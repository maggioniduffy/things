import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Supabase Free per-file limit (also the `things` bucket's `file_size_limit`). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Per-file cap for guests (the storage trigger enforces it; the 25 MB total lives in the DB). */
export const GUEST_MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Files larger than this go through resumable (TUS) uploads, which report progress. */
export const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024;
export const BUCKET = "things";

/** TUS chunk size. Supabase's hosted docs require 6 MB; the local stack accepts any size. */
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;
/** Longest storage-safe object name we produce (extension included). */
const MAX_NAME_LENGTH = 100;

export type UploadErrorCode =
  "too_large" | "guest_file_too_large" | "guest_quota" | "network" | "aborted" | "unknown";

/** Typed upload failure: callers branch on `code` (toast copy lives in the UI, not here). */
export class UploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = "UploadError";
    this.code = code;
  }
}

/**
 * Storage-safe object name: NFKD, strip diacritics, keep `[A-Za-z0-9._-]` (everything else
 * becomes "_", repeats collapse), keep the extension, at most 100 characters, never empty.
 * "Canción final.PDF" -> "Cancion_final.PDF".
 */
export function safeObjectName(fileName: string): string {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    // No hidden files, and ".." can never survive as a whole name.
    .replace(/^\.+/, "");

  // The extension is the last ".alnum" run; anything odder is just part of the name.
  const extension = cleaned.match(/\.[A-Za-z0-9]{1,19}$/)?.[0] ?? "";
  let base = cleaned.slice(0, cleaned.length - extension.length);
  base = base.slice(0, MAX_NAME_LENGTH - extension.length);

  // A name that was only emoji/punctuation ends up as underscores or dots: call it "file".
  if (/^[._]*$/.test(base)) base = "file";
  return `${base}${extension}`;
}

/** Object path of a saved file: `things/{user_id}/{item_id}/{safe name}` (bucket not included). */
export function filePath(userId: string, itemId: string, fileName: string): string {
  return `${userId}/${itemId}/${safeObjectName(fileName)}`;
}

/** Object path of an item's thumbnail. */
export function thumbnailPath(userId: string, itemId: string): string {
  return `${userId}/${itemId}/thumb.webp`;
}

/** Client-side size check, run before anything is inserted. `null` means the file is fine. */
export function checkFileSize(size: number, opts: { isGuest: boolean }): UploadError | null {
  if (size > MAX_FILE_BYTES) {
    return new UploadError("too_large", "This file is over the 50 MB limit.");
  }
  if (opts.isGuest && size > GUEST_MAX_FILE_BYTES) {
    return new UploadError("guest_file_too_large", "Guest accounts can upload files up to 10 MB.");
  }
  return null;
}

/** `null` = indeterminate (the standard upload has no progress events). */
export type UploadProgress = { loaded: number; total: number } | null;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/** What we can read off a storage-js error, a tus `DetailedError`, or a plain fetch failure. */
type ErrorFacts = { status: number | undefined; text: string; hasResponse: boolean };

