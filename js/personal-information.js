import {
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
