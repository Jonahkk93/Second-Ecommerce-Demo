const POPULAR_PRODUCT_LIMIT = 6;
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

    // Paint the local fallback immediately. Popularity data is an enhancement and
    // should never hold the storefront behind a network request.
    renderCards(cards.slice(0, POPULAR_PRODUCT_LIMIT));

    Promise.all([
        import("./firebase.js"),
        import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
    ]).then(async ([, { doc, getDoc }]) => {
        if (!window.db) return;
        const summary = await getDoc(doc(window.db, "storefront", "popular"));
        const rankedIds = summary.exists()
            ? (summary.data().products || []).map(product => String(product.id))
            : [];
        const rankedCards = rankedIds.map(id => cardsById.get(id)).filter(Boolean);
        if (rankedCards.length) renderCards(rankedCards.slice(0, POPULAR_PRODUCT_LIMIT));
    }).catch(error => {
        console.warn("Using fallback popular products", error);
    });
}
