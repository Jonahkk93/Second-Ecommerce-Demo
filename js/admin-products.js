import { onAuthStateChanged } from "./auth-api.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "./firestore-api.js";
import { deleteImage, uploadImage } from "./media-api.js";

const auth = window.auth;
const db = window.db;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const categoryLabels = { "press-ons": "Press-On Nails", wigs: "Wigs", lashes: "Lashes", products: "Products" };
const POPULAR_PRODUCT_LIMIT = 10;
const HOMEPAGE_DISCOUNT_PRODUCT_LIMIT = 10;
const DEFAULT_DISCOUNTS = ["12", "15", "1", "4", "11"].map(id => ({ id, percent: 15 }));
const DISCOUNT_CAMPAIGN_LABELS = ["Limited Offers", "Valentines Offers", "Christmas Offers", "Black Friday"];
const LEGACY_DISCOUNT_CAMPAIGN_LABELS = { Valentines: "Valentines Offers", Christmas: "Christmas Offers" };

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
let popularIds = [];
let automaticPopularIds = [];
let automaticPopularSales = new Map();
let discountSelections = [];
let discountCampaignLabel = DISCOUNT_CAMPAIGN_LABELS[0];
let popularMode = "manual";
let discountMode = "manual";
let discountSectionEnabled = true;
let editingProduct = null;
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
const catalogueChannel = "BroadcastChannel" in window ? new BroadcastChannel("mpwr-catalogue") : null;
const panelHashes = { catalogue: "products", homepage: "homepage", deleted: "deleted-products" };
const hashPanels = Object.fromEntries(Object.entries(panelHashes).map(([panel, hash]) => [hash, panel]));

function notifyStorefrontChange() {
    const revision = String(Date.now());
    localStorage.setItem("mpwrCatalogueRevision", revision);
    catalogueChannel?.postMessage({ type: "catalogue-changed", revision });
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

function updateHomepageSelection(product, action, sourceCard = null, shouldAutosave = true) {
    if (popularMode !== "manual") {
        showToast("Switch Popular Products to Manual before editing the selection", "error");
        return false;
    }
    if (action === "add" && discountSectionEnabled && isHomepageDiscount(product.id)) {
        showToast("Remove this product from Discounts before adding it to Popular", "error");
        return false;
    }
    if (action === "add" && !popularIds.includes(String(product.id)) && popularIds.length >= POPULAR_PRODUCT_LIMIT) {
        showToast(`Only ${POPULAR_PRODUCT_LIMIT} popular products can be added`, "error");
        return false;
    }
    const id = String(product.id);
    if (action === "add") {
        if (!popularIds.includes(id)) popularIds.push(id);
    } else {
        homepageRemovalTarget = product;
        $("#homepage-removal-title").textContent = `Remove ${product.title}?`;
        $("#homepage-removal-message").textContent = "This product will be removed from the homepage Popular section when you save your changes.";
        $("#homepage-removal-modal").classList.remove("hidden");
        $("#confirm-homepage-removal").focus();
        return false;
    }
    renderPopularSelection();
    updateHomepageProductCard(id, true);
    animateProductToPopular(sourceCard, id);
    if (shouldAutosave) autosaveHomepageSettings(`${product.title} added to Popular.`);
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
    const eligible = product => product.active !== false;
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

function updateDiscountSelection(product, action, sourceCard = null, shouldAutosave = true) {
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
    if (action === "remove") {
        discountRemovalTarget = product;
        $("#discount-removal-title").textContent = `Remove ${product.title}?`;
        $("#discount-removal-modal").classList.remove("hidden");
        $("#confirm-discount-removal").focus();
        return false;
    }
    if (!discountSelection(id)) discountSelections.push({ id, percent: 15 });
    if (popularMode === "manual" && popularIds.includes(id)) {
        popularIds = popularIds.filter(value => value !== id);
        renderPopularSelection();
    }
    updateHomepageProductCard(id, false);
    renderDiscountSelection();
    syncDiscountPickerAvailability();
    animateProductToDiscount(sourceCard, id);
    if (shouldAutosave) autosaveHomepageSettings(`${product.title} added to Offers.`);
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

    [...select.options].forEach(item => {
        const option = document.createElement("button");
        option.type = "button";
        option.dataset.value = item.value;
        option.textContent = item.textContent;
        option.disabled = item.disabled;
        option.setAttribute("role", "option");
        menu.appendChild(option);
    });

    const sync = () => {
        const selected = select.options[select.selectedIndex];
        trigger.querySelector(".product-dropdown-label").textContent = selected?.textContent || "Select";
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
    productDropdownSync.set(select, sync);
    sync();
}

async function loadData() {
    const [snapshot, deletedSnapshot, popularSetting, bestsellerSetting, discountSetting] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "deletedProducts")),
        getDoc(doc(db, "storefront", "popular")),
        getDoc(doc(db, "storefront", "bestsellers")),
        getDoc(doc(db, "storefront", "discounts"))
    ]);
    products = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    deletedProducts = deletedSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    popularIds = popularSetting.exists() && Array.isArray(popularSetting.data().products)
        ? popularSetting.data().products.map(item => String(item.id))
        : [];
    popularMode = popularSetting.data()?.mode === "automatic" ? "automatic" : "manual";
    const bestsellerProducts = Array.isArray(bestsellerSetting.data()?.products) ? bestsellerSetting.data().products : [];
    automaticPopularIds = bestsellerProducts.map(item => String(item.id)).filter(Boolean);
    automaticPopularSales = new Map(bestsellerProducts.map(item => [String(item.id), Math.max(0, Number(item.unitsSold) || 0)]));
    discountSelections = Array.isArray(discountSetting.data()?.products)
        ? discountSetting.data().products.map(item => ({
            id: String(item.id),
            percent: Math.min(95, Math.max(1, Math.round(Number(item.percent) || 15)))
        }))
        : DEFAULT_DISCOUNTS.map(item => ({ ...item }));
    discountCampaignLabel = normalizeDiscountCampaignLabel(discountSetting.data()?.label);
    discountMode = discountSetting.data()?.mode === "automatic" ? "automatic" : "manual";
    discountSectionEnabled = discountSetting.data()?.enabled !== false;
    $("#popular-mode-automatic").checked = popularMode === "automatic";
    $("#discount-mode-automatic").checked = discountMode === "automatic";
    $("#offer-section-enabled").checked = discountSectionEnabled;
    syncHomepageSectionStates();
    $("#discount-campaign-label").value = discountCampaignLabel;
    productDropdownSync.get($("#discount-campaign-label"))?.();
    $("#discount-campaign-preview").textContent = discountCampaignLabel;
    renderAll();
}

