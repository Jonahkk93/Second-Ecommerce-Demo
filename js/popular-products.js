await (window.MPWRCatalogueReady || Promise.resolve(window.products));
await (window.MPWRDiscountsReady || Promise.resolve());

const POPULAR_PRODUCT_LIMIT = 10;
const POPULAR_CACHE_KEY = "mpwrPopularProductIds";
const POPULAR_MODE_CACHE_KEY = "mpwrPopularMode";
const grid = document.querySelector("#products > .product-content");
const pageName = window.location.pathname.split("/").pop().toLowerCase();
const isHomepage = pageName === "" || pageName === "index.html";

if (grid && isHomepage) {
    const cards = [...grid.querySelectorAll(":scope > .product-box")];
    const cardsById = new Map(cards.map(card => [String(card.dataset.id), card]));
    const renderCards = selectedCards => {
        cards.forEach(card => card.remove());
        selectedCards.forEach(card => grid.appendChild(card));
    };

    let preferredIds = [];
    let automaticIds = [];
    let popularMode = localStorage.getItem(POPULAR_MODE_CACHE_KEY) === "automatic" ? "automatic" : "manual";
    try {
        preferredIds = JSON.parse(localStorage.getItem(POPULAR_CACHE_KEY) || "[]");
        if (!Array.isArray(preferredIds)) preferredIds = [];
    } catch (_) {
        preferredIds = [];
    }

    // A saved management selection is authoritative and is loaded before the
    // homepage is arranged, so the very next refresh reflects the change.
    try {
        const [, { doc, getDoc }] = await Promise.all([import("./firebase.js"), import("./firestore-api.js")]);
        if (window.db) {
            const [summary, bestsellerSummary] = await Promise.all([
                getDoc(doc(window.db, "storefront", "popular")),
                getDoc(doc(window.db, "storefront", "bestsellers"))
            ]);
            const setting = summary.exists() ? summary.data() : null;
            const savedIds = (setting?.products || []).map(product => String(product.id));
            automaticIds = (bestsellerSummary.data()?.products || []).map(product => String(product.id));
            popularMode = setting?.mode === "automatic" ? "automatic" : "manual";
            localStorage.setItem(POPULAR_MODE_CACHE_KEY, popularMode);
            const validIds = savedIds.filter(id => cardsById.has(id)).slice(0, POPULAR_PRODUCT_LIMIT);
            if (validIds.length) {
                preferredIds = validIds;
                localStorage.setItem(POPULAR_CACHE_KEY, JSON.stringify(validIds));
            }
        }
    } catch (error) {
        console.warn("Using cached popular products", error);
    }

    const section = grid.closest("#products");
    if (section) section.hidden = false;
    let selectedCards;
    if (popularMode === "automatic") {
            const bestsellerCards = automaticIds.map(id => cardsById.get(String(id))).filter(Boolean).slice(0, POPULAR_PRODUCT_LIMIT);
            const bestsellerSet = new Set(bestsellerCards);
            const rankedBestsellers = window.MPWRDiscovery
                ? window.MPWRDiscovery.rank(bestsellerCards, { context: "homepage-popular-automatic", preferredIds: automaticIds })
                : bestsellerCards;
            const fallbackCards = cards.filter(card => !bestsellerSet.has(card));
            const fallbackLimit = POPULAR_PRODUCT_LIMIT - rankedBestsellers.length;
            const rankedFallbacks = fallbackLimit <= 0
                ? []
                : window.MPWRDiscovery
                    ? window.MPWRDiscovery.rank(fallbackCards, { context: "homepage-popular-automatic-fallback", limit: fallbackLimit })
                    : fallbackCards.slice(0, fallbackLimit);
            selectedCards = [...rankedBestsellers, ...rankedFallbacks].slice(0, POPULAR_PRODUCT_LIMIT);
    } else {
        selectedCards = preferredIds.map(id => cardsById.get(String(id))).filter(Boolean).slice(0, POPULAR_PRODUCT_LIMIT);
        if (!selectedCards.length) {
            selectedCards = window.MPWRDiscovery
                ? window.MPWRDiscovery.rank(cards, { context: "homepage-popular", limit: POPULAR_PRODUCT_LIMIT })
                : cards.slice(0, POPULAR_PRODUCT_LIMIT);
        }
    }
    renderCards(selectedCards);
    document.documentElement.dataset.siteContentReady = "true";
    window.MPWRLoading?.ready();
}
