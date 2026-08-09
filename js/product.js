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

const productPageHeader = document.querySelector(".product-page-header");
const updateProductHeaderMode = () => {
    productPageHeader?.classList.toggle("is-scrolled", window.scrollY > 64);
};

window.addEventListener("scroll", updateProductHeaderMode, { passive: true });
updateProductHeaderMode();

const productId = Number(params.get("id"));
const product = products.find(item => item.id === productId);

function getProductOptions(item) {
    if (Array.isArray(item?.options) && item.options.length) {
        return item.options.filter(group =>
            group?.key && Array.isArray(group.values) && group.values.length
        );
    }

    const legacyOptions = [];
    if (item?.colors?.length) {
        legacyOptions.push({ key: "color", label: "Color", values: item.colors });
    }
    if (item?.sizes?.length) {
        legacyOptions.push({
            key: "size",
            label: item.sizeLabel || "Size",
            values: item.sizes
        });
    }
    return legacyOptions;
}

const optionGroups = getProductOptions(product);
let selectedOptions = {};

function selectionKey(selections = selectedOptions) {
    return optionGroups.map(group => selections[group.key] || "").join("|");
}

function itemSelections(item) {
    if (item?.selectedOptions && Object.keys(item.selectedOptions).length) {
        return item.selectedOptions;
    }
    return { color: item?.color || "", size: item?.size || "" };
}

function sameCartSelection(first, second) {
    const normalized = item => Object.entries(itemSelections(item))
        .filter(([, value]) => value)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey));
    return JSON.stringify(normalized(first)) === JSON.stringify(normalized(second));
}

function appendSelectionParams(searchParams, item) {
    Object.entries(itemSelections(item)).forEach(([key, value]) => {
        if (value) searchParams.set(key, value);
    });
}

function selectionSummary(item) {
    return Object.values(itemSelections(item)).filter(Boolean).join(" • ");
}
const sliderTrack = document.querySelector(".product-slider-track");
const sliderContainer = document.querySelector(".product-image-container");
const galleryPrevious = document.querySelector(".gallery-arrow-prev");
const galleryNext = document.querySelector(".gallery-arrow-next");
const galleryStatus = document.querySelector(".gallery-status");

sliderContainer?.classList.toggle(
    "show-full-gallery-image",
    optionGroups.some(group => group.key === "length")
);

const thumbnailsContainer =
    document.querySelector(".product-thumbnails");

// =========================
// PRODUCT IMAGE SLIDER
// =========================

let currentSlide = 0;
let galleryImages = [];
let thumbnailLoadGeneration = 0;

function getSlideWidth() {
    return sliderContainer.getBoundingClientRect().width;
}

function updateMobileGalleryFrame() {
    if (!sliderContainer || !sliderTrack) return;

    if (!window.matchMedia("(max-width: 600px)").matches) {
        sliderContainer.style.removeProperty("--mobile-gallery-image");
        return;
    }

    const activeImage = sliderTrack.children[currentSlide]?.querySelector("img");
    if (!activeImage) return;
    const imageUrl = (activeImage.currentSrc || activeImage.src)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
    sliderContainer.style.setProperty(
        "--mobile-gallery-image",
        `url("${imageUrl}")`
    );
}

function updateSlider(animate = true) {
    updateMobileGalleryFrame();
    sliderTrack.style.transition = animate ? "transform .35s ease" : "none";
    sliderTrack.style.transform = `translateX(-${currentSlide * getSlideWidth()}px)`;

    document.querySelectorAll(".product-thumbnail").forEach((thumb, i) => {
        thumb.classList.toggle("active", i === currentSlide);
        thumb.setAttribute("aria-current", i === currentSlide ? "true" : "false");
    });

    const hasMultipleImages = galleryImages.length > 1;
    galleryPrevious.hidden = !hasMultipleImages;
    galleryNext.hidden = !hasMultipleImages;
    galleryPrevious.disabled = !hasMultipleImages;
    galleryNext.disabled = !hasMultipleImages;
    galleryStatus.textContent = hasMultipleImages
        ? `Image ${currentSlide + 1} of ${galleryImages.length}`
        : "Product image";
}

