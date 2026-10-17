import { populateUgandaDistricts, deliveryQuoteFor } from "./shipping-config.js";

const estimator = document.querySelector("#delivery-estimator");
const district = document.querySelector("#info-district");
const result = document.querySelector("#info-delivery-result");
if (estimator && district && result) {
    populateUgandaDistricts(district);
    estimator.hidden = false;
    district.addEventListener("change", () => {
        const quote = deliveryQuoteFor(district.value);
        if (!quote) {
            result.textContent = "Choose a district to see the starting fee and estimated delivery time.";
            return;
        }
        const location = document.createElement("span");
        location.textContent = `Delivery to ${quote.district}`;
        const fee = document.createElement("strong");
        fee.textContent = `From USh${quote.fee.toLocaleString("en-UG")}`;
        const timing = document.createElement("span");
        timing.textContent = `Estimated ${quote.minDays}–${quote.maxDays} business days`;
        result.replaceChildren(location, fee, timing);
    });
}
