
/* ============================================================
   CARTNEW.JS
   ------------------------------------------------------------
   Controls the entire homepage.

   Features:
   ✓ Shopping Cart
   ✓ Wishlist
   ✓ Search
   ✓ Filters
   ✓ Product Modal
   ✓ Toast Notifications
   ✓ Checkout
   ✓ Local Storage
============================================================ */


/* ============================================================
   NAVIGATION
============================================================ */

import {
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    setDoc,
    collection,
    addDoc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const auth = window.auth;

const db = window.db;

const cartIcon = document.querySelector("#cart-icon");
const cart = document.querySelector(".cart");
const cartClose = document.querySelector("#cart-close");

const searchIcon = document.querySelector("#search-icon");
const searchBar = document.querySelector(".search-bar");
const searchInput = document.querySelector("#search-input");
const searchClose = document.querySelector("#search-close");
let productSearchReturnUrl = null;

const filterBar = document.querySelector(".filter-bar");
const filterButtons = document.querySelectorAll(".filter-btn");

const filterColumnCount = Math.min(Math.max(filterButtons.length, 1), 10);
const additionalFilterRows = Math.max(Math.ceil(filterButtons.length / 10) - 1, 0);
const mobileFilterColumnCount = Math.min(Math.max(filterButtons.length, 1), 5);
const additionalMobileFilterRows = Math.max(Math.ceil(filterButtons.length / 5) - 1, 0);
document.documentElement.style.setProperty("--filter-columns", filterColumnCount);
document.documentElement.style.setProperty("--additional-filter-space", `${additionalFilterRows * 52}px`);
document.documentElement.style.setProperty("--mobile-filter-columns", mobileFilterColumnCount);
document.documentElement.style.setProperty("--additional-mobile-filter-space", `${additionalMobileFilterRows * 52}px`);


/* ============================================================
   CART
============================================================ */

const cartContent = document.querySelector(".cart-content");

const cartEmpty = document.querySelector(".cart-empty");

const continueShopping = document.querySelector(".continue-shopping");

const totalSection = document.querySelector(".total");

const totalPriceElement = document.querySelector(".total-price");

const checkoutButton = document.querySelector(".btn-buy");


/* ============================================================
   WISHLIST
============================================================ */

const wishlistNavIcon = document.querySelector("#wishlist-nav-icon");

const wishlist = document.querySelector(".wishlist");

const wishlistClose = document.querySelector("#wishlist-close");

[searchClose, cartClose, wishlistClose].filter(Boolean).forEach(closeIcon => {
    let resetTimer;
    const resetCloseIcon = () => {
        resetTimer = setTimeout(() => {
            closeIcon.src = "images/Icon Folder/Close Icon_333.PNG";
        }, 220);
    };

    closeIcon.addEventListener("pointerdown", () => {
        clearTimeout(resetTimer);
        closeIcon.src = "images/Icon Folder/Close Icon_Gray.PNG";
    });
    closeIcon.addEventListener("pointerup", resetCloseIcon);
    closeIcon.addEventListener("pointercancel", resetCloseIcon);
});

const wishlistContent = document.querySelector(".wishlist-content");

const wishlistEmpty = document.querySelector(".wishlist-empty");

const wishlistFooter = document.querySelector(".wishlist-footer");

const wishlistContinue = document.querySelector(".wishlist-continue");

const clearWishlistButton = document.querySelector(".clear-wishlist");

function syncSidePanelScrollLock() {

    const panelIsOpen =
        cart.classList.contains("active") ||
        wishlist.classList.contains("active");

    document.documentElement.classList.toggle("side-panel-open", panelIsOpen);
    document.body.classList.toggle("side-panel-open", panelIsOpen);

}


/* ============================================================
   CONFIRMATION POPUP
============================================================ */

const confirmOverlay = document.querySelector(".confirm-overlay");

const confirmCancel = document.querySelector(".confirm-cancel");

const confirmClear = document.querySelector(".confirm-clear");
const moveWishlistConfirmOverlay = document.querySelector(".move-wishlist-confirm-overlay");
const moveWishlistCancel = document.querySelector(".move-wishlist-cancel");
const moveWishlistConfirm = document.querySelector(".move-wishlist-confirm");
let pendingMoveToWishlist = null;
const deleteItemConfirmOverlay = document.querySelector(".delete-item-confirm-overlay");
const deleteItemConfirmMessage = document.querySelector(".delete-item-confirm-message");
const deleteItemCancel = document.querySelector(".delete-item-cancel");
const deleteItemConfirm = document.querySelector(".delete-item-confirm");
let pendingItemDeletion = null;


/* ============================================================
   PRODUCT MODAL
============================================================ */

const productModalOverlay = document.querySelector(".product-modal-overlay");

const productModal = document.querySelector(".product-modal");

const productModalImage = document.querySelector(".product-modal-image");

const productModalImageLink = document.querySelector(".product-modal-image-link");

const productModalTitle = document.querySelector(".product-modal-title");

const productModalTitleLink = document.querySelector(".product-modal-title-link");
const productModalFavorite =
    document.querySelector(".product-modal-favorite");

const productModalPrice = document.querySelector(".product-modal-price");

const productModalDescription = document.querySelector(".product-modal-description");

const productModalReadMore = document.querySelector(".product-modal-read-more");

const productModalCart = document.querySelector(".product-modal-cart");

const productModalOptions = document.querySelector(".product-modal-options-dynamic");
const productModalOptionsGroup = document.querySelector(".product-modal-options-group");


/* ============================================================
   SEARCH & PRODUCTS
============================================================ */

const noResults = document.querySelector(".no-results");

const productBoxes = document.querySelectorAll(".product-box");

const addCartButtons = document.querySelectorAll(".addie");

const wishlistButtons = document.querySelectorAll(".wishlist-btn");


/* ============================================================
   TOAST
============================================================ */

const toast = document.querySelector(".toast");


/* ============================================================
   APPLICATION STATE
============================================================ */

let currentFilter = "all";

let selectedProduct = null;
let selectedModalProduct = null;
let selectedModalOptions = {};
let selectedModalPrice = "0";
const productsById = Object.fromEntries(
    products.map(product => [product.id, product])
);

function itemIdentity(item) {
    const selections = item.selectedOptions && Object.keys(item.selectedOptions).length
        ? Object.entries(item.selectedOptions).sort(([a], [b]) => a.localeCompare(b))
        : [["color", item.color || ""], ["size", item.size || ""]];
    return [item.id, JSON.stringify(selections)]
        .map(value => String(value).trim().toLowerCase())
        .join("::");
}

/* Recalculate the homepage when it is restored from browser history. */
function restoreHomepageLayout() {
    document.documentElement.style.removeProperty("width");
    document.documentElement.style.removeProperty("max-width");
    document.body.style.removeProperty("width");
    document.body.style.removeProperty("max-width");

    const panelIsOpen =
        cart.classList.contains("active") ||
        wishlist.classList.contains("active");

    if (!panelIsOpen) {
        document.documentElement.classList.remove("side-panel-open");
        document.body.classList.remove("side-panel-open");
        document.body.style.removeProperty("overflow");
    }

    document.documentElement.classList.add("layout-refreshing");
    void document.documentElement.offsetWidth;

    requestAnimationFrame(() => {
        document.documentElement.classList.remove("layout-refreshing");
        window.dispatchEvent(new Event("resize"));
    });
}

window.addEventListener("pageshow", restoreHomepageLayout);

function itemOptionEntries(item) {
    if (item.selectedOptions && Object.keys(item.selectedOptions).length) {
        return Object.entries(item.selectedOptions).filter(([, value]) => value);
    }
    return [["color", item.color || ""], ["size", item.size || ""]]
        .filter(([, value]) => value);
}

function itemOptionSummary(item) {
    return itemOptionEntries(item).map(([, value]) => value).join(" • ");
}

function mergeCartItems(accountItems, localItems, combineQuantities) {
    const merged = new Map();
    accountItems.forEach(item => merged.set(itemIdentity(item), { ...item }));

    localItems.forEach(item => {
        const key = itemIdentity(item);
        const savedItem = merged.get(key);
        if (!savedItem) {
            merged.set(key, { ...item });
            return;
        }

        const savedQuantity = Number(savedItem.quantity) || 1;
        const localQuantity = Number(item.quantity) || 1;
        savedItem.quantity = combineQuantities
            ? savedQuantity + localQuantity
            : Math.max(savedQuantity, localQuantity);
    });

    return [...merged.values()];
}

function mergeFavoriteItems(accountItems, localItems) {
    const merged = new Map();
    [...accountItems, ...localItems].forEach(item => {
        const key = itemIdentity(item);
        if (!merged.has(key)) merged.set(key, { ...item });
    });
    return [...merged.values()];
}

async function saveCartToFirestore() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        await setDoc(
            doc(db, "carts", user.uid),
            {
                items: cartItems
            }
        );

        localStorage.setItem("mpwrCartOwnerUid", user.uid);

        console.log("Cart saved to Firestore.");

    } catch (error) {

        console.error("Error saving cart:", error);

    }

}

