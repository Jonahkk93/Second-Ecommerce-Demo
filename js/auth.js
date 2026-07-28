import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;

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
        alert("Passwords do not match.");
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
alert("Account created successfully!");

registerForm.reset();

    } catch (error) {
        alert(error.message);
    }
});

signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;

    try {
        await signInWithEmailAndPassword(auth, email, password);

        alert("Signed in successfully!");

        signinForm.reset();

    } catch (error) {
        alert(error.message);
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

    const userEmail =
    document.getElementById("user-email");

    if (user) {

        signinContainer.style.display = "none";

        registerContainer.style.display = "none";

        accountPanel.style.display = "block";

        const userDoc = await getDoc(doc(db, "users", user.uid));

if (userDoc.exists()) {

    const userData = userDoc.data();

    const accountTitle = document.querySelector("#account-panel h2");

    accountTitle.textContent =
        `Welcome back, ${userData.firstName}`;

    userEmail.textContent = userData.email;

} else {

    userEmail.textContent = user.email;

}

    } else {

    accountPanel.style.display = "none";

}

});

const logoutButton = document.getElementById("logout-btn");

logoutButton.addEventListener("click", async () => {

    try {

        await signOut(auth);

        alert("Signed out successfully!");

    } catch (error) {

        alert(error.message);

    }

});

