# Phase 3 — Capture

Product spec for one phase. Shared context: [README.md](README.md) (always), [data-model.md](data-model.md) (schema work), [design.md](design.md) (UI work). How it is built: [../orchestration/phase-3.md](../orchestration/phase-3.md).

## Build

- `detect-kind.ts` with unit tests; paste listener; external drop overlay; quick add.
- `/api/unfurl` with SSRF guard, rate limit and oEmbed providers; file upload pipeline + client thumbnails; notes.
- **Done when:** a YouTube URL, a blog URL, a PDF, an image and plain text each produce the right kind and an enriched card within 3 s on a normal connection; unfurl rejects `http://127.0.0.1` and `http://169.254.169.254`.

## Spec

**Capture (MVP)**

1. **Paste anywhere** (⌘V when no input is focused): URL → link item; text → note; image on clipboard → image item.
2. **Drop anywhere:** files from the OS, links or images dragged from another tab. A full-screen overlay with the aurora and "Drop to save" appears on `dragenter`. Dropping on a sidebar collection files it there directly.
3. **Quick add** (⌘K → "Add", or the + button): one field that accepts a URL, text, or a file picker.
4. **Notes:** plain text with light markdown, rendered on the card.

## Key flows

Every save follows the same two-step shape: insert a minimal row immediately (optimistic card on screen), then enrich it and patch the row. Failures leave a usable card with `enrich_status = 'failed'` and a retry action.

**Kind detection (`lib/items/detect-kind.ts`, pure function, unit-tested)**

| Input | Rule | Kind |
| --- | --- | --- |
| File | `image/*` | image |
| File | `application/pdf` | pdf |
| File | `audio/*` | audio |
| File | `video/*` | video |
| File | Word, Excel, PowerPoint, ODF, `text/*`, Markdown | document |
| URL | youtube.com, youtu.be, vimeo.com, loom.com | video |
| URL | github.com, gitlab.com, codepen.io, codesandbox.io | code |
| URL | Path ends in `.pdf` / `.png` / `.jpg` etc. | pdf / image |
| URL | After unfurl: `og:type = article` or an `article:published_time` tag | article |
| URL | Anything else | link |
| Text | Not a URL | note |

**Link unfurl — `POST /api/unfurl`**

1. Validate with zod: http(s) only, max 2,048 chars; require an authenticated Supabase session.
2. **SSRF guard:** resolve DNS, reject private, loopback, link-local and metadata ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7); re-check on every redirect; max 3 redirects.
3. Fetch with a 5 s timeout, a browser-like User-Agent, and a 1 MB body cap; parse only `<head>`.
4. Extract `og:*`, `twitter:*`, `<title>`, meta description, canonical URL, favicon (`<link rel=icon>` → fallback `/favicon.ico`).
5. Provider overrides via oEmbed for YouTube and Vimeo (title, thumbnail, duration). X/Twitter and Instagram block scraping; v1 stores those as plain links with domain and favicon only.
6. Return JSON; the client patches the row (`title`, `description`, `image_url`, `kind`, `enrich_status = 'done'`). Cache successful results for 24 h with Next's fetch cache.

**File upload (client only)**

1. Insert the row (kind from MIME, `file_name`, `file_size`, `enrich_status = 'pending'`).
2. Upload to `things/{user_id}/{item_id}/{file_name}` with `supabase.storage.upload`; switch to resumable (TUS) uploads above 6 MB. Show progress on the card.
3. Generate a thumbnail in the browser: images via `createImageBitmap` → canvas → WebP 480px; PDFs via `pdfjs-dist` page 1; video via a `<video>` frame at 1 s. Upload as `thumb.webp`, then patch `thumbnail_path`.
4. Enforce a client-side size limit that matches the Supabase plan (50 MB on Free) with a clear error toast.
