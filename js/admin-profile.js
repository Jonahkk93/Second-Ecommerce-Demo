import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { adminAuth, adminDb, adminStorage } from "./admin-firebase.js";

const page = document.getElementById("admin-profile-page");
const form = document.getElementById("admin-profile-form");
const image = document.getElementById("admin-profile-image");
const fileInput = document.getElementById("admin-profile-file");
const firstName = document.getElementById("admin-profile-first-name");
const lastName = document.getElementById("admin-profile-last-name");
const email = document.getElementById("admin-profile-email");
const message = document.getElementById("admin-profile-message");
const saveButton = document.getElementById("admin-profile-save");
let currentUser = null;
let currentPhotoUrl = "";

function initialsPhoto(first, last) {
    const initials = `${first?.[0] || "A"}${last?.[0] || ""}`.toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#E5A484"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="82" fill="white">${initials}</text></svg>`)}`;
}

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    message.textContent = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        fileInput.value = "";
        message.textContent = "Choose an image smaller than 5 MB.";
        return;
    }
    image.src = URL.createObjectURL(file);
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) return;
    message.textContent = "";
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const file = fileInput.files[0];
        if (file) {
            const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
            const imageRef = ref(adminStorage, `admin-profiles/${currentUser.uid}/profile.${extension}`);
            await uploadBytes(imageRef, file, { contentType: file.type });
            currentPhotoUrl = await getDownloadURL(imageRef);
        }

        await setDoc(doc(adminDb, "users", currentUser.uid), {
            firstName: firstName.value.trim(),
            lastName: lastName.value.trim(),
            profileImage: currentPhotoUrl
        }, { merge: true });

        message.textContent = "Profile updated successfully.";
        fileInput.value = "";
    } catch (error) {
        console.error("Unable to update admin profile:", error);
        message.textContent = "Your profile could not be updated.";
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
});

onAuthStateChanged(adminAuth, async user => {
    if (!user) {
        window.location.replace("admin-login.html");
        return;
    }

    const userDoc = await getDoc(doc(adminDb, "users", user.uid));
    if (!userDoc.exists() || userDoc.data().role !== "admin") {
        window.location.replace("admin-login.html?error=unauthorized");
        return;
    }

    currentUser = user;
    const data = userDoc.data();
    firstName.value = data.firstName || "";
    lastName.value = data.lastName || "";
    email.value = user.email || data.email || "";
    currentPhotoUrl = data.profileImage || "";
    image.src = currentPhotoUrl || initialsPhoto(data.firstName, data.lastName);
    page.hidden = false;
});
