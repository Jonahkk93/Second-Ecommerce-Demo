import { mountMPWRDrawers } from "./drawer-component.js?v=20260808-8";

let firebaseServicesPromise;
function loadFirebaseServices() {
    if (!firebaseServicesPromise) {
        firebaseServicesPromise = Promise.all([
            import("./firebase.js"),
            import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js"),
            import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js")
        ]).then(([, firestore, authApi]) => ({
            auth:window.auth,
            db:window.db,
            doc:firestore.doc,
            getDoc:firestore.getDoc,
            setDoc:firestore.setDoc,
            onAuthStateChanged:authApi.onAuthStateChanged
        }));
    }
    return firebaseServicesPromise;
}

mountMPWRDrawers(document.body);

const queryInput = document.querySelector("#results-query");
const searchForm = document.querySelector(".results-search");
const resultsGrid = document.querySelector(".results-grid");
const noResults = document.querySelector(".no-results");
const sortResults = document.querySelector("#sort-results");
const colorFilter = document.querySelector("#color-filter");
const sizeFilter = document.querySelector("#size-filter");
const resultsToolbar = document.querySelector(".results-toolbar");
const query = new URLSearchParams(location.search).get("q")?.trim() || "";
const productModalOverlay = document.querySelector(".product-modal-overlay");
const productModalImage = document.querySelector(".product-modal-image");
const productModalImageLink = document.querySelector(".product-modal-image-link");
const productModalTitle = document.querySelector(".product-modal-title");
const productModalTitleLink = document.querySelector(".product-modal-title-link");
const productModalPrice = document.querySelector(".product-modal-price");
const productModalFavorite = document.querySelector(".product-modal-favorite");
const productModalDescription = document.querySelector(".product-modal-description");
const productModalReadMore = document.querySelector(".product-modal-read-more");
const productModalOptions = document.querySelector(".product-modal-options-dynamic");
const productModalOptionsGroup = document.querySelector(".product-modal-options-group");
const productModalCart = document.querySelector(".product-modal-cart");
let selectedModalProduct = null;
let selectedModalCard = null;
let selectedModalOptions = {};
let selectedModalPrice = 0;

function updateCartButton() {
    const count = getCart().reduce((total,item) => total + Number(item.quantity || 1),0);
    const badge = document.querySelector(".cart-item-count");
    badge.textContent = count > 0 ? String(count) : "";
    badge.style.visibility = count > 0 ? "visible" : "hidden";
}

const cartDrawer = document.querySelector(".cart");
const cartBackdrop = document.querySelector(".results-cart-backdrop");
const drawerItems = document.querySelector(".cart-content");
const wishlistDrawer = document.querySelector(".wishlist");
const wishlistBackdrop = document.querySelector(".results-wishlist-backdrop");
const wishlistDrawerItems = document.querySelector(".wishlist-content");
let pendingConfirmation = null;
let suppressSwipeCloseUntil = 0;

function requestConfirmation(overlay,action) {
    pendingConfirmation = action;
    overlay.classList.add("active");
}

function closeConfirmation(overlay) {
    overlay.classList.remove("active");
    pendingConfirmation = null;
}

function showDrawerToast(message,type = "success") {
    const toast = document.querySelector(".toast");
    if (!toast) return;
    clearTimeout(toast.hideTimer);
    toast.textContent = message;
    toast.className = `toast ${type}`;
    void toast.offsetWidth;
    toast.classList.add("show");
    toast.hideTimer = setTimeout(() => toast.classList.remove("show"),2200);
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
}

document.querySelectorAll(".confirm-overlay").forEach(overlay => {
    overlay.querySelector(".confirm-cancel")?.addEventListener("click",() => closeConfirmation(overlay));
    overlay.querySelector(".confirm-clear")?.addEventListener("click",() => {
        const action = pendingConfirmation;
        closeConfirmation(overlay);
        action?.();
    });
    overlay.addEventListener("click",event => { if (event.target === overlay) closeConfirmation(overlay); });
});

