/*ALL THE PRODUCTS*/
const products = [

{
    id: 1,
    title: "Pineapple Zest Rest",
    price: "30000",
    image: "images/Nails1.jpg",
    gallery: [
        "images/Nails1.jpg",
        "images/Nails1.jpg",
        "images/Nails1.jpg"
    ],
    description: "Product description coming soon.",
    colors: [
    "Pink",
    "Nude",
    "White"
],

sizes: [
    "XS",
    "S",
    "M",
    "L"
],
options: [
    { key: "color", label: "Color", values: ["Pink", "Nude", "White"] },
    { key: "size", label: "Size", values: ["XS", "S", "M", "L"] }
]
},

{
    id: 2,
    title: "Press Explosion",
    price: "25000",
    image: "images/PressOn Nails_Pink.JPG",
    gallery: [
        "images/PressOn Nails_Pink.JPG",
        "images/PressOn Nails_Purple.PNG",
        "images/PressOn Nails_BabyBlue.PNG"

    ],
    galleries: {
        "Pink": ["images/PressOn Nails_Pink.JPG"],
        "Purple": ["images/PressOn Nails_Purple.PNG"],
        "Baby Blue": ["images/PressOn Nails_BabyBlue.PNG"]
    },
    description: " Press Explosion is a vibrant, high-impact press-on nail set designed for anyone who loves a playful burst of colour. Featuring bright pink tones, delicate French-inspired details, and a touch of glitter, each nail creates a polished statement look with minimal effort. The lightweight set is comfortable for everyday wear, easy to apply at home, and ideal for parties, weekends, photos, and special occasions. Mix the sizes for your most natural fit, then pair Pink Explosion with your favourite rings and accessories for a cheerful finish that stands out beautifully from every angle.",
   colors: [
    "Pink",
    "Purple",
    "Baby Blue"
],

sizes: [
    "XS",
    "S",
    "M",
    "L"
],
options: [
    { key: "color", label: "Color", values: ["Pink", "Purple", "Baby Blue"] },
    { key: "size", label: "Size", values: ["XS", "S", "M", "L"] }
]
},

{
    id: 3,
    title: "Moisturizer",
    price: "20000",
    image: "images/Nails3.jpg",
    gallery: [
        "images/Nails3.jpg",
    ],
    description: "Product description coming soon.",
    colors: ["Clear"],
    sizes: ["100ml"],
    options: [
        { key: "color", label: "Color", values: ["Clear"] },
        { key: "size", label: "Size", values: ["100ml"] }
    ]
},

{
    id: 4,
    title: "Pearly Press-Ons",
    price: "25000",
    image: "images/IMG_389p.jpg",
    gallery: [
        "images/IMG_389p.jpg"
    ],
    description: "Product description coming soon.",
    colors: ["White"],
    sizes: ["Medium"],
    options: [
        { key: "color", label: "Color", values: ["White"] },
        { key: "size", label: "Size", values: ["Medium"] }
    ]
},

{
    id: 5,
    title: "Soft Pink Polish",
    price: "35000",
    image: "images/IMG_3887h.jpg",
    gallery: [
        "images/IMG_3887h.jpg"
    ],
    description: "Product description coming soon.",
    colors: ["Pink"],
    sizes: ["15ml"],
    options: [
        { key: "color", label: "Color", values: ["Pink"] },
        { key: "size", label: "Size", values: ["15ml"] }
    ]
},

{
    id: 6,
    title: "Press-Ons",
    price: "45000",
    image: "images/Nails2.jpg",
    gallery: [
        "images/Nails2.jpg"
    ],
    description: "Product description coming soon.",
    colors: ["Black"],
    sizes: ["Medium"],
    options: [
        { key: "color", label: "Color", values: ["Black"] },
        { key: "size", label: "Size", values: ["Medium"] }
    ]
},

{
    id: 7,
    title: "Lavendar",
    price: "50000",
    image: "images/IMG_3893.JPG",
    gallery: [
        "images/IMG_3893.JPG"
    ],
    description: "Product description coming soon.",
    colors: ["Purple"],
    sizes: ["15ml"],
    options: [
        { key: "color", label: "Color", values: ["Purple"] },
        { key: "size", label: "Size", values: ["15ml"] }
    ]
},

{
    id: 8,
    title: "Princess Cuts",
    price: "12000",
   image: "images/Snow White.jpg",

   galleries: {
       "Snow White": [
           "images/Snow White.jpg"
       ],

       "Pearl": [
           "images/Pearl.PNG"
       ],

       "Silver": [
           "images/Silver.PNG"
       ]
   },

   gallery: [
       "images/Snow White.jpg",
       "images/Pearl.PNG",
       "images/Silver.PNG"
   ],

    description: "Product description coming soon.",
colors: [
    "Snow White",
    "Pearl",
    "Silver"
],

sizes: [
    "XS",
    "S",
    "M",
    "L",
    "XL"
],
options: [
    { key: "color", label: "Color", values: ["Snow White", "Pearl", "Silver"] },
    { key: "size", label: "Size", values: ["XS", "S", "M", "L", "XL"] }
]
},

{
    id: 9,
    title: "Light Vendar",
    price: "52000",
    image: "images/IMG_3896.jpg",
    gallery: [
        "images/IMG_3896.jpg"
    ],
    description: "Product description coming soon.",
    colors: ["Purple"],
    sizes: ["15ml"],
    options: [
        { key: "color", label: "Color", values: ["Purple"] },
        { key: "size", label: "Size", values: ["15ml"] }
    ]
},

{
    id: 10,
    title: "Human-Hair Wig",
    price: "800000",
    image: "images/Human Wig_Shoulder.PNG",
    gallery: [
        "images/Human Wig_Shoulder.PNG",
         "images/Human Wig_MidBack.webp",
          "images/Human Wig_Waist.PNG",
    ],
    sizeGalleries: {
        "Shoulder": ["images/Human Wig_Shoulder.PNG"],
        "Mid-Back": ["images/Human Wig_MidBack.webp"],
        "Waist": ["images/Human Wig_Waist.PNG"]
    },
    sizePrices: {
        "Shoulder": "400000",
        "Mid-Back": "800000",
        "Waist": "1200000"
    },
    description: "Product description coming soon.",
    colors: ["Black"],
    sizeLabel: "Lengths",
    sizes: ["Shoulder", "Mid-Back", "Waist"],
    options: [
        { key: "color", label: "Color", values: ["Black"] },
        { key: "length", label: "Length", values: ["Shoulder", "Mid-Back", "Waist"] }
    ],
    variants: {
        "Black|Shoulder": {
            price: "400000",
            images: ["images/Human Wig_Shoulder.PNG"]
        },
        "Black|Mid-Back": {
            price: "800000",
            images: ["images/Human Wig_MidBack.webp"]
        },
        "Black|Waist": {
            price: "1200000",
            images: ["images/Human Wig_Waist.PNG"]
        }
    }
},

{
    id: 11,
    title: "Clip-On Lashes",
    price: "40000",
    image: "images/Lashes.webp",
    gallery: [
        "images/Lashes.webp"
    ],
    description: "Product description coming soon.",
    colors: ["Black"],
    sizes: ["Short", "Medium","Long"],
    options: [
        { key: "color", label: "Color", values: ["Black"] },
        { key: "size", label: "Size", values: ["Short", "Medium", "Long"] }
    ]
},

{
    id: 12,
    title: "Human-Curly Wig",
    price: "700000",
    image: "images/Wigs/Human Curly Wig.PNG",
    gallery: [
        "images/Wigs/Human Curly Wig.PNG",
         "images/Wigs/Human Curly Wig.PNG",
          "images/Wigs/Human Curly Wig.PNG",
    ],
    sizeGalleries: {
        "Shoulder": ["images/Wigs/Human Curly Wig.PNG"],
    },
    sizePrices: {
        "Shoulder": "700000",
    },
    description: "Product description coming soon.",
    colors: ["Black"],
    sizeLabel: "Lengths",
    sizes: ["Shoulder"],
    options: [
        { key: "color", label: "Color", values: ["Black"] },
        { key: "length", label: "Length", values: ["Shoulder"] }
    ],
    variants: {
        "Black|Shoulder": {
            price: "700000",
            images: ["images/Wigs/Human Curly Wig.PNG"]
        }
    }
},

{
    id: 13,
    title: "Human-Curly Wig",
    price: "700000",
    image: "images/Wigs/Human Hair Wig 2_Shoulder.PNG",
    gallery: [
        "images/Wigs/Human Hair Wig 2_Shoulder.PNG",
        "images/Wigs/Human Hair Wig 2_Waist.JPG",
    ],
    sizeGalleries: {
        "Shoulder": ["images/Wigs/Human Hair Wig 2_Shoulder.PNG"],
         "Waist": ["images/Wigs/Human Hair Wig 2_Waist.JPG"],
    },
    sizePrices: {
        "Shoulder": "600000",
        "Waist": "1000000",
    },
    description: "Pblah blah blah blah description words and stuff.",
    colors: ["Black"],
    sizeLabel: "Lengths",
    sizes: ["Shoulder", "Waist"],
    options: [
        { key: "color", label: "Color", values: ["Black"] },
        { key: "length", label: "Length", values: ["Shoulder", "Waist"] }
    ],
    variants: {
        "Black|Shoulder": {
            price: "600000",
            images: ["images/Wigs/Human Hair Wig 2_Shoulder.PNG"]
        },
         "Black|Waist": {
            price: "1000000",
            images: ["images/Wigs/Human Hair Wig 2_Waist.JPG"]
        }
    }
},


{
    id: 14,
    title: "Synthetic Wig",
    price: "600000",
    image: "images/Wigs/Synthetic Wig_Waist.JPG",
    gallery: [
        "images/Wigs/Synthetic Wig_Waist.JPG",
        "images/Wigs/Synthetic Wig_Shoulder.PNG",
        
    ],
    sizeGalleries: {
        "Shoulder": ["images/Wigs/Synthetic Wig_Shoulder.PNG"],
        "Waist": ["images/Wigs/Synthetic Wig_Waist.JPG"]
         
    },
    sizePrices: {
        "Shoulder": "600000",
        "Waist": "1000000",
    },
    description: "blah blah blah blah description words and stuff.",
    colors: ["Black"],
    sizeLabel: "Lengths",
    sizes: ["Shoulder", "Waist"],
    options: [
        { key: "color", label: "Color", values: ["Black"] },
        { key: "length", label: "Length", values: ["Shoulder", "Waist"] }
    ],
    variants: {
         "Black|Shoulder": {
            price: "600000",
            images: ["images/Wigs/Synthetic Wig_Shoulder.PNG"]
        },
         "Black|Waist": {
            price: "1000000",
            images: ["images/Wigs/Synthetic Wig_Waist.JPG"]
        }
        
    }
},

{
    id: 15,
    title: "Synthetic-Curly Wig",
    price: "200000",
    image: "images/Wigs/Synthetic Curly Wig.JPG",
    gallery: [
        "images/Wigs/Synthetic Curly Wig.JPG",
        "images/Wigs/Synthetic Curly Wig 2.JPG"
    ],
    sizeGalleries: {
        "Shoulder": ["images/Wigs/Synthetic Curly Wig.JPG"],
         
    },
    sizePrices: {
        "Shoulder": "200000",
    },
    description: "blah blah blah blah description words and stuff.",
    colors: ["Black"],
    sizeLabel: "Lengths",
    sizes: ["Shoulder"],
    options: [
        { key: "color", label: "Color", values: ["Black"] },
        { key: "length", label: "Length", values: ["Shoulder"] }
    ],
    variants: {
         "Black|Shoulder": {
            price: "200000",
            images: [
                "images/Wigs/Synthetic Curly Wig.JPG",
                "images/Wigs/Synthetic Curly Wig 2.JPG"
            ]
        }
        
    }
}

];

