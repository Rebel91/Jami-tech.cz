window.JAMI_FORM_CONFIG = Object.freeze({
  apiBaseUrl: "https://forms.jami-tech.cz",
  turnstileSiteKey: "0x4AAAAAAE2eIf_X-kQaW2jF"
});

window.JamiForms = {
  renderTurnstile(container, action) {
    const siteKey = window.JAMI_FORM_CONFIG.turnstileSiteKey;
    if (!siteKey) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      const render = () => resolve(window.turnstile.render(container, { sitekey: siteKey, action, size: "flexible" }));
      if (window.turnstile) {
        render();
        return;
      }

      const existingScript = document.querySelector('script[data-jami-turnstile]');
      if (existingScript) {
        existingScript.addEventListener("load", render, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.jamiTurnstile = "";
      script.addEventListener("load", render, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.append(script);
    });
  },

  resetTurnstile(widgetId) {
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
  },

  showSuccess(title, message) {
    const dialog = document.createElement("dialog");
    dialog.className = "form-success-dialog";
    dialog.setAttribute("aria-labelledby", "form-success-title");

    const content = document.createElement("div");
    content.className = "form-success-content";

    const closeButton = document.createElement("button");
    closeButton.className = "form-success-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Zavřít potvrzení");
    closeButton.title = "Zavřít";
    closeButton.textContent = "×";

    const heading = document.createElement("h2");
    heading.id = "form-success-title";
    heading.textContent = title;

    const text = document.createElement("p");
    text.textContent = message;

    const confirmButton = document.createElement("button");
    confirmButton.className = "form-success-confirm";
    confirmButton.type = "button";
    confirmButton.textContent = "Zavřít";

    content.append(closeButton, heading, text, confirmButton);
    dialog.append(content);
    document.body.append(dialog);

    const close = () => dialog.close();
    closeButton.addEventListener("click", close);
    confirmButton.addEventListener("click", close);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }
};
