import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { itemQueryKey } from "@/lib/items/item-query";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import { useCloseItem, useOpenItem } from "./item-param";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/app/c/abc",
}));

const ITEM = makeItem({ id: "11111111-1111-4111-8111-111111111111" });

function setup() {
  const queryClient = makeTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper: Wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/app/c/abc");
});

describe("useOpenItem", () => {
  it("pushes ?item=<id> on the current view path and seeds the item's cache entry", () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useOpenItem(), { wrapper });
    result.current(ITEM);
    expect(mocks.push).toHaveBeenCalledWith(`/app/c/abc?item=${ITEM.id}`, { scroll: false });
    expect(queryClient.getQueryData(itemQueryKey(ITEM.id))).toEqual(ITEM);
  });

  it("keeps other params such as ?sort=", () => {
    window.history.replaceState(null, "", "/app/c/abc?sort=title");
    const { wrapper } = setup();
    const { result } = renderHook(() => useOpenItem(), { wrapper });
    result.current(ITEM);
    expect(mocks.push).toHaveBeenCalledWith(`/app/c/abc?sort=title&item=${ITEM.id}`, {
      scroll: false,
    });
  });
});

describe("useCloseItem", () => {
  it("replaces the URL without ?item=, keeping the rest", () => {
    window.history.replaceState(null, "", `/app/c/abc?sort=title&item=${ITEM.id}`);
    const { wrapper } = setup();
    const { result } = renderHook(() => useCloseItem(), { wrapper });
    result.current();
    expect(mocks.replace).toHaveBeenCalledWith("/app/c/abc?sort=title", { scroll: false });
  });

  it("drops the query string when ?item= was the only param", () => {
    window.history.replaceState(null, "", `/app/c/abc?item=${ITEM.id}`);
    const { wrapper } = setup();
    const { result } = renderHook(() => useCloseItem(), { wrapper });
    result.current();
    expect(mocks.replace).toHaveBeenCalledWith("/app/c/abc", { scroll: false });
  });
});
