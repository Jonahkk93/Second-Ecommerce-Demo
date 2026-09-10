(async () => {
    await (window.MPWRCatalogueReady || Promise.resolve(window.products));

    const page = window.location.pathname.split("/").pop().toLowerCase();
    const isHomepage = page === "" || page === "index.html";

    if (!isHomepage) {
        document.body.classList.add("category-page");
        const categoryPages = {
            "nails.html": { category: "press-ons", title: "Press-On Nails" },
            "wigs.html": { category: "wigs", title: "Wigs" },
            "lashes.html": { category: "lashes", title: "Lashes" },
            "productspage.html": { category: "products", title: "Products" }
        };
        const pageCategory = categoryPages[page];
        if (pageCategory) {
            const section = document.querySelector("#products");
            const grid = section?.querySelector(":scope > .product-content");
            section?.setAttribute("aria-label", `${pageCategory.title} catalogue`);
            const heading = section?.querySelector(":scope > .section-title");
            if (heading) heading.textContent = pageCategory.title;
            document.title = `${pageCategory.title} | MPWR`;
            [...(grid?.querySelectorAll(":scope > .product-box") || [])].forEach(card => {
                if (card.dataset.category !== pageCategory.category) card.remove();
            });
            window.MPWRDiscovery?.rankElements(grid, { context: `category-page-${pageCategory.category}` });
        }
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
