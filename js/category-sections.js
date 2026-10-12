(async () => {
    const INDEX_MARKUP_CACHE_KEY = "mpwrIndexMarkupHomepageCampaignLinked";
    const INDEX_MARKUP_CACHE_TIME_KEY = "mpwrIndexMarkupHomepageCampaignLinkedCachedAt";
    const warmIndexMarkupCache = () => {
        try {
            sessionStorage.setItem(INDEX_MARKUP_CACHE_KEY, `<!DOCTYPE html>\n${document.documentElement.outerHTML}`);
            sessionStorage.setItem(INDEX_MARKUP_CACHE_TIME_KEY, String(Date.now()));
        } catch (_) {}
    };

    const page = window.location.pathname.split("/").pop().toLowerCase();
    const isHomepage = page === "" || page === "index.html";
    if (isHomepage) warmIndexMarkupCache();

    await (window.MPWRCatalogueReady || Promise.resolve(window.products));

    const categoryCampaignDefaults = {
        eyebrow: "Limited Offers",
        heading: "15% off selected favourites",
        body: "Bring your next beauty refresh home for less with limited-time campaign deals.",
        buttonLabel: "Shop offers",
        buttonLink: "Campaign.html",
        image: "images/Icon Folder/Discount Icon_E5A484.PNG"
    };

    const cleanText = (value, fallback, maxLength) => {
        const cleaned = String(value || "").trim().replace(/\s+/g, " ");
        return (cleaned || fallback).slice(0, maxLength);
    };

    const renderCategoryCampaignBanner = pageCategory => {
        document.querySelector(".homepage-hero")?.remove();
        document.querySelectorAll(".homepage-campaign-banner").forEach(section => section.remove());
        document.body.classList.remove("has-homepage-hero");
        if (!pageCategory || pageCategory.category === "all") return;
        let cachedCampaign = null;
        try {
            cachedCampaign = JSON.parse(localStorage.getItem("mpwrCampaignBanner") || "null");
        } catch (_) {
            cachedCampaign = null;
        }
        const campaign = window.MPWRCampaignBanner || cachedCampaign || {};
        const banner = {
            eyebrow: cleanText(campaign.eyebrow, categoryCampaignDefaults.eyebrow, 40),
            heading: cleanText(campaign.heading, categoryCampaignDefaults.heading, 80),
            body: cleanText(campaign.body, categoryCampaignDefaults.body, 180),
            buttonLabel: cleanText(campaign.buttonLabel, categoryCampaignDefaults.buttonLabel, 32),
            buttonLink: String(campaign.buttonLink || "").trim() || categoryCampaignDefaults.buttonLink,
            image: String(campaign.image || categoryCampaignDefaults.image).trim()
        };
        const productsSection = document.querySelector("#products");
        if (!productsSection?.parentNode) return;
        let section = document.querySelector(".category-campaign-banner");
        if (!section) {
            section = document.createElement("section");
            section.className = "homepage-campaign-banner category-campaign-banner";
            section.innerHTML = `
                <img class="homepage-campaign-image" alt="">
                <div class="homepage-campaign-copy">
                    <p class="homepage-campaign-eyebrow"></p>
                    <h2></h2>
                    <p class="homepage-campaign-body"></p>
                </div>
                <a class="homepage-campaign-button"></a>
            `;
        }
        productsSection.parentNode.insertBefore(section, productsSection);
        section.querySelector(".homepage-campaign-eyebrow").textContent = banner.eyebrow;
        section.querySelector("h2").textContent = banner.heading;
        section.querySelector(".homepage-campaign-body").textContent = banner.body;
        const button = section.querySelector(".homepage-campaign-button");
        button.textContent = banner.buttonLabel;
        button.href = banner.buttonLink;
        const image = section.querySelector(".homepage-campaign-image");
        image.src = banner.image;
        image.alt = banner.heading;
    };

    if (!isHomepage) {
        document.body.classList.add("category-page");
        const categoryPages = {
            "nails.html": { category: "press-ons", title: "Press-On Nails" },
            "wigs.html": { category: "wigs", title: "Wigs" },
            "lashes.html": { category: "lashes", title: "Lashes" },
            "productspage.html": { category: "products", title: "Products" }
        };
        const requestedCategory = String(new URLSearchParams(window.location.search).get("category") || "").trim();
        const requestedCategoryDetails = (window.MPWRCategoryOrder || [])
            .find(category => category.slug === requestedCategory);
        const pageCategory = page === "productspage.html" && requestedCategory === "all"
            ? { category: "all", title: "Shop All" }
            : page === "productspage.html" && requestedCategoryDetails
                ? { category: requestedCategoryDetails.slug, title: requestedCategoryDetails.label }
                : categoryPages[page];
        if (pageCategory) {
            renderCategoryCampaignBanner(pageCategory);
            const section = document.querySelector("#products");
            const grid = section?.querySelector(":scope > .product-content");
            section?.setAttribute("aria-label", `${pageCategory.title} catalogue`);
            const heading = section?.querySelector(":scope > .section-title");
            if (heading) heading.textContent = pageCategory.title;
            document.title = `${pageCategory.title} | MPWR`;
            if (pageCategory.category === "all") {
                document.body.classList.add("shop-all-page");
            } else {
                [...(grid?.querySelectorAll(":scope > .product-box") || [])].forEach(card => {
                    if (card.dataset.category !== pageCategory.category) card.remove();
                });
            }
            window.MPWRDiscovery?.rankElements(grid, {
                context: pageCategory.category === "all" ? "shop-all" : `category-page-${pageCategory.category}`
            });
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
    warmIndexMarkupCache();
})();
