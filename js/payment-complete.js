import { onAuthStateChanged } from "./auth-api.js";
import { doc, getPaymentStatus, setDoc } from "./firestore-api.js";

const panel = document.querySelector(".payment-result");
const title = document.getElementById("payment-result-title");
const message = document.getElementById("payment-result-message");
const referenceLine = document.getElementById("payment-result-reference");
const actions = document.getElementById("payment-result-actions");
const params = new URLSearchParams(location.search);
const reference = params.get("OrderMerchantReference") || params.get("orderMerchantReference") || "";
const orderId = reference.match(/^MPWR-([0-9a-f-]{36})(?:-\d+)?$/i)?.[1] || sessionStorage.getItem("mpwrPendingPaymentOrder");

function showResult(state, heading, copy) {
    panel.classList.remove("is-success", "is-failed");
    if (state) panel.classList.add(`is-${state}`);
    panel.setAttribute("aria-busy", "false");
    title.textContent = heading;
    message.textContent = copy;
    actions.hidden = false;
}

async function clearPaidCart(user) {
    localStorage.setItem("cart", "[]");
    await setDoc(doc(window.db, "carts", user.uid), { items: [] });
    sessionStorage.removeItem("mpwrPendingPaymentOrder");
    sessionStorage.removeItem("mpwrPendingPaymentUser");
    sessionStorage.removeItem("mpwrPendingPaymentCart");
}

async function verify(user) {
    if (!orderId) {
        showResult("failed", "We could not identify this payment", "Open your orders to review its current status or contact MPWR support.");
        return;
    }
    referenceLine.textContent = `Order #${orderId.slice(0, 8).toUpperCase()}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            const payment = await getPaymentStatus(orderId);
            if (payment.status === "successful") {
                await clearPaidCart(user);
                showResult("success", "Payment confirmed", "Your order is confirmed and is now being prepared for delivery.");
                return;
            }
            if (payment.status === "failed") {
                showResult("failed", "Payment was not completed", "No confirmed payment was recorded. Your basket is still available so you can try again.");
                return;
            }
        } catch (error) {
            if (attempt === 7) console.error("Payment verification failed", error);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    showResult("", "Payment is still processing", "We have not received a final result yet. You can safely check your orders again in a few moments.");
}

onAuthStateChanged(window.auth, user => {
    if (!user) {
        sessionStorage.setItem("mpwrReturnAfterSignin", location.pathname.split("/").pop() + location.search);
        showResult("", "Sign in to view this payment", "Use the account that placed the order, then return to this page.");
        return;
    }
    void verify(user);
});
