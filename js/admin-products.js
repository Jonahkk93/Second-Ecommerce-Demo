import { onAuthStateChanged } from "./auth-api.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getManagementBootstrap, setDoc, updateDoc } from "./firestore-api.js?v=20260928-2";
import { deleteImage, uploadImage } from "./media-api.js";
import { openReviewLightbox } from "./review-lightbox.js?v=20260923-3";

const auth = window.auth;
const db = window.db;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const DEFAULT_CATEGORIES = [
    { slug: "press-ons", label: "Press-On Nails" },
    { slug: "wigs", label: "Wigs" },
    { slug: "lashes", label: "Lashes" },
    { slug: "products", label: "Products" }
];
const UNCATEGORIZED_CATEGORY = "uncategorized";
const categoryLabels = Object.fromEntries(DEFAULT_CATEGORIES.map(category => [category.slug, category.label]));
categoryLabels[UNCATEGORIZED_CATEGORY] = "No Category";
const POPULAR_PRODUCT_LIMIT = 10;
const HOMEPAGE_DISCOUNT_PRODUCT_LIMIT = 10;
const SEARCH_POPULAR_PRODUCT_LIMIT = 12;
const HOMEPAGE_HERO_IMAGE_LIMIT = 10;
const DEFAULT_SEARCH_SUGGESTIONS = ["Press-ons", "Wigs", "Lashes", "Nail polish", "Moisturizer", "Pink", "Black", "Shoulder"];
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
    eyebrow: "Limited Offers",
    heading: "15% off selected favourites",
    body: "Bring your next beauty refresh home for less with limited-time campaign deals.",
    buttonLabel: "Shop offers",
    buttonLink: "#discounts",
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

function normalizeDiscountCampaignLabel(label) {
    const normalizedLabel = LEGACY_DISCOUNT_CAMPAIGN_LABELS[label] || label;
    return DISCOUNT_CAMPAIGN_LABELS.includes(normalizedLabel) ? normalizedLabel : DISCOUNT_CAMPAIGN_LABELS[0];
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
let homepageHeroPreviewImage = "";
let homepageHeroPreviewTimer = null;
let homepageHeroPreviewFadeTimer = null;
let homepageHeroPreviewTransitionToken = 0;
let homepageHeroPreviewPlaying = false;
let campaignBanner = { ...DEFAULT_CAMPAIGN_BANNER };
let searchSettings = { suggestions: [...DEFAULT_SEARCH_SUGGESTIONS], popularProducts: [], popularMode: "automatic", suggestionsEnabled: true, popularEnabled: true, suggestionsHeading: "Suggested searches", popularHeading: "Popular picks", defaultSort: "relevance" };
let editingProduct = null;
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
let categorySlugEdited = false;
let categoryProductIds = new Set();
let categoryReassignmentIds = new Set();
let categoryReassignmentTarget = null;
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

function normalizeAnnouncementBar(value = {}) {
    return {
        enabled: value.enabled !== false,
        message: cleanHeroText(value.message, DEFAULT_ANNOUNCEMENT_BAR.message, 120),
        linkLabel: cleanHeroText(value.linkLabel, DEFAULT_ANNOUNCEMENT_BAR.linkLabel, 32),
        link: cleanHeroText(value.link, DEFAULT_ANNOUNCEMENT_BAR.link, 140)
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

function renderAnnouncementBarPreview() {
    const announcement = readAnnouncementBarForm();
    const preview = $("#homepage-announcement-preview");
    preview.classList.toggle("is-hidden", !announcement.enabled);
    $(".homepage-announcement-toggle-label").textContent = announcement.enabled ? "Shown" : "Hidden";
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
        const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname) || parsed.hostname === "google.com";
        if (isGoogle) {
            const embeddedImage = parsed.searchParams.get("imgurl")
                || parsed.searchParams.get("mediaurl")
                || parsed.searchParams.get("image_url");
            if (embeddedImage) candidate = embeddedImage;
        }
    } catch {}
    return candidate;
}

function isGooglePageLink(value) {
    try {
        const parsed = new URL(value);
        const googleHost = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname) || parsed.hostname === "google.com";
        const googleShareLink = parsed.hostname === "images.app.goo.gl";
        return (googleHost || googleShareLink) && !parsed.searchParams.get("imgurl") && !parsed.searchParams.get("mediaurl") && !parsed.searchParams.get("image_url");
    } catch {
        return false;
    }
}

function syncHomepageHeroUrlFields(images) {
    [...document.querySelectorAll(".homepage-hero-url-input")].forEach((field, index) => {
        const item = images.find(image => image.slot === index + 1);
        const filledByPhoto = Boolean(item && (item.source === "upload" || item.key));
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
        buttonLink: cleanHeroText(value.buttonLink, DEFAULT_HOMEPAGE_HERO.buttonLink, 140),
        image: images[0]?.url || "",
        imageKey: images[0]?.key || "",
        images
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
        images
    });
    return homepageHero;
}