/* Serve phone-friendly catalogue assets while keeping the full-resolution
   originals available for future editing. */
const optimizedProductImages = {
    "images/Nails1.jpg": "images/optimized/Nails1.jpg",
    "images/Nails3.jpg": "images/optimized/Nails3.jpg",
    "images/Nails2.jpg": "images/optimized/Nails2.jpg",
    "images/IMG_3893.JPG": "images/optimized/IMG_3893.jpg",
    "images/Human Wig_Shoulder.PNG": "images/optimized/Human-Wig-Shoulder.jpg",
    "images/Human Wig_Waist.PNG": "images/optimized/Human-Wig-Waist.jpg",
    "images/Wigs/Human Curly Wig.PNG": "images/optimized/Human-Curly-Wig.jpg",
    "images/Wigs/Human Hair Wig 2_Shoulder.PNG": "images/optimized/Human-Hair-Wig-2-Shoulder.jpg",
    "images/Wigs/Synthetic Wig_Shoulder.PNG": "images/optimized/Synthetic-Wig-Shoulder.jpg",
    "images/PressOn Nails_Purple.PNG": "images/optimized/PressOn-Nails-Purple.jpg",
    "images/PressOn Nails_BabyBlue.PNG": "images/optimized/PressOn-Nails-BabyBlue.jpg",
    "images/Pearl.PNG": "images/optimized/Pearl.jpg",
    "images/Silver.PNG": "images/optimized/Silver.jpg"
};

