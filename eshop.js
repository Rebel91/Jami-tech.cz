const navToggle = document.querySelector("#nav-toggle");
const mainNav = document.querySelector("#main-nav");
if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    mainNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }));
}

const categoryLabels = CATEGORIES;

function readCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem("jami-cart") || "[]");
    return Array.isArray(savedCart) ? savedCart : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  try { localStorage.setItem("jami-cart", JSON.stringify(cart)); } catch { /* Košík zůstane jen v paměti. */ }
}

const state = { category: "all", cart: readCart() };
const productGrid = document.querySelector("#shop-product-grid");
const emptyProducts = document.querySelector("#empty-products");
const filterButtons = document.querySelectorAll(".filter-button");

function renderProducts() {
  const visibleProducts = products.filter((product) => state.category === "all" || product.category === state.category);
  emptyProducts.hidden = visibleProducts.length > 0;
  productGrid.innerHTML = visibleProducts.map((product) => {
    const index = products.indexOf(product);
    return `<article class="product-card"><div class="product-image"><img src="${product.image}" alt="${product.name}"><span class="product-image-fallback" hidden>Obrázek produktu není dostupný.</span></div><div class="product-info"><p class="product-category">${categoryLabels[product.category]}</p><h3>${product.name}</h3><p>${product.description}</p><div class="product-meta"><span class="product-price">${product.price}</span><button class="add-to-cart" data-index="${index}" type="button">PŘIDAT</button></div></div></article>`;
  }).join("");
  productGrid.querySelectorAll(".product-image img").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    });
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.category = button.dataset.filter;
    filterButtons.forEach((filter) => filter.classList.toggle("is-active", filter === button));
    renderProducts();
  });
});

function groupCart(items) {
  const groups = [];
  items.forEach((product) => {
    const existing = groups.find((group) => group.product.name === product.name);
    if (existing) existing.qty += 1;
    else groups.push({ product, qty: 1 });
  });
  return groups;
}

function renderCart() {
  saveCart(state.cart);
  const count = document.querySelector("#cart-count");
  const items = document.querySelector("#cart-items");
  count.textContent = state.cart.length;
  if (!state.cart.length) {
    items.innerHTML = '<p class="cart-empty">Košík je zatím prázdný.</p>';
    return;
  }
  items.innerHTML = groupCart(state.cart).map(({ product, qty }) => `<div class="cart-item"><div><strong>${product.name}</strong><span>${product.price}</span></div><div class="qty-control"><button class="qty-btn" data-qty-action="dec" data-cart-name="${product.name}" type="button" aria-label="Uběrat kus">−</button><input class="qty-input" type="number" min="0" value="${qty}" data-cart-name="${product.name}"><button class="qty-btn" data-qty-action="inc" data-cart-name="${product.name}" type="button" aria-label="Přidat kus">+</button></div><button class="remove-item" data-cart-name="${product.name}" type="button" aria-label="Odebrat ${product.name}">×</button></div>`).join("");
}

function setQuantity(name, qty) {
  const product = state.cart.find((item) => item.name === name) || products.find((item) => item.name === name);
  state.cart = state.cart.filter((item) => item.name !== name);
  for (let i = 0; i < qty; i += 1) state.cart.push(product);
  renderCart();
}

function setDrawer(open) {
  document.querySelector("#cart-drawer").classList.toggle("is-open", open);
  document.querySelector("#drawer-backdrop").classList.toggle("is-visible", open);
  document.querySelector("#cart-drawer").setAttribute("aria-hidden", String(!open));
  document.querySelector("#cart-toggle").setAttribute("aria-expanded", String(open));
}

document.addEventListener("click", (event) => {
  const productImage = event.target.closest(".product-image img");
  const addButton = event.target.closest(".add-to-cart");
  const removeButton = event.target.closest(".remove-item");
  const qtyButton = event.target.closest(".qty-btn");
  if (productImage) {
    const overlay = document.createElement("div");
    overlay.className = "image-lightbox";
    overlay.innerHTML = `<button class="image-lightbox-close" type="button" aria-label="Zavřít náhled">×</button><img src="${productImage.src}" alt="${productImage.alt}">`;
    document.body.append(overlay);
    document.body.classList.add("lightbox-open");

    const closeLightbox = () => {
      overlay.remove();
      document.body.classList.remove("lightbox-open");
      document.removeEventListener("keydown", handleKeydown);
    };
    const handleKeydown = (keyboardEvent) => {
      if (keyboardEvent.key === "Escape") closeLightbox();
    };

    overlay.addEventListener("click", (overlayEvent) => {
      if (overlayEvent.target === overlay || overlayEvent.target.closest(".image-lightbox-close")) closeLightbox();
    });
    document.addEventListener("keydown", handleKeydown);
  }
  if (addButton) { state.cart.push(products[Number(addButton.dataset.index)]); renderCart(); setDrawer(true); }
  if (removeButton) { state.cart = state.cart.filter((product) => product.name !== removeButton.dataset.cartName); renderCart(); }
  if (qtyButton) {
    const name = qtyButton.dataset.cartName;
    const currentQty = state.cart.filter((product) => product.name === name).length;
    setQuantity(name, qtyButton.dataset.qtyAction === "inc" ? currentQty + 1 : currentQty - 1);
  }
});

document.addEventListener("change", (event) => {
  const qtyInput = event.target.closest(".qty-input");
  if (!qtyInput) return;
  const qty = Math.max(0, Number(qtyInput.value) || 0);
  setQuantity(qtyInput.dataset.cartName, qty);
});

document.querySelector("#cart-toggle").addEventListener("click", () => setDrawer(true));
document.querySelector("#cart-close").addEventListener("click", () => setDrawer(false));
document.querySelector("#drawer-backdrop").addEventListener("click", () => setDrawer(false));

document.querySelector("#send-order").addEventListener("click", () => {
  if (!state.cart.length) { window.alert("Nejdříve přidej do košíku alespoň jeden produkt."); return; }
  saveCart(state.cart);
  window.location.href = "objednavka.html";
});

renderProducts();
renderCart();
