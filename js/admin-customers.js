import { onAuthStateChanged, signOut } from "./auth-api.js";
import { collection, doc, getDoc, getDocs } from "./firestore-api.js";
import { adminAuth, adminDb } from "./admin-firebase.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = value => `UGX ${Math.round(Number(value) || 0).toLocaleString()}`;
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const dateValue = value => {
    if (!value) return null;
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};
const orderDate = order => dateValue(order.createdAt || order.orderDate || order.updatedAt);
const formatDate = value => value ? value.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "—";

let customers = [];
let activeSegment = "all";

function customerIdentity(order) {
    const detail = order.customer || order.delivery?.customer || {};
    const email = String(detail.email || order.email || "").trim().toLowerCase();
    const phone = String(detail.phone || order.phone || order.delivery?.phone || "").trim();
    return String(order.userId || email || phone || `guest-${order.id}`);
}

function customerName(order) {
    const detail = order.customer || order.delivery?.customer || {};
    return String(detail.name || [detail.firstName, detail.lastName].filter(Boolean).join(" ") || order.customerName || detail.email || "Customer").trim();
}

function buildCustomers(orders) {
    const grouped = new Map();
    orders.forEach(order => {
        const key = customerIdentity(order);
        const detail = order.customer || order.delivery?.customer || {};
        const customer = grouped.get(key) || { id: key, name: customerName(order), email: detail.email || order.email || "", phone: detail.phone || order.phone || order.delivery?.phone || "", orders: [], spend: 0, firstOrder: null, lastOrder: null };
        const placed = orderDate(order);
        customer.name = customer.name === "Customer" ? customerName(order) : customer.name;
        customer.email ||= detail.email || order.email || "";
        customer.phone ||= detail.phone || order.phone || order.delivery?.phone || "";
        customer.orders.push(order);
        if (String(order.status || "").toLowerCase() !== "cancelled") customer.spend += Number(order.total || order.grandTotal || 0);
        if (placed && (!customer.firstOrder || placed < customer.firstOrder)) customer.firstOrder = placed;
        if (placed && (!customer.lastOrder || placed > customer.lastOrder)) customer.lastOrder = placed;
        grouped.set(key, customer);
    });
    const now = Date.now();
    return [...grouped.values()].map(customer => {
        const age = customer.lastOrder ? now - customer.lastOrder.getTime() : Infinity;
        customer.segment = customer.orders.length > 1 ? "repeat" : age <= 30 * 86400000 ? "new" : age > 90 * 86400000 ? "inactive" : "new";
        return customer;
    });
}

function filteredCustomers() {
    const term = $("#customer-search").value.trim().toLowerCase();
    const sort = $("#customer-sort").value;
    const filtered = customers.filter(customer => (activeSegment === "all" || customer.segment === activeSegment) && [customer.name, customer.email, customer.phone].some(value => String(value).toLowerCase().includes(term)));
    filtered.sort((a, b) => sort === "value" ? b.spend - a.spend : sort === "orders" ? b.orders.length - a.orders.length : sort === "name" ? a.name.localeCompare(b.name) : (b.lastOrder?.getTime() || 0) - (a.lastOrder?.getTime() || 0));
    return filtered;
}

function initials(name) { return String(name || "C").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }

function renderCustomers() {
    const rows = filteredCustomers();
    $("#customer-result-copy").textContent = `${rows.length.toLocaleString()} customer${rows.length === 1 ? "" : "s"}`;
    $("#customer-empty").hidden = rows.length > 0;
    $("#customer-list").innerHTML = rows.map(customer => `<tr data-customer-id="${escapeHtml(customer.id)}"><td><div class="customer-cell"><span class="customer-avatar">${escapeHtml(initials(customer.name))}</span><div><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.email || customer.phone || "No contact details")}</small></div></div></td><td>${customer.orders.length.toLocaleString()}</td><td><strong>${money(customer.spend)}</strong></td><td>${formatDate(customer.lastOrder)}</td><td><span class="customer-segment ${customer.segment}">${customer.segment === "repeat" ? "Repeat buyer" : customer.segment === "inactive" ? "Inactive" : "New customer"}</span></td><td><button class="customer-view" type="button">View</button></td></tr>`).join("");
}

