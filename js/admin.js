
import {
    onAuthStateChanged,
    signOut
} from "./auth-api.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy,
    updateDoc,
    setDoc,
    serverTimestamp
} from "./firestore-api.js";

import { adminAuth, adminDb } from "./admin-firebase.js";

const auth = adminAuth;
const db = adminDb;
const ordersPortal = document.body.dataset.ordersPortal === "true";
const ordersList = document.querySelector(".orders-list");
const orderSearch = document.getElementById("order-search");
const adminDashboard = document.getElementById("admin-dashboard");
const portalAccountButton = ordersPortal ? document.getElementById("admin-account-button") : null;
const portalAccountMenu = ordersPortal ? document.getElementById("admin-account-menu") : null;
const portalAccountEmail = ordersPortal ? document.getElementById("admin-account-email") : null;
const portalAccountInitials = ordersPortal ? document.getElementById("admin-account-initials") : null;
const portalSignout = ordersPortal ? document.getElementById("admin-signout") : null;
const statusConfirm = document.getElementById("admin-status-confirm");
const statusConfirmName = document.getElementById("admin-status-confirm-name");
const statusConfirmCancel = statusConfirm.querySelector(".admin-status-cancel");
const dashboardNavLink = document.querySelector('.admin-side-nav a[href="admin.html"]');
const ordersNavLink = document.querySelector('.admin-side-nav a[href="#orders"]');
const adminTopNav = document.querySelector(".admin-dashboard > .admin-nav");

function syncAdminNavSelection() {
    const ordersSelected = window.location.hash === "#orders";
    dashboardNavLink?.classList.toggle("active", !ordersSelected);
    ordersNavLink?.classList.toggle("active", ordersSelected);
    if (!ordersPortal) {
        adminTopNav?.classList.toggle("orders-view-hidden", ordersSelected);
        adminDashboard?.classList.toggle("orders-view", ordersSelected);
        document.documentElement.classList.toggle("management-orders-view", ordersSelected);
    }
}

syncAdminNavSelection();
window.addEventListener("hashchange", syncAdminNavSelection);

const BESTSELLER_WINDOW_DAYS = 30;

async function publishBestsellers(orders) {
    const cutoff = Date.now() - BESTSELLER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const totals = new Map();

    orders.forEach(order => {
        const createdAt = order.createdAt?.toDate?.();
        if (order.status !== "Delivered" || !createdAt || createdAt.getTime() < cutoff) return;

        (Array.isArray(order.items) ? order.items : []).forEach(item => {
            const id = String(item.id ?? "").trim();
            if (!id) return;
            totals.set(id, (totals.get(id) || 0) + Math.max(Number(item.quantity) || 1, 1));
        });
    });

    const products = [...totals.entries()]
        .map(([id, unitsSold]) => ({ id, unitsSold }))
        .sort((a, b) => b.unitsSold - a.unitsSold || a.id.localeCompare(b.id))
        .slice(0, 10);

    // Sales rankings are analytics data. Keep them separate from the manually
    // curated Popular selection managed on the Homepage screen.
    await setDoc(doc(db, "storefront", "bestsellers"), {
        products,
        windowDays: BESTSELLER_WINDOW_DAYS,
        updatedAt: serverTimestamp()
    });
}
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
    if (portalAccountEmail) portalAccountEmail.textContent = auth.currentUser?.email || "Orders account";
    if (portalAccountInitials) portalAccountInitials.textContent = (auth.currentUser?.email?.trim()?.[0] || "A").toUpperCase();
}

portalAccountButton?.addEventListener("click", event => {
    event.stopPropagation();
    const willOpen = portalAccountMenu.hidden;
    portalAccountMenu.hidden = !willOpen;
    portalAccountButton.setAttribute("aria-expanded", String(willOpen));
});

portalSignout?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("order-management-login.html");
});

document.addEventListener("click", event => {
    if (portalAccountMenu && !event.target.closest(".admin-account")) {
        portalAccountMenu.hidden = true;
        portalAccountButton.setAttribute("aria-expanded", "false");
    }
    document.querySelectorAll(".status-picker-menu:not([hidden])").forEach(menu => {
        menu.hidden = true;
        menu.closest(".status-picker")
            ?.querySelector(".status-picker-trigger")
            ?.setAttribute("aria-expanded", "false");
    });
});

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.replace(ordersPortal ? "order-management-login.html" : "admin-login.html");
        return;
    }

    try {
        const userDoc = ordersPortal ? null : await getDoc(doc(db, "users", user.uid));
        const userData = ordersPortal ? user : userDoc?.exists() ? userDoc.data() : {};
        const isAdmin = userData.role === "admin";
        const hasOrdersAccess = isAdmin || (ordersPortal && userData.role === "orders");

        if (!hasOrdersAccess) {
            await signOut(auth);
            window.location.replace(ordersPortal ? "order-management-login.html?error=unauthorized" : "admin-login.html?error=unauthorized");
            return;
        }

        showDashboard(userData);
    } catch (error) {
        console.error("Unable to verify administrator access:", error);
        await signOut(auth);
        window.location.replace(ordersPortal ? "order-management-login.html?error=verification" : "admin-login.html?error=verification");
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

    if (!ordersPortal) {
        try {
            await publishBestsellers(snapshot.docs.map(orderDoc => orderDoc.data()));
        } catch (error) {
            console.error("Could not refresh the popular-products summary", error);
        }
    }

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
        let customerName = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || order.customer?.name || "Unknown Customer";
let customerEmail = order.customer?.email || "No email";

if (!ordersPortal) try {
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

const deliveryFee = Number(order.deliveryFee ?? order.delivery?.fee ?? 0);
const orderTotal = Number(order.total) || 0;
const orderSubtotal = Number(order.subtotal ?? Math.max(0, orderTotal - deliveryFee));

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

        <p><strong>Subtotal:</strong> UGX ${orderSubtotal.toLocaleString()}</p>
        <p><strong>Delivery:</strong> UGX ${deliveryFee.toLocaleString()}${order.delivery?.district ? ` to ${order.delivery.district}` : ""}</p>
        <p><strong>Total:</strong> UGX ${orderTotal.toLocaleString()}</p>
        ${order.delivery?.etaLabel ? `<p><strong>Delivery ETA:</strong> ${order.delivery.etaLabel}</p>` : ""}
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
        order.status = nextStatus;
        if (!ordersPortal) {
            try {
                await publishBestsellers(snapshot.docs.map(item =>
                    item.id === orderDoc.id
                        ? { ...item.data(), status: nextStatus }
                        : item.data()
                ));
            } catch (error) {
                console.error("Could not refresh the popular-products summary", error);
            }
        }
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

function showAdminToast(message, type = "success"){

    const toast = document.getElementById("admin-toast");
    if (!toast) return;

    clearTimeout(toast.timeout);
    toast.textContent = message;
    toast.className = type;
    void toast.offsetWidth;
    toast.classList.add("show");

    toast.timeout = setTimeout(() => {
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

document.querySelectorAll(".admin-side-nav [data-coming-soon]").forEach(button => {
    button.addEventListener("click", () => showAdminToast(`${button.dataset.comingSoon} management is the next workspace to connect.`));
});
