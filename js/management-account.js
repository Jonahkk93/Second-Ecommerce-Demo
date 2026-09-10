import { onAuthStateChanged, signOut } from "./auth-api.js";
import { doc, getDoc } from "./firestore-api.js";
import { adminAuth, adminDb } from "./admin-firebase.js";

function initialiseManagementAccount() {
    const account = document.querySelector("[data-management-sidebar] .admin-account");
    const button = account?.querySelector("#admin-account-button");
    const menu = account?.querySelector("#admin-account-menu");
    const email = account?.querySelector("#admin-account-email");
    const photo = account?.querySelector("#admin-account-photo");
    const initials = account?.querySelector("#admin-account-initials");
    const name = account?.querySelector("#admin-account-name");
    const signout = account?.querySelector("#admin-signout");
    if (!account || !button || !menu || !email || !photo || !initials || !name || !signout) return;

    const closeMenu = () => {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
    };

    button.addEventListener("click", event => {
        event.stopPropagation();
        const willOpen = menu.hidden;
        menu.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".admin-account")) closeMenu();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
    });

    signout.addEventListener("click", async () => {
        await signOut(adminAuth);
        window.location.replace("admin-login.html");
    });

    onAuthStateChanged(adminAuth, async user => {
        if (!user) return;
        email.textContent = user.email || "Admin account";

        let profile = {};
        try {
            const snapshot = await getDoc(doc(adminDb, "users", user.uid));
            if (snapshot.exists()) profile = snapshot.data();
        } catch (error) {
            console.warn("Unable to load the Management account profile.", error);
        }

        const label = `${profile.firstName?.trim()?.[0] || ""}${profile.lastName?.trim()?.[0] || ""}` ||
            user.email?.trim()?.[0] || "A";
        initials.textContent = label.toUpperCase();
        name.textContent = [profile.firstName, profile.lastName].map(value => value?.trim()).filter(Boolean).join(" ") ||
            user.displayName?.trim() || "Administrator";

        if (!profile.profileImage) {
            button.classList.remove("has-photo");
            photo.removeAttribute("src");
            return;
        }

        photo.src = profile.profileImage;
        button.classList.add("has-photo");
        photo.onerror = () => {
            photo.onerror = null;
            button.classList.remove("has-photo");
        };
    });
}

if (document.querySelector("[data-management-sidebar] .admin-account")) {
    initialiseManagementAccount();
} else {
    document.addEventListener("management-navigation:ready", initialiseManagementAccount, { once: true });
}
