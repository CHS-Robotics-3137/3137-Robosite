/**
 * readHomepage.ts
 * Separates homepage YAML settings from the Markdown body.
 * Validates required settings so editing mistakes produce useful errors.
 */
import { parse } from "yaml";

interface HomepageSettings {
    pageTitle: string;
    heroHeading: string;
    heroSubtitle: string;
    heroImage: string;
    heroAlt: string;
    heroPosition: string;
}

export function readHomepage(markdown: string): {
    settings: HomepageSettings;
    content: string;
} {
    // Only read settings enclosed by --- at the very start of the file.
    // Horizontal rules elsewhere remain part of the Markdown body.
    const match = markdown.match(
        /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/,
    );

    if (!match) {
        throw new Error(
            "home.md: Add homepage settings between --- lines at the very top of the file.",
        );
    }

    let data: unknown;

    try {
        data = parse(match[1]);
    } catch (error) {
        throw new Error(
            `home.md: Could not read the YAML settings. ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error(
            "home.md: The top settings must contain named fields such as pageTitle and heroImage.",
        );
    }

    const fields = data as Record<string, unknown>;

    // Require text values rather than silently accepting missing or wrong fields.
    function requiredText(name: keyof HomepageSettings): string {
        const value = fields[name];

        if (typeof value !== "string" || !value.trim()) {
            throw new Error(
                `home.md: "${name}" must contain non-empty text in the top settings.`,
            );
        }

        return value.trim();
    }

    return {
        settings: {
            pageTitle: requiredText("pageTitle"),
            heroHeading: requiredText("heroHeading"),
            heroSubtitle: requiredText("heroSubtitle"),
            heroImage: requiredText("heroImage"),
            heroAlt: requiredText("heroAlt"),
            heroPosition: requiredText("heroPosition"),
        },

        // Pass only the remaining document to our existing section reader.
        content: markdown.slice(match[0].length),
    };
}