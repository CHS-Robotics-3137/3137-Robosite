/**
 * parseHomepage.ts
 * Reads homepage Markdown in document order.
 * Level-two headings start panels; photo directives insert image windows.
 * Ordinary Markdown inside each panel becomes HTML at build time.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { Root, RootContent } from "mdast";

export type HomepageSection =
    | { type: "panel"; heading: string; html: string }
    | { type: "image"; src: string; position: string };

// Read Markdown structure instead of splitting raw text at heading symbols.
const reader = unified().use(remarkParse).use(remarkDirective);

// Convert panel content to HTML. Raw HTML is not passed through.
const htmlWriter = unified().use(remarkRehype).use(rehypeStringify);

// Extract readable heading text, including text inside bold or links.
function headingText(node: {
    value?: string;
    children?: readonly unknown[];
}): string {
    if (typeof node.value === "string") return node.value;

    return (node.children ?? [])
        .map((child) => headingText(child as Parameters<typeof headingText>[0]))
        .join("");
}

export async function parseHomepage(
    markdown: string,
): Promise<HomepageSection[]> {
    const document = reader.parse(markdown) as Root;
    const sections: HomepageSection[] = [];

    // Reference-style links may use definitions elsewhere in the document.
    const definitions = document.children.filter(
        (node) => node.type === "definition",
    );

    let panel: { heading: string; nodes: RootContent[] } | undefined;

    // Finish the current panel before starting another panel or photo window.
    async function finishPanel() {
        if (!panel) return;

        const tree: Root = {
            type: "root",
            children: [...panel.nodes, ...definitions],
        };

        const htmlTree = await htmlWriter.run(tree);

        sections.push({
            type: "panel",
            heading: panel.heading,
            html: String(htmlWriter.stringify(htmlTree)),
        });

        panel = undefined;
    }

    for (const node of document.children) {
        // Comments document the file; link definitions are handled separately.
        if (node.type === "definition") continue;
        if (
            node.type === "html" &&
            /^\s*<!--[\s\S]*-->\s*$/.test(node.value)
        ) {
            continue;
        }

        // Only top-level ## headings begin panels.
        // Headings inside quotes and code examples do not split the page.
        if (node.type === "heading" && node.depth === 2) {
            await finishPanel();

            const heading = headingText(node).trim();
            if (!heading) {
                throw new Error("home.md: Every ## panel heading needs text.");
            }

            panel = { heading, nodes: [] };
            continue;
        }

        // A standalone ::photo instruction becomes a decorative image window.
        if (node.type === "leafDirective" && node.name === "photo") {
            await finishPanel();

            const src = node.attributes?.src?.trim();
            const position = node.attributes?.position?.trim() || "center 60%";

            if (!src) {
                throw new Error(
                    'home.md: Each ::photo needs src="robots/.../photo.png".',
                );
            }

            sections.push({ type: "image", src, position });
            continue;
        }

        // Catch unsupported standalone directives instead of silently hiding them.
        if (
            node.type === "leafDirective" ||
            node.type === "containerDirective"
        ) {
            throw new Error(
                "home.md: Use ::photo for photo windows, or ## for text panels.",
            );
        }

        if (node.type === "heading" && node.depth === 1) {
            throw new Error(
                "home.md: Use ## for panel headings. The hero already supplies the page's main heading.",
            );
        }

        if (!panel) {
            throw new Error(
                "home.md: Put text beneath a ## heading. After a photo window, start another ## panel before writing more text.",
            );
        }

        panel.nodes.push(node);
    }

    await finishPanel();
    return sections;
}