(() => {
    fetch("index.html", { cache: "no-store" })
        .then(response => {
            if (!response.ok) throw new Error(`Unable to load page (${response.status})`);
            return response.text();
        })
        .then(markup => {
            markup = markup.replace(
                /\s*<!--FOOTER-->\s*<footer class="footer">[\s\S]*?<\/footer>/,
                ""
            );

            markup = markup.replace(
                '<a href="Nails.html">',
                `<a href="index.html" class="category-sidebar-home">
                    <img src="images/Icon Folder/Home Icon_E5A484.PNG" class="sidebar-item-icon" alt="">
                    <span>Home</span>
                </a>
            </li>
            <li>
                <a href="Nails.html">`
            );

            const currentPage = window.location.pathname.split("/").pop().toLowerCase();
            const categoryLinks = {
                "nails.html": "Nails.html",
                "wigs.html": "Wigs.html",
                "lashes.html": "Lashes.html",
                "productspage.html": "ProductsPage.html",
                "discounts.html": "Discounts.html",
                "campaign.html": "Campaign.html"
            };
            const currentCategoryLink = categoryLinks[currentPage];

            if (currentCategoryLink) {
                markup = markup.replace(
                    `<a href="${currentCategoryLink}">`,
                    `<a href="${currentCategoryLink}" aria-current="page">`
                );
            }

            markup = markup.replace(
                '<a href="index.html" class="logo">MPWR</a>',
                '<a href="index.html" class="category-back-button" aria-label="Back to home"></a>'
            );

            markup = markup.replace(
                '<!--SEARCH ICON IN NAV-->',
                `<!--HOME ICON IN NAV-->
    <a href="index.html" class="category-nav-home" aria-label="Home" title="Home">
        <img src="images/Icon Folder/Home Icon_333.PNG" alt="">
    </a>

<!--SEARCH ICON IN NAV-->`
            );

            document.open();
            document.write(markup);
            document.close();
        })
        .catch(error => {
            document.body.innerHTML = `
                <main style="padding:40px;font-family:system-ui;text-align:center">
                    <h1>Unable to load this page</h1>
                    <p>${error.message}</p>
                    <a href="index.html">Return home</a>
                </main>
            `;
        });
})();
