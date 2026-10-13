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

const categoryLabels = CATEGORIES;

function readCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem("jami-cart") || "[]");
    if (!Array.isArray(savedCart)) return [];
    return savedCart.flatMap((savedItem) => {
      const product = resolveProduct(savedItem.id)
        || products.find((item) => item.name === savedItem.name);
      const quantity = Number.isInteger(savedItem.qty) ? Math.max(0, savedItem.qty) : 1;
      return product && Number.isInteger(product.priceCents) ? Array(Math.min(99, quantity)).fill(product) : [];
    });
  } catch {
    return [];
  }
}

function saveCart(cart) {
  const storedCart = groupCart(cart).map(({ product, qty }) => ({ id: product.id, qty }));
  try { localStorage.setItem("jami-cart", JSON.stringify(storedCart)); } catch { /* Košík zůstane jen v paměti. */ }
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
    const options = product.sizes ? `<div class="product-options">
      <label>Velikost fotografie<select data-option="size">${product.sizes.map(size => `<option value="${size}">${size.replace("x", " × ")} mm</option>`).join("")}</select></label>
      <label>Barva rámečku<select data-option="color">${product.colors.map(color => `<option value="${color.id}">${color.label}</option>`).join("")}</select></label>
      <label>Vaše fotografie<input type="file" data-photo accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label>
      <small>JPG, PNG nebo WebP, maximálně 10 MB. Fotografie se odešle až s objednávkou.</small>
      <p class="product-photo-status" role="status" aria-live="polite"></p>
      <small>Ilustrační náhled produktu.</small>
    </div>` : "";
    const initial = product.sizes ? resolveProduct(`${product.id}-${product.sizes[0]}-${product.colors[0].id}`) : product;
    const available = Number.isInteger(initial.priceCents);
    return `<article class="product-card${product.sizes ? " product-card-configurable" : ""}" id="product-${product.id}" data-product-id="${product.id}"><button class="product-image product-image-button" type="button" aria-label="Zvětšit obrázek produktu ${product.name}"><img src="${product.image}" alt="${product.name}" width="${product.imageWidth}" height="${product.imageHeight}" loading="lazy" decoding="async"><span class="product-image-fallback" hidden>Obrázek produktu není dostupný.</span></button><div class="product-info"><p class="product-category">${categoryLabels[product.category]}</p><h3>${product.name}</h3><p>${product.description}</p>${options}<div class="product-meta"><span class="product-price">${available ? formatPrice(initial.priceCents) : "Cena bude doplněna"}</span><button class="add-to-cart" data-index="${index}" type="button" ${available ? "" : "disabled"}>PŘIDAT</button></div></div></article>`;
  }).join("");
  productGrid.querySelectorAll(".product-image img").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    });
  });
}


function selectedProduct(card) {
  const product = products.find(item => item.id === card.dataset.productId);
  return product.sizes ? resolveProduct(`${product.id}-${card.querySelector('[data-option="size"]').value}-${card.querySelector('[data-option="color"]').value}`) : product;
}

productGrid.addEventListener("change", async (event) => {
  const card = event.target.closest(".product-card-configurable");
  if (!card) return;
  const product = selectedProduct(card);
  const status = card.querySelector(".product-photo-status");
  const upload = card.querySelector("[data-photo]");
  const image = card.querySelector(".product-image img");
  image.src = product.image;
  image.alt = product.name;
  image.hidden = false;
  image.nextElementSibling.hidden = true;
  card.querySelector(".product-image-button").setAttribute("aria-label", `Zvětšit obrázek produktu ${product.name}`);
  card.querySelector(".product-price").textContent = Number.isInteger(product.priceCents) ? formatPrice(product.priceCents) : "Cena bude doplněna";
  card.querySelector(".add-to-cart").disabled = true;
  try {
    if (event.target.matches("[data-photo]") && upload.files[0]) {
      await window.JamiPhotos.save(product.id, upload.files[0]);
    } else if (event.target.matches("[data-option]")) { upload.value = ""; }
    const photo = await window.JamiPhotos.get(product.id);
    if (selectedProduct(card).id === product.id) status.textContent = photo ? `Fotografie uložená v tomto prohlížeči: ${photo.name}` : "";
  } catch (error) { status.textContent = error.message; upload.value = ""; }
  finally { card.querySelector(".add-to-cart").disabled = !Number.isInteger(selectedProduct(card).priceCents); }
});

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
    const existing = groups.find((group) => group.product.id === product.id);
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
  items.innerHTML = groupCart(state.cart).map(({ product, qty }) => `<div class="cart-item"><div><strong>${product.name}</strong><span>${formatPrice(product.priceCents)}</span></div><div class="qty-control"><button class="qty-btn" data-qty-action="dec" data-cart-id="${product.id}" type="button" aria-label="Ubrat jeden kus produktu ${product.name}">−</button><input class="qty-input" type="number" min="0" value="${qty}" data-cart-id="${product.id}" aria-label="Množství produktu ${product.name}"><button class="qty-btn" data-qty-action="inc" data-cart-id="${product.id}" type="button" aria-label="Přidat jeden kus produktu ${product.name}">+</button></div><button class="remove-item" data-cart-id="${product.id}" type="button" aria-label="Odebrat ${product.name}">×</button></div>`).join("");
}

