/*
 * readTheme.ts
 * Reads seasonal schedule + random chance from src/content/theme.md
 * and indexes every theme preset + Google Font in src/styles/theme.css.
 */
import { parse } from "yaml";

export interface ThemeRegistry {
    mode: string;
    fallbackTheme: string;
    randomChance: number;
    monthMap: Record<number, string>;
    allThemes: string[];
    fontsByTheme: Record<string, string>;
}

const MONTH_INDEX: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
};

const SYSTEM_FONTS = new Set([
    "arial", "helvetica", "helvetica neue", "verdana", "tahoma",
    "trebuchet ms", "gill sans", "georgia", "palatino", "palatino linotype",
    "book antiqua", "times", "times new roman", "courier", "courier new",
    "impact", "system-ui", "-apple-system", "blinkmacsystemfont", "segoe ui",
    "ui-sans-serif", "ui-serif", "ui-monospace",
    "sans-serif", "serif", "monospace", "cursive", "fantasy",
]);

function extractCssBlock(cleanCss: string, themeName: string): string {
    const escaped = themeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern =
        themeName === "default"
            ? /:root\s*\{([^}]*)\}/
            : new RegExp(
                  `:root\\[data-theme=["']${escaped}["']\\]\\s*\\{([^}]*)\\}`,
              );
    return cleanCss.match(pattern)?.[1] ?? "";
}

function extractFirstFont(block: string, varName: string): string | null {
    const match = block.match(new RegExp(`${varName}\\s*:\\s*([^;]+);`));
    if (!match) return null;
    const first = match[1].split(",")[0]?.trim() ?? "";
    return first.replace(/^["']|["']$/g, "").trim() || null;
}

function clampProbability(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

export function readTheme(markdown: string, themeCss: string): ThemeRegistry {
    const match = markdown.match(
        /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/,
    );

    if (!match) {
        throw new Error(
            "theme.md: Keep settings between --- lines at the top of src/content/theme.md.",
        );
    }

    const fields = parse(match[1]) as Record<string, unknown> | null;
    const rawTheme = fields?.theme;

    if (typeof rawTheme !== "string" || !rawTheme.trim()) {
        throw new Error(
            'theme.md: "theme" must be non-empty text (for example: theme: auto).',
        );
    }

    const mode = rawTheme.trim().toLowerCase();
    const randomChance = clampProbability(Number(fields?.randomChance ?? 0));

    const monthMap: Record<number, string> = {};
    const rawSeasons = fields?.seasons;
    if (
        rawSeasons &&
        typeof rawSeasons === "object" &&
        !Array.isArray(rawSeasons)
    ) {
        for (const [monthKey, val] of Object.entries(
            rawSeasons as Record<string, unknown>,
        )) {
            const idx = MONTH_INDEX[monthKey.trim().toLowerCase()];
            if (idx !== undefined && typeof val === "string" && val.trim()) {
                monthMap[idx] = val.trim().toLowerCase();
            }
        }
    }

    const cleanCss = themeCss.replace(/\/\*[\s\S]*?\*\//g, "");

    const allThemes = ["default"];
    for (const m of cleanCss.matchAll(
        /:root\[data-theme=["']([^"']+)["']\]/g,
    )) {
        const found = m[1].trim().toLowerCase();
        if (found && !allThemes.includes(found)) {
            allThemes.push(found);
        }
    }

    const localFaces = new Set(
        [
            ...cleanCss.matchAll(
                /@font-face\s*\{[^}]*font-family\s*:\s*["']?([^"';]+)["']?/gi,
            ),
        ].map((m) => m[1].trim().toLowerCase()),
    );

    const defaultBlock = extractCssBlock(cleanCss, "default");
    const fontsByTheme: Record<string, string> = {};

    for (const themeName of allThemes) {
        const themeBlock =
            themeName === "default"
                ? defaultBlock
                : extractCssBlock(cleanCss, themeName);

        const heading =
            extractFirstFont(themeBlock, "--font-heading") ??
            extractFirstFont(defaultBlock, "--font-heading");
        const subheading =
            extractFirstFont(themeBlock, "--font-subheading") ??
            extractFirstFont(defaultBlock, "--font-subheading");
        const body =
            extractFirstFont(themeBlock, "--font-body") ??
            extractFirstFont(defaultBlock, "--font-body");

        const googleFamilies: string[] = [];
        for (const font of [heading, subheading, body]) {
            if (!font) continue;
            const lower = font.toLowerCase();
            if (SYSTEM_FONTS.has(lower) || localFaces.has(lower)) continue;
            if (!googleFamilies.some((f) => f.toLowerCase() === lower)) {
                googleFamilies.push(font);
            }
        }

        if (googleFamilies.length > 0) {
            const query = googleFamilies
                .map(
                    (f) =>
                        `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`,
                )
                .join("&");
            fontsByTheme[themeName] =
                `https://fonts.googleapis.com/css2?${query}&display=swap`;
        }
    }

    const buildMonth = new Date().getMonth();
    const fallbackCandidate =
        mode === "auto" ? (monthMap[buildMonth] ?? "default") : mode;
    const fallbackTheme = allThemes.includes(fallbackCandidate)
        ? fallbackCandidate
        : "default";

    return {
        mode,
        fallbackTheme,
        randomChance,
        monthMap,
        allThemes,
        fontsByTheme,
    };
}