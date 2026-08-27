import { confirmPasswordReset } from "./auth-api.js";

const form = document.getElementById("reset-password-form");
const password = document.getElementById("reset-password");
const confirmation = document.getElementById("reset-password-confirm");
const message = document.querySelector(".auth-action-message");
const returnLink = document.querySelector(".auth-action-link");
const token = new URLSearchParams(location.search).get("token") || "";

if (!token) { message.textContent = "This reset link is incomplete."; message.dataset.type = "error"; form.hidden = true; }

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (password.value !== confirmation.value) { message.textContent = "The passwords do not match."; message.dataset.type = "error"; return; }
    const button = form.querySelector("button");
    button.disabled = true;
    try {
        await confirmPasswordReset(token, password.value);
        form.hidden = true;
        message.textContent = "Your password has been updated. You can sign in now.";
        message.dataset.type = "success";
        returnLink.hidden = false;
    } catch (error) { message.textContent = error.message; message.dataset.type = "error"; button.disabled = false; }
});
