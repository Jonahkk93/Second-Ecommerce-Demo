import { onAuthStateChanged } from "./auth-api.js";
import { doc, getDoc, serverTimestamp, setDoc } from "./firestore-api.js";
import { populateUgandaDistricts } from "./shipping-config.js?v=20260827-2";

const auth = window.auth;
const db = window.db;
const addressesContainer = document.querySelector(".shipping-addresses");
const emptyState = document.querySelector(".shipping-empty");
const loading = document.querySelector(".shipping-loading");
const addButton = document.querySelector(".shipping-add");
const backLink = document.querySelector(".shipping-back");
const editorOverlay = document.querySelector(".shipping-editor-overlay");
const editorTitle = document.getElementById("shipping-editor-title");
const editorClose = document.querySelector(".shipping-editor-close");
const form = document.getElementById("shipping-address-form");
const formError = document.querySelector(".shipping-form-error");
const saveButton = document.querySelector(".shipping-save");
const deleteOverlay = document.querySelector(".shipping-delete-overlay");
const deleteCancel = document.querySelector(".shipping-delete-cancel");
const deleteConfirm = document.querySelector(".shipping-delete-confirm");
const toast = document.querySelector(".shipping-toast");
const shippingPickers = [...document.querySelectorAll(".shipping-picker")];

populateUgandaDistricts(form.elements.district);

let currentUser = null;
let profile = {};
let addresses = [];
let editingId = null;
let deletingId = null;
let toastTimer = null;

const returnTarget = new URLSearchParams(location.search).get("return");
if (returnTarget && /^[a-z0-9-]+\.html(?:\?.*)?$/i.test(returnTarget)) {
    backLink.href = returnTarget;
    backLink.setAttribute("aria-label", "Back to checkout");
}

