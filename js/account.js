import {
    onAuthStateChanged,
    signOut
} from "./auth-api.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where
} from "./firestore-api.js";
import { deleteImage, uploadImage } from "./media-api.js";

const auth = window.auth;
const db = window.db;
const dashboard = document.querySelector(".account-dashboard");
const profileOverview = document.querySelector(".account-profile-overview");
const loading = document.querySelector(".account-loading");
const signoutButton = document.querySelector(".account-signout");
const reviewOverlay = document.querySelector(".account-review-overlay");
const reviewForm = document.querySelector("#account-review-form");
const reviewComment = document.querySelector("#account-review-comment");
const reviewFile = document.querySelector("#account-review-file");
const reviewImageSelection = document.querySelector(".account-review-image-selection");
const reviewProductName = document.querySelector(".account-review-product");
const reviewProductImage = document.querySelector(".account-review-product-image");
const reviewProductOptions = document.querySelector(".account-review-product-options");
const reviewError = document.querySelector(".account-review-error");
const reviewSubmit = document.querySelector(".account-review-submit");
const reviewStars = [...document.querySelectorAll(".account-review-stars button")];

let currentReviewItem = null;
let currentReviewRating = 0;
let accountReviewPreviewUrls = [];
let accountReviewSelectedFiles = [];
const REVIEW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function initialsPicture(firstName, lastName, email = "") {
    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}` || email[0] || "M";
    const safeInitials = initials.toUpperCase().replace(/[^A-Z0-9]/g, "") || "M";
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#E5A484"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="82" font-weight="700" fill="white">${safeInitials}</text></svg>`)}`;
}

async function loadProfileOverview(user) {
    let data = {};
    try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) data = snapshot.data();
    } catch (error) {
        console.warn("Profile details could not be loaded:", error);
    }

    const displayParts = String(user.displayName || "").trim().split(/\s+/).filter(Boolean);
    const firstName = data.firstName || displayParts[0] || "";
    const lastName = data.lastName || displayParts.slice(1).join(" ") || "";
    const fullName = `${firstName} ${lastName}`.trim() || user.displayName || "MPWR Customer";
    const email = user.email || data.email || "—";
    const photo = data.profileImage || user.photoURL || initialsPicture(firstName, lastName, email);

    document.querySelector("#account-profile-picture").src = photo;
    document.querySelector("#account-profile-name").textContent = fullName;
}

function productLink(item) {
    const params = new URLSearchParams({ id: item.id });
    if (item.color) params.set("color", item.color);
    if (item.size) params.set("size", item.size);
    return `product.html?${params.toString()}`;
}

function orderDate(order) {
    const date = order.createdAt?.toDate?.();
    return date
        ? date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
        })
        : "";
}

function createItemCard(item, order, reviewAction = false) {
    const card = document.createElement("article");
    card.className = "account-item-card";

    const imageLink = document.createElement("a");
    imageLink.href = productLink(item);
    imageLink.className = "account-item-image";

    const image = document.createElement("img");
    image.src = window.normalizeMPWRImagePath?.(item.image, item.id) || item.image || "";
    image.alt = item.title || "Purchased product";
    imageLink.appendChild(image);

    const details = document.createElement("div");
    details.className = "account-item-details";

    const meta = document.createElement("p");
    meta.className = "account-item-meta";
    meta.textContent = reviewAction
        ? "Verified purchase"
        : `${order.status || "Pending"}${orderDate(order) ? ` • ${orderDate(order)}` : ""}`;

    const title = document.createElement("a");
    title.href = productLink(item);
    title.className = "account-item-title";
    title.textContent = item.title || "Product";

    const options = document.createElement("p");
    options.className = "account-item-options";
    options.textContent = [item.color, item.size, `Qty ${item.quantity || 1}`]
        .filter(Boolean)
        .join(" • ");

    const action = document.createElement(reviewAction ? "button" : "a");
    if (!reviewAction) action.href = productLink(item);
    action.className = "account-item-action";
    action.textContent = reviewAction ? "Review item" : "View item";
    if (reviewAction) {
        action.type = "button";
        action.addEventListener("click", () => openReviewModal(item));
    }

    details.append(meta, title, options, action);
    card.append(imageLink, details);
    return card;
}

function setAccountReviewRating(rating) {
    currentReviewRating = rating;
    reviewStars.forEach(star => {
        const selected = Number(star.dataset.rating) <= rating;
        star.classList.toggle("selected", selected);
        star.setAttribute("aria-pressed", String(selected));
    });
}

function openReviewModal(item) {
    currentReviewItem = item;
    setAccountReviewRating(0);
    reviewComment.value = "";
    syncAccountReviewFiles([]);
    reviewError.textContent = "";
    reviewProductName.textContent = item.title || "Purchased product";
    reviewProductImage.src = window.normalizeMPWRImagePath?.(item.image, item.id) || item.image || "images/MPWR Logo.PNG";
    reviewProductImage.alt = item.title || "Purchased product";
    reviewProductOptions.replaceChildren();
    [
        item.color ? `Color: ${item.color}` : "",
        item.size ? `Length/Size: ${item.size}` : "",
        `Quantity: ${item.quantity || 1}`
    ].filter(Boolean).forEach(value => {
        const detail = document.createElement("span");
        detail.textContent = value;
        reviewProductOptions.appendChild(detail);
    });
    reviewOverlay.classList.add("active");
    reviewOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("review-modal-open");
}

function closeReviewModal() {
    reviewOverlay.classList.remove("active");
    reviewOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("review-modal-open");
}

reviewStars.forEach(star => {
    star.addEventListener("click", () =>
        setAccountReviewRating(Number(star.dataset.rating))
    );
});

function setAccountReviewImagePreview(files = []) {
    accountReviewPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    accountReviewPreviewUrls = [];
    reviewImageSelection.replaceChildren();
    files.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "account-review-image-preview-item";
        const image = document.createElement("img");
        image.className = "account-review-image-preview";
        const imageUrl = URL.createObjectURL(file);
        accountReviewPreviewUrls.push(imageUrl);
        image.src = imageUrl;
        image.alt = `Review photo ${index + 1}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "account-review-image-remove";
        remove.setAttribute("aria-label", `Remove ${file.name}`);
        const removeIcon = document.createElement("img");
        removeIcon.src = "images/Icon Folder/Close Icon_333.PNG";
        removeIcon.alt = "";
        remove.appendChild(removeIcon);
        remove.addEventListener("click", () => {
            syncAccountReviewFiles(files.filter((_selectedFile, fileIndex) => fileIndex !== index));
        });
        item.append(image, remove);
        reviewImageSelection.appendChild(item);
    });
    reviewImageSelection.hidden = !files.length;
}

