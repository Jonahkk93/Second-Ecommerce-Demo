/*
 * MPWR discovery engine
 *
 * Gives each browsing session its own stable catalogue order. The order changes
 * for a new session, but stays put while a shopper moves between pages so cards
 * do not jump around underneath them.
 */
(() => {
    "use strict";

    const SESSION_KEY = "mpwrDiscoverySessionSeed";
    const SIGNAL_KEY = "mpwrDiscoverySignalsV1";
    const MAX_SIGNALS = 80;
    const CATEGORY_BY_ID = {
        "1": "press-ons", "2": "press-ons", "3": "products",
        "4": "press-ons", "5": "press-ons", "6": "press-ons",
        "7": "products", "8": "press-ons", "9": "polish",
        "10": "wigs", "11": "lashes", "12": "wigs",
        "13": "wigs", "14": "wigs", "15": "wigs"
    };

    function storageGet(storage, key) {
        try { return storage.getItem(key); }
        catch (_) { return null; }
    }

    function storageSet(storage, key, value) {
        try { storage.setItem(key, value); }
        catch (_) { /* Discovery must never prevent shopping. */ }
    }

    function makeSeed() {
        if (globalThis.crypto?.getRandomValues) {
            const values = new Uint32Array(2);
            globalThis.crypto.getRandomValues(values);
            return `${values[0].toString(36)}${values[1].toString(36)}`;
        }
        return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    }

    let sessionSeed = storageGet(sessionStorage, SESSION_KEY);
    if (!sessionSeed) {
        sessionSeed = makeSeed();
        storageSet(sessionStorage, SESSION_KEY, sessionSeed);
    }

    function hash(value) {
        let result = 2166136261;
        const input = String(value);
        for (let index = 0; index < input.length; index++) {
            result ^= input.charCodeAt(index);
            result = Math.imul(result, 16777619);
        }
        return result >>> 0;
    }

    function randomFor(value) {
        let state = hash(`${sessionSeed}|${value}`);
        state += 0x6D2B79F5;
        let mixed = state;
        mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    }

    function readSignals() {
        try {
            const value = JSON.parse(storageGet(localStorage, SIGNAL_KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function idOf(item) {
        return String(item?.dataset?.id ?? item?.id ?? "");
    }

    function categoryOf(item) {
        const id = idOf(item);
        return String(item?.dataset?.category ?? item?.category ?? CATEGORY_BY_ID[id] ?? "other");
    }

    function record(id, category, action = "open") {
        if (!id) return;
        const signals = readSignals();
        signals.push({
            id: String(id),
            category: category || CATEGORY_BY_ID[String(id)] || "other",
            action,
            at: Date.now()
        });
        storageSet(localStorage, SIGNAL_KEY, JSON.stringify(signals.slice(-MAX_SIGNALS)));
    }

    function profile() {
        const categoryWeights = {};
        const recentIds = new Map();
        const now = Date.now();
        readSignals().forEach((signal, index, signals) => {
            const ageDays = Math.max(0, (now - Number(signal.at || now)) / 86400000);
            const recency = Math.exp(-ageDays / 21);
            const actionWeight = signal.action === "purchase" ? 2 : signal.action === "cart" ? 1.5 : 1;
            const sequenceWeight = 0.55 + 0.45 * ((index + 1) / signals.length);
            categoryWeights[signal.category] = (categoryWeights[signal.category] || 0) + recency * actionWeight * sequenceWeight;
            recentIds.set(String(signal.id), Math.max(recentIds.get(String(signal.id)) || 0, recency));
        });
        const maxCategoryWeight = Math.max(1, ...Object.values(categoryWeights));
        Object.keys(categoryWeights).forEach(category => {
            categoryWeights[category] /= maxCategoryWeight;
        });
        return { categoryWeights, recentIds };
    }

    /**
     * Rank products or DOM cards. Randomness is deterministic within the current
     * session and context. `baseOrderWeight` protects relevance in search lists.
     */
    function rank(items, options = {}) {
        const list = Array.from(items || []);
        const context = options.context || location.pathname || "storefront";
        const baseOrderWeight = Number(options.baseOrderWeight ?? 0.12);
        const explorationWeight = Number(options.explorationWeight ?? 0.72);
        const personalizationWeight = Number(options.personalizationWeight ?? 0.16);
        const preferred = new Map((options.preferredIds || []).map((id, index, ids) => [
            String(id),
            ids.length ? (ids.length - index) / ids.length : 0
        ]));
        const shopper = profile();

        return list
            .map((item, index) => {
                const id = idOf(item) || `position-${index}`;
                const category = categoryOf(item);
                const baseOrder = list.length > 1 ? 1 - index / (list.length - 1) : 1;
                const affinity = shopper.categoryWeights[category] || 0;
                const recentlyOpened = shopper.recentIds.get(id) || 0;
                const popular = preferred.get(id) || 0;
                const exploration = randomFor(`${context}|${id}`);
                const score =
                    baseOrder * baseOrderWeight +
                    exploration * explorationWeight +
                    affinity * personalizationWeight +
                    popular * 0.18 -
                    recentlyOpened * 0.10;
                return { item, id, score };
            })
            .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
            .slice(0, options.limit || list.length)
            .map(entry => entry.item);
    }

    function rankElements(container, options = {}) {
        if (!container) return [];
        const selector = options.selector || ":scope > .product-box";
        const ranked = rank(container.querySelectorAll(selector), options);
        ranked.forEach(element => container.appendChild(element));
        return ranked;
    }

    document.addEventListener("click", event => {
        const card = event.target.closest?.(".product-box");
        if (!card || event.target.closest(".wishlist-btn")) return;
        record(card.dataset.id, categoryOf(card), event.target.closest(".addie") ? "cart" : "open");
    }, true);

    const productId = new URLSearchParams(location.search).get("id");
    if (/product\.html$/i.test(location.pathname) && productId) {
        record(productId, CATEGORY_BY_ID[String(productId)], "view");
    }

    window.MPWRDiscovery = Object.freeze({ rank, rankElements, record, categoryOf });
})();
