import { mountMPWRDrawers } from "./drawer-component.js?v=20260816-6";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

mountMPWRDrawers(document.body);

const historyGrid = document.querySelector(".history-products");
const historyIntro = document.querySelector(".history-intro");
const emptyState = document.querySelector(".history-empty");
const historyFooter = document.querySelector(".history-footer");
const clearButton = document.querySelector(".history-clear");
const clearOverlay = document.querySelector(".history-clear-confirm-overlay");
const clearCancel = document.querySelector(".history-clear-cancel");
const clearConfirm = document.querySelector(".history-clear-confirm");
const historyKey = "mpwrProductHistory";
const cartDrawer = document.querySelector(".cart");
const cartContent = cartDrawer.querySelector(".cart-content");
const cartTrigger = document.querySelector(".history-cart-trigger");
const cartBackdrop = document.querySelector(".history-cart-backdrop");
const wishlistDrawer = document.querySelector(".wishlist");
const wishlistContent = wishlistDrawer.querySelector(".wishlist-content");
const wishlistTrigger = document.querySelector("#wishlist-nav-icon");
const wishlistClearButton = wishlistDrawer.querySelector(".clear-wishlist");
const wishlistClearIcon = wishlistClearButton.querySelector(".clear-wishlist-icon");
const wishlistClearOverlay = document.querySelector(".wishlist-clear-confirm-overlay");
const productModalOverlay = document.querySelector(".product-modal-overlay");
const productModalImage = productModalOverlay.querySelector(".product-modal-image");
const productModalImageLink = productModalOverlay.querySelector(".product-modal-image-link");
const productModalTitle = productModalOverlay.querySelector(".product-modal-title");
const productModalTitleLink = productModalOverlay.querySelector(".product-modal-title-link");
const productModalReviewStars = productModalOverlay.querySelector(".product-modal-review-stars");
const productModalReviewSummary = productModalOverlay.querySelector(".product-modal-review-summary");
const productModalPrice = productModalOverlay.querySelector(".product-modal-price");
const productModalDescription = productModalOverlay.querySelector(".product-modal-description");
const productModalReadMore = productModalOverlay.querySelector(".product-modal-read-more");
const productModalOptions = productModalOverlay.querySelector(".product-modal-options-dynamic");
const productModalOptionsGroup = productModalOverlay.querySelector(".product-modal-options-group");
const productModalFavorite = productModalOverlay.querySelector(".product-modal-favorite");
const productModalCart = productModalOverlay.querySelector(".product-modal-cart");
const cartDeleteOverlay = document.querySelector(".delete-item-confirm-overlay");
const moveWishlistOverlay = document.querySelector(".move-wishlist-confirm-overlay");
let pendingCartDelete = null;
let confirmingDeleteIcon = null;
let pendingMoveToWishlist = null;
let selectedModalProduct = null;
let selectedModalOptions = {};
let selectedModalPrice = 0;

function showToast(message,type = "success") {
    const toast = document.querySelector(".toast");
    if (!toast) return;
    clearTimeout(toast.hideTimer);
    toast.textContent = message;
    toast.className = `toast ${type}`;
    void toast.offsetWidth;
    toast.classList.add("show");
    toast.hideTimer = setTimeout(() => toast.classList.remove("show"),2500);
}

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("cart")) || [];
        if (!Array.isArray(cart)) return [];
        return window.normalizeMPWRItems?.(cart) || cart;
    } catch {
        return [];
    }
}

function cartSelections(item) {
    if (item?.selectedOptions && Object.keys(item.selectedOptions).length) {
        return item.selectedOptions;
    }
    return { color:item?.color || "", size:item?.size || "" };
}

function cartIdentity(item) {
    const selections = Object.entries(cartSelections(item)).sort(([a],[b]) => a.localeCompare(b));
    return [item.id,JSON.stringify(selections)]
        .map(value => String(value).trim().toLowerCase())
        .join("::");
}

function cartProduct(item) {
    return products.find(product => String(product.id) === String(item.id));
}

function cartTitle(item) {
    return item.title || cartProduct(item)?.title || "Product";
}

function cartImage(item) {
    const image = item.image || cartProduct(item)?.image || "";
    return window.normalizeMPWRImagePath?.(image, item.id) || image;
}

function cartPrice(item) {
    const value = item.price ?? cartProduct(item)?.price ?? 0;
    return Number(String(value).replace(/[^0-9.]/g,"")) || 0;
}

function cartProductLink(item) {
    const parameters = new URLSearchParams({ id:String(item.id) });
    Object.entries(cartSelections(item)).forEach(([key,value]) => {
        if (value) parameters.set(key,value);
    });
    return `product.html?${parameters.toString()}`;
}

function saveCart(cart, shouldRender = true) {
    cart = window.normalizeMPWRItems?.(cart) || cart;
    localStorage.setItem("cart",JSON.stringify(cart));
    void saveCartToAccount(cart);
    if (shouldRender) renderCart();
}

async function saveCartToAccount(cart) {
    const user = window.auth?.currentUser;
    if (!user || !window.db) return;
    try {
        await setDoc(doc(window.db,"carts",user.uid),{items:cart});
        localStorage.setItem("mpwrCartOwnerUid",user.uid);
    } catch (error) {
        console.error("Unable to synchronize cart",error);
    }
}

function mergeCartItems(accountItems,localItems,combineQuantities) {
    const merged = new Map();
    accountItems.forEach(item => merged.set(cartIdentity(item),{...item}));
    localItems.forEach(item => {
        const key = cartIdentity(item);
        const saved = merged.get(key);
        if (!saved) {
            merged.set(key,{...item});
            return;
        }
        const accountQuantity = Number(saved.quantity) || 1;
        const localQuantity = Number(item.quantity) || 1;
        saved.quantity = combineQuantities
            ? accountQuantity + localQuantity
            : Math.max(accountQuantity,localQuantity);
    });
    return window.normalizeMPWRItems?.([...merged.values()]) || [...merged.values()];
}

