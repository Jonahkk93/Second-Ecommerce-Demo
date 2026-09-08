import { onAuthStateChanged, signOut } from "./auth-api.js";
import { doc, getDoc } from "./firestore-api.js";
import { adminAuth, adminDb } from "./admin-firebase.js";

const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_ROOT = window.MPWR_API_URL || (localHost ? "http://127.0.0.1:3000/v1" : "/api/v1");
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const statusColours = { pending: "#f2ad4b", processing: "#578ee9", shipped: "#8c65df", delivered: "#31ad76", cancelled: "#d95c5c" };
const categoryLabels = { "press-ons": "Press-On Nails", wigs: "Wigs", lashes: "Lashes", products: "Products", polish: "Nail Polish" };
let report = null;
let toastTimer;

function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function money(value) { return `UGX ${Math.round(Number(value) || 0).toLocaleString()}`; }
function compactMoney(value) { return `UGX ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0)}`; }

function showToast(message, type = "success") {
    const toast = $(".admin-products-toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "admin-products-toast";
    toast.classList.add(type === "error" ? "warning" : type);
    void toast.offsetWidth;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function renderChange(element, change) {
    const number = Number(change) || 0;
    element.className = number > 0 ? "change-up" : number < 0 ? "change-down" : "change-flat";
    element.textContent = `${number > 0 ? "↑" : number < 0 ? "↓" : "–"} ${Math.abs(number)}% vs previous period`;
}

function lineChart(host, series, valueKey, gradientId) {
    const values = series.map(point => Number(point[valueKey]) || 0);
    if (!values.some(Boolean)) {
        host.innerHTML = '<div class="chart-empty">No activity in this reporting period.</div>';
        return;
    }
    const width = 700, height = 245, left = 42, right = 12, top = 15, bottom = 32;
    const chartWidth = width - left - right, chartHeight = height - top - bottom;
    const max = Math.max(...values, 1);
    const points = values.map((value, index) => ({ x: left + (index / Math.max(values.length - 1, 1)) * chartWidth, y: top + chartHeight - (value / max) * chartHeight }));
    const pointString = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const area = `${left},${top + chartHeight} ${pointString} ${left + chartWidth},${top + chartHeight}`;
    const labelIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
    const labels = labelIndexes.map(index => `<text class="chart-label" x="${points[index].x}" y="${height - 7}" text-anchor="${index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}">${new Date(`${series[index].date}T00:00:00`).toLocaleDateString("en-UG", { day: "numeric", month: "short" })}</text>`).join("");
    const grid = [0, .25, .5, .75, 1].map(ratio => { const y = top + chartHeight * ratio; const value = Math.round(max * (1 - ratio)); return `<line class="chart-grid-line" x1="${left}" x2="${left + chartWidth}" y1="${y}" y2="${y}"/><text class="chart-label" x="${left - 7}" y="${y + 3}" text-anchor="end">${valueKey === "revenue" ? Intl.NumberFormat("en", { notation: "compact" }).format(value) : value}</text>`; }).join("");
    const dots = points.filter((_, index) => series.length <= 31 || index % Math.ceil(series.length / 24) === 0).map(point => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="3"/>`).join("");
    host.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(valueKey)} over time"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5a484" stop-opacity=".3"/><stop offset="1" stop-color="#e5a484" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#${gradientId})"/><polyline class="chart-line" points="${pointString}"/>${dots}${labels}</svg>`;
}

function renderStatuses(statuses) {
    const total = statuses.reduce((sum, item) => sum + item.count, 0);
    let cursor = 0;
    const segments = statuses.map(item => {
        const start = cursor;
        cursor += total ? (item.count / total) * 100 : 0;
        return `${statusColours[item.status]} ${start}% ${cursor}%`;
    });
    $("#status-donut").style.background = total ? `conic-gradient(${segments.join(",")})` : "#eee";
    $("#status-total").textContent = total;
    $("#status-legend").innerHTML = statuses.map(item => `<div><i style="background:${statusColours[item.status]}"></i><span>${escapeHtml(item.status)}</span><b>${item.count}</b></div>`).join("");
}

function renderCategories(categories) {
    if (!categories.length) return void ($("#category-bars").innerHTML = '<div class="analytics-empty">No category sales yet.</div>');
    const max = Math.max(...categories.map(item => item.value), 1);
    $("#category-bars").innerHTML = categories.slice(0, 7).map(item => `<div class="category-row"><span>${escapeHtml(categoryLabels[item.category] || item.category)}</span><div class="bar-track"><i style="width:${(item.value / max) * 100}%"></i></div><strong>${compactMoney(item.value)}</strong></div>`).join("");
}

function renderTables(data) {
    const totalRevenue = Math.max(Number(data.metrics.revenue.value) || 0, 1);
    $("#top-products").innerHTML = data.topProducts.length ? data.topProducts.map(product => `<tr><td><div class="product-cell"><img src="${escapeHtml(product.image || "images/MPWR Logo.PNG")}" alt=""><span>${escapeHtml(product.title)}</span></div></td><td>${product.units}</td><td>${money(product.revenue)}</td><td>${((product.revenue / totalRevenue) * 100).toFixed(1)}%</td></tr>`).join("") : '<tr><td colspan="4">No product sales in this period.</td></tr>';
    $("#recent-orders").innerHTML = data.recentOrders.length ? data.recentOrders.map(order => `<tr><td>#${escapeHtml(order.id)}</td><td>${escapeHtml(order.customer)}</td><td>${money(order.total)}</td><td><span class="analytics-status ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span></td></tr>`).join("") : '<tr><td colspan="4">No recent orders.</td></tr>';
}

function renderReport(data) {
    report = data;
    const metrics = data.metrics;
    $("#metric-revenue").textContent = money(metrics.revenue.value);
    $("#metric-orders").textContent = Number(metrics.orders.value).toLocaleString();
    $("#metric-aov").textContent = money(metrics.averageOrderValue.value);
    $("#metric-fulfilment").textContent = `${metrics.fulfilmentRate.value}%`;
    $("#metric-customers").textContent = Number(metrics.customers.value).toLocaleString();
    renderChange($("#change-revenue"), metrics.revenue.change);
    renderChange($("#change-orders"), metrics.orders.change);
    renderChange($("#change-aov"), metrics.averageOrderValue.change);
    renderChange($("#change-fulfilment"), metrics.fulfilmentRate.change);
    renderChange($("#change-customers"), metrics.customers.change);
    const first = data.revenueSeries[0]?.date;
    const last = data.revenueSeries.at(-1)?.date;
    $("#report-period").textContent = first && last ? `${new Date(`${first}T00:00:00`).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(`${last}T00:00:00`).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}` : `Last ${data.rangeDays} days`;
    $("#revenue-total-label").textContent = money(metrics.revenue.value);
    lineChart($("#revenue-chart"), data.revenueSeries, "revenue", "revenue-gradient");
    lineChart($("#orders-chart"), data.revenueSeries, "orders", "orders-gradient");
    renderStatuses(data.orderStatuses);
    renderCategories(data.categorySales);
    renderTables(data);
}

async function loadReport() {
    const range = $("#analytics-range").value;
    $("#analytics-range").disabled = true;
    try {
        const response = await fetch(`${API_ROOT}/admin/analytics?range=${encodeURIComponent(range)}`, { credentials: "include" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || `Analytics request failed (${response.status})`);
        renderReport(payload);
    } catch (error) {
        showToast(error?.message || "Unable to load analytics.", "error");
    } finally {
        $("#analytics-range").disabled = false;
    }
}

function exportCsv() {
    if (!report) return;
    const rows = [
        ["MPWR Analytics Report", `${report.rangeDays} days`],
        ["Metric", "Value", "Change vs previous period"],
        ["Revenue", report.metrics.revenue.value, `${report.metrics.revenue.change}%`],
        ["Orders", report.metrics.orders.value, `${report.metrics.orders.change}%`],
        ["Average order value", report.metrics.averageOrderValue.value, `${report.metrics.averageOrderValue.change}%`],
        ["Fulfilment rate", `${report.metrics.fulfilmentRate.value}%`, `${report.metrics.fulfilmentRate.change}%`],
        ["New customers", report.metrics.customers.value, `${report.metrics.customers.change}%`],
        [], ["Top products"], ["Product", "Units", "Revenue", "Category"],
        ...report.topProducts.map(product => [product.title, product.units, product.revenue, product.category]),
        [], ["Daily performance"], ["Date", "Revenue", "Orders"],
        ...report.revenueSeries.map(day => [day.date, day.revenue, day.orders])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `mpwr-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

$("#analytics-range").addEventListener("change", loadReport);
$("#export-report").addEventListener("click", exportCsv);
$$('[data-coming-soon]').forEach(button => button.addEventListener("click", () => showToast(`${button.dataset.comingSoon} management is the next workspace to connect.`)));

onAuthStateChanged(adminAuth, async user => {
    if (!user) return void window.location.replace("admin-login.html");
    try {
        const profile = await getDoc(doc(adminDb, "users", user.uid));
        if (!profile.exists() || profile.data().role !== "admin") {
            await signOut(adminAuth);
            return void window.location.replace("admin-login.html?error=unauthorized");
        }
        $("#analytics-app").hidden = false;
        $("#analytics-loading").remove();
        await loadReport();
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    } catch (error) {
        $("#analytics-loading").classList.add("error");
        $("#analytics-loading p").textContent = error?.message || "Unable to open analytics.";
    }
});
