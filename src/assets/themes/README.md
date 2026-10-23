# Seasonal Theme Artwork Guide (`src/assets/themes/`)

Create a subfolder matching a theme name in `src/styles/theme.css` (for example `src/assets/themes/halloween/` or `src/assets/themes/winter/`).

Drop in **any** of these **8 exact optional filenames** (`.png`, `.webp`, `.jpg`, or `.svg` at any resolution—Astro compresses and resizes them automatically):

1. `corner-top-left.*` — Hangs right under the left corner of the navbar (never floats over the homepage hero).
2. `corner-top-right.*` — Hangs right under the right corner of the navbar.
3. `corner-bottom-left.*` — Bottom-left DDLC-style hopping sticker (jumps higher on hover/click!).
4. `corner-bottom-right.*` — Bottom-right DDLC-style hopping sticker.
5. `border-trim.*` — Horizontally repeating trim sitting right along the bottom edge of the navbar.
6. `ambient-sprite.*` — Single small mood graphic (e.g. bat, snowflake, leaf) scattered gently in 5 spots with a soft float animation.
7. `cursor.*` — Custom normal mouse pointer (auto-shrunk to `<= 32px`).
8. `cursor-pointer.*` — Custom hover mouse pointer on links, buttons, and stickers (auto-shrunk to `<= 32px`).

> **Note:** Only files using these exact 8 base names appear on the site—any draft or unused files in the folder are safely ignored.