import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "./firestore-api.js";

import {
    onAuthStateChanged
} from "./auth-api.js";

const auth = window.auth;
const db = window.db;

const ordersContent = document.querySelector(".orders-content");
const cancelConfirmOverlay = document.getElementById("orders-cancel-confirm");
const cancelConfirmDismiss = cancelConfirmOverlay.querySelector(".orders-confirm-dismiss");
const cancelConfirmApprove = cancelConfirmOverlay.querySelector(".orders-confirm-approve");
const confirmTitle = document.getElementById("orders-confirm-title");
const confirmMessage = document.getElementById("orders-confirm-message");
const ordersToast = document.querySelector(".orders-toast");
let resolveCancelConfirmation = null;

function safeText(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character]);
}

function refundDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString("en-UG", { day:"numeric", month:"long", year:"numeric" })
        : "—";
}

function customerRefundPanel(refund) {
    if (!refund) return "";
    const status = String(refund.status || "pending").toLowerCase();
    const labels = { pending:"Refund pending", initiated:"Refund initiated", processing:"Refund processing", refunded:"Refunded", failed:"Refund needs attention" };
    const descriptions = {
        pending:"MPWR will initiate your full refund within one business day.",
        initiated:"Your refund has been sent to the payment provider.",
        processing:"Your payment provider is processing the refund.",
        refunded:"Your full refund has been completed.",
        failed:"We could not complete this refund attempt. MPWR will investigate and retry it."
    };
    const steps = ["pending", "initiated", "processing", "refunded"];
    const activeIndex = status === "failed" ? 0 : Math.max(0, steps.indexOf(status));
    const arrival = status === "pending" ? `Initiation by ${refundDate(refund.initiationDueAt)}`
        : status === "refunded" ? `Completed ${refundDate(refund.completedAt)}`
        : `Expected by ${refundDate(refund.expectedBy)}`;
    return `<section class="order-refund refund-${safeText(status)}">
        <div class="order-refund-heading"><div><small>Buyer protection</small><h3>${safeText(labels[status] || status)}</h3></div><strong>UGX ${Number(refund.amount || 0).toLocaleString()}</strong></div>
        <p>${safeText(descriptions[status] || "Your refund is being handled by MPWR.")}</p>
        <div class="refund-progress" aria-label="Refund progress">${steps.map((step, index) => `<i class="${index <= activeIndex && status !== "failed" ? "complete" : ""}"></i>`).join("")}</div>
        <div class="order-refund-meta"><span>${safeText(refund.destination || "Original payment method")}</span><span>${safeText(arrival)}</span></div>
        ${refund.reference ? `<small class="order-refund-reference">Reference: ${safeText(refund.reference)}</small>` : ""}
        <small class="order-refund-note">Mobile Money usually takes 1–3 business days. Card refunds usually take 5–10 business days and can take up to 15.</small>
    </section>`;
}

function showOrdersToast(message) {
    clearTimeout(showOrdersToast.timeout);
    ordersToast.textContent = message;
    ordersToast.classList.remove("show");
    void ordersToast.offsetWidth;
    ordersToast.classList.add("show");
    showOrdersToast.timeout = setTimeout(() => {
        ordersToast.classList.remove("show");
    }, 2500);
}

function closeCancelConfirmation(confirmed) {
    cancelConfirmOverlay.classList.remove("active");
    cancelConfirmOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("orders-confirm-open");
    resolveCancelConfirmation?.(confirmed);
    resolveCancelConfirmation = null;
}

function showOrderConfirmation({ title, message, dismissLabel, approveLabel }) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    cancelConfirmDismiss.textContent = dismissLabel;
    cancelConfirmApprove.textContent = approveLabel;
    cancelConfirmOverlay.classList.add("active");
    cancelConfirmOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("orders-confirm-open");
    requestAnimationFrame(() => cancelConfirmDismiss.focus());
    return new Promise(resolve => {
        resolveCancelConfirmation = resolve;
    });
}

cancelConfirmDismiss.addEventListener("click", () => closeCancelConfirmation(false));
cancelConfirmApprove.addEventListener("click", () => closeCancelConfirmation(true));
cancelConfirmOverlay.addEventListener("click", event => {
    if (event.target === cancelConfirmOverlay) closeCancelConfirmation(false);
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && cancelConfirmOverlay.classList.contains("active")) {
        closeCancelConfirmation(false);
    }
});

