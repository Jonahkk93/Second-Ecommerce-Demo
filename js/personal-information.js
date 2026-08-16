import {
    deleteUser,
    onAuthStateChanged,
    updateProfile,
    verifyBeforeUpdateEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    getDownloadURL,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const auth = window.auth;
const db = window.db;
const storage = window.storage;
const page = document.getElementById("personal-information-page");
const loading = document.getElementById("personal-information-loading");
const form = document.getElementById("personal-information-form");
const image = document.getElementById("personal-profile-image");
const fileInput = document.getElementById("personal-profile-file");
const firstNameInput = document.getElementById("personal-first-name");
const lastNameInput = document.getElementById("personal-last-name");
const emailInput = document.getElementById("personal-email");
const message = document.getElementById("personal-information-message");
const saveButton = document.getElementById("personal-information-save");
const deleteButton = document.getElementById("personal-account-delete");
const deleteIcon = deleteButton.querySelector("img");
const deleteOverlay = document.getElementById("personal-delete-confirm-overlay");
const deleteCancelButton = document.getElementById("personal-delete-cancel");
const deleteConfirmButton = document.getElementById("personal-delete-confirm");

let currentUser = null;
let currentPhotoUrl = "";

function initialsPicture(firstName, lastName, email = "") {
    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}` || email[0] || "M";
    const safeInitials = initials.toUpperCase().replace(/[^A-Z0-9]/g, "") || "M";
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#E5A484"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="82" font-weight="700" fill="white">${safeInitials}</text></svg>`)}`;
}

function showMessage(text, type = "success") {
    message.textContent = text;
    message.dataset.type = type;
}

function friendlyError(error) {
    const code = String(error?.code || "");
    if (code.includes("requires-recent-login")) {
        return "For security, sign out and sign in again before changing your email.";
    }
    if (code.includes("email-already-in-use")) return "That email address is already in use.";
    if (code.includes("invalid-email")) return "Enter a valid email address.";
    return "Your changes could not be saved. Please try again.";
}

function closeDeleteConfirmation() {
    deleteOverlay.classList.remove("active");
    deleteOverlay.setAttribute("aria-hidden", "true");
    deleteButton.classList.remove("is-confirming");
    deleteIcon.src = "images/Icon Folder/Delete Icon_Black.PNG";
    document.body.classList.remove("personal-delete-confirm-open");
}

deleteButton.addEventListener("click", () => {
    deleteOverlay.classList.add("active");
    deleteOverlay.setAttribute("aria-hidden", "false");
    deleteButton.classList.add("is-confirming");
    deleteIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
    document.body.classList.add("personal-delete-confirm-open");
    deleteCancelButton.focus();
});

deleteButton.addEventListener("pointerenter", () => {
    deleteIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
});

deleteButton.addEventListener("pointerleave", () => {
    if (!deleteOverlay.classList.contains("active")) {
        deleteIcon.src = "images/Icon Folder/Delete Icon_Black.PNG";
    }
});

deleteButton.addEventListener("pointerdown", () => {
    deleteIcon.src = "images/Icon Folder/Delete Icon_d9534f.PNG";
});

deleteCancelButton.addEventListener("click", closeDeleteConfirmation);

deleteOverlay.addEventListener("click", event => {
    if (event.target === deleteOverlay) closeDeleteConfirmation();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && deleteOverlay.classList.contains("active")) closeDeleteConfirmation();
});

deleteConfirmButton.addEventListener("click", async () => {
    if (!currentUser) return;

    deleteConfirmButton.disabled = true;
    deleteConfirmButton.textContent = "Deleting…";

    try {
        await deleteUser(currentUser);
        window.location.replace("index.html");
    } catch (error) {
        console.error("Unable to delete account:", error);
        closeDeleteConfirmation();
        showMessage(
            String(error?.code || "").includes("requires-recent-login")
                ? "For security, sign out and sign in again before deleting your account."
                : "Your account could not be deleted. Please try again.",
            "error"
        );
    } finally {
        deleteConfirmButton.disabled = false;
        deleteConfirmButton.textContent = "Delete Account";
    }
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    message.textContent = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        fileInput.value = "";
        showMessage("Choose an image smaller than 5 MB.", "error");
        return;
    }
    image.src = URL.createObjectURL(file);
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) return;

    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const nextEmail = emailInput.value.trim();
    const emailChanged = nextEmail.toLowerCase() !== String(currentUser.email || "").toLowerCase();

    message.textContent = "";
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    try {
        const file = fileInput.files[0];
        if (file) {
            const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
            const imageRef = ref(storage, `profiles/${currentUser.uid}/profile.${extension}`);
            await uploadBytes(imageRef, file, { contentType: file.type });
            currentPhotoUrl = await getDownloadURL(imageRef);
        }

        await updateProfile(currentUser, {
            displayName: `${firstName} ${lastName}`.trim(),
            photoURL: currentPhotoUrl || null
        });

        await setDoc(doc(db, "users", currentUser.uid), {
            firstName,
            lastName,
            profileImage: currentPhotoUrl
        }, { merge: true });

        if (emailChanged) {
            await verifyBeforeUpdateEmail(currentUser, nextEmail);
            showMessage("Profile saved. Check your new email address to confirm the email change.");
        } else {
            showMessage("Personal information updated successfully.");
        }

        fileInput.value = "";
    } catch (error) {
        console.error("Unable to update personal information:", error);
        showMessage(friendlyError(error), "error");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
});

onAuthStateChanged(auth, async user => {
    if (!user) {
        sessionStorage.setItem("openAccountSignIn", "true");
        window.location.replace("index.html");
        return;
    }

    currentUser = user;
    let data = {};
    try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) data = snapshot.data();
    } catch (error) {
        console.warn("Profile details could not be loaded:", error);
    }

    const displayParts = String(user.displayName || "").trim().split(/\s+/).filter(Boolean);
    firstNameInput.value = data.firstName || displayParts[0] || "";
    lastNameInput.value = data.lastName || displayParts.slice(1).join(" ") || "";
    emailInput.value = user.email || data.email || "";
    currentPhotoUrl = data.profileImage || user.photoURL || "";
    image.src = currentPhotoUrl || initialsPicture(firstNameInput.value, lastNameInput.value, user.email || "");

    loading.hidden = true;
    page.hidden = false;
});
