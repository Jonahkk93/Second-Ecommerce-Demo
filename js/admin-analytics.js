import { onAuthStateChanged, signOut } from "./auth-api.js";
import { doc, getDoc } from "./firestore-api.js";
import { adminAuth, adminDb } from "./admin-firebase.js";

const localHost = /^(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i.test(window.location.hostname);
const API_ROOT = window.MPWR_API_URL || (localHost ? `http://${window.location.hostname}:3000/v1` : "/api/v1");
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const statusColours = { pending: "#f2ad4b", processing: "#578ee9", shipped: "#8c65df", delivered: "#31ad76", cancelled: "#d95c5c", returned: "#8a6f5a" };
const categoryLabels = { "press-ons": "Press-On Nails", wigs: "Wigs", lashes: "Lashes", products: "Products", polish: "Nail Polish" };
let report = null;
let toastTimer;
let activeChartMetric = "revenue";

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

function enhanceManagementDropdown(select) {
    select.classList.add("product-dropdown-native");
    const picker = document.createElement("div");
    picker.className = "product-dropdown";
    const trigger = document.createElement("button");
    trigger.className = "product-dropdown-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", select.closest("label")?.querySelector(":scope > span")?.textContent || "Choose reporting period");
    trigger.innerHTML = '<span class="product-dropdown-label"></span><img class="product-dropdown-arrow" src="images/Icon Folder/Back Icon Down_Gray.PNG" alt="">';
    const menu = document.createElement("div");
    menu.className = "product-dropdown-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    [...select.options].forEach(item => {
        const option = document.createElement("button");
        option.type = "button";
        option.dataset.value = item.value;
        option.textContent = item.textContent;
        option.setAttribute("role", "option");
        menu.appendChild(option);
    });

    const close = () => {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };
    const sync = () => {
        trigger.querySelector(".product-dropdown-label").textContent = select.options[select.selectedIndex]?.textContent || "Select";
        trigger.disabled = select.disabled;
        picker.classList.toggle("disabled", select.disabled);
        menu.querySelectorAll("button").forEach(option => {
            const selected = option.dataset.value === select.value;
            option.classList.toggle("selected", selected);
            option.setAttribute("aria-selected", String(selected));
        });
        if (select.disabled) close();
    };
    trigger.addEventListener("click", event => {
        if (select.disabled) return;
        event.stopPropagation();
        menu.hidden = !menu.hidden;
        trigger.setAttribute("aria-expanded", String(!menu.hidden));
    });
    menu.addEventListener("click", event => {
        const option = event.target.closest("button[data-value]");
        if (!option) return;
        select.value = option.dataset.value;
        sync();
        close();
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    document.addEventListener("click", close);
    document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    picker.append(trigger, menu);
    select.insertAdjacentElement("afterend", picker);
    sync();
    return sync;
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
    $("#status-legend").innerHTML = statuses.map(item => {
        const share = total ? (item.count / total) * 100 : 0;
        return `<div class="status-row"><i style="background:${statusColours[item.status]}"></i><span>${escapeHtml(item.status)}</span><div><b style="width:${share}%"></b></div><strong>${item.count}</strong></div>`;
    }).join("");
    const count = status => statuses.find(item => item.status === status)?.count || 0;
    const active = Math.max(0, total - count("cancelled") - count("returned"));
    $("#delivered-share").textContent = `${active ? Math.round((count("delivered") / active) * 100) : 0}%`;
    $("#cancelled-share").textContent = `${total ? Math.round((count("cancelled") / total) * 100) : 0}%`;
}

function renderCategories(categories) {
    const total = categories.reduce((sum, item) => sum + Number(item.value || 0), 0);
    $("#category-total").textContent = compactMoney(total);
    if (!categories.length) return void ($("#category-bars").innerHTML = '<div class="analytics-empty">No category sales yet.</div>');
    const max = Math.max(...categories.map(item => item.value), 1);
    $("#category-bars").innerHTML = categories.slice(0, 7).map(item => `<div class="category-row"><div><span>${escapeHtml(categoryLabels[item.category] || item.category)}</span><small>${total ? ((item.value / total) * 100).toFixed(1) : 0}% of revenue</small></div><div class="bar-track"><i style="width:${(item.value / max) * 100}%"></i></div><strong>${compactMoney(item.value)}</strong></div>`).join("");
}

function renderTables(data) {
    const totalRevenue = Math.max(Number(data.metrics.revenue.value) || 0, 1);
    $("#top-products").innerHTML = data.topProducts.length ? data.topProducts.map((product, index) => `<tr><td><span class="ranking-number">${index + 1}</span></td><td><div class="product-cell"><img src="${escapeHtml(product.image || "images/MPWR Logo.PNG")}" alt=""><span>${escapeHtml(product.title)}</span></div></td><td><span class="category-chip">${escapeHtml(categoryLabels[product.category] || product.category)}</span></td><td>${Number(product.units).toLocaleString()}</td><td><strong>${money(product.revenue)}</strong></td><td><div class="share-cell"><span>${((product.revenue / totalRevenue) * 100).toFixed(1)}%</span><i><b style="width:${Math.min(100, (product.revenue / totalRevenue) * 100)}%"></b></i></div></td></tr>`).join("") : '<tr><td colspan="6">No product sales in this period.</td></tr>';
    $("#recent-orders").innerHTML = data.recentOrders.length ? data.recentOrders.map(order => {
        const date = order.createdAt ? new Date(order.createdAt) : null;
        return `<tr><td><strong>#${escapeHtml(String(order.id).slice(0, 8).toUpperCase())}</strong></td><td>${escapeHtml(order.customer)}</td><td>${date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td><td><strong>${money(order.total)}</strong></td><td><span class="analytics-status ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span></td></tr>`;
    }).join("") : '<tr><td colspan="5">No recent orders.</td></tr>';
}

function renderPerformanceChart() {
    if (!report) return;
    const metric = activeChartMetric;
    $("#performance-label").textContent = metric === "revenue" ? "Revenue" : "Orders";
    $("#performance-total").textContent = metric === "revenue"
        ? money(report.metrics.revenue.value)
        : Number(report.metrics.orders.value).toLocaleString();
    lineChart($("#performance-chart"), report.revenueSeries, metric, `performance-${metric}-gradient`);
}

function renderInsights(data) {
    const bestDay = [...data.revenueSeries].sort((a, b) => Number(b.revenue) - Number(a.revenue))[0];
    if (bestDay && Number(bestDay.revenue) > 0) {
        $("#insight-best-day").textContent = new Date(`${bestDay.date}T00:00:00`).toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "short" });
        $("#insight-best-day-note").textContent = `${money(bestDay.revenue)} from ${bestDay.orders} order${bestDay.orders === 1 ? "" : "s"}`;
    }
    const category = data.categorySales[0];
    if (category) {
        const total = data.categorySales.reduce((sum, item) => sum + Number(item.value || 0), 0);
        $("#insight-category").textContent = categoryLabels[category.category] || category.category;
        $("#insight-category-note").textContent = `${total ? ((category.value / total) * 100).toFixed(1) : 0}% of product revenue`;
    }
    const product = data.topProducts[0];
    if (product) {
        $("#insight-product").textContent = product.title;
        $("#insight-product-note").textContent = `${product.units} unit${product.units === 1 ? "" : "s"} · ${money(product.revenue)}`;
    }
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
    renderPerformanceChart();
    renderStatuses(data.orderStatuses);
    renderCategories(data.categorySales);
    renderTables(data);
    renderInsights(data);
}

