import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;
const methodsContainer = document.querySelector(".payment-methods");
const emptyState = document.querySelector(".payment-empty");
const loading = document.querySelector(".payment-loading");
const addButton = document.querySelector(".payment-add");
const backLink = document.querySelector(".payment-back");
const editorOverlay = document.querySelector(".payment-editor-overlay");
const editorTitle = document.getElementById("payment-editor-title");
const editorClose = document.querySelector(".payment-editor-close");
const form = document.getElementById("payment-option-form");
const typeSelect = form.elements.type;
const formError = document.querySelector(".payment-form-error");
const saveButton = document.querySelector(".payment-save");
const deleteOverlay = document.querySelector(".payment-delete-overlay");
const deleteCancel = document.querySelector(".payment-delete-cancel");
const deleteConfirm = document.querySelector(".payment-delete-confirm");
const toast = document.querySelector(".payment-toast");
const paymentPickers = [...document.querySelectorAll(".payment-picker")];

let currentUser = null;
let profile = {};
let methods = [];
let editingId = null;
let deletingId = null;
let toastTimer = null;

const returnTarget = new URLSearchParams(location.search).get("return");
if (returnTarget && /^[a-z0-9-]+\.html(?:\?.*)?$/i.test(returnTarget)) {
    backLink.href = returnTarget;
    backLink.setAttribute("aria-label", "Back to checkout");
}

function createId() {
    return crypto.randomUUID?.() || `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* Only these display/preference fields may ever be persisted. */
function normalizeMethod(method, index = 0) {
    const type = ["card", "flutterwave", "mobile_money"].includes(method.type) ? method.type : "card";
    return {
        id: String(method.id || `saved-${index}`),
        type,
        isDefault: Boolean(method.isDefault),
        ...(type === "card" ? {
            cardholderName: String(method.cardholderName || "").trim(),
            brand: String(method.brand || "Card").trim(),
            last4: String(method.last4 || "").replace(/\D/g, "").slice(-4),
            expiry: String(method.expiry || "").trim()
        } : {}),
        ...(type === "flutterwave" ? {
            email: String(method.email || "").trim(),
            phone: String(method.phone || "").trim()
        } : {}),
        ...(type === "mobile_money" ? {
            network: method.network === "Airtel" ? "Airtel" : "MTN",
            phone: String(method.phone || "").trim()
        } : {})
    };
}

function normalizeMethods(data) {
    const saved = Array.isArray(data.paymentMethods) ? data.paymentMethods.map(normalizeMethod) : [];
    const valid = saved.filter(method => method.type !== "card" || method.last4);
    if (valid.length && !valid.some(method => method.isDefault)) valid[0].isDefault = true;
    let foundDefault = false;
    valid.forEach(method => {
        if (method.isDefault && !foundDefault) foundDefault = true;
        else if (method.isDefault) method.isDefault = false;
    });
    return valid;
}

function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("active");
    toastTimer = setTimeout(() => toast.classList.remove("active"), 2200);
}

function setModalState() {
    document.body.classList.toggle("payment-modal-open", editorOverlay.classList.contains("active") || deleteOverlay.classList.contains("active"));
}

function updateFields() {
    const selectedType = typeSelect.value;
    document.querySelectorAll("[data-payment-fields]").forEach(group => {
        group.hidden = group.dataset.paymentFields !== selectedType;
    });
}

function closePaymentPickers(except = null) {
    paymentPickers.forEach(picker => {
        if (picker === except) return;
        picker.querySelector(".payment-picker-menu").hidden = true;
        picker.querySelector(".payment-picker-trigger").setAttribute("aria-expanded", "false");
    });
}

function setPickerValue(picker, value, focus = false) {
    const option = picker.querySelector(`[data-value="${CSS.escape(value)}"]`);
    if (!option) return;
    const input = picker.previousElementSibling;
    input.value = value;
    const optionDisplay = option.querySelector(".payment-picker-option");
    const triggerDisplay = picker.querySelector(".payment-picker-trigger .payment-picker-option");
    if (optionDisplay && triggerDisplay) {
        triggerDisplay.innerHTML = optionDisplay.innerHTML;
        const triggerText = triggerDisplay.lastElementChild;
        if (triggerText) triggerText.classList.add("payment-picker-text");
    } else {
        picker.querySelector(".payment-picker-trigger .payment-picker-text").textContent = option.textContent.trim();
    }
    picker.querySelectorAll('[role="option"]').forEach(button => {
        const selected = button === option;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", String(selected));
    });
    if (picker.dataset.paymentPicker === "type") {
        formError.textContent = "";
        updateFields();
    }
    if (focus) picker.querySelector(".payment-picker-trigger").focus();
}

paymentPickers.forEach(picker => {
    const trigger = picker.querySelector(".payment-picker-trigger");
    const menu = picker.querySelector(".payment-picker-menu");
    trigger.addEventListener("click", event => {
        event.stopPropagation();
        const open = menu.hidden;
        closePaymentPickers(picker);
        menu.hidden = !open;
        trigger.setAttribute("aria-expanded", String(open));
    });
    menu.querySelectorAll("button").forEach(option => option.addEventListener("click", event => {
        event.stopPropagation();
        setPickerValue(picker, option.dataset.value, true);
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    }));
});

document.addEventListener("click", event => {
    if (!event.target.closest(".payment-picker")) closePaymentPickers();
});

function closeEditor() {
    editorOverlay.classList.remove("active");
    editorOverlay.setAttribute("aria-hidden", "true");
    editingId = null;
    setModalState();
}

function openEditor(method = null) {
    editingId = method?.id || null;
    form.reset();
    formError.textContent = "";
    form.querySelectorAll(".is-invalid").forEach(field => field.classList.remove("is-invalid"));
    editorTitle.textContent = method ? "Edit payment option" : "Add payment option";
    setPickerValue(document.querySelector('[data-payment-picker="type"]'), method?.type || "card");
    const defaultPhone = profile.phone || profile.phoneNumber || "";
    form.elements.cardholderName.value = method?.cardholderName || `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
    form.elements.cardNumber.value = "";
    form.elements.cardNumber.placeholder = method?.last4 ? `Saved card ending ${method.last4}` : "1234 5678 9012 3456";
    form.elements.cardExpiry.value = method?.expiry || "";
    form.elements.flutterwaveEmail.value = method?.email || currentUser?.email || "";
    form.elements.flutterwavePhone.value = method?.type === "flutterwave" ? method.phone : defaultPhone;
    setPickerValue(document.querySelector('[data-payment-picker="network"]'), method?.network || "MTN");
    form.elements.mobileNumber.value = method?.type === "mobile_money" ? method.phone : defaultPhone;
    form.elements.isDefault.checked = Boolean(method?.isDefault || methods.length === 0);
    updateFields();
    editorOverlay.classList.add("active");
    editorOverlay.setAttribute("aria-hidden", "false");
    setModalState();
    requestAnimationFrame(() => typeSelect.focus());
}

