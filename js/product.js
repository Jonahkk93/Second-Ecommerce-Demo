import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;

const params = new URLSearchParams(window.location.search);

const productId = Number(params.get("id"));
const product = products.find(item => item.id === productId);
const sliderTrack = document.querySelector(".product-slider-track");
const sliderContainer = document.querySelector(".product-image-container");

const thumbnailsContainer =
    document.querySelector(".product-thumbnails");

// =========================
// PRODUCT IMAGE SLIDER
// =========================

let currentSlide = 0;
let galleryImages = [];

function getSlideWidth() {
    return sliderContainer.getBoundingClientRect().width;
}

function updateSlider(animate = true) {
    sliderTrack.style.transition = animate ? "transform .35s ease" : "none";
    sliderTrack.style.transform = `translateX(-${currentSlide * getSlideWidth()}px)`;

    document.querySelectorAll(".product-thumbnail").forEach((thumb, i) => {
        thumb.classList.toggle("active", i === currentSlide);
    });
}

function goToSlide(index) {
    currentSlide = Math.max(0, Math.min(index, galleryImages.length - 1));
    updateSlider(true);
}

const productTitle = document.querySelector(".product-page-title");

const productPrice = document.querySelector(".product-page-price");

const productDescription = document.querySelector(".product-page-description");

const colorOptions = document.querySelector(".color-options");

const sizeOptions = document.querySelector(".size-options");
const addTocartIcon = document.querySelector(".product-bottom-cart");
const quantityMinus = document.querySelector(".quantity-minus");

const quantityPlus = document.querySelector(".quantity-plus");

const quantityValue = document.querySelector(".quantity-value");

const cartIcon = document.querySelector("#cart-icon");
const cartBadge = document.querySelector(".cart-item-count");
console.log("cartBadge element:", cartBadge);

const wishlist = document.querySelector(".wishlist");
const searchIcon = document.querySelector("#search-icon");
const cart = document.querySelector(".cart");

const cartClose = document.querySelector("#cart-close");

const wishlistNavIcon = document.querySelector("#wishlist-nav-icon");
const favoriteIcon = wishlistNavIcon?.querySelector("img");

const wishlistClose = document.querySelector("#wishlist-close");
const wishlistContent = document.querySelector(".wishlist-content");
const wishlistEmpty = document.querySelector(".wishlist-empty");
const wishlistFooter = document.querySelector(".wishlist-footer");
const clearWishlistButton = document.querySelector(".clear-wishlist");
const wishlistContinue = document.querySelector(".wishlist-continue");
const bottomwishlistNavIcon = document.querySelector(".product-bottom-favorite");
const bottomFavoriteIcon = bottomwishlistNavIcon?.querySelector("img");

const searchBar = document.querySelector(".search-bar");
const searchClose = document.querySelector("#search-close");
const searchInput = document.querySelector("#search-input");
const productBoxes = document.querySelectorAll(".product-box");


const cartContent = document.querySelector(".cart-content");

const cartEmpty = document.querySelector(".cart-empty");

const totalSection = document.querySelector(".total");

const totalPriceElement = document.querySelector(".total-price");

const checkoutButton = document.querySelector(".btn-buy");

const continueShopping = document.querySelector(".continue-shopping");
const backButton = document.querySelector(".product-back-btn");

let quantity = 1;
quantityValue.textContent = quantity;

quantityPlus.addEventListener("click", () => {
    quantity++;
    quantityValue.textContent = quantity;
});

quantityMinus.addEventListener("click", () => {
    if (quantity > 1) {
        quantity--;
        quantityValue.textContent = quantity;
    }
});
let selectedColor = "";

let selectedSize = "";

let favorites = JSON.parse(
    localStorage.getItem("favorites")
) || [];

function updateCartBadge() {
    const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

    console.log("updateCartBadge()", cartItems);

    if (!cartBadge) {
        console.error(".cart-item-count element not found");
        return;
    }

    const totalItems = cartItems.reduce(
        (sum, item) => sum + Number(item.quantity || 1),
        0
    );

    cartBadge.textContent = String(totalItems);
    cartBadge.style.display = totalItems > 0 ? "flex" : "none";
    cartBadge.style.visibility = "visible";
    cartBadge.style.opacity = "1";
    cartBadge.style.zIndex = "9999";

    console.log("Badge updated:", totalItems, cartBadge);
}

function saveCart(cartItems) {
    localStorage.setItem("cart", JSON.stringify(cartItems));
    saveCartToFirestore();
}

async function saveCartToFirestore() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

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

    async function loadCartFromFirestore() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        const cartDoc = await getDoc(
            doc(db, "carts", user.uid)
        );

        if (cartDoc.exists()) {

            const data = cartDoc.data();

            const cartItems = data.items || [];

            localStorage.setItem(
                "cart",
                JSON.stringify(cartItems)
            );

            renderSavedCart();

            updateCartBadge();

            console.log("Cart loaded from Firestore.");

        }

    } catch (error) {

        console.error("Error loading cart:", error);

    }

}

