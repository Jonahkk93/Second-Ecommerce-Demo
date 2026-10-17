// Progressive enhancement: keep the select for FormData and validation, and
// present the same rounded menu, arrow and peach options as MPWR's pickers.
const pickers = new WeakMap();
let openPicker;
let nextId = 0;

export function enhanceMPWRSelect(select) {
    if (!select || select.multiple || select.size > 1) return;
    if (pickers.has(select)) return pickers.get(select);
    const picker = document.createElement("div");
    picker.className = "mpwr-select product-dropdown";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "product-dropdown-trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const label = document.createElement("span"); label.className = "product-dropdown-label";
    const arrow = document.createElement("img"); arrow.className = "product-dropdown-arrow";
    arrow.src = "images/Icon Folder/Back Icon Down_Gray.PNG"; arrow.alt = "";
    trigger.append(label, arrow);
    const menu = document.createElement("div");
    menu.className = "product-dropdown-menu";
    menu.id = `mpwr-select-${++nextId}`;
    menu.setAttribute("role", "listbox"); menu.hidden = true;
    trigger.setAttribute("aria-controls", menu.id);
    picker.append(trigger, menu);
    select.after(picker);
    select.classList.add("mpwr-select-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    let activeIndex = -1, typeahead = "", typedAt = 0;
    const options = () => [...menu.children];
    const enabled = () => options().filter(option => !option.disabled);
    const name = () => {
        if (select.getAttribute("aria-label")) return select.getAttribute("aria-label");
        const labelled = select.getAttribute("aria-labelledby");
        if (labelled) return labelled.split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
        const source = select.labels?.[0]?.cloneNode(true);
        source?.querySelectorAll("select,.mpwr-select").forEach(node => node.remove());
        return source?.textContent.trim() || "Choose an option";
    };
    function close(focus = false) {
        menu.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        trigger.removeAttribute("aria-activedescendant");
        if (openPicker === api) openPicker = null;
        if (focus && !trigger.disabled) trigger.focus();
    }
    function activate(index) {
        const items = options(); activeIndex = index;
        items.forEach((option, i) => option.classList.toggle("is-active", i === index));
        const option = items[index];
        if (option) {
            trigger.setAttribute("aria-activedescendant", option.id);
            // Scroll the option menu only, without jumping the whole page.
            if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
            else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
        }
    }
    function sync() {
        label.textContent = select.selectedOptions[0]?.textContent || "Select";
        trigger.disabled = select.disabled;
        trigger.setAttribute("aria-label", name());
        trigger.setAttribute("aria-required", String(select.required));
        menu.setAttribute("aria-label", name());
        options().forEach((option, i) => {
            const selected = i === select.selectedIndex;
            option.classList.toggle("selected", selected);
            option.setAttribute("aria-selected", String(selected));
            option.disabled = select.disabled || select.options[i].disabled || select.options[i].parentElement.disabled === true;
        });
        if (select.disabled) close();
    }
    function rebuild() {
        menu.replaceChildren(...[...select.options].map((item, index) => {
            const option = document.createElement("button");
            option.type = "button"; option.tabIndex = -1;
            option.id = `${menu.id}-option-${index}`;
            option.setAttribute("role", "option");
            option.textContent = item.textContent;
            option.addEventListener("click", event => {
                event.preventDefault(); event.stopPropagation();
                choose(index);
            });
            return option;
        }));
        sync();
        if (!menu.hidden) { positionMenu(); activate(select.selectedIndex); }
    }
    function positionMenu() {
        const rect = trigger.getBoundingClientRect();
        const footer = document.querySelector(".feedback-submit-bar")?.getBoundingClientRect();
        const bottom = footer?.top > 0 ? Math.min(window.innerHeight, footer.top) : window.innerHeight;
        const below = bottom - rect.bottom - 12;
        const above = rect.top - 12;
        const upwards = below < Math.min(menu.scrollHeight, 200) && above > below;
        menu.classList.toggle("is-above", upwards);
        menu.style.maxHeight = `${Math.max(40, Math.min(280, upwards ? above : below))}px`;
    }
    function open() {
        if (select.disabled) return;
        if (openPicker && openPicker !== api) openPicker.close();
        sync(); menu.hidden = false; openPicker = api;
        positionMenu();
        trigger.setAttribute("aria-expanded", "true");
        activate(select.selectedIndex >= 0 && !options()[select.selectedIndex]?.disabled ? select.selectedIndex : options().indexOf(enabled()[0]));
    }
    function choose(index) {
        if (select.disabled || !options()[index] || options()[index].disabled) return;
        select.selectedIndex = index; sync(); close(true);
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const api = { picker, trigger, menu, sync, close };
    pickers.set(select, api);
    trigger.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation();
        if (menu.hidden) open(); else close();
    });
    trigger.addEventListener("keydown", event => {
        if (event.key === "Tab") { close(); return; }
        if (event.key === "Escape") { event.preventDefault(); close(true); return; }
        if (["Enter", " "].includes(event.key)) {
            event.preventDefault();
            if (menu.hidden) open(); else choose(activeIndex);
            return;
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            if (menu.hidden) { open(); if (event.key !== "Home" && event.key !== "End") return; }
            const available = enabled();
            const current = available.indexOf(options()[activeIndex]);
            const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + available.length) % available.length;
            activate(options().indexOf(available[next]));
            return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (menu.hidden) open();
            typeahead = Date.now() - typedAt < 700 ? typeahead + event.key : event.key;
            typedAt = Date.now();
            const match = enabled().find(option => option.textContent.trim().toLowerCase().startsWith(typeahead.toLowerCase()));
            if (match) activate(options().indexOf(match));
        }
    });
    select.addEventListener("change", sync);
    select.addEventListener("focus", () => trigger.focus());
    select.addEventListener("invalid", event => {
        event.preventDefault(); trigger.setAttribute("aria-invalid", "true"); trigger.focus(); open();
    });
    select.addEventListener("change", () => trigger.removeAttribute("aria-invalid"));
    new MutationObserver(rebuild).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "selected", "label", "value", "required"] });
    rebuild();
    return api;
}

export function mountMPWRSelects(root = document) {
    if (root.matches?.("select")) enhanceMPWRSelect(root);
    root.querySelectorAll?.("select").forEach(enhanceMPWRSelect);
}
document.addEventListener("click", event => { if (openPicker && !openPicker.picker.contains(event.target)) openPicker.close(); });
document.addEventListener("focusin", event => { if (openPicker && !openPicker.picker.contains(event.target)) openPicker.close(); });
document.addEventListener("reset", event => { queueMicrotask(() => event.target.querySelectorAll("select").forEach(select => pickers.get(select)?.sync())); });
mountMPWRSelects();
new MutationObserver(records => {
    if (openPicker && !openPicker.picker.isConnected) openPicker.close();
    records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) mountMPWRSelects(node); }));
}).observe(document.body, { childList: true, subtree: true });
