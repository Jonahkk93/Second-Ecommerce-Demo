import { confirmEmailVerification } from "./auth-api.js";

const message = document.querySelector(".auth-action-message");
const returnLink = document.querySelector(".auth-action-link");
const token = new URLSearchParams(location.search).get("token") || "";

try {
    if (!token) throw new Error("This verification link is incomplete.");
    await confirmEmailVerification(token);
    message.textContent = "Your email address is verified.";
    message.dataset.type = "success";
} catch (error) {
    message.textContent = error.message;
    message.dataset.type = "error";
} finally { returnLink.hidden = false; }
