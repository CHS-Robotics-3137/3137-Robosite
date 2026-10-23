---
# Base theme mode:
#   - auto (uses the `seasons:` calendar below; defaults to `default` in unlisted months)
#   - default
#   - halloween
theme: auto

# Fun surprise chance (0.0 to 1.0) on fresh visit / browser Refresh (Cmd+R):
#   0.5 = 50% chance to pick a random OTHER theme from `src/styles/theme.css`
#   0.05 = 5% rare Easter-egg chance
#   0 = never pick randomly
randomChance: 0.50

# Automatic monthly schedule when `theme: auto` is set above.
# Add future months anytime (e.g. `november: thanksgiving`, `december: christmas`):
seasons:
  october: halloween
---

# Team 3137 Seasonal Theme Guide

## 1. Base Mode, Monthly Schedule & Random Surprise Rolls
- **`theme: auto`** checks the visitor's real calendar month against `seasons:` above (`october: halloween`, otherwise `default`). To force a specific base theme at any time, replace `auto` with `default` or `halloween`.
- **`randomChance`** (from `0` to `1`) gives every new visit or browser **Refresh (`Cmd+R` / `F5`)** a chance to flip to a random *different* theme from `src/styles/theme.css`! Clicking links between pages (`Home -> Robots -> Gallery -> Sponsors`) keeps that rolled theme steady until you refresh.

## 2. Changing Fonts (3 Automatic Google Font Slots)
Inside **`src/styles/theme.css`**, every theme controls 3 font slots:
- **`--font-heading`** — Main hero title, page `h1` titles, and large section/robot `h2` headings.
- **`--font-subheading`** — Navbar links, footer, Markdown `h3`–`h6` subheaders, and small eyebrow/year labels.
- **`--font-body`** — All normal paragraphs, photo descriptions, lists, and search/filter controls.

Put any exact font name from **https://fonts.google.com** first in quotes, followed by `, sans-serif` or `, serif` as an offline backup—`src/lib/readTheme.ts` detects and loads it automatically!

## 3. Seasonal Artwork & Custom Cursors (`src/assets/themes/<theme-name>/`)
Drop any of these **8 exact optional filenames** (`.png`, `.webp`, `.jpg`, or `.svg`) into `src/assets/themes/<theme-name>/` (see `src/assets/themes/README.md`):
- `corner-top-left.*` / `corner-top-right.*` — Stickers right under the navbar corners
- `corner-bottom-left.*` / `corner-bottom-right.*` — DDLC-style hopping bottom stickers
- `border-trim.*` — Trim sitting along the bottom line of the navbar
- `ambient-sprite.*` — Scattered gently drifting background mood sprites
- `cursor.*` / `cursor-pointer.*` — Custom normal & link-hover mouse pointers