function renderHomepageHeroPreview({ syncMedia = true } = {}) {
    const hero = readHomepageHeroForm();
    const preview = $("#homepage-hero-preview");
    preview.classList.toggle("is-hidden", !hero.enabled);
    $(".homepage-hero-toggle-label").textContent = hero.enabled ? "Shown" : "Hidden";
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
    button.querySelector(".management-storefront-hero-play-icon").textContent = homepageHeroPreviewPlaying ? "■" : "▶";
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
        image.loading = "eager";
        image.decoding = "async";
        return image;
    });
    media.replaceChildren(...slides);
    const imageReady = slides.map(image => image.decode().catch(() => {}));
    let activeIndex = startIndex;
    let pendingIndex = null;
    homepageHeroPreviewPlaying = true;
    updateHomepageHeroPreviewPlayButton(hero.images);
    updateHomepageHeroPreviewCount(hero.images[activeIndex].url, hero.images);

    const showSlide = async index => {
        const nextIndex = (index + slides.length) % slides.length;
        if (!homepageHeroPreviewPlaying || nextIndex === activeIndex || nextIndex === pendingIndex) return;
        pendingIndex = nextIndex;
        const token = ++homepageHeroPreviewTransitionToken;
        await imageReady[nextIndex];
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
    $("#homepage-hero-enabled").checked = homepageHero.enabled !== false;
    $("#homepage-hero-eyebrow").value = homepageHero.eyebrow;
    $("#homepage-hero-heading").value = homepageHero.heading;
    const bodyField = $("#homepage-hero-body");
    bodyField.value = homepageHero.body;
    window.MPWRAutoGrowTextareas?.prepare(bodyField);
    $("#homepage-hero-button-label").value = homepageHero.buttonLabel;
    $("#homepage-hero-button-link").value = homepageHero.buttonLink;
    syncHomepageHeroUrlFields(homepageHero.images);
    $("#homepage-hero-image").value = homepageHero.image;
    $("#homepage-hero-image-key").value = homepageHero.imageKey || "";
    $("#homepage-hero-images").value = JSON.stringify(homepageHero.images);
    renderHomepageHeroPreview();
}

function normalizeCampaignBanner(value = {}) {
    return {
        enabled: value.enabled !== false,
        eyebrow: cleanHeroText(value.eyebrow, DEFAULT_CAMPAIGN_BANNER.eyebrow, 40),
        heading: cleanHeroText(value.heading, DEFAULT_CAMPAIGN_BANNER.heading, 80),
        body: cleanHeroText(value.body, DEFAULT_CAMPAIGN_BANNER.body, 180),
        buttonLabel: cleanHeroText(value.buttonLabel, DEFAULT_CAMPAIGN_BANNER.buttonLabel, 32),
        buttonLink: cleanHeroText(value.buttonLink, DEFAULT_CAMPAIGN_BANNER.buttonLink, 140),
        image: cleanHeroText(value.image, DEFAULT_CAMPAIGN_BANNER.image, 500),
        imageKey: cleanHeroText(value.imageKey, "", 500)
    };
}

function readCampaignBannerForm() {
    campaignBanner = normalizeCampaignBanner({
        enabled: $("#homepage-campaign-enabled").checked,
        eyebrow: $("#homepage-campaign-eyebrow").value,
        heading: $("#homepage-campaign-heading").value,
        body: $("#homepage-campaign-body").value,
        buttonLabel: $("#homepage-campaign-button-label").value,
        buttonLink: $("#homepage-campaign-button-link").value,
        image: $("#homepage-campaign-image").value,
        imageKey: $("#homepage-campaign-image-key").value
    });
    return campaignBanner;
}

function renderCampaignBannerPreview() {
    const banner = readCampaignBannerForm();
    const preview = $("#homepage-campaign-preview");
    preview.classList.toggle("is-hidden", !banner.enabled);
    $(".homepage-campaign-toggle-label").textContent = banner.enabled ? "Shown" : "Hidden";
    preview.querySelector(".hero-preview-eyebrow").textContent = banner.eyebrow;
    preview.querySelector("h3").textContent = banner.heading;
    preview.querySelector(".hero-preview-body").textContent = banner.body;
    preview.querySelector(".hero-preview-button").textContent = banner.buttonLabel;
    const image = preview.querySelector("img");
    image.src = banner.image;
    image.alt = banner.heading;
    syncBannerMediaControl("campaign", banner.image);
}

