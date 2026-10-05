
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
    getManagementBootstrap,
    markCustomerCancellationSeen,
    reviewCustomerCancellation,
    updateOrderRefund,
    updateOrderTracking,
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
const dashboardOverview = document.getElementById("dashboard-overview");
const ordersContent = document.getElementById("orders-content");
const portalAccountButton = ordersPortal ? document.getElementById("admin-account-button") : null;
const portalAccountMenu = ordersPortal ? document.getElementById("admin-account-menu") : null;
const portalAccountEmail = ordersPortal ? document.getElementById("admin-account-email") : null;
const portalAccountInitials = ordersPortal ? document.getElementById("admin-account-initials") : null;
const portalSignout = ordersPortal ? document.getElementById("admin-signout") : null;
const statusConfirm = document.getElementById("admin-status-confirm");
const statusConfirmTitle = document.getElementById("admin-status-confirm-title");
const statusConfirmMessage = statusConfirm.querySelector(".admin-status-confirm-box > p");
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
        dashboardOverview.hidden = ordersSelected;
        ordersContent.hidden = !ordersSelected;
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
    statusConfirmTitle.textContent = "Update Order Status?";
    statusConfirmMessage.replaceChildren(
        "Are you sure you want to update this order to ",
        statusConfirmName,
        status === "Cancelled" ? "? If it has been paid, a full refund case will open automatically." : "?"
    );
    statusConfirmName.textContent = status;
    statusConfirmName.className = statusClass;
    statusConfirmApprove.className = `admin-status-approve ${statusClass}`;
    statusConfirmApprove.textContent = "Update Status";
    statusConfirm.hidden = false;

    return new Promise(resolve => {
        resolveStatusConfirmation = resolve;
    });
}

function confirmCustomerCancellationSeen(nextSeen) {
    const nextState = nextSeen ? "seen" : "unseen";
    statusConfirmTitle.textContent = nextSeen ? "Mark as Seen?" : "Mark as Unseen?";
    statusConfirmMessage.replaceChildren(
        "Are you sure you want to mark this customer cancellation as ",
        statusConfirmName,
        "?"
    );
    statusConfirmName.textContent = nextState;
    statusConfirmName.className = "cancelled";
    statusConfirmApprove.className = "admin-status-approve";
    statusConfirmApprove.textContent = nextSeen ? "Mark as Seen" : "Mark as Unseen";
    statusConfirm.hidden = false;

    return new Promise(resolve => {
        resolveStatusConfirmation = resolve;
    });
}

function confirmCustomerCancellationReview(decision) {
    const approving = decision === "approve";
    statusConfirmTitle.textContent = approving ? "Approve Cancellation?" : "Reject Cancellation?";
    statusConfirmMessage.replaceChildren(
        approving
            ? "Approve this customer cancellation request? The order will move to "
            : "Reject this customer cancellation request? The order will stay active.",
        approving ? statusConfirmName : "",
        approving ? "." : ""
    );
    statusConfirmName.textContent = "Cancelled";
    statusConfirmName.className = "cancelled";
    statusConfirmApprove.className = `admin-status-approve ${approving ? "cancelled" : ""}`;
    statusConfirmApprove.textContent = approving ? "Approve Cancellation" : "Reject Request";
    statusConfirm.hidden = false;

    return new Promise(resolve => {
        resolveStatusConfirmation = resolve;
    });
}

function refundAction(status) {
    const labels = {
        pending: ["Retry Refund?", "Return this refund to the pending queue?", "Retry Refund"],
        initiated: ["Initiate Refund?", "Confirm that the full refund has been submitted through Pesapal. The customer will see the estimated arrival date.", "Refund Initiated"],
        processing: ["Mark Refund Processing?", "Confirm that Pesapal is processing this refund.", "Mark Processing"],
        refunded: ["Complete Refund?", "Only confirm this after the full amount has been returned to the customer.", "Confirm Refunded"],
        failed: ["Mark Refund Failed?", "Mark this attempt as failed so it can be investigated or retried.", "Mark Failed"]
    };
    const [title, message, button] = labels[status];
    statusConfirmTitle.textContent = title;
    statusConfirmMessage.textContent = message;
    statusConfirmName.textContent = "";
    statusConfirmApprove.className = `admin-status-approve refund-${status}`;
    statusConfirmApprove.textContent = button;
    statusConfirm.hidden = false;
    return new Promise(resolve => { resolveStatusConfirmation = resolve; });
}

function refundDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString("en-UG", { day:"numeric", month:"short", year:"numeric" })
        : "—";
}

function refundPanel(refund) {
    if (!refund) return "";
    const status = String(refund.status || "pending").toLowerCase();
    const labels = { pending:"Pending initiation", initiated:"Initiated", processing:"Processing", refunded:"Refunded", failed:"Action required" };
    const actions = {
        pending:[["initiated", "Confirm initiated"], ["failed", "Mark failed"]],
        initiated:[["processing", "Mark processing"], ["refunded", "Confirm refunded"], ["failed", "Mark failed"]],
        processing:[["refunded", "Confirm refunded"], ["failed", "Mark failed"]],
        failed:[["pending", "Retry refund"]],
        refunded:[]
    };
    const dueLabel = status === "pending" ? "Initiate by" : status === "refunded" ? "Completed" : "Expected by";
    const dueValue = status === "pending" ? refund.initiationDueAt : status === "refunded" ? refund.completedAt : refund.expectedBy;
    return `<section class="admin-refund-panel" data-refund-status="${dashboardEscape(status)}">
        <div><p class="admin-refund-kicker">Full refund</p><h4>UGX ${Number(refund.amount || 0).toLocaleString()}</h4><span class="refund-status refund-${dashboardEscape(status)}">${dashboardEscape(labels[status] || status)}</span></div>
        <dl><div><dt>Return to</dt><dd>${dashboardEscape(refund.destination || "Original payment method")}</dd></div><div><dt>${dueLabel}</dt><dd>${refundDate(dueValue)}</dd></div>${refund.reference ? `<div><dt>Reference</dt><dd>${dashboardEscape(refund.reference)}</dd></div>` : ""}</dl>
        <div class="admin-refund-actions">${(actions[status] || []).map(([next, label]) => `<button type="button" data-refund-next="${next}">${label}</button>`).join("")}</div>
    </section>`;
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
    const firstName = String(profile.firstName || profile.displayName || auth.currentUser?.displayName || "").trim().split(/\s+/)[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const greetingElement = document.getElementById("dashboard-greeting");
    if (greetingElement) greetingElement.textContent = `${greeting}${firstName ? `, ${firstName}` : ""}`;
    const dateElement = document.getElementById("dashboard-date");
    if (dateElement) dateElement.textContent = new Intl.DateTimeFormat("en-UG", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    if (portalAccountEmail) portalAccountEmail.textContent = auth.currentUser?.email || "Orders account";
    if (portalAccountInitials) portalAccountInitials.textContent = (auth.currentUser?.email?.trim()?.[0] || "A").toUpperCase();
}

function dashboardEscape(value = "") {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function dashboardMoney(value) {
    return `UGX ${Math.round(Number(value) || 0).toLocaleString()}`;
}

function orderCreatedAt(order) {
    const value = order.createdAt?.toDate?.() || (order.createdAt ? new Date(order.createdAt) : null);
    return value && !Number.isNaN(value.getTime()) ? value : null;
}

const ORDER_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"];

function normalizedOrderStatus(value) {
    const match = ORDER_STATUSES.find(status => status.toLowerCase() === String(value || "").toLowerCase());
    return match || "Pending";
}

function safeOrderItems(order) {
    return Array.isArray(order?.items) ? order.items.filter(item => item && typeof item === "object") : [];
}

function renderDashboard(orders, products) {
    const inactiveRevenueStatuses = new Set(["cancelled", "returned"]);
    const activeOrders = orders.filter(order => !inactiveRevenueStatuses.has(String(order.status).toLowerCase()));
    const totalRevenue = activeOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const customers = new Set(orders.map(order => order.userId || order.customer?.email).filter(Boolean));
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const recentOrders = orders.filter(order => (orderCreatedAt(order)?.getTime() || 0) >= sevenDaysAgo.getTime());

    document.getElementById("total-orders").textContent = orders.length.toLocaleString();
    document.getElementById("total-revenue").textContent = dashboardMoney(totalRevenue);
    document.getElementById("average-order-value").textContent = dashboardMoney(activeOrders.length ? totalRevenue / activeOrders.length : 0);
    document.getElementById("total-customers").textContent = customers.size.toLocaleString();
    document.getElementById("orders-note").textContent = `${recentOrders.length} placed in the last 7 days`;

    const daily = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + index);
        const key = date.toISOString().slice(0, 10);
        const revenue = activeOrders.reduce((sum, order) => {
            const createdAt = orderCreatedAt(order);
            return createdAt?.toISOString().slice(0, 10) === key ? sum + (Number(order.total) || 0) : sum;
        }, 0);
        return { date, revenue };
    });
    const weekRevenue = daily.reduce((sum, day) => sum + day.revenue, 0);
    const maxRevenue = Math.max(...daily.map(day => day.revenue), 1);
    document.getElementById("week-revenue").textContent = dashboardMoney(weekRevenue);
    document.getElementById("sales-chart").innerHTML = daily.map(day => `<div class="sales-day"><div class="sales-bar-track"><i style="height:${Math.max(day.revenue ? 10 : 3, (day.revenue / maxRevenue) * 100)}%" title="${dashboardMoney(day.revenue)}"></i></div><span>${day.date.toLocaleDateString("en-UG", { weekday: "short" })}</span></div>`).join("");

    const statuses = ORDER_STATUSES;
    document.getElementById("order-pipeline").innerHTML = statuses.map(status => {
        const count = orders.filter(order => String(order.status).toLowerCase() === status.toLowerCase()).length;
        const share = orders.length ? Math.round((count / orders.length) * 100) : 0;
        return `<a href="admin.html#orders" class="pipeline-row"><i class="pipeline-dot ${status.toLowerCase()}"></i><span>${status}</span><div><b style="width:${share}%"></b></div><strong>${count}</strong></a>`;
    }).join("");

    const latest = [...orders].sort((a, b) => (orderCreatedAt(b)?.getTime() || 0) - (orderCreatedAt(a)?.getTime() || 0)).slice(0, 5);
    document.getElementById("dashboard-recent-orders").innerHTML = latest.length ? latest.map(order => {
        const customer = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || order.customer?.name || "Customer";
        const createdAt = orderCreatedAt(order);
        return `<a href="admin.html#orders" class="dashboard-order-row"><div class="dashboard-order-avatar">${dashboardEscape(customer.charAt(0).toUpperCase() || "C")}</div><div><strong>${dashboardEscape(customer)}</strong><small>#${dashboardEscape(String(order.id).slice(0, 8).toUpperCase())} · ${createdAt ? createdAt.toLocaleDateString("en-UG", { day: "numeric", month: "short" }) : "No date"}</small></div><span class="dashboard-status ${dashboardEscape(String(order.status).toLowerCase())}">${dashboardEscape(order.status || "Pending")}</span><b>${dashboardMoney(order.total)}</b></a>`;
    }).join("") : '<div class="dashboard-empty">No orders yet.</div>';

    const productTotals = new Map();
    activeOrders.forEach(order => (Array.isArray(order.items) ? order.items : []).forEach(item => {
        const key = String(item.id || item.title || "product");
        const current = productTotals.get(key) || { title: item.title || "Product", image: item.image || "", units: 0, revenue: 0 };
        const quantity = Math.max(1, Number(item.quantity) || 1);
        current.units += quantity;
        current.revenue += (Number(item.price) || 0) * quantity;
        productTotals.set(key, current);
    }));
    const topProducts = [...productTotals.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 5);
    document.getElementById("dashboard-top-products").innerHTML = topProducts.length ? topProducts.map((product, index) => `<div class="dashboard-product-row"><span class="product-rank">${index + 1}</span><img src="${dashboardEscape(window.normalizeMPWRImagePath?.(product.image) || product.image || "images/MPWR Logo.PNG")}" alt=""><div><strong>${dashboardEscape(product.title)}</strong><small>${product.units} unit${product.units === 1 ? "" : "s"} ordered</small></div><b>${dashboardMoney(product.revenue)}</b></div>`).join("") : '<div class="dashboard-empty">Sales will appear here after the first order.</div>';

    const lowStock = products.filter(product => product.active !== false && product.stock !== undefined && Number(product.stock) <= 5).sort((a, b) => Number(a.stock) - Number(b.stock)).slice(0, 5);
    document.getElementById("dashboard-inventory").innerHTML = lowStock.length ? lowStock.map(product => `<a href="admin-products.html" class="inventory-row"><img src="${dashboardEscape(product.image || product.imageUrl || "images/MPWR Logo.PNG")}" alt=""><div><strong>${dashboardEscape(product.title || "Product")}</strong><small>${Number(product.stock) === 0 ? "Out of stock" : `${Number(product.stock)} remaining`}</small></div><span class="${Number(product.stock) === 0 ? "out" : "low"}">${Number(product.stock) === 0 ? "Restock" : "Low"}</span></a>`).join("") : '<div class="dashboard-empty success">Inventory levels look healthy.</div>';
    dashboardOverview.classList.remove("is-loading");
    dashboardOverview.removeAttribute("aria-busy");
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

document.getElementById("total-orders")?.replaceChildren("...");
document.getElementById("pending-orders")?.replaceChildren("...");
document.getElementById("processing-orders")?.replaceChildren("...");
document.getElementById("shipped-orders")?.replaceChildren("...");
document.getElementById("delivered-orders")?.replaceChildren("...");
document.getElementById("cancelled-orders")?.replaceChildren("...");
document.getElementById("returned-orders")?.replaceChildren("...");
document.getElementById("total-revenue")?.replaceChildren("Loading...");
document.getElementById("total-customers")?.replaceChildren("...");

    await loadOrdersWithFeedback();
});


