/** The part of a node z-order needs. */
export type ZNode = { id: string; zIndex?: number };

const z = (node: ZNode) => node.zIndex ?? 0;

/** Splits the nodes into the chosen ones (low z first, ties in list order) and the rest. */
function split(nodes: readonly ZNode[], ids: ReadonlySet<string>) {
  const chosen = nodes.filter((node) => ids.has(node.id));
  const others = nodes.filter((node) => !ids.has(node.id));
  // Array.prototype.sort is stable: ties keep list order.
  chosen.sort((a, b) => z(a) - z(b));
  return { chosen, others };
}

/**
 * New z for each of `ids` so they sit above every other node, keeping their own order:
 * `max z of the others + 1 + k`. Nodes not in `ids` are not in the result.
 */
export function bringToFront(nodes: readonly ZNode[], ids: Iterable<string>): Map<string, number> {
  const { chosen, others } = split(nodes, new Set(ids));
  const top = others.length > 0 ? Math.max(...others.map(z)) : -1;
  return new Map(chosen.map((node, k) => [node.id, top + 1 + k]));
}

/** Like `bringToFront`, below everything else: `min z of the others - n + k`. */
export function sendToBack(nodes: readonly ZNode[], ids: Iterable<string>): Map<string, number> {
  const { chosen, others } = split(nodes, new Set(ids));
  const bottom = others.length > 0 ? Math.min(...others.map(z)) : 0;
  return new Map(chosen.map((node, k) => [node.id, bottom - chosen.length + k]));
}