async function reorderItems(orderItems) {

    const user = auth.currentUser;

    if (!user) return;

    const cartRef = doc(db, "carts", user.uid);

    const cartDoc = await getDoc(cartRef);

    let cart = [];

    if (cartDoc.exists()) {
        cart = window.normalizeMPWRItems?.(cartDoc.data().items || []) || cartDoc.data().items || [];
    }

    orderItems.forEach(orderItem => {

        const existingItem = cart.find(item =>
            item.id === orderItem.id &&
            item.color === orderItem.color &&
            item.size === orderItem.size
        );

        if (existingItem) {

            existingItem.quantity += orderItem.quantity;

        } else {

            cart.push({
                ...orderItem
            });

        }

    });

    await setDoc(cartRef, {
        items: cart
    });

    localStorage.setItem(
        "cart",
        JSON.stringify(cart)
    );

    showOrdersToast("Items added to your cart");

}

async function loadOrders() {

    const user = auth.currentUser;

    if (!user) return;

    try {

        const ordersQuery = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(ordersQuery);

        ordersContent.innerHTML = "";

        snapshot.forEach(orderDoc => {

            const order = orderDoc.data();
           const orderId = orderDoc.id;
            const itemsHTML = order.items.map((item, itemIndex) => `
    <div class="order-item">

        <img
            src="${window.normalizeMPWRImagePath?.(item.image, item.id) || item.image}"
            class="order-item-image"
        >

        <div class="order-item-details">

            <h3>${item.title}</h3>

            <p><strong>Color:</strong> ${item.color || "—"}</p>

            <p><strong>Length/Size:</strong> ${item.length || item.size || "—"}</p>

            <p><strong>Quantity:</strong> ${item.quantity || 1}</p>

        </div>

        <button class="item-reorder-btn" type="button" data-item-index="${itemIndex}">
            Reorder
        </button>

    </div>
`).join("");

            const orderCard = document.createElement("div");

            orderCard.className = "order-card";

           const orderDate = order.createdAt
    ? order.createdAt.toDate().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric"
      })
    : "Unknown date";

    let statusClass = "";

switch (order.status) {

    case "Pending":
        statusClass = "status-pending";
        break;

    case "Processing":
        statusClass = "status-processing";
        break;

    case "Shipped":
        statusClass = "status-shipped";
        break;

    case "Delivered":
        statusClass = "status-delivered";
        break;

    case "Cancelled":
        statusClass = "status-cancelled";
        break;

    case "Returned":
        statusClass = "status-returned";
        break;

    default:
        statusClass = "status-pending";
}

const deliveryFee = Number(order.deliveryFee ?? order.delivery?.fee ?? 0);
const orderTotal = Number(order.total) || 0;
const orderSubtotal = Number(order.subtotal ?? Math.max(0, orderTotal - deliveryFee));
const deliveryLabel = "Delivery";
const deliveryDestination = [order.delivery?.city, order.delivery?.district].filter(Boolean).join(", ");
const trackingUrl = /^https?:\/\/[^\s]+$/i.test(String(order.trackingUrl || "")) ? String(order.trackingUrl) : "";
const cancellationRequest = order.delivery?.cancellationRequest;
const cancellationPending = order.status !== "Cancelled" && cancellationRequest?.status === "pending";
const cancellationRejected = order.status !== "Cancelled" && cancellationRequest?.status === "rejected";
const trackingPanel = order.trackingNumber ? `
    <section class="order-tracking">
        <div><small>Shipment tracking</small><h3>${safeText(order.shippingCarrier || "MPWR delivery")}</h3></div>
        <p><span>Tracking number</span><strong>${safeText(order.trackingNumber)}</strong></p>
        ${order.shippedAt ? `<p><span>Shipped</span><strong>${safeText(refundDate(order.shippedAt.toDate?.() || order.shippedAt))}</strong></p>` : ""}
        ${trackingUrl ? `<a href="${safeText(trackingUrl)}" target="_blank" rel="noopener noreferrer">Track shipment</a>` : ""}
    </section>` : "";

orderCard.innerHTML = `
    <div class="order-header">

        <div>

            <p class="order-id">
                Order #${orderDoc.id.slice(0, 8).toUpperCase()}
            </p>

            <p class="order-date">${orderDate}</p>

        </div>

        <span class="order-status ${statusClass}">
            ${order.status}
        </span>

    </div>

    <div class="order-price-breakdown">
        <p class="order-subtotal-row"><span>Subtotal</span><strong>UGX ${orderSubtotal.toLocaleString()}</strong></p>
        <p class="order-delivery-row"><span>${deliveryDestination || deliveryLabel}</span><strong>UGX ${deliveryFee.toLocaleString()}</strong></p>
        ${order.delivery?.etaLabel ? `<small>Estimated delivery: ${order.delivery.etaLabel}</small>` : ""}
        <p class="order-total"><span>Total</span><strong>UGX ${orderTotal.toLocaleString()}</strong></p>
    </div>

    ${trackingPanel}

    ${cancellationPending ? `<section class="order-cancellation-note"><h3>Cancellation requested</h3><p>MPWR will review your request before cancelling this order.</p></section>` : ""}
    ${cancellationRejected ? `<section class="order-cancellation-note is-rejected"><h3>Cancellation not approved</h3><p>This order is still active. Contact MPWR support if you need help.</p></section>` : ""}

    ${customerRefundPanel(order.delivery?.refund)}

<div class="order-actions">

    <button class="toggle-order-btn">
        View Details
    </button>

    ${
        order.status === "Pending" && !cancellationPending && !cancellationRejected
            ? `
            <button class="cancel-order-btn">
                Request Cancellation
            </button>
            `
            : cancellationPending
                ? `<button class="cancel-order-btn" disabled>Cancellation Requested</button>`
                : cancellationRejected
                    ? `<button class="cancel-order-btn" disabled>Cancellation Not Approved</button>`
            : ""
    }

</div>

<div class="order-items">
    ${itemsHTML}
    ${order.items.length > 1 ? `
        <div class="order-items-footer">
            <button class="reorder-btn" type="button">Reorder All</button>
        </div>
    ` : ""}
</div>
`;

const itemsContainer = orderCard.querySelector(".order-items");

itemsContainer.style.display = "none";

const toggleButton = orderCard.querySelector(".toggle-order-btn");
const reorderButton = orderCard.querySelector(".reorder-btn");
const cancelButton = orderCard.querySelector(".cancel-order-btn");

if (reorderButton) reorderButton.addEventListener("click", async () => {

    const confirmed = await showOrderConfirmation({
        title: "Reorder Items?",
        message: "Add all the items from this order to your cart?",
        dismissLabel: "Not Now",
        approveLabel: "Reorder"
    });

    if (!confirmed) return;

    await reorderItems(order.items);

});

orderCard.querySelectorAll(".item-reorder-btn").forEach(button => {
    button.addEventListener("click", async () => {
        const item = order.items[Number(button.dataset.itemIndex)];
        if (!item) return;

        const confirmed = await showOrderConfirmation({
            title: "Reorder Item?",
            message: `Add ${item.title || "this item"} to your cart?`,
            dismissLabel: "Not Now",
            approveLabel: "Reorder"
        });

        if (!confirmed) return;
        await reorderItems([item]);
    });
});

if (cancelButton) {

    cancelButton.addEventListener("click", async () => {

        const confirmed = await showOrderConfirmation({
            title: "Request Cancellation?",
            message: "Send this order to MPWR for cancellation approval?",
            dismissLabel: "Keep Order",
            approveLabel: "Request Cancellation"
        });

        if (!confirmed) return;

        await updateDoc(
            doc(db, "orders", orderId),
            {
                status: "Cancelled",
                cancelledBy: "customer"
            }
        );

        showOrdersToast("Cancellation request sent for approval.");

        loadOrders();

    });

}

toggleButton.addEventListener("click", () => {

    const isHidden = itemsContainer.style.display === "none";

    itemsContainer.style.display = isHidden ? "block" : "none";
    toggleButton.classList.toggle("details-open", isHidden);

    toggleButton.textContent = isHidden
        ? "Hide Details "
        : "View Details ";

});

 ordersContent.appendChild(orderCard);

        });

    } catch (error) {

        console.error(error);

    }

}


onAuthStateChanged(auth, user => {

    if (user) {

        loadOrders();

    }

});
