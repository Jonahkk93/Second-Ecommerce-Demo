/* Load before storefront scripts so optional storage starts disabled. */
(() => {
    "use strict";
    if (window.MPWRCookieConsent) return;
    const KEY = "mpwrCookieConsentV1";
    const NOTICE_VERSION = "2026-10-17.1";
    const CATEGORIES = ["performance", "functional", "targeting"];
    const TTL = 180 * 24 * 60 * 60 * 1000;
    const defaults = () => ({ version: 1, noticeVersion: NOTICE_VERSION, necessary: true, performance: false, functional: false, targeting: false });
    function read() {
        try {
            const value = JSON.parse(localStorage.getItem(KEY) || "null");
            if (!value || value.version !== 1 || value.noticeVersion !== NOTICE_VERSION || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return defaults();
            return { ...defaults(), ...Object.fromEntries(CATEGORIES.map(key => [key, value[key] === true])), updatedAt: value.updatedAt, expiresAt: value.expiresAt };
        } catch { return defaults(); }
    }
    let state = read();
    function get() {
        if (state.expiresAt && state.expiresAt <= Date.now()) {
            state = defaults();
            cleanDisallowed();
            syncBanner();
            window.dispatchEvent(new CustomEvent("mpwr:cookie-consent-changed", { detail: { ...state } }));
        }
        return { ...state };
    }
    function allows(category) { return category === "necessary" || (CATEGORIES.includes(category) && get()[category] === true); }
    function withoutAttribution(value) {
        if (Array.isArray(value)) return value.map(withoutAttribution);
        if (!value || typeof value !== "object") return value;
        return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "searchAttribution").map(([key, entry]) => [key, withoutAttribution(entry)]));
    }
    function sanitizeItems(items) { return allows("performance") ? items : withoutAttribution(items); }
    function browserStorage(name) { try { return name === "local" ? localStorage : sessionStorage; } catch { return null; } }
    function remove(storage, keys) { keys.forEach(key => { try { storage.removeItem(key); } catch {} }); }
    function cleanDisallowed() {
        if (!allows("functional")) {
            remove(browserStorage("local"), ["mpwrRecentSearches", "mpwrProductHistory"]);
            remove(browserStorage("session"), ["mpwrDiscoverySessionSeed"]);
        }
        if (!allows("targeting")) remove(browserStorage("local"), ["mpwrDiscoverySignalsV1"]);
        if (!allows("performance")) {
            remove(browserStorage("local"), ["mpwrSearchVisitor"]);
            remove(browserStorage("session"), ["mpwrSearchAttribution"]);
            // Keep shopping items; remove only optional search attribution.
            ["cart", "mpwrGuestCart"].forEach(key => {
                try {
                    const stored = localStorage.getItem(key);
                    if (stored && stored.includes('"searchAttribution"')) localStorage.setItem(key, JSON.stringify(withoutAttribution(JSON.parse(stored))));
                } catch {}
            });
        }
    }
    function notify() {
        cleanDisallowed();
        syncBanner();
        window.dispatchEvent(new CustomEvent("mpwr:cookie-consent-changed", { detail: get() }));
    }
    function save(choices) {
        const next = { ...defaults(), ...Object.fromEntries(CATEGORIES.map(key => [key, choices[key] === true])), updatedAt: new Date().toISOString(), expiresAt: Date.now() + TTL };
        // Do not claim a saved preference if browser storage is unavailable.
        localStorage.setItem(KEY, JSON.stringify(next));
        state = next;
        notify();
        return get();
    }
    window.addEventListener("storage", event => {
        if (event.key !== KEY && event.key !== null) return;
        state = read(); notify();
    });
    window.addEventListener("pageshow", () => { state = read(); notify(); });
    cleanDisallowed();

    let dialog, banner, opener, toastTimer;
    function syncBanner() {
        if (banner) banner.hidden = Boolean(state.updatedAt) || Boolean(document.querySelector("[data-cookie-settings-page]"));
    }
    function close() { if (dialog?.open) dialog.close(); }
    function open(trigger = document.activeElement) {
        mount();
        if (dialog.open) return;
        opener = trigger;
        const current = get();
        CATEGORIES.forEach(key => { dialog.querySelector(`[name="${key}"]`).checked = current[key]; });
        dialog.querySelectorAll("details").forEach(details => { details.open = false; });
        dialog.querySelector(".cookie-error").textContent = "";
        const updated = dialog.querySelector(".cookie-saved-note");
        updated.textContent = current.updatedAt ? "Your saved choices are shown below. Changes apply when you confirm." : "Optional categories are off until you choose to enable them.";
        dialog.showModal();
        document.documentElement.classList.add("cookie-settings-open");
        dialog.querySelector(".cookie-scroll").scrollTop = 0;
        dialog.querySelector(".cookie-close").focus();
    }
    function confirm(choices) {
        try {
            save(choices);
            close();
            const toast = document.querySelector("#cookie-consent-status");
            toast.textContent = "Your cookie preferences have been saved.";
            toast.hidden = false;
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
        } catch {
            dialog.querySelector(".cookie-error").textContent = "Your browser could not save these choices. Allow site storage in your browser and try again. Optional categories remain at their previously saved settings.";
        }
    }
    function mount() {
        if (dialog) return;
        dialog = document.createElement("dialog");
        dialog.id = "mpwr-cookie-settings";
        dialog.className = "cookie-dialog";
        dialog.setAttribute("aria-labelledby", "cookie-settings-title");
        dialog.innerHTML = `
            <header class="cookie-dialog-header"><span class="cookie-brand">MPWR</span><button class="cookie-close" type="button" aria-label="Close cookie settings"><img src="images/Icon Folder/Close Icon_333.PNG" alt=""></button></header>
            <div class="cookie-scroll">
                <h2 id="cookie-settings-title">Privacy settings center</h2>
                <p>MPWR uses cookies and browser storage to keep the shop working and, with your permission, remember your browsing preferences, understand how the site is used, and personalize recommendations.</p>
                <p>You can choose which optional categories to allow. Essential features such as signing in, your cart, and checkout stay available. <a href="privacy-policy.html#cookies">Read our Privacy & Cookie Policy</a>.</p>
                <p class="cookie-saved-note"></p>
                <h3>Manage consent preferences</h3>
                <div class="cookie-categories">
                    <div class="cookie-category"><details><summary>Strictly necessary cookies</summary><div class="cookie-category-copy"><p>Required for sign-in, account security, carts, checkout, and saving these privacy choices. They also support account information and services you explicitly request, such as saved addresses and wishlists.</p><p>These cannot be switched off here. Blocking them in your browser may prevent those services from working.</p></div></details><span class="cookie-always-active">Always active</span></div>
                    <div class="cookie-category"><details><summary>Performance cookies</summary><div class="cookie-category-copy"><p>Help MPWR understand searches, product clicks, and purchases that follow a search, so we can improve search results. This includes an analytics visitor identifier and search attribution.</p><p>Switching this off stops new optional search analytics from this browser and clears its saved visitor identifier and search attribution. It does not delete reports already received or necessary order records.</p></div></details><label class="cookie-switch"><input type="checkbox" role="switch" name="performance" aria-label="Allow performance cookies"><span aria-hidden="true"></span></label></div>
                    <div class="cookie-category"><details><summary>Functional cookies</summary><div class="cookie-category-copy"><p>Remember recent searches, recently viewed products, and the catalogue order within a browsing session.</p><p>Switching this off clears recent searches and product browsing history stored on this browser. Your cart, wishlist, saved account details, and orders are kept.</p></div></details><label class="cookie-switch"><input type="checkbox" role="switch" name="functional" aria-label="Allow functional cookies"><span aria-hidden="true"></span></label></div>
                    <div class="cookie-category"><details><summary>Targeting & personalization</summary><div class="cookie-category-copy"><p>Use product interactions saved on this browser to tailor MPWR product recommendations to your interests.</p><p>Switching this off clears those recommendation signals and stops saving new ones. MPWR currently does not load third-party advertising trackers.</p></div></details><label class="cookie-switch"><input type="checkbox" role="switch" name="targeting" aria-label="Allow targeting and personalization"><span aria-hidden="true"></span></label></div>
                </div>
                <p class="cookie-device-note">Choices are saved for 180 days on this browser. You can change or withdraw them anytime through Manage Cookies.</p>
            </div>
            <footer class="cookie-dialog-footer"><p class="cookie-error" role="alert"></p><div class="cookie-quick-actions"><button type="button" data-cookie-action="reject">Reject optional</button><button type="button" data-cookie-action="allow">Allow all</button></div><button class="cookie-confirm" type="button">Confirm my choices</button></footer>`;
        document.body.appendChild(dialog);
        banner = document.createElement("section");
        banner.className = "cookie-banner";
        banner.setAttribute("aria-labelledby", "cookie-banner-title");
        banner.innerHTML = `
            <div class="cookie-banner-copy"><strong id="cookie-banner-title">Your privacy choices</strong><p>We use essential cookies to run MPWR. With your permission, optional cookies help us improve the shop, remember what you browse, and personalize products. <a href="privacy-policy.html#cookies">Privacy &amp; Cookie Policy</a></p></div>
            <div class="cookie-banner-actions"><button type="button" data-cookie-banner="reject" aria-label="Reject optional cookies">Reject</button><button type="button" data-cookie-banner="manage">Manage cookies</button><button type="button" data-cookie-banner="accept">Accept all</button></div>`;
        banner.hidden = true;
        document.body.appendChild(banner);
        banner.querySelector('[data-cookie-banner="reject"]').addEventListener("click", () => confirm({}));
        banner.querySelector('[data-cookie-banner="manage"]').addEventListener("click", event => open(event.currentTarget));
        banner.querySelector('[data-cookie-banner="accept"]').addEventListener("click", () => confirm({ performance: true, functional: true, targeting: true }));
        syncBanner();
        const toast = document.createElement("div");
        toast.id = "cookie-consent-status"; toast.className = "cookie-consent-toast";
        toast.setAttribute("role", "status"); toast.setAttribute("aria-live", "polite"); toast.hidden = true;
        document.body.appendChild(toast);
        dialog.querySelector(".cookie-close").addEventListener("click", close);
        dialog.addEventListener("close", () => {
            document.documentElement.classList.remove("cookie-settings-open");
            if (opener?.isConnected) opener.focus();
        });
        dialog.addEventListener("click", event => {
            const bounds = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
        });
        dialog.querySelector(".cookie-confirm").addEventListener("click", () => confirm(Object.fromEntries(CATEGORIES.map(key => [key, dialog.querySelector(`[name="${key}"]`).checked]))));
        dialog.querySelector('[data-cookie-action="reject"]').addEventListener("click", () => confirm({}));
        dialog.querySelector('[data-cookie-action="allow"]').addEventListener("click", () => confirm({ performance: true, functional: true, targeting: true }));
    }
    document.addEventListener("click", event => {
        const trigger = event.target.closest?.("[data-manage-cookies]");
        if (!trigger || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); open(trigger);
    });
    window.MPWRCookieConsent = Object.freeze({ get, allows, save, open, close, sanitizeItems });
    function ready() {
        mount();
        if (document.querySelector("[data-cookie-settings-page]")) open(document.querySelector("[data-manage-cookies]"));
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
    else ready();
})();
