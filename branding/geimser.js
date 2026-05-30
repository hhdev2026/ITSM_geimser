(function () {
  function patchTranslationPrompt() {
    if (!window.App || !App.LocalStorage || App.LocalStorage.__geimserTranslationPatch) {
      return false;
    }

    var originalGet = App.LocalStorage.get.bind(App.LocalStorage);

    App.LocalStorage.get = function (key, userId) {
      if (key === "translation_support_no") {
        return true;
      }
      return originalGet(key, userId);
    };

    App.LocalStorage.__geimserTranslationPatch = true;
    return true;
  }

  function rememberTranslationPromptDismissal() {
    try {
      if (!window.App || !App.LocalStorage || !App.Session || !App.Session.get()) {
        return;
      }

      var session = App.Session.get();
      if (session && session.id) {
        App.LocalStorage.set("translation_support_no", true, session.id);
      }
    } catch (_error) {
      // Best effort only; the LocalStorage getter patch prevents the prompt.
    }
  }

  function closeVisibleTranslationPrompt() {
    var buttons = document.querySelectorAll("a, button");
    buttons.forEach(function (button) {
      var text = (button.textContent || "").trim();
      if (/^(No,?\s*gracias|No Thanks!)$/i.test(text)) {
        button.click();
      }
    });
  }

  function isInSidebarHeader(rect) {
    return rect.left >= 0 && rect.left < 280 && rect.top >= 0 && rect.top < 58;
  }

  function isLikelyZammadBrand(el) {
    var rect = el.getBoundingClientRect();
    if (!isInSidebarHeader(rect)) return false;

    var label = [
      el.getAttribute("alt"),
      el.getAttribute("title"),
      el.getAttribute("aria-label"),
      el.getAttribute("href"),
      el.getAttribute("src"),
      el.className && String(el.className),
      el.id
    ].join(" ");

    return /zammad|logo|brand|organization|product/i.test(label) || rect.left > 170;
  }

  function removeZammadBranding() {
    var candidates = document.querySelectorAll(
      "#app img, #app svg, #app a, #app [class*='logo'], #app [class*='Logo'], #app [class*='brand'], #app [class*='Brand']"
    );

    candidates.forEach(function (el) {
      if (isLikelyZammadBrand(el)) {
        el.classList.add("geimser-hide-zammad-brand");
        el.style.display = "none";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    });
  }

  function normalizeSidebarFooter() {
    var app = document.querySelector("#app");
    if (!app) return;

    var elements = Array.from(app.querySelectorAll("div, nav, aside, footer, section, ul"));
    var footerCandidates = elements.filter(function (el) {
      var rect = el.getBoundingClientRect();
      return rect.left >= 0 &&
        rect.left < 285 &&
        rect.bottom >= window.innerHeight - 72 &&
        rect.top < window.innerHeight - 18 &&
        rect.width >= 120 &&
        rect.width <= 285 &&
        rect.height >= 42 &&
        rect.height <= 90;
    });

    footerCandidates.forEach(function (el) {
      el.classList.add("geimser-sidebar-footer");
    });
  }

  function applyGeimserUi() {
    var app = document.querySelector("#app");
    if (!app) return;

    removeZammadBranding();
    normalizeSidebarFooter();

    var textRegex = /(TIEMPO DE ESPERA|ANIMO|CANAL DE DISTRIBUCI|ASIGNADOS|TICKETS EN PROCESO|REABIERTOS|Promedio|Total:|tickets)/i;
    var panels = Array.from(document.querySelectorAll("#app div, #app section, #app article")).filter(function (el) {
      var rect = el.getBoundingClientRect();
      var text = (el.textContent || "").trim();
      return rect.width > 220 && rect.height > 70 && textRegex.test(text);
    });

    panels.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.75 && rect.height > window.innerHeight * 0.75) return;
      el.style.background = "#ffffff";
      el.style.backgroundColor = "#ffffff";
      el.style.color = "#1d1d1f";
      el.style.borderColor = "rgba(0, 31, 61, 0.12)";
      el.style.boxShadow = "0 8px 24px rgba(0, 31, 61, 0.08)";
    });

    var lightContainers = document.querySelectorAll("#app .content, #app .main, #app .dashboard, #app .overview");
    lightContainers.forEach(function (el) {
      el.style.background = "#f5f7fb";
      el.style.backgroundColor = "#f5f7fb";
      el.style.color = "#1d1d1f";
    });
  }

  var attempts = 0;
  var interval = window.setInterval(function () {
    attempts += 1;
    patchTranslationPrompt();
    rememberTranslationPromptDismissal();
    closeVisibleTranslationPrompt();
    applyGeimserUi();

    if (attempts > 240) {
      window.clearInterval(interval);
    }
  }, 250);
})();
