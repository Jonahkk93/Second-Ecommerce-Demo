import { onAuthStateChanged } from "./auth-api.js";
import { doc, getDoc, getManagementBootstrap, setDoc, updateDoc } from "./firestore-api.js?v=20261001-1";
import { uploadImage } from "./media-api.js?v=20260929-2";

const auth = window.auth;
const db = window.db;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const DEFAULT_CATEGORIES = [
    { slug: "press-ons", label: "Press-On Nails", image: "images/Icon Folder/Nails 3 Icon_Black.PNG" },
    { slug: "wigs", label: "Wigs", image: "images/optimized/wigs-icon.png" },
    { slug: "lashes", label: "Lashes", image: "images/optimized/lashes-icon.png" },
    { slug: "products", label: "Products", image: "images/Icon Folder/Products 2 Icon_333.PNG" }
];
const CATEGORY_STATUSES = new Set(["active", "hidden", "draft"]);
const CATEGORY_SORT_MODES = new Set(["manual", "newest", "price-low", "price-high", "discounted", "in-stock", "name"]);
const CATEGORY_BADGES = new Set(["", "New", "Hot", "Sale", "Trending", "Limited"]);
const UNCATEGORIZED_CATEGORY = "uncategorized";

let products = [];
let categories = [];
let editingSlug = new URLSearchParams(window.location.search).get("slug") || "";
let selectedProductIds = new Set();
let categoryImageFile = null;
let categoryImagePreviewUrl = "";
let existingImage = "";
let existingImageKey = "";
let categoryCampaignImageFile = null;
let categoryCampaignImagePreviewUrl = "";
let existingCampaignImage = "";
let existingCampaignImageKey = "";
let linkedCampaignBanner = null;
let toastTimer = null;
const productDropdownSync = new WeakMap();

function showToast(message, type = "success") {
    const toast = $(".admin-products-toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `admin-products-toast ${type} show`;
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, match => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[match]));
}

function enhanceProductDropdown(select) {
    if (!select || productDropdownSync.has(select)) return;
    select.classList.add("product-dropdown-native");
    const picker = document.createElement("div");
    picker.className = "product-dropdown";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "product-dropdown-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="product-dropdown-label"></span><img class="product-dropdown-arrow" src="images/Icon Folder/Back Icon Down_Gray.PNG" alt="">`;
    const menu = document.createElement("div");
    menu.className = "product-dropdown-menu";
    menu.hidden = true;
    picker.append(trigger, menu);
    select.insertAdjacentElement("afterend", picker);

    const close = () => {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };
    const refresh = () => {
        const selected = select.options[select.selectedIndex] || select.options[0];
        trigger.querySelector(".product-dropdown-label").textContent = selected?.textContent || "";
        picker.classList.toggle("disabled", select.disabled);
        menu.innerHTML = [...select.options].map(option => `<button type="button" role="option" data-value="${escapeHtml(option.value)}" class="${option.value === select.value ? "selected" : ""}" ${option.disabled ? "disabled" : ""}>${escapeHtml(option.textContent)}</button>`).join("");
    };

    trigger.addEventListener("click", event => {
        event.stopPropagation();
        if (select.disabled) return;
        document.querySelectorAll(".product-dropdown-menu:not([hidden])").forEach(openMenu => {
            if (openMenu !== menu) {
                openMenu.hidden = true;
                openMenu.previousElementSibling?.setAttribute("aria-expanded", "false");
            }
        });
        const opening = menu.hidden;
        menu.hidden = !opening;
        trigger.setAttribute("aria-expanded", String(opening));
    });
    menu.addEventListener("click", event => {
        const option = event.target.closest("button[data-value]");
        if (!option || option.disabled) return;
        select.value = option.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
        close();
    });
    select.addEventListener("change", refresh);
    productDropdownSync.set(select, { refresh, close });
    refresh();
}