const optimizedProductImage = source => optimizedProductImages[source] || source;
const optimizeGalleryMap = galleries => Object.fromEntries(
    Object.entries(galleries || {}).map(([key, images]) => [
        key,
        images.map(optimizedProductImage)
    ])
);

products.forEach(product => {
    product.shippingClass ||= "small";
    product.image = optimizedProductImage(product.image);
    product.gallery = (product.gallery || []).map(optimizedProductImage);
    if (product.galleries) product.galleries = optimizeGalleryMap(product.galleries);
    if (product.sizeGalleries) product.sizeGalleries = optimizeGalleryMap(product.sizeGalleries);
    Object.values(product.variants || {}).forEach(variant => {
        variant.images = (variant.images || []).map(optimizedProductImage);
    });
});

window.products = products;

const mpwrDiscountsById = new Map();

function numericMPWRPrice(value) {
    return Number(String(value ?? "").replace(/[^0-9.]/g, "")) || 0;
}

function setMPWRDiscounts(discounts) {
    mpwrDiscountsById.clear();
    (Array.isArray(discounts) ? discounts : []).forEach(item => {
        const id = String(item?.id || "");
        const percent = Math.min(95, Math.max(0, Math.round(Number(item?.percent) || 0)));
        if (id && percent) mpwrDiscountsById.set(id, percent);
    });
    products.forEach(product => {
        const percent = mpwrDiscountsById.get(String(product.id)) || 0;
        if (percent) product.discountPercent = percent;
        else delete product.discountPercent;
    });
}

function mpwrPriceDetails(item, regularOverride) {
    const catalogueProduct = products.find(product => String(product.id) === String(item?.id));
    const explicitPercent = regularOverride !== undefined ? item?.discountPercent : undefined;
    const campaignPercent = Math.min(95, Math.max(0, Number(
        explicitPercent ?? (catalogueProduct
            ? (catalogueProduct.discountPercent ?? mpwrDiscountsById.get(String(item?.id)) ?? 0)
            : (item?.discountPercent ?? mpwrDiscountsById.get(String(item?.id)) ?? 0))
    ) || 0));
    const storedPrice = numericMPWRPrice(item?.price);
    const cataloguePrice = numericMPWRPrice(catalogueProduct?.price);

    if (campaignPercent) {
        const regular = numericMPWRPrice(
            regularOverride ?? item?.originalPrice ?? (catalogueProduct ? cataloguePrice : storedPrice)
        );
        const current = Math.round(regular * (1 - campaignPercent / 100));
        return { current, regular, percent: campaignPercent, discounted: regular > current, source: "campaign" };
    }

    const current = numericMPWRPrice(
        regularOverride ?? (catalogueProduct ? cataloguePrice : storedPrice)
    );
    const compareAtPrice = numericMPWRPrice(
        item?.compareAtPrice ?? catalogueProduct?.compareAtPrice ?? item?.originalPrice
    );
    if (compareAtPrice > current) {
        const percent = Math.min(95, Math.max(1, Math.round((1 - current / compareAtPrice) * 100)));
        return { current, regular: compareAtPrice, percent, discounted: true, source: "product" };
    }

    return { current, regular: current, percent: 0, discounted: false, source: "regular" };
}

function mpwrPriceMarkup(item, regularOverride, groupClass = "") {
    const pricing = mpwrPriceDetails(item, regularOverride);
    if (!pricing.discounted) return `UGX ${pricing.current.toLocaleString()}`;
    return `<span class="mpwr-price-pair ${groupClass}"><span class="mpwr-sale-price">UGX ${pricing.current.toLocaleString()}</span><span class="mpwr-original-price">UGX ${pricing.regular.toLocaleString()}</span></span>`;
}

window.MPWRPricing = {
    details: mpwrPriceDetails,
    markup: mpwrPriceMarkup,
    setDiscounts: setMPWRDiscounts
};

