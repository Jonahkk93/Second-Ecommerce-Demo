import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const auth = window.auth;
const db = window.db;
const form = document.getElementById("checkout-form");
const itemsContainer = document.getElementById("checkout-items");
const errorElement = document.getElementById("form-error");
const submitButton = document.getElementById("place-order");
const mobileFields = document.getElementById("mobile-money-fields");
const itemsToggle = document.getElementById("order-items-toggle");
const checkoutBack = document.getElementById("checkout-back");
const exitOverlay = document.getElementById("checkout-exit-overlay");
const stayAtCheckout = document.getElementById("checkout-stay");
const leaveCheckout = document.getElementById("checkout-leave");
const networkPicker = document.querySelector(".network-picker");
const networkTrigger = document.querySelector(".network-picker-trigger");
const networkMenu = document.querySelector(".network-picker-menu");
const visibleItemLimit = 3;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
cart = window.normalizeMPWRItems?.(cart) || cart;
localStorage.setItem("cart", JSON.stringify(cart));
let currentUser = null;
let pendingExitUrl = "index.html";
let checkoutComplete = false;

function closeExitConfirmation() {
    exitOverlay.classList.remove("active");
    exitOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("checkout-exit-open");
}

function showExitConfirmation(url = "index.html") {
    pendingExitUrl = url;
    closeNetworkPicker();
    exitOverlay.classList.add("active");
    exitOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("checkout-exit-open");
    stayAtCheckout.focus();
}

document.addEventListener("click", event => {
    const link = event.target.closest('a[href]');
    if (!link || checkoutComplete || link.target === "_blank") return;
    event.preventDefault();
    showExitConfirmation(link.href);
});

stayAtCheckout.addEventListener("click", closeExitConfirmation);

leaveCheckout.addEventListener("click", () => {
    if (new URL(pendingExitUrl, window.location.href).pathname.endsWith("index.html")) {
        sessionStorage.setItem("mpwrOpenCartOnReturn", "true");
    }
    window.location.href = pendingExitUrl;
});

exitOverlay.addEventListener("click", event => {
    if (event.target === exitOverlay) closeExitConfirmation();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && exitOverlay.classList.contains("active")) closeExitConfirmation();
});

history.pushState({ checkoutExitGuard: true }, "", window.location.href);
window.addEventListener("popstate", () => {
    if (checkoutComplete) return;
    history.pushState({ checkoutExitGuard: true }, "", window.location.href);
    showExitConfirmation("index.html");
});


function closeNetworkPicker() {
    networkMenu.hidden = true;
    networkTrigger.setAttribute("aria-expanded", "false");
}

networkTrigger.addEventListener("click", event => {
    event.stopPropagation();
    const willOpen = networkMenu.hidden;
    networkMenu.hidden = !willOpen;
    networkTrigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) networkMenu.querySelector(".selected")?.focus();
});

networkMenu.querySelectorAll("button").forEach(option => {
    option.addEventListener("click", event => {
        event.stopPropagation();
        form.elements.mobileNetwork.value = option.dataset.value;
        networkTrigger.querySelector("span").textContent = option.textContent.trim();
        networkMenu.querySelectorAll("button").forEach(button => {
            const selected = button === option;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-selected", String(selected));
        });
        closeNetworkPicker();
        networkTrigger.focus();
    });
});

networkPicker.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeNetworkPicker(); networkTrigger.focus(); }
});

document.addEventListener("click", event => {
    if (!event.target.closest(".network-picker")) closeNetworkPicker();
});

const numberFromPrice = value => Number(String(value ?? 0).replace(/[^\d]/g, "")) || 0;
const money = value => `UGX ${value.toLocaleString()}`;
const itemOptions = item => Object.values(item.selectedOptions || {}).filter(Boolean).join(" · ") || [item.color, item.size].filter(Boolean).join(" · ");

