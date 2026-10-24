# Phase 11 — MCP server

Shared rules, loop, owner actions and status: [README.md](README.md). Spec: [../spec/mcp.md](../spec/mcp.md) (it says "Planzz"; that is this app). Data: [data-model.md](data-model.md).

Goal: users work with their Thingteca/Cosateca data and features from any MCP-compatible client, under the same access boundaries as the app (RLS, guest quotas).

Decisions taken with the owner:
- Remote MCP server (Streamable HTTP) at `/api/mcp` on the app's own deployment; auth by OAuth through Supabase's OAuth server. Clients use their own AI model and tokens; the server never calls an LLM. The only credential it sees is the user's OAuth access token (a Supabase JWT).
- Scope v1 = full CRUD on all app features, except hard delete: trash only (the daily cron purges trash as today).
- Guests (anonymous users) are refused on `/api/mcp`.
- Files via MCP follow the app's limits (50 MB per file).
- CLAUDE.md rule updated: `/api/mcp` joins the allowed Route Handlers. It uses the caller's JWT under RLS; the service-role key is never used there.

Design:
- Route `src/app/api/mcp/route.ts` with `mcp-handler` + `@modelcontextprotocol/sdk` (verify versions and API against the installed packages and `docs/research-notes.md` first; scout adds findings there).
- Per request, `src/lib/supabase/bearer.ts` builds a supabase-js client with `Authorization: Bearer <jwt>` (verified with `getClaims()`), so RLS applies. `proxy.ts` cookie auth is not used for `/api/mcp`.
- Reuse (already take a `client` argument or are pure): `fetchItemsPage`, `applyRules`/`parseRules`, `buildLinkRow`/`buildNoteRow`/`unfurlPatch`, `statePatch`, `batchPatch`, `lib/order.ts` + `items/reorder.ts`, `normalizeTagName`/`ensureTags`/`attachTags`, `save_canvas_layout`, `unfurl()`.
- Mirror in `src/lib/mcp/` (the `use*` hooks are browser-only): create, edit, archive, trash, restore, collections, tags, smart views, canvas. No TanStack Query or i18n there. Shared state (positions, tag names) goes through the existing helpers, never a new shape.
- Tools (zod v4 schemas, readOnly/destructive annotations): list/search/get items (view, collection, tag, kind, smart view, keyset cursor); save link (unfurl); create/edit note; update item (title, description, note, color, favorite, read, collection, tags); archive, trash, restore (no hard delete); collections CRUD + reorder; tags CRUD; smart views CRUD; canvas get/set layout; counts; signed download URL. Resources: item, collection.
- Files: signed upload URL flow; no server-side thumbnails (pdfjs/canvas are browser-only).

## WP 11.1 — OAuth server and bearer auth (reviewer: yes, security)
- `supabase/config.toml` `[auth.oauth_server]` enabled (`authorization_url_path = "/oauth/consent"`); decide dynamic client registration (MCP clients usually need it) and record why.
- Consent page `/oauth/consent` (shows client name and scopes, approve/deny); `/.well-known/oauth-protected-resource` metadata; 401 with `WWW-Authenticate` from `/api/mcp`.
- `src/lib/supabase/bearer.ts` + tests. Guests: reject tokens with `is_anonymous` (403, message points to sign-up).
- Tests: unit (bearer client, 401 paths); pgTAP unchanged (RLS already per user).

## WP 11.2 — MCP route, read tools, rate limit (reviewer: yes, migration)
- Route skeleton, tool registry, error mapping (no token or SQL leakage in messages).
- Read tools and resources: list/search/get items, collections, tags, smart views, counts, signed download URL.
- Migration `supabase/migrations/<ts>_mcp_log.sql`: `mcp_log` (user_id, tool, created_at) with RLS, mirroring `unfurl_log`; per-user limit, fail closed. Regenerate types.
- Tests: route tests in node env (pattern of `src/app/api/cron/daily/route.test.ts`); pgTAP for `mcp_log` isolation.

## WP 11.3 — Item write tools ∥
- Save link, create/edit note, update fields, favorite/read/archive/trash/restore, tags attach/detach, no hard-delete tool.
- Tests: each rule one test; previous behavior of touched helpers (`statePatch`, `ensureTags`) still holds.

## WP 11.4 — Collections, smart views, canvas, files ∥
- Collections CRUD + reorder, smart views CRUD (rules validated by `Rules`), canvas layout read/write via `save_canvas_layout`, signed upload URL (app limit: 50 MB).
- Tests: as above; invalid rules rejected.

## WP 11.5 — Connect-a-client help
- Settings page section: endpoint URL, short steps for common clients, and revoke link if Supabase exposes client management (else note it). EN copy sentence case; Spanish via `docs/i18n-glossary.md`.

## Gate
- `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` green.
- pgTAP/route test: user A's token cannot read or change user B's rows through any tool.
- Manual: connect from MCP Inspector and one real client, run each tool group; no token in logs.
- CHANGELOG.md entry. Owner action O7 done before production use.

## Open findings
| # | Finding | Fix in |
| --- | --- | --- |
| 1 | Revoking a connected client: check whether Supabase's OAuth server lets users list and revoke them; if not, document it | 11.5 |