function attachCartSwipe(row,cart,index,item) {
    const main = row.querySelector(".cart-box-main");
    const actions = row.querySelector(".cart-swipe-actions");
    const deleteAction = row.querySelector(".cart-delete");
    let startX = 0;
    let startY = 0;
    let offset = 0;
    let dragging = false;

    main.addEventListener("pointerdown",event => {
        if (event.target.closest("button,a,.cart-remove")) return;
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        offset = row.classList.contains("is-swiped") ? -actions.offsetWidth : 0;
        actions.setAttribute("aria-hidden","false");
        main.setPointerCapture(event.pointerId);
        main.classList.add("is-dragging");
        row.classList.add("swipe-dragging");
    });

    main.addEventListener("pointermove",event => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
            dragging = false;
            main.classList.remove("is-dragging");
            main.style.transform = "";
            row.classList.remove("delete-armed","swipe-dragging");
            actions.setAttribute("aria-hidden",String(!row.classList.contains("is-swiped")));
            return;
        }
        const rawX = Math.min(0,offset + dx);
        const overswipe = Math.max(0,-actions.offsetWidth - rawX);
        const deleteDistance = Math.min(72,main.offsetWidth * .2);
        const x = rawX < -actions.offsetWidth ? -actions.offsetWidth - Math.min(48,overswipe * .55) : rawX;
        row.classList.toggle("delete-armed",overswipe >= deleteDistance);
        main.style.transform = `translate3d(${x}px,0,0)`;
    });

    const finish = (event,cancelled = false) => {
        if (!dragging) return;
        dragging = false;
        main.classList.remove("is-dragging");
        const dx = event.clientX - startX;
        const deleteThreshold = -(actions.offsetWidth + Math.min(72,main.offsetWidth * .2));
        const shouldDelete = !cancelled && offset + dx <= deleteThreshold;
        const shouldOpen = offset + dx < -actions.offsetWidth * .35;
        if (Math.abs(dx) > 8) suppressSwipeCloseUntil = Date.now() + 350;
        main.style.transform = "";
        row.classList.remove("delete-armed","swipe-dragging");
        if (shouldDelete) {
            row.classList.remove("is-swiped");
            actions.setAttribute("aria-hidden","true");
            deleteAction.click();
            return;
        }
        if (shouldOpen) closeOpenCartSwipes(row);
        row.classList.toggle("is-swiped",shouldOpen);
        actions.setAttribute("aria-hidden",String(!shouldOpen));
    };
    main.addEventListener("pointerup",finish);
    main.addEventListener("pointercancel",event => finish(event,true));
    deleteAction.addEventListener("click",() => requestConfirmation(document.querySelector(".delete-item-confirm-overlay"),() => { cart.splice(index,1); saveCart(cart); }));
    row.querySelector(".cart-move-wishlist").addEventListener("click",() => requestConfirmation(document.querySelector(".move-wishlist-confirm-overlay"),() => {
        const favorites = getFavorites();
        if (!favorites.some(favorite => String(favorite.id) === String(item.id))) {
            favorites.push({
                id:String(item.id),
                title:cartItemTitle(item),
                price:item.price,
                image:cartItemImage(item),
                selectedOptions:{...(item.selectedOptions || {})},
                color:item.color || "",
                size:item.size || ""
            });
        }
        cart.splice(index,1);
        saveFavorites(favorites);
        saveCart(cart);
    }));
    row.querySelector(".cart-share").addEventListener("click",async() => { try { const url = new URL(`product.html?id=${encodeURIComponent(item.id)}`,location.href).href; if (navigator.share) await navigator.share({title:cartItemTitle(item),url}); else await navigator.clipboard.writeText(url); } catch {} row.classList.remove("is-swiped"); });
}

function closeOpenCartSwipes(except = null) {
    drawerItems.querySelectorAll(".cart-box.is-swiped").forEach(row => {
        if (row === except) return;
        row.classList.remove("is-swiped");
        row.querySelector(".cart-box-main")?.style.removeProperty("transform");
        row.querySelector(".cart-swipe-actions")?.setAttribute("aria-hidden","true");
    });
}

function normalizeCommerceItems(items,includeQuantity = false) {
    const normalized = window.normalizeMPWRItems?.(items) || items;
    return normalized.map(item => ({
        ...item,
        id:String(item.id),
        ...(includeQuantity ? {quantity:Math.max(1,Number(item.quantity) || 1)} : {})
    }));
}

function itemIdentity(item) {
    const selections = item.selectedOptions && Object.keys(item.selectedOptions).length
        ? Object.entries(item.selectedOptions).sort(([a],[b]) => a.localeCompare(b))
        : [["color",item.color || ""],["size",item.size || ""]];
    return [item.id,JSON.stringify(selections)].map(value => String(value).trim().toLowerCase()).join("::");
}

function mergeCommerceItems(accountItems,localItems,includeQuantity = false) {
    const merged = new Map();
    [...normalizeCommerceItems(accountItems,includeQuantity),...normalizeCommerceItems(localItems,includeQuantity)].forEach(item => {
        const key = itemIdentity(item);
        const existing = merged.get(key);
        if (!existing) merged.set(key,{...item});
        else if (includeQuantity) existing.quantity = Math.max(existing.quantity,item.quantity);
    });
    return [...merged.values()];
}

async function saveCommerceToAccount(collectionName,items) {
    try {
        const { auth, db, doc, setDoc } = await loadFirebaseServices();
        const user = auth?.currentUser;
        if (!user || !db) return;
        await setDoc(doc(db,collectionName,user.uid),{items});
        localStorage.setItem(collectionName === "carts" ? "mpwrCartOwnerUid" : "mpwrFavoritesOwnerUid",user.uid);
    } catch (error) {
        console.error(`Unable to synchronize ${collectionName}`,error);
    }
}

function getCart() {
    try { return normalizeCommerceItems(JSON.parse(localStorage.getItem("cart")) || [],true); }
    catch { return []; }
}

function saveCart(cart) {
    const normalizedCart = normalizeCommerceItems(cart,true);
    localStorage.setItem("cart",JSON.stringify(normalizedCart));
    void saveCommerceToAccount("carts",normalizedCart);
    renderCartDrawer();
    updateCartButton();
}

function cartItemImage(item) {
    return item.image || products.find(product => String(product.id) === String(item.id))?.image || "";
}

function cartItemTitle(item) {
    return item.title || products.find(product => String(product.id) === String(item.id))?.title || "Product";
}

function cartItemPrice(item) {
    const rawPrice = item.price || products.find(product => String(product.id) === String(item.id))?.price || 0;
    return Number(String(rawPrice).replace(/[^0-9.]/g,"")) || 0;
}

