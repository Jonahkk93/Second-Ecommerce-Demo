export const SHIPPING_CONFIG_VERSION = "jumia-ug-2026-08-27";

// Jumia Uganda's published Zone 1 departure rates, mapped to MPWR delivery bands.

export const UGANDA_DISTRICTS = [
    "Abim", "Adjumani", "Agago", "Alebtong", "Amolatar", "Amudat", "Amuria", "Amuru",
    "Apac", "Arua", "Budaka", "Bududa", "Bugiri", "Bugweri", "Buhweju", "Buikwe",
    "Bukedea", "Bukomansimbi", "Bukwo", "Bulambuli", "Buliisa", "Bundibugyo", "Bunyangabu",
    "Bushenyi", "Busia", "Butaleja", "Butambala", "Butebo", "Buvuma", "Buyende", "Dokolo",
    "Gomba", "Gulu", "Hoima", "Ibanda", "Iganga", "Isingiro", "Jinja", "Kaabong", "Kabale",
    "Kabarole", "Kaberamaido", "Kagadi", "Kakumiro", "Kalaki", "Kalangala", "Kaliro", "Kalungu",
    "Kampala", "Kamuli", "Kamwenge", "Kanungu", "Kapchorwa", "Kapelebyong", "Karenga", "Kasanda",
    "Kasese", "Katakwi", "Kayunga", "Kazo", "Kibaale", "Kiboga", "Kibuku", "Kikuube",
    "Kiruhura", "Kiryandongo", "Kisoro", "Kitagwenda", "Kitgum", "Koboko", "Kole", "Kotido",
    "Kumi", "Kwania", "Kween", "Kyankwanzi", "Kyegegwa", "Kyenjojo", "Kyotera", "Lamwo",
    "Lira", "Luuka", "Luwero", "Lwengo", "Lyantonde", "Madi-Okollo", "Manafwa", "Maracha",
    "Masaka", "Masindi", "Mayuge", "Mbale", "Mbarara", "Mitooma", "Mityana", "Moroto", "Moyo",
    "Mpigi", "Mubende", "Mukono", "Nabilatuk", "Nakapiripirit", "Nakaseke", "Nakasongola",
    "Namayingo", "Namisindwa", "Namutumba", "Napak", "Nebbi", "Ngora", "Ntoroko", "Ntungamo",
    "Nwoya", "Obongi", "Omoro", "Otuke", "Oyam", "Pader", "Pakwach", "Pallisa", "Rakai",
    "Rubanda", "Rubirizi", "Rukiga", "Rukungiri", "Rwampara", "Sembabule", "Serere", "Sheema",
    "Sironko", "Soroti", "Terego", "Tororo", "Wakiso", "Yumbe", "Zombo"
].sort((a, b) => a.localeCompare(b));

const REMOTE_DISTRICTS = new Set([
    "Abim", "Amudat", "Buvuma", "Kaabong", "Kalangala", "Karenga", "Kotido", "Moroto",
    "Nabilatuk", "Nakapiripirit", "Napak", "Obongi"
]);

const REGIONAL_CENTRES = new Set([
    "Arua", "Gulu", "Hoima", "Jinja", "Kabale", "Kabarole", "Lira", "Masaka", "Mbale",
    "Mbarara", "Soroti"
]);

export const DELIVERY_ZONES = [
    { id: "zone-1", name: "Zone 1 · Kampala", districts: new Set(["Kampala"]), fees: { small: 4000, medium: 8000, large: 17000 }, minDays: 1, maxDays: 2 },
    { id: "zone-2", name: "Zone 2 · Greater Kampala", districts: new Set(["Mukono", "Wakiso"]), fees: { small: 4800, medium: 9000, large: 17500 }, minDays: 2, maxDays: 3 },
    { id: "zone-3", name: "Zone 3 · Regional centre", districts: REGIONAL_CENTRES, fees: { small: 6000, medium: 11000, large: 20000 }, minDays: 3, maxDays: 4 },
    { id: "zone-5", name: "Zone 5 · Remote or island district", districts: REMOTE_DISTRICTS, fees: { small: 8000, medium: 12000, large: 26000 }, minDays: 4, maxDays: 5 },
    { id: "zone-4", name: "Zone 4 · Uganda national delivery", districts: null, fees: { small: 7500, medium: 11500, large: 23000 }, minDays: 4, maxDays: 5 }
];

const SHIPPING_CLASSES = new Set(["small", "medium", "large"]);

function normalizedShippingClass(value) {
    const shippingClass = String(value || "small").toLowerCase();
    return SHIPPING_CLASSES.has(shippingClass) ? shippingClass : "small";
}

function orderShippingClass(items = []) {
    const levels = ["small", "medium", "large"];
    return items.reduce((largest, item) => {
        const current = normalizedShippingClass(item.shippingClass);
        return levels.indexOf(current) > levels.indexOf(largest) ? current : largest;
    }, "small");
}

export function deliveryQuoteFor(district, items = []) {
    const normalizedDistrict = String(district || "").trim();
    if (!UGANDA_DISTRICTS.includes(normalizedDistrict)) return null;

    const zone = DELIVERY_ZONES.find(candidate =>
        candidate.districts?.has(normalizedDistrict)
    ) || DELIVERY_ZONES.find(candidate => candidate.id === "zone-4");
    const shippingClass = orderShippingClass(items);
    const baseFee = zone.fees.small;
    const fee = zone.fees[shippingClass];

    return {
        configVersion: SHIPPING_CONFIG_VERSION,
        country: "Uganda",
        district: normalizedDistrict,
        zoneId: zone.id,
        zoneName: zone.name,
        method: "standard-door",
        methodLabel: "Standard door delivery",
        shippingClass,
        baseFee,
        surcharge: fee - baseFee,
        fee,
        minDays: zone.minDays,
        maxDays: zone.maxDays,
        etaLabel: `${zone.minDays}-${zone.maxDays} business days`
    };
}

export function populateUgandaDistricts(select, selectedDistrict = "") {
    if (!select) return;
    const selected = String(selectedDistrict || "").trim();
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select district";
    placeholder.disabled = true;
    placeholder.selected = !selected;
    select.appendChild(placeholder);

    const districts = selected && !UGANDA_DISTRICTS.includes(selected)
        ? [...UGANDA_DISTRICTS, selected].sort((a, b) => a.localeCompare(b))
        : UGANDA_DISTRICTS;

    districts.forEach(district => {
        const option = document.createElement("option");
        option.value = district;
        option.textContent = district;
        option.selected = district === selected;
        select.appendChild(option);
    });
}