async function saveFavoritesToFirestore() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        await setDoc(
            doc(db, "favorites", user.uid),
            {
                items: favorites
            }
        );

        localStorage.setItem("mpwrFavoritesOwnerUid", user.uid);

        console.log("Favorites saved to Firestore.");

    } catch (error) {

        console.error("Error saving favorites:", error);

    }

}

async function loadFavoritesFromFirestore() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        const favoritesDoc = await getDoc(
            doc(db, "favorites", user.uid)
        );

        const accountFavorites = favoritesDoc.exists()
            ? favoritesDoc.data().items || []
            : [];
        const localFavorites = JSON.parse(
            localStorage.getItem("favorites")
        ) || [];

        favorites = mergeFavoriteItems(accountFavorites, localFavorites);
        favorites = window.normalizeMPWRItems?.(favorites) || favorites;
        localStorage.setItem("favorites", JSON.stringify(favorites));
        localStorage.setItem("mpwrFavoritesOwnerUid", user.uid);
        await setDoc(doc(db, "favorites", user.uid), { items: favorites });

        renderWishlist();
        updateWishlistButtons();

        console.log("Favorites merged and synchronized.");

    } catch (error) {

        console.error("Error loading favorites:", error);

    }

}

async function saveOrderToFirestore() {

    const user = auth.currentUser;

    if (!user || cartItems.length === 0) return;

    try {

        await addDoc(collection(db, "orders"), {

            userId: user.uid,

            items: cartItems,

            total: cartItems.reduce((sum, item) => {

                const price = Number(
                    String(item.price).replace(/[^\d]/g, "")
                );

                return sum + (price * item.quantity);

            }, 0),

            status: "Pending",

            createdAt: serverTimestamp()

        });

        console.log("Order saved successfully.");

    } catch (error) {

        console.error("Error saving order:", error);

    }

}
async function loadOrdersFromFirestore() {

    const user = auth.currentUser;

    if (!user) return [];

    try {

        const ordersQuery = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(ordersQuery);

        const orders = [];

        snapshot.forEach(doc => {

            orders.push({
                id: doc.id,
                ...doc.data()
            });

        });

        console.log("Orders:", orders);

        return orders;

    } catch (error) {

        console.error("Error loading orders:", error);

        return [];

    }

}

/* ============================================================
   LOCAL STORAGE
============================================================ */

let cartItems = JSON.parse(
    localStorage.getItem("cart")
) || [];

let favorites = JSON.parse(
    localStorage.getItem("favorites")
) || [];

cartItems = window.normalizeMPWRItems?.(cartItems) || cartItems;
favorites = window.normalizeMPWRItems?.(favorites) || favorites;
localStorage.setItem("cart", JSON.stringify(cartItems));
localStorage.setItem("favorites", JSON.stringify(favorites));


/* ============================================================
   CART BADGE
============================================================ */

let cartItemCount = cartItems.length;

/* ============================================================
   SHOW TOAST NOTIFICATION
============================================================ */

function showToast(message, type = "success") {

    if (!toast) return;

    clearTimeout(toast.timeout);

    toast.textContent = message;

    toast.className = "toast";

    toast.classList.add(type);

    // Restart the transition when notifications occur close together.
    void toast.offsetWidth;
    toast.classList.add("show");

    toast.timeout = setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

}

function requestItemDeletion(source, action) {
    pendingItemDeletion = action;
    deleteItemConfirmMessage.textContent =
        `Are you sure you want to delete this item from your ${source}?`;
    deleteItemConfirmOverlay.classList.add("active");
}

const flashToast = sessionStorage.getItem("flashToast");
if (flashToast) {
    sessionStorage.removeItem("flashToast");
    try {
        const { message, type } = JSON.parse(flashToast);
        showToast(message, type);
    } catch (error) {
        console.error("Unable to display saved toast:", error);
    }
}


/* ============================================================
   UPDATE CART BADGE
============================================================ */

function updateCartCount() {

    const badge = document.querySelector(".cart-item-count");
    const titleCount = document.querySelector(".cart-title-count");

    cartItemCount = cartItems.reduce(
    (sum, item) => sum + Number(item.quantity || 1),
    0
);

    if (titleCount) {
        titleCount.textContent = `(${cartItemCount})`;
    }

    if (cartItemCount > 0) {

        badge.style.visibility = "visible";

        badge.textContent = cartItemCount;

        badge.classList.remove("badge-pop");

        void badge.offsetWidth;

        badge.classList.add("badge-pop");

    } else {

        badge.style.visibility = "hidden";

        badge.textContent = "";

    }

}


/* ============================================================
   UPDATE TOTAL PRICE
============================================================ */

