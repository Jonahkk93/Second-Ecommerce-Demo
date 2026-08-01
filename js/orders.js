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
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const auth = window.auth;
const db = window.db;

const ordersContent = document.querySelector(".orders-content");
const ordersSignout = document.querySelector(".orders-signout");
const cancelConfirmOverlay = document.getElementById("orders-cancel-confirm");
const cancelConfirmDismiss = cancelConfirmOverlay.querySelector(".orders-confirm-dismiss");
const cancelConfirmApprove = cancelConfirmOverlay.querySelector(".orders-confirm-approve");
const confirmTitle = document.getElementById("orders-confirm-title");
const confirmMessage = document.getElementById("orders-confirm-message");
const ordersToast = document.querySelector(".orders-toast");
let resolveCancelConfirmation = null;

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

ordersSignout.addEventListener("click", async () => {
    localStorage.removeItem("cart");
    localStorage.removeItem("favorites");
    localStorage.removeItem("mpwrCartOwnerUid");
    localStorage.removeItem("mpwrFavoritesOwnerUid");
    await signOut(auth);
    window.location.assign("index.html");
});

async function reorderItems(orderItems) {

    const user = auth.currentUser;

    if (!user) return;

    const cartRef = doc(db, "carts", user.uid);

    const cartDoc = await getDoc(cartRef);

    let cart = [];

    if (cartDoc.exists()) {
        cart = cartDoc.data().items || [];
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
            const itemsHTML = order.items.map(item => `
    <div class="order-item">

        <img
            src="${item.image}"
            class="order-item-image"
        >

        <div class="order-item-details">

            <h3>${item.title}</h3>

            <p>${item.color} • ${item.size}</p>

            <p>Qty: ${item.quantity}</p>

        </div>

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

    default:
        statusClass = "status-pending";
}

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

    <div class="order-items">
    ${itemsHTML}
</div>



    <p class="order-total">
    Total: UGX ${Number(order.total).toLocaleString()}
</p>

<div class="order-actions">

    <button class="toggle-order-btn">
        View Details
    </button>

    <button class="reorder-btn">
        Reorder
    </button>

    ${
        order.status === "Pending"
            ? `
            <button class="cancel-order-btn">
                Cancel Order
            </button>
            `
            : ""
    }

</div>
`;

const itemsContainer = orderCard.querySelector(".order-items");

itemsContainer.style.display = "none";

const toggleButton = orderCard.querySelector(".toggle-order-btn");
const reorderButton = orderCard.querySelector(".reorder-btn");
const cancelButton = orderCard.querySelector(".cancel-order-btn");
reorderButton.hidden = true;

reorderButton.addEventListener("click", async () => {

    const confirmed = await showOrderConfirmation({
        title: "Reorder Items?",
        message: "Add all the items from this order to your cart?",
        dismissLabel: "Not Now",
        approveLabel: "Reorder"
    });

    if (!confirmed) return;

    await reorderItems(order.items);

});

if (cancelButton) {

    cancelButton.addEventListener("click", async () => {

        const confirmed = await showOrderConfirmation({
            title: "Cancel Order?",
            message: "Are you sure you want to cancel this order?",
            dismissLabel: "Keep Order",
            approveLabel: "Cancel Order"
        });

        if (!confirmed) return;

        await updateDoc(
            doc(db, "orders", orderId),
            {
                status: "Cancelled"
            }
        );

        loadOrders();

    });

}

toggleButton.addEventListener("click", () => {

    const isHidden = itemsContainer.style.display === "none";

    itemsContainer.style.display = isHidden ? "block" : "none";
    reorderButton.hidden = !isHidden;
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

    ordersSignout.hidden = !user;

    if (user) {

        loadOrders();

    }

});
