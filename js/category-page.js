(() => {
    const INDEX_MARKUP_CACHE_KEY = "mpwrIndexMarkupManagedSidebarV2";
    const INDEX_MARKUP_CACHE_TIME_KEY = "mpwrIndexMarkupManagedSidebarCachedAtV2";
    const INDEX_MARKUP_MAX_AGE = 5 * 60 * 1000;

    function cachedIndexMarkup() {
        try {
            const cachedAt = Number(sessionStorage.getItem(INDEX_MARKUP_CACHE_TIME_KEY) || 0);
            const markup = sessionStorage.getItem(INDEX_MARKUP_CACHE_KEY);
            return markup && Date.now() - cachedAt < INDEX_MARKUP_MAX_AGE ? markup : "";
        } catch (_) {
            return "";
        }
    }

    function loadIndexMarkup() {
        const cached = cachedIndexMarkup();
        if (cached) return Promise.resolve(cached);
        return fetch("index.html", { cache: "force-cache" })
            .then(response => {
                if (!response.ok) throw new Error(`Unable to load page (${response.status})`);
                return response.text();
            });
    }

    loadIndexMarkup()
        .then(markup => {
            markup = markup.replace(
                /\s*<!--FOOTER-->\s*<footer class="footer">[\s\S]*?<\/footer>/,
                ""
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
                `<a href="index.html" class="category-back-button" aria-label="Back to home"></a>
        <a href="index.html" class="logo">MPWR</a>`
            );

            markup = markup.replace(
                '<!--SEARCH ICON IN NAV-->',
                `<!--HOME ICON IN NAV-->
    <a href="index.html" class="category-nav-home" aria-label="Home" title="Home">
        <img src="images/Icon Folder/Home Icon_333.PNG" alt="">
    </a>

<!--SEARCH ICON IN NAV-->`
            );

            markup = markup.replace(
                /\s*<!--ACCOUNT ICON IN NAV-->\s*<div id="account-icon">[\s\S]*?<\/div>\s*<\/div>\s*(?=<!--SEARCH BAR-->)/,
                "\n</div>\n\n"
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