function updateTotalPrice() {

    let total = 0;

    console.log(cartItems);

    cartItems.forEach(item => {

        console.log("PRICE:", item.price);

        const price = Number(String(item.price).replace(/[^\d]/g, ""));

        console.log("PARSED:", price);

        total += price * item.quantity;

    });

    totalPriceElement.textContent = `UGX ${total.toLocaleString()}`;

}


/* ============================================================
   SHOW / HIDE EMPTY CART
============================================================ */

function updateCartUI() {

    if (cartItems.length === 0) {

        cartContent.style.display = "none";
        cartEmpty.style.display = "flex";

        totalSection.style.display = "none";

        checkoutButton.style.display = "none";

    } else {

        cartContent.style.display = "block";
        cartEmpty.style.display = "none";

        totalSection.style.display = "flex";

        checkoutButton.style.display = "block";

    }

}


/* ============================================================
   SHOW / HIDE EMPTY WISHLIST
============================================================ */

function updateWishlistUI() {

    if (favorites.length === 0) {

        wishlistContent.style.display = "none";

        wishlistEmpty.style.display = "flex";

        wishlistFooter.style.display = "none";

    } else {

        wishlistContent.style.display = "block";

        wishlistEmpty.style.display = "none";

        wishlistFooter.style.display = "block";

    }

}


/* ============================================================
   SAVE CART
============================================================ */

function saveCart() {

    cartItems = window.normalizeMPWRItems?.(cartItems) || cartItems;

    localStorage.setItem(
        "cart",
        JSON.stringify(cartItems)
    );

    saveCartToFirestore();

}

    async function loadCartFromFirestore() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        const cartDoc = await getDoc(
            doc(db, "carts", user.uid)
        );

        const accountCart = cartDoc.exists()
            ? cartDoc.data().items || []
            : [];
        const localCart = JSON.parse(localStorage.getItem("cart")) || [];
        const localOwner = localStorage.getItem("mpwrCartOwnerUid");

        cartItems = mergeCartItems(
            accountCart,
            localCart,
            Boolean(localCart.length) && localOwner !== user.uid
        );
        cartItems = window.normalizeMPWRItems?.(cartItems) || cartItems;

        localStorage.setItem("cart", JSON.stringify(cartItems));
        localStorage.setItem("mpwrCartOwnerUid", user.uid);
        await setDoc(doc(db, "carts", user.uid), { items: cartItems });

        renderSavedCart();

        console.log("Cart merged and synchronized.");

    } catch (error) {

        console.error("Error loading cart:", error);

    }

}



/* ============================================================
   SAVE WISHLIST
============================================================ */

function saveWishlist() {

    favorites = window.normalizeMPWRItems?.(favorites) || favorites;

    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

    saveFavoritesToFirestore();

}

/* ============================================================
   CREATE CART ITEM OBJECT
   Creates a JavaScript object from a product card.
============================================================ */

function createCartItem(productBox, selections = {}, overrides = {}) {

    return {

        id: productBox.dataset.id,

        title: productBox.querySelector(".product-title").textContent,

        price: overrides.price || productBox.querySelector(".price").textContent,

        image: overrides.image || productBox.querySelector(".img-box > img").src,

        selectedOptions: { ...selections },
        color: selections.color || "",
        size: selections.size || selections.length || "",

        quantity: 1

    };

}


/* ============================================================
   CREATE CART HTML
   Builds one cart item.
============================================================ */

function createCartBox(cartItem) {

    const cartBox = document.createElement("div");
    const productParams = new URLSearchParams({
        id: String(cartItem.id)
    });

    itemOptionEntries(cartItem).forEach(([key, value]) =>
        productParams.set(key, value)
    );

    const productHref = `product.html?${productParams.toString()}`;

    cartBox.classList.add("cart-box");
    cartBox.dataset.id = cartItem.id;

    cartBox.innerHTML = `
        <div class="cart-swipe-actions" aria-hidden="true">
            <button class="cart-swipe-action cart-move-wishlist" type="button" aria-label="Move item to wishlist">
                <img src="images/Icon Folder/Move To Favorites Icon_333.PNG" alt="">
                <span>Wishlist</span>
            </button>
            <button class="cart-swipe-action cart-share" type="button" aria-label="Share item">
                <img src="images/Icon Folder/Share Icon V2_White.PNG" alt="">
                <span>Share</span>
            </button>
            <button class="cart-swipe-action cart-delete" type="button" aria-label="Delete item">
                <img src="images/Icon Folder/Delete Icon_White.PNG" alt="">
                <span>Delete</span>
            </button>
        </div>
        <div class="cart-box-main">
        <a href="${productHref}" class="cart-product-link" aria-label="View ${cartItem.title}">
            <img
                src="${cartItem.image}"
                class="cart-img"
            >
        </a>

        <div class="cart-detail">

            <h2 class="cart-product-title">
                <a href="${productHref}" class="cart-title-link">${cartItem.title}</a>
            </h2>

<div class="cart-variants">
    ${itemOptionSummary(cartItem)}
</div>

<span class="cart-price">
UGX ${Number(String(cartItem.price).replace(/[^\d]/g, "")).toLocaleString()}

            </span>

            <div class="cart-quantity">

                <button class="decrement" type="button" aria-label="Decrease quantity">
                    <img src="images/Icon Folder/Minus Icon_333.PNG" alt="">
                </button>

                <span class="number">

                    ${cartItem.quantity}

                </span>

                <button class="increment" type="button" aria-label="Increase quantity">
                    <img src="images/Icon Folder/Plus Icon_333.PNG" alt="">
                </button>

            </div>

        </div>

        <div class="cart-item-actions">
            <img
                src="images/Icon Folder/Delete Icon_333.PNG"
                class="cart-remove"
                alt="Remove item"
                role="button"
                tabindex="0"
            >
        </div>
        </div>

    `;
    attachCartEvents(cartBox, cartItem);

    return cartBox;

}