function updateCartBadge(cart = getCart()) {
    const count = cart.reduce((total,item) => total + Math.max(1,Number(item.quantity) || 1),0);
    const badge = cartTrigger.querySelector(".cart-item-count");
    badge.textContent = count ? String(count) : "";
    badge.style.display = count ? "flex" : "none";
    badge.style.visibility = count ? "visible" : "hidden";
    badge.style.opacity = count ? "1" : "0";
    cartDrawer.querySelector(".cart-title-count").textContent = `(${count})`;
}

function requestCartDelete(action, deletingAll = false, icon = null, source = "cart") {
    pendingCartDelete = action;
    confirmingDeleteIcon = icon;
    if (icon) icon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    cartDeleteOverlay.querySelector("h2").textContent = deletingAll ? "Delete All Items" : "Delete Item";
    cartDeleteOverlay.querySelector(".delete-item-confirm-message").textContent = deletingAll
        ? "Are you sure you want to delete all items from your cart?"
        : `Are you sure you want to delete this item from your ${source}?`;
    cartDeleteOverlay.querySelector(".delete-item-confirm").textContent = deletingAll ? "Delete All" : "Delete Item";
    cartDeleteOverlay.classList.add("active");
    cartDeleteOverlay.setAttribute("aria-hidden","false");
}

function closeCartDelete() {
    pendingCartDelete = null;
    if (confirmingDeleteIcon) confirmingDeleteIcon.src = "images/Icon Folder/Delete Icon_333.PNG";
    confirmingDeleteIcon = null;
    cartDeleteOverlay.classList.remove("active");
    cartDeleteOverlay.setAttribute("aria-hidden","true");
}

function closeMoveWishlist() {
    pendingMoveToWishlist = null;
    moveWishlistOverlay.classList.remove("active");
    moveWishlistOverlay.setAttribute("aria-hidden","true");
}

