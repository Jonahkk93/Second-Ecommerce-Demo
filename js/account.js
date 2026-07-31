import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    getDownloadURL,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const auth = window.auth;
const db = window.db;
const storage = window.storage;
const dashboard = document.querySelector(".account-dashboard");
const loading = document.querySelector(".account-loading");
const customer = document.querySelector(".account-customer");
const signoutButton = document.querySelector(".account-signout");
const reviewOverlay = document.querySelector(".account-review-overlay");
const reviewModalClose = document.querySelector(".account-review-close");
const reviewForm = document.querySelector("#account-review-form");
const reviewComment = document.querySelector("#account-review-comment");
const reviewFile = document.querySelector("#account-review-file");
const reviewFileName = document.querySelector(".account-review-file-name");
const reviewProductName = document.querySelector(".account-review-product");
const reviewError = document.querySelector(".account-review-error");
const reviewSubmit = document.querySelector(".account-review-submit");
const reviewStars = [...document.querySelectorAll(".account-review-stars button")];

let currentReviewItem = null;
let currentReviewRating = 0;

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
    image.src = item.image || "";
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
    reviewFile.value = "";
    reviewFileName.textContent = "";
    reviewError.textContent = "";
    reviewProductName.textContent = item.title || "Purchased product";
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

reviewFile.addEventListener("change", () => {
    const file = reviewFile.files[0];
    reviewFileName.textContent = file ? file.name : "";
});

reviewModalClose.addEventListener("click", closeReviewModal);
reviewOverlay.addEventListener("click", event => {
    if (event.target === reviewOverlay) closeReviewModal();
});

reviewForm.addEventListener("submit", async event => {
    event.preventDefault();
    const user = auth.currentUser;
    const comment = reviewComment.value.trim();
    const file = reviewFile.files[0];

    reviewError.textContent = "";
    if (!user || !currentReviewItem || !currentReviewRating || !comment) {
        reviewError.textContent = "Choose a star rating and write your review.";
        return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
        reviewError.textContent = "Attachments must be smaller than 5 MB.";
        return;
    }

    reviewSubmit.disabled = true;
    reviewSubmit.textContent = "Posting…";

    try {
        const reviewRef = doc(
            db,
            "reviews",
            `${user.uid}_${currentReviewItem.id}`
        );
        const productId = currentReviewItem.id;

        await setDoc(reviewRef, {
            productId: String(currentReviewItem.id),
            userId: user.uid,
            customerName: user.displayName || user.email?.split("@")[0] || "MPWR customer",
            rating: currentReviewRating,
            text: comment,
            attachment: null,
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

        // Attachments upload after the review itself has posted, so a large
        // image or document does not hold the modal open.
        if (file) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const storageRef = ref(
                storage,
                `review-attachments/${user.uid}/${productId}/${Date.now()}-${safeName}`
            );

            uploadBytes(storageRef, file, { contentType: file.type })
                .then(() => getDownloadURL(storageRef))
                .then(url => setDoc(reviewRef, {
                    attachment: {
                        url,
                        name: file.name,
                        type: file.type
                    },
                    updatedAt: serverTimestamp()
                }, { merge: true }))
                .catch(error => {
                    console.warn("Review attachment could not upload:", error);
                });
        }
    } catch (error) {
        console.error("Unable to publish review:", error);
        reviewError.textContent = "Your review could not be posted.";
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
    const pending = [];
    const returns = [];
    const review = [];
    const reviewProductsAdded = new Set();

    orders.forEach(order => {
        (order.items || []).forEach(item => {
            const entry = { item, order };
            if (order.status === "Shipped") shipped.push(entry);
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
        });
    });

    renderCategory("shipped", shipped, "You have no shipped items.");
    renderCategory("pending", pending, "You have no pending items.");
    renderCategory("returns", returns, "You have no returns.");
    renderCategory("review", review, "You have reviewed all eligible purchases.");
}

document.querySelectorAll(".account-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".account-tab").forEach(item =>
            item.classList.toggle("active", item === tab)
        );
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
    signoutButton.hidden = !user;

    if (!user) {
        sessionStorage.setItem("openAccountSignIn", "true");
        window.location.replace("index.html");
        return;
    }

    customer.textContent = user.email || "MPWR customer";
    try {
        await loadAccount(user);
    } catch (error) {
        console.error("Unable to load account:", error);
        dashboard.replaceChildren(emptyState("Your account could not be loaded right now."));
    }
});
