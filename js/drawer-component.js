export function mountMPWRDrawers(target = document.body) {
    if (target.querySelector(":scope > .cart") || target.querySelector(":scope > .wishlist")) return;
    target.insertAdjacentHTML("beforeend", `
        <div class="cart">
            <h2 class="cart-title">My Cart <span class="cart-title-count" aria-live="polite">(0)</span></h2>
            <div class="cart-content"></div>
            <div class="cart-empty">
                <img src="images/Cart black.png" class="empty-cart-icon" alt="">
                <h3>Your cart is empty</h3>
                <p>Add your favorite products to get started.</p>
                <button class="continue-shopping" type="button">Continue Shopping</button>
            </div>
            <div class="total"><div class="total-title">Total</div><div class="total-price">UGX 0</div></div>
            <button class="btn-buy" type="button">Check Out</button><br><br>
            <div class="cart-header-actions">
                <button class="cart-menu-toggle" type="button" aria-label="Cart options" aria-expanded="false" aria-controls="cart-actions-menu"><img src="images/Icon Folder/3 Dots Icon_Black.PNG" alt=""></button>
                <div class="cart-actions-menu" id="cart-actions-menu" role="menu" hidden>
                    <button class="cart-delete-all" type="button" role="menuitem">Delete all</button>
                    <button class="cart-share-all" type="button" role="menuitem">Share Cart</button>
                </div>
                <button class="cart-close-button" type="button" aria-label="Close cart"><img src="images/Icon Folder/Close Icon_333.PNG" class="ri-close-line" id="cart-close" alt=""></button>
            </div>
        </div>
        <div class="wishlist">
            <h2 class="wishlist-title">My Wishlist</h2>
            <img src="images/Icon Folder/Close Icon_333.PNG" id="wishlist-close" alt="Close wishlist">
            <div class="wishlist-content"></div>
            <div class="wishlist-empty">
                <img src="images/BlackHeart.PNG" class="wishlist-empty-icon" alt="">
                <h3>Your Wishlist is empty</h3>
                <p>Save products you love and they'll appear here.</p>
                <button class="wishlist-continue" type="button">Continue Shopping</button>
            </div>
            <div class="wishlist-footer">
                <button class="clear-wishlist" type="button"><img src="images/Icon Folder/Delete Icon_333.PNG" class="clear-wishlist-icon" alt=""><span>Clear Wishlist</span></button>
            </div>
        </div>`);

    if (!document.querySelector(".confirm-overlay")) {
        target.insertAdjacentHTML("beforeend", `
            <div class="confirm-overlay wishlist-clear-confirm-overlay"><div class="confirm-box"><img src="images/trashbin.png" class="confirm-icon" alt=""><h2>Clear Wishlist</h2><p>This will remove all saved products from your Wishlist.</p><div class="confirm-buttons"><button class="confirm-cancel" type="button">Cancel</button><button class="confirm-clear" type="button">Clear Wishlist</button></div></div></div>
            <div class="confirm-overlay move-wishlist-confirm-overlay"><div class="confirm-box"><h2>Move to Wishlist</h2><p>Are you sure you want to move this item from your cart to your Wishlist?</p><div class="confirm-buttons"><button class="confirm-cancel move-wishlist-cancel" type="button">Cancel</button><button class="confirm-clear move-wishlist-confirm" type="button">Move to Wishlist</button></div></div></div>
            <div class="confirm-overlay delete-item-confirm-overlay"><div class="confirm-box"><h2>Delete Item</h2><p class="delete-item-confirm-message">Are you sure you want to delete this item?</p><div class="confirm-buttons"><button class="confirm-cancel delete-item-cancel" type="button">Cancel</button><button class="confirm-clear delete-item-confirm" type="button">Delete Item</button></div></div></div>`);
    }
    if (!document.querySelector(".toast")) target.insertAdjacentHTML("beforeend",'<div class="toast"></div>');
}
