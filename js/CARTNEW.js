
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

const filterBar = document.querySelector(".filter-bar");
const filterButtons = document.querySelectorAll(".filter-btn");


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

const productModalColorOptions = document.querySelector(".product-modal-color-options");


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
let selectedModalColor = "";
let selectedModalSize = "";
const productsById = Object.fromEntries(
    products.map(product => [product.id, product])
);
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

      onSnapshot(
    doc(db, "favorites", user.uid),
    (docSnap) => {

        favorites = docSnap.exists()
            ? docSnap.data().items || []
            : [];

        localStorage.setItem(
            "favorites",
            JSON.stringify(favorites)
        );

        renderWishlist();

        updateWishlistButtons();

        console.log("Favorites synchronized.");

    }
);

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


/* ============================================================
   CART BADGE
============================================================ */

let cartItemCount = cartItems.length;

/* ============================================================
   SHOW TOAST NOTIFICATION
============================================================ */

function showToast(message, type = "success") {

    toast.textContent = message;

    toast.className = "toast";

    toast.classList.add(type);

    toast.classList.add("show");

    clearTimeout(toast.timeout);

    toast.timeout = setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

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

        if (cartDoc.exists()) {

            cartItems = cartDoc.data().items || [];

            localStorage.setItem(
                "cart",
                JSON.stringify(cartItems)
            );

            renderSavedCart();

            console.log("Cart loaded from Firestore.");

        }

    } catch (error) {

        console.error("Error loading cart:", error);

    }

}



/* ============================================================
   SAVE WISHLIST
============================================================ */