function setQuantity(id, qty) {
  const product = resolveProduct(id);
  if (!product) return;
  state.cart = state.cart.filter((item) => item.id !== id);
  for (let i = 0; i < qty; i += 1) state.cart.push(product);
  renderCart();
}

const cartDrawer = document.querySelector("#cart-drawer");
const cartToggle = document.querySelector("#cart-toggle");
const pageRegions = Array.from(document.querySelectorAll("body > header, body > main, body > footer"));

function setDrawer(open) {
  cartDrawer.classList.toggle("is-open", open);
  document.querySelector("#drawer-backdrop").classList.toggle("is-visible", open);
  cartDrawer.setAttribute("aria-hidden", String(!open));
  cartDrawer.inert = !open;
  cartToggle.setAttribute("aria-expanded", String(open));
  pageRegions.forEach((element) => { element.inert = open; });
  if (open) document.querySelector("#cart-close").focus();
  else cartToggle.focus();
}

document.addEventListener("click", (event) => {
  const productImageButton = event.target.closest(".product-image-button");
  const addButton = event.target.closest(".add-to-cart");
  const removeButton = event.target.closest(".remove-item");
  const qtyButton = event.target.closest(".qty-btn");
  if (productImageButton) {
    const productImage = productImageButton.querySelector("img");
    const overlay = document.createElement("div");
    overlay.className = "image-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `Náhled produktu ${productImage.alt}`);
    overlay.innerHTML = `<button class="image-lightbox-close" type="button" aria-label="Zavřít náhled">×</button><img src="${productImage.src}" alt="${productImage.alt}">`;
    document.body.append(overlay);
    document.body.classList.add("lightbox-open");
    const modalRegions = Array.from(document.querySelectorAll("body > header, body > main, body > aside, body > footer"));
    const previousInert = modalRegions.map((element) => element.inert);
    modalRegions.forEach((element) => { element.inert = true; });

    const closeLightbox = () => {
      overlay.remove();
      document.body.classList.remove("lightbox-open");
      modalRegions.forEach((element, index) => { element.inert = previousInert[index]; });
      document.removeEventListener("keydown", handleKeydown);
      productImageButton.focus();
    };
    const handleKeydown = (keyboardEvent) => {
      if (keyboardEvent.key === "Escape") closeLightbox();
      if (keyboardEvent.key === "Tab") {
        keyboardEvent.preventDefault();
        overlay.querySelector(".image-lightbox-close").focus();
      }
    };

    overlay.addEventListener("click", (overlayEvent) => {
      if (overlayEvent.target === overlay || overlayEvent.target.closest(".image-lightbox-close")) closeLightbox();
    });
    document.addEventListener("keydown", handleKeydown);
    overlay.querySelector(".image-lightbox-close").focus();
  }
  if (addButton && !addButton.disabled) {
    const card = addButton.closest(".product-card");
    const product = selectedProduct(card);
    if (!Number.isInteger(product.priceCents)) return;
    if (product.requiresPhoto) {
      addButton.disabled = true;
      window.JamiPhotos.get(product.id).then((file) => {
        if (!file) throw new Error("Nejdříve nahrajte fotografii pro vybranou variantu.");
        state.cart.push(product); renderCart(); setDrawer(true);
      }).catch(error => { card.querySelector(".product-photo-status").textContent = error.message; })
        .finally(() => { addButton.disabled = false; });
    } else { state.cart.push(product); renderCart(); setDrawer(true); }
  }
  if (removeButton) { state.cart = state.cart.filter((product) => product.id !== removeButton.dataset.cartId); renderCart(); }
  if (qtyButton) {
    const id = qtyButton.dataset.cartId;
    const currentQty = state.cart.filter((product) => product.id === id).length;
    setQuantity(id, qtyButton.dataset.qtyAction === "inc" ? currentQty + 1 : currentQty - 1);
  }
});

document.addEventListener("change", (event) => {
  const qtyInput = event.target.closest(".qty-input");
  if (!qtyInput) return;
  const qty = Math.max(0, Number(qtyInput.value) || 0);
  setQuantity(qtyInput.dataset.cartId, qty);
});

cartToggle.addEventListener("click", () => setDrawer(true));
document.querySelector("#cart-close").addEventListener("click", () => setDrawer(false));
document.querySelector("#drawer-backdrop").addEventListener("click", () => setDrawer(false));
document.addEventListener("keydown", (event) => {
  if (!cartDrawer.classList.contains("is-open")) return;
  if (event.key === "Escape") setDrawer(false);
  if (event.key === "Tab") {
    const controls = Array.from(cartDrawer.querySelectorAll("button:not([disabled]), input:not([disabled])"));
    const firstControl = controls[0];
    const lastControl = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  }
});

document.querySelector("#send-order").addEventListener("click", () => {
  if (!state.cart.length) { window.alert("Nejdříve přidej do košíku alespoň jeden produkt."); return; }
  saveCart(state.cart);
  window.location.href = "objednavka.html";
});

renderProducts();
renderCart();

if (window.location.hash) {
  const linkedProduct = document.getElementById(window.location.hash.slice(1));
  if (linkedProduct) linkedProduct.scrollIntoView({ block: "start" });
}