function renderSummary() {
    if (!cart.length) {
        window.location.replace("index.html");
        return;
    }
    itemsContainer.innerHTML = "";
    cart.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "checkout-item";
        if (index >= visibleItemLimit) row.classList.add("is-collapsed");
        const image = document.createElement("img");
        image.src = item.image || "images/Shopping Bag.png";
        image.alt = "";
        const details = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = item.title || "MPWR product";
        const quantity = document.createElement("p");
        quantity.textContent = `Quantity: ${Number(item.quantity) || 1}`;
        details.append(title);
        const options = itemOptions(item);
        if (options) { const optionLine = document.createElement("p"); optionLine.textContent = options; details.append(optionLine); }
        details.append(quantity);
        const price = document.createElement("strong");
        price.className = "checkout-item-price";
        price.textContent = money(numberFromPrice(item.price) * (Number(item.quantity) || 1));
        row.append(image, details, price);
        itemsContainer.append(row);
    });
    itemsToggle.hidden = cart.length <= visibleItemLimit;
    itemsToggle.setAttribute("aria-expanded", "false");
    itemsToggle.querySelector(".order-items-toggle-label").textContent = `Show ${cart.length - visibleItemLimit} more item${cart.length - visibleItemLimit === 1 ? "" : "s"}`;
    const total = cart.reduce((sum, item) => sum + numberFromPrice(item.price) * (Number(item.quantity) || 1), 0);
    document.getElementById("subtotal").textContent = money(total);
    document.getElementById("order-total").textContent = money(total);
}

itemsToggle.addEventListener("click", () => {
    const expanded = itemsToggle.getAttribute("aria-expanded") === "true";
    itemsContainer.querySelectorAll(".checkout-item").forEach((item, index) => {
        if (index >= visibleItemLimit) item.classList.toggle("is-collapsed", expanded);
    });
    itemsToggle.setAttribute("aria-expanded", String(!expanded));
    itemsToggle.querySelector(".order-items-toggle-label").textContent = expanded
        ? `Show ${cart.length - visibleItemLimit} more item${cart.length - visibleItemLimit === 1 ? "" : "s"}`
        : "Show fewer items";
});

document.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener("change", () => {
    const mobileSelected = form.elements.paymentMethod.value === "mobile_money";
    mobileFields.hidden = !mobileSelected;
    form.elements.mobileNumber.required = mobileSelected;
    if (!mobileSelected) closeNetworkPicker();
}));

onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) {
        sessionStorage.setItem("mpwrReturnAfterSignin", "checkout.html");
        window.location.replace("index.html");
        return;
    }
    form.elements.email.value = user.email || "";
    const names = String(user.displayName || "").trim().split(/\s+/);
    if (names[0]) form.elements.firstName.value = names.shift();
    if (names.length) form.elements.lastName.value = names.join(" ");
    try {
        const profile = await getDoc(doc(db, "users", user.uid));
        if (profile.exists()) {
            const data = profile.data();
            form.elements.firstName.value ||= data.firstName || "";
            form.elements.lastName.value ||= data.lastName || "";
            form.elements.phone.value ||= data.phone || data.phoneNumber || "";
        }
    } catch (error) { console.warn("Could not load checkout profile", error); }
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    errorElement.textContent = "";
    if (!currentUser) { errorElement.textContent = "Please sign in to place your order."; return; }
    if (!form.reportValidity()) return;
    cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (!cart.length) { window.location.replace("index.html"); return; }

    submitButton.disabled = true;
    submitButton.textContent = "Placing order…";
    const data = new FormData(form);
    const total = cart.reduce((sum, item) => sum + numberFromPrice(item.price) * (Number(item.quantity) || 1), 0);
    try {
        const order = await addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            customer: { firstName: data.get("firstName").trim(), lastName: data.get("lastName").trim(), email: data.get("email").trim(), phone: data.get("phone").trim() },
            delivery: { address: data.get("address").trim(), city: data.get("city").trim(), district: data.get("district").trim(), notes: data.get("notes").trim() },
            payment: { method: data.get("paymentMethod"), network: data.get("paymentMethod") === "mobile_money" ? data.get("mobileNetwork") : null, number: data.get("paymentMethod") === "mobile_money" ? data.get("mobileNumber").trim() : null, status: "Pending" },
            items: cart,
            total,
            status: "Pending",
            createdAt: serverTimestamp()
        });
        localStorage.setItem("cart", "[]");
        await setDoc(doc(db, "carts", currentUser.uid), { items: [] });
        document.querySelector(".checkout-form-panel").hidden = true;
        document.querySelector(".order-summary").hidden = true;
        document.getElementById("order-number").textContent = `#${order.id.slice(0, 8).toUpperCase()}`;
        document.getElementById("order-success").hidden = false;
        checkoutComplete = true;
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error("Checkout failed", error);
        errorElement.textContent = "We couldn’t place your order. Please check your connection and try again.";
        submitButton.disabled = false;
        submitButton.textContent = "Place order";
    }
});

renderSummary();
