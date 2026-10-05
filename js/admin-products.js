import { onAuthStateChanged } from "./auth-api.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getManagementBootstrap, getSearchInsights, setDoc, updateDoc } from "./firestore-api.js?v=20261001-1";
import { deleteImage, importImage, uploadImage } from "./media-api.js?v=20260929-2";
import { openReviewLightbox } from "./review-lightbox.js?v=20260923-3";

const redirectingToDashboard = window.location.pathname.endsWith("/admin-products.html") && !window.location.hash;
if (redirectingToDashboard) window.location.replace("admin.html");

const auth = window.auth;
const db = window.db;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const DEFAULT_CATEGORIES = [
    { slug: "press-ons", label: "Press-On Nails", image: "images/optimized/nails-icon.png" },
    { slug: "wigs", label: "Wigs", image: "images/optimized/wigs-icon.png" },
    { slug: "lashes", label: "Lashes", image: "images/optimized/lashes-icon.png" },
    { slug: "products", label: "Products", image: "images/Icon Folder/Products 2 Icon_333.PNG" }
];
const UNCATEGORIZED_CATEGORY = "uncategorized";
const categoryLabels = Object.fromEntries(DEFAULT_CATEGORIES.map(category => [category.slug, category.label]));
categoryLabels[UNCATEGORIZED_CATEGORY] = "No Category";
const POPULAR_PRODUCT_LIMIT = 10;
const HOMEPAGE_DISCOUNT_PRODUCT_LIMIT = 10;
const SEARCH_POPULAR_PRODUCT_LIMIT = 12;
const HOMEPAGE_HERO_IMAGE_LIMIT = 10;
const HOMEPAGE_HERO_DESKTOP_CATEGORY_LIMIT = 6;
const HOMEPAGE_HERO_MOBILE_CATEGORY_LIMIT = 4;
const HOMEPAGE_HERO_SMALL_MOBILE_CATEGORY_LIMIT = 3;
const HOMEPAGE_HERO_UPLOAD_LIMIT = 5 * 1024 * 1024;
const HOMEPAGE_HERO_MAX_DIMENSION = 1920;
const DEFAULT_SEARCH_SUGGESTIONS = ["Press-ons", "Wigs", "Lashes", "Nail polish", "Moisturizer", "Pink", "Black", "Shoulder"];
const DEFAULT_TRENDING_SEARCHES = ["Pink nails", "Black wig", "Press-ons", "Lashes", "Black Friday"];
const DEFAULT_SEARCH_SYNONYMS = [
    { term: "nails", synonyms: ["press-ons", "press on nails"] },
    { term: "wig", synonyms: ["wigs", "hair"] },
    { term: "false lashes", synonyms: ["lashes"] }
];
const DEFAULT_DISCOUNTS = ["12", "15", "1", "4", "11"].map(id => ({ id, percent: 15 }));
const DEFAULT_ANNOUNCEMENT_BAR = {
    enabled: true,
    message: "Free delivery on selected orders this week.",
    linkLabel: "Shop now",
    link: "#products"
};
const DEFAULT_HOMEPAGE_HERO = {
    enabled: true,
    eyebrow: "MPWR Beauty",
    heading: "Beauty finds, made easy",
    body: "Shop press-ons, wigs, lashes and self-care favourites curated for effortless everyday glam.",
    buttonLabel: "Shop now",
    buttonLink: "#products",
    image: "images/PressOn Nails_Pink.JPG"
};
const DEFAULT_CAMPAIGN_BANNER = {
    enabled: true,
    eyebrow: "Event",
    heading: "15% off selected favourites",
    body: "Bring your next beauty refresh home for less with limited-time campaign deals.",
    buttonLabel: "Shop offers",
    buttonLink: "Campaign.html",
    image: "images/Icon Folder/Image Icon_White.PNG"
};
const LEGACY_CAMPAIGN_BANNER_DEFAULTS = {
    eyebrow: "Limited Offers",
    image: "images/Icon Folder/Discount Icon_E5A484.PNG"
};
const DISCOUNT_CAMPAIGN_LABELS = ["Limited Offers", "Valentines Offers", "Christmas Offers", "Black Friday"];
const LEGACY_DISCOUNT_CAMPAIGN_LABELS = { Valentines: "Valentines Offers", Christmas: "Christmas Offers" };
const DISCOUNT_CAMPAIGN_ICONS = {
    "Limited Offers": "images/Icon Folder/Discount Icon_E5A484.PNG",
    "Valentines Offers": "images/Icon Folder/Valentines Icon_Red.PNG",
    "Christmas Offers": "images/Icon Folder/Christmas Icon_Red.PNG",
    "Black Friday": "images/Icon Folder/Black Friday.png"
};
const DISCOUNT_CAMPAIGN_COPY = {
    "Limited Offers": "Save on selected beauty favourites while this limited-time campaign is live.",
    "Valentines Offers": "Share the love and save on selected beauty favourites in our Valentine's campaign.",
    "Christmas Offers": "Celebrate the season with savings on selected beauty favourites.",
    "Black Friday": "Shop Black Friday savings on selected beauty favourites while stocks last."
};
const HOMEPAGE_LINK_DESTINATIONS = new Set(["#products", "#discounts", "Campaign.html", "Discounts.html", "Nails.html", "Wigs.html", "Lashes.html", "ProductsPage.html", "search.html"]);
const HOMEPAGE_DESTINATION_SELECTORS = ["#homepage-announcement-link-choice", "#homepage-hero-button-link-choice", "#homepage-campaign-button-link-choice"];
const HOMEPAGE_DESTINATION_GROUPS = [
    {
        type: "homepage",
        label: "Homepage section",
        description: "Send shoppers to a specific section on your homepage.",
        icon: "images/Icon Folder/Home Icon_Black.PNG",
        values: ["#products", "#discounts"]
    },
    {
        type: "store",
        label: "Store page",
        description: "Send shoppers to a page in your store.",
        icon: "images/Icon Folder/Products 2 Icon_Black.PNG",
        values: ["Campaign.html", "Discounts.html", "Nails.html", "Wigs.html", "Lashes.html", "ProductsPage.html", "search.html"]
    },
    {
        type: "advanced",
        label: "Advanced",
        description: "Custom destination URL.",
        icon: "images/Icon Folder/Share Icon_Black.PNG",
        values: ["custom"]
    }
];
const HOMEPAGE_SECTION_ORDER_DEFAULT = ["announcement", "hero", "campaign", "popular", "discounts"];
const HOMEPAGE_SECTION_LOCKED = new Set(["announcement", "hero"]);
const HOMEPAGE_SECTION_DETAILS = {
    announcement: { label: "Announcement Bar", description: "Fixed at the top of the storefront" },
    hero: { label: "Hero Banner", description: "Fixed as the first visual banner" },
    campaign: { label: "Campaign Banner", description: "Promotional banner below the hero" },
    popular: { label: "Popular Products", description: "Main product section on the homepage" },
    discounts: { label: "Discount Campaign", description: "Current discount campaign section" }
};

function normalizeDiscountCampaignLabel(label) {
    const normalizedLabel = LEGACY_DISCOUNT_CAMPAIGN_LABELS[label] || label;
    return DISCOUNT_CAMPAIGN_LABELS.includes(normalizedLabel) ? normalizedLabel : DISCOUNT_CAMPAIGN_LABELS[0];
}

function normalizeHomepageSectionOrder(value) {
    const incoming = Array.isArray(value?.items) ? value.items : value;
    const valid = new Set(HOMEPAGE_SECTION_ORDER_DEFAULT);
    const movable = [];
    (Array.isArray(incoming) ? incoming : []).forEach(item => {
        const key = String(item || "").trim();
        if (!valid.has(key) || HOMEPAGE_SECTION_LOCKED.has(key) || movable.includes(key)) return;
        movable.push(key);
    });
    HOMEPAGE_SECTION_ORDER_DEFAULT.forEach(key => {
        if (!HOMEPAGE_SECTION_LOCKED.has(key) && !movable.includes(key)) movable.push(key);
    });
    return HOMEPAGE_SECTION_ORDER_DEFAULT.filter(key => HOMEPAGE_SECTION_LOCKED.has(key)).concat(movable);
}
const legacyCategories = {
    "1": "press-ons", "2": "press-ons", "4": "press-ons", "5": "press-ons", "6": "press-ons", "8": "press-ons",
    "10": "wigs", "12": "wigs", "13": "wigs", "14": "wigs", "15": "wigs", "11": "lashes"
};
const toast = $(".admin-products-toast");
const productDropdownSync = new WeakMap();
let toastTimer;
let products = [];
let deletedProducts = [];
let categories = DEFAULT_CATEGORIES.map(category => ({ ...category }));
let heroCategoryOrder = DEFAULT_CATEGORIES.map(category => category.slug);
let popularIds = [];
let automaticPopularIds = [];
let automaticPopularSales = new Map();
let discountSelections = [];
let discountCampaignLabel = DISCOUNT_CAMPAIGN_LABELS[0];
let popularMode = "manual";
let discountMode = "manual";
let discountSectionEnabled = true;
let announcementBar = { ...DEFAULT_ANNOUNCEMENT_BAR };
let homepageHero = { ...DEFAULT_HOMEPAGE_HERO };
let homepageSectionOrder = [...HOMEPAGE_SECTION_ORDER_DEFAULT];
let homepageHeroPreviewImage = "";
let homepageHeroPreviewTimer = null;
let homepageHeroPreviewFadeTimer = null;
let homepageHeroPreviewTransitionToken = 0;
let homepageHeroPreviewPlaying = false;
let savedHomepageHeroImageKeys = new Set();
const pendingHomepageHeroImageKeys = new Set();
let campaignBanner = { ...DEFAULT_CAMPAIGN_BANNER };
let searchSettings = { suggestions: [...DEFAULT_SEARCH_SUGGESTIONS], popularProducts: [], popularMode: "automatic", suggestionsEnabled: true, popularEnabled: true, suggestionsHeading: "Suggested searches", popularHeading: "Popular picks", defaultSort: "relevance", trendingEnabled: true, trendingHeading: "Trending searches", trendingSearches: [...DEFAULT_TRENDING_SEARCHES], trendingHiddenSearches: [], trendingAutoRefresh: false, trendingLastAutoRefresh: "", synonyms: DEFAULT_SEARCH_SYNONYMS.map(item => ({ ...item, synonyms: [...item.synonyms] })), emptyFallback: "popular", emptyMessage: "Try a trending search or browse our popular picks.", searchRules: [], autocompleteEnabled: true, autocompleteCategories: true, autocompleteProducts: true, autocompleteProductLimit: 3, typoEnabled: true, typoStrength: "balanced" };
let searchInsights = null;
let activeSynonymAddIndex = null;
let activeSearchSection = "filters";
let searchTrendingExpanded = false;
let editingProduct = null;
let productEditorScrollY = 0;
let pendingMediaPreviewUrls = [];
let selectedMediaFiles = [];
let removedExistingImageUrls = new Set();
let archiveTarget = null;
let restoreTarget = null;
let permanentDeleteTarget = null;
let permanentDeleteButton = null;
let homepageAdditionTarget = null;
let homepageSettingTarget = null;
let homepageRemovalTarget = null;
let discountRemovalTarget = null;
let homepagePanelResizeObserver = null;
let homepageAutosaveTimer = null;
let homepageAutosaveQueue = Promise.resolve();
let homepageAutosaveMessage = "";
let activeHomepageSection = "announcement";
let categorySlugEdited = false;
let categoryProductIds = new Set();
let categoryReassignmentIds = new Set();
let categoryReassignmentTarget = null;
let categoryImageFile = null;
let categoryImagePreviewUrl = "";
const catalogueChannel = "BroadcastChannel" in window ? new BroadcastChannel("mpwr-catalogue") : null;
const panelHashes = { catalogue: "products", homepage: "homepage", search: "search-page", deleted: "deleted-products" };
const hashPanels = Object.fromEntries(Object.entries(panelHashes).map(([panel, hash]) => [hash, panel]));

function productVisibility(product) {
    return ["active", "hidden", "draft"].includes(product?.visibility)
        ? product.visibility
        : (product?.active === false ? "draft" : "active");
}

function isStorefrontActive(product) {
    return productVisibility(product) === "active";
}

function notifyStorefrontChange() {
    const revision = String(Date.now());
    localStorage.setItem("mpwrCatalogueRevision", revision);
    catalogueChannel?.postMessage({ type: "catalogue-changed", revision });
}

function cleanHeroText(value, fallback, maxLength) {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    return (text || fallback).slice(0, maxLength);
}

function canonicalHomepageLink(value, context = "") {
    const link = String(value || "").trim();
    return link;
}

function syncHomepageLinkDestination(select, { writePreset = false } = {}) {
    if (!select) return;
    const input = document.getElementById(select.dataset.linkInput);
    if (!input) return;
    const currentLink = canonicalHomepageLink(input.value, select.dataset.linkContext);
    const choice = HOMEPAGE_LINK_DESTINATIONS.has(currentLink) ? currentLink : "custom";
    if (!writePreset) select.value = choice;
    if (writePreset && select.value !== "custom") input.value = select.value;
    if (!writePreset && choice !== "custom") input.value = choice;
    const customField = document.querySelector(`[data-link-custom-field="${select.dataset.linkInput}"]`);
    if (customField) customField.hidden = select.value !== "custom";
    productDropdownSync.get(select)?.();
    select.homepageDestinationSync?.();
}

function syncHomepageLinkDestinations() {
    HOMEPAGE_DESTINATION_SELECTORS.forEach(selector => syncHomepageLinkDestination($(selector)));
}

function normalizeAnnouncementBar(value = {}) {
    return {
        enabled: value.enabled !== false,
        message: cleanHeroText(value.message, DEFAULT_ANNOUNCEMENT_BAR.message, 120),
        linkLabel: cleanHeroText(value.linkLabel, DEFAULT_ANNOUNCEMENT_BAR.linkLabel, 32),
        link: normalizeStorefrontLink(cleanHeroText(value.link, DEFAULT_ANNOUNCEMENT_BAR.link, 140), DEFAULT_ANNOUNCEMENT_BAR.link)
    };
}

function readAnnouncementBarForm() {
    announcementBar = normalizeAnnouncementBar({
        enabled: $("#homepage-announcement-enabled").checked,
        message: $("#homepage-announcement-message").value,
        linkLabel: $("#homepage-announcement-link-label").value,
        link: $("#homepage-announcement-link").value
    });
    return announcementBar;
}

function syncHomepageTabVisibility(input, enabled, sectionName) {
    const control = input?.closest(".homepage-tab-visibility");
    if (!control) return;
    const action = enabled ? "Hide" : "Show";
    control.classList.toggle("is-off", !enabled);
    control.title = `${action} ${sectionName}`;
    input.setAttribute("aria-label", `${action} ${sectionName}`);
    const icon = control.querySelector("img");
    if (icon) icon.src = `images/Icon Folder/Shutdown Icon_${enabled ? "E5A484" : "Gray"}.PNG?v=20261003-2`;
}

function syncSearchVisibilityIcon(input, enabled, sectionName) {
    const control = input?.closest(".search-visibility-toggle");
    if (!control) return;
    const action = enabled ? "Hide" : "Show";
    control.classList.toggle("is-off", !enabled);
    control.title = `${action} ${sectionName}`;
    input.setAttribute("aria-label", `${action} ${sectionName}`);
    const icon = control.querySelector("img");
    if (icon) icon.src = `images/Icon Folder/Shutdown Icon_${enabled ? "E5A484" : "Gray"}.PNG?v=20261003-2`;
}

function syncCampaignBannerTabIcon() {
    const control = $("#homepage-campaign-enabled")?.closest(".homepage-tab-visibility");
    const synced = Boolean($("#homepage-campaign-sync")?.checked);
    control?.classList.toggle("is-synced", synced);
    const icon = control?.querySelector("img");
    if (icon && synced) icon.src = "images/Icon Folder/Link Icon_E5A484.PNG?v=20261003-2";
}

function syncCampaignSyncCard() {
    const card = $("#campaign-sync-card");
    if (!card) return;
    const source = $("#homepage-campaign-source")?.value;
    const syncToggle = $("#homepage-campaign-sync");
    const linked = source === "discounts";
    const synced = linked && Boolean(syncToggle?.checked);
    const label = discountCampaignLabel;
    const copy = DISCOUNT_CAMPAIGN_COPY[label] || DEFAULT_CAMPAIGN_BANNER.body;
    const icon = card.querySelector(".campaign-sync-campaign-icon");
    if (icon) icon.src = synced ? (DISCOUNT_CAMPAIGN_ICONS[label] || DEFAULT_CAMPAIGN_BANNER.image) : DEFAULT_CAMPAIGN_BANNER.image;
    const labelNode = card.querySelector("[data-campaign-sync-label]");
    if (labelNode) labelNode.textContent = linked ? label : "No campaign linked";
    const copyNode = card.querySelector("[data-campaign-sync-copy]");
    if (copyNode) copyNode.textContent = linked ? copy : "Choose the current discount campaign to sync banner content.";
    const status = card.querySelector("[data-campaign-sync-status]");
    if (status) status.textContent = synced ? "Synced" : linked ? "Ready to sync" : "Not linked";
    const toggleLabel = card.querySelector(".campaign-sync-toggle span");
    if (toggleLabel) toggleLabel.textContent = synced ? "Unsync" : "Sync";
    card.classList.toggle("is-synced", synced);
    card.classList.toggle("is-disabled", !linked);
}

function renderAnnouncementBarPreview() {
    const announcement = readAnnouncementBarForm();
    const preview = $("#homepage-announcement-preview");
    const panel = $("#homepage-section-announcement");
    panel.classList.toggle("section-disabled", !announcement.enabled);
    panel.inert = !announcement.enabled;
    preview.classList.toggle("is-hidden", !announcement.enabled);
    syncHomepageTabVisibility($("#homepage-announcement-enabled"), announcement.enabled, "Announcement Bar");
    preview.querySelector("span").textContent = announcement.message;
    const link = preview.querySelector("a");
    link.textContent = announcement.linkLabel;
    link.href = announcement.link || "#products";
}

function syncAnnouncementBarForm() {
    $("#homepage-announcement-enabled").checked = announcementBar.enabled !== false;
    $("#homepage-announcement-message").value = announcementBar.message;
    $("#homepage-announcement-link-label").value = announcementBar.linkLabel;
    $("#homepage-announcement-link").value = announcementBar.link;
    syncHomepageLinkDestination($("#homepage-announcement-link-choice"));
    renderAnnouncementBarPreview();
}

function normalizeHeroImages(value = {}) {
    const hasImageList = Array.isArray(value.images);
    const source = hasImageList
        ? value.images
        : [{ url: value.image || DEFAULT_HOMEPAGE_HERO.image, key: value.imageKey }];
    const images = source.map((item, index) => typeof item === "string" ? { url: item, key: "", source: "", slot: index + 1 } : {
        url: cleanHeroText(item?.url, "", 500),
        key: cleanHeroText(item?.key, "", 500),
        source: item?.source === "upload" ? "upload" : "",
        slot: Number.isInteger(Number(item?.slot)) && Number(item.slot) >= 1 && Number(item.slot) <= HOMEPAGE_HERO_IMAGE_LIMIT
            ? Number(item.slot)
            : index + 1
    }).filter(item => item.url).slice(0, HOMEPAGE_HERO_IMAGE_LIMIT).sort((a, b) => a.slot - b.slot);
    return images;
}

function normalizePastedImageUrl(value) {
    let candidate = String(value || "").trim().replace(/&amp;/gi, "&");
    if (!candidate) return "";
    try {
        const parsed = new URL(candidate);
        if (!["http:", "https:"].includes(parsed.protocol)) return "";
        const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname) || parsed.hostname === "google.com";
        if (isGoogle) {
            const embeddedImage = parsed.searchParams.get("imgurl")
                || parsed.searchParams.get("mediaurl")
                || parsed.searchParams.get("image_url");
            if (embeddedImage) candidate = embeddedImage;
        }
        const normalized = new URL(candidate);
        return ["http:", "https:"].includes(normalized.protocol) ? normalized.href : "";
    } catch { return ""; }
}

function isGooglePageLink(value) {
    try {
        const parsed = new URL(value);
        const googleHost = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname) || parsed.hostname === "google.com";
        const googleShareLink = parsed.hostname === "images.app.goo.gl" || parsed.hostname === "share.google";
        return (googleHost || googleShareLink) && !parsed.searchParams.get("imgurl") && !parsed.searchParams.get("mediaurl") && !parsed.searchParams.get("image_url");
    } catch {
        return false;
    }
}

function normalizeStorefrontLink(value, fallback = "#products") {
    const candidate = String(value || "").trim();
    if (!candidate) return fallback;
    if (candidate.startsWith("#") || candidate.startsWith("/") || candidate.startsWith("./") || candidate.startsWith("../")) return candidate;
    try {
        const parsed = new URL(candidate, window.location.href);
        return ["http:", "https:"].includes(parsed.protocol) ? candidate : fallback;
    } catch { return fallback; }
}

async function optimizeHeroImage(file) {
    if (file.type === "image/gif") return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { return file; }
    const scale = Math.min(1, HOMEPAGE_HERO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= HOMEPAGE_HERO_UPLOAD_LIMIT && file.type === "image/webp") {
        bitmap.close();
        return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .86));
    if (!blob) return file;
    const optimized = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp", lastModified: file.lastModified });
    return optimized.size < file.size || file.size > HOMEPAGE_HERO_UPLOAD_LIMIT ? optimized : file;
}

function syncHomepageHeroUrlFields(images) {
    [...document.querySelectorAll(".homepage-hero-url-input")].forEach((field, index) => {
        const slot = index + 1;
        const row = field.closest(".field");
        const item = images.find(image => image.slot === index + 1);
        const filledByPhoto = Boolean(item && (item.source === "upload" || item.key));
        const filledByUrl = Boolean(item && !filledByPhoto);
        if (row) {
            row.dataset.heroUrlSlot = String(slot);
            row.draggable = filledByUrl;
            row.classList.toggle("hero-url-row-filled", filledByUrl);
            row.classList.toggle("hero-url-row-locked", filledByPhoto);
        }
        field.disabled = filledByPhoto;
        field.value = filledByPhoto ? "" : (item?.url || "");
        field.placeholder = filledByPhoto ? "Image slot is already filled" : "Paste image URL here";
        const previewButton = field.closest(".hero-url-control")?.querySelector("[data-hero-url-preview]");
        if (previewButton) previewButton.disabled = filledByPhoto;
    });
}

function normalizeHomepageHero(value = {}) {
    const images = normalizeHeroImages(value);
    return {
        enabled: value.enabled !== false,
        eyebrow: cleanHeroText(value.eyebrow, DEFAULT_HOMEPAGE_HERO.eyebrow, 40),
        heading: cleanHeroText(value.heading, DEFAULT_HOMEPAGE_HERO.heading, 80),
        body: cleanHeroText(value.body, DEFAULT_HOMEPAGE_HERO.body, 180),
        buttonLabel: cleanHeroText(value.buttonLabel, DEFAULT_HOMEPAGE_HERO.buttonLabel, 32),
        buttonLink: normalizeStorefrontLink(cleanHeroText(value.buttonLink, DEFAULT_HOMEPAGE_HERO.buttonLink, 140), DEFAULT_HOMEPAGE_HERO.buttonLink),
        image: images[0]?.url || "",
        imageKey: images[0]?.key || "",
        images,
        categoryOrder: normalizeHeroCategoryOrder(value.categoryOrder)
    };
}

function readHomepageHeroForm() {
    let images;
    try { images = JSON.parse($("#homepage-hero-images").value || "[]"); }
    catch { images = []; }
    homepageHero = normalizeHomepageHero({
        enabled: $("#homepage-hero-enabled").checked,
        eyebrow: $("#homepage-hero-eyebrow").value,
        heading: $("#homepage-hero-heading").value,
        body: $("#homepage-hero-body").value,
        buttonLabel: $("#homepage-hero-button-label").value,
        buttonLink: $("#homepage-hero-button-link").value,
        image: $("#homepage-hero-image").value,
        imageKey: $("#homepage-hero-image-key").value,
        images,
        categoryOrder: heroCategoryOrder
    });
    heroCategoryOrder = [...homepageHero.categoryOrder];
    return homepageHero;
}

function heroCategoryVisibilityLabel(index) {
    if (index < HOMEPAGE_HERO_SMALL_MOBILE_CATEGORY_LIMIT) return "All screens";
    if (index < HOMEPAGE_HERO_MOBILE_CATEGORY_LIMIT) return "Wide phones + desktop";
    if (index < HOMEPAGE_HERO_DESKTOP_CATEGORY_LIMIT) return "Desktop only";
    return "All page only";
}

function orderedHeroCategories() {
    const bySlug = new Map(categories.map(category => [category.slug, category]));
    return normalizeHeroCategoryOrder(heroCategoryOrder).map(slug => bySlug.get(slug)).filter(Boolean);
}

function renderHeroCategoryPreview() {
    const nav = $("#homepage-hero-preview .management-storefront-hero-categories");
    if (!nav) return;
    const ordered = orderedHeroCategories();
    const visible = ordered.slice(0, HOMEPAGE_HERO_DESKTOP_CATEGORY_LIMIT);
    const categoryMarkup = visible.map((category, index) => {
        const responsiveClass = index >= HOMEPAGE_HERO_MOBILE_CATEGORY_LIMIT
            ? " hero-category-desktop-only"
            : index >= HOMEPAGE_HERO_SMALL_MOBILE_CATEGORY_LIMIT
                ? " hero-category-wide-mobile-only"
                : "";
        return `<span class="${index === 0 ? "is-featured" : ""}${responsiveClass}">${escapeHtml(category.label)}</span>`;
    }).join("");
    const allMarkup = ordered.length > HOMEPAGE_HERO_SMALL_MOBILE_CATEGORY_LIMIT
        ? `<span class="hero-category-all${ordered.length > HOMEPAGE_HERO_DESKTOP_CATEGORY_LIMIT ? " is-desktop-visible" : ""}${ordered.length > HOMEPAGE_HERO_MOBILE_CATEGORY_LIMIT ? " is-mobile-visible" : ""}${ordered.length > HOMEPAGE_HERO_SMALL_MOBILE_CATEGORY_LIMIT ? " is-small-mobile-visible" : ""}">All</span>`
        : "";
    nav.innerHTML = categoryMarkup + allMarkup;
}

function renderHeroCategoryOrder() {
    const list = $("#hero-category-order-list");
    if (!list) return;
    heroCategoryOrder = normalizeHeroCategoryOrder(heroCategoryOrder);
    const ordered = orderedHeroCategories();
    $("#hero-category-count").textContent = `${ordered.length} categor${ordered.length === 1 ? "y" : "ies"}`;
    list.innerHTML = ordered.map((category, index) => `
        <article class="hero-category-order-item" draggable="true" tabindex="0" data-slug="${escapeHtml(category.slug)}" aria-label="${escapeHtml(category.label)}, ${heroCategoryVisibilityLabel(index)}. Drag or use the left and right arrow keys to reorder.">
            <span class="hero-category-order-drag${index < HOMEPAGE_HERO_DESKTOP_CATEGORY_LIMIT ? " is-position" : ""}" aria-hidden="true">${index < HOMEPAGE_HERO_DESKTOP_CATEGORY_LIMIT ? index + 1 : '<img src="images/Icon Folder/Menu Bar Icon_Gray.PNG" alt="">'}</span>
            <div class="hero-category-order-copy"><strong title="${escapeHtml(category.label)}">${escapeHtml(category.label)}</strong><small title="${heroCategoryVisibilityLabel(index)}">${heroCategoryVisibilityLabel(index)}</small></div>
        </article>
    `).join("");
    renderHeroCategoryPreview();
}

function moveHeroCategory(slug, direction) {
    const index = heroCategoryOrder.indexOf(slug);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= heroCategoryOrder.length) return;
    const next = [...heroCategoryOrder];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    heroCategoryOrder = next;
    renderHeroCategoryOrder();
}

function reorderHeroCategory(dragSlug, targetSlug, placeAfter = false) {
    if (!dragSlug || !targetSlug || dragSlug === targetSlug) return;
    const withoutDragged = heroCategoryOrder.filter(slug => slug !== dragSlug);
    const targetIndex = withoutDragged.indexOf(targetSlug);
    if (targetIndex < 0) return;
    withoutDragged.splice(targetIndex + (placeAfter ? 1 : 0), 0, dragSlug);
    heroCategoryOrder = withoutDragged;
    renderHeroCategoryOrder();
}

function initializeHeroCategoryReorder() {
    const list = $("#hero-category-order-list");
    const items = () => [...list.querySelectorAll(".hero-category-order-item")];
    const animateLayout = mutate => {
        const before = new Map(items().map(item => [item, item.getBoundingClientRect()]));
        mutate();
        items().forEach(item => {
            const start = before.get(item);
            if (!start) return;
            const end = item.getBoundingClientRect();
            const dx = start.left - end.left;
            const dy = start.top - end.top;
            if (!dx && !dy) return;
            item.animate([
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "translate(0, 0)" }
            ], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
        });
    };
    let draggedSlug = "";
    let dropTarget = null;
    let dropTargets = [];
    let previewKey = "";
    const captureDropTargets = () => {
        dropTargets = items().map(item => {
            const rect = item.getBoundingClientRect();
            return {
                slug: item.dataset.slug,
                left: rect.left,
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2
            };
        });
    };
    const nearestDropTarget = event => {
        if (!dropTargets.length) captureDropTargets();
        let nearest = null;
        let nearestDistance = Infinity;
        dropTargets.forEach(target => {
            const distance = Math.hypot(event.clientX - target.centerX, event.clientY - target.centerY);
            if (distance >= nearestDistance) return;
            nearestDistance = distance;
            nearest = target;
        });
        return nearest ? { slug: nearest.slug, placeAfter: event.clientX > nearest.centerX } : null;
    };
    const resetPreview = () => {
        previewKey = "";
        items().forEach(item => {
            item.style.removeProperty("order");
            item.classList.remove("is-making-space");
        });
    };
    const previewSpace = target => {
        if (!target || !draggedSlug) return;
        if (target.slug === draggedSlug) {
            if (previewKey) animateLayout(resetPreview);
            return;
        }
        const key = `${target.slug}:${target.placeAfter}`;
        if (previewKey === key) return;
        previewKey = key;
        const nextOrder = heroCategoryOrder.filter(slug => slug !== draggedSlug);
        const targetIndex = nextOrder.indexOf(target.slug);
        if (targetIndex < 0) return;
        nextOrder.splice(targetIndex + (target.placeAfter ? 1 : 0), 0, draggedSlug);
        animateLayout(() => {
            items().forEach(item => {
                item.style.order = String(nextOrder.indexOf(item.dataset.slug));
                item.classList.toggle("is-making-space", item.dataset.slug !== draggedSlug);
            });
        });
    };
    const clearDragState = (committed = false) => {
        if (!draggedSlug && !dropTargets.length) return;
        draggedSlug = "";
        dropTarget = null;
        dropTargets = [];
        list.classList.remove("is-reordering");
        if (committed) resetPreview();
        else animateLayout(resetPreview);
        items().forEach(item => item.classList.remove("dragging", "is-drop-target", "is-making-space"));
    };

    list.addEventListener("keydown", event => {
        const item = event.target.closest(".hero-category-order-item");
        if (!item || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        moveHeroCategory(item.dataset.slug, event.key === "ArrowLeft" ? "up" : "down");
        list.querySelector(`[data-slug="${CSS.escape(item.dataset.slug)}"]`)?.focus();
    });
    list.addEventListener("dragstart", event => {
        const item = event.target.closest(".hero-category-order-item");
        if (!item) return event.preventDefault();
        draggedSlug = item.dataset.slug || "";
        captureDropTargets();
        item.classList.add("dragging");
        list.classList.add("is-reordering");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedSlug);
        event.dataTransfer.setDragImage(item, item.offsetWidth / 2, item.offsetHeight / 2);
    });
    list.addEventListener("dragover", event => {
        if (!draggedSlug) return;
        const target = nearestDropTarget(event);
        if (!target) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        dropTarget = target;
        items().forEach(item => item.classList.toggle("is-drop-target", item.dataset.slug === target.slug && target.slug !== draggedSlug));
        previewSpace(target);
    });
    list.addEventListener("dragleave", event => {
        if (list.contains(event.relatedTarget)) return;
        items().forEach(item => item.classList.remove("is-drop-target"));
    });
    list.addEventListener("drop", event => {
        if (!draggedSlug) return;
        const target = nearestDropTarget(event) || dropTarget;
        if (!target) return clearDragState();
        event.preventDefault();
        const sourceSlug = draggedSlug;
        reorderHeroCategory(sourceSlug, target.slug, target.placeAfter);
        clearDragState(true);
    });
    list.addEventListener("dragend", () => clearDragState());
}

function renderHomepageHeroPreview({ syncMedia = true } = {}) {
    const hero = readHomepageHeroForm();
    const preview = $("#homepage-hero-preview");
    const panel = $("#homepage-section-hero");
    panel.classList.toggle("section-disabled", !hero.enabled);
    panel.inert = !hero.enabled;
    preview.classList.toggle("is-hidden", !hero.enabled);
    syncHomepageTabVisibility($("#homepage-hero-enabled"), hero.enabled, "Hero Banner");
    preview.querySelector(".hero-preview-eyebrow").textContent = hero.eyebrow;
    preview.querySelector("h3").textContent = hero.heading;
    preview.querySelector(".hero-preview-body").textContent = hero.body;
    preview.querySelector(".hero-preview-button").textContent = hero.buttonLabel;
    const availablePreviewImage = hero.images.some(item => item.url === homepageHeroPreviewImage)
        ? homepageHeroPreviewImage
        : hero.image;
    homepageHeroPreviewImage = availablePreviewImage;
    if (!homepageHeroPreviewPlaying) {
        const media = preview.querySelector(".management-storefront-hero-media");
        let image = media.querySelector("img");
        if (!image) {
            image = document.createElement("img");
            media.appendChild(image);
        }
        [...media.querySelectorAll("img")].slice(1).forEach(item => item.remove());
        image.className = availablePreviewImage ? "is-active" : "";
        image.hidden = !availablePreviewImage;
        if (availablePreviewImage) {
            image.onerror = () => {
                image.hidden = true;
                syncHeroMediaControl(hero.images, "This image could not be loaded. Remove or replace it before saving.");
            };
            image.src = availablePreviewImage;
            image.alt = hero.heading;
        } else {
            image.removeAttribute("src");
            image.alt = "";
        }
    }
    updateHomepageHeroPreviewCount(availablePreviewImage, hero.images);
    updateHomepageHeroPreviewPlayButton(hero.images);
    if (syncMedia) syncHeroMediaControl(hero.images);
}

