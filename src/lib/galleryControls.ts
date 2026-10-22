/*
 * galleryControls.ts
 * Connects the desktop gallery toolbar: scoped search, Google-style autocomplete,
 * inline ghost completion, dynamic Subject/Activity filters, and shareable URLs.
 * Phones (<= 700px) remain completely unfiltered.
 */

import {
    buildGallerySearchIndex,
    computeGhostCompletion,
    findDidYouMean,
    matchesQueryInScope,
    normalizeText,
    splitWords,
    tokenMatches,
    type ArchivePhotoRecord,
    type CandidateEntry,
    type SearchScope,
    type SuggestionItem,
} from "./gallerySearchIndex";

const RECENT_STORAGE_KEY = "team3137-gallery-recent-searches";
const MAX_RECENT = 5;
const MAX_SUGGESTIONS = 8;

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build safe DOM nodes with matching text segments bolded.
function buildHighlightedLabel(
    label: string,
    rawQuery: string,
): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const cleanTokens = splitWords(normalizeText(rawQuery)).filter(
        (token) => token.length > 0,
    );

    if (cleanTokens.length === 0) {
        fragment.append(document.createTextNode(label));
        return fragment;
    }

    const pattern = new RegExp(
        `(${cleanTokens
            .slice()
            .sort((a, b) => b.length - a.length)
            .map(escapeRegExp)
            .join("|")})`,
        "gi",
    );

    let lastIndex = 0;

    for (const match of label.matchAll(pattern)) {
        const matchIndex = match.index ?? 0;

        if (matchIndex > lastIndex) {
            fragment.append(
                document.createTextNode(label.slice(lastIndex, matchIndex)),
            );
        }

        const strong = document.createElement("strong");
        strong.textContent = match[0];
        fragment.append(strong);
        lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < label.length) {
        fragment.append(document.createTextNode(label.slice(lastIndex)));
    }

    return fragment;
}

function readRecentSearches(): string[] {
    try {
        const stored = window.localStorage.getItem(RECENT_STORAGE_KEY);
        if (!stored) return [];
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(
                (item): item is string =>
                    typeof item === "string" && item.trim().length > 0,
            )
            .slice(0, MAX_RECENT);
    } catch {
        return [];
    }
}

function writeRecentSearches(items: string[]): void {
    try {
        window.localStorage.setItem(
            RECENT_STORAGE_KEY,
            JSON.stringify(items.slice(0, MAX_RECENT)),
        );
    } catch {
        // Ignore storage errors in private browsing mode.
    }
}

