import { onAuthStateChanged } from "./auth-api.js";
import { adminAuth } from "./admin-firebase.js";
const $ = selector => document.querySelector(selector);
const API = window.MPWR_API_URL;
function node(tag, text = "") { const el = document.createElement(tag); el.textContent = text; return el; }
async function request(path = "", payload) {
    const response = await fetch(`${API}/admin/privacy-requests${path}`, { credentials: "include", method: payload ? "PATCH" : "GET", headers: payload ? { "Content-Type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(". ") : data.message || "Could not load requests.");
    return data;
}
async function load() {
    const button = $("#privacy-reload"); button.disabled = true;
    try {
        const rows = await request();
        const list = $("#privacy-admin-list"); list.replaceChildren();
        rows.sort((a, b) => (a.request.status === "closed") - (b.request.status === "closed"));
        if (!rows.length) list.append(node("p", "No privacy requests yet."));
        for (const { request: row, email } of rows) {
            const card = node("article"); card.className = "feedback-admin-card";
            card.append(node("h2", `${row.kind} · ${email}`), node("p", row.reference), node("p", `Received ${new Date(row.createdAt).toLocaleString("en-UG", { timeZone: "Africa/Kampala" })}`), node("p", row.details));
            const form = node("form");
            const label = node("label", "Status "); const select = node("select");
            for (const value of ["new", "in_review", "closed"]) select.append(new Option(value.replaceAll("_", " "), value));
            select.value = row.status; label.append(select);
            const responseLabel = node("label", "Customer-visible response / outcome "); const response = node("textarea");
            response.value = row.response; response.maxLength = 4000; response.rows = 5; response.style.width = "100%"; responseLabel.append(response);
            const save = node("button", "Save response"); save.type = "submit";
            const message = node("p"); message.setAttribute("role", "status");
            form.append(label, responseLabel, save, message);
            form.addEventListener("submit", async event => {
                event.preventDefault(); save.disabled = true;
                try { await request(`/${encodeURIComponent(row.id)}`, { status: select.value, response: response.value }); message.textContent = "Saved. The customer can see this response in Privacy requests."; }
                catch (error) { message.textContent = error.message; }
                finally { save.disabled = false; }
            });
            card.append(form); list.append(card);
        }
    } catch (error) { $("#privacy-admin-message").textContent = error.message; }
    finally { button.disabled = false; }
}
$("#privacy-reload").addEventListener("click", load);
onAuthStateChanged(adminAuth, async user => {
    if (!user) { location.replace("admin-login.html"); return; }
    $("#privacy-admin-loading").hidden = true; $("#privacy-admin").hidden = false;
    await load();
});
