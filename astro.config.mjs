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

    build: {
        // Inline small page stylesheets so CSS never blocks initial rendering.
        inlineStylesheets: "always",
    },

    // Keep generated CSS compatible with Safari 15, including iOS 15.
    vite: {
        css: {
            transformer: "lightningcss",
            lightningcss: {
                // Lightning CSS represents versions as major << 16.
                targets: {
                    safari: 15 << 16,
                    ios_saf: 15 << 16,
                },
            },
        },
        build: {
            // Apply the same compatibility goal to production CSS
            cssTarget: "safari15",
        },
    },
});