function updateHomepageHeroPreviewCount(imageUrl, images) {
    const count = $("#homepage-hero-preview .management-storefront-hero-count");
    if (!count) return;
    const items = Array.isArray(images) ? images : (() => {
        try { return normalizeHeroImages({ images: JSON.parse($("#homepage-hero-images").value || "[]") }); }
        catch { return []; }
    })();
    const index = items.findIndex(item => item.url === imageUrl);
    count.hidden = items.length === 0;
    count.textContent = items.length ? `${Math.max(0, index) + 1} / ${items.length}` : "";
}

function showHomepageHeroPreviewImage(imageUrl) {
    stopHomepageHeroPreview();
    homepageHeroPreviewImage = imageUrl || "";
    const media = $("#homepage-hero-preview .management-storefront-hero-media");
    media.replaceChildren();
    const image = document.createElement("img");
    image.className = homepageHeroPreviewImage ? "is-active" : "";
    media.appendChild(image);
    image.hidden = !homepageHeroPreviewImage;
    if (homepageHeroPreviewImage) {
        image.onerror = () => {
            image.hidden = true;
            syncHeroMediaControl(readHomepageHeroForm().images, "This image could not be loaded. Remove or replace it before saving.");
        };
        image.src = homepageHeroPreviewImage;
        image.alt = $("#homepage-hero-heading").value.trim() || DEFAULT_HOMEPAGE_HERO.heading;
    } else {
        image.removeAttribute("src");
        image.alt = "";
    }
    updateHomepageHeroPreviewCount(homepageHeroPreviewImage);
}

function updateHomepageHeroPreviewPlayButton(images) {
    const button = $("#homepage-hero-preview-play");
    if (!button) return;
    const canPlay = Array.isArray(images) && images.length > 1;
    if (!canPlay && homepageHeroPreviewPlaying) stopHomepageHeroPreview();
    button.disabled = !canPlay;
    button.setAttribute("aria-pressed", String(homepageHeroPreviewPlaying));
    const icon = button.querySelector(".management-storefront-hero-play-icon");
    if (icon) {
        icon.classList.toggle("is-play", !homepageHeroPreviewPlaying);
        icon.classList.toggle("is-stop", homepageHeroPreviewPlaying);
    }
    button.querySelector(".management-storefront-hero-play-label").textContent = homepageHeroPreviewPlaying ? "Stop Preview" : "Play Preview";
}

function stopHomepageHeroPreview() {
    clearInterval(homepageHeroPreviewTimer);
    clearTimeout(homepageHeroPreviewFadeTimer);
    homepageHeroPreviewTimer = null;
    homepageHeroPreviewFadeTimer = null;
    homepageHeroPreviewTransitionToken += 1;
    homepageHeroPreviewPlaying = false;
    const media = $("#homepage-hero-preview .management-storefront-hero-media");
    const activeImage = media?.querySelector("img.is-active") || media?.querySelector("img");
    if (activeImage && media) {
        homepageHeroPreviewImage = activeImage.getAttribute("src") || homepageHeroPreviewImage;
        activeImage.className = "is-active";
        activeImage.alt = $("#homepage-hero-heading")?.value.trim() || DEFAULT_HOMEPAGE_HERO.heading;
        media.replaceChildren(activeImage);
    }
    updateHomepageHeroPreviewPlayButton(readHomepageHeroForm().images);
}

function startHomepageHeroPreview() {
    const hero = readHomepageHeroForm();
    if (hero.images.length < 2) return;
    stopHomepageHeroPreview();
    const media = $("#homepage-hero-preview .management-storefront-hero-media");
    const startIndex = Math.max(0, hero.images.findIndex(item => item.url === homepageHeroPreviewImage));
    const slides = hero.images.map((item, index) => {
        const image = document.createElement("img");
        image.className = index === startIndex ? "is-active" : "";
        image.src = item.url;
        image.alt = index === startIndex ? hero.heading : "";
        image.loading = index === startIndex ? "eager" : "lazy";
        image.decoding = "async";
        return image;
    });
    media.replaceChildren(...slides);
    const imageReady = slides.map(image => new Promise(resolve => {
        if (image.complete) return resolve(image.naturalWidth > 0);
        image.addEventListener("load", () => resolve(true), { once: true });
        image.addEventListener("error", () => resolve(false), { once: true });
    }));
    let activeIndex = startIndex;
    let pendingIndex = null;
    homepageHeroPreviewPlaying = true;
    updateHomepageHeroPreviewPlayButton(hero.images);
    updateHomepageHeroPreviewCount(hero.images[activeIndex].url, hero.images);

    const showSlide = async index => {
        if (!homepageHeroPreviewPlaying || pendingIndex !== null) return;
        pendingIndex = -1;
        let nextIndex = -1;
        for (let offset = 0; offset < slides.length; offset += 1) {
            const candidate = (index + offset + slides.length) % slides.length;
            if (candidate !== activeIndex && await imageReady[candidate]) { nextIndex = candidate; break; }
        }
        if (!homepageHeroPreviewPlaying || nextIndex < 0) {
            pendingIndex = null;
            if (nextIndex < 0) syncHeroMediaControl(hero.images, "No additional hero images could be loaded. Check or replace broken links.");
            return;
        }
        pendingIndex = nextIndex;
        const token = ++homepageHeroPreviewTransitionToken;
        if (!homepageHeroPreviewPlaying || token !== homepageHeroPreviewTransitionToken) return;
        clearTimeout(homepageHeroPreviewFadeTimer);
        slides.forEach(slide => slide.classList.remove("is-leaving"));
        const outgoingSlide = slides[activeIndex];
        const incomingSlide = slides[nextIndex];
        incomingSlide.classList.remove("is-active", "is-leaving");
        void incomingSlide.offsetWidth;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!homepageHeroPreviewPlaying || token !== homepageHeroPreviewTransitionToken) return;
            outgoingSlide.classList.remove("is-active");
            outgoingSlide.classList.add("is-leaving");
            outgoingSlide.alt = "";
            incomingSlide.classList.add("is-active");
            incomingSlide.alt = hero.heading;
            activeIndex = nextIndex;
            pendingIndex = null;
            homepageHeroPreviewImage = hero.images[activeIndex].url;
            updateHomepageHeroPreviewCount(homepageHeroPreviewImage, hero.images);
            syncHeroMediaControl(hero.images);
            homepageHeroPreviewFadeTimer = setTimeout(() => {
                outgoingSlide.classList.remove("is-leaving");
                homepageHeroPreviewFadeTimer = null;
            }, 1250);
        }));
    };
    homepageHeroPreviewTimer = setInterval(() => showSlide(activeIndex + 1), 4000);
}

function syncHomepageHeroForm() {
    heroCategoryOrder = normalizeHeroCategoryOrder(homepageHero.categoryOrder);
    $("#homepage-hero-enabled").checked = homepageHero.enabled !== false;
    $("#homepage-hero-eyebrow").value = homepageHero.eyebrow;
    $("#homepage-hero-heading").value = homepageHero.heading;
    const bodyField = $("#homepage-hero-body");
    bodyField.value = homepageHero.body;
    window.MPWRAutoGrowTextareas?.prepare(bodyField);
    $("#homepage-hero-button-label").value = homepageHero.buttonLabel;
    $("#homepage-hero-button-link").value = homepageHero.buttonLink;
    syncHomepageLinkDestination($("#homepage-hero-button-link-choice"));
    syncHomepageHeroUrlFields(homepageHero.images);
    $("#homepage-hero-image").value = homepageHero.image;
    $("#homepage-hero-image-key").value = homepageHero.imageKey || "";
    $("#homepage-hero-images").value = JSON.stringify(homepageHero.images);
    renderHeroCategoryOrder();
    renderHomepageHeroPreview();
}

function normalizeCampaignBanner(value = {}) {
    const source = value.source === "discounts" ? "discounts" : "custom";
    const synced = source === "discounts" && value.syncWithCampaign === true;
    const campaignIconValues = Object.values(DISCOUNT_CAMPAIGN_ICONS);
    const hasLinkedCampaignDefaults = !synced && (DISCOUNT_CAMPAIGN_LABELS.includes(value.eyebrow) || campaignIconValues.includes(value.image));
    const eyebrowValue = hasLinkedCampaignDefaults ? DEFAULT_CAMPAIGN_BANNER.eyebrow : value.eyebrow;
    const headingValue = hasLinkedCampaignDefaults ? DEFAULT_CAMPAIGN_BANNER.heading : value.heading;
    const bodyValue = hasLinkedCampaignDefaults ? DEFAULT_CAMPAIGN_BANNER.body : value.body;
    const buttonLabelValue = hasLinkedCampaignDefaults ? DEFAULT_CAMPAIGN_BANNER.buttonLabel : value.buttonLabel;
    const buttonLinkValue = hasLinkedCampaignDefaults ? DEFAULT_CAMPAIGN_BANNER.buttonLink : value.buttonLink;
    const imageValue = hasLinkedCampaignDefaults ? DEFAULT_CAMPAIGN_BANNER.image : value.image;
    return {
        enabled: value.enabled !== false,
        source,
        syncWithCampaign: synced,
        linkedCampaignLabel: source === "discounts" ? normalizeDiscountCampaignLabel(value.linkedCampaignLabel) : "",
        eyebrow: cleanHeroText(eyebrowValue, DEFAULT_CAMPAIGN_BANNER.eyebrow, 40),
        heading: cleanHeroText(headingValue, DEFAULT_CAMPAIGN_BANNER.heading, 80),
        body: cleanHeroText(bodyValue, DEFAULT_CAMPAIGN_BANNER.body, 180),
        buttonLabel: cleanHeroText(buttonLabelValue, DEFAULT_CAMPAIGN_BANNER.buttonLabel, 32),
        buttonLink: normalizeStorefrontLink(cleanHeroText(buttonLinkValue, DEFAULT_CAMPAIGN_BANNER.buttonLink, 140), DEFAULT_CAMPAIGN_BANNER.buttonLink),
        image: cleanHeroText(imageValue, DEFAULT_CAMPAIGN_BANNER.image, 500),
        imageKey: hasLinkedCampaignDefaults ? "" : cleanHeroText(value.imageKey, "", 500)
    };
}

function readCampaignBannerForm() {
    const campaignImageInput = $("#homepage-campaign-image");
    campaignBanner = normalizeCampaignBanner({
        enabled: $("#homepage-campaign-enabled").checked,
        source: $("#homepage-campaign-source").value,
        syncWithCampaign: $("#homepage-campaign-sync").checked,
        linkedCampaignLabel: discountCampaignLabel,
        eyebrow: $("#homepage-campaign-eyebrow").value,
        heading: $("#homepage-campaign-heading").value,
        body: $("#homepage-campaign-body").value,
        buttonLabel: $("#homepage-campaign-button-label").value,
        buttonLink: $("#homepage-campaign-button-link").value,
        image: campaignImageInput.disabled ? (campaignImageInput.dataset.filledUrl || "") : campaignImageInput.value,
        imageKey: $("#homepage-campaign-image-key").value
    });
    return campaignBanner;
}

function linkedDiscountCampaignPreset() {
    const percents = discountMode === "automatic"
        ? [15]
        : [...new Set(discountSelections.map(item => Math.min(95, Math.max(1, Math.round(Number(item.percent) || 15)))))];
    const highestPercent = percents.length ? Math.max(...percents) : 15;
    const discountText = percents.length <= 1 ? `${highestPercent}% off` : `Up to ${highestPercent}% off`;
    return {
        eyebrow: discountCampaignLabel,
        heading: `${discountText} selected favourites`,
        body: DISCOUNT_CAMPAIGN_COPY[discountCampaignLabel] || DEFAULT_CAMPAIGN_BANNER.body,
        buttonLabel: "Shop offers",
        buttonLink: "Campaign.html",
        image: DISCOUNT_CAMPAIGN_ICONS[discountCampaignLabel] || DEFAULT_CAMPAIGN_BANNER.image
    };
}

function resetCampaignBannerDefaultFields() {
    $("#homepage-campaign-eyebrow").value = DEFAULT_CAMPAIGN_BANNER.eyebrow;
    $("#homepage-campaign-heading").value = DEFAULT_CAMPAIGN_BANNER.heading;
    const bodyField = $("#homepage-campaign-body");
    bodyField.value = DEFAULT_CAMPAIGN_BANNER.body;
    window.MPWRAutoGrowTextareas?.prepare(bodyField);
    $("#homepage-campaign-button-label").value = DEFAULT_CAMPAIGN_BANNER.buttonLabel;
    $("#homepage-campaign-button-link").value = DEFAULT_CAMPAIGN_BANNER.buttonLink;
    syncHomepageLinkDestination($("#homepage-campaign-button-link-choice"));
    $("#homepage-campaign-image").value = DEFAULT_CAMPAIGN_BANNER.image;
    $("#homepage-campaign-image-key").value = "";
}

function syncLinkedCampaignControls({ refreshContent = false } = {}) {
    const source = $("#homepage-campaign-source").value;
    const linkedOption = $("#homepage-campaign-source").querySelector('option[value="discounts"]');
    linkedOption.textContent = `Current: ${discountCampaignLabel}`;
    const syncToggle = $("#homepage-campaign-sync");
    const linked = source === "discounts";
    const activelySynced = linked && syncToggle.checked;
    $("#homepage-campaign-enabled").disabled = activelySynced;
    syncToggle.closest(".campaign-sync-settings")?.classList.toggle("is-disabled", !linked);
    syncCampaignSyncCard();
    if (linked && refreshContent) {
        const preset = linkedDiscountCampaignPreset();
        $("#homepage-campaign-eyebrow").value = preset.eyebrow;
        $("#homepage-campaign-heading").value = preset.heading;
        const bodyField = $("#homepage-campaign-body");
        bodyField.value = preset.body;
        window.MPWRAutoGrowTextareas?.prepare(bodyField);
        $("#homepage-campaign-button-label").value = preset.buttonLabel;
        $("#homepage-campaign-button-link").value = preset.buttonLink;
        syncHomepageLinkDestination($("#homepage-campaign-button-link-choice"));
        $("#homepage-campaign-image").value = preset.image;
        $("#homepage-campaign-image-key").value = "";
    }
    if (activelySynced) $("#homepage-campaign-enabled").checked = discountSectionEnabled;
    productDropdownSync.get($("#homepage-campaign-source"))?.();
    renderCampaignBannerPreview();
}

function renderCampaignBannerPreview() {
    const banner = readCampaignBannerForm();
    const preview = $("#homepage-campaign-preview");
    const panel = $("#homepage-section-campaign");
    panel.classList.toggle("section-disabled", !banner.enabled);
    panel.inert = !banner.enabled;
    preview.classList.toggle("is-hidden", !banner.enabled);
    syncHomepageTabVisibility($("#homepage-campaign-enabled"), banner.enabled, "Campaign Banner");
    syncCampaignBannerTabIcon();
    syncCampaignSyncCard();
    const synced = banner.source === "discounts" && banner.syncWithCampaign;
    const eyebrow = !synced && banner.eyebrow === LEGACY_CAMPAIGN_BANNER_DEFAULTS.eyebrow ? DEFAULT_CAMPAIGN_BANNER.eyebrow : banner.eyebrow;
    const displayImage = !synced && banner.image === LEGACY_CAMPAIGN_BANNER_DEFAULTS.image ? DEFAULT_CAMPAIGN_BANNER.image : banner.image;
    preview.querySelector(".hero-preview-eyebrow").textContent = eyebrow;
    preview.querySelector("h3").textContent = banner.heading;
    preview.querySelector(".hero-preview-body").textContent = banner.body;
    preview.querySelector(".hero-preview-button").textContent = banner.buttonLabel;
    const image = preview.querySelector("img");
    image.src = displayImage;
    image.alt = banner.heading;
    syncBannerMediaControl("campaign", !synced && displayImage === DEFAULT_CAMPAIGN_BANNER.image ? "" : displayImage);
}

function syncCampaignBannerForm() {
    $("#homepage-campaign-enabled").checked = campaignBanner.enabled !== false;
    $("#homepage-campaign-source").value = campaignBanner.source;
    $("#homepage-campaign-sync").checked = campaignBanner.syncWithCampaign;
    $("#homepage-campaign-eyebrow").value = campaignBanner.eyebrow;
    $("#homepage-campaign-heading").value = campaignBanner.heading;
    const bodyField = $("#homepage-campaign-body");
    bodyField.value = campaignBanner.body;
    window.MPWRAutoGrowTextareas?.prepare(bodyField);
    $("#homepage-campaign-button-label").value = campaignBanner.buttonLabel;
    $("#homepage-campaign-button-link").value = campaignBanner.buttonLink;
    syncHomepageLinkDestination($("#homepage-campaign-button-link-choice"));
    $("#homepage-campaign-image").value = campaignBanner.image;
    $("#homepage-campaign-image-key").value = campaignBanner.imageKey || "";
    syncLinkedCampaignControls();
}

function syncBannerUrlField(prefix) {
    const container = $(`[data-banner-media="${prefix}"]`);
    if (!container) return;
    const urlInput = $(`#homepage-${prefix}-image`);
    const keyInput = $(`#homepage-${prefix}-image-key`);
    const previewButton = container.querySelector("[data-banner-url-preview]");
    const filledByPhoto = Boolean(keyInput?.value);
    if (filledByPhoto) {
        if (urlInput.value) urlInput.dataset.filledUrl = urlInput.value;
        urlInput.value = "";
        urlInput.disabled = true;
        urlInput.placeholder = "Image slot is already filled";
    } else {
        urlInput.disabled = false;
        urlInput.placeholder = "Paste image URL here";
    }
    if (previewButton) previewButton.disabled = filledByPhoto;
}

function syncBannerMediaControl(prefix, imageUrl, statusText = "Current image") {
    const container = $(`[data-banner-media="${prefix}"]`);
    if (!container) return;
    const preview = container.querySelector(".banner-media-preview");
    const thumbnail = container.querySelector(".banner-media-thumbnail");
    preview?.classList.toggle("is-empty", !imageUrl);
    if (preview) preview.hidden = !imageUrl;
    if (thumbnail) thumbnail.src = imageUrl || "";
    const status = container.querySelector(".banner-media-status");
    if (status) {
        status.textContent = imageUrl ? statusText : "";
        status.hidden = !imageUrl;
    }
    syncBannerUrlField(prefix);
}

function syncHeroMediaControl(images, statusText = "") {
    const container = $('[data-banner-media="hero"]');
    const previews = container?.querySelector(".banner-media-previews");
    if (!previews) return;
    previews.innerHTML = Array.from({ length: HOMEPAGE_HERO_IMAGE_LIMIT }, (_item, index) => {
        const slot = index + 1;
        const imageIndex = images.findIndex(item => item.slot === slot);
        const item = images[imageIndex];
        if (!item) return `<label class="banner-media-empty banner-media-empty-add" for="homepage-hero-image-file" data-hero-slot="${slot}" aria-label="Add hero image to slot ${slot}"><img src="images/Icon Folder/Plus Icon_Gray.PNG" alt=""></label>`;
        if (item.source !== "upload" && !item.key) return `<span class="banner-media-empty is-filled-by-url" data-slot="Filled" data-hero-slot="${slot}" aria-label="Hero image slot ${slot} is filled by an image URL"></span>`;
        return `<div class="banner-media-preview${item.url === homepageHeroPreviewImage ? " is-previewing" : ""}" draggable="true" data-hero-slot="${slot}"><button class="hero-media-preview-button" type="button" data-hero-image-preview="${imageIndex}" aria-label="Show hero slide ${slot} in the preview"><img class="banner-media-thumbnail" src="${escapeHtml(item.url)}" alt="Hero slide ${slot}"></button><button class="banner-media-reset" type="button" data-hero-image-remove="${imageIndex}" aria-label="Remove hero slide ${slot}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button></div>`;
    }).join("");
    const dropzone = container.querySelector(".banner-media-dropzone");
    const full = images.length >= HOMEPAGE_HERO_IMAGE_LIMIT;
    dropzone.classList.toggle("is-disabled", full);
    dropzone.setAttribute("aria-disabled", String(full));
    container.querySelector(".banner-media-status").textContent = statusText || (images.length
        ? "Images display in this order and slide automatically"
        : "No hero photos added");
}

function initializeHeroMediaUploader() {
    const container = $('[data-banner-media="hero"]');
    const fileInput = $("#homepage-hero-image-file");
    const urlInput = $("#homepage-hero-image");
    const urlInputs = [...container.querySelectorAll(".homepage-hero-url-input")];
    const keyInput = $("#homepage-hero-image-key");
    const imagesInput = $("#homepage-hero-images");
    const dropzone = container.querySelector(".banner-media-dropzone");
    const previews = container.querySelector(".banner-media-previews");
    const status = container.querySelector(".banner-media-status");
    const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const imagesFromUrlFields = (existingImages = []) => {
        const seen = new Set();
        const imagesBySlot = new Map(existingImages.map((item, index) => [item.slot || index + 1, item]));
        return urlInputs.map((input, index) => {
            const slot = index + 1;
            const existing = imagesBySlot.get(slot);
            if (existing && (existing.source === "upload" || existing.key)) return existing;
            const url = normalizePastedImageUrl(input.value);
            if (!url || isGooglePageLink(url) || seen.has(url)) return null;
            seen.add(url);
            return { url, key: "", source: "", slot };
        }).filter(Boolean).slice(0, HOMEPAGE_HERO_IMAGE_LIMIT);
    };
    const currentImages = () => {
        try { return normalizeHeroImages({ images: JSON.parse(imagesInput.value || "[]") }); }
        catch { return normalizeHeroImages({ images: imagesFromUrlFields() }); }
    };
    const setImages = (images, message) => {
        stopHomepageHeroPreview();
        const normalized = normalizeHeroImages({ images });
        imagesInput.value = JSON.stringify(normalized);
        syncHomepageHeroUrlFields(normalized);
        urlInput.value = normalized[0]?.url || "";
        keyInput.value = normalized[0]?.key || "";
        renderHomepageHeroPreview();
        if (message) syncHeroMediaControl(normalized, message);
    };
    const imageBySlot = (images, slot) => images.find(item => Number(item.slot) === Number(slot));
    const isUploadedHeroImage = item => Boolean(item && (item.source === "upload" || item.key));
    const isUrlHeroImage = item => Boolean(item && !isUploadedHeroImage(item));
    const heroImageReorderSlots = images => Array.from({ length: HOMEPAGE_HERO_IMAGE_LIMIT }, (_item, index) => index + 1)
        .filter(slot => !isUrlHeroImage(imageBySlot(images, slot)));
    const heroMediaItems = () => [...previews.querySelectorAll("[data-hero-slot]")];
    const animateHeroMediaLayout = mutate => {
        const before = new Map(heroMediaItems().map(item => [item, item.getBoundingClientRect()]));
        mutate();
        heroMediaItems().forEach(item => {
            const start = before.get(item);
            if (!start) return;
            const end = item.getBoundingClientRect();
            const dx = start.left - end.left;
            const dy = start.top - end.top;
            if (!dx && !dy) return;
            item.animate([
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "translate(0, 0)" }
            ], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
        });
    };
    let heroImagePreviewTargetSlot = "";
    const resetHeroImagePreviewOrder = () => {
        heroImagePreviewTargetSlot = "";
        heroMediaItems().forEach(item => {
            item.style.removeProperty("order");
            item.classList.remove("is-making-space");
        });
    };
    const previewHeroImageSpace = (fromSlot, toSlot) => {
        if (heroImagePreviewTargetSlot === String(toSlot)) return;
        heroImagePreviewTargetSlot = String(toSlot);
        const images = currentImages();
        const slots = heroImageReorderSlots(images);
        const fromIndex = slots.indexOf(Number(fromSlot));
        const toIndex = slots.indexOf(Number(toSlot));
        if (fromIndex < 0 || toIndex < 0) return;
        const orderedSlots = [...slots];
        const [movedSlot] = orderedSlots.splice(fromIndex, 1);
        orderedSlots.splice(toIndex, 0, movedSlot);
        animateHeroMediaLayout(() => {
            heroMediaItems().forEach(item => {
                const slot = Number(item.dataset.heroSlot);
                const visualIndex = orderedSlots.indexOf(slot);
                item.style.order = String((visualIndex >= 0 ? slots[visualIndex] : slot) * 10);
                item.classList.toggle("is-making-space", visualIndex >= 0 && slot !== Number(fromSlot));
            });
        });
    };
    let heroImageDropTargets = [];
    const captureHeroImageDropTargets = () => {
        const validSlots = new Set(heroImageReorderSlots(currentImages()).map(String));
        heroImageDropTargets = heroMediaItems().flatMap(item => {
            const slot = item.dataset.heroSlot || "";
            if (!validSlots.has(slot) || item.classList.contains("is-filled-by-url")) return [];
            const rect = item.getBoundingClientRect();
            return [{ slot, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 }];
        });
    };
    const nearestHeroImageDropSlot = event => {
        if (!heroImageDropTargets.length) captureHeroImageDropTargets();
        let bestSlot = "";
        let bestDistance = Infinity;
        heroImageDropTargets.forEach(target => {
            const distance = Math.hypot(event.clientX - target.centerX, event.clientY - target.centerY);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestSlot = target.slot;
            }
        });
        return bestSlot;
    };
    const moveHeroImageSlot = (fromSlot, toSlot) => {
        if (!fromSlot || !toSlot || fromSlot === toSlot) return;
        const images = currentImages();
        const dragged = imageBySlot(images, fromSlot);
        const target = imageBySlot(images, toSlot);
        if (!isUploadedHeroImage(dragged) || isUrlHeroImage(target)) return;
        const slots = heroImageReorderSlots(images);
        const fromIndex = slots.indexOf(Number(fromSlot));
        const toIndex = slots.indexOf(Number(toSlot));
        if (fromIndex < 0 || toIndex < 0) return;
        const next = images.map(item => ({ ...item }));
        const movableBySlot = new Map(slots.map(slot => [slot, isUploadedHeroImage(imageBySlot(next, slot)) ? imageBySlot(next, slot) : null]));
        const ordered = slots.map(slot => movableBySlot.get(slot));
        const [draggedItem] = ordered.splice(fromIndex, 1);
        ordered.splice(toIndex, 0, draggedItem);
        slots.forEach((slot, index) => {
            if (ordered[index]) ordered[index].slot = slot;
        });
        setImages(next, "Hero photo order updated · Save homepage to publish");
    };
    const moveHeroUrlSlot = (fromSlot, toSlot) => {
        if (!fromSlot || !toSlot || fromSlot === toSlot) return;
        const images = currentImages();
        const dragged = imageBySlot(images, fromSlot);
        const target = imageBySlot(images, toSlot);
        if (!isUrlHeroImage(dragged) || isUploadedHeroImage(target)) return;
        const next = images.map(item => ({ ...item }));
        const draggedItem = imageBySlot(next, fromSlot);
        const targetItem = imageBySlot(next, toSlot);
        draggedItem.slot = Number(toSlot);
        if (isUrlHeroImage(targetItem)) targetItem.slot = Number(fromSlot);
        setImages(next, "Hero URL order updated · Save homepage to publish");
    };

    async function uploadHeroFiles(files) {
        const additions = [...files];
        if (!additions.length) return;
        const savedImages = currentImages();
        const existing = savedImages.length === 1 && savedImages[0].url === DEFAULT_HOMEPAGE_HERO.image && !savedImages[0].key
            ? []
            : savedImages;
        if (existing.length + additions.length > HOMEPAGE_HERO_IMAGE_LIMIT) return showToast(`You can add up to ${HOMEPAGE_HERO_IMAGE_LIMIT} hero photos.`, "error");
        if (additions.some(file => !acceptedTypes.has(file.type))) return showToast("Choose JPG, PNG, WebP or GIF images.", "error");
        if (additions.some(file => file.size > 25 * 1024 * 1024)) return showToast("Choose source images smaller than 25 MB so they can be optimized safely.", "error");
        if (additions.some(file => file.type === "image/gif" && file.size > HOMEPAGE_HERO_UPLOAD_LIMIT)) return showToast("Animated GIF hero images must be 5 MB or smaller.", "error");

        dropzone.classList.add("is-uploading");
        status.textContent = additions.length > 1 ? `Optimizing and uploading ${additions.length} photos…` : `Optimizing ${additions[0].name}…`;
        const uploadedImages = [];
        const occupiedSlots = new Set(existing.map((item, index) => item.slot || index + 1));
        try {
            for (const file of additions) {
                const optimizedFile = await optimizeHeroImage(file);
                if (optimizedFile.size > HOMEPAGE_HERO_UPLOAD_LIMIT) throw new Error(`${file.name} is still larger than 5 MB after optimization.`);
                status.textContent = `Uploading ${optimizedFile.name}…`;
                const uploaded = await uploadImage(optimizedFile, "banner");
                const slot = Array.from({ length: HOMEPAGE_HERO_IMAGE_LIMIT }, (_item, index) => index + 1).find(value => !occupiedSlots.has(value));
                if (!slot) break;
                occupiedSlots.add(slot);
                if (uploaded.key) pendingHomepageHeroImageKeys.add(uploaded.key);
                uploadedImages.push({ url: uploaded.url, key: uploaded.key || "", source: "upload", slot });
            }
            const next = [...existing, ...uploadedImages].slice(0, HOMEPAGE_HERO_IMAGE_LIMIT);
            setImages(next, `${next.length} hero ${next.length === 1 ? "photo" : "photos"} staged · Click Save Changes to publish`);
        } catch (error) {
            await Promise.all(uploadedImages.filter(item => item.key).map(item => {
                pendingHomepageHeroImageKeys.delete(item.key);
                return deleteImage(item.key).catch(() => {});
            }));
            showToast(error?.message || "Unable to upload the hero photos.", "error");
        } finally {
            dropzone.classList.remove("is-uploading");
            fileInput.value = "";
        }
    }

    fileInput.addEventListener("change", () => uploadHeroFiles(fileInput.files || []));
    ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => {
        event.preventDefault();
        if (!dropzone.classList.contains("is-disabled")) dropzone.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
    }));
    dropzone.addEventListener("drop", event => uploadHeroFiles(event.dataTransfer?.files || []));
    let draggedHeroImageSlot = "";
    let heroImageDropSlot = "";
    const clearHeroImageDragState = (committed = false) => {
        draggedHeroImageSlot = "";
        heroImageDropSlot = "";
        heroImageDropTargets = [];
        previews.classList.remove("is-reordering");
        if (committed) resetHeroImagePreviewOrder();
        else animateHeroMediaLayout(resetHeroImagePreviewOrder);
        previews.querySelectorAll(".is-dragging,.is-drop-target,.is-making-space").forEach(item => {
            item.classList.remove("is-dragging", "is-drop-target", "is-making-space");
        });
    };
    previews.addEventListener("dragstart", event => {
        if (event.target.closest("[data-hero-image-remove]")) return event.preventDefault();
        const tile = event.target.closest(".banner-media-preview[draggable='true']");
        if (!tile) return;
        draggedHeroImageSlot = tile.dataset.heroSlot || "";
        captureHeroImageDropTargets();
        tile.classList.add("is-dragging");
        previews.classList.add("is-reordering");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedHeroImageSlot);
        event.dataTransfer.setDragImage(tile, tile.offsetWidth / 2, tile.offsetHeight / 2);
    });
    previews.addEventListener("dragover", event => {
        if (!draggedHeroImageSlot) return;
        const targetSlot = nearestHeroImageDropSlot(event);
        if (!targetSlot) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        heroImageDropSlot = targetSlot;
        const target = previews.querySelector(`[data-hero-slot="${targetSlot}"]`);
        previews.querySelectorAll(".is-drop-target").forEach(item => item.classList.remove("is-drop-target"));
        if (targetSlot !== draggedHeroImageSlot) target?.classList.add("is-drop-target");
        previewHeroImageSpace(Number(draggedHeroImageSlot), Number(targetSlot));
    });
    previews.addEventListener("dragleave", event => {
        if (previews.contains(event.relatedTarget)) return;
        heroImageDropSlot = "";
        previews.querySelectorAll(".is-drop-target").forEach(item => item.classList.remove("is-drop-target"));
    });
    previews.addEventListener("drop", event => {
        if (!draggedHeroImageSlot) return;
        const targetSlot = nearestHeroImageDropSlot(event) || heroImageDropSlot;
        if (!targetSlot) return clearHeroImageDragState();
        event.preventDefault();
        moveHeroImageSlot(Number(draggedHeroImageSlot), Number(targetSlot));
        clearHeroImageDragState(true);
    });
    previews.addEventListener("dragend", () => clearHeroImageDragState());
    previews.addEventListener("click", async event => {
        const button = event.target.closest("[data-hero-image-remove]");
        if (button) {
            const images = currentImages();
            const removed = images[Number(button.dataset.heroImageRemove)];
            const next = images.filter((_item, index) => index !== Number(button.dataset.heroImageRemove));
            setImages(next, "Hero photo removed · Save homepage to publish");
            if (removed?.key && pendingHomepageHeroImageKeys.has(removed.key)) {
                pendingHomepageHeroImageKeys.delete(removed.key);
                await deleteImage(removed.key).catch(() => showToast("The staged photo was removed, but storage cleanup will be retried later.", "warning"));
            }
            return;
        }
        const previewButton = event.target.closest("[data-hero-image-preview]");
        if (!previewButton) return;
        const imageUrl = currentImages()[Number(previewButton.dataset.heroImagePreview)]?.url || "";
        showHomepageHeroPreviewImage(imageUrl);
    });
    let urlPreviewTimer;
    const stageUrlImages = event => {
        stopHomepageHeroPreview();
        const activeInput = event?.currentTarget;
        if (activeInput) activeInput.value = normalizePastedImageUrl(activeInput.value);
        const previousImages = currentImages();
        const next = normalizeHeroImages({ images: imagesFromUrlFields(previousImages) });
        const activeSlot = activeInput ? urlInputs.indexOf(activeInput) + 1 : 0;
        const activeImage = next.find(item => item.slot === activeSlot);
        if (activeImage) homepageHeroPreviewImage = activeImage.url;
        imagesInput.value = JSON.stringify(next);
        syncHomepageHeroUrlFields(next);
        urlInput.value = next[0]?.url || "";
        keyInput.value = next[0]?.key || "";
        clearTimeout(urlPreviewTimer);
        urlPreviewTimer = setTimeout(() => {
            renderHomepageHeroPreview();
            if (activeInput && isGooglePageLink(activeInput.value)) {
                syncHeroMediaControl(next, "That Google link is a webpage, not an image. In Google Images, use Copy Image Address.");
                return;
            }
            syncHeroMediaControl(next, `${next.length} hero image ${next.length === 1 ? "URL" : "URLs"} staged · Click Save Changes to publish`);
        }, 250);
    };
    urlInputs.forEach(input => {
        input.addEventListener("paste", event => {
            const pasted = event.clipboardData?.getData("text") || "";
            const normalized = normalizePastedImageUrl(pasted);
            if (!normalized || normalized === pasted.trim()) return;
            event.preventDefault();
            input.value = normalized;
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        input.addEventListener("input", stageUrlImages);
    });
    const urlGrid = container.querySelector(".hero-url-grid");
    let draggedHeroUrlSlot = "";
    const clearHeroUrlDragState = () => {
        draggedHeroUrlSlot = "";
        urlGrid.classList.remove("is-reordering");
        urlGrid.querySelectorAll(".is-dragging,.is-drop-target").forEach(item => item.classList.remove("is-dragging", "is-drop-target"));
    };
    urlGrid.addEventListener("dragstart", event => {
        const row = event.target.closest("[data-hero-url-slot]");
        if (!row || row.classList.contains("hero-url-row-locked") || !row.classList.contains("hero-url-row-filled")) return event.preventDefault();
        draggedHeroUrlSlot = row.dataset.heroUrlSlot || "";
        row.classList.add("is-dragging");
        urlGrid.classList.add("is-reordering");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedHeroUrlSlot);
    });
    urlGrid.addEventListener("dragover", event => {
        if (!draggedHeroUrlSlot) return;
        const row = event.target.closest("[data-hero-url-slot]");
        if (!row || row.classList.contains("hero-url-row-locked") || row.dataset.heroUrlSlot === draggedHeroUrlSlot) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        urlGrid.querySelectorAll(".is-drop-target").forEach(item => item.classList.remove("is-drop-target"));
        row.classList.add("is-drop-target");
    });
    urlGrid.addEventListener("dragleave", event => {
        const row = event.target.closest("[data-hero-url-slot]");
        if (row && !row.contains(event.relatedTarget)) row.classList.remove("is-drop-target");
    });
    urlGrid.addEventListener("drop", event => {
        if (!draggedHeroUrlSlot) return;
        const row = event.target.closest("[data-hero-url-slot]");
        if (!row || row.classList.contains("hero-url-row-locked")) return clearHeroUrlDragState();
        event.preventDefault();
        moveHeroUrlSlot(Number(draggedHeroUrlSlot), Number(row.dataset.heroUrlSlot));
        clearHeroUrlDragState();
    });
    urlGrid.addEventListener("dragend", clearHeroUrlDragState);
    urlGrid.addEventListener("click", event => {
        const previewButton = event.target.closest("[data-hero-url-preview]");
        if (!previewButton) return;
        const index = Number(previewButton.dataset.heroUrlPreview);
        const pastedUrl = urlInputs[index]?.value.trim() || "";
        if (isGooglePageLink(pastedUrl)) return showToast("That is a Google webpage link. In Google Images, choose Copy Image Address instead.", "warning");
        const imageUrl = normalizePastedImageUrl(pastedUrl);
        if (!imageUrl) return showToast(`Paste a URL for Image ${index + 1} first.`, "warning");
        showHomepageHeroPreviewImage(imageUrl);
        status.textContent = `Previewing Image ${index + 1}`;
    });
}

