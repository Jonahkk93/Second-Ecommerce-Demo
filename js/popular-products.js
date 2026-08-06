import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const POPULAR_PRODUCT_LIMIT = 6;
const grid = document.querySelector("#products > .product-content");

if (grid) {
    const cards = [...grid.querySelectorAll(":scope > .product-box")];
    const cardsById = new Map(cards.map(card => [String(card.dataset.id), card]));

    // Until delivered-sale data exists, keep a small curated fallback instead of
    // showing the entire catalogue as "Popular".
    let selectedCards = cards.slice(0, POPULAR_PRODUCT_LIMIT);

    try {
        const summary = await getDoc(doc(window.db, "storefront", "popular"));
        const rankedIds = summary.exists()
            ? (summary.data().products || []).map(product => String(product.id))
            : [];
        const rankedCards = rankedIds.map(id => cardsById.get(id)).filter(Boolean);
        if (rankedCards.length) selectedCards = rankedCards.slice(0, POPULAR_PRODUCT_LIMIT);
    } catch (error) {
        console.warn("Using fallback popular products", error);
    }

    cards.forEach(card => card.remove());
    selectedCards.forEach(card => grid.appendChild(card));
}