function closeDeleteDialog() {
    deleteOverlay.classList.remove("active");
    deleteOverlay.setAttribute("aria-hidden", "true");
    deletingId = null;
    setModalState();
}

function openDeleteDialog(id) {
    deletingId = id;
    deleteOverlay.classList.add("active");
    deleteOverlay.setAttribute("aria-hidden", "false");
    setModalState();
    deleteCancel.focus();
}

function methodCopy(method) {
    if (method.type === "mobile_money") return {
        title:`${method.network} ${method.network === "MTN" ? "MoMo" : "Money"}`,
        detail:method.phone,
        icon:method.network,
        iconImage:method.network === "Airtel"
            ? "images/Icon Folder/Airtel Icon.PNG"
            : "images/Icon Folder/Momo logo.jpg",
        iconAlt:method.network === "Airtel" ? "Airtel" : "MTN MoMo"
    };
    if (method.type === "flutterwave") return {
        title:"Flutterwave",
        detail:[method.email,method.phone].filter(Boolean).join(" • "),
        icon:"FW",
        iconImage:"images/Icon Folder/Flutterwave Logo.PNG",
        iconAlt:"Flutterwave"
    };
    return {
        title:`${method.brand} ending in ${method.last4}`,
        detail:[method.cardholderName,method.expiry && `Expires ${method.expiry}`].filter(Boolean).join(" • "),
        icon:method.brand,
        iconImage:"images/Icon Folder/Visa_Mastercard Icon 2.PNG",
        iconAlt:"Visa and Mastercard"
    };
}