function attachCartEvents(cartBox, cartItem) {

    const removeButton = cartBox.querySelector(".cart-remove");
    const moveToWishlistButton =
        cartBox.querySelector(".cart-move-wishlist");
    const shareButton = cartBox.querySelector(".cart-share");
    const swipeDeleteButton = cartBox.querySelector(".cart-delete");

    attachCartSwipe(cartBox);

    shareButton.addEventListener("click", async event => {
        event.stopPropagation();
        const url = new URL(`product.html?id=${encodeURIComponent(cartItem.id)}`, window.location.href).href;
        try {
            if (navigator.share) {
                await navigator.share({ title: cartItem.title, text: `Check out ${cartItem.title}`, url });
            } else {
                await navigator.clipboard.writeText(url);
                showToast("Product link copied", "success");
            }
            cartBox.classList.remove("is-swiped");
        } catch {
            // Sharing failures are intentionally silent.
        }
    });

    swipeDeleteButton.addEventListener("click", event => {
        event.stopPropagation();
        removeButton.click();
    });

    const incrementButton = cartBox.querySelector(".increment");

    const decrementButton = cartBox.querySelector(".decrement");

    const numberElement = cartBox.querySelector(".number");

    [
        [decrementButton, "images/Icon Folder/Minus Icon_E5A484.PNG", "images/Icon Folder/Minus Icon_333.PNG"],
        [incrementButton, "images/Icon Folder/Plus Icon_E5A484.PNG", "images/Icon Folder/Plus Icon_333.PNG"]
    ].forEach(([button, tappedIcon, defaultIcon]) => {
        const icon = button.querySelector("img");
        let resetTimer;

        button.addEventListener("click", () => {
            clearTimeout(resetTimer);
            icon.src = tappedIcon;
            resetTimer = setTimeout(() => {
                icon.src = defaultIcon;
            }, 300);
        });
    });

    moveToWishlistButton.addEventListener("click", event => {
        event.stopPropagation();

        pendingMoveToWishlist = () => {
            const isAlreadySaved = favorites.some(item =>
                String(item.id) === String(cartItem.id)
            );

            if (!isAlreadySaved) {
                favorites.push({
                    id: cartItem.id,
                    title: cartItem.title,
                    price: cartItem.price,
                    image: cartItem.image,
                    selectedOptions: { ...cartItem.selectedOptions },
                    color: cartItem.color || "",
                    size: cartItem.size || ""
                });
            }

            cartItems = cartItems.filter(item =>
                !(
                    itemIdentity(item) === itemIdentity(cartItem)
                )
            );

            saveWishlist();
            saveCart();
            renderWishlist();
            renderSavedCart();
            updateCartCount();
            cart.classList.add("active");
            syncSidePanelScrollLock();

            showToast(
                isAlreadySaved
                    ? "Item removed from cart — already in wishlist"
                    : "Moved to wishlist",
                "success"
            );
        };

        moveWishlistConfirmOverlay.classList.add("active");
    });

    removeButton.addEventListener("pointerdown", () => {
        removeButton.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    });

    removeButton.addEventListener("pointerenter", () => {
        removeButton.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    });

    removeButton.addEventListener("pointerleave", () => {
        removeButton.src = "images/Icon Folder/Delete Icon_333.PNG";
    });

    removeButton.addEventListener("click", () => {
        requestItemDeletion("cart", () => {
            cartItems = cartItems.filter(item => {
                return !(
                    itemIdentity(item) === itemIdentity(cartItem)
                );
            });

            saveCart();
            renderSavedCart();
            updateCartCount();
            showToast("Deleted", "success");
        });
    });

incrementButton.addEventListener("click", () => {

   const item = cartItems.find(i => itemIdentity(i) === itemIdentity(cartItem));

    if (!item) return;

    item.quantity++;

    numberElement.textContent = item.quantity;

    saveCart();
    updateCartCount();
    updateTotalPrice();

});

decrementButton.addEventListener("click", () => {

    const item = cartItems.find(i => itemIdentity(i) === itemIdentity(cartItem));

    if (!item) return;

    if (item.quantity > 1) {

        item.quantity--;

        numberElement.textContent = item.quantity;

        saveCart();
        updateCartCount();

        updateTotalPrice();

    }

});

}

function attachCartSwipe(cartBox) {
    const main = cartBox.querySelector(".cart-box-main");
    const actions = cartBox.querySelector(".cart-swipe-actions");
    const deleteAction = cartBox.querySelector(".cart-delete");
    let startX = 0;
    let startY = 0;
    let offset = 0;
    let dragging = false;

    main.addEventListener("pointerdown", event => {
        if (event.target.closest("button, a, .cart-remove")) return;
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        offset = cartBox.classList.contains("is-swiped") ? -actions.offsetWidth : 0;
        actions.setAttribute("aria-hidden", "false");
        main.setPointerCapture(event.pointerId);
        main.classList.add("is-dragging");
        cartBox.classList.add("swipe-dragging");
    });

    main.addEventListener("pointermove", event => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
            dragging = false;
            main.classList.remove("is-dragging");
            main.style.transform = "";
            cartBox.classList.remove("delete-armed", "swipe-dragging");
            actions.setAttribute(
                "aria-hidden",
                String(!cartBox.classList.contains("is-swiped"))
            );
            return;
        }
        const rawX = Math.min(0, offset + dx);
        const overswipe = Math.max(0, -actions.offsetWidth - rawX);
        const deleteDistance = Math.min(72, main.offsetWidth * .2);
        const x = rawX < -actions.offsetWidth
            ? -actions.offsetWidth - Math.min(48, overswipe * .55)
            : rawX;
        cartBox.classList.toggle("delete-armed", overswipe >= deleteDistance);
        main.style.transform = `translate3d(${x}px, 0, 0)`;
    });

    const finish = (event, cancelled = false) => {
        if (!dragging) return;
        dragging = false;
        main.classList.remove("is-dragging");
        const dx = event.clientX - startX;
        const deleteThreshold = -(actions.offsetWidth + Math.min(72, main.offsetWidth * .2));
        const shouldDelete = !cancelled && offset + dx <= deleteThreshold;
        const shouldOpen = offset + dx < -actions.offsetWidth * .35;
        main.style.transform = "";
        cartBox.classList.remove("delete-armed", "swipe-dragging");

        if (shouldDelete) {
            cartBox.classList.remove("is-swiped");
            actions.setAttribute("aria-hidden", "true");
            deleteAction.click();
            return;
        }

        if (shouldOpen) {
            cartBox.closest(".cart-content")
                ?.querySelectorAll(".cart-box.is-swiped")
                .forEach(openCartBox => {
                    if (openCartBox === cartBox) return;
                    openCartBox.classList.remove("is-swiped");
                    openCartBox.querySelector(".cart-swipe-actions")
                        ?.setAttribute("aria-hidden", "true");
                });
        }

        cartBox.classList.toggle("is-swiped", shouldOpen);
        actions.setAttribute("aria-hidden", String(!shouldOpen));
    };

    main.addEventListener("pointerup", event => finish(event));
    main.addEventListener("pointercancel", event => finish(event, true));
}

/* ============================================================
   RENDER SAVED CART
   Restores the cart after refreshing the page.
============================================================ */

function renderSavedCart() {
    cartItems = JSON.parse(localStorage.getItem("cart")) || [];
cartContent.innerHTML = "";


    cartItems.forEach(cartItem => {

        const cartBox = createCartBox(cartItem);

        cartContent.appendChild(cartBox);

    });

    updateCartCount();

    updateTotalPrice();

    updateCartUI();

}


/* ============================================================
   ADD PRODUCT TO CART
============================================================ */

