import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "./auth-api.js?v=20261001-1";

import {
    doc,
    getDoc,
    setDoc
} from "./firestore-api.js";

const auth = window.auth;
const db = window.db;
const authToast = document.querySelector(".toast");
const accountIcon = document.getElementById("account-icon");
const accountImage = accountIcon?.querySelector(".account-image");
const accountInitials = accountIcon?.querySelector(".account-initials");
const homeAccountMenu = document.getElementById("home-account-menu");
const homeAccountName = document.getElementById("home-account-name");
const homeAccountEmail = document.getElementById("home-account-email");
const homeSignout = document.getElementById("home-signout");
const defaultAccountImage = "images/Account Logo 3.PNG";
const signinHeading = document.getElementById("signin-heading");
const signinSubheading = document.getElementById("signin-subheading");
const blockedLogoutModal = document.getElementById("blocked-logout-modal");
let blockedLogoutReason = "This account has been blocked.";

function resetSigninMessage() {
    if (!signinHeading || !signinSubheading) return;
    signinHeading.textContent = "Welcome";
    signinHeading.classList.remove("signin-error-message");
    signinSubheading.textContent = "Sign in to continue shopping.";
    signinSubheading.hidden = false;
}

function showSigninError(message) {
    if (!signinHeading || !signinSubheading) return;
    signinHeading.replaceChildren(document.createTextNode(`${message} `));
    const contactLink = document.createElement("a");
    contactLink.href = `account-appeal.html?email=${encodeURIComponent(document.getElementById("signin-email")?.value.trim() || "")}`;
    contactLink.className = "signin-error-contact";
    contactLink.textContent = "Contact Us";
    signinHeading.append(contactLink);
    signinHeading.classList.add("signin-error-message");
    signinSubheading.hidden = true;
}

function setAccountScrollLock(locked) {
    document.documentElement.classList.toggle("account-modal-open", locked);
    document.body.classList.toggle("account-modal-open", locked);
    document.body.style.overflow = locked ? "hidden" : "";
}

window.setMPWRAccountScrollLock = setAccountScrollLock;

function initializeAccountControls() {
    if (!accountIcon) return;

    const accountOverlay = document.querySelector(".account-overlay");
    const accountClose = document.querySelector(".account-close");
    const signinView = document.querySelector(".signin-view");
    const registerView = document.querySelector(".register-view");
    const createAccountButton = document.querySelector(".create-account-btn");
    const backToSigninButton = document.querySelector(".back-to-signin-btn");
    const homeViewProfile = document.getElementById("home-view-profile");

    const showSignin = () => {
        resetSigninMessage();
        registerView?.classList.remove("active");
        signinView?.classList.remove("hide");
        accountOverlay?.classList.add("active");
        accountOverlay?.setAttribute("aria-hidden", "false");
        setAccountScrollLock(true);
        accountOverlay?.querySelector(".account-modal")?.scrollTo(0, 0);
        requestAnimationFrame(() => {
            document.getElementById("signin-email")?.focus({ preventScroll: true });
        });
    };

    const closeAccount = () => {
        accountOverlay?.classList.remove("active");
        accountOverlay?.setAttribute("aria-hidden", "true");
        setAccountScrollLock(false);
        registerView?.classList.remove("active");
        signinView?.classList.remove("hide");
    };

    accountIcon.addEventListener("click", event => {
        if (event.target.closest(".home-account-menu")) return;

        if (auth.currentUser) {
            if (homeAccountMenu) homeAccountMenu.hidden = !homeAccountMenu.hidden;
        } else {
            showSignin();
        }
    });

    createAccountButton?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        signinView?.classList.add("hide");
        registerView?.classList.add("active");
        accountOverlay?.querySelector(".account-modal")?.scrollTo(0, 0);
    });

    backToSigninButton?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        showSignin();
    });

    accountClose?.addEventListener("click", closeAccount);
    accountOverlay?.addEventListener("click", event => {
        if (event.target === accountOverlay) closeAccount();
    });

    homeViewProfile?.addEventListener("click", () => {
        sessionStorage.setItem("accountReturnUrl", window.location.href);
    });

    document.addEventListener("click", event => {
        if (event.target.closest("#account-icon")) return;
        if (homeAccountMenu) homeAccountMenu.hidden = true;
    });

    if (sessionStorage.getItem("openAccountSignIn") === "true") {
        sessionStorage.removeItem("openAccountSignIn");
        showSignin();
    } else if (new URLSearchParams(window.location.search).get("account") === "login") {
        showSignin();
        history.replaceState({}, "", window.location.pathname);
    }
}

initializeAccountControls();

function showAccountInitials(firstName = "", lastName = "", email = "") {
    const initials = `${firstName.trim()[0] || ""}${lastName.trim()[0] || ""}` ||
        email.trim()[0] || "A";
    accountInitials.textContent = initials.toUpperCase();
    accountIcon.classList.add("show-initials");
    accountImage.classList.remove("has-profile-image");
}

async function updateAccountNav(user) {
    if (!accountIcon || !accountImage || !accountInitials) return;

    if (!user) {
        homeAccountMenu.hidden = true;
        accountIcon.classList.remove("show-initials");
        accountImage.classList.remove("has-profile-image");
        accountImage.src = defaultAccountImage;
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : {};
        homeAccountName.textContent =
            `${data.firstName || ""} ${data.lastName || ""}`.trim() || "My Account";
        homeAccountEmail.textContent = user.email || data.email || "";

        if (data.profileImage) {
            accountIcon.classList.remove("show-initials");
            accountImage.classList.add("has-profile-image");
            accountImage.src = data.profileImage;
            accountImage.onerror = () => {
                accountImage.onerror = null;
                showAccountInitials(data.firstName, data.lastName, user.email);
            };
        } else {
            showAccountInitials(data.firstName, data.lastName, user.email);
        }
    } catch (error) {
        console.error("Unable to load account navigation profile:", error);
        showAccountInitials("", "", user.email);
    }
}

