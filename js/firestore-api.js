const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_ROOT = window.MPWR_API_URL || (localHost ? "http://127.0.0.1:3000/v1" : "/api/v1");
let sessionUid = null;

class ApiTimestamp {
    constructor(value) { this.value = value; }
    toDate() { return new Date(this.value); }
}

function hydrate(value, key = "") {
    if (Array.isArray(value)) return value.map(item => hydrate(item));
    if (!value || typeof value !== "object") {
        if (typeof value === "string" && /At$/.test(key) && !Number.isNaN(Date.parse(value))) return new ApiTimestamp(value);
        return value;
    }
    return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, hydrate(entry, entryKey)]));
}

async function ensureSession(db) {
    const auth = db?.auth || window.auth;
    await auth?.ready;
    const user = auth?.currentUser;
    if (!user) throw new Error("Sign in required");
    if (sessionUid === user.uid) return;
    sessionUid = user.uid;
}

async function request(path, options = {}) {
    if (!options.skipSession && options.auth !== false) await ensureSession(options.db);
    const response = await fetch(`${API_ROOT}${path}`, {
        method: options.method || "GET",
        credentials: "include",
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `API request failed (${response.status})`);
    return hydrate(payload);
}

export function collection(db, name) { return { kind: "collection", db, name, constraints: [] }; }
export function doc(first, second, third) {
    if (first?.kind === "collection") return { kind: "document", db: first.db, name: first.name, id: second || crypto.randomUUID() };
    return { kind: "document", db: first, name: second, id: third };
}
export function where(field, operator, value) { return { kind: "where", field, operator, value }; }
export function orderBy(field, direction = "asc") { return { kind: "orderBy", field, direction }; }
export function query(reference, ...constraints) { return { ...reference, constraints }; }
export function serverTimestamp() { return new Date().toISOString(); }

function snapshot(id, data) {
    return { id, exists: () => data !== null && data !== undefined, data: () => data };
}

function constraint(reference, field) { return reference.constraints?.find(item => item.kind === "where" && item.field === field); }

function normalizeRow(collectionName, row) {
    if (collectionName === "products") return { ...row, id: row.legacyId || row.id, image: row.imageUrl || row.image, shippingClass: row.class || row.shippingClass, ...(row.metadata || {}) };
    if (collectionName === "orders") { const status = String(row.status || "pending"); return { ...row, status: status.charAt(0).toUpperCase() + status.slice(1), payment: row.delivery?.payment || row.payment || { status: "Pending" } }; }
    return row;
}

export async function getDoc(reference) {
    let data = null;
    if (reference.name === "users") data = reference.db?.kind === "admin" ? await request(`/admin/users/${encodeURIComponent(reference.id)}`, { db: reference.db }) : await request("/profile", { db: reference.db });
    if (reference.name === "carts") data = await request("/cart", { db: reference.db });
    if (reference.name === "favorites") data = await request("/favorites", { db: reference.db });
    if (reference.name === "reviews") { const uid = (reference.db?.auth || window.auth)?.currentUser?.uid || ""; const productId = reference.id.startsWith(`${uid}_`) ? reference.id.slice(uid.length + 1) : reference.id; data = await request(`/reviews/mine/${encodeURIComponent(productId)}`, { db: reference.db }); }
    if (reference.name === "storefront") data = await request(`/storefront/${encodeURIComponent(reference.id)}`, { auth: false });
    if (reference.name === "products") data = await request(`/products/${encodeURIComponent(reference.id)}`, { auth: false });
    return snapshot(reference.id, data);
}

export async function getDocs(reference) {
    let rows = [];
    if (reference.name === "reviews") { const product = constraint(reference, "productId"); const user = constraint(reference, "userId"); rows = product ? await request(`/reviews?productId=${encodeURIComponent(product.value)}`, { auth: false }) : user ? await request("/reviews/mine", { db: reference.db }) : []; }
    if (reference.name === "orders") rows = reference.db?.kind === "admin" ? await request("/orders/admin/all", { db: reference.db }) : await request("/orders", { db: reference.db });
    if (reference.name === "products") rows = reference.db?.kind === "admin" ? await request("/admin/products", { db: reference.db }) : await request("/products", { auth: false });
    const docs = rows.map(row => { const normalized = normalizeRow(reference.name, row); return snapshot(normalized.legacyId || normalized.id, normalized); });
    return { docs, empty: docs.length === 0, size: docs.length, forEach(callback) { docs.forEach(callback); } };
}

export async function setDoc(reference, data) {
    if (reference.name === "carts") return request("/cart", { method: "PUT", body: { items: data.items || [] }, db: reference.db });
    if (reference.name === "favorites") return request("/favorites", { method: "PUT", body: { items: data.items || [] }, db: reference.db });
    if (reference.name === "users") { const body = Object.fromEntries(["firstName", "lastName", "phone", "profileImage", "shippingAddresses", "paymentMethods"].filter(key => data[key] !== undefined).map(key => [key, data[key]])); return request("/profile", { method: "PATCH", body, db: reference.db }); }
    if (reference.name === "reviews") { const uid = (reference.db?.auth || window.auth)?.currentUser?.uid || ""; const productId = reference.id.startsWith(`${uid}_`) ? reference.id.slice(uid.length + 1) : data.productId; if (data.rating === undefined || data.text === undefined) return request(`/reviews/${encodeURIComponent(productId)}/attachment`, { method: "PATCH", body: { attachment: data.attachment }, db: reference.db }); return request(`/reviews/${encodeURIComponent(productId)}`, { method: "PUT", body: { rating: Number(data.rating), text: data.text, customerName: data.customerName, purchasedOptions: data.purchasedOptions || {}, ...(data.attachment ? { attachment: data.attachment } : {}) }, db: reference.db }); }
    if (reference.name === "storefront") { const value = { ...data }; delete value.updatedAt; return request(`/storefront/${encodeURIComponent(reference.id)}`, { method: "PUT", body: { value }, db: reference.db }); }
    if (reference.name === "products") return request("/admin/products", { method: "POST", body: normalizeProduct(data, reference.id), db: reference.db });
}

function normalizeProduct(data, legacyId) {
    const title = String(data.title || "Product");
    return { legacyId: String(legacyId || data.id || Date.now()), title, slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${legacyId || Date.now()}`, description: data.description || "", price: Number(data.price) || 0, imageUrl: data.image || data.imageUrl || "", shippingClass: data.shippingClass || "small", metadata: { colors: data.colors || [], sizes: data.sizes || [] } };
}

export async function addDoc(reference, data) {
    if (reference.name === "orders") { const order = await request("/orders/legacy", { method: "POST", body: { items: data.items || [], customer: data.customer || {}, delivery: data.delivery || {}, payment: data.payment || {}, deliveryFee: Number(data.deliveryFee) || 0 }, db: reference.db }); return { id: order.id }; }
    if (reference.name === "products") { const product = await request("/admin/products", { method: "POST", body: normalizeProduct(data), db: reference.db }); return { id: product.id }; }
    throw new Error(`Unsupported add operation for ${reference.name}`);
}

export async function updateDoc(reference, data) {
    if (reference.name === "orders") return request(`/orders/${encodeURIComponent(reference.id)}/status`, { method: "PATCH", body: { status: String(data.status || "pending").toLowerCase() }, db: reference.db });
    if (reference.name === "users") return setDoc(reference, data);
    throw new Error(`Unsupported update operation for ${reference.name}`);
}

export async function deleteDoc() { throw new Error("Delete is not available through the Firestore compatibility layer"); }
