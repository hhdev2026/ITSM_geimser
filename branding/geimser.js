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

  function styleSidebarDockControls() {
    var app = document.querySelector("#app");
    if (!app) return;

    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var candidates = Array.from(app.querySelectorAll("a, button, [role='button'], li, div")).filter(function (el) {
      var rect = el.getBoundingClientRect();
      return rect.left >= -1 &&
        rect.left < 350 &&
        rect.bottom >= viewportHeight - 72 &&
        rect.top >= viewportHeight - 96 &&
        rect.width >= 38 &&
        rect.width <= 96 &&
        rect.height >= 38 &&
        rect.height <= 72;
    });

    candidates.forEach(function (el) {
      el.classList.add("geimser-sidebar-dock-item");
      el.style.background = "#20232b";
      el.style.backgroundColor = "#20232b";
      el.style.borderColor = "rgba(255, 255, 255, 0.08)";
      el.style.boxShadow = "none";
      el.style.color = "#d9e2ec";

      var parent = el.parentElement;
      if (parent) {
        var parentRect = parent.getBoundingClientRect();
        if (parentRect.left >= -1 && parentRect.left < 350 && parentRect.bottom >= viewportHeight - 78) {
          parent.classList.add("geimser-sidebar-dock");
          parent.style.background = "#20232b";
          parent.style.backgroundColor = "#20232b";
          parent.style.borderTop = "1px solid rgba(255, 255, 255, 0.08)";
        }
      }

      Array.from(el.querySelectorAll("svg, .icon, [class*='icon'], [class*='Icon']")).forEach(function (icon) {
        icon.style.color = "#d9e2ec";
        icon.style.fill = "#d9e2ec";
      });

      Array.from(el.querySelectorAll(".avatar, [class*='avatar'], [class*='Avatar']")).forEach(function (avatar) {
        avatar.style.background = "#f28c18";
        avatar.style.backgroundColor = "#f28c18";
        avatar.style.color = "#ffffff";
      });
    });
  }

  function parseRgb(value) {
    var match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/i);
    if (!match) return null;
    var alpha = match[4] === undefined ? 1 : Number(match[4]);
    if (alpha === 0) return null;
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: alpha
    };
  }

  function luminance(rgb) {
    function channel(value) {
      var normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(foreground, background) {
    var lighter = Math.max(luminance(foreground), luminance(background));
    var darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function colorSpread(rgb) {
    return Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
  }

  function isFilledControl(el, bg) {
    if (!el.matches("a, button, .btn, .button, [role='button']")) return false;
    if (luminance(bg) > 0.82 && colorSpread(bg) < 35) return false;
    return colorSpread(bg) > 35 || luminance(bg) < 0.55;
  }

  function effectiveBackground(el) {
    var current = el;
    while (current && current !== document.documentElement) {
      var bg = parseRgb(window.getComputedStyle(current).backgroundColor);
      if (bg && bg.a >= 0.92) return bg;
      current = current.parentElement;
    }
    return { r: 245, g: 247, b: 251, a: 1 };
  }

  function isInsideNavigation(el) {
    return Boolean(el.closest(".navigation, .sidebar, .appSidebar, .mainNavigation, [class*='Navigation'], [class*='navigation'], .geimser-sidebar-footer, .geimser-sidebar-dock"));
  }

  function normalizeTextContrast() {
    var app = document.querySelector("#app");
    if (!app) return;

    var textSelectors = [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "label", "legend", "span", "small", "a", "div",
      "li", "td", "th", "button", ".btn", ".link",
      "[role='columnheader']", "[class*='column']", "[class*='Column']",
      "[class*='label']", "[class*='Label']", "[class*='title']", "[class*='Title']", "[class*='headline']", "[class*='Headline']"
    ].join(",");

    Array.from(app.querySelectorAll(textSelectors)).forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      if (isInsideNavigation(el)) return;
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      if (el.children.length > 0 && text.length > 80 && !el.matches("[role='columnheader'], [class*='column'], [class*='Column']")) return;

      var style = window.getComputedStyle(el);
      var fg = parseRgb(style.color);
      var bg = effectiveBackground(el);
      if (!fg || !bg) return;

      var bgIsLight = luminance(bg) > 0.55;
      var minRatio = /^(H[1-6]|LABEL|LEGEND|BUTTON)$/i.test(el.tagName) ? 4.5 : 4.0;
      var weak = contrastRatio(fg, bg) < minRatio;

      if (!weak && !/rgba?\(255,\s*255,\s*255/i.test(style.color)) return;

      if (isFilledControl(el, bg)) {
        el.classList.add("geimser-filled-control");
        el.style.color = "#ffffff";
        Array.from(el.querySelectorAll("*")).forEach(function (child) {
          child.style.color = "#ffffff";
        });
        return;
      }

      if (bgIsLight) {
        if (el.matches("a, .link")) {
          el.style.color = "#004b8d";
        } else if (el.matches("label, legend, small, .small, [class*='label'], [class*='Label'], [class*='muted'], [class*='hint']")) {
          el.style.color = "#5f6672";
        } else {
          el.style.color = "#1d1d1f";
        }
        el.closest(".panel, .box, .widget, .card, .table, section, article")?.classList.add("geimser-light-surface");
      } else {
        el.style.color = el.matches("a, .link") ? "#8fd3ff" : "#f3f7fb";
        el.closest(".panel, .box, .widget, .card, .table, section, article")?.classList.add("geimser-dark-surface");
      }
    });
  }

  function normalizeDynamicTableHeaders() {
    var app = document.querySelector("#app");
    if (!app) return;

    var headerText = /^(INICIAR SESI[ÓO]N|NOMBRE|APELLIDO\(S\)|ORGANIZACI[ÓO]N|ORGANIZACIONES SECUNDARIAS|ACCI[ÓO]N|AC\.\.\.|PROTOCOLO|DIRECCI[ÓO]N DE CORREO ELECTR[ÓO]NICO|SALIENTE|EDITAR)$/i;
    var candidates = Array.from(app.querySelectorAll("div, span, th, [role='columnheader'], [class*='column'], [class*='Column']"));

    candidates.forEach(function (el) {
      if (isInsideNavigation(el)) return;
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!headerText.test(text)) return;

      var rect = el.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 8 || rect.left < 520) return;

      el.style.color = "#1f2937";
      el.style.backgroundColor = "#eef3f8";
      el.style.fontWeight = "700";

      Array.from(el.querySelectorAll("*")).forEach(function (child) {
        child.style.color = "#1f2937";
        child.style.backgroundColor = "transparent";
      });

      var parent = el.parentElement;
      var depth = 0;
      while (parent && depth < 3) {
        var parentRect = parent.getBoundingClientRect();
        if (parentRect.height > 12 && parentRect.height < 72 && parentRect.width > rect.width * 0.8 && !isInsideNavigation(parent)) {
          parent.style.backgroundColor = "#eef3f8";
          parent.style.color = "#1f2937";
        }
        parent = parent.parentElement;
        depth += 1;
      }
    });
  }

  function normalizeNavigationContrast() {
    var app = document.querySelector("#app");
    if (!app) return;

    var navNodes = Array.from(app.querySelectorAll(
      ".navigation, .sidebar, .appSidebar, .mainNavigation, aside, nav, [class*='Navigation'], [class*='navigation'], [class*='Sidebar'], [class*='sidebar']"
    ));

    navNodes.forEach(function (nav) {
      var rect = nav.getBoundingClientRect();
      if (rect.width < 40 || rect.left > 540) return;
      nav.classList.add("geimser-nav-surface");
    });

    Array.from(app.querySelectorAll(".geimser-nav-surface a, .geimser-nav-surface button, .geimser-nav-surface span, .geimser-nav-surface div, .geimser-nav-surface li")).forEach(function (el) {
      if (!(el.textContent || "").trim() && !el.matches("a, button, [role='button']")) return;
      var isActive = Boolean(el.closest(".is-active, .active, [aria-current='page']"));
      el.style.color = isActive ? "#071c2b" : "#e9f1f8";
    });
  }

  function normalizeSidebarTicketLabels() {
    var app = document.querySelector("#app");
    if (!app) return;

    var seenIncoming = 0;
    Array.from(app.querySelectorAll("a[href*='#ticket/create/id/'], a[href*='#ticket/zoom/'], a[href*='#ticket/edit/']")).forEach(function (link) {
      if (!isInsideNavigation(link)) return;

      var text = (link.textContent || "").replace(/\s+/g, " ").trim();
      if (!/^Llamada entrante$/i.test(text)) return;

      var href = link.getAttribute("href") || "";
      var match = href.match(/#ticket\/(?:create\/id|zoom|edit)\/?(\d+)?/);
      seenIncoming += 1;
      var label = match && match[1] ? "Ticket #" + match[1] : "Ticket abierto " + seenIncoming;

      link.setAttribute("title", "Llamada entrante - " + label);
      link.setAttribute("aria-label", label);
      replaceVisibleText(link, label);
    });
  }

  function replaceVisibleText(root, label) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return /^(\s*)Llamada entrante(\s*)$/i.test(node.nodeValue || "")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    var node = walker.nextNode();
    if (node) {
      node.nodeValue = node.nodeValue.replace(/Llamada entrante/i, label);
      return;
    }

    root.textContent = label;
  }

  function markSurfaces() {
    var app = document.querySelector("#app");
    if (!app) return;

    Array.from(app.querySelectorAll(".content, .main, .main-content, .page, .settings, .admin, .ticketZoom, .dashboard, [class*='Content'], [class*='content']")).forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width > 240 && rect.height > 120) {
        el.classList.add("geimser-app-surface");
      }
    });

    Array.from(app.querySelectorAll("table, .table, .card, .panel, .box, .widget, .tile, form, fieldset, section, article, [class*='Table'], [class*='table'], [class*='Card'], [class*='card'], [class*='Panel'], [class*='panel']")).forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width > 80 && rect.height > 24 && !isInsideNavigation(el)) {
        el.classList.add("geimser-readable-surface");
      }
    });
  }

  function auditContrast() {
    var app = document.querySelector("#app");
    if (!app) return [];

    var failures = [];
    var textSelectors = [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "label", "legend", "span", "small", "a",
      "li", "td", "th", "button", ".btn", ".link",
      "[class*='label']", "[class*='Label']", "[class*='title']", "[class*='Title']"
    ].join(",");

    Array.from(app.querySelectorAll(textSelectors)).forEach(function (el) {
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;

      var rect = el.getBoundingClientRect();
      if (rect.width < 3 || rect.height < 3) return;

      var style = window.getComputedStyle(el);
      var fg = parseRgb(style.color);
      var bg = effectiveBackground(el);
      if (!fg || !bg) return;

      var ratio = contrastRatio(fg, bg);
      var minRatio = /^(H[1-6]|LABEL|LEGEND|BUTTON)$/i.test(el.tagName) ? 4.5 : 4.0;
      if (ratio < minRatio) {
        failures.push({
          text: text.slice(0, 80),
          tag: el.tagName.toLowerCase(),
          className: String(el.className || "").slice(0, 120),
          ratio: Number(ratio.toFixed(2)),
          required: minRatio,
          color: style.color,
          background: window.getComputedStyle(el.parentElement || el).backgroundColor,
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        });
      }
    });

    return failures;
  }

  function meshUrl() {
    var host = window.location.hostname || "localhost";
    if (host === "itsm.geimser.cl") {
      return "https://remoto.geimser.cl";
    }
    return "https://" + host;
  }

  function ensureRemoteModal() {
    var existing = document.querySelector(".geimser-remote-modal");
    if (existing) return existing;

    var remoteInviteText = [
      "Hola, necesitamos registrar tu equipo en ITSM Geimser para soporte remoto.",
      "",
      "1. Abre este enlace: https://remoto.geimser.cl",
      "2. Descarga el agente que te indique soporte.",
      "3. Ejecuta el instalador una sola vez.",
      "4. Avísanos cuando termine. El equipo quedará disponible para soporte remoto autorizado.",
      "",
      "No compartas este instalador fuera de tu equipo."
    ].join("\n");

    var modal = document.createElement("div");
    modal.className = "geimser-remote-modal";
    modal.innerHTML = [
      '<div class="geimser-remote-panel" role="dialog" aria-label="Toma remota">',
      '  <div class="geimser-remote-header">',
      '    <div class="geimser-remote-heading">',
      '      <div class="geimser-remote-title">Centro remoto</div>',
      '      <div class="geimser-remote-subtitle">Equipos, agentes y sesiones dentro de ITSM Geimser</div>',
      '    </div>',
      '    <div class="geimser-remote-actions">',
      '      <button type="button" class="geimser-remote-home">Equipos</button>',
      '      <button type="button" class="geimser-remote-register">Registrar equipo</button>',
      '      <a class="geimser-remote-open" target="_blank" rel="noopener">Abrir completo</a>',
      '      <button type="button" class="geimser-remote-close">Cerrar</button>',
      '    </div>',
      '  </div>',
      '  <div class="geimser-remote-guide">',
      '    <div class="geimser-remote-guide-main">',
      '      <strong>Flujo recomendado:</strong> primero abre <strong>Abrir completo</strong> e inicia sesión en el centro remoto. Luego vuelve acá para trabajar embebido dentro del ITSM.',
      '    </div>',
      '    <button type="button" class="geimser-remote-copy">Copiar mensaje para cliente</button>',
      '  </div>',
      '  <div class="geimser-remote-register-help" role="status">',
      '    <div class="geimser-remote-steps">',
      '      <div><span>1</span><strong>Entrar</strong><small>Abre el centro remoto completo e inicia sesión.</small></div>',
      '      <div><span>2</span><strong>Grupo</strong><small>Crea o selecciona el grupo de dispositivos del cliente.</small></div>',
      '      <div><span>3</span><strong>Agente</strong><small>Selecciona Agregar agente y el sistema operativo.</small></div>',
      '      <div><span>4</span><strong>Enviar</strong><small>Descarga o copia el instalador y envíalo al usuario.</small></div>',
      '      <div><span>5</span><strong>Validar</strong><small>Cuando el usuario lo ejecute, el equipo aparecerá conectado.</small></div>',
      '    </div>',
      '    <div class="geimser-remote-tip"><strong>Qué enviar:</strong> el instalador del agente que genera MeshCentral para Windows, macOS o Linux. Ese archivo registra el equipo contra <strong>remoto.geimser.cl</strong>.</div>',
      '    <button type="button" class="geimser-remote-help-close" aria-label="Cerrar ayuda">Ocultar guia</button>',
      '  </div>',
      '  <iframe class="geimser-remote-frame" title="MeshCentral"></iframe>',
      '</div>'
    ].join("");

    modal.querySelector(".geimser-remote-copy").addEventListener("click", function (event) {
      var button = event.currentTarget;
      function done(text) {
        button.textContent = text;
        setTimeout(function () {
          button.textContent = "Copiar mensaje para cliente";
        }, 2200);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(remoteInviteText).then(function () {
          done("Mensaje copiado");
        }).catch(function () {
          window.prompt("Copia este mensaje para enviarlo al cliente:", remoteInviteText);
          done("Mensaje listo");
        });
        return;
      }

      window.prompt("Copia este mensaje para enviarlo al cliente:", remoteInviteText);
      done("Mensaje listo");
    });

    modal.querySelector(".geimser-remote-close").addEventListener("click", function () {
      modal.classList.remove("is-open");
    });

    modal.querySelector(".geimser-remote-home").addEventListener("click", function () {
      modal.classList.remove("show-register-help");
      modal.querySelector(".geimser-remote-frame").src = meshUrl();
    });

    modal.querySelector(".geimser-remote-register").addEventListener("click", function () {
      modal.classList.add("show-register-help");
      modal.querySelector(".geimser-remote-frame").src = meshUrl();
    });

    modal.querySelector(".geimser-remote-help-close").addEventListener("click", function () {
      modal.classList.remove("show-register-help");
    });

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        modal.classList.remove("is-open");
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function openRemoteModal() {
    var url = meshUrl();
    var modal = ensureRemoteModal();
    var frame = modal.querySelector(".geimser-remote-frame");
    var openLink = modal.querySelector(".geimser-remote-open");
    frame.src = url;
    openLink.href = url;
    modal.classList.add("is-open");
  }

  function ensureRemoteButton() {
    var app = document.querySelector("#app");
    if (!app) return;

    var hash = window.location.hash || "";
    var isPublicScreen = /^#(login|password_reset|signup|register)?$/.test(hash) ||
      Boolean(document.querySelector(".hero-unit"));
    var existing = document.querySelector(".geimser-remote-button");

    if (isPublicScreen) {
      if (existing) existing.remove();
      return;
    }

    var isTicketScreen = /^#ticket\/(create|zoom|edit)|^#ticket\//.test(hash);

    if (existing) {
      existing.textContent = isTicketScreen ? "Toma remota" : "Equipos remotos";
      return;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "geimser-remote-button";
    button.textContent = isTicketScreen ? "Toma remota" : "Equipos remotos";
    button.addEventListener("click", openRemoteModal);
    document.body.appendChild(button);
  }

  function applyGeimserUi() {
    var app = document.querySelector("#app");
    if (!app) return;

    removeZammadBranding();
    normalizeSidebarFooter();
    styleSidebarDockControls();
    normalizeNavigationContrast();
    normalizeSidebarTicketLabels();
    markSurfaces();
    normalizeTextContrast();
    normalizeDynamicTableHeaders();
    ensureRemoteButton();

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

  window.GeimserContrastAudit = auditContrast;

  var scheduled = false;
  var applying = false;
  var observer;
  var observerOptions = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "aria-selected", "aria-current"]
  };

  function observeChanges() {
    if (!observer) return;
    observer.observe(document.documentElement, observerOptions);
  }

  function scheduleApply() {
    if (scheduled || applying) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      applying = true;
      if (observer) observer.disconnect();
      patchTranslationPrompt();
      rememberTranslationPromptDismissal();
      closeVisibleTranslationPrompt();
      applyGeimserUi();
      applying = false;
      observeChanges();
    });
  }

  var attempts = 0;
  var warmup = window.setInterval(function () {
    attempts += 1;
    patchTranslationPrompt();
    rememberTranslationPromptDismissal();
    closeVisibleTranslationPrompt();
    applyGeimserUi();

    if (attempts > 80) {
      window.clearInterval(warmup);
    }
  }, 250);

  window.addEventListener("hashchange", scheduleApply);
  window.addEventListener("resize", scheduleApply);
  window.addEventListener("load", scheduleApply);

  observer = new MutationObserver(scheduleApply);
  observeChanges();
})();