function initializeBannerMediaUploader({ prefix, defaultImage, render }) {
    const container = $(`[data-banner-media="${prefix}"]`);
    const fileInput = $(`#homepage-${prefix}-image-file`);
    const urlInput = $(`#homepage-${prefix}-image`);
    const keyInput = $(`#homepage-${prefix}-image-key`);
    const dropzone = container.querySelector(".banner-media-dropzone");
    const status = container.querySelector(".banner-media-status");
    const resetButton = container.querySelector(".banner-media-reset");
    const previewButton = container.querySelector("[data-banner-url-preview]");
    const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

    async function uploadBannerFile(file) {
        if (!file) return;
        if (!acceptedTypes.has(file.type)) return showToast("Choose a JPG, PNG, WebP or GIF image.", "error");
        if (file.size > 10 * 1024 * 1024) return showToast("Banner images must be 10 MB or smaller.", "error");

        const previousUrl = urlInput.disabled ? (urlInput.dataset.filledUrl || "") : urlInput.value;
        const previousKey = keyInput.value;
        const localPreview = URL.createObjectURL(file);
        urlInput.value = localPreview;
        urlInput.disabled = false;
        keyInput.value = "";
        dropzone.classList.add("is-uploading");
        status.textContent = `Uploading ${file.name}…`;
        render();

        try {
            const uploaded = await uploadImage(file, "banner");
            urlInput.value = uploaded.url;
            urlInput.dataset.filledUrl = uploaded.url;
            keyInput.value = uploaded.key || "";
            render();
            syncBannerMediaControl(prefix, uploaded.url, `${file.name} uploaded · Save homepage to publish`);
        } catch (error) {
            urlInput.value = previousUrl;
            keyInput.value = previousKey;
            render();
            showToast(error?.message || "Unable to upload the banner image.", "error");
        } finally {
            dropzone.classList.remove("is-uploading");
            fileInput.value = "";
            URL.revokeObjectURL(localPreview);
        }
    }

    fileInput.addEventListener("change", () => uploadBannerFile(fileInput.files?.[0]));
    ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
    }));
    dropzone.addEventListener("drop", event => uploadBannerFile(event.dataTransfer?.files?.[0]));
    let urlPreviewTimer;
    const stageUrlImage = () => {
        urlInput.value = normalizePastedImageUrl(urlInput.value);
        keyInput.value = "";
        clearTimeout(urlPreviewTimer);
        urlPreviewTimer = setTimeout(() => {
            render();
            if (isGooglePageLink(urlInput.value)) {
                syncBannerMediaControl(prefix, urlInput.value || defaultImage, "That Google link is a webpage, not an image. In Google Images, use Copy Image Address.");
                return;
            }
            syncBannerMediaControl(prefix, urlInput.value || defaultImage, "Image URL staged · Click Save Changes to publish");
        }, 250);
    };
    urlInput.addEventListener("paste", event => {
        const pasted = event.clipboardData?.getData("text") || "";
        const normalized = normalizePastedImageUrl(pasted);
        if (!normalized || normalized === pasted.trim()) return;
        event.preventDefault();
        urlInput.value = normalized;
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    urlInput.addEventListener("input", stageUrlImage);
    previewButton?.addEventListener("click", () => {
        const pastedUrl = urlInput.value.trim();
        if (isGooglePageLink(pastedUrl)) return showToast("That is a Google webpage link. In Google Images, choose Copy Image Address instead.", "warning");
        const imageUrl = normalizePastedImageUrl(pastedUrl);
        if (!imageUrl) return showToast("Paste a URL for Image 1 first.", "warning");
        urlInput.value = imageUrl;
        keyInput.value = "";
        render();
        syncBannerMediaControl(prefix, imageUrl, "Previewing Image 1");
    });
    resetButton.addEventListener("click", () => {
        const clearsToEmptyPreview = prefix === "campaign" && defaultImage === DEFAULT_CAMPAIGN_BANNER.image;
        urlInput.value = clearsToEmptyPreview ? "" : defaultImage;
        delete urlInput.dataset.filledUrl;
        urlInput.disabled = false;
        keyInput.value = "";
        render();
        syncBannerMediaControl(prefix, clearsToEmptyPreview ? "" : defaultImage, clearsToEmptyPreview ? "" : "Default image restored · Save homepage to publish");
    });
}

function showToast(message, type = "success") {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "admin-products-toast";
    toast.classList.add(type === "error" ? "warning" : type);
    void toast.offsetWidth;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function panelFromLocation() {
    return hashPanels[window.location.hash.slice(1).toLowerCase()] || "catalogue";
}

function activateManagementPanel(panelName, updateHistory = false) {
    const panel = panelHashes[panelName] ? panelName : "catalogue";
    $$(".management-nav-item[data-panel]").forEach(item => item.classList.toggle("active", item.dataset.panel === panel));
    $$(".management-panel").forEach(section => section.classList.toggle("active", section.dataset.panelContent === panel));
    $("#add-product-btn").classList.toggle("hidden", panel !== "catalogue");
    if (panel === "homepage") requestAnimationFrame(() => {
        activateHomepageSection(activeHomepageSection);
        syncHomepagePanelHeights();
    });
    if (panel === "search") requestAnimationFrame(() => {
        activateSearchSection(activeSearchSection);
        renderSearchSettings();
    });

    if (updateHistory) {
        const nextHash = `#${panelHashes[panel]}`;
        if (window.location.hash !== nextHash) window.history.pushState({ managementPanel: panel }, "", nextHash);
    }
}

function activateHomepageSection(sectionName = "announcement") {
    const validSections = new Set($$("[data-homepage-section-tab]").map(tab => tab.dataset.homepageSectionTab));
    const section = validSections.has(sectionName) ? sectionName : "announcement";
    activeHomepageSection = section;
    $$("[data-homepage-section-tab]").forEach(tab => {
        const active = tab.dataset.homepageSectionTab === section;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
    });
    $$("[data-homepage-section-panel]").forEach(panel => {
        panel.hidden = panel.dataset.homepageSectionPanel !== section;
    });
    requestAnimationFrame(syncHomepagePanelHeights);
}

function activateSearchSection(sectionName = "synonyms") {
    if (sectionName === "merchandising") sectionName = "filters";
    const validSections = new Set($$("[data-search-section-tab]").map(tab => tab.dataset.searchSectionTab));
    const section = validSections.has(sectionName) ? sectionName : "synonyms";
    activeSearchSection = section;
    $$("[data-search-section-tab]").forEach(tab => {
        const active = tab.dataset.searchSectionTab === section;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
    });
    $$("[data-search-section-panel]").forEach(panel => {
        panel.hidden = panel.dataset.searchSectionPanel !== section;
    });
}

function setPermanentDeleteButtonState(button, confirming) {
    if (!button) return;
    button.classList.toggle("is-confirming", confirming);
    const icon = button.querySelector("img");
    if (icon) icon.src = confirming
        ? "images/Icon Folder/Delete Icon_d9534f.PNG"
        : "images/Icon Folder/Delete Icon_333.PNG";
}

function closePermanentDeleteConfirmation() {
    setPermanentDeleteButtonState(permanentDeleteButton, false);
    permanentDeleteButton = null;
    permanentDeleteTarget = null;
    $("#permanent-delete-modal").classList.add("hidden");
}

function openHomepageAdditionConfirmation(product, section, sourceCard) {
    homepageAdditionTarget = { product, section, sourceCard };
    const sectionName = section === "popular" ? "Popular" : "Discount Products";
    $("#homepage-addition-title").textContent = `Add ${product.title} to ${sectionName}?`;
    $("#homepage-addition-message").textContent = `This product will be added to ${sectionName} and saved to the homepage.`;
    $("#confirm-homepage-addition").textContent = `Add to ${sectionName}`;
    $("#homepage-addition-modal").classList.remove("hidden");
    $("#confirm-homepage-addition").focus();
}

function closeHomepageAdditionConfirmation() {
    homepageAdditionTarget = null;
    $("#homepage-addition-modal").classList.add("hidden");
}

function openHomepageSettingConfirmation(type, value) {
    homepageSettingTarget = { type, value };
    let title;
    let message;
    let buttonLabel;
    if (type === "campaign") {
        title = `Use the ${value} campaign?`;
        message = `The homepage offer section will use “${value}” as its campaign label.`;
        buttonLabel = "Change Campaign";
    } else if (type === "popularMode") {
        const automatic = value === "automatic";
        title = `Switch Popular Products to ${automatic ? "Automatic" : "Manual"}?`;
        message = automatic
            ? "The homepage will use the most-purchased products from delivered orders. Your manual selection will be kept for later."
            : "Your saved manual product selection will return and become editable again.";
        buttonLabel = `Use ${automatic ? "Automatic" : "Manual"}`;
    } else if (type === "discountMode") {
        const automatic = value === "automatic";
        title = `Switch Discount Products to ${automatic ? "Automatic" : "Manual"}?`;
        message = automatic
            ? "The homepage will automatically offer the most-purchased products from delivered orders at 15% off. Your manual selection will be kept for later."
            : "Your saved manual discount products, order, and percentages will return and become editable again.";
        buttonLabel = `Use ${automatic ? "Automatic" : "Manual"}`;
    } else {
        const sectionName = type === "popular" ? "Popular Products" : "Discount Products";
        const action = value ? "Show" : "Hide";
        title = `${action} ${sectionName}?`;
        message = value
            ? `${sectionName} will become visible on the homepage.`
            : `${sectionName} will be hidden from the homepage until you show it again.`;
        buttonLabel = `${action} Section`;
    }
    $("#homepage-setting-title").textContent = title;
    $("#homepage-setting-message").textContent = message;
    $("#confirm-homepage-setting").textContent = buttonLabel;
    $("#homepage-setting-modal").classList.remove("hidden");
    $("#confirm-homepage-setting").focus();
}

function closeHomepageSettingConfirmation() {
    homepageSettingTarget = null;
    $("#homepage-setting-modal").classList.add("hidden");
}

function updateHomepageSelection(product, action, sourceCard = null) {
    if (popularMode !== "manual") {
        showToast("Switch Popular Products to Manual before editing the selection", "error");
        return false;
    }
    if (action === "add" && discountSectionEnabled && isHomepageDiscount(product.id)) {
        showToast("Remove this product from Discounts before adding it to Popular", "error");
        return false;
    }
    if (popularMode === "manual") {
        popularIds = popularIds.filter(id => products.some(item => String(item.id) === id && isStorefrontActive(item))
            && (!discountSectionEnabled || !isHomepageDiscount(id)));
    }
    if (action === "add" && !popularIds.includes(String(product.id)) && popularIds.length >= POPULAR_PRODUCT_LIMIT) {
        showToast(`Only ${POPULAR_PRODUCT_LIMIT} popular products can be added`, "error");
        return false;
    }
    const id = String(product.id);
    if (action === "add") {
        if (!popularIds.includes(id)) popularIds.push(id);
    } else popularIds = popularIds.filter(value => value !== id);
    updatePopularSelectionPreview(product, action);
    updateHomepageProductCard(id, action === "add");
    if (action === "add") animateProductToPopular(sourceCard, id);
    return true;
}

function closeHomepageRemovalConfirmation() {
    homepageRemovalTarget = null;
    $("#homepage-removal-modal").classList.add("hidden");
}

function discountSelection(id) {
    return discountSelections.find(item => item.id === String(id));
}

function automaticDiscountSelections() {
    const eligible = isStorefrontActive;
    const rankedIds = automaticPopularIds.filter(id => products.some(product => String(product.id) === id && eligible(product)));
    const rankedSet = new Set(rankedIds);
    const fallbackIds = products.filter(product => eligible(product) && !rankedSet.has(String(product.id))).map(product => String(product.id));
    return [...rankedIds, ...fallbackIds].slice(0, HOMEPAGE_DISCOUNT_PRODUCT_LIMIT).map(id => ({ id, percent: 15 }));
}

function homepageDiscountSelections() {
    return discountMode === "automatic"
        ? automaticDiscountSelections()
        : discountSelections.slice(0, HOMEPAGE_DISCOUNT_PRODUCT_LIMIT);
}

function isHomepageDiscount(id) {
    return homepageDiscountSelections().some(item => item.id === String(id));
}

function updateDiscountSelection(product, action, sourceCard = null) {
    if (discountMode !== "manual") {
        showToast("Switch Discount Products to Manual before editing the selection", "error");
        return false;
    }
    const id = String(product.id);
    if (action === "add" && discountSelection(id) && !isHomepageDiscount(id)) {
        showToast("This product is already in Offers, but only the first 10 products can appear on the homepage", "error");
        return false;
    }
    if (action === "add" && !discountSelection(id) && homepageDiscountSelections().length >= HOMEPAGE_DISCOUNT_PRODUCT_LIMIT) {
        showToast(`Only ${HOMEPAGE_DISCOUNT_PRODUCT_LIMIT} discount products can appear on the homepage`, "error");
        return false;
    }
    if (action === "remove") discountSelections = discountSelections.filter(item => item.id !== id);
    else if (!discountSelection(id)) discountSelections.push({ id, percent: 15 });
    if (action === "add" && popularMode === "manual" && popularIds.includes(id)) {
        popularIds = popularIds.filter(value => value !== id);
        updatePopularSelectionPreview(product, "remove");
    }
    updateHomepageProductCard(id, action === "add");
    updateDiscountSelectionPreview(product, action);
    if ($("#homepage-campaign-source").value === "discounts" && $("#homepage-campaign-sync").checked) {
        syncLinkedCampaignControls({ refreshContent: true });
    }
    syncDiscountPickerAvailability();
    if (action === "add") animateProductToDiscount(sourceCard, id);
    return true;
}

function closeDiscountRemovalConfirmation() {
    discountRemovalTarget = null;
    $("#discount-removal-modal").classList.add("hidden");
}

function syncProductDiscountEditor() {
    const enabled = $("#product-discounted").checked;
    $("#product-discount-field").classList.toggle("hidden", !enabled);
    $("#product-discounted").disabled = discountMode === "automatic";
    $("#product-discount-percent").disabled = !enabled || discountMode === "automatic";
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function list(value) {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

function productImage(product) {
    return product.image || product.gallery?.[0] || "images/MPWR Logo.PNG";
}

function categorySlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}

function normalizeHeroCategoryOrder(value, categoryItems = categories) {
    const available = (Array.isArray(categoryItems) ? categoryItems : [])
        .map(category => String(category?.slug || "").trim())
        .filter(Boolean);
    const availableSet = new Set(available);
    const ordered = [];
    const known = new Set();
    (Array.isArray(value) ? value : []).forEach(slug => {
        const normalized = String(slug || "").trim();
        if (!availableSet.has(normalized) || known.has(normalized)) return;
        known.add(normalized);
        ordered.push(normalized);
    });
    available.forEach(slug => {
        if (known.has(slug)) return;
        known.add(slug);
        ordered.push(slug);
    });
    return ordered;
}

function normalizeCategories(items) {
    const defaults = new Map(DEFAULT_CATEGORIES.map(category => [category.slug, category]));
    const normalized = [];
    const known = new Set();
    (Array.isArray(items) ? items : []).forEach(item => {
        const slug = categorySlug(item?.slug || item?.label);
        const label = String(item?.label || defaults.get(slug)?.label || "").trim().slice(0, 60);
        if (!slug || !label || known.has(slug)) return;
        known.add(slug);
        normalized.push({
            slug,
            label,
            image: String(item?.image || defaults.get(slug)?.image || "").trim(),
            imageKey: String(item?.imageKey || "").trim(),
            productIds: Array.isArray(item?.productIds) ? item.productIds.map(String).filter(Boolean) : []
        });
    });
    DEFAULT_CATEGORIES.forEach(category => {
        if (!known.has(category.slug)) {
            known.add(category.slug);
            normalized.push({ ...category });
        }
    });
    return normalized;
}

function syncCategoryControls(preferredProductCategory = "") {
    heroCategoryOrder = normalizeHeroCategoryOrder(heroCategoryOrder);
    Object.keys(categoryLabels).forEach(key => delete categoryLabels[key]);
    categories.forEach(category => { categoryLabels[category.slug] = category.label; });
    categoryLabels[UNCATEGORIZED_CATEGORY] = "No Category";

    const filter = $("#category-filter");
    const productSelect = $("#product-category");
    const filterValue = filter.value || "all";
    const productValue = preferredProductCategory || productSelect.value || "products";

    filter.replaceChildren(
        new Option("All categories", "all"),
        new Option("No Category", UNCATEGORIZED_CATEGORY),
        ...categories.map(category => new Option(category.label, category.slug))
    );
    productSelect.replaceChildren(
        new Option("No Category", UNCATEGORIZED_CATEGORY),
        ...categories.map(category => new Option(category.label, category.slug))
    );
    filter.value = filterValue === UNCATEGORIZED_CATEGORY || categories.some(category => category.slug === filterValue) ? filterValue : "all";
    productSelect.value = productValue === UNCATEGORIZED_CATEGORY || categories.some(category => category.slug === productValue) ? productValue : "products";
    productDropdownSync.get(filter)?.refresh?.();
    productDropdownSync.get(productSelect)?.refresh?.();
    renderHomepageSectionOrder();
    renderHeroCategoryOrder();
}

function renderHomepageSectionOrder() {
    const list = $("#category-order-list");
    if (!list) return;
    homepageSectionOrder = normalizeHomepageSectionOrder(homepageSectionOrder);
    list.innerHTML = homepageSectionOrder.map((key, index) => {
        const locked = HOMEPAGE_SECTION_LOCKED.has(key);
        const detail = HOMEPAGE_SECTION_DETAILS[key] || { label: key, description: "Homepage section" };
        const label = key === "discounts" ? discountCampaignLabel : detail.label;
        const description = key === "discounts" ? "Current discount campaign section" : detail.description;
        const control = locked
            ? `<span class="homepage-order-status">Fixed</span>`
            : `<span class="homepage-order-status is-movable">Drag</span>`;
        return `
        <article class="category-order-item homepage-order-item${locked ? " is-locked" : ""}" draggable="${locked ? "false" : "true"}" data-homepage-order-key="${escapeHtml(key)}" aria-label="${escapeHtml(label)}, position ${index + 1}${locked ? ", fixed" : ""}">
            <span class="category-order-drag" aria-hidden="true">${locked ? index + 1 : '<img src="images/Icon Folder/Menu Bar Icon_Gray.PNG" alt="">'}</span>
            <div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></div>
            ${control}
        </article>
    `;
    }).join("");
}

function reorderHomepageSectionNear(dragKey, targetKey, placeAfter = false) {
    homepageSectionOrder = normalizeHomepageSectionOrder(homepageSectionOrder);
    if (!dragKey || !targetKey || dragKey === targetKey || HOMEPAGE_SECTION_LOCKED.has(dragKey) || HOMEPAGE_SECTION_LOCKED.has(targetKey)) return;
    const movable = homepageSectionOrder.filter(key => !HOMEPAGE_SECTION_LOCKED.has(key));
    const dragged = movable.find(key => key === dragKey);
    if (!dragged) return;
    const withoutDragged = movable.filter(key => key !== dragKey);
    const targetIndex = withoutDragged.findIndex(key => key === targetKey);
    if (targetIndex < 0) return;
    const insertIndex = targetIndex + (placeAfter ? 1 : 0);
    homepageSectionOrder = normalizeHomepageSectionOrder([...HOMEPAGE_SECTION_ORDER_DEFAULT.filter(key => HOMEPAGE_SECTION_LOCKED.has(key)), ...withoutDragged.slice(0, insertIndex), dragged, ...withoutDragged.slice(insertIndex)]);
    renderHomepageSectionOrder();
}

function homepageSectionOrderItems() {
    return $$("#category-order-list .homepage-order-item");
}

function updateHomepageSectionOrderRanks() {
    homepageSectionOrderItems().forEach((item, index) => {
        const key = item.dataset.homepageOrderKey;
        const drag = item.querySelector(".category-order-drag");
        if (HOMEPAGE_SECTION_LOCKED.has(key) && drag) drag.textContent = String(index + 1);
        const title = item.querySelector("strong")?.textContent || key;
        item.setAttribute("aria-label", `${title}, position ${index + 1}${HOMEPAGE_SECTION_LOCKED.has(key) ? ", fixed" : ""}`);
    });
}

function animateHomepageSectionOrderLayout(mutate) {
    const items = homepageSectionOrderItems();
    const before = new Map(items.map(item => [item, item.getBoundingClientRect()]));
    mutate();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    items.forEach(item => {
        const start = before.get(item);
        if (!start) return;
        const end = item.getBoundingClientRect();
        const dx = start.left - end.left;
        const dy = start.top - end.top;
        if (!dx && !dy) return;
        item.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" }
        ], { duration: 90, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
}

function initializeHomepageSectionOrderReorder() {
    const list = $("#category-order-list");
    if (!list) return;
    let drag = null;

    const items = () => homepageSectionOrderItems();
    const movableItems = () => items().filter(item => !item.classList.contains("is-locked"));
    const clearTargets = () => items().forEach(item => item.classList.remove("is-drop-target", "is-making-space"));
    const sectionOrder = () => items().map(item => item.dataset.homepageOrderKey).filter(Boolean);
    const movePreview = event => {
        if (!drag?.preview) return;
        drag.preview.style.transform = `translate3d(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px, 0)`;
    };
    const createPreview = (item, event) => {
        const rect = item.getBoundingClientRect();
        const preview = item.cloneNode(true);
        preview.classList.remove("dragging", "is-making-space", "is-drop-target");
        preview.classList.add("popular-drag-preview");
        preview.removeAttribute("draggable");
        Object.assign(preview.style, {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`
        });
        document.body.appendChild(preview);
        drag.offsetX = event.clientX || event.clientY ? event.clientX - rect.left : rect.width / 2;
        drag.offsetY = event.clientX || event.clientY ? event.clientY - rect.top : rect.height / 2;
        drag.preview = preview;
        if (event.clientX || event.clientY) movePreview(event);
    };
    const nearestTarget = event => {
        const directItem = event.target.closest(".homepage-order-item");
        if (directItem && directItem !== drag?.item && !directItem.classList.contains("is-locked") && list.contains(directItem)) {
            return { item: directItem };
        }
        if (directItem === drag?.item) return null;
        let nearest = null;
        movableItems().forEach(item => {
            if (item === drag?.item) return;
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
            if (!nearest || distance < nearest.distance) nearest = { item, distance };
        });
        return nearest ? { item: nearest.item } : null;
    };
    const restoreOriginalOrder = () => {
        if (!drag) return;
        const byKey = new Map(items().map(item => [item.dataset.homepageOrderKey, item]));
        drag.originalOrder.forEach(key => {
            const item = byKey.get(key);
            if (item) list.appendChild(item);
        });
        updateHomepageSectionOrderRanks();
    };
    const swapItems = (first, second) => {
        if (!first || !second || first === second) return;
        const marker = document.createTextNode("");
        first.before(marker);
        second.before(first);
        marker.replaceWith(second);
    };
    const markDropTarget = target => {
        clearTargets();
        if (target?.item && target.item !== drag?.item) target.item.classList.add("is-drop-target");
    };
    const previewSwapTarget = target => {
        if (!drag || !target?.item || target.item === drag.item || target.item.classList.contains("is-locked")) return;
        const currentOrder = sectionOrder().join("|");
        const nextPreviewKey = `${target.item.dataset.homepageOrderKey || "empty"}:${currentOrder}`;
        if (drag.previewTarget === nextPreviewKey) return;
        drag.previewTarget = nextPreviewKey;
        markDropTarget(target);
        animateHomepageSectionOrderLayout(() => {
            swapItems(drag.item, target.item);
            updateHomepageSectionOrderRanks();
        });
    };
    const commitDropTarget = () => {
        if (!drag) return;
        homepageSectionOrder = normalizeHomepageSectionOrder(sectionOrder());
        updateHomepageSectionOrderRanks();
    };
    const clearDragState = () => {
        if (!drag) return;
        if (!drag.committed) animateHomepageSectionOrderLayout(restoreOriginalOrder);
        clearTargets();
        drag.preview?.remove();
        drag.item.classList.remove("dragging");
        list.classList.remove("is-reordering");
        drag = null;
    };

    list.addEventListener("dragstart", event => {
        const item = event.target.closest(".homepage-order-item");
        if (event.target.closest("button,input,label,select,textarea")) return event.preventDefault();
        if (!item || item.classList.contains("is-locked")) return event.preventDefault();
        drag = { item, originalOrder: sectionOrder(), previewTarget: null, committed: false, preview: null, offsetX: 0, offsetY: 0 };
        createPreview(item, event);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.dataset.homepageOrderKey || "");
        event.dataTransfer.setDragImage(transparentDragImage(), 0, 0);
        requestAnimationFrame(() => {
            item.classList.add("dragging");
            list.classList.add("is-reordering");
        });
    });
    list.addEventListener("dragover", event => {
        if (!drag) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
    });
    list.addEventListener("drag", event => {
        if (!drag || !event.clientX || !event.clientY) return;
        movePreview(event);
    });
    list.addEventListener("dragleave", event => {
        if (!drag || list.contains(event.relatedTarget)) return;
        clearTargets();
    });
    list.addEventListener("drop", event => {
        if (!drag) return;
        event.preventDefault();
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
        commitDropTarget();
        drag.committed = true;
        clearDragState();
    });
    list.addEventListener("dragend", clearDragState);
    list.addEventListener("keydown", event => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        const item = event.target.closest(".homepage-order-item");
        if (!item || item.classList.contains("is-locked")) return;
        const movable = movableItems();
        const current = movable.indexOf(item);
        const step = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
        const next = current + step;
        if (current < 0 || next < 0 || next >= movable.length) return;
        event.preventDefault();
        animateHomepageSectionOrderLayout(() => {
            swapItems(item, movable[next]);
            commitDropTarget();
            item.focus();
        });
    });
}

function syncCategoryProductSelection() {
    const count = categoryProductIds.size;
    $("#category-product-selection-count").textContent = `${count} product${count === 1 ? "" : "s"} selected`;
    $("#save-category").disabled = count === 0 || !categoryImageFile;
}

function setCategoryImage(file = null) {
    if (categoryImagePreviewUrl) URL.revokeObjectURL(categoryImagePreviewUrl);
    categoryImagePreviewUrl = "";
    categoryImageFile = file;
    const preview = $("#category-image-preview");
    const placeholder = $(".category-image-placeholder");
    if (file) {
        categoryImagePreviewUrl = URL.createObjectURL(file);
        preview.src = categoryImagePreviewUrl;
        preview.alt = `Preview of ${file.name}`;
        preview.hidden = false;
        placeholder.hidden = true;
        $("#category-image-status").textContent = file.name;
    } else {
        preview.removeAttribute("src");
        preview.alt = "";
        preview.hidden = true;
        placeholder.hidden = false;
        $("#category-image-status").textContent = "Choose a JPEG, PNG, WebP, or GIF image up to 5 MB.";
    }
    syncCategoryProductSelection();
}

function renderCategoryProductPicker() {
    const query = $("#category-product-search").value.trim().toLowerCase();
    const matches = products
        .filter(product => !query || `${product.title || ""} ${product.sku || ""}`.toLowerCase().includes(query))
        .sort((first, second) => {
            const firstAssigned = productCategory(first) !== UNCATEGORIZED_CATEGORY;
            const secondAssigned = productCategory(second) !== UNCATEGORIZED_CATEGORY;
            return Number(firstAssigned) - Number(secondAssigned);
        });
    $("#category-product-picker").innerHTML = matches.map(product => {
        const id = String(product.id);
        const selected = categoryProductIds.has(id);
        const currentCategorySlug = productCategory(product);
        const hasCategory = currentCategorySlug !== UNCATEGORIZED_CATEGORY;
        const reassignmentApproved = categoryReassignmentIds.has(id);
        const category = hasCategory ? (categoryLabels[currentCategorySlug] || currentCategorySlug) : "No Category";
        return `<article class="category-product-choice ${hasCategory ? "has-category" : ""} ${selected ? "selected" : ""}" data-id="${escapeHtml(id)}">
            <img src="${escapeHtml(productImage(product))}" alt="">
            <span class="category-product-choice-copy"><strong>${escapeHtml(product.title || "Untitled product")}</strong><small>${escapeHtml(category)} · ${escapeHtml(product.sku || "No SKU")}</small></span>
            ${hasCategory ? `<button class="category-product-menu-toggle" type="button" aria-label="More options for ${escapeHtml(product.title || "product")}" aria-expanded="false">⋯</button><div class="category-product-menu" hidden><button class="change-product-category" type="button">Change category</button></div>` : `<span aria-hidden="true"></span>`}
            <button class="category-product-select" type="button" aria-label="${selected ? "Remove" : "Select"} ${escapeHtml(product.title || "product")}" aria-pressed="${selected}" ${hasCategory && !reassignmentApproved ? "disabled" : ""}><span class="category-product-check" aria-hidden="true"><img src="images/Icon Folder/Tick Icon_White.PNG" alt=""></span></button>
        </article>`;
    }).join("");
    $("#category-products-empty").classList.toggle("hidden", matches.length > 0);
    syncCategoryProductSelection();
}

function resetCategoryEditor() {
    $("#category-form").reset();
    $("#category-slug").setCustomValidity("");
    categorySlugEdited = false;
    categoryProductIds = new Set();
    categoryReassignmentIds = new Set();
    categoryReassignmentTarget = null;
    setCategoryImage();
    renderCategoryProductPicker();
}

function productMediaCount(product) {
    return new Set([...(product.gallery || []), ...(product.videos || []).map(video => video.url || video).filter(Boolean)]).size;
}

function productCategory(product) {
    return product.category || legacyCategories[String(product.id)] || "products";
}

function formatMoney(value) {
    return `UGX ${Math.max(0, Number(value) || 0).toLocaleString()}`;
}

function enhanceProductDropdown(select) {
    const isCampaignDropdown = select.id === "discount-campaign-label";
    select.classList.add("product-dropdown-native");
    const picker = document.createElement("div");
    picker.className = "product-dropdown";
    const trigger = document.createElement("button");
    trigger.className = "product-dropdown-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", select.getAttribute("aria-label") || select.closest("label")?.querySelector(":scope > span")?.textContent || "Choose option");
    trigger.innerHTML = `<span class="product-dropdown-label"></span><img class="product-dropdown-arrow" src="images/Icon Folder/Back Icon Down_Gray.PNG" alt="">`;
    const menu = document.createElement("div");
    menu.className = "product-dropdown-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    const populateOptions = () => {
        menu.replaceChildren();
        [...select.options].forEach(item => {
            const option = document.createElement("button");
            option.type = "button";
            option.dataset.value = item.value;
            if (isCampaignDropdown) {
                option.classList.add("campaign-dropdown-option");
                const icon = document.createElement("img");
                icon.src = DISCOUNT_CAMPAIGN_ICONS[item.value] || DISCOUNT_CAMPAIGN_ICONS["Limited Offers"];
                icon.alt = "";
                option.append(icon, document.createTextNode(item.textContent));
            } else {
                option.textContent = item.textContent;
            }
            option.disabled = item.disabled;
            option.setAttribute("role", "option");
            menu.appendChild(option);
        });
    };
    populateOptions();

    const sync = () => {
        const selected = select.options[select.selectedIndex];
        const triggerLabel = trigger.querySelector(".product-dropdown-label");
        if (isCampaignDropdown && selected) {
            const icon = document.createElement("img");
            icon.src = DISCOUNT_CAMPAIGN_ICONS[selected.value] || DISCOUNT_CAMPAIGN_ICONS["Limited Offers"];
            icon.alt = "";
            triggerLabel.classList.add("campaign-dropdown-label");
            triggerLabel.replaceChildren(icon, document.createTextNode(selected.textContent));
        } else {
            triggerLabel.textContent = selected?.textContent || "Select";
        }
        trigger.disabled = select.disabled;
        picker.classList.toggle("disabled", select.disabled);
        if (select.disabled) close();
        menu.querySelectorAll("button").forEach(option => {
            const nativeOption = [...select.options].find(item => item.value === option.dataset.value);
            if (!isCampaignDropdown && nativeOption) option.textContent = nativeOption.textContent;
            const active = option.dataset.value === select.value;
            option.classList.toggle("selected", active);
            option.setAttribute("aria-selected", String(active));
        });
    };
    const close = () => {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };
    trigger.addEventListener("click", event => {
        if (select.disabled) return;
        event.stopPropagation();
        document.querySelectorAll(".product-dropdown-menu:not([hidden])").forEach(openMenu => {
            if (openMenu !== menu) {
                openMenu.hidden = true;
                openMenu.previousElementSibling?.setAttribute("aria-expanded", "false");
            }
        });
        menu.hidden = !menu.hidden;
        trigger.setAttribute("aria-expanded", String(!menu.hidden));
    });
    menu.addEventListener("click", event => {
        const option = event.target.closest("button[data-value]");
        if (!option || option.disabled) return;
        select.value = option.dataset.value;
        sync();
        close();
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    select.addEventListener("change", sync);
    picker.append(trigger, menu);
    select.insertAdjacentElement("afterend", picker);
    sync.refresh = () => {
        populateOptions();
        sync();
    };
    productDropdownSync.set(select, sync);
    sync();
}

async function loadData() {
    const [bootstrap, insights] = await Promise.all([
        getManagementBootstrap(db),
        getSearchInsights().catch(error => { console.warn("Unable to load search insights", error); return null; })
    ]);
    searchInsights = insights;
    const popularSetting = bootstrap.settings.popular || {};
    const bestsellerSetting = bootstrap.settings.bestsellers || {};
    const discountSetting = bootstrap.settings.discounts || {};
    const announcementSetting = bootstrap.settings.announcementBar || {};
    const heroSetting = bootstrap.settings.homepageHero || {};
    const campaignSetting = bootstrap.settings.campaignBanner || {};
    const sectionOrderSetting = bootstrap.settings.homepageSectionOrder || {};
    const storedSearch = bootstrap.settings.search || {};
    products = bootstrap.products;
    deletedProducts = bootstrap.deletedProducts;
    categories = normalizeCategories(bootstrap.settings.categories?.items);
    syncCategoryControls();
    popularIds = Array.isArray(popularSetting.products)
        ? popularSetting.products.map(item => String(item.id))
        : [];
    popularMode = popularSetting.mode === "automatic" ? "automatic" : "manual";
    const bestsellerProducts = Array.isArray(bestsellerSetting.products) ? bestsellerSetting.products : [];
    automaticPopularIds = bestsellerProducts.map(item => String(item.id)).filter(Boolean);
    automaticPopularSales = new Map(bestsellerProducts.map(item => [String(item.id), Math.max(0, Number(item.unitsSold) || 0)]));
    discountSelections = Array.isArray(discountSetting.products)
        ? discountSetting.products.map(item => ({
            id: String(item.id),
            percent: Math.min(95, Math.max(1, Math.round(Number(item.percent) || 15)))
        }))
        : DEFAULT_DISCOUNTS.map(item => ({ ...item }));
    discountCampaignLabel = normalizeDiscountCampaignLabel(discountSetting.label);
    discountMode = discountSetting.mode === "automatic" ? "automatic" : "manual";
    discountSectionEnabled = discountSetting.enabled !== false;
    announcementBar = normalizeAnnouncementBar(announcementSetting);
    heroCategoryOrder = normalizeHeroCategoryOrder(heroSetting.categoryOrder);
    homepageHero = normalizeHomepageHero(heroSetting);
    homepageSectionOrder = normalizeHomepageSectionOrder(sectionOrderSetting.items || sectionOrderSetting);
    savedHomepageHeroImageKeys = new Set(homepageHero.images.map(image => image.key).filter(Boolean));
    campaignBanner = normalizeCampaignBanner(campaignSetting);
    searchSettings = {
        suggestions: normalizeSearchList(storedSearch.suggestions, DEFAULT_SEARCH_SUGGESTIONS, 20),
        popularProducts: Array.isArray(storedSearch.popularProducts) ? storedSearch.popularProducts.map(item => String(item.id || item)).slice(0, SEARCH_POPULAR_PRODUCT_LIMIT) : [],
        popularMode: storedSearch.popularMode === "manual" ? "manual" : "automatic",
        suggestionsEnabled: storedSearch.suggestionsEnabled !== false,
        popularEnabled: true,
        suggestionsHeading: String(storedSearch.suggestionsHeading || "Suggested searches").slice(0, 60),
        popularHeading: String(storedSearch.popularHeading || "Popular picks").slice(0, 60),
        defaultSort: ["relevance", "popular", "newest", "low", "high"].includes(storedSearch.defaultSort) ? storedSearch.defaultSort : "relevance",
        trendingEnabled: storedSearch.trendingEnabled !== false,
        trendingHeading: String(storedSearch.trendingHeading || "Trending searches").slice(0, 60),
        trendingSearches: normalizeSearchList(storedSearch.trendingSearches, DEFAULT_TRENDING_SEARCHES, 20),
        trendingHiddenSearches: normalizeSearchList(storedSearch.trendingHiddenSearches, [], 20),
        trendingAutoRefresh: storedSearch.trendingAutoRefresh === true,
        trendingLastAutoRefresh: String(storedSearch.trendingLastAutoRefresh || ""),
        synonyms: normalizeSearchSynonyms(storedSearch.synonyms),
        emptyFallback: ["popular", "trending", "suggestions", "message"].includes(storedSearch.emptyFallback) ? storedSearch.emptyFallback : "popular",
        emptyMessage: String(storedSearch.emptyMessage || "Try a trending search or browse our popular picks.").slice(0, 120),
        searchRules: normalizeSearchRules(storedSearch.searchRules),
        autocompleteEnabled: storedSearch.autocompleteEnabled !== false,
        autocompleteCategories: storedSearch.autocompleteCategories !== false,
        autocompleteProducts: storedSearch.autocompleteProducts !== false,
        autocompleteProductLimit: [2, 3, 4].includes(Number(storedSearch.autocompleteProductLimit)) ? Number(storedSearch.autocompleteProductLimit) : 3,
        typoEnabled: storedSearch.typoEnabled !== false,
        typoStrength: storedSearch.typoStrength === "strict" ? "strict" : "balanced"
    };
    const weeklyMs = 7 * 24 * 60 * 60 * 1000;
    const lastTrendingRefresh = Date.parse(searchSettings.trendingLastAutoRefresh);
    const topInsightTerms = normalizeSearchList((searchInsights?.topQueries || []).map(item => item.query), [], 20);
    if (searchSettings.trendingAutoRefresh && topInsightTerms.length && (!lastTrendingRefresh || Date.now() - lastTrendingRefresh >= weeklyMs)) {
        searchSettings.trendingSearches = topInsightTerms;
        searchSettings.trendingHiddenSearches = [];
        searchSettings.trendingLastAutoRefresh = new Date().toISOString();
        saveSearchSettings().catch(error => console.warn("Unable to auto-refresh trending searches", error));
    }
    $("#popular-mode-automatic").checked = popularMode === "automatic";
    $("#discount-mode-automatic").checked = discountMode === "automatic";
    $("#offer-section-enabled").checked = discountSectionEnabled;
    syncAnnouncementBarForm();
    syncHomepageHeroForm();
    syncCampaignBannerForm();
    renderHomepageSectionOrder();
    syncHomepageSectionStates();
    $("#discount-campaign-label").value = discountCampaignLabel;
    productDropdownSync.get($("#discount-campaign-label"))?.();
    $("#discount-campaign-preview").textContent = discountCampaignLabel;
    renderAll();
    renderSearchSettings();
}

function renderStats() {
    const activeProducts = products.filter(isStorefrontActive);
    $("#stat-total").textContent = products.length;
    $("#stat-active").textContent = activeProducts.length;
    $("#stat-hidden").textContent = products.filter(product => productVisibility(product) === "hidden").length;
    $("#stat-draft").textContent = products.filter(product => productVisibility(product) === "draft").length;
    $("#stat-low-stock").textContent = activeProducts.filter(product => product.stock !== undefined && Number(product.stock) <= 5).length;
    $("#deleted-nav-count").textContent = deletedProducts.length;
}

function filteredProducts() {
    const query = $("#product-search").value.trim().toLowerCase();
    const category = $("#category-filter").value;
    const status = $("#status-filter").value;
    return products.filter(product => {
        const matchesQuery = !query || `${product.title || ""} ${product.sku || ""}`.toLowerCase().includes(query);
        const matchesCategory = category === "all" || productCategory(product) === category;
        const matchesStatus = status === "all" || productVisibility(product) === status;
        return matchesQuery && matchesCategory && matchesStatus;
    });
}

function renderProducts() {
    const visibleProducts = filteredProducts();
    $("#product-count").textContent = `${visibleProducts.length} result${visibleProducts.length === 1 ? "" : "s"}`;
    $("#products-empty").classList.toggle("hidden", visibleProducts.length > 0);
    $(".products-list").innerHTML = visibleProducts.map(product => {
        const status = productVisibility(product);
        const statusLabel = status === "active" ? "Active" : status === "hidden" ? "Hidden" : "Draft";
        const stockTracked = product.stock !== undefined && product.stock !== null;
        const stock = Math.max(0, Number(product.stock) || 0);
        return `<article class="product-card" data-id="${escapeHtml(product.id)}">
            <div class="product-thumb"><img src="${escapeHtml(productImage(product))}" alt=""><span class="media-count">${productMediaCount(product)} media</span></div>
            <div class="product-primary"><strong>${escapeHtml(product.title || "Untitled product")}</strong><div class="product-meta"><span>${escapeHtml(product.sku || "No SKU")}</span><span>·</span><span>${list(product.colors).length} colours</span><span>·</span><span>${list(product.sizes).length} sizes</span></div></div>
            <span class="category-pill">${escapeHtml(categoryLabels[productCategory(product)] || "Products")}</span>
            <span class="product-price">${formatMoney(product.price)}</span>
            <span class="stock-value ${stockTracked && stock <= 5 ? "low" : ""}">${stockTracked ? `${stock} in stock` : "Not tracked"}</span>
            <span class="status-pill ${status}">${statusLabel}</span>
            <div class="product-card-actions"><button class="edit-product" type="button" aria-label="Edit ${escapeHtml(product.title || "product")}" title="Edit"><img src="images/Icon Folder/Pencil Icon_333.PNG" alt=""></button><button class="archive-product" type="button" aria-label="Delete ${escapeHtml(product.title || "product")}" title="Delete"><img src="images/Icon Folder/Delete Icon_333.PNG" alt=""></button></div>
        </article>`;
    }).join("");
}

function daysRemaining(product) {
    const deleteAfter = product._trash?.deleteAfter;
    if (!deleteAfter) return 0;
    return Math.max(0, Math.ceil((Date.parse(deleteAfter) - Date.now()) / (24 * 60 * 60 * 1000)));
}

function renderDeletedProducts() {
    $("#deleted-products-empty").classList.toggle("hidden", deletedProducts.length > 0);
    $("#deleted-products-list").innerHTML = deletedProducts.map(product => {
        const remaining = daysRemaining(product);
        const deleteAfter = product._trash?.deleteAfter;
        const formattedDate = deleteAfter ? new Intl.DateTimeFormat("en-UG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(deleteAfter)) : "Soon";
        return `<article class="deleted-product-card" data-id="${escapeHtml(product.id)}">
            <img src="${escapeHtml(productImage(product))}" alt="">
            <div><strong>${escapeHtml(product.title || "Untitled product")}</strong><small>${escapeHtml(categoryLabels[productCategory(product)] || "Products")} · ${formatMoney(product.price)}</small></div>
            <div class="deletion-countdown"><span>${remaining} day${remaining === 1 ? "" : "s"} remaining</span><time datetime="${escapeHtml(deleteAfter || "")}">Deletes automatically on ${escapeHtml(formattedDate)}</time></div>
            <div class="deleted-product-actions"><button class="restore-product" type="button">Restore</button><button class="permanently-delete-product" type="button" aria-label="Permanently delete ${escapeHtml(product.title || "product")}" title="Permanently delete"><img src="images/Icon Folder/Delete Icon_333.PNG" alt=""></button></div>
        </article>`;
    }).join("");
}

function popularSelectionProductItems() {
    return $$("#popular-selection .popular-item:not(.popular-item-placeholder)");
}

function updatePopularSelectionRanks() {
    $$("#popular-selection .popular-item").forEach((item, index) => {
        const rank = item.querySelector(".popular-rank");
        if (!rank) return;
        rank.textContent = String(index + 1);
        rank.setAttribute("aria-label", `Position ${index + 1}`);
    });
}

function transparentDragImage() {
    let image = $("#transparent-drag-image");
    if (image) return image;
    image = document.createElement("span");
    image.id = "transparent-drag-image";
    image.setAttribute("aria-hidden", "true");
    Object.assign(image.style, {
        position: "fixed",
        left: "-20px",
        top: "-20px",
        width: "1px",
        height: "1px",
        opacity: "0",
        pointerEvents: "none"
    });
    document.body.appendChild(image);
    return image;
}

function animatePopularSelectionLayout(mutate) {
    const items = $$("#popular-selection .popular-item");
    const before = new Map(items.map(item => [item, item.getBoundingClientRect()]));
    mutate();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    items.forEach(item => {
        const start = before.get(item);
        if (!start) return;
        const end = item.getBoundingClientRect();
        const dx = start.left - end.left;
        const dy = start.top - end.top;
        if (!dx && !dy) return;
        item.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" }
        ], { duration: 90, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
}

function initializeHomepagePopularReorder() {
    const list = $("#popular-selection");
    if (!list) return;
    let drag = null;

    const items = () => $$("#popular-selection .popular-item");
    const clearTargets = () => items().forEach(item => item.classList.remove("is-drop-target", "is-making-space"));
    const productOrder = () => popularSelectionProductItems().map(item => item.dataset.id).filter(Boolean);
    const movePreview = event => {
        if (!drag?.preview) return;
        drag.preview.style.transform = `translate3d(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px, 0)`;
    };
    const createPreview = (item, event) => {
        const rect = item.getBoundingClientRect();
        const preview = item.cloneNode(true);
        preview.classList.remove("dragging", "is-making-space", "is-drop-target");
        preview.classList.add("popular-drag-preview");
        preview.removeAttribute("draggable");
        Object.assign(preview.style, {
            width: `${rect.width}px`,
            height: `${rect.height}px`
        });
        document.body.appendChild(preview);
        drag.offsetX = event.clientX - rect.left;
        drag.offsetY = event.clientY - rect.top;
        drag.preview = preview;
        movePreview(event);
    };
    const nearestTarget = event => {
        const directItem = event.target.closest(".popular-item");
        if (directItem && directItem !== drag?.item) {
            const rect = directItem.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const horizontal = Math.abs(event.clientX - centerX) > Math.abs(event.clientY - centerY);
            return { item: directItem, placeAfter: horizontal ? event.clientX > centerX : event.clientY > centerY };
        }
        if (directItem === drag?.item) return null;
        let nearest = null;
        items().forEach(item => {
            if (item === drag?.item) return;
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
            if (!nearest || distance < nearest.distance) nearest = { item, centerX, centerY, distance };
        });
        if (!nearest) return null;
        const horizontal = Math.abs(event.clientX - nearest.centerX) > Math.abs(event.clientY - nearest.centerY);
        return { item: nearest.item, placeAfter: horizontal ? event.clientX > nearest.centerX : event.clientY > nearest.centerY };
    };
    const restoreOriginalOrder = () => {
        if (!drag) return;
        const firstPlaceholder = $("#popular-selection .popular-item-placeholder");
        drag.originalIds.forEach(id => {
            const item = popularSelectionProductItems().find(row => row.dataset.id === id);
            if (item) list.insertBefore(item, firstPlaceholder);
        });
        updatePopularSelectionRanks();
    };
    const swapItems = (first, second) => {
        if (!first || !second || first === second) return;
        const marker = document.createTextNode("");
        first.before(marker);
        second.before(first);
        marker.replaceWith(second);
    };
    const markDropTarget = target => {
        clearTargets();
        if (target?.item && target.item !== drag?.item) {
            target.item.classList.add("is-drop-target", "is-making-space");
        }
    };
    const previewSwapTarget = target => {
        if (!drag || !target?.item || target.item === drag.item) return;
        const currentOrder = productOrder().join("|");
        const nextPreviewKey = `${target.item.dataset.id || "empty"}:${currentOrder}`;
        if (drag.previewTarget === nextPreviewKey) return;
        drag.previewTarget = nextPreviewKey;
        markDropTarget(target);
        animatePopularSelectionLayout(() => {
            if (target.item.classList.contains("popular-item-placeholder")) {
                list.insertBefore(drag.item, target.placeAfter ? target.item.nextSibling : target.item);
            } else {
                swapItems(drag.item, target.item);
            }
            updatePopularSelectionRanks();
        });
    };
    const commitDropTarget = () => {
        if (!drag) return;
        popularIds = productOrder();
        updatePopularSelectionRanks();
    };
    const clearDragState = () => {
        if (!drag) return;
        if (!drag.committed) animatePopularSelectionLayout(restoreOriginalOrder);
        clearTargets();
        drag.preview?.remove();
        drag.item.classList.remove("dragging");
        list.classList.remove("is-reordering");
        drag = null;
    };

    list.addEventListener("dragstart", event => {
        if (popularMode !== "manual" || event.target.closest("button")) return event.preventDefault();
        const item = event.target.closest(".popular-item:not(.popular-item-placeholder)");
        if (!item) return;
        drag = { item, id: item.dataset.id, originalIds: productOrder(), previewTarget: null, committed: false, preview: null, offsetX: 0, offsetY: 0 };
        createPreview(item, event);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", drag.id || "");
        event.dataTransfer.setDragImage(transparentDragImage(), 0, 0);
        requestAnimationFrame(() => {
            item.classList.add("dragging");
            list.classList.add("is-reordering");
        });
    });
    list.addEventListener("dragover", event => {
        if (!drag || popularMode !== "manual") return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        movePreview(event);
        const target = nearestTarget(event);
        if (!target) return;
        previewSwapTarget(target);
    });
    list.addEventListener("drag", event => {
        if (!drag || !event.clientX || !event.clientY) return;
        movePreview(event);
    });
    list.addEventListener("dragleave", event => {
        if (!drag || list.contains(event.relatedTarget)) return;
        clearTargets();
    });
    list.addEventListener("drop", event => {
        if (!drag) return;
        event.preventDefault();
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
        commitDropTarget();
        drag.committed = true;
        clearDragState();
    });
    list.addEventListener("dragend", () => {
        clearDragState();
    });
    list.addEventListener("keydown", event => {
        if (popularMode !== "manual" || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        const item = event.target.closest(".popular-item:not(.popular-item-placeholder)");
        if (!item) return;
        const current = popularIds.indexOf(item.dataset.id);
        const step = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
        const next = current + step;
        if (current < 0 || next < 0 || next >= popularIds.length) return;
        const target = popularSelectionProductItems()[next];
        event.preventDefault();
        animatePopularSelectionLayout(() => {
            popularIds.splice(next, 0, popularIds.splice(current, 1)[0]);
            if (target) list.insertBefore(item, step > 0 ? target.nextSibling : target);
            updatePopularSelectionRanks();
            item.focus();
        });
    });
}

function renderPopularSelection() {
    const selectedIds = popularMode === "automatic"
        ? automaticPopularSelectionIds()
        : popularIds.filter(id => !discountSectionEnabled || discountMode !== "automatic" || !isHomepageDiscount(id));
    const selected = selectedIds.map(id => products.find(product => String(product.id) === id)).filter(Boolean);
    $("#popular-selection-help").classList.add("hidden");
    const automatic = popularMode === "automatic";
    const productsMarkup = selected.map((product, index) => `<div class="popular-item ${automatic ? "is-automatic" : ""}" draggable="${automatic ? "false" : "true"}" tabindex="${automatic ? "-1" : "0"}" data-id="${escapeHtml(product.id)}">
        <span class="popular-rank" aria-label="Position ${index + 1}">${index + 1}</span>
        <div class="popular-item-card">
            <img class="popular-item-image" src="${escapeHtml(productImage(product))}" alt="">
            <div class="popular-item-details"><strong>${escapeHtml(product.title)}</strong><small>${automatic ? (automaticPopularSales.has(String(product.id)) ? `${automaticPopularSales.get(String(product.id))} sold in 30 days` : "Automatic fallback") : formatMoney(product.price)}</small></div>
            ${automatic ? "" : `<button type="button" class="remove-popular" aria-label="Remove ${escapeHtml(product.title)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button>`}
        </div>
    </div>`).join("");
    const emptyMarkup = Array.from({ length: Math.max(0, POPULAR_PRODUCT_LIMIT - selected.length) }, (_, offset) => selectionPlaceholderMarkup(selected.length + offset));
    $("#popular-selection").innerHTML = productsMarkup + emptyMarkup.join("");
}

function homepageAutomaticMessageMarkup(message) {
    return `<p class="search-setting-empty search-automatic-message homepage-automatic-message"><img src="images/Icon Folder/Gear Icon_Gray.PNG" alt="" aria-hidden="true"><strong>Operating Automatically</strong><span>${escapeHtml(message)}</span></p>`;
}

function automaticPopularSelectionIds() {
    const discountedIds = discountSectionEnabled ? new Set(homepageDiscountSelections().map(item => item.id)) : new Set();
    const eligible = product => isStorefrontActive(product) && !discountedIds.has(String(product.id));
    const rankedIds = automaticPopularIds.filter(id => products.some(product => String(product.id) === id && eligible(product)));
    const rankedSet = new Set(rankedIds);
    const fallbackIds = products.filter(product => eligible(product) && !rankedSet.has(String(product.id))).map(product => String(product.id));
    return [...rankedIds, ...fallbackIds].slice(0, POPULAR_PRODUCT_LIMIT);
}

function selectionPlaceholderMarkup(index) {
    return `<div class="popular-item popular-item-placeholder" aria-label="Empty product position ${index + 1}">
        <span class="popular-rank" aria-hidden="true">${index + 1}</span>
        <div class="popular-item-card">
            <span class="popular-placeholder-image"></span>
            <span class="popular-placeholder-details"><i></i><i></i></span>
            <span class="popular-placeholder-action"></span>
        </div>
    </div>`;
}

function renderHomepageProducts() {
    if (popularMode === "automatic") {
        $("#homepage-products").innerHTML = homepageAutomaticMessageMarkup("MPWR will choose popular active products for this section.");
        return;
    }
    const query = $("#homepage-search").value.trim().toLowerCase();
    const candidates = products.filter(product => isStorefrontActive(product) && (!query || `${product.title} ${product.sku || ""}`.toLowerCase().includes(query)));
    $("#homepage-products").innerHTML = candidates.map(product => {
        const selectedProduct = popularMode === "manual" && popularIds.includes(String(product.id)) && (!discountSectionEnabled || !isHomepageDiscount(product.id));
        const discountedProduct = discountSectionEnabled && isHomepageDiscount(product.id);
        const pickerDisabled = popularMode === "automatic";
        return `<div class="homepage-product ${selectedProduct ? "selected" : ""}" data-id="${escapeHtml(product.id)}"><img src="${escapeHtml(productImage(product))}" alt=""><div><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(categoryLabels[productCategory(product)] || "Products")}</small></div><button type="button" class="toggle-popular ${discountedProduct ? "is-blocked" : ""}" ${pickerDisabled ? "disabled" : ""} aria-disabled="${pickerDisabled || discountedProduct}" aria-label="${pickerDisabled ? "Switch Popular Products to Manual to edit" : discountedProduct ? "Already in Offers. Select for an explanation" : `${selectedProduct ? "Remove" : "Add"} ${escapeHtml(product.title)}`}"><img src="images/Icon Folder/${selectedProduct ? "Tick Icon_White.PNG" : "Plus Icon_Gray.PNG"}" alt=""></button></div>`;
    }).join("");
}

function updateHomepageProductCard(id, selected) {
    const card = $$("#homepage-products .homepage-product").find(item => item.dataset.id === String(id));
    if (!card) return;
    const product = products.find(item => String(item.id) === String(id));
    const button = card.querySelector(".toggle-popular");
    const discountedProduct = discountSectionEnabled && isHomepageDiscount(id);
    card.classList.toggle("selected", selected);
    button.disabled = false;
    button.classList.toggle("is-blocked", discountedProduct);
    button.setAttribute("aria-disabled", String(discountedProduct));
    button.setAttribute("aria-label", discountedProduct ? "Already in Offers. Select for an explanation" : `${selected ? "Remove" : "Add"} ${product?.title || "product"}`);
    button.querySelector("img").src = `images/Icon Folder/${selected ? "Tick Icon_White.PNG" : "Plus Icon_Gray.PNG"}`;
}

function appendPopularSelectionCard(product) {
    const index = popularIds.indexOf(String(product.id));
    if (index < 0) return;
    const list = $("#popular-selection");
    const firstPlaceholder = $("#popular-selection .popular-item-placeholder");
    const wrapper = document.createElement("template");
    wrapper.innerHTML = `<div class="popular-item" draggable="true" tabindex="0" data-id="${escapeHtml(product.id)}">
        <span class="popular-rank" aria-label="Position ${index + 1}">${index + 1}</span>
        <div class="popular-item-card">
            <img class="popular-item-image" src="${escapeHtml(productImage(product))}" alt="">
            <div class="popular-item-details"><strong>${escapeHtml(product.title)}</strong><small>${formatMoney(product.price)}</small></div>
            <button type="button" class="remove-popular" aria-label="Remove ${escapeHtml(product.title)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button>
        </div>
    </div>`;
    list.insertBefore(wrapper.content.firstElementChild, firstPlaceholder);
    firstPlaceholder?.remove();
    $("#popular-selection-help").classList.add("hidden");
    updatePopularSelectionRanks();
}

function animateProductToPopular(sourceCard, id) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sourceImage = sourceCard?.querySelector(":scope > img");
    const targetCard = $$("#popular-selection .popular-item").find(item => item.dataset.id === String(id));
    const targetImage = targetCard?.querySelector(".popular-item-image");
    if (!sourceImage || !targetImage) return;

    const sourceRect = sourceImage.getBoundingClientRect();
    const targetRect = targetImage.getBoundingClientRect();
    const flyingImage = sourceImage.cloneNode(true);
    flyingImage.className = "popular-flying-image";
    Object.assign(flyingImage.style, {
        left: `${sourceRect.left}px`,
        top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        margin: "0"
    });
    document.body.appendChild(flyingImage);

    const translateX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const translateY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
    const scale = Math.min(targetRect.width / sourceRect.width, targetRect.height / sourceRect.height);
    const animation = flyingImage.animate([
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        { transform: `translate3d(${translateX}px,${translateY}px,0) scale(${scale})`, opacity: .15 }
    ], {
        duration: 650,
        easing: "cubic-bezier(.25,.8,.25,1)",
        fill: "forwards"
    });
    animation.finished.finally(() => {
        flyingImage.remove();
        targetCard.classList.add("popular-arrival");
        setTimeout(() => targetCard.classList.remove("popular-arrival"), 450);
    });
}

function removePopularSelectionCard(id) {
    const card = $$("#popular-selection .popular-item").find(item => item.dataset.id === String(id));
    card?.remove();
    const list = $("#popular-selection");
    const totalItems = $$("#popular-selection .popular-item").length;
    if (totalItems < POPULAR_PRODUCT_LIMIT) list.insertAdjacentHTML("beforeend", selectionPlaceholderMarkup(totalItems + 1));
    updatePopularSelectionRanks();
    $("#popular-selection-help").classList.toggle("hidden", popularIds.length > 0);
}

function updatePopularSelectionPreview(product, action) {
    if (popularMode !== "manual") return renderPopularSelection();
    if (action === "add") appendPopularSelectionCard(product);
    else removePopularSelectionCard(product.id);
}

function discountSelectionMarkup(product, index, selection = discountSelection(product.id)) {
    const automatic = discountMode === "automatic";
    const salesLabel = automaticPopularSales.has(String(product.id))
        ? `${automaticPopularSales.get(String(product.id))} sold in 30 days · ${selection?.percent || 15}% off`
        : `Automatic fallback · ${selection?.percent || 15}% off`;
    return `<div class="popular-item discount-item ${automatic ? "is-automatic" : ""}" draggable="${automatic ? "false" : "true"}" tabindex="${automatic ? "-1" : "0"}" data-id="${escapeHtml(product.id)}">
        <span class="popular-rank" aria-label="Position ${index + 1}">${index + 1}</span>
        <div class="popular-item-card">
            <img class="popular-item-image" src="${escapeHtml(productImage(product))}" alt="">
            <div class="popular-item-details"><strong>${escapeHtml(product.title)}</strong>${automatic ? `<small>${salesLabel}</small>` : `<label class="discount-percent-control"><input class="discount-percent-input" type="number" min="1" max="95" step="1" value="${selection?.percent || 15}" aria-label="Discount percentage for ${escapeHtml(product.title)}"><span>% off</span></label>`}</div>
            ${automatic ? "" : `<button type="button" class="remove-popular remove-discount" aria-label="Remove ${escapeHtml(product.title)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button>`}
        </div>
    </div>`;
}

function renderDiscountSelection() {
    const selections = homepageDiscountSelections();
    const selected = selections.map(selection => ({ selection, product: products.find(product => String(product.id) === selection.id) })).filter(item => item.product);
    $("#discount-selection-help").classList.add("hidden");
    const emptyMarkup = Array.from({ length: Math.max(0, HOMEPAGE_DISCOUNT_PRODUCT_LIMIT - selected.length) }, (_, offset) => selectionPlaceholderMarkup(selected.length + offset));
    $("#discount-selection").innerHTML = selected.map(({ product, selection }, index) => discountSelectionMarkup(product, index, selection)).join("") + emptyMarkup.join("");
}

function updateDiscountSelectionPreview(product, action) {
    if (discountMode !== "manual") return renderDiscountSelection();
    if (action === "add") appendDiscountSelectionCard(product);
    else removeDiscountSelectionCard(product.id);
}

function discountSelectionProductItems() {
    return $$("#discount-selection .discount-item:not(.popular-item-placeholder)");
}

function updateDiscountSelectionRanks() {
    $$("#discount-selection .popular-item").forEach((item, index) => {
        const rank = item.querySelector(".popular-rank");
        if (!rank) return;
        rank.textContent = String(index + 1);
        rank.setAttribute("aria-label", `Position ${index + 1}`);
    });
}

function animateDiscountSelectionLayout(mutate) {
    const items = $$("#discount-selection .popular-item");
    const before = new Map(items.map(item => [item, item.getBoundingClientRect()]));
    mutate();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    items.forEach(item => {
        const start = before.get(item);
        if (!start) return;
        const end = item.getBoundingClientRect();
        const dx = start.left - end.left;
        const dy = start.top - end.top;
        if (!dx && !dy) return;
        item.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" }
        ], { duration: 90, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
}

function initializeHomepageDiscountReorder() {
    const list = $("#discount-selection");
    if (!list) return;
    let drag = null;

    const items = () => $$("#discount-selection .popular-item");
    const clearTargets = () => items().forEach(item => item.classList.remove("is-drop-target", "is-making-space"));
    const selectionOrder = () => discountSelectionProductItems().map(item => item.dataset.id).filter(Boolean);
    const movePreview = event => {
        if (!drag?.preview || !event.clientX || !event.clientY) return;
        drag.previewX = event.clientX - drag.offsetX;
        drag.previewY = event.clientY - drag.offsetY;
        if (drag.previewFrame) return;
        drag.previewFrame = requestAnimationFrame(() => {
            if (drag?.preview) drag.preview.style.transform = `translate3d(${drag.previewX}px, ${drag.previewY}px, 0)`;
            if (drag) drag.previewFrame = null;
        });
    };
    const createPreview = (item, event) => {
        const rect = item.getBoundingClientRect();
        const preview = item.cloneNode(true);
        preview.classList.remove("dragging", "is-making-space", "is-drop-target");
        preview.classList.add("popular-drag-preview");
        preview.removeAttribute("draggable");
        Object.assign(preview.style, {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`
        });
        document.body.appendChild(preview);
        drag.offsetX = event.clientX || event.clientY ? event.clientX - rect.left : rect.width / 2;
        drag.offsetY = event.clientX || event.clientY ? event.clientY - rect.top : rect.height / 2;
        drag.preview = preview;
        movePreview(event);
    };
    const nearestTarget = event => {
        const directItem = event.target.closest(".popular-item");
        if (directItem && directItem !== drag?.item && list.contains(directItem)) {
            const rect = directItem.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const horizontal = Math.abs(event.clientX - centerX) > Math.abs(event.clientY - centerY);
            return { item: directItem, placeAfter: horizontal ? event.clientX > centerX : event.clientY > centerY };
        }
        if (directItem === drag?.item) return null;
        let nearest = null;
        items().forEach(item => {
            if (item === drag?.item) return;
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
            if (!nearest || distance < nearest.distance) nearest = { item, centerX, centerY, distance };
        });
        if (!nearest) return null;
        const horizontal = Math.abs(event.clientX - nearest.centerX) > Math.abs(event.clientY - nearest.centerY);
        return { item: nearest.item, placeAfter: horizontal ? event.clientX > nearest.centerX : event.clientY > nearest.centerY };
    };
    const restoreOriginalOrder = () => {
        if (!drag) return;
        const firstPlaceholder = $("#discount-selection .popular-item-placeholder");
        drag.originalIds.forEach(id => {
            const item = discountSelectionProductItems().find(row => row.dataset.id === id);
            if (item) list.insertBefore(item, firstPlaceholder);
        });
        updateDiscountSelectionRanks();
    };
    const swapItems = (first, second) => {
        if (!first || !second || first === second) return;
        const marker = document.createTextNode("");
        first.before(marker);
        second.before(first);
        marker.replaceWith(second);
    };
    const markDropTarget = target => {
        clearTargets();
        if (target?.item && target.item !== drag?.item) target.item.classList.add("is-drop-target");
    };
    const previewSwapTarget = target => {
        if (!drag || !target?.item || target.item === drag.item) return;
        const currentOrder = selectionOrder().join("|");
        const nextPreviewKey = `${target.item.dataset.id || "empty"}:${currentOrder}`;
        if (drag.previewTarget === nextPreviewKey) return;
        drag.previewTarget = nextPreviewKey;
        markDropTarget(target);
        animateDiscountSelectionLayout(() => {
            if (target.item.classList.contains("popular-item-placeholder")) list.insertBefore(drag.item, target.placeAfter ? target.item.nextSibling : target.item);
            else swapItems(drag.item, target.item);
            updateDiscountSelectionRanks();
        });
    };
    const commitDropTarget = () => {
        if (!drag) return;
        const order = selectionOrder();
        const byId = new Map(discountSelections.map(item => [item.id, item]));
        discountSelections = order.map(id => byId.get(id)).filter(Boolean);
        updateDiscountSelectionRanks();
    };
    const clearDragState = () => {
        if (!drag) return;
        if (!drag.committed) animateDiscountSelectionLayout(restoreOriginalOrder);
        clearTargets();
        if (drag.previewFrame) cancelAnimationFrame(drag.previewFrame);
        drag.preview?.remove();
        drag.item.classList.remove("dragging");
        list.classList.remove("is-reordering");
        drag = null;
    };

    list.addEventListener("dragstart", event => {
        if (discountMode !== "manual" || event.target.closest("input,button")) return event.preventDefault();
        const item = event.target.closest(".discount-item:not(.popular-item-placeholder)");
        if (!item) return;
        if (drag) return event.preventDefault();
        drag = { item, id: item.dataset.id, originalIds: selectionOrder(), previewTarget: null, committed: false, preview: null, previewFrame: null, previewX: 0, previewY: 0, offsetX: 0, offsetY: 0 };
        createPreview(item, event);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", drag.id || "");
        event.dataTransfer.setDragImage(transparentDragImage(), 0, 0);
        requestAnimationFrame(() => {
            item.classList.add("dragging");
            list.classList.add("is-reordering");
        });
    });
    list.addEventListener("dragover", event => {
        if (!drag || discountMode !== "manual") return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
    });
    list.addEventListener("drag", event => {
        if (!drag || !event.clientX || !event.clientY) return;
        movePreview(event);
    });
    list.addEventListener("dragleave", event => {
        if (!drag || list.contains(event.relatedTarget)) return;
        clearTargets();
    });
    list.addEventListener("drop", event => {
        if (!drag) return;
        event.preventDefault();
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
        commitDropTarget();
        drag.committed = true;
        clearDragState();
    });
    list.addEventListener("dragend", clearDragState);
    list.addEventListener("keydown", event => {
        if (discountMode !== "manual" || event.target.closest("input,button") || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        const item = event.target.closest(".discount-item:not(.popular-item-placeholder)");
        if (!item) return;
        const current = discountSelections.findIndex(selection => selection.id === item.dataset.id);
        const step = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
        const next = current + step;
        if (current < 0 || next < 0 || next >= discountSelections.length) return;
        const target = discountSelectionProductItems()[next];
        event.preventDefault();
        animateDiscountSelectionLayout(() => {
            discountSelections.splice(next, 0, discountSelections.splice(current, 1)[0]);
            if (target) list.insertBefore(item, step > 0 ? target.nextSibling : target);
            updateDiscountSelectionRanks();
            item.focus();
        });
    });
}

function renderDiscountProducts() {
    if (discountMode === "automatic") {
        $("#discount-products").innerHTML = homepageAutomaticMessageMarkup("MPWR will choose and arrange discounted products for this campaign.");
        return;
    }
    const query = $("#discount-search").value.trim().toLowerCase();
    const candidates = products.filter(product => isStorefrontActive(product) && (!query || `${product.title} ${product.sku || ""}`.toLowerCase().includes(query)));
    $("#discount-products").innerHTML = candidates.map(product => {
        const selectedProduct = discountMode === "manual" && isHomepageDiscount(product.id);
        const pickerDisabled = discountMode === "automatic";
        const disabled = pickerDisabled || (!selectedProduct && homepageDiscountSelections().length >= HOMEPAGE_DISCOUNT_PRODUCT_LIMIT);
        return `<div class="homepage-product discount-homepage-product ${selectedProduct ? "selected" : ""}" data-id="${escapeHtml(product.id)}"><img src="${escapeHtml(productImage(product))}" alt=""><div><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(categoryLabels[productCategory(product)] || "Products")}</small></div><button type="button" class="toggle-discount ${disabled && !pickerDisabled ? "is-blocked" : ""}" ${pickerDisabled ? "disabled" : ""} aria-disabled="${disabled}" aria-label="${pickerDisabled ? "Switch Discount Products to Manual to edit" : disabled ? "Homepage offer limit reached. Select for an explanation" : `${selectedProduct ? "Remove" : "Add"} ${escapeHtml(product.title)}`}"><img src="images/Icon Folder/${selectedProduct ? "Tick Icon_White.PNG" : "Plus Icon_Gray.PNG"}" alt=""></button></div>`;
    }).join("");
}

function syncDiscountPickerAvailability() {
    if (discountMode === "automatic") return renderDiscountProducts();
    const homepageFull = homepageDiscountSelections().length >= HOMEPAGE_DISCOUNT_PRODUCT_LIMIT;
    $$("#discount-products .homepage-product").forEach(card => {
        const selected = isHomepageDiscount(card.dataset.id);
        const product = products.find(item => String(item.id) === card.dataset.id);
        const button = card.querySelector(".toggle-discount");
        card.classList.toggle("selected", selected);
        const blocked = homepageFull && !selected;
        button.disabled = false;
        button.classList.toggle("is-blocked", blocked);
        button.setAttribute("aria-disabled", String(blocked));
        button.setAttribute("aria-label", blocked ? "Homepage offer limit reached. Select for an explanation" : `${selected ? "Remove" : "Add"} ${product?.title || "product"}`);
        button.querySelector("img").src = `images/Icon Folder/${selected ? "Tick Icon_White.PNG" : "Plus Icon_Gray.PNG"}`;
    });
}

function appendDiscountSelectionCard(product) {
    const index = discountSelections.findIndex(item => item.id === String(product.id));
    if (index < 0 || index >= HOMEPAGE_DISCOUNT_PRODUCT_LIMIT) return;
    const list = $("#discount-selection");
    const firstPlaceholder = $("#discount-selection .popular-item-placeholder");
    const wrapper = document.createElement("template");
    wrapper.innerHTML = discountSelectionMarkup(product, index, discountSelection(product.id));
    list.insertBefore(wrapper.content.firstElementChild, firstPlaceholder);
    firstPlaceholder?.remove();
    $("#discount-selection-help").classList.add("hidden");
    updateDiscountSelectionRanks();
}

function animateProductToDiscount(sourceCard, id) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sourceImage = sourceCard?.querySelector(":scope > img");
    const targetCard = $$("#discount-selection .discount-item").find(item => item.dataset.id === String(id));
    const targetImage = targetCard?.querySelector(".popular-item-image");
    if (!sourceImage || !targetImage) return;
    const sourceRect = sourceImage.getBoundingClientRect();
    const targetRect = targetImage.getBoundingClientRect();
    const flyingImage = sourceImage.cloneNode(true);
    flyingImage.className = "popular-flying-image";
    Object.assign(flyingImage.style, { left: `${sourceRect.left}px`, top: `${sourceRect.top}px`, width: `${sourceRect.width}px`, height: `${sourceRect.height}px`, margin: "0" });
    document.body.appendChild(flyingImage);
    const translateX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
    const translateY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
    const scale = Math.min(targetRect.width / sourceRect.width, targetRect.height / sourceRect.height);
    const animation = flyingImage.animate([
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        { transform: `translate3d(${translateX}px,${translateY}px,0) scale(${scale})`, opacity: .15 }
    ], { duration: 650, easing: "cubic-bezier(.25,.8,.25,1)", fill: "forwards" });
    animation.finished.finally(() => {
        flyingImage.remove();
        targetCard.classList.add("popular-arrival");
        setTimeout(() => targetCard.classList.remove("popular-arrival"), 450);
    });
}

function removeDiscountSelectionCard(id) {
    const card = $$("#discount-selection .discount-item").find(item => item.dataset.id === String(id));
    card?.remove();
    const list = $("#discount-selection");
    const totalItems = $$("#discount-selection .popular-item").length;
    if (totalItems < HOMEPAGE_DISCOUNT_PRODUCT_LIMIT) list.insertAdjacentHTML("beforeend", selectionPlaceholderMarkup(totalItems + 1));
    updateDiscountSelectionRanks();
    $("#discount-selection-help").classList.toggle("hidden", discountSelections.length > 0);
}

function renderHomepage() {
    discountSelections = discountSelections.filter(item => products.some(product => String(product.id) === item.id && isStorefrontActive(product)));
    const discountedIds = new Set(homepageDiscountSelections().map(item => item.id));
    popularIds = popularIds.filter(id => (popularMode === "automatic" || !discountSectionEnabled || !discountedIds.has(id)) && products.some(product => String(product.id) === id && isStorefrontActive(product))).slice(0, POPULAR_PRODUCT_LIMIT);
    renderPopularSelection();
    renderHomepageProducts();
    renderDiscountSelection();
    renderDiscountProducts();
    requestAnimationFrame(syncHomepagePanelHeights);
}

function syncHomepagePanelHeights() {
    const useEqualPanels = window.matchMedia("(min-width: 1051px)").matches;
    $$(".homepage-layout").forEach(layout => {
        const preview = layout.querySelector(".homepage-preview-card");
        const picker = layout.querySelector(".homepage-picker-card");
        if (!preview || !picker) return;
        const targetHeight = useEqualPanels ? `${Math.ceil(preview.getBoundingClientRect().height)}px` : "";
        if (picker.style.height !== targetHeight) picker.style.height = targetHeight;
    });
}

function renderAll() {
    renderStats();
    renderProducts();
    renderHomepage();
    renderDeletedProducts();
}

function searchPopularSelection() {
    const ids = searchSettings.popularMode === "automatic"
        ? [...automaticPopularIds, ...products.map(product => String(product.id))]
        : searchSettings.popularProducts;
    return [...new Set(ids)].map(id => products.find(product => String(product.id) === id && isStorefrontActive(product))).filter(Boolean).slice(0, SEARCH_POPULAR_PRODUCT_LIMIT);
}

function searchPreviewPricing(product) {
    const campaign = discountSectionEnabled
        ? homepageDiscountSelections().find(item => item.id === String(product.id))
        : null;
    const current = Math.max(0, Number(product.price) || 0);
    if (campaign?.percent) {
        const percent = Math.min(95, Math.max(1, Math.round(Number(campaign.percent) || 0)));
        return { current: Math.round(current * (1 - percent / 100)), regular: current, percent, discounted: true };
    }
    const compareAt = Math.max(0, Number(product.compareAtPrice) || 0);
    if (compareAt > current) {
        const percent = Math.min(95, Math.max(1, Math.round((1 - current / compareAt) * 100)));
        return { current, regular: compareAt, percent, discounted: true };
    }
    return { current, regular: current, percent: 0, discounted: false };
}

function searchPreviewProductMarkup(product) {
    const pricing = searchPreviewPricing(product);
    const price = pricing.discounted
        ? `<span class="search-preview-price-pair mpwr-price-pair is-card-price"><span class="mpwr-sale-price">${formatMoney(pricing.current)}</span><span class="mpwr-original-price">${formatMoney(pricing.regular)}</span></span>`
        : formatMoney(pricing.current);
    return `<article class="search-preview-product product-box" aria-label="Preview of ${escapeHtml(product.title)}">
        <div class="search-preview-product-image img-box">
            ${pricing.discounted ? `<span class="search-preview-discount discount-badge">${pricing.percent}% OFF</span>` : ""}
            <img src="${escapeHtml(productImage(product))}" alt="">
        </div>
        <h2 class="product-title">${escapeHtml(product.title)}</h2>
        <div class="search-preview-product-footer price-and-cart">
            <span class="search-preview-price price">${price}</span>
            <i aria-hidden="true"><img src="images/Plus.PNG" class="search-preview-add addie" alt=""></i>
        </div>
    </article>`;
}

function searchPreviewPopularEmptyMarkup() {
    return `<div class="search-preview-products-empty">
        <strong>No products selected</strong>
        <span>Select products from the Popular Picks section.</span>
    </div>`;
}

function renderSearchPopularPreview() {
    const previewPopularHeading = $("#search-preview-popular-heading");
    const previewProducts = $("#search-preview-products");
    if (!previewPopularHeading || !previewProducts) return;
    previewPopularHeading.textContent = searchSettings.popularHeading;
    const previewPopularKicker = $(".search-preview-results-kicker");
    if (previewPopularKicker) previewPopularKicker.hidden = !searchSettings.popularEnabled;
    previewPopularHeading.hidden = !searchSettings.popularEnabled;
    previewProducts.hidden = !searchSettings.popularEnabled;
    const previewPopularSelection = searchPopularSelection();
    previewProducts.innerHTML = searchSettings.popularMode === "manual" && !previewPopularSelection.length
        ? searchPreviewPopularEmptyMarkup()
        : previewPopularSelection.map(searchPreviewProductMarkup).join("");
}

function syncSearchPopularProducts({ animate = true } = {}) {
    const list = $("#search-popular-products");
    if (!list || searchSettings.popularMode !== "manual") return;
    const rows = [...list.querySelectorAll(".search-product-row")];
    const before = animate ? new Map(rows.map(row => [row, row.getBoundingClientRect()])) : null;
    const selected = new Set(searchSettings.popularProducts);
    rows.forEach((row, productIndex) => {
        const id = row.dataset.id || "";
        const product = products.find(item => String(item.id) === id);
        if (!product) return;
        const isSelected = selected.has(id);
        const selectedIndex = searchSettings.popularProducts.indexOf(id);
        const limitReached = !isSelected && searchSettings.popularProducts.length >= SEARCH_POPULAR_PRODUCT_LIMIT;
        let dragHandle = row.querySelector(".search-product-drag");
        if (isSelected && !dragHandle) {
            row.insertAdjacentHTML("afterbegin", '<span class="search-product-drag is-position" draggable="true" aria-hidden="true"></span>');
            dragHandle = row.querySelector(".search-product-drag");
        } else if (!isSelected && dragHandle) dragHandle.remove();
        if (dragHandle) dragHandle.textContent = String(selectedIndex + 1);
        row.classList.toggle("selected", isSelected);
        row.draggable = isSelected;
        row.dataset.index = isSelected ? String(selectedIndex) : "";
        row.style.order = String(isSelected ? selectedIndex : 1000 + productIndex);
        const small = row.querySelector("small");
        if (small) small.textContent = isSelected ? `Selected · position ${selectedIndex + 1}` : (categoryLabels[productCategory(product)] || "Products");
        const button = row.querySelector("[data-toggle]");
        const icon = button?.querySelector("img");
        if (!button || !icon) return;
        button.classList.toggle("is-limit-reached", limitReached);
        if (limitReached) button.setAttribute("aria-disabled", "true");
        else button.removeAttribute("aria-disabled");
        button.setAttribute("aria-label", isSelected ? `Remove ${product.title}` : limitReached ? "Popular Picks limit reached" : `Add ${product.title}`);
        icon.src = `images/Icon Folder/${isSelected ? "Tick Icon_White.PNG" : limitReached ? "Plus Icon_Light Gray.PNG" : "Plus Icon_Gray.PNG"}`;
    });
    if (animate && before) {
        rows.forEach(row => {
            const start = before.get(row);
            if (!start) return;
            const end = row.getBoundingClientRect();
            const dx = start.left - end.left;
            const dy = start.top - end.top;
            if (!dx && !dy) return;
            row.animate([
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "translate(0, 0)" }
            ], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
        });
    }
    renderSearchPopularPreview();
}

function syncSearchPopularSelectedRows({ renderPreview = true, changedId = null, updateLimitState = false } = {}) {
    const list = $("#search-popular-products");
    if (!list || searchSettings.popularMode !== "manual") return;
    const selected = new Set(searchSettings.popularProducts);
    const allRows = [...list.querySelectorAll(".search-product-row")];
    const rows = updateLimitState
        ? allRows
        : allRows.filter(row => selected.has(row.dataset.id) || row.dataset.id === String(changedId || ""));
    const atLimit = searchSettings.popularProducts.length >= SEARCH_POPULAR_PRODUCT_LIMIT;
    rows.forEach(row => {
        const id = row.dataset.id || "";
        const product = products.find(item => String(item.id) === id);
        if (!product) return;
        const isSelected = selected.has(id);
        const selectedIndex = searchSettings.popularProducts.indexOf(id);
        const productIndex = allRows.indexOf(row);
        let dragHandle = row.querySelector(".search-product-drag");
        if (isSelected && !dragHandle) {
            row.insertAdjacentHTML("afterbegin", '<span class="search-product-drag is-position" draggable="true" aria-hidden="true"></span>');
            dragHandle = row.querySelector(".search-product-drag");
        } else if (!isSelected && dragHandle) dragHandle.remove();
        row.classList.toggle("selected", isSelected);
        row.draggable = isSelected;
        row.dataset.index = isSelected ? String(selectedIndex) : "";
        row.style.order = String(isSelected ? selectedIndex : 1000 + productIndex);
        if (dragHandle) dragHandle.textContent = String(selectedIndex + 1);
        const small = row.querySelector("small");
        if (small) small.textContent = isSelected ? `Selected · position ${selectedIndex + 1}` : (categoryLabels[productCategory(product)] || "Products");
        const button = row.querySelector("[data-toggle]");
        const icon = button?.querySelector("img");
        if (!button || !icon) return;
        const limitReached = !isSelected && atLimit;
        button.classList.toggle("is-limit-reached", limitReached);
        if (limitReached) button.setAttribute("aria-disabled", "true");
        else button.removeAttribute("aria-disabled");
        button.setAttribute("aria-label", isSelected ? `Remove ${product.title}` : limitReached ? "Popular Picks limit reached" : `Add ${product.title}`);
        icon.src = `images/Icon Folder/${isSelected ? "Tick Icon_White.PNG" : limitReached ? "Plus Icon_Light Gray.PNG" : "Plus Icon_Gray.PNG"}`;
    });
    if (renderPreview) renderSearchPopularPreview();
}

function initializeSearchPopularReorder() {
    const list = $("#search-popular-products");
    if (!list) return;
    let drag = null;

    const selectedRows = () => $$("#search-popular-products .search-product-row.selected")
        .sort((first, second) => (Number(first.dataset.index) || 0) - (Number(second.dataset.index) || 0));
    const clearTargets = () => selectedRows().forEach(row => row.classList.remove("is-drop-target", "is-making-space"));
    const rowForId = id => selectedRows().find(row => row.dataset.id === String(id));
    const animateRows = mutate => {
        const rows = selectedRows();
        const before = new Map(rows.map(row => [row, row.getBoundingClientRect()]));
        mutate();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        rows.forEach(row => {
            const start = before.get(row);
            if (!start) return;
            const end = row.getBoundingClientRect();
            const dx = start.left - end.left;
            const dy = start.top - end.top;
            if (!dx && !dy) return;
            row.animate([
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "translate(0, 0)" }
            ], { duration: 90, easing: "cubic-bezier(.2,.8,.2,1)" });
        });
    };
    const movePreview = event => {
        if (!drag?.preview || !event.clientX || !event.clientY) return;
        drag.preview.style.transform = `translate3d(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px, 0)`;
    };
    const createPreview = (row, event) => {
        const rect = row.getBoundingClientRect();
        const preview = row.cloneNode(true);
        preview.classList.remove("dragging", "is-making-space", "is-drop-target");
        preview.classList.add("search-product-drag-preview");
        preview.removeAttribute("draggable");
        Object.assign(preview.style, {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`
        });
        document.body.appendChild(preview);
        drag.offsetX = event.clientX || event.clientY ? event.clientX - rect.left : rect.width / 2;
        drag.offsetY = event.clientX || event.clientY ? event.clientY - rect.top : rect.height / 2;
        drag.preview = preview;
        movePreview(event);
    };
    const nearestTarget = event => {
        const directRow = event.target.closest(".search-product-row.selected");
        if (directRow && directRow !== drag?.row) {
            const rect = directRow.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const horizontal = Math.abs(event.clientX - centerX) > Math.abs(event.clientY - centerY);
            return { row: directRow, placeAfter: horizontal ? event.clientX > centerX : event.clientY > centerY };
        }
        if (directRow === drag?.row) return null;
        let nearest = null;
        selectedRows().forEach(row => {
            if (row === drag?.row) return;
            const rect = row.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
            if (!nearest || distance < nearest.distance) nearest = { row, centerX, centerY, distance };
        });
        if (!nearest) return null;
        const horizontal = Math.abs(event.clientX - nearest.centerX) > Math.abs(event.clientY - nearest.centerY);
        return { row: nearest.row, placeAfter: horizontal ? event.clientX > nearest.centerX : event.clientY > nearest.centerY };
    };
    const swapPopularIds = (firstId, secondId) => {
        const firstIndex = searchSettings.popularProducts.indexOf(String(firstId));
        const secondIndex = searchSettings.popularProducts.indexOf(String(secondId));
        if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return;
        [searchSettings.popularProducts[firstIndex], searchSettings.popularProducts[secondIndex]] = [searchSettings.popularProducts[secondIndex], searchSettings.popularProducts[firstIndex]];
    };
    const markDropTarget = target => {
        clearTargets();
        if (target?.row && target.row !== drag?.row) target.row.classList.add("is-drop-target");
    };
    const previewSwapTarget = target => {
        if (!drag || !target?.row || target.row === drag.row) return;
        const targetId = target.row.dataset.id;
        const currentOrder = searchSettings.popularProducts.join("|");
        const nextPreviewKey = `${targetId || "empty"}:${currentOrder}`;
        if (drag.previewTarget === nextPreviewKey) return;
        drag.previewTarget = nextPreviewKey;
        markDropTarget(target);
        animateRows(() => {
            swapPopularIds(drag.id, targetId);
            syncSearchPopularSelectedRows({ renderPreview: false });
            drag.row = rowForId(drag.id) || drag.row;
        });
    };
    const restoreOriginalOrder = () => {
        if (!drag) return;
        searchSettings.popularProducts = [...drag.originalIds];
        syncSearchPopularSelectedRows({ renderPreview: false });
        drag.row = rowForId(drag.id) || drag.row;
    };
    const clearDragState = () => {
        if (!drag) return;
        if (!drag.committed) animateRows(restoreOriginalOrder);
        clearTargets();
        drag.preview?.remove();
        drag.row?.classList.remove("dragging");
        list.classList.remove("is-reordering");
        drag = null;
    };

    list.addEventListener("dragstart", event => {
        if (searchSettings.popularMode !== "manual") return event.preventDefault();
        if (event.target.closest("[data-toggle]")) return event.preventDefault();
        const row = event.target.closest(".search-product-row.selected");
        if (!row) return event.preventDefault();
        if (drag) return event.preventDefault();
        drag = { row, id: row.dataset.id, originalIds: [...searchSettings.popularProducts], previewTarget: null, committed: false, preview: null, offsetX: 0, offsetY: 0 };
        createPreview(row, event);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", drag.id || "");
        event.dataTransfer.setDragImage(transparentDragImage(), 0, 0);
        requestAnimationFrame(() => {
            row.classList.add("dragging");
            list.classList.add("is-reordering");
        });
    });
    list.addEventListener("dragover", event => {
        if (!drag || searchSettings.popularMode !== "manual") return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
    });
    list.addEventListener("drag", event => {
        if (!drag) return;
        movePreview(event);
    });
    list.addEventListener("dragleave", event => {
        if (!drag || list.contains(event.relatedTarget)) return;
        clearTargets();
    });
    list.addEventListener("drop", event => {
        if (!drag) return;
        event.preventDefault();
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
        syncSearchPopularSelectedRows({ renderPreview: false });
        drag.committed = true;
        clearDragState();
    });
    list.addEventListener("dragend", clearDragState);
}

function normalizeSearchList(value, fallback = [], limit = 20) {
    const source = Array.isArray(value) ? value : fallback;
    const seen = new Set();
    return source.map(item => String(item || "").trim().replace(/\s+/g, " "))
        .filter(item => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()))
        .slice(0, limit);
}

function normalizeSearchSynonyms(value) {
    const source = Array.isArray(value) ? value : DEFAULT_SEARCH_SYNONYMS;
    return source.map(rule => ({
        term: String(rule?.term || "").trim().replace(/\s+/g, " "),
        synonyms: normalizeSearchList(rule?.synonyms || [], [], 8)
    })).filter(rule => rule.term && rule.synonyms.length).slice(0, 30);
}

function parseSearchTermsTextarea(value, fallback = []) {
    return normalizeSearchList(String(value || "").split(/\n+/), fallback, 20);
}

function hiddenTrendingSet() {
    return new Set(normalizeSearchList(searchSettings.trendingHiddenSearches || [], [], 20).map(item => item.toLowerCase()));
}

function visibleTrendingSearches() {
    const hidden = hiddenTrendingSet();
    return searchSettings.trendingSearches.filter(label => !hidden.has(String(label).toLowerCase()));
}

function analyticsSearchKey(value) {
    return String(value || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function productForSearchTerm(label) {
    const normalized = String(label || "").toLowerCase();
    return products.find(product => isStorefrontActive(product) && `${product.title} ${categoryLabels[productCategory(product)] || ""} ${product.category || ""}`.toLowerCase().includes(normalized))
        || products.find(product => isStorefrontActive(product) && normalized.split(/\s+/).some(term => term.length > 2 && `${product.title} ${categoryLabels[productCategory(product)] || ""}`.toLowerCase().includes(term)));
}

function trendInsightFor(label, index) {
    const normalized = analyticsSearchKey(label);
    const insight = [...(searchInsights?.queries || []), ...(searchInsights?.topQueries || [])].find(item => analyticsSearchKey(item.query) === normalized);
    const clickRate = Number(insight?.clickRate) || 0;
    const purchases = Number(insight?.purchases) || 0;
    const revenue = Number(insight?.revenue) || 0;
    const conversion = insight
        ? purchases ? `${purchases} purchase${purchases === 1 ? "" : "s"} · ${formatMoney(revenue)}` : clickRate > 0 ? `${clickRate}% product clicks` : "No clicks yet"
        : "No search data";
    return {
        searches: Number(insight?.searches) || 0,
        trend: insight?.trendPercent,
        category: insight?.suggestedLink?.label || "No click data",
        conversion,
        hasInsight: Boolean(insight),
        clickRate,
        purchases,
        revenue,
        zeroResultRate: Number(insight?.zeroResultRate) || 0
    };
}

function formatSearchVolume(value) {
    const number = Number(value) || 0;
    if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1).replace(/\.0$/, "")}k searches`;
    return `${number} searches`;
}

function renderTrendingManager() {
    const list = $("#search-trending-list");
    if (!list) return;
    const hidden = hiddenTrendingSet();
    const visibleLimit = 5;
    const allTerms = searchSettings.trendingSearches;
    const hiddenCount = Math.max(0, allTerms.length - visibleLimit);
    const displayedTerms = searchTrendingExpanded ? allTerms : allTerms.slice(0, visibleLimit);
    const moreRow = hiddenCount > 0
        ? `<tr class="search-trending-more-row"><td colspan="9"><button type="button" data-trending-more aria-expanded="${searchTrendingExpanded}"><span>${searchTrendingExpanded ? "Show less" : "More"}</span><small>${searchTrendingExpanded ? "Hide extra search terms" : `${hiddenCount} more search term${hiddenCount === 1 ? "" : "s"}`}</small></button></td></tr>`
        : "";
    list.innerHTML = displayedTerms.map(label => {
        const index = allTerms.indexOf(label);
        const insight = trendInsightFor(label, index);
        const isVisible = !hidden.has(String(label).toLowerCase());
        const trendClass = Number(insight.trend) < 0 ? "down" : "up";
        const trendLabel = !insight.hasInsight ? "No data" : insight.trend === null || insight.trend === undefined ? "New" : `${Number(insight.trend) < 0 ? "" : "+"}${insight.trend}%`;
        return `
            <tr class="${isVisible ? "" : "is-hidden"}" draggable="true" data-index="${index}" data-label="${escapeHtml(label)}">
                <td><span class="search-trending-drag" aria-hidden="true"><img src="images/Icon Folder/Menu Bar Icon_Gray.PNG" alt=""></span></td>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(label)}</strong></td>
                <td><span class="search-trend-pill ${trendClass}">${trendLabel}</span></td>
                <td>${escapeHtml(formatSearchVolume(insight.searches))}</td>
                <td>${escapeHtml(insight.conversion)}</td>
                <td><span class="search-trending-link-pill">${escapeHtml(insight.category)}</span></td>
                <td><label class="toggle-row search-trending-row-toggle"><input type="checkbox" data-trending-visible ${isVisible ? "checked" : ""}><span class="toggle-control"></span></label></td>
                <td><div class="search-trending-actions"><button type="button" data-trending-remove aria-label="Remove ${escapeHtml(label)}"><img src="images/Icon Folder/Delete Icon_Gray.PNG" alt=""></button></div></td>
            </tr>
        `;
    }).join("") + moreRow || '<tr><td colspan="9"><p class="search-setting-empty">No trending searches added.</p></td></tr>';
    const previewHeading = $("#search-trending-preview-heading");
    const previewChips = $("#search-trending-preview-chips");
    const previewList = $("#search-trending-preview-list");
    if (previewHeading && previewChips && previewList) {
        const visible = visibleTrendingSearches();
        previewHeading.textContent = searchSettings.trendingHeading;
        previewHeading.hidden = searchSettings.trendingEnabled === false;
        previewChips.hidden = searchSettings.trendingEnabled === false;
        previewList.hidden = searchSettings.trendingEnabled === false;
        previewChips.innerHTML = visible.slice(0, 4).map(label => `<span>↗ ${escapeHtml(label)}</span>`).join("");
        previewList.innerHTML = visible.slice(0, 6).map(label => `<div><span>⌕</span><strong>${escapeHtml(label)}</strong><span>›</span></div>`).join("") || '<p class="search-setting-empty">No visible trends.</p>';
    }
}

function createSearchReorderState({ list, rowSelector, handleSelector, getItems, setItems, afterCommit, direction = "vertical" }) {
    let drag = null;
    const rows = () => [...list.querySelectorAll(rowSelector)];
    const clearTargets = () => rows().forEach(row => row.classList.remove("is-drop-target"));
    const nearestDropTarget = event => {
        let nearest = null;
        rows().forEach(row => {
            if (row === drag?.row) return;
            const rect = row.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
            if (!nearest || distance < nearest.distance) nearest = { row, rect, centerX, centerY, distance };
        });
        if (!nearest) return null;
        const horizontal = direction === "grid" && Math.abs(event.clientX - nearest.centerX) > Math.abs(event.clientY - nearest.centerY);
        return {
            row: nearest.row,
            placeAfter: horizontal ? event.clientX > nearest.centerX : event.clientY > nearest.centerY
        };
    };
    const finish = event => {
        if (!drag) return;
        if (drag.handle.hasPointerCapture?.(event.pointerId)) drag.handle.releasePointerCapture(event.pointerId);
        const nextItems = rows().map(row => drag.original[Number(row.dataset.index)]).filter(item => item !== undefined);
        setItems(nextItems);
        drag.row.classList.remove("dragging");
        rows().forEach(row => row.classList.remove("is-drop-target", "is-making-space"));
        list.classList.remove("is-reordering");
        drag = null;
        afterCommit?.();
        renderSearchSettings();
    };
    list.addEventListener("pointerdown", event => {
        const handle = event.target.closest(handleSelector);
        const row = handle?.closest(rowSelector);
        if (!handle || !row) return;
        event.preventDefault();
        drag = { row, handle, original: [...getItems()] };
        row.classList.add("dragging");
        rows().forEach(item => item.classList.toggle("is-making-space", item !== row));
        list.classList.add("is-reordering");
        handle.setPointerCapture?.(event.pointerId);
    });
    list.addEventListener("pointermove", event => {
        if (!drag) return;
        event.preventDefault();
        const target = nearestDropTarget(event);
        if (!target || target.row.parentElement !== drag.row.parentElement) return;
        clearTargets();
        target.row.classList.add("is-drop-target");
        target.row.parentElement.insertBefore(drag.row, target.placeAfter ? target.row.nextSibling : target.row);
    });
    list.addEventListener("pointerleave", event => {
        if (!drag || list.contains(event.relatedTarget)) return;
        clearTargets();
    });
    list.addEventListener("pointerup", finish);
    list.addEventListener("pointercancel", finish);
}

function initializeSearchTrendingReorder() {
    const list = $("#search-trending-list");
    if (!list) return;
    let drag = null;

    const rows = () => $$("#search-trending-list tr[data-index]");
    const clearTargets = () => rows().forEach(row => row.classList.remove("is-drop-target", "is-making-space"));
    const rowOrder = () => rows().map(row => row.dataset.label).filter(label => label !== undefined);
    const reindexRows = () => {
        rows().forEach((row, index) => {
            row.dataset.index = String(index);
            const positionCell = row.children[1];
            if (positionCell) positionCell.textContent = String(index + 1);
        });
    };
    const updateTrendingPreview = () => {
        const previewChips = $("#search-trending-preview-chips");
        const previewList = $("#search-trending-preview-list");
        if (!previewChips || !previewList) return;
        const visible = visibleTrendingSearches();
        previewChips.innerHTML = visible.slice(0, 4).map(label => `<span>↗ ${escapeHtml(label)}</span>`).join("");
        previewList.innerHTML = visible.slice(0, 6).map(label => `<div><span>⌕</span><strong>${escapeHtml(label)}</strong><span>›</span></div>`).join("") || '<p class="search-setting-empty">No visible trends.</p>';
    };
    const animateRows = mutate => {
        const items = rows();
        const before = new Map(items.map(row => [row, row.getBoundingClientRect()]));
        mutate();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        items.forEach(row => {
            const start = before.get(row);
            if (!start) return;
            const end = row.getBoundingClientRect();
            const dx = start.left - end.left;
            const dy = start.top - end.top;
            if (!dx && !dy) return;
            row.animate([
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "translate(0, 0)" }
            ], { duration: 90, easing: "cubic-bezier(.2,.8,.2,1)" });
        });
    };
    const movePreview = event => {
        if (!drag?.preview || !event.clientX || !event.clientY) return;
        drag.preview.style.transform = `translate3d(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px, 0)`;
    };
    const createPreview = (row, event) => {
        const rect = row.getBoundingClientRect();
        const table = document.createElement("table");
        const tbody = document.createElement("tbody");
        const previewRow = row.cloneNode(true);
        previewRow.classList.remove("dragging", "is-making-space", "is-drop-target");
        [...row.children].forEach((cell, index) => {
            const previewCell = previewRow.children[index];
            if (previewCell) previewCell.style.width = `${cell.getBoundingClientRect().width}px`;
        });
        table.className = "search-trending-table search-trending-drag-preview";
        table.setAttribute("aria-hidden", "true");
        tbody.append(previewRow);
        table.append(tbody);
        Object.assign(table.style, {
            width: `${rect.width}px`,
            minWidth: `${rect.width}px`,
            height: `${rect.height}px`,
            transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`
        });
        document.body.appendChild(table);
        drag.offsetX = event.clientX || event.clientY ? event.clientX - rect.left : rect.width / 2;
        drag.offsetY = event.clientX || event.clientY ? event.clientY - rect.top : rect.height / 2;
        drag.preview = table;
        movePreview(event);
    };
    const nearestTarget = event => {
        const directRow = event.target.closest("tr[data-index]");
        if (directRow && directRow !== drag?.row) {
            const rect = directRow.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            return { row: directRow, placeAfter: event.clientY > centerY };
        }
        if (directRow === drag?.row) return null;
        let nearest = null;
        rows().forEach(row => {
            if (row === drag?.row) return;
            const rect = row.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
            if (!nearest || distance < nearest.distance) nearest = { row, centerY, distance };
        });
        if (!nearest) return null;
        return { row: nearest.row, placeAfter: event.clientY > nearest.centerY };
    };
    const restoreOriginalOrder = () => {
        if (!drag) return;
        drag.originalLabels.forEach(label => {
            const row = rows().find(item => item.dataset.label === label);
            if (row) list.append(row);
        });
        reindexRows();
    };
    const swapRows = (first, second) => {
        if (!first || !second || first === second) return;
        const marker = document.createTextNode("");
        first.before(marker);
        second.before(first);
        marker.replaceWith(second);
    };
    const markDropTarget = target => {
        clearTargets();
        if (target?.row && target.row !== drag?.row) target.row.classList.add("is-drop-target");
    };
    const previewSwapTarget = target => {
        if (!drag || !target?.row || target.row === drag.row) return;
        const currentOrder = rowOrder().join("|");
        const nextPreviewKey = `${target.row.dataset.label || "empty"}:${currentOrder}`;
        if (drag.previewTarget === nextPreviewKey) return;
        drag.previewTarget = nextPreviewKey;
        markDropTarget(target);
        animateRows(() => {
            swapRows(drag.row, target.row);
            reindexRows();
        });
    };
    const commitDropTarget = () => {
        if (!drag) return;
        const hidden = hiddenTrendingSet();
        const orderedVisible = rowOrder();
        const orderedSet = new Set(orderedVisible.map(item => item.toLowerCase()));
        const remaining = searchSettings.trendingSearches.filter(item => !orderedSet.has(String(item).toLowerCase()));
        searchSettings.trendingSearches = [...orderedVisible, ...remaining];
        searchSettings.trendingHiddenSearches = searchSettings.trendingSearches.filter(item => hidden.has(item.toLowerCase()));
        reindexRows();
        updateTrendingPreview();
    };
    const clearDragState = () => {
        if (!drag) return;
        if (!drag.committed) animateRows(restoreOriginalOrder);
        clearTargets();
        drag.preview?.remove();
        drag.row.classList.remove("dragging");
        list.classList.remove("is-reordering");
        drag = null;
    };

    list.addEventListener("dragstart", event => {
        if (event.target.closest("button,input,label,.toggle-row")) return event.preventDefault();
        const row = event.target.closest("tr[data-index]");
        if (!row) return event.preventDefault();
        if (drag) return event.preventDefault();
        drag = { row, originalLabels: rowOrder(), previewTarget: null, committed: false, preview: null, offsetX: 0, offsetY: 0 };
        createPreview(row, event);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.dataset.label || "");
        event.dataTransfer.setDragImage(transparentDragImage(), 0, 0);
        requestAnimationFrame(() => {
            row.classList.add("dragging");
            list.classList.add("is-reordering");
        });
    });
    list.addEventListener("dragover", event => {
        if (!drag) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
    });
    list.addEventListener("drag", event => {
        if (!drag) return;
        movePreview(event);
    });
    list.addEventListener("dragleave", event => {
        if (!drag || list.contains(event.relatedTarget)) return;
        clearTargets();
    });
    list.addEventListener("drop", event => {
        if (!drag) return;
        event.preventDefault();
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
        commitDropTarget();
        drag.committed = true;
        clearDragState();
    });
    list.addEventListener("dragend", clearDragState);
}

function initializeSearchSuggestionReorder() {
    const list = $("#search-suggestion-list");
    if (!list) return;
    let drag = null;

    const rows = () => $$("#search-suggestion-list .search-suggestion-row");
    const clearTargets = () => rows().forEach(row => row.classList.remove("is-drop-target", "is-making-space"));
    const rowOrder = () => rows().map(row => row.dataset.label).filter(label => label !== undefined);
    const reindexRows = () => {
        rows().forEach((row, index) => {
            row.dataset.index = String(index);
        });
    };
    const updateSuggestionPreview = () => {
        const previewChips = $("#search-preview-chips");
        if (!previewChips) return;
        previewChips.innerHTML = searchSettings.suggestions.map(label => `<button class="search-chip" type="button" tabindex="-1" aria-disabled="true">${escapeHtml(label)}</button>`).join("");
    };
    const animateRows = mutate => {
        const items = rows();
        const before = new Map(items.map(row => [row, row.getBoundingClientRect()]));
        mutate();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        items.forEach(row => {
            const start = before.get(row);
            if (!start) return;
            const end = row.getBoundingClientRect();
            const dx = start.left - end.left;
            const dy = start.top - end.top;
            if (!dx && !dy) return;
            row.animate([
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "translate(0, 0)" }
            ], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
        });
    };
    const movePreview = event => {
        if (!drag?.preview || !event.clientX || !event.clientY) return;
        drag.preview.style.transform = `translate3d(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px, 0)`;
    };
    const createPreview = (row, event) => {
        const rect = row.getBoundingClientRect();
        const preview = row.cloneNode(true);
        preview.classList.remove("dragging", "is-making-space", "is-drop-target");
        preview.classList.add("search-suggestion-drag-preview");
        preview.removeAttribute("draggable");
        Object.assign(preview.style, {
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`
        });
        document.body.appendChild(preview);
        drag.offsetX = event.clientX || event.clientY ? event.clientX - rect.left : rect.width / 2;
        drag.offsetY = event.clientX || event.clientY ? event.clientY - rect.top : rect.height / 2;
        drag.preview = preview;
        movePreview(event);
    };
    const nearestTarget = event => {
        const directRow = event.target.closest(".search-suggestion-row");
        if (directRow && directRow !== drag?.row) {
            const rect = directRow.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const horizontal = Math.abs(event.clientX - centerX) > Math.abs(event.clientY - centerY);
            return { row: directRow, placeAfter: horizontal ? event.clientX > centerX : event.clientY > centerY };
        }
        if (directRow === drag?.row) return null;
        let nearest = null;
        rows().forEach(row => {
            if (row === drag?.row) return;
            const rect = row.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
            if (!nearest || distance < nearest.distance) nearest = { row, centerX, centerY, distance };
        });
        if (!nearest) return null;
        const horizontal = Math.abs(event.clientX - nearest.centerX) > Math.abs(event.clientY - nearest.centerY);
        return { row: nearest.row, placeAfter: horizontal ? event.clientX > nearest.centerX : event.clientY > nearest.centerY };
    };
    const restoreOriginalOrder = () => {
        if (!drag) return;
        drag.originalLabels.forEach(label => {
            const row = rows().find(item => item.dataset.label === label);
            if (row) list.append(row);
        });
        reindexRows();
    };
    const swapRows = (first, second) => {
        if (!first || !second || first === second) return;
        const marker = document.createTextNode("");
        first.before(marker);
        second.before(first);
        marker.replaceWith(second);
    };
    const markDropTarget = target => {
        clearTargets();
        if (target?.row && target.row !== drag?.row) target.row.classList.add("is-drop-target", "is-making-space");
    };
    const previewSwapTarget = target => {
        if (!drag || !target?.row || target.row === drag.row) return;
        const currentOrder = rowOrder().join("|");
        const nextPreviewKey = `${target.row.dataset.label || "empty"}:${currentOrder}`;
        if (drag.previewTarget === nextPreviewKey) return;
        drag.previewTarget = nextPreviewKey;
        markDropTarget(target);
        animateRows(() => {
            swapRows(drag.row, target.row);
            reindexRows();
        });
    };
    const commitDropTarget = () => {
        if (!drag) return;
        searchSettings.suggestions = rowOrder();
        reindexRows();
        updateSuggestionPreview();
    };
    const clearDragState = () => {
        if (!drag) return;
        if (!drag.committed) animateRows(restoreOriginalOrder);
        clearTargets();
        drag.preview?.remove();
        drag.row.classList.remove("dragging");
        list.classList.remove("is-reordering");
        drag = null;
    };

    list.addEventListener("dragstart", event => {
        if (event.target.closest("[data-remove]")) return event.preventDefault();
        const row = event.target.closest(".search-suggestion-row");
        if (!row) return event.preventDefault();
        if (drag) return event.preventDefault();
        drag = { row, originalLabels: rowOrder(), previewTarget: null, committed: false, preview: null, offsetX: 0, offsetY: 0 };
        createPreview(row, event);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.dataset.label || "");
        event.dataTransfer.setDragImage(transparentDragImage(), 0, 0);
        requestAnimationFrame(() => {
            row.classList.add("dragging");
            list.classList.add("is-reordering");
        });
    });
    list.addEventListener("dragover", event => {
        if (!drag) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
    });
    list.addEventListener("drag", event => {
        if (!drag) return;
        movePreview(event);
    });
    list.addEventListener("dragleave", event => {
        if (!drag || list.contains(event.relatedTarget)) return;
        clearTargets();
    });
    list.addEventListener("drop", event => {
        if (!drag) return;
        event.preventDefault();
        movePreview(event);
        const target = nearestTarget(event);
        if (target) previewSwapTarget(target);
        commitDropTarget();
        drag.committed = true;
        clearDragState();
    });
    list.addEventListener("dragend", clearDragState);
}

function renderSearchSynonyms() {
    const list = $("#search-synonym-list");
    if (!list) return;
    list.innerHTML = searchSettings.synonyms.map((rule, index) => {
        const term = escapeHtml(rule.term || "");
        const chips = (rule.synonyms || []).map((label, synonymIndex) => `
            <button class="search-synonym-chip" type="button" data-remove-synonym="${synonymIndex}" aria-label="Remove ${escapeHtml(label)} from ${term || "this rule"}">
                <span>${escapeHtml(label)}</span>
                <img src="images/Icon Folder/Close Icon_Gray.PNG" alt="">
            </button>
        `).join("");
        const addControl = activeSynonymAddIndex === index
            ? `<form class="search-synonym-add-form" data-synonym-add-form><input data-synonym-add-input maxlength="40" placeholder="Add synonym" aria-label="New connected search"><button type="submit">Add</button></form>`
            : `<button class="search-add-synonym-chip" type="button" data-add-synonym><img src="images/Icon Folder/Plus Icon_E5A484.PNG" alt="">Add synonym</button>`;
        return `
            <div class="search-synonym-rule" data-index="${index}">
                <label class="search-synonym-term-field">
                    <span>Primary term</span>
                    <input data-synonym-term maxlength="40" value="${term}" placeholder="Primary term">
                </label>
                <div class="search-synonym-connected">
                    ${chips}
                    ${addControl}
                </div>
                <button class="search-delete-synonym-rule" type="button" data-delete-synonym-rule aria-label="Delete synonym rule" title="Delete synonym rule">
                    <img src="images/Icon Folder/Delete Icon_Black.PNG" alt="">
                </button>
            </div>
        `;
    }).join("") || '<p class="search-setting-empty">No synonym rules added.</p>';
    if (activeSynonymAddIndex !== null) {
        requestAnimationFrame(() => $("#search-synonym-list [data-synonym-add-input]")?.focus());
    }
}

function normalizeSearchRules(value) {
    return (Array.isArray(value) ? value : []).map(rule => ({
        query: String(rule?.query || "").trim().replace(/\s+/g, " ").slice(0, 40),
        targetType: rule?.targetType === "category" ? "category" : "product",
        targetId: String(rule?.targetId || "").trim()
    })).filter(rule => rule.query && rule.targetId).slice(0, 30);
}

function searchRuleTargetLabel(rule) {
    if (rule.targetType === "category") return categories.find(category => category.slug === rule.targetId)?.label || rule.targetId;
    return products.find(product => String(product.id) === rule.targetId)?.title || "Unavailable product";
}

function populateSearchRuleTargets() {
    const select = $("#search-rule-target");
    if (!select || select.options.length) return;
    const categoryGroup = document.createElement("optgroup");
    categoryGroup.label = "Categories";
    categories.forEach(category => categoryGroup.append(new Option(category.label, `category:${category.slug}`)));
    const productGroup = document.createElement("optgroup");
    productGroup.label = "Products";
    products.filter(isStorefrontActive).forEach(product => productGroup.append(new Option(product.title, `product:${product.id}`)));
    select.append(categoryGroup, productGroup);
    enhanceManagementSelect(select);
}

function renderSearchInsights() {
    if (!searchInsights) return;
    const totalSearches = Number(searchInsights.totalSearches) || 0;
    const clickRate = Math.min(100, Number(searchInsights.clickRate) || 0);
    const purchases = Number(searchInsights.totalPurchases) || 0;
    const revenue = Number(searchInsights.attributedRevenue) || 0;
    const zeroResults = Number(searchInsights.zeroResultSearches) || 0;
    const uniqueQueries = Number(searchInsights.uniqueQueries) || 0;
    const metrics = [
        { label: "Searches", value: String(totalSearches), icon: "Search Icon_E5A484.PNG", trend: "12%", tone: "positive" },
        { label: "Product clicks", value: `${clickRate}%`, icon: "Password Visible Icon_E5A484.PNG", trend: "0%", tone: "neutral" },
        { label: "Purchases", value: String(purchases), icon: "Purchased Icon_E5A484.PNG", trend: "0%", tone: "neutral" },
        { label: "Revenue", value: formatMoney(revenue), icon: "Credit Card 2_E5A484.PNG", trend: "0%", tone: "neutral" },
        { label: "No-result searches", value: String(zeroResults), icon: "X Icon_E5A484.PNG", trend: zeroResults ? "100%" : "0%", tone: zeroResults ? "negative" : "neutral" },
        { label: "Unique searches", value: String(uniqueQueries), icon: "Customers Icon_E5A484.PNG", trend: "22%", tone: "positive" }
    ];
    $("#search-insight-stats").innerHTML = metrics.map(metric => `
        <div class="search-insight-stat">
            <span class="search-insight-stat-icon"><img src="images/Icon Folder/${metric.icon}" alt=""></span>
            <strong>${escapeHtml(metric.value)}</strong>
            <span>${escapeHtml(metric.label)}</span>
            <small class="${metric.tone}">${metric.tone === "positive" ? "+" : metric.tone === "negative" ? "!" : ""} ${escapeHtml(metric.trend)} <em>vs previous 30 days</em></small>
        </div>
    `).join("");
    $("#search-activity-chart").innerHTML = searchActivityChartMarkup(totalSearches, zeroResults);
    renderSearchQueryTable("#search-top-queries", searchInsights.topQueries, "No search activity yet.", "searches");
    renderSearchQueryTable("#search-zero-queries", searchInsights.zeroResultQueries, "No unsuccessful searches.", "zeroResults", true);
}

function searchActivityChartMarkup(totalSearches, zeroResults) {
    const days = 30;
    const base = Array.from({ length: days }, (_, index) => {
        const wave = Math.max(0, Math.sin((index + 1) * .9) * 2.2);
        const pulse = index % 6 === 4 ? 3 : index % 11 === 0 ? 2 : 0;
        return Math.round(wave + pulse);
    });
    const baseTotal = base.reduce((sum, value) => sum + value, 0) || 1;
    let remaining = Math.max(0, Math.round(totalSearches));
    const searchValues = base.map((value, index) => {
        if (index === days - 1) return remaining;
        const scaled = Math.min(remaining, Math.round((value / baseTotal) * totalSearches));
        remaining -= scaled;
        return scaled;
    });
    const noResultValues = Array.from({ length: days }, () => 0);
    const noResultCount = Math.min(days, Math.max(0, Math.round(zeroResults)));
    for (let index = 0; index < noResultCount; index += 1) {
        noResultValues[Math.max(0, days - 5 - (index * 7))] += 1;
    }
    const maxValue = Math.max(10, ...searchValues, ...noResultValues);
    const width = 920;
    const height = 210;
    const pad = { left: 36, right: 16, top: 14, bottom: 34 };
    const x = index => pad.left + (index / (days - 1)) * (width - pad.left - pad.right);
    const y = value => pad.top + (1 - (value / maxValue)) * (height - pad.top - pad.bottom);
    const line = values => values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const area = values => `${pad.left},${height - pad.bottom} ${line(values)} ${width - pad.right},${height - pad.bottom}`;
    const yTicks = [0, Math.ceil(maxValue / 2), maxValue];
    const xTicks = [0, 4, 9, 14, 19, 24, 29];
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${totalSearches} searches and ${zeroResults} no-result searches in the last 30 days">
        <defs><linearGradient id="searchChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e57f58" stop-opacity=".22"/><stop offset="1" stop-color="#e57f58" stop-opacity="0"/></linearGradient></defs>
        ${yTicks.map(value => `<g><line x1="${pad.left}" y1="${y(value).toFixed(1)}" x2="${width - pad.right}" y2="${y(value).toFixed(1)}"></line><text x="4" y="${(y(value) + 4).toFixed(1)}">${value}</text></g>`).join("")}
        ${xTicks.map(index => `<text class="x-label" x="${x(index).toFixed(1)}" y="${height - 10}">Mar ${index + 1}</text>`).join("")}
        <polygon points="${area(searchValues)}" class="search-chart-area"></polygon>
        <polyline points="${line(searchValues)}" class="search-chart-line"></polyline>
        <polyline points="${line(noResultValues)}" class="search-chart-line is-empty"></polyline>
        ${searchValues.map((value, index) => `<circle cx="${x(index).toFixed(1)}" cy="${y(value).toFixed(1)}" r="3"></circle>`).join("")}
    </svg>`;
}

function renderSearchQueryTable(selector, items, emptyText, metric, issueMode = false) {
    const rows = (items || []).slice(0, 8);
    if (!rows.length) {
        $(selector).innerHTML = `<p class="search-setting-empty">${emptyText}</p>`;
        return;
    }
    const max = Math.max(1, ...rows.map(item => Number(item[metric]) || 0));
    $(selector).innerHTML = `
        <div class="search-query-table">
            <div class="search-query-table-head"><span>#</span><span>Search term</span><span>${issueMode ? "Issues" : "Searches"}</span></div>
            ${rows.map((item, index) => {
                const value = Number(item[metric]) || 0;
                const width = Math.max(8, Math.round((value / max) * 100));
                return `<div class="search-query-row">
                    <span class="search-query-rank">${index + 1}</span>
                    <span class="search-query-term">${escapeHtml(item.query)}</span>
                    ${issueMode
                        ? `<strong class="search-query-issue">${value} no-result search${value === 1 ? "" : "es"}</strong>`
                        : `<span class="search-query-volume"><i style="width:${width}%"></i></span><strong>${value}</strong>`}
                </div>`;
            }).join("")}
        </div>
    `;
}

function renderSearchSettings() {
    if (!$("#search-suggestion-list")) return;
    populateSearchRuleTargets();
    renderSearchInsights();
    $("#search-suggestions-enabled").checked = searchSettings.suggestionsEnabled;
    $("#search-popular-enabled").checked = searchSettings.popularEnabled !== false;
    $("#search-popular-automatic").checked = searchSettings.popularMode === "automatic";
    $("#search-suggestions-heading").value = searchSettings.suggestionsHeading;
    $("#search-popular-heading").value = searchSettings.popularHeading;
    $("#search-default-sort").value = searchSettings.defaultSort;
    $("#search-trending-enabled").checked = searchSettings.trendingEnabled !== false;
    $("#search-trending-auto").checked = searchSettings.trendingAutoRefresh === true;
    $("#search-trending-heading").value = searchSettings.trendingHeading;
    renderSearchSynonyms();
    renderTrendingManager();
    $("#search-empty-fallback").value = searchSettings.emptyFallback;
    $("#search-empty-fallback").managementPickerSync?.();
    $("#search-empty-message").value = searchSettings.emptyMessage;
    $("#search-autocomplete-enabled").checked = searchSettings.autocompleteEnabled;
    $("#search-autocomplete-categories").checked = searchSettings.autocompleteCategories;
    $("#search-autocomplete-products").checked = searchSettings.autocompleteProducts;
    $("#search-autocomplete-product-limit").value = String(searchSettings.autocompleteProductLimit);
    $("#search-autocomplete-product-limit").managementPickerSync?.();
    $("#search-typo-enabled").checked = searchSettings.typoEnabled;
    $("#search-typo-strength").value = searchSettings.typoStrength;
    $("#search-typo-strength").managementPickerSync?.();
    $(".search-autocomplete-toggle-label").textContent = searchSettings.autocompleteEnabled ? "On" : "Off";
    $(".search-typo-toggle-label").textContent = searchSettings.typoEnabled ? "On" : "Off";
    $("#search-rule-list").innerHTML = searchSettings.searchRules.map((rule, index) => `<div class="search-rule-row" data-index="${index}"><div><strong>${escapeHtml(rule.query)}</strong><span>Promotes ${escapeHtml(searchRuleTargetLabel(rule))}</span></div><button type="button" data-remove-rule aria-label="Remove rule for ${escapeHtml(rule.query)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button></div>`).join("") || '<p class="search-setting-empty">No search rules added.</p>';
    $("#search-default-sort").managementPickerSync?.();
    $("#search-suggestions-enabled").closest(".toggle-row").querySelector(".search-toggle-label").textContent = searchSettings.suggestionsEnabled ? "Shown" : "Hidden";
    $(".search-popular-toggle-label").textContent = searchSettings.popularEnabled !== false ? "Shown" : "Hidden";
    $(".search-trending-toggle-label").textContent = searchSettings.trendingEnabled !== false ? "Shown" : "Hidden";
    syncSearchVisibilityIcon($("#search-suggestions-enabled"), searchSettings.suggestionsEnabled, "Suggested Searches");
    syncSearchVisibilityIcon($("#search-popular-enabled"), searchSettings.popularEnabled !== false, "Popular Picks");
    syncSearchVisibilityIcon($("#search-trending-enabled"), searchSettings.trendingEnabled !== false, "Trending Searches");
    $(".search-mode-label").textContent = searchSettings.popularMode === "automatic" ? "Automatic" : "Manual";
    $("#search-suggestion-list").innerHTML = searchSettings.suggestions.map((label, index) => `<div class="search-suggestion-row" draggable="true" data-index="${index}" data-label="${escapeHtml(label)}"><button class="search-suggestion-drag" type="button" aria-label="Drag ${escapeHtml(label)} to reorder"><img src="images/Icon Folder/Menu Bar Icon_Gray.PNG" alt=""></button><span>${escapeHtml(label)}</span><button type="button" data-remove aria-label="Remove ${escapeHtml(label)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button></div>`).join("") || '<p class="search-setting-empty">No suggested searches added.</p>';
    const manual = searchSettings.popularMode === "manual";
    const popularProductSearch = $("#search-popular-product-search");
    popularProductSearch.closest(".search-field").hidden = !manual;
    if (!manual) {
        popularProductSearch.disabled = true;
        $("#search-popular-products").classList.remove("is-disabled");
        $("#search-popular-products").innerHTML = '<p class="search-setting-empty search-automatic-message"><img src="images/Icon Folder/Gear Icon_Gray.PNG" alt="" aria-hidden="true"><strong>Operating Automatically</strong><span>MPWR will choose popular active products for this section.</span></p>';
    } else {
        const query = popularProductSearch.value.trim().toLowerCase();
        const selected = new Set(searchSettings.popularProducts);
        const popularIndex = product => {
            const index = searchSettings.popularProducts.indexOf(String(product.id));
            return index < 0 ? Number.MAX_SAFE_INTEGER : index;
        };
        const visibleProducts = products
            .filter(product => isStorefrontActive(product) && (!query || `${product.title} ${product.category || ""}`.toLowerCase().includes(query)))
            .sort((first, second) => {
                const firstIndex = popularIndex(first);
                const secondIndex = popularIndex(second);
                if (firstIndex !== secondIndex) return firstIndex - secondIndex;
                return 0;
            });
        $("#search-popular-products").innerHTML = visibleProducts.map((product, productIndex) => {
            const id = String(product.id);
            const selectedIndex = searchSettings.popularProducts.indexOf(id);
            const isSelected = selected.has(id);
            const limitReached = !isSelected && searchSettings.popularProducts.length >= SEARCH_POPULAR_PRODUCT_LIMIT;
            const buttonIcon = isSelected ? "Tick Icon_White.PNG" : limitReached ? "Plus Icon_Light Gray.PNG" : "Plus Icon_Gray.PNG";
            const buttonLabel = isSelected ? `Remove ${escapeHtml(product.title)}` : limitReached ? "Popular Picks limit reached" : `Add ${escapeHtml(product.title)}`;
            const controls = `<button type="button" class="${limitReached ? "is-limit-reached" : ""}" data-toggle ${manual ? "" : "disabled"} ${limitReached ? 'aria-disabled="true"' : ""} aria-label="${buttonLabel}"><img src="images/Icon Folder/${buttonIcon}" alt=""></button>`;
            const dragHandle = isSelected ? `<span class="search-product-drag is-position" draggable="true" aria-hidden="true">${selectedIndex + 1}</span>` : "";
            const visualOrder = isSelected ? selectedIndex : 1000 + productIndex;
            return `<div class="search-product-row ${isSelected ? "selected" : ""}" draggable="${isSelected ? "true" : "false"}" data-id="${escapeHtml(id)}" data-index="${isSelected ? selectedIndex : ""}" style="order:${visualOrder}">${dragHandle}<img src="${escapeHtml(productImage(product))}" alt=""><div><strong>${escapeHtml(product.title)}</strong><small>${isSelected ? `Selected · position ${selectedIndex + 1}` : (categoryLabels[productCategory(product)] || "Products")}</small></div>${controls}</div>`;
        }).join("");
        popularProductSearch.disabled = false;
        $("#search-popular-products").classList.remove("is-disabled");
    }
    const previewSuggestionsHeading = $("#search-preview-suggestions-heading");
    const previewChips = $("#search-preview-chips");
    const previewTrendingHeading = $("#search-preview-trending-heading");
    const previewTrending = $("#search-preview-trending");
    const previewPopularHeading = $("#search-preview-popular-heading");
    const previewProducts = $("#search-preview-products");
    if (previewSuggestionsHeading && previewChips && previewTrendingHeading && previewTrending && previewPopularHeading && previewProducts) {
        previewSuggestionsHeading.textContent = searchSettings.suggestionsHeading;
        previewSuggestionsHeading.closest(".search-preview-discovery-section").hidden = !searchSettings.suggestionsEnabled;
        previewChips.innerHTML = searchSettings.suggestions.map(label => `<button class="search-chip" type="button" tabindex="-1" aria-disabled="true">${escapeHtml(label)}</button>`).join("");
        previewTrendingHeading.textContent = searchSettings.trendingHeading;
        previewTrendingHeading.closest(".search-preview-discovery-section").hidden = searchSettings.trendingEnabled === false;
        previewTrending.innerHTML = visibleTrendingSearches().map(label => `<button class="search-chip" type="button" tabindex="-1" aria-disabled="true">${escapeHtml(label)}</button>`).join("");
        renderSearchPopularPreview();
    }
}

async function saveSearchSettings() {
    const selected = searchSettings.popularProducts.map(id => products.find(product => String(product.id) === id)).filter(Boolean);
    searchSettings.synonyms = normalizeSearchSynonyms(searchSettings.synonyms);
    const hidden = hiddenTrendingSet();
    searchSettings.trendingHiddenSearches = searchSettings.trendingSearches.filter(label => hidden.has(String(label).toLowerCase()));
    await setDoc(doc(db, "storefront", "search"), { ...searchSettings, popularProducts: selected.map(product => ({ id: String(product.id), title: product.title, image: productImage(product) })) });
}

function validateSearchSynonyms() {
    const invalidIndex = searchSettings.synonyms.findIndex(rule => !String(rule.term || "").trim() || !rule.synonyms?.length);
    if (invalidIndex < 0) return true;
    const rule = searchSettings.synonyms[invalidIndex];
    showToast(!String(rule.term || "").trim() ? "Add a primary term to this synonym rule." : "Add at least one connected search to this synonym rule.", "error");
    const row = $(`#search-synonym-list .search-synonym-rule[data-index="${invalidIndex}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!String(rule.term || "").trim()) row?.querySelector("[data-synonym-term]")?.focus();
    else {
        activeSynonymAddIndex = invalidIndex;
        renderSearchSynonyms();
    }
    return false;
}

function setEditorPanel(panel, focusField = true) {
    const content = $(".product-modal-content");
    const nextPanel = panel === "category" && !editingProduct ? "category" : "product";
    content.dataset.editorPanel = nextPanel;
    $$(".add-editor-tab").forEach(tab => {
        const active = tab.dataset.editorPanel === nextPanel;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });
    $(".modal-header .eyebrow").textContent = nextPanel === "category" ? "Catalogue category" : "Catalogue item";
    $("#product-modal-title").textContent = editingProduct
        ? "Edit Product"
        : nextPanel === "category" ? "Add Category" : "Add Product";
    if (nextPanel === "category") renderCategoryProductPicker();
    if (focusField) {
        setTimeout(() => $(nextPanel === "category" ? "#category-name" : "#product-title")?.focus(), 330);
    }
}

function lockProductEditorScroll() {
    productEditorScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add("product-editor-open");
    document.body.classList.add("product-editor-open");
    document.body.style.top = `-${productEditorScrollY}px`;
}

function unlockProductEditorScroll() {
    document.documentElement.classList.remove("product-editor-open");
    document.body.classList.remove("product-editor-open");
    document.body.style.top = "";
    window.scrollTo(0, productEditorScrollY);
}

function closeEditor() {
    pendingMediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    pendingMediaPreviewUrls = [];
    selectedMediaFiles = [];
    removedExistingImageUrls = new Set();
    $(".product-modal").classList.add("hidden");
    unlockProductEditorScroll();
    $(".product-modal-content").classList.remove("is-editing");
    editingProduct = null;
    setEditorPanel("product", false);
}

function openEditor(product = null) {
    pendingMediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    pendingMediaPreviewUrls = [];
    selectedMediaFiles = [];
    removedExistingImageUrls = new Set();
    editingProduct = product;
    $(".product-modal-content").classList.toggle("is-editing", Boolean(product));
    resetCategoryEditor();
    $("#product-form").reset();
    $("#product-id").value = product?.apiId || product?.id || "";
    $("#product-title").value = product?.title || "";
    $("#product-category").value = product ? productCategory(product) : "products";
    $("#product-status").value = product ? productVisibility(product) : "active";
    $("#product-description").value = product?.description || "";
    $("#product-price").value = product?.price ?? "";
    $("#product-compare-price").value = Number(product?.compareAtPrice) || "";
    $("#product-sku").value = product?.sku || "";
    $("#product-stock").value = Math.max(0, Number(product?.stock) || 0);
    $("#product-shipping").value = product?.shippingClass || "small";
    $("#product-weight").value = Number(product?.weightGrams) || "";
    $("#product-colors").value = list(product?.colors).join(", ");
    $("#product-sizes").value = list(product?.sizes).join(", ");
    ["#product-category", "#product-status", "#product-shipping"].forEach(selector => productDropdownSync.get($(selector))?.());
    $("#product-featured").checked = Boolean(product && popularIds.includes(String(product.id)));
    $("#product-featured").disabled = popularMode === "automatic";
    const currentDiscount = product ? discountSelection(product.id) : null;
    $("#product-discounted").checked = Boolean(currentDiscount);
    $("#product-discount-percent").value = String(currentDiscount?.percent || 15);
    syncProductDiscountEditor();
    $("#selected-media-count").textContent = "No new files selected.";
    const gallery = product?.gallery?.length ? product.gallery : (product?.image ? [product.image] : []);
    const videos = product?.videos || [];
    const existingMedia = $("#existing-media");
    existingMedia.innerHTML = `${gallery.map((url, index) => `<button class="existing-media-view" type="button" draggable="true" data-media-url="${escapeHtml(url)}" aria-label="View product image ${index + 1}" title="Drag to rearrange"><img src="${escapeHtml(url)}" alt="Product image ${index + 1}" draggable="false"><span class="existing-media-remove" aria-label="Remove product image"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></span></button>`).join("")}${videos.map(video => `<video src="${escapeHtml(video.url || video)}" muted aria-label="Existing product video"></video>`).join("")}<button class="existing-media-add" type="button" aria-label="Add another image or video"><img src="images/Icon Folder/Plus Icon_Gray.PNG" alt=""></button>`;
    existingMedia.classList.remove("hidden");
    lockProductEditorScroll();
    $(".product-modal").classList.remove("hidden");
    setEditorPanel("product");
}

function renderPendingMedia(files) {
    pendingMediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    pendingMediaPreviewUrls = [];
    const existingMedia = $("#existing-media");
    existingMedia.querySelectorAll(".pending-media-preview").forEach(preview => preview.remove());
    const addButton = existingMedia.querySelector(".existing-media-add");
    files.forEach(file => {
        const isVideo = file.type.startsWith("video/");
        const preview = document.createElement(isVideo ? "video" : "img");
        const url = URL.createObjectURL(file);
        pendingMediaPreviewUrls.push(url);
        preview.src = url;
        preview.setAttribute("aria-label", `New media: ${file.name}`);
        if (preview instanceof HTMLVideoElement) {
            preview.className = "pending-media-preview";
            preview.muted = true;
            existingMedia.insertBefore(preview, addButton);
            return;
        }
        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "existing-media-view pending-media-preview";
        previewButton.draggable = true;
        previewButton.title = "Drag to rearrange";
        previewButton.dataset.pendingId = mediaFileId(file);
        preview.draggable = false;
        previewButton.setAttribute("aria-label", `View new image: ${file.name}`);
        const remove = document.createElement("span");
        remove.className = "existing-media-remove";
        remove.setAttribute("aria-label", "Remove new product image");
        remove.innerHTML = '<img src="images/Icon Folder/Close Icon_333.PNG" alt="">';
        previewButton.append(preview, remove);
        existingMedia.insertBefore(previewButton, addButton);
    });
}

function mediaFileId(file) {
    return `${file.name}:${file.size}:${file.lastModified}`;
}

function confirmImageDeletion() {
    const modal = $("#image-delete-confirm-modal");
    const cancelButton = $("#cancel-image-delete");
    const confirmButton = $("#confirm-image-delete");
    modal.classList.remove("hidden");
    confirmButton.focus({ preventScroll: true });
    return new Promise(resolve => {
        const finish = confirmed => {
            modal.classList.add("hidden");
            cancelButton.onclick = null;
            confirmButton.onclick = null;
            modal.onclick = null;
            resolve(confirmed);
        };
        cancelButton.onclick = () => finish(false);
        confirmButton.onclick = () => finish(true);
        modal.onclick = event => {
            if (event.target === modal) finish(false);
        };
    });
}

async function uploadMedia(files, saveButton) {
    const uploaded = [];
    for (let index = 0; index < files.length; index += 1) {
        saveButton.textContent = `Uploading ${index + 1} of ${files.length}…`;
        const result = await uploadImage(files[index], "product");
        uploaded.push({ ...result, type: result.contentType || files[index].type, name: files[index].name, pendingId: mediaFileId(files[index]) });
    }
    return uploaded;
}

function validateMedia(files) {
    if (files.length > 10) return "Choose no more than 10 images and videos.";
    const oversized = files.find(file => file.size > (file.type.startsWith("video/") ? 50 : 5) * 1024 * 1024);
    return oversized ? `${oversized.name} is too large. Images can be 5 MB and videos 50 MB.` : "";
}

async function savePopularSetting() {
    const selected = popularIds.map(id => products.find(product => String(product.id) === id)).filter(Boolean);
    await setDoc(doc(db, "storefront", "popular"), { enabled: true, mode: popularMode, products: selected.map(product => ({ id: String(product.id), title: product.title, image: productImage(product) })) });
    localStorage.setItem("mpwrPopularProductIds", JSON.stringify(popularIds));
    localStorage.setItem("mpwrPopularSectionEnabled", "true");
    localStorage.setItem("mpwrPopularMode", popularMode);
}

async function saveDiscountSetting() {
    const selected = discountSelections.map(selection => {
        const product = products.find(item => String(item.id) === selection.id);
        return product ? {
            id: String(product.id),
            title: product.title,
            image: productImage(product),
            percent: selection.percent
        } : null;
    }).filter(Boolean);
    discountCampaignLabel = DISCOUNT_CAMPAIGN_LABELS.includes($("#discount-campaign-label").value)
        ? $("#discount-campaign-label").value
        : DISCOUNT_CAMPAIGN_LABELS[0];
    await setDoc(doc(db, "storefront", "discounts"), { enabled: discountSectionEnabled, mode: discountMode, products: selected, label: discountCampaignLabel });
    localStorage.setItem("mpwrDiscountProducts", JSON.stringify(selected.map(({ id, percent }) => ({ id, percent }))));
    localStorage.setItem("mpwrDiscountCampaignLabel", discountCampaignLabel);
    localStorage.setItem("mpwrDiscountMode", discountMode);
    localStorage.setItem("mpwrDiscountSectionEnabled", String(discountSectionEnabled));
}

function syncHomepageSectionStates() {
    const offerToggle = $("#offer-section-enabled");
    if (!offerToggle) return;
    discountSectionEnabled = offerToggle.checked;
    if (popularMode === "manual" && discountMode === "manual" && discountSectionEnabled) {
        const discountedIds = new Set(homepageDiscountSelections().map(item => item.id));
        const uniquePopularIds = popularIds.filter(id => !discountedIds.has(id));
        if (uniquePopularIds.length !== popularIds.length) {
            popularIds = uniquePopularIds;
            renderPopularSelection();
        }
    }
    const offerPreview = $("#offer-preview-card");
    const offerLayout = offerPreview?.closest(".homepage-layout");
    const offerPanel = $("#homepage-section-discounts");
    offerPanel?.classList.toggle("section-disabled", !discountSectionEnabled);
    if (offerPanel) offerPanel.inert = !discountSectionEnabled;
    offerPreview?.classList.toggle("section-disabled", !discountSectionEnabled);
    offerLayout?.classList.toggle("section-disabled", !discountSectionEnabled);
    if (offerPreview) offerPreview.querySelector(".popular-selection").inert = !discountSectionEnabled;
    if (offerLayout) offerLayout.querySelector(".homepage-picker-card").inert = !discountSectionEnabled;
    syncHomepageTabVisibility(offerToggle, discountSectionEnabled, "Discount Products");
    const automaticDiscounts = discountMode === "automatic";
    $("#discount-mode-automatic").checked = automaticDiscounts;
    $(".discount-mode-toggle-label").textContent = automaticDiscounts ? "Automatic" : "Manual";
    offerLayout?.classList.toggle("popular-automatic", automaticDiscounts);
    if (offerLayout) offerLayout.querySelector(".homepage-picker-card").inert = automaticDiscounts || !discountSectionEnabled;
    $("#discount-mode-description").textContent = automaticDiscounts
        ? "Uses the most-purchased products from delivered orders, applies 15% off, and shuffles their storefront order for each shopping session."
        : "Choose and order every discounted product. The first 10 appear on the homepage; View All opens the complete list.";
    $("#discount-selection-help").textContent = automaticDiscounts
        ? "Products without recent sales are used only when fewer than 10 bestsellers are available."
        : "Select discount products from the catalogue on the right.";
    const automatic = popularMode === "automatic";
    const popularLayout = $("#popular-preview-card")?.closest(".homepage-layout");
    popularLayout?.classList.toggle("popular-automatic", automatic);
    if (popularLayout) popularLayout.querySelector(".homepage-picker-card").inert = automatic;
    $("#popular-mode-automatic").checked = automatic;
    $(".popular-mode-toggle-label").textContent = automatic ? "Automatic" : "Manual";
    $("#popular-preview-label").textContent = automatic ? "Automatic bestseller preview" : "Manual section preview";
    $("#popular-mode-description").textContent = automatic
        ? "Uses the most-purchased products from delivered orders and shuffles their storefront order for each shopping session."
        : "Choose up to 10 active products and arrange the order shoppers should see.";
    $("#popular-selection-help").textContent = automatic
        ? "Products without recent sales are used only when fewer than 10 bestsellers are available."
        : "Select products from the catalogue on the right.";
    const campaignSelect = $("#discount-campaign-label");
    campaignSelect.disabled = !discountSectionEnabled;
    campaignSelect.closest(".discount-campaign-field")?.classList.toggle("section-disabled", !discountSectionEnabled);
    productDropdownSync.get(campaignSelect)?.();
    const linkedBanner = $("#homepage-campaign-source")?.value === "discounts" && $("#homepage-campaign-sync")?.checked;
    if (linkedBanner) {
        $("#homepage-campaign-enabled").checked = discountSectionEnabled;
        syncLinkedCampaignControls();
    }
    renderHomepageProducts();
    syncDiscountPickerAvailability();
}

async function saveHomepageSettings({ includeHero = false } = {}) {
    const saves = [savePopularSetting(), saveDiscountSetting(), saveAnnouncementBar(), saveCampaignBanner(), saveCategorySetting(), saveHomepageSectionOrder()];
    if (includeHero) saves.push(saveHomepageHero());
    await Promise.all(saves);
}

async function saveAnnouncementBar() {
    const announcement = readAnnouncementBarForm();
    await setDoc(doc(db, "storefront", "announcementBar"), announcement);
    localStorage.setItem("mpwrAnnouncementBar", JSON.stringify(announcement));
}

async function saveHomepageHero() {
    const hero = readHomepageHeroForm();
    const importedKeys = [];
    try {
        for (const image of hero.images) {
            if (image.key || !/^https?:\/\//i.test(image.url)) continue;
            const imported = await importImage(image.url, "banner");
            image.url = imported.url;
            image.key = imported.key || "";
            image.source = "upload";
            if (image.key) {
                importedKeys.push(image.key);
                pendingHomepageHeroImageKeys.add(image.key);
            }
        }
        hero.image = hero.images[0]?.url || "";
        hero.imageKey = hero.images[0]?.key || "";
        await setDoc(doc(db, "storefront", "homepageHero"), hero);
        const currentKeys = new Set(hero.images.map(image => image.key).filter(Boolean));
        const removedKeys = [...savedHomepageHeroImageKeys].filter(key => !currentKeys.has(key));
        await Promise.all(removedKeys.map(key => deleteImage(key).catch(() => {})));
        savedHomepageHeroImageKeys = currentKeys;
        currentKeys.forEach(key => pendingHomepageHeroImageKeys.delete(key));
        homepageHero = normalizeHomepageHero(hero);
        syncHomepageHeroForm();
        localStorage.setItem("mpwrHomepageHero", JSON.stringify(hero));
    } catch (error) {
        await Promise.all(importedKeys.map(key => deleteImage(key).catch(() => {})));
        importedKeys.forEach(key => pendingHomepageHeroImageKeys.delete(key));
        throw error;
    }
}

async function saveCampaignBanner() {
    const banner = readCampaignBannerForm();
    await setDoc(doc(db, "storefront", "campaignBanner"), banner);
    localStorage.setItem("mpwrCampaignBanner", JSON.stringify(banner));
}

async function saveCategorySetting() {
    await setDoc(doc(db, "storefront", "categories"), { items: categories });
    localStorage.setItem("mpwrCategories", JSON.stringify(categories));
}

async function saveHomepageSectionOrder() {
    homepageSectionOrder = normalizeHomepageSectionOrder(homepageSectionOrder);
    await setDoc(doc(db, "storefront", "homepageSectionOrder"), { items: homepageSectionOrder });
    localStorage.setItem("mpwrHomepageSectionOrder", JSON.stringify(homepageSectionOrder));
}

async function verifyHomepageAddition(section, productId) {
    const settingKey = section === "popular" ? "popular" : "discounts";
    const savedSetting = await getDoc(doc(db, "storefront", settingKey));
    const savedIds = Array.isArray(savedSetting.data()?.products)
        ? savedSetting.data().products.map(item => String(item.id))
        : [];
    if (!savedIds.includes(String(productId))) {
        throw new Error("The server did not retain this homepage selection. Please try again.");
    }
}

function autosaveHomepageSettings(successMessage = "") {
    if (successMessage) homepageAutosaveMessage = successMessage;
    clearTimeout(homepageAutosaveTimer);
    homepageAutosaveTimer = setTimeout(() => {
        const message = homepageAutosaveMessage;
        homepageAutosaveMessage = "";
        homepageAutosaveQueue = homepageAutosaveQueue
            .then(async () => {
                await saveHomepageSettings();
                notifyStorefrontChange();
                if (message) showToast(message);
            })
            .catch(error => showToast(error?.message || "Unable to save the homepage.", "error"));
    }, 300);
}

async function handleCategorySubmit(event) {
    event.preventDefault();
    const label = $("#category-name").value.trim().replace(/\s+/g, " ").slice(0, 60);
    const slug = categorySlug($("#category-slug").value || label);
    if (!label || !slug) return showToast("Enter a category name and valid handle.", "error");
    if (!categoryImageFile) return showToast("Choose an image for this category.", "error");
    if (categoryProductIds.size === 0) return showToast("Select at least one product before saving the category.", "error");
    if (categories.some(category => category.slug === slug || category.label.toLowerCase() === label.toLowerCase())) {
        return showToast("That category already exists.", "error");
    }

    const button = $("#save-category");
    const selectedProducts = products.filter(product => categoryProductIds.has(String(product.id)));
    if (!selectedProducts.length) return showToast("Select at least one available product.", "error");
    const unconfirmedProduct = selectedProducts.find(product => {
        const id = String(product.id);
        return productCategory(product) !== UNCATEGORIZED_CATEGORY && !categoryReassignmentIds.has(id);
    });
    if (unconfirmedProduct) return showToast(`Confirm the category change for ${unconfirmedProduct.title}.`, "error");
    const previousCategories = categories.map(category => ({ ...category }));
    const previousMetadata = new Map(selectedProducts.map(product => [String(product.id), { ...(product.metadata || {}) }]));
    let uploadedImage = null;
    button.disabled = true;
    button.textContent = "Uploading image…";
    try {
        uploadedImage = await uploadImage(categoryImageFile, "category");
        button.textContent = "Saving category…";
        categories = [...categories, {
            slug,
            label,
            image: uploadedImage.url,
            imageKey: uploadedImage.key || "",
            productIds: selectedProducts.map(product => String(product.id))
        }];
        await setDoc(doc(db, "storefront", "categories"), { items: categories });
        await Promise.all(selectedProducts.map(product => updateDoc(
            doc(db, "products", product.apiId || product.id),
            { metadata: { ...(product.metadata || {}), category: slug } }
        )));
        await loadData();
        syncCategoryControls(slug);
        resetCategoryEditor();
        setEditorPanel("product");
        notifyStorefrontChange();
        showToast(`${label} added with ${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"}.`);
    } catch (error) {
        categories = previousCategories;
        if (uploadedImage?.key) await deleteImage(uploadedImage.key).catch(() => {});
        await Promise.allSettled([
            setDoc(doc(db, "storefront", "categories"), { items: previousCategories }),
            ...selectedProducts.map(product => updateDoc(
                doc(db, "products", product.apiId || product.id),
                { metadata: previousMetadata.get(String(product.id)) || {} }
            ))
        ]);
        await loadData().catch(() => syncCategoryControls());
        showToast(error?.message || "Unable to save the category.", "error");
    } finally {
        button.disabled = categoryProductIds.size === 0 || !categoryImageFile;
        button.textContent = "Save Category";
    }
}

async function handleProductSubmit(event) {
    event.preventDefault();
    const wasEditing = Boolean(editingProduct);
    const files = [...selectedMediaFiles];
    const existingImages = (editingProduct?.gallery?.length ? [...editingProduct.gallery] : (editingProduct?.image ? [editingProduct.image] : [])).filter(url => !removedExistingImageUrls.has(url));
    const existingVideos = [...(editingProduct?.videos || [])];
    const imageOrder = [...$("#existing-media").querySelectorAll(".existing-media-view")].map(button => ({
        existingUrl: button.dataset.mediaUrl || "",
        pendingId: button.dataset.pendingId || ""
    }));
    const mediaError = validateMedia(files);
    const putOnDiscount = discountMode === "manual" && $("#product-discounted").checked;
    const discountPercent = Math.min(95, Math.max(1, Math.round(Number($("#product-discount-percent").value) || 15)));
    const existingDiscount = editingProduct ? discountSelection(editingProduct.id) : null;
    if (mediaError) return showToast(mediaError, "error");
    if (putOnDiscount && $("#product-status").value !== "active") return showToast("Set the product to Active before putting it on discount.", "error");
    if (!editingProduct && !files.some(file => file.type.startsWith("image/"))) return showToast("Include at least one image to use as the product cover.", "error");
    if (editingProduct && !existingImages.length && !files.some(file => file.type.startsWith("image/"))) return showToast("Keep or add at least one product image.", "error");
    if (existingImages.length + existingVideos.length + files.length > 10) return showToast("A product can have up to 10 images and videos in total.", "error");
    const button = $("#save-product");
    const uploaded = [];
    let productSaved = false;
    button.disabled = true;
    try {
        uploaded.push(...await uploadMedia(files, button));
        const newImages = uploaded.filter(item => item.type.startsWith("image/"));
        const newVideos = uploaded.filter(item => item.type.startsWith("video/"));
        const uploadedImageUrls = new Map(newImages.map(item => [item.pendingId, item.url]));
        const gallery = imageOrder.map(item => item.existingUrl || uploadedImageUrls.get(item.pendingId)).filter(Boolean);
        const videos = [...existingVideos, ...newVideos];
        const visibility = $("#product-status").value;
        const active = visibility === "active";
        const data = {
            title: $("#product-title").value.trim(), category: $("#product-category").value,
            description: $("#product-description").value.trim(), price: Number($("#product-price").value),
            compareAtPrice: Number($("#product-compare-price").value) || 0, sku: $("#product-sku").value.trim(),
            stock: Number($("#product-stock").value) || 0, shippingClass: $("#product-shipping").value,
            weightGrams: Number($("#product-weight").value) || 0, colors: list($("#product-colors").value),
            sizes: list($("#product-sizes").value), visibility, active, image: gallery[0] || "", gallery, videos
        };
        button.textContent = "Saving product…";
        let savedApiId = editingProduct?.apiId;
        if (editingProduct) {
            const metadata = { ...(editingProduct.metadata || {}), category: data.category, compareAtPrice: data.compareAtPrice, sku: data.sku, stock: data.stock, colors: data.colors, sizes: data.sizes, gallery, videos, featured: $("#product-featured").checked };
            await updateDoc(doc(db, "products", editingProduct.apiId || editingProduct.id), { ...data, metadata });
        } else {
            const created = await addDoc(collection(db, "products"), { ...data, featured: $("#product-featured").checked });
            savedApiId = created.id;
        }
        productSaved = true;
        await loadData();
        const savedProduct = products.find(product => product.apiId === savedApiId) || products.find(product => product.title === data.title);
        if (savedProduct) {
            if (popularMode === "manual") {
                popularIds = popularIds.filter(id => id !== String(savedProduct.id));
                if ($("#product-featured").checked && !putOnDiscount && active && popularIds.length < POPULAR_PRODUCT_LIMIT) popularIds.push(String(savedProduct.id));
            }
            if (discountMode === "manual") {
                discountSelections = discountSelections.filter(item => item.id !== String(savedProduct.id));
                if (putOnDiscount && active) discountSelections.push({ id: String(savedProduct.id), percent: discountPercent });
            }
            await saveHomepageSettings();
        }
        closeEditor();
        renderAll();
        notifyStorefrontChange();
        showToast(wasEditing ? "Product updated." : "Product added and connected to the website.");
    } catch (error) {
        if (!productSaved) await Promise.all(uploaded.filter(item => item.key).map(item => deleteImage(item.key).catch(() => {})));
        showToast(productSaved ? "Product saved, but the homepage selection could not be updated." : (error?.message || "Unable to save the product."), "error");
    } finally {
        button.disabled = false;
        button.textContent = "Save Product";
    }
}

function enhanceManagementSelect(select) {
    const picker = document.createElement("div");
    picker.className = "management-select-picker";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "management-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<span></span><i aria-hidden="true"></i>';
    const menu = document.createElement("div");
    menu.className = "management-select-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    const close = () => {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };
    const sync = () => {
        const selected = select.options[select.selectedIndex];
        trigger.querySelector("span").textContent = selected?.textContent || "Select";
        menu.querySelectorAll("button").forEach(button => {
            const active = button.dataset.value === select.value;
            button.classList.toggle("selected", active);
            button.setAttribute("aria-selected", String(active));
        });
    };

    [...select.options].forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "option");
        button.dataset.value = option.value;
        button.textContent = option.textContent;
        button.addEventListener("click", () => {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            sync();
            close();
            trigger.focus();
        });
        menu.appendChild(button);
    });

    trigger.addEventListener("click", event => {
        event.stopPropagation();
        const opening = menu.hidden;
        document.querySelectorAll(".management-select-menu").forEach(item => { item.hidden = true; });
        document.querySelectorAll(".management-select-trigger").forEach(item => item.setAttribute("aria-expanded", "false"));
        menu.hidden = !opening;
        trigger.setAttribute("aria-expanded", String(opening));
        if (opening) menu.querySelector(".selected")?.focus();
    });
    picker.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        close();
        trigger.focus();
    });
    document.addEventListener("click", event => {
        if (!picker.contains(event.target)) close();
    });

    picker.append(trigger, menu);
    select.insertAdjacentElement("afterend", picker);
    select.classList.add("management-native-select");
    select.managementPickerSync = sync;
    sync();
}