/* Keep catalogue image paths portable between localhost and the deployed site. */
function normalizeMPWRImagePath(source, productId) {
    const fallback = products.find(product => String(product.id) === String(productId))?.image || "";
    // Clip-On Lashes previously referenced a wig gallery image. Repair any
    // already-saved cart or order item that still carries that stale thumbnail.
    if (String(productId) === "11") return fallback;
    if (!source) return fallback;

    const value = String(source).trim();
    try {
        const url = new URL(value, window.location.href);
        const pathname = decodeURIComponent(url.pathname);
        if (pathname.startsWith("/images/")) return optimizedProductImage(pathname.slice(1));
    } catch (error) {
        console.warn("Could not normalize image path", value, error);
    }
    return optimizedProductImage(value);
}

function normalizeMPWRItems(items = []) {
    return items.map(item => {
        const catalogueProduct = products.find(product => String(product.id) === String(item.id));
        const pricing = mpwrPriceDetails(item);
        return {
            ...item,
            price: pricing.current,
            originalPrice: pricing.discounted ? pricing.regular : undefined,
            discountPercent: pricing.discounted ? pricing.percent : undefined,
            image: normalizeMPWRImagePath(item.image, item.id),
            shippingClass: item.shippingClass || catalogueProduct?.shippingClass || "small"
        };
    });
}

function mpwrCartItemIdentity(item = {}) {
    const selections = item.selectedOptions && Object.keys(item.selectedOptions).length
        ? Object.entries(item.selectedOptions).sort(([a], [b]) => a.localeCompare(b))
        : [["color", item.color || ""], ["size", item.size || ""]];
    return [item.id, JSON.stringify(selections)]
        .map(value => String(value).trim().toLowerCase())
        .join("::");
}

function normalizeMPWRCartItems(items = []) {
    const catalogueIds = new Set(products.map(product => String(product.id)));
    const merged = new Map();

    normalizeMPWRItems(Array.isArray(items) ? items : []).forEach(item => {
        if (!item?.id || !catalogueIds.has(String(item.id))) return;
        const normalizedItem = {
            ...item,
            quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
        };
        const key = mpwrCartItemIdentity(normalizedItem);
        const existing = merged.get(key);
        if (!existing) merged.set(key, normalizedItem);
        else existing.quantity = Math.max(existing.quantity, normalizedItem.quantity);
    });

    return [...merged.values()];
}

window.normalizeMPWRImagePath = normalizeMPWRImagePath;
window.normalizeMPWRItems = normalizeMPWRItems;
window.normalizeMPWRCartItems = normalizeMPWRCartItems;
window.MPWRCartStorage = Object.freeze({
    read(key = "cart") {
        try {
            return normalizeMPWRCartItems(JSON.parse(localStorage.getItem(key) || "[]"));
        } catch {
            return [];
        }
    },
    current() {
        if (window.auth?.currentUser) return this.read("cart");
        if (localStorage.getItem("mpwrGuestCart") !== null) {
            return this.read("mpwrGuestCart");
        }
        // The legacy shared key may contain a previous account's cached cart.
        // Never expose that data as a guest cart.
        return [];
    },
    save(items, user = window.auth?.currentUser || null) {
        const normalized = normalizeMPWRCartItems(items);
        localStorage.setItem("cart", JSON.stringify(normalized));
        if (!user) localStorage.setItem("mpwrGuestCart", JSON.stringify(normalized));
        return normalized;
    },
    activateGuest() {
        const hasGuestCart = localStorage.getItem("mpwrGuestCart") !== null;
        const guestCart = hasGuestCart
            ? this.read("mpwrGuestCart")
            : [];
        localStorage.setItem("mpwrGuestCart", JSON.stringify(guestCart));
        localStorage.setItem("cart", JSON.stringify(guestCart));
        localStorage.removeItem("mpwrCartOwnerUid");
        return guestCart;
    },
    consumeGuest() {
        localStorage.removeItem("mpwrGuestCart");
    }
});

function apiProduct(row) {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const image = row.imageUrl || metadata.image || "";
    return {
        ...metadata,
        id: String(row.legacyId || row.id),
        apiId: row.id,
        title: row.title || "Product",
        price: Number(row.price) || 0,
        image,
        gallery: Array.isArray(metadata.gallery) && metadata.gallery.length
            ? metadata.gallery
            : image ? [image] : [],
        description: row.description || "Product description coming soon.",
        shippingClass: row.class || row.shippingClass || "small",
        category: metadata.category || "",
        colors: Array.isArray(metadata.colors) ? metadata.colors : [],
        sizes: Array.isArray(metadata.sizes) ? metadata.sizes : [],
        videos: Array.isArray(metadata.videos) ? metadata.videos : []
    };
}

function createCatalogueCard(product) {
    const card = document.createElement("div");
    card.className = "product-box";
    card.dataset.id = String(product.id);

    const imageBox = document.createElement("div");
    imageBox.className = "img-box";

    const wishlistButton = document.createElement("button");
    wishlistButton.className = "wishlist-btn";
    wishlistButton.type = "button";
    wishlistButton.setAttribute("aria-label", `Add ${product.title} to wishlist`);

    const wishlistIcon = document.createElement("img");
    wishlistIcon.src = "images/optimized/heart-outline.png";
    wishlistIcon.className = "wishlist-icon";
    wishlistIcon.alt = "";
    wishlistButton.appendChild(wishlistIcon);

    const productImage = document.createElement("img");
    productImage.src = product.image;
    productImage.alt = product.title;
    productImage.loading = "lazy";
    productImage.decoding = "async";
    imageBox.append(wishlistButton, productImage);

    const title = document.createElement("h2");
    title.className = "product-title";
    title.textContent = product.title;

    const priceAndCart = document.createElement("div");
    priceAndCart.className = "price-and-cart";
    const price = document.createElement("span");
    price.className = "price";
    price.innerHTML = mpwrPriceMarkup(product, undefined, "is-card-price");
    const addWrapper = document.createElement("i");
    const addIcon = document.createElement("img");
    addIcon.src = "images/Plus.PNG";
    addIcon.className = "addie";
    addIcon.alt = "View product";
    addWrapper.appendChild(addIcon);
    priceAndCart.append(price, addWrapper);

    card.append(imageBox, title, priceAndCart);
    return card;
}

