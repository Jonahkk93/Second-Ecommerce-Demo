import { uploadImage, deleteImage } from "./media-api.js";

const $ = selector => document.querySelector(selector);
const API = window.MPWR_API_URL;
const problems = {
    finding: ["Search results are not relevant", "Filters or sorting are difficult to use", "Cannot find a product or category", "Product recommendations", "Other"],
    details: ["Product information is unclear or missing", "Product images do not load", "Options or prices are confusing", "Reviews or ratings are difficult to use", "Other"],
    ordering: ["Cannot add an item to my bag", "My bag does not update correctly", "Checkout is difficult to use", "Payment options are unclear", "Other"],
    other: ["Account or profile", "Wishlist or browsing history", "Navigation or page layout", "Accessibility", "Other"],
    bug: ["A page will not load", "A button or link does not work", "The website is slow", "An error message appears", "Other"]
};
let files = [], previews = [], busy = false, signedIn = false;
async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, { credentials: "include", ...options });
    const data = await response.json().catch(() => null);
    if (!response.ok) { const error = new Error(data?.message || "We couldn’t send your feedback. Please try again."); error.status = response.status; throw error; }
    return data;
}
function update() {
    const category = $("input[name=category]:checked")?.value;
    $("#feedback-count").textContent = `${$("#feedback-description").value.length} / 500`;
    $("#feedback-submit").disabled = busy || !signedIn || !category || !$("#feedback-problem").value || !$("#feedback-description").value.trim();
    const rating = Number($("input[name=rating]:checked")?.value || 0);
    document.querySelectorAll(".feedback-stars label").forEach(label => label.classList.toggle("is-selected", Number(label.querySelector("input").value) <= rating));
    $("#feedback-rating-label").textContent = rating ? ["Very dissatisfied", "Dissatisfied", "Okay", "Satisfied", "Very satisfied"][rating - 1] : "Tap a star to rate your experience";
    $("#feedback-clear-rating").hidden = !rating;
}
function renderFiles() {
    previews.forEach(URL.revokeObjectURL);
    previews = [];
    $("#feedback-images").replaceChildren();
    files.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "feedback-thumbnail";
        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        previews.push(image.src);
        image.alt = `Supporting image ${index + 1}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove image ${index + 1}`);
        remove.innerHTML = '<img src="images/Icon Folder/Close Icon_333.PNG" alt="">';
        remove.addEventListener("click", () => { files.splice(index, 1); renderFiles(); });
        item.append(image, remove);
        $("#feedback-images").append(item);
    });
    $("#feedback-files").disabled = files.length >= 5;
    $(".feedback-upload").classList.toggle("is-disabled", files.length >= 5);
}
$("#feedback-form").addEventListener("input", update);
$("#feedback-form").addEventListener("change", event => {
    if (event.target.name === "category") {
        const select = $("#feedback-problem");
        select.replaceChildren(new Option("Select the problem you experienced", ""), ...problems[event.target.value].map(value => new Option(value, value)));
        select.disabled = false;
    }
    update();
});
$("#feedback-clear-rating").addEventListener("click", () => { $("input[name=rating]:checked").checked = false; update(); });
$("#feedback-files").addEventListener("change", event => {
    const additions = [...event.target.files];
    event.target.value = "";
    let error = "";
    if (files.length + additions.length > 5) error = "You can add up to 5 images. Remove one before adding more.";
    else if (additions.some(file => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) error = "Please choose JPG, PNG, WebP or GIF images.";
    else if (additions.some(file => file.size > 5 * 1024 * 1024 || file.size === 0)) error = "Each image must be between 1 byte and 5 MB.";
    $("#feedback-error").textContent = error;
    if (!error) { files.push(...additions); renderFiles(); }
});
$("#feedback-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !signedIn || !event.currentTarget.reportValidity()) return;
    const description = $("#feedback-description").value.trim();
    if (!description) return;
    // Capture fields before uploads and keep the submitted form stable while sending.
    const payload = { category: $("input[name=category]:checked").value, problem: $("#feedback-problem").value, description, ...($("input[name=rating]:checked") ? { rating: Number($("input[name=rating]:checked").value) } : {}) };
    busy = true;
    update();
    const controls = [...event.currentTarget.querySelectorAll("input, select, textarea, button")].map(control => [control, control.disabled]);
    controls.forEach(([control]) => { control.disabled = true; });
    $("#feedback-error").textContent = "";
    const uploaded = [];
    let submitted = false, posting = false;
    try {
        for (const file of files) {
            $("#feedback-submit").textContent = `Uploading images ${uploaded.length + 1}/${files.length}…`;
            uploaded.push(await uploadImage(file, "feedback"));
        }
        $("#feedback-submit").textContent = "Sending…";
        posting = true;
        const result = await request("/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, images: uploaded }) });
        submitted = true;
        $("#feedback-reference").textContent = `Reference: ${result.reference}`;
        $("#feedback-form").hidden = true;
        $("#feedback-success").hidden = false;
        $("#feedback-success").focus();
        files = []; renderFiles();
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        // A lost response may follow a successful save. Keep uploaded files on
        // ambiguous network failures so a saved submission retains its images.
        if (!posting || (error.status >= 400 && error.status < 500)) await Promise.allSettled(uploaded.map(file => deleteImage(file.key)));
        $("#feedback-error").textContent = error.message;
    } finally {
        controls.forEach(([control, disabled]) => { control.disabled = disabled; });
        busy = false;
        $("#feedback-submit").textContent = "SUBMIT";
        if (submitted) { $("#feedback-form").reset(); $("#feedback-problem").replaceChildren(new Option("Please answer question 1 first", "")); $("#feedback-problem").disabled = true; renderFiles(); }
        update();
    }
});
$("#feedback-another").addEventListener("click", () => {
    $("#feedback-success").hidden = true;
    $("#feedback-form").hidden = false;
    $("input[name=category]").focus();
});
try {
    await request("/auth/me");
    signedIn = true;
    $("#feedback-session").hidden = true;
    $("#feedback-form").hidden = false;
    update();
} catch (error) {
    $("#feedback-session").replaceChildren(document.createTextNode("Sign in to send feedback, or return to your account to try again. "));
    const link = document.createElement("a"); link.href = "Account.html"; link.textContent = "Go to my account ›";
    $("#feedback-session").append(link);
}
