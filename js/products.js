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

window.normalizeMPWRImagePath = normalizeMPWRImagePath;
window.normalizeMPWRItems = normalizeMPWRItems;

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

const catalogueHost = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://127.0.0.1:3000/v1"
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
                const snapshot = await getDoc(doc(window.db, "storefront", "discounts"));
                const remoteDiscounts = snapshot.data()?.products;
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
