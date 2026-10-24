import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import type { Database } from "../src/types/supabase";
import { BUCKET, UploadError, filePath, uploadFile } from "../src/lib/items/upload";
import { getOtpCode, uniqueEmail } from "./mailpit";
import { supabasePublicEnv } from "./helpers/session";

// WP 3.3: the real upload pipeline (`uploadFile`) against the local stack, driven from Node
// (no UI needed). Node's tus-js-client build takes a Buffer, so large bodies are Buffers that
// also carry a `size`, which is all `uploadFile` reads from a File.

const MB = 1024 * 1024;

type Client = SupabaseClient<Database>;

// `getSupabaseEnv` (used by the TUS branch) reads process.env, which playwright.config.ts fills.
const { url, publishableKey } = supabasePublicEnv();
process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey;

function newClient(): Client {
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function guestClient() {
  const client = newClient();
  const { data, error } = await client.auth.signInAnonymously();
  expect(error).toBeNull();
  return { client, userId: data.user?.id ?? "" };
}

/** Signed-in (non-guest) user through the same email OTP flow the app uses. */
async function signedInClient() {
  const client = newClient();
  const email = uniqueEmail("upload");
  const sent = await client.auth.signInWithOtp({ email });
  expect(sent.error).toBeNull();
  const verified = await client.auth.verifyOtp({
    email,
    token: await getOtpCode(email),
    type: "email",
  });
  expect(verified.error).toBeNull();
  return { client, userId: verified.data.user?.id ?? "" };
}

function bytes(size: number): File {
  const body = Buffer.alloc(size, 7);
  return Object.assign(body, { size, type: "" }) as unknown as File;
}

let itemCounter = 0;
function newItemId() {
  return `00000000-0000-4000-8000-${String(Date.now() + itemCounter++).padStart(12, "0")}`;
}

async function objectNames(client: Client, userId: string, itemId: string) {
  const { data, error } = await client.storage.from(BUCKET).list(`${userId}/${itemId}`);
  expect(error).toBeNull();
  return (data ?? []).map((entry) => entry.name);
}

async function upload(
  client: Client,
  userId: string,
  isGuest: boolean,
  size: number,
  name = "Canción.bin",
) {
  const itemId = newItemId();
  const progress: ({ loaded: number; total: number } | null)[] = [];
  await uploadFile({
    client,
    file: bytes(size),
    path: filePath(userId, itemId, name),
    contentType: "application/octet-stream",
    isGuest,
    onProgress: (value) => progress.push(value),
  });
  return { itemId, progress };
}

async function expectUploadError(promise: Promise<unknown>, code: UploadError["code"]) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(UploadError);
  expect((error as UploadError).code).toBe(code);
}

test.describe("upload pipeline", () => {
  test("a guest 1 MB standard upload succeeds, lands at the safe path and gets a working signed URL", async () => {
    const { client, userId } = await guestClient();

    const { itemId, progress } = await upload(client, userId, true, 1 * MB);

    expect(await objectNames(client, userId, itemId)).toEqual(["Cancion.bin"]);
    expect(progress[0]).toBeNull();
    expect(progress.at(-1)).toEqual({ loaded: 1 * MB, total: 1 * MB });

    const path = filePath(userId, itemId, "Canción.bin");
    const { data, error } = await client.storage.from(BUCKET).createSignedUrls([path], 3600);
    expect(error).toBeNull();
    const signedUrl = data?.[0]?.signedUrl;
    expect(signedUrl).toBeTruthy();
    const response = await fetch(signedUrl ?? "");
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(1 * MB);
  });

  test("a guest 7 MB upload goes through TUS, reports progress and the object exists", async () => {
    const { client, userId } = await guestClient();

    const { itemId, progress } = await upload(client, userId, true, 7 * MB);

    expect(await objectNames(client, userId, itemId)).toEqual(["Cancion.bin"]);
    const real = progress.filter((entry) => entry !== null);
    expect(real.length).toBeGreaterThan(1);
    expect(real.at(-1)).toEqual({ loaded: 7 * MB, total: 7 * MB });
  });

  test("an 11 MB guest TUS upload is rejected by the storage trigger as guest_quota", async () => {
    const { client, userId } = await guestClient();
    const itemId = newItemId();

    await expectUploadError(
      uploadFile({
        client,
        file: bytes(11 * MB),
        path: filePath(userId, itemId, "huge.bin"),
        contentType: "application/octet-stream",
        isGuest: true,
      }),
      "guest_quota",
    );
    expect(await objectNames(client, userId, itemId)).toEqual([]);
  });

  test("a second guest pushing the total past 25 MB is rejected, earlier files stay", async () => {
    const { client, userId } = await guestClient();

    const kept = [];
    for (let n = 0; n < 3; n++)
      kept.push((await upload(client, userId, true, 7 * MB, `part${n}.bin`)).itemId);

    // 21 MB used; another 7 MB makes 28 MB.
    await expectUploadError(upload(client, userId, true, 7 * MB, "part3.bin"), "guest_quota");

    for (const itemId of kept) expect(await objectNames(client, userId, itemId)).toHaveLength(1);
  });

  test("a signed-in user uploads 20 MB over TUS, but 60 MB is rejected as too_large", async () => {
    const { client, userId } = await signedInClient();

    const { itemId } = await upload(client, userId, false, 20 * MB);
    expect(await objectNames(client, userId, itemId)).toEqual(["Cancion.bin"]);

    // `checkFileSize` would stop this before upload; here we confirm the server's 413 maps too.
    await expectUploadError(upload(client, userId, false, 60 * MB), "too_large");
  });

  test("aborting a TUS upload rejects with aborted and leaves no object behind", async () => {
    const { client, userId } = await signedInClient();
    const itemId = newItemId();
    const controller = new AbortController();

    const pending = uploadFile({
      client,
      file: bytes(30 * MB),
      path: filePath(userId, itemId, "abort.bin"),
      contentType: "application/octet-stream",
      isGuest: false,
      signal: controller.signal,
      onProgress: (value) => {
        if (value && value.loaded > 0) controller.abort();
      },
    });

    await expectUploadError(pending, "aborted");
    expect(await objectNames(client, userId, itemId)).toEqual([]);
  });
});
