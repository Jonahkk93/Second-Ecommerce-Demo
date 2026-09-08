import { onAuthStateChanged, signOut } from "./auth-api.js";
import { doc, getDoc } from "./firestore-api.js";
import { adminAuth, adminDb } from "./admin-firebase.js";

const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_ROOT = window.MPWR_API_URL || (localHost ? "http://127.0.0.1:3000/v1" : "/api/v1");
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let reviews = [];
let openEditorId = null;
let pendingSeenReviewId = null;
let toastTimer;
const reviewChannel = "BroadcastChannel" in window ? new BroadcastChannel("mpwr-reviews") : null;

function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

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

function openSeenConfirmation(review) {
    pendingSeenReviewId = review.id;
    const customer = review.customerName || "this customer";
    $("#seen-confirm-message").textContent = `Mark ${customer}'s review as seen? It will be removed from "Awaiting reply / To be Seen".`;
    $("#seen-confirm-modal").classList.remove("hidden");
    $("#confirm-seen").focus();
}

function closeSeenConfirmation() {
    pendingSeenReviewId = null;
    $("#seen-confirm-modal").classList.add("hidden");
}

function dateLabel(value) {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat("en-UG", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function attachments(review) {
    const attachment = review.attachment;
    if (!attachment) return [];
    return Array.isArray(attachment.items) ? attachment.items : [attachment];
}

function initials(name) {
    return String(name || "M").split(/\s+/).slice(0, 2).map(word => word[0] || "").join("").toUpperCase();
}

function optionSummary(review) {
    return Object.entries(review.purchasedOptions || {}).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ");
}

function isAwaitingReply(review) {
    return !String(review.adminReply || "").trim() && !review.adminSeenAt;
}

function renderStats() {
    const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0;
    $("#reviews-total").textContent = reviews.length;
    $("#reviews-average").textContent = average.toFixed(1);
    $("#reviews-unanswered").textContent = reviews.filter(isAwaitingReply).length;
    $("#reviews-five-star").textContent = reviews.filter(review => Number(review.rating) === 5).length;
}

function filteredReviews() {
    const query = $("#review-search").value.trim().toLowerCase();
    const rating = $("#rating-filter").value;
    const reply = $("#reply-filter").value;
    return reviews.filter(review => {
        const searchText = `${review.customerName || ""} ${review.customerEmail || ""} ${review.productTitle || ""} ${review.text || ""}`.toLowerCase();
        const answered = Boolean(String(review.adminReply || "").trim());
        return (!query || searchText.includes(query)) && (rating === "all" || Number(review.rating) === Number(rating)) && (reply === "all" || (reply === "answered" ? answered : isAwaitingReply(review)));
    });
}

function enhanceReviewFilter(select) {
    select.classList.add("review-filter-native");
    const picker = document.createElement("div");
    picker.className = "review-filter-picker";
    const trigger = document.createElement("button");
    trigger.className = "review-filter-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", select.getAttribute("aria-label") || "Choose filter");
    trigger.innerHTML = `<span class="review-filter-label"></span><img class="review-filter-arrow" src="images/Icon Folder/Back Icon Down_Gray.PNG" alt="">`;
    const menu = document.createElement("div");
    menu.className = "review-filter-menu";
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

    const sync = () => {
        const selected = select.options[select.selectedIndex];
        trigger.querySelector(".review-filter-label").textContent = selected?.textContent || "Select";
        menu.querySelectorAll("button").forEach(option => {
            const active = option.dataset.value === select.value;
            option.classList.toggle("selected", active);
            option.setAttribute("aria-selected", String(active));
        });
    };
    const close = () => {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", event => {
        event.stopPropagation();
        document.querySelectorAll(".review-filter-menu:not([hidden])").forEach(openMenu => {
            if (openMenu !== menu) {
                openMenu.hidden = true;
                openMenu.previousElementSibling?.setAttribute("aria-expanded", "false");
            }
        });
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
    select.addEventListener("change", sync);
    picker.append(trigger, menu);
    select.insertAdjacentElement("afterend", picker);
    sync();
}

function renderReviews() {
    const visible = filteredReviews();
    $("#review-result-count").textContent = `${visible.length} review${visible.length === 1 ? "" : "s"}`;
    $("#reviews-empty").classList.toggle("hidden", visible.length > 0);
    $("#admin-review-list").innerHTML = visible.map(review => {
        const reply = String(review.adminReply || "");
        const isOpen = openEditorId === review.id;
        const images = attachments(review).filter(item => String(item.type || "").startsWith("image/"));
        return `<article class="admin-review-card" data-id="${escapeHtml(review.id)}">
            <section class="review-panel">
                <span class="review-panel-label">Review</span>
                <header class="admin-review-header">
                    <div class="review-customer"><span class="review-avatar">${escapeHtml(initials(review.customerName))}</span><div><strong>${escapeHtml(review.customerName || "MPWR customer")}${review.verifiedPurchase ? '<img class="verified-purchase" src="images/Icon Folder/Verified Icon_E5A484.PNG" alt="Verified purchase">' : ""}<span class="review-rating" aria-label="${Number(review.rating)} out of 5 stars">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</span></strong><small>${escapeHtml(review.customerEmail || "Customer account")} · ${escapeHtml(dateLabel(review.createdAt))}</small></div></div>
                </header>
                <div class="review-content"><p class="review-copy">${escapeHtml(review.text || "")}</p>${images.length ? `<div class="review-attachments-admin">${images.map(item => `<a href="${escapeHtml(item.url)}" target="_blank"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || "Review image")}"></a>`).join("")}</div>` : ""}${reply ? `<div class="admin-reply"><div class="admin-reply-heading"><strong><span>MPWR reply</span><img src="images/Icon Folder/Verified Purchase Icon_333.PNG" alt="Verified MPWR"></strong><time>${escapeHtml(dateLabel(review.adminRepliedAt))}</time></div><p>${escapeHtml(reply)}</p></div>` : ""}${isOpen ? `<form class="reply-editor"><textarea maxlength="1200" aria-label="Reply to ${escapeHtml(review.customerName || "customer")}" placeholder="Write a helpful public response…">${escapeHtml(reply)}</textarea><div class="reply-editor-footer"><small><span class="reply-character-count">${reply.length}</span>/1200 · This reply will be visible to shoppers.</small><div class="reply-actions"><button class="cancel-reply" type="button">Cancel</button>${reply ? '<button class="remove-reply" type="button">Remove reply</button>' : ""}<button class="save-reply" type="submit">${reply ? "Update reply" : "Publish reply"}</button></div></div></form>` : ""}</div>
                ${isOpen ? "" : `<div class="review-response-actions"><button class="reply-toggle" type="button">${reply ? "Edit reply" : "Reply"}</button><button class="seen-toggle${review.adminSeenAt ? " is-seen" : ""}" type="button">${review.adminSeenAt ? "Mark as unseen" : "Seen"}</button></div>`}
            </section>
            <aside class="ordered-item-panel">
                <span class="review-panel-label">Item ordered</span>
                <div class="review-product"><img src="${escapeHtml(review.productImage || "images/MPWR Logo.PNG")}" alt=""><div><strong>${escapeHtml(review.productTitle || "Product")}</strong><small>Purchased product</small>${optionSummary(review) ? `<div class="review-options">${escapeHtml(optionSummary(review))}</div>` : ""}</div></div>
            </aside>
        </article>`;
    }).join("");
}

async function saveReply(reviewId, reply) {
    const response = await fetch(`${API_ROOT}/admin/reviews/${encodeURIComponent(reviewId)}/reply`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Reply failed (${response.status})`);
    const review = reviews.find(item => item.id === reviewId);
    if (review) {
        review.adminReply = payload.adminReply;
        review.adminRepliedAt = payload.adminRepliedAt;
    }
    openEditorId = null;
    renderStats();
    renderReviews();
    const revision = String(Date.now());
    localStorage.setItem("mpwrReviewRevision", revision);
    reviewChannel?.postMessage({ type: "reviews-changed", revision });
}

async function saveSeen(reviewId, seen) {
    const response = await fetch(`${API_ROOT}/admin/reviews/${encodeURIComponent(reviewId)}/seen`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seen }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Seen update failed (${response.status})`);
    const review = reviews.find(item => item.id === reviewId);
    if (review) review.adminSeenAt = payload.adminSeenAt;
    renderStats();
    renderReviews();
}

async function loadReviews() {
    const response = await fetch(`${API_ROOT}/admin/reviews`, { credentials: "include" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Reviews request failed (${response.status})`);
    reviews = Array.isArray(payload) ? payload : [];
    renderStats();
    renderReviews();
}

[$("#review-search"), $("#rating-filter"), $("#reply-filter")].forEach(control => control.addEventListener(control.tagName === "INPUT" ? "input" : "change", renderReviews));
["#rating-filter", "#reply-filter"].forEach(selector => enhanceReviewFilter($(selector)));
document.addEventListener("click", () => document.querySelectorAll(".review-filter-menu:not([hidden])").forEach(menu => {
    menu.hidden = true;
    menu.previousElementSibling?.setAttribute("aria-expanded", "false");
}));
$$('[data-coming-soon]').forEach(button => button.addEventListener("click", () => showToast(`${button.dataset.comingSoon} management is the next workspace to connect.`)));
$("#admin-review-list").addEventListener("click", async event => {
    const card = event.target.closest(".admin-review-card");
    if (!card) return;
    if (event.target.closest(".reply-toggle")) { openEditorId = card.dataset.id; renderReviews(); document.querySelector(`.admin-review-card[data-id="${CSS.escape(openEditorId)}"] textarea`)?.focus(); }
    if (event.target.closest(".cancel-reply")) { openEditorId = null; renderReviews(); }
    if (event.target.closest(".seen-toggle")) {
        const review = reviews.find(item => item.id === card.dataset.id);
        if (!review) return;
        if (!review.adminSeenAt) {
            openSeenConfirmation(review);
            return;
        }
        const button = event.target.closest(".seen-toggle");
        button.disabled = true;
        try {
            await saveSeen(review.id, false);
            showToast("Review returned to Awaiting reply / To be Seen.");
        } catch (error) {
            showToast(error?.message || "Unable to update the review.", "error");
            button.disabled = false;
        }
    }
    if (event.target.closest(".remove-reply")) {
        const button = event.target.closest(".remove-reply"); button.disabled = true;
        try { await saveReply(card.dataset.id, ""); showToast("Public reply removed."); } catch (error) { showToast(error?.message || "Unable to remove reply.", "error"); button.disabled = false; }
    }
});
$("#cancel-seen").addEventListener("click", closeSeenConfirmation);
$("#seen-confirm-modal").addEventListener("click", event => { if (event.target === event.currentTarget) closeSeenConfirmation(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("#seen-confirm-modal").classList.contains("hidden")) closeSeenConfirmation(); });
$("#confirm-seen").addEventListener("click", async event => {
    const review = reviews.find(item => item.id === pendingSeenReviewId);
    if (!review) return closeSeenConfirmation();
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Saving…";
    try {
        await saveSeen(review.id, true);
        closeSeenConfirmation();
        showToast("Review marked as seen.");
    } catch (error) {
        showToast(error?.message || "Unable to update the review.", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Mark as seen";
    }
});
$("#admin-review-list").addEventListener("input", event => {
    if (!event.target.matches("textarea")) return;
    event.target.closest(".reply-editor")?.querySelector(".reply-character-count").replaceChildren(String(event.target.value.length));
});
$("#admin-review-list").addEventListener("submit", async event => {
    if (!event.target.matches(".reply-editor")) return;
    event.preventDefault();
    const card = event.target.closest(".admin-review-card");
    const button = event.target.querySelector(".save-reply");
    const reply = event.target.querySelector("textarea").value.trim();
    if (!reply) return showToast("Write a reply before publishing.", "error");
    button.disabled = true; button.textContent = "Publishing…";
    try { await saveReply(card.dataset.id, reply); showToast("Reply published on the storefront."); } catch (error) { showToast(error?.message || "Unable to publish reply.", "error"); button.disabled = false; button.textContent = reviews.find(review => review.id === card.dataset.id)?.adminReply ? "Update reply" : "Publish reply"; }
});

onAuthStateChanged(adminAuth, async user => {
    if (!user) return void window.location.replace("admin-login.html");
    try {
        const profile = await getDoc(doc(adminDb, "users", user.uid));
        if (!profile.exists() || profile.data().role !== "admin") { await signOut(adminAuth); return void window.location.replace("admin-login.html?error=unauthorized"); }
        await loadReviews();
        $("#reviews-app").hidden = false;
        $("#reviews-loading")?.remove();
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    } catch (error) {
        const loading = $("#reviews-loading");
        loading?.classList.add("error");
        const message = loading?.querySelector("p");
        if (message) message.textContent = error?.message || "Unable to load reviews.";
        window.MPWRLoading?.ready();
    }
});
