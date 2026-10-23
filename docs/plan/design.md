# Things — Design

## Visual language

The reference is a light, near-white page with a fine film grain, dark grotesk type, hairline borders, and an iridescent "hills" gradient (pink → violet → blue, with red and olive undertones) rising from the bottom. Things keeps the content area calm and uses the gradient only as atmosphere: empty states, the drop overlay, auth and landing.

**Tokens** (Tailwind v4 `@theme` in `globals.css`; hex values are eyeballed from the image — tune in the styleguide page)

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `#F3F4F6` | App background, slightly cool |
| `--color-surface` | `rgb(255 255 255 / 0.65)` + `backdrop-blur-md` | Cards, sidebar, popovers |
| `--color-ink` | `#0F0F12` | Headings, logo, primary text |
| `--color-ink-muted` | `#4A4A52` | Body, link lists |
| `--color-ink-subtle` | `#8B8B94` | Meta (domain, dates, counts) |
| `--color-line` | `rgb(15 15 18 / 0.12)` | Hairline dividers, card and icon-button borders |
| `--aurora-pink` | `#EE5BC4` | Gradient stop |
| `--aurora-violet` | `#8E6CF0` | Gradient stop, focus ring base |
| `--aurora-blue` | `#4F63DE` | Gradient stop, primary accent |
| `--aurora-red` | `#EF4A30` | Gradient stop, destructive hint |
| `--aurora-coral` | `#F6A79C` | Gradient haze at horizon |
| `--aurora-olive` | `#A9A55C` | Gradient highlight band |
| `--radius-control` | `8px` | Buttons, inputs, icon buttons |
| `--radius-card` | `14px` | Item cards, drawer |

**Typography.** Inter for UI (variable, `font-feature-settings: "ss01", "cv11"`), Inter Tight or Geist for headings and the wordmark with `-0.02em` tracking. Scale: 13 meta · 15 body · 17 card title · 20 section · 28 page title. Column headers in the reference are 17px medium ink; links are 15px regular ink-muted. Footer-style text links use a 1px underline offset 3px.

**Signature elements**

- **Grain overlay.** A fixed full-screen SVG `feTurbulence` noise layer (`baseFrequency ≈ 0.85`, 3 octaves) at 6–10% opacity, `mix-blend-mode: multiply`, `pointer-events: none`. One component: `<Grain />`.
- **Aurora hills.** `<Aurora />` = 4–6 large blurred radial/elliptical gradients in the stops above, masked to a wavy horizon, with the grain on top so the noise reads stronger on color (as in the image). Slow drift: 20–40s keyframes on `transform` only. Static when `prefers-reduced-motion`. CSS only, no WebGL in v1.
- **Outlined icon buttons.** 40×40, 1px `--color-line` border, 8px radius, white surface, ink icon at 18px (the social buttons in the reference). Used for toolbar actions and card quick actions.
- **Hairline dividers.** Full-width 1px lines separate sidebar sections and the list view rows.
- **Wordmark.** "Thingteca" / "Cosateca" in the heading font; the "teca" suffix takes the mark gradient (color) or a light weight (mono, emails, flat grounds), next to a geometric mark built from stacked chevrons/slashes in the spirit of the reference logo — an original mark, not a copy.

**Components (shadcn/ui base, restyled to tokens):** Button (primary ink-filled, secondary outlined, ghost), IconButton, Input, SearchField, Dialog, Drawer (vaul on mobile), DropdownMenu, ContextMenu, Tooltip, Kbd, Badge (outlined, kind-colored dot), Toast (sonner), Command (cmdk), Skeleton with shimmer.