function actionButton(label, content) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "payment-card-action";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = content;
    return button;
}

function renderMethods() {
    methodsContainer.replaceChildren();
    methods.forEach(method => {
        const copy = methodCopy(method);
        const card = document.createElement("article");
        card.className = "payment-card";
        const icon = document.createElement("span");
        icon.className = "payment-method-icon";
        if (copy.iconImage) {
            const iconImage = document.createElement("img");
            iconImage.src = copy.iconImage;
            iconImage.alt = copy.iconAlt;
            icon.appendChild(iconImage);
        } else {
            icon.textContent = copy.icon;
        }
        const details = document.createElement("div");
        details.className = "payment-card-details";
        const title = document.createElement("h2");
        title.textContent = copy.title;
        const subtitle = document.createElement("p");
        subtitle.textContent = copy.detail;
        details.append(title,subtitle);
        const side = document.createElement("div");
        side.className = "payment-card-side";
        const defaultButton = document.createElement("button");
        defaultButton.type = "button";
        defaultButton.className = "payment-default";
        defaultButton.disabled = method.isDefault;
        defaultButton.textContent = method.isDefault ? "Default" : "Set as default";
        defaultButton.addEventListener("click", () => setDefaultMethod(method.id));
        const edit = actionButton("Edit payment option", `<img src="images/Icon Folder/Pencil Icon_Gray.PNG" alt="">`);
        edit.addEventListener("click", () => openEditor(method));
        const remove = actionButton("Delete payment option", `<img src="images/Icon Folder/Delete Icon_Gray.PNG" alt="">`);
        remove.addEventListener("click", () => openDeleteDialog(method.id));
        side.append(defaultButton,edit,remove);
        card.append(icon,details,side);
        methodsContainer.appendChild(card);
    });
    methodsContainer.hidden = methods.length === 0;
    emptyState.hidden = methods.length !== 0;
}

async function persistMethods(message) {
    if (!currentUser) return;
    methods = methods.map(normalizeMethod);
    await setDoc(doc(db,"users",currentUser.uid), { paymentMethods:methods, paymentMethodsUpdatedAt:serverTimestamp() }, { merge:true });
    renderMethods();
    if (message) showToast(message);
}

async function setDefaultMethod(id) {
    const previous = methods.map(method => ({...method}));
    methods = methods.map(method => ({...method,isDefault:method.id === id}));
    renderMethods();
    try { await persistMethods("Default payment option updated"); }
    catch (error) { console.error(error); methods = previous; renderMethods(); showToast("Could not update the payment option"); }
}

function cardBrand(number) {
    if (/^4/.test(number)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(number)) return "Mastercard";
    if (/^3[47]/.test(number)) return "Amex";
    return "Card";
}

function luhnValid(number) {
    let sum = 0;
    let double = false;
    for (let index = number.length - 1; index >= 0; index -= 1) {
        let digit = Number(number[index]);
        if (double && (digit *= 2) > 9) digit -= 9;
        sum += digit;
        double = !double;
    }
    return number.length >= 13 && number.length <= 19 && sum % 10 === 0;
}

function fieldInvalid(field, invalid) {
    field.classList.toggle("is-invalid", invalid);
    return invalid;
}

function paymentFromForm() {
    const data = new FormData(form);
    const type = data.get("type");
    const existing = methods.find(method => method.id === editingId);
    const base = { id:editingId || createId(), type, isDefault:data.get("isDefault") === "on" || methods.length === 0 };
    let invalid = false;
    if (type === "card") {
        const number = String(data.get("cardNumber") || "").replace(/\D/g, "");
        const expiry = String(data.get("cardExpiry") || "").trim();
        const holder = String(data.get("cardholderName") || "").trim();
        invalid = fieldInvalid(form.elements.cardholderName,!holder) || invalid;
        invalid = fieldInvalid(form.elements.cardNumber,!number && !(existing?.type === "card" && existing.last4) || Boolean(number && !luhnValid(number))) || invalid;
        invalid = fieldInvalid(form.elements.cardExpiry,!/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/.test(expiry)) || invalid;
        if (invalid) return null;
        return normalizeMethod({ ...base,cardholderName:holder,brand:number ? cardBrand(number) : existing.brand,last4:number ? number.slice(-4) : existing.last4,expiry });
    }
    if (type === "flutterwave") {
        const email = String(data.get("flutterwaveEmail") || "").trim();
        const phone = String(data.get("flutterwavePhone") || "").trim();
        invalid = fieldInvalid(form.elements.flutterwaveEmail,!email || !form.elements.flutterwaveEmail.checkValidity()) || invalid;
        invalid = fieldInvalid(form.elements.flutterwavePhone,phone.replace(/\D/g,"").length < 9) || invalid;
        return invalid ? null : normalizeMethod({ ...base,email,phone });
    }
    const phone = String(data.get("mobileNumber") || "").trim();
    invalid = fieldInvalid(form.elements.mobileNumber,phone.replace(/\D/g,"").length < 9);
    return invalid ? null : normalizeMethod({ ...base,network:data.get("mobileNetwork"),phone });
}

