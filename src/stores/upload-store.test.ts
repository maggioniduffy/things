import { beforeEach, describe, expect, it } from "vitest";
import { useUploadStore } from "./upload-store";

describe("useUploadStore", () => {
  beforeEach(() => useUploadStore.setState({ progress: {} }));

  it("tracks determinate and indeterminate progress per item", () => {
    useUploadStore.getState().set("a", null);
    useUploadStore.getState().set("b", { loaded: 5, total: 10 });
    expect(useUploadStore.getState().progress).toEqual({ a: null, b: { loaded: 5, total: 10 } });
  });

  it("clears one item and ignores unknown ids", () => {
    useUploadStore.getState().set("a", null);
    useUploadStore.getState().set("b", null);
    useUploadStore.getState().clear("a");
    expect(Object.keys(useUploadStore.getState().progress)).toEqual(["b"]);

    const before = useUploadStore.getState();
    useUploadStore.getState().clear("missing");
    expect(useUploadStore.getState()).toBe(before);
  });
});