function syncCatalogueCards() {
    const grid = document.querySelector("#products > .product-content");
    if (!grid) return;

    const cards = new Map(
        [...grid.querySelectorAll(":scope > .product-box")]
            .map(card => [String(card.dataset.id), card])
    );

    const activeProductIds = new Set(products.map(product => String(product.id)));
    cards.forEach((card, id) => {
        if (!activeProductIds.has(id)) card.remove();
    });

    products.forEach(product => {
        let card = cards.get(String(product.id));
        if (!product.category && card?.dataset.category) product.category = card.dataset.category;
        product.category ||= "products";

        if (!card) {
            card = createCatalogueCard(product);
            grid.appendChild(card);
        } else {
            const image = card.querySelector(".img-box > img:not(.wishlist-icon)");
            if (image && product.image) image.src = product.image;
            if (image) image.alt = product.title;
            const title = card.querySelector(".product-title");
            if (title) title.textContent = product.title;
            const price = card.querySelector(".price");
            if (price) price.innerHTML = mpwrPriceMarkup(product, undefined, "is-card-price");
        }

        card.dataset.category = product.category;
    });
}

const DEFAULT_HOMEPAGE_HERO = {
    enabled: true,
    eyebrow: "MPWR Beauty",
    heading: "Beauty finds, made easy",
    body: "Shop press-ons, wigs, lashes and self-care favourites curated for effortless everyday glam.",
    buttonLabel: "Shop now",
    buttonLink: "#products",
    image: "images/PressOn Nails_Pink.JPG"
};
const HOMEPAGE_HERO_IMAGE_LIMIT = 10;
const DEFAULT_ANNOUNCEMENT_BAR = {
    enabled: true,
    message: "Free delivery on selected orders this week.",
    linkLabel: "Shop now",
    link: "#products"
};
const DEFAULT_CAMPAIGN_BANNER = {
    enabled: true,
    eyebrow: "Limited Offers",
    heading: "15% off selected favourites",
    body: "Bring your next beauty refresh home for less with limited-time campaign deals.",
    buttonLabel: "Shop offers",
    buttonLink: "#discounts",
    image: "images/Icon Folder/Discount Icon_E5A484.PNG"
};
const DEFAULT_CATALOGUE_CATEGORIES = [
    { slug: "press-ons", label: "Press-ons" },
    { slug: "wigs", label: "Wigs" },
    { slug: "products", label: "Products" },
    { slug: "lashes", label: "Lashes" }
];

function normalizeHomepageHero(value = {}) {
    const text = (input, fallback, maxLength) => {
        const cleaned = String(input || "").trim().replace(/\s+/g, " ");
        return (cleaned || fallback).slice(0, maxLength);
    };
    const hasImageList = Array.isArray(value.images);
    const image = hasImageList ? "" : text(value.image, DEFAULT_HOMEPAGE_HERO.image, 500);
    const images = (hasImageList ? value.images : [image])
        .map(item => text(typeof item === "string" ? item : item?.url, "", 500))
        .filter(Boolean)
        .filter((url, index, list) => list.indexOf(url) === index)
        .slice(0, HOMEPAGE_HERO_IMAGE_LIMIT);
    return {
        enabled: value.enabled !== false,
        eyebrow: text(value.eyebrow, DEFAULT_HOMEPAGE_HERO.eyebrow, 40),
        heading: text(value.heading, DEFAULT_HOMEPAGE_HERO.heading, 80),
        body: text(value.body, DEFAULT_HOMEPAGE_HERO.body, 180),
        buttonLabel: text(value.buttonLabel, DEFAULT_HOMEPAGE_HERO.buttonLabel, 32),
        buttonLink: safeStorefrontLink(text(value.buttonLink, DEFAULT_HOMEPAGE_HERO.buttonLink, 140), DEFAULT_HOMEPAGE_HERO.buttonLink),
        image: images[0] || "",
        images
    };
}

function safeStorefrontLink(value, fallback) {
    const candidate = String(value || "").trim();
    if (!candidate) return fallback;
    if (candidate.startsWith("#") || candidate.startsWith("/") || candidate.startsWith("./") || candidate.startsWith("../")) return candidate;
    try {
        const parsed = new URL(candidate, window.location.href);
        return ["http:", "https:"].includes(parsed.protocol) ? candidate : fallback;
    } catch { return fallback; }
}

