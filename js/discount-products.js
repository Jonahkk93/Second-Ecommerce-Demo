(function initializeHomepageDiscounts() {
    const CACHE_KEY = "mpwrDiscountProducts";
    const CAMPAIGN_CACHE_KEY = "mpwrDiscountCampaignLabel";
    const SECTION_ENABLED_CACHE_KEY = "mpwrDiscountSectionEnabled";
    const MODE_CACHE_KEY = "mpwrDiscountMode";
    const HOMEPAGE_PRODUCT_LIMIT = 10;
    const CAMPAIGN_LABELS = ["Limited Offers", "Valentines Offers", "Christmas Offers", "Black Friday"];
    const LEGACY_CAMPAIGN_LABELS = { Valentines: "Valentines Offers", Christmas: "Christmas Offers" };

    function normalizeCampaignLabel(label) {
        const normalizedLabel = LEGACY_CAMPAIGN_LABELS[label] || label;
        return CAMPAIGN_LABELS.includes(normalizedLabel) ? normalizedLabel : null;
    }
    const pageName = window.location.pathname.split("/").pop().toLowerCase();
    const isHomepage = pageName === "" || pageName === "index.html";
    const isDiscountPage = pageName === "discounts.html";
    const isCampaignPage = pageName === "campaign.html";
    if (isDiscountPage || isCampaignPage) {
        document.body.classList.add("discounts-page");
        if (isDiscountPage) document.title = "Discounts | MPWR";
    }
    const legacyCategories = {
        "1": "press-ons", "2": "press-ons", "4": "press-ons", "5": "press-ons", "6": "press-ons", "8": "press-ons",
        "10": "wigs", "12": "wigs", "13": "wigs", "14": "wigs", "15": "wigs", "11": "lashes"
    };

    function normalizeDiscounts(value) {
        if (!Array.isArray(value)) return null;
        const seen = new Set();
        return value.map(item => ({
            id: String(item?.id || ""),
            percent: Math.min(95, Math.max(1, Math.round(Number(item?.percent) || 15)))
        })).filter(item => item.id && !seen.has(item.id) && seen.add(item.id));
    }

    function createDiscountCard(product, percent, productPricing = null) {
        const card = document.createElement("div");
        card.className = "product-box discount-product-box";
        card.dataset.id = String(product.id);
        card.dataset.category = product.category || legacyCategories[String(product.id)] || "products";
        if (!productPricing) card.dataset.discountPercent = String(percent);

        const imageBox = document.createElement("div");
        imageBox.className = "img-box";

        const wishlistButton = document.createElement("button");
        wishlistButton.className = "wishlist-btn";
        wishlistButton.type = "button";
        wishlistButton.setAttribute("aria-label", `Add ${product.title} to wishlist`);
        const wishlistIcon = document.createElement("img");
        wishlistIcon.src = "images/optimized/heart-outline.png";
        wishlistIcon.className = "wishlist-icon";
        wishlistIcon.alt = "";
        wishlistButton.appendChild(wishlistIcon);

        const badge = document.createElement("span");
        badge.className = "discount-badge";
        badge.textContent = `${percent}% OFF`;

        const image = document.createElement("img");
        image.src = product.image || product.gallery?.[0] || "images/MPWR Logo.PNG";
        image.loading = "lazy";
        image.decoding = "async";
        image.alt = product.title || "Discount product";
        imageBox.append(wishlistButton, badge, image);

        const title = document.createElement("h2");
        title.className = "product-title";
        title.textContent = product.title || "Product";

        const regularPrice = productPricing?.regular ?? Math.max(0, Number(product.price) || 0);
        const salePrice = productPricing?.current ?? Math.round(regularPrice * (1 - percent / 100));
        const priceAndCart = document.createElement("div");
        priceAndCart.className = "price-and-cart";
        const prices = document.createElement("span");
        prices.className = "discount-price-group";
        const price = document.createElement("span");
        price.className = "price";
        price.textContent = `UGX ${salePrice.toLocaleString()}`;
        const originalPrice = document.createElement("span");
        originalPrice.className = "original-price";
        originalPrice.textContent = `UGX ${regularPrice.toLocaleString()}`;
        prices.append(price, originalPrice);

        const addWrapper = document.createElement("i");
        const addIcon = document.createElement("img");
        addIcon.src = "images/Plus.PNG";
        addIcon.className = "addie";
        addIcon.alt = `View ${product.title || "product"}`;
        addWrapper.appendChild(addIcon);
        priceAndCart.append(prices, addWrapper);
        card.append(imageBox, title, priceAndCart);
        return card;
    }

    function applyDiscountPresentation(card, product, percent) {
        if (!card || !product) return;
        card.classList.add("discount-product-box");
        card.dataset.discountPercent = String(percent);

        const imageBox = card.querySelector(".img-box");
        if (imageBox && !imageBox.querySelector(".discount-badge")) {
            const badge = document.createElement("span");
            badge.className = "discount-badge";
            badge.textContent = `${percent}% OFF`;
            imageBox.appendChild(badge);
        }

        const priceAndCart = card.querySelector(".price-and-cart");
        if (!priceAndCart) return;
        const regularPrice = Math.max(0, Number(product.price) || 0);
        const salePrice = Math.round(regularPrice * (1 - percent / 100));
        let priceGroup = priceAndCart.querySelector(".discount-price-group");
        if (!priceGroup) {
            priceGroup = document.createElement("span");
            priceGroup.className = "discount-price-group";
            priceAndCart.querySelector(":scope > .price")?.replaceWith(priceGroup);
            if (!priceGroup.isConnected) priceAndCart.prepend(priceGroup);
        }
        priceGroup.replaceChildren();
        const price = document.createElement("span");
        price.className = "price";
        price.textContent = `UGX ${salePrice.toLocaleString()}`;
        const originalPrice = document.createElement("span");
        originalPrice.className = "original-price";
        originalPrice.textContent = `UGX ${regularPrice.toLocaleString()}`;
        priceGroup.append(price, originalPrice);
    }

    window.MPWRDiscountsReady = (async () => {
        await (window.MPWRCatalogueReady || Promise.resolve(window.products));
        const section = document.querySelector("#discounts");
        const grid = section?.querySelector(".discount-product-content");
        const campaignLabelElement = section?.querySelector(".discount-eyebrow");
        if (!section || !grid) return;

        let configuredDiscounts = null;
        let automaticIds = [];
        let campaignLabel = CAMPAIGN_LABELS[0];
        let sectionEnabled = localStorage.getItem(SECTION_ENABLED_CACHE_KEY) !== "false";
        let discountMode = localStorage.getItem(MODE_CACHE_KEY) === "automatic" ? "automatic" : "manual";
        try {
            configuredDiscounts = normalizeDiscounts(JSON.parse(localStorage.getItem(CACHE_KEY) || "null"));
            const cachedCampaignLabel = normalizeCampaignLabel(localStorage.getItem(CAMPAIGN_CACHE_KEY));
            if (cachedCampaignLabel) campaignLabel = cachedCampaignLabel;
        } catch (_) {
            configuredDiscounts = null;
        }

        try {
            const [, { doc, getDoc }] = await Promise.all([
                import("./firebase.js"),
                import("./firestore-api.js")
            ]);
            if (window.db) {
                const [snapshot, bestsellerSnapshot] = await Promise.all([
                    getDoc(doc(window.db, "storefront", "discounts")),
                    getDoc(doc(window.db, "storefront", "bestsellers"))
                ]);
                const setting = snapshot.data();
                automaticIds = (bestsellerSnapshot.data()?.products || []).map(product => String(product.id)).filter(Boolean);
                if (typeof setting?.enabled === "boolean") {
                    sectionEnabled = setting.enabled;
                    localStorage.setItem(SECTION_ENABLED_CACHE_KEY, String(sectionEnabled));
                }
                discountMode = setting?.mode === "automatic" ? "automatic" : "manual";
                localStorage.setItem(MODE_CACHE_KEY, discountMode);
                const remoteDiscounts = normalizeDiscounts(setting?.products);
                if (remoteDiscounts !== null) {
                    configuredDiscounts = remoteDiscounts;
                    localStorage.setItem(CACHE_KEY, JSON.stringify(remoteDiscounts));
                }
                const remoteCampaignLabel = normalizeCampaignLabel(setting?.label);
                if (remoteCampaignLabel) {
                    campaignLabel = remoteCampaignLabel;
                    localStorage.setItem(CAMPAIGN_CACHE_KEY, campaignLabel);
                }
            }
        } catch (error) {
            console.warn("Using cached homepage discounts", error);
        }

        if (campaignLabelElement) campaignLabelElement.textContent = campaignLabel;
        if (configuredDiscounts === null) {
            configuredDiscounts = [...grid.querySelectorAll(":scope > .discount-product-box")].map(card => ({
                id: String(card.dataset.id || ""),
                percent: Math.min(95, Math.max(1, Math.round(Number(card.dataset.discountPercent) || 15)))
            })).filter(item => item.id);
        }
        const productsById = new Map((window.products || []).map(product => [String(product.id), product]));
        const manualSelected = configuredDiscounts
            .map(discount => ({ ...discount, product: productsById.get(discount.id) }))
            .filter(discount => discount.product && discount.product.active !== false);
        let selected = manualSelected;
        if (discountMode === "automatic") {
            const bestsellerProducts = automaticIds.map(id => productsById.get(id)).filter(product => product && product.active !== false).slice(0, HOMEPAGE_PRODUCT_LIMIT);
            const bestsellerSet = new Set(bestsellerProducts.map(product => String(product.id)));
            const rankedBestsellers = window.MPWRDiscovery
                ? window.MPWRDiscovery.rank(bestsellerProducts, { context: "homepage-discounts-automatic", preferredIds: automaticIds })
                : bestsellerProducts;
            const fallbackProducts = (window.products || []).filter(product => product.active !== false && !bestsellerSet.has(String(product.id)));
            const fallbackLimit = HOMEPAGE_PRODUCT_LIMIT - rankedBestsellers.length;
            const rankedFallbacks = fallbackLimit <= 0
                ? []
                : window.MPWRDiscovery
                    ? window.MPWRDiscovery.rank(fallbackProducts, { context: "homepage-discounts-automatic-fallback", limit: fallbackLimit })
                    : fallbackProducts.slice(0, fallbackLimit);
            selected = [...rankedBestsellers, ...rankedFallbacks].slice(0, HOMEPAGE_PRODUCT_LIMIT).map(product => ({
                id: String(product.id),
                percent: 15,
                product
            }));
        }
        window.MPWRPricing?.setDiscounts(selected.map(({ id, percent }) => ({ id, percent })));

        const productDiscounts = (window.products || []).map(product => {
            const current = Math.max(0, Number(product.price) || 0);
            const regular = Math.max(0, Number(product.compareAtPrice) || 0);
            if (product.active === false || !current || regular <= current) return null;
            return {
                product,
                percent: Math.min(95, Math.max(1, Math.round((1 - current / regular) * 100))),
                pricing: { current, regular }
            };
        }).filter(Boolean);

        // The Discounts catalogue is an aggregate of every price shoppers
        // currently see as reduced. Campaign branding and section visibility
        // do not control whether an item belongs in this catalogue.
        const allDiscountsById = new Map(
            productDiscounts.map(discount => [String(discount.product.id), discount])
        );
        selected.forEach(discount => {
            const regular = Math.max(0, Number(discount.product.price) || 0);
            const current = Math.round(regular * (1 - discount.percent / 100));
            allDiscountsById.set(String(discount.product.id), {
                ...discount,
                pricing: { current, regular }
            });
        });
        const allDiscountedProducts = [...allDiscountsById.values()];
        const isCampaignActive = sectionEnabled && selected.length > 0;

        document.querySelectorAll(".sidebar-campaign-item").forEach(item => {
            const link = item.querySelector('a[href="Campaign.html"]');
            const label = link?.querySelector("span");
            const icon = link?.querySelector(".sidebar-item-icon");
            if (label) label.textContent = campaignLabel;
            if (icon) {
                const campaignIcons = {
                    "Valentines Offers": "images/Icon Folder/Valentines Icon_Red.PNG",
                    "Christmas Offers": "images/Icon Folder/Christmas Icon_Red.PNG"
                };
                icon.src = campaignIcons[campaignLabel] || "images/Icon Folder/Discount Icon_E5A484.PNG";
            }
            item.hidden = !isCampaignActive;
        });

        document.querySelectorAll('a[href="Discounts.html"]').forEach(link => {
            const entry = link.classList.contains("discount-view-all")
                ? link
                : (link.closest("li") || link);
            const isSidebarDiscountEntry = entry.classList?.contains("sidebar-discounts-item");
            entry.hidden = allDiscountedProducts.length === 0 || (isSidebarDiscountEntry && isCampaignActive);
        });

        if (isDiscountPage) {
            if (campaignLabelElement) campaignLabelElement.textContent = "All discounted items";
            const heading = section.querySelector(".section-title");
            if (heading) heading.textContent = "Discounts";
        } else if (isCampaignPage) {
            if (campaignLabelElement) campaignLabelElement.textContent = "Discount campaign";
            const heading = section.querySelector(".section-title");
            if (heading) heading.textContent = campaignLabel;
            document.title = `${campaignLabel} | MPWR`;
        }

        const visibleDiscounts = isDiscountPage
            ? allDiscountedProducts
            : isCampaignPage
                ? (sectionEnabled ? selected : [])
                : selected.slice(0, HOMEPAGE_PRODUCT_LIMIT);
        grid.replaceChildren(...visibleDiscounts.map(discount =>
            createDiscountCard(discount.product, discount.percent, discount.pricing || null)
        ));

        const discountsById = new Map(selected.map(discount => [discount.id, discount]));
        document.querySelectorAll(".product-box[data-id]").forEach(card => {
            if (card.closest("#discounts")) return;
            const discount = discountsById.get(String(card.dataset.id));
            if (!discount) return;
            if (isHomepage && sectionEnabled) {
                card.remove();
                return;
            }
            applyDiscountPresentation(card, discount.product, discount.percent);
        });

        section.hidden = (isDiscountPage || isCampaignPage)
            ? visibleDiscounts.length === 0
            : (!sectionEnabled || visibleDiscounts.length === 0);
    })();
})();
