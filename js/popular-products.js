const POPULAR_PRODUCT_LIMIT = 6;
const POPULAR_CACHE_KEY = "mpwrPopularProductIds";
const grid = document.querySelector("#products > .product-content");
const pageName = window.location.pathname.split("/").pop().toLowerCase();
const isHomepage = pageName === "" || pageName === "index.html";

if (grid && isHomepage) {
    const cards = [...grid.querySelectorAll(":scope > .product-box")];
    const cardsById = new Map(cards.map(card => [String(card.dataset.id), card]));

    // Until delivered-sale data exists, keep a small curated fallback instead of
    // showing the entire catalogue as "Popular".
    const renderCards = selectedCards => {
        cards.forEach(card => card.remove());
        selectedCards.forEach(card => grid.appendChild(card));
    };

    let cachedIds = [];
    try {
        cachedIds = JSON.parse(localStorage.getItem(POPULAR_CACHE_KEY) || "[]");
    } catch (_) {
        cachedIds = [];
    }
    const cachedCards = Array.isArray(cachedIds)
        ? cachedIds.map(id => cardsById.get(String(id))).filter(Boolean)
        : [];

    // Paint a stable local selection immediately. Fresh rankings are cached for
    // the next visit instead of rearranging products after the user sees them.
    renderCards((cachedCards.length ? cachedCards : cards).slice(0, POPULAR_PRODUCT_LIMIT));
    document.documentElement.dataset.siteContentReady = "true";
    window.MPWRLoading?.ready();

    Promise.all([
        import("./firebase.js"),
        import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
    ]).then(async ([, { doc, getDoc }]) => {
        if (!window.db) return;
        const summary = await getDoc(doc(window.db, "storefront", "popular"));
        const rankedIds = summary.exists()
            ? (summary.data().products || []).map(product => String(product.id))
            : [];
        const validRankedIds = rankedIds.filter(id => cardsById.has(id)).slice(0, POPULAR_PRODUCT_LIMIT);
        if (validRankedIds.length) {
            localStorage.setItem(POPULAR_CACHE_KEY, JSON.stringify(validRankedIds));
        }
    }).catch(error => {
        console.warn("Using fallback popular products", error);
    });
}