function applyHomepageHero(value) {
    const isHomepage = /(?:^\/$|\/index\.html$)/i.test(window.location.pathname);
    if (!isHomepage) return;
    const hero = normalizeHomepageHero(value);
    const productsSection = document.querySelector("#products");
    if (!productsSection) return;
    document.body.classList.toggle("has-homepage-hero", hero.enabled);
    let section = document.querySelector(".homepage-hero");
    if (!hero.enabled) {
        section?.heroCleanup?.();
        section?.remove();
        return;
    }
    if (!section) {
        section = document.createElement("section");
        section.className = "homepage-hero";
        section.innerHTML = `
            <div class="homepage-hero-copy">
                <p class="homepage-hero-eyebrow"></p>
                <h1></h1>
                <p class="homepage-hero-body"></p>
                <a class="homepage-hero-button"></a>
            </div>
            <div class="homepage-hero-media" aria-label="Hero image slideshow"></div>
            <div class="homepage-hero-controls" aria-label="Hero slideshow controls">
                <button type="button" data-hero-control="previous" aria-label="Previous hero image">‹</button>
                <button type="button" data-hero-control="pause" aria-label="Pause hero slideshow" aria-pressed="false">Ⅱ</button>
                <button type="button" data-hero-control="next" aria-label="Next hero image">›</button>
            </div>
            <nav class="homepage-hero-categories" aria-label="Shop by category">
                <a class="is-featured" href="Nails.html">Press-ons</a>
                <a href="Wigs.html">Wigs</a>
                <a href="Lashes.html">Lashes</a>
                <a href="ProductsPage.html">Self-care</a>
            </nav>
        `;
        productsSection.parentNode.insertBefore(section, productsSection);
    }
    section.heroCleanup?.();
    const categoryLinks = section.querySelectorAll(".homepage-hero-categories a");
    const selectCategory = selectedLink => {
        categoryLinks.forEach(link => link.classList.toggle("is-featured", link === selectedLink));
    };
    categoryLinks.forEach(link => {
        link.onpointerdown = () => selectCategory(link);
        link.onclick = () => selectCategory(link);
    });
    section.querySelector(".homepage-hero-eyebrow").textContent = hero.eyebrow;
    section.querySelector("h1").textContent = hero.heading;
    section.querySelector(".homepage-hero-body").textContent = hero.body;
    const button = section.querySelector(".homepage-hero-button");
    button.textContent = hero.buttonLabel;
    button.href = hero.buttonLink || "#products";
    const media = section.querySelector(".homepage-hero-media");
    media.replaceChildren();
    const track = document.createElement("div");
    track.className = "homepage-hero-track";
    const slides = hero.images.map((url, index) => {
        const image = document.createElement("img");
        image.className = `homepage-hero-slide${index === 0 ? " is-active" : ""}`;
        image.alt = index === 0 ? hero.heading : "";
        image.loading = index === 0 ? "eager" : "lazy";
        image.fetchPriority = index === 0 ? "high" : "low";
        image.decoding = "async";
        image.dataset.src = url;
        track.appendChild(image);
        return image;
    });
    const imageReady = slides.map(image => new Promise(resolve => {
        if (image.getAttribute("src") && image.complete) return resolve(image.naturalWidth > 0);
        image.addEventListener("load", () => resolve(true), { once: true });
        image.addEventListener("error", () => resolve(false), { once: true });
    }));
    if (slides[0]?.dataset.src) {
        slides[0].src = slides[0].dataset.src;
        delete slides[0].dataset.src;
    }
    const ensureImage = index => {
        const image = slides[index];
        if (image?.dataset.src) {
            image.src = image.dataset.src;
            delete image.dataset.src;
        }
        return imageReady[index];
    };
    media.appendChild(track);

    let activeIndex = 0;
    let pendingIndex = null;
    let transitionToken = 0;
    let disposed = false;
    let pausedByUser = false;
    const controls = section.querySelector(".homepage-hero-controls");
    const pauseButton = controls.querySelector('[data-hero-control="pause"]');
    const step = async (index, direction = 1) => {
        if (slides.length < 2) return -1;
        for (let offset = 0; offset < slides.length; offset += 1) {
            const candidate = (index + offset * direction + slides.length) % slides.length;
            if (candidate !== activeIndex && await ensureImage(candidate)) return candidate;
        }
        return -1;
    };
    const showSlide = async (index, direction = 1) => {
        if (disposed || pendingIndex !== null) return;
        pendingIndex = -1;
        const nextIndex = await step(index, direction);
        if (disposed || nextIndex < 0) { pendingIndex = null; return; }
        pendingIndex = nextIndex;
        const token = ++transitionToken;
        if (token !== transitionToken) return;
        clearTimeout(section.heroFadeTimer);
        slides.forEach(slide => slide.classList.remove("is-leaving"));
        const outgoingSlide = slides[activeIndex];
        const incomingSlide = slides[nextIndex];
        incomingSlide.classList.remove("is-active", "is-leaving");
        void incomingSlide.offsetWidth;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (disposed || token !== transitionToken) return;
            outgoingSlide.classList.remove("is-active");
            outgoingSlide.classList.add("is-leaving");
            outgoingSlide.alt = "";
            incomingSlide.classList.add("is-active");
            incomingSlide.alt = hero.heading;
            activeIndex = nextIndex;
            pendingIndex = null;
            section.heroFadeTimer = setTimeout(() => {
                outgoingSlide.classList.remove("is-leaving");
                section.heroFadeTimer = null;
            }, 1250);
        }));
    };
    const stop = () => { clearInterval(section.heroSlideshowTimer); section.heroSlideshowTimer = null; };
    const start = () => {
        stop();
        if (disposed || pausedByUser || document.hidden || slides.length < 2) return;
        section.heroSlideshowTimer = setInterval(() => showSlide(activeIndex + 1), 5000);
    };
    const setPaused = paused => {
        pausedByUser = paused;
        pauseButton.setAttribute("aria-pressed", String(paused));
        pauseButton.setAttribute("aria-label", paused ? "Play hero slideshow" : "Pause hero slideshow");
        pauseButton.textContent = paused ? "▶" : "Ⅱ";
        if (paused) stop(); else start();
    };
    const onVisibilityChange = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    controls.hidden = slides.length < 2;
    controls.onclick = event => {
        const action = event.target.closest("[data-hero-control]")?.dataset.heroControl;
        if (!action) return;
        if (action === "pause") return setPaused(!pausedByUser);
        stop();
        showSlide(activeIndex + (action === "previous" ? -1 : 1), action === "previous" ? -1 : 1).finally(start);
    };
    section.heroCleanup = () => {
        disposed = true;
        stop();
        transitionToken += 1;
        pendingIndex = null;
        clearTimeout(section.heroFadeTimer);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        controls.onclick = null;
    };
    imageReady[0]?.then(loaded => {
        if (!loaded && section.isConnected) showSlide(1);
    });
    if (slides.length > 1) {
        start();
    }
}