function enhanceHomepageDestinationPicker(select) {
    if (!select) return;
    select.classList.add("homepage-destination-native");
    const picker = document.createElement("div");
    picker.className = "homepage-destination-picker";
    picker.setAttribute("role", "radiogroup");
    picker.setAttribute("aria-label", select.closest("label")?.querySelector(":scope > span")?.textContent || "Button destination");
    const optionText = value => [...select.options].find(option => option.value === value)?.textContent || "Select destination";

    const groups = HOMEPAGE_DESTINATION_GROUPS
        .map(group => ({
            ...group,
            values: group.values.filter(value => value === "custom" || [...select.options].some(option => option.value === value))
        }))
        .filter(group => group.values.length);

    groups.forEach(group => {
        const card = document.createElement("article");
        card.className = "homepage-destination-card";
        card.dataset.destinationType = group.type;
        card.innerHTML = `
            <button class="homepage-destination-choice" type="button" role="radio" aria-checked="false">
                <span class="homepage-destination-radio" aria-hidden="true"></span>
                <span class="homepage-destination-icon"><img src="${group.icon}" alt=""></span>
                <span class="homepage-destination-copy">
                    <strong>${group.label}</strong>
                    <small>${group.description}</small>
                </span>
                <img class="homepage-destination-arrow" src="images/Icon Folder/Back Icon Down_Gray.PNG" alt="">
            </button>
        `;
        if (group.values.length > 1) {
            const selectLabel = document.createElement("label");
            selectLabel.className = "homepage-destination-select";
            const destinationSelect = document.createElement("select");
            destinationSelect.setAttribute("aria-label", group.label);
            destinationSelect.dataset.destinationType = group.type;
            group.values.forEach(value => destinationSelect.append(new Option(optionText(value), value)));
            selectLabel.append(destinationSelect);
            card.append(selectLabel);
            enhanceProductDropdown(destinationSelect);
            destinationSelect.addEventListener("click", event => event.stopPropagation());
            destinationSelect.addEventListener("change", () => {
                select.value = destinationSelect.value;
                select.dispatchEvent(new Event("change", { bubbles: true }));
            });
        }
        if (group.type === "advanced") {
            const customField = document.querySelector(`[data-link-custom-field="${select.dataset.linkInput}"]`);
            if (customField) {
                customField.classList.add("homepage-destination-custom");
                card.append(customField);
            }
        }
        card.querySelector(".homepage-destination-choice").addEventListener("click", () => {
            const nestedSelect = card.querySelector("select");
            select.value = nestedSelect?.value || group.values[0];
            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        picker.append(card);
    });

    const sync = () => {
        const custom = select.value === "custom";
        picker.querySelectorAll(".homepage-destination-card").forEach(card => {
            const group = groups.find(item => item.type === card.dataset.destinationType);
            const active = group?.values.includes(select.value) || (custom && group?.type === "advanced");
            card.classList.toggle("selected", Boolean(active));
            const button = card.querySelector(".homepage-destination-choice");
            button.setAttribute("aria-checked", String(Boolean(active)));
            card.querySelector(".homepage-destination-arrow")?.classList.toggle("hidden", !card.querySelector("select"));
            const nestedSelect = card.querySelector("select");
            if (nestedSelect) {
                if (group.values.includes(select.value)) nestedSelect.value = select.value;
                productDropdownSync.get(nestedSelect)?.();
            }
        });
    };

    select.homepageDestinationSync = sync;
    select.insertAdjacentElement("afterend", picker);
    sync();
}

function bindEvents() {
    enhanceManagementSelect($("#search-default-sort"));
    enhanceManagementSelect($("#search-empty-fallback"));
    enhanceManagementSelect($("#search-autocomplete-product-limit"));
    enhanceManagementSelect($("#search-typo-strength"));
    activateHomepageSection(activeHomepageSection);
    const homepageTabs = $$("[data-homepage-section-tab]");
    homepageTabs.forEach(tab => {
        tab.addEventListener("click", () => activateHomepageSection(tab.dataset.homepageSectionTab));
        tab.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const current = homepageTabs.indexOf(tab);
            const nextIndex = event.key === "Home"
                ? 0
                : event.key === "End"
                    ? homepageTabs.length - 1
                    : (current + (event.key === "ArrowRight" ? 1 : -1) + homepageTabs.length) % homepageTabs.length;
            homepageTabs[nextIndex]?.focus();
            activateHomepageSection(homepageTabs[nextIndex]?.dataset.homepageSectionTab);
        });
    });
    activateSearchSection(activeSearchSection);
    const searchTabs = $$("[data-search-section-tab]");
    searchTabs.forEach(tab => {
        tab.addEventListener("click", () => activateSearchSection(tab.dataset.searchSectionTab));
        tab.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const current = searchTabs.indexOf(tab);
            const nextIndex = event.key === "Home"
                ? 0
                : event.key === "End"
                    ? searchTabs.length - 1
                    : (current + (event.key === "ArrowRight" ? 1 : -1) + searchTabs.length) % searchTabs.length;
            searchTabs[nextIndex]?.focus();
            activateSearchSection(searchTabs[nextIndex]?.dataset.searchSectionTab);
        });
    });
    $("#search-rule-form").addEventListener("submit", event => {
        event.preventDefault();
        const query = $("#search-rule-query").value.trim().replace(/\s+/g, " ").slice(0, 40);
        const [targetType, ...targetParts] = $("#search-rule-target").value.split(":");
        const targetId = targetParts.join(":");
        if (!query || !targetId) return showToast("Add a search and something to promote.", "error");
        const duplicate = searchSettings.searchRules.some(rule => rule.query.toLowerCase() === query.toLowerCase() && rule.targetType === targetType && rule.targetId === targetId);
        if (duplicate) return showToast("That search rule already exists.", "error");
        if (searchSettings.searchRules.length >= 30) return showToast("Add up to 30 search rules.", "error");
        searchSettings.searchRules.push({ query, targetType, targetId });
        $("#search-rule-query").value = "";
        renderSearchSettings();
    });
    $("#search-rule-list").addEventListener("click", event => {
        const row = event.target.closest(".search-rule-row");
        if (!row || !event.target.closest("[data-remove-rule]")) return;
        searchSettings.searchRules.splice(Number(row.dataset.index), 1);
        renderSearchSettings();
    });
    $("#search-suggestion-form").addEventListener("submit", event => {
        event.preventDefault();
        const input = $("#search-suggestion-input");
        const label = input.value.trim().replace(/\s+/g, " ").slice(0, 40);
        if (!label) return;
        if (searchSettings.suggestions.some(item => item.toLowerCase() === label.toLowerCase())) return showToast("That suggested search already exists.", "error");
        if (searchSettings.suggestions.length >= 20) return showToast("Add up to 20 suggested searches.", "error");
        searchSettings.suggestions.push(label);
        input.value = "";
        renderSearchSettings();
    });
    $("#search-suggestion-list").addEventListener("click", event => {
        const row = event.target.closest(".search-suggestion-row");
        if (!row) return;
        const index = Number(row.dataset.index);
        if (event.target.closest("[data-remove]")) searchSettings.suggestions.splice(index, 1);
        else return;
        renderSearchSettings();
    });
    initializeSearchSuggestionReorder();
    initializeSearchPopularReorder();
    $("#search-popular-products").addEventListener("click", event => {
        const row = event.target.closest(".search-product-row");
        if (!row || searchSettings.popularMode !== "manual" || !event.target.closest("button")) return;
        const id = row.dataset.id;
        const wasAtLimit = searchSettings.popularProducts.length >= SEARCH_POPULAR_PRODUCT_LIMIT;
        if (searchSettings.popularProducts.includes(id)) searchSettings.popularProducts = searchSettings.popularProducts.filter(value => value !== id);
        else if (searchSettings.popularProducts.length < SEARCH_POPULAR_PRODUCT_LIMIT) searchSettings.popularProducts.push(id);
        else return showToast(`Choose up to ${SEARCH_POPULAR_PRODUCT_LIMIT} Popular Picks.`, "error");
        const isAtLimit = searchSettings.popularProducts.length >= SEARCH_POPULAR_PRODUCT_LIMIT;
        syncSearchPopularSelectedRows({ changedId: id, updateLimitState: wasAtLimit !== isAtLimit });
    });
    $("#search-popular-product-search").addEventListener("input", renderSearchSettings);
    $("#search-suggestions-enabled").addEventListener("change", event => { searchSettings.suggestionsEnabled = event.target.checked; renderSearchSettings(); });
    $("#search-popular-enabled").addEventListener("change", event => { searchSettings.popularEnabled = event.target.checked; renderSearchSettings(); });
    $("#search-popular-automatic").addEventListener("change", event => { searchSettings.popularMode = event.target.checked ? "automatic" : "manual"; renderSearchSettings(); });
    $("#search-suggestions-heading").addEventListener("input", event => { searchSettings.suggestionsHeading = event.target.value.trimStart().slice(0, 60) || "Suggested searches"; const previewHeading = $("#search-preview-suggestions-heading"); if (previewHeading) previewHeading.textContent = searchSettings.suggestionsHeading; });
    $("#search-popular-heading").addEventListener("input", event => { searchSettings.popularHeading = event.target.value.trimStart().slice(0, 60) || "Popular picks"; const previewHeading = $("#search-preview-popular-heading"); if (previewHeading) previewHeading.textContent = searchSettings.popularHeading; });
    $("#search-default-sort").addEventListener("change", event => { searchSettings.defaultSort = event.target.value; });
    $("#search-trending-enabled").addEventListener("change", event => { searchSettings.trendingEnabled = event.target.checked; renderSearchSettings(); });
    $("#search-trending-auto").addEventListener("change", event => { searchSettings.trendingAutoRefresh = event.target.checked; });
    $("#search-trending-heading").addEventListener("input", event => {
        searchSettings.trendingHeading = event.target.value.trimStart().slice(0, 60) || "Trending searches";
        const previewHeading = $("#search-preview-trending-heading");
        if (previewHeading) previewHeading.textContent = searchSettings.trendingHeading;
        renderTrendingManager();
    });
    $("#search-trending-form").addEventListener("submit", event => {
        event.preventDefault();
        const input = $("#search-trending-input");
        const label = input.value.trim().replace(/\s+/g, " ").slice(0, 40);
        if (!label) return;
        if (searchSettings.trendingSearches.some(item => item.toLowerCase() === label.toLowerCase())) return showToast("That trend already exists.", "error");
        if (searchSettings.trendingSearches.length >= 20) return showToast("Add up to 20 trending searches.", "error");
        searchSettings.trendingSearches.push(label);
        searchSettings.trendingHiddenSearches = normalizeSearchList(searchSettings.trendingHiddenSearches, [], 20).filter(item => item.toLowerCase() !== label.toLowerCase());
        input.value = "";
        renderSearchSettings();
    });
    $("#import-search-trends").addEventListener("click", () => {
        const insightTerms = normalizeSearchList((searchInsights?.topQueries || []).map(item => item.query), [], 20);
        if (!insightTerms.length) return showToast("No search insights are available to import yet.", "error");
        searchSettings.trendingSearches = insightTerms;
        searchSettings.trendingHiddenSearches = [];
        searchSettings.trendingLastAutoRefresh = new Date().toISOString();
        renderSearchSettings();
        showToast("Trending searches imported from insights.");
    });
    $("#search-trending-list").addEventListener("click", event => {
        if (event.target.closest("[data-trending-more]")) {
            searchTrendingExpanded = !searchTrendingExpanded;
            renderTrendingManager();
            return;
        }
        const row = event.target.closest("tr[data-index]");
        if (!row) return;
        const index = Number(row.dataset.index);
        const label = searchSettings.trendingSearches[index];
        if (!label) return;
        if (event.target.closest("[data-trending-remove]")) {
            searchSettings.trendingSearches.splice(index, 1);
            searchSettings.trendingHiddenSearches = normalizeSearchList(searchSettings.trendingHiddenSearches, [], 20).filter(item => item.toLowerCase() !== label.toLowerCase());
            renderSearchSettings();
            return;
        }
    });
    $("#search-trending-list").addEventListener("change", event => {
        if (!event.target.matches("[data-trending-visible]")) return;
        const row = event.target.closest("tr[data-index]");
        const label = searchSettings.trendingSearches[Number(row?.dataset.index)];
        if (!label) return;
        const hidden = hiddenTrendingSet();
        if (event.target.checked) hidden.delete(label.toLowerCase());
        else hidden.add(label.toLowerCase());
        searchSettings.trendingHiddenSearches = searchSettings.trendingSearches.filter(item => hidden.has(item.toLowerCase()));
        renderSearchSettings();
    });
    initializeSearchTrendingReorder();
    $("#search-synonym-list").addEventListener("input", event => {
        const row = event.target.closest(".search-synonym-rule");
        if (!row || !event.target.matches("[data-synonym-term]")) return;
        const index = Number(row.dataset.index);
        if (!searchSettings.synonyms[index]) return;
        searchSettings.synonyms[index].term = event.target.value.trimStart().slice(0, 40);
    });
    $("#search-synonym-list").addEventListener("blur", event => {
        const row = event.target.closest(".search-synonym-rule");
        if (!row || !event.target.matches("[data-synonym-term]")) return;
        const index = Number(row.dataset.index);
        if (!searchSettings.synonyms[index]) return;
        searchSettings.synonyms[index].term = event.target.value.trim().replace(/\s+/g, " ");
        event.target.value = searchSettings.synonyms[index].term;
    }, true);
    $("#search-synonym-list").addEventListener("click", event => {
        const row = event.target.closest(".search-synonym-rule");
        if (!row) return;
        const index = Number(row.dataset.index);
        const rule = searchSettings.synonyms[index];
        if (!rule) return;
        if (event.target.closest("[data-delete-synonym-rule]")) {
            searchSettings.synonyms.splice(index, 1);
            activeSynonymAddIndex = null;
            renderSearchSynonyms();
            return;
        }
        const removeButton = event.target.closest("[data-remove-synonym]");
        if (removeButton) {
            rule.synonyms.splice(Number(removeButton.dataset.removeSynonym), 1);
            renderSearchSynonyms();
            return;
        }
        if (event.target.closest("[data-add-synonym]")) {
            activeSynonymAddIndex = index;
            renderSearchSynonyms();
        }
    });
    $("#search-synonym-list").addEventListener("submit", event => {
        const form = event.target.closest("[data-synonym-add-form]");
        if (!form) return;
        event.preventDefault();
        const row = form.closest(".search-synonym-rule");
        const index = Number(row.dataset.index);
        const rule = searchSettings.synonyms[index];
        const input = form.querySelector("[data-synonym-add-input]");
        const label = input.value.trim().replace(/\s+/g, " ").slice(0, 40);
        if (!rule || !label) return;
        if (rule.synonyms.some(item => item.toLowerCase() === label.toLowerCase())) return showToast("That synonym already exists in this rule.", "error");
        if (rule.synonyms.length >= 8) return showToast("Add up to 8 connected searches per rule.", "error");
        rule.synonyms.push(label);
        activeSynonymAddIndex = null;
        renderSearchSynonyms();
    });
    $("#add-search-synonym-rule").addEventListener("click", () => {
        if (searchSettings.synonyms.length >= 30) return showToast("Add up to 30 synonym rules.", "error");
        searchSettings.synonyms.push({ term: "", synonyms: [] });
        activeSynonymAddIndex = null;
        renderSearchSynonyms();
        requestAnimationFrame(() => {
            const inputs = $$("#search-synonym-list [data-synonym-term]");
            inputs.at(-1)?.focus();
        });
    });
    $("#search-autocomplete-enabled").addEventListener("change", event => { searchSettings.autocompleteEnabled = event.target.checked; renderSearchSettings(); });
    $("#search-autocomplete-categories").addEventListener("change", event => { searchSettings.autocompleteCategories = event.target.checked; });
    $("#search-autocomplete-products").addEventListener("change", event => { searchSettings.autocompleteProducts = event.target.checked; });
    $("#search-autocomplete-product-limit").addEventListener("change", event => { searchSettings.autocompleteProductLimit = Number(event.target.value) || 3; });
    $("#search-typo-enabled").addEventListener("change", event => { searchSettings.typoEnabled = event.target.checked; renderSearchSettings(); });
    $("#search-typo-strength").addEventListener("change", event => { searchSettings.typoStrength = event.target.value === "strict" ? "strict" : "balanced"; });
    $("#search-empty-fallback").addEventListener("change", event => { searchSettings.emptyFallback = ["popular", "trending", "suggestions", "message"].includes(event.target.value) ? event.target.value : "popular"; });
    $("#search-empty-message").addEventListener("input", event => { searchSettings.emptyMessage = event.target.value.trimStart().slice(0, 120) || "Try a trending search or browse our popular picks."; });
    $("#save-search-settings").addEventListener("click", () => {
        if (!validateSearchSynonyms()) return;
        $("#search-save-modal").classList.remove("hidden");
        $("#confirm-search-save").focus();
    });
    const closeSearchSave = () => { $("#search-save-modal").classList.add("hidden"); $("#save-search-settings").focus(); };
    $("#cancel-search-save").addEventListener("click", closeSearchSave);
    $("#search-save-modal").addEventListener("click", event => { if (event.target === event.currentTarget) closeSearchSave(); });
    $("#confirm-search-save").addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Saving…";
        try { await saveSearchSettings(); notifyStorefrontChange(); closeSearchSave(); showToast("Search Page changes saved."); }
        catch (error) { showToast(error?.message || "Unable to save the Search Page.", "error"); }
        finally { button.disabled = false; button.textContent = "Save Changes"; }
    });
    $$('[data-coming-soon]').forEach(button => button.addEventListener("click", () => showToast(`${button.dataset.comingSoon} management is the next workspace to connect.`)));
    $("#add-product-btn").addEventListener("click", () => openEditor());
    $$(".add-editor-tab").forEach(tab => tab.addEventListener("click", () => setEditorPanel(tab.dataset.editorPanel)));
    $(".show-product-panel").addEventListener("click", () => setEditorPanel("product"));
    $$(".close-modal, .close-modal-secondary").forEach(button => button.addEventListener("click", closeEditor));
    $(".product-modal").addEventListener("click", event => { if (event.target === event.currentTarget) closeEditor(); });
    $("#product-form").addEventListener("submit", handleProductSubmit);
    $("#category-form").addEventListener("submit", handleCategorySubmit);
    $("#category-name").addEventListener("input", event => {
        if (!categorySlugEdited) $("#category-slug").value = categorySlug(event.target.value);
    });
    $("#category-slug").addEventListener("input", event => {
        categorySlugEdited = Boolean(event.target.value);
        const normalized = categorySlug(event.target.value);
        event.target.setCustomValidity(event.target.value && normalized !== event.target.value ? "Use lowercase letters, numbers, and hyphens only." : "");
    });
    $("#category-image").addEventListener("change", event => {
        const file = event.target.files?.[0] || null;
        if (!file) return setCategoryImage();
        if (!/^image\/(?:jpeg|png|webp|gif)$/.test(file.type)) {
            event.target.value = "";
            setCategoryImage();
            return showToast("Use a JPEG, PNG, WebP, or GIF category image.", "error");
        }
        if (file.size > 5 * 1024 * 1024) {
            event.target.value = "";
            setCategoryImage();
            return showToast("Category images must be 5 MB or smaller.", "error");
        }
        setCategoryImage(file);
    });
    $("#category-product-search").addEventListener("input", renderCategoryProductPicker);
    $("#category-product-picker").addEventListener("click", event => {
        const choice = event.target.closest(".category-product-choice");
        if (!choice) return;
        const id = String(choice.dataset.id || "");
        const menuToggle = event.target.closest(".category-product-menu-toggle");
        if (menuToggle) {
            event.stopPropagation();
            const menu = choice.querySelector(".category-product-menu");
            const opening = menu.hidden;
            $$(".category-product-menu:not([hidden])").forEach(openMenu => {
                openMenu.hidden = true;
                openMenu.previousElementSibling?.setAttribute("aria-expanded", "false");
            });
            menu.hidden = !opening;
            menuToggle.setAttribute("aria-expanded", String(opening));
            return;
        }
        if (event.target.closest(".change-product-category")) {
            const product = products.find(item => String(item.id) === id);
            if (!product) return;
            categoryReassignmentTarget = product;
            const currentCategory = categoryLabels[product.category || legacyCategories[id]] || "its current category";
            const nextCategory = $("#category-name").value.trim() || "this new category";
            $("#change-category-title").textContent = `Change ${product.title || "product"}'s category?`;
            $("#change-category-message").textContent = `Are you sure you want to move this item from ${currentCategory} to ${nextCategory}?`;
            $("#change-category-modal").classList.remove("hidden");
            $("#confirm-change-category").focus();
            return;
        }
        const selectButton = event.target.closest(".category-product-select");
        if (!selectButton && choice.classList.contains("has-category")) return;
        if (selectButton?.disabled) return;
        if (categoryProductIds.has(id)) categoryProductIds.delete(id);
        else categoryProductIds.add(id);
        renderCategoryProductPicker();
    });
    $("#cancel-change-category").addEventListener("click", () => {
        categoryReassignmentTarget = null;
        $("#change-category-modal").classList.add("hidden");
    });
    $("#confirm-change-category").addEventListener("click", () => {
        if (!categoryReassignmentTarget) return;
        const id = String(categoryReassignmentTarget.id);
        categoryReassignmentIds.add(id);
        categoryProductIds.add(id);
        categoryReassignmentTarget = null;
        $("#change-category-modal").classList.add("hidden");
        renderCategoryProductPicker();
    });
    $("#change-category-modal").addEventListener("click", event => {
        if (event.target !== event.currentTarget) return;
        categoryReassignmentTarget = null;
        event.currentTarget.classList.add("hidden");
    });
    let editorSwipeStart = null;
    $(".add-editor-viewport").addEventListener("touchstart", event => {
        const touch = event.touches[0];
        editorSwipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });
    $(".add-editor-viewport").addEventListener("touchend", event => {
        if (!editorSwipeStart || editingProduct) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - editorSwipeStart.x;
        const dy = touch.clientY - editorSwipeStart.y;
        editorSwipeStart = null;
        if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx > 0) setEditorPanel("category");
        else setEditorPanel("product");
    }, { passive: true });
    $("#product-discounted").addEventListener("change", syncProductDiscountEditor);
    const existingMediaStrip = $("#existing-media");
    let draggedImage = null;
    let touchDrag = null;
    const positionDraggedImage = (dragged, target, clientX) => {
        if (!dragged || !target || dragged === target) return;
        const placeAfter = clientX > target.getBoundingClientRect().left + target.offsetWidth / 2;
        existingMediaStrip.insertBefore(dragged, placeAfter ? target.nextSibling : target);
    };
    const suppressViewerClick = () => {
        existingMediaStrip.dataset.suppressClick = "true";
        setTimeout(() => { existingMediaStrip.dataset.suppressClick = "false"; }, 0);
    };
    existingMediaStrip.addEventListener("dragstart", event => {
        draggedImage = event.target.closest(".existing-media-view");
        if (!draggedImage) return;
        draggedImage.classList.add("is-reordering");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "reorder-product-image");
        existingMediaStrip.dataset.suppressClick = "true";
    });
    existingMediaStrip.addEventListener("dragover", event => {
        const target = event.target.closest(".existing-media-view");
        if (!draggedImage || !target) return;
        event.preventDefault();
        positionDraggedImage(draggedImage, target, event.clientX);
    });
    existingMediaStrip.addEventListener("drop", event => {
        if (draggedImage) event.preventDefault();
    });
    existingMediaStrip.addEventListener("dragend", () => {
        draggedImage?.classList.remove("is-reordering");
        draggedImage = null;
        suppressViewerClick();
    });
    existingMediaStrip.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse") return;
        if (event.target.closest(".existing-media-remove")) return;
        const image = event.target.closest(".existing-media-view");
        if (!image) return;
        touchDrag = { image, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
        image.setPointerCapture?.(event.pointerId);
    });
    existingMediaStrip.addEventListener("pointermove", event => {
        if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
        const distance = Math.hypot(event.clientX - touchDrag.startX, event.clientY - touchDrag.startY);
        if (!touchDrag.active && distance < 8) return;
        touchDrag.active = true;
        touchDrag.image.classList.add("is-reordering");
        event.preventDefault();
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".existing-media-view");
        if (target?.parentElement === existingMediaStrip) positionDraggedImage(touchDrag.image, target, event.clientX);
    }, { passive: false });
    const finishTouchReorder = event => {
        if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
        touchDrag.image.releasePointerCapture?.(event.pointerId);
        touchDrag.image.classList.remove("is-reordering");
        if (touchDrag.active) suppressViewerClick();
        touchDrag = null;
    };
    existingMediaStrip.addEventListener("pointerup", finishTouchReorder);
    existingMediaStrip.addEventListener("pointercancel", finishTouchReorder);
    existingMediaStrip.addEventListener("click", async event => {
        if (event.currentTarget.dataset.suppressClick === "true") {
            event.preventDefault();
            return;
        }
        if (event.target.closest(".existing-media-add")) {
            $("#product-media").click();
            return;
        }
        const removeControl = event.target.closest(".existing-media-remove");
        if (removeControl) {
            event.preventDefault();
            event.stopPropagation();
            const imageButton = removeControl.closest(".existing-media-view");
            if (!imageButton || !await confirmImageDeletion()) return;
            if (imageButton.dataset.mediaUrl) {
                removedExistingImageUrls.add(imageButton.dataset.mediaUrl);
                imageButton.remove();
                showToast("Image will be deleted when you save the product.");
            } else if (imageButton.dataset.pendingId) {
                selectedMediaFiles = selectedMediaFiles.filter(file => mediaFileId(file) !== imageButton.dataset.pendingId);
                renderPendingMedia(selectedMediaFiles);
            }
            $("#selected-media-count").textContent = selectedMediaFiles.length ? `${selectedMediaFiles.length} new file${selectedMediaFiles.length === 1 ? "" : "s"} selected.` : "No new files selected.";
            return;
        }
        const trigger = event.target.closest(".existing-media-view");
        if (!trigger) return;
        const imageButtons = [...existingMediaStrip.querySelectorAll(".existing-media-view")];
        const images = imageButtons.map((button, index) => ({
            url: button.querySelector("img")?.src || "",
            name: button.querySelector("img")?.alt || `Product image ${index + 1}`,
            element: button,
            existingUrl: button.dataset.mediaUrl || "",
            pendingId: button.dataset.pendingId || ""
        }));
        openReviewLightbox({
            images,
            index: imageButtons.indexOf(trigger),
            review: {},
            trigger,
            action: {
                label: "Delete image",
                imageSrc: "images/Icon Folder/Delete Icon_White.PNG",
                handler: async image => {
                    if (!await confirmImageDeletion()) return false;
                    if (image.existingUrl) {
                        removedExistingImageUrls.add(image.existingUrl);
                        image.element?.remove();
                    } else if (image.pendingId) {
                        selectedMediaFiles = selectedMediaFiles.filter(file => mediaFileId(file) !== image.pendingId);
                        renderPendingMedia(selectedMediaFiles);
                    }
                    $("#selected-media-count").textContent = selectedMediaFiles.length ? `${selectedMediaFiles.length} new file${selectedMediaFiles.length === 1 ? "" : "s"} selected.` : "No new files selected.";
                    showToast("Image will be deleted when you save the product.");
                    return true;
                }
            }
        });
    });
    $("#product-media").addEventListener("change", event => {
        const knownFiles = new Set(selectedMediaFiles.map(mediaFileId));
        const additions = [...event.target.files].filter(file => !knownFiles.has(mediaFileId(file)));
        selectedMediaFiles = [...selectedMediaFiles, ...additions];
        event.target.value = "";
        renderPendingMedia(selectedMediaFiles);
        $("#selected-media-count").textContent = selectedMediaFiles.length ? `${selectedMediaFiles.length} new file${selectedMediaFiles.length === 1 ? "" : "s"} selected.` : "No new files selected.";
    });
    ["#product-search", "#category-filter", "#status-filter"].forEach(selector => $(selector).addEventListener(selector === "#product-search" ? "input" : "change", renderProducts));
    ["#category-filter", "#status-filter", "#product-category", "#product-status", "#product-shipping", "#discount-campaign-label", "#homepage-campaign-source"].forEach(selector => enhanceProductDropdown($(selector)));
    HOMEPAGE_DESTINATION_SELECTORS.forEach(selector => enhanceHomepageDestinationPicker($(selector)));
    document.addEventListener("click", () => {
        document.querySelectorAll(".product-dropdown-menu:not([hidden])").forEach(menu => {
            menu.hidden = true;
            menu.previousElementSibling?.setAttribute("aria-expanded", "false");
        });
        document.querySelectorAll(".category-product-menu:not([hidden])").forEach(menu => {
            menu.hidden = true;
            menu.previousElementSibling?.setAttribute("aria-expanded", "false");
        });
    });
    $("#homepage-search").addEventListener("input", renderHomepageProducts);
    $("#discount-search").addEventListener("input", renderDiscountProducts);
    initializeHeroCategoryReorder();
    initializeHomepageSectionOrderReorder();
    ["#homepage-announcement-enabled", "#homepage-announcement-message", "#homepage-announcement-link-label", "#homepage-announcement-link"].forEach(selector => {
        const field = $(selector);
        field.addEventListener(field.type === "checkbox" ? "change" : "input", renderAnnouncementBarPreview);
    });
    $("#homepage-announcement-link-choice").addEventListener("change", event => {
        syncHomepageLinkDestination(event.target, { writePreset: true });
        renderAnnouncementBarPreview();
    });
    initializeHeroMediaUploader();
    $("#homepage-hero-preview-play").addEventListener("click", () => {
        if (homepageHeroPreviewPlaying) stopHomepageHeroPreview();
        else startHomepageHeroPreview();
    });
    initializeBannerMediaUploader({ prefix: "campaign", defaultImage: DEFAULT_CAMPAIGN_BANNER.image, render: renderCampaignBannerPreview });
    ["#homepage-hero-enabled", "#homepage-hero-eyebrow", "#homepage-hero-heading", "#homepage-hero-body", "#homepage-hero-button-label", "#homepage-hero-button-link"].forEach(selector => {
        const field = $(selector);
        field.addEventListener(field.type === "checkbox" ? "change" : "input", () => renderHomepageHeroPreview({ syncMedia: false }));
    });
    $("#homepage-hero-button-link-choice").addEventListener("change", event => {
        syncHomepageLinkDestination(event.target, { writePreset: true });
        renderHomepageHeroPreview({ syncMedia: false });
    });
    ["#homepage-campaign-enabled", "#homepage-campaign-eyebrow", "#homepage-campaign-heading", "#homepage-campaign-body", "#homepage-campaign-button-label", "#homepage-campaign-button-link", "#homepage-campaign-image"].forEach(selector => {
        const field = $(selector);
        field.addEventListener(field.type === "checkbox" ? "change" : "input", renderCampaignBannerPreview);
    });
    $("#homepage-campaign-button-link-choice").addEventListener("change", event => {
        syncHomepageLinkDestination(event.target, { writePreset: true });
        renderCampaignBannerPreview();
    });
    $("#homepage-campaign-source").addEventListener("change", event => {
        productDropdownSync.get(event.target)?.();
        if (event.target.value === "discounts") $("#homepage-campaign-sync").checked = true;
        syncLinkedCampaignControls({ refreshContent: event.target.value === "discounts" });
    });
    $("#homepage-campaign-sync").addEventListener("change", event => {
        $("#homepage-campaign-source").value = event.target.checked ? "discounts" : "custom";
        if (!event.target.checked) resetCampaignBannerDefaultFields();
        productDropdownSync.get($("#homepage-campaign-source"))?.();
        syncLinkedCampaignControls({ refreshContent: event.target.checked });
    });
    $("#homepage-campaign-manage")?.addEventListener("click", () => activateHomepageSection("discounts"));
    const closeHomepageSaveConfirmation = () => {
        $("#homepage-save-modal").classList.add("hidden");
        $("#save-homepage").focus();
    };
    $("#save-homepage").addEventListener("click", () => {
        $("#homepage-save-modal").classList.remove("hidden");
        $("#confirm-homepage-save").focus();
    });
    $("#cancel-homepage-save").addEventListener("click", closeHomepageSaveConfirmation);
    $("#homepage-save-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeHomepageSaveConfirmation();
    });
    $("#confirm-homepage-save").addEventListener("click", async event => {
        const button = event.currentTarget;
        clearTimeout(homepageAutosaveTimer);
        homepageAutosaveMessage = "";
        button.disabled = true;
        button.textContent = "Saving…";
        try {
            await homepageAutosaveQueue;
            await saveHomepageSettings({ includeHero: true });
            notifyStorefrontChange();
            $("#homepage-save-modal").classList.add("hidden");
            showToast("Homepage changes saved.");
        } catch (error) {
            showToast(error?.message || "Unable to save the homepage.", "error");
        } finally {
            button.disabled = false;
            button.textContent = "Save Changes";
        }
    });
    $("#offer-section-enabled").addEventListener("change", syncHomepageSectionStates);
    $("#popular-mode-automatic").addEventListener("change", event => {
        popularMode = event.target.checked ? "automatic" : "manual";
        syncHomepageSectionStates();
        renderHomepage();
    });
    $("#discount-mode-automatic").addEventListener("change", event => {
        discountMode = event.target.checked ? "automatic" : "manual";
        syncHomepageSectionStates();
        renderHomepage();
        if ($("#homepage-campaign-source").value === "discounts" && $("#homepage-campaign-sync").checked) {
            syncLinkedCampaignControls({ refreshContent: true });
        }
    });
    $("#discount-campaign-label").addEventListener("change", event => {
        discountCampaignLabel = DISCOUNT_CAMPAIGN_LABELS.includes(event.target.value)
            ? event.target.value
            : DISCOUNT_CAMPAIGN_LABELS[0];
        event.target.value = discountCampaignLabel;
        productDropdownSync.get(event.target)?.();
        $("#discount-campaign-preview").textContent = discountCampaignLabel;
        renderHomepageSectionOrder();
        if ($("#homepage-campaign-source").value === "discounts" && $("#homepage-campaign-sync").checked) {
            syncLinkedCampaignControls({ refreshContent: true });
        }
    });
    homepagePanelResizeObserver = new ResizeObserver(syncHomepagePanelHeights);
    $$(".homepage-preview-card").forEach(panel => homepagePanelResizeObserver.observe(panel));
    window.addEventListener("resize", syncHomepagePanelHeights);
    $$(".management-nav-item[data-panel]").forEach(link => link.addEventListener("click", event => {
        event.preventDefault();
        activateManagementPanel(link.dataset.panel, true);
    }));
    window.addEventListener("popstate", () => activateManagementPanel(panelFromLocation()));
    window.addEventListener("hashchange", () => activateManagementPanel(panelFromLocation()));
    activateManagementPanel(panelFromLocation());
    $(".products-list").addEventListener("click", event => {
        const card = event.target.closest(".product-card");
        const product = products.find(item => String(item.id) === card?.dataset.id);
        if (!product) return;
        if (event.target.closest(".edit-product")) openEditor(product);
        if (event.target.closest(".archive-product")) { archiveTarget = product; $("#archive-title").textContent = `Delete ${product.title}?`; $(".confirm-modal").classList.remove("hidden"); }
    });
    $("#cancel-archive").addEventListener("click", () => { archiveTarget = null; $(".confirm-modal").classList.add("hidden"); });
    $("#confirm-archive").addEventListener("click", async () => {
        if (!archiveTarget) return;
        const button = $("#confirm-archive"); button.disabled = true;
        try { await deleteDoc(doc(db, "products", archiveTarget.apiId || archiveTarget.id)); popularIds = popularIds.filter(id => id !== String(archiveTarget.id)); discountSelections = discountSelections.filter(item => item.id !== String(archiveTarget.id)); await saveHomepageSettings(); await loadData(); notifyStorefrontChange(); $(".confirm-modal").classList.add("hidden"); showToast("Product moved to Deleted Products for 60 days."); archiveTarget = null; }
        catch (error) { showToast(error?.message || "Unable to delete the product.", "error"); }
        finally { button.disabled = false; }
    });
    $("#deleted-products-list").addEventListener("click", event => {
        const card = event.target.closest(".deleted-product-card");
        if (!card) return;
        const product = deletedProducts.find(item => String(item.id) === card.dataset.id);
        if (!product) return;
        if (event.target.closest(".restore-product")) {
            restoreTarget = product;
            $("#restore-confirm-title").textContent = `Restore ${product.title}?`;
            $("#restore-confirm-message").textContent = "This product will return to the catalogue and become available in MPWR Management again.";
            $("#restore-confirm-modal").classList.remove("hidden");
            $("#confirm-restore").focus();
        }
        if (event.target.closest(".permanently-delete-product")) {
            permanentDeleteButton = event.target.closest(".permanently-delete-product");
            setPermanentDeleteButtonState(permanentDeleteButton, true);
            permanentDeleteTarget = product;
            $("#permanent-delete-title").textContent = `Permanently delete ${product.title}?`;
            $("#permanent-delete-message").textContent = "This product will be permanently removed and cannot be restored.";
            $("#permanent-delete-modal").classList.remove("hidden");
            $("#confirm-permanent-delete").focus();
        }
    });
    $("#cancel-restore").addEventListener("click", () => { restoreTarget = null; $("#restore-confirm-modal").classList.add("hidden"); });
    $("#confirm-restore").addEventListener("click", async event => {
        if (!restoreTarget) return;
        const product = restoreTarget;
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Restoring…";
        try {
            await updateDoc(doc(db, "deletedProducts", product.apiId || product.id), {});
            restoreTarget = null;
            $("#restore-confirm-modal").classList.add("hidden");
            await loadData();
            notifyStorefrontChange();
            showToast(`${product.title} was restored to the catalogue.`);
        } catch (error) {
            showToast(error?.message || "Unable to restore the product.", "error");
        } finally {
            button.disabled = false;
            button.textContent = "Restore Product";
        }
    });
    $("#cancel-permanent-delete").addEventListener("click", closePermanentDeleteConfirmation);
    $("#confirm-permanent-delete").addEventListener("click", async event => {
        if (!permanentDeleteTarget) return;
        const product = permanentDeleteTarget;
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Deleting…";
        try {
            await deleteDoc(doc(db, "deletedProducts", product.apiId || product.id));
            closePermanentDeleteConfirmation();
            await loadData();
            notifyStorefrontChange();
            showToast(`${product.title} was permanently deleted.`);
        } catch (error) {
            showToast(error?.message || "Unable to permanently delete the product.", "error");
        } finally {
            button.disabled = false;
            button.textContent = "Delete Permanently";
        }
    });
    ["#restore-confirm-modal", "#permanent-delete-modal"].forEach(selector => $(selector).addEventListener("click", event => {
        if (event.target !== event.currentTarget) return;
        if (selector === "#restore-confirm-modal") restoreTarget = null;
        else return closePermanentDeleteConfirmation();
        event.currentTarget.classList.add("hidden");
    }));
    $("#homepage-products").addEventListener("click", event => {
        if (popularMode !== "manual") return;
        const item = event.target.closest(".homepage-product"); if (!item || !event.target.closest(".toggle-popular")) return;
        const id = item.dataset.id;
        const product = products.find(entry => String(entry.id) === id);
        if (!product) return;
        updateHomepageSelection(product, popularIds.includes(id) ? "remove" : "add", item);
    });
    $("#popular-selection").addEventListener("click", event => {
        if (popularMode !== "manual") return;
        const item = event.target.closest(".popular-item");
        if (!item || !event.target.closest(".remove-popular")) return;
        const product = products.find(entry => String(entry.id) === item.dataset.id);
        if (product) updateHomepageSelection(product, "remove");
    });
    initializeHomepagePopularReorder();
    $("#cancel-homepage-removal").addEventListener("click", closeHomepageRemovalConfirmation);
    $("#confirm-homepage-removal").addEventListener("click", () => {
        if (!homepageRemovalTarget) return;
        const id = String(homepageRemovalTarget.id);
        popularIds = popularIds.filter(value => value !== id);
        closeHomepageRemovalConfirmation();
        renderPopularSelection();
        updateHomepageProductCard(id, false);
    });
    $("#homepage-removal-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeHomepageRemovalConfirmation();
    });
    $("#discount-products").addEventListener("click", event => {
        if (discountMode !== "manual") return;
        const item = event.target.closest(".homepage-product");
        if (!item || !event.target.closest(".toggle-discount")) return;
        const product = products.find(entry => String(entry.id) === item.dataset.id);
        if (!product) return;
        updateDiscountSelection(product, isHomepageDiscount(item.dataset.id) ? "remove" : "add", item);
    });
    $("#cancel-homepage-addition").addEventListener("click", closeHomepageAdditionConfirmation);
    $("#confirm-homepage-addition").addEventListener("click", async event => {
        if (!homepageAdditionTarget) return;
        const { product, section, sourceCard } = homepageAdditionTarget;
        const previousPopularIds = [...popularIds];
        const previousDiscountSelections = discountSelections.map(item => ({ ...item }));
        const button = event.currentTarget;
        const buttonLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Saving…";
        const updated = section === "popular"
            ? updateHomepageSelection(product, "add", sourceCard, false)
            : updateDiscountSelection(product, "add", sourceCard, false);
        if (!updated) {
            button.disabled = false;
            button.textContent = buttonLabel;
            return;
        }
        clearTimeout(homepageAutosaveTimer);
        homepageAutosaveMessage = "";
        try {
            homepageAutosaveQueue = homepageAutosaveQueue.then(saveHomepageSettings);
            await homepageAutosaveQueue;
            await verifyHomepageAddition(section, product.id);
            notifyStorefrontChange();
            closeHomepageAdditionConfirmation();
            showToast(`${product.title} added to ${section === "popular" ? "Popular" : "Discount Products"}.`);
        } catch (error) {
            popularIds = previousPopularIds;
            discountSelections = previousDiscountSelections;
            renderHomepage();
            homepageAutosaveQueue = Promise.resolve();
            showToast(error?.message || "Unable to save the homepage change.", "error");
        } finally {
            button.disabled = false;
            button.textContent = buttonLabel;
        }
    });
    $("#homepage-addition-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeHomepageAdditionConfirmation();
    });
    $("#cancel-homepage-setting").addEventListener("click", closeHomepageSettingConfirmation);
    $("#confirm-homepage-setting").addEventListener("click", async event => {
        if (!homepageSettingTarget) return;
        const { type, value } = homepageSettingTarget;
        const previousState = {
            popularMode,
            discountMode,
            discountEnabled: discountSectionEnabled,
            campaign: discountCampaignLabel,
            popularIds: [...popularIds],
            discounts: discountSelections.map(item => ({ ...item }))
        };
        const button = event.currentTarget;
        const buttonLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Saving…";
        if (type === "campaign") {
            discountCampaignLabel = value;
            $("#discount-campaign-label").value = value;
            productDropdownSync.get($("#discount-campaign-label"))?.();
            $("#discount-campaign-preview").textContent = value;
            renderHomepageSectionOrder();
        } else if (type === "popularMode") {
            popularMode = value;
            syncHomepageSectionStates();
            renderHomepage();
        } else if (type === "discountMode") {
            discountMode = value;
            syncHomepageSectionStates();
            renderHomepage();
        } else {
            $("#offer-section-enabled").checked = value;
            syncHomepageSectionStates();
        }
        clearTimeout(homepageAutosaveTimer);
        homepageAutosaveMessage = "";
        try {
            homepageAutosaveQueue = homepageAutosaveQueue.then(saveHomepageSettings);
            await homepageAutosaveQueue;
            notifyStorefrontChange();
            closeHomepageSettingConfirmation();
            showToast(type === "campaign"
                ? `Campaign changed to ${value}.`
                : type === "popularMode"
                    ? `Popular Products switched to ${value}.`
                    : type === "discountMode"
                        ? `Discount Products switched to ${value}.`
                    : `Discount Products ${value ? "shown" : "hidden"}.`);
        } catch (error) {
            popularMode = previousState.popularMode;
            discountMode = previousState.discountMode;
            discountSectionEnabled = previousState.discountEnabled;
            discountCampaignLabel = previousState.campaign;
            popularIds = previousState.popularIds;
            discountSelections = previousState.discounts;
            $("#popular-mode-automatic").checked = popularMode === "automatic";
            $("#discount-mode-automatic").checked = discountMode === "automatic";
            $("#offer-section-enabled").checked = discountSectionEnabled;
            $("#discount-campaign-label").value = discountCampaignLabel;
            productDropdownSync.get($("#discount-campaign-label"))?.();
            $("#discount-campaign-preview").textContent = discountCampaignLabel;
            renderHomepageSectionOrder();
            syncHomepageSectionStates();
            renderHomepage();
            homepageAutosaveQueue = Promise.resolve();
            showToast(error?.message || "Unable to save the homepage setting.", "error");
        } finally {
            button.disabled = false;
            button.textContent = buttonLabel;
        }
    });
    $("#homepage-setting-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeHomepageSettingConfirmation();
    });
    $("#discount-selection").addEventListener("click", event => {
        if (discountMode !== "manual") return;
        const item = event.target.closest(".discount-item");
        if (!item || !event.target.closest(".remove-discount")) return;
        const product = products.find(entry => String(entry.id) === item.dataset.id);
        if (product) updateDiscountSelection(product, "remove");
    });
    initializeHomepageDiscountReorder();
    $("#discount-selection").addEventListener("input", event => {
        if (discountMode !== "manual") return;
        const input = event.target.closest(".discount-percent-input");
        if (!input) return;
        const selection = discountSelection(input.closest(".discount-item")?.dataset.id);
        if (selection) {
            selection.percent = Math.min(95, Math.max(1, Math.round(Number(input.value) || 1)));
            if ($("#homepage-campaign-source").value === "discounts" && $("#homepage-campaign-sync").checked) {
                syncLinkedCampaignControls({ refreshContent: true });
            }
        }
    });
    $("#discount-selection").addEventListener("change", event => {
        if (discountMode !== "manual") return;
        const input = event.target.closest(".discount-percent-input");
        if (!input) return;
        const selection = discountSelection(input.closest(".discount-item")?.dataset.id);
        if (!selection) return;
        input.value = String(selection.percent);
    });
    $("#cancel-discount-removal").addEventListener("click", closeDiscountRemovalConfirmation);
    $("#confirm-discount-removal").addEventListener("click", () => {
        if (!discountRemovalTarget) return;
        const id = String(discountRemovalTarget.id);
        discountSelections = discountSelections.filter(item => item.id !== id);
        closeDiscountRemovalConfirmation();
        renderDiscountSelection();
        if ($("#homepage-campaign-source").value === "discounts" && $("#homepage-campaign-sync").checked) {
            syncLinkedCampaignControls({ refreshContent: true });
        }
        syncDiscountPickerAvailability();
        updateHomepageProductCard(id, false);
    });
    $("#discount-removal-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeDiscountRemovalConfirmation();
    });
}

window.addEventListener("pagehide", () => {
    for (const key of pendingHomepageHeroImageKeys) deleteImage(key, { keepalive: true }).catch(() => {});
    pendingHomepageHeroImageKeys.clear();
});

if (!redirectingToDashboard) onAuthStateChanged(auth, async user => {
    if (!user) return void (window.location.href = "admin-login.html");
    try {
        if (user.role !== "admin") {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists() || userDoc.data().role !== "admin") return void (window.location.href = "admin-login.html");
        }
        db.kind = "admin";
        bindEvents();
        await loadData();
        $("#management-app").hidden = false;
        $("#management-page-loading").remove();
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    } catch (error) {
        const loading = $("#management-page-loading");
        loading?.classList.add("error");
        if (loading) loading.querySelector("p").textContent = "MPWR Management is temporarily busy. Please refresh in a moment.";
        showToast(error?.message || "Unable to load MPWR Management.", "error");
    }
});
