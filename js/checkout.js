import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "./firestore-api.js";
import { onAuthStateChanged } from "./auth-api.js";
import { deliveryQuoteFor, populateUgandaDistricts } from "./shipping-config.js?v=20260827-2";

const auth = window.auth;
const db = window.db;
const form = document.getElementById("checkout-form");
const itemsContainer = document.getElementById("checkout-items");
const errorElement = document.getElementById("form-error");
const submitButton = document.getElementById("place-order");
const mobileFields = document.getElementById("mobile-money-fields");
const creditCardFields = document.getElementById("credit-card-fields");
const flutterwaveFields = document.getElementById("flutterwave-fields");
const itemsToggle = document.getElementById("order-items-toggle");
const checkoutBack = document.getElementById("checkout-back");
const exitOverlay = document.getElementById("checkout-exit-overlay");
const stayAtCheckout = document.getElementById("checkout-stay");
const leaveCheckout = document.getElementById("checkout-leave");
const networkPicker = document.querySelector(".network-picker");
const networkTrigger = document.querySelector(".network-picker-trigger");
const networkMenu = document.querySelector(".network-picker-menu");
const deliveryQuoteCard = document.getElementById("delivery-quote");
const deliveryFeeElement = document.getElementById("delivery-fee");
const deliverySummaryEta = document.getElementById("delivery-summary-eta");
const visibleItemLimit = 3;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
cart = window.normalizeMPWRItems?.(cart) || cart;
localStorage.setItem("cart", JSON.stringify(cart));
let currentUser = null;
let pendingExitUrl = "index.html";
let checkoutComplete = false;
let subtotal = 0;
let deliveryQuote = null;

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

function setNetworkOption(option) {
    if (!option) return;
    form.elements.mobileNetwork.value = option.dataset.value;
    networkTrigger.querySelector(".network-picker-text").textContent = option.textContent.trim();
    const optionImage = option.querySelector("img");
    const triggerImage = networkTrigger.querySelector("img");
    if (optionImage && triggerImage) triggerImage.src = optionImage.src;
    networkMenu.querySelectorAll("button").forEach(button => {
        const selected = button === option;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", String(selected));
    });
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
        setNetworkOption(option);
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

function refreshDeliveryQuote() {
    deliveryQuote = deliveryQuoteFor(form.elements.district.value, cart);
    deliveryQuoteCard.hidden = !deliveryQuote;

    if (!deliveryQuote) {
        deliveryFeeElement.textContent = "Select district";
        deliverySummaryEta.textContent = "";
        document.getElementById("order-total").textContent = money(subtotal);
        return;
    }

    document.getElementById("delivery-method").textContent = deliveryQuote.methodLabel;
    document.getElementById("delivery-zone").textContent = `${deliveryQuote.district} · ${deliveryQuote.zoneName}`;
    document.getElementById("delivery-eta").textContent = `Estimated delivery: ${deliveryQuote.etaLabel}`;
    document.getElementById("delivery-quote-fee").textContent = money(deliveryQuote.fee);
    deliveryFeeElement.textContent = money(deliveryQuote.fee);
    deliverySummaryEta.textContent = deliveryQuote.etaLabel;
    document.getElementById("order-total").textContent = money(subtotal + deliveryQuote.fee);
}

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
    subtotal = cart.reduce((sum, item) => sum + numberFromPrice(item.price) * (Number(item.quantity) || 1), 0);
    document.getElementById("subtotal").textContent = money(subtotal);
    refreshDeliveryQuote();
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

function updatePaymentFields() {
    const method = form.elements.paymentMethod.value;
    const mobileSelected = method === "mobile_money";
    const cardSelected = method === "credit_card";
    const flutterwaveSelected = method === "flutterwave";

    mobileFields.hidden = !mobileSelected;
    creditCardFields.hidden = !cardSelected;
    flutterwaveFields.hidden = !flutterwaveSelected;

    form.elements.mobileNumber.required = mobileSelected;
    ["cardholderName", "cardNumber", "cardExpiry", "cardCvv"].forEach(name => {
        form.elements[name].required = cardSelected;
    });
    ["flutterwaveEmail", "flutterwavePhone"].forEach(name => {
        form.elements[name].required = flutterwaveSelected;
    });
    if (!mobileSelected) closeNetworkPicker();
}

document.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener("change", updatePaymentFields));
updatePaymentFields();

function validateCheckoutForm() {
    const fields = [...form.querySelectorAll("input, textarea, select")]
        .filter(field => field.willValidate && !field.disabled);
    const invalidFields = fields.filter(field => !field.checkValidity());
    const firstInvalid = invalidFields[0];
    if (!firstInvalid) return true;

    fields.forEach(field => {
        const invalid = invalidFields.includes(field);
        field.classList.toggle("is-invalid", invalid);
        field.setAttribute("aria-invalid", String(invalid));
    });

    const hasFormatError = invalidFields.some(field =>
        field.validity.typeMismatch || field.validity.patternMismatch
    );
    errorElement.textContent = hasFormatError
        ? "Please correct all highlighted fields."
        : "Please complete all highlighted fields.";
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid.focus({ preventScroll: true });
    return false;
}

form.addEventListener("input", event => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
    if (field.checkValidity()) {
        field.classList.remove("is-invalid");
        field.removeAttribute("aria-invalid");
    }
});