function showAuthToast(message, type = "success") {
    if (!authToast) return;

    authToast.textContent = message;
    authToast.className = `toast ${type} show`;

    clearTimeout(authToast.timeout);
    authToast.timeout = setTimeout(() => {
        authToast.classList.remove("show");
    }, 2500);
}

function showBlockedLogoutPopup(message) {
    if (!blockedLogoutModal) return;
    blockedLogoutReason = message;
    blockedLogoutModal.hidden = false;
    blockedLogoutModal.setAttribute("aria-hidden", "false");
    blockedLogoutModal.classList.add("active");
    blockedLogoutModal.querySelector(".blocked-logout-see-why")?.focus();
}

window.addEventListener("mpwr:account-blocked", event => {
    showBlockedLogoutPopup(event.detail?.message || "This account has been blocked.");
});

function closeBlockedLogoutModal() {
    blockedLogoutModal?.classList.remove("active");
    blockedLogoutModal?.setAttribute("aria-hidden", "true");
    if (blockedLogoutModal) blockedLogoutModal.hidden = true;
}

blockedLogoutModal?.querySelector(".blocked-logout-see-why")?.addEventListener("click", () => {
    closeBlockedLogoutModal();
    accountIcon?.click();
    showSigninError(blockedLogoutReason);
});
blockedLogoutModal?.addEventListener("click", event => {
    if (event.target === blockedLogoutModal) closeBlockedLogoutModal();
});

function authErrorMessage(error) {
    return String(error?.message || "Something went wrong.")
        .replace(/^Firebase:\s*/i, "");
}

// Register form
const registerForm = document.getElementById("register-form");

// Sign in form
const signinForm = document.getElementById("signin-form");
const forgotPassword = signinForm?.querySelector(".forgot-password-button");

forgotPassword?.addEventListener("click", async event => {
    event.preventDefault();
    const email = document.getElementById("signin-email").value.trim();
    if (!email) {
        showAuthToast("Enter your email address first.", "warning");
        document.getElementById("signin-email").focus();
        return;
    }
    try {
        const result = await sendPasswordResetEmail(auth, email);
        if (result.previewUrl) {
            window.location.href = result.previewUrl;
            return;
        }
        showAuthToast(result.message, "success");
    } catch (error) {
        showAuthToast(authErrorMessage(error), "warning");
    }
});

registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName =
document.getElementById("register-firstname").value.trim();

const lastName =
document.getElementById("register-lastname").value.trim();

const phone =
document.getElementById("register-phone").value.trim();

    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;

    if (password !== confirmPassword) {
        showAuthToast("Passwords do not match.", "warning");
        return;
    }

    try {
       const userCredential =
await createUserWithEmailAndPassword(
    auth,
    email,
    password
);
await setDoc(
    doc(db, "users", userCredential.user.uid),
    {
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,

        role: "customer",

        createdAt: new Date().toISOString()
    }
);
await updateAccountNav(userCredential.user);
showAuthToast("Account created successfully!", "success");

registerForm.reset();

    } catch (error) {
        showAuthToast(authErrorMessage(error), "warning");
    }
});

signinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;
    const submitButton = signinForm.querySelector('[type="submit"]');

    if (!email || !password) {
        resetSigninMessage();
        showAuthToast("Enter your email and password.", "warning");
        return;
    }

    try {
        resetSigninMessage();
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        await signInWithEmailAndPassword(auth, email, password);

        showAuthToast("Welcome Back!", "success");

        signinForm.reset();

    } catch (error) {
        const message = authErrorMessage(error);
        if (error?.code === "auth/account-blocked" || /account has been blocked/i.test(message)) showSigninError(message);
        else showAuthToast(message, "warning");
    } finally {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
    }
});

signinForm?.addEventListener("input", () => {
    if (signinHeading?.classList.contains("signin-error-message")) resetSigninMessage();
});

onAuthStateChanged(auth, async (user) => {
await updateAccountNav(user);
    
if (typeof loadCartFromFirestore === "function") {
    await loadCartFromFirestore();
}
if (typeof loadCartFromFirestore === "function") {
    await loadCartFromFirestore();
}
    const signinContainer =
    document.getElementById("signin-container");

    const registerContainer =
    document.getElementById("register-container");

    const accountPanel =
    document.getElementById("account-panel");

    if (user) {
        document.querySelector(".account-overlay")?.classList.remove("active");
        document.querySelector(".account-overlay")?.setAttribute("aria-hidden", "true");
        setAccountScrollLock(false);
        registerContainer.classList.remove("active");
        signinContainer.classList.remove("hide");
        accountPanel.style.display = "none";

    } else {

        accountPanel.style.display = "none";

}

});

const logoutButton = document.getElementById("logout-btn");

homeSignout?.addEventListener("click", async event => {
    event.stopPropagation();
    localStorage.removeItem("cart");
    localStorage.removeItem("favorites");
    localStorage.removeItem("mpwrCartOwnerUid");
    localStorage.removeItem("mpwrFavoritesOwnerUid");
    homeAccountMenu.hidden = true;
    await signOut(auth);
    showAuthToast("Signed out successfully!", "success");
});

logoutButton?.addEventListener("click", async () => {

    try {

        localStorage.removeItem("cart");
        localStorage.removeItem("favorites");
        localStorage.removeItem("mpwrCartOwnerUid");
        localStorage.removeItem("mpwrFavoritesOwnerUid");

        await signOut(auth);

        showAuthToast("Signed out successfully!", "success");

    } catch (error) {

        showAuthToast(authErrorMessage(error), "warning");

    }

});
