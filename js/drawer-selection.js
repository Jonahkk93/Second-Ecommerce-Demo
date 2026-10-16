const LONG_PRESS_DELAY = 500;
const MOVE_TOLERANCE = 10;

function addSelectionStylesheet() {
    if (document.querySelector('link[data-mpwr-drawer-selection]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/drawer-selection.css?v=20261016-53";
    link.dataset.mpwrDrawerSelection = "";
    document.head.appendChild(link);
}

function selectionMarkup(kind) {
    const noun = kind === "cart" ? "cart" : "wishlist";
    const buttonClass = kind === "cart" ? "drawer-selection-delete btn-buy" : "drawer-selection-delete";
    const deleteIcon = "images/Icon Folder/Delete Icon_333.PNG";
    return `
        <div class="drawer-selection-toolbar" hidden>
            <button class="drawer-selection-cancel" type="button" aria-label="Cancel selection">
                <img src="images/Icon Folder/Back Icon Left_Black.PNG" alt="">
            </button>
            <strong><span class="drawer-selection-count">0</span> selected</strong>
            <button class="drawer-selection-all" type="button">Select all</button>
        </div>
        <div class="drawer-selection-actions" hidden>
            <button class="${buttonClass}" type="button" aria-label="Remove selected items from ${noun}">
                <img src="${deleteIcon}" alt="">
                <span>Remove selected</span>
            </button>
        </div>`;
}

function createDrawerSelection(drawer, kind) {
    const content = drawer.querySelector(kind === "cart" ? ".cart-content" : ".wishlist-content");
    const rowSelector = kind === "cart" ? ".cart-box" : ".wishlist-item";
    if (!content || drawer.dataset.selectionReady === "true") return;

    drawer.dataset.selectionReady = "true";
    drawer.insertAdjacentHTML("beforeend", selectionMarkup(kind));

    const toolbar = drawer.querySelector(".drawer-selection-toolbar");
    const drawerTitle = drawer.querySelector(kind === "cart" ? ".cart-title" : ".wishlist-title");
    const actions = drawer.querySelector(".drawer-selection-actions");
    const count = toolbar.querySelector(".drawer-selection-count");
    const selectAll = toolbar.querySelector(".drawer-selection-all");
    const cancel = toolbar.querySelector(".drawer-selection-cancel");
    const remove = actions.querySelector(".drawer-selection-delete");
    drawer.prepend(toolbar);
    const selected = new Set();
    let pressTimer = 0;
    let startX = 0;
    let startY = 0;
    let pressRow = null;
    let pressPointerId = null;
    let suppressNextClick = false;
    let pendingRemoval = false;

    const rows = () => [...content.querySelectorAll(rowSelector)];

    function matchDrawerTitleHeight() {
        const height = drawerTitle?.getBoundingClientRect().height || 0;
        if (!height) return;
        toolbar.style.height = `${height}px`;
        toolbar.style.minHeight = `${height}px`;
        toolbar.style.flexBasis = `${height}px`;
    }

    function prepareRows() {
        rows().forEach(row => {
            if (!row.querySelector(".drawer-selection-check")) {
                const check = document.createElement("span");
                check.className = "drawer-selection-check";
                check.setAttribute("aria-hidden", "true");
                const selectionRow = kind === "cart"
                    ? row.querySelector(".cart-box-main")
                    : row;
                selectionRow?.prepend(check);
            }
            row.setAttribute("aria-selected", String(selected.has(row)));
            row.classList.toggle("is-selected", selected.has(row));
        });
        [...selected].forEach(row => {
            if (!row.isConnected || !content.contains(row)) selected.delete(row);
        });
    }

    function update() {
        prepareRows();
        const allRows = rows();
        const total = selected.size;
        const active = drawer.classList.contains("is-selecting-items");
        toolbar.hidden = !active;
        actions.hidden = !active;
        count.textContent = String(total);
        selectAll.textContent = allRows.length > 0 && total === allRows.length ? "Clear all" : "Select all";
        remove.disabled = total === 0;
        remove.querySelector("span").textContent = total === 1 ? "Remove selected item" : `Remove ${total} selected items`;
    }

    function exitSelection() {
        if (pendingRemoval) closeRemovalConfirmation();
        cancelPress();
        suppressNextClick = false;
        selected.clear();
        drawer.classList.remove("is-selecting-items");
        rows().forEach(row => {
            row.classList.remove("is-selected");
            row.setAttribute("aria-selected", "false");
        });
        update();
    }

    function toggle(row, force) {
        const shouldSelect = force ?? !selected.has(row);
        if (shouldSelect) selected.add(row);
        else selected.delete(row);
        if (!selected.size) {
            exitSelection();
            return;
        }
        update();
    }

    function enterSelection(row) {
        // End a swipe before hiding its actions or changing the row layout.
        const main = row.querySelector(".cart-box-main");
        if (main && pressPointerId !== null) {
            const pointerId = pressPointerId;
            main.dispatchEvent(new PointerEvent("pointercancel", {
                pointerId, clientX: startX, clientY: startY
            }));
            if (main.hasPointerCapture(pointerId)) main.releasePointerCapture(pointerId);
        }
        matchDrawerTitleHeight();
        rows().forEach(item => {
            item.classList.remove("is-selection-press", "is-swiped", "swipe-dragging", "delete-armed");
            item.querySelector(".cart-box-main")?.style.removeProperty("transform");
            item.querySelector(".cart-swipe-actions")?.setAttribute("aria-hidden", "true");
        });
        drawer.classList.add("is-selecting-items");
        toggle(row, true);
        suppressNextClick = true;
        navigator.vibrate?.(20);
    }

    function cancelPress(event) {
        if (event && pressPointerId !== null && event.pointerId !== pressPointerId) return;
        pressRow?.classList.remove("is-selection-press");
        clearTimeout(pressTimer);
        pressTimer = 0;
        pressRow = null;
        pressPointerId = null;
    }

    content.addEventListener("pointerdown", event => {
        const row = event.target.closest(rowSelector);
        if (!row || (event.pointerType === "mouse" && event.button !== 0)) return;
        if (event.target.closest('button, [role="button"], input, select, textarea')) return;
        suppressNextClick = false;
        if (drawer.classList.contains("is-selecting-items")) {
            event.stopImmediatePropagation();
            return;
        }
        startX = event.clientX;
        startY = event.clientY;
        pressRow = row;
        pressPointerId = event.pointerId;
        row.classList.add("is-selection-press");
        pressTimer = window.setTimeout(() => {
            if (pressRow === row && pressPointerId === event.pointerId) enterSelection(row);
            pressTimer = 0;
        }, LONG_PRESS_DELAY);
    }, true);

    content.addEventListener("pointermove", event => {
        if (drawer.classList.contains("is-selecting-items")) event.stopImmediatePropagation();
        if (!pressTimer || event.pointerId !== pressPointerId) return;
        if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_TOLERANCE) cancelPress();
    }, true);
    content.addEventListener("pointerup", cancelPress, true);
    content.addEventListener("pointercancel", cancelPress, true);
    content.addEventListener("contextmenu", event => {
        if (!pressTimer && !drawer.classList.contains("is-selecting-items")) return;
        event.preventDefault();
    });

    content.addEventListener("click", event => {
        if (!drawer.classList.contains("is-selecting-items")) return;
        const row = event.target.closest(rowSelector);
        if (!row) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (suppressNextClick) {
            suppressNextClick = false;
            return;
        }
        toggle(row);
    }, true);

    // Native image/link dragging otherwise cancels the long-press gesture.
    content.addEventListener("dragstart", event => event.preventDefault());
    const menu = drawer.querySelector(`.${kind}-actions-menu`);
    if (menu) {
        const selectItems = document.createElement("button");
        selectItems.type = "button";
        selectItems.className = "drawer-selection-start";
        selectItems.setAttribute("role", "menuitem");
        selectItems.textContent = "Select items";
        menu.prepend(selectItems);
        selectItems.addEventListener("click", () => {
            const firstRow = rows()[0];
            if (!firstRow) return;
            enterSelection(firstRow);
            suppressNextClick = false;
            menu.hidden = true;
            drawer.querySelector(`.${kind}-menu-toggle`)?.setAttribute("aria-expanded", "false");
        });
    }

    cancel.addEventListener("click", exitSelection);
    selectAll.addEventListener("click", () => {
        const allRows = rows();
        if (selected.size === allRows.length) selected.clear();
        else allRows.forEach(row => selected.add(row));
        if (!selected.size) exitSelection();
        else update();
    });

    const overlay = document.querySelector(".delete-item-confirm-overlay");
    const overlayCancel = overlay?.querySelector(".delete-item-cancel");
    const overlayConfirm = overlay?.querySelector(".delete-item-confirm");
    const overlayHeading = overlay?.querySelector("h2");
    const overlayMessage = overlay?.querySelector(".delete-item-confirm-message");

    function closeRemovalConfirmation() {
        pendingRemoval = false;
        remove.classList.remove("is-confirming");
        overlay?.classList.remove("active");
        overlay?.setAttribute("aria-hidden", "true");
        if (overlayHeading) overlayHeading.textContent = "Delete Item";
        if (overlayMessage) overlayMessage.textContent = "Are you sure you want to delete this item?";
        if (overlayConfirm) overlayConfirm.textContent = "Delete Item";
    }

    remove.addEventListener("click", () => {
        if (!selected.size || !overlay) return;
        pendingRemoval = true;
        const total = selected.size;
        overlayHeading.textContent = total === 1 ? "Remove Selected Item" : "Remove Selected Items";
        overlayMessage.textContent = kind === "cart"
            ? `Remove ${total === 1 ? "this item" : `these ${total} items`} from your cart?`
            : `Remove ${total === 1 ? "this item" : `these ${total} items`} from your Wishlist?`;
        overlayConfirm.textContent = total === 1 ? "Remove Item" : `Remove ${total} Items`;
        remove.classList.add("is-confirming");
        overlay.classList.add("active");
        overlay.setAttribute("aria-hidden", "false");
    });

    overlayCancel?.addEventListener("click", event => {
        if (!pendingRemoval) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRemovalConfirmation();
    }, true);

    overlayConfirm?.addEventListener("click", event => {
        if (!pendingRemoval) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const allRows = rows();
        const indices = allRows.reduce((list, row, index) => {
            if (selected.has(row)) list.push(index);
            return list;
        }, []);
        closeRemovalConfirmation();
        drawer.dispatchEvent(new CustomEvent("mpwr:drawer-remove-selected", {
            bubbles: true,
            detail: { drawer: kind, indices }
        }));
        exitSelection();
    }, true);

    overlay?.addEventListener("click", event => {
        if (!pendingRemoval || event.target !== overlay) return;
        event.stopImmediatePropagation();
        closeRemovalConfirmation();
    }, true);

    const closeButton = drawer.querySelector(kind === "cart" ? ".cart-close-button" : ".wishlist-close-button");
    closeButton?.addEventListener("click", event => {
        exitSelection();
        if (event.target === closeButton) closeButton.querySelector("img")?.click();
    });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        if (pendingRemoval) {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeRemovalConfirmation();
        } else if (drawer.classList.contains("is-selecting-items")) {
            event.preventDefault();
            event.stopImmediatePropagation();
            exitSelection();
        }
    }, true);

    const rowObserver = new MutationObserver(() => {
        if (drawer.classList.contains("is-selecting-items")) exitSelection();
        else prepareRows();
    });
    rowObserver.observe(content, { childList: true });

    const drawerObserver = new MutationObserver(() => {
        if (!drawer.classList.contains("active") && drawer.classList.contains("is-selecting-items")) {
            if (pendingRemoval) closeRemovalConfirmation();
            exitSelection();
        }
    });
    drawerObserver.observe(drawer, { attributes: true, attributeFilter: ["class"] });

    matchDrawerTitleHeight();
    window.addEventListener("resize", () => {
        if (!drawer.classList.contains("is-selecting-items")) matchDrawerTitleHeight();
    }, { passive: true });
    prepareRows();
}

export function mountMPWRDrawerSelection(target = document.body) {
    addSelectionStylesheet();
    const cart = target.querySelector(":scope > .cart");
    const wishlist = target.querySelector(":scope > .wishlist");
    if (cart) createDrawerSelection(cart, "cart");
    if (wishlist) createDrawerSelection(wishlist, "wishlist");
}
