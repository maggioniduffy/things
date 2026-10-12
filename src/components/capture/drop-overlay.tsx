import { Aurora } from "@/components/brand";

/**
 * Full-screen "Drop to save" layer shown while an external drag is over the page. It never
 * receives pointer events, so the drag keeps targeting the page underneath. The fade is opacity
 * only (CSS), and off under prefers-reduced-motion.
 */
export function DropOverlay({ visible }: { visible: boolean }) {
  return (
    <>
      {/* Announced once when it appears; the visual layer itself is aria-hidden. */}
      <div role="status" className="sr-only">
        {visible ? "Drop to save" : ""}
      </div>
      {visible ? (
        <div
          aria-hidden="true"
          data-slot="drop-overlay"
          className="bg-paper/70 animate-in fade-in-0 pointer-events-none fixed inset-0 z-40 overflow-hidden duration-(--duration-slow) motion-reduce:animate-none"
        >
          <Aurora variant="hero" />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-heading text-page tracking-heading text-ink font-semibold">
              Drop to save
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
