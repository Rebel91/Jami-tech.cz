const navToggle = document.querySelector("#nav-toggle");
const mainNav = document.querySelector("#main-nav");
if (navToggle && mainNav) {
  const closeMainNav = () => {
    mainNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Otevřít menu");
  };
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Zavřít menu" : "Otevřít menu");
  });
  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMainNav));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mainNav.classList.contains("is-open")) {
      closeMainNav();
      navToggle.focus();
    }
  });
}

function readCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem("jami-cart") || "[]");
    if (!Array.isArray(savedCart)) return [];
    return savedCart.flatMap((savedItem) => {
      const product = products.find((item) => item.id === savedItem.id)
        || products.find((item) => item.name === savedItem.name);
      const quantity = Number.isInteger(savedItem.qty) ? Math.max(0, savedItem.qty) : 1;
      return product ? Array(quantity).fill(product) : [];
    });
  } catch {
    return [];
  }
}

const cart = readCart();

const itemsContainer = document.querySelector("#checkout-items");
const emptyNotice = document.querySelector("#checkout-empty");
const checkoutLayout = document.querySelector("#checkout-layout");
const orderSuccess = document.querySelector("#order-success");
const orderForm = document.querySelector("#order-form");
const submitButton = document.querySelector("#send-order");
const addressField = document.querySelector("#order-address-field");
const paymentInfo = document.querySelector("#order-payment-info");
const checkoutTotal = document.querySelector("#checkout-total");
const checkoutDeliveryPrice = document.querySelector("#checkout-delivery-price");
const checkoutTotalPrice = document.querySelector("#checkout-total-price");
const deliveryPrices = { kuryr: 129, osobne: 0 };
const TERMS_VERSION = "v3.0";
const FORM_API_BASE_URL = window.JAMI_FORM_CONFIG?.apiBaseUrl?.replace(/\/$/, "") || "";
const orderTurnstile = window.JamiForms?.renderTurnstile("#order-turnstile", "order") ?? Promise.resolve(null);

function updateTotals() {
  if (!cart.length) { checkoutTotal.hidden = true; return; }
  const delivery = orderForm.delivery.value;
  const deliveryPrice = deliveryPrices[delivery] ?? 0;
  const productsTotalCents = cart.reduce((sum, product) => sum + product.priceCents, 0);
  checkoutTotal.hidden = false;
  checkoutDeliveryPrice.textContent = formatPrice(deliveryPrice * 100);
  checkoutTotalPrice.textContent = formatPrice(productsTotalCents + (deliveryPrice * 100));
}

function groupCart(items) {
  const groups = [];
  items.forEach((product) => {
    const existing = groups.find((group) => group.product.id === product.id);
    if (existing) existing.qty += 1;
    else groups.push({ product, qty: 1 });
  });
  return groups;
}

function saveCart() {
  const storedCart = groupCart(cart).map(({ product, qty }) => ({ id: product.id, qty }));
  localStorage.setItem("jami-cart", JSON.stringify(storedCart));
}

function renderSummary() {
  emptyNotice.hidden = cart.length > 0;
  orderForm.hidden = cart.length === 0;
  itemsContainer.innerHTML = groupCart(cart).map(({ product, qty }) => `<div class="cart-item"><div><strong>${product.name}</strong><span>${formatPrice(product.priceCents)}</span></div><div class="qty-control"><button class="qty-btn" data-qty-action="dec" data-cart-id="${product.id}" type="button" aria-label="Ubrat jeden kus produktu ${product.name}">−</button><input class="qty-input" type="number" min="0" value="${qty}" data-cart-id="${product.id}" aria-label="Množství produktu ${product.name}"><button class="qty-btn" data-qty-action="inc" data-cart-id="${product.id}" type="button" aria-label="Přidat jeden kus produktu ${product.name}">+</button></div><button class="remove-item" data-cart-id="${product.id}" type="button" aria-label="Odebrat ${product.name}">×</button></div>`).join("");
}

function setQuantity(id, qty) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  const remaining = cart.filter((item) => item.id !== id);
  cart.length = 0;
  cart.push(...remaining);
  for (let i = 0; i < qty; i += 1) cart.push(product);
  saveCart();
  renderSummary();
  updateTotals();
}

itemsContainer.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-item");
  const qtyButton = event.target.closest(".qty-btn");
  if (removeButton) {
    const id = removeButton.dataset.cartId;
    const remaining = cart.filter((product) => product.id !== id);
    cart.length = 0;
    cart.push(...remaining);
    saveCart();
    renderSummary();
    updateTotals();
  }
  if (qtyButton) {
    const id = qtyButton.dataset.cartId;
    const currentQty = cart.filter((product) => product.id === id).length;
    setQuantity(id, qtyButton.dataset.qtyAction === "inc" ? currentQty + 1 : currentQty - 1);
  }
});

