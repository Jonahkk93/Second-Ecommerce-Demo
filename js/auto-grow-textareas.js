(() => {
    const resize = textarea => {
        textarea.style.height = "auto";
        if (textarea.scrollHeight) textarea.style.height = `${textarea.scrollHeight}px`;
    };

    const prepare = textarea => {
        if (!(textarea instanceof HTMLTextAreaElement)) return;
        textarea.rows = 1;
        textarea.style.minHeight = "0";
        textarea.style.boxSizing = "border-box";
        textarea.style.resize = "none";
        textarea.style.overflowY = "hidden";
        resize(textarea);
    };

    const scan = root => {
        if (root instanceof HTMLTextAreaElement) prepare(root);
        root.querySelectorAll?.("textarea").forEach(prepare);
    };

    const initialize = () => {
        scan(document);
        new MutationObserver(records => {
            records.forEach(record => record.addedNodes.forEach(node => {
                if (node instanceof Element) scan(node);
            }));
        }).observe(document.body, { childList: true, subtree: true });
    };

    document.addEventListener("input", event => {
        if (event.target instanceof HTMLTextAreaElement) resize(event.target);
    });

    document.addEventListener("focusin", event => {
        if (event.target instanceof HTMLTextAreaElement) resize(event.target);
    });

    document.addEventListener("reset", event => {
        requestAnimationFrame(() => scan(event.target));
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
