const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_ROOT = window.MPWR_API_URL || (localHost ? "http://127.0.0.1:3000/v1" : "/api/v1");

async function request(path, options = {}) {
    const response = await fetch(`${API_ROOT}${path}`, {
        method: options.method || "GET",
        credentials: "include",
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(payload?.message || `Authentication request failed (${response.status})`);
        error.code = response.status === 401 ? "auth/invalid-credential" : response.status === 409 ? "auth/email-already-in-use" : "auth/request-failed";
        throw error;
    }
    return payload;
}

function localUser(data, auth) {
    if (!data) return null;
    return {
        ...data,
        uid: data.uid || data.id,
        displayName: data.displayName || `${data.firstName || ""} ${data.lastName || ""}`.trim(),
        photoURL: data.photoURL || data.profileImage || null,
        async reload() { await auth.refresh(); },
        async getIdToken() { return "session-cookie"; }
    };
}

export function createAuth() {
    const auth = {
        currentUser: null,
        listeners: new Set(),
        ready: null,
        async refresh() {
            try { auth.currentUser = localUser(await request("/auth/me"), auth); }
            catch (error) { if (error.code === "auth/invalid-credential") auth.currentUser = null; else throw error; }
            return auth.currentUser;
        },
        notify() { auth.listeners.forEach(listener => listener(auth.currentUser)); }
    };
    auth.ready = auth.refresh();
    return auth;
}

async function applySession(auth, payload) {
    auth.currentUser = localUser(payload.user, auth);
    auth.notify();
    return { user: auth.currentUser, ...payload };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
    const firstName = email.split("@")[0] || "MPWR";
    return applySession(auth, await request("/auth/register", { method: "POST", body: { email, password, firstName, lastName: "Customer" } }));
}

export async function signInWithEmailAndPassword(auth, email, password) {
    return applySession(auth, await request("/auth/login", { method: "POST", body: { email, password } }));
}

export async function signOut(auth) {
    await request("/auth/logout", { method: "POST" });
    auth.currentUser = null;
    auth.notify();
}

export function onAuthStateChanged(auth, listener) {
    let active = true;
    auth.listeners.add(listener);
    auth.ready.then(() => { if (active) listener(auth.currentUser); });
    return () => { active = false; auth.listeners.delete(listener); };
}

export async function updateProfile(user, profile) {
    const names = String(profile.displayName || user.displayName || "").trim().split(/\s+/);
    const payload = await request("/auth/account", { method: "PATCH", body: { firstName: names[0] || "MPWR", lastName: names.slice(1).join(" ") || "Customer", ...(profile.photoURL !== undefined ? { profileImage: profile.photoURL || "" } : {}) } });
    return applySession(window.auth || window.adminAuth, payload);
}

export async function verifyBeforeUpdateEmail(user, email) {
    const auth = window.auth || window.adminAuth;
    const payload = await request("/auth/account", { method: "PATCH", body: { email } });
    await applySession(auth, payload);
    return request("/auth/email-verification/send", { method: "POST" });
}

export async function deleteUser() {
    await request("/auth/account", { method: "DELETE" });
    const auth = window.auth || window.adminAuth;
    auth.currentUser = null;
    auth.notify();
}

export function sendPasswordResetEmail(_auth, email) {
    return request("/auth/password-reset/request", { method: "POST", body: { email } });
}

export function confirmPasswordReset(token, password) {
    return request("/auth/password-reset/confirm", { method: "POST", body: { token, password } });
}

export function confirmEmailVerification(token) {
    return request("/auth/email-verification/confirm", { method: "POST", body: { token } });
}

export const browserSessionPersistence = { kind: "session" };
export async function setPersistence() {}
