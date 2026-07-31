import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getAuth,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDGl6ypgbZORkxoHu9SmhWdgWQxEc8jK-o",
    authDomain: "mpwr5432.firebaseapp.com",
    projectId: "mpwr5432",
    storageBucket: "mpwr5432.firebasestorage.app",
    messagingSenderId: "256344192826",
    appId: "1:256344192826:web:2d0dd4d5f6287263fb4203",
    measurementId: "G-DQEKS4JTZ1"
};

// A named Firebase app keeps admin authentication separate from storefront auth.
const adminApp = initializeApp(firebaseConfig, "admin");
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);
const adminStorage = getStorage(adminApp);

await setPersistence(adminAuth, browserSessionPersistence);

export { adminAuth, adminDb, adminStorage };
