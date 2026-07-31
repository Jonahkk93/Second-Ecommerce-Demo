import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;
const authToast = document.querySelector(".toast");

function showAuthToast(message, type = "success") {
    if (!authToast) return;

    authToast.textContent = message;
    authToast.className = `toast ${type} show`;

    clearTimeout(authToast.timeout);
    authToast.timeout = setTimeout(() => {
        authToast.classList.remove("show");
    }, 2500);
}

function authErrorMessage(error) {
    return String(error?.message || "Something went wrong.")
        .replace(/^Firebase:\s*/i, "");
}

// Register form
const registerForm = document.getElementById("register-form");

// Sign in form
const signinForm = document.getElementById("signin-form");

registerForm.addEventListener("submit", async (e) => {
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
showAuthToast("Account created successfully!", "success");

registerForm.reset();

    } catch (error) {
        showAuthToast(authErrorMessage(error), "warning");
    }
});

signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;

    try {
        await signInWithEmailAndPassword(auth, email, password);

        showAuthToast("Signed in successfully!", "success");

        signinForm.reset();

    } catch (error) {
        showAuthToast(authErrorMessage(error), "warning");
    }
});

onAuthStateChanged(auth, async (user) => {
    
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
        document.body.style.overflow = "";
        registerContainer.classList.remove("active");
        signinContainer.classList.remove("hide");
        accountPanel.style.display = "none";

    } else {

        accountPanel.style.display = "none";

}

});

const logoutButton = document.getElementById("logout-btn");

logoutButton.addEventListener("click", async () => {

    try {

        await signOut(auth);

        showAuthToast("Signed out successfully!", "success");

    } catch (error) {

        showAuthToast(authErrorMessage(error), "warning");

    }

});
