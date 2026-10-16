# Phase 3 — Capture

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-3.md](../plan/phase-3.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 3.1 | B | `lib/items/detect-kind.ts` + table-driven tests from the spec's kind table (+ edge cases: `youtu.be`, query strings, uppercase extensions, `text/markdown`) | 100% branch coverage of the function |
| 3.2 | B ∥ | `/api/unfurl`: zod input, session required, `unfurl_log` 60/h, `lib/unfurl/fetch-safe.ts` (§5.3), `parse.ts` (linkedom, `<head>` only, 1 MB cap), `providers.ts` (YouTube/Vimeo oEmbed), article detection | Tests reject `127.0.0.1`, `169.254.169.254`, `[::1]`, `[::ffff:127.0.0.1]`, `2130706433`, redirect-to-private, port 22; fixture HTML parses |
| 3.3 | B ∥ | `lib/items/upload.ts` (standard ≤ 6 MB, TUS above, progress), `thumbnails.ts` (image → WebP 480, PDF page 1 via pdfjs worker, video frame at 1 s), signed-URL batching hook | Unit tests with fixtures; 50 MB client limit toast |
| 3.4 | B | `lib/items/mutations.ts`: optimistic create (link/note/file) → enrich patch, `enrich_status` + retry; notes | Optimistic card appears before network resolves (test with delayed mock) |
| 3.5 | B | `capture/`: `PasteListener`, `ExternalDropZone` + `DropOverlay` (aurora), `QuickAdd` (⌘K "Add" / + button) | Playwright: paste URL/text/image, drop file |
| 3.G | R + O | Gate: YouTube URL, blog URL, PDF, image, text → right kind + enriched card ≤ 3 s; SSRF cases rejected. Reviewer focus: SSRF + upload paths | Green |
