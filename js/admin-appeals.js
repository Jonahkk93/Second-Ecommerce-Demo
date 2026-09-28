import { onAuthStateChanged } from "./auth-api.js";
import { adminAuth } from "./admin-firebase.js";

const $ = selector => document.querySelector(selector);
const isLocal = /^(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i.test(location.hostname);
const API = window.MPWR_API_URL || (isLocal ? `http://${location.hostname}:3000/v1` : "/api/v1");

let appeals = [];
let activeFilter = "open";
const responseDrafts = new Map();
let pendingDecision = null;
let confirmationTrigger = null;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
})[character]);

async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        credentials: "include",
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
}

function isOpen(status) {
    return ["submitted", "more_information_required"].includes(status);
}

function visibleAppeals() {
    const query = $("#appeals-search").value.trim().toLowerCase();
    return appeals.filter(appeal => {
        if (activeFilter === "open" && !isOpen(appeal.status)) return false;
        if (!query) return true;
        return [
            appeal.reference,
            appeal.email,
            appeal.blockReason,
            appeal.explanation,
            appeal.status?.replaceAll("_", " "),
            appeal.adminResponse
        ].some(value => String(value || "").toLowerCase().includes(query));
    });
}

function autosizeResponse(field) {
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
    field.style.overflowY = field.scrollHeight > 160 ? "auto" : "hidden";
}

function render() {
    const rows = visibleAppeals();
    const query = $("#appeals-search").value.trim();

    $("#appeals-awaiting").textContent = appeals.filter(appeal => appeal.status === "submitted").length;
    $("#appeals-total").textContent = appeals.length;
    $("#appeals-result-count").textContent = `${rows.length.toLocaleString()} appeal${rows.length === 1 ? "" : "s"}`;
    $("#appeals-empty").textContent = query ? "No appeals match your search." : "No account appeals found.";
    $("#appeals-empty").hidden = rows.length > 0;

    $("#appeals-list").innerHTML = rows.map(appeal => `
        <article class="appeal-admin-card" data-id="${escapeHtml(appeal.id)}">
            <div class="appeal-admin-head">
                <div>
                    <h2>${escapeHtml(appeal.reference)}</h2>
                    <p>${new Date(appeal.createdAt).toLocaleString("en-UG")}</p>
                </div>
                <span class="appeal-status ${escapeHtml(appeal.status)}">${escapeHtml(appeal.status.replaceAll("_", " "))}</span>
            </div>
            <div class="appeal-admin-grid">
                <div class="appeal-admin-meta">
                    <span>Customer</span>
                    <strong>${escapeHtml(appeal.email)}</strong>
                    <span>Block reason</span>
                    <strong>${escapeHtml(appeal.blockReason || "Not specified")}</strong>
                </div>
                <div class="appeal-admin-copy">
                    <span>Customer explanation</span>
                    <p>${escapeHtml(appeal.explanation)}</p>
                    <div class="appeal-evidence">
                        ${(appeal.evidence || []).map(file => `<a href="${escapeHtml(file.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(file.url)}" alt="Appeal evidence"></a>`).join("")}
                    </div>
                </div>
            </div>
            ${appeal.status === "submitted" ? `
                <div class="appeal-decision">
                    <textarea rows="1" maxlength="1200" aria-label="Response for ${escapeHtml(appeal.reference)}" placeholder="Type a response">${escapeHtml(responseDrafts.get(appeal.id) || "")}</textarea>
                    <button class="approve-appeal" type="button">Approve</button>
                    <button class="reject-appeal" type="button">Reject</button>
                </div>
            ` : appeal.adminResponse ? `<p><strong>Response:</strong> ${escapeHtml(appeal.adminResponse)}</p>` : ""}
        </article>
    `).join("");

    document.querySelectorAll(".appeal-decision textarea").forEach(autosizeResponse);
}

async function decide(card, status) {
    const field = card.querySelector("textarea");
    const response = field.value.trim();
    if (response.length < 3) {
        field.placeholder = "Please add a short response first";
        field.focus();
        return;
    }

    card.querySelectorAll("button").forEach(button => { button.disabled = true; });
    try {
        const updated = await request(`/admin/account-appeals/${card.dataset.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status, response })
        });
        responseDrafts.delete(updated.id);
        appeals = appeals.map(appeal => appeal.id === updated.id ? updated : appeal);
        render();
    } catch (error) {
        field.placeholder = error.message;
        card.querySelectorAll("button").forEach(button => { button.disabled = false; });
    }
}

function closeConfirmation() {
    const modal = $("#appeal-confirm");
    modal.hidden = true;
    document.body.classList.remove("appeal-confirm-open");
    pendingDecision = null;
    confirmationTrigger?.focus();
    confirmationTrigger = null;
}

function openConfirmation(card, status, trigger) {
    const field = card.querySelector("textarea");
    if (field.value.trim().length < 3) {
        field.placeholder = "Please add a short response first";
        field.focus();
        return;
    }

    const approving = status === "approved";
    pendingDecision = { card, status };
    confirmationTrigger = trigger;
    $("#appeal-confirm-title").textContent = approving ? "Approve this appeal?" : "Reject this appeal?";
    $("#appeal-confirm-message").textContent = approving
        ? "The customer’s account restriction will be removed and your response will be sent."
        : "The account restriction will remain in place and your response will be sent.";
    $("#appeal-confirm-icon").textContent = approving ? "✓" : "×";
    $("#appeal-confirm-submit").textContent = approving ? "Yes, approve" : "Yes, reject";
    $("#appeal-confirm").classList.toggle("is-approve", approving);
    $("#appeal-confirm").classList.toggle("is-reject", !approving);
    $("#appeal-confirm").hidden = false;
    document.body.classList.add("appeal-confirm-open");
    $("#appeal-confirm-submit").focus();
}

$("#appeals-search").addEventListener("input", render);

$("#appeals-list").addEventListener("input", event => {
    if (!event.target.matches(".appeal-decision textarea")) return;
    const card = event.target.closest(".appeal-admin-card");
    responseDrafts.set(card.dataset.id, event.target.value);
    autosizeResponse(event.target);
});

$("#appeals-list").addEventListener("click", event => {
    const card = event.target.closest(".appeal-admin-card");
    if (!card) return;
    const approveButton = event.target.closest(".approve-appeal");
    const rejectButton = event.target.closest(".reject-appeal");
    if (approveButton) openConfirmation(card, "approved", approveButton);
    if (rejectButton) openConfirmation(card, "rejected", rejectButton);
});

$("#appeal-confirm").addEventListener("click", event => {
    if (event.target.closest("[data-close-confirm]")) closeConfirmation();
});

$("#appeal-confirm-submit").addEventListener("click", async () => {
    if (!pendingDecision) return;
    const { card, status } = pendingDecision;
    const submit = $("#appeal-confirm-submit");
    submit.disabled = true;
    submit.textContent = status === "approved" ? "Approving…" : "Rejecting…";
    closeConfirmation();
    submit.disabled = false;
    await decide(card, status);
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#appeal-confirm").hidden) closeConfirmation();
});

document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("active", item === button));
    render();
}));

onAuthStateChanged(adminAuth, async user => {
    if (!user) {
        location.replace("admin-login.html");
        return;
    }

    try {
        appeals = await request("/admin/account-appeals");
        render();
        $("#appeals-app").hidden = false;
        $("#appeals-loading").hidden = true;
    } catch (error) {
        $("#appeals-loading").classList.add("error");
        $("#appeals-loading p").textContent = error.message;
    }
});
