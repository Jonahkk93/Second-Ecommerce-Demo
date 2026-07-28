
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDGl6ypgbZORkxoHu9SmhWdgWQxEc8jK-o",
    authDomain: "mpwr5432.firebaseapp.com",
    projectId: "mpwr5432",
    storageBucket: "mpwr5432.firebasestorage.app",
    messagingSenderId: "256344192826",
    appId: "1:256344192826:web:2d0dd4d5f6287263fb4203",
    measurementId: "G-DQEKS4JTZ1"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);
const storage = getStorage(app);

window.auth = auth;

window.db = db;

window.storage = storage;


console.log("Firebase connected successfully!");