async function loadReport() {
    const range = $("#analytics-range").value;
    $("#analytics-range").disabled = true;
    rangeDropdownSync();
    try {
        const response = await fetch(`${API_ROOT}/admin/analytics?range=${encodeURIComponent(range)}`, { credentials: "include" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || `Analytics request failed (${response.status})`);
        renderReport(payload);
    } catch (error) {
        showToast(error?.message || "Unable to load analytics.", "error");
    } finally {
        $("#analytics-range").disabled = false;
        rangeDropdownSync();
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

const rangeDropdownSync = enhanceManagementDropdown($("#analytics-range"));
$("#analytics-range").addEventListener("change", loadReport);
$("#export-report").addEventListener("click", exportCsv);
$$('[data-chart-metric]').forEach(button => button.addEventListener("click", () => {
    activeChartMetric = button.dataset.chartMetric;
    $$('[data-chart-metric]').forEach(option => {
        const selected = option === button;
        option.classList.toggle("active", selected);
        option.setAttribute("aria-selected", String(selected));
    });
    renderPerformanceChart();
}));
$$('[data-coming-soon]').forEach(button => button.addEventListener("click", () => showToast(`${button.dataset.comingSoon} management is the next workspace to connect.`)));

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
        await loadReport();
        $("#analytics-app").hidden = false;
        $("#analytics-loading").remove();
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    } catch (error) {
        $("#analytics-loading").classList.add("error");
        $("#analytics-loading p").textContent = error?.message || "Unable to open analytics.";
    }
});
