const searchInput = document.querySelector("#page-search-input");
const searchForm = document.querySelector(".search-form");
const searchResults = document.querySelector(".search-results");
const searchEmpty = document.querySelector(".search-empty");
const resultTitle = document.querySelector("#search-results-title");
const resultCount = document.querySelector(".results-count");
const recentContainer = document.querySelector(".recent-searches");
const suggestedContainer = document.querySelector(".suggested-searches");
const clearRecent = document.querySelector(".clear-recent");
const backButton = document.querySelector(".search-back");
const liveSuggestions = document.querySelector(".live-search-suggestions");

const RECENT_SEARCH_KEY = "mpwrRecentSearches";
const suggestions = ["Press-ons","Wigs","Lashes","Nail polish","Moisturizer","Pink","Black","Shoulder"];

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

function renderRecentSearches() {
    const recent = savedSearches();
    recentContainer.replaceChildren();
    clearRecent.hidden = recent.length === 0;
    if (!recent.length) {
        const empty = document.createElement("p");
        empty.className = "recent-empty";
        empty.textContent = "Your recent searches will appear here.";
        recentContainer.appendChild(empty);
        return;
    }
    recent.forEach(item => recentContainer.appendChild(chip(item)));
}

function searchableText(product) {
    const optionValues = (product.options || []).flatMap(group => group.values || []);
    return [product.title,product.description,...(product.colors || []),...(product.sizes || []),...optionValues].join(" ").toLowerCase();
}

function productCard(product) {
    const card = document.createElement("article");
    card.className = "product-box";
    card.dataset.id = product.id;
    card.tabIndex = 0;
    card.setAttribute("role","link");
    card.innerHTML = `
        <div class="img-box">
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
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProduct();
        }
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
backButton.addEventListener("click",() => {
    if (history.length > 1) history.back();
    else window.location.href = "index.html";
});

suggestions.forEach(item => suggestedContainer.appendChild(chip(item)));
renderRecentSearches();
const initialQuery = new URLSearchParams(location.search).get("q") || "";
searchInput.value = initialQuery;
renderResults();
requestAnimationFrame(() => searchInput.focus());