function createId() {
    return crypto.randomUUID?.() || `address-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizedAddress(address, index) {
    return {
        id: String(address.id || `saved-${index}`),
        firstName: String(address.firstName || "").trim(),
        lastName: String(address.lastName || "").trim(),
        phone: String(address.phone || address.phoneNumber || "").trim(),
        address: String(address.address || address.street || "").trim(),
        city: String(address.city || "").trim(),
        district: String(address.district || address.region || "").trim(),
        country: String(address.country || "Uganda").trim(),
        postalCode: String(address.postalCode || "").trim(),
        notes: String(address.notes || "").trim(),
        isDefault: Boolean(address.isDefault)
    };
}

function normalizeAddresses(data) {
    let saved = Array.isArray(data.shippingAddresses) ? data.shippingAddresses : [];
    if (!saved.length && data.shippingAddress && typeof data.shippingAddress === "object") saved = [data.shippingAddress];
    saved = saved.map(normalizedAddress).filter(address => address.address || address.city || address.phone);
    if (saved.length && !saved.some(address => address.isDefault)) saved[0].isDefault = true;
    let foundDefault = false;
    saved.forEach(address => {
        if (address.isDefault && !foundDefault) foundDefault = true;
        else if (address.isDefault) address.isDefault = false;
    });
    return saved;
}

function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("active");
    toastTimer = setTimeout(() => toast.classList.remove("active"), 2200);
}

function setModalState() {
    document.body.classList.toggle(
        "shipping-modal-open",
        editorOverlay.classList.contains("active") || deleteOverlay.classList.contains("active")
    );
}

function closeShippingPickers(except = null) {
    shippingPickers.forEach(picker => {
        if (picker === except) return;
        picker.querySelector(".shipping-picker-menu").hidden = true;
        picker.querySelector(".shipping-picker-trigger").setAttribute("aria-expanded", "false");
    });
}

function setShippingPickerValue(picker, value, focus = false) {
    const option = picker.querySelector(`[data-value="${CSS.escape(value)}"]`);
    if (!option) return;
    picker.previousElementSibling.value = value;
    picker.querySelector(".shipping-picker-text").textContent = option.textContent.trim();
    picker.querySelectorAll('[role="option"]').forEach(button => {
        const selected = button === option;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", String(selected));
    });
    if (focus) picker.querySelector(".shipping-picker-trigger").focus();
}

shippingPickers.forEach(picker => {
    const trigger = picker.querySelector(".shipping-picker-trigger");
    const menu = picker.querySelector(".shipping-picker-menu");
    trigger.addEventListener("click", event => {
        event.stopPropagation();
        const open = menu.hidden;
        closeShippingPickers(picker);
        menu.hidden = !open;
        trigger.setAttribute("aria-expanded", String(open));
    });
    menu.querySelectorAll("button").forEach(option => option.addEventListener("click", event => {
        event.stopPropagation();
        setShippingPickerValue(picker, option.dataset.value, true);
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    }));
});

document.addEventListener("click", event => {
    if (!event.target.closest(".shipping-picker")) closeShippingPickers();
});

function closeEditor() {
    closeShippingPickers();
    editorOverlay.classList.remove("active");
    editorOverlay.setAttribute("aria-hidden", "true");
    editingId = null;
    setModalState();
}

function openEditor(address = null) {
    editingId = address?.id || null;
    form.reset();
    formError.textContent = "";
    form.querySelectorAll(".is-invalid").forEach(field => field.classList.remove("is-invalid"));
    editorTitle.textContent = address ? "Edit address" : "Add new address";
    saveButton.textContent = address ? "Save changes" : "Save address";

    const displayParts = String(currentUser?.displayName || "").trim().split(/\s+/).filter(Boolean);
    const defaults = {
        firstName: profile.firstName || displayParts[0] || "",
        lastName: profile.lastName || displayParts.slice(1).join(" ") || "",
        phone: profile.phone || profile.phoneNumber || "",
        country: "Uganda",
        isDefault: addresses.length === 0
    };
    const values = { ...defaults, ...(address || {}) };
    populateUgandaDistricts(form.elements.district, values.district || "");
    ["firstName", "lastName", "phone", "address", "city", "district", "country", "postalCode", "notes"].forEach(name => {
        form.elements[name].value = values[name] || "";
    });
    shippingPickers.forEach(picker => setShippingPickerValue(picker, values.country || "Uganda"));
    form.elements.isDefault.checked = Boolean(values.isDefault);

    editorOverlay.classList.add("active");
    editorOverlay.setAttribute("aria-hidden", "false");
    setModalState();
    requestAnimationFrame(() => form.elements.firstName.focus());
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

function iconButton(label, className, content) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = content;
    return button;
}

function renderAddresses() {
    addressesContainer.replaceChildren();
    addresses.forEach(address => {
        const card = document.createElement("article");
        card.className = "shipping-card";

        const top = document.createElement("div");
        top.className = "shipping-card-top";
        const details = document.createElement("div");
        const name = document.createElement("h2");
        name.textContent = `${address.firstName} ${address.lastName}`.trim() || "MPWR Customer";
        const phone = document.createElement("p");
        phone.className = "shipping-card-phone";
        phone.textContent = address.phone;
        const addressLine = document.createElement("p");
        addressLine.className = "shipping-card-address";
        addressLine.textContent = [address.address, address.city, address.district, address.country, address.postalCode].filter(Boolean).join(", ");
        details.append(name, phone, addressLine);
        if (address.notes) {
            const notes = document.createElement("p");
            notes.className = "shipping-card-notes";
            notes.textContent = address.notes;
            details.appendChild(notes);
        }
        top.appendChild(details);
        if (address.isDefault) {
            const badge = document.createElement("span");
            badge.className = "shipping-card-badge";
            badge.textContent = "Default";
            top.appendChild(badge);
        }

        const footer = document.createElement("div");
        footer.className = "shipping-card-footer";
        const defaultButton = document.createElement("button");
        defaultButton.type = "button";
        defaultButton.className = `shipping-default${address.isDefault ? " is-default" : ""}`;
        defaultButton.disabled = address.isDefault;
        defaultButton.innerHTML = `<span class="shipping-default-mark" aria-hidden="true">${address.isDefault ? "✓" : ""}</span><span>${address.isDefault ? "Default address" : "Set as default"}</span>`;
        defaultButton.addEventListener("click", () => setDefaultAddress(address.id));

        const actions = document.createElement("div");
        actions.className = "shipping-card-actions";
        const editButton = iconButton("Edit address", "shipping-edit", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 6.5 17.5 10.5M4 20l4.2-.9L19 8.3a2.8 2.8 0 0 0-4-4L4.9 14.5 4 20Z"/><path d="M13.8 5.6 17.8 9.6"/></svg>`);
        editButton.addEventListener("click", () => openEditor(address));
        const deleteButton = iconButton("Delete address", "shipping-delete", `<img src="images/Icon Folder/Delete Icon_Gray.PNG" alt="">`);
        deleteButton.addEventListener("click", () => openDeleteDialog(address.id));
        actions.append(editButton, deleteButton);
        footer.append(defaultButton, actions);
        card.append(top, footer);
        addressesContainer.appendChild(card);
    });

    addressesContainer.hidden = addresses.length === 0;
    emptyState.hidden = addresses.length !== 0;
}