function updateTotalPrice(cartItems) {
    let total = 0;

    cartItems.forEach(item => {
        const price = Number(String(item.price).replace(/[^\d.]/g, ""));
        total += price * item.quantity;
    });

    totalPriceElement.textContent = `UGX ${total.toLocaleString()}`;
}

function updateCartUI(cartItems) {
    const isEmpty = cartItems.length === 0;

    cartEmpty.style.display = isEmpty ? "flex" : "none";
    totalSection.style.display = isEmpty ? "none" : "flex";
    checkoutButton.style.display = isEmpty ? "none" : "block";
}

function createCartBox(cartItem) {
    const cartBox = document.createElement("div");
    cartBox.classList.add("cart-box");

    cartBox.innerHTML = `
        <img src="${cartItem.image}" class="cart-img">

        <div class="cart-detail">
            <h2 class="cart-product-title">${cartItem.title}</h2>

<div class="cart-variants">
    ${cartItem.color}
    ${cartItem.color && cartItem.size ? " • " : ""}
    ${cartItem.size}
</div>

<span class="cart-price">

    UGX ${Number(String(cartItem.price).replace(/[^\d]/g, "")).toLocaleString()}

</span>

            <div class="cart-quantity">
                <button class="decrement">−</button>
                <span class="number">${cartItem.quantity}</span>
                <button class="increment">+</button>
            </div>
        </div>

        <img
    src="images/trashbin.png"
    class="cart-remove"
>
    `;

    attachCartEvents(cartBox, cartItem);

    return cartBox;
}

function attachCartEvents(cartBox, cartItem) {
    const decrement = cartBox.querySelector(".decrement");
    const increment = cartBox.querySelector(".increment");
    const quantityText = cartBox.querySelector(".number");
    const removeButton = cartBox.querySelector(".cart-remove");

    increment.addEventListener("click", () => {
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        const item = cartItems.find(i =>
            i.id === cartItem.id &&
            i.color === cartItem.color &&
            i.size === cartItem.size
        );

        if (!item) return;

        item.quantity++;

        quantityText.textContent = item.quantity;

        saveCart(cartItems);
        updateTotalPrice(cartItems);
    });

    decrement.addEventListener("click", () => {
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        const item = cartItems.find(i =>
            i.id === cartItem.id &&
            i.color === cartItem.color &&
            i.size === cartItem.size
        );

        if (!item) return;

        if (item.quantity > 1) {
            item.quantity--;

            quantityText.textContent = item.quantity;

            saveCart(cartItems);
            updateTotalPrice(cartItems);
        }
    });

    removeButton.addEventListener("click", () => {
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        cartItems = cartItems.filter(i =>
            !(
                i.id === cartItem.id &&
                i.color === cartItem.color &&
                i.size === cartItem.size
            )
        );

        saveCart(cartItems);

        renderSavedCart();

        updateCartBadge();
    });
}

function renderSavedCart() {
    const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

    cartContent.innerHTML = "";

    cartItems.forEach(item => {
        cartContent.appendChild(createCartBox(item));
    });

    updateTotalPrice(cartItems);
    updateCartUI(cartItems);
}

function updateFavoriteIcon() {

    const exists = favorites.some(item =>
        item.id === product.id.toString()
    );

    const heartImage = exists
        ? "images/Heart7.PNG"
        : "images/Heart-Outline2.PNG";

    bottomFavoriteIcon?.setAttribute("src", heartImage);
}

if (product) {
    galleryImages = product.gallery || [product.image];

    sliderTrack.innerHTML = galleryImages.map(src => `
        <div class="product-slide">
            <img src="${src}" alt="Product image">
        </div>
    `).join("");

    thumbnailsContainer.innerHTML = "";

    galleryImages.forEach((src, index) => {
        const thumbnail = document.createElement("img");
        thumbnail.src = src;
        thumbnail.className = "product-thumbnail";
        thumbnail.addEventListener("click", () => {
            goToSlide(index);
        });
        thumbnailsContainer.appendChild(thumbnail);
    });

    productTitle.textContent = product.title;
    productPrice.textContent =
        `UGX ${Number(product.price).toLocaleString()}`;
    productDescription.textContent =
        product.description;

    colorOptions.innerHTML = "";
    product.colors.forEach(color => {
        colorOptions.innerHTML += `
            <button class="color-btn">${color}</button>
        `;
    });

    sizeOptions.innerHTML = "";
    product.sizes.forEach(size => {
        sizeOptions.innerHTML += `
                <button class="size-btn">${size}</button>
            `;
    });

    goToSlide(0);

    const colorButtons = document.querySelectorAll(".color-btn");

    colorButtons.forEach(button => {
        button.addEventListener("click", () => {
            colorButtons.forEach(btn =>
                btn.classList.remove("active")
            );
            button.classList.add("active");
            selectedColor = button.textContent;
            if (!product.galleries || !product.galleries[selectedColor]) return;
            galleryImages = [...product.galleries[selectedColor]];

            sliderTrack.innerHTML = galleryImages.map(src => `
                <div class="product-slide">
                    <img src="${src}" alt="Product image">
                </div>
            `).join("");

            thumbnailsContainer.innerHTML = "";
            galleryImages.forEach((src, index) => {
                const thumbnail = document.createElement("img");
                thumbnail.src = src;
                thumbnail.className = "product-thumbnail";
                thumbnail.addEventListener("click", () => {
                    goToSlide(index);
                });
                thumbnailsContainer.appendChild(thumbnail);
            });
            goToSlide(0);
        });
    });
}