function normalizeAnnouncementBar(value = {}) {
    const text = (input, fallback, maxLength) => {
        const cleaned = String(input || "").trim().replace(/\s+/g, " ");
        return (cleaned || fallback).slice(0, maxLength);
    };
    return {
        enabled: value.enabled !== false,
        message: text(value.message, DEFAULT_ANNOUNCEMENT_BAR.message, 120),
        linkLabel: text(value.linkLabel, DEFAULT_ANNOUNCEMENT_BAR.linkLabel, 32),
        link: text(value.link, DEFAULT_ANNOUNCEMENT_BAR.link, 140)
    };
}

function applyAnnouncementBar(value) {
    const isHomepage = /(?:^\/$|\/index\.html$)/i.test(window.location.pathname);
    if (!isHomepage) return;
    const announcement = normalizeAnnouncementBar(value);
    let bar = document.querySelector(".mpwr-announcement-bar");
    document.body.classList.toggle("has-announcement-bar", announcement.enabled);
    if (!announcement.enabled) {
        bar?.remove();
        return;
    }
    if (!bar) {
        bar = document.createElement("div");
        bar.className = "mpwr-announcement-bar";
        bar.innerHTML = `<span></span><a></a>`;
        document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.querySelector("span").textContent = announcement.message;
    const link = bar.querySelector("a");
    link.textContent = announcement.linkLabel;
    link.href = announcement.link || "#products";
}

function normalizeCampaignBanner(value = {}) {
    const text = (input, fallback, maxLength) => {
        const cleaned = String(input || "").trim().replace(/\s+/g, " ");
        return (cleaned || fallback).slice(0, maxLength);
    };
    const source = value.source === "discounts" ? "discounts" : "custom";
    return {
        enabled: value.enabled !== false,
        source,
        syncWithCampaign: source === "discounts" && value.syncWithCampaign === true,
        eyebrow: text(value.eyebrow, DEFAULT_CAMPAIGN_BANNER.eyebrow, 40),
        heading: text(value.heading, DEFAULT_CAMPAIGN_BANNER.heading, 80),
        body: text(value.body, DEFAULT_CAMPAIGN_BANNER.body, 180),
        buttonLabel: text(value.buttonLabel, DEFAULT_CAMPAIGN_BANNER.buttonLabel, 32),
        buttonLink: text(value.buttonLink, DEFAULT_CAMPAIGN_BANNER.buttonLink, 140),
        image: text(value.image, DEFAULT_CAMPAIGN_BANNER.image, 500)
    };
}

function resolveCampaignBanner(value, discountSetting = null) {
    const banner = normalizeCampaignBanner(value);
    if (banner.source === "discounts" && banner.syncWithCampaign && discountSetting && typeof discountSetting.enabled === "boolean") {
        banner.enabled = discountSetting.enabled;
    }
    return banner;
}

function applyCampaignBanner(value) {
    const isHomepage = /(?:^\/$|\/index\.html$)/i.test(window.location.pathname);
    if (!isHomepage) return;
    const banner = normalizeCampaignBanner(value);
    const productsSection = document.querySelector("#products");
    if (!productsSection) return;
    let section = document.querySelector(".homepage-campaign-banner");
    if (!banner.enabled) {
        section?.remove();
        return;
    }
    if (!section) {
        section = document.createElement("section");
        section.className = "homepage-campaign-banner";
        section.innerHTML = `
            <img class="homepage-campaign-image" alt="">
            <div class="homepage-campaign-copy">
                <p class="homepage-campaign-eyebrow"></p>
                <h2></h2>
                <p class="homepage-campaign-body"></p>
            </div>
            <a class="homepage-campaign-button"></a>
        `;
    }
    const hero = document.querySelector(".homepage-hero");
    if (hero?.parentNode === productsSection.parentNode) hero.after(section);
    else productsSection.parentNode.insertBefore(section, productsSection);
    section.querySelector(".homepage-campaign-eyebrow").textContent = banner.eyebrow;
    section.querySelector("h2").textContent = banner.heading;
    section.querySelector(".homepage-campaign-body").textContent = banner.body;
    const button = section.querySelector(".homepage-campaign-button");
    button.textContent = banner.buttonLabel;
    button.href = banner.buttonLink || "#discounts";
    const image = section.querySelector(".homepage-campaign-image");
    image.src = banner.image;
    image.alt = banner.heading;
}

function normalizeCatalogueCategories(items) {
    const defaults = new Map(DEFAULT_CATALOGUE_CATEGORIES.map(category => [category.slug, category]));
    const normalized = [];
    const known = new Set();
    (Array.isArray(items) ? items : []).forEach(item => {
        const slug = String(item?.slug || "").trim().toLowerCase();
        const label = String(item?.label || defaults.get(slug)?.label || "").trim();
        if (!slug || !label || known.has(slug)) return;
        known.add(slug);
        normalized.push({ slug, label });
    });
    DEFAULT_CATALOGUE_CATEGORIES.forEach(category => {
        if (!known.has(category.slug)) {
            known.add(category.slug);
            normalized.push({ ...category });
        }
    });
    return normalized;
}

function applyCategoryOrder(items) {
    const categories = normalizeCatalogueCategories(items);
    window.MPWRCategoryOrder = categories;
    const filterBar = document.querySelector(".filter-bar");
    if (!filterBar) return;
    const activeFilter = filterBar.querySelector(".filter-btn.active")?.dataset.filter || "all";
    const allButton = filterBar.querySelector('.filter-btn[data-filter="all"]') || document.createElement("button");
    allButton.type = "button";
    allButton.className = "filter-btn";
    allButton.dataset.filter = "all";
    allButton.textContent = "All";
    filterBar.replaceChildren(allButton, ...categories.map(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-btn";
        button.dataset.filter = category.slug;
        button.textContent = category.label;
        return button;
    }));
    const activeButton = filterBar.querySelector(`.filter-btn[data-filter="${CSS.escape(activeFilter)}"]`) || allButton;
    activeButton.classList.add("active");
}

