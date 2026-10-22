/**
 * parseGallery.ts
 * Reads the single Markdown gallery document.
 * Each ## heading starts a photo entry with one ::photo settings line.
 * Captions become HTML at build time; raw HTML is not passed through.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { Root, RootContent } from "mdast";

export type GalleryPhoto = {
    id: string;
    title: string;
    image: string;
    year: number | null;
    subjects: string[];
    activity: string;
    credit: string;
    source: string;
    html: string;
};

export type GalleryContent = {
    title: string;
    introHtml: string;
    photos: GalleryPhoto[];
};

type PhotoSettings = Pick<
    GalleryPhoto,
    "image" | "year" | "subjects" | "activity" | "credit" | "source"
>;

type PendingPhoto = {
    title: string;
    settings?: PhotoSettings;
    nodes: RootContent[];
};

const reader = unified().use(remarkParse).use(remarkDirective);
const htmlWriter = unified().use(remarkRehype).use(rehypeStringify);

// Keep readable heading text, including text inside emphasis or links.
function headingText(node: {
    value?: string;
    children?: readonly unknown[];
}): string {
    if (typeof node.value === "string") return node.value;

    return (node.children ?? [])
        .map((child) => headingText(child as Parameters<typeof headingText>[0]))
        .join("");
}

export async function parseGallery(
    markdown: string,
): Promise<GalleryContent> {
    const document = reader.parse(markdown) as Root;
    const photos: GalleryPhoto[] = [];
    const introNodes: RootContent[] = [];
    const usedImages = new Set<string>();

    // Let captions use reference-style links defined anywhere in the file.
    const definitions = document.children.filter(
        (node) => node.type === "definition",
    );

    let title: string | undefined;
    let current: PendingPhoto | undefined;

    async function renderHtml(nodes: RootContent[]): Promise<string> {
        const tree: Root = {
            type: "root",
            children: [...nodes, ...definitions],
        };

        const result = await htmlWriter.run(tree);
        return String(htmlWriter.stringify(result));
    }

    // Finish each entry before reading the next photo heading.
    async function finishPhoto() {
        if (!current) return;

        const { title: photoTitle, settings, nodes } = current;

        if (!settings) {
            throw new Error(
                `gallery.md: "${photoTitle}" needs one ::photo settings line.`,
            );
        }

        if (usedImages.has(settings.image)) {
            throw new Error(
                `gallery.md: Image "${settings.image}" is listed more than once.`,
            );
        }

        photos.push({
            id: `gallery-photo-${photos.length + 1}`,
            title: photoTitle,
            ...settings,
            html: await renderHtml(nodes),
        });

        usedImages.add(settings.image);
        current = undefined;
    }

    for (const node of document.children) {
        if (node.type === "definition") continue;

        // Editing comments belong in the document, not on the public page.
        if (
            node.type === "html" &&
            /^\s*<!--[\s\S]*-->\s*$/.test(node.value)
        ) {
            continue;
        }

        if (node.type === "heading" && node.depth === 1) {
            if (title !== undefined || current || photos.length > 0) {
                throw new Error(
                    "gallery.md: Use one # page title before all photo entries.",
                );
            }

            title = headingText(node).trim();

            if (!title) {
                throw new Error("gallery.md: The page title cannot be empty.");
            }

            continue;
        }

        if (title === undefined) {
            throw new Error(
                "gallery.md: Start with a # page title before the introduction.",
            );
        }

        // Only ## starts a photo; ### remains part of its detailed caption.
        if (node.type === "heading" && node.depth === 2) {
            await finishPhoto();

            const photoTitle = headingText(node).trim();

            if (!photoTitle) {
                throw new Error(
                    "gallery.md: Every ## photo heading needs a title.",
                );
            }

            current = { title: photoTitle, nodes: [] };
            continue;
        }

        if (node.type === "leafDirective" && node.name === "photo") {
            if (!current) {
                throw new Error(
                    "gallery.md: Put ::photo beneath a ## photo heading.",
                );
            }

            if (current.settings) {
                throw new Error(
                    `gallery.md: "${current.title}" has more than one ::photo line.`,
                );
            }

            const attributes = node.attributes ?? {};
            const allowed = new Set([
                "image",
                "year",
                "subjects",
                "activity",
                "credit",
                "source",
            ]);

            for (const key of Object.keys(attributes)) {
                if (!allowed.has(key)) {
                    throw new Error(
                        `gallery.md: Unknown ::photo setting "${key}".`,
                    );
                }
            }

            const image = attributes.image?.trim() ?? "";
            const yearText = attributes.year?.trim() ?? "";
            const source = attributes.source?.trim() ?? "";

            // Paths are relative to src/assets/images/, never external URLs.
            if (
                !image ||
                image.startsWith("/") ||
                image.includes("\\") ||
                image.includes(":") ||
                image.split("/").some(
                    (part) => part === "" || part === "." || part === "..",
                ) ||
                !/\.(png|jpe?g|webp|avif)$/i.test(image)
            ) {
                throw new Error(
                    `gallery.md: "${current.title}" needs a local image path like 2026/robot/photo.png.`,
                );
            }

            // Unknown years remain genuinely unknown, not zero or this year.
            if (
                yearText !== "unknown" &&
                !/^[1-9]\d{3}$/.test(yearText)
            ) {
                throw new Error(
                    `gallery.md: "${current.title}" needs a four-digit year or year="unknown".`,
                );
            }

            if (source) {
                let validSource = false;

                try {
                    const url = new URL(source);
                    validSource =
                        url.protocol === "https:" || url.protocol === "http:";
                } catch {
                    validSource = false;
                }

                if (!validSource) {
                    throw new Error(
                        `gallery.md: "${current.title}" needs a complete http:// or https:// source URL.`,
                    );
                }
            }

            current.settings = {
                image,
                year: yearText === "unknown" ? null : Number(yearText),
                subjects: [
                    ...new Set(
                        (attributes.subjects ?? "")
                            .split(",")
                            .map((subject) => subject.trim())
                            .filter(Boolean),
                    ),
                ],
                activity: attributes.activity?.trim() ?? "",
                credit:
                    attributes.credit?.trim() || "Photographer unknown",
                source,
            };

            continue;
        }

        if (
            node.type === "leafDirective" ||
            node.type === "containerDirective" ||
            node.type === "textDirective"
        ) {
            throw new Error(
                "gallery.md: Use ::photo for settings and ordinary Markdown for captions.",
            );
        }

        if (current) {
            current.nodes.push(node);
        } else {
            introNodes.push(node);
        }
    }

    await finishPhoto();

    if (!title || photos.length === 0) {
        throw new Error(
            "gallery.md: Add a # page title and at least one ## photo entry.",
        );
    }

    return {
        title,
        introHtml: await renderHtml(introNodes),
        photos,
    };
}