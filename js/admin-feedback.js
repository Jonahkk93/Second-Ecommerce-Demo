import { onAuthStateChanged } from "./auth-api.js";
import { adminAuth } from "./admin-firebase.js";
const $ = selector => document.querySelector(selector);
const API = window.MPWR_API_URL;
const categories = { finding: "Finding products", details: "Product details & reviews", ordering: "Placing an order", other: "Other functions", bug: "Bug & website error" };
let rows = [];
async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, { credentials: "include", ...options });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "Feedback could not be loaded.");
    return data;
}
function element(tag, text, className) {
    const node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className;
    return node;
}
function render() {
    const search = $("#feedback-search").value.trim().toLowerCase();
    const status = $("#feedback-status-filter").value;
    const visible = rows.filter(row => (status === "all" || row.status === status) && [row.email, row.reference, categories[row.category], row.problem, row.description].some(value => String(value).toLowerCase().includes(search)));
    $("#feedback-admin-count").textContent = `${visible.length} submissions · ${rows.filter(row => row.status === "new").length} new`;
    $("#feedback-admin-list").replaceChildren();
    if (!visible.length) $("#feedback-admin-list").append(element("p", "No feedback matches this view."));
    visible.forEach(row => {
        const card = element("article", "", "feedback-admin-card");
        const header = element("header", "");
        const details = element("div", "");
        details.append(element("h2", categories[row.category]), element("small", `${row.email} · ${new Date(row.createdAt).toLocaleString("en-UG", { timeZone: "Africa/Kampala" })}`));
        const label = element("label", "Status ");
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Status for ${row.reference}`);
        ["new", "seen", "resolved"].forEach(value => select.append(new Option(value[0].toUpperCase() + value.slice(1), value)));
        select.value = row.status;
        select.addEventListener("change", async () => {
            select.disabled = true;
            $("#feedback-admin-message").textContent = "";
            try { const result = await request(`/admin/feedback/${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value }) }); row.status = result.status; render(); }
            catch (error) { $("#feedback-admin-message").textContent = error.message; select.value = row.status; }
            finally { select.disabled = false; }
        });
        label.append(select); header.append(details, label);
        card.append(header, element("p", row.problem), element("p", row.description, "description"));
        if (row.rating) card.append(element("p", `${"★".repeat(row.rating)}${"☆".repeat(5 - row.rating)} · ${row.rating}/5 experience rating`));
        const images = element("div", "", "feedback-admin-images");
        (row.images || []).forEach((file, index) => {
            if (!/^https?:\/\//i.test(file.url)) return;
            const link = document.createElement("a"); link.href = file.url; link.target = "_blank"; link.rel = "noopener";
            const image = document.createElement("img"); image.src = file.url; image.alt = `Supporting image ${index + 1}`; image.loading = "lazy"; link.append(image); images.append(link);
        });
        card.append(images, element("p", row.reference, "feedback-admin-note"));
        $("#feedback-admin-list").append(card);
    });
}
async function load() {
    $("#feedback-reload").disabled = true;
    $("#feedback-admin-message").textContent = "";
    try { rows = await request("/admin/feedback"); render(); }
    catch (error) { $("#feedback-admin-message").textContent = error.message; }
    finally { $("#feedback-reload").disabled = false; }
}
$("#feedback-search").addEventListener("input", render);
$("#feedback-status-filter").addEventListener("change", render);
$("#feedback-reload").addEventListener("click", load);
onAuthStateChanged(adminAuth, async user => {
    if (!user) { location.replace("admin-login.html"); return; }
    $("#feedback-admin-loading").hidden = true;
    $("#feedback-admin").hidden = false;
    await load();
});
