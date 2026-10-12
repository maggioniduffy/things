import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignedUrls } from "./use-signed-urls";

const createSignedUrls = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from } }),
}));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  createSignedUrls.mockReset();
  from.mockReset();
  from.mockReturnValue({ createSignedUrls });
  createSignedUrls.mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })),
    error: null,
  }));
});

describe("useSignedUrls", () => {
  it("signs N paths with one createSignedUrls call (1 h expiry)", async () => {
    const { result } = renderHook(
      () => useSignedUrls(["u/a/thumb.webp", "u/b/thumb.webp", "u/c/x.png"]),
      {
        wrapper: wrapper(),
      },
    );

    await waitFor(() => expect(result.current.size).toBe(3));
    expect(from).toHaveBeenCalledWith("things");
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(
      ["u/a/thumb.webp", "u/b/thumb.webp", "u/c/x.png"],
      3600,
    );
    expect(result.current.get("u/b/thumb.webp")).toBe("https://signed/u/b/thumb.webp");
  });

  it("makes no request for empty input or only null/undefined paths", () => {
    const { result } = renderHook(() => useSignedUrls([null, undefined]), { wrapper: wrapper() });
    expect(result.current.size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();

    const empty = renderHook(() => useSignedUrls([]), { wrapper: wrapper() });
    expect(empty.result.current.size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("dedupes and ignores order: the same set is one cache entry", async () => {
    const Wrapper = wrapper();
    const first = renderHook(() => useSignedUrls(["b", null, "a", "b"]), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.size).toBe(2));
    expect(createSignedUrls).toHaveBeenCalledWith(["a", "b"], 3600);

    const second = renderHook(() => useSignedUrls(["a", "b"]), { wrapper: Wrapper });
    await waitFor(() => expect(second.result.current.size).toBe(2));
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("does not re-request when the caller passes a fresh array with the same paths", async () => {
    const { result, rerender } = renderHook(({ list }) => useSignedUrls(list), {
      wrapper: wrapper(),
      initialProps: { list: ["a", "b"] },
    });
    await waitFor(() => expect(result.current.size).toBe(2));
    rerender({ list: ["a", "b"] });
    rerender({ list: ["b", "a"] });
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("requests a new batch when the set changes and keeps old URLs meanwhile", async () => {
    const { result, rerender } = renderHook(({ list }) => useSignedUrls(list), {
      wrapper: wrapper(),
      initialProps: { list: ["a"] },
    });
    await waitFor(() => expect(result.current.get("a")).toBe("https://signed/a"));

    rerender({ list: ["a", "b"] });
    expect(result.current.get("a")).toBe("https://signed/a");
    await waitFor(() => expect(result.current.get("b")).toBe("https://signed/b"));
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
  });

  it("leaves paths that could not be signed out of the map", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "ok", signedUrl: "https://signed/ok", error: null },
        { path: "gone", signedUrl: null, error: "Object not found" },
      ],
      error: null,
    });
    const { result } = renderHook(() => useSignedUrls(["ok", "gone"]), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.has("gone")).toBe(false);
  });

  it("returns an empty map when the request fails", async () => {
    createSignedUrls.mockResolvedValue({ data: null, error: new Error("boom") });
    const { result } = renderHook(() => useSignedUrls(["a"]), { wrapper: wrapper() });
    await waitFor(() => expect(createSignedUrls).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});
