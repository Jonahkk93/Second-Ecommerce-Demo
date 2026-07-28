import {
    collection,
    setDoc,
    doc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const db = window.db;

async function uploadProducts() {

    for (const product of products) {

        await setDoc(
            doc(collection(db, "products"), product.id.toString()),
            product
        );

        console.log(`Uploaded: ${product.title}`);

    }

    alert("All products uploaded successfully!");

}

uploadProducts();
