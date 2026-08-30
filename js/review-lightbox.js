let lightbox;
let lightboxImage;
let lightboxCounter;
let lightboxStars;
let lightboxText;
let previousButton;
let nextButton;
let zoomButton;
let shareButton;
let activeImages = [];
let activeIndex = 0;
let activeReview = null;
let restoreFocus = null;
let touchStartX = null;

const icon = path => `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        ${path}
    </svg>`;

function createButton(className, label, contents) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.innerHTML = contents;
    return button;
}

function ensureLightbox() {
    if (lightbox) return;

    lightbox = document.createElement("div");
    lightbox.className = "review-lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Review photos");

    const topBar = document.createElement("div");
    topBar.className = "review-lightbox-topbar";

    const closeButton = createButton(
        "review-lightbox-close",
        "Close review photos",
        icon('<path d="M5 5l14 14M19 5L5 19"/>')
    );
    lightboxCounter = document.createElement("span");
    lightboxCounter.className = "review-lightbox-counter";
    lightboxCounter.setAttribute("aria-live", "polite");

    const actions = document.createElement("div");
    actions.className = "review-lightbox-actions";
    zoomButton = createButton(
        "review-lightbox-zoom",
        "Zoom photo",
        icon('<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.5 14.5L20 20M10.5 8v5M8 10.5h5"/>')
    );
    shareButton = createButton(
        "review-lightbox-share",
        "Share photo",
        icon('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5"/>')
    );
    actions.append(zoomButton, shareButton);
    topBar.append(closeButton, lightboxCounter, actions);

    const stage = document.createElement("div");
    stage.className = "review-lightbox-stage";
    lightboxImage = document.createElement("img");
    lightboxImage.className = "review-lightbox-image";
    lightboxImage.alt = "";
    previousButton = createButton(
        "review-lightbox-nav review-lightbox-previous",
        "Previous photo",
        icon('<path d="M15 5l-7 7 7 7"/>')
    );
    nextButton = createButton(
        "review-lightbox-nav review-lightbox-next",
        "Next photo",
        icon('<path d="M9 5l7 7-7 7"/>')
    );
    stage.append(lightboxImage, previousButton, nextButton);

    const details = document.createElement("div");
    details.className = "review-lightbox-details";
    lightboxStars = document.createElement("div");
    lightboxStars.className = "review-lightbox-stars";
    lightboxText = document.createElement("p");
    lightboxText.className = "review-lightbox-text";
    details.append(lightboxStars, lightboxText);

    lightbox.append(stage, topBar, details);
    document.body.appendChild(lightbox);

    closeButton.addEventListener("click", closeReviewLightbox);
    previousButton.addEventListener("click", () => showImage(activeIndex - 1));
    nextButton.addEventListener("click", () => showImage(activeIndex + 1));
    zoomButton.addEventListener("click", () => {
        const zoomed = lightbox.classList.toggle("is-zoomed");
        zoomButton.setAttribute("aria-label", zoomed ? "Fit photo to screen" : "Zoom photo");
    });
    lightboxImage.addEventListener("click", () => zoomButton.click());
    shareButton.addEventListener("click", shareCurrentImage);
    lightbox.addEventListener("click", event => {
        if (event.target === lightbox || event.target === stage) closeReviewLightbox();
    });
    lightbox.addEventListener("touchstart", event => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    lightbox.addEventListener("touchend", event => {
        if (touchStartX === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
        touchStartX = null;
        if (Math.abs(distance) < 45 || lightbox.classList.contains("is-zoomed")) return;
        showImage(activeIndex + (distance < 0 ? 1 : -1));
    }, { passive: true });
    document.addEventListener("keydown", event => {
        if (lightbox.hidden) return;
        if (event.key === "Escape") closeReviewLightbox();
        if (event.key === "ArrowLeft") showImage(activeIndex - 1);
        if (event.key === "ArrowRight") showImage(activeIndex + 1);
    });
}

function showImage(index) {
    if (!activeImages.length) return;
    activeIndex = (index + activeImages.length) % activeImages.length;
    const image = activeImages[activeIndex];
    lightbox.classList.remove("is-zoomed");
    zoomButton.setAttribute("aria-label", "Zoom photo");
    lightboxImage.src = image.url;
    lightboxImage.alt = image.name || `Review photo ${activeIndex + 1}`;
    lightboxCounter.textContent = `${activeIndex + 1} / ${activeImages.length}`;
    previousButton.hidden = activeImages.length < 2;
    nextButton.hidden = activeImages.length < 2;
}

async function shareCurrentImage() {
    const image = activeImages[activeIndex];
    if (!image) return;
    const shareData = {
        title: "MPWR review photo",
        text: String(activeReview?.text || "Review photo"),
        url: image.url
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(image.url);
            shareButton.classList.add("is-copied");
            shareButton.setAttribute("aria-label", "Photo link copied");
            setTimeout(() => {
                shareButton.classList.remove("is-copied");
                shareButton.setAttribute("aria-label", "Share photo");
            }, 1600);
        }
    } catch (error) {
        if (error?.name !== "AbortError") console.warn("Unable to share review photo:", error);
    }
}

export function openReviewLightbox({ images, index = 0, review, trigger }) {
    ensureLightbox();
    activeImages = images.filter(image => image?.url);
    if (!activeImages.length) return;
    activeReview = review || {};
    restoreFocus = trigger || document.activeElement;
    const rating = Math.max(0, Math.min(5, Number(activeReview.rating) || 0));
    lightboxStars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
    lightboxStars.setAttribute("aria-label", `${rating} out of 5 stars`);
    lightboxText.textContent = String(activeReview.text || "").trim();
    lightboxText.hidden = !lightboxText.textContent;
    showImage(index);
    lightbox.hidden = false;
    document.body.classList.add("review-lightbox-open");
    requestAnimationFrame(() => lightbox.classList.add("is-open"));
    lightbox.querySelector(".review-lightbox-close")?.focus({ preventScroll: true });
}

export function closeReviewLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.classList.remove("is-open", "is-zoomed");
    document.body.classList.remove("review-lightbox-open");
    lightbox.hidden = true;
    lightboxImage.removeAttribute("src");
    restoreFocus?.focus?.({ preventScroll: true });
}
