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

  function meshLoginUrl(path) {
    return "/geimser/mesh/login?next=" + encodeURIComponent(path || "/");
  }

  function remoteAssetStatusLabel(status) {
    return status === "online" ? "Online" : "Offline";
  }

  function remoteAssetLastSeen(asset) {
    if (!asset.last_seen_at) return "Sin contacto registrado";

    try {
      return "Ultimo contacto: " + new Date(asset.last_seen_at).toLocaleString();
    } catch (_error) {
      return "Ultimo contacto registrado";
    }
  }

  function renderRemoteAssets(modal, payload) {
    var container = modal.querySelector(".geimser-remote-assets");
    if (!container) return;

    var assets = (payload && payload.assets) || [];
    if (!assets.length) {
      container.innerHTML = [
        '<div class="geimser-remote-empty">',
        '  <strong>No hay equipos sincronizados todavia.</strong>',
        '  <span>Instala el agente en Windows. Cuando el equipo aparezca online en MeshCentral, tambien quedara registrado aqui como activo remoto.</span>',
        '</div>'
      ].join("");
      return;
    }

    container.innerHTML = [
      '<div class="geimser-remote-assets-head">',
      '  <strong>Activos remotos sincronizados</strong>',
      '  <span>' + assets.length + ' equipo' + (assets.length === 1 ? '' : 's') + ' en CMDB ITSM</span>',
      '</div>',
      '<div class="geimser-remote-asset-grid">',
      assets.map(function (asset) {
        var isOnline = asset.status === "online";
        return [
          '<article class="geimser-remote-asset ' + (isOnline ? 'is-online' : 'is-offline') + '">',
          '  <div>',
          '    <strong>' + escapeHtml(asset.name || asset.hostname || "Equipo remoto") + '</strong>',
          '    <span>' + escapeHtml(asset.group || "Sin grupo") + '</span>',
          '  </div>',
          '  <div class="geimser-remote-asset-meta">',
          '    <span>' + escapeHtml(asset.os || "Sistema no informado") + '</span>',
          '    <span>' + escapeHtml(asset.ip || remoteAssetLastSeen(asset)) + '</span>',
          '  </div>',
          '  <div class="geimser-remote-asset-actions">',
          '    <em>' + remoteAssetStatusLabel(asset.status) + '</em>',
          '    <button type="button" data-remote-session="' + escapeHtml(asset.session_url || meshLoginUrl("/")) + '">Tomar control</button>',
          '  </div>',
          '</article>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");

    container.querySelectorAll("[data-remote-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        var url = button.getAttribute("data-remote-session") || meshLoginUrl("/");
        modal.querySelector(".geimser-remote-frame").src = url;
        modal.querySelector(".geimser-remote-open").href = url;
      });
    });
  }

  function loadRemoteAssets(modal) {
    var container = modal.querySelector(".geimser-remote-assets");
    if (!container) return;

    container.innerHTML = '<div class="geimser-remote-empty"><strong>Sincronizando equipos...</strong><span>Estamos leyendo los agentes registrados en MeshCentral y guardandolos como activos del ITSM.</span></div>';

    fetch("/geimser/remote/assets", {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("remote assets failed");
      return response.json();
    }).then(function (payload) {
      renderRemoteAssets(modal, payload);
    }).catch(function () {
      container.innerHTML = '<div class="geimser-remote-empty is-error"><strong>No pudimos sincronizar la CMDB remota.</strong><span>Abre MeshCentral con el boton Instalador/Completo mientras revisamos la conexion.</span></div>';
    });
  }

  function remoteAssetSummary(assets) {
    return assets.reduce(function (memo, asset) {
      if (asset.status === "online") {
        memo.online += 1;
      } else {
        memo.offline += 1;
      }
      memo.groups[asset.group || "Sin grupo"] = true;
      return memo;
    }, { online: 0, offline: 0, groups: {} });
  }

  function ensureCmdbView() {
    var existing = document.querySelector(".geimser-cmdb-view");
    if (existing) return existing;

    var view = document.createElement("section");
    view.className = "geimser-cmdb-view";
    view.setAttribute("aria-label", "CMDB ITSM Geimser");
    view.innerHTML = [
      '<div class="geimser-cmdb-shell">',
      '  <header class="geimser-cmdb-header">',
      '    <div>',
      '      <div class="geimser-cmdb-kicker">ITSM Geimser</div>',
      '      <h1>CMDB de equipos</h1>',
      '      <p>Inventario sincronizado desde MeshCentral para registrar estado y tomar control remoto.</p>',
      '    </div>',
      '    <div class="geimser-cmdb-actions">',
      '      <button type="button" class="geimser-cmdb-refresh">Actualizar</button>',
      '      <button type="button" class="geimser-cmdb-register">Registrar equipo</button>',
      '      <button type="button" class="geimser-cmdb-close">Cerrar</button>',
      '    </div>',
      '  </header>',
      '  <div class="geimser-cmdb-stats" aria-label="Resumen CMDB"></div>',
      '  <div class="geimser-cmdb-content"></div>',
      '</div>'
    ].join("");

    view.querySelector(".geimser-cmdb-close").addEventListener("click", function () {
      view.classList.remove("is-open");
      if ((window.location.hash || "") === "#geimser/cmdb") {
        window.location.hash = "#dashboard";
      }
    });

    view.querySelector(".geimser-cmdb-refresh").addEventListener("click", function () {
      loadCmdbView(view, true);
    });

    view.querySelector(".geimser-cmdb-register").addEventListener("click", function () {
      openRemoteModal("registrar");
    });

    document.body.appendChild(view);
    return view;
  }

  function renderCmdbView(view, payload) {
    var assets = (payload && payload.assets) || [];
    var summary = remoteAssetSummary(assets);
    var groupsCount = Object.keys(summary.groups).length;
    var stats = view.querySelector(".geimser-cmdb-stats");
    var content = view.querySelector(".geimser-cmdb-content");

    stats.innerHTML = [
      '<article><span>Total</span><strong>' + assets.length + '</strong></article>',
      '<article><span>Online</span><strong>' + summary.online + '</strong></article>',
      '<article><span>Offline</span><strong>' + summary.offline + '</strong></article>',
      '<article><span>Grupos</span><strong>' + groupsCount + '</strong></article>'
    ].join("");

    if (!assets.length) {
      content.innerHTML = [
        '<div class="geimser-cmdb-empty">',
        '  <strong>No hay equipos en la CMDB todavía.</strong>',
        '  <span>Usa Registrar equipo, instala el agente Windows y vuelve a actualizar cuando aparezca online.</span>',
        '</div>'
      ].join("");
      return;
    }

    content.innerHTML = [
      '<div class="geimser-cmdb-table" role="table" aria-label="Equipos sincronizados">',
      '  <div class="geimser-cmdb-row geimser-cmdb-row-head" role="row">',
      '    <span role="columnheader">Equipo</span>',
      '    <span role="columnheader">Grupo</span>',
      '    <span role="columnheader">Sistema</span>',
      '    <span role="columnheader">IP / contacto</span>',
      '    <span role="columnheader">Estado</span>',
      '    <span role="columnheader">Acción</span>',
      '  </div>',
      assets.map(function (asset) {
        var isOnline = asset.status === "online";
        return [
          '<div class="geimser-cmdb-row" role="row">',
          '  <span role="cell"><strong>' + escapeHtml(asset.name || asset.hostname || "Equipo remoto") + '</strong><small>' + escapeHtml(asset.hostname || "") + '</small></span>',
          '  <span role="cell">' + escapeHtml(asset.group || "Sin grupo") + '</span>',
          '  <span role="cell">' + escapeHtml(asset.os || "Sistema no informado") + '</span>',
          '  <span role="cell">' + escapeHtml(asset.ip || remoteAssetLastSeen(asset)) + '</span>',
          '  <span role="cell"><em class="' + (isOnline ? "is-online" : "is-offline") + '">' + remoteAssetStatusLabel(asset.status) + '</em></span>',
          '  <span role="cell"><button type="button" data-cmdb-session="' + escapeHtml(asset.session_url || meshLoginUrl("/")) + '">Tomar control</button></span>',
          '</div>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");

    content.querySelectorAll("[data-cmdb-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        var sessionUrl = button.getAttribute("data-cmdb-session") || meshLoginUrl("/");
        var modal = ensureRemoteModal();
        openRemoteModal("equipos");
        modal.querySelector(".geimser-remote-frame").src = sessionUrl;
        modal.querySelector(".geimser-remote-open").href = sessionUrl;
      });
    });
  }

  function loadCmdbView(view, force) {
    if (!force && view.getAttribute("data-cmdb-loaded") === "true") return;
    view.setAttribute("data-cmdb-loaded", "true");

    var stats = view.querySelector(".geimser-cmdb-stats");
    var content = view.querySelector(".geimser-cmdb-content");
    stats.innerHTML = "";
    content.innerHTML = '<div class="geimser-cmdb-empty"><strong>Actualizando CMDB...</strong><span>Estamos leyendo los equipos registrados en MeshCentral.</span></div>';

    fetch("/geimser/remote/assets", {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("cmdb assets failed");
      return response.json();
    }).then(function (payload) {
      renderCmdbView(view, payload);
    }).catch(function () {
      view.removeAttribute("data-cmdb-loaded");
      content.innerHTML = '<div class="geimser-cmdb-empty is-error"><strong>No pudimos cargar la CMDB.</strong><span>Revisa que MeshCentral esté levantado y vuelve a actualizar.</span></div>';
    });
  }

  function openCmdbView() {
    var view = ensureCmdbView();
    view.classList.add("is-open");
    loadCmdbView(view);
  }

  function syncCmdbRoute() {
    var view = document.querySelector(".geimser-cmdb-view");
    if ((window.location.hash || "") === "#geimser/cmdb") {
      openCmdbView();
    } else if (view) {
      view.classList.remove("is-open");
    }
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function ensureRemoteModal() {
    var existing = document.querySelector(".geimser-remote-modal");
    if (existing) return existing;

    var remoteInviteText = [
      "Hola, necesitamos agregar tu equipo al centro remoto de ITSM Geimser.",
      "",
      "1. Te enviaremos el instalador Windows generado desde ITSM Geimser.",
      "2. Descárgalo y ejecútalo una sola vez en el equipo que necesita soporte.",
      "3. Acepta los permisos que pida Windows.",
      "4. Avísanos cuando termine. El equipo aparecerá online para la atención remota.",
      "",
      "No compartas el instalador con otros equipos; queda asociado al grupo de soporte."
    ].join("\n");

    var modal = document.createElement("div");
    modal.className = "geimser-remote-modal";
    modal.innerHTML = [
      '<div class="geimser-remote-panel" role="dialog" aria-label="Toma remota">',
      '  <div class="geimser-remote-header">',
      '    <div class="geimser-remote-heading">',
      '      <div class="geimser-remote-title">Soporte remoto</div>',
      '      <div class="geimser-remote-subtitle">Conecta, registra equipos y toma control desde ITSM Geimser</div>',
      '    </div>',
      '    <div class="geimser-remote-actions">',
      '      <button type="button" class="geimser-remote-home">Ver equipos</button>',
      '      <button type="button" class="geimser-remote-register">Instalador</button>',
      '      <a class="geimser-remote-open" target="_blank" rel="noopener">Abrir completo</a>',
      '      <button type="button" class="geimser-remote-close">Cerrar</button>',
      '    </div>',
      '  </div>',
      '  <div class="geimser-remote-body">',
      '    <aside class="geimser-remote-workflow" aria-label="Flujo de soporte remoto">',
      '      <button type="button" class="geimser-remote-flow is-active" data-remote-flow="equipos">',
      '        <span>1</span><strong>Conectar</strong><small>Elige un equipo registrado y abre la sesión remota.</small>',
      '      </button>',
      '      <button type="button" class="geimser-remote-flow" data-remote-flow="registrar">',
      '        <span>2</span><strong>Instalador</strong><small>Crea un grupo y descarga el agente Windows.</small>',
      '      </button>',
      '      <button type="button" class="geimser-remote-flow" data-remote-flow="enviar">',
      '        <span>3</span><strong>Enviar</strong><small>Adjunta el .exe al ticket o correo del cliente.</small>',
      '      </button>',
      '      <button type="button" class="geimser-remote-flow" data-remote-flow="esperar">',
      '        <span>4</span><strong>Tomar control</strong><small>Cuando el agente aparezca online, entra por Ver equipos.</small>',
      '      </button>',
      '      <div class="geimser-remote-note">',
      '        <strong>Sin doble login:</strong> este panel usa tu sesión de ITSM para entrar al centro remoto.',
      '      </div>',
      '      <div class="geimser-remote-install-help">',
      '        <strong>¿Dónde está el instalador?</strong>',
      '        <span>En el panel derecho: crea/abre un grupo, entra a <b>Agregar agente</b>, elige Windows y descarga.</span>',
      '      </div>',
      '      <button type="button" class="geimser-remote-copy">Copiar instrucciones</button>',
      '    </aside>',
      '    <main class="geimser-remote-stage">',
      '      <div class="geimser-remote-banner" role="status">',
      '        <strong>Equipos registrados</strong>',
      '        <span>Si el equipo ya existe, selecciónalo y abre escritorio remoto. Si no existe, usa Registrar equipo.</span>',
      '      </div>',
      '      <section class="geimser-remote-assets" aria-label="Activos remotos sincronizados"></section>',
      '      <div class="geimser-remote-frame-shell">',
      '        <iframe class="geimser-remote-frame" title="Centro remoto ITSM Geimser"></iframe>',
      '      </div>',
      '    </main>',
      '  </div>',
      '</div>'
    ].join("");

    function setFlow(flow) {
      var title = "Equipos registrados";
      var detail = "Si el equipo ya existe, selecciónalo y abre escritorio remoto. Si no existe, usa Registrar equipo.";

      if (flow === "registrar") {
        title = "Descargar instalador Windows";
        detail = "En Mis Dispositivos crea o abre un grupo. Luego usa Agregar agente, selecciona Windows y descarga el instalador.";
      } else if (flow === "enviar") {
        title = "Enviar al notebook";
        detail = "Adjunta el .exe generado al ticket o correo. El usuario lo ejecuta una vez y el equipo aparecerá online.";
      } else if (flow === "esperar") {
        title = "Tomar control";
        detail = "Cuando el agente quede online, vuelve a Ver equipos, abre el equipo y selecciona escritorio remoto.";
      }

      modal.querySelectorAll(".geimser-remote-flow").forEach(function (button) {
        button.classList.toggle("is-active", button.getAttribute("data-remote-flow") === flow);
      });

      modal.querySelector(".geimser-remote-banner strong").textContent = title;
      modal.querySelector(".geimser-remote-banner span").textContent = detail;
      modal.querySelector(".geimser-remote-frame").src = meshLoginUrl("/");
      modal.querySelector(".geimser-remote-assets").hidden = flow !== "equipos";
      modal.querySelector(".geimser-remote-frame-shell").classList.toggle("is-compact", flow === "equipos");
      if (flow === "equipos") {
        loadRemoteAssets(modal);
      }
    }

    modal.querySelector(".geimser-remote-copy").addEventListener("click", function (event) {
      var button = event.currentTarget;
      function done(text) {
        button.textContent = text;
        setTimeout(function () {
          button.textContent = "Copiar instrucciones";
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
      setFlow("equipos");
    });

    modal.querySelector(".geimser-remote-register").addEventListener("click", function () {
      setFlow("registrar");
    });

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        modal.classList.remove("is-open");
      }
    });

    modal.querySelectorAll(".geimser-remote-flow").forEach(function (button) {
      button.addEventListener("click", function () {
        setFlow(button.getAttribute("data-remote-flow"));
      });
    });

    modal.GeimserSetFlow = setFlow;
    document.body.appendChild(modal);
    return modal;
  }

  function openRemoteModal(flow) {
    var url = meshLoginUrl("/");
    var modal = ensureRemoteModal();
    var frame = modal.querySelector(".geimser-remote-frame");
    var openLink = modal.querySelector(".geimser-remote-open");
    frame.src = url;
    openLink.href = url;
    modal.classList.add("is-open");
    if (modal.GeimserSetFlow) {
      modal.GeimserSetFlow(flow || "equipos");
    }
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
      existing.textContent = isTicketScreen ? "Toma remota" : "Soporte remoto";
      return;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "geimser-remote-button";
    button.textContent = isTicketScreen ? "Toma remota" : "Soporte remoto";
    button.addEventListener("click", function () {
      openRemoteModal(isTicketScreen ? "equipos" : "registrar");
    });
    document.body.appendChild(button);
  }

  function normalizeNativeCmdbLabels() {
    var labels = Array.from(document.querySelectorAll("#app, #app *")).filter(function (el) {
      return el.childNodes && Array.from(el.childNodes).some(function (node) {
        return node.nodeType === 3 && /i-doit/i.test(node.nodeValue || "");
      });
    });

    labels.slice(0, 60).forEach(function (el) {
      Array.from(el.childNodes).forEach(function (node) {
        if (node.nodeType !== 3) return;
        node.nodeValue = (node.nodeValue || "").replace(/i-doit/gi, "CMDB");
      });
    });

    document.querySelectorAll("[title], [aria-label], [placeholder]").forEach(function (el) {
      ["title", "aria-label", "placeholder"].forEach(function (attr) {
        var value = el.getAttribute(attr);
        if (value && /i-doit/i.test(value)) {
          el.setAttribute(attr, value.replace(/i-doit/gi, "CMDB"));
        }
      });
    });
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
    normalizeNativeCmdbLabels();

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
