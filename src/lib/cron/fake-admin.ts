import type { AdminClient } from "@/lib/supabase/admin";

/** In-memory stand-in for the slice of the admin client the cron steps use. Test helper only. */

export type FakeItem = {
  id: string;
  file_path: string | null;
  thumbnail_path: string | null;
  deleted_at: string | null;
};

export type FakeState = {
  items: FakeItem[];
  unfurl: { created_at: string }[];
  /** Storage objects: path (without bucket) -> created_at. */
  objects: Map<string, string>;
  /** Return true to make a `remove` call fail. */
  failRemove?: (paths: string[]) => boolean;
  /** Ordered log of side effects, e.g. "storage.remove", "items.delete". */
  calls: string[];
};

export function newFakeState(): FakeState {
  return { items: [], unfurl: [], objects: new Map(), calls: [] };
}

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

function builder(state: FakeState, table: "items" | "unfurl_log") {
  const filters: Filter[] = [];
  let op: "select" | "delete" = "select";
  let order: string | null = null;
  let limit = Infinity;
  let wantCount = false;
  let returning = false;

  const add = (filter: Filter) => {
    filters.push(filter);
    return api;
  };

  const run = () => {
    const source = (table === "items" ? state.items : state.unfurl) as Row[];
    let rows = source.filter((row) => filters.every((filter) => filter(row)));
    if (op === "delete") {
      state.calls.push(`${table}.delete`);
      const doomed = new Set(rows);
      const kept = source.filter((row) => !doomed.has(row));
      source.length = 0;
      source.push(...kept);
      return { data: returning ? rows : null, count: wantCount ? rows.length : null, error: null };
    }
    if (order) {
      const key = order;
      rows = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
    }
    return { data: rows.slice(0, limit), error: null };
  };

  const api = {
    select: () => {
      if (op === "delete") returning = true;
      return api;
    },
    delete: (options?: { count?: string }) => {
      op = "delete";
      wantCount = options?.count === "exact";
      return api;
    },
    not: (column: string, operator: string, value: unknown) => {
      if (operator !== "is" || value !== null) throw new Error("fake: only not(col, 'is', null)");
      return add((row) => row[column] !== null);
    },
    lt: (column: string, value: string) => add((row) => String(row[column]) < value),
    gt: (column: string, value: string) => add((row) => String(row[column]) > value),
    in: (column: string, values: string[]) => add((row) => values.includes(String(row[column]))),
    order: (column: string) => {
      order = column;
      return api;
    },
    limit: (n: number) => {
      limit = n;
      return api;
    },
    then: (resolve: (value: unknown) => void) => resolve(run()),
  };
  return api;
}

function storage(state: FakeState) {
  return {
    from: () => ({
      list: async (prefix: string, options: { limit?: number; offset?: number } = {}) => {
        const base = prefix ? `${prefix}/` : "";
        const entries = new Map<
          string,
          { name: string; id: string | null; created_at: string | null }
        >();
        for (const [path, createdAt] of state.objects) {
          if (!path.startsWith(base)) continue;
          const rest = path.slice(base.length);
          const [first = "", ...tail] = rest.split("/");
          if (tail.length === 0)
            entries.set(first, { name: first, id: `id:${path}`, created_at: createdAt });
          else if (!entries.has(first))
            entries.set(first, { name: first, id: null, created_at: null });
        }
        const sorted = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
        const offset = options.offset ?? 0;
        return { data: sorted.slice(offset, offset + (options.limit ?? 100)), error: null };
      },
      remove: async (paths: string[]) => {
        state.calls.push("storage.remove");
        if (state.failRemove?.(paths)) return { data: null, error: { message: "boom" } };
        const gone = paths.filter((path) => state.objects.delete(path));
        return { data: gone.map((name) => ({ name })), error: null };
      },
    }),
  };
}

export function fakeAdmin(state: FakeState): AdminClient {
  return {
    from: (table: "items" | "unfurl_log") => builder(state, table),
    storage: storage(state),
  } as unknown as AdminClient;
}