async function saveAddresses(message) {
    if (!currentUser) return;
    await setDoc(doc(db, "users", currentUser.uid), {
        shippingAddresses: addresses,
        shippingAddressesUpdatedAt: serverTimestamp()
    }, { merge: true });
    renderAddresses();
    if (message) showToast(message);
}

async function setDefaultAddress(id) {
    const previous = addresses.map(address => ({ ...address }));
    addresses = addresses.map(address => ({ ...address, isDefault: address.id === id }));
    renderAddresses();
    try {
        await saveAddresses("Default address updated");
    } catch (error) {
        console.error("Could not update default address", error);
        addresses = previous;
        renderAddresses();
        showToast("Could not update the address");
    }
}

function validateForm() {
    const required = [...form.querySelectorAll("[required]")];
    const invalid = required.filter(field => !field.checkValidity());
    required.forEach(field => field.classList.toggle("is-invalid", invalid.includes(field)));
    if (!invalid.length) return true;
    formError.textContent = "Please complete all highlighted fields.";
    invalid[0].focus();
    return false;
}

form.addEventListener("input", event => {
    if (event.target.checkValidity?.()) event.target.classList.remove("is-invalid");
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    formError.textContent = "";
    if (!validateForm() || !currentUser) return;
    const data = new FormData(form);
    const address = normalizedAddress({
        id: editingId || createId(),
        firstName: data.get("firstName"),
        lastName: data.get("lastName"),
        phone: data.get("phone"),
        address: data.get("address"),
        city: data.get("city"),
        district: data.get("district"),
        country: data.get("country"),
        postalCode: data.get("postalCode"),
        notes: data.get("notes"),
        isDefault: data.get("isDefault") === "on" || addresses.length === 0
    }, 0);
    const previous = addresses.map(item => ({ ...item }));
    if (address.isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false }));
    const existingIndex = addresses.findIndex(item => item.id === address.id);
    const wasEditing = existingIndex >= 0;
    if (existingIndex >= 0) addresses[existingIndex] = address;
    else addresses.push(address);
    if (!addresses.some(item => item.isDefault)) addresses[0].isDefault = true;

    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    try {
        await saveAddresses(wasEditing ? "Address updated" : "Address added");
        closeEditor();
    } catch (error) {
        console.error("Could not save shipping address", error);
        addresses = previous;
        formError.textContent = "Your address could not be saved. Please try again.";
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = wasEditing ? "Save changes" : "Save address";
    }
});

deleteConfirm.addEventListener("click", async () => {
    if (!deletingId) return;
    const previous = addresses.map(address => ({ ...address }));
    const wasDefault = addresses.find(address => address.id === deletingId)?.isDefault;
    addresses = addresses.filter(address => address.id !== deletingId);
    if (wasDefault && addresses.length) addresses[0].isDefault = true;
    deleteConfirm.disabled = true;
    deleteConfirm.textContent = "Deleting…";
    try {
        await saveAddresses("Address deleted");
        closeDeleteDialog();
    } catch (error) {
        console.error("Could not delete shipping address", error);
        addresses = previous;
        renderAddresses();
        showToast("Could not delete the address");
    } finally {
        deleteConfirm.disabled = false;
        deleteConfirm.textContent = "Delete address";
    }
});

addButton.addEventListener("click", () => openEditor());
editorClose.addEventListener("click", closeEditor);
deleteCancel.addEventListener("click", closeDeleteDialog);
editorOverlay.addEventListener("click", event => { if (event.target === editorOverlay) closeEditor(); });
deleteOverlay.addEventListener("click", event => { if (event.target === deleteOverlay) closeDeleteDialog(); });
document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (shippingPickers.some(picker => !picker.querySelector(".shipping-picker-menu").hidden)) {
        closeShippingPickers();
        return;
    }
    if (deleteOverlay.classList.contains("active")) closeDeleteDialog();
    else if (editorOverlay.classList.contains("active")) closeEditor();
});

onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (!user) {
        sessionStorage.setItem("mpwrReturnAfterSignin", location.pathname.split("/").pop() + location.search);
        location.replace("index.html");
        return;
    }
    try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        profile = snapshot.exists() ? snapshot.data() : {};
        addresses = normalizeAddresses(profile);
        renderAddresses();
    } catch (error) {
        console.error("Could not load shipping addresses", error);
        emptyState.hidden = false;
        showToast("Could not load your addresses");
    } finally {
        loading.hidden = true;
        document.documentElement.dataset.siteContentReady = "true";
        window.MPWRLoading?.ready();
    }
});
