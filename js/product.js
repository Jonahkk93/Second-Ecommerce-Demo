import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    collection,
    addDoc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;

const params = new URLSearchParams(window.location.search);

const productId = Number(params.get("id"));
const requestedColor = params.get("color");
const requestedSize = params.get("size");
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

let touchStartX = 0;
let touchStartY = 0;
let touchDeltaX = 0;
let isHorizontalSwipe = false;

sliderContainer.addEventListener("touchstart", event => {
    const touch = event.touches[0];

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchDeltaX = 0;
    isHorizontalSwipe = false;
    sliderTrack.style.transition = "none";
}, { passive: true });

sliderContainer.addEventListener("touchmove", event => {
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (!isHorizontalSwipe && Math.abs(deltaY) > Math.abs(deltaX)) {
        return;
    }

    if (Math.abs(deltaX) > 6) {
        isHorizontalSwipe = true;
    }

    if (!isHorizontalSwipe) return;

    event.preventDefault();
    touchDeltaX = deltaX;

    const edgeResistance =
        (currentSlide === 0 && deltaX > 0) ||
        (currentSlide === galleryImages.length - 1 && deltaX < 0)
            ? 0.28
            : 1;

    const offset =
        -(currentSlide * getSlideWidth()) +
        (deltaX * edgeResistance);

    sliderTrack.style.transform = `translate3d(${offset}px, 0, 0)`;
}, { passive: false });

function finishTouchSwipe() {
    const threshold = Math.min(70, getSlideWidth() * 0.18);

    if (isHorizontalSwipe && Math.abs(touchDeltaX) >= threshold) {
        goToSlide(currentSlide + (touchDeltaX < 0 ? 1 : -1));
    } else {
        updateSlider(true);
    }

    touchDeltaX = 0;
    isHorizontalSwipe = false;
}

sliderContainer.addEventListener("touchend", finishTouchSwipe, { passive: true });
sliderContainer.addEventListener("touchcancel", finishTouchSwipe, { passive: true });

window.addEventListener("resize", () => updateSlider(false));

const productTitle = document.querySelector(".product-page-title");

const productPrice = document.querySelector(".product-page-price");

const productDescription = document.querySelector(".product-page-description");

const productDescriptionReadMore = document.querySelector(
    ".product-description-read-more"
);

const colorOptions = document.querySelector(".color-options");

const sizeOptions = document.querySelector(".size-options");
const addTocartIcon = document.querySelector(".product-bottom-cart");
const quantityMinus = document.querySelector(".quantity-minus");

const quantityPlus = document.querySelector(".quantity-plus");

const quantityValue = document.querySelector(".quantity-value");

const cartIcon = document.querySelector("#cart-icon");
const accountIcon = document.querySelector("#account-icon");
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
const toast = document.querySelector(".toast");
const confirmOverlay = document.querySelector(".confirm-overlay");
const confirmCancel = document.querySelector(".confirm-cancel");
const confirmClear = document.querySelector(".confirm-clear");
const sidePanelBackdrop = document.querySelector(".side-panel-backdrop");
const reviewForm = document.querySelector("#review-form");
const reviewEligibility = document.querySelector(".review-eligibility");
const reviewList = document.querySelector(".review-list");
const reviewEmpty = document.querySelector(".review-empty");
const reviewText = document.querySelector("#review-text");
const reviewSubmit = document.querySelector(".review-submit");
const reviewStars = [...document.querySelectorAll(".review-star")];
const ratingScores = [...document.querySelectorAll(".rating-score")];
const reviewCounts = [...document.querySelectorAll(".review-count")];
const productRatingStars = document.querySelector(".product-rating .stars");
const reviewSummaryStars = document.querySelector(".reviews-summary-stars");
const productReviews = document.querySelector(".product-reviews");
const productGallery = document.querySelector(".product-gallery");
const productLayout = document.querySelector(".product-layout");

let selectedReviewRating = 0;
let currentReviewExists = false;

accountIcon?.addEventListener("click", () => {
    window.location.href = auth.currentUser
        ? "Account.html"
        : "index.html?account=login";
});

accountIcon?.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = auth.currentUser
            ? "Account.html"
            : "index.html?account=login";
    }
});

function positionReviews() {
    const destination = window.matchMedia("(min-width: 601px)").matches
        ? productGallery
        : productLayout;

    if (productReviews.parentElement !== destination) {
        destination.appendChild(productReviews);
    }
}

positionReviews();
window.addEventListener("resize", positionReviews);