function renderCart() {
    const cart = getCart();
    cartContent.replaceChildren();

    cart.forEach((item,index) => {
        const quantity = Math.max(1,Number(item.quantity) || 1);
        const selections = Object.values(cartSelections(item)).filter(Boolean).join(" • ");
        const row = document.createElement("article");
        row.className = "cart-box";
        row.innerHTML = `<div class="cart-swipe-actions" aria-hidden="true"><button class="cart-swipe-action cart-move-wishlist" type="button" aria-label="Move item to wishlist"><img src="images/Icon Folder/Move To Favorites Outline Icon_White.PNG" alt=""><span>Wishlist</span></button><button class="cart-swipe-action cart-share" type="button" aria-label="Share item"><img src="images/Icon Folder/Share Icon V2_White.PNG" alt=""><span>Share</span></button><button class="cart-swipe-action cart-delete" type="button" aria-label="Delete item"><img src="images/Icon Folder/Delete Icon_White.PNG" alt=""><span>Delete</span></button></div><div class="cart-box-main"><a href="${cartProductLink(item)}" class="cart-product-link" aria-label="View ${cartTitle(item)}"><img class="cart-img" src="${cartImage(item)}" alt="${cartTitle(item)}" loading="lazy" decoding="async"></a><div class="cart-detail"><h2 class="cart-product-title"><a href="${cartProductLink(item)}" class="cart-title-link">${cartTitle(item)}</a></h2><div class="cart-variants">${selections}</div><span class="cart-price">UGX ${cartPrice(item).toLocaleString()}</span><div class="cart-quantity"><button class="decrement" type="button" aria-label="Decrease quantity"><img src="images/Icon Folder/Minus Icon_333.PNG" alt=""></button><span class="number">${quantity}</span><button class="increment" type="button" aria-label="Increase quantity"><img src="images/Icon Folder/Plus Icon_333.PNG" alt=""></button></div></div><div class="cart-item-actions"><img src="images/Icon Folder/Delete Icon_333.PNG" class="cart-remove" alt="Remove item" role="button" tabindex="0"></div></div>`;

        const number = row.querySelector(".number");
        const updateQuantity = nextQuantity => {
            cart[index].quantity = nextQuantity;
            number.textContent = String(nextQuantity);
            saveCart(cart,false);
            updateCartBadge(cart);
            updateCartTotal(cart);
        };
        row.querySelector(".decrement").addEventListener("click",event => {
            event.stopPropagation();
            const current = Math.max(1,Number(cart[index].quantity) || 1);
            if (current > 1) updateQuantity(current - 1);
        });
        row.querySelector(".increment").addEventListener("click",event => {
            event.stopPropagation();
            const current = Math.max(1,Number(cart[index].quantity) || 1);
            updateQuantity(current + 1);
        });
        [[row.querySelector(".decrement"),"images/Icon Folder/Minus Icon_E5A484.PNG","images/Icon Folder/Minus Icon_333.PNG"],[row.querySelector(".increment"),"images/Icon Folder/Plus Icon_E5A484.PNG","images/Icon Folder/Plus Icon_333.PNG"]].forEach(([button,tapped,normal]) => {
            const icon = button.querySelector("img");
            let timer;
            button.addEventListener("click",() => {
                clearTimeout(timer);
                icon.src = tapped;
                timer = setTimeout(() => { icon.src = normal; },300);
            });
        });
        const removeIcon = row.querySelector(".cart-remove");
        removeIcon.addEventListener("pointerenter",() => { removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        removeIcon.addEventListener("pointerleave",() => { if (removeIcon !== confirmingDeleteIcon) removeIcon.src = "images/Icon Folder/Delete Icon_333.PNG"; });
        removeIcon.addEventListener("pointerdown",() => { removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        removeIcon.addEventListener("click",event => {
            event.stopPropagation();
            requestCartDelete(() => {
                const currentCart = getCart().filter(savedItem => cartIdentity(savedItem) !== cartIdentity(item));
                saveCart(currentCart);
            }, false, removeIcon);
        });
        row.querySelector(".cart-delete").addEventListener("click",event => {
            event.stopPropagation();
            removeIcon.click();
        });
        row.querySelector(".cart-move-wishlist").addEventListener("click",event => {
            event.stopPropagation();
            pendingMoveToWishlist = () => {
                const favorites = getFavorites();
                if (!favorites.some(saved => String(saved.id) === String(item.id))) favorites.push({...item});
                localStorage.setItem("favorites",JSON.stringify(favorites));
                saveCart(getCart().filter(saved => cartIdentity(saved) !== cartIdentity(item)));
                cartDrawer.classList.add("active");
            };
            moveWishlistOverlay.classList.add("active");
            moveWishlistOverlay.setAttribute("aria-hidden","false");
        });
        row.querySelector(".cart-share").addEventListener("click",async event => {
            event.stopPropagation();
            const url = new URL(cartProductLink(item),window.location.href).href;
            try {
                if (navigator.share) await navigator.share({title:cartTitle(item),text:`Check out ${cartTitle(item)}`,url});
                else await navigator.clipboard.writeText(url);
            } catch {}
            row.classList.remove("is-swiped");
        });
        attachCartSwipe(row);
        cartContent.appendChild(row);
    });

    const empty = cart.length === 0;
    cartDrawer.querySelector(".cart-empty").style.display = empty ? "flex" : "none";
    cartContent.style.display = empty ? "none" : "block";
    cartDrawer.querySelector(".total").style.display = empty ? "none" : "flex";
    cartDrawer.querySelector(".btn-buy").style.display = empty ? "none" : "block";
    updateCartTotal(cart);
    updateCartBadge(cart);
}

function updateCartTotal(cart = getCart()) {
    cartDrawer.querySelector(".total-price").textContent = `UGX ${cart.reduce((total,item) => total + cartPrice(item) * Math.max(1,Number(item.quantity) || 1),0).toLocaleString()}`;
}

function attachCartSwipe(cartBox) {
    const main = cartBox.querySelector(".cart-box-main");
    const actions = cartBox.querySelector(".cart-swipe-actions");
    const deleteAction = cartBox.querySelector(".cart-delete");
    let startX = 0, startY = 0, offset = 0, dragging = false;
    main.addEventListener("pointerdown",event => {
        if (event.target.closest("button, a, .cart-remove")) return;
        dragging = true; startX = event.clientX; startY = event.clientY;
        offset = cartBox.classList.contains("is-swiped") ? -actions.offsetWidth : 0;
        actions.setAttribute("aria-hidden","false");
        main.setPointerCapture(event.pointerId);
        main.classList.add("is-dragging"); cartBox.classList.add("swipe-dragging");
    });
    main.addEventListener("pointermove",event => {
        if (!dragging) return;
        const dx = event.clientX - startX, dy = event.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
            dragging = false; main.classList.remove("is-dragging"); main.style.transform = "";
            cartBox.classList.remove("delete-armed","swipe-dragging");
            actions.setAttribute("aria-hidden",String(!cartBox.classList.contains("is-swiped"))); return;
        }
        const rawX = Math.min(0,offset + dx);
        const overswipe = Math.max(0,-actions.offsetWidth - rawX);
        const x = rawX < -actions.offsetWidth ? -actions.offsetWidth - Math.min(48,overswipe * .55) : rawX;
        cartBox.classList.toggle("delete-armed",overswipe >= Math.min(72,main.offsetWidth * .2));
        main.style.transform = `translate3d(${x}px,0,0)`;
    });
    const finish = (event,cancelled = false) => {
        if (!dragging) return;
        dragging = false; main.classList.remove("is-dragging");
        const dx = event.clientX - startX;
        const shouldDelete = !cancelled && offset + dx <= -(actions.offsetWidth + Math.min(72,main.offsetWidth * .2));
        const shouldOpen = offset + dx < -actions.offsetWidth * .35;
        main.style.transform = ""; cartBox.classList.remove("delete-armed","swipe-dragging");
        if (shouldDelete) { cartBox.classList.remove("is-swiped"); actions.setAttribute("aria-hidden","true"); deleteAction.click(); return; }
        if (shouldOpen) cartBox.closest(".cart-content")?.querySelectorAll(".cart-box.is-swiped").forEach(openBox => {
            if (openBox === cartBox) return;
            openBox.classList.remove("is-swiped");
            openBox.querySelector(".cart-swipe-actions")?.setAttribute("aria-hidden","true");
        });
        cartBox.classList.toggle("is-swiped",shouldOpen);
        actions.setAttribute("aria-hidden",String(!shouldOpen));
    };
    main.addEventListener("pointerup",event => finish(event));
    main.addEventListener("pointercancel",event => finish(event,true));
}

function openCart() {
    renderCart();
    cartDrawer.classList.add("active");
    document.documentElement.classList.add("side-panel-open");
    document.body.classList.add("side-panel-open");
    document.body.classList.add("history-cart-open");
    syncDrawerState();
}

function closeCart() {
    cartDrawer.classList.remove("active");
    document.documentElement.classList.remove("side-panel-open");
    document.body.classList.remove("side-panel-open");
    document.body.classList.remove("history-cart-open");
    syncDrawerState();
}

function getHistory() {
    try {
        const visits = JSON.parse(localStorage.getItem(historyKey)) || [];
        return Array.isArray(visits) ? visits : [];
    } catch {
        return [];
    }
}

function getFavorites() {
    try {
        const favorites = JSON.parse(localStorage.getItem("favorites")) || [];
        return Array.isArray(favorites) ? favorites : [];
    } catch {
        return [];
    }
}

function saveFavorites(favorites, shouldRender = true) {
    favorites = window.normalizeMPWRItems?.(favorites) || favorites;
    localStorage.setItem("favorites",JSON.stringify(favorites));
    const user = window.auth?.currentUser;
    if (user && window.db) {
        void setDoc(doc(window.db,"favorites",user.uid),{items:favorites}).catch(error => {
            console.error("Unable to synchronize wishlist",error);
        });
        localStorage.setItem("mpwrFavoritesOwnerUid",user.uid);
    }
    if (shouldRender) {
        renderWishlist();
        renderHistory();
    }
}

function addWishlistItemToCart(item) {
    const cart = getCart();
    const itemToAdd = {
        ...item,
        id:String(item.id),
        title:cartTitle(item),
        image:cartImage(item),
        price:cartPrice(item),
        quantity:1
    };
    const saved = cart.find(entry => cartIdentity(entry) === cartIdentity(itemToAdd));
    if (saved) saved.quantity = Math.max(1,Number(saved.quantity) || 1) + 1;
    else cart.push(itemToAdd);
    saveCart(cart);
}

function modalOptionGroups(product) {
    if (Array.isArray(product.options) && product.options.length) return product.options;
    return [
        product.colors?.length ? {key:"color",label:"Color",values:product.colors} : null,
        product.sizes?.length ? {key:"size",label:product.sizeLabel || "Size",values:product.sizes} : null
    ].filter(Boolean);
}

async function updateProductModalReviews(product) {
    productModalReviewStars.textContent = "☆☆☆☆☆";
    productModalReviewSummary.textContent = "Loading reviews…";
    if (!window.db) {
        productModalReviewSummary.textContent = "No reviews yet";
        return;
    }
    try {
        const snapshot = await getDocs(query(collection(window.db,"reviews"),where("productId","==",String(product.id))));
        if (String(selectedModalProduct?.id) !== String(product.id)) return;
        const ratings = snapshot.docs.map(review => Number(review.data().rating || 0));
        const count = ratings.length;
        const average = count ? ratings.reduce((sum,rating) => sum + rating,0) / count : 0;
        const rounded = Math.round(average);
        productModalReviewStars.textContent = "★".repeat(rounded) + "☆".repeat(5 - rounded);
        productModalReviewSummary.textContent = count
            ? `${average.toFixed(1)} · ${count} ${count === 1 ? "Review" : "Reviews"}`
            : "No reviews yet";
    } catch (error) {
        console.error("Unable to load modal reviews",error);
        productModalReviewSummary.textContent = "No reviews yet";
    }
}

function updateModalFavorite() {
    const isFavorite = getFavorites().some(item => String(item.id) === String(selectedModalProduct?.id));
    const label = isFavorite ? "Remove from Favorites" : "Add to Favorites";
    productModalFavorite.classList.toggle("is-favorite",isFavorite);
    productModalFavorite.setAttribute("aria-label",label);
    productModalFavorite.setAttribute("title",label);
    productModalFavorite.querySelector("img").src = isFavorite
        ? "images/Heart7.PNG"
        : "images/optimized/heart-outline.png";
}

function openProductModal(item) {
    const product = cartProduct(item) || item;
    selectedModalProduct = product;
    selectedModalOptions = {};
    const optionGroups = modalOptionGroups(product);
    const variantKey = () => optionGroups.map(group => selectedModalOptions[group.key] || "").join("|");
    const updateVariant = () => {
        const color = selectedModalOptions.color || "";
        const size = selectedModalOptions.size || selectedModalOptions.length || "";
        const key = variantKey();
        const variant = product.variants?.[key];
        const images = variant?.images || variant?.gallery || product.variantGalleries?.[key] ||
            product.variantGalleries?.[color]?.[size] || product.sizeGalleries?.[size] ||
            product.galleries?.[color] || product.gallery || [product.image];
        selectedModalPrice = variant?.price || product.variantPrices?.[key] ||
            product.variantPrices?.[color]?.[size] || product.sizePrices?.[size] ||
            product.colorPrices?.[color] || product.price;
        productModalImage.src = window.normalizeMPWRImagePath?.(images[0] || product.image,product.id) || images[0] || product.image;
        productModalPrice.textContent = `UGX ${Number(String(selectedModalPrice).replace(/[^0-9.]/g,"")).toLocaleString()}`;
        const parameters = new URLSearchParams({id:String(product.id)});
        Object.entries(selectedModalOptions).forEach(([keyName,value]) => { if (value) parameters.set(keyName,value); });
        const href = `product.html?${parameters.toString()}`;
        productModalImageLink.href = href;
        productModalTitleLink.href = href;
        productModalReadMore.href = href;
    };

    productModalTitle.textContent = product.title;
    productModalDescription.textContent = String(product.description || "Product description coming soon.").trim();
    productModalOptions.replaceChildren();
    productModalOptionsGroup.hidden = optionGroups.length === 0;
    optionGroups.forEach((group,groupIndex) => {
        selectedModalOptions[group.key] = group.values[0];
        if (groupIndex) {
            const divider = document.createElement("div");
            divider.className = "product-modal-section-divider";
            divider.setAttribute("aria-hidden","true");
            productModalOptions.appendChild(divider);
        }
        const section = document.createElement("section");
        section.className = "product-modal-option-group";
        section.innerHTML = `<h3>${group.label}</h3><div class="product-modal-option-values"></div>`;
        const values = section.querySelector(".product-modal-option-values");
        if (group.values.length === 1) values.classList.add("has-one-option");
        group.values.forEach((value,index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = value;
            button.className = "product-modal-option-btn";
            button.classList.toggle("active",index === 0);
            button.addEventListener("click",() => {
                values.querySelectorAll(".product-modal-option-btn").forEach(option => option.classList.remove("active"));
                button.classList.add("active");
                selectedModalOptions[group.key] = value;
                updateVariant();
            });
            values.appendChild(button);
        });
        productModalOptions.appendChild(section);
    });
    updateVariant();
    updateModalFavorite();
    void updateProductModalReviews(product);
    productModalOverlay.classList.add("active");
    productModalOverlay.setAttribute("aria-hidden","false");
    document.documentElement.classList.add("product-modal-open");
    document.body.classList.add("product-modal-open");
}

function closeProductModal() {
    productModalOverlay.classList.remove("active");
    productModalOverlay.setAttribute("aria-hidden","true");
    document.documentElement.classList.remove("product-modal-open");
    document.body.classList.remove("product-modal-open");
    selectedModalProduct = null;
    syncDrawerState();
}

function animateModalProductToCart() {
    const imageRect = productModalImage.getBoundingClientRect();
    const cartRect = cartTrigger.getBoundingClientRect();
    const flyingImage = productModalImage.cloneNode(true);
    Object.assign(flyingImage.style,{
        left:`${imageRect.left}px`,top:`${imageRect.top}px`,width:`${imageRect.width}px`,height:`${imageRect.height}px`,
        margin:"0",position:"fixed",zIndex:"100001",pointerEvents:"none"
    });
    flyingImage.classList.add("flying-image");
    document.body.appendChild(flyingImage);
    const x = cartRect.left + cartRect.width / 2 - (imageRect.left + imageRect.width / 2);
    const y = cartRect.top + cartRect.height / 2 - (imageRect.top + imageRect.height / 2);
    flyingImage.animate([
        {transform:"translate3d(0,0,0) scale(1)",opacity:1},
        {transform:`translate3d(${x}px,${y}px,0) scale(.15)`,opacity:0}
    ],{duration:650,easing:"cubic-bezier(.25,.8,.25,1)",fill:"forwards"}).finished.finally(() => flyingImage.remove());
}

function renderWishlist() {
    const favorites = getFavorites();
    wishlistContent.replaceChildren();

    favorites.forEach(item => {
        const row = document.createElement("article");
        row.className = "wishlist-item";
        row.innerHTML = `
            <a href="${cartProductLink(item)}" class="wishlist-product-link" aria-label="View ${cartTitle(item)}">
                <img src="${cartImage(item)}" class="wishlist-img" alt="${cartTitle(item)}" loading="lazy" decoding="async">
            </a>
            <div class="wishlist-details">
                <h3><a href="${cartProductLink(item)}" class="wishlist-title-link">${cartTitle(item)}</a></h3>
                <span>UGX ${cartPrice(item).toLocaleString()}</span>
                <button class="wishlist-add-cart" type="button">Add to Cart</button>
            </div>
            <button class="wishlist-remove" type="button" aria-label="Remove ${cartTitle(item)} from wishlist">
                <img src="images/Icon Folder/Delete Icon_333.PNG" class="wishlist-remove-icon" alt="">
            </button>`;

        const removeButton = row.querySelector(".wishlist-remove");
        const removeIcon = row.querySelector(".wishlist-remove-icon");
        removeButton.addEventListener("pointerenter",() => { removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        removeButton.addEventListener("pointerleave",() => {
            if (removeIcon !== confirmingDeleteIcon) removeIcon.src = "images/Icon Folder/Delete Icon_333.PNG";
        });
        removeButton.addEventListener("pointerdown",() => { removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG"; });
        removeButton.addEventListener("click",event => {
            event.stopPropagation();
            requestCartDelete(() => {
                saveFavorites(getFavorites().filter(saved => String(saved.id) !== String(item.id)));
                wishlistDrawer.classList.add("active");
                syncDrawerState();
            },false,removeIcon,"wishlist");
        });
        row.querySelector(".wishlist-add-cart").addEventListener("click",event => {
            event.preventDefault();
            event.stopPropagation();
            openProductModal(item);
        });
        wishlistContent.appendChild(row);
    });

    const empty = favorites.length === 0;
    wishlistDrawer.querySelector(".wishlist-empty").style.display = empty ? "flex" : "none";
    wishlistContent.style.display = empty ? "none" : "block";
    wishlistDrawer.querySelector(".wishlist-footer").style.display = empty ? "none" : "block";
}

function syncDrawerState() {
    const open = cartDrawer.classList.contains("active") || wishlistDrawer.classList.contains("active");
    document.documentElement.classList.toggle("side-panel-open",open);
    document.body.classList.toggle("side-panel-open",open);
}

function openWishlist() {
    renderWishlist();
    wishlistDrawer.classList.add("active");
    syncDrawerState();
}

function closeWishlist() {
    wishlistDrawer.classList.remove("active");
    syncDrawerState();
}

function productLink(product) {
    return `product.html?id=${encodeURIComponent(product.id)}`;
}

function historyDateLabel(timestamp) {
    const viewedDate = new Date(Number(timestamp) || Date.now());
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfViewedDay = new Date(viewedDate.getFullYear(), viewedDate.getMonth(), viewedDate.getDate());
    const dayDifference = Math.round((startOfToday - startOfViewedDay) / 86400000);

    if (dayDifference === 0) return "Today";
    if (dayDifference === 1) return "Yesterday";
    return viewedDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: viewedDate.getFullYear() === today.getFullYear() ? undefined : "numeric"
    });
}

function removeProductFromHistory(productId) {
    const nextHistory = getHistory().filter(visit => String(visit?.id) !== String(productId));
    localStorage.setItem(historyKey, JSON.stringify(nextHistory));
    renderHistory();
    showToast("Removed from history");
}

function closeHistoryProductMenus() {
    document.querySelectorAll(".history-product-menu-options:not([hidden])").forEach(menu => {
        menu.hidden = true;
        const productMenu = menu.closest(".history-product-menu");
        productMenu?.querySelector(".history-product-menu-trigger")?.setAttribute("aria-expanded", "false");
        productMenu?.closest(".product-box")?.classList.remove("history-menu-open");
    });
}

function createProductCard(product, favorites) {
    const card = document.createElement("article");
    card.className = "product-box";
    card.dataset.id = product.id;
    card.dataset.category = product.category || "products";

    const isFavorite = favorites.some(item => String(item.id) === String(product.id));
    card.innerHTML = `
        <div class="img-box">
            <button class="wishlist-btn" type="button" aria-label="${isFavorite ? "Remove from favorites" : "Add to favorites"}">
                <img src="${isFavorite ? "images/Heart7.PNG" : "images/optimized/heart-outline.png"}" class="wishlist-icon" alt="">
            </button>
            <img src="${window.normalizeMPWRImagePath?.(product.image, product.id) || product.image}" alt="${product.title}" loading="lazy" decoding="async">
        </div>
        <h2 class="product-title">${product.title}</h2>
        <div class="price-and-cart">
            <span class="price">UGX ${Number(String(product.price).replace(/[^0-9.]/g, "")).toLocaleString()}</span>
            <div class="history-product-menu">
                <button class="history-product-menu-trigger" type="button" aria-label="Product options" aria-expanded="false">
                    <img src="images/Icon Folder/3 Dots Icon_Gray.PNG" alt="">
                </button>
                <div class="history-product-menu-options" role="menu" hidden>
                    <button class="history-product-add-cart" type="button" role="menuitem">
                        <img src="images/Cart black.png" alt="">
                        <span>Add to Cart</span>
                    </button>
                    <button class="history-product-delete" type="button" role="menuitem">
                        <img src="images/Icon Folder/Delete Icon_d9534f.PNG" alt="">
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        </div>`;

    const openProduct = () => {
        window.location.href = productLink(product);
    };

    card.addEventListener("click", openProduct);
    const wishlistButton = card.querySelector(".wishlist-btn");
    const wishlistIcon = wishlistButton.querySelector(".wishlist-icon");
    const productMenu = card.querySelector(".history-product-menu");
    const productMenuTrigger = productMenu.querySelector(".history-product-menu-trigger");
    const productMenuOptions = productMenu.querySelector(".history-product-menu-options");
    productMenu.addEventListener("click", event => event.stopPropagation());
    productMenuTrigger.addEventListener("click", () => {
        const willOpen = productMenuOptions.hidden;
        closeHistoryProductMenus();
        if (!willOpen) return;
        productMenuOptions.hidden = false;
        productMenuTrigger.setAttribute("aria-expanded", "true");
        card.classList.add("history-menu-open");
    });
    productMenu.querySelector(".history-product-add-cart").addEventListener("click", () => {
        closeHistoryProductMenus();
        openProductModal(product);
    });
    productMenu.querySelector(".history-product-delete").addEventListener("click", () => {
        closeHistoryProductMenus();
        requestCartDelete(() => removeProductFromHistory(product.id), false, null, "history");
    });
    wishlistButton.addEventListener("click", event => {
        event.stopPropagation();
        const currentFavorites = getFavorites();
        const index = currentFavorites.findIndex(item => String(item.id) === String(product.id));
        const isRemoving = index >= 0;
        if (isRemoving) {
            currentFavorites.splice(index, 1);
        } else {
            currentFavorites.push({
                id: String(product.id),
                title: product.title,
                price: Number(String(product.price).replace(/[^0-9.]/g, "")),
                image: product.image,
                quantity: 1
            });
        }
        localStorage.setItem("favorites", JSON.stringify(currentFavorites));
        wishlistIcon.src = isRemoving
            ? "images/optimized/heart-outline.png"
            : "images/Heart7.PNG";
        wishlistButton.setAttribute("aria-label",isRemoving ? "Add to favorites" : "Remove from favorites");
    });

    return card;
}

document.addEventListener("click", event => {
    if (!event.target.closest(".history-product-menu")) closeHistoryProductMenus();
});

function renderHistory() {
    const productById = new Map(products.map(product => [String(product.id), product]));
    const visits = getHistory();
    const visitedProducts = visits
        .map(visit => ({ product: productById.get(String(visit.id)), visitedAt: visit.visitedAt }))
        .filter(visit => visit.product);
    const favorites = getFavorites();

    const groupedProducts = new Map();
    visitedProducts.forEach(visit => {
        const label = historyDateLabel(visit.visitedAt);
        if (!groupedProducts.has(label)) groupedProducts.set(label, []);
        groupedProducts.get(label).push(visit.product);
    });

    const historyNodes = [];
    groupedProducts.forEach((productsForDate, label) => {
        const dayGroup = document.createElement("section");
        dayGroup.className = "history-day-group";
        const dateHeading = document.createElement("h2");
        dateHeading.className = "history-date";
        dateHeading.textContent = label;
        const productGrid = document.createElement("div");
        productGrid.className = "product-content history-day-products";
        productGrid.append(...productsForDate.map(product => createProductCard(product, favorites)));
        dayGroup.append(dateHeading, productGrid);
        historyNodes.push(dayGroup);
    });

    historyGrid.replaceChildren(historyIntro, ...historyNodes);
    const isEmpty = visitedProducts.length === 0;
    historyGrid.hidden = isEmpty;
    emptyState.hidden = !isEmpty;
    historyFooter.hidden = isEmpty;
}

clearButton.addEventListener("click", () => {
    clearButton.querySelector("img").src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    clearButton.classList.add("is-confirming");
    clearOverlay.classList.add("active");
    clearOverlay.setAttribute("aria-hidden", "false");
});

function closeClearConfirmation() {
    clearButton.classList.remove("is-confirming");
    clearOverlay.classList.remove("active");
    clearOverlay.setAttribute("aria-hidden", "true");
    clearButton.querySelector("img").src = "images/Icon Folder/Delete Icon_Black.PNG";
}

clearCancel.addEventListener("click", closeClearConfirmation);
clearConfirm.addEventListener("click", () => {
    localStorage.removeItem(historyKey);
    closeClearConfirmation();
    renderHistory();
});
clearOverlay.addEventListener("click", event => {
    if (event.target === clearOverlay) closeClearConfirmation();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && clearOverlay.classList.contains("active")) {
        closeClearConfirmation();
    }
});

const clearIcon = clearButton.querySelector("img");
clearButton.addEventListener("pointerenter", () => {
    clearIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
});
clearButton.addEventListener("pointerleave", () => {
    if (!clearOverlay.classList.contains("active")) {
        clearIcon.src = "images/Icon Folder/Delete Icon_Black.PNG";
    }
});
clearButton.addEventListener("pointerdown", () => {
    clearIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
});

cartTrigger.addEventListener("click",openCart);
wishlistTrigger.addEventListener("click",openWishlist);
wishlistDrawer.querySelector("#wishlist-close").addEventListener("click",closeWishlist);
wishlistDrawer.querySelector(".wishlist-continue").addEventListener("click",closeWishlist);
cartBackdrop.addEventListener("click",closeCart);
cartBackdrop.addEventListener("pointerdown",closeCart);
document.addEventListener("pointerdown",event => {
    if (!cartDrawer.classList.contains("active")) return;
    if (event.target.closest(".cart, .history-cart-trigger, .confirm-overlay")) return;
    closeCart();
},true);
document.addEventListener("pointerdown",event => {
    if (!wishlistDrawer.classList.contains("active")) return;
    if (event.target.closest(".wishlist, #wishlist-nav-icon, .confirm-overlay, .product-modal-overlay")) return;
    closeWishlist();
},true);
cartDrawer.querySelector("#cart-close").addEventListener("click",closeCart);
cartDrawer.querySelector(".continue-shopping").addEventListener("click",closeCart);
cartDrawer.querySelector(".btn-buy").addEventListener("click",() => {
    window.location.href = "checkout.html";
});

cartDeleteOverlay.querySelector(".delete-item-cancel").addEventListener("click",closeCartDelete);
cartDeleteOverlay.querySelector(".delete-item-confirm").addEventListener("click",() => {
    const action = pendingCartDelete;
    pendingCartDelete = null;
    if (confirmingDeleteIcon) confirmingDeleteIcon.src = "images/Icon Folder/Delete Icon_333.PNG";
    confirmingDeleteIcon = null;
    cartDeleteOverlay.classList.remove("active");
    cartDeleteOverlay.setAttribute("aria-hidden","true");
    action?.();
});
cartDeleteOverlay.addEventListener("click",event => {
    if (event.target === cartDeleteOverlay) closeCartDelete();
});

moveWishlistOverlay.querySelector(".move-wishlist-cancel").addEventListener("click",closeMoveWishlist);
moveWishlistOverlay.querySelector(".move-wishlist-confirm").addEventListener("click",() => {
    const action = pendingMoveToWishlist;
    closeMoveWishlist();
    action?.();
});
moveWishlistOverlay.addEventListener("click",event => {
    if (event.target === moveWishlistOverlay) closeMoveWishlist();
});

wishlistClearButton.addEventListener("pointerenter",() => {
    wishlistClearIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
});
wishlistClearButton.addEventListener("pointerleave",() => {
    if (!wishlistClearOverlay.classList.contains("active")) wishlistClearIcon.src = "images/Icon Folder/Delete Icon_333.PNG";
});
wishlistClearButton.addEventListener("pointerdown",() => {
    wishlistClearIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
});
wishlistClearButton.addEventListener("click",() => {
    if (!getFavorites().length) return;
    wishlistClearButton.classList.add("is-confirming");
    wishlistClearIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    wishlistClearOverlay.classList.add("active");
    wishlistClearOverlay.setAttribute("aria-hidden","false");
});

function closeWishlistClearConfirmation() {
    wishlistClearButton.classList.remove("is-confirming");
    wishlistClearIcon.src = "images/Icon Folder/Delete Icon_333.PNG";
    wishlistClearOverlay.classList.remove("active");
    wishlistClearOverlay.setAttribute("aria-hidden","true");
}

wishlistClearOverlay.querySelector(".wishlist-clear-cancel").addEventListener("click",closeWishlistClearConfirmation);
wishlistClearOverlay.querySelector(".wishlist-clear-confirm").addEventListener("click",() => {
    saveFavorites([]);
    closeWishlistClearConfirmation();
    wishlistDrawer.classList.add("active");
    syncDrawerState();
});
wishlistClearOverlay.addEventListener("click",event => {
    if (event.target === wishlistClearOverlay) closeWishlistClearConfirmation();
});

productModalOverlay.addEventListener("click",event => {
    if (event.target === productModalOverlay) {
        event.stopPropagation();
        closeProductModal();
    }
});
productModalFavorite.addEventListener("click",() => {
    if (!selectedModalProduct) return;
    const favorites = getFavorites();
    const index = favorites.findIndex(item => String(item.id) === String(selectedModalProduct.id));
    if (index >= 0) favorites.splice(index,1);
    else favorites.push({
        id:String(selectedModalProduct.id),
        title:selectedModalProduct.title,
        price:selectedModalProduct.price,
        image:selectedModalProduct.image,
        quantity:1
    });
    saveFavorites(favorites);
    updateModalFavorite();
    wishlistDrawer.classList.add("active");
    syncDrawerState();
    showToast(index >= 0 ? "Removed from Wishlist" : "Added to Wishlist","success");
});
productModalCart.addEventListener("click",() => {
    if (!selectedModalProduct) return;
    const item = {
        id:String(selectedModalProduct.id),
        title:selectedModalProduct.title,
        price:Number(String(selectedModalPrice).replace(/[^0-9.]/g,"")),
        image:productModalImage.src,
        quantity:1,
        selectedOptions:{...selectedModalOptions}
    };
    if (selectedModalOptions.color) item.color = selectedModalOptions.color;
    if (selectedModalOptions.size) item.size = selectedModalOptions.size;
    const cart = getCart();
    const saved = cart.find(entry => cartIdentity(entry) === cartIdentity(item));
    if (saved) saved.quantity = Math.max(1,Number(saved.quantity) || 1) + 1;
    else cart.push(item);
    animateModalProductToCart();
    saveCart(cart);
    cartTrigger.classList.add("cart-bounce");
    setTimeout(() => cartTrigger.classList.remove("cart-bounce"),450);
    wishlistDrawer.classList.add("active");
    syncDrawerState();
    showToast("Added to cart 🛒","success");
});

const cartMenuToggle = cartDrawer.querySelector(".cart-menu-toggle");
const cartActionsMenu = cartDrawer.querySelector(".cart-actions-menu");
function closeCartMenu() {
    cartActionsMenu.hidden = true;
    cartMenuToggle.setAttribute("aria-expanded","false");
}

cartMenuToggle.addEventListener("click",event => {
    event.stopPropagation();
    const opening = cartActionsMenu.hidden;
    cartActionsMenu.hidden = !opening;
    cartMenuToggle.setAttribute("aria-expanded",String(opening));
});
cartDrawer.querySelector(".cart-delete-all").addEventListener("click",() => {
    closeCartMenu();
    if (getCart().length) requestCartDelete(() => saveCart([]),true);
});
cartDrawer.querySelector(".cart-share-all").addEventListener("click",async() => {
    closeCartMenu();
    const cart = getCart();
    if (!cart.length) return;
    const text = cart.map(item => `${Math.max(1,Number(item.quantity) || 1)} × ${cartTitle(item)} — UGX ${cartPrice(item).toLocaleString()}`).join("\n");
    try {
        if (navigator.share) await navigator.share({ title:"My MPWR cart", text });
        else await navigator.clipboard.writeText(text);
    } catch {}
});
document.addEventListener("click",event => {
    if (!event.target.closest(".cart-header-actions")) closeCartMenu();
});
document.addEventListener("keydown",event => {
    if (event.key !== "Escape") return;
    if (productModalOverlay.classList.contains("active")) closeProductModal();
    else if (wishlistClearOverlay.classList.contains("active")) closeWishlistClearConfirmation();
    else if (cartDeleteOverlay.classList.contains("active")) closeCartDelete();
    else if (moveWishlistOverlay.classList.contains("active")) closeMoveWishlist();
    else if (cartDrawer.classList.contains("active")) closeCart();
    else if (wishlistDrawer.classList.contains("active")) closeWishlist();
});
window.addEventListener("storage",event => {
    if (event.key === "cart") renderCart();
    if (event.key === "favorites") {
        renderWishlist();
        renderHistory();
    }
});

if (window.auth && window.db) {
    onAuthStateChanged(window.auth,user => {
        if (!user) {
            renderCart();
            renderWishlist();
            return;
        }
        void (async() => {
            try {
                const [accountDocument,favoritesDocument] = await Promise.all([
                    getDoc(doc(window.db,"carts",user.uid)),
                    getDoc(doc(window.db,"favorites",user.uid))
                ]);
                const accountCart = accountDocument.exists() ? accountDocument.data().items || [] : [];
                const localCart = getCart();
                const localOwner = localStorage.getItem("mpwrCartOwnerUid");
                const mergedCart = mergeCartItems(
                    accountCart,
                    localCart,
                    Boolean(localCart.length) && localOwner !== user.uid
                );
                localStorage.setItem("cart",JSON.stringify(mergedCart));
                localStorage.setItem("mpwrCartOwnerUid",user.uid);
                await setDoc(doc(window.db,"carts",user.uid),{items:mergedCart});

                const accountFavorites = favoritesDocument.exists() ? favoritesDocument.data().items || [] : [];
                const mergedFavorites = [...accountFavorites];
                getFavorites().forEach(item => {
                    if (!mergedFavorites.some(saved => String(saved.id) === String(item.id))) mergedFavorites.push(item);
                });
                localStorage.setItem("favorites",JSON.stringify(mergedFavorites));
                localStorage.setItem("mpwrFavoritesOwnerUid",user.uid);
                await setDoc(doc(window.db,"favorites",user.uid),{items:mergedFavorites});
                renderCart();
                renderWishlist();
                renderHistory();
            } catch (error) {
                console.error("Unable to load account drawers",error);
                renderCart();
                renderWishlist();
            }
        })();
    });
}

renderCart();
renderWishlist();
renderHistory();

const wishlistMenuToggle = wishlistDrawer.querySelector(".wishlist-menu-toggle");
const wishlistActionsMenu = wishlistDrawer.querySelector(".wishlist-actions-menu");
function closeWishlistActionsMenu() {
    wishlistActionsMenu.hidden = true;
    wishlistMenuToggle.setAttribute("aria-expanded","false");
}
wishlistMenuToggle.addEventListener("click",event => {
    event.stopPropagation();
    const opening = wishlistActionsMenu.hidden;
    wishlistActionsMenu.hidden = !opening;
    wishlistMenuToggle.setAttribute("aria-expanded",String(opening));
});
wishlistDrawer.querySelector(".wishlist-share-all").addEventListener("click",async () => {
    const items = getFavorites();
    closeWishlistActionsMenu();
    if (!items.length) { showToast("Your Wishlist is empty", "warning"); return; }
    const text = items.map(item => item.title).join("\n");
    try {
        if (navigator.share) await navigator.share({title:"My MPWR Wishlist",text});
        else { await navigator.clipboard.writeText(text); showToast("Wishlist copied", "success"); }
    } catch {}
});
document.addEventListener("click",event => { if (!event.target.closest(".wishlist-header-actions")) closeWishlistActionsMenu(); });