form.elements.cardNumber.addEventListener("input", event => {
    const digits = event.target.value.replace(/\D/g,"").slice(0,19);
    event.target.value = digits.replace(/(.{4})/g,"$1 ").trim();
});
form.elements.cardExpiry.addEventListener("input", event => {
    const digits = event.target.value.replace(/\D/g,"").slice(0,4);
    event.target.value = digits.length > 2 ? `${digits.slice(0,2)} / ${digits.slice(2)}` : digits;
});
form.addEventListener("input", event => event.target.classList?.remove("is-invalid"));
form.addEventListener("submit", async event => {
    event.preventDefault();
    formError.textContent = "";
    const method = paymentFromForm();
    if (!method || !currentUser) { formError.textContent = "Please check all highlighted fields."; return; }
    const previous = methods.map(item => ({...item}));
    if (method.isDefault) methods = methods.map(item => ({...item,isDefault:false}));
    const existingIndex = methods.findIndex(item => item.id === method.id);
    if (existingIndex >= 0) methods[existingIndex] = method; else methods.push(method);
    if (!methods.some(item => item.isDefault)) methods[0].isDefault = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    try { await persistMethods(existingIndex >= 0 ? "Payment option updated" : "Payment option added"); closeEditor(); }
    catch (error) { console.error(error); methods = previous; formError.textContent = "Your payment option could not be saved."; }
    finally { saveButton.disabled = false; saveButton.textContent = "Save payment option"; }
});

deleteConfirm.addEventListener("click", async () => {
    if (!deletingId) return;
    const previous = methods.map(method => ({...method}));
    const wasDefault = methods.find(method => method.id === deletingId)?.isDefault;
    methods = methods.filter(method => method.id !== deletingId);
    if (wasDefault && methods.length) methods[0].isDefault = true;
    deleteConfirm.disabled = true;
    try { await persistMethods("Payment option deleted"); closeDeleteDialog(); }
    catch (error) { console.error(error); methods = previous; renderMethods(); showToast("Could not delete the payment option"); }
    finally { deleteConfirm.disabled = false; }
});

addButton.addEventListener("click", () => openEditor());
editorClose.addEventListener("click",closeEditor);
deleteCancel.addEventListener("click",closeDeleteDialog);
editorOverlay.addEventListener("click",event => { if (event.target === editorOverlay) closeEditor(); });
deleteOverlay.addEventListener("click",event => { if (event.target === deleteOverlay) closeDeleteDialog(); });
document.addEventListener("keydown",event => {
    if (event.key !== "Escape") return;
    if (paymentPickers.some(picker => !picker.querySelector(".payment-picker-menu").hidden)) {
        closePaymentPickers();
        return;
    }
    deleteOverlay.classList.contains("active") ? closeDeleteDialog() : closeEditor();
});

onAuthStateChanged(auth,async user => {
    currentUser = user;
    if (!user) { sessionStorage.setItem("mpwrReturnAfterSignin",location.pathname.split("/").pop()+location.search); location.replace("index.html"); return; }
    try {
        const snapshot = await getDoc(doc(db,"users",user.uid));
        profile = snapshot.exists() ? snapshot.data() : {};
        methods = normalizeMethods(profile);
        renderMethods();
    } catch (error) { console.error(error); emptyState.hidden = false; showToast("Could not load your payment options"); }
    finally { loading.hidden = true; document.documentElement.dataset.siteContentReady = "true"; window.MPWRLoading?.ready(); }
});
