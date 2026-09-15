(() => {
    const sidebar = document.querySelector("[data-management-sidebar]");
    if (!sidebar) return;

    const page = window.location.pathname.split("/").pop() || "admin.html";
    const hash = window.location.hash.toLowerCase();
    const onDashboard = page === "admin.html";
    const onProducts = page === "admin-products.html";

    const activeKey = onDashboard
        ? (hash === "#orders" ? "orders" : "dashboard")
        : onProducts
            ? (hash === "#homepage" ? "homepage" : hash === "#deleted-products" ? "deleted" : "products")
            : page === "admin-reviews.html"
                ? "reviews"
                : page === "admin-analytics.html"
                    ? "analytics"
                    : "";

    const icon = (file) => `<span><img src="images/Icon Folder/${file}" alt=""></span>`;
    const link = (key, href, label, iconMarkup, extra = "") =>
        `<a class="management-nav-item${activeKey === key ? " active" : ""}" href="${href}"${extra}>${iconMarkup}${label}</a>`;
    const comingSoon = (label, iconMarkup) =>
        `<button class="management-nav-item" data-coming-soon="${label}" type="button">${iconMarkup}${label}</button>`;

    const productExtra = onProducts ? ' data-panel="catalogue"' : "";
    const homepageExtra = onProducts ? ' data-panel="homepage"' : "";
    const deletedExtra = onProducts ? ' data-panel="deleted"' : "";
    const dashboardHref = onDashboard ? "admin.html" : "admin.html";
    const ordersHref = onDashboard ? "#orders" : "admin.html#orders";

    sidebar.innerHTML = `
        <a class="management-brand" href="admin.html" aria-label="MPWR admin dashboard">
            <span>MPWR</span><small>Management</small>
        </a>
        <nav class="management-nav" aria-label="Management sections">
            ${link("dashboard", dashboardHref, "Dashboard", icon("Dashboard Icon_Light Gray.PNG"))}
            ${link("orders", ordersHref, "Orders", icon("Order status_Light Gray.PNG"))}
            ${link("products", "admin-products.html#products", "Products", icon("Products 2 Icon_Light Gray.PNG"), productExtra)}
            ${link("homepage", "admin-products.html#homepage", "Homepage", icon("Home Icon_Light Gray.PNG"), homepageExtra)}
            ${link("deleted", "admin-products.html#deleted-products", '<span class="management-nav-label">Deleted Products <em id="deleted-nav-count">0</em></span>', icon("Delete Icon_Light Gray.PNG"), deletedExtra)}
            ${comingSoon("Customers", icon("Customers Icon_Light Gray.PNG"))}
            ${link("reviews", "admin-reviews.html", '<span class="management-nav-label">Reviews <em id="reviews-nav-count">0</em></span>', icon("Reviews Icon_Light Gray.PNG"))}
            ${link("analytics", "admin-analytics.html", "Analytics", icon("Analytics Icon_Light Gray.PNG"))}
            ${comingSoon("Marketing", icon("Marketing Icon_Light Gray.PNG"))}
            ${comingSoon("Coupons", "<span>◇</span>")}
            ${comingSoon("Settings", icon("Settings Icon_Light Gray.PNG"))}
            ${link("website", "index.html", "View website", "<span>↗</span>", ' target="_blank"')}
        </nav>
        <div class="admin-account">
            <button class="admin-account-button" id="admin-account-button" type="button" aria-label="Admin account" aria-expanded="false">
                <img class="admin-account-photo" id="admin-account-photo" alt="">
                <span class="admin-account-initials" id="admin-account-initials" aria-hidden="true">A</span>
            </button>
            <span class="admin-account-name" id="admin-account-name">Administrator</span>
            <div class="admin-account-menu" id="admin-account-menu" hidden>
                <p class="admin-account-label">Administrator</p>
                <p class="admin-account-email" id="admin-account-email">Admin account</p>
                <a class="admin-view-profile" href="admin-profile.html">View Profile</a>
                <button type="button" id="admin-signout">Sign Out</button>
            </div>
        </div>`;

    const setReviewsCount = count => {
        const badge = sidebar.querySelector("#reviews-nav-count");
        if (badge) badge.textContent = String(Math.max(0, Number(count) || 0));
    };

    const setDeletedProductsCount = count => {
        const badge = sidebar.querySelector("#deleted-nav-count");
        if (badge) badge.textContent = String(Math.max(0, Number(count) || 0));
    };

    const loadReviewsCount = async () => {
        const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
        const apiRoot = window.MPWR_API_URL || (localHost ? "http://127.0.0.1:3000/v1" : "/api/v1");
        try {
            const response = await fetch(`${apiRoot}/admin/reviews`, { credentials: "include" });
            if (!response.ok) return;
            const reviews = await response.json();
            const awaiting = Array.isArray(reviews)
                ? reviews.filter(review => !String(review.adminReply || "").trim() && !review.adminSeenAt).length
                : 0;
            setReviewsCount(awaiting);
        } catch (_error) {
            // Keep the badge at zero while the management API is unavailable.
        }
    };

    const loadDeletedProductsCount = async () => {
        const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
        const apiRoot = window.MPWR_API_URL || (localHost ? "http://127.0.0.1:3000/v1" : "/api/v1");
        try {
            const response = await fetch(`${apiRoot}/admin/products/deleted`, { credentials: "include" });
            if (!response.ok) return;
            const products = await response.json();
            setDeletedProductsCount(Array.isArray(products) ? products.length : 0);
        } catch (_error) {
            // Keep the badge at zero while the management API is unavailable.
        }
    };

    window.addEventListener("management-reviews-count", event => setReviewsCount(event.detail?.count));
    loadReviewsCount();
    loadDeletedProductsCount();

    const syncActiveItem = () => {
        if (!onDashboard) return;
        const selected = window.location.hash.toLowerCase() === "#orders" ? "orders" : "dashboard";
        sidebar.querySelectorAll(".management-nav-item").forEach(item => {
            const itemKey = item.getAttribute("href") === "#orders" ? "orders" : item.getAttribute("href") === "admin.html" ? "dashboard" : "";
            if (itemKey) item.classList.toggle("active", itemKey === selected);
        });
    };

    window.addEventListener("hashchange", syncActiveItem);
    if (window.matchMedia("(max-width: 780px)").matches) {
        window.requestAnimationFrame(() => sidebar.querySelector(".management-nav-item.active")?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" }));
    }
    document.dispatchEvent(new CustomEvent("management-navigation:ready"));
})();
