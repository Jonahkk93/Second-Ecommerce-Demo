await (window.MPWRCatalogueReady || Promise.resolve(window.products));

const POPULAR_PRODUCT_LIMIT = 10;
const POPULAR_CACHE_KEY = "mpwrPopularProductIds";
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
            const summary = await getDoc(doc(window.db, "storefront", "popular"));
            const savedIds = summary.exists() ? (summary.data().products || []).map(product => String(product.id)) : [];
            const validIds = savedIds.filter(id => cardsById.has(id)).slice(0, POPULAR_PRODUCT_LIMIT);
            if (validIds.length) {
                preferredIds = validIds;
                localStorage.setItem(POPULAR_CACHE_KEY, JSON.stringify(validIds));
            }
        }
    } catch (error) {
        console.warn("Using cached popular products", error);
    }

    let selectedCards = preferredIds.map(id => cardsById.get(String(id))).filter(Boolean).slice(0, POPULAR_PRODUCT_LIMIT);
    if (!selectedCards.length) {
        selectedCards = window.MPWRDiscovery
            ? window.MPWRDiscovery.rank(cards, { context: "homepage-popular", limit: POPULAR_PRODUCT_LIMIT })
            : cards.slice(0, POPULAR_PRODUCT_LIMIT);
    }
    renderCards(selectedCards);
    document.documentElement.dataset.siteContentReady = "true";
    window.MPWRLoading?.ready();
}