async function loadOrdersWithFeedback() {
    try {
        await loadAllOrders();
    } catch (error) {
        console.error("Unable to load management orders:", error);
        dashboardOverview?.classList.remove("is-loading");
        dashboardOverview?.removeAttribute("aria-busy");
        ordersList.innerHTML = `<div class="orders-error-state"><strong>Orders could not be loaded</strong><span>${dashboardEscape(error?.message || "Please check the management API and try again.")}</span><button type="button">Try again</button></div>`;
        ordersList.querySelector("button")?.addEventListener("click", loadOrdersWithFeedback, { once: true });
        showAdminToast("Orders could not be loaded. Please try again.", "error");
    }
}


async function loadAllOrders() {
    /*LOADING DASBOARD*/
ordersList.innerHTML = `
    <div class="loading-dashboard">
        <div class="loading-spinner"></div>
        <p>Loading orders...</p>
    </div>
`;

    const [snapshot, management] = await Promise.all([
        getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"))),
        ordersPortal ? Promise.resolve({ products: [] }) : getManagementBootstrap(db).catch(() => ({ products: [] }))
    ]);

    if (!ordersPortal) {
        try {
            await publishBestsellers(snapshot.docs.map(orderDoc => orderDoc.data()));
        } catch (error) {
            console.error("Could not refresh the popular-products summary", error);
        }
    }

    ordersList.innerHTML = "";
    const dashboardOrders = snapshot.docs.map(orderDoc => ({ id: orderDoc.id, ...orderDoc.data() }));
    let totalOrders = 0;
    let pendingOrders = 0;
    const portalStatusCounts = {
        Processing: 0,
        Shipped: 0,
        Delivered: 0,
        Cancelled: 0,
        Returned: 0
    };
    let totalRevenue = 0;
    const customers = new Set();

for (const orderDoc of snapshot.docs) {

        const order = orderDoc.data();
        const apiOrderId = String(order.id || order.apiId || orderDoc.id);
        const status = normalizedOrderStatus(order.status);
        const items = safeOrderItems(order);
        const createdAt = orderCreatedAt(order);
        const orderDate = createdAt ? createdAt.toLocaleString("en-UG") : "Unknown";
        const itemCount = items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
        order.status = status;
        const cancelledByCustomer = status === "Cancelled" && (
            order.cancelledBy === "customer" ||
            order.cancellationSource === "customer" ||
            order.delivery?.cancellationSource === "customer"
        );
        const cancellationRequest = order.delivery?.cancellationRequest;
        const cancellationPending = status !== "Cancelled" && cancellationRequest?.status === "pending" && cancellationRequest?.source === "customer";
        const cancellationReviewed = ["approved", "rejected"].includes(String(cancellationRequest?.status || ""));
        const customerCancellationSeen = Boolean(order.delivery?.cancellationSeenAt);
        const refund = order.delivery?.refund || null;
        const itemsHTML = items.length ? items.map(item => {
            const selections = item.selectedOptions && typeof item.selectedOptions === "object"
                ? Object.values(item.selectedOptions).filter(value => typeof value !== "object" && String(value).trim()).join(" • ")
                : [item.color, item.size].filter(Boolean).join(" • ");
            const image = window.normalizeMPWRImagePath?.(item.image, item.id) || item.image || "images/MPWR Logo.PNG";
            return `
    <div class="admin-order-item">

        <img
            src="${dashboardEscape(image)}"
            class="admin-order-image"
            alt="${dashboardEscape(item.title || "Ordered product")}" loading="lazy"
        >

        <div class="admin-order-details">

            <h4>${dashboardEscape(item.title || "Product")}</h4>

            ${selections ? `<p>${dashboardEscape(selections)}</p>` : ""}

            <p>Qty: ${Math.max(1, Number(item.quantity) || 1)}</p>

        </div>

    </div>
`;
        }).join("") : '<p class="admin-order-items-empty">No item details are available for this order.</p>';
        let customerName = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || order.customer?.name || "Unknown Customer";
let customerEmail = order.customer?.email || "No email";

        totalOrders++;

if (status === "Pending") {
    pendingOrders++;
}

if (cancellationPending) {
    portalStatusCounts.Cancelled++;
} else if (status === "Cancelled") {
    if (cancelledByCustomer && !customerCancellationSeen) portalStatusCounts.Cancelled++;
} else if (Object.hasOwn(portalStatusCounts, status)) {
    portalStatusCounts[status]++;
}

totalRevenue += Number(order.total) || 0;

const deliveryFee = Number(order.deliveryFee ?? order.delivery?.fee ?? 0);
const orderTotal = Number(order.total) || 0;
const orderSubtotal = Number(order.subtotal ?? Math.max(0, orderTotal - deliveryFee));
const trackingNumber = String(order.trackingNumber || "");
const shippingCarrier = String(order.shippingCarrier || "");
const trackingUrl = String(order.trackingUrl || "");

if (order.userId) {
    customers.add(order.userId);
}

        const orderCard = document.createElement("div");
        const statusBadge = `
    <span class="status-badge ${status.toLowerCase()}${cancelledByCustomer ? " customer-cancelled" : ""}">
        ${cancelledByCustomer ? "Cancelled by customer" : status}
    </span>
`;
        orderCard.className = "order-card";
        
orderCard.innerHTML = `
<div class="order-header">

    <div class="order-info">

        <h3>Order #${dashboardEscape(String(orderDoc.id).slice(0,8).toUpperCase())}</h3>

        <p><strong>Customer:</strong> ${dashboardEscape(customerName)}</p>
        <p><strong>Email:</strong> ${dashboardEscape(customerEmail)}</p>

        <p><strong>Subtotal:</strong> UGX ${orderSubtotal.toLocaleString()}</p>
        <p><strong>Delivery:</strong> UGX ${deliveryFee.toLocaleString()}${order.delivery?.district ? ` to ${dashboardEscape(order.delivery.district)}` : ""}</p>
        <p><strong>Total:</strong> UGX ${orderTotal.toLocaleString()}</p>
        ${order.delivery?.etaLabel ? `<p><strong>Delivery ETA:</strong> ${dashboardEscape(order.delivery.etaLabel)}</p>` : ""}
        <p><strong>Order Date:</strong> ${dashboardEscape(orderDate)}</p>
        <p><strong>Items:</strong> ${itemCount}</p>

    </div>

    <div class="order-actions">

    <div class="status-section">

    ${statusBadge}

    <div class="status-picker${cancelledByCustomer ? " is-customer-cancelled" : ""}">
        <button class="status-picker-trigger" type="button" data-status="${status}" aria-expanded="false"${cancelledByCustomer ? ' aria-label="Customer-cancelled order status options are locked"' : ""}${cancellationPending ? " disabled" : ""}>
            ${status}<span aria-hidden="true">⌄</span>
        </button>
        <div class="status-picker-menu" hidden>
            ${ORDER_STATUSES.map(optionStatus => `
                <button type="button" data-status="${optionStatus}" class="${status === optionStatus ? "selected" : ""}"${cancelledByCustomer || cancellationPending ? " disabled aria-disabled=\"true\"" : ""}>
                    ${optionStatus}
                </button>
            `).join("")}
        </div>
    </div>
    ${cancelledByCustomer && !cancellationReviewed ? `<button class="customer-cancellation-seen" type="button" data-seen="${customerCancellationSeen}" aria-label="${customerCancellationSeen ? "Mark as unseen" : "Mark as seen"}"><span>${customerCancellationSeen ? "Mark as unseen" : "Mark as seen"}</span><img src="images/Icon Folder/${customerCancellationSeen ? "Password Hidden Icon_333.PNG" : "Password Visible Icon_333 .PNG"}" alt=""></button>` : ""}
    ${cancellationPending ? `<div class="customer-cancellation-review"><small>Cancellation requested</small><div><button type="button" data-cancellation-review="approve">Approve</button><button type="button" data-cancellation-review="reject">Reject</button></div></div>` : ""}

            </div>

    </div>

    <button class="toggle-items-btn">
        View Items
    </button>

</div>

<form class="admin-tracking-panel" aria-label="Shipment tracking">
    <div class="admin-tracking-heading"><div><small>Shipment tracking</small><h4>${trackingNumber ? "Tracking assigned" : "Add tracking details"}</h4></div>${order.shippedAt ? `<span>Shipped ${dashboardEscape(new Date(order.shippedAt.toDate?.() || order.shippedAt).toLocaleDateString("en-UG"))}</span>` : ""}</div>
    <div class="admin-tracking-fields">
        <label>Tracking number<input name="trackingNumber" maxlength="120" value="${dashboardEscape(trackingNumber)}" placeholder="e.g. MPWR-482910" required></label>
        <label>Carrier / courier<input name="shippingCarrier" maxlength="120" value="${dashboardEscape(shippingCarrier)}" placeholder="e.g. SafeBoda"></label>
        <label>Tracking link<input name="trackingUrl" type="url" maxlength="1000" value="${dashboardEscape(trackingUrl)}" placeholder="https://..."></label>
        <button type="submit">${trackingNumber ? "Update tracking" : "Save tracking"}</button>
    </div>
</form>

${refundPanel(refund)}

<div class="admin-order-items">

    ${itemsHTML}

</div>

<hr>
`;

        orderCard.dataset.orderId = orderDoc.id.toUpperCase();
        orderCard.dataset.customer = `${customerName} ${customerEmail}`.toUpperCase();
        orderCard.dataset.status = status;

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
        const cancellationSeenButton = orderCard.querySelector(".customer-cancellation-seen");
        const cancellationReviewButtons = orderCard.querySelectorAll("[data-cancellation-review]");
        const trackingForm = orderCard.querySelector(".admin-tracking-panel");
        trackingForm.addEventListener("submit", async event => {
            event.preventDefault();
            const submit = trackingForm.querySelector('button[type="submit"]');
            const data = new FormData(trackingForm);
            submit.disabled = true;
            try {
                await updateOrderTracking(apiOrderId, {
                    trackingNumber: String(data.get("trackingNumber") || ""),
                    shippingCarrier: String(data.get("shippingCarrier") || ""),
                    trackingUrl: String(data.get("trackingUrl") || "")
                }, db);
                showAdminToast("Shipment tracking saved");
                await loadOrdersWithFeedback();
            } catch (error) {
                console.error("Unable to save shipment tracking:", error);
                showAdminToast(error?.message || "Shipment tracking could not be saved.", "error");
                submit.disabled = false;
            }
        });
        orderCard.querySelectorAll("[data-refund-next]").forEach(button => {
            button.addEventListener("click", async () => {
                const nextStatus = button.dataset.refundNext;
                if (!await refundAction(nextStatus)) return;
                orderCard.querySelectorAll("[data-refund-next]").forEach(item => { item.disabled = true; });
                try {
                    await updateOrderRefund(apiOrderId, nextStatus, db);
                    showAdminToast(nextStatus === "refunded" ? "Refund marked as completed" : "Refund status updated");
                    await loadOrdersWithFeedback();
                } catch (error) {
                    console.error("Unable to update refund:", error);
                    showAdminToast(error.message || "Could not update the refund", "error");
                    orderCard.querySelectorAll("[data-refund-next]").forEach(item => { item.disabled = false; });
                }
            });
        });

if (cancellationSeenButton) {
    cancellationSeenButton.addEventListener("click", async () => {
        const wasSeen = cancellationSeenButton.dataset.seen === "true";
        const nextSeen = !wasSeen;
        if (!await confirmCustomerCancellationSeen(nextSeen)) return;
        cancellationSeenButton.disabled = true;
        try {
            await markCustomerCancellationSeen(apiOrderId, nextSeen, db);
            cancellationSeenButton.dataset.seen = String(nextSeen);
            const nextLabel = nextSeen ? "Mark as unseen" : "Mark as seen";
            cancellationSeenButton.setAttribute("aria-label", nextLabel);
            cancellationSeenButton.querySelector("span").textContent = nextLabel;
            cancellationSeenButton.querySelector("img").src = `images/Icon Folder/${nextSeen ? "Password Hidden Icon_333.PNG" : "Password Visible Icon_333 .PNG"}`;
            const count = document.getElementById("cancelled-orders");
            if (count) count.textContent = String(Math.max(0, (Number(count.textContent) || 0) + (nextSeen ? -1 : 1)));
            showAdminToast(`Customer cancellation marked as ${nextSeen ? "seen" : "unseen"}`);
        } catch (error) {
            console.error("Unable to mark customer cancellation as seen:", error);
            cancellationSeenButton.disabled = false;
            showAdminToast(error.message || "Could not mark cancellation as seen", "error");
        } finally {
            cancellationSeenButton.disabled = false;
        }
    });
}

cancellationReviewButtons.forEach(button => {
    button.addEventListener("click", async () => {
        const decision = button.dataset.cancellationReview;
        if (!await confirmCustomerCancellationReview(decision)) return;
        cancellationReviewButtons.forEach(item => { item.disabled = true; });
        try {
            await reviewCustomerCancellation(apiOrderId, decision, db);
            showAdminToast(decision === "approve" ? "Cancellation approved" : "Cancellation request rejected");
            await loadOrdersWithFeedback();
        } catch (error) {
            console.error("Unable to review cancellation request:", error);
            showAdminToast(error.message || "Could not update the cancellation request", "error");
            cancellationReviewButtons.forEach(item => { item.disabled = false; });
        }
    });
});

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
    if (cancelledByCustomer || cancellationPending) return;
    const nextStatus = option.dataset.status;
    const previousStatus = order.status;

    statusMenu.hidden = true;
    statusTrigger.setAttribute("aria-expanded", "false");

    if (nextStatus === previousStatus) return;
    if (!await confirmStatusChange(nextStatus)) return;

    statusTrigger.disabled = true;

    try {
        await updateDoc(doc(db, "orders", apiOrderId), { status: nextStatus });
        order.status = nextStatus;
    if (nextStatus === "Cancelled") {
            showAdminToast("Order cancelled. Any completed payment is now in the refund queue.");
            await loadOrdersWithFeedback();
            return;
        }
        if (!ordersPortal) {
            const dashboardOrder = dashboardOrders.find(item => String(item.id) === apiOrderId);
            if (dashboardOrder) dashboardOrder.status = nextStatus;
            renderDashboard(dashboardOrders, management.products || []);
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
    } catch (error) {
        console.error("Unable to update order status:", error);
        showAdminToast(error?.message || "The order status could not be updated.", "error");
        return;
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

const updateStatusPanel = (statusName, change) => {
    // Customer cancellations are counted when orders reload from the API.
    // Status changes made by staff must not affect this customer-only total.
    if (statusName === "Cancelled") return;
    const element = document.getElementById(`${statusName.toLowerCase()}-orders`);
    if (!element) return;
    element.textContent = String(Math.max(0, (Number(element.textContent) || 0) + change));
};

updateStatusPanel(previousStatus, -1);
updateStatusPanel(nextStatus, 1);
order.status = nextStatus;
filterOrders();
showAdminToast("Order status updated successfully");

});
});
    }

    document.getElementById("total-orders")?.replaceChildren(String(totalOrders));
    document.getElementById("pending-orders")?.replaceChildren(String(pendingOrders));
    document.getElementById("processing-orders")?.replaceChildren(String(portalStatusCounts.Processing));
    document.getElementById("shipped-orders")?.replaceChildren(String(portalStatusCounts.Shipped));
    document.getElementById("delivered-orders")?.replaceChildren(String(portalStatusCounts.Delivered));
    document.getElementById("cancelled-orders")?.replaceChildren(String(portalStatusCounts.Cancelled));
    document.getElementById("returned-orders")?.replaceChildren(String(portalStatusCounts.Returned));
    document.getElementById("total-revenue")?.replaceChildren(`UGX ${totalRevenue.toLocaleString()}`);
    document.getElementById("total-customers")?.replaceChildren(String(customers.size));

    if (!ordersPortal) renderDashboard(dashboardOrders, management.products || []);

    filterOrders();

    if (!snapshot.docs.length) {
        ordersList.innerHTML = '<div class="orders-empty-state"><strong>No orders yet</strong><span>New customer orders will appear here.</span></div>';
    }

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
