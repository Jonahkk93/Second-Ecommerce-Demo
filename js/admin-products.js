import { onAuthStateChanged } from "./auth-api.js";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "./firestore-api.js";
import { deleteImage, uploadImage } from "./media-api.js";

const auth = window.auth;
const db = window.db;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const categoryLabels = { "press-ons": "Press-On Nails", wigs: "Wigs", lashes: "Lashes", products: "Products" };
const POPULAR_PRODUCT_LIMIT = 10;
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
let editingProduct = null;
let archiveTarget = null;
let restoreTarget = null;
let permanentDeleteTarget = null;
let permanentDeleteButton = null;
let homepageSelectionTarget = null;
let homepageSelectionAction = null;
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

function openHomepageSelectionConfirmation(product, action) {
    if (action === "add" && !popularIds.includes(String(product.id)) && popularIds.length >= POPULAR_PRODUCT_LIMIT) {
        showToast(`Only ${POPULAR_PRODUCT_LIMIT} popular products can be added`, "error");
        return;
    }
    homepageSelectionTarget = product;
    homepageSelectionAction = action;
    const adding = action === "add";
    $("#homepage-selection-title").textContent = `${adding ? "Add" : "Remove"} ${product.title}?`;
    $("#homepage-selection-message").textContent = adding
        ? "This product will be added to the homepage Popular section. Save the homepage to publish the change."
        : "This product will be removed from the homepage Popular section. Save the homepage to publish the change.";
    const confirmButton = $("#confirm-homepage-selection");
    confirmButton.textContent = adding ? "Add Product" : "Remove Product";
    confirmButton.classList.toggle("primary-button", adding);
    confirmButton.classList.toggle("danger-button", !adding);
    $("#homepage-selection-modal").classList.remove("hidden");
    confirmButton.focus();
}

function closeHomepageSelectionConfirmation() {
    homepageSelectionTarget = null;
    homepageSelectionAction = null;
    $("#homepage-selection-modal").classList.add("hidden");
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
    const [snapshot, deletedSnapshot, popularSetting] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "deletedProducts")),
        getDoc(doc(db, "storefront", "popular"))
    ]);
    products = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    deletedProducts = deletedSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    popularIds = popularSetting.exists() && Array.isArray(popularSetting.data().products)
        ? popularSetting.data().products.map(item => String(item.id))
        : [];
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

function renderHomepage() {
    popularIds = popularIds.filter(id => products.some(product => String(product.id) === id && product.active !== false)).slice(0, POPULAR_PRODUCT_LIMIT);
    const selected = popularIds.map(id => products.find(product => String(product.id) === id)).filter(Boolean);
    $("#popular-selection-help").classList.toggle("hidden", selected.length > 0);
    $("#popular-selection").innerHTML = selected.map((product, index) => `<div class="popular-item" draggable="true" data-id="${escapeHtml(product.id)}">
        <span class="popular-rank" aria-label="Position ${index + 1}">${index + 1}</span>
        <div class="popular-item-card">
            <img class="popular-item-image" src="${escapeHtml(productImage(product))}" alt="">
            <div class="popular-item-details"><strong>${escapeHtml(product.title)}</strong><small>${formatMoney(product.price)}</small></div>
            <button type="button" class="remove-popular" aria-label="Remove ${escapeHtml(product.title)}"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button>
        </div>
    </div>`).join("");
    const query = $("#homepage-search").value.trim().toLowerCase();
    const candidates = products.filter(product => product.active !== false && (!query || `${product.title} ${product.sku || ""}`.toLowerCase().includes(query)));
    $("#homepage-products").innerHTML = candidates.map(product => {
        const selectedProduct = popularIds.includes(String(product.id));
        return `<div class="homepage-product ${selectedProduct ? "selected" : ""}" data-id="${escapeHtml(product.id)}"><img src="${escapeHtml(productImage(product))}" alt=""><div><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(categoryLabels[productCategory(product)] || "Products")}</small></div><button type="button" class="toggle-popular" aria-label="${selectedProduct ? "Remove" : "Add"} ${escapeHtml(product.title)}"><img src="images/Icon Folder/${selectedProduct ? "Tick Icon_White.PNG" : "Plus Icon_Gray.PNG"}" alt=""></button></div>`;
    }).join("");
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
    await setDoc(doc(db, "storefront", "popular"), { products: selected.map(product => ({ id: String(product.id), title: product.title, image: productImage(product) })) });
    localStorage.setItem("mpwrPopularProductIds", JSON.stringify(popularIds));
}

