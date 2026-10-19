/**
 * parseRobots.ts
 * Reads the robot archive in Markdown document order.
 * Each ## heading starts a season with one ::robot settings directive.
 * Ordinary Markdown becomes detail HTML at build time.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { Root, RootContent } from "mdast";

export type RobotSeason = {
    id: string;
    heading: string;
    year: number;
    game: string;
    image: string;
    position: string;
    html: string;
};

type RobotSettings = Pick<
    RobotSeason,
    "year" | "game" | "image" | "position"
>;

type PendingSeason = {
    heading: string;
    settings?: RobotSettings;
    nodes: RootContent[];
};

// Read headings and directives as Markdown structure, not raw text patterns.
const reader = unified().use(remarkParse).use(remarkDirective);

// Convert detail content to HTML without passing raw HTML through.
const htmlWriter = unified().use(remarkRehype).use(rehypeStringify);

// Preserve heading text, including symbols and text inside bold or links.
function headingText(node: {
    value?: string;
    children?: readonly unknown[];
}): string {
    if (typeof node.value === "string") return node.value;

    return (node.children ?? [])
        .map((child) => headingText(child as Parameters<typeof headingText>[0]))
        .join("");
}

export async function parseRobots(
    markdown: string,
): Promise<RobotSeason[]> {
    const document = reader.parse(markdown) as Root;
    const seasons: RobotSeason[] = [];
    const usedYears = new Set<number>();

    // Reference-style links can use definitions elsewhere in the file.
    const definitions = document.children.filter(
        (node) => node.type === "definition",
    );

    let current: PendingSeason | undefined;

    // Validate and finish a season before starting the next one.
    async function finishSeason() {
        if (!current) return;

        const { heading, settings, nodes } = current;

        if (!settings) {
            throw new Error(
                `robots.md: "${heading}" needs one ::robot settings line.`,
            );
        }

        if (usedYears.has(settings.year)) {
            throw new Error(
                `robots.md: The year ${settings.year} appears more than once.`,
            );
        }

        const tree: Root = {
            type: "root",
            children: [...nodes, ...definitions],
        };

        const htmlTree = await htmlWriter.run(tree);

        seasons.push({
            id: `robot-${settings.year}`,
            heading,
            ...settings,
            html: String(htmlWriter.stringify(htmlTree)),
        });

        usedYears.add(settings.year);
        current = undefined;
    }

    for (const node of document.children) {
        // Editing comments stay out of the rendered archive.
        if (node.type === "definition") continue;
        if (
            node.type === "html" &&
            /^\s*<!--[\s\S]*-->\s*$/.test(node.value)
        ) {
            continue;
        }

        // Only top-level ## headings start seasons.
        // ### headings remain inside the season's detail content.
        if (node.type === "heading" && node.depth === 2) {
            await finishSeason();

            const heading = headingText(node).trim();

            if (!heading) {
                throw new Error(
                    "robots.md: Every ## season heading needs text.",
                );
            }

            current = { heading, nodes: [] };
            continue;
        }

        if (node.type === "heading" && node.depth === 1) {
            throw new Error(
                "robots.md: Use ## for seasons. The page supplies its main heading.",
            );
        }

        if (!current) {
            throw new Error(
                "robots.md: Put archive content beneath a ## season heading.",
            );
        }

        if (node.type === "leafDirective" && node.name === "robot") {
            if (current.settings) {
                throw new Error(
                    `robots.md: "${current.heading}" has more than one ::robot line.`,
                );
            }

            const attributes = node.attributes ?? {};
            const allowed = new Set([
                "year",
                "game",
                "image",
                "position",
            ]);

            // Catch misspelled settings instead of silently ignoring them.
            for (const key of Object.keys(attributes)) {
                if (!allowed.has(key)) {
                    throw new Error(
                        `robots.md: Unknown ::robot setting "${key}".`,
                    );
                }
            }

            const yearText = attributes.year?.trim() ?? "";
            const game = attributes.game?.trim() ?? "";
            const image = attributes.image?.trim() ?? "";
            const position =
                attributes.position?.trim() || "center 60%";

            if (!/^\d{4}$/.test(yearText)) {
                throw new Error(
                    `robots.md: "${current.heading}" needs a four-digit year.`,
                );
            }

            if (!game || !image) {
                throw new Error(
                    `robots.md: "${current.heading}" needs game and image settings.`,
                );
            }

            // Robot photos belong to this season's YEAR/robot/ asset folder.
            // Reject backslashes and empty or relative-navigation segments.
            if (
                !image.startsWith(`${yearText}/robot/`) ||
                image.includes("\\") ||
                image.split("/").some(
                    (part) => part === ".." || part === "." || part === "",
                )
            ) {
                throw new Error(
                    `robots.md: "${current.heading}" needs an image path like ${yearText}/robot/photo.png.`,
                );
            }

            current.settings = {
                year: Number(yearText),
                game,
                image,
                position,
            };

            continue;
        }

        // Unsupported directives would otherwise disappear during conversion.
        if (
            node.type === "leafDirective" ||
            node.type === "containerDirective"
        ) {
            throw new Error(
                "robots.md: Use ::robot for season settings and ordinary Markdown for details.",
            );
        }

        current.nodes.push(node);
    }

    await finishSeason();

    if (seasons.length === 0) {
        throw new Error(
            "robots.md: Add at least one ## season with ::robot settings.",
        );
    }

    return seasons;
}