const searchInput = document.querySelector("#page-search-input");
const searchForm = document.querySelector(".search-form");
const searchResults = document.querySelector(".search-results");
const searchEmpty = document.querySelector(".search-empty");
const resultTitle = document.querySelector("#search-results-title");
const resultCount = document.querySelector(".results-count");
const recentContainer = document.querySelector(".recent-searches");
const suggestedContainer = document.querySelector(".suggested-searches");
const clearRecent = document.querySelector(".clear-recent");
const recentMore = document.querySelector(".recent-searches-more");
const backButton = document.querySelector(".search-back");
const liveSuggestions = document.querySelector(".live-search-suggestions");
const productModalOverlay = document.querySelector(".product-modal-overlay");
const productModalImage = document.querySelector(".product-modal-image");
const productModalImageLink = document.querySelector(".product-modal-image-link");
const productModalTitle = document.querySelector("#search-product-modal-title");
const productModalTitleLink = document.querySelector(".product-modal-title-link");
const productModalPrice = document.querySelector(".product-modal-price");
const productModalDescription = document.querySelector(".product-modal-description");
const productModalReadMore = document.querySelector(".product-modal-read-more");
const productModalOptionsGroup = document.querySelector(".product-modal-options-group");
const productModalOptions = document.querySelector(".product-modal-options-dynamic");
const productModalFavorite = document.querySelector(".product-modal-favorite");
const productModalCart = document.querySelector(".product-modal-cart");
const searchToast = document.querySelector(".toast");

const RECENT_SEARCH_KEY = "mpwrRecentSearches";
let recentSearchesExpanded = false;
let recentLayoutFrame = 0;
let selectedModalProduct = null;
let selectedModalCard = null;
let selectedModalOptions = {};
let selectedModalPrice = 0;
let suggestions = [];
try {
    const configuredSuggestions = JSON.parse(document.querySelector("#search-suggestions-data")?.textContent || "[]");
    if (Array.isArray(configuredSuggestions)) suggestions = configuredSuggestions.map(String);
} catch (_) {
    suggestions = [];
}

function openResultsPage(query) {
    const normalized = query.trim();
    if (!normalized) return;
    saveSearch(normalized);
    window.location.href = `search-results.html?q=${encodeURIComponent(normalized)}`;
}

function suggestionLabels() {
    const labels = new Set(suggestions);
    products.forEach(product => {
        labels.add(product.title);
        (product.options || []).forEach(group => {
            (group.values || []).forEach(value => labels.add(value));
        });
    });
    return [...labels];
}

function highlightedLabel(label, query) {
    const fragment = document.createDocumentFragment();
    const index = label.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) {
        fragment.append(label);
        return fragment;
    }
    fragment.append(label.slice(0,index));
    const strong = document.createElement("strong");
    strong.textContent = label.slice(index,index + query.length);
    fragment.append(strong,label.slice(index + query.length));
    return fragment;
}

function hideLiveSuggestions() {
    liveSuggestions.hidden = true;
    liveSuggestions.replaceChildren();
    searchInput.setAttribute("aria-expanded","false");
}

function renderLiveSuggestions(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        hideLiveSuggestions();
        return;
    }
    const matches = suggestionLabels()
        .filter(label => label.toLowerCase().includes(normalized))
        .sort((a,b) => Number(!a.toLowerCase().startsWith(normalized)) - Number(!b.toLowerCase().startsWith(normalized)) || a.localeCompare(b))
        .slice(0,14);
    liveSuggestions.replaceChildren();
    matches.forEach(label => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "live-suggestion";
        button.setAttribute("role","option");
        const icon = document.createElement("img");
        icon.src = "images/Search icon black .png";
        icon.alt = "";
        const text = document.createElement("span");
        text.appendChild(highlightedLabel(label,query.trim()));
        button.append(icon,text);
        button.addEventListener("click",() => {
            searchInput.value = label;
            hideLiveSuggestions();
            openResultsPage(label);
        });
        liveSuggestions.appendChild(button);
    });
    liveSuggestions.hidden = matches.length === 0;
    searchInput.setAttribute("aria-expanded",String(matches.length > 0));
}

function savedSearches() {
    try { return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY)) || []; }
    catch { return []; }
}

function saveSearch(query) {
    const normalized = query.trim();
    if (!normalized) return;
    const next = [normalized,...savedSearches().filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0,8);
    localStorage.setItem(RECENT_SEARCH_KEY,JSON.stringify(next));
    renderRecentSearches();
}