function setReviewRating(rating) {
    selectedReviewRating = rating;
    reviewStars.forEach(star => {
        const isSelected = Number(star.dataset.rating) <= rating;
        star.classList.toggle("selected", isSelected);
        star.setAttribute("aria-pressed", String(isSelected));
    });
}

reviewStars.forEach(star => {
    star.addEventListener("click", () => {
        setReviewRating(Number(star.dataset.rating));
    });
});

function reviewDate(value) {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    if (!date || Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}

function renderReviewList(reviews) {
    reviewList.replaceChildren();
    reviewEmpty.hidden = reviews.length > 0;

    const average = reviews.length
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
        : 0;

    ratingScores.forEach(score => {
        score.textContent = reviews.length ? average.toFixed(1) : "0.0";
    });
    reviewCounts.forEach(count => {
        count.textContent = reviews.length
            ? `${reviews.length} ${reviews.length === 1 ? "Review" : "Reviews"}`
            : "No reviews yet";
    });
    const averageStars =
        "★".repeat(Math.round(average)) + "☆".repeat(5 - Math.round(average));
    productRatingStars.textContent = averageStars;
    reviewSummaryStars.textContent = averageStars;

    reviews.forEach(review => {
        const card = document.createElement("article");
        card.className = "review-card";

        const header = document.createElement("div");
        header.className = "review-card-header";

        const customer = document.createElement("strong");
        customer.textContent = review.customerName || "MPWR customer";

        const verified = document.createElement("span");
        verified.className = "verified-purchase";
        verified.textContent = "Verified purchase";

        const stars = document.createElement("span");
        stars.className = "review-card-stars";
        stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
        stars.textContent =
            "★".repeat(Number(review.rating)) +
            "☆".repeat(5 - Number(review.rating));

        const body = document.createElement("p");
        body.textContent = review.text;

        const date = document.createElement("time");
        date.textContent = reviewDate(review.updatedAt || review.createdAt);

        header.append(customer, verified);
        card.append(header, stars, body);

        if (review.userId === auth.currentUser?.uid) {
            const updateButton = document.createElement("button");
            updateButton.type = "button";
            updateButton.className = "review-update-button";
            updateButton.textContent = "Update review";
            updateButton.addEventListener("click", () => {
                reviewEligibility.hidden = false;
                reviewEligibility.textContent = "Update your verified review.";
                reviewForm.hidden = false;
                reviewSubmit.textContent = "Update review";
                reviewText.focus();
                reviewForm.scrollIntoView({ behavior: "smooth", block: "center" });
            });
            card.appendChild(updateButton);
        }

        if (review.attachment?.url) {
            if (review.attachment.type?.startsWith("image/")) {
                const attachmentLink = document.createElement("a");
                attachmentLink.href = review.attachment.url;
                attachmentLink.target = "_blank";
                attachmentLink.rel = "noopener";

                const attachmentImage = document.createElement("img");
                attachmentImage.className = "review-attachment-image";
                attachmentImage.src = review.attachment.url;
                attachmentImage.alt = review.attachment.name || "Review attachment";
                attachmentLink.appendChild(attachmentImage);
                card.appendChild(attachmentLink);
            } else {
                const attachmentLink = document.createElement("a");
                attachmentLink.className = "review-attachment-file";
                attachmentLink.href = review.attachment.url;
                attachmentLink.target = "_blank";
                attachmentLink.rel = "noopener";
                attachmentLink.textContent =
                    `View attachment: ${review.attachment.name || "File"}`;
                card.appendChild(attachmentLink);
            }
        }

        card.appendChild(date);
        reviewList.appendChild(card);
    });
}

async function loadProductReviews() {
    try {
        const snapshot = await getDocs(query(
            collection(db, "reviews"),
            where("productId", "==", String(product.id))
        ));
        const reviews = snapshot.docs
            .map(reviewDoc => ({ id: reviewDoc.id, ...reviewDoc.data() }))
            .sort((a, b) => {
                const aTime = (a.updatedAt || a.createdAt)?.toMillis?.() || 0;
                const bTime = (b.updatedAt || b.createdAt)?.toMillis?.() || 0;
                return bTime - aTime;
            });
        renderReviewList(reviews);
    } catch (error) {
        console.error("Unable to load reviews:", error);
        reviewEmpty.hidden = false;
        reviewEmpty.textContent = "Reviews could not be loaded right now.";
    }
}

async function customerPurchasedProduct(user) {
    const snapshot = await getDocs(query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
    ));

    return snapshot.docs.some(orderDoc => {
        const order = orderDoc.data();
        return order.status !== "Cancelled" &&
            Array.isArray(order.items) &&
            order.items.some(item => String(item.id) === String(product.id));
    });
}

