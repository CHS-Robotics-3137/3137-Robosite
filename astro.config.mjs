/*
 * astro.config.mjs
 * Configures Astro for this repository's GitHub Pages address.
 */
import { defineConfig } from "astro/config";

export default defineConfig({
    // The account hosting the website.
    site: "https://chs-robotics-3137.github.io",

    // Project sites live under their repository name.
    base: "/3137-Robosite",

    // Use consistent slash-ended page URLs.
    trailingSlash: "always",
});