function chip(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-chip";
    button.textContent = label;
    button.addEventListener("click",() => {
        searchInput.value = label;
        openResultsPage(label);
    });
    return button;
}

function updateRecentSearchLimit() {
    cancelAnimationFrame(recentLayoutFrame);
    recentLayoutFrame = requestAnimationFrame(() => {
        const chips = [...recentContainer.querySelectorAll(".search-chip")];
        chips.forEach(item => { item.hidden = false; });

        const rowTops = [];
        chips.forEach(item => {
            if (!rowTops.some(top => Math.abs(top - item.offsetTop) < 2)) rowTops.push(item.offsetTop);
        });

        const hasMore = rowTops.length > 2;
        recentMore.hidden = !hasMore;
        recentMore.textContent = recentSearchesExpanded ? "Less" : "More";
        recentMore.setAttribute("aria-expanded", String(recentSearchesExpanded));
        recentContainer.classList.toggle("is-expanded", recentSearchesExpanded);

        if (hasMore && !recentSearchesExpanded) {
            const thirdRowTop = rowTops[2];
            chips.forEach(item => { item.hidden = item.offsetTop >= thirdRowTop - 1; });
        }
    });
}

function renderRecentSearches() {
    const recent = savedSearches();
    recentContainer.replaceChildren();
    clearRecent.hidden = recent.length === 0;
    if (!recent.length) {
        recentSearchesExpanded = false;
        recentMore.hidden = true;
        recentContainer.classList.remove("is-expanded");
        const empty = document.createElement("p");
        empty.className = "recent-empty";
        empty.textContent = "Your recent searches will appear here.";
        recentContainer.appendChild(empty);
        return;
    }
    recent.forEach(item => recentContainer.appendChild(chip(item)));
    updateRecentSearchLimit();
}

function searchableText(product) {
    const optionValues = (product.options || []).flatMap(group => group.values || []);
    return [product.title,product.description,...(product.colors || []),...(product.sizes || []),...optionValues].join(" ").toLowerCase();
}

function storedList(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch (_) {
        return [];
    }
}

function saveStoredList(key,value) {
    localStorage.setItem(key,JSON.stringify(value));
}

function showSearchToast(text,type = "success") {
    clearTimeout(searchToast.hideTimer);
    searchToast.textContent = text;
    searchToast.classList.remove("success","warning");
    searchToast.classList.add(type);
    searchToast.classList.add("show");
    searchToast.hideTimer = setTimeout(() => searchToast.classList.remove("show","success","warning"),2200);
}

function isFavorite(productId) {
    return storedList("favorites").some(item => String(item.id) === String(productId));
}

function setFavorite(product,enabled) {
    const favorites = storedList("favorites");
    const index = favorites.findIndex(item => String(item.id) === String(product.id));
    if (enabled && index < 0) {
        favorites.push({id:String(product.id),title:product.title,price:product.price,image:product.image});
    } else if (!enabled && index >= 0) {
        favorites.splice(index,1);
    }
    saveStoredList("favorites",favorites);
    document.querySelectorAll(`.product-box[data-id="${CSS.escape(String(product.id))}"] .wishlist-icon`).forEach(icon => {
        icon.src = enabled ? "images/Heart7.PNG" : "images/optimized/heart-outline.png";
        if (enabled) {
            icon.classList.remove("heart-pop");
            void icon.offsetWidth;
            icon.classList.add("heart-pop");
        }
        icon.closest("button")?.setAttribute("aria-label",`${enabled ? "Remove" : "Add"} ${product.title} ${enabled ? "from" : "to"} wishlist`);
    });
}

function updateModalFavorite() {
    const favorite = selectedModalProduct && isFavorite(selectedModalProduct.id);
    const label = favorite ? "Remove from Favorites" : "Add to Favorites";
    productModalFavorite.querySelector("img").src = favorite ? "images/Heart7.PNG" : "images/optimized/heart-outline.png";
    productModalFavorite.querySelector("span").textContent = label;
    productModalFavorite.setAttribute("aria-label",label);
    productModalFavorite.setAttribute("title",label);
}

function closeProductModal() {
    productModalOverlay.classList.remove("active");
    productModalOverlay.setAttribute("aria-hidden","true");
    document.documentElement.classList.remove("product-modal-open");
    document.body.classList.remove("product-modal-open");
}

