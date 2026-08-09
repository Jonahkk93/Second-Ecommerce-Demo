(() => {
    const root = document.documentElement;
    root.classList.add("site-loading-enabled");

    const pendingByFrame = new WeakMap();
    const pendingImages = new WeakSet();
    const failedFrames = new WeakSet();
    const imageGenerations = new WeakMap();

    function imageFrame(image) {
        const parent = image.parentElement;
        if (!parent || parent === document.body || parent === root) return null;
        return parent.tagName === "PICTURE" && parent.parentElement
            ? parent.parentElement
            : parent;
    }

    function addToFrame(image) {
        const frame = imageFrame(image);
        if (!frame) return;
        const count = (pendingByFrame.get(frame) || 0) + 1;
        pendingByFrame.set(frame, count);
        pendingImages.add(image);
        failedFrames.delete(frame);
        frame.classList.remove("site-image-error-frame");
        frame.classList.add("site-image-frame");
        frame.setAttribute("aria-busy", "true");
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
    }

    const imageObserver = new MutationObserver(records => {
        records.forEach(record => {
            if (record.type === "attributes") {
                watchImage(record.target, true);
                return;
            }
            record.addedNodes.forEach(watchTree);
        });
    });
    imageObserver.observe(root, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:["src", "srcset"]
    });
    document.querySelectorAll("img").forEach(watchImage);

    window.addEventListener("load", () => root.classList.add("site-page-ready"), { once:true });
    window.setTimeout(() => root.classList.add("site-page-ready"), 12000);
    window.addEventListener("pageshow", event => {
        if (event.persisted) root.classList.add("site-page-ready");
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
