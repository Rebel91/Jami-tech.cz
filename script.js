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

const portfolioWindow = document.querySelector(".portfolio-window");
const portfolioGrid = document.querySelector(".portfolio-grid");
const portfolioTrack = document.querySelector(".portfolio-track");

if (portfolioWindow && portfolioGrid && portfolioTrack) {
  const prevButton = portfolioWindow.querySelector(".portfolio-arrow-prev");
  const nextButton = portfolioWindow.querySelector(".portfolio-arrow-next");
  const step = 277; // sirka polozky (263px) + mezera (14px)
  let offset = 0;
  let trackWidth = 0;
  let speed = 0; // px/s, dopocita se z sirky pasu
  let paused = false;
  let lastTime = null;

  const measureTrack = () => {
    trackWidth = portfolioTrack.scrollWidth + 14;
    speed = trackWidth / 42; // stejne tempo jako puvodni 42s animace
  };
  measureTrack();
  window.addEventListener("resize", measureTrack);

  const applyOffset = () => { portfolioGrid.style.transform = `translateX(${offset}px)`; };

  const tick = (now) => {
    if (lastTime === null) lastTime = now;
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (!paused) {
      offset -= speed * dt;
      if (offset <= -trackWidth) offset += trackWidth;
      applyOffset();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  portfolioWindow.addEventListener("mouseenter", () => { paused = true; });
  portfolioWindow.addEventListener("mouseleave", () => { paused = false; });

  const movePortfolio = (direction) => {
    offset += direction * step;
    if (offset > 0) offset -= trackWidth;
    if (offset <= -trackWidth) offset += trackWidth;
    applyOffset();
  };

  prevButton?.addEventListener("click", () => movePortfolio(1));
  nextButton?.addEventListener("click", () => movePortfolio(-1));
}

document.addEventListener("click", (event) => {
  const image = event.target.closest(".portfolio-placeholder img");
  if (!image) return;

  const gallery = Array.from(document.querySelectorAll(".portfolio-track:not([aria-hidden]) .portfolio-placeholder img"));
  let currentIndex = gallery.indexOf(image);
  if (currentIndex === -1) currentIndex = 0;

  const overlay = document.createElement("div");
  overlay.className = "image-lightbox";
  overlay.innerHTML = `<button class="image-lightbox-close" type="button" aria-label="Zavřít náhled">×</button><button class="image-lightbox-arrow image-lightbox-prev" type="button" aria-label="Předchozí obrázek">‹</button><button class="image-lightbox-arrow image-lightbox-next" type="button" aria-label="Další obrázek">›</button><img src="${image.src}" alt="${image.alt}">`;
  document.body.append(overlay);
  document.body.classList.add("lightbox-open");

  const overlayImage = overlay.querySelector("img");
  const showImage = (index) => {
    currentIndex = (index + gallery.length) % gallery.length;
    const target = gallery[currentIndex];
    overlayImage.src = target.src;
    overlayImage.alt = target.alt;
  };

  const closeLightbox = () => {
    overlay.remove();
    document.body.classList.remove("lightbox-open");
    document.removeEventListener("keydown", handleKeydown);
  };
  const handleKeydown = (keyboardEvent) => {
    if (keyboardEvent.key === "Escape") closeLightbox();
    if (keyboardEvent.key === "ArrowLeft") showImage(currentIndex - 1);
    if (keyboardEvent.key === "ArrowRight") showImage(currentIndex + 1);
  };

  overlay.querySelector(".image-lightbox-prev")?.addEventListener("click", () => showImage(currentIndex - 1));
  overlay.querySelector(".image-lightbox-next")?.addEventListener("click", () => showImage(currentIndex + 1));

  overlay.addEventListener("click", (overlayEvent) => {
    if (overlayEvent.target === overlay || overlayEvent.target.closest(".image-lightbox-close")) closeLightbox();
  });
  document.addEventListener("keydown", handleKeydown);
});
