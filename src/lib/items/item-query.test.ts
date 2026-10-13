import { describe, expect, it, vi } from "vitest";
import { fetchItemById, isItemId } from "./item-query";
import { ITEM_COLUMNS } from "./queries";

const ID = "11111111-1111-4111-8111-111111111111";

function clientReturning(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  const chain = {
    select: (...args: unknown[]) => (calls.push(["select", ...args]), chain),
    eq: (...args: unknown[]) => (calls.push(["eq", ...args]), chain),
    maybeSingle: () => Promise.resolve(result),
  };
  return { client: { from: vi.fn(() => chain) } as never, calls };
}

describe("isItemId", () => {
  it("accepts uuids only", () => {
    expect(isItemId(ID)).toBe(true);
    expect(isItemId("nope")).toBe(false);
    expect(isItemId("")).toBe(false);
  });
});

describe("fetchItemById", () => {
  it("selects the explicit column list by id", async () => {
    const row = { id: ID };
    const { client, calls } = clientReturning({ data: row, error: null });
    await expect(fetchItemById(client, ID)).resolves.toBe(row);
    expect(calls).toEqual([
      ["select", ITEM_COLUMNS],
      ["eq", "id", ID],
    ]);
  });

  it("returns null for a missing or foreign item", async () => {
    const { client } = clientReturning({ data: null, error: null });
    await expect(fetchItemById(client, ID)).resolves.toBeNull();
  });

  it("never asks the database about an id that is not a uuid", async () => {
    const { client } = clientReturning({ data: { id: "x" }, error: null });
    await expect(fetchItemById(client, "nope")).resolves.toBeNull();
    expect((client as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it("throws database errors", async () => {
    const { client } = clientReturning({ data: null, error: new Error("boom") });
    await expect(fetchItemById(client, ID)).rejects.toThrow("boom");
  });
});
