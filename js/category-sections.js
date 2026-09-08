(async () => {
    await (window.MPWRCatalogueReady || Promise.resolve(window.products));

    const page = window.location.pathname.split("/").pop().toLowerCase();
    const isHomepage = page === "" || page === "index.html";

    if (!isHomepage) {
        document.body.classList.add("category-page");
        window.MPWRDiscovery?.rankElements(
            document.querySelector("#products > .product-content"),
            { context: `category-page-${page}` }
        );
        return;
    }

    const cards = Array.from(
        document.querySelectorAll("#products > .product-content > .product-box")
    );

    // Establish the session's catalogue order before commerce handlers attach.
    const rankedCards = window.MPWRDiscovery
        ? window.MPWRDiscovery.rank(cards, { context: "homepage-catalogue" })
        : cards;
    const mainGrid = document.querySelector("#products > .product-content");
    rankedCards.forEach(card => mainGrid?.appendChild(card));

    document.querySelectorAll("[data-home-category]").forEach(section => {
        const grid = section.querySelector(".product-content");
        const categoryCards = rankedCards
            .filter(card => card.dataset.category === section.dataset.homeCategory)
            .map(card => card.cloneNode(true));
        const rankedCategoryCards = window.MPWRDiscovery
            ? window.MPWRDiscovery.rank(categoryCards, {
                context: `homepage-category-${section.dataset.homeCategory}`
            })
            : categoryCards;
        rankedCategoryCards.forEach(card => grid.appendChild(card));
    });
})();
