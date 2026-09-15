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
  }
};