itemsContainer.addEventListener("change", (event) => {
  const qtyInput = event.target.closest(".qty-input");
  if (!qtyInput) return;
  const qty = Math.max(0, Number(qtyInput.value) || 0);
  setQuantity(qtyInput.dataset.cartId, qty);
});

const paymentNotes = {
  prevod: "Po odeslání objednávky ti pošleme číslo účtu a částku k úhradě e-mailem.",
  qr: "QR platbu pro rychlé zaplacení ti zašleme e-mailem spolu s potvrzením objednávky.",
  dobirka: "Částku uhradíš v hotovosti nebo kartou kurýrovi při doručení.",
  hotove: "Částku uhradíš v hotovosti při osobním převzetí."
};
const deliveryLabels = { kuryr: "Kurýrem na adresu (129 Kč)", osobne: "Osobní odběr (0 Kč)" };
const paymentLabels = { prevod: "Bankovní převod", qr: "QR kód", dobirka: "Dobírka kurýrovi", hotove: "Hotově při osobním převzetí" };

function updatePaymentOptions() {
  const delivery = orderForm.delivery.value;
  addressField.hidden = delivery !== "kuryr";
  orderForm.querySelector('[name="address"]').required = delivery === "kuryr";
  orderForm.querySelectorAll("[data-payment]").forEach((label) => {
    const key = label.dataset.payment;
    const hide = (key === "dobirka" && delivery === "osobne") || (key === "hotove" && delivery !== "osobne");
    label.hidden = hide;
    if (hide && label.querySelector("input").checked) orderForm.querySelector('[data-payment="prevod"] input').checked = true;
  });
  updatePaymentNote();
  updateTotals();
}

function updatePaymentNote() {
  paymentInfo.textContent = paymentNotes[orderForm.payment.value] || "";
}

orderForm.addEventListener("change", (event) => {
  if (event.target.name === "delivery") updatePaymentOptions();
  if (event.target.name === "payment") updatePaymentNote();
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cart.length) return;
  if (!orderForm.reportValidity()) return;

  const delivery = orderForm.delivery.value;
  const payment = orderForm.payment.value;
  if (!FORM_API_BASE_URL || !window.JAMI_FORM_CONFIG?.turnstileSiteKey) {
    window.alert("Objednávkový formulář ještě není připojený k backendu.");
    return;
  }

  const originalBtnText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = "Odesílám objednávku...";

  try {
    const formData = new FormData(orderForm);
    formData.set("delivery", delivery);
    formData.set("payment", payment);
    formData.set("address", delivery === "kuryr" ? orderForm.address.value : "Osobní odběr");
    formData.set("cart", JSON.stringify(groupCart(cart).map(({ product, qty }) => ({ id: product.id, qty }))));
    formData.set("terms_version", TERMS_VERSION);

    const response = await fetch(`${FORM_API_BASE_URL}/order`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (response.status === 200 && result.success) {
      localStorage.removeItem("jami-cart");
      cart.length = 0;
      if (checkoutLayout) checkoutLayout.hidden = true;
      if (orderSuccess) {
        orderSuccess.hidden = false;
        const successText = orderSuccess.querySelector("p");
        if (successText) successText.textContent = `Objednávku evidujeme pod číslem ${result.reference}.`;
      }
      const confirmationMessage = result.confirmationSent
        ? `Děkujeme. Vaše objednávka ${result.reference} byla úspěšně přijata. Potvrzení s podrobnostmi jsme poslali na váš e-mail.`
        : `Vaše objednávka ${result.reference} byla přijata, ale potvrzovací e-mail se nepodařilo odeslat. Číslo si prosím poznamenejte. Objednávku znovu neodesílejte.`;
      window.JamiForms.showSuccess(
        result.confirmationSent ? "Objednávka byla odeslána" : "Objednávka byla přijata",
        confirmationMessage
      );
    } else {
      throw new Error(result.message || "Chyba při odesílání");
    }
  } catch (error) {
    console.error("Order submission failed", error);
    window.alert("Objednávku se nepodařilo automaticky odeslat. Zkuste to prosím znovu nebo nás kontaktujte na info@jami-tech.cz.");
    submitButton.disabled = false;
    submitButton.innerHTML = originalBtnText;
  } finally {
    orderTurnstile.then((widgetId) => window.JamiForms?.resetTurnstile(widgetId));
  }
});

renderSummary();
updatePaymentOptions();