function renderMetrics() {
    const repeat = customers.filter(customer => customer.orders.length > 1).length;
    const active = customers.filter(customer => customer.lastOrder && Date.now() - customer.lastOrder.getTime() <= 30 * 86400000).length;
    const totalSpend = customers.reduce((sum, customer) => sum + customer.spend, 0);
    $("#customer-total").textContent = customers.length.toLocaleString();
    $("#customer-repeat").textContent = repeat.toLocaleString();
    $("#customer-repeat-rate").textContent = `${customers.length ? Math.round(repeat / customers.length * 100) : 0}% return rate`;
    $("#customer-active").textContent = active.toLocaleString();
    $("#customer-value").textContent = money(customers.length ? totalSpend / customers.length : 0);
}

function openCustomer(customer) {
    if (!customer) return;
    const sortedOrders = [...customer.orders].sort((a, b) => (orderDate(b)?.getTime() || 0) - (orderDate(a)?.getTime() || 0));
    const average = customer.orders.length ? customer.spend / customer.orders.length : 0;
    $("#customer-drawer-content").innerHTML = `<section class="customer-drawer-profile"><span class="customer-avatar">${escapeHtml(initials(customer.name))}</span><h2 id="customer-drawer-name">${escapeHtml(customer.name)}</h2><p>${escapeHtml(customer.email || customer.phone || "Customer account")}</p></section><section class="customer-drawer-stats"><div><strong>${customer.orders.length}</strong><span>Orders</span></div><div><strong>${money(customer.spend)}</strong><span>Lifetime spend</span></div><div><strong>${money(average)}</strong><span>Average order</span></div></section><section class="customer-detail-section"><h3>Contact details</h3><div class="customer-contact-row"><span>Email</span><strong>${escapeHtml(customer.email || "Not provided")}</strong></div><div class="customer-contact-row"><span>Phone</span><strong>${escapeHtml(customer.phone || "Not provided")}</strong></div><div class="customer-contact-row"><span>Customer since</span><strong>${formatDate(customer.firstOrder)}</strong></div></section><section class="customer-detail-section"><h3>Order history</h3><div class="customer-order-history">${sortedOrders.map(order => `<div class="customer-order-row"><div><strong>#${escapeHtml(String(order.id || "").slice(0, 8).toUpperCase())}</strong><small>${formatDate(orderDate(order))}</small></div><div><b>${money(order.total || order.grandTotal)}</b><em>${escapeHtml(order.status || "Pending")}</em></div></div>`).join("")}</div></section>`;
    $("#customer-drawer-overlay").classList.add("active");
    $("#customer-drawer-overlay").setAttribute("aria-hidden", "false");
    document.body.classList.add("customer-drawer-open");
}

function closeCustomer() {
    $("#customer-drawer-overlay").classList.remove("active");
    $("#customer-drawer-overlay").setAttribute("aria-hidden", "true");
    document.body.classList.remove("customer-drawer-open");
}

function exportCsv() {
    const rows = [["Name", "Email", "Phone", "Orders", "Lifetime spend (UGX)", "Last order", "Segment"], ...filteredCustomers().map(customer => [customer.name, customer.email, customer.phone, customer.orders.length, Math.round(customer.spend), customer.lastOrder?.toISOString() || "", customer.segment])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `mpwr-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

$("#customer-search").addEventListener("input", renderCustomers);
$("#customer-sort").addEventListener("change", renderCustomers);
$("#export-customers").addEventListener("click", exportCsv);
$("#customer-list").addEventListener("click", event => openCustomer(customers.find(customer => customer.id === event.target.closest("tr")?.dataset.customerId)));
$$('[data-segment]').forEach(button => button.addEventListener("click", () => { activeSegment = button.dataset.segment; $$('[data-segment]').forEach(item => item.classList.toggle("active", item === button)); renderCustomers(); }));
$(".customer-drawer-close").addEventListener("click", closeCustomer);
$("#customer-drawer-overlay").addEventListener("click", event => { if (event.target === event.currentTarget) closeCustomer(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeCustomer(); });

onAuthStateChanged(adminAuth, async user => {
    if (!user) return void window.location.replace("admin-login.html");
    try {
        if (user.role !== "admin") {
            const profile = await getDoc(doc(adminDb, "users", user.uid));
            if (!profile.exists() || profile.data().role !== "admin") {
                await signOut(adminAuth);
                return void window.location.replace("admin-login.html?error=unauthorized");
            }
        }
        const snapshot = await getDocs(collection(adminDb, "orders"));
        customers = buildCustomers(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
        renderMetrics();
        renderCustomers();
        $("#customers-app").hidden = false;
        $("#customers-loading").remove();
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    } catch (error) {
        $("#customers-loading").classList.add("error");
        $("#customers-loading p").textContent = error?.message || "Unable to open the customer directory.";
    }
});
