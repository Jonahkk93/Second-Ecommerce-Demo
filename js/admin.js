
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;
const ordersList = document.querySelector(".orders-list");
const orderSearch = document.getElementById("order-search");

onAuthStateChanged(auth, async (user) => {

    // Not signed in
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // Get user's Firestore document
    const userDoc = await getDoc(
        doc(db, "users", user.uid)
    );

    // User document missing
    if (!userDoc.exists()) {
        window.location.href = "index.html";
        return;
    }

    const userData = userDoc.data();

    // Not an admin
    if (userData.role !== "admin") {
        window.location.href = "index.html";
        return;
    }

    console.log("Admin access granted.");

document.getElementById("total-orders").textContent = "...";
document.getElementById("pending-orders").textContent = "...";
document.getElementById("total-revenue").textContent = "Loading...";
document.getElementById("total-customers").textContent = "...";

    await loadAllOrders();
});


async function loadAllOrders() {
    /*LOADING DASBOARD*/
ordersList.innerHTML = `
    <div class="loading-dashboard">
        <div class="loading-spinner"></div>
        <p>Loading dashboard...</p>
    </div>
`;

    const snapshot = await getDocs(
        query(
            collection(db, "orders"),
            orderBy("createdAt", "desc")
        )
    );

    ordersList.innerHTML = "";
    let totalOrders = 0;
    let pendingOrders = 0;
    let totalRevenue = 0;
    const customers = new Set();

for (const orderDoc of snapshot.docs) {

        const order = orderDoc.data();
        const orderDate = order.createdAt
    ? order.createdAt.toDate().toLocaleString()
    : "Unknown";
    const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0
);
        const itemsHTML = order.items.map(item => `
    <div class="admin-order-item">

        <img
            src="${item.image}"
            class="admin-order-image"
        >

        <div class="admin-order-details">

            <h4>${item.title}</h4>

            <p>${item.color} • ${item.size}</p>

            <p>Qty: ${item.quantity}</p>

        </div>

    </div>
`).join("");
        let customerName = "Unknown Customer";
let customerEmail = "No email";

try {
    const customerDoc = await getDoc(doc(db, "users", order.userId));

if (customerDoc.exists()) {
    const customer = customerDoc.data();

    customerName = `${customer.firstName} ${customer.lastName}`;

    customerEmail = customer.email || "No email";
}

} catch (error) {
    console.error(error);
}
        totalOrders++;

if (order.status === "Pending") {
    pendingOrders++;
}

totalRevenue += Number(order.total) || 0;

if (order.userId) {
    customers.add(order.userId);
}

        const orderCard = document.createElement("div");
        const statusBadge = `
    <span class="status-badge ${order.status.toLowerCase()}">
        ${order.status}
    </span>
`;
        orderCard.className = "order-card";
        
orderCard.innerHTML = `
<div class="order-header">

    <div class="order-info">

        <h3>Order #${orderDoc.id.slice(0,8).toUpperCase()}</h3>

        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Email:</strong> ${customerEmail}</p>

        <p><strong>Total:</strong>
        UGX ${Number(order.total).toLocaleString()}</p>
        <p><strong>Order Date:</strong> ${orderDate}</p>
        <p><strong>Items:</strong> ${itemCount}</p>

    </div>

    <div class="order-actions">

    <div class="status-section">

    ${statusBadge}

    <select class="status-select" data-id="${orderDoc.id}">
                <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                <option value="Processing" ${order.status === "Processing" ? "selected" : ""}>Processing</option>
                <option value="Shipped" ${order.status === "Shipped" ? "selected" : ""}>Shipped</option>
                <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
                <option value="Cancelled" ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
            </select>

            </div>

        <button class="toggle-items-btn">
            View Items
        </button>

    </div>

</div>

<div class="admin-order-items">

    ${itemsHTML}

</div>

<hr>
`;

        orderCard.dataset.orderId = orderDoc.id.toUpperCase();
        orderCard.dataset.customer = customerName.toUpperCase();
        orderCard.dataset.status = order.status;

        ordersList.appendChild(orderCard);
        const itemsContainer = orderCard.querySelector(".admin-order-items");
        const toggleButton = orderCard.querySelector(".toggle-items-btn");
        toggleButton.addEventListener("click", () => {

    const isHidden = itemsContainer.style.display === "none";

    itemsContainer.style.display = isHidden
        ? "block"
        : "none";

    toggleButton.textContent = isHidden
        ? "Hide Items"
        : "View Items";

});

        itemsContainer.style.display = "none";
        const statusSelect = orderCard.querySelector(".status-select");

statusSelect.addEventListener("change", async () => {
    const previousStatus = order.status;

    await updateDoc(
        doc(db, "orders", orderDoc.id),
        {
            status: statusSelect.value
        }
    );

    orderCard.dataset.status = statusSelect.value;

    const badge = orderCard.querySelector(".status-badge");

    badge.textContent = statusSelect.value;

    badge.className =
        `status-badge ${statusSelect.value.toLowerCase()}`;

const pendingOrdersElement = document.getElementById("pending-orders");

let pendingCount = Number(pendingOrdersElement.textContent);

if (
    previousStatus === "Pending" &&
    statusSelect.value !== "Pending"
) {
    pendingCount--;
}

else if (
    previousStatus !== "Pending" &&
    statusSelect.value === "Pending"
) {
    pendingCount++;
}

pendingOrdersElement.textContent = pendingCount;
order.status = statusSelect.value;
filterOrders();
showAdminToast("Order status updated successfully");



});
    }

    document.getElementById("total-orders").textContent = totalOrders;

document.getElementById("pending-orders").textContent = pendingOrders;

document.getElementById("total-revenue").textContent =
    `UGX ${totalRevenue.toLocaleString()}`;

document.getElementById("total-customers").textContent =
    customers.size;

}


orderSearch.addEventListener("input", filterOrders);

const filterButtons = document.querySelectorAll(".filter-btn");

filterButtons.forEach(button => {

    button.addEventListener("click", () => {

        filterButtons.forEach(btn =>
            btn.classList.remove("active")
        );

        button.classList.add("active");

        filterOrders();

    });

});

function showAdminToast(message){

    const toast = document.getElementById("admin-toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);

}


function filterOrders() {

    const search = orderSearch.value.trim().toUpperCase();

    const activeFilter = document.querySelector(".filter-btn.active");
    const selectedStatus = activeFilter
        ? activeFilter.dataset.status
        : "All";

    const cards = document.querySelectorAll(".order-card");

    cards.forEach(card => {

        const orderId = card.dataset.orderId;
        const customer = card.dataset.customer;
        const status = card.dataset.status;

        const matchesSearch =
            orderId.includes(search) ||
            customer.includes(search);

        const matchesStatus =
            selectedStatus === "All" ||
            status === selectedStatus;

        card.style.display =
            matchesSearch && matchesStatus
                ? ""
                : "none";

    });

}
