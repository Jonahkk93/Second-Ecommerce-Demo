
import {
    onAuthStateChanged,
    signOut
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

import { adminAuth, adminDb } from "./admin-firebase.js";

const auth = adminAuth;
const db = adminDb;
const ordersList = document.querySelector(".orders-list");
const orderSearch = document.getElementById("order-search");
const adminDashboard = document.getElementById("admin-dashboard");
const adminAccountButton = document.getElementById("admin-account-button");
const adminAccountMenu = document.getElementById("admin-account-menu");
const adminAccountEmail = document.getElementById("admin-account-email");
const adminAccountPhoto = document.getElementById("admin-account-photo");
const adminAccountInitials = document.getElementById("admin-account-initials");
const adminSignout = document.getElementById("admin-signout");
const statusConfirm = document.getElementById("admin-status-confirm");
const statusConfirmName = document.getElementById("admin-status-confirm-name");
const statusConfirmCancel = statusConfirm.querySelector(".admin-status-cancel");
const statusConfirmApprove = statusConfirm.querySelector(".admin-status-approve");
let dashboardLoaded = false;
let resolveStatusConfirmation = null;

function confirmStatusChange(status) {
    const statusClass = status.toLowerCase();
    statusConfirmName.textContent = status;
    statusConfirmName.className = statusClass;
    statusConfirmApprove.className = `admin-status-approve ${statusClass}`;
    statusConfirm.hidden = false;

    return new Promise(resolve => {
        resolveStatusConfirmation = resolve;
    });
}

function closeStatusConfirmation(confirmed) {
    statusConfirm.hidden = true;
    resolveStatusConfirmation?.(confirmed);
    resolveStatusConfirmation = null;
}

statusConfirmCancel.addEventListener("click", () => closeStatusConfirmation(false));
statusConfirmApprove.addEventListener("click", () => closeStatusConfirmation(true));
statusConfirm.addEventListener("click", event => {
    if (event.target === statusConfirm) closeStatusConfirmation(false);
});

function showDashboard(profile = {}) {
    adminDashboard.hidden = false;
    adminAccountEmail.textContent = auth.currentUser?.email || "Admin account";

    const initials = `${profile.firstName?.trim()?.[0] || ""}${profile.lastName?.trim()?.[0] || ""}` ||
        auth.currentUser?.email?.[0] || "A";
    adminAccountInitials.textContent = initials.toUpperCase();

    if (profile.profileImage) {
        adminAccountPhoto.src = profile.profileImage;
        adminAccountButton.classList.add("has-photo");
        adminAccountPhoto.onerror = () => {
            adminAccountPhoto.onerror = null;
            adminAccountButton.classList.remove("has-photo");
        };
    } else {
        adminAccountButton.classList.remove("has-photo");
    }
}

adminAccountButton.addEventListener("click", event => {
    event.stopPropagation();
    const willOpen = adminAccountMenu.hidden;
    adminAccountMenu.hidden = !willOpen;
    adminAccountButton.setAttribute("aria-expanded", String(willOpen));
});

document.addEventListener("click", event => {
    if (event.target.closest(".admin-account")) return;
    adminAccountMenu.hidden = true;
    adminAccountButton.setAttribute("aria-expanded", "false");

    document.querySelectorAll(".status-picker-menu:not([hidden])").forEach(menu => {
        menu.hidden = true;
        menu.closest(".status-picker")
            ?.querySelector(".status-picker-trigger")
            ?.setAttribute("aria-expanded", "false");
    });
});

adminSignout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("admin-login.html");
});

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.replace("admin-login.html");
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const isAdmin = userDoc.exists() && userData.role === "admin";

        if (!isAdmin) {
            await signOut(auth);
            window.location.replace("admin-login.html?error=unauthorized");
            return;
        }

        showDashboard(userData);
    } catch (error) {
        console.error("Unable to verify administrator access:", error);
        await signOut(auth);
        window.location.replace("admin-login.html?error=verification");
        return;
    }

    if (dashboardLoaded) return;
    dashboardLoaded = true;

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
            src="${window.normalizeMPWRImagePath?.(item.image, item.id) || item.image}"
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

    <div class="status-picker">
        <button class="status-picker-trigger" type="button" data-status="${order.status}" aria-expanded="false">
            ${order.status}<span aria-hidden="true">⌄</span>
        </button>
        <div class="status-picker-menu" hidden>
            ${["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].map(status => `
                <button type="button" data-status="${status}" class="${order.status === status ? "selected" : ""}">
                    ${status}
                </button>
            `).join("")}
        </div>
    </div>

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
        const statusPicker = orderCard.querySelector(".status-picker");
        const statusTrigger = statusPicker.querySelector(".status-picker-trigger");
        const statusMenu = statusPicker.querySelector(".status-picker-menu");

statusTrigger.addEventListener("click", event => {
    event.stopPropagation();
    document.querySelectorAll(".status-picker-menu:not([hidden])").forEach(menu => {
        if (menu !== statusMenu) menu.hidden = true;
    });
    statusMenu.hidden = !statusMenu.hidden;
    statusTrigger.setAttribute("aria-expanded", String(!statusMenu.hidden));
});

statusMenu.querySelectorAll("button").forEach(option => {
option.addEventListener("click", async event => {
    event.stopPropagation();
    const nextStatus = option.dataset.status;
    const previousStatus = order.status;

    statusMenu.hidden = true;
    statusTrigger.setAttribute("aria-expanded", "false");

    if (nextStatus === previousStatus) return;
    if (!await confirmStatusChange(nextStatus)) return;

    statusTrigger.disabled = true;

    try {
        await updateDoc(doc(db, "orders", orderDoc.id), { status: nextStatus });
    } finally {
        statusTrigger.disabled = false;
    }

    orderCard.dataset.status = nextStatus;
    statusTrigger.dataset.status = nextStatus;
    statusTrigger.firstChild.textContent = nextStatus;
    statusMenu.querySelectorAll("button").forEach(button =>
        button.classList.toggle("selected", button === option)
    );

    const badge = orderCard.querySelector(".status-badge");

    badge.textContent = nextStatus;

    badge.className =
        `status-badge ${nextStatus.toLowerCase()}`;

const pendingOrdersElement = document.getElementById("pending-orders");

let pendingCount = Number(pendingOrdersElement.textContent);

if (
    previousStatus === "Pending" &&
    nextStatus !== "Pending"
) {
    pendingCount--;
}

else if (
    previousStatus !== "Pending" &&
    nextStatus === "Pending"
) {
    pendingCount++;
}

pendingOrdersElement.textContent = pendingCount;
order.status = nextStatus;
filterOrders();
showAdminToast("Order status updated successfully");

});
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