function syncAccountReviewFiles(files) {
    accountReviewSelectedFiles = [...files];
    const transfer = new DataTransfer();
    accountReviewSelectedFiles.forEach(file => transfer.items.add(file));
    reviewFile.files = transfer.files;
    const addButton = document.querySelector(".account-review-file-button");
    const limitReached = accountReviewSelectedFiles.length >= 5;
    reviewFile.disabled = limitReached;
    addButton?.classList.toggle("is-disabled", limitReached);
    addButton?.setAttribute("aria-disabled", String(limitReached));
    setAccountReviewImagePreview(accountReviewSelectedFiles);
}

reviewFile.addEventListener("change", () => {
    const additions = [...reviewFile.files];
    const selectedById = new Map(accountReviewSelectedFiles.map(file => [`${file.name}:${file.size}:${file.lastModified}`, file]));
    additions.forEach(file => selectedById.set(`${file.name}:${file.size}:${file.lastModified}`, file));
    const files = [...selectedById.values()];
    if (files.length > 5) {
        syncAccountReviewFiles(accountReviewSelectedFiles);
        reviewError.textContent = "You can add up to 5 review photos.";
        return;
    }
    if (additions.some(file => !REVIEW_IMAGE_TYPES.has(file.type))) {
        syncAccountReviewFiles(accountReviewSelectedFiles);
        reviewError.textContent = "Use JPEG, PNG, WebP, or GIF images.";
        return;
    }
    if (additions.some(file => file.size > 5 * 1024 * 1024)) {
        syncAccountReviewFiles(accountReviewSelectedFiles);
        reviewError.textContent = "Each review photo must be smaller than 5 MB.";
        return;
    }
    reviewError.textContent = "";
    syncAccountReviewFiles(files);
});