function syncOptionsToCurrentSlide() {
    const currentImage = galleryImages[currentSlide];
    if (!currentImage || !optionGroups?.length) return;

    let selectionChanged = false;

    optionGroups.forEach(group => {
        let matchingValue = "";

        if (group.key === "color") {
            matchingValue = group.values.find(value =>
                product.galleries?.[value]?.includes(currentImage)
            ) || "";
        }

        if (group.key === "size" || group.key === "length") {
            matchingValue = group.values.find(value =>
                product.sizeGalleries?.[value]?.includes(currentImage)
            ) || "";
        }

        if (!matchingValue || selectedOptions[group.key] === matchingValue) return;

        selectedOptions[group.key] = matchingValue;
        selectionChanged = true;

        const optionSection = dynamicOptions?.querySelector(
            `.product-option-group[data-option-key="${group.key}"]`
        );
        optionSection?.querySelectorAll(".product-option-btn").forEach(button => {
            button.classList.toggle("active", button.textContent === matchingValue);
        });
    });

    if (selectionChanged) updateVariationPrice();
}

function goToSlide(index) {
    if (galleryImages.length < 2) {
        currentSlide = 0;
    } else {
        currentSlide = (index + galleryImages.length) % galleryImages.length;
    }
    updateSlider(true);
    syncOptionsToCurrentSlide();
}

function renderProductGallery(images) {
    const thumbnailGeneration = ++thumbnailLoadGeneration;
    thumbnailsContainer.classList.add("thumbnails-loading-state");
    const sourceImages = Array.isArray(images) && images.length
        ? images
        : [product.image];
    const validImages = [...new Set(
        sourceImages
            .map(source => String(source || "").trim())
            .filter(Boolean)
    )];

    if (!validImages.length && product.image) {
        validImages.push(product.image);
    }

    galleryImages = [...validImages];
    sliderTrack.innerHTML = galleryImages.map((src, index) => `
        <div class="product-slide">
            <img src="${src}" alt="${product.title} variation ${index + 1}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async">
        </div>
    `).join("");

    thumbnailsContainer.replaceChildren();
    galleryImages.forEach((src, index) => {
        const thumbnail = document.createElement("img");
        thumbnail.src = src;
        thumbnail.alt = `${product.title} thumbnail ${index + 1}`;
        thumbnail.className = "product-thumbnail";
        thumbnail.loading = "lazy";
        thumbnail.decoding = "async";
        thumbnail.addEventListener("click", () => goToSlide(index));
        thumbnailsContainer.appendChild(thumbnail);
    });

    const thumbnailLoads = [...thumbnailsContainer.querySelectorAll("img")].map(thumbnail => {
        if (thumbnail.complete && thumbnail.naturalWidth > 0) return Promise.resolve();
        return new Promise(resolve => {
            thumbnail.addEventListener("load", resolve, { once:true });
            thumbnail.addEventListener("error", resolve, { once:true });
        });
    });
    Promise.all(thumbnailLoads).then(() => {
        if (thumbnailGeneration === thumbnailLoadGeneration) {
            thumbnailsContainer.classList.remove("thumbnails-loading-state");
        }
    });

    currentSlide = 0;
    updateSlider(false);
}

[galleryPrevious, galleryNext].filter(Boolean).forEach(control => {
    control.addEventListener("pointerdown", event => event.stopPropagation());
    control.addEventListener("touchstart", event => event.stopPropagation(), { passive:true });
});

galleryPrevious?.addEventListener("click", event => {
    event.stopPropagation();
    goToSlide(currentSlide - 1);
});
galleryNext?.addEventListener("click", event => {
    event.stopPropagation();
    goToSlide(currentSlide + 1);
});
sliderContainer?.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToSlide(currentSlide - 1);
    }
    if (event.key === "ArrowRight") {
        event.preventDefault();
        goToSlide(currentSlide + 1);
    }
});

