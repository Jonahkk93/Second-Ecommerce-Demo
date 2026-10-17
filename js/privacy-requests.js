import { onAuthStateChanged, submitPrivacyRequest, listPrivacyRequests } from "./auth-api.js";
import "./firebase.js";
const auth = window.auth;
const form = document.getElementById("privacy-request-form");
const message = document.getElementById("privacy-request-message");
const state = document.getElementById("privacy-requests-state");
const list = document.getElementById("privacy-request-list");
let currentUser;
function paragraph(text) { const node = document.createElement("p"); node.textContent = text; return node; }
async function load() {
    const rows = await listPrivacyRequests();
    list.replaceChildren();
    state.textContent = rows.length ? "Updates appear here. Contact MPWR if a request is urgent or you cannot access this page." : "You have no privacy requests yet.";
    for (const row of rows) {
        const card = document.createElement("article"); card.className = "privacy-request-card";
        card.append(paragraph(`${row.kind} · ${row.status.replaceAll("_", " ")}`), paragraph(row.reference), paragraph(new Date(row.createdAt).toLocaleString("en-UG")));
        if (row.details) card.append(paragraph(row.details));
        if (row.response) card.append(paragraph(`MPWR response: ${row.response}`));
        list.append(card);
    }
}
form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) { message.textContent = "Sign in from My Account, or contact MPWR using the details above."; return; }
    const button = form.querySelector("button"); button.disabled = true;
    try {
        const data = new FormData(form);
        const result = await submitPrivacyRequest(data.get("kind"), data.get("details"));
        message.textContent = `Request received: ${result.reference}. Your request is awaiting review. An existing open request of the same type keeps its original reference.`;
        form.reset(); await load();
    } catch (error) { message.textContent = error.message || "Could not submit. Contact MPWR if this continues."; }
    finally { button.disabled = false; }
});
onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) { list.replaceChildren(); state.textContent = "Sign in from My Account to see your requests. You can also make a request by email or telephone."; return; }
    try { await load(); } catch { state.textContent = "Could not load requests. Please try again or contact MPWR."; }
});
