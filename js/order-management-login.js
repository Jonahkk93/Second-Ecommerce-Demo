import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "./auth-api.js";
import { adminAuth } from "./admin-firebase.js";

const form = document.getElementById("orders-login-form");
const button = document.getElementById("orders-login-button");
const errorMessage = document.getElementById("orders-login-error");
let submitting = false;

const hasOrdersAccess = user => user?.role === "orders" || user?.role === "admin";

if (new URLSearchParams(location.search).has("error")) {
    errorMessage.textContent = "This account does not have Orders Portal access.";
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    submitting = true;
    button.disabled = true;
    button.textContent = "Signing in...";
    errorMessage.textContent = "";
    try {
        const credential = await signInWithEmailAndPassword(
            adminAuth,
            document.getElementById("orders-email").value.trim(),
            document.getElementById("orders-password").value
        );
        if (!hasOrdersAccess(credential.user)) {
            await signOut(adminAuth);
            errorMessage.textContent = "This account does not have Orders Portal access.";
            return;
        }
        location.replace("order-management.html");
    } catch (error) {
        errorMessage.textContent = String(error?.code || "").includes("invalid-credential")
            ? "Incorrect email or password."
            : "Unable to sign in. Please try again.";
    } finally {
        submitting = false;
        button.disabled = false;
        button.textContent = "Log In";
    }
});

onAuthStateChanged(adminAuth, async user => {
    if (!user || submitting) return;
    if (hasOrdersAccess(user)) location.replace("order-management.html");
    else await signOut(adminAuth);
});
