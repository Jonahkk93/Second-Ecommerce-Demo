import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { adminAuth, adminDb } from "./admin-firebase.js";

const auth = adminAuth;
const db = adminDb;
const loginForm = document.getElementById("admin-login-form");
const loginButton = document.getElementById("admin-login-button");
const loginError = document.getElementById("admin-login-error");
let isSubmitting = false;

const loginErrorCode = new URLSearchParams(window.location.search).get("error");
if (loginErrorCode === "unauthorized") {
    loginError.textContent = "This account does not have administrator access.";
} else if (loginErrorCode === "verification") {
    loginError.textContent = "Administrator access could not be verified.";
}

function friendlyLoginError(error) {
    const code = String(error?.code || "");
    if (code.includes("invalid-credential")) return "Incorrect email or password.";
    if (code.includes("too-many-requests")) return "Too many attempts. Please try again later.";
    return "Unable to sign in. Please try again.";
}

async function isAdministrator(user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    return userDoc.exists() && userDoc.data().role === "admin";
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    loginError.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";
    isSubmitting = true;

    try {
        const email = document.getElementById("admin-email").value.trim();
        const password = document.getElementById("admin-password").value;
        const credential = await signInWithEmailAndPassword(auth, email, password);

        if (!await isAdministrator(credential.user)) {
            await signOut(auth);
            loginError.textContent = "This account does not have administrator access.";
            return;
        }

        window.location.replace("admin.html");
    } catch (error) {
        loginError.textContent = friendlyLoginError(error);
    } finally {
        isSubmitting = false;
        loginButton.disabled = false;
        loginButton.textContent = "Log In";
    }
});

onAuthStateChanged(auth, async user => {
    if (!user || isSubmitting) return;

    try {
        if (await isAdministrator(user)) {
            window.location.replace("admin.html");
        } else {
            await signOut(auth);
            loginError.textContent = "This account does not have administrator access.";
        }
    } catch (error) {
        console.error("Unable to verify administrator access:", error);
        loginError.textContent = "Administrator access could not be verified.";
    }
});
