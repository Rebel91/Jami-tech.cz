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
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  if (!prefersReducedMotion) requestAnimationFrame(tick);

  portfolioWindow.addEventListener("focusin", () => { paused = true; });
  portfolioWindow.addEventListener("focusout", (event) => {
    if (!portfolioWindow.contains(event.relatedTarget)) paused = false;
  });

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
  const trigger = event.target.closest(".portfolio-image-button");
  if (!trigger) return;
  const image = trigger.querySelector("img");

  const gallery = Array.from(document.querySelectorAll(".portfolio-track:not([aria-hidden]) .portfolio-placeholder img"));
  let currentIndex = gallery.indexOf(image);
  if (currentIndex === -1) currentIndex = 0;

  const overlay = document.createElement("div");
  overlay.className = "image-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Náhled realizace");
  overlay.innerHTML = `<button class="image-lightbox-close" type="button" aria-label="Zavřít náhled">×</button><button class="image-lightbox-arrow image-lightbox-prev" type="button" aria-label="Předchozí obrázek">‹</button><button class="image-lightbox-arrow image-lightbox-next" type="button" aria-label="Další obrázek">›</button><img src="${image.src}" alt="${image.alt}">`;
  document.body.append(overlay);
  document.body.classList.add("lightbox-open");
  const pageRegions = Array.from(document.querySelectorAll("body > header, body > main, body > footer"));
  const previousInert = pageRegions.map((element) => element.inert);
  pageRegions.forEach((element) => { element.inert = true; });

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
    pageRegions.forEach((element, index) => { element.inert = previousInert[index]; });
    document.removeEventListener("keydown", handleKeydown);
    trigger.focus();
  };
  const handleKeydown = (keyboardEvent) => {
    if (keyboardEvent.key === "Escape") closeLightbox();
    if (keyboardEvent.key === "ArrowLeft") showImage(currentIndex - 1);
    if (keyboardEvent.key === "ArrowRight") showImage(currentIndex + 1);
    if (keyboardEvent.key === "Tab") {
      const controls = Array.from(overlay.querySelectorAll("button"));
      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];
      if (keyboardEvent.shiftKey && document.activeElement === firstControl) {
        keyboardEvent.preventDefault();
        lastControl.focus();
      } else if (!keyboardEvent.shiftKey && document.activeElement === lastControl) {
        keyboardEvent.preventDefault();
        firstControl.focus();
      }
    }
  };

  overlay.querySelector(".image-lightbox-prev")?.addEventListener("click", () => showImage(currentIndex - 1));
  overlay.querySelector(".image-lightbox-next")?.addEventListener("click", () => showImage(currentIndex + 1));

  overlay.addEventListener("click", (overlayEvent) => {
    if (overlayEvent.target === overlay || overlayEvent.target.closest(".image-lightbox-close")) closeLightbox();
  });
  document.addEventListener("keydown", handleKeydown);
  overlay.querySelector(".image-lightbox-close").focus();
});

const quoteForm = document.querySelector("#quote-form");
const quoteSubmit = document.querySelector("#quote-submit");
const quoteStatus = document.querySelector("#quote-form-status");
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const FORM_API_BASE_URL = window.JAMI_FORM_CONFIG?.apiBaseUrl?.replace(/\/$/, "") || "";
const quoteTurnstile = window.JamiForms?.renderTurnstile("#quote-turnstile", "quote") ?? Promise.resolve(null);

if (quoteForm && quoteSubmit && quoteStatus) {
  const deadlineInput = quoteForm.elements.deadline;
  const pragueParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const datePart = (type) => Number(pragueParts.find((part) => part.type === type)?.value);
  deadlineInput.min = new Date(Date.UTC(datePart("year"), datePart("month") - 1, datePart("day") + 3))
    .toISOString()
    .slice(0, 10);
  const deadlineLabel = deadlineInput.previousElementSibling;
  if (deadlineLabel) deadlineLabel.textContent = "Požadovaný termín (nejdříve za 3 dny)";

  quoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!quoteForm.reportValidity()) return;

    if (!FORM_API_BASE_URL || !window.JAMI_FORM_CONFIG?.turnstileSiteKey) {
      quoteStatus.textContent = "Formulář ještě není připojený k backendu.";
      quoteStatus.className = "quote-form-status is-error";
      return;
    }

    const attachment = quoteForm.elements.attachment.files[0];
    if (attachment && attachment.size > MAX_ATTACHMENT_SIZE) {
      quoteStatus.textContent = "Příloha je větší než 10 MB. Nahrajte prosím menší soubor.";
      quoteStatus.className = "quote-form-status is-error";
      quoteForm.elements.attachment.focus();
      return;
    }

    const originalButtonContent = quoteSubmit.innerHTML;
    quoteSubmit.disabled = true;
    quoteSubmit.textContent = "Odesílám...";
    quoteStatus.textContent = "Poptávku právě odesíláme.";
    quoteStatus.className = "quote-form-status";

    const formData = new FormData(quoteForm);

    try {
      const response = await fetch(`${FORM_API_BASE_URL}/quote`, {
        method: "POST",
        body: formData
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Odeslání se nezdařilo");

      quoteForm.reset();
      quoteStatus.textContent = "";
      quoteStatus.className = "quote-form-status";
      const confirmationMessage = result.confirmationSent
        ? `Děkujeme. Vaše poptávka ${result.reference} byla úspěšně odeslána. Potvrzení jsme poslali na váš e-mail.`
        : `Vaše poptávka ${result.reference} byla přijata, ale potvrzovací e-mail se nepodařilo odeslat. Číslo si prosím poznamenejte. Formulář znovu neodesílejte.`;
      window.JamiForms.showSuccess(
        result.confirmationSent ? "Poptávka byla odeslána" : "Poptávka byla přijata",
        confirmationMessage
      );
    } catch (error) {
      console.error("Quote submission failed", error);
      quoteStatus.textContent = "Poptávku se nepodařilo odeslat. Zkuste to znovu nebo napište na info@jami-tech.cz.";
      quoteStatus.className = "quote-form-status is-error";
    } finally {
      quoteSubmit.disabled = false;
      quoteSubmit.innerHTML = originalButtonContent;
      quoteTurnstile.then((widgetId) => window.JamiForms?.resetTurnstile(widgetId));
    }
  });
}