function categorySlug(value) {
    return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeCategories(items) {
    const defaults = new Map(DEFAULT_CATEGORIES.map(category => [category.slug, category]));
    const normalized = [];
    const known = new Set();
    (Array.isArray(items) ? items : []).forEach((item, index) => {
        const slug = categorySlug(item?.slug || item?.label);
        const label = String(item?.label || defaults.get(slug)?.label || "").trim().slice(0, 60);
        if (!slug || !label || known.has(slug)) return;
        const hero = item?.hero && typeof item.hero === "object" ? item.hero : {};
        const metrics = item?.metrics && typeof item.metrics === "object" ? item.metrics : {};
        known.add(slug);
        normalized.push({
            slug,
            label,
            priority: Math.max(1, Math.round(Number(item?.priority) || index + 1)),
            image: String(item?.image || defaults.get(slug)?.image || "").trim(),
            imageKey: String(item?.imageKey || "").trim(),
            productIds: Array.isArray(item?.productIds) ? item.productIds.map(String).filter(Boolean) : [],
            status: CATEGORY_STATUSES.has(item?.status) ? item.status : "active",
            sortMode: CATEGORY_SORT_MODES.has(item?.sortMode) ? item.sortMode : "manual",
            badge: CATEGORY_BADGES.has(item?.badge) ? item.badge : "",
            subcategories: Array.isArray(item?.subcategories) ? item.subcategories.map(value => String(value || "").trim().replace(/\s+/g, " ").slice(0, 32)).filter(Boolean).slice(0, 12) : [],
            hero: {
                eyebrow: String(hero.eyebrow || "").trim().replace(/\s+/g, " ").slice(0, 40),
                heading: String(hero.heading || "").trim().replace(/\s+/g, " ").slice(0, 80),
                body: String(hero.body || "").trim().replace(/\s+/g, " ").slice(0, 180),
                buttonLabel: String(hero.buttonLabel || "").trim().replace(/\s+/g, " ").slice(0, 32),
                buttonLink: String(hero.buttonLink || "").trim().slice(0, 140),
                image: String(hero.image || "").trim(),
                imageKey: String(hero.imageKey || "").trim()
            },
            metrics: {
                views: Math.max(0, Number(metrics.views) || 0),
                clicks: Math.max(0, Number(metrics.clicks) || 0),
                orders: Math.max(0, Number(metrics.orders) || 0)
            }
        });
    });
    DEFAULT_CATEGORIES.forEach(category => {
        if (known.has(category.slug)) return;
        known.add(category.slug);
        normalized.push({ ...category, priority: normalized.length + 1, status: "active", sortMode: "manual", badge: "", subcategories: [], hero: { eyebrow: "", heading: "", body: "", buttonLabel: "", buttonLink: "", image: "", imageKey: "" }, metrics: { views: 0, clicks: 0, orders: 0 } });
    });
    return normalized;
}

function productCategory(product) {
    return product.category || "products";
}

function productImage(product) {
    return product.image || product.imageUrl || product.gallery?.[0] || "images/Icon Folder/Products 2 Icon_333.PNG";
}

function productVisibility(product) {
    return ["active", "hidden", "draft"].includes(product?.visibility) ? product.visibility : (product?.active === false ? "draft" : "active");
}

function productTimestamp(product) {
    const value = product?.createdAt || product?.updatedAt || product?.metadata?.createdAt || "";
    if (value?.toDate) return value.toDate().getTime();
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function discountSelection(_id) {
    return null;
}

function categoryProductSorter(category) {
    const mode = CATEGORY_SORT_MODES.has(category?.sortMode) ? category.sortMode : "manual";
    const manualOrder = new Map((Array.isArray(category?.productIds) ? category.productIds : []).map((id, index) => [String(id), index]));
    return (first, second) => {
        if (mode === "manual") {
            const firstOrder = manualOrder.has(String(first.id)) ? manualOrder.get(String(first.id)) : Number.MAX_SAFE_INTEGER;
            const secondOrder = manualOrder.has(String(second.id)) ? manualOrder.get(String(second.id)) : Number.MAX_SAFE_INTEGER;
            if (firstOrder !== secondOrder) return firstOrder - secondOrder;
        }
        if (mode === "newest") return productTimestamp(second) - productTimestamp(first);
        if (mode === "price-low") return (Number(first.price) || 0) - (Number(second.price) || 0);
        if (mode === "price-high") return (Number(second.price) || 0) - (Number(first.price) || 0);
        if (mode === "discounted") return Number(Boolean(discountSelection(second.id))) - Number(Boolean(discountSelection(first.id)));
        if (mode === "in-stock") return (Number(second.stock) || 0) - (Number(first.stock) || 0);
        return String(first.title || "").localeCompare(String(second.title || ""));
    };
}

function categoryProducts(category) {
    const slug = String(category?.slug || "");
    const explicitIds = new Set((Array.isArray(category?.productIds) ? category.productIds : []).map(String));
    return products.filter(product => productCategory(product) === slug || explicitIds.has(String(product.id))).sort(categoryProductSorter(category));
}

function setCategoryImage(file = null, currentImage = "", currentKey = "") {
    if (categoryImagePreviewUrl) URL.revokeObjectURL(categoryImagePreviewUrl);
    categoryImagePreviewUrl = "";
    categoryImageFile = file;
    existingImage = currentImage;
    existingImageKey = currentKey;
    const preview = $("#category-image-preview");
    const placeholder = $(".category-image-placeholder");
    if (file) {
        categoryImagePreviewUrl = URL.createObjectURL(file);
        preview.src = categoryImagePreviewUrl;
        preview.alt = "Selected category image";
        preview.hidden = false;
        placeholder.hidden = true;
        $("#category-image-status").textContent = file.name;
    } else if (currentImage) {
        preview.src = currentImage;
        preview.alt = "Current category image";
        preview.hidden = false;
        placeholder.hidden = true;
        $("#category-image-status").textContent = "Current category image";
    } else {
        preview.removeAttribute("src");
        preview.alt = "";
        preview.hidden = true;
        placeholder.hidden = false;
        $("#category-image-status").textContent = "Choose a JPEG, PNG, WebP, or GIF image up to 5 MB.";
    }
}

function normalizeLinkedCampaignBanner(value = {}) {
    const banner = value && typeof value === "object" ? value : {};
    const text = (input, fallback, maxLength) => {
        const cleaned = String(input || "").trim().replace(/\s+/g, " ");
        return (cleaned || fallback).slice(0, maxLength);
    };
    return {
        eyebrow: text(banner.eyebrow, "Limited Offers", 40),
        heading: text(banner.heading, "15% off selected favourites", 80),
        body: text(banner.body, "Bring your next beauty refresh home for less with limited-time campaign deals.", 180),
        buttonLabel: text(banner.buttonLabel, "Shop offers", 32),
        buttonLink: String(banner.buttonLink || "Campaign.html").trim().slice(0, 140),
        image: String(banner.image || "images/Icon Folder/Discount Icon_E5A484.PNG").trim().slice(0, 500),
        imageKey: String(banner.imageKey || "").trim()
    };
}

function currentCategoryCampaignImage() {
    return categoryCampaignImagePreviewUrl || $("#category-campaign-image-url")?.value.trim() || existingCampaignImage || "";
}

function setCategoryCampaignImage(file = null, currentImage = "", currentKey = "") {
    if (categoryCampaignImagePreviewUrl) URL.revokeObjectURL(categoryCampaignImagePreviewUrl);
    categoryCampaignImagePreviewUrl = "";
    categoryCampaignImageFile = file;
    existingCampaignImage = currentImage;
    existingCampaignImageKey = currentKey;
    const preview = $("#category-campaign-image-preview");
    const previewWrap = $("#category-campaign-image-preview-wrap");
    const urlInput = $("#category-campaign-image-url");
    const keyInput = $("#category-campaign-image-key");
    const status = $("#category-campaign-image-status");
    if (keyInput) keyInput.value = currentKey || "";
    if (file) {
        categoryCampaignImagePreviewUrl = URL.createObjectURL(file);
        if (urlInput) urlInput.value = "";
        preview.src = categoryCampaignImagePreviewUrl;
        previewWrap.hidden = false;
        status.textContent = file.name;
    } else if (currentImage) {
        if (urlInput) urlInput.value = currentImage;
        preview.src = currentImage;
        previewWrap.hidden = false;
        status.textContent = currentKey ? "Current campaign image" : "Image URL ready";
    } else {
        if (urlInput) urlInput.value = "";
        preview.removeAttribute("src");
        previewWrap.hidden = true;
        status.textContent = "No campaign photo added";
    }
    renderCategoryCampaignPreview();
}

function renderCategoryCampaignPreview() {
    const preview = $("#category-campaign-preview");
    if (!preview) return;
    const categoryLabel = $("#category-name")?.value.trim() || "Category campaign";
    const eyebrow = $("#category-hero-eyebrow")?.value.trim() || "Limited offer";
    const heading = $("#category-hero-heading")?.value.trim() || categoryLabel;
    const body = $("#category-hero-body")?.value.trim() || "Add a short campaign message for this category.";
    const buttonLabel = $("#category-hero-button-label")?.value.trim() || "Shop offers";
    const image = currentCategoryCampaignImage() || existingImage || "images/Icon Folder/Discount Icon_E5A484.PNG";
    preview.querySelector(".hero-preview-eyebrow").textContent = eyebrow;
    preview.querySelector("h3").textContent = heading;
    preview.querySelector(".hero-preview-body").textContent = body;
    preview.querySelector(".hero-preview-button").textContent = buttonLabel;
    const imageElement = preview.querySelector(".homepage-campaign-image");
    imageElement.src = image;
    imageElement.alt = heading;
}

function syncSelectionCount() {
    const count = selectedProductIds.size;
    $("#category-product-selection-count").textContent = `${count} product${count === 1 ? "" : "s"} selected`;
}

function visiblePickerProducts() {
    const query = $("#category-product-search").value.trim().toLowerCase();
    return products.filter(product => {
        const text = `${product.title || ""} ${product.sku || ""} ${productCategory(product)}`.toLowerCase();
        return !query || text.includes(query);
    }).sort((first, second) => {
        const firstSelected = selectedProductIds.has(String(first.id));
        const secondSelected = selectedProductIds.has(String(second.id));
        return Number(secondSelected) - Number(firstSelected);
    });
}

function syncProductChoiceState(choice) {
    const id = String(choice?.dataset.id || "");
    const selected = selectedProductIds.has(id);
    const product = products.find(item => String(item.id) === id);
    choice?.classList.toggle("selected", selected);
    const button = choice?.querySelector(".category-product-select");
    if (button) {
        button.setAttribute("aria-pressed", String(selected));
        button.setAttribute("aria-label", `${selected ? "Remove" : "Select"} ${product?.title || "product"}`);
    }
}

function animateProductPickerReorder(productId) {
    const picker = $("#category-product-picker");
    if (!picker) return;
    const previousItems = [...picker.querySelectorAll(".category-product-choice")];
    const previousRects = new Map(previousItems.map(item => [item.dataset.id, item.getBoundingClientRect()]));
    const nodes = new Map(previousItems.map(item => [item.dataset.id, item]));
    const movingNode = nodes.get(productId);
    const desiredIds = visiblePickerProducts().map(product => String(product.id));
    const nextId = desiredIds.slice(desiredIds.indexOf(productId) + 1).find(id => nodes.has(id));
    const nextNode = nextId ? nodes.get(nextId) : null;
    if (movingNode) syncProductChoiceState(movingNode);
    if (movingNode) picker.insertBefore(movingNode, nextNode);
    syncSelectionCount();
    if (!picker || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    picker.classList.add("is-reordering");
    requestAnimationFrame(() => {
        [...picker.querySelectorAll(".category-product-choice")].forEach(item => {
            const previousRect = previousRects.get(item.dataset.id);
            if (!previousRect) return;
            const nextRect = item.getBoundingClientRect();
            const dx = previousRect.left - nextRect.left;
            const dy = previousRect.top - nextRect.top;
            if (!dx && !dy) return;
            const promoted = item.dataset.id === productId && item.classList.contains("selected") && dy > 0;
            item.classList.add("is-moving");
            if (promoted) item.classList.add("is-promoted");
            const animation = item.animate([
                { transform: `translate(${dx}px, ${dy}px) scale(${promoted ? ".94" : "1"})`, filter: promoted ? "brightness(1.08) saturate(1.08)" : "none" },
                { transform: `translate(${dx * .58}px, ${dy * .58}px) scale(${promoted ? "1.075" : "1.012"})`, filter: promoted ? "brightness(1.12) saturate(1.1)" : "none", offset: .45 },
                { transform: `translate(${dx * .08}px, ${dy * .08}px) scale(${promoted ? "1.035" : "1"})`, filter: promoted ? "brightness(1.06) saturate(1.06)" : "none", offset: .82 },
                { transform: "translate(0, 0) scale(1)", filter: "none" }
            ], { duration: promoted ? 880 : 620, easing: "cubic-bezier(.16,1,.28,1)", fill: "both" });
            animation.onfinish = () => item.classList.remove("is-moving", "is-promoted");
            animation.oncancel = animation.onfinish;
        });
        window.setTimeout(() => picker.classList.remove("is-reordering"), 560);
    });
}

function renderProductPicker() {
    const matches = visiblePickerProducts();
    $("#category-products-empty").classList.toggle("hidden", matches.length > 0);
    $("#category-product-picker").innerHTML = matches.map(product => {
        const id = String(product.id);
        const selected = selectedProductIds.has(id);
        return `<article class="category-product-choice ${selected ? "selected" : ""}" data-id="${escapeHtml(id)}">
            <img src="${escapeHtml(productImage(product))}" alt="">
            <span class="category-product-choice-copy"><strong>${escapeHtml(product.title || "Untitled product")}</strong><small>${escapeHtml(product.sku || "No SKU")} · ${escapeHtml(productVisibility(product))}</small></span>
            <span aria-hidden="true"></span>
            <button class="category-product-select" type="button" aria-label="${selected ? "Remove" : "Select"} ${escapeHtml(product.title || "product")}" aria-pressed="${selected}"><span class="category-product-check" aria-hidden="true"><img src="images/Icon Folder/Tick Icon_White.PNG" alt=""></span></button>
        </article>`;
    }).join("");
    syncSelectionCount();
}

function fillForm(category) {
    $("#category-page-title").textContent = category ? "Edit Category" : "Add Category";
    $("#category-name").value = category?.label || "";
    $("#category-slug").value = category?.slug || "";
    $("#category-priority").value = category?.priority || categories.length + 1;
    $("#category-status").value = category?.status || "active";
    $("#category-sort-mode").value = category?.sortMode || "manual";
    $("#category-badge").value = category?.badge || "";
    $("#category-subcategories").value = Array.isArray(category?.subcategories) ? category.subcategories.join(", ") : "";
    const campaign = linkedCampaignBanner || normalizeLinkedCampaignBanner();
    $("#category-hero-eyebrow").value = campaign.eyebrow;
    $("#category-hero-heading").value = campaign.heading;
    $("#category-hero-body").value = campaign.body;
    $("#category-hero-button-label").value = campaign.buttonLabel;
    $("#category-hero-button-link").value = campaign.buttonLink;
    setCategoryCampaignImage(null, campaign.image, campaign.imageKey);
    ["#category-status", "#category-sort-mode", "#category-badge"].forEach(selector => productDropdownSync.get($(selector))?.refresh?.());
    selectedProductIds = new Set(category ? categoryProducts(category).map(product => String(product.id)) : []);
    setCategoryImage(null, category?.image || "", category?.imageKey || "");
    renderCategoryCampaignPreview();
    renderProductPicker();
}

async function loadPage() {
    const bootstrap = await getManagementBootstrap(db);
    products = bootstrap.products || [];
    categories = normalizeCategories(bootstrap.settings.categories?.items);
    linkedCampaignBanner = normalizeLinkedCampaignBanner(bootstrap.settings.campaignBanner || {});
    const category = categories.find(item => item.slug === editingSlug) || null;
    if (editingSlug && !category) {
        showToast("Category not found. Creating a new category instead.", "warning");
        editingSlug = "";
    }
    fillForm(category);
}

async function saveCategory(event) {
    event.preventDefault();
    const button = $("#category-page-save");
    const label = $("#category-name").value.trim().replace(/\s+/g, " ").slice(0, 60);
    const slug = categorySlug($("#category-slug").value || label);
    const editingCategory = categories.find(category => category.slug === editingSlug);
    if (!label || !slug) return showToast("Enter a category name and valid handle.", "error");
    if (!categoryImageFile && !existingImage) return showToast("Choose an image for this category.", "error");
    if (!selectedProductIds.size) return showToast("Select at least one product before saving.", "error");
    if (categories.some(category => category.slug !== editingSlug && (category.slug === slug || category.label.toLowerCase() === label.toLowerCase()))) return showToast("That category already exists.", "error");

    button.disabled = true;
    button.textContent = categoryImageFile || categoryCampaignImageFile ? "Uploading images…" : "Saving…";
    try {
        const priority = Math.max(1, Math.round(Number($("#category-priority").value) || categories.length + 1));
        const status = CATEGORY_STATUSES.has($("#category-status").value) ? $("#category-status").value : "active";
        const sortMode = CATEGORY_SORT_MODES.has($("#category-sort-mode").value) ? $("#category-sort-mode").value : "manual";
        const badge = CATEGORY_BADGES.has($("#category-badge").value) ? $("#category-badge").value : "";
        const subcategories = $("#category-subcategories").value.split(",").map(value => value.trim().replace(/\s+/g, " ").slice(0, 32)).filter(Boolean).slice(0, 12);
        const uploaded = categoryImageFile ? await uploadImage(categoryImageFile, "category") : null;
        const campaign = linkedCampaignBanner || normalizeLinkedCampaignBanner();
        const hero = {
            eyebrow: campaign.eyebrow,
            heading: campaign.heading,
            body: campaign.body,
            buttonLabel: campaign.buttonLabel,
            buttonLink: campaign.buttonLink,
            image: campaign.image,
            imageKey: campaign.imageKey
        };
        const selectedProducts = products.filter(product => selectedProductIds.has(String(product.id)));
        const nextCategory = {
            slug,
            label,
            priority,
            image: uploaded?.url || existingImage,
            imageKey: uploaded?.key || existingImageKey || "",
            productIds: selectedProducts.sort(categoryProductSorter({ sortMode, productIds: editingCategory?.productIds || [] })).map(product => String(product.id)),
            status,
            sortMode,
            badge,
            subcategories,
            hero,
            metrics: editingCategory?.metrics || { views: 0, clicks: 0, orders: 0 }
        };
        const previousAssigned = editingCategory ? categoryProducts(editingCategory) : [];
        const affectedProducts = products.filter(product => selectedProductIds.has(String(product.id)) || previousAssigned.some(item => String(item.id) === String(product.id)));
        categories = editingCategory ? categories.map(category => category.slug === editingSlug ? nextCategory : category) : [...categories, nextCategory];
        await setDoc(doc(db, "storefront", "categories"), { items: categories });
        await Promise.all(affectedProducts.map(product => {
            const metadata = { ...(product.metadata || {}) };
            metadata.category = selectedProductIds.has(String(product.id)) ? slug : UNCATEGORIZED_CATEGORY;
            return updateDoc(doc(db, "products", product.apiId || product.id), { metadata });
        }));
        localStorage.setItem("mpwrCategories", JSON.stringify(categories));
        localStorage.setItem("mpwrCatalogueRevision", String(Date.now()));
        showToast("Category saved.");
        setTimeout(() => { window.location.href = "admin-products.html#categories"; }, 450);
    } catch (error) {
        showToast(error?.message || "Unable to save the category.", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Save Category";
    }
}

function bindEvents() {
    ["#category-status", "#category-sort-mode", "#category-badge"].forEach(selector => enhanceProductDropdown($(selector)));
    document.addEventListener("click", event => {
        if (event.target.closest(".product-dropdown")) return;
        document.querySelectorAll(".product-dropdown-menu:not([hidden])").forEach(menu => {
            menu.hidden = true;
            menu.previousElementSibling?.setAttribute("aria-expanded", "false");
        });
    });
    $("#category-name").addEventListener("input", event => {
        if (!editingSlug) $("#category-slug").value = categorySlug(event.target.value);
        renderCategoryCampaignPreview();
    });
    $("#category-image").addEventListener("change", event => {
        const file = event.target.files?.[0] || null;
        if (!file) return setCategoryImage(null, existingImage, existingImageKey);
        if (!/^image\/(?:jpeg|png|webp|gif)$/.test(file.type)) {
            event.target.value = "";
            return showToast("Use a JPEG, PNG, WebP, or GIF category image.", "error");
        }
        if (file.size > 5 * 1024 * 1024) {
            event.target.value = "";
            return showToast("Category images must be 5 MB or smaller.", "error");
        }
        setCategoryImage(file);
        renderCategoryCampaignPreview();
    });
    ["#category-hero-eyebrow", "#category-hero-heading", "#category-hero-body", "#category-hero-button-label"].forEach(selector => {
        $(selector)?.addEventListener("input", renderCategoryCampaignPreview);
    });
    $("#category-campaign-image-file")?.addEventListener("change", event => {
        const file = event.target.files?.[0] || null;
        if (!file) return setCategoryCampaignImage(null, existingCampaignImage, existingCampaignImageKey);
        if (!/^image\/(?:jpeg|png|webp|gif)$/.test(file.type)) {
            event.target.value = "";
            return showToast("Use a JPEG, PNG, WebP, or GIF campaign image.", "error");
        }
        if (file.size > 10 * 1024 * 1024) {
            event.target.value = "";
            return showToast("Campaign images must be 10 MB or smaller.", "error");
        }
        setCategoryCampaignImage(file);
    });
    $("#category-campaign-image-reset")?.addEventListener("click", event => {
        event.preventDefault();
        $("#category-campaign-image-file").value = "";
        setCategoryCampaignImage(null, "", "");
    });
    $("#category-campaign-image-url")?.addEventListener("input", renderCategoryCampaignPreview);
    $("#category-campaign-image-url-preview")?.addEventListener("click", () => {
        const url = $("#category-campaign-image-url").value.trim();
        if (!url) return showToast("Paste an image URL first.", "error");
        $("#category-campaign-image-file").value = "";
        setCategoryCampaignImage(null, url, "");
    });
    $("#category-product-search").addEventListener("input", renderProductPicker);
    $("#category-product-picker").addEventListener("click", event => {
        const choice = event.target.closest(".category-product-choice");
        if (!choice || !event.target.closest(".category-product-select")) return;
        const id = String(choice.dataset.id || "");
        if (selectedProductIds.has(id)) selectedProductIds.delete(id);
        else selectedProductIds.add(id);
        syncProductChoiceState(choice);
        animateProductPickerReorder(id);
    });
    $("#category-page-form").addEventListener("submit", saveCategory);
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
        await loadPage();
        $("#category-editor-app").hidden = false;
        $("#management-page-loading").remove();
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    } catch (error) {
        const loading = $("#management-page-loading");
        loading?.classList.add("error");
        if (loading) loading.querySelector("p").textContent = "Unable to load the category editor. Please refresh in a moment.";
        showToast(error?.message || "Unable to load the category editor.", "error");
    }
});