async function handleProductSubmit(event) {
    event.preventDefault();
    const wasEditing = Boolean(editingProduct);
    const files = [...$("#product-media").files];
    const existingImages = editingProduct?.gallery?.length ? [...editingProduct.gallery] : (editingProduct?.image ? [editingProduct.image] : []);
    const existingVideos = [...(editingProduct?.videos || [])];
    const mediaError = validateMedia(files);
    if (mediaError) return showToast(mediaError, "error");
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
            popularIds = popularIds.filter(id => id !== String(savedProduct.id));
            if ($("#product-featured").checked && active && popularIds.length < POPULAR_PRODUCT_LIMIT) popularIds.push(String(savedProduct.id));
            await savePopularSetting();
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
    $("#product-media").addEventListener("change", event => { const count = event.target.files.length; $("#selected-media-count").textContent = count ? `${count} new file${count === 1 ? "" : "s"} selected.` : "No new files selected."; });
    ["#product-search", "#category-filter", "#status-filter"].forEach(selector => $(selector).addEventListener(selector === "#product-search" ? "input" : "change", renderProducts));
    ["#category-filter", "#status-filter", "#product-category", "#product-status", "#product-shipping"].forEach(selector => enhanceProductDropdown($(selector)));
    document.addEventListener("click", () => document.querySelectorAll(".product-dropdown-menu:not([hidden])").forEach(menu => {
        menu.hidden = true;
        menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    }));
    $("#homepage-search").addEventListener("input", renderHomepage);
    $$(".management-nav-item[data-panel]").forEach(button => button.addEventListener("click", () => activateManagementPanel(button.dataset.panel, true)));
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
        try { await deleteDoc(doc(db, "products", archiveTarget.apiId || archiveTarget.id)); popularIds = popularIds.filter(id => id !== String(archiveTarget.id)); await savePopularSetting(); await loadData(); notifyStorefrontChange(); $(".confirm-modal").classList.add("hidden"); showToast("Product moved to Deleted Products for 60 days."); archiveTarget = null; }
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
        const item = event.target.closest(".homepage-product"); if (!item || !event.target.closest(".toggle-popular")) return;
        const id = item.dataset.id;
        const product = products.find(entry => String(entry.id) === id);
        if (product) openHomepageSelectionConfirmation(product, popularIds.includes(id) ? "remove" : "add");
    });
    $("#popular-selection").addEventListener("click", event => {
        const item = event.target.closest(".popular-item");
        if (!item || !event.target.closest(".remove-popular")) return;
        const product = products.find(entry => String(entry.id) === item.dataset.id);
        if (product) openHomepageSelectionConfirmation(product, "remove");
    });
    $("#cancel-homepage-selection").addEventListener("click", closeHomepageSelectionConfirmation);
    $("#confirm-homepage-selection").addEventListener("click", () => {
        if (!homepageSelectionTarget || !homepageSelectionAction) return;
        const id = String(homepageSelectionTarget.id);
        if (homepageSelectionAction === "add") {
            if (!popularIds.includes(id) && popularIds.length < POPULAR_PRODUCT_LIMIT) popularIds.push(id);
        } else {
            popularIds = popularIds.filter(value => value !== id);
        }
        closeHomepageSelectionConfirmation();
        renderHomepage();
    });
    $("#homepage-selection-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeHomepageSelectionConfirmation();
    });
    let draggedId = null;
    $("#popular-selection").addEventListener("dragstart", event => { const item = event.target.closest(".popular-item"); if (item) { draggedId = item.dataset.id; item.classList.add("dragging"); } });
    $("#popular-selection").addEventListener("dragend", event => { event.target.closest(".popular-item")?.classList.remove("dragging"); draggedId = null; });
    $("#popular-selection").addEventListener("dragover", event => { event.preventDefault(); const target = event.target.closest(".popular-item"); if (!draggedId || !target || target.dataset.id === draggedId) return; const from = popularIds.indexOf(draggedId); const to = popularIds.indexOf(target.dataset.id); popularIds.splice(to, 0, popularIds.splice(from, 1)[0]); renderHomepage(); });
    $("#save-homepage").addEventListener("click", async event => { event.currentTarget.disabled = true; try { await savePopularSetting(); showToast("Homepage products saved."); } catch (error) { showToast(error?.message || "Unable to save the homepage.", "error"); } finally { event.currentTarget.disabled = false; } });
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
