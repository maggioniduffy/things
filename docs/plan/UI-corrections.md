# Phase 10 — UI corrections

Shared rules, loop, owner actions and status: [README.md](README.md). UI: [design.md](design.md).

Owner feedback after Phase 9. Three areas: the landing page, empty views, and mobile forms.

Decisions taken with the owner:
- Landing: content starts higher, "How it works" is clearer, and there's a new "Install the app" section for Android, iOS and desktop Chrome.
- Every empty view that can hold new items gets a large "Add something" card that opens quick add.
- On mobile, every form opens as a bottom sheet (like quick add since 9.2). Focusing a field must not zoom the page.

## WP 10.1 — Landing: content higher, clearer "How it works"
- `src/components/marketing/hero.tsx`: `Hero` drops `min-h-[calc(100dvh-4rem)]`. Smaller top padding (≈ `pt-[clamp(1rem,4vh,3rem)]`) so `HowItWorks` starts above the fold on a 390×844 phone and a 1440×900 desktop. `HeroBackdrop` keeps the aurora behind the shorter hero (check that the mask still fades out before the steps).
- `HowItWorks`: visible `h2` (not `sr-only`) plus a short lead. Each step gets a concrete example line (e.g. "Paste a link, drop a PDF or type a note" → "It's filed as Article / PDF / Note" → "Find it with ⌘K or by format"), and a small illustration per step from the existing card components or static mockups in tokens. No screenshots of real data. Copy goes in `src/i18n/messages` (en + es).
- Nav: add "Install" to `SiteHeader` links (anchor to 10.2's section).
- Tests: update the marketing unit tests; e2e: on the mobile and desktop projects, `#how-it-works` is in the first viewport.

## WP 10.2 — Landing: "Install the app" section ∥
- New `InstallApp` section in `src/components/marketing/sections.tsx` (id `install`), between `HowItWorks` and `Features`. Three tabs or cards with numbered steps:
  - **Android (Chrome):** ⋮ menu → "Add to home screen" / "Install app".
  - **iPhone / iPad (Safari):** Share → "Add to Home Screen" → Add. Note that on iOS this only works from Safari (or another browser's "Add to Home Screen" on iOS 16.4+).
  - **Desktop Chrome / Edge:** install icon in the address bar, or ⋮ menu → "Cast, save and share" → "Install page as app".
- Client island `install-prompt.tsx`: detect the platform (UA + `navigator.standalone` / `display-mode: standalone`) and open the matching tab first. If `beforeinstallprompt` fires (Chromium), show an "Install" button that calls `prompt()`. Hide the section's CTA when already running standalone. Don't do UA sniffing on the server.
- Check installability: `src/app/manifest.ts` already has name, icons, `display: standalone`, `start_url`. Add a maskable icon, `id`, and `apple-touch-icon`/`apple-mobile-web-app-*` metadata if missing. Verify current Chrome installability criteria with a researcher (whether a service worker is still required); if one is needed, add a minimal pass-through `public/sw.js` and note it in research-notes.
- Copy en + es; icons from lucide (Smartphone, Share, MonitorDown).
- Tests: unit for platform detection → default tab, and for the `beforeinstallprompt` button; Lighthouse PWA/installability check at the gate.

## WP 10.3 — Empty views: big "Add something" card
- `src/components/board/empty-state.tsx`: for inbox, all, collection, unread, kind and tag views, render a large dashed-border card button (full width on mobile, ~card size on desktop, Plus icon, "Add something", sub-line "Paste a link, drop a file or write a note") that calls `setQuickAddOpen(true)` from `ui-store`. Keep the heading and body above it.
  - In a collection, quick add files the new item into that collection. In a tag view, it gets that tag. In a kind view, quick add opens normally (the format comes from the content). If quick add can't pass a target collection or tag yet, add an optional `defaults` argument to `setQuickAddOpen` (Zustand, UI-only).
  - Not in trash, archive, favorites or smart views (adding there makes no sense, or the item wouldn't show up). Unknown views keep "Go to inbox".
- The card is a drop target too: dropping files on it goes through the existing external-drop pipeline (`external-drop-zone.tsx`).
- Motion: hover lift via tokens; reduced motion → no lift. Tokens only, no raw colors.
- Tests: update `empty-state.test.tsx` / `.es.test.tsx` (which views show the card, click opens quick add with defaults); e2e: empty collection → card → note saved in that collection.

## WP 10.4 — Mobile forms: bottom sheets, no zoom (reviewer: yes, touches every dialog)
- **Zoom root cause:** iOS Safari zooms in when a focused field's font size is under 16px. `--text-body` is 15px and `Input` uses `text-body`, so every field zooms and the page stays zoomed. Fix: fields use `text-base` (16px) below `sm` and `sm:text-body` above, in `src/components/ui/input.tsx`, the quick-add textarea, `fields.tsx` textareas/inputs, `search-field.tsx`, the cmdk input in `command.tsx`, and the OTP input. Optionally add a `--text-input` token. **Don't** set `maximum-scale=1` / `user-scalable=no` in the viewport: that blocks pinch zoom on Android and fails WCAG 1.4.4.
- **Bottom sheets:** pull the 9.2 pattern into `src/components/ui/responsive-dialog.tsx` (`ResponsiveDialog`, `…Content`, `…Header`, `…Title`, `…Description`, `…Footer`): `Dialog` at `sm+`, vaul `Drawer` (bottom, content height, `repositionInputs`) below. Move `quick-add.tsx` onto it, then `collection-dialog.tsx`, `tag-rename-dialog.tsx`, `smart-view-dialog.tsx`, `upgrade-dialog.tsx`, `canvas/move-dialog.tsx` and `confirm-delete-dialog.tsx`. The command palette stays a dialog.
- Sheet details: drag handle, safe-area bottom padding (`env(safe-area-inset-bottom)`), max height `85svh` with inner scroll, footer buttons side by side, focus restore as in 9.2.
- Tests: unit for `ResponsiveDialog` (both branches); e2e on iPhone 13: each form opens as a sheet, every focused field has a computed `font-size` ≥ 16px, and `visualViewport.scale` is 1 after focus → blur. Manual on a real iPhone at the gate.

## Order
(10.1 ∥ 10.3, disjoint files) → 10.2 (after 10.1, same marketing files) → 10.4 → gate.

## Verification (gate)
`pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` green (desktop + mobile projects), including the new specs. Manual on `pnpm dev`, phone-sized viewport and a real iPhone and Android: landing above the fold, install steps per platform (install it once on each), empty-view card in inbox/all/collection, every form as a sheet with the keyboard open and no zoom. Lighthouse on `/` (installable, a11y ≥ 95). Styleguide renders (add the empty-state card and `ResponsiveDialog`). CHANGELOG entry; README progress table gets a Phase 10 row.

## Open findings

| Finding | Fix in |
| --- | --- |
