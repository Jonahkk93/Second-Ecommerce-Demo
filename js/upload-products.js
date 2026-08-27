import {
    collection,
    setDoc,
    doc
} from "./firestore-api.js";

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
