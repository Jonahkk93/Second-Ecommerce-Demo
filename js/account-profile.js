import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;
const overview = document.querySelector(".account-profile-overview");
const loading = document.querySelector(".account-loading");
const signoutButton = document.querySelector(".account-signout");

function initialsPicture(firstName, lastName, email = "") {
    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}` || email[0] || "M";
    const safeInitials = initials.toUpperCase().replace(/[^A-Z0-9]/g, "") || "M";
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#E5A484"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="82" font-weight="700" fill="white">${safeInitials}</text></svg>`)}`;
}

async function loadProfile(user) {
    let data = {};
    try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) data = snapshot.data();
    } catch (error) {
        console.warn("Profile details could not be loaded:", error);
    }

    const displayParts = String(user.displayName || "").trim().split(/\s+/).filter(Boolean);
    const firstName = data.firstName || displayParts[0] || "";
    const lastName = data.lastName || displayParts.slice(1).join(" ") || "";
    const fullName = `${firstName} ${lastName}`.trim() || user.displayName || "MPWR Customer";
    const photo = data.profileImage || user.photoURL || initialsPicture(firstName, lastName, user.email || "");

    document.getElementById("account-profile-picture").src = photo;
    document.getElementById("account-profile-name").textContent = fullName;
}

signoutButton.addEventListener("click", async () => {
    localStorage.removeItem("cart");
    localStorage.removeItem("favorites");
    localStorage.removeItem("mpwrCartOwnerUid");
    localStorage.removeItem("mpwrFavoritesOwnerUid");
    await signOut(auth);
    window.location.assign("index.html");
});

onAuthStateChanged(auth, async user => {
    loading.hidden = true;
    overview.hidden = !user;
    signoutButton.hidden = !user;

    if (!user) {
        sessionStorage.setItem("openAccountSignIn", "true");
        window.location.replace("index.html");
        return;
    }

    await loadProfile(user);
});
