import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/supabase";
import {
  BUCKET,
  GUEST_MAX_FILE_BYTES,
  MAX_FILE_BYTES,
  RESUMABLE_THRESHOLD_BYTES,
  UploadError,
  checkFileSize,
  filePath,
  safeObjectName,
  thumbnailPath,
  toUploadError,
  uploadFile,
} from "./upload";

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({ url: "http://supabase.test", publishableKey: "pk_test" }),
}));

// A scriptable stand-in for tus-js-client's Upload: tests set `tusBehavior` to drive callbacks.
type TusOptions = {
  endpoint: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  chunkSize: number;
  uploadDataDuringCreation: boolean;
  removeFingerprintOnSuccess: boolean;
  retryDelays: number[];
  onBeforeRequest: (request: { setHeader(name: string, value: string): void }) => Promise<void>;
  onShouldRetry: (error: unknown) => boolean;
  onProgress: (loaded: number, total: number) => void;
  onError: (error: Error) => void;
  onSuccess: () => void;
};
const tus = vi.hoisted(() => ({
  instances: [] as { file: unknown; options: unknown; abort: ReturnType<typeof vi.fn> }[],
  behavior: undefined as undefined | ((options: unknown) => void),
}));
vi.mock("tus-js-client", () => ({
  Upload: class {
    abort = vi.fn(() => Promise.resolve());
    constructor(
      public file: unknown,
      public options: unknown,
    ) {
      tus.instances.push(this);
    }
    start() {
      tus.behavior?.(this.options);
    }
  },
}));

/** tus DetailedError look-alike: `originalResponse` is null for network failures. */
function tusError(status: number | null, body = "") {
  return Object.assign(new Error("tus: unexpected response"), {
    originalResponse: status === null ? null : { getStatus: () => status, getBody: () => body },
  });
}

type StorageResult = { data: unknown; error: unknown };
function fakeClient(upload: (...args: unknown[]) => Promise<StorageResult> | StorageResult) {
  const uploadSpy = vi.fn(async (...args: unknown[]) => upload(...args));
  const from = vi.fn(() => ({ upload: uploadSpy }));
  const getSession = vi.fn(async () => ({ data: { session: { access_token: "jwt-1" } } }));
  const client = {
    storage: { from },
    auth: { getSession },
  } as unknown as SupabaseClient<Database>;
  return { client, uploadSpy, from, getSession };
}

function fileOfSize(size: number, type = "application/pdf") {
  return new File([new Uint8Array(size)], "doc.pdf", { type });
}

beforeEach(() => {
  tus.instances.length = 0;
  tus.behavior = undefined;
});