function getFavorites() {
    try { return normalizeCommerceItems(JSON.parse(localStorage.getItem("favorites")) || []); }
    catch { return []; }
}

function saveFavorites(favorites) {
    const normalizedFavorites = normalizeCommerceItems(favorites);
    localStorage.setItem("favorites",JSON.stringify(normalizedFavorites));
    void saveCommerceToAccount("favorites",normalizedFavorites);
    renderWishlistDrawer();
    updateProductWishlistButtons(normalizedFavorites);
}

function updateProductWishlistButtons(favorites = getFavorites()) {
    document.querySelectorAll(".product-box").forEach(card => {
        const isFavorite = favorites.some(item => String(item.id) === String(card.dataset.id));
        const icon = card.querySelector(".wishlist-icon");
        if (icon) icon.src = isFavorite ? "images/Heart7.PNG" : "images/optimized/heart-outline.png";
    });
}

function renderWishlistDrawer() {
    const favorites = getFavorites();
    wishlistDrawerItems.replaceChildren();
    favorites.forEach((item,index) => {
        const row = document.createElement("article");
        row.className = "wishlist-item";
        row.innerHTML = `<a href="product.html?id=${encodeURIComponent(item.id)}" class="wishlist-product-link" aria-label="View ${cartItemTitle(item)}"><img class="wishlist-img" src="${cartItemImage(item)}" alt="${cartItemTitle(item)}" loading="lazy" decoding="async"></a><div class="wishlist-details"><h3><a href="product.html?id=${encodeURIComponent(item.id)}" class="wishlist-title-link">${cartItemTitle(item)}</a></h3><span>UGX ${cartItemPrice(item).toLocaleString()}</span><button class="wishlist-add-cart" type="button">Add to Cart</button></div><button class="wishlist-remove" type="button"><img class="wishlist-remove-icon" src="images/Icon Folder/Delete Icon_333.PNG" alt=""></button>`;
        const removeIcon = row.querySelector(".wishlist-remove-icon");
        row.querySelector(".wishlist-remove").addEventListener("pointerenter",() => { removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        row.querySelector(".wishlist-remove").addEventListener("pointerleave",() => { removeIcon.src = "images/Icon Folder/Delete Icon_333.PNG"; });
        row.querySelector(".wishlist-remove").addEventListener("pointerdown",() => { removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        row.querySelector(".wishlist-remove").addEventListener("click",() => requestConfirmation(document.querySelector(".delete-item-confirm-overlay"),() => { favorites.splice(index,1); saveFavorites(favorites); }));
        row.querySelector(".wishlist-add-cart").addEventListener("click",() => {
            const cart = getCart();
            const cartItem = {...item,id:String(item.id),price:cartItemPrice(item),quantity:1};
            const existing = cart.find(savedItem => itemIdentity(savedItem) === itemIdentity(cartItem));
            if (existing) existing.quantity = Math.max(1,Number(existing.quantity) || 1) + 1;
            else cart.push(cartItem);
            saveCart(cart);
        });
        wishlistDrawerItems.appendChild(row);
    });
    document.querySelector(".wishlist-empty").style.display = favorites.length ? "none" : "flex";
    wishlistDrawerItems.style.display = favorites.length ? "block" : "none";
    document.querySelector(".wishlist-footer").style.display = favorites.length ? "block" : "none";
}

function renderCartDrawer() {
    const cart = getCart();
    const count = cart.reduce((sum,item) => sum + Math.max(1,Number(item.quantity) || 1),0);
    document.querySelector(".cart-title-count").textContent = `(${count})`;
    drawerItems.replaceChildren();
    cart.forEach((item,index) => {
        const quantity = Math.max(1,Number(item.quantity) || 1);
        const selections = item.selectedOptions && Object.keys(item.selectedOptions).length
            ? Object.values(item.selectedOptions).join(" • ")
            : [item.color,item.size].filter(Boolean).join(" • ");
        const row = document.createElement("article");
        row.className = "cart-box";
        row.innerHTML = `<div class="cart-swipe-actions" aria-hidden="true"><button class="cart-swipe-action cart-move-wishlist" type="button" aria-label="Move item to wishlist"><img src="images/Icon Folder/Move To Favorites Outline Icon_White.PNG" alt=""><span>Wishlist</span></button><button class="cart-swipe-action cart-share" type="button" aria-label="Share item"><img src="images/Icon Folder/Share Icon V2_White.PNG" alt=""><span>Share</span></button><button class="cart-swipe-action cart-delete" type="button" aria-label="Delete item"><img src="images/Icon Folder/Delete Icon_White.PNG" alt=""><span>Delete</span></button></div><div class="cart-box-main"><a href="product.html?id=${encodeURIComponent(item.id)}" class="cart-product-link" aria-label="View ${cartItemTitle(item)}"><img class="cart-img" src="${cartItemImage(item)}" alt="${cartItemTitle(item)}" loading="lazy" decoding="async"></a><div class="cart-detail"><h2 class="cart-product-title"><a href="product.html?id=${encodeURIComponent(item.id)}" class="cart-title-link">${cartItemTitle(item)}</a></h2><div class="cart-variants">${selections}</div><span class="cart-price">UGX ${cartItemPrice(item).toLocaleString()}</span><div class="cart-quantity"><button class="decrement" type="button" data-action="decrease" aria-label="Decrease quantity"><img src="images/Icon Folder/Minus Icon_333.PNG" alt=""></button><span class="number">${quantity}</span><button class="increment" type="button" data-action="increase" aria-label="Increase quantity"><img src="images/Icon Folder/Plus Icon_333.PNG" alt=""></button></div></div><div class="cart-item-actions"><img src="images/Icon Folder/Delete Icon_333.PNG" class="cart-remove" alt="Remove item" role="button" tabindex="0"></div></div>`;
        row.querySelector('[data-action="decrease"]').addEventListener("click",() => { if (quantity > 1) cart[index].quantity = quantity - 1; else cart.splice(index,1); saveCart(cart); });
        row.querySelector('[data-action="increase"]').addEventListener("click",() => { cart[index].quantity = quantity + 1; saveCart(cart); });
        const cartRemoveIcon = row.querySelector(".cart-remove");
        cartRemoveIcon.addEventListener("pointerdown",() => { cartRemoveIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        cartRemoveIcon.addEventListener("pointerenter",() => { cartRemoveIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        cartRemoveIcon.addEventListener("pointerleave",() => { cartRemoveIcon.src = "images/Icon Folder/Delete Icon_333.PNG"; });
        cartRemoveIcon.addEventListener("click",() => requestConfirmation(document.querySelector(".delete-item-confirm-overlay"),() => { cart.splice(index,1); saveCart(cart); }));
        attachCartSwipe(row,cart,index,item);
        drawerItems.appendChild(row);
    });
    document.querySelector(".cart-empty").style.display = cart.length ? "none" : "flex";
    drawerItems.style.display = cart.length ? "block" : "none";
    document.querySelector(".total").style.display = cart.length ? "flex" : "none";
    document.querySelector(".btn-buy").style.display = cart.length ? "block" : "none";
    const total = cart.reduce((sum,item) => sum + cartItemPrice(item) * Math.max(1,Number(item.quantity) || 1),0);
    document.querySelector(".total-price").textContent = `UGX ${total.toLocaleString()}`;
}

function openCartDrawer() {
    renderCartDrawer();
    cartDrawer.classList.add("active");
    document.body.classList.add("cart-drawer-open");
}

function closeCartDrawer() {
    cartDrawer.classList.remove("active");
    document.body.classList.remove("cart-drawer-open");
}

function openWishlistDrawer() {
    renderWishlistDrawer();
    wishlistDrawer.classList.add("active");
    document.body.classList.add("wishlist-drawer-open");
}

function closeWishlistDrawer() {
    wishlistDrawer.classList.remove("active");
    document.body.classList.remove("wishlist-drawer-open");
}

function normalizeSearchText(value = "") {
    return String(value)
        .toLowerCase()
        .replace(/['’]s\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function canonicalToken(token) {
    if (token.length > 3 && token.endsWith("ies")) return `${token.slice(0,-3)}y`;
    if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0,-1);
    return token;
}

function searchTokens(value) {
    const ignored = new Set(["a","an","and","for","of","the","to","with"]);
    const tokens = normalizeSearchText(value).split(" ").filter(Boolean).map(canonicalToken);
    const meaningful = tokens.filter(token => !ignored.has(token));
    return [...new Set(meaningful.length ? meaningful : tokens)];
}

function productSearchFields(product) {
    const optionLabels = (product.options || []).flatMap(group => [group.key,group.label,...(group.values || [])]);
    return {
        title: normalizeSearchText(product.title),
        description: normalizeSearchText(product.description),
        attributes: normalizeSearchText([...(product.colors || []),...(product.sizes || []),...optionLabels].join(" "))
    };
}

const productFamilies = [
    ["wig","hair","weave"],
    ["lash","eyelash"],
    ["nail","press on","polish","manicure"],
    ["moisturizer","cream","lotion","skincare"]
];

function familyMatches(text) {
    const normalized = normalizeSearchText(text);
    return productFamilies.filter(aliases => aliases.some(alias => normalized.includes(alias)));
}

function searchScore(product, searchQuery) {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return 1;

    const queryTokens = searchTokens(normalizedQuery);
    const fields = productSearchFields(product);
    const titleTokens = searchTokens(fields.title);
    const descriptionTokens = searchTokens(fields.description);
    const attributeTokens = searchTokens(fields.attributes);
    const allTokens = new Set([...titleTokens,...descriptionTokens,...attributeTokens]);
    const tokenMatches = (tokens,queryToken) => tokens.some(token => token === queryToken || (queryToken.length > 3 && (token.startsWith(queryToken) || queryToken.startsWith(token))));
    let score = 0;

    if (fields.title === normalizedQuery) score += 10000;
    else if (fields.title.startsWith(normalizedQuery)) score += 1800;
    else if (fields.title.includes(normalizedQuery)) score += 1400;
    if (fields.description.includes(normalizedQuery)) score += 300;
    if (fields.attributes.includes(normalizedQuery)) score += 350;

    queryTokens.forEach(token => {
        if (tokenMatches(titleTokens,token)) score += 220;
        if (tokenMatches(attributeTokens,token)) score += 70;
        if (tokenMatches(descriptionTokens,token)) score += 45;
    });

    if (queryTokens.every(token => tokenMatches(titleTokens,token))) score += 900;
    else if (queryTokens.every(token => tokenMatches([...allTokens],token))) score += 350;

    const queryFamilies = familyMatches(normalizedQuery);
    const productText = `${fields.title} ${fields.description} ${fields.attributes}`;
    if (queryFamilies.some(family => family.some(alias => productText.includes(alias)))) score += 100;

    return score;
}

function closeProductModal() {
    productModalOverlay.classList.remove("active");
    selectedModalProduct = null;
    selectedModalCard = null;
}

function openProductModal(product,card) {
    selectedModalProduct = product;
    selectedModalCard = card;
    selectedModalOptions = {};

    const optionGroups = Array.isArray(product.options) && product.options.length
        ? product.options
        : [
            product.colors?.length ? {key:"color",label:"Color",values:product.colors} : null,
            product.sizes?.length ? {key:"size",label:product.sizeLabel || "Size",values:product.sizes} : null
        ].filter(Boolean);

    const variantKey = () => optionGroups.map(group => selectedModalOptions[group.key] || "").join("|");
    const updateModalVariant = () => {
        const color = selectedModalOptions.color || "";
        const size = selectedModalOptions.size || selectedModalOptions.length || "";
        const key = variantKey();
        const variant = product.variants?.[key];
        const images = variant?.images || variant?.gallery ||
            product.variantGalleries?.[key] ||
            product.variantGalleries?.[color]?.[size] ||
            product.sizeGalleries?.[size] ||
            product.galleries?.[color] ||
            product.gallery || [product.image];

        selectedModalPrice = variant?.price ||
            product.variantPrices?.[key] ||
            product.variantPrices?.[color]?.[size] ||
            product.sizePrices?.[size] ||
            product.colorPrices?.[color] ||
            product.price;

        productModalImage.src = images[0] || product.image;
        productModalPrice.textContent = `UGX ${Number(selectedModalPrice).toLocaleString()}`;
        const detailParams = new URLSearchParams({id:String(product.id)});
        Object.entries(selectedModalOptions).forEach(([optionKey,value]) => {
            if (value) detailParams.set(optionKey,value);
        });
        const detailHref = `product.html?${detailParams.toString()}`;
        productModalReadMore.href = detailHref;
        productModalImageLink.href = detailHref;
        productModalTitleLink.href = detailHref;
    };

    productModalTitle.textContent = product.title;
    productModalImage.alt = product.title;
    const previewWords = String(product.description || "Product description coming soon.").trim().split(/\s+/).slice(0,6);
    productModalDescription.textContent = `${previewWords.join(" ")}...`;
    productModalOptions.replaceChildren();
    productModalOptionsGroup.hidden = optionGroups.length === 0;

    optionGroups.forEach((group,groupIndex) => {
        const valuesList = Array.isArray(group.values) ? group.values : [];
        selectedModalOptions[group.key] = valuesList[0] || "";
        if (groupIndex > 0) {
            const divider = document.createElement("div");
            divider.className = "product-modal-section-divider";
            divider.setAttribute("aria-hidden","true");
            productModalOptions.appendChild(divider);
        }
        const section = document.createElement("section");
        section.className = "product-modal-option-group";
        section.innerHTML = `<h3>${group.label}</h3><div class="product-modal-option-values"></div>`;
        const values = section.querySelector(".product-modal-option-values");
        if (valuesList.length === 1) values.classList.add("has-one-option");
        valuesList.forEach((value,index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = value;
            button.className = "product-modal-option-btn";
            button.classList.toggle("active",index === 0);
            button.addEventListener("click",() => {
                values.querySelectorAll(".product-modal-option-btn").forEach(item => item.classList.remove("active"));
                button.classList.add("active");
                selectedModalOptions[group.key] = value;
                updateModalVariant();
            });
            values.appendChild(button);
        });
        productModalOptions.appendChild(section);
    });

    const isFavorite = getFavorites().some(item => String(item.id) === String(product.id));
    productModalFavorite.textContent = isFavorite ? "Remove From Favorites" : "Add To Favorites";
    updateModalVariant();
    productModalOverlay.classList.add("active");
}

function optionValues(product,keyPattern) {
    return (product.options || []).filter(group => keyPattern.test(`${group.key} ${group.label}`)).flatMap(group => group.values || []);
}

function addOptions(select,values) {
    [...new Set(values)].sort().forEach(value => select.add(new Option(value,value)));
}

const filterPickers = [];

function closeFilterPickers(except = null) {
    filterPickers.forEach(picker => {
        if (picker === except) return;
        picker.menu.hidden = true;
        picker.trigger.setAttribute("aria-expanded","false");
    });
}

function positionFilterMenu(picker) {
    const rect = picker.trigger.getBoundingClientRect();
    picker.menu.style.minWidth = `${rect.width}px`;
    picker.menu.style.left = `${Math.max(8,Math.min(rect.left,window.innerWidth - picker.menu.offsetWidth - 8))}px`;
    const below = rect.bottom + 8;
    const above = rect.top - picker.menu.offsetHeight - 8;
    picker.menu.style.top = `${below + picker.menu.offsetHeight <= window.innerHeight - 8 || above < 8 ? below : above}px`;
}

function enhanceFilterSelect(select) {
    const picker = document.createElement("div");
    picker.className = "filter-picker";
    picker.dataset.selectId = select.id;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "filter-picker-trigger";
    trigger.setAttribute("aria-haspopup","listbox");
    trigger.setAttribute("aria-expanded","false");
    trigger.innerHTML = '<span class="filter-picker-label"></span><span class="filter-picker-arrow" aria-hidden="true"></span>';
    const menu = document.createElement("div");
    menu.className = "filter-picker-menu";
    menu.setAttribute("role","listbox");
    menu.setAttribute("aria-label",select.getAttribute("aria-label") || "Filter options");
    menu.hidden = true;
    picker.appendChild(trigger);
    select.insertAdjacentElement("afterend",picker);
    document.body.appendChild(menu);

    const pickerState = {picker,trigger,menu,select};
    filterPickers.push(pickerState);

    const syncSelection = () => {
        const selectedOption = select.options[select.selectedIndex];
        trigger.querySelector(".filter-picker-label").textContent = selectedOption?.dataset.triggerLabel || selectedOption?.textContent || "Select";
        menu.querySelectorAll("button").forEach(button => {
            const selected = button.dataset.value === select.value;
            button.classList.toggle("selected",selected);
            button.setAttribute("aria-selected",String(selected));
        });
    };

    [...select.options].forEach((option,index,options) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role","option");
        button.dataset.value = option.value;
        button.textContent = option.textContent;
        button.addEventListener("click",event => {
            event.stopPropagation();
            select.value = option.value;
            select.dispatchEvent(new Event("change",{bubbles:true}));
            syncSelection();
            closeFilterPickers();
            trigger.focus();
        });
        menu.appendChild(button);
        if (index < options.length - 1) {
            const divider = document.createElement("div");
            divider.className = "filter-option-divider";
            divider.setAttribute("aria-hidden","true");
            menu.appendChild(divider);
        }
    });

    trigger.addEventListener("click",event => {
        event.stopPropagation();
        const willOpen = menu.hidden;
        closeFilterPickers(willOpen ? pickerState : null);
        menu.hidden = !willOpen;
        trigger.setAttribute("aria-expanded",String(willOpen));
        if (willOpen) {
            positionFilterMenu(pickerState);
            menu.querySelector(".selected")?.focus();
        }
    });
    const handlePickerKeys = event => {
        if (event.key === "Escape") {
            closeFilterPickers();
            trigger.focus();
        }
    };
    picker.addEventListener("keydown",handlePickerKeys);
    menu.addEventListener("keydown",handlePickerKeys);
    select.addEventListener("change",syncSelection);
    syncSelection();
}

function resultCard(product) {
    const card = document.createElement("div");
    card.className = "product-box";
    card.dataset.id = product.id;
    card.tabIndex = 0;
    const isFavorite = getFavorites().some(item => String(item.id) === String(product.id));
    card.innerHTML = `
        <div class="img-box">
            <button class="wishlist-btn" type="button" aria-label="Add ${product.title} to wishlist">
                <img src="${isFavorite ? "images/Heart7.PNG" : "images/optimized/heart-outline.png"}" class="wishlist-icon" alt="">
            </button>
            <img src="${product.image}" alt="${product.title}" loading="lazy" decoding="async">
        </div>
        <h2 class="product-title">${product.title}</h2>
        <div class="price-and-cart">
            <span class="price">UGX ${Number(product.price).toLocaleString()}</span>
            <i><img src="images/Plus.PNG" class="addie" alt="View product"></i>
        </div>`;
    const open = () => location.href = `product.html?id=${encodeURIComponent(product.id)}`;
    card.addEventListener("click",open);
    card.addEventListener("keydown",event => { if (event.key === "Enter" && !event.target.closest("button")) open(); });
    card.querySelector(".wishlist-btn").addEventListener("click",event => {
        event.stopPropagation();
        const favorites = getFavorites();
        const favoriteIndex = favorites.findIndex(item => String(item.id) === String(product.id));
        if (favoriteIndex >= 0) favorites.splice(favoriteIndex,1);
        else favorites.push({id:String(product.id),title:product.title,price:product.price,image:product.image});
        saveFavorites(favorites);
        event.currentTarget.querySelector("img").src = favoriteIndex >= 0 ? "images/optimized/heart-outline.png" : "images/Heart7.PNG";
    });
    card.querySelector(".addie").addEventListener("click",event => {
        event.stopPropagation();
        openProductModal(product,card);
    });
    return card;
}

function matchingProducts() {
    return products
        .map((product,index) => ({product,index,score:searchScore(product,query)}))
        .filter(match => match.score > 0)
        .sort((a,b) => b.score - a.score || a.index - b.index)
        .map(match => match.product);
}

const baseMatches = matchingProducts();

function render() {
    let matches = baseMatches.filter(product => {
        const colors = [...(product.colors || []),...optionValues(product,/color/i)];
        const sizes = [...(product.sizes || []),...optionValues(product,/size|length/i)];
        return (!colorFilter.value || colors.includes(colorFilter.value)) && (!sizeFilter.value || sizes.includes(sizeFilter.value));
    });
    if (sortResults.value === "low") matches.sort((a,b) => Number(a.price) - Number(b.price));
    if (sortResults.value === "high") matches.sort((a,b) => Number(b.price) - Number(a.price));
    if (sortResults.value === "popular") matches.sort((a,b) => Number(a.id) - Number(b.id));
    resultsGrid.replaceChildren(...matches.map(resultCard));
    resultsGrid.hidden = matches.length === 0;
    noResults.hidden = matches.length > 0;
}

queryInput.value = query;
addOptions(colorFilter,baseMatches.flatMap(product => [...(product.colors || []),...optionValues(product,/color/i)]));
addOptions(sizeFilter,baseMatches.flatMap(product => [...(product.sizes || []),...optionValues(product,/size|length/i)]));
[sortResults,colorFilter,sizeFilter].forEach(enhanceFilterSelect);
resultsToolbar.classList.add("filters-ready");
resultsToolbar.removeAttribute("aria-busy");
document.addEventListener("click",event => {
    if (!event.target.closest(".filter-picker-trigger,.filter-picker-menu")) closeFilterPickers();
});
window.addEventListener("resize",() => closeFilterPickers());
window.addEventListener("scroll",() => closeFilterPickers(),{passive:true});
resultsToolbar.addEventListener("scroll",() => closeFilterPickers(),{passive:true});

productModalOverlay.addEventListener("click",event => {
    if (event.target === productModalOverlay) closeProductModal();
});
productModalFavorite.addEventListener("click",() => {
    if (!selectedModalProduct) return;
    const favorites = getFavorites();
    const favoriteIndex = favorites.findIndex(item => String(item.id) === String(selectedModalProduct.id));
    if (favoriteIndex >= 0) favorites.splice(favoriteIndex,1);
    else favorites.push({
        id:String(selectedModalProduct.id),
        title:selectedModalProduct.title,
        price:selectedModalProduct.price,
        image:selectedModalProduct.image
    });
    saveFavorites(favorites);
    const isFavorite = favoriteIndex < 0;
    productModalFavorite.textContent = isFavorite ? "Remove From Favorites" : "Add To Favorites";
    selectedModalCard?.querySelector(".wishlist-icon")?.setAttribute("src",isFavorite ? "images/Heart7.PNG" : "images/optimized/heart-outline.png");
});
productModalCart.addEventListener("click",() => {
    if (!selectedModalProduct) return;
    const cart = getCart();
    const cartItem = {
        id:String(selectedModalProduct.id),
        title:selectedModalProduct.title,
        price:Number(selectedModalPrice),
        image:productModalImage.src,
        selectedOptions:{...selectedModalOptions},
        color:selectedModalOptions.color || "",
        size:selectedModalOptions.size || selectedModalOptions.length || "",
        quantity:1
    };
    const alreadyInCart = cart.some(item => itemIdentity(item) === itemIdentity(cartItem));
    if (alreadyInCart) {
        showDrawerToast("This item is already in the cart ⚠️","warning");
        return;
    }
    cart.push(cartItem);
    saveCart(cart);

    const productImage = selectedModalCard?.querySelector(".img-box > img");
    const cartIcon = document.querySelector("#cart-icon");
    if (productImage && cartIcon) {
        const imageRect = productImage.getBoundingClientRect();
        const cartRect = cartIcon.getBoundingClientRect();
        const flyingImage = productImage.cloneNode(true);
        flyingImage.classList.add("flying-image");
        flyingImage.style.left = `${imageRect.left}px`;
        flyingImage.style.top = `${imageRect.top}px`;
        document.body.appendChild(flyingImage);

        requestAnimationFrame(() => {
            flyingImage.style.left = `${cartRect.left}px`;
            flyingImage.style.top = `${cartRect.top}px`;
            flyingImage.style.width = "20px";
            flyingImage.style.height = "20px";
            flyingImage.style.opacity = "0";
        });

        setTimeout(() => flyingImage.remove(),650);
        cartIcon.classList.add("cart-bounce");
        setTimeout(() => cartIcon.classList.remove("cart-bounce"),450);
    }

    showDrawerToast("Added to cart 🛒","success");
});

searchForm.id = "results-search-form";
searchForm.addEventListener("submit",event => { event.preventDefault(); if (queryInput.value.trim()) location.href = `search-results.html?q=${encodeURIComponent(queryInput.value.trim())}`; });
document.querySelector(".query-clear").addEventListener("click",() => { queryInput.value = ""; queryInput.focus(); });
document.querySelector(".product-back-btn").addEventListener("click",() => location.href = `search.html?q=${encodeURIComponent(query)}`);
document.querySelector("#cart-icon").addEventListener("click",() => {
    openCartDrawer();
});
document.querySelector("#wishlist-nav-icon").addEventListener("click",openWishlistDrawer);
document.querySelector("#cart-close").addEventListener("click",closeCartDrawer);
cartBackdrop.addEventListener("click",closeCartDrawer);
document.querySelector("#wishlist-close").addEventListener("click",closeWishlistDrawer);
wishlistBackdrop.addEventListener("click",closeWishlistDrawer);
document.addEventListener("keydown",event => {
    if (event.key === "Escape") {
        closeCartDrawer();
        closeWishlistDrawer();
        closeProductModal();
    }
});
document.querySelector(".btn-buy").addEventListener("click",() => { location.href = "checkout.html"; });
document.querySelector(".continue-shopping").addEventListener("click",closeCartDrawer);
document.querySelector(".wishlist-continue").addEventListener("click",closeWishlistDrawer);
document.addEventListener("click",event => {
    if (event.target.closest(".confirm-overlay")) return;
    if (cartDrawer.classList.contains("active") && !cartDrawer.contains(event.target) && !event.target.closest("#cart-icon")) closeCartDrawer();
    if (wishlistDrawer.classList.contains("active") && !wishlistDrawer.contains(event.target) && !event.target.closest("#wishlist-nav-icon")) closeWishlistDrawer();
    if (Date.now() >= suppressSwipeCloseUntil && !event.target.closest(".cart-swipe-actions")) closeOpenCartSwipes();
});
const cartMenu = document.querySelector(".cart-menu-toggle");
const cartActions = document.querySelector(".cart-actions-menu");
const clearWishlist = document.querySelector(".clear-wishlist");
const clearWishlistIcon = clearWishlist.querySelector(".clear-wishlist-icon");
function closeCartMenu() { cartActions.hidden = true; cartMenu.setAttribute("aria-expanded","false"); }
cartMenu.addEventListener("click",event => { event.stopPropagation(); const open = cartActions.hidden; cartActions.hidden = !open; cartMenu.setAttribute("aria-expanded",String(open)); });
document.addEventListener("click",event => { if (!event.target.closest(".cart-header-actions")) closeCartMenu(); });
document.querySelector(".cart-delete-all").addEventListener("click",() => { closeCartMenu(); requestConfirmation(document.querySelector(".delete-item-confirm-overlay"),() => saveCart([])); });
document.querySelector(".cart-share-all").addEventListener("click",async() => {
    const cart = getCart();
    closeCartMenu();
    if (!cart.length) {
        showDrawerToast("Your cart is empty 🛒","warning");
        return;
    }
    const text = cart.map(item => `${Math.max(1,Number(item.quantity) || 1)} × ${cartItemTitle(item)} — UGX ${cartItemPrice(item).toLocaleString()}`).join("\n");
    try {
        if (navigator.share) {
            await navigator.share({title:"My MPWR cart",text});
        } else {
            await copyText(text);
            showDrawerToast("Cart copied","success");
        }
    } catch (error) {
        if (error?.name === "AbortError") return;
        try {
            await copyText(text);
            showDrawerToast("Cart copied","success");
        } catch {}
    }
});
clearWishlist.addEventListener("pointerenter",() => { clearWishlistIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
clearWishlist.addEventListener("pointerleave",() => { clearWishlistIcon.src = "images/Icon Folder/Delete Icon_333.PNG"; });
clearWishlist.addEventListener("pointerdown",() => {
    clearWishlistIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    setTimeout(() => { if (!clearWishlist.matches(":hover")) clearWishlistIcon.src = "images/Icon Folder/Delete Icon_333.PNG"; },120);
});
clearWishlist.addEventListener("click",() => requestConfirmation(document.querySelector(".wishlist-clear-confirm-overlay"),() => saveFavorites([])));
window.addEventListener("storage",event => {
    if (event.storageArea !== localStorage) return;
    if (event.key === "cart") {
        updateCartButton();
        if (cartDrawer.classList.contains("active")) renderCartDrawer();
    }
    if (event.key === "favorites") {
        updateProductWishlistButtons();
        if (wishlistDrawer.classList.contains("active")) renderWishlistDrawer();
    }
});
["pageshow","focus"].forEach(eventName => window.addEventListener(eventName,() => {
    updateCartButton();
    updateProductWishlistButtons();
    if (cartDrawer.classList.contains("active")) renderCartDrawer();
    if (wishlistDrawer.classList.contains("active")) renderWishlistDrawer();
}));
loadFirebaseServices().then(({ auth, db, doc, getDoc, setDoc, onAuthStateChanged }) => {
    if (!auth || !db) return;
    onAuthStateChanged(auth,async user => {
        if (!user) return;
        try {
            const [cartDocument,favoritesDocument] = await Promise.all([
                getDoc(doc(db,"carts",user.uid)),
                getDoc(doc(db,"favorites",user.uid))
            ]);
            const mergedCart = mergeCommerceItems(cartDocument.exists() ? cartDocument.data().items || [] : [],getCart(),true);
            const mergedFavorites = mergeCommerceItems(favoritesDocument.exists() ? favoritesDocument.data().items || [] : [],getFavorites());
            localStorage.setItem("cart",JSON.stringify(mergedCart));
            localStorage.setItem("favorites",JSON.stringify(mergedFavorites));
            localStorage.setItem("mpwrCartOwnerUid",user.uid);
            localStorage.setItem("mpwrFavoritesOwnerUid",user.uid);
            await Promise.all([
                setDoc(doc(db,"carts",user.uid),{items:mergedCart}),
                setDoc(doc(db,"favorites",user.uid),{items:mergedFavorites})
            ]);
            updateCartButton();
            updateProductWishlistButtons(mergedFavorites);
            if (cartDrawer.classList.contains("active")) renderCartDrawer();
            if (wishlistDrawer.classList.contains("active")) renderWishlistDrawer();
        } catch (error) {
            console.error("Unable to synchronize shopping data",error);
        }
    });
}).catch(error => {
    console.error("Unable to initialize account synchronization",error);
});
[sortResults,colorFilter,sizeFilter].forEach(control => control.addEventListener("change",render));
document.querySelector(".reset-filters").addEventListener("click",() => {
    sortResults.value = "relevance";
    colorFilter.value = "";
    sizeFilter.value = "";
    [sortResults,colorFilter,sizeFilter].forEach(control => control.dispatchEvent(new Event("change",{bubbles:true})));
    closeFilterPickers();
});
render();
updateCartButton();