function addToCart(productBox, selections = {}, overrides = {}) {
    const cartItem = createCartItem(
        productBox,
        selections,
        overrides
);

    /* --------------------------------------------------------
       Prevent duplicate products
    --------------------------------------------------------- */

    const existingItem = cartItems.find(item => {

    return item.title === cartItem.title && itemIdentity(item) === itemIdentity(cartItem);

});

    if (existingItem) {

        showToast(
            "This item is already in the cart ⚠️",
            "warning"
        );

        return;

    }


    /* --------------------------------------------------------
       Save item
    --------------------------------------------------------- */

    cartItems.push(cartItem);

    saveCart();


    /* --------------------------------------------------------
       Create cart element
    --------------------------------------------------------- */

    const cartBox = createCartBox(cartItem);

    cartContent.appendChild(cartBox);


    /* --------------------------------------------------------
       Flying image animation
    --------------------------------------------------------- */

    const productImage =
        productBox.querySelector(".img-box > img");

    const imageRect =
        productImage.getBoundingClientRect();

    const cartRect =
        cartIcon.getBoundingClientRect();

    const flyingImage =
        productImage.cloneNode(true);

    flyingImage.classList.add("flying-image");

    flyingImage.style.left = imageRect.left + "px";

    flyingImage.style.top = imageRect.top + "px";

    document.body.appendChild(flyingImage);

    requestAnimationFrame(() => {

        flyingImage.style.left = cartRect.left + "px";

        flyingImage.style.top = cartRect.top + "px";

        flyingImage.style.width = "20px";

        flyingImage.style.height = "20px";

        flyingImage.style.opacity = "0";

    });

    setTimeout(() => {

        flyingImage.remove();

    }, 650);


    /* --------------------------------------------------------
       Cart bounce animation
    --------------------------------------------------------- */

    cartIcon.classList.add("cart-bounce");

    setTimeout(() => {

        cartIcon.classList.remove("cart-bounce");

    }, 450);


    /* --------------------------------------------------------
       Update interface
    --------------------------------------------------------- */

    updateCartCount();

    updateTotalPrice();

    updateCartUI();


    /* --------------------------------------------------------
       Success message
    --------------------------------------------------------- */

    showToast(
        "Added to cart 🛒",
        "success"
    );

}


/* ============================================================
   ADD TO CART BUTTONS
============================================================ */

addCartButtons.forEach(button => {

    button.addEventListener("click", event => {

        event.stopPropagation();

        const productBox =
            event.target.closest(".product-box");

        openProductModal(productBox);

    });

});

/* ============================================================
   OPEN / CLOSE CART
============================================================ */

cartIcon.addEventListener("click", () => {

    cart.classList.add("active");
    syncSidePanelScrollLock();

});

cartClose.addEventListener("click", () => {

    cart.classList.remove("active");
    syncSidePanelScrollLock();

});


/* ============================================================
   CONTINUE SHOPPING
============================================================ */

continueShopping.addEventListener("click", () => {

    cart.classList.remove("active");
    syncSidePanelScrollLock();

    document.querySelector(".shop").scrollIntoView({

        behavior: "smooth"

    });

});


/* ============================================================
   CHECKOUT
============================================================ */

function openCheckoutSigninModal() {
    const accountOverlay = document.querySelector(".account-overlay");
    const signinView = document.querySelector(".signin-view");
    const registerView = document.querySelector(".register-view");

    registerView?.classList.remove("active");
    signinView?.classList.remove("hide");
    cart.classList.remove("active");
    syncSidePanelScrollLock();
    accountOverlay?.classList.add("active");
    document.body.style.overflow = "hidden";
    accountOverlay?.querySelector(".account-modal")?.scrollTo(0, 0);
    requestAnimationFrame(() => {
        document.getElementById("signin-email")?.focus({ preventScroll: true });
    });
}

checkoutButton.addEventListener("click", () => {

    if (!auth.currentUser) {

        showToast(
            "Please sign in before checking out⚠️.",
            "warning"
        );

        openCheckoutSigninModal();

        return;

    }

    if (cartItems.length === 0) {

        showToast(
            "Your cart is empty 🛒",
            "warning"
        );

        return;

    }

    window.location.href = "checkout.html";

});


/* ============================================================
   RESTORE SAVED CART
============================================================ */


/* ============================================================
   OPEN SEARCH
============================================================ */

searchIcon.addEventListener("click", () => {

    if (searchBar.classList.contains("active")) {

        if (productSearchReturnUrl) {
            window.location.href = productSearchReturnUrl;
            return;
        }

        searchBar.classList.remove("active");
        filterBar.classList.remove("active");
        document.body.classList.remove("search-open");
        searchInput.value = "";
        filterProducts("");

        return;

    }

    searchBar.classList.add("active");

    filterBar.classList.add("active");

    document.body.classList.add("search-open");

    searchInput.focus();

});


/* ============================================================
   CLOSE SEARCH
============================================================ */

searchClose.addEventListener("click", () => {

    if (productSearchReturnUrl) {
        window.location.href = productSearchReturnUrl;
        return;
    }

    searchBar.classList.remove("active");

    filterBar.classList.remove("active");

    document.body.classList.remove("search-open");

    searchInput.value = "";

    filterProducts("");

});

document.addEventListener("click", event => {
    const clickedSearchControls = event.target.closest?.(
        ".search-bar, .filter-bar, #search-icon, .product-box"
    );

    if (!document.body.classList.contains("search-open") || clickedSearchControls) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (productSearchReturnUrl) {
        window.location.href = productSearchReturnUrl;
        return;
    }

    searchBar.classList.remove("active");
    filterBar.classList.remove("active");
    document.body.classList.remove("search-open");
    searchInput.value = "";
    filterProducts("");
}, true);


/* ============================================================
   SEARCH PRODUCTS
============================================================ */

searchInput.addEventListener("input", event => {

    filterProducts(event.target.value);

});


/* ============================================================
   FILTER PRODUCTS
============================================================ */

function filterProducts(searchTerm) {

    const value = searchTerm.toLowerCase().trim();
    console.log("Searching for:", value);

    let visibleProducts = 0;

    productBoxes.forEach(product => {

        const title = product
            .querySelector(".product-title")
            .textContent
            .toLowerCase();

       const id = Number(product.dataset.id);

       const productData = productsById[id];

       const description = (productData?.description || "").toLowerCase();

       const colors = (productData?.colors || [])
       .join(" ")
       .toLowerCase();

       const sizes = (productData?.sizes || [])
         .join(" ")
          .toLowerCase();

       const matches =
       title.includes(value) ||
       description.includes(value) ||
       colors.includes(value) ||
       sizes.includes(value);

        product.style.display = matches ? "block" : "none";

        if (matches) {

            visibleProducts++;

        }

    });


    /* ----------------------------------------
       No Results
    ----------------------------------------- */

    if (visibleProducts === 0) {

        noResults.style.display = "block";

    } else {

        noResults.style.display = "none";

    }

}
/* ============================================================
   APPLY CATEGORY FILTER
============================================================ */

