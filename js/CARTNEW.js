const cartIcon = document.querySelector("#cart-icon");
const cart = document.querySelector (".cart"); 
const cartClose = document.querySelector("#cart-close");
const toast = document.querySelector(".toast");
const searchIcon = document.querySelector("#search-icon");
const searchBar = document.querySelector(".search-bar");
const searchInput = document.querySelector("#search-input");
const noResults = document.querySelector(".no-results");

function showToast(message, type = "success") {

    toast.textContent = message;

    toast.className = "toast";

    toast.classList.add(type);

    toast.classList.add("show");

    clearTimeout(toast.timeout);

    toast.timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);

}
cartIcon.addEventListener("click", () => cart.classList.add("active"));
cartClose.addEventListener("click", () => cart.classList.remove("active"));

const addCartButtons = document.querySelectorAll (".addie");
addCartButtons.forEach(button => {
    button.addEventListener("click", event => {
        const productBox = event.target.closest(".product-box");
        addToCart(productBox);
    });

});
const cartContent = document.querySelector(".cart-content");
const continueShopping = document.querySelector(".continue-shopping");
const cartEmpty = document.querySelector(".cart-empty");
const totalSection = document.querySelector(".total");
const checkoutButton = document.querySelector(".btn-buy");

let cartItems = [];
const addToCart = productBox => {
    const productImgSrc = productBox.querySelector(".img-box img").src;
    const productTitle = productBox.querySelector(".product-title").textContent;
    const productPrice = productBox.querySelector(".price").textContent;

    cartItems.push({
    title: productTitle,
    price: productPrice,
    image: productImgSrc,
    quantity: 1
});
    

    //ITEM IS ALREADY IN CART MESSAGE
const existingItems = cartContent.querySelectorAll(".cart-product-title");
for (let item of existingItems) {
    if (item.textContent === productTitle) {
        showToast("This item is already in the cart⚠️", "warning");
        return;
    }
}
const productImage = productBox.querySelector(".img-box img");
    const cartRect = cartIcon.getBoundingClientRect();
    const imageRect = productImage.getBoundingClientRect();

    const flyingImage = productImage.cloneNode(true);

    flyingImage.classList.add("flying-image");

    flyingImage.style.left = imageRect.left + "px";
    flyingImage.style.top = imageRect.top + "px";

    document.body.appendChild(flyingImage);

    const cartBox = document.createElement("div");
    cartBox.classList.add("cart-box");
    cartBox.innerHTML = `
        <img src="${productImgSrc}" class="cart-img">
        <div class="cart-detail">
            <h2 class="cart-product-title">${productTitle}</h2>
            <span class="cart-price">${productPrice}</span>
            <div class="cart-quantity">
                <button id="decrement">-</button>
                <span class="number">1</span>
                <button id="increment">+</button>
            </div>
        </div>
        <i><img src="images/trashbin.png" id="cart-remove"></i>
    `;

    cartContent.appendChild(cartBox);
    requestAnimationFrame(() =>{

    flyingImage.style.left = cartRect.left + "px";
    flyingImage.style.top = cartRect.top + "px";

    flyingImage.style.width = "20px";
    flyingImage.style.height = "20px";

    flyingImage.style.opacity = "0";

});

setTimeout(() =>{

    flyingImage.remove();

},650);

    cartBox.querySelector("#cart-remove").addEventListener("click", () => {

    cartBox.remove();

    updateCartCount(-1);

    updateTotalPrice();

    updateCartUI();

});

    //PLUS AND MINUS 
    cartBox.querySelector(".cart-quantity").addEventListener("click", event => {
        const numberElement = cartBox.querySelector(".number");
        const decrementButton = cartBox.querySelector("#decrement");
        let quantity = numberElement.textContent;

        if (event.target.id === "decrement" && quantity > 1) {
            quantity--;
            if (quantity === 1) {
                decrementButton.style.color = "#999";
            }
        } else if (event.target.id === "increment") {
            quantity++;
            decrementButton.style.color = "#333";
        }
        numberElement.textContent = quantity;

        updateTotalPrice();

    });
    updateCartCount(1);

cartIcon.classList.add("cart-bounce");

setTimeout(() => {
    cartIcon.classList.remove("cart-bounce");
}, 450);

updateTotalPrice();

updateCartUI();

};

//TOTAL PRICE
const updateTotalPrice = () => {
    const totalPriceElement = document.querySelector(".total-price");
    const cartBoxes = cartContent.querySelectorAll(".cart-box");
    let total = 0;
    cartBoxes.forEach(cartBox => {
        const priceElement = cartBox.querySelector(".cart-price");
        const qualityElement = cartBox.querySelector(".number");
        const price = priceElement.textContent.replace("UGX","");
        const quantity = qualityElement.textContent;
        total += price * quantity;
    });
    totalPriceElement.textContent = `UGX ${total}`;
};

//NUMBER ON CART IN NAVBAR
let cartItemCount = 0;
const updateCartCount = change => {
    const cartItemCountBadge = document.querySelector(".cart-item-count");
    cartItemCount += change;
    if (cartItemCount > 0) {
        cartItemCountBadge.style.visibility = "visible";
        cartItemCountBadge.textContent = cartItemCount;
        cartItemCountBadge.classList.remove("badge-pop");
        void cartItemCountBadge.offsetWidth;
        cartItemCountBadge.classList.add("badge-pop");
    } else {
        cartItemCountBadge.style.visibility = "hidden";
        cartItemCountBadge.textContent = "";
    }
};

//BUY BUTTON
const buyNowButton = document.querySelector(".btn-buy");
buyNowButton.addEventListener("click", () => {
    const cartBoxes = cartContent.querySelectorAll(".cart-box");
    if (cartBoxes.length === 0) {
        showToast("Your cart is empty. Please add items to your cart🛒.", "warning");
        return;
    }

    cartBoxes.forEach(cartBox => cartBox.remove());

    cartItemCount = 0;
    updateCartCount(0);

    updateTotalPrice();

    updateCartUI();

    showToast("Thank you for Ordering❤️", "success")
});


const updateCartUI = () => {

    const cartBoxes = cartContent.querySelectorAll(".cart-box");

    if(cartBoxes.length === 0){
        cartEmpty.style.display = "flex";
        totalSection.style.display = "none";
        checkoutButton.style.display = "none";

    }else{

        cartEmpty.style.display = "none";
        totalSection.style.display = "flex";
        checkoutButton.style.display = "block";

    }

};
continueShopping.addEventListener("click", () => {
    cart.classList.remove("active");

    document.querySelector(".products").scrollIntoView({
        behavior: "smooth"
    });
});
updateCartUI();
searchIcon.addEventListener("click", () => {

    searchBar.classList.toggle("active");

    if (searchBar.classList.contains("active")) {
        searchInput.focus();
    }

});
searchInput.addEventListener("input", () => {

    const searchValue = searchInput.value.toLowerCase();

    const products = document.querySelectorAll(".product-box");
    let matches = 0;

 products.forEach(product => {

    const title = product
        .querySelector(".product-title")
        .textContent
        .toLowerCase();

   if (title.includes(searchValue)) {
    product.style.display = "";
    matches++;

} else {
    product.style.display = "none";
}
    
});

if (matches === 0) {
    noResults.style.display = "block";
}
else {
    noResults.style.display = "none";
}
});


