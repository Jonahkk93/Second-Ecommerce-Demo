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
    product.image = optimizedProductImage(product.image);
    product.gallery = (product.gallery || []).map(optimizedProductImage);
    if (product.galleries) product.galleries = optimizeGalleryMap(product.galleries);
    if (product.sizeGalleries) product.sizeGalleries = optimizeGalleryMap(product.sizeGalleries);
    Object.values(product.variants || {}).forEach(variant => {
        variant.images = (variant.images || []).map(optimizedProductImage);
    });
});

window.products = products;

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
    return items.map(item => ({
        ...item,
        image: normalizeMPWRImagePath(item.image, item.id)
    }));
}

window.normalizeMPWRImagePath = normalizeMPWRImagePath;
window.normalizeMPWRItems = normalizeMPWRItems;
