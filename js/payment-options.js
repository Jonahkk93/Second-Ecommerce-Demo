import { onAuthStateChanged } from "./auth-api.js";
import { doc, getDoc, serverTimestamp, setDoc } from "./firestore-api.js";

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
    const migratedType = method.type === "mobile_money"
        ? (method.network === "Airtel" ? "airtel_money" : "mtn_momo")
        : method.type;
    const type = ["card", "mtn_momo", "airtel_money"].includes(migratedType) ? migratedType : "card";
    return {
        id: String(method.id || `saved-${index}`),
        type,
        isDefault: Boolean(method.isDefault),
        ...(type !== "card" ? {
            phone: String(method.phone || "").trim()
        } : {})
    };
}

function normalizeMethods(data) {
    const saved = Array.isArray(data.paymentMethods)
        ? data.paymentMethods.filter(method => method.type !== "flutterwave").map(normalizeMethod)
        : [];
    const valid = saved.filter(method => method.type === "card" || method.phone);
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
    form.elements.mtnNumber.value = method?.type === "mtn_momo" ? method.phone : defaultPhone;
    form.elements.airtelNumber.value = method?.type === "airtel_money" ? method.phone : defaultPhone;
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
    if (method.type === "mtn_momo" || method.type === "airtel_money") return {
        title:method.type === "mtn_momo" ? "MTN MoMo" : "Airtel Money",
        detail:method.phone,
        icon:method.type === "mtn_momo" ? "MTN" : "Airtel",
        iconImage:method.type === "airtel_money"
            ? "images/Icon Folder/Airtel Icon.PNG"
            : "images/Icon Folder/Momo logo.jpg",
        iconAlt:method.type === "airtel_money" ? "Airtel Money" : "MTN MoMo"
    };
    return {
        title:"Credit / debit card",
        detail:"Enter securely when paying",
        icon:"Card",
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

function fieldInvalid(field, invalid) {
    field.classList.toggle("is-invalid", invalid);
    return invalid;
}

function paymentFromForm() {
    const data = new FormData(form);
    const type = data.get("type");
    const base = { id:editingId || createId(), type, isDefault:data.get("isDefault") === "on" || methods.length === 0 };
    if (type === "card") return normalizeMethod(base);
    const field = type === "airtel_money" ? form.elements.airtelNumber : form.elements.mtnNumber;
    const phone = String(field.value || "").trim();
    const invalid = fieldInvalid(field, phone.replace(/\D/g, "").length < 9);
    return invalid ? null : normalizeMethod({ ...base, phone });
}

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
