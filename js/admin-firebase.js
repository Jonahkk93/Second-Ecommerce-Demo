import {
    setPersistence,
    browserSessionPersistence
} from "./auth-api.js";
import { createAuth } from "./auth-api.js";
const adminAuth = createAuth();
const adminDb = { kind: "admin", auth: adminAuth };

await setPersistence(adminAuth, browserSessionPersistence);

window.adminAuth = adminAuth;

export { adminAuth, adminDb };
