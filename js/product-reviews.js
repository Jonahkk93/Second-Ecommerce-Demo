import {
    collection,
    getDocs,
    query,
    where
} from "./firestore-api.js";

const db = window.db;
const params = new URLSearchParams(window.location.search);
const productId = Number(params.get("id"));
const product = products.find(item => item.id === productId);

const backLink = document.querySelector(".product-reviews-back");
const pageTitle = document.querySelector(".product-reviews-page-title");
const productName = document.querySelector(".product-reviews-name");
const reviewList = document.querySelector(".review-list");
const productReviews = document.querySelector(".product-reviews");
const ratingScores = [...document.querySelectorAll(".rating-score")];
const reviewCounts = [...document.querySelectorAll(".review-count")];
const reviewSummaryStars = document.querySelector(".reviews-summary-stars");
const bottomFavoriteButton = document.querySelector(".product-bottom-favorite");
const bottomFavoriteIcon = document.querySelector(".product-bottom-favorite-icon");
const bottomCartButton = document.querySelector(".product-bottom-cart");
const quantityMinus = document.querySelector(".quantity-minus");
const quantityPlus = document.querySelector(".quantity-plus");
const quantityValue = document.querySelector(".quantity-value");
const toast = document.querySelector(".toast");
let quantity = 1;

if (product) {
    document.title = `${product.title} Reviews | MPWR`;
    backLink.href = `product.html?id=${encodeURIComponent(product.id)}`;
    pageTitle.textContent = "MPWR";
    productName.textContent = product.title;
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

function defaultSelectedOptions(item) {
    const groups = Array.isArray(item?.options) && item.options.length
        ? item.options
        : [
            item?.colors?.length ? { key: "color", values: item.colors } : null,
            item?.sizes?.length ? { key: "size", values: item.sizes } : null
        ].filter(Boolean);

    return groups.reduce((options, group) => {
        options[group.key] = group.values?.[0] || "";
        return options;
    }, {});
}

function showToast(message, type = "success") {
    if (!toast) return;

    clearTimeout(toast.timeout);
    toast.textContent = message;
    toast.className = "toast";
    toast.classList.add(type);
    void toast.offsetWidth;
    toast.classList.add("show");

    toast.timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function currentFavorites() {
    const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    return window.normalizeMPWRItems?.(favorites) || favorites;
}

function updateFavoriteIcon() {
    if (!product || !bottomFavoriteIcon) return;
    const isFavorite = currentFavorites().some(item => String(item.id) === String(product.id));
    bottomFavoriteIcon.src = isFavorite ? "images/Heart7.PNG" : "images/optimized/heart-outline.png";
}

function updateQuantity() {
    if (quantityValue) quantityValue.textContent = quantity;
}

function reviewDate(value) {
    const date = value?.toDate?.() || new Date(value || Date.now());
    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}

function reviewPurchasedOptions(review) {
    const options = review.purchasedOptions || review.selectedOptions || {
        color: review.color || "",
        size: review.size || "",
        length: review.length || ""
    };
    return ["color", "size", "length"]
        .filter(key => options[key])
        .map(key => options[key]);
}

function renderReviewList(reviews) {
    reviewList.replaceChildren();

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
    reviewSummaryStars.textContent =
        "★".repeat(Math.round(average)) + "☆".repeat(5 - Math.round(average));

    if (!reviews.length) {
        const empty = document.createElement("p");
        empty.className = "product-reviews-empty";
        empty.textContent = "No reviews yet.";
        reviewList.appendChild(empty);
    }

    reviews.forEach(review => {
        const card = document.createElement("article");
        card.className = "review-card";

        const header = document.createElement("div");
        header.className = "review-card-header";

        const customer = document.createElement("strong");
        customer.textContent = review.customerName || "MPWR customer";

        const verified = document.createElement("img");
        verified.className = "verified-purchase";
        verified.src = "images/Icon Folder/Verified Icon_E5A484.PNG";
        verified.alt = "Verified purchase";

        const stars = document.createElement("span");
        stars.className = "review-card-stars";
        stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
        stars.textContent =
            "★".repeat(Number(review.rating)) +
            "☆".repeat(5 - Number(review.rating));

        const date = document.createElement("time");
        date.className = "review-purchase-date";
        date.textContent = reviewDate(review.updatedAt || review.createdAt);

        const clientLine = document.createElement("div");
        clientLine.className = "review-client-name";
        clientLine.append(customer, verified, stars, date);

        const purchasedItem = document.createElement("span");
        purchasedItem.className = "review-purchased-item";
        const purchasedOptions = reviewPurchasedOptions(review);
        purchasedItem.textContent = [
            `Purchased: ${review.productTitle || product?.title || "Product"}`,
            ...purchasedOptions
        ].join(" • ");

        const reviewerDetails = document.createElement("div");
        reviewerDetails.className = "review-client-details";
        reviewerDetails.append(clientLine, purchasedItem);

        const body = document.createElement("p");
        body.textContent = review.text;

        header.append(reviewerDetails);
        card.append(header, body);

        if (review.attachment?.url) {
            const attachmentLink = document.createElement("a");
            attachmentLink.href = review.attachment.url;
            attachmentLink.target = "_blank";
            attachmentLink.rel = "noopener";

            if (review.attachment.type?.startsWith("image/")) {
                const attachmentImage = document.createElement("img");
                attachmentImage.className = "review-attachment-image";
                attachmentImage.src = review.attachment.url;
                attachmentImage.alt = review.attachment.name || "Review attachment";
                attachmentLink.appendChild(attachmentImage);
            } else {
                attachmentLink.className = "review-attachment-file";
                attachmentLink.textContent =
                    `View attachment: ${review.attachment.name || "File"}`;
            }

            card.appendChild(attachmentLink);
        }

        reviewList.appendChild(card);
    });

    productReviews.classList.remove("reviews-loading-state");
    productReviews.querySelector(".reviews-loading-placeholder")?.remove();
}

async function loadProductReviews() {
    if (!product) {
        renderReviewList([]);
        return;
    }

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

quantityMinus?.addEventListener("click", () => {
    if (quantity <= 1) return;
    quantity -= 1;
    updateQuantity();
});

quantityPlus?.addEventListener("click", () => {
    quantity += 1;
    updateQuantity();
});

bottomCartButton?.addEventListener("click", () => {
    if (!product) return;

    const selectedOptions = defaultSelectedOptions(product);
    const cartItem = {
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        selectedOptions,
        color: selectedOptions.color || "",
        size: selectedOptions.size || selectedOptions.length || "",
        quantity
    };
    const cartItems = JSON.parse(localStorage.getItem("cart") || "[]");

    if (cartItems.some(item => String(item.id) === String(cartItem.id) && sameCartSelection(item, cartItem))) {
        showToast("This product is already in your cart⚠️", "warning");
        return;
    }

    const normalizedCart = window.normalizeMPWRItems?.([...cartItems, cartItem]) || [...cartItems, cartItem];
    localStorage.setItem("cart", JSON.stringify(normalizedCart));
    showToast("Added to cart🛒", "success");
});

bottomFavoriteButton?.addEventListener("click", () => {
    if (!product) return;

    const favorites = currentFavorites();
    const index = favorites.findIndex(item => String(item.id) === String(product.id));

    if (index === -1) {
        favorites.push({
            id: String(product.id),
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

    const normalizedFavorites = window.normalizeMPWRItems?.(favorites) || favorites;
    localStorage.setItem("favorites", JSON.stringify(normalizedFavorites));
    updateFavoriteIcon();
});

updateQuantity();
updateFavoriteIcon();
loadProductReviews();