function openProductModal(product,card) {
    selectedModalProduct = product;
    selectedModalCard = card;
    selectedModalOptions = {};

    const optionGroups = Array.isArray(product.options) && product.options.length
        ? product.options
        : [
            product.colors?.length ? {key:"color",label:"Color",values:product.colors} : null,
            product.sizes?.length ? {key:"size",label:product.sizeLabel || "Size",values:product.sizes} : null
        ].filter(Boolean);

    const updateVariant = () => {
        const color = selectedModalOptions.color || "";
        const size = selectedModalOptions.size || selectedModalOptions.length || "";
        const variantKey = optionGroups.map(group => selectedModalOptions[group.key] || "").join("|");
        const variant = product.variants?.[variantKey];
        const images = variant?.images || variant?.gallery ||
            product.variantGalleries?.[variantKey] ||
            product.variantGalleries?.[color]?.[size] ||
            product.sizeGalleries?.[size] ||
            product.galleries?.[color] ||
            product.gallery || [product.image];

        selectedModalPrice = variant?.price ||
            product.variantPrices?.[variantKey] ||
            product.variantPrices?.[color]?.[size] ||
            product.sizePrices?.[size] ||
            product.colorPrices?.[color] ||
            product.price;

        productModalImage.src = images[0] || product.image;
        productModalPrice.textContent = `UGX ${Number(selectedModalPrice).toLocaleString()}`;
        const parameters = new URLSearchParams({id:String(product.id)});
        Object.entries(selectedModalOptions).forEach(([key,value]) => { if (value) parameters.set(key,value); });
        const href = `product.html?${parameters.toString()}`;
        productModalImageLink.href = href;
        productModalTitleLink.href = href;
        productModalReadMore.href = href;
    };

    productModalTitle.textContent = product.title;
    productModalImage.alt = product.title;
    productModalDescription.textContent = product.description || "Product description coming soon.";
    productModalOptions.replaceChildren();
    productModalOptionsGroup.hidden = optionGroups.length === 0;

    optionGroups.forEach((group,groupIndex) => {
        const values = Array.isArray(group.values) ? group.values : [];
        selectedModalOptions[group.key] = values[0] || "";
        if (groupIndex > 0) {
            const divider = document.createElement("div");
            divider.className = "product-modal-section-divider";
            divider.setAttribute("aria-hidden","true");
            productModalOptions.appendChild(divider);
        }
        const section = document.createElement("section");
        section.className = "product-modal-option-group";
        const heading = document.createElement("h3");
        heading.textContent = group.label;
        const choices = document.createElement("div");
        choices.className = "product-modal-option-values";
        values.forEach((value,index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "product-modal-option-btn";
            button.classList.toggle("active",index === 0);
            button.textContent = value;
            button.addEventListener("click",() => {
                choices.querySelectorAll(".product-modal-option-btn").forEach(choice => choice.classList.remove("active"));
                button.classList.add("active");
                selectedModalOptions[group.key] = value;
                updateVariant();
            });
            choices.appendChild(button);
        });
        section.append(heading,choices);
        productModalOptions.appendChild(section);
    });

    updateModalFavorite();
    updateVariant();
    productModalOverlay.classList.add("active");
    productModalOverlay.setAttribute("aria-hidden","false");
    document.documentElement.classList.add("product-modal-open");
    document.body.classList.add("product-modal-open");
}

function productCard(product) {
    const card = document.createElement("div");
    card.className = "product-box";
    card.dataset.id = product.id;
    card.tabIndex = 0;
    card.setAttribute("role","link");
    const favorite = isFavorite(product.id);
    card.innerHTML = `
        <div class="img-box">
            <button class="wishlist-btn" type="button" aria-label="${favorite ? "Remove" : "Add"} ${product.title} ${favorite ? "from" : "to"} wishlist">
                <img src="${favorite ? "images/Heart7.PNG" : "images/optimized/heart-outline.png"}" class="wishlist-icon" alt="">
            </button>
            <img src="${product.image}" alt="${product.title}" loading="lazy" decoding="async">
        </div>
        <h2 class="product-title">${product.title}</h2>
        <div class="price-and-cart">
            <span class="price">UGX ${Number(product.price).toLocaleString()}</span>
            <i><img src="images/Plus.PNG" class="addie" alt="View product"></i>
        </div>`;
    const openProduct = () => {
        window.location.href = `product.html?id=${encodeURIComponent(product.id)}`;
    };
    card.addEventListener("click",openProduct);
    card.addEventListener("keydown",event => {
        if ((event.key === "Enter" || event.key === " ") && !event.target.closest("button")) {
            event.preventDefault();
            openProduct();
        }
    });
    card.querySelector(".wishlist-btn").addEventListener("click",event => {
        event.stopPropagation();
        const nextFavorite = !isFavorite(product.id);
        setFavorite(product,nextFavorite);
        showSearchToast(nextFavorite ? "Added to Wishlist" : "Removed from Wishlist");
    });
    card.querySelector(".addie").addEventListener("click",event => {
        event.stopPropagation();
        openProductModal(product,card);
    });
    return card;
}

