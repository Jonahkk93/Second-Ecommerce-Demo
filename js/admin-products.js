
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const auth = window.auth;
const db = window.db;
const storage = window.storage;
const toast = document.querySelector(".admin-products-toast");
let toastTimer;

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "admin-login.html";
        return;
    }

    const userDoc = await getDoc(
        doc(db, "users", user.uid)
    );

    if (!userDoc.exists()) {
        window.location.href = "admin-login.html";
        return;
    }

    const userData = userDoc.data();

    if (userData.role !== "admin") {
        window.location.href = "admin-login.html";
        return;
    }

    const productsContainer = document.querySelector(".products-list");

    async function loadProducts() {

    const snapshot = await getDocs(
        collection(db, "products")
    );

    const products = [];

    snapshot.forEach(doc => {

        products.push({
            id: doc.id,
            ...doc.data()
        });

    });

    return products;

}

function renderProducts(products) {

    productsContainer.innerHTML = "";

    products.forEach(product => {

        productsContainer.innerHTML += `
            <div class="product-card">

                <img src="${product.image}" alt="${product.title}">

                <div class="product-card-body">

                    <div class="product-card-title">
                        ${product.title}
                    </div>

                    <div class="product-card-price">
                        UGX ${Number(product.price).toLocaleString()}
                    </div>

                    <div class="product-card-actions">

                        <button class="edit-product">
                            Edit
                        </button>

                        <button class="delete-product">
                            Delete
                        </button>

                    </div>

                </div>

            </div>
        `;

    });

}

let products = await loadProducts();
renderProducts(products);
const productSearch = document.querySelector("#product-search");

productSearch?.addEventListener("input", () => {
    const query = productSearch.value.trim().toLowerCase();
    renderProducts(products.filter(product =>
        String(product.title || "").toLowerCase().includes(query)
    ));
});
const modal = document.querySelector(".product-modal");

const addProductBtn = document.querySelector("#add-product-btn");

const closeModal = document.querySelector(".close-modal");

const productForm = document.querySelector("#product-form");

addProductBtn.addEventListener("click", () => {

    modal.classList.remove("hidden");

});

closeModal.addEventListener("click", () => {

    modal.classList.add("hidden");

});

modal.addEventListener("click", e => {

    if(e.target === modal){

        modal.classList.add("hidden");

    }

});

productForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const title = document.querySelector("#product-title").value.trim();

    const price = document.querySelector("#product-price").value.trim();

    const description = document.querySelector("#product-description").value.trim();

const imageFile = document.querySelector("#product-image").files[0];

if (!imageFile) {
    showToast("Please select an image.");
    return;
}

const imageRef = ref(
    storage,
    `products/${Date.now()}-${imageFile.name}`
);

await uploadBytes(imageRef, imageFile);

const image = await getDownloadURL(imageRef);

    await addDoc(collection(db, "products"), {

        title,

        price: Number(price),

        description,

        image,

        colors: [],

        sizes: []

    });
    

    showToast("Product added successfully!");

    modal.classList.add("hidden");

    productForm.reset();

    products = await loadProducts();

    renderProducts(products);

});
});