populateUgandaDistricts(form.elements.district);
form.elements.district.addEventListener("change", refreshDeliveryQuote);

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
            const savedAddresses = Array.isArray(data.shippingAddresses)
                ? data.shippingAddresses
                : data.shippingAddress && typeof data.shippingAddress === "object"
                    ? [data.shippingAddress]
                    : [];
            const shippingAddress = savedAddresses.find(address => address.isDefault) || savedAddresses[0];
            if (shippingAddress) {
                if (shippingAddress.firstName) form.elements.firstName.value = shippingAddress.firstName;
                if (shippingAddress.lastName) form.elements.lastName.value = shippingAddress.lastName;
                if (shippingAddress.phone || shippingAddress.phoneNumber) form.elements.phone.value = shippingAddress.phone || shippingAddress.phoneNumber;
                if (shippingAddress.address || shippingAddress.street) form.elements.address.value = shippingAddress.address || shippingAddress.street;
                if (shippingAddress.city) form.elements.city.value = shippingAddress.city;
                if (shippingAddress.district || shippingAddress.region) {
                    populateUgandaDistricts(form.elements.district, shippingAddress.district || shippingAddress.region);
                    refreshDeliveryQuote();
                }
                if (shippingAddress.notes) form.elements.notes.value = shippingAddress.notes;
                form.elements.mobileNumber.value ||= shippingAddress.phone || shippingAddress.phoneNumber || "";
                form.elements.flutterwavePhone.value ||= shippingAddress.phone || shippingAddress.phoneNumber || "";
            }
            const savedPaymentMethods = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
            const paymentMethod = savedPaymentMethods.find(method => method.isDefault) || savedPaymentMethods[0];
            if (paymentMethod) {
                const checkoutType = paymentMethod.type === "card" ? "credit_card" : paymentMethod.type;
                const paymentRadio = form.querySelector(`input[name="paymentMethod"][value="${checkoutType}"]`);
                if (paymentRadio) paymentRadio.checked = true;
                if (paymentMethod.type === "card") {
                    form.elements.cardholderName.value = paymentMethod.cardholderName || "";
                } else if (paymentMethod.type === "flutterwave") {
                    form.elements.flutterwaveEmail.value = paymentMethod.email || user.email || "";
                    form.elements.flutterwavePhone.value = paymentMethod.phone || "";
                } else if (paymentMethod.type === "mobile_money") {
                    const network = paymentMethod.network === "Airtel" ? "Airtel" : "MTN";
                    form.elements.mobileNumber.value = paymentMethod.phone || "";
                    setNetworkOption(networkMenu.querySelector(`[data-value="${network}"]`));
                }
                updatePaymentFields();
            }
        }
    } catch (error) { console.warn("Could not load checkout profile", error); }
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    errorElement.textContent = "";
    if (!currentUser) { errorElement.textContent = "Please sign in to place your order."; return; }
    if (!validateCheckoutForm()) return;
    cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (!cart.length) { window.location.replace("index.html"); return; }

    const data = new FormData(form);
    deliveryQuote = deliveryQuoteFor(data.get("district"), cart);
    if (!deliveryQuote) {
        errorElement.textContent = "Choose a supported delivery district in Uganda.";
        form.elements.district.focus();
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Placing order…";
    const orderSubtotal = cart.reduce((sum, item) => sum + numberFromPrice(item.price) * (Number(item.quantity) || 1), 0);
    const total = orderSubtotal + deliveryQuote.fee;
    try {
        const order = await addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            customer: { firstName: data.get("firstName").trim(), lastName: data.get("lastName").trim(), email: data.get("email").trim(), phone: data.get("phone").trim() },
            delivery: {
                address: data.get("address").trim(),
                city: data.get("city").trim(),
                district: deliveryQuote.district,
                country: "Uganda",
                notes: data.get("notes").trim(),
                zoneId: deliveryQuote.zoneId,
                zoneName: deliveryQuote.zoneName,
                method: deliveryQuote.method,
                methodLabel: deliveryQuote.methodLabel,
                shippingClass: deliveryQuote.shippingClass,
                baseFee: deliveryQuote.baseFee,
                surcharge: deliveryQuote.surcharge,
                fee: deliveryQuote.fee,
                minDays: deliveryQuote.minDays,
                maxDays: deliveryQuote.maxDays,
                etaLabel: deliveryQuote.etaLabel,
                configVersion: deliveryQuote.configVersion
            },
            payment: { method: data.get("paymentMethod"), network: data.get("paymentMethod") === "mobile_money" ? data.get("mobileNetwork") : null, number: data.get("paymentMethod") === "mobile_money" ? data.get("mobileNumber").trim() : null, status: "Pending" },
            items: cart,
            subtotal: orderSubtotal,
            deliveryFee: deliveryQuote.fee,
            total,
            status: "Pending",
            createdAt: serverTimestamp()
        });
        localStorage.setItem("cart", "[]");
        await setDoc(doc(db, "carts", currentUser.uid), { items: [] });
        document.querySelector(".checkout-form-panel").hidden = true;
        document.querySelector(".order-summary").hidden = true;
        document.getElementById("order-number").textContent = `#${order.id.slice(0, 8).toUpperCase()}`;
        document.getElementById("success-delivery").textContent =
            `${deliveryQuote.methodLabel} to ${deliveryQuote.district}: ${money(deliveryQuote.fee)} · ${deliveryQuote.etaLabel}`;
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