describe("constants", () => {
  it("matches the Supabase Free limits", () => {
    expect(MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
    expect(GUEST_MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(RESUMABLE_THRESHOLD_BYTES).toBe(6 * 1024 * 1024);
    expect(BUCKET).toBe("things");
  });
});

describe("safeObjectName", () => {
  it.each([
    ["Canción final.PDF", "Cancion_final.PDF"],
    ["report.pdf", "report.pdf"],
    ["my   spaced  name.txt", "my_spaced_name.txt"],
    ["a (1) [copy].png", "a_1_copy_.png"],
    ["Ünïcödé–Ñame.docx", "Unicode_Name.docx"],
    ["archive.tar.gz", "archive.tar.gz"],
    ["../x", "_x"],
    ["../../etc/passwd", "_.._etc_passwd"],
    ["C:\\Users\\me\\file.txt", "C_Users_me_file.txt"],
    ["pic 😀.png", "pic_.png"],
    ["😀😀😀.png", "file.png"],
    ["README", "README"],
    [".env", "env"],
    [".gitignore", "gitignore"],
    ["..", "file"],
    ["", "file"],
    ["???", "file"],
  ])("%j -> %j", (input, expected) => {
    expect(safeObjectName(input)).toBe(expected);
  });

  it("keeps names at 100 characters or fewer and preserves the extension", () => {
    const name = safeObjectName(`${"a".repeat(300)}.pdf`);
    expect(name).toHaveLength(100);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("truncates a name with no extension and drops an absurdly long extension", () => {
    expect(safeObjectName("b".repeat(250))).toHaveLength(100);
    const odd = safeObjectName(`x.${"c".repeat(150)}`);
    expect(odd.length).toBeLessThanOrEqual(100);
    expect(odd.length).toBeGreaterThan(0);
  });

  it("only emits storage-safe characters", () => {
    expect(safeObjectName("ñ/é\\ü*?\"<>|:;,'#%&{}$!`~^=+@ x")).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe("paths", () => {
  it("builds the file and thumbnail object paths", () => {
    expect(filePath("u1", "i1", "Canción final.PDF")).toBe("u1/i1/Cancion_final.PDF");
    expect(thumbnailPath("u1", "i1")).toBe("u1/i1/thumb.webp");
  });
});

describe("checkFileSize", () => {
  it("accepts files within the limits", () => {
    expect(checkFileSize(MAX_FILE_BYTES, { isGuest: false })).toBeNull();
    expect(checkFileSize(GUEST_MAX_FILE_BYTES, { isGuest: true })).toBeNull();
    expect(checkFileSize(0, { isGuest: true })).toBeNull();
  });

  it("rejects anything over 50 MB as too_large", () => {
    expect(checkFileSize(MAX_FILE_BYTES + 1, { isGuest: false })?.code).toBe("too_large");
    expect(checkFileSize(MAX_FILE_BYTES + 1, { isGuest: true })?.code).toBe("too_large");
  });

  it("rejects guest files over 10 MB, but not signed-in ones", () => {
    const error = checkFileSize(GUEST_MAX_FILE_BYTES + 1, { isGuest: true });
    expect(error).toBeInstanceOf(UploadError);
    expect(error?.code).toBe("guest_file_too_large");
    expect(checkFileSize(GUEST_MAX_FILE_BYTES + 1, { isGuest: false })).toBeNull();
  });
});

describe("toUploadError", () => {
  const storageError = (status: number, message: string, statusCode = String(status)) =>
    Object.assign(new Error(message), { status, statusCode });

  it("maps 413 and size messages to too_large", () => {
    expect(toUploadError(storageError(413, "Payload too large"), { isGuest: false }).code).toBe(
      "too_large",
    );
    expect(
      toUploadError(
        { message: "The object exceeded the maximum allowed size", statusCode: "400" },
        { isGuest: false },
      ).code,
    ).toBe("too_large");
    expect(toUploadError(tusError(413, "Maximum size exceeded\n"), { isGuest: true }).code).toBe(
      "too_large",
    );
  });

  it("maps guest_quota_exceeded anywhere in the message to guest_quota", () => {
    expect(
      toUploadError(storageError(400, "new row violates: guest_quota_exceeded"), {
        isGuest: false,
      }).code,
    ).toBe("guest_quota");
  });

  it("maps a 500 on a guest upload to guest_quota, but not for signed-in users", () => {
    const generic500 = storageError(500, "DatabaseError");
    expect(toUploadError(generic500, { isGuest: true }).code).toBe("guest_quota");
    expect(toUploadError(generic500, { isGuest: false }).code).toBe("unknown");
  });

  it("maps tus DetailedErrors by status and body", () => {
    expect(
      toUploadError(tusError(500, "database error, code: P0001"), { isGuest: true }).code,
    ).toBe("guest_quota");
    expect(toUploadError(tusError(500, "boom"), { isGuest: false }).code).toBe("unknown");
    expect(toUploadError(tusError(403, "denied"), { isGuest: true }).code).toBe("unknown");
  });

  it("maps failures without any HTTP response to network", () => {
    expect(toUploadError(new TypeError("Failed to fetch"), { isGuest: true }).code).toBe("network");
    expect(toUploadError(tusError(null), { isGuest: true }).code).toBe("network");
  });

  it("maps AbortError to aborted and passes UploadError through", () => {
    expect(toUploadError(new DOMException("aborted", "AbortError"), { isGuest: false }).code).toBe(
      "aborted",
    );
    const original = new UploadError("guest_quota");
    expect(toUploadError(original, { isGuest: false })).toBe(original);
  });

  it("falls back to unknown", () => {
    expect(toUploadError(storageError(409, "Duplicate"), { isGuest: false }).code).toBe("unknown");
    expect(toUploadError("weird", { isGuest: false }).code).toBe("network");
  });
});

describe("uploadFile: standard branch (<= 6 MB)", () => {
  it("uploads through storage with the content type on a wrapping File and reports progress", async () => {
    const { client, uploadSpy, from } = fakeClient(() => ({ data: {}, error: null }));
    const onProgress = vi.fn();
    const file = fileOfSize(1024, "application/octet-stream");

    await uploadFile({
      client,
      file,
      path: "u1/i1/doc.pdf",
      contentType: "application/pdf",
      isGuest: false,
      onProgress,
    });

    expect(from).toHaveBeenCalledWith("things");
    const [path, body, options] = uploadSpy.mock.calls[0] as [string, File, object];
    expect(path).toBe("u1/i1/doc.pdf");
    expect(body).toBeInstanceOf(File);
    expect(body.type).toBe("application/pdf");
    expect(body.name).toBe("doc.pdf");
    expect(options).toEqual({
      contentType: "application/pdf",
      upsert: false,
      cacheControl: "3600",
    });
    expect(onProgress.mock.calls).toEqual([[null], [{ loaded: 1024, total: 1024 }]]);
    expect(tus.instances).toHaveLength(0);
  });

  it("uses the standard branch at exactly 6 MB", async () => {
    const { client, uploadSpy } = fakeClient(() => ({ data: {}, error: null }));
    await uploadFile({
      client,
      file: fileOfSize(RESUMABLE_THRESHOLD_BYTES),
      path: "u/i/f.pdf",
      contentType: "application/pdf",
      isGuest: false,
    });
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(tus.instances).toHaveLength(0);
  });

  it("throws a typed error for storage errors and fetch failures", async () => {
    const quota = fakeClient(() => ({
      data: null,
      error: Object.assign(new Error("DatabaseError"), { status: 500, statusCode: "500" }),
    }));
    await expect(
      uploadFile({
        client: quota.client,
        file: fileOfSize(10),
        path: "u/i/f.pdf",
        contentType: "application/pdf",
        isGuest: true,
      }),
    ).rejects.toMatchObject({ name: "UploadError", code: "guest_quota" });

    const offline = fakeClient(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      uploadFile({
        client: offline.client,
        file: fileOfSize(10),
        path: "u/i/f.pdf",
        contentType: "application/pdf",
        isGuest: false,
      }),
    ).rejects.toMatchObject({ code: "network" });
  });

  it("rejects with aborted without starting when the signal is already aborted", async () => {
    const { client, uploadSpy } = fakeClient(() => ({ data: {}, error: null }));
    const controller = new AbortController();
    controller.abort();
    await expect(
      uploadFile({
        client,
        file: fileOfSize(10),
        path: "u/i/f.pdf",
        contentType: "application/pdf",
        isGuest: false,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("stops waiting and rejects with aborted when aborted mid-flight", async () => {
    const { client } = fakeClient(() => new Promise<StorageResult>(() => {}));
    const controller = new AbortController();
    const pending = uploadFile({
      client,
      file: fileOfSize(10),
      path: "u/i/f.pdf",
      contentType: "application/pdf",
      isGuest: false,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
  });
});

describe("uploadFile: resumable branch (> 6 MB)", () => {
  const big = () => fileOfSize(RESUMABLE_THRESHOLD_BYTES + 1);

  it("configures tus for the Supabase endpoint and reports progress", async () => {
    const { client, uploadSpy, getSession } = fakeClient(() => ({ data: {}, error: null }));
    tus.behavior = (raw) => {
      const options = raw as TusOptions;
      options.onProgress(100, 200);
      options.onProgress(200, 200);
      options.onSuccess();
    };
    const onProgress = vi.fn();
    const file = big();

    await uploadFile({
      client,
      file,
      path: "u1/i1/big.pdf",
      contentType: "application/pdf",
      isGuest: false,
      onProgress,
    });

    expect(uploadSpy).not.toHaveBeenCalled();
    const instance = tus.instances[0];
    expect(instance?.file).toBe(file);
    const options = instance?.options as TusOptions;
    expect(options.endpoint).toBe("http://supabase.test/storage/v1/upload/resumable");
    expect(options.headers).toEqual({ apikey: "pk_test", "x-upsert": "false" });
    expect(options.metadata).toEqual({
      bucketName: "things",
      objectName: "u1/i1/big.pdf",
      contentType: "application/pdf",
      cacheControl: "3600",
    });
    expect(options.chunkSize).toBe(6 * 1024 * 1024);
    expect(options.uploadDataDuringCreation).toBe(true);
    expect(options.removeFingerprintOnSuccess).toBe(true);
    expect(options.retryDelays).toEqual([0, 1000, 3000]);

    // The access token is read fresh for every request.
    const setHeader = vi.fn();
    await options.onBeforeRequest({ setHeader });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith("authorization", "Bearer jwt-1");

    expect(onProgress.mock.calls).toEqual([
      [null],
      [{ loaded: 100, total: 200 }],
      [{ loaded: 200, total: 200 }],
      [{ loaded: file.size, total: file.size }],
    ]);
  });

  it("maps a guest 500 from tus to guest_quota and does not retry it", async () => {
    const { client } = fakeClient(() => ({ data: {}, error: null }));
    let shouldRetry: boolean | undefined;
    tus.behavior = (raw) => {
      const options = raw as TusOptions;
      const error = tusError(500, "database error, code: P0001");
      shouldRetry = options.onShouldRetry(error);
      options.onError(error);
    };
    await expect(
      uploadFile({
        client,
        file: big(),
        path: "u/i/big.pdf",
        contentType: "application/pdf",
        isGuest: true,
      }),
    ).rejects.toMatchObject({ code: "guest_quota" });
    expect(shouldRetry).toBe(false);
  });

  it("retries network failures and 5xx for signed-in users, but not other 4xx", async () => {
    const { client } = fakeClient(() => ({ data: {}, error: null }));
    const decisions: boolean[] = [];
    tus.behavior = (raw) => {
      const options = raw as TusOptions;
      decisions.push(
        options.onShouldRetry(tusError(null)),
        options.onShouldRetry(tusError(500, "oops")),
        options.onShouldRetry(tusError(409)),
        options.onShouldRetry(tusError(403)),
        options.onShouldRetry(tusError(413)),
      );
      options.onSuccess();
    };
    await uploadFile({
      client,
      file: big(),
      path: "u/i/big.pdf",
      contentType: "application/pdf",
      isGuest: false,
    });
    expect(decisions).toEqual([true, true, true, false, false]);
  });

  it("maps 413 to too_large and network errors to network", async () => {
    const { client } = fakeClient(() => ({ data: {}, error: null }));
    for (const [error, code] of [
      [tusError(413, "Maximum size exceeded\n"), "too_large"],
      [tusError(null), "network"],
    ] as const) {
      tus.behavior = (raw) => (raw as TusOptions).onError(error);
      await expect(
        uploadFile({
          client,
          file: big(),
          path: "u/i/big.pdf",
          contentType: "application/pdf",
          isGuest: false,
        }),
      ).rejects.toMatchObject({ code });
    }
  });

  it("aborts the upload (terminating it on the server) when the signal fires", async () => {
    const { client } = fakeClient(() => ({ data: {}, error: null }));
    tus.behavior = () => {}; // never completes
    const controller = new AbortController();
    const pending = uploadFile({
      client,
      file: big(),
      path: "u/i/big.pdf",
      contentType: "application/pdf",
      isGuest: false,
      signal: controller.signal,
    });
    // Let the lazy tus import resolve and the upload start.
    await vi.waitFor(() => expect(tus.instances).toHaveLength(1));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    expect(tus.instances[0]?.abort).toHaveBeenCalledWith(true);
  });
});