function renderStats() {
    const published = products.filter(product => product.active !== false);
    $("#stat-total").textContent = products.length;
    $("#stat-active").textContent = published.length;
    $("#stat-draft").textContent = products.length - published.length;
    $("#stat-low-stock").textContent = published.filter(product => product.stock !== undefined && Number(product.stock) <= 5).length;
    $("#deleted-nav-count").textContent = deletedProducts.length;
}

function filteredProducts() {
    const query = $("#product-search").value.trim().toLowerCase();
    const category = $("#category-filter").value;
    const status = $("#status-filter").value;
    return products.filter(product => {
        const matchesQuery = !query || `${product.title || ""} ${product.sku || ""}`.toLowerCase().includes(query);
        const matchesCategory = category === "all" || productCategory(product) === category;
        const matchesStatus = status === "all" || (status === "active" ? product.active !== false : product.active === false);
        return matchesQuery && matchesCategory && matchesStatus;
    });
}

function renderProducts() {
    const visibleProducts = filteredProducts();
    $("#product-count").textContent = `${visibleProducts.length} result${visibleProducts.length === 1 ? "" : "s"}`;
    $("#products-empty").classList.toggle("hidden", visibleProducts.length > 0);
    $(".products-list").innerHTML = visibleProducts.map(product => {
        const status = product.active === false ? "draft" : "active";
        const stockTracked = product.stock !== undefined && product.stock !== null;
        const stock = Math.max(0, Number(product.stock) || 0);
        return `<article class="product-card" data-id="${escapeHtml(product.id)}">
            <div class="product-thumb"><img src="${escapeHtml(productImage(product))}" alt=""><span class="media-count">${productMediaCount(product)} media</span></div>
            <div class="product-primary"><strong>${escapeHtml(product.title || "Untitled product")}</strong><div class="product-meta"><span>${escapeHtml(product.sku || "No SKU")}</span><span>·</span><span>${list(product.colors).length} colours</span><span>·</span><span>${list(product.sizes).length} sizes</span></div></div>
            <span class="category-pill">${escapeHtml(categoryLabels[productCategory(product)] || "Products")}</span>
            <span class="product-price">${formatMoney(product.price)}</span>
            <span class="stock-value ${stockTracked && stock <= 5 ? "low" : ""}">${stockTracked ? `${stock} in stock` : "Not tracked"}</span>
            <span class="status-pill ${status}">${status === "active" ? "Published" : "Draft"}</span>
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
    const eligible = product => product.active !== false && !discountedIds.has(String(product.id));
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
    const candidates = products.filter(product => product.active !== false && (!query || `${product.title} ${product.sku || ""}`.toLowerCase().includes(query)));
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
    const candidates = products.filter(product => product.active !== false && (!query || `${product.title} ${product.sku || ""}`.toLowerCase().includes(query)));
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
    discountSelections = discountSelections.filter(item => products.some(product => String(product.id) === item.id && product.active !== false));
    const discountedIds = new Set(homepageDiscountSelections().map(item => item.id));
    popularIds = popularIds.filter(id => (popularMode === "automatic" || discountMode === "automatic" || !discountSectionEnabled || !discountedIds.has(id)) && products.some(product => String(product.id) === id && product.active !== false)).slice(0, POPULAR_PRODUCT_LIMIT);
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

function closeEditor() {
    $(".product-modal").classList.add("hidden");
    editingProduct = null;
}

function openEditor(product = null) {
    editingProduct = product;
    $("#product-form").reset();
    $("#product-id").value = product?.apiId || product?.id || "";
    $("#product-modal-title").textContent = product ? "Edit Product" : "Add Product";
    $("#product-title").value = product?.title || "";
    $("#product-category").value = product ? productCategory(product) : "products";
    $("#product-status").value = product?.active === false ? "draft" : "active";
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
    existingMedia.innerHTML = `${gallery.map(url => `<img src="${escapeHtml(url)}" alt="Existing product image">`).join("")}${videos.map(video => `<video src="${escapeHtml(video.url || video)}" muted aria-label="Existing product video"></video>`).join("")}`;
    existingMedia.classList.toggle("hidden", gallery.length + videos.length === 0);
    $(".product-modal").classList.remove("hidden");
    setTimeout(() => $("#product-title").focus(), 30);
}

async function uploadMedia(files, saveButton) {
    const uploaded = [];
    for (let index = 0; index < files.length; index += 1) {
        saveButton.textContent = `Uploading ${index + 1} of ${files.length}…`;
        const result = await uploadImage(files[index], "product");
        uploaded.push({ ...result, type: result.contentType || files[index].type, name: files[index].name });
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
        : "Choose up to 10 published products and arrange the order shoppers should see.";
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

async function saveHomepageSettings() {
    await Promise.all([savePopularSetting(), saveDiscountSetting()]);
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

async function handleProductSubmit(event) {
    event.preventDefault();
    const wasEditing = Boolean(editingProduct);
    const files = [...$("#product-media").files];
    const existingImages = editingProduct?.gallery?.length ? [...editingProduct.gallery] : (editingProduct?.image ? [editingProduct.image] : []);
    const existingVideos = [...(editingProduct?.videos || [])];
    const mediaError = validateMedia(files);
    const putOnDiscount = discountMode === "manual" && $("#product-discounted").checked;
    const discountPercent = Math.min(95, Math.max(1, Math.round(Number($("#product-discount-percent").value) || 15)));
    const existingDiscount = editingProduct ? discountSelection(editingProduct.id) : null;
    if (mediaError) return showToast(mediaError, "error");
    if (putOnDiscount && $("#product-status").value !== "active") return showToast("Publish the product before putting it on discount.", "error");
    if (!editingProduct && !files.some(file => file.type.startsWith("image/"))) return showToast("Include at least one image to use as the product cover.", "error");
    if (existingImages.length + existingVideos.length + files.length > 10) return showToast("A product can have up to 10 images and videos in total.", "error");
    const button = $("#save-product");
    const uploaded = [];
    let productSaved = false;
    button.disabled = true;
    try {
        uploaded.push(...await uploadMedia(files, button));
        const newImages = uploaded.filter(item => item.type.startsWith("image/"));
        const newVideos = uploaded.filter(item => item.type.startsWith("video/"));
        const gallery = [...existingImages, ...newImages.map(item => item.url)];
        const videos = [...existingVideos, ...newVideos];
        const active = $("#product-status").value === "active";
        const data = {
            title: $("#product-title").value.trim(), category: $("#product-category").value,
            description: $("#product-description").value.trim(), price: Number($("#product-price").value),
            compareAtPrice: Number($("#product-compare-price").value) || 0, sku: $("#product-sku").value.trim(),
            stock: Number($("#product-stock").value) || 0, shippingClass: $("#product-shipping").value,
            weightGrams: Number($("#product-weight").value) || 0, colors: list($("#product-colors").value),
            sizes: list($("#product-sizes").value), active, image: gallery[0] || "", gallery, videos
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

function bindEvents() {
    $$('[data-coming-soon]').forEach(button => button.addEventListener("click", () => showToast(`${button.dataset.comingSoon} management is the next workspace to connect.`)));
    $("#add-product-btn").addEventListener("click", () => openEditor());
    $$(".close-modal, .close-modal-secondary").forEach(button => button.addEventListener("click", closeEditor));
    $(".product-modal").addEventListener("click", event => { if (event.target === event.currentTarget) closeEditor(); });
    $("#product-form").addEventListener("submit", handleProductSubmit);
    $("#product-discounted").addEventListener("change", syncProductDiscountEditor);
    $("#product-media").addEventListener("change", event => { const count = event.target.files.length; $("#selected-media-count").textContent = count ? `${count} new file${count === 1 ? "" : "s"} selected.` : "No new files selected."; });
    ["#product-search", "#category-filter", "#status-filter"].forEach(selector => $(selector).addEventListener(selector === "#product-search" ? "input" : "change", renderProducts));
    ["#category-filter", "#status-filter", "#product-category", "#product-status", "#product-shipping", "#discount-campaign-label"].forEach(selector => enhanceProductDropdown($(selector)));
    document.addEventListener("click", () => document.querySelectorAll(".product-dropdown-menu:not([hidden])").forEach(menu => {
        menu.hidden = true;
        menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    }));
    $("#homepage-search").addEventListener("input", renderHomepageProducts);
    $("#discount-search").addEventListener("input", renderDiscountProducts);
    ["#offer-section-enabled"].forEach(selector => $(selector).addEventListener("change", event => {
        const type = "discount";
        const requestedValue = event.target.checked;
        const currentValue = discountSectionEnabled;
        event.target.checked = currentValue;
        if (requestedValue !== currentValue) openHomepageSettingConfirmation(type, requestedValue);
    }));
    $("#popular-mode-automatic").addEventListener("change", event => {
        const requestedMode = event.target.checked ? "automatic" : "manual";
        event.target.checked = popularMode === "automatic";
        if (requestedMode !== popularMode) openHomepageSettingConfirmation("popularMode", requestedMode);
    });
    $("#discount-mode-automatic").addEventListener("change", event => {
        const requestedMode = event.target.checked ? "automatic" : "manual";
        event.target.checked = discountMode === "automatic";
        if (requestedMode !== discountMode) openHomepageSettingConfirmation("discountMode", requestedMode);
    });
    $("#discount-campaign-label").addEventListener("change", event => {
        const requestedValue = DISCOUNT_CAMPAIGN_LABELS.includes(event.target.value)
            ? event.target.value
            : DISCOUNT_CAMPAIGN_LABELS[0];
        event.target.value = discountCampaignLabel;
        productDropdownSync.get(event.target)?.();
        if (requestedValue !== discountCampaignLabel) openHomepageSettingConfirmation("campaign", requestedValue);
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
        if (popularIds.includes(id)) updateHomepageSelection(product, "remove", item);
        else if (event.target.closest(".toggle-popular").classList.contains("is-blocked")) updateHomepageSelection(product, "add", item);
        else openHomepageAdditionConfirmation(product, "popular", item);
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
        autosaveHomepageSettings();
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
        if (isHomepageDiscount(item.dataset.id)) updateDiscountSelection(product, "remove", item);
        else if (event.target.closest(".toggle-discount").classList.contains("is-blocked")) updateDiscountSelection(product, "add", item);
        else openHomepageAdditionConfirmation(product, "discount", item);
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
            autosaveHomepageSettings();
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
        autosaveHomepageSettings();
    });
    $("#discount-removal-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeDiscountRemovalConfirmation();
    });
    let draggedId = null;
    $("#popular-selection").addEventListener("dragstart", event => { if (popularMode !== "manual") return event.preventDefault(); const item = event.target.closest(".popular-item"); if (item) { draggedId = item.dataset.id; item.classList.add("dragging"); } });
    $("#popular-selection").addEventListener("dragend", event => {
        event.target.closest(".popular-item")?.classList.remove("dragging");
        if (draggedId) autosaveHomepageSettings();
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
        if (draggedDiscountId) autosaveHomepageSettings();
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
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== "admin") return void (window.location.href = "admin-login.html");
        db.kind = "admin";
        bindEvents();
        await loadData();
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    } catch (error) {
        showToast(error?.message || "Unable to load MPWR Management.", "error");
    }
});