reviewOverlay.addEventListener("click", event => {
    if (event.target === reviewOverlay) closeReviewModal();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && reviewOverlay.classList.contains("active")) closeReviewModal();
});

reviewForm.addEventListener("submit", async event => {
    event.preventDefault();
    const user = auth.currentUser;
    const comment = reviewComment.value.trim();
    const files = [...reviewFile.files];

    reviewError.textContent = "";
    if (!user || !currentReviewItem || !currentReviewRating || !comment) {
        reviewError.textContent = "Choose a star rating and write your review.";
        return;
    }
    if (files.length > 5) {
        reviewError.textContent = "You can add up to 5 review photos.";
        return;
    }
    if (files.some(file => file.size > 5 * 1024 * 1024)) {
        reviewError.textContent = "Each review photo must be smaller than 5 MB.";
        return;
    }
    if (files.some(file => !REVIEW_IMAGE_TYPES.has(file.type))) {
        reviewError.textContent = "Use JPEG, PNG, WebP, or GIF images.";
        return;
    }

    reviewSubmit.disabled = true;
    reviewSubmit.textContent = files.length ? "Uploading photos…" : "Posting…";
    const uploadedImages = [];

    try {
        for (const file of files) {
            uploadedImages.push({ file, upload: await uploadImage(file, "review") });
        }
        const reviewRef = doc(
            db,
            "reviews",
            `${user.uid}_${currentReviewItem.id}`
        );
        const productId = currentReviewItem.id;
        const purchasedOptions = currentReviewItem.selectedOptions && Object.keys(currentReviewItem.selectedOptions).length
            ? currentReviewItem.selectedOptions
            : {
                ...(currentReviewItem.color ? { color: currentReviewItem.color } : {}),
                ...(currentReviewItem.size ? { size: currentReviewItem.size } : {})
            };

        await setDoc(reviewRef, {
            productId: String(currentReviewItem.id),
            productTitle: currentReviewItem.title || "Purchased product",
            purchasedOptions,
            userId: user.uid,
            customerName: user.displayName || user.email?.split("@")[0] || "MPWR customer",
            rating: currentReviewRating,
            text: comment,
            ...(uploadedImages.length ? {
                attachment: {
                    items: uploadedImages.map(({ file, upload }) => ({
                        url: upload.url,
                        key: upload.key,
                        name: file.name,
                        type: upload.contentType
                    }))
                }
            } : {}),
            verifiedPurchase: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        closeReviewModal();
        reviewSubmit.textContent = "Posted";

        // Refresh the account sections without making the customer wait
        // for every order and review query to finish before the modal closes.
        loadAccount(user).catch(error => {
            console.warn("Account sections could not refresh:", error);
        });

    } catch (error) {
        await Promise.all(uploadedImages.map(({ upload }) =>
            deleteImage(upload.key).catch(cleanupError =>
                console.warn("Unused review photo could not be removed:", cleanupError)
            )
        ));
        console.error("Unable to publish review:", error);
        reviewError.textContent = error?.message || "Your review could not be posted.";
    } finally {
        reviewSubmit.disabled = false;
        reviewSubmit.textContent = "Post review";
    }
});

function emptyState(message) {
    const empty = document.createElement("div");
    empty.className = "account-empty";
    empty.textContent = message;
    return empty;
}

function renderCategory(name, items, emptyMessage) {
    const container = document.querySelector(`[data-items="${name}"]`);
    container.replaceChildren();
    items.forEach(entry => {
        container.appendChild(
            createItemCard(entry.item, entry.order, name === "review")
        );
    });
    if (!items.length) container.appendChild(emptyState(emptyMessage));
    document.querySelector(`[data-count="${name}"]`).textContent = items.length;
}

async function loadAccount(user) {
    const ordersSnapshot = await getDocs(
        query(collection(db, "orders"), where("userId", "==", user.uid))
    );

    let reviewedProducts = new Set();

    try {
        const reviewsSnapshot = await getDocs(
            query(collection(db, "reviews"), where("userId", "==", user.uid))
        );
        reviewedProducts = new Set(
            reviewsSnapshot.docs.map(reviewDoc =>
                String(reviewDoc.data().productId)
            )
        );
    } catch (error) {
        console.warn("Reviews could not be checked:", error);
    }

    const orders = ordersSnapshot.docs
        .map(orderDoc => ({ id: orderDoc.id, ...orderDoc.data() }))
        .sort((a, b) =>
            (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
    const shipped = [];
    const delivered = [];
    const pending = [];
    const returns = [];
    const review = [];
    const reviewed = [];
    const reviewProductsAdded = new Set();
    const reviewedProductsAdded = new Set();

    orders.forEach(order => {
        (order.items || []).forEach(item => {
            const entry = { item, order };
            if (order.status === "Shipped") shipped.push(entry);
            if (order.status === "Delivered") delivered.push(entry);
            if (["Pending", "Processing"].includes(order.status)) pending.push(entry);
            if (["Cancelled", "Returned", "Refunded"].includes(order.status)) returns.push(entry);

            const productId = String(item.id);
            if (
                !["Cancelled", "Returned", "Refunded"].includes(order.status) &&
                !reviewedProducts.has(productId) &&
                !reviewProductsAdded.has(productId)
            ) {
                review.push(entry);
                reviewProductsAdded.add(productId);
            }
            if (
                reviewedProducts.has(productId) &&
                !reviewedProductsAdded.has(productId)
            ) {
                reviewed.push(entry);
                reviewedProductsAdded.add(productId);
            }
        });
    });

    renderCategory("shipped", shipped, "You have no shipped items.");
    renderCategory("delivered", delivered, "You have no delivered items.");
    renderCategory("pending", pending, "You have no pending items.");
    renderCategory("returns", returns, "You have no returns.");
    renderCategory("review", review, "You have reviewed all eligible purchases.");
    renderCategory("reviewed", reviewed, "You have not reviewed any purchases yet.");
}

document.querySelectorAll(".account-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".account-tab").forEach(item =>
            item.classList.toggle("active", item === tab)
        );
        document.querySelectorAll(".account-tab-icon").forEach(icon => {
            icon.src = icon.closest(".account-tab").classList.contains("active")
                ? icon.dataset.iconActive
                : icon.dataset.iconDefault;
        });
        document.querySelectorAll(".account-order-section").forEach(panel =>
            panel.classList.toggle("active", panel.dataset.panel === tab.dataset.section)
        );
    });
});

