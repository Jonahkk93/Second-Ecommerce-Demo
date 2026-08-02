(() => {
    const interactiveSelector = [
        "button",
        "a",
        "[role='button']",
        "input",
        "select",
        "summary",
        ".cart-remove",
        ".wishlist-remove"
    ].join(",");

    const finishTouch = event => {
        if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

        const control = event.target.closest?.(interactiveSelector);
        control?.blur?.();

        if (control && typeof PointerEvent === "function") {
            control.dispatchEvent(new PointerEvent("pointerleave", {
                bubbles: false,
                pointerType: event.pointerType
            }));
        }

        requestAnimationFrame(() => {
            document.documentElement.classList.remove("touch-press-active");
        });
    };

    document.addEventListener("pointerdown", event => {
        if (event.pointerType === "touch" || event.pointerType === "pen") {
            document.documentElement.classList.add("using-touch", "touch-press-active");
        } else if (event.pointerType === "mouse") {
            document.documentElement.classList.remove("using-touch", "touch-press-active");
        }
    }, true);

    document.addEventListener("pointerup", finishTouch, true);
    document.addEventListener("pointercancel", finishTouch, true);

    // Close swipe actions in any cart when the surrounding background is touched.
    document.addEventListener("pointerdown", event => {
        if (event.target.closest?.(".cart-box.is-swiped")) return;

        document.querySelectorAll(".cart-box.is-swiped").forEach(cartBox => {
            cartBox.classList.remove("is-swiped", "delete-armed", "swipe-dragging");
            cartBox.querySelector(".cart-box-main")?.style.removeProperty("transform");
            cartBox.querySelector(".cart-swipe-actions")
                ?.setAttribute("aria-hidden", "true");
        });
    }, true);
})();
