/*
 * gallerySearchIndex.ts
 * Indexes gallery metadata for fast client-side search, typo tolerance,
 * ranked Google-style suggestions, inline ghost text, and "Did you mean" hints.
 */

export type SearchScope =
    | "all"
    | "title"
    | "caption"
    | "credit"
    | "year"
    | "tags";

export type ArchivePhotoRecord = {
    id: string;
    yearId: string;
    title: string;
    caption: string;
    credit: string;
    year: string;
    subjects: string[];
    activity: string;
};

export type IndexedPhoto = ArchivePhotoRecord & {
    element: HTMLElement | null;
    normFields: Record<SearchScope, string>;
    wordsByScope: Record<SearchScope, string[]>;
};

export type SuggestionKind =
    | "Recent"
    | "Starter"
    | "Keyword"
    | "Title"
    | "Credit"
    | "Tag"
    | "Year";

export type SuggestionItem = {
    value: string;
    kind: SuggestionKind;
    count: number | null;
};

export type CandidateEntry = {
    label: string;
    norm: string;
    words: string[];
    kind: Exclude<SuggestionKind, "Recent" | "Starter">;
    scopes: SearchScope[];
    matchingIndexes: number[];
};

const STOP_WORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "into", "over",
    "under", "after", "before", "during", "while", "near", "side", "view",
    "photo", "photograph", "photographs", "image", "team", "3137", "first",
    "robotics", "competition", "connetquot", "year", "unknown", "were",
    "have", "been", "their", "them", "they", "also", "more", "some", "when",
    "where", "what", "which", "there", "here", "onto", "upon", "around",
]);