function applyCategoryFilter(category) {

    currentFilter = category;

    let visibleProducts = 0;

    productBoxes.forEach(product => {

        const productCategory = product.dataset.category;

        const productTitle = product
            .querySelector(".product-title")
            .textContent
            .toLowerCase();

        const searchValue = searchInput.value
            .toLowerCase()
            .trim();

        const matchesCategory =
            category === "all" ||
            productCategory === category;

       const id = Number(product.dataset.id);

const productData = productsById[id];

const description = (productData?.description || "").toLowerCase();

const colors = (productData?.colors || [])
    .join(" ")
    .toLowerCase();

const sizes = (productData?.sizes || [])
    .join(" ")
    .toLowerCase();

const matchesSearch =
    productTitle.includes(searchValue) ||
    description.includes(searchValue) ||
    colors.includes(searchValue) ||
    sizes.includes(searchValue);

        const shouldShow =
            matchesCategory && matchesSearch;

        product.style.display = shouldShow
            ? "block"
            : "none";

        if (shouldShow) {

            visibleProducts++;

        }

    });

    noResults.style.display =
        visibleProducts === 0
            ? "block"
            : "none";

}


/* ============================================================
   FILTER BUTTONS
============================================================ */

filterButtons.forEach(button => {

    button.addEventListener("click", () => {

        /* ----------------------------
           Active Button
        ----------------------------- */

        filterButtons.forEach(btn => {

            btn.classList.remove("active");

        });

        button.classList.add("active");


        /* ----------------------------
           Filter Products
        ----------------------------- */

        const category = button.dataset.filter;

        applyCategoryFilter(category);

    });

});

/* ============================================================
   TOGGLE WISHLIST
============================================================ */

function toggleWishlist(productBox) {

    const productId = productBox.dataset.id;

    const existingItem = favorites.find(item => {

        return item.id === productId;

    });

    if (existingItem) {

        favorites = favorites.filter(item => {

            return item.id !== productId;

        });

        showToast(
            "Removed from wishlist 💔",
            "warning"
        );

    } else {

        favorites.push({

            id: productId,

            title: productBox.querySelector(".product-title").textContent,

            price: productBox.querySelector(".price").textContent,

            image: productBox.querySelector(".img-box > img:last-of-type").src

        });
const icon = productBox.querySelector(".wishlist-btn img");

icon.classList.remove("heart-pop");

void icon.offsetWidth;

icon.classList.add("heart-pop");

        showToast(
            "Added to wishlist ❤️",
            "success"
        );

    }

    saveWishlist();

    renderWishlist();

}

productModalFavorite.addEventListener("click", () => {

    if (!selectedProduct) return;

    toggleWishlist(selectedProduct);

});


/* ============================================================
   CREATE WISHLIST ITEM
============================================================ */

function createWishlistItem(item) {

    const wishlistBox = document.createElement("div");
    const productParams = new URLSearchParams({
        id: String(item.id)
    });

    if (item.color) productParams.set("color", item.color);
    if (item.size) productParams.set("size", item.size);

    const productHref = `product.html?${productParams.toString()}`;

   wishlistBox.classList.add("wishlist-item");

    wishlistBox.innerHTML = `

        <a href="${productHref}" class="wishlist-product-link" aria-label="View ${item.title}">
            <img
                src="${window.normalizeMPWRImagePath?.(item.image, item.id) || item.image}"
                class="wishlist-img"
            >
        </a>

        <div class="wishlist-details">

            <h3>
                <a href="${productHref}" class="wishlist-title-link">${item.title}</a>
            </h3>

           <span>
    UGX ${Number(String(item.price).replace(/[^\d]/g, "")).toLocaleString()}
</span>

            <button class="wishlist-add-cart">

                Add to Cart

             </button>
        

        </div>

       <button class="wishlist-remove">

    <img
        src="images/Icon Folder/Delete Icon_333.PNG"
        class="wishlist-remove-icon"
    >

</button>

    `;

    const removeButton =
        wishlistBox.querySelector(".wishlist-remove");
    const removeIcon =
        wishlistBox.querySelector(".wishlist-remove-icon");
        const addCartButton =
    wishlistBox.querySelector(".wishlist-add-cart");

    removeButton.addEventListener("pointerenter", () => {
        removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    });

    removeButton.addEventListener("pointerleave", () => {
        removeIcon.src = "images/Icon Folder/Delete Icon_333.PNG";
    });

    removeButton.addEventListener("pointerdown", () => {
        removeIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    });

    removeButton.addEventListener("click", () => {
        requestItemDeletion("wishlist", () => {
            favorites = favorites.filter(favorite => {
                return favorite.id !== item.id;
            });

            saveWishlist();
            renderWishlist();
            showToast("Deleted", "success");
        });

    });

   addCartButton.addEventListener("click", () => {

    const productBox = document.querySelector(
    `.product-box[data-id="${item.id}"]`
    );

    if (!productBox) return;

    openProductModal(productBox);

    wishlist.classList.remove("active");
    syncSidePanelScrollLock();
});

    return wishlistBox;

}


/* ============================================================
   RENDER WISHLIST
============================================================ */

function renderWishlist() {

    wishlistContent.innerHTML = "";

    favorites.forEach(item => {

        wishlistContent.appendChild(

            createWishlistItem(item)

        );

    });

    updateWishlistUI();

}

/* ============================================================
   OPEN / CLOSE WISHLIST
============================================================ */

wishlistNavIcon.addEventListener("click", () => {

    wishlist.classList.add("active");
    syncSidePanelScrollLock();

});

wishlistClose.addEventListener("click", () => {

    wishlist.classList.remove("active");
    syncSidePanelScrollLock();

});


/* ============================================================
   CONTINUE SHOPPING
============================================================ */

wishlistContinue.addEventListener("click", () => {

    wishlist.classList.remove("active");
    syncSidePanelScrollLock();

    document.querySelector(".shop").scrollIntoView({

        behavior: "smooth"

    });

});

document.addEventListener("click", event => {

    if (event.target.closest(".confirm-overlay")) return;

    if (
        cart.classList.contains("active") &&
        !cart.contains(event.target) &&
        !cartIcon.contains(event.target)
    ) {
        cart.classList.remove("active");
    }

    if (
        wishlist.classList.contains("active") &&
        !wishlist.contains(event.target) &&
        !wishlistNavIcon.contains(event.target)
    ) {
        wishlist.classList.remove("active");
    }

    syncSidePanelScrollLock();

});


/* ============================================================
   WISHLIST BUTTONS
============================================================ */

wishlistButtons.forEach(button => {

    button.addEventListener("click", event => {

        event.stopPropagation();

        const productBox =
            event.target.closest(".product-box");

        toggleWishlist(productBox);

    });

});


/* ============================================================
   UPDATE HEART ICONS
============================================================ */