signoutButton.addEventListener("click", async () => {
    const savedUrl = sessionStorage.getItem("accountReturnUrl");
    sessionStorage.removeItem("accountReturnUrl");

    let returnUrl = "index.html";
    if (savedUrl) {
        const candidate = new URL(savedUrl, window.location.href);
        if (
            candidate.origin === window.location.origin &&
            !candidate.pathname.endsWith("/Account.html")
        ) {
            returnUrl = candidate.href;
        }
    }

    localStorage.removeItem("cart");
    localStorage.removeItem("favorites");
    localStorage.removeItem("mpwrCartOwnerUid");
    localStorage.removeItem("mpwrFavoritesOwnerUid");

    await signOut(auth);
    sessionStorage.setItem("flashToast", JSON.stringify({
        message: "Signed out successfully",
        type: "success"
    }));
    window.location.assign(returnUrl);
});

onAuthStateChanged(auth, async user => {
    loading.hidden = true;
    dashboard.hidden = !user;
    if (profileOverview) profileOverview.hidden = !user;
    signoutButton.hidden = !user;

    if (!user) {
        sessionStorage.setItem("openAccountSignIn", "true");
        window.location.replace("index.html");
        return;
    }

    try {
        await Promise.all([
            profileOverview ? loadProfileOverview(user) : Promise.resolve(),
            loadAccount(user)
        ]);
    } catch (error) {
        console.error("Unable to load account:", error);
        dashboard.replaceChildren(emptyState("Your account could not be loaded right now."));
    }
});