async function initializeReviewForm(user) {
    reviewForm.hidden = true;
    reviewEligibility.hidden = false;
    setReviewRating(0);
    reviewText.value = "";
    currentReviewExists = false;

    if (!user) {
        reviewEligibility.textContent =
            "Sign in to review this product after purchasing it.";
        return;
    }

    reviewEligibility.textContent = "Checking your purchase history…";

    try {
        const eligible = await customerPurchasedProduct(user);
        if (!eligible) {
            reviewEligibility.textContent =
                "Only customers who purchased this product can leave a review.";
            return;
        }

        const reviewRef = doc(db, "reviews", `${user.uid}_${product.id}`);
        const existing = await getDoc(reviewRef);

        if (existing.exists()) {
            const data = existing.data();
            currentReviewExists = true;
            reviewText.value = data.text || "";
            setReviewRating(Number(data.rating || 0));
            reviewSubmit.textContent = "Update review";
            reviewEligibility.hidden = true;
            reviewForm.hidden = true;
        } else {
            reviewSubmit.textContent = "Post review";
            reviewEligibility.textContent =
                "Verified purchase — tell us what you think.";
        }

        reviewForm.hidden = currentReviewExists;
    } catch (error) {
        console.error("Unable to verify purchase:", error);
        reviewEligibility.hidden = true;
    }
}

reviewForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const user = auth.currentUser;
    const text = reviewText.value.trim();

    if (!user || !selectedReviewRating || !text) {
        showToast("Choose a rating and write your review.", "warning");
        return;
    }

    reviewSubmit.disabled = true;
    reviewSubmit.textContent = currentReviewExists ? "Updating…" : "Posting…";

    try {
        const reviewRef = doc(db, "reviews", `${user.uid}_${product.id}`);
        const payload = {
            productId: String(product.id),
            userId: user.uid,
            customerName: user.displayName || user.email?.split("@")[0] || "MPWR customer",
            rating: selectedReviewRating,
            text,
            verifiedPurchase: true,
            updatedAt: serverTimestamp()
        };
        if (!currentReviewExists) payload.createdAt = serverTimestamp();

        await setDoc(reviewRef, payload, { merge: true });
        currentReviewExists = true;
        reviewSubmit.textContent = "Update review";
        reviewEligibility.textContent =
            "Your verified review has been published.";
        showToast("Review published.", "success");
        await loadProductReviews();
        if (currentReviewExists) {
            reviewEligibility.hidden = true;
            reviewForm.hidden = true;
        }
    } catch (error) {
        console.error("Unable to save review:", error);
        reviewSubmit.textContent = currentReviewExists ? "Update review" : "Post review";
        showToast("Your review could not be saved.", "warning");
    } finally {
        reviewSubmit.disabled = false;
    }
});

function syncSidePanelScrollLock() {
    const panelIsOpen =
        cart?.classList.contains("active") ||
        wishlist?.classList.contains("active");

    document.documentElement.classList.toggle("side-panel-open", panelIsOpen);
    document.body.classList.toggle("side-panel-open", panelIsOpen);
}

sidePanelBackdrop?.addEventListener("click", () => {
    cart?.classList.remove("active");
    wishlist?.classList.remove("active");
    syncSidePanelScrollLock();
});

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
    const titleCount = document.querySelector(".cart-title-count");

    console.log("updateCartBadge()", cartItems);

    if (!cartBadge) {
        console.error(".cart-item-count element not found");
        return;
    }

    const totalItems = cartItems.reduce(
        (sum, item) => sum + Number(item.quantity || 1),
        0
    );

    if (titleCount) {
        titleCount.textContent = `(${totalItems})`;
    }

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

async function saveOrderToFirestore(cartItems) {

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

    cartContent.style.display = isEmpty ? "none" : "block";
    cartEmpty.style.display = isEmpty ? "flex" : "none";
    totalSection.style.display = isEmpty ? "none" : "flex";
    checkoutButton.style.display = isEmpty ? "none" : "block";
}

