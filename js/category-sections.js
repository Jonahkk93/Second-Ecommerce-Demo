(() => {
    const page = window.location.pathname.split("/").pop().toLowerCase();
    const isHomepage = page === "" || page === "index.html";

    if (!isHomepage) {
        document.body.classList.add("category-page");
        return;
    }

    const cards = Array.from(
        document.querySelectorAll("#products > .product-content > .product-box")
    );

    document.querySelectorAll("[data-home-category]").forEach(section => {
        const grid = section.querySelector(".product-content");
        cards
            .filter(card => card.dataset.category === section.dataset.homeCategory)
            .forEach(card => grid.appendChild(card.cloneNode(true)));
    });
})();
