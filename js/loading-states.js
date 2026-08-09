(() => {
    const root = document.documentElement;
    root.classList.add("site-loading-enabled");

    const pendingByFrame = new WeakMap();
    const pendingImages = new WeakSet();
    const failedFrames = new WeakSet();
    const imageGenerations = new WeakMap();
    let pageLoadingFinished = false;
    const contentSelector = [
        "h1", "h2", "h3", "h4",
        "p",
        ".price", ".cart-price", ".results-count",
        ".account-kicker", ".eyebrow",
        ".home-category-heading a",
        ".related-product-title", ".related-product-price",
        ".benefit-item strong"
    ].join(",");
    const contentExclusions = [
        "header", "nav", "aside", "footer",
        ".cart", ".wishlist", ".toast",
        ".product-bottom-bar", ".product-options-loading", ".filter-loading",
        "[hidden]", "[aria-hidden='true']"
    ].join(",");
    const cartButtonSelector = [
        "button",
        ".addie",
        ".product-bottom-favorite",
        ".product-bottom-cart",
        ".product-modal-cart",
        ".wishlist-add-cart",
        "[data-action='add-to-cart']",
        "[data-add-to-cart]"
    ].join(",");
    const controlSelector = [
        "button[aria-label]:not(:has(img))",
        "a[aria-label]:not(:has(img))",
        "[role='button'][aria-label]:not(:has(img))"
    ].join(",");

    function imageFrame(image) {
        const parent = image.parentElement;
        if (!parent || parent === document.body || parent === root) return null;
        if (image.closest("button, i") || parent.matches("button, i")) return null;

        const frame = parent.tagName === "PICTURE" && parent.parentElement
            ? parent.parentElement
            : parent;
        const isKnownMediaFrame = frame.matches([
            ".img-box",
            ".product-slide",
            ".product-modal-image-link",
            ".cart-product-link",
            ".wishlist-product-link"
        ].join(","));
        const isImageOnlyFrame = frame.children.length === 1 &&
            ["DIV", "SPAN", "A", "FIGURE", "PICTURE"].includes(frame.tagName);

        if (!isKnownMediaFrame && !isImageOnlyFrame) return null;
        const bounds = image.getBoundingClientRect();
        if (bounds.width < 72 || bounds.height < 72) return null;
        return frame;
    }

    function addToFrame(image) {
        const frame = imageFrame(image);
        if (!frame) return;
        const imageUrl = (image.currentSrc || image.src)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"');
        const count = (pendingByFrame.get(frame) || 0) + 1;
        pendingByFrame.set(frame, count);
        pendingImages.add(image);
        failedFrames.delete(frame);
        frame.classList.remove("site-image-error-frame");
        frame.classList.add("site-image-frame");
        frame.setAttribute("aria-busy", "true");
        if (imageUrl) {
            frame.style.setProperty("--site-loading-image", `url("${imageUrl}")`);
        }
    }

    function removeFromFrame(image, failed = false) {
        if (!pendingImages.has(image)) return;
        pendingImages.delete(image);
        const frame = imageFrame(image);
        if (!frame) return;
        if (failed) failedFrames.add(frame);
        const count = Math.max(0, (pendingByFrame.get(frame) || 1) - 1);
        pendingByFrame.set(frame, count);
        if (count > 0) return;
        frame.classList.remove("site-image-frame");
        frame.removeAttribute("aria-busy");
        frame.style.removeProperty("--site-loading-image");
        frame.classList.toggle("site-image-error-frame", failedFrames.has(frame));
    }

    async function revealImage(image, generation) {
        if (image.classList.contains("site-image-ready")) return;
        try {
            await image.decode?.();
        } catch (_) {
            // A completed image can still be safely revealed if decode is unsupported.
        }
        if (imageGenerations.get(image) !== generation) return;
        image.classList.remove("site-image-loading", "site-image-error");
        image.classList.add("site-image-ready");
        image.removeAttribute("aria-busy");
        removeFromFrame(image);
    }

    function failImage(image, generation) {
        if (imageGenerations.get(image) !== generation) return;
        if (image.classList.contains("site-image-ready")) return;
        image.classList.remove("site-image-loading");
        image.classList.add("site-image-error");
        image.removeAttribute("aria-busy");
        removeFromFrame(image, true);
    }

    function watchImage(image, force = false) {
        if (!(image instanceof HTMLImageElement)) return;
        if (image.dataset.loadingObserved && !force) return;
        if (force) {
            removeFromFrame(image);
            image.classList.remove("site-image-loading", "site-image-ready", "site-image-error");
        }
        image.dataset.loadingObserved = "true";
        const generation = (imageGenerations.get(image) || 0) + 1;
        imageGenerations.set(image, generation);

        if (image.complete && image.naturalWidth > 0) {
            revealImage(image, generation);
            return;
        }

        image.classList.add("site-image-loading");
        image.setAttribute("aria-busy", "true");
        addToFrame(image);
        image.addEventListener("load", () => revealImage(image, generation), { once:true });
        image.addEventListener("error", () => failImage(image, generation), { once:true });
    }

    function watchTree(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.("img")) watchImage(node);
        node.querySelectorAll?.("img").forEach(watchImage);
        watchContentTree(node);
        watchCartButtonTree(node);
        watchControlTree(node);
    }

    function watchControl(control) {
        if (!(control instanceof HTMLElement) || root.classList.contains("site-page-ready")) return;
        if (control.dataset.loadingControlObserved || control.closest("[hidden], [aria-hidden='true']")) return;
        if (control.querySelector("input, textarea, select")) return;
        const readableText = control.textContent.replace(/[^a-z0-9]/gi, "").trim();
        if (readableText) return;
        const bounds = control.getBoundingClientRect();
        if (bounds.width < 14 || bounds.height < 14 || bounds.width > 160 || bounds.height > 160) return;

        const controlPosition = getComputedStyle(control).position;
        control.dataset.loadingControlObserved = "true";
        control.classList.add("site-control-loading");
        if (controlPosition === "static") control.classList.add("site-control-loading-static");
        control.setAttribute("aria-busy", "true");
        const loader = document.createElement("span");
        loader.className = "site-content-loading site-control-loading-overlay";
        loader.setAttribute("aria-hidden", "true");
        control.appendChild(loader);
    }

    function watchControlTree(node) {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(controlSelector)) watchControl(node);
        node.querySelectorAll(controlSelector).forEach(watchControl);
    }

    function watchCartButton(button) {
        if (!(button instanceof HTMLElement) || root.classList.contains("site-page-ready")) return;
        const actionLabel = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const isKnownAction = button.matches([
            ".addie", ".product-bottom-favorite", ".product-bottom-cart",
            ".product-modal-cart", ".wishlist-add-cart",
            "[data-action='add-to-cart']", "[data-add-to-cart]"
        ].join(","));
        const isNamedAction = /add to (?:the )?(?:cart|favourites?|favorites?)/.test(actionLabel);
        if (!isKnownAction && !isNamedAction) return;

        const target = button.matches(".product-bottom-cart")
            ? button.closest(".purchase-pill") || button
            : button.matches(".addie")
                ? button.closest("button, i, [role='button']") || button.parentElement
                : button;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.loadingCartButtonObserved || target.closest("[hidden], [aria-hidden='true']")) return;
        const bounds = target.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;

        target.dataset.loadingCartButtonObserved = "true";
        target.classList.add("site-cart-button-loader-host");
        if (getComputedStyle(target).position === "static") {
            target.classList.add("site-cart-button-loader-host-static");
        }
        const radiusSource = button.matches(".addie") ? button : target;
        target.style.setProperty(
            "--site-cart-loader-radius",
            getComputedStyle(radiusSource).borderRadius || "0px"
        );
        target.setAttribute("aria-busy", "true");

        const loader = document.createElement("span");
        loader.className = "site-content-loading site-cart-button-loader-overlay";
        loader.setAttribute("aria-hidden", "true");
        target.appendChild(loader);
    }

    function watchCartButtonTree(node) {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(cartButtonSelector)) watchCartButton(node);
        node.querySelectorAll(cartButtonSelector).forEach(watchCartButton);
    }

    function watchContent(element) {
        return watchContentElement(element, false);
    }

    function clearContentLines(element) {
        element.querySelectorAll(":scope > .site-text-loader-line").forEach(line => line.remove());
    }

    function renderContentLines(element) {
        clearContentLines(element);
        const elementBounds = element.getBoundingClientRect();
        if (elementBounds.width <= 0 || elementBounds.height <= 0) return;

        const range = document.createRange();
        range.selectNodeContents(element);
        const rawRects = [...range.getClientRects()]
            .filter(rect => rect.width > 1 && rect.height > 1)
            .sort((first, second) => first.top - second.top || first.left - second.left);
        range.detach?.();

        const lines = [];
        rawRects.forEach(rect => {
            const existing = lines.find(line => Math.abs(line.top - rect.top) <= 2);
            if (existing) {
                existing.left = Math.min(existing.left, rect.left);
                existing.right = Math.max(existing.right, rect.right);
                existing.height = Math.max(existing.height, rect.height);
                return;
            }
            lines.push({
                top:rect.top,
                left:rect.left,
                right:rect.right,
                height:rect.height
            });
        });

        lines.forEach(line => {
            const loaderHeight = Math.max(7, line.height * .66);
            const loader = document.createElement("span");
            loader.className = "site-content-loading site-text-loader-line";
            loader.setAttribute("aria-hidden", "true");
            loader.style.left = `${line.left - elementBounds.left}px`;
            loader.style.top = `${line.top - elementBounds.top + ((line.height - loaderHeight) / 2)}px`;
            loader.style.width = `${Math.max(8, line.right - line.left)}px`;
            loader.style.height = `${loaderHeight}px`;
            element.appendChild(loader);
        });
    }

    function watchContentElement(element, force = false) {
        if (!(element instanceof HTMLElement)) return;
        if (root.classList.contains("site-page-ready")) return;
        if (element.dataset.loadingContentObserved && !force) return;
        if (!element.matches(contentSelector) || element.closest(contentExclusions)) return;
        if (!element.textContent.trim()) return;
        element.dataset.loadingContentObserved = "true";
        element.classList.add("site-auto-content-loading");
        element.setAttribute("aria-busy", "true");
        renderContentLines(element);
    }

    function watchContentTree(node) {
        if (!(node instanceof HTMLElement)) return;
        watchContent(node);
        node.querySelectorAll(contentSelector).forEach(watchContent);
    }

    function finishPageLoading() {
        if (pageLoadingFinished) return;
        pageLoadingFinished = true;
        root.classList.add("site-loading-prepared");
        root.classList.add("site-page-ready");
        root.classList.remove("site-navigating");
        document.querySelectorAll(".site-auto-content-loading").forEach(element => {
            clearContentLines(element);
            element.classList.remove("site-auto-content-loading");
            element.removeAttribute("aria-busy");
        });
        document.querySelectorAll(".site-cart-button-loader-host").forEach(target => {
            target.querySelectorAll(":scope > .site-cart-button-loader-overlay").forEach(loader => loader.remove());
            target.classList.remove("site-cart-button-loader-host", "site-cart-button-loader-host-static");
            target.style.removeProperty("--site-cart-loader-radius");
            target.removeAttribute("aria-busy");
        });
        document.querySelectorAll(".site-control-loading").forEach(control => {
            control.querySelectorAll(":scope > .site-control-loading-overlay").forEach(loader => loader.remove());
            control.classList.remove("site-control-loading", "site-control-loading-static");
            control.removeAttribute("aria-busy");
        });
        document.dispatchEvent(new CustomEvent("site:ready"));
    }

    const imageObserver = new MutationObserver(records => {
        records.forEach(record => {
            if (record.type === "attributes") {
                watchImage(record.target, true);
                return;
            }
            if (record.type === "characterData") {
                watchContentElement(record.target.parentElement, true);
                return;
            }
            const changedNodes = [...record.addedNodes, ...record.removedNodes];
            if (changedNodes.length && changedNodes.every(node =>
                node instanceof HTMLElement && (
                    node.classList.contains("site-text-loader-line") ||
                    node.classList.contains("site-cart-button-loader-overlay") ||
                    node.classList.contains("site-control-loading-overlay")
                )
            )) return;
            watchContentElement(record.target, true);
            record.addedNodes.forEach(watchTree);
        });
    });
    imageObserver.observe(root, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true,
        attributeFilter:["src", "srcset"]
    });
    document.querySelectorAll("img").forEach(watchImage);
    watchContentTree(document.body);
    watchCartButtonTree(document.body);
    watchControlTree(document.body);
    root.classList.add("site-loading-prepared");
    document.fonts?.ready.then(() => {
        if (root.classList.contains("site-page-ready")) return;
        document.querySelectorAll(".site-auto-content-loading").forEach(renderContentLines);
    });

    const finishAfterPaint = () => requestAnimationFrame(() => requestAnimationFrame(finishPageLoading));
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", finishAfterPaint, { once:true });
    } else {
        finishAfterPaint();
    }
    window.addEventListener("load", finishPageLoading, { once:true });
    window.setTimeout(finishPageLoading, 2500);
    window.addEventListener("pageshow", event => {
        if (event.persisted) finishPageLoading();
    });

    document.addEventListener("click", event => {
        const link = event.target.closest?.("a[href]");
        if (!link || event.defaultPrevented || event.button !== 0) return;
        if (link.target === "_blank" || link.hasAttribute("download")) return;
        const destination = new URL(link.href, location.href);
        if (destination.origin !== location.origin || destination.href === location.href) return;
        root.classList.remove("site-page-ready");
        root.classList.add("site-navigating");
    });

    document.addEventListener("submit", event => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || !form.checkValidity()) return;
        const submitter = event.submitter || form.querySelector('button[type="submit"]');
        if (!(submitter instanceof HTMLButtonElement)) return;
        submitter.classList.add("site-button-loading");
        submitter.setAttribute("aria-busy", "true");
        window.setTimeout(() => {
            submitter.classList.remove("site-button-loading");
            submitter.removeAttribute("aria-busy");
        }, 12000);
    });
})();