function createCartBox(cartItem) {
    const cartBox = document.createElement("div");
    const productParams = new URLSearchParams({
        id: String(cartItem.id)
    });

    if (cartItem.color) productParams.set("color", cartItem.color);
    if (cartItem.size) productParams.set("size", cartItem.size);

    const productHref = `product.html?${productParams.toString()}`;
    cartBox.classList.add("cart-box");

    cartBox.innerHTML = `
        <div class="cart-swipe-actions" aria-hidden="true">
            <button class="cart-swipe-action cart-move-wishlist" type="button" aria-label="Move item to wishlist">
                <img src="images/Icon Folder/Move To Favorites Icon_333.PNG" alt="">
                <span>Move</span>
            </button>
            <button class="cart-swipe-action cart-share" type="button" aria-label="Share item">
                <img src="images/Icon Folder/Share Icon V2_White.PNG" alt="">
                <span>Share</span>
            </button>
        </div>
        <div class="cart-box-main">
        <a href="${productHref}" class="cart-product-link" aria-label="View ${cartItem.title}">
            <img src="${cartItem.image}" class="cart-img">
        </a>

        <div class="cart-detail">
            <h2 class="cart-product-title">
                <a href="${productHref}" class="cart-title-link">${cartItem.title}</a>
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
                <button class="decrement" type="button" aria-label="Decrease quantity">
                    <img src="images/Icon Folder/Minus Icon_333.PNG" alt="">
                </button>
                <span class="number">${cartItem.quantity}</span>
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
    const decrement = cartBox.querySelector(".decrement");
    const increment = cartBox.querySelector(".increment");
    const quantityText = cartBox.querySelector(".number");
    const removeButton = cartBox.querySelector(".cart-remove");
    const moveToWishlistButton =
        cartBox.querySelector(".cart-move-wishlist");
    const shareButton = cartBox.querySelector(".cart-share");

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
        } catch (error) {
            if (error.name !== "AbortError") showToast("Unable to share this item", "warning");
        }
    });

    moveToWishlistButton.addEventListener("click", event => {
        event.stopPropagation();

        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];
        const isAlreadySaved = favorites.some(item =>
            String(item.id) === String(cartItem.id)
        );

        if (!isAlreadySaved) {
            favorites.push({
                id: cartItem.id,
                title: cartItem.title,
                price: cartItem.price,
                image: cartItem.image,
                color: cartItem.color || "",
                size: cartItem.size || ""
            });
        }

        cartItems = cartItems.filter(item =>
            !(
                item.id === cartItem.id &&
                item.color === cartItem.color &&
                item.size === cartItem.size
            )
        );

        localStorage.setItem("favorites", JSON.stringify(favorites));
        saveFavoritesToFirestore();
        saveCart(cartItems);
        renderWishlist();
        renderSavedCart();
        updateCartBadge();
        cart.classList.add("active");
        syncSidePanelScrollLock();
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
        updateCartBadge();
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
            updateCartBadge();
        }
    });

    removeButton.addEventListener("click", () => {
        setTimeout(() => {
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
        }, 120);
    });
}

function attachCartSwipe(cartBox) {
    const main = cartBox.querySelector(".cart-box-main");
    const actions = cartBox.querySelector(".cart-swipe-actions");
    let startX = 0, startY = 0, offset = 0, dragging = false, didSwipe = false;

    main.addEventListener("pointerdown", event => {
        if (event.target.closest("button, .cart-remove")) return;
        dragging = true;
        didSwipe = false;
        startX = event.clientX;
        startY = event.clientY;
        offset = cartBox.classList.contains("is-swiped") ? -actions.offsetWidth : 0;
        main.setPointerCapture(event.pointerId);
        main.classList.add("is-dragging");
    });
    main.addEventListener("pointermove", event => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
            dragging = false;
            main.classList.remove("is-dragging");
            main.style.transform = "";
            return;
        }
        if (Math.abs(dx) > 8) didSwipe = true;
        main.style.transform = `translateX(${Math.max(-actions.offsetWidth, Math.min(0, offset + dx))}px)`;
    });
    const finish = event => {
        if (!dragging) return;
        dragging = false;
        main.classList.remove("is-dragging");
        const shouldOpen = offset + event.clientX - startX < -actions.offsetWidth * .35;
        main.style.transform = "";

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
    main.addEventListener("pointerup", finish);
    main.addEventListener("pointercancel", finish);
    main.addEventListener("click", event => {
        if (!didSwipe) return;
        event.preventDefault();
        event.stopPropagation();
        didSwipe = false;
    }, true);
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
    productDescription.classList.add("is-collapsed");
    productDescriptionReadMore.textContent = "Read more";

    requestAnimationFrame(() => {
        productDescriptionReadMore.hidden =
            productDescription.scrollHeight <= productDescription.clientHeight + 1;
    });

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

productDescriptionReadMore.addEventListener("click", () => {
    const isCollapsed = productDescription.classList.toggle("is-collapsed");

    productDescriptionReadMore.textContent = isCollapsed
        ? "Read more"
        : "Read less";
});

selectedColor = product.colors.includes(requestedColor)
    ? requestedColor
    : product.colors[0];

selectedSize = product.sizes.includes(requestedSize)
    ? requestedSize
    : product.sizes[0];

const initialColorButton = [...document.querySelectorAll(".color-btn")]
    .find(button => button.textContent.trim() === selectedColor);

const initialSizeButton = [...document.querySelectorAll(".size-btn")]
    .find(button => button.textContent.trim() === selectedSize);

initialColorButton?.click();
initialSizeButton?.classList.add("active");

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
        showToast("This product is already in your cart⚠️", "warning");
        return;
    }

    cartItems.push(cartItem);

    saveCart(cartItems);

    renderSavedCart();

    updateCartBadge();
    showToast("Added to cart🛒", "success");

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
        syncSidePanelScrollLock();
    }

});

if (wishlistClose) {

    wishlistClose.addEventListener("click", () => {

        wishlist.classList.remove("active");
        syncSidePanelScrollLock();

    });

}

wishlistContinue.addEventListener("click", () => {
    wishlist.classList.remove("active");
    syncSidePanelScrollLock();
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
                src="${item.image}"
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
        const addTocartIcon =
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

        setTimeout(() => {

        favorites = favorites.filter(favorite => {

            return favorite.id !== item.id;

        });

    localStorage.setItem(
    "favorites",
    JSON.stringify(favorites)
);

saveFavoritesToFirestore();    

        renderWishlist();

        }, 120);

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

clearWishlistButton?.addEventListener("pointerenter", () => {
    clearWishlistButton.querySelector(".clear-wishlist-icon").src =
        "images/Icon Folder/Delete Icon_d9534f.PNG";
});

clearWishlistButton?.addEventListener("pointerleave", () => {
    clearWishlistButton.querySelector(".clear-wishlist-icon").src =
        "images/Icon Folder/Delete Icon_333.PNG";
});

clearWishlistButton?.addEventListener("pointerdown", () => {
    const icon = clearWishlistButton.querySelector(".clear-wishlist-icon");

    icon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";

    setTimeout(() => {
        if (!clearWishlistButton.matches(":hover")) {
            icon.src = "images/Icon Folder/Delete Icon_333.PNG";
        }
    }, 120);
});

clearWishlistButton?.addEventListener("click", () => {

    if (favorites.length === 0) {

        showToast(
            "Wishlist is already empty",
            "warning"
        );

        return;

    }

    confirmOverlay.classList.add("active");

});

confirmCancel.addEventListener("click", () => {

    confirmOverlay.classList.remove("active");

});

confirmOverlay.addEventListener("click", (e) => {

    if (e.target === confirmOverlay) {

        confirmOverlay.classList.remove("active");

    }

});

confirmClear.addEventListener("click", () => {

    clearWishlist();

    confirmOverlay.classList.remove("active");

    showToast(
        "Wishlist cleared",
        "success"
    );

});

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

        bottomFavoriteIcon?.classList.remove("heart-pop");
        void bottomFavoriteIcon?.offsetWidth;
        bottomFavoriteIcon?.classList.add("heart-pop");

        showToast("Added to wishlist❤️", "success");

    } else {

        favorites.splice(index, 1);
        showToast("Removed from wishlist💔", "warning");

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
    syncSidePanelScrollLock();

});

cartClose.addEventListener("click", () => {

    cart.classList.remove("active");
    syncSidePanelScrollLock();

});

continueShopping.addEventListener("click", () => {
    cart.classList.remove("active");
    syncSidePanelScrollLock();
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

checkoutButton.addEventListener("click", async () => {
    if (!auth.currentUser) {
        showToast("Please sign in before checking out⚠️.", "warning");
        return;
    }

    const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

    if (cartItems.length === 0) {
        showToast("Your cart is empty 🛒", "warning");
        return;
    }

    await saveOrderToFirestore(cartItems);

    showToast("Thank you for your order ❤️", "success");

    saveCart([]);
    renderSavedCart();
    updateCartBadge();
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
loadProductReviews();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadCartFromFirestore();
    }
    await initializeReviewForm(user);
    await loadProductReviews();
    renderSavedCart();
    updateTotalPrice(JSON.parse(localStorage.getItem("cart")) || []);
    updateCartBadge();
});
