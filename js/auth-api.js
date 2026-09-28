const localHost = /^(?:localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i.test(window.location.hostname);
const LOCAL_API_ROOT = localHost ? `http://${window.location.hostname === "0.0.0.0" ? "127.0.0.1" : window.location.hostname}:3000/v1` : "";
const API_ROOT = window.MPWR_API_URL || LOCAL_API_ROOT || "/api/v1";

async function request(path, options = {}) {
    let response;
    try {
        response = await fetch(`${API_ROOT}${path}`, {
            method: options.method || "GET",
            credentials: "include",
            headers: options.body ? { "Content-Type": "application/json" } : undefined,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        if (response.status === 404 && LOCAL_API_ROOT && API_ROOT !== LOCAL_API_ROOT) {
            response = await fetch(`${LOCAL_API_ROOT}${path}`, {
                method: options.method || "GET",
                credentials: "include",
                headers: options.body ? { "Content-Type": "application/json" } : undefined,
                body: options.body ? JSON.stringify(options.body) : undefined
            });
        }
    } catch (cause) {
        const error = new Error(localHost
            ? "The sign-in service is not running. Start the MPWR API and try again."
            : "The sign-in service is temporarily unavailable. Please try again.");
        error.code = "auth/network-request-failed";
        error.cause = cause;
        throw error;
    }
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(payload?.message || `Authentication request failed (${response.status})`);
        error.code = response.status === 401
            ? "auth/invalid-credential"
            : response.status === 403 && /blocked/i.test(error.message)
                ? "auth/account-blocked"
                : response.status === 409
                    ? "auth/email-already-in-use"
                    : "auth/request-failed";
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
        revision: 0,
        ready: null,
        async refresh() {
            const startingRevision = auth.revision;
            let refreshedUser = null;
            let blocked = false;
            try { refreshedUser = localUser(await request("/auth/me"), auth); }
            catch (error) {
                blocked = error.code === "auth/account-blocked";
                if (error.code === "auth/network-request-failed") return auth.currentUser;
                if (!blocked && error.code !== "auth/invalid-credential") throw error;
            }
            // A login/register may finish while the initial session check is in
            // flight. Never let that older response erase the new account.
            if (startingRevision === auth.revision) {
                const previousUser = auth.currentUser;
                auth.currentUser = refreshedUser;
                if (previousUser && !refreshedUser) {
                    auth.revision += 1;
                    auth.notify();
                    if (blocked) window.dispatchEvent(new CustomEvent("mpwr:account-blocked", { detail: { message: "This account has been blocked. Contact MPWR support if you think this is a mistake." } }));
                }
            }
            if (blocked) request("/auth/logout", { method: "POST" }).catch(() => {});
            return auth.currentUser;
        },
        notify() { auth.listeners.forEach(listener => listener(auth.currentUser)); }
    };
    auth.ready = auth.refresh();
    return auth;
}

export function startSessionMonitor(auth, intervalMs = 2000) {
    let checking = false;
    const check = async () => {
        if (checking || !auth.currentUser || document.visibilityState === "hidden") return;
        checking = true;
        try { await auth.refresh(); }
        catch (error) {
            if (error.code !== "auth/network-request-failed") console.warn("Unable to verify the active session:", error);
        } finally { checking = false; }
    };
    const timer = window.setInterval(check, intervalMs);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    return () => {
        window.clearInterval(timer);
        window.removeEventListener("focus", check);
    };
}

async function applySession(auth, payload) {
    auth.revision += 1;
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
    auth.revision += 1;
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