export function initGalleryControls(): void {
    const dataScript = document.getElementById("gallery-archive-data");
    const toolbar = document.querySelector<HTMLElement>(".gallery-toolbar");
    const searchBox =
        document.querySelector<HTMLElement>(".gallery-search-box");
    const scopeSelect = document.querySelector<HTMLSelectElement>(
        "#gallery-scope-select",
    );
    const searchInput = document.querySelector<HTMLInputElement>(
        "#gallery-search-input",
    );
    const ghostTyped = document.querySelector<HTMLElement>(
        ".gallery-ghost-typed",
    );
    const ghostRest = document.querySelector<HTMLElement>(
        ".gallery-ghost-rest",
    );
    const shortcutHint = document.querySelector<HTMLElement>(
        ".gallery-search-shortcut",
    );
    const clearButton = document.querySelector<HTMLButtonElement>(
        ".gallery-search-clear",
    );
    const suggestionPopup = document.querySelector<HTMLDivElement>(
        "#gallery-autocomplete-popup",
    );
    const subjectSelect = document.querySelector<HTMLSelectElement>(
        "#gallery-subject-select",
    );
    const activitySelect = document.querySelector<HTMLSelectElement>(
        "#gallery-activity-select",
    );
    const resetButton =
        document.querySelector<HTMLButtonElement>(".gallery-reset-btn");
    const countStatus = document.querySelector<HTMLElement>(
        ".gallery-status-count",
    );
    const emptyBox = document.querySelector<HTMLElement>(".gallery-empty");
    const emptyMessage = document.querySelector<HTMLElement>(
        ".gallery-empty-message",
    );
    const emptyActions = document.querySelector<HTMLElement>(
        ".gallery-empty-actions",
    );

    if (
        !dataScript?.textContent ||
        !toolbar ||
        !searchBox ||
        !scopeSelect ||
        !searchInput ||
        !ghostTyped ||
        !ghostRest ||
        !shortcutHint ||
        !clearButton ||
        !suggestionPopup ||
        !subjectSelect ||
        !activitySelect ||
        !resetButton ||
        !countStatus ||
        !emptyBox ||
        !emptyMessage ||
        !emptyActions
    ) {
        return;
    }

    const rawRecords = JSON.parse(
        dataScript.textContent,
    ) as ArchivePhotoRecord[];
    const { records, candidates, starterEntries } =
        buildGallerySearchIndex(rawRecords);

    const yearSections = Array.from(
        document.querySelectorAll<HTMLElement>("section.gallery-year"),
    );
    const yearNavLinks = new Map<string, HTMLAnchorElement>();

    document
        .querySelectorAll<HTMLAnchorElement>(".gallery-years a[href^='#']")
        .forEach((link) => {
            const targetId = link.getAttribute("href")?.slice(1);
            if (targetId) {
                yearNavLinks.set(targetId, link);

                // Ignore clicks on grayed-out years that currently have 0 matching photos.
                link.addEventListener("click", (event) => {
                    if (link.getAttribute("aria-disabled") === "true") {
                        event.preventDefault();
                    }
                });
            }
        });

    const validScopes = new Set<SearchScope>([
        "all",
        "title",
        "caption",
        "credit",
        "year",
        "tags",
    ]);

    const phoneMedia = window.matchMedia("(max-width: 700px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let recentSearches = readRecentSearches();
    let currentSuggestions: SuggestionItem[] = [];
    let activeSuggestionIndex = -1;
    let activeGhostFullValue = "";
    let pauseSaveTimer: number | undefined;

    function countMatchingActiveDropdowns(indexes: number[]): number {
        const selectedSubject = subjectSelect!.value;
        const selectedActivity = activitySelect!.value;

        if (!selectedSubject && !selectedActivity) {
            return indexes.length;
        }

        let total = 0;
        for (const idx of indexes) {
            const photo = records[idx];
            if (selectedSubject && !photo.subjects.includes(selectedSubject)) {
                continue;
            }
            if (selectedActivity && photo.activity !== selectedActivity) {
                continue;
            }
            total++;
        }
        return total;
    }

    function saveRecentSearch(rawQuery: string): void {
        const trimmed = rawQuery.trim();
        if (trimmed.length < 2) return;
        recentSearches = [
            trimmed,
            ...recentSearches.filter(
                (existing) => existing.toLowerCase() !== trimmed.toLowerCase(),
            ),
        ].slice(0, MAX_RECENT);
        writeRecentSearches(recentSearches);
    }

    function removeRecentSearch(valueToRemove: string): void {
        recentSearches = recentSearches.filter(
            (existing) =>
                existing.toLowerCase() !== valueToRemove.toLowerCase(),
        );
        writeRecentSearches(recentSearches);
    }

    function updateGhostDisplay(suggestions: SuggestionItem[]): void {
        const value = searchInput!.value;

        if (
            document.activeElement !== searchInput ||
            searchInput!.scrollLeft > 0 ||
            (searchInput!.selectionStart !== null &&
                searchInput!.selectionStart !== value.length)
        ) {
            ghostTyped!.textContent = "";
            ghostRest!.textContent = "";
            activeGhostFullValue = "";
            return;
        }

        const { suffix, fullValue } = computeGhostCompletion(
            value,
            suggestions,
            candidates,
        );
        ghostTyped!.textContent = suffix ? value : "";
        ghostRest!.textContent = suffix;
        activeGhostFullValue = fullValue;
    }

    function computeSuggestions(): SuggestionItem[] {
        const rawQuery = searchInput!.value.trim();
        const scope = scopeSelect!.value as SearchScope;

        if (!rawQuery) {
            const combined: SuggestionItem[] = recentSearches.map((term) => ({
                value: term,
                kind: "Recent",
                count: null,
            }));

            for (const starter of starterEntries) {
                if (combined.length >= MAX_SUGGESTIONS) break;
                const duplicate = combined.some(
                    (item) =>
                        item.value.toLowerCase() ===
                        starter.label.toLowerCase(),
                );
                const liveCount = countMatchingActiveDropdowns(
                    starter.matchingIndexes,
                );
                if (!duplicate && liveCount > 0) {
                    combined.push({
                        value: starter.label,
                        kind: "Starter",
                        count: liveCount,
                    });
                }
            }

            return combined;
        }

        const normQuery = normalizeText(rawQuery);
        const queryTokens = splitWords(normQuery);
        if (queryTokens.length === 0) return [];

        const scored: {
            item: CandidateEntry;
            liveCount: number;
            score: number;
        }[] = [];

        for (const candidate of candidates) {
            if (!candidate.scopes.includes(scope)) continue;

            const liveCount = countMatchingActiveDropdowns(
                candidate.matchingIndexes,
            );
            if (liveCount === 0) continue;

            let score = 0;

            if (candidate.norm === normQuery) {
                score = 1000;
            } else if (candidate.norm.startsWith(normQuery)) {
                score = 800;
            } else if (candidate.words.some((w) => w.startsWith(normQuery))) {
                score = 650;
            } else if (
                queryTokens.every((token) =>
                    candidate.words.some((w) => w.startsWith(token)),
                )
            ) {
                score = 520;
            } else if (
                queryTokens.every((token) => candidate.norm.includes(token))
            ) {
                score = 380;
            } else if (
                queryTokens.every((token) =>
                    tokenMatches(token, candidate.norm, candidate.words),
                )
            ) {
                score = 220;
            }

            if (score > 0) {
                score += Math.min(60, liveCount * 2);
                scored.push({ item: candidate, liveCount, score });
            }
        }

        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, MAX_SUGGESTIONS).map(({ item, liveCount }) => ({
            value: item.label,
            kind: item.kind,
            count: liveCount,
        }));
    }

    function setActiveSuggestion(index: number): void {
        activeSuggestionIndex = index;
        const rows = suggestionPopup!.querySelectorAll<HTMLButtonElement>(
            ".gallery-suggestion-row",
        );

        rows.forEach((row, idx) => {
            const isSelected = idx === activeSuggestionIndex;
            row.classList.toggle("is-active", isSelected);

            if (isSelected) {
                searchInput!.setAttribute("aria-activedescendant", row.id);
            }
        });

        if (activeSuggestionIndex < 0) {
            searchInput!.removeAttribute("aria-activedescendant");
        }
    }

    function closeAutocomplete(): void {
        suggestionPopup!.hidden = true;
        searchInput!.setAttribute("aria-expanded", "false");
        setActiveSuggestion(-1);
        updateGhostDisplay([]);
    }

    function renderAutocomplete(): void {
        currentSuggestions = computeSuggestions();
        suggestionPopup!.replaceChildren();
        activeSuggestionIndex = -1;
        searchInput!.removeAttribute("aria-activedescendant");

        if (
            !searchBox!.contains(document.activeElement) ||
            currentSuggestions.length === 0 ||
            phoneMedia.matches
        ) {
            suggestionPopup!.hidden = true;
            searchInput!.setAttribute("aria-expanded", "false");
            updateGhostDisplay([]);
            return;
        }

        const rawQuery = searchInput!.value;

        currentSuggestions.forEach((suggestion, idx) => {
            const entryRow = document.createElement("div");
            entryRow.className = "gallery-suggestion-entry";

            const selectBtn = document.createElement("button");
            selectBtn.type = "button";
            selectBtn.id = `gallery-suggestion-${idx}`;
            selectBtn.className = "gallery-suggestion-row";

            const labelSpan = document.createElement("span");
            labelSpan.className = "gallery-suggestion-label";
            labelSpan.append(buildHighlightedLabel(suggestion.value, rawQuery));

            const badgeSpan = document.createElement("span");
            badgeSpan.className = "gallery-suggestion-badge";
            badgeSpan.textContent =
                suggestion.count !== null
                    ? `${suggestion.kind} · ${suggestion.count}`
                    : suggestion.kind;

            selectBtn.append(labelSpan, badgeSpan);
            selectBtn.addEventListener("pointerdown", (event) => {
                // Keep text cursor inside the search input during clicks.
                event.preventDefault();
            });
            selectBtn.addEventListener("click", () => {
                searchInput!.value = suggestion.value;
                saveRecentSearch(suggestion.value);
                applyFilters({ syncUrl: true });
                closeAutocomplete();
            });

            entryRow.append(selectBtn);

            if (suggestion.kind === "Recent") {
                const removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "gallery-recent-remove";
                removeBtn.setAttribute(
                    "aria-label",
                    `Remove recent search: ${suggestion.value}`,
                );
                removeBtn.textContent = "×";
                removeBtn.addEventListener("pointerdown", (event) => {
                    event.preventDefault();
                });
                removeBtn.addEventListener("click", () => {
                    removeRecentSearch(suggestion.value);
                    searchInput!.focus({ preventScroll: true });
                    renderAutocomplete();
                });
                entryRow.append(removeBtn);
            }

            suggestionPopup!.append(entryRow);
        });

        suggestionPopup!.hidden = false;
        searchInput!.setAttribute("aria-expanded", "true");
        updateGhostDisplay(currentSuggestions);
    }

    function syncUrlState(): void {
        if (phoneMedia.matches) return;

        const url = new URL(window.location.href);
        const rawQuery = searchInput!.value.trim();
        const scope = scopeSelect!.value as SearchScope;
        const selectedSubject = subjectSelect!.value;
        const selectedActivity = activitySelect!.value;

        if (rawQuery) url.searchParams.set("q", rawQuery);
        else url.searchParams.delete("q");

        if (scope !== "all") url.searchParams.set("scope", scope);
        else url.searchParams.delete("scope");

        if (selectedSubject) url.searchParams.set("subject", selectedSubject);
        else url.searchParams.delete("subject");

        if (selectedActivity) {
            url.searchParams.set("activity", selectedActivity);
        } else {
            url.searchParams.delete("activity");
        }

        window.history.replaceState(null, "", url.toString());
    }

    function applyFilters({ syncUrl }: { syncUrl: boolean }): void {
        // Phones always display the entire unfiltered archive cleanly.
        if (phoneMedia.matches) {
            for (const photo of records) {
                if (photo.element) photo.element.hidden = false;
            }
            for (const section of yearSections) {
                section.hidden = false;
            }
            for (const link of yearNavLinks.values()) {
                link.classList.remove("is-empty");
                link.removeAttribute("aria-disabled");
            }
            emptyBox!.hidden = true;
            return;
        }

        const rawQuery = searchInput!.value.trim();
        const queryTokens = splitWords(normalizeText(rawQuery));
        const scope = scopeSelect!.value as SearchScope;
        const selectedSubject = subjectSelect!.value;
        const selectedActivity = activitySelect!.value;

        const hasText = searchInput!.value.length > 0;
        shortcutHint!.hidden = hasText;
        clearButton!.hidden = !hasText;

        const queryMatches = records.map((photo) =>
            matchesQueryInScope(photo, queryTokens, scope),
        );

        // Live counts inside Subject ▾ given current search + Activity filter.
        const subjectCounts = new Map<string, number>();
        let allSubjectsTotal = 0;

        records.forEach((photo, idx) => {
            if (!queryMatches[idx]) return;
            if (selectedActivity && photo.activity !== selectedActivity) return;
            allSubjectsTotal++;
            for (const subj of photo.subjects) {
                subjectCounts.set(subj, (subjectCounts.get(subj) ?? 0) + 1);
            }
        });

        for (const opt of Array.from(subjectSelect!.options)) {
            if (!opt.value) {
                opt.textContent = `Subject: All (${allSubjectsTotal})`;
                opt.disabled = false;
            } else {
                const count = subjectCounts.get(opt.value) ?? 0;
                opt.textContent = `${opt.value} (${count})`;
                opt.disabled = count === 0 && opt.value !== selectedSubject;
            }
        }

        // Live counts inside Activity ▾ given current search + Subject filter.
        const activityCounts = new Map<string, number>();
        let allActivitiesTotal = 0;

        records.forEach((photo, idx) => {
            if (!queryMatches[idx]) return;
            if (selectedSubject && !photo.subjects.includes(selectedSubject)) {
                return;
            }
            allActivitiesTotal++;
            if (photo.activity) {
                activityCounts.set(
                    photo.activity,
                    (activityCounts.get(photo.activity) ?? 0) + 1,
                );
            }
        });

        for (const opt of Array.from(activitySelect!.options)) {
            if (!opt.value) {
                opt.textContent = `Activity: All (${allActivitiesTotal})`;
                opt.disabled = false;
            } else {
                const count = activityCounts.get(opt.value) ?? 0;
                opt.textContent = `${opt.value} (${count})`;
                opt.disabled = count === 0 && opt.value !== selectedActivity;
            }
        }

        let visibleTotal = 0;
        const visiblePerYear = new Map<string, number>();

        records.forEach((photo, idx) => {
            const visible =
                queryMatches[idx] &&
                (!selectedSubject ||
                    photo.subjects.includes(selectedSubject)) &&
                (!selectedActivity || photo.activity === selectedActivity);

            if (photo.element) {
                photo.element.hidden = !visible;
            }

            if (visible) {
                visibleTotal++;
                visiblePerYear.set(
                    photo.yearId,
                    (visiblePerYear.get(photo.yearId) ?? 0) + 1,
                );
            }
        });

        // Hide empty year sections below; keep all 12 year jump links in place, graying out 0s.
        for (const section of yearSections) {
            const yearVisible = visiblePerYear.get(section.id) ?? 0;
            section.hidden = yearVisible === 0;

            const navLink = yearNavLinks.get(section.id);
            if (navLink) {
                const empty = yearVisible === 0;
                navLink.classList.toggle("is-empty", empty);
                if (empty) {
                    navLink.setAttribute("aria-disabled", "true");
                } else {
                    navLink.removeAttribute("aria-disabled");
                }
            }
        }

        const isFiltered =
            rawQuery.length > 0 ||
            scope !== "all" ||
            selectedSubject !== "" ||
            selectedActivity !== "";

        resetButton!.disabled = !isFiltered;

        if (!isFiltered) {
            countStatus!.textContent = `${records.length} photographs`;
        } else {
            const noun = visibleTotal === 1 ? "photograph" : "photographs";
            countStatus!.textContent = `Showing ${visibleTotal} of ${records.length} ${noun}`;
        }

        // Zero-match recovery ("Search in All", "Did you mean ...?", and "Clear search & filters").
        emptyActions!.replaceChildren();

        if (visibleTotal === 0) {
            const scopeName =
                scopeSelect!.selectedOptions[0]?.textContent ?? scope;

            let matchesInAllScope = 0;
            if (scope !== "all" && queryTokens.length > 0) {
                matchesInAllScope = records.filter(
                    (photo) =>
                        matchesQueryInScope(photo, queryTokens, "all") &&
                        (!selectedSubject ||
                            photo.subjects.includes(selectedSubject)) &&
                        (!selectedActivity ||
                            photo.activity === selectedActivity),
                ).length;
            }

            if (matchesInAllScope > 0) {
                const noun =
                    matchesInAllScope === 1
                        ? "photograph matches"
                        : "photographs match";
                emptyMessage!.textContent = `0 matches in ${scopeName} — ${matchesInAllScope} ${noun} across all fields.`;

                const switchBtn = document.createElement("button");
                switchBtn.type = "button";
                switchBtn.className = "gallery-empty-btn";
                switchBtn.textContent = "Search in All";
                switchBtn.addEventListener("click", () => {
                    scopeSelect!.value = "all";
                    applyFilters({ syncUrl: true });
                });
                emptyActions!.append(switchBtn);
            } else {
                emptyMessage!.textContent =
                    "No photographs match your current search and filters.";
            }

            const suggestion = rawQuery
                ? findDidYouMean(rawQuery, candidates)
                : null;
            if (suggestion) {
                const meanBtn = document.createElement("button");
                meanBtn.type = "button";
                meanBtn.className = "gallery-empty-btn";
                meanBtn.textContent = `Did you mean "${suggestion}"?`;
                meanBtn.addEventListener("click", () => {
                    searchInput!.value = suggestion;
                    saveRecentSearch(suggestion);
                    applyFilters({ syncUrl: true });
                });
                emptyActions!.append(meanBtn);
            }

            const clearAllBtn = document.createElement("button");
            clearAllBtn.type = "button";
            clearAllBtn.className = "gallery-empty-btn";
            clearAllBtn.textContent = "Clear search & filters";
            clearAllBtn.addEventListener("click", () => {
                resetAllControls();
            });
            emptyActions!.append(clearAllBtn);

            emptyBox!.hidden = false;
        } else {
            emptyBox!.hidden = true;
        }

        // Save valid queries to Recent Searches after pausing typing for 1.5s.
        window.clearTimeout(pauseSaveTimer);
        if (rawQuery.length >= 2 && visibleTotal > 0) {
            pauseSaveTimer = window.setTimeout(() => {
                saveRecentSearch(rawQuery);
            }, 1500);
        }

        if (syncUrl) {
            syncUrlState();
        }
    }

    function resetAllControls(): void {
        window.clearTimeout(pauseSaveTimer);
        searchInput!.value = "";
        scopeSelect!.value = "all";
        subjectSelect!.value = "";
        activitySelect!.value = "";
        applyFilters({ syncUrl: true });
        closeAutocomplete();
    }

    // Restore shareable URL query parameters on desktop/tablet.
    if (!phoneMedia.matches) {
        const params = new URLSearchParams(window.location.search);
        const paramQuery = params.get("q");
        const paramScope = params.get("scope") as SearchScope | null;
        const paramSubject = params.get("subject");
        const paramActivity = params.get("activity");

        if (paramQuery) {
            searchInput.value = paramQuery;
        }
        if (paramScope && validScopes.has(paramScope)) {
            scopeSelect.value = paramScope;
        }
        if (
            paramSubject &&
            Array.from(subjectSelect.options).some(
                (o) => o.value === paramSubject,
            )
        ) {
            subjectSelect.value = paramSubject;
        }
        if (
            paramActivity &&
            Array.from(activitySelect.options).some(
                (o) => o.value === paramActivity,
            )
        ) {
            activitySelect.value = paramActivity;
        }
    }

    searchInput.addEventListener("focus", () => {
        renderAutocomplete();
    });

    searchInput.addEventListener("click", () => {
        if (suggestionPopup.hidden) {
            renderAutocomplete();
        } else {
            updateGhostDisplay(currentSuggestions);
        }
    });

    searchInput.addEventListener("input", () => {
        applyFilters({ syncUrl: true });
        renderAutocomplete();
    });

    searchInput.addEventListener("scroll", () => {
        updateGhostDisplay(currentSuggestions);
    });

    searchInput.addEventListener("keyup", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            updateGhostDisplay(currentSuggestions);
        }
    });

    searchBox.addEventListener("focusout", (event) => {
        if (!searchBox.contains(event.relatedTarget as Node | null)) {
            closeAutocomplete();
        }
    });

    document.addEventListener("pointerdown", (event) => {
        if (!searchBox.contains(event.target as Node | null)) {
            closeAutocomplete();
        }
    });

    searchInput.addEventListener("keydown", (event) => {
        const atEnd =
            searchInput.selectionStart === searchInput.value.length &&
            searchInput.selectionEnd === searchInput.value.length;

        // Accept inline ghost completion via Tab or Right Arrow at end of text.
        if (
            activeGhostFullValue &&
            atEnd &&
            (event.key === "Tab" || event.key === "ArrowRight") &&
            !event.shiftKey
        ) {
            event.preventDefault();
            searchInput.value = activeGhostFullValue;
            saveRecentSearch(activeGhostFullValue);
            applyFilters({ syncUrl: true });
            renderAutocomplete();
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (suggestionPopup.hidden) {
                renderAutocomplete();
            }
            if (currentSuggestions.length > 0) {
                const next =
                    (activeSuggestionIndex + 1) % currentSuggestions.length;
                setActiveSuggestion(next);
            }
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (suggestionPopup.hidden) {
                renderAutocomplete();
            }
            if (currentSuggestions.length > 0) {
                const prev =
                    activeSuggestionIndex <= 0
                        ? currentSuggestions.length - 1
                        : activeSuggestionIndex - 1;
                setActiveSuggestion(prev);
            }
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            if (
                !suggestionPopup.hidden &&
                activeSuggestionIndex >= 0 &&
                currentSuggestions[activeSuggestionIndex]
            ) {
                const chosen = currentSuggestions[activeSuggestionIndex].value;
                searchInput.value = chosen;
                saveRecentSearch(chosen);
                applyFilters({ syncUrl: true });
            } else if (searchInput.value.trim()) {
                saveRecentSearch(searchInput.value);
            }
            closeAutocomplete();
            return;
        }

        if (event.key === "Escape") {
            if (!suggestionPopup.hidden) {
                event.preventDefault();
                closeAutocomplete();
            } else if (searchInput.value) {
                event.preventDefault();
                searchInput.value = "";
                applyFilters({ syncUrl: true });
            }
        }
    });

    clearButton.addEventListener("click", () => {
        window.clearTimeout(pauseSaveTimer);
        searchInput.value = "";
        applyFilters({ syncUrl: true });
        searchInput.focus();
        renderAutocomplete();
    });

    scopeSelect.addEventListener("change", () => {
        applyFilters({ syncUrl: true });
        if (document.activeElement === searchInput) {
            renderAutocomplete();
        }
    });

    subjectSelect.addEventListener("change", () => {
        applyFilters({ syncUrl: true });
    });

    activitySelect.addEventListener("change", () => {
        applyFilters({ syncUrl: true });
    });

    resetButton.addEventListener("click", () => {
        resetAllControls();
    } );

    // Save current search to Recent Searches if visitor opens a matching photo.
    document
        .querySelectorAll<HTMLAnchorElement>(
            ".gallery-item a.photo-link, .gallery-item a.caption-open",
        )
        .forEach((link) => {
            link.addEventListener("click", () => {
                if (searchInput.value.trim()) {
                    saveRecentSearch(searchInput.value);
                }
            });
        });

    // Global "/" shortcut smoothly scrolls up to the search bar and focuses inside.
    document.addEventListener("keydown", (event) => {
        if (
            event.key !== "/" ||
            phoneMedia.matches ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            document.querySelector(".pswp--open")
        ) {
            return;
        }

        const target = event.target;
        if (
            target instanceof HTMLElement &&
            (target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable)
        ) {
            return;
        }

        event.preventDefault();

        const headerTop = document.getElementById("gallery-top") ?? toolbar;
        headerTop.scrollIntoView({
            behavior: reducedMotion.matches ? "auto" : "smooth",
            block: "start",
        });

        searchInput.focus({ preventScroll: true });
        renderAutocomplete();
    });

    phoneMedia.addEventListener("change", () => {
        closeAutocomplete();
        applyFilters({ syncUrl: false });
    });

    applyFilters({ syncUrl: false });
}