selectedColor = product.colors[0];
selectedSize = product.sizes[0];

document.querySelector(".color-btn")?.classList.add("active");
document.querySelector(".size-btn")?.classList.add("active");

const sizeButtons = document.querySelectorAll(".size-btn");

sizeButtons.forEach(button => {

    button.addEventListener("click", () => {

        sizeButtons.forEach(btn => {

            btn.classList.remove("active");

        });

        button.classList.add("active");
        selectedSize = button.textContent;

    });

});

addTocartIcon.addEventListener("click", () => {

    const cartItem = {

        id: product.id,
        title: product.title,
        price: product.price,
        image: product.images
            ? product.images[selectedColor]
            : product.image,
        color: selectedColor,
        size: selectedSize,
        quantity: quantity
    };

    let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

    const existingItem = cartItems.find(item => {
        return (
            item.id === cartItem.id &&
            item.color === cartItem.color &&
            item.size === cartItem.size
        );
    });

    if (existingItem) {
        alert("This product is already in your cart.");
        return;
    }

    cartItems.push(cartItem);

    saveCart(cartItems);

    renderSavedCart();

    updateCartBadge();

    console.log(cartItems);
});

backButton.addEventListener("click", () => {

    if (document.referrer && document.referrer.includes("index.html")) {
        window.location.href = "index.html";
    } else {
        history.back();
    }

});

updateCartBadge();
updateFavoriteIcon();
renderWishlist();

wishlistNavIcon.addEventListener("click", () => {

    console.log("Header heart clicked");
    console.log(wishlist);

    if (wishlist) {
        wishlist.classList.add("active");
    }

});

if (wishlistClose) {

    wishlistClose.addEventListener("click", () => {

        wishlist.classList.remove("active");

    });

}


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
        src="images/trashbin.png"
        class="wishlist-remove-icon"
    >

</button>

    `;

    const removeButton =
        wishlistBox.querySelector(".wishlist-remove");
        const addTocartIcon =
    wishlistBox.querySelector(".wishlist-add-cart");

    removeButton.addEventListener("click", () => {

        favorites = favorites.filter(favorite => {

            return favorite.id !== item.id;

        });

    localStorage.setItem(
    "favorites",
    JSON.stringify(favorites)
);

saveFavoritesToFirestore();    

        renderWishlist();

    });

   addTocartIcon.addEventListener("click", () => {
    const targetProduct = products.find(
        p => p.id.toString() === item.id.toString()
    );

    if (!targetProduct) return;

    window.location.href = `product.html?id=${targetProduct.id}`;
});

    return wishlistBox;

}

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
   RENDER WISHLIST
============================================================ */

function renderWishlist() {

    if (!wishlistContent) {
        console.error(".wishlist-content element was not found in product.html");
        return;
    }

    wishlistContent.innerHTML = "";

    favorites.forEach(item => {
        wishlistContent.appendChild(
            createWishlistItem(item)
        );
    });

    updateWishlistUI();
}
function clearWishlist() {
    favorites = [];

    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

    saveFavoritesToFirestore();

    updateFavoriteIcon();

    renderWishlist();
}
clearWishlistButton?.addEventListener("click", clearWishlist);



bottomwishlistNavIcon?.addEventListener("click", () => {

    const index = favorites.findIndex(
        item => item.id === product.id.toString()
    );

    if (index === -1) {

        favorites.push({
            id: product.id.toString(),
            title: product.title,
            price: product.price,
            image: product.image
        });

    } else {

        favorites.splice(index, 1);

    }

    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

    saveFavoritesToFirestore();

    updateFavoriteIcon();

    renderWishlist();

});
   

cartIcon.addEventListener("click", () => {

    cart.classList.add("active");

});

cartClose.addEventListener("click", () => {

    cart.classList.remove("active");

});
searchIcon.addEventListener("click", () => {
    searchBar.classList.add("active");
});

searchClose.addEventListener("click", () => {
    searchBar.classList.remove("active");
});

searchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const query = searchInput.value.trim();

    if (query) {
        window.location.href = `index.html?search=${encodeURIComponent(query)}`;
    } else {
        window.location.href = "index.html";
    }
});
renderSavedCart();
updateCartBadge();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadCartFromFirestore();
    }
    renderSavedCart();
    updateTotalPrice(JSON.parse(localStorage.getItem("cart")) || []);
    updateCartBadge();
});


