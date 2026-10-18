<!--
README.md
Setup, content-editing, and publishing instructions for future maintainers.
-->

# T-Birds Robotics Website

Website for Connetquot Robotics, FIRST Robotics Competition Team 3137.

**Live website:** https://chs-robotics-3137.github.io/3137-Robosite/

Built with Astro and published through GitHub Pages.

## Run the project locally

Install a Node.js version supported by the project's Astro version.
Open a terminal in the project folder.

On a fresh checkout, install the dependencies recorded in the lockfile:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed in the terminal.

To test on another device connected to the same Wi-Fi:

```bash
npm run dev -- --host 0.0.0.0
```

Open the Network URL printed in the terminal on that device.
The local preview is not the published website.

## Where to edit things

| What you want to change | File or folder |
|---|---|
| Homepage settings, words, section order, and photo-window choices | `src/content/home.md` |
| Original homepage photos | `src/assets/images/` |
| Shared colors, fonts, and theme settings | `src/styles/theme.css` |
| Homepage layout and hero styling | `src/pages/index.astro` |
| Text-panel layout and Markdown styling | `src/components/ContentPanel.astro` |
| Decorative photo-window behavior | `src/components/ImageWindow.astro` |
| Navigation | `src/components/Navigation.astro` |
| Footer text and update year | `src/components/Footer.astro` |
| Shared document structure and metadata | `src/layouts/BaseLayout.astro` |
| Browser-tab icon | `public/images/favicon.ico` |

Routine homepage content changes do not require editing Astro files.

## Homepage settings

The first lines of `src/content/home.md` contain YAML settings,
enclosed by opening and closing `---` lines.

Keep this block at the very top of the file.

| Setting | Purpose |
|---|---|
| `pageTitle` | Browser-tab title |
| `pageDescription` | Page summary that search engines may use in results |
| `heroHeading` | Main heading over the opening photo |
| `heroSubtitle` | Smaller text above the main heading |
| `heroImage` | Photo path, starting inside `src/assets/images/` |
| `heroAlt` | A useful description of the hero photo for people who cannot see it |
| `heroPosition` | Horizontal and vertical crop position, such as `"center 38%"` |

Keep text values in quotes. All these fields are required.

If text contains a double quotation mark, escape it as `\"`
inside a double-quoted YAML value.

The settings reader reports missing or empty fields during preview/building.

## Text panels

Start a panel with a level-two heading:

```markdown
## About our team

Write a paragraph here.

Write another paragraph after a blank line.
```

Each top-level `##` heading starts a new panel.

- Sections appear in document order.
- Add a heading and its content to add a panel.
- Move an entire section to rearrange it.
- Delete an entire section to remove it.
- Use `###` through `######` for subheadings inside a panel.
- Do not use `#` headings here; the hero supplies the main page heading.

## Markdown formatting

Inside a panel, you can write:

```markdown
### A subheading

Use **bold**, *italics*, and [link text](https://example.com).

- A bullet item.
- Another bullet item.

1. A numbered item.
2. Another numbered item.

> A quotation.

---

A paragraph after a horizontal dividing line.
```

A standalone `---` in the document body creates a line inside a panel.
It does not start a new panel or photo window.

The special `##` panel rule applies to top-level headings,
not headings inside quotations or fenced code examples.

Raw HTML is not passed through by the homepage reader.
Use Markdown for ordinary content.

## Decorative photo windows

Add a standalone photo instruction with blank lines around it:

```markdown
::photo{src="robots/2025-robot/robo-on-field-1.png" position="center 60%"}
```

- Put the original photo inside `src/assets/images/`.
- Write its path relative to that folder.
- Match the filename and capitalization exactly.
- Supported file extensions currently include lowercase `.png`, `.jpg`,
  `.jpeg`, `.webp`, and `.avif`.
- `position` adjusts the crop, not the window's dimensions.
- If `position` is omitted, the default is `"center 60%"`.

For example, a photo at:

```text
src/assets/images/robots/2025-robot/robo-on-field-1.png
```

is referenced as:

```text
robots/2025-robot/robo-on-field-1.png
```

Photo windows end the preceding text panel.
Start another `##` heading before writing text after a photo window.

These windows are decorative and hidden from screen readers.
Do not put essential information only in a photo window.

The component generates WebP versions during the build.
Desktop devices with a fine pointer and hover support use fixed backgrounds.
Other devices use ordinary scrolling. Reduced-motion preferences also
disable the fixed-background effect.

Ordinary Markdown images are not photo windows and do not currently
receive this component's image optimization. Their paths are browser URLs,
not automatically resolved from `src/assets/images/`.

## Preview, build, and publish

1. Save your changes.
2. Preview them locally.
3. Check desktop and phone layouts when changing presentation.
4. Run:

   ```bash
   npm run build
   ```

5. Resolve any build errors.
6. Review the changed files, then stage, commit, and push.
7. Check that the GitHub Actions deployment succeeds.
8. Verify the published website.

A local build does not publish the site.
Committing saves changes in Git; pushing sends them to GitHub.
GitHub Actions then builds and deploys the website.

Do not commit generated `dist/` or `node_modules/` folders.
Keep `package-lock.json` committed when dependencies change.

The build checks static generation, but is not a complete TypeScript,
accessibility, or browser-compatibility test.

## Footer update year

The footer displays the manually maintained year in
`src/components/Footer.astro`.

Update it when maintaining the website in a new year.
It intentionally does not automatically show the current year:
an abandoned website should not appear freshly updated.

## Maintenance notes

- Never put passwords, tokens, or recovery codes in this repository.
- Review Dependabot pull requests rather than merging them blindly.
- Dependency changes should be built and checked before publishing.
- Run Lighthouse without browser extensions for a cleaner baseline.
- Lighthouse scores do not replace manual accessibility or device testing.

Known deferred work includes the animated logo's rendering issue on
iOS 15.8.8.