function readFacts(error: unknown): ErrorFacts {
  if (typeof error !== "object" || error === null) {
    return { status: undefined, text: String(error ?? ""), hasResponse: false };
  }
  const e = error as {
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
    error?: unknown;
    originalResponse?: { getStatus?: () => number; getBody?: () => string } | null;
  };

  const parts: string[] = [];
  if (typeof e.message === "string") parts.push(e.message);
  if (typeof e.error === "string") parts.push(e.error);

  let status: number | undefined;
  if (typeof e.status === "number") status = e.status;
  else if (typeof e.statusCode === "string" && /^\d{3}$/.test(e.statusCode)) {
    status = Number(e.statusCode);
  }

  // tus DetailedError: the HTTP response, when the failure came from one (null for network errors).
  const response = e.originalResponse;
  if (response) {
    const responseStatus = response.getStatus?.();
    if (typeof responseStatus === "number" && responseStatus > 0) status ??= responseStatus;
    const body = response.getBody?.();
    if (typeof body === "string") parts.push(body);
  }

  return { status, text: parts.join(" "), hasResponse: status !== undefined || Boolean(response) };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/**
 * Maps a storage-js error or a tus `DetailedError` to an `UploadError`.
 * - 413 or a "too large" message -> `too_large`
 * - `guest_quota_exceeded` in the message -> `guest_quota`
 * - a 500 on a guest upload -> `guest_quota`: the storage trigger's exception surfaces as a
 *   generic 500 `DatabaseError` (orchestration section 9; "database error, code: P0001" via TUS)
 * - no HTTP response at all (fetch/XHR failure) -> `network`
 */
export function toUploadError(error: unknown, opts: { isGuest: boolean }): UploadError {
  if (error instanceof UploadError) return error;
  if (isAbortError(error)) return new UploadError("aborted", "Upload cancelled.", { cause: error });

  const { status, text, hasResponse } = readFacts(error);
  const lower = text.toLowerCase();

  if (lower.includes("guest_quota_exceeded")) {
    return new UploadError("guest_quota", "Guest storage is full.", { cause: error });
  }
  if (
    status === 413 ||
    lower.includes("payload too large") ||
    lower.includes("exceeded the maximum allowed size") ||
    lower.includes("maximum size exceeded")
  ) {
    return new UploadError("too_large", "This file is over the 50 MB limit.", { cause: error });
  }
  if (opts.isGuest && status === 500) {
    return new UploadError("guest_quota", "Guest storage is full.", { cause: error });
  }
  if (!hasResponse) {
    return new UploadError("network", "Network error while uploading.", { cause: error });
  }
  return new UploadError("unknown", text || "Upload failed.", { cause: error });
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

type UploadArgs = {
  client: SupabaseClient<Database>;
  file: File | Blob;
  /** Object path inside the `things` bucket (see `filePath` / `thumbnailPath`). */
  path: string;
  contentType: string;
  isGuest: boolean;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/**
 * Uploads one object to the `things` bucket (never overwrites). Up to 6 MB uses the standard
 * upload (indeterminate progress); above that, resumable TUS with real progress.
 * Throws `UploadError`.
 */
export async function uploadFile(args: UploadArgs): Promise<void> {
  if (args.signal?.aborted) throw new UploadError("aborted", "Upload cancelled.");
  args.onProgress?.(null);

  if (args.file.size > RESUMABLE_THRESHOLD_BYTES) {
    await uploadResumable(args);
  } else {
    await uploadStandard(args);
  }
  args.onProgress?.({ loaded: args.file.size, total: args.file.size });
}

async function uploadStandard({ client, file, path, contentType, isGuest, signal }: UploadArgs) {
  // storage-js ignores `contentType` for Blob bodies (the multipart part takes the Blob's own
  // type), so hand it a File that carries the right type.
  const name = path.split("/").pop() ?? "file";
  const body = new File([file], name, { type: contentType });

  const request = (async () => {
    try {
      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, body, { contentType, upsert: false, cacheControl: "3600" });
      if (error) throw toUploadError(error, { isGuest });
    } catch (error) {
      // storage-js returns API errors but can throw on fetch failures.
      throw toUploadError(error, { isGuest });
    }
  })();

  if (!signal) return request;

  // storage-js has no abort hook: on abort we stop waiting, but the request may still finish.
  // The caller owns cleanup (remove the object) if it cares.
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(new UploadError("aborted", "Upload cancelled."));
    signal.addEventListener("abort", onAbort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function uploadResumable({
  client,
  file,
  path,
  contentType,
  isGuest,
  onProgress,
  signal,
}: UploadArgs): Promise<void> {
  const { url, publishableKey } = getSupabaseEnv();
  // Lazy: tus-js-client only loads when a large file is actually saved.
  const { Upload } = await import("tus-js-client");
  if (signal?.aborted) throw new UploadError("aborted", "Upload cancelled.");

  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${url}/storage/v1/upload/resumable`,
      headers: { apikey: publishableKey, "x-upsert": "false" },
      // Read the token per request so a refresh during a long upload is picked up.
      onBeforeRequest: async (request) => {
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token;
        if (token) request.setHeader("authorization", `Bearer ${token}`);
      },
      metadata: { bucketName: BUCKET, objectName: path, contentType, cacheControl: "3600" },
      chunkSize: TUS_CHUNK_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000],
      // tus' default retries 5xx. For a guest a 500 is the quota trigger: retrying only delays the toast.
      onShouldRetry: (error) => {
        const mapped = toUploadError(error, { isGuest });
        if (mapped.code === "guest_quota" || mapped.code === "too_large") return false;
        const status = (
          error as { originalResponse?: { getStatus(): number } }
        ).originalResponse?.getStatus();
        const clientError = status !== undefined && status >= 400 && status < 500;
        return (!clientError || status === 409 || status === 423) && navigator.onLine !== false;
      },
      onProgress: (loaded, total) => onProgress?.({ loaded, total }),
      onError: (error) => {
        cleanup();
        reject(toUploadError(error, { isGuest }));
      },
      onSuccess: () => {
        cleanup();
        resolve();
      },
    });

    const onAbort = () => {
      cleanup();
      // `true` also terminates the upload on the server so no partial object lingers.
      void upload.abort(true).catch(() => {});
      reject(new UploadError("aborted", "Upload cancelled."));
    };
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    signal?.addEventListener("abort", onAbort, { once: true });
    upload.start();
  });
}