function variationGallery(selections = selectedOptions) {
    const color = selections.color || "";
    const size = selections.size || selections.length || "";
    const combinedKey = selectionKey(selections);
    const variant = product.variants?.[combinedKey];
    const combinedGallery =
        variant?.images || variant?.gallery ||
        product.variantGalleries?.[combinedKey] ||
        product.variantGalleries?.[color]?.[size];
    const selectedGallery = combinedGallery ||
        product.sizeGalleries?.[size] ||
        product.galleries?.[color];
    const baseGallery = product.gallery || [product.image];

    if (!selectedGallery) return baseGallery;

    return [...new Set([...selectedGallery, ...baseGallery])];
}

function variationPrice(selections = selectedOptions) {
    const color = selections.color || "";
    const size = selections.size || selections.length || "";
    const combinedKey = selectionKey(selections);
    return product.variants?.[combinedKey]?.price ||
        product.variantPrices?.[combinedKey] ||
        product.variantPrices?.[color]?.[size] ||
        product.sizePrices?.[size] ||
        product.colorPrices?.[color] ||
        product.price;
}

function updateVariationPrice() {
    selectedPrice = variationPrice();
    productPrice.textContent = `UGX ${Number(selectedPrice).toLocaleString()}`;
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

let mouseDragStartX = 0;
let mouseDragDeltaX = 0;
let isMouseDragging = false;

sliderContainer.addEventListener("pointerdown", event => {
    if (
        event.pointerType !== "mouse" ||
        galleryImages.length < 2 ||
        event.target.closest(".gallery-arrow")
    ) return;

    isMouseDragging = true;
    mouseDragStartX = event.clientX;
    mouseDragDeltaX = 0;
    sliderTrack.style.transition = "none";
    sliderContainer.setPointerCapture(event.pointerId);
});

sliderContainer.addEventListener("pointermove", event => {
    if (!isMouseDragging || event.pointerType !== "mouse") return;

    mouseDragDeltaX = event.clientX - mouseDragStartX;
    const atEdge =
        (currentSlide === 0 && mouseDragDeltaX > 0) ||
        (currentSlide === galleryImages.length - 1 && mouseDragDeltaX < 0);
    const offset =
        -(currentSlide * getSlideWidth()) +
        (mouseDragDeltaX * (atEdge ? 0.28 : 1));

    sliderTrack.style.transform = `translate3d(${offset}px, 0, 0)`;
});

function finishMouseDrag(event) {
    if (!isMouseDragging) return;

    const threshold = Math.min(70, getSlideWidth() * 0.18);
    if (Math.abs(mouseDragDeltaX) >= threshold) {
        goToSlide(currentSlide + (mouseDragDeltaX < 0 ? 1 : -1));
    } else {
        updateSlider(true);
    }

    isMouseDragging = false;
    mouseDragDeltaX = 0;
    if (sliderContainer.hasPointerCapture(event.pointerId)) {
        sliderContainer.releasePointerCapture(event.pointerId);
    }
}

sliderContainer.addEventListener("pointerup", finishMouseDrag);
sliderContainer.addEventListener("pointercancel", finishMouseDrag);

window.addEventListener("resize", () => updateSlider(false));

const productTitle = document.querySelector(".product-page-title");

const productPrice = document.querySelector(".product-page-price");

const productDescription = document.querySelector(".product-page-description");

const productDescriptionReadMore = document.querySelector(
    ".product-description-read-more"
);

const dynamicOptions = document.querySelector(".product-options-dynamic");
const optionsPanel = document.querySelector(".product-options-panel");
const addTocartIcon = document.querySelector(".product-bottom-cart");
const quantityMinus = document.querySelector(".quantity-minus");

const quantityPlus = document.querySelector(".quantity-plus");

const quantityValue = document.querySelector(".quantity-value");

const cartIcon = document.querySelector("#cart-icon");
const cartBadge = document.querySelector(".cart-item-count");
console.log("cartBadge element:", cartBadge);

const wishlist = document.querySelector(".wishlist");
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
const productShareButton = document.querySelector(".product-bottom-share");
const productShareIcon = productShareButton?.querySelector(".product-bottom-share-icon");

if (productShareIcon) {
    let shareIconResetTimer;
    const resetShareIcon = () => {
        shareIconResetTimer = setTimeout(() => {
            productShareIcon.src = "images/Icon Folder/Share Icon V3_333.PNG";
        }, 220);
    };

    productShareButton.addEventListener("pointerdown", () => {
        clearTimeout(shareIconResetTimer);
        productShareIcon.src = "images/Icon Folder/Share Icon V3_Gray.PNG";
    });
    productShareButton.addEventListener("pointerup", resetShareIcon);
    productShareButton.addEventListener("pointercancel", resetShareIcon);
}

[cartClose, wishlistClose].filter(Boolean).forEach(closeIcon => {
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
const searchInput = document.querySelector("#search-input");
const searchClearButton = document.querySelector(".product-search-clear");
const productBoxes = document.querySelectorAll(".product-box");

searchInput?.addEventListener("focus", () => {
    window.location.href = "search.html";
});


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
const moveWishlistConfirmOverlay = document.querySelector(".move-wishlist-confirm-overlay");
const moveWishlistCancel = document.querySelector(".move-wishlist-cancel");
const moveWishlistConfirm = document.querySelector(".move-wishlist-confirm");
let pendingMoveToWishlist = null;
const deleteItemConfirmOverlay = document.querySelector(".delete-item-confirm-overlay");
const deleteItemConfirmMessage = document.querySelector(".delete-item-confirm-message");
const deleteItemCancel = document.querySelector(".delete-item-cancel");
const deleteItemConfirm = document.querySelector(".delete-item-confirm");
let pendingItemDeletion = null;
const sidePanelBackdrop = document.querySelector(".side-panel-backdrop");
const reviewCompose = document.querySelector(".review-compose");
const reviewForm = document.querySelector("#review-form");
const reviewList = document.querySelector(".review-list");
const reviewsReadMore = document.querySelector(".reviews-read-more");
const relatedProductsGrid = document.querySelector(".related-products-grid");
const relatedProducts = document.querySelector(".related-products");
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
const productInfo = document.querySelector(".product-info");
const productBenefits = document.querySelector(".product-benefits");
const productReviewsInner = document.querySelector(".product-reviews-inner");

let selectedReviewRating = 0;
let currentReviewExists = false;
let reviewsExpanded = false;

function renderRelatedProducts() {
    if (!product || !relatedProductsGrid) return;

    const currentIndex = products.findIndex(item => item.id === product.id);
    const recommendations = [];

    for (let offset = 1; recommendations.length < Math.min(3, products.length - 1); offset++) {
        const candidate = products[(currentIndex + offset) % products.length];
        if (candidate.id !== product.id) recommendations.push(candidate);
    }

    relatedProductsGrid.innerHTML = recommendations.map(item => `
        <a class="related-product-card" href="product.html?id=${encodeURIComponent(item.id)}">
            <span class="related-product-image"><img src="${item.image}" alt="${item.title}"></span>
            <span class="related-product-title">${item.title}</span>
            <span class="related-product-price">UGX ${Number(item.price).toLocaleString()}</span>
        </a>
    `).join("");
    relatedProducts.classList.remove("related-products-loading-state");
    relatedProducts.querySelector(".related-products-loading-placeholder")?.remove();
}

renderRelatedProducts();

function positionReviews() {
    const isTabletOrLaptop = window.matchMedia("(min-width: 601px)").matches;

    if (isTabletOrLaptop) {
        if (productBenefits.parentElement !== productGallery) {
            productGallery.appendChild(productBenefits);
        }
        if (relatedProducts.parentElement !== productGallery) {
            productGallery.appendChild(relatedProducts);
        }
        if (productReviews.parentElement !== productInfo) {
            productInfo.appendChild(productReviews);
        }
        return;
    }

    if (productBenefits.parentElement !== productInfo) {
        productInfo.appendChild(productBenefits);
    }
    if (productReviews.parentElement !== productLayout) {
        productLayout.appendChild(productReviews);
    }
    if (relatedProducts.parentElement !== productReviewsInner) {
        productReviewsInner.appendChild(relatedProducts);
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
    reviewsExpanded = false;
    reviewsReadMore.hidden = reviews.length <= 2;
    reviewsReadMore.textContent = "Read more";

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

    reviews.forEach((review, index) => {
        const card = document.createElement("article");
        card.className = "review-card";
        card.hidden = index >= 2;

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
                reviewCompose.hidden = false;
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
    productReviews.classList.remove("reviews-loading-state");
    productReviews.querySelector(".reviews-loading-placeholder")?.remove();
}

reviewsReadMore?.addEventListener("click", () => {
    reviewsExpanded = !reviewsExpanded;
    [...reviewList.children].forEach((card, index) => {
        card.hidden = !reviewsExpanded && index >= 2;
    });
    reviewsReadMore.textContent = reviewsExpanded ? "Show less" : "Read more";
});

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
        renderReviewList([]);
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
    reviewCompose.hidden = true;
    reviewForm.hidden = true;
    setReviewRating(0);
    reviewText.value = "";
    currentReviewExists = false;

    if (!user) {
        return;
    }

    try {
        const eligible = await customerPurchasedProduct(user);
        if (!eligible) {
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
            reviewForm.hidden = true;
            reviewCompose.hidden = true;
        } else {
            reviewSubmit.textContent = "Post review";
            reviewCompose.hidden = false;
        }

        reviewForm.hidden = currentReviewExists;
    } catch (error) {
        console.error("Unable to verify purchase:", error);
        reviewCompose.hidden = true;
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
        showToast("Review published.", "success");
        await loadProductReviews();
        if (currentReviewExists) {
            reviewForm.hidden = true;
            reviewCompose.hidden = true;
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
    const deletingWholeCart = source === "cart-all";
    deleteItemConfirmOverlay.querySelector("h2").textContent = deletingWholeCart ? "Delete All Items" : "Delete Item";
    deleteItemConfirmMessage.textContent = deletingWholeCart ? "Are you sure you want to delete all items from your cart?" : `Are you sure you want to delete this item from your ${source}?`;
    deleteItemConfirm.textContent = deletingWholeCart ? "Delete All" : "Delete Item";
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
let selectedPrice = product?.price || "0";

let favorites = JSON.parse(
    localStorage.getItem("favorites")
) || [];
favorites = window.normalizeMPWRItems?.(favorites) || favorites;
localStorage.setItem("favorites", JSON.stringify(favorites));

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
    cartItems = window.normalizeMPWRItems?.(cartItems) || cartItems;
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

    favorites = window.normalizeMPWRItems?.(favorites) || favorites;
    localStorage.setItem("favorites", JSON.stringify(favorites));

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

            const cartItems = window.normalizeMPWRItems?.(data.items || []) || data.items || [];

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

    appendSelectionParams(productParams, cartItem);

    const productHref = `product.html?${productParams.toString()}`;
    cartBox.classList.add("cart-box");

    cartBox.innerHTML = `
        <div class="cart-swipe-actions" aria-hidden="true">
            <button class="cart-swipe-action cart-move-wishlist" type="button" aria-label="Move item to wishlist">
                <img src="images/Icon Folder/Move To Favorites Outline Icon_White.PNG" alt="">
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
            <img src="${cartItem.image}" class="cart-img" alt="${cartItem.title}" loading="lazy" decoding="async">
        </a>

        <div class="cart-detail">
            <h2 class="cart-product-title">
                <a href="${productHref}" class="cart-title-link">${cartItem.title}</a>
            </h2>

<div class="cart-variants">
    ${selectionSummary(cartItem)}
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
    const swipeDeleteButton = cartBox.querySelector(".cart-delete");

    const confirmCartItemDeletion = () => {
        requestItemDeletion("cart", () => {
            let savedCartItems = JSON.parse(localStorage.getItem("cart")) || [];

            savedCartItems = savedCartItems.filter(item => !(
                item.id === cartItem.id && sameCartSelection(item, cartItem)
            ));

            saveCart(savedCartItems);
            renderSavedCart();
            updateCartBadge();
            showToast("Deleted", "success");
        });
    };

    attachCartSwipe(cartBox);

    [
        [decrement, "images/Icon Folder/Minus Icon_E5A484.PNG", "images/Icon Folder/Minus Icon_333.PNG"],
        [increment, "images/Icon Folder/Plus Icon_E5A484.PNG", "images/Icon Folder/Plus Icon_333.PNG"]
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
        cartBox.classList.remove("is-swiped");
        cartBox.querySelector(".cart-swipe-actions")
            ?.setAttribute("aria-hidden", "true");
        confirmCartItemDeletion();
    });

    moveToWishlistButton.addEventListener("click", event => {
        event.stopPropagation();

        pendingMoveToWishlist = () => {
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
                    selectedOptions: { ...itemSelections(cartItem) },
                    color: cartItem.color || "",
                    size: cartItem.size || ""
                });
            }

            cartItems = cartItems.filter(item =>
                !(
                    item.id === cartItem.id && sameCartSelection(item, cartItem)
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

    increment.addEventListener("click", () => {
        let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

        const item = cartItems.find(i =>
            i.id === cartItem.id && sameCartSelection(i, cartItem)
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
            i.id === cartItem.id && sameCartSelection(i, cartItem)
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

    removeButton.addEventListener("click", confirmCartItemDeletion);
}

function attachCartSwipe(cartBox) {
    const main = cartBox.querySelector(".cart-box-main");
    const actions = cartBox.querySelector(".cart-swipe-actions");
    const deleteAction = cartBox.querySelector(".cart-delete");
    let startX = 0, startY = 0, offset = 0, dragging = false, didSwipe = false;

    main.addEventListener("pointerdown", event => {
        if (event.target.closest("button, .cart-remove")) return;
        dragging = true;
        didSwipe = false;
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
        if (Math.abs(dx) > 8) didSwipe = true;
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
        const shouldOpen = offset + event.clientX - startX < -actions.offsetWidth * .35;
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
        : "images/optimized/heart-outline.png";

    bottomFavoriteIcon?.setAttribute("src", heartImage);
}

if (product) {
    renderProductGallery(product.gallery || [product.image]);
    optionsPanel.hidden = optionGroups.length === 0;

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

    dynamicOptions.replaceChildren();
    const largestOptionCount = Math.max(0, ...optionGroups.map(group => group.values.length));
    const hasCompactOptionSet = largestOptionCount > 0 && largestOptionCount <= 4;
    optionsPanel.classList.toggle("has-compact-options", hasCompactOptionSet);

    optionGroups.forEach((group, index) => {
        const requestedValue = params.get(group.key);
        selectedOptions[group.key] = group.values.includes(requestedValue)
            ? requestedValue
            : group.values[0];

        if (index > 0) {
            const divider = document.createElement("div");
            divider.className = "section-divider product-option-divider";
            dynamicOptions.appendChild(divider);
        }

        const section = document.createElement("section");
        section.className = "product-option-group";
        section.dataset.optionKey = group.key;
        section.innerHTML = `<h3>${group.label}</h3><div class="product-option-values"></div>`;
        const values = section.querySelector(".product-option-values");
        if (group.values.length === 1) {
            values.classList.add("has-one-option");
        }
        if (group.values.length <= 4) {
            values.classList.add("has-few-options");
            values.style.setProperty("--option-count", group.values.length);
        }
        if (group.values.length >= 4) {
            values.classList.add("has-four-columns");
        }

        group.values.forEach(value => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "product-option-btn";
            button.textContent = value;
            button.classList.toggle("has-long-label", String(value).length >= 8);
            button.classList.toggle("active", value === selectedOptions[group.key]);
            button.addEventListener("click", () => {
                values.querySelectorAll(".product-option-btn").forEach(item =>
                    item.classList.remove("active")
                );
                button.classList.add("active");
                selectedOptions[group.key] = value;
                renderProductGallery(variationGallery());
                updateVariationPrice();
            });
            values.appendChild(button);
        });

        dynamicOptions.appendChild(section);
    });

    optionsPanel.classList.add("options-ready");
    optionsPanel.removeAttribute("aria-busy");
    renderProductGallery(variationGallery());
    updateVariationPrice();
}

document.documentElement.dataset.siteContentReady = "true";
window.MPWRLoading?.ready();

productDescriptionReadMore.addEventListener("click", () => {
    const isCollapsed = productDescription.classList.toggle("is-collapsed");

    productDescriptionReadMore.textContent = isCollapsed
        ? "Read more"
        : "Read less";
});

addTocartIcon.addEventListener("click", () => {

    const cartItem = {

        id: product.id,
        title: product.title,
        price: selectedPrice,
        image: galleryImages[0] || product.image,
        selectedOptions: { ...selectedOptions },
        color: selectedOptions.color || "",
        size: selectedOptions.size || selectedOptions.length || "",
        quantity: quantity
    };

    let cartItems = JSON.parse(localStorage.getItem("cart")) || [];

    const existingItem = cartItems.find(item => {
        return item.id === cartItem.id && sameCartSelection(item, cartItem);
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

    appendSelectionParams(productParams, item);

    const productHref = `product.html?${productParams.toString()}`;

   wishlistBox.classList.add("wishlist-item");

    wishlistBox.innerHTML = `

        <a href="${productHref}" class="wishlist-product-link" aria-label="View ${item.title}">
            <img
                src="${window.normalizeMPWRImagePath?.(item.image, item.id) || item.image}"
                class="wishlist-img"
                alt="${item.title}"
                loading="lazy"
                decoding="async"
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
        requestItemDeletion("wishlist", () => {
            favorites = favorites.filter(favorite => {
                return favorite.id !== item.id;
            });

            localStorage.setItem(
                "favorites",
                JSON.stringify(favorites)
            );

            saveFavoritesToFirestore();

            updateFavoriteIcon();

            renderWishlist();

            showToast("Deleted", "success");
        });

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

productShareButton?.addEventListener("click", async () => {
    const shareData = {
        title: product.title,
        text: `Check out ${product.title}`,
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareData.url);
            showToast("Product link copied", "success");
        }
    } catch {
        // Sharing failures are intentionally silent.
    }
});
   

cartIcon.addEventListener("click", () => {

    cart.classList.add("active");
    syncSidePanelScrollLock();

});

const cartMenuToggle = document.querySelector(".cart-menu-toggle");
const cartActionsMenu = document.querySelector(".cart-actions-menu");
const cartMenuIcon = cartMenuToggle.querySelector("img");
let cartMenuIconResetTimer;

function resetCartMenuIcon() {
    cartMenuIconResetTimer = setTimeout(() => {
        cartMenuIcon.src = "images/Icon Folder/3 Dots Icon_Black.PNG";
    }, 220);
}

cartMenuToggle.addEventListener("pointerdown", () => {
    clearTimeout(cartMenuIconResetTimer);
    cartMenuIcon.src = "images/Icon Folder/3 Dots Icon_Light Gray.PNG";
});
cartMenuToggle.addEventListener("pointerup", resetCartMenuIcon);
cartMenuToggle.addEventListener("pointercancel", resetCartMenuIcon);

function closeCartActionsMenu() {
    cartActionsMenu.hidden = true;
    cartMenuToggle.setAttribute("aria-expanded", "false");
}

cartMenuToggle.addEventListener("click", event => {
    event.stopPropagation();
    const willOpen = cartActionsMenu.hidden;
    cartActionsMenu.hidden = !willOpen;
    cartMenuToggle.setAttribute("aria-expanded", String(willOpen));
});

document.querySelector(".cart-delete-all").addEventListener("click", () => {
    closeCartActionsMenu();
    requestItemDeletion("cart-all", () => {
        saveCart([]);
        renderSavedCart();
        updateCartBadge();
        showToast("Cart cleared", "success");
    });
});

document.querySelector(".cart-share-all").addEventListener("click", async () => {
    const items = JSON.parse(localStorage.getItem("cart")) || [];
    if (!items.length) { closeCartActionsMenu(); showToast("Your cart is empty 🛒", "warning"); return; }
    const text = items.map(item => `${item.quantity || 1} × ${item.title}`).join("\n");
    try {
        if (navigator.share) await navigator.share({ title: "My MPWR cart", text });
        else { await navigator.clipboard.writeText(text); showToast("Cart copied", "success"); }
    } catch {
        // Sharing failures are intentionally silent.
    }
    closeCartActionsMenu();
});

document.addEventListener("click", event => { if (!event.target.closest(".cart-header-actions")) closeCartActionsMenu(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !cartActionsMenu.hidden) closeCartActionsMenu(); });

cartClose.addEventListener("click", () => {

    closeCartActionsMenu();
    cart.classList.remove("active");
    syncSidePanelScrollLock();

});

continueShopping.addEventListener("click", () => {
    cart.classList.remove("active");
    syncSidePanelScrollLock();
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

function openCheckoutSigninModal() {
    const accountOverlay = document.querySelector(".account-overlay");
    const signinView = document.querySelector(".signin-view");
    const registerView = document.querySelector(".register-view");

    cart.classList.remove("active");
    registerView?.classList.remove("active");
    signinView?.classList.remove("hide");
    accountOverlay?.classList.add("active");
    accountOverlay?.setAttribute("aria-hidden", "false");
    syncSidePanelScrollLock();
    document.body.style.overflow = "hidden";
    accountOverlay?.querySelector(".account-modal")?.scrollTo(0, 0);

    requestAnimationFrame(() => {
        document.getElementById("signin-email")?.focus({ preventScroll: true });
    });
}

function closeCheckoutSigninModal() {
    const accountOverlay = document.querySelector(".account-overlay");
    accountOverlay?.classList.remove("active");
    accountOverlay?.setAttribute("aria-hidden", "true");
    document.querySelector(".register-view")?.classList.remove("active");
    document.querySelector(".signin-view")?.classList.remove("hide");
    document.body.style.overflow = "";
}

document.querySelector(".account-close")?.addEventListener("click", closeCheckoutSigninModal);
document.querySelector(".account-overlay")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeCheckoutSigninModal();
});
document.querySelector(".create-account-btn")?.addEventListener("click", () => {
    document.querySelector(".signin-view")?.classList.add("hide");
    document.querySelector(".register-view")?.classList.add("active");
    document.querySelector(".account-modal")?.scrollTo(0, 0);
});
document.querySelector(".back-to-signin-btn")?.addEventListener("click", openCheckoutSigninModal);

checkoutButton.addEventListener("click", () => {
    if (!auth.currentUser) {
        showToast("Please sign in before checking out⚠️.", "warning");
        openCheckoutSigninModal();
        return;
    }

    const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

    if (cartItems.length === 0) {
        showToast("Your cart is empty 🛒", "warning");
        return;
    }

    window.location.href = "checkout.html";
});

function syncProductSearchClearButton() {
    searchClearButton.hidden = !searchInput.value;
}

searchInput.addEventListener("input", syncProductSearchClearButton);

searchClearButton.addEventListener("pointerdown", () => {
    searchClearButton.querySelector("img").src = "images/Icon Folder/Close Icon_333.PNG";
});

const resetProductSearchClearIcon = () => {
    searchClearButton.querySelector("img").src = "images/Icon Folder/Close Icon_Gray.PNG";
};

searchClearButton.addEventListener("pointerup", resetProductSearchClearIcon);
searchClearButton.addEventListener("pointercancel", resetProductSearchClearIcon);
searchClearButton.addEventListener("pointerleave", resetProductSearchClearIcon);
searchClearButton.addEventListener("click", () => {
    searchInput.value = "";
    syncProductSearchClearButton();
    searchInput.focus();
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
});

syncProductSearchClearButton();

searchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const query = searchInput.value.trim();

    if (query) {
        sessionStorage.setItem("mpwrProductSearchReturnUrl", window.location.href);
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

/* Synchronize product-page drawers and badges with changes on other pages. */
window.addEventListener("storage", event => {
    if (event.storageArea !== localStorage) return;
    if (event.key === "cart") {
        const latestCart = window.normalizeMPWRItems?.(JSON.parse(event.newValue || "[]")) || JSON.parse(event.newValue || "[]");
        renderSavedCart();
        updateTotalPrice(latestCart);
        updateCartBadge();
    }
    if (event.key === "favorites") {
        favorites = JSON.parse(event.newValue || "[]");
        favorites = window.normalizeMPWRItems?.(favorites) || favorites;
        renderWishlist();
        updateFavoriteIcon();
    }
});
