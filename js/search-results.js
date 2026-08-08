import { mountMPWRDrawers } from "./drawer-component.js?v=20260808-8";

mountMPWRDrawers(document.body);

const queryInput = document.querySelector("#results-query");
const searchForm = document.querySelector(".results-search");
const queryLabel = document.querySelector(".query-label");
const resultsGrid = document.querySelector(".results-grid");
const resultTotal = document.querySelector(".result-total");
const noResults = document.querySelector(".no-results");
const sortResults = document.querySelector("#sort-results");
const colorFilter = document.querySelector("#color-filter");
const sizeFilter = document.querySelector("#size-filter");
const relatedSearches = document.querySelector(".related-searches");
const query = new URLSearchParams(location.search).get("q")?.trim() || "";

function updateCartButton() {
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem("cart")) || []; } catch {}
    const count = cart.reduce((total,item) => total + Math.max(1,Number(item.quantity) || 1),0);
    const badge = document.querySelector(".results-cart-count");
    badge.textContent = count;
    badge.hidden = count === 0;
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
    row.querySelector(".cart-move-wishlist").addEventListener("click",() => requestConfirmation(document.querySelector(".move-wishlist-confirm-overlay"),() => { const favorites = getFavorites(); if (!favorites.some(favorite => String(favorite.id) === String(item.id))) favorites.push({...item}); cart.splice(index,1); saveFavorites(favorites); saveCart(cart); }));
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

function getCart() {
    try { return JSON.parse(localStorage.getItem("cart")) || []; } catch { return []; }
}

function saveCart(cart) {
    localStorage.setItem("cart",JSON.stringify(cart));
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
    try { return JSON.parse(localStorage.getItem("favorites")) || []; } catch { return []; }
}

function saveFavorites(favorites) {
    localStorage.setItem("favorites",JSON.stringify(favorites));
    renderWishlistDrawer();
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
            const existing = cart.find(cartItem => String(cartItem.id) === String(item.id));
            if (existing) existing.quantity = Math.max(1,Number(existing.quantity) || 1) + 1;
            else cart.push({...item,price:cartItemPrice(item),quantity:1});
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

function searchableText(product) {
    const values = (product.options || []).flatMap(group => group.values || []);
    return [product.title,product.description,...(product.colors || []),...(product.sizes || []),...values].join(" ").toLowerCase();
}

function optionValues(product,keyPattern) {
    return (product.options || []).filter(group => keyPattern.test(`${group.key} ${group.label}`)).flatMap(group => group.values || []);
}

function addOptions(select,values) {
    [...new Set(values)].sort().forEach(value => select.add(new Option(value,value)));
}

function resultCard(product) {
    const card = document.createElement("article");
    card.className = "result-card";
    card.tabIndex = 0;
    card.innerHTML = `<div class="result-image"><img src="${product.image}" alt="${product.title}" loading="lazy"></div><h3>${product.title}</h3><div class="result-card-footer"><span>UGX ${Number(product.price).toLocaleString()}</span><img src="images/Plus.PNG" alt="View product"></div>`;
    const open = () => location.href = `product.html?id=${encodeURIComponent(product.id)}`;
    card.addEventListener("click",open);
    card.addEventListener("keydown",event => { if (event.key === "Enter") open(); });
    return card;
}

function matchingProducts() {
    const normalized = query.toLowerCase();
    return products.filter(product => !normalized || searchableText(product).includes(normalized));
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
    resultTotal.textContent = `${matches.length} product${matches.length === 1 ? "" : "s"}`;
    resultsGrid.hidden = matches.length === 0;
    noResults.hidden = matches.length > 0;
}

queryInput.value = query;
queryLabel.textContent = query || "All products";
addOptions(colorFilter,baseMatches.flatMap(product => [...(product.colors || []),...optionValues(product,/color/i)]));
addOptions(sizeFilter,baseMatches.flatMap(product => [...(product.sizes || []),...optionValues(product,/size|length/i)]));

const related = [...new Set(baseMatches.flatMap(product => [product.title,...(product.colors || []),...(product.sizes || [])]))].filter(label => label.toLowerCase() !== query.toLowerCase()).slice(0,10);
related.forEach(label => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "related-chip";
    button.textContent = label;
    button.addEventListener("click",() => location.href = `search-results.html?q=${encodeURIComponent(label)}`);
    relatedSearches.appendChild(button);
});

searchForm.id = "results-search-form";
searchForm.addEventListener("submit",event => { event.preventDefault(); if (queryInput.value.trim()) location.href = `search-results.html?q=${encodeURIComponent(queryInput.value.trim())}`; });
document.querySelector(".query-clear").addEventListener("click",() => { queryInput.value = ""; queryInput.focus(); });
document.querySelector(".results-back").addEventListener("click",() => location.href = `search.html?q=${encodeURIComponent(query)}`);
document.querySelector(".results-cart").addEventListener("click",() => {
    openCartDrawer();
});
document.querySelector(".results-wishlist").addEventListener("click",openWishlistDrawer);
document.querySelector("#cart-close").addEventListener("click",closeCartDrawer);
cartBackdrop.addEventListener("click",closeCartDrawer);
document.querySelector("#wishlist-close").addEventListener("click",closeWishlistDrawer);
wishlistBackdrop.addEventListener("click",closeWishlistDrawer);
document.addEventListener("keydown",event => { if (event.key === "Escape") { closeCartDrawer(); closeWishlistDrawer(); } });
document.querySelector(".btn-buy").addEventListener("click",() => { location.href = "checkout.html"; });
document.querySelector(".continue-shopping").addEventListener("click",closeCartDrawer);
document.querySelector(".wishlist-continue").addEventListener("click",closeWishlistDrawer);
document.addEventListener("click",event => {
    if (event.target.closest(".confirm-overlay")) return;
    if (cartDrawer.classList.contains("active") && !cartDrawer.contains(event.target) && !event.target.closest(".results-cart")) closeCartDrawer();
    if (wishlistDrawer.classList.contains("active") && !wishlistDrawer.contains(event.target) && !event.target.closest(".results-wishlist")) closeWishlistDrawer();
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
    if (event.key === "favorites" && wishlistDrawer.classList.contains("active")) renderWishlistDrawer();
});
[sortResults,colorFilter,sizeFilter].forEach(control => control.addEventListener("change",render));
document.querySelector(".reset-filters").addEventListener("click",() => { sortResults.value = "relevance"; colorFilter.value = ""; sizeFilter.value = ""; render(); });
render();
updateCartButton();