const catalogueLocalHost = /^(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i.test(window.location.hostname);
const catalogueHost = catalogueLocalHost
    ? `http://${window.location.hostname}:3000/v1`
    : "/api/v1";

window.MPWRCatalogueReady = fetch(`${catalogueHost}/products`, { credentials: "include" })
    .then(async response => {
        if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
        const rows = await response.json();
        const existingProducts = new Map(products.map(product => [String(product.id), product]));
        const liveProducts = (Array.isArray(rows) ? rows : []).map(apiProduct).map(product => {
            const existing = existingProducts.get(String(product.id));
            const cardCategory = document.querySelector(`.product-box[data-id="${CSS.escape(String(product.id))}"]`)?.dataset.category;
            return {
                ...(existing || {}),
                ...product,
                category: product.category || existing?.category || cardCategory || "products"
            };
        });

        // Once the API responds successfully it is the source of truth. This
        // removes deleted or unpublished legacy products instead of retaining
        // their hard-coded fallback cards.
        products.splice(0, products.length, ...liveProducts);

        syncCatalogueCards();
        return products;
    })
    .catch(error => {
        console.warn("Using the built-in catalogue because the live catalogue is unavailable.", error);
        syncCatalogueCards();
        return products;
    })
    .then(async catalogue => {
        let cachedAnnouncement = null;
        try {
            cachedAnnouncement = JSON.parse(localStorage.getItem("mpwrAnnouncementBar") || "null");
        } catch (_) {
            cachedAnnouncement = null;
        }
        applyAnnouncementBar(cachedAnnouncement || DEFAULT_ANNOUNCEMENT_BAR);

        let cachedHero = null;
        try {
            cachedHero = JSON.parse(localStorage.getItem("mpwrHomepageHero") || "null");
        } catch (_) {
            cachedHero = null;
        }
        applyHomepageHero(cachedHero || DEFAULT_HOMEPAGE_HERO);
        let cachedCampaign = null;
        try {
            cachedCampaign = JSON.parse(localStorage.getItem("mpwrCampaignBanner") || "null");
        } catch (_) {
            cachedCampaign = null;
        }
        const cachedDiscountEnabled = localStorage.getItem("mpwrDiscountSectionEnabled");
        const cachedDiscountSetting = cachedDiscountEnabled === null ? null : { enabled: cachedDiscountEnabled !== "false" };
        applyCampaignBanner(resolveCampaignBanner(cachedCampaign || DEFAULT_CAMPAIGN_BANNER, cachedDiscountSetting));
        let cachedCategories = null;
        try {
            cachedCategories = JSON.parse(localStorage.getItem("mpwrCategories") || "null");
        } catch (_) {
            cachedCategories = null;
        }
        applyCategoryOrder(cachedCategories || DEFAULT_CATALOGUE_CATEGORIES);

        let discounts = null;
        try {
            discounts = JSON.parse(localStorage.getItem("mpwrDiscountProducts") || "null");
        } catch (_) {
            discounts = null;
        }
        setMPWRDiscounts(discounts);

        try {
            const [, { doc, getDoc }] = await Promise.all([
                import("./firebase.js"),
                import("./firestore-api.js")
            ]);
            if (window.db) {
                const announcementSnapshot = await getDoc(doc(window.db, "storefront", "announcementBar"));
                const remoteAnnouncement = announcementSnapshot.data();
                if (remoteAnnouncement) {
                    applyAnnouncementBar(remoteAnnouncement);
                    localStorage.setItem("mpwrAnnouncementBar", JSON.stringify(normalizeAnnouncementBar(remoteAnnouncement)));
                }
                const heroSnapshot = await getDoc(doc(window.db, "storefront", "homepageHero"));
                const remoteHero = heroSnapshot.data();
                if (remoteHero) {
                    applyHomepageHero(remoteHero);
                    localStorage.setItem("mpwrHomepageHero", JSON.stringify(normalizeHomepageHero(remoteHero)));
                }
                const [campaignSnapshot, discountSnapshot] = await Promise.all([
                    getDoc(doc(window.db, "storefront", "campaignBanner")),
                    getDoc(doc(window.db, "storefront", "discounts"))
                ]);
                const remoteCampaign = campaignSnapshot.data();
                const remoteDiscountSetting = discountSnapshot.data();
                if (remoteCampaign) {
                    applyCampaignBanner(resolveCampaignBanner(remoteCampaign, remoteDiscountSetting));
                    localStorage.setItem("mpwrCampaignBanner", JSON.stringify(normalizeCampaignBanner(remoteCampaign)));
                }
                const categorySnapshot = await getDoc(doc(window.db, "storefront", "categories"));
                const remoteCategories = categorySnapshot.data()?.items;
                if (Array.isArray(remoteCategories)) {
                    const normalizedCategories = normalizeCatalogueCategories(remoteCategories);
                    applyCategoryOrder(normalizedCategories);
                    localStorage.setItem("mpwrCategories", JSON.stringify(normalizedCategories));
                }
                const remoteDiscounts = remoteDiscountSetting?.products;
                if (Array.isArray(remoteDiscounts)) {
                    setMPWRDiscounts(remoteDiscounts);
                    localStorage.setItem("mpwrDiscountProducts", JSON.stringify(remoteDiscounts));
                }
            }
        } catch (error) {
            console.warn("Using cached discount prices.", error);
        }

        syncCatalogueCards();
        return catalogue;
    });

// Keep an already-open storefront tab synchronized with catalogue changes made
// in MPWR Management. A reload also re-runs category and search rendering.
const reloadForCatalogueChange = () => window.location.reload();
window.addEventListener("storage", event => {
    if (event.key === "mpwrCatalogueRevision" && event.newValue) reloadForCatalogueChange();
});
if ("BroadcastChannel" in window) {
    const catalogueChannel = new BroadcastChannel("mpwr-catalogue");
    catalogueChannel.addEventListener("message", event => {
        if (event.data?.type === "catalogue-changed") reloadForCatalogueChange();
    });
}