function renderResults(query = "") {
    const normalized = query.trim().toLowerCase();
    const matches = normalized
        ? products.filter(product => searchableText(product).includes(normalized))
        : products.slice(0,12);
    searchResults.replaceChildren(...matches.map(productCard));
    searchEmpty.hidden = matches.length > 0;
    searchResults.hidden = matches.length === 0;
    resultTitle.textContent = normalized ? `Results for “${query.trim()}”` : "Popular picks";
    resultCount.textContent = `${matches.length} product${matches.length === 1 ? "" : "s"}`;
}

searchForm.addEventListener("submit",event => {
    event.preventDefault();
    hideLiveSuggestions();
    openResultsPage(searchInput.value);
});
searchInput.addEventListener("input",() => renderLiveSuggestions(searchInput.value));
searchInput.addEventListener("keydown",event => {
    if (event.key === "Escape") hideLiveSuggestions();
});
clearRecent.addEventListener("click",() => {
    localStorage.removeItem(RECENT_SEARCH_KEY);
    renderRecentSearches();
});
recentMore.addEventListener("click",() => {
    recentSearchesExpanded = !recentSearchesExpanded;
    updateRecentSearchLimit();
});
window.addEventListener("resize",updateRecentSearchLimit);
productModalOverlay.addEventListener("click",event => {
    if (event.target === productModalOverlay) closeProductModal();
});
productModalFavorite.addEventListener("click",() => {
    if (!selectedModalProduct) return;
    const nextFavorite = !isFavorite(selectedModalProduct.id);
    setFavorite(selectedModalProduct,nextFavorite);
    updateModalFavorite();
    showSearchToast(nextFavorite ? "Added to Wishlist" : "Removed from Wishlist");
});
productModalCart.addEventListener("click",() => {
    if (!selectedModalProduct) return;
    const cart = storedList("cart");
    const cartItem = {
        id:String(selectedModalProduct.id),
        title:selectedModalProduct.title,
        price:Number(selectedModalPrice),
        image:productModalImage.src,
        selectedOptions:{...selectedModalOptions},
        color:selectedModalOptions.color || "",
        size:selectedModalOptions.size || selectedModalOptions.length || "",
        quantity:1
    };
    const identity = item => `${item.id}|${JSON.stringify(item.selectedOptions || {})}`;
    if (cart.some(item => identity(item) === identity(cartItem))) {
        showSearchToast("This item is already in the cart ⚠️","warning");
        return;
    }
    cart.push(cartItem);
    saveStoredList("cart",cart);
    showSearchToast("Added to cart 🛒");
});
document.addEventListener("keydown",event => {
    if (event.key === "Escape" && productModalOverlay.classList.contains("active")) closeProductModal();
});
backButton.addEventListener("click",() => {
    if (history.length > 1) history.back();
    else window.location.href = "index.html";
});

suggestedContainer.replaceChildren(...suggestions.map(chip));
renderRecentSearches();
const initialQuery = new URLSearchParams(location.search).get("q") || "";
searchInput.value = initialQuery;
renderResults();
document.documentElement.dataset.siteContentReady = "true";
window.MPWRLoading?.ready();
const finishSearchDiscoveryLoading = () => {
    recentContainer.setAttribute("aria-busy","false");
    suggestedContainer.setAttribute("aria-busy","false");
};
if (document.documentElement.classList.contains("site-page-ready")) {
    finishSearchDiscoveryLoading();
} else {
    document.addEventListener("site:ready",finishSearchDiscoveryLoading,{once:true});
}
requestAnimationFrame(() => searchInput.focus());