function saveWishlist() {

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

function createCartItem(productBox, selectedColor, selectedSize) {

    return {

        id: productBox.dataset.id,

        title: productBox.querySelector(".product-title").textContent,

        price: productBox.querySelector(".price").textContent,

        image: productBox.querySelector(".img-box > img").src,

       color: selectedColor || "",
size: selectedSize || "",

        quantity: 1

    };

}


/* ============================================================
   CREATE CART HTML
   Builds one cart item.
============================================================ */

function createCartBox(cartItem) {

    const cartBox = document.createElement("div");

    cartBox.classList.add("cart-box");
    cartBox.dataset.id = cartItem.id;

    cartBox.innerHTML = `

        <img
            src="${cartItem.image}"
            class="cart-img"
        >

        <div class="cart-detail">

            <h2 class="cart-product-title">
    ${cartItem.title}
</h2>

<div class="cart-variants">
    ${cartItem.color}
    ${cartItem.color && cartItem.size ? " • " : ""}
    ${cartItem.size}
</div>

<span class="cart-price">
UGX ${Number(String(cartItem.price).replace(/[^\d]/g, "")).toLocaleString()}

            </span>

            <div class="cart-quantity">

                <button class="decrement">-</button>

                <span class="number">

                    ${cartItem.quantity}

                </span>

                <button class="increment">+</button>

            </div>

        </div>

        <img
            src="images/Icon Folder/Delete Icon_Black.PNG"
            class="cart-remove"
        >

    `;
    attachCartEvents(cartBox, cartItem);

    return cartBox;

}

function attachCartEvents(cartBox, cartItem) {

    const removeButton = cartBox.querySelector(".cart-remove");

    const incrementButton = cartBox.querySelector(".increment");

    const decrementButton = cartBox.querySelector(".decrement");

    const numberElement = cartBox.querySelector(".number");

    removeButton.addEventListener("pointerdown", () => {
        removeButton.src = "images/Icon Folder/Delete Icon_Red.PNG";
    });

    removeButton.addEventListener("pointerenter", () => {
        removeButton.src = "images/Icon Folder/Delete Icon_Red.PNG";
    });

    removeButton.addEventListener("pointerleave", () => {
        removeButton.src = "images/Icon Folder/Delete Icon_Black.PNG";
    });

    removeButton.addEventListener("click", () => {

    setTimeout(() => {

   cartItems = cartItems.filter(item => {

    return !(
        item.id === cartItem.id &&
        item.color === cartItem.color &&
        item.size === cartItem.size
    );

});

    saveCart();

    renderSavedCart();

    updateCartCount();

    }, 120);

});

incrementButton.addEventListener("click", () => {

   const item = cartItems.find(i =>
    i.id === cartItem.id &&
    i.color === cartItem.color &&
    i.size === cartItem.size
);

    if (!item) return;

    item.quantity++;

    numberElement.textContent = item.quantity;

    saveCart();
    updateCartCount();
    updateTotalPrice();

});

decrementButton.addEventListener("click", () => {

    const item = cartItems.find(i =>
    i.id === cartItem.id &&
    i.color === cartItem.color &&
    i.size === cartItem.size
);

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

function addToCart(productBox, selectedColor, selectedSize) {
    const cartItem = createCartItem(
    productBox,
    selectedColor,
    selectedSize
);

    /* --------------------------------------------------------
       Prevent duplicate products
    --------------------------------------------------------- */

    const existingItem = cartItems.find(item => {

    return (
        item.title === cartItem.title &&
        item.color === cartItem.color &&
        item.size === cartItem.size
    );

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

checkoutButton.addEventListener("click", async () => {

    if (!auth.currentUser) {

        showToast(
            "Please sign in before checking out⚠️.",
            "warning"
        );

        return;

    }

    if (cartItems.length === 0) {

        showToast(
            "Your cart is empty 🛒",
            "warning"
        );

        return;

    }

   await saveOrderToFirestore();

showToast(
    "Thank you for your order ❤️",
    "success"
);

cartItems = [];

saveCart();

renderSavedCart();

});


/* ============================================================
   RESTORE SAVED CART
============================================================ */


/* ============================================================
   OPEN SEARCH
============================================================ */

searchIcon.addEventListener("click", () => {

    if (searchBar.classList.contains("active")) {

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

    searchBar.classList.remove("active");

    filterBar.classList.remove("active");

    document.body.classList.remove("search-open");

    searchInput.value = "";

    filterProducts("");

});


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

   wishlistBox.classList.add("wishlist-item");

    wishlistBox.innerHTML = `

        <img
            src="${item.image}"
            class="wishlist-img"
        >

        <div class="wishlist-details">

            <h3>

                ${item.title}

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
        src="images/Icon Folder/Delete Icon_Black.PNG"
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
        removeIcon.src = "images/Icon Folder/Delete Icon_Red.PNG";
    });

    removeButton.addEventListener("pointerleave", () => {
        removeIcon.src = "images/Icon Folder/Delete Icon_Black.PNG";
    });

    removeButton.addEventListener("pointerdown", () => {
        removeIcon.src = "images/Icon Folder/Delete Icon_Red.PNG";
    });

    removeButton.addEventListener("click", () => {

        setTimeout(() => {

        favorites = favorites.filter(favorite => {

            return favorite.id !== item.id;

        });

        saveWishlist();

        renderWishlist();

        }, 120);

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
        "images/Icon Folder/Delete Icon_Red.PNG";
});

clearWishlistButton.addEventListener("pointerleave", () => {
    clearWishlistButton.querySelector(".clear-wishlist-icon").src =
        "images/Icon Folder/Delete Icon_Black.PNG";
});

clearWishlistButton.addEventListener("pointerdown", () => {
    const icon = clearWishlistButton.querySelector(".clear-wishlist-icon");

    icon.src = "images/Icon Folder/Delete Icon_Red.PNG";

    setTimeout(() => {
        if (!clearWishlistButton.matches(":hover")) {
            icon.src = "images/Icon Folder/Delete Icon_Black.PNG";
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

productModalImage.src = product.image;
productModalTitle.textContent = product.title;

    productModalImage.src = product.image;
    productModalTitle.textContent = product.title;
    productModalPrice.textContent =
        `UGX ${Number(product.price).toLocaleString()}`;
    const previewWords = product.description.trim().split(/\s+/).slice(0, 6);

    productModalDescription.textContent = `${previewWords.join(" ")}...`;
    productModalReadMore.href = `product.html?id=${product.id}`;
    productModalImageLink.href = `product.html?id=${product.id}`;
    productModalTitleLink.href = `product.html?id=${product.id}`;
   productModalColorOptions.innerHTML = "";
   selectedModalColor = product.colors[0];
   selectedModalSize = product.sizes[0];

product.colors.forEach((color, index) => {

    const button = document.createElement("button");

    button.textContent = color;

    button.classList.add("product-modal-color-btn");

    if (index === 0) {
        button.classList.add("active");
    }

    button.addEventListener("click", () => {

        productModalColorOptions
            .querySelectorAll(".product-modal-color-btn")
            .forEach(btn => btn.classList.remove("active"));

        button.classList.add("active");
        selectedModalColor = color;
        

    });

    productModalColorOptions.appendChild(button);

});
const sizeOptions = document.querySelector(".product-modal-size-options");

sizeOptions.innerHTML = "";

product.sizes.forEach((size, index) => {

    const button = document.createElement("button");

    button.textContent = size;

    button.classList.add("product-modal-size-btn");

    if (index === 0) {
        button.classList.add("active");
    }

    button.addEventListener("click", () => {

        sizeOptions
            .querySelectorAll(".product-modal-size-btn")
            .forEach(btn => btn.classList.remove("active"));

        button.classList.add("active");

        selectedModalSize = size;

    });

    sizeOptions.appendChild(button);

});
    productModalOverlay.classList.add("active");
}


/* ============================================================
   CLOSE PRODUCT MODAL
============================================================ */

function closeProductModal() {

    productModalOverlay.classList.remove("active");

    selectedProduct = null;

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
        selectedModalColor,
        selectedModalSize
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
    const params = new URLSearchParams(window.location.search);
const search = params.get("search");

if (search) {
    searchBar.classList.add("active");
    filterBar.classList.add("active");
    searchInput.value = search;
    applyCategoryFilter(currentFilter);

    window.history.replaceState({}, "", "index.html");
}


    noResults.style.display = "none";


    /* ----------------------------------------
       Default Filter
    ----------------------------------------- */

    currentFilter = "all";

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
   const backToSigninBtn = document.querySelector(".back-to-signin-btn");;

       // Switch to Register
    createAccountBtn.addEventListener("click", () => {
    signinView.classList.add("hide");
    registerView.classList.add("active");
});

// Switch back to Sign In
    backToSigninBtn.addEventListener("click", () => {
    registerView.classList.remove("active");
    signinView.classList.remove("hide");
});

    accountIcon.addEventListener("click", () => {
    accountOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
});

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


onAuthStateChanged(auth, async (user) => {

    if (user) {

        await loadCartFromFirestore();

        await loadFavoritesFromFirestore();

        await loadOrdersFromFirestore();

    } else {

        cartItems = [];
        favorites = [];

        localStorage.removeItem("cart");
        localStorage.removeItem("favorites");

        renderSavedCart();
        renderWishlist();

    }

});

