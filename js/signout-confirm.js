(() => {
    const signoutSelector = "#home-signout, #admin-signout, .account-signout, .orders-signout";
    const overlay = document.createElement("div");
    overlay.className = "signout-confirm-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <div class="signout-confirm-box" role="dialog" aria-modal="true" aria-labelledby="shared-signout-title">
            <h2 id="shared-signout-title">Sign Out?</h2>
            <p>Are you sure you want to sign out of your MPWR account?</p>
            <div class="signout-confirm-actions">
                <button class="signout-confirm-cancel" type="button">Stay Signed In</button>
                <button class="signout-confirm-approve" type="button">Sign Out</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const cancelButton = overlay.querySelector(".signout-confirm-cancel");
    const approveButton = overlay.querySelector(".signout-confirm-approve");
    let pendingButton = null;

    function closeConfirmation() {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("signout-confirm-open");
    }

    function cancelConfirmation() {
        const button = pendingButton;
        pendingButton = null;
        closeConfirmation();
        button?.focus?.();
    }

    document.addEventListener("click", event => {
        const button = event.target.closest?.(signoutSelector);
        if (!button) return;

        if (button.dataset.signoutConfirmed === "true") {
            delete button.dataset.signoutConfirmed;
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        pendingButton = button;
        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("signout-confirm-open");
        requestAnimationFrame(() => cancelButton.focus());
    }, true);

    cancelButton.addEventListener("click", cancelConfirmation);
    approveButton.addEventListener("click", () => {
        const button = pendingButton;
        pendingButton = null;
        closeConfirmation();
        if (!button) return;
        button.dataset.signoutConfirmed = "true";
        button.click();
    });

    overlay.addEventListener("click", event => {
        if (event.target === overlay) cancelConfirmation();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.classList.contains("active")) {
            cancelConfirmation();
        }
    });
})();