// Normalize punctuation, quotes, math symbols (such as π -> pi), and spacing.
export function normalizeText(input: string): string {
    return input
        .toLowerCase()
        .replace(/π/g, "π pi ")
        .replace(/[\u2018\u2019']/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function splitWords(normalized: string): string[] {
    return normalized ? normalized.split(" ") : [];
}

// Check whether two words differ by at most 1 edit (insert, delete, substitute, or adjacent swap).
export function withinOneEdit(first: string, second: string): boolean {
    const lenA = first.length;
    const lenB = second.length;

    if (Math.abs(lenA - lenB) > 1) return false;
    if (first === second) return true;

    if (lenA === lenB) {
        let diffs = 0;

        for (let i = 0; i < lenA; i++) {
            if (first[i] !== second[i]) {
                if (
                    diffs === 0 &&
                    i + 1 < lenA &&
                    first[i] === second[i + 1] &&
                    first[i + 1] === second[i]
                ) {
                    i++;
                    diffs++;
                    continue;
                }

                diffs++;
                if (diffs > 1) return false;
            }
        }

        return diffs <= 1;
    }

    const shorter = lenA < lenB ? first : second;
    const longer = lenA < lenB ? second : first;
    let i = 0;
    let j = 0;
    let skipped = false;

    while (i < shorter.length && j < longer.length) {
        if (shorter[i] === longer[j]) {
            i++;
            j++;
        } else {
            if (skipped) return false;
            skipped = true;
            j++;
        }
    }

    return true;
}

// Edit distance capped at 2 for "Did you mean ...?" hints on zero-result typos.
export function withinTwoEdits(first: string, second: string): boolean {
    if (Math.abs(first.length - second.length) > 2) return false;
    if (withinOneEdit(first, second)) return true;

    const rows = first.length + 1;
    const cols = second.length + 1;
    const dp: number[] = Array.from({ length: cols }, (_, idx) => idx);

    for (let r = 1; r < rows; r++) {
        let prevDiag = dp[0];
        dp[0] = r;
        let rowMin = dp[0];

        for (let c = 1; c < cols; c++) {
            const temp = dp[c];
            const cost = first[r - 1] === second[c - 1] ? 0 : 1;
            dp[c] = Math.min(dp[c] + 1, dp[c - 1] + 1, prevDiag + cost);
            prevDiag = temp;
            if (dp[c] < rowMin) rowMin = dp[c];
        }

        if (rowMin > 2) return false;
    }

    return dp[cols - 1] <= 2;
}

export function tokenMatches(
    token: string,
    fieldText: string,
    fieldWords: string[],
): boolean {
    if (!token) return true;
    if (fieldText.includes(token)) return true;

    // Only forgive 1-character typos on 4+ letter words so short queries stay exact.
    if (token.length < 4) return false;

    for (const word of fieldWords) {
        if (word.length < 4) continue;
        if (withinOneEdit(token, word)) return true;
    }

    return false;
}

export function matchesQueryInScope(
    photo: IndexedPhoto,
    tokens: string[],
    scope: SearchScope,
): boolean {
    if (tokens.length === 0) return true;
    const fieldText = photo.normFields[scope];
    const fieldWords = photo.wordsByScope[scope];
    return tokens.every((token) =>
        tokenMatches(token, fieldText, fieldWords),
    );
}

// Pre-index records and build autocomplete candidates once on page load.
export function buildGallerySearchIndex(rawRecords: ArchivePhotoRecord[]): {
    records: IndexedPhoto[];
    candidates: CandidateEntry[];
    starterEntries: CandidateEntry[];
} {
    const records: IndexedPhoto[] = rawRecords.map((record) => {
        const tagsJoined = [...record.subjects, record.activity]
            .filter(Boolean)
            .join(" ");
        const normTitle = normalizeText(record.title);
        const normCaption = normalizeText(record.caption);
        const normCredit = normalizeText(record.credit);
        const normYear = normalizeText(
            record.year === "unknown" ? "unknown year" : record.year,
        );
        const normTags = normalizeText(tagsJoined);
        const normAll = [
            normTitle,
            normCaption,
            normCredit,
            normYear,
            normTags,
        ]
            .filter(Boolean)
            .join(" ");

        const normFields: Record<SearchScope, string> = {
            all: normAll,
            title: normTitle,
            caption: normCaption,
            credit: normCredit,
            year: normYear,
            tags: normTags,
        };

        return {
            ...record,
            element: document.getElementById(record.id),
            normFields,
            wordsByScope: {
                all: splitWords(normAll),
                title: splitWords(normTitle),
                caption: splitWords(normCaption),
                credit: splitWords(normCredit),
                year: splitWords(normYear),
                tags: splitWords(normTags),
            },
        };
    });

    const candidates: CandidateEntry[] = [];
    const seenCandidateNorms = new Set<string>();

    const registerCandidate = (
        label: string,
        kind: Exclude<SuggestionKind, "Recent" | "Starter">,
        scopes: SearchScope[],
        matchingIndexes: number[],
    ) => {
        const clean = label.trim();
        const norm = normalizeText(clean);
        if (!clean || !norm || seenCandidateNorms.has(norm)) return;
        seenCandidateNorms.add(norm);
        candidates.push({
            label: clean,
            norm,
            words: splitWords(norm),
            kind,
            scopes,
            matchingIndexes,
        });
    };

    const tagIndexes = new Map<string, number[]>();
    const creditIndexes = new Map<string, number[]>();
    const yearIndexes = new Map<string, number[]>();
    const keywordMap = new Map<
        string,
        { display: string; indexes: Set<number>; scopes: Set<SearchScope> }
    >();

    records.forEach((item, index) => {
        const pushIndex = (map: Map<string, number[]>, key: string) => {
            const list = map.get(key);
            if (list) list.push(index);
            else map.set(key, [index]);
        };

        for (const subject of item.subjects) {
            pushIndex(tagIndexes, subject);
        }
        if (item.activity) {
            pushIndex(tagIndexes, item.activity);
        }
        if (item.credit && item.credit !== "Photographer unknown") {
            pushIndex(creditIndexes, item.credit);
        }
        const yearLabel = item.year === "unknown" ? "Unknown year" : item.year;
        pushIndex(yearIndexes, yearLabel);

        const collectWords = (sourceText: string, fieldScope: SearchScope) => {
            const matches =
                sourceText.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) ?? [];
            for (const rawWord of matches) {
                const norm = normalizeText(rawWord);
                if (
                    norm.length < 4 ||
                    STOP_WORDS.has(norm) ||
                    /^\d{4}$/.test(norm)
                ) {
                    continue;
                }
                const existing = keywordMap.get(norm);
                if (existing) {
                    existing.indexes.add(index);
                    existing.scopes.add(fieldScope);
                    if (
                        rawWord[0] === rawWord[0].toUpperCase() &&
                        existing.display[0] === existing.display[0].toLowerCase()
                    ) {
                        existing.display = rawWord;
                    }
                } else {
                    keywordMap.set(norm, {
                        display: rawWord,
                        indexes: new Set([index]),
                        scopes: new Set(["all", fieldScope]),
                    });
                }
            }
        };

        collectWords(item.title, "title");
        collectWords(item.caption, "caption");
    });

    for (const [tag, idxs] of [...tagIndexes.entries()].sort(
        (a, b) => b[1].length - a[1].length,
    )) {
        registerCandidate(tag, "Tag", ["all", "tags"], idxs);
    }
    for (const [credit, idxs] of [...creditIndexes.entries()].sort(
        (a, b) => b[1].length - a[1].length,
    )) {
        registerCandidate(credit, "Credit", ["all", "credit"], idxs);
    }
    for (const [yearLabel, idxs] of [...yearIndexes.entries()].sort((a, b) =>
        b[0].localeCompare(a[0]),
    )) {
        registerCandidate(yearLabel, "Year", ["all", "year"], idxs);
    }
    for (const [, info] of [...keywordMap.entries()]
        .filter(([, data]) => data.indexes.size >= 2)
        .sort((a, b) => b[1].indexes.size - a[1].indexes.size)) {
        registerCandidate(
            info.display,
            "Keyword",
            [...info.scopes],
            [...info.indexes],
        );
    }
    records.forEach((item, index) => {
        registerCandidate(item.title, "Title", ["all", "title"], [index]);
    });

    const preferredStarterLabels = [
        "Plinko",
        "Pleco",
        "MSG Varsity",
        "Mascots",
        "Awards",
        "Regional",
        "Workshop",
        "2012",
    ];
    const starterEntries = preferredStarterLabels
        .map((label) =>
            candidates.find((c) => c.norm === normalizeText(label)),
        )
        .filter((entry): entry is CandidateEntry => Boolean(entry));

    return { records, candidates, starterEntries };
}

// Complete either full phrase prefixes ("msg v" -> "msg varsity") or the active last word ("2024 rob" -> "2024 robot").
export function computeGhostCompletion(
    rawInput: string,
    suggestions: SuggestionItem[],
    candidates: CandidateEntry[],
): { suffix: string; fullValue: string } {
    if (!rawInput || /\s$/.test(rawInput)) {
        return { suffix: "", fullValue: "" };
    }

    const lowerInput = rawInput.toLowerCase();

    for (const suggestion of suggestions) {
        if (
            suggestion.value.length > rawInput.length &&
            suggestion.value.toLowerCase().startsWith(lowerInput)
        ) {
            const suffix = suggestion.value.slice(rawInput.length);
            return { suffix, fullValue: rawInput + suffix };
        }
    }

    const parts = rawInput.split(/\s+/);
    const lastWord = parts[parts.length - 1];

    if (parts.length > 1 && lastWord.length >= 2) {
        const lowerLast = lastWord.toLowerCase();

        for (const candidate of candidates) {
            if (
                candidate.kind !== "Title" &&
                candidate.words.length === 1 &&
                candidate.label.length > lastWord.length &&
                candidate.label.toLowerCase().startsWith(lowerLast)
            ) {
                const suffix = candidate.label.slice(lastWord.length);
                return { suffix, fullValue: rawInput + suffix };
            }
        }
    }

    return { suffix: "", fullValue: "" };
}

// Find a closest archive word within 2 character edits for zero-match hints.
export function findDidYouMean(
    rawQuery: string,
    candidates: CandidateEntry[],
): string | null {
    const tokens = splitWords(normalizeText(rawQuery));
    if (tokens.length === 0) return null;

    let changed = false;
    const repaired = tokens.map((token) => {
        if (token.length < 4) return token;

        let bestMatch: CandidateEntry | null = null;
        for (const candidate of candidates) {
            if (candidate.words.length !== 1) continue;
            if (withinTwoEdits(token, candidate.norm)) {
                if (
                    !bestMatch ||
                    candidate.matchingIndexes.length >
                        bestMatch.matchingIndexes.length
                ) {
                    bestMatch = candidate;
                }
            }
        }

        if (bestMatch && bestMatch.norm !== token) {
            changed = true;
            return bestMatch.label;
        }

        return token;
    });

    return changed ? repaired.join(" ") : null;
}