function updateWishlistButtons() {

    wishlistButtons.forEach(button => {

        const productBox = button.closest(".product-box");

        const productId = productBox.dataset.id;

        const icon = button.querySelector("img");

        const isFavorite = favorites.some(item => {

            return item.id === productId;

        });

        if (isFavorite) {

            icon.src = "images/Heart7.PNG";

        } else {

            icon.src = "images/Heart-Outline2.PNG";

        }

    });

}


/* ============================================================
   CLEAR WISHLIST
============================================================ */

clearWishlistButton.addEventListener("pointerenter", () => {
    clearWishlistButton.querySelector(".clear-wishlist-icon").src =
        "images/Icon Folder/Delete Icon_d9534f.PNG";
});

clearWishlistButton.addEventListener("pointerleave", () => {
    clearWishlistButton.querySelector(".clear-wishlist-icon").src =
        "images/Icon Folder/Delete Icon_333.PNG";
});

clearWishlistButton.addEventListener("pointerdown", () => {
    const icon = clearWishlistButton.querySelector(".clear-wishlist-icon");

    icon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";

    setTimeout(() => {
        if (!clearWishlistButton.matches(":hover")) {
            icon.src = "images/Icon Folder/Delete Icon_333.PNG";
        }
    }, 120);
});

clearWishlistButton.addEventListener("click", () => {

    if (favorites.length === 0) {

        showToast(

            "Wishlist is already empty",

            "warning"

        );

        return;

    }

    confirmOverlay.classList.add("active");

});


/* ============================================================
   CANCEL CLEAR
============================================================ */

confirmCancel.addEventListener("click", () => {

    confirmOverlay.classList.remove("active");

});

confirmOverlay.addEventListener("click", (e) => {

    if (e.target === confirmOverlay) {

        confirmOverlay.classList.remove("active");

    }

});


/* ============================================================
   CONFIRM CLEAR
============================================================ */

confirmClear.addEventListener("click", () => {

    favorites = [];

    saveWishlist();

    renderWishlist();

    updateWishlistButtons();

    confirmOverlay.classList.remove("active");

    showToast(

        "Wishlist cleared",

        "success"

    );

});

moveWishlistCancel?.addEventListener("click", () => {
    pendingMoveToWishlist = null;
    moveWishlistConfirmOverlay.classList.remove("active");
});

moveWishlistConfirmOverlay?.addEventListener("click", event => {
    if (event.target === moveWishlistConfirmOverlay) {
        pendingMoveToWishlist = null;
        moveWishlistConfirmOverlay.classList.remove("active");
    }
});

moveWishlistConfirm?.addEventListener("click", () => {
    const moveItem = pendingMoveToWishlist;
    pendingMoveToWishlist = null;
    moveWishlistConfirmOverlay.classList.remove("active");
    moveItem?.();
});

deleteItemCancel?.addEventListener("click", () => {
    pendingItemDeletion = null;
    deleteItemConfirmOverlay.classList.remove("active");
});

deleteItemConfirmOverlay?.addEventListener("click", event => {
    if (event.target === deleteItemConfirmOverlay) {
        pendingItemDeletion = null;
        deleteItemConfirmOverlay.classList.remove("active");
    }
});

deleteItemConfirm?.addEventListener("click", () => {
    const deleteItem = pendingItemDeletion;
    pendingItemDeletion = null;
    deleteItemConfirmOverlay.classList.remove("active");
    deleteItem?.();
});


/* ============================================================
   UPDATE WISHLIST
============================================================ */

const originalRenderWishlist = renderWishlist;

renderWishlist = function () {

    originalRenderWishlist();

    updateWishlistButtons();

};


/* ============================================================
   RESTORE WISHLIST
============================================================ */

renderWishlist();

/* ============================================================
   OPEN PRODUCT MODAL
============================================================ */

function openProductModal(productBox) {

    selectedProduct = productBox;

    const id = Number(productBox.dataset.id);
    const product = productsById[id];

    if (!product) return;
    selectedModalProduct = product;
    selectedModalOptions = {};

    const optionGroups = Array.isArray(product.options) && product.options.length
        ? product.options
        : [
            product.colors?.length
                ? { key: "color", label: "Color", values: product.colors }
                : null,
            product.sizes?.length
                ? { key: "size", label: product.sizeLabel || "Size", values: product.sizes }
                : null
        ].filter(Boolean);

    const variantKey = () => optionGroups
        .map(group => selectedModalOptions[group.key] || "")
        .join("|");

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
        productModalPrice.textContent =
            `UGX ${Number(selectedModalPrice).toLocaleString()}`;

        const detailParams = new URLSearchParams({ id: String(product.id) });
        Object.entries(selectedModalOptions).forEach(([optionKey, value]) => {
            if (value) detailParams.set(optionKey, value);
        });
        const detailHref = `product.html?${detailParams.toString()}`;
        productModalReadMore.href = detailHref;
        productModalImageLink.href = detailHref;
        productModalTitleLink.href = detailHref;
    };

    productModalImage.src = product.image;
    productModalTitle.textContent = product.title;
    const previewWords = product.description.trim().split(/\s+/).slice(0, 6);

    productModalDescription.textContent = `${previewWords.join(" ")}...`;
    productModalOptions.replaceChildren();
    productModalOptionsGroup.hidden = optionGroups.length === 0;

    optionGroups.forEach((group, groupIndex) => {
        selectedModalOptions[group.key] = group.values[0];

        if (groupIndex > 0) {
            const divider = document.createElement("div");
            divider.className = "product-modal-section-divider";
            divider.setAttribute("aria-hidden", "true");
            productModalOptions.appendChild(divider);
        }

        const section = document.createElement("section");
        section.className = "product-modal-option-group";
        section.innerHTML = `<h3>${group.label}</h3><div class="product-modal-option-values"></div>`;
        const values = section.querySelector(".product-modal-option-values");
        if (group.values.length === 1) {
            values.classList.add("has-one-option");
        }

        group.values.forEach((value, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = value;
            button.className = "product-modal-option-btn";
            button.classList.toggle("active", index === 0);
            button.addEventListener("click", () => {
                values.querySelectorAll(".product-modal-option-btn").forEach(item =>
                    item.classList.remove("active")
                );
                button.classList.add("active");
                selectedModalOptions[group.key] = value;
                updateModalVariant();
            });
            values.appendChild(button);
        });

        productModalOptions.appendChild(section);
    });

    updateModalVariant();
    productModalOverlay.classList.add("active");
}


/* ============================================================
   CLOSE PRODUCT MODAL
============================================================ */

function closeProductModal() {

    productModalOverlay.classList.remove("active");

    selectedProduct = null;
    selectedModalProduct = null;

}


/* ============================================================
   PRODUCT CLICK
============================================================ */

/* ============================================================
   PRODUCT CLICK
   Open Product Page (Modal Disabled)
============================================================ */

productBoxes.forEach(product => {

    product.addEventListener("click", event => {

        // Don't navigate if clicking Add to Cart
        if (event.target.closest(".addie")) return;

        // Don't navigate if clicking Wishlist
        if (event.target.closest(".wishlist-btn")) return;

        const productId = product.dataset.id;

        window.location.href = `product.html?id=${productId}`;

    });

});

productModalOverlay.addEventListener("click", (event) => {

    if (event.target === productModalOverlay) {
        productModalOverlay.classList.remove("active");
    }

});

/* ============================================================
   CLOSE WHEN CLICKING OUTSIDE
============================================================ */

productModalOverlay.addEventListener("click", event => {

    console.log("Overlay clicked", event.target);

    if (event.target === productModalOverlay) {

        console.log("Closing modal");

        closeProductModal();

    }

});


/* ============================================================
   ESC KEY
============================================================ */

document.addEventListener("keydown", event => {

    if (

        event.key === "Escape" &&

        productModalOverlay.classList.contains("active")

    ) {

        closeProductModal();

    }

});


/* ============================================================
   ADD TO CART FROM MODAL
============================================================ */

productModalCart.addEventListener("click", () => {

    if (!selectedProduct) return;

    addToCart(
        selectedProduct,
        selectedModalOptions,
        {
            price: selectedModalPrice,
            image: productModalImage.src
        }
    );

});

/* ============================================================
   INITIALIZE APPLICATION
============================================================ */

function initializeApp() {

    /* ----------------------------------------
       Restore Cart
    ----------------------------------------- */

    renderSavedCart();


    /* ----------------------------------------
       Restore Wishlist
    ----------------------------------------- */

    renderWishlist();


    /* ----------------------------------------
       Update Cart Badge
    ----------------------------------------- */

    updateCartCount();


    /* ----------------------------------------
       Update Totals
    ----------------------------------------- */

    updateTotalPrice();


    /* ----------------------------------------
       Update Empty States
    ----------------------------------------- */

    updateCartUI();

    updateWishlistUI();


    /* ----------------------------------------
       Synchronize Heart Icons
    ----------------------------------------- */

    updateWishlistButtons();


    /* ----------------------------------------
       Reset Search
    ----------------------------------------- */

    searchInput.value = "";
    const categoryPages = {
        "/nails.html": { filter: "press-ons", title: "Press-On Nails" },
        "/lashes.html": { filter: "lashes", title: "Lashes" },
        "/productspage.html": { filter: "products", title: "Products" },
        "/wigs.html": { filter: "wigs", title: "Wigs" }
    };
    const pageName = `/${window.location.pathname.split("/").pop().toLowerCase()}`;
    const categoryPage = categoryPages[pageName];
    const params = new URLSearchParams(window.location.search);
const search = params.get("search");

if (search) {
    productSearchReturnUrl = sessionStorage.getItem("mpwrProductSearchReturnUrl");
    sessionStorage.removeItem("mpwrProductSearchReturnUrl");
    searchBar.classList.add("active");
    filterBar.classList.add("active");
    document.body.classList.add("search-open");
    searchInput.value = search;
    applyCategoryFilter(currentFilter);

    window.history.replaceState({}, "", window.location.pathname);
}


    noResults.style.display = "none";


    /* ----------------------------------------
       Default Filter
    ----------------------------------------- */

    currentFilter = categoryPage?.filter || "all";

    if (categoryPage) {
        document.title = `${categoryPage.title} | MPWR`;
        const sectionTitle = document.querySelector(".section-title");
        if (sectionTitle) sectionTitle.textContent = categoryPage.title;

        filterButtons.forEach(button => {
            button.classList.toggle("active", button.dataset.filter === currentFilter);
        });
    }

    if (!search) {
    applyCategoryFilter(currentFilter);
}

}


/* ============================================================
   START APPLICATION
============================================================ */
document.addEventListener("DOMContentLoaded", () => {

    initializeApp();

   const accountIcon = document.querySelector("#account-icon");
   const accountOverlay = document.querySelector(".account-overlay");
   const accountClose = document.querySelector(".account-close");

   const signinView = document.querySelector(".signin-view");
   const registerView = document.querySelector(".register-view");

   const createAccountBtn = document.querySelector(".create-account-btn");
   const backToSigninBtn = document.querySelector(".back-to-signin-btn");

    const showSigninView = () => {
        registerView.classList.remove("active");
        signinView.classList.remove("hide");
        accountOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
        accountOverlay.querySelector(".account-modal")?.scrollTo(0, 0);
        requestAnimationFrame(() => {
            document.getElementById("signin-email")?.focus({ preventScroll: true });
        });
    };

       // Switch to Register
    createAccountBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    signinView.classList.add("hide");
    registerView.classList.add("active");
});

// Switch back to Sign In
    backToSigninBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    showSigninView();
});

    const openAccountModal = () => {
        accountOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
    };

    if (sessionStorage.getItem("openAccountSignIn") === "true") {
        sessionStorage.removeItem("openAccountSignIn");
        openAccountModal();
    }

    const homeAccountMenu = document.getElementById("home-account-menu");
    const homeViewProfile = document.getElementById("home-view-profile");

    accountIcon.addEventListener("click", event => {
        if (event.target.closest(".home-account-menu")) return;

        if (auth.currentUser) {
            homeAccountMenu.hidden = !homeAccountMenu.hidden;
            return;
        }

        openAccountModal();
    });

    homeViewProfile.addEventListener("click", () => {
        sessionStorage.setItem("accountReturnUrl", window.location.href);
    });

    document.addEventListener("click", event => {
        if (event.target.closest("#account-icon")) return;
        homeAccountMenu.hidden = true;
    });

    if (
        !auth.currentUser &&
        new URLSearchParams(window.location.search).get("account") === "login"
    ) {
        openAccountModal();
        history.replaceState({}, "", window.location.pathname);
    }

accountClose.addEventListener("click", () => {
    accountOverlay.classList.remove("active");
    document.body.style.overflow = "";

    registerView.classList.remove("active");
    signinView.classList.remove("hide");
});

accountOverlay.addEventListener("click", (event) => {
    if (event.target === accountOverlay) {
        accountOverlay.classList.remove("active");
        document.body.style.overflow = "";

        registerView.classList.remove("active");
        signinView.classList.remove("hide");
    }
});

});


if (sessionStorage.getItem("mpwrOpenCartOnReturn") === "true") {
    sessionStorage.removeItem("mpwrOpenCartOnReturn");
    cart.classList.add("active");
    syncSidePanelScrollLock();
}

onAuthStateChanged(auth, async (user) => {

    if (user) {

        await loadCartFromFirestore();

        await loadFavoritesFromFirestore();

        await loadOrdersFromFirestore();

    } else {

        cartItems = JSON.parse(
            localStorage.getItem("cart")
        ) || [];

        favorites = JSON.parse(
            localStorage.getItem("favorites")
        ) || [];

        renderSavedCart();
        renderWishlist();

    }

});