function syncCampaignBannerForm() {
    $("#homepage-campaign-enabled").checked = campaignBanner.enabled !== false;
    $("#homepage-campaign-eyebrow").value = campaignBanner.eyebrow;
    $("#homepage-campaign-heading").value = campaignBanner.heading;
    const bodyField = $("#homepage-campaign-body");
    bodyField.value = campaignBanner.body;
    window.MPWRAutoGrowTextareas?.prepare(bodyField);
    $("#homepage-campaign-button-label").value = campaignBanner.buttonLabel;
    $("#homepage-campaign-button-link").value = campaignBanner.buttonLink;
    $("#homepage-campaign-image").value = campaignBanner.image;
    $("#homepage-campaign-image-key").value = campaignBanner.imageKey || "";
    renderCampaignBannerPreview();
}

function syncBannerMediaControl(prefix, imageUrl, statusText = "Current image") {
    const container = $(`[data-banner-media="${prefix}"]`);
    if (!container) return;
    container.querySelector(".banner-media-thumbnail").src = imageUrl;
    container.querySelector(".banner-media-status").textContent = statusText;
}

function syncHeroMediaControl(images, statusText = "") {
    const container = $('[data-banner-media="hero"]');
    const previews = container?.querySelector(".banner-media-previews");
    if (!previews) return;
    previews.innerHTML = Array.from({ length: HOMEPAGE_HERO_IMAGE_LIMIT }, (_item, index) => {
        const slot = index + 1;
        const imageIndex = images.findIndex(item => item.slot === slot);
        const item = images[imageIndex];
        if (!item) return `<span class="banner-media-empty" data-slot="${slot}" aria-label="Empty hero image slot ${slot}"></span>`;
        if (item.source !== "upload" && !item.key) return `<span class="banner-media-empty is-filled-by-url" data-slot="Filled" aria-label="Hero image slot ${slot} is filled by an image URL"></span>`;
        return `<div class="banner-media-preview${item.url === homepageHeroPreviewImage ? " is-previewing" : ""}"><button class="hero-media-preview-button" type="button" data-hero-image-preview="${imageIndex}" aria-label="Show hero slide ${slot} in the preview"><img class="banner-media-thumbnail" src="${escapeHtml(item.url)}" alt="Hero slide ${slot}"></button><button class="banner-media-reset" type="button" data-hero-image-remove="${imageIndex}" aria-label="Remove hero slide ${slot}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button></div>`;
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

    async function uploadHeroFiles(files) {
        const additions = [...files];
        if (!additions.length) return;
        const savedImages = currentImages();
        const existing = savedImages.length === 1 && savedImages[0].url === DEFAULT_HOMEPAGE_HERO.image && !savedImages[0].key
            ? []
            : savedImages;
        if (existing.length + additions.length > HOMEPAGE_HERO_IMAGE_LIMIT) return showToast(`You can add up to ${HOMEPAGE_HERO_IMAGE_LIMIT} hero photos.`, "error");
        if (additions.some(file => !acceptedTypes.has(file.type))) return showToast("Choose JPG, PNG, WebP or GIF images.", "error");
        if (additions.some(file => file.size > 50 * 1024 * 1024)) return showToast("Each hero image must be 50 MB or smaller.", "error");

        dropzone.classList.add("is-uploading");
        status.textContent = additions.length > 1 ? `Uploading ${additions.length} photos…` : `Uploading ${additions[0].name}…`;
        const uploadedImages = [];
        const occupiedSlots = new Set(existing.map((item, index) => item.slot || index + 1));
        try {
            for (const file of additions) {
                const uploaded = await uploadImage(file, "banner");
                const slot = Array.from({ length: HOMEPAGE_HERO_IMAGE_LIMIT }, (_item, index) => index + 1).find(value => !occupiedSlots.has(value));
                if (!slot) break;
                occupiedSlots.add(slot);
                uploadedImages.push({ url: uploaded.url, key: uploaded.key || "", source: "upload", slot });
            }
            const next = [...existing, ...uploadedImages].slice(0, HOMEPAGE_HERO_IMAGE_LIMIT);
            setImages(next, `${next.length} hero ${next.length === 1 ? "photo" : "photos"} staged · Click Save Changes to publish`);
        } catch (error) {
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
    previews.addEventListener("click", event => {
        const button = event.target.closest("[data-hero-image-remove]");
        if (button) {
            const next = currentImages().filter((_item, index) => index !== Number(button.dataset.heroImageRemove));
            setImages(next, "Hero photo removed · Save homepage to publish");
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
    container.querySelector(".hero-url-grid").addEventListener("click", event => {
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
    const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

    async function uploadBannerFile(file) {
        if (!file) return;
        if (!acceptedTypes.has(file.type)) return showToast("Choose a JPG, PNG, WebP or GIF image.", "error");
        if (file.size > 10 * 1024 * 1024) return showToast("Banner images must be 10 MB or smaller.", "error");

        const previousUrl = urlInput.value;
        const previousKey = keyInput.value;
        const localPreview = URL.createObjectURL(file);
        urlInput.value = localPreview;
        keyInput.value = "";
        dropzone.classList.add("is-uploading");
        status.textContent = `Uploading ${file.name}…`;
        render();

        try {
            const uploaded = await uploadImage(file, "banner");
            urlInput.value = uploaded.url;
            keyInput.value = uploaded.key || "";
            render();
            syncBannerMediaControl(prefix, uploaded.url, `${file.name} uploaded · Save homepage to publish`);
            showToast("Banner image uploaded. Save homepage to publish it.");
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
    urlInput.addEventListener("input", () => { keyInput.value = ""; });
    resetButton.addEventListener("click", () => {
        urlInput.value = defaultImage;
        keyInput.value = "";
        render();
        syncBannerMediaControl(prefix, defaultImage, "Default image restored · Save homepage to publish");
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
    if (panel === "homepage") requestAnimationFrame(syncHomepagePanelHeights);
    if (panel === "search") requestAnimationFrame(renderSearchSettings);

    if (updateHistory) {
        const nextHash = `#${panelHashes[panel]}`;
        if (window.location.hash !== nextHash) window.history.pushState({ managementPanel: panel }, "", nextHash);
    }
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
    renderPopularSelection();
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
        renderPopularSelection();
    }
    updateHomepageProductCard(id, action === "add");
    renderDiscountSelection();
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
    renderCategoryOrder();
}

function renderCategoryOrder() {
    const list = $("#category-order-list");
    if (!list) return;
    list.innerHTML = categories.map((category, index) => `
        <article class="category-order-item" draggable="true" data-slug="${escapeHtml(category.slug)}">
            <span class="category-order-drag" aria-hidden="true">☰</span>
            <div><strong>${escapeHtml(category.label)}</strong><small>${escapeHtml(category.slug)}</small></div>
            <div class="category-order-actions">
                <button type="button" data-category-move="up" ${index === 0 ? "disabled" : ""} aria-label="Move ${escapeHtml(category.label)} up">↑</button>
                <button type="button" data-category-move="down" ${index === categories.length - 1 ? "disabled" : ""} aria-label="Move ${escapeHtml(category.label)} down">↓</button>
            </div>
        </article>
    `).join("");
}

function moveCategory(slug, direction) {
    const index = categories.findIndex(category => category.slug === slug);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= categories.length) return;
    const nextCategories = [...categories];
    [nextCategories[index], nextCategories[nextIndex]] = [nextCategories[nextIndex], nextCategories[index]];
    categories = nextCategories;
    syncCategoryControls();
}

function reorderCategoryBefore(dragSlug, targetSlug) {
    if (!dragSlug || !targetSlug || dragSlug === targetSlug) return;
    const dragged = categories.find(category => category.slug === dragSlug);
    if (!dragged) return;
    const withoutDragged = categories.filter(category => category.slug !== dragSlug);
    const targetIndex = withoutDragged.findIndex(category => category.slug === targetSlug);
    if (targetIndex < 0) return;
    categories = [...withoutDragged.slice(0, targetIndex), dragged, ...withoutDragged.slice(targetIndex)];
    syncCategoryControls();
}

function syncCategoryProductSelection() {
    const count = categoryProductIds.size;
    $("#category-product-selection-count").textContent = `${count} product${count === 1 ? "" : "s"} selected`;
    $("#save-category").disabled = count === 0;
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
    const bootstrap = await getManagementBootstrap(db);
    const popularSetting = bootstrap.settings.popular || {};
    const bestsellerSetting = bootstrap.settings.bestsellers || {};
    const discountSetting = bootstrap.settings.discounts || {};
    const announcementSetting = bootstrap.settings.announcementBar || {};
    const heroSetting = bootstrap.settings.homepageHero || {};
    const campaignSetting = bootstrap.settings.campaignBanner || {};
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
    homepageHero = normalizeHomepageHero(heroSetting);
    campaignBanner = normalizeCampaignBanner(campaignSetting);
    searchSettings = {
        suggestions: Array.isArray(storedSearch.suggestions) ? storedSearch.suggestions.map(String).filter(Boolean).slice(0, 20) : [...DEFAULT_SEARCH_SUGGESTIONS],
        popularProducts: Array.isArray(storedSearch.popularProducts) ? storedSearch.popularProducts.map(item => String(item.id || item)).slice(0, SEARCH_POPULAR_PRODUCT_LIMIT) : [],
        popularMode: storedSearch.popularMode === "manual" ? "manual" : "automatic",
        suggestionsEnabled: storedSearch.suggestionsEnabled !== false,
        popularEnabled: storedSearch.popularEnabled !== false,
        suggestionsHeading: String(storedSearch.suggestionsHeading || "Suggested searches").slice(0, 60),
        popularHeading: String(storedSearch.popularHeading || "Popular picks").slice(0, 60),
        defaultSort: ["relevance", "popular", "newest", "low", "high"].includes(storedSearch.defaultSort) ? storedSearch.defaultSort : "relevance"
    };
    $("#popular-mode-automatic").checked = popularMode === "automatic";
    $("#discount-mode-automatic").checked = discountMode === "automatic";
    $("#offer-section-enabled").checked = discountSectionEnabled;
    syncAnnouncementBarForm();
    syncHomepageHeroForm();
    syncCampaignBannerForm();
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

function renderPopularSelection() {
    const selectedIds = popularMode === "automatic"
        ? automaticPopularSelectionIds()
        : popularIds.filter(id => !discountSectionEnabled || discountMode !== "automatic" || !isHomepageDiscount(id));
    const selected = selectedIds.map(id => products.find(product => String(product.id) === id)).filter(Boolean);
    $("#popular-selection-help").classList.add("hidden");
    const automatic = popularMode === "automatic";
    const productsMarkup = selected.map((product, index) => `<div class="popular-item ${automatic ? "is-automatic" : ""}" draggable="${automatic ? "false" : "true"}" data-id="${escapeHtml(product.id)}">
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
    $("#popular-selection").insertAdjacentHTML("beforeend", `<div class="popular-item" draggable="true" data-id="${escapeHtml(product.id)}">
        <span class="popular-rank" aria-label="Position ${index + 1}">${index + 1}</span>
        <div class="popular-item-card">
            <img class="popular-item-image" src="${escapeHtml(productImage(product))}" alt="">
            <div class="popular-item-details"><strong>${escapeHtml(product.title)}</strong><small>${formatMoney(product.price)}</small></div>
            <button type="button" class="remove-popular" aria-label="Remove ${escapeHtml(product.title)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button>
        </div>
    </div>`);
    $("#popular-selection-help").classList.add("hidden");
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
    $$("#popular-selection .popular-item").forEach((item, index) => {
        const rank = item.querySelector(".popular-rank");
        rank.textContent = String(index + 1);
        rank.setAttribute("aria-label", `Position ${index + 1}`);
    });
    $("#popular-selection-help").classList.toggle("hidden", popularIds.length > 0);
}

function discountSelectionMarkup(product, index, selection = discountSelection(product.id)) {
    const automatic = discountMode === "automatic";
    const salesLabel = automaticPopularSales.has(String(product.id))
        ? `${automaticPopularSales.get(String(product.id))} sold in 30 days · ${selection?.percent || 15}% off`
        : `Automatic fallback · ${selection?.percent || 15}% off`;
    return `<div class="popular-item discount-item ${automatic ? "is-automatic" : ""}" draggable="${automatic ? "false" : "true"}" data-id="${escapeHtml(product.id)}">
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

function renderDiscountProducts() {
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
    $("#discount-selection").insertAdjacentHTML("beforeend", discountSelectionMarkup(product, index));
    $("#discount-selection-help").classList.add("hidden");
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
    $$("#discount-selection .discount-item").find(item => item.dataset.id === String(id))?.remove();
    $$("#discount-selection .discount-item").forEach((item, index) => {
        const rank = item.querySelector(".popular-rank");
        rank.textContent = String(index + 1);
        rank.setAttribute("aria-label", `Position ${index + 1}`);
    });
    $("#discount-selection-help").classList.toggle("hidden", homepageDiscountSelections().length > 0);
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

function renderSearchSettings() {
    if (!$("#search-suggestion-list")) return;
    $("#search-suggestions-enabled").checked = searchSettings.suggestionsEnabled;
    $("#search-popular-enabled").checked = searchSettings.popularEnabled;
    $("#search-popular-automatic").checked = searchSettings.popularMode === "automatic";
    $("#search-suggestions-heading").value = searchSettings.suggestionsHeading;
    $("#search-popular-heading").value = searchSettings.popularHeading;
    $("#search-default-sort").value = searchSettings.defaultSort;
    $("#search-default-sort").managementPickerSync?.();
    $("#search-suggestions-enabled").closest(".toggle-row").querySelector(".search-toggle-label").textContent = searchSettings.suggestionsEnabled ? "Shown" : "Hidden";
    $("#search-popular-enabled").closest(".toggle-row").querySelector(".search-toggle-label").textContent = searchSettings.popularEnabled ? "Shown" : "Hidden";
    $(".search-mode-label").textContent = searchSettings.popularMode === "automatic" ? "Automatic" : "Manual";
    $("#search-suggestion-list").innerHTML = searchSettings.suggestions.map((label, index) => `<div class="search-suggestion-row" data-index="${index}"><button class="search-suggestion-drag" type="button" aria-label="Drag ${escapeHtml(label)} to reorder"><img src="images/Icon Folder/Menu Bar Icon_Gray.PNG" alt=""></button><span>${escapeHtml(label)}</span><button type="button" data-remove aria-label="Remove ${escapeHtml(label)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button></div>`).join("") || '<p class="search-setting-empty">No suggested searches added.</p>';
    const query = $("#search-popular-product-search").value.trim().toLowerCase();
    const manual = searchSettings.popularMode === "manual";
    const selected = new Set(searchSettings.popularProducts);
    $("#search-popular-products").innerHTML = products.filter(product => isStorefrontActive(product) && (!query || `${product.title} ${product.category || ""}`.toLowerCase().includes(query))).map(product => {
        const id = String(product.id);
        const selectedIndex = searchSettings.popularProducts.indexOf(id);
        const controls = selected.has(id) && manual
            ? `<div class="search-product-controls"><button type="button" data-move="up" aria-label="Move ${escapeHtml(product.title)} up">↑</button><button type="button" data-move="down" aria-label="Move ${escapeHtml(product.title)} down">↓</button><button type="button" data-toggle aria-label="Remove ${escapeHtml(product.title)}">✓</button></div>`
            : `<button type="button" data-toggle ${manual ? "" : "disabled"} aria-label="${selected.has(id) ? "Remove" : "Add"} ${escapeHtml(product.title)}">${selected.has(id) ? "✓" : "+"}</button>`;
        return `<div class="search-product-row ${selected.has(id) ? "selected" : ""}" data-id="${escapeHtml(id)}"><img src="${escapeHtml(productImage(product))}" alt=""><div><strong>${escapeHtml(product.title)}</strong><small>${selected.has(id) ? `Selected · position ${selectedIndex + 1}` : (categoryLabels[productCategory(product)] || "Products")}</small></div>${controls}</div>`;
    }).join("");
    $("#search-popular-product-search").disabled = !manual;
    $("#search-popular-products").classList.toggle("is-disabled", !manual);
    $("#search-preview-suggestions-heading").textContent = searchSettings.suggestionsHeading;
    $("#search-preview-suggestions-heading").hidden = !searchSettings.suggestionsEnabled;
    $("#search-preview-chips").hidden = !searchSettings.suggestionsEnabled;
    $("#search-preview-chips").innerHTML = searchSettings.suggestions.map(label => `<span>${escapeHtml(label)}</span>`).join("");
    $("#search-preview-popular-heading").textContent = searchSettings.popularHeading;
    $("#search-preview-popular-heading").hidden = !searchSettings.popularEnabled;
    $("#search-preview-products").hidden = !searchSettings.popularEnabled;
    $("#search-preview-products").innerHTML = searchPopularSelection().slice(0, 6).map(product => `<div><img src="${escapeHtml(productImage(product))}" alt=""><span>${escapeHtml(product.title)}</span></div>`).join("");
}

async function saveSearchSettings() {
    const selected = searchSettings.popularProducts.map(id => products.find(product => String(product.id) === id)).filter(Boolean);
    await setDoc(doc(db, "storefront", "search"), { ...searchSettings, popularProducts: selected.map(product => ({ id: String(product.id), title: product.title, image: productImage(product) })) });
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

function closeEditor() {
    pendingMediaPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    pendingMediaPreviewUrls = [];
    selectedMediaFiles = [];
    removedExistingImageUrls = new Set();
    $(".product-modal").classList.add("hidden");
    document.body.classList.remove("product-editor-open");
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
    document.body.classList.add("product-editor-open");
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
    offerPreview?.classList.toggle("section-disabled", !discountSectionEnabled);
    offerLayout?.classList.toggle("section-disabled", !discountSectionEnabled);
    if (offerPreview) offerPreview.querySelector(".popular-selection").inert = !discountSectionEnabled;
    if (offerLayout) offerLayout.querySelector(".homepage-picker-card").inert = !discountSectionEnabled;
    const offerLabel = offerToggle.closest(".homepage-section-toggle")?.querySelector(".homepage-section-toggle-label");
    if (offerLabel) offerLabel.textContent = discountSectionEnabled ? "Shown" : "Hidden";
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
    renderHomepageProducts();
    syncDiscountPickerAvailability();
}

async function saveHomepageSettings({ includeHero = false } = {}) {
    const saves = [savePopularSetting(), saveDiscountSetting(), saveAnnouncementBar(), saveCampaignBanner(), saveCategorySetting()];
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
    await setDoc(doc(db, "storefront", "homepageHero"), hero);
    localStorage.setItem("mpwrHomepageHero", JSON.stringify(hero));
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
    button.disabled = true;
    button.textContent = "Saving category…";
    try {
        categories = [...categories, { slug, label, productIds: selectedProducts.map(product => String(product.id)) }];
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
        button.disabled = categoryProductIds.size === 0;
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

function bindEvents() {
    enhanceManagementSelect($("#search-default-sort"));
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
    let suggestionDrag = null;
    $("#search-suggestion-list").addEventListener("pointerdown", event => {
        const handle = event.target.closest(".search-suggestion-drag");
        const row = handle?.closest(".search-suggestion-row");
        if (!handle || !row) return;
        event.preventDefault();
        suggestionDrag = { row, handle, original: [...searchSettings.suggestions] };
        row.classList.add("dragging");
        handle.setPointerCapture(event.pointerId);
    });
    $("#search-suggestion-list").addEventListener("pointermove", event => {
        if (!suggestionDrag) return;
        event.preventDefault();
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".search-suggestion-row");
        if (!target || target === suggestionDrag.row || target.parentElement !== suggestionDrag.row.parentElement) return;
        const rect = target.getBoundingClientRect();
        target.parentElement.insertBefore(suggestionDrag.row, event.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
    });
    const finishSuggestionDrag = event => {
        if (!suggestionDrag) return;
        if (suggestionDrag.handle.hasPointerCapture(event.pointerId)) suggestionDrag.handle.releasePointerCapture(event.pointerId);
        searchSettings.suggestions = [...$("#search-suggestion-list").querySelectorAll(".search-suggestion-row")].map(row => suggestionDrag.original[Number(row.dataset.index)]);
        suggestionDrag.row.classList.remove("dragging");
        suggestionDrag = null;
        renderSearchSettings();
    };
    $("#search-suggestion-list").addEventListener("pointerup", finishSuggestionDrag);
    $("#search-suggestion-list").addEventListener("pointercancel", finishSuggestionDrag);
    $("#search-popular-products").addEventListener("click", event => {
        const row = event.target.closest(".search-product-row");
        if (!row || searchSettings.popularMode !== "manual" || !event.target.closest("button")) return;
        const id = row.dataset.id;
        const index = searchSettings.popularProducts.indexOf(id);
        if (event.target.closest('[data-move="up"]') && index > 0) [searchSettings.popularProducts[index - 1], searchSettings.popularProducts[index]] = [searchSettings.popularProducts[index], searchSettings.popularProducts[index - 1]];
        else if (event.target.closest('[data-move="down"]') && index >= 0 && index < searchSettings.popularProducts.length - 1) [searchSettings.popularProducts[index + 1], searchSettings.popularProducts[index]] = [searchSettings.popularProducts[index], searchSettings.popularProducts[index + 1]];
        else if (searchSettings.popularProducts.includes(id)) searchSettings.popularProducts = searchSettings.popularProducts.filter(value => value !== id);
        else if (searchSettings.popularProducts.length < SEARCH_POPULAR_PRODUCT_LIMIT) searchSettings.popularProducts.push(id);
        else return showToast(`Choose up to ${SEARCH_POPULAR_PRODUCT_LIMIT} Popular Picks.`, "error");
        renderSearchSettings();
    });
    $("#search-popular-product-search").addEventListener("input", renderSearchSettings);
    $("#search-suggestions-enabled").addEventListener("change", event => { searchSettings.suggestionsEnabled = event.target.checked; renderSearchSettings(); });
    $("#search-popular-enabled").addEventListener("change", event => { searchSettings.popularEnabled = event.target.checked; renderSearchSettings(); });
    $("#search-popular-automatic").addEventListener("change", event => { searchSettings.popularMode = event.target.checked ? "automatic" : "manual"; renderSearchSettings(); });
    $("#search-suggestions-heading").addEventListener("input", event => { searchSettings.suggestionsHeading = event.target.value.trimStart().slice(0, 60) || "Suggested searches"; $("#search-preview-suggestions-heading").textContent = searchSettings.suggestionsHeading; });
    $("#search-popular-heading").addEventListener("input", event => { searchSettings.popularHeading = event.target.value.trimStart().slice(0, 60) || "Popular picks"; $("#search-preview-popular-heading").textContent = searchSettings.popularHeading; });
    $("#search-default-sort").addEventListener("change", event => { searchSettings.defaultSort = event.target.value; });
    $("#save-search-settings").addEventListener("click", () => { $("#search-save-modal").classList.remove("hidden"); $("#confirm-search-save").focus(); });
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
    ["#category-filter", "#status-filter", "#product-category", "#product-status", "#product-shipping", "#discount-campaign-label"].forEach(selector => enhanceProductDropdown($(selector)));
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
    $("#category-order-list").addEventListener("click", event => {
        const button = event.target.closest("[data-category-move]");
        const item = event.target.closest(".category-order-item");
        if (!button || !item) return;
        moveCategory(item.dataset.slug, button.dataset.categoryMove);
    });
    $("#category-order-list").addEventListener("dragstart", event => {
        const item = event.target.closest(".category-order-item");
        if (!item) return;
        item.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.dataset.slug);
    });
    $("#category-order-list").addEventListener("dragend", event => {
        event.target.closest(".category-order-item")?.classList.remove("dragging");
    });
    $("#category-order-list").addEventListener("dragover", event => {
        const item = event.target.closest(".category-order-item");
        if (!item) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });
    $("#category-order-list").addEventListener("drop", event => {
        const item = event.target.closest(".category-order-item");
        if (!item) return;
        event.preventDefault();
        reorderCategoryBefore(event.dataTransfer.getData("text/plain"), item.dataset.slug);
    });
    ["#homepage-announcement-enabled", "#homepage-announcement-message", "#homepage-announcement-link-label", "#homepage-announcement-link"].forEach(selector => {
        const field = $(selector);
        field.addEventListener(field.type === "checkbox" ? "change" : "input", renderAnnouncementBarPreview);
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
    ["#homepage-campaign-enabled", "#homepage-campaign-eyebrow", "#homepage-campaign-heading", "#homepage-campaign-body", "#homepage-campaign-button-label", "#homepage-campaign-button-link", "#homepage-campaign-image"].forEach(selector => {
        const field = $(selector);
        field.addEventListener(field.type === "checkbox" ? "change" : "input", renderCampaignBannerPreview);
    });
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
    });
    $("#discount-campaign-label").addEventListener("change", event => {
        discountCampaignLabel = DISCOUNT_CAMPAIGN_LABELS.includes(event.target.value)
            ? event.target.value
            : DISCOUNT_CAMPAIGN_LABELS[0];
        event.target.value = discountCampaignLabel;
        productDropdownSync.get(event.target)?.();
        $("#discount-campaign-preview").textContent = discountCampaignLabel;
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
    $("#discount-selection").addEventListener("input", event => {
        if (discountMode !== "manual") return;
        const input = event.target.closest(".discount-percent-input");
        if (!input) return;
        const selection = discountSelection(input.closest(".discount-item")?.dataset.id);
        if (selection) {
            selection.percent = Math.min(95, Math.max(1, Math.round(Number(input.value) || 1)));
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
        syncDiscountPickerAvailability();
        updateHomepageProductCard(id, false);
    });
    $("#discount-removal-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeDiscountRemovalConfirmation();
    });
    let draggedId = null;
    $("#popular-selection").addEventListener("dragstart", event => { if (popularMode !== "manual") return event.preventDefault(); const item = event.target.closest(".popular-item"); if (item) { draggedId = item.dataset.id; item.classList.add("dragging"); } });
    $("#popular-selection").addEventListener("dragend", event => {
        event.target.closest(".popular-item")?.classList.remove("dragging");
        draggedId = null;
    });
    $("#popular-selection").addEventListener("dragover", event => { if (popularMode !== "manual") return; event.preventDefault(); const target = event.target.closest(".popular-item:not(.popular-item-placeholder)"); if (!draggedId || !target || target.dataset.id === draggedId) return; const from = popularIds.indexOf(draggedId); const to = popularIds.indexOf(target.dataset.id); popularIds.splice(to, 0, popularIds.splice(from, 1)[0]); renderPopularSelection(); });
    let draggedDiscountId = null;
    $("#discount-selection").addEventListener("dragstart", event => {
        if (discountMode !== "manual") return event.preventDefault();
        if (event.target.closest("input,button")) return event.preventDefault();
        const item = event.target.closest(".discount-item");
        if (item) { draggedDiscountId = item.dataset.id; item.classList.add("dragging"); }
    });
    $("#discount-selection").addEventListener("dragend", event => {
        event.target.closest(".discount-item")?.classList.remove("dragging");
        draggedDiscountId = null;
    });
    $("#discount-selection").addEventListener("dragover", event => {
        if (discountMode !== "manual") return;
        event.preventDefault();
        const target = event.target.closest(".discount-item:not(.popular-item-placeholder)");
        if (!draggedDiscountId || !target || target.dataset.id === draggedDiscountId) return;
        const from = discountSelections.findIndex(item => item.id === draggedDiscountId);
        const to = discountSelections.findIndex(item => item.id === target.dataset.id);
        discountSelections.splice(to, 0, discountSelections.splice(from, 1)[0]);
        renderDiscountSelection();
    });
}

onAuthStateChanged(auth, async user => {
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
