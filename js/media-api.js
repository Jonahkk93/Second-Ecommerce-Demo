const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_ROOT = window.MPWR_API_URL || (localHost ? "http://127.0.0.1:3000/v1" : "/api/v1");

export async function uploadImage(file, purpose) {
    const form = new FormData();
    form.append("file", file, file.name);
    const response = await fetch(`${API_ROOT}/media/uploads/${encodeURIComponent(purpose)}`, { method: "POST", credentials: "include", body: form });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Image upload failed (${response.status})`);
    return payload;
}

export async function deleteImage(key) {
    const response = await fetch(`${API_ROOT}/media`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.message || "Image removal failed"); }
}
