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

    return /zammad|product[-_\s]?logo/i.test(label);
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

  function normalizeVisibleBrandText() {
    var replacements = [
      [/\bITSM Geimser\b/gi, "Geimser ITSM"],
      [/\bZammad\b/gi, "Geimser ITSM"]
    ];

    function replaceBrand(value) {
      return replacements.reduce(function (result, pair) {
        return result.replace(pair[0], pair[1]);
      }, String(value || ""));
    }

    if (document.title) {
      document.title = replaceBrand(document.title);
    }

    document.querySelectorAll("img[alt], img[title], .company-logo[aria-label]").forEach(function (el) {
      ["title", "aria-label", "alt"].forEach(function (attr) {
        var value = el.getAttribute(attr);
        if (value) el.setAttribute(attr, replaceBrand(value));
      });
    });
  }

  function ensureSidebarBrand() {
    var existing = document.querySelector(".geimser-sidebar-brand");
    var app = document.querySelector("#app");
    if (!app) return;

    var sidebar = Array.from(app.querySelectorAll(
      ".navigation, .sidebar, .appSidebar, .mainNavigation, [class*='Navigation'], [class*='navigation'], [class*='Sidebar'], [class*='sidebar']"
    )).find(function (el) {
      var rect = el.getBoundingClientRect();
      return rect.left >= -1 && rect.left < 16 && rect.width >= 120 && rect.height >= window.innerHeight * 0.55;
    });

    if (!sidebar) return;

    var compact = sidebar.getBoundingClientRect().width < 250;
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "geimser-sidebar-brand";
      existing.setAttribute("aria-label", "Geimser ITSM");
      existing.innerHTML = '<img alt="Geimser ITSM" />';
      document.body.appendChild(existing);
    }

    existing.classList.toggle("is-compact", compact);
    existing.querySelector("img").src = compact
      ? "/assets/images/geimser-logo-mark.png"
      : "/assets/images/geimser-logo.png";
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

  function currentSession() {
    try {
      if (!window.App || !App.Session || !App.Session.get()) return null;
      return App.Session.get();
    } catch (_error) {
      return null;
    }
  }

  function collectSessionNames(value, result, depth) {
    if (!value || depth > 3) return;

    if (typeof value === "string") {
      result.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(function (entry) {
        collectSessionNames(entry, result, depth + 1);
      });
      return;
    }

    if (typeof value !== "object") return;

    Object.keys(value).forEach(function (key) {
      if (value[key] === true || value[key] === 1 || typeof value[key] === "string") {
        result.push(key);
      }
    });

    ["name", "title", "permission", "permissions", "roles"].forEach(function (key) {
      collectSessionNames(value[key], result, depth + 1);
    });
  }

  function sessionPermissionText() {
    var session = currentSession();
    if (!session) return "";

    var names = [];
    collectSessionNames(session.permissions, names, 0);
    collectSessionNames(session.roles, names, 0);
    collectSessionNames(session.role, names, 0);
    return names.join(" ").toLowerCase();
  }

  function adminSidebarAccess() {
    return /(^|[\s._-])admin($|[\s._-])/.test(sessionPermissionText());
  }

  function internalSidebarAccess() {
    return /ticket\.agent|(^|[\s._-])admin($|[\s._-])/.test(sessionPermissionText());
  }

  function findSidebarSurface() {
    var app = document.querySelector("#app");
    if (!app) return null;

    return Array.from(app.querySelectorAll(
      ".navigation, .sidebar, .appSidebar, .mainNavigation, .geimser-nav-surface, [class*='Navigation'], [class*='navigation'], [class*='Sidebar'], [class*='sidebar']"
    )).find(isRealSidebarSurface);
  }

  function isRealSidebarSurface(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    return rect.left >= -1 &&
      rect.left < 18 &&
      rect.width >= 44 &&
      rect.width <= 380 &&
      rect.height >= window.innerHeight * 0.55;
  }

  function sidebarReferenceItem(sidebar) {
    return sidebar.querySelector('a[href="#ticket/view"], a[href^="#ticket/view/"]') ||
      sidebar.querySelector('a[href="#dashboard"]') ||
      null;
  }

  function ensureInternalSidebarShortcuts() {
    var existing = document.querySelector(".geimser-sidebar-shortcuts");
    if (!adminSidebarAccess()) {
      // Solo eliminar si la sesión ya está disponible; si no, esperar para no
      // borrar prematuramente antes de que Zammad termine de cargar el perfil.
      var sessionReady = Boolean(currentSession());
      if (sessionReady && existing) existing.remove();
      return;
    }

    var sidebar = findSidebarSurface();
    if (!sidebar) return;
    if (sidebar.getBoundingClientRect().width < 120) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) {
      existing = document.createElement("nav");
      existing.className = "geimser-sidebar-shortcuts";
      existing.setAttribute("aria-label", "Accesos internos Geimser ITSM");
      existing.innerHTML = [
        '<a class="geimser-sidebar-shortcut" data-geimser-shortcut="users" href="#manage/users">',
        '  <span class="geimser-sidebar-shortcut-icon geimser-sidebar-shortcut-icon-users" aria-hidden="true"></span>',
        '  <span>Usuarios</span>',
        '</a>',
        '<a class="geimser-sidebar-shortcut" data-geimser-shortcut="users-cmdb" href="#geimser/users-cmdb">',
        '  <span class="geimser-sidebar-shortcut-icon geimser-sidebar-shortcut-icon-users" aria-hidden="true"></span>',
        '  <span>Usuarios CMDB</span>',
        '</a>',
        '<a class="geimser-sidebar-shortcut" data-geimser-shortcut="cmdb" href="#system/integration/idoit">',
        '  <span class="geimser-sidebar-shortcut-icon geimser-sidebar-shortcut-icon-cmdb" aria-hidden="true"></span>',
        '  <span>CMDB ITSM</span>',
        '</a>'
      ].join("");
    }

    var reference = sidebarReferenceItem(sidebar);
    var insertionNode = reference && reference.parentElement && /^(LI|DD|DT)$/i.test(reference.parentElement.tagName)
      ? reference.parentElement
      : reference;

    existing.classList.remove("is-fixed");
    existing.style.removeProperty("--geimser-sidebar-left");
    existing.style.removeProperty("--geimser-sidebar-width");

    if (insertionNode && insertionNode.parentElement) {
      if (existing.previousElementSibling !== insertionNode) {
        insertionNode.insertAdjacentElement("afterend", existing);
      }
    } else if (existing.parentElement !== sidebar) {
      sidebar.appendChild(existing);
    }

    var hash = window.location.hash || "";
    existing.querySelectorAll(".geimser-sidebar-shortcut").forEach(function (link) {
      var target = link.getAttribute("href");
      link.classList.toggle("is-active", Boolean(target && hash === target));
    });
  }

  function removeLegacyCmdbOverlay() {
    document.querySelectorAll(".geimser-cmdb-view").forEach(function (view) {
      view.remove();
    });

    if ((window.location.hash || "") === "#geimser/cmdb") {
      window.location.hash = "#system/integration/idoit";
    }
  }

  function markRouteState() {
    var app = document.querySelector("#app");
    if (!app) return;
    var hash = window.location.hash || "";
    var isProfile = /^#profile(?:\/|$)/.test(hash);
    var hasActivityFlow = /\bFlujo de Actividad\b/i.test((app.textContent || "").replace(/\s+/g, " "));
    var isTicketCreate = /^#ticket\/create(?:\/|$)/.test(hash);
    app.classList.toggle("geimser-route-profile", isProfile || hasActivityFlow);
    app.classList.toggle("geimser-route-ticket-create", isTicketCreate);
    app.classList.toggle("geimser-route-native", isProfile || hasActivityFlow || isTicketCreate);
    app.classList.toggle("geimser-route-activity-flow", hasActivityFlow);
  }

  function repairActivityFlowLayout() {
    var app = document.querySelector("#app");
    if (!app || !app.classList.contains("geimser-route-activity-flow")) return;

    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var propsToClear = [
      "background",
      "background-color",
      "color",
      "width",
      "min-width",
      "max-width",
      "writing-mode",
      "text-orientation",
      "word-break",
      "overflow-wrap",
      "white-space",
    ];

    function resetNode(el) {
      if (!el || el === app || el === document.body || el === document.documentElement) return;
      el.classList.remove("geimser-activity-surface");
      propsToClear.forEach(function (prop) {
        el.style.removeProperty(prop);
      });
      el.style.setProperty("writing-mode", "horizontal-tb", "important");
      el.style.setProperty("text-orientation", "mixed", "important");
      el.style.setProperty("word-break", "normal", "important");
      el.style.setProperty("overflow-wrap", "break-word", "important");
      el.style.setProperty("white-space", "normal", "important");
    }

    var anchors = Array.from(app.querySelectorAll("h1, h2, h3, header, aside, section, article, div")).filter(function (el) {
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!/\bFlujo de Actividad\b/i.test(text)) return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 20 && rect.height > 20 && rect.left > 220 && rect.left < viewportWidth - 20;
    });

    anchors.forEach(function (anchor) {
      var current = anchor;
      var depth = 0;
      while (current && current !== app && depth < 8) {
        var rect = current.getBoundingClientRect();
        var text = (current.textContent || "").replace(/\s+/g, " ").trim();
        if (rect.left > 220 && /\bFlujo de Actividad\b/i.test(text)) {
          resetNode(current);
          Array.from(current.querySelectorAll(".geimser-activity-surface, [style]")).forEach(resetNode);
        }
        current = current.parentElement;
        depth += 1;
      }
    });
  }

  function forcePopupContrast() {
    var popupSelectors = [
      "[role='menu']", ".dropdown-menu",
      "[class*='userMenu']", "[class*='UserMenu']",
      "[class*='profileMenu']", "[class*='ProfileMenu']",
      "[class*='accountMenu']", "[class*='AccountMenu']",
      ".js-profileSettings", ".js-profileMenu", ".js-accountMenu"
    ].join(", ");

    function looksLikeProfilePopup(popup) {
      var className = String(popup.className || "");
      var text = (popup.textContent || "").replace(/\s+/g, " ").trim();
      return /profile|userMenu|accountMenu|js-profile|js-account/i.test(className) ||
        /Modo oscuro|Perfil|Cerrar sesi[oó]n|Mi cuenta|Profile|Dark mode|Sign out|Logout/i.test(text);
    }

    function isDarkPopup(popup) {
      var savedTheme = "";
      try {
        savedTheme = localStorage.getItem("theme") || "";
      } catch (e) { }

      return document.documentElement.dataset.theme === "dark" ||
        savedTheme === "dark" ||
        document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark");
    }

    Array.from(document.querySelectorAll(popupSelectors)).forEach(function (popup) {
      var rect = popup.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 30) return;
      if (!looksLikeProfilePopup(popup)) return;

      popup.classList.add("geimser-popup-surface");
      popup.classList.add("geimser-profile-popup");
      var popupTheme = isDarkPopup(popup) ? "dark" : "light";
      if (popup.dataset.geimserPopupTheme !== popupTheme) {
        popup.dataset.geimserPopupTheme = popupTheme;
      }

    });
  }

  function ensureProfileLogoutFallback() {
    if (window.__geimserProfileLogoutFallbackInstalled) return;
    window.__geimserProfileLogoutFallbackInstalled = true;

    document.addEventListener("click", function (event) {
      var item = event.target && event.target.closest
        ? event.target.closest(".geimser-profile-popup a, .geimser-profile-popup button, .geimser-profile-popup [role='menuitem'], .geimser-profile-popup li")
        : null;
      if (!item) return;

      var text = (item.textContent || "").replace(/\s+/g, " ").trim();
      var href = item.getAttribute && (item.getAttribute("href") || "");
      var isLogout = /cerrar sesi[oó]n|logout|sign out/i.test(text + " " + href);
      if (!isLogout) return;

      if (/logout|sign_out|signout/i.test(href)) return;

      var nativeLogout = document.querySelector("a[href*='logout'], a[href*='sign_out'], a[href*='signout'], form[action*='logout'] button, form[action*='sign_out'] button");
      if (nativeLogout && nativeLogout !== item) {
        window.setTimeout(function () {
          nativeLogout.click();
        }, 80);
        return;
      }

      window.setTimeout(function () {
        if (!/#logout/i.test(window.location.hash || "")) {
          window.location.hash = "#logout";
        }
      }, 80);
    });
  }

  function fixSidebarSearchDropdowns() {
    var sidebar = findSidebarSurface();
    if (!sidebar) return;

    var sidebarRect = sidebar.getBoundingClientRect();
    if (sidebarRect.width < 60) return;

    // Paneles de sugerencias que Zammad renderiza dentro del sidebar
    var panels = Array.from(document.querySelectorAll(
      "#app [class*='search'] [class*='result']," +
      "#app [class*='search'] [class*='suggest']," +
      "#app [class*='search'] [class*='dropdown']," +
      "#app .js-results," +
      "#app .js-search-result," +
      "#app [class*='SearchResult']," +
      "#app [class*='Suggestions']"
    ));

    panels.forEach(function (panel) {
      // Solo procesar panels dentro del sidebar
      if (!sidebar.contains(panel)) return;

      var rect = panel.getBoundingClientRect();
      // Si el panel no es visible, ignorar
      if (rect.width < 30 || rect.height < 20) return;

      // Verificar si el panel está siendo clippeado (sale de la sidebar)
      var overflowsRight = rect.right > sidebarRect.right + 8;
      var overflowsBottom = rect.bottom > window.innerHeight - 20;

      if (overflowsRight || overflowsBottom) {
        panel.style.setProperty("position", "fixed", "important");
        panel.style.setProperty("z-index", "99999", "important");
        panel.style.setProperty("left", sidebarRect.left + "px", "important");
        panel.style.setProperty("width", sidebarRect.width + "px", "important");
        panel.style.setProperty("max-height", Math.min(480, window.innerHeight - rect.top - 20) + "px", "important");
        panel.style.setProperty("overflow-y", "auto", "important");
        panel.style.setProperty("background", "#ffffff", "important");
        panel.style.setProperty("color", "#1d1d1f", "important");
        panel.style.setProperty("border", "1px solid rgba(0,31,61,0.14)", "important");
        panel.style.setProperty("border-radius", "10px", "important");
        panel.style.setProperty("box-shadow", "0 16px 48px rgba(0,31,61,0.22)", "important");
      }

      // Garantizar contraste dentro del panel
      Array.from(panel.querySelectorAll("*")).forEach(function (child) {
        var text = (child.textContent || "").trim();
        if (!text && !child.matches("a, button, [role='option']")) return;
        child.style.setProperty("color", "#1d1d1f", "important");
      });
      Array.from(panel.querySelectorAll("a, [role='option'], [class*='item']")).forEach(function (item) {
        item.style.setProperty("color", "#004b8d", "important");
      });
    });
  }

  function normalizeSidebarFloatingUi() {
    var app = document.querySelector("#app");
    if (!app) return;

    Array.from(app.querySelectorAll(".geimser-sidebar-search-shell")).forEach(function (shell) {
      shell.classList.remove("geimser-sidebar-search-shell");
    });

    var navSurfaces = Array.from(app.querySelectorAll(
      ".navigation, .sidebar, .appSidebar, .mainNavigation, .geimser-nav-surface, [class*='Navigation'], [class*='navigation'], [class*='Sidebar'], [class*='sidebar']"
    )).filter(function (el) {
      var rect = el.getBoundingClientRect();
      return rect.left >= -1 &&
        rect.left < 16 &&
        rect.width >= 120 &&
        rect.width <= 360 &&
        rect.height >= window.innerHeight * 0.55;
    });

    var sidebarRight = navSurfaces.reduce(function (right, el) {
      return Math.max(right, el.getBoundingClientRect().right);
    }, 0);

    if (sidebarRight < 120) return;

    Array.from(app.querySelectorAll("input, textarea, .form-control")).forEach(function (control) {
      var rect = control.getBoundingClientRect();
      var label = [
        control.getAttribute("type"),
        control.getAttribute("placeholder"),
        control.getAttribute("aria-label"),
        control.className
      ].join(" ");

      if (rect.left < sidebarRight && rect.top < 180 && /search|buscar|filter|filtro|text/i.test(label)) {
        control.classList.add("geimser-sidebar-search-control");
      }
    });

    Array.from(document.querySelectorAll(".dropdown-menu, .popover, [role='menu']")).forEach(function (overlay) {
      var rect = overlay.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 24 || rect.left > sidebarRight + 24 || rect.top > window.innerHeight - 36) return;

      overlay.classList.add("geimser-sidebar-overlay");
      var first = overlay.firstElementChild;
      if (!first) return;

      var firstRect = first.getBoundingClientRect();
      if (firstRect.height >= 38 && firstRect.height <= 110) {
        first.classList.add("geimser-sidebar-overlay-header");
      }
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

  function setImportantStyle(el, property, value) {
    el.style.setProperty(property, value, "important");
  }

  function setReadableColor(el, bg, options) {
    var isDark = luminance(bg) < 0.42;
    var color = isDark ? "#f8fbff" : "#1d1d1f";

    if (options && options.link) {
      color = isDark ? "#bfe7ff" : "#004b8d";
    } else if (options && options.muted) {
      color = isDark ? "#d7e7f6" : "#5f6672";
    }

    setImportantStyle(el, "color", color);
    if (el.matches("svg, .icon, [class*='icon'], [class*='Icon']")) {
      setImportantStyle(el, "fill", "currentColor");
      setImportantStyle(el, "stroke", "currentColor");
    }
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
    var nav = el.closest(".navigation, .sidebar, .appSidebar, .mainNavigation, .geimser-nav-surface, .geimser-sidebar-footer, .geimser-sidebar-dock");
    return Boolean(nav && (nav.matches(".geimser-sidebar-footer, .geimser-sidebar-dock") || isRealSidebarSurface(nav)));
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
        setImportantStyle(el, "color", "#ffffff");
        Array.from(el.querySelectorAll("*")).forEach(function (child) {
          setImportantStyle(child, "color", "#ffffff");
        });
        return;
      }

      if (bgIsLight) {
        if (el.matches("a, .link")) {
          setImportantStyle(el, "color", "#004b8d");
        } else if (el.matches("label, legend, small, .small, [class*='label'], [class*='Label'], [class*='muted'], [class*='hint']")) {
          setImportantStyle(el, "color", "#5f6672");
        } else {
          setImportantStyle(el, "color", "#1d1d1f");
        }
        el.closest(".panel, .box, .widget, .card, .table, section, article")?.classList.add("geimser-light-surface");
      } else {
        setImportantStyle(el, "color", el.matches("a, .link") ? "#8fd3ff" : "#f3f7fb");
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

      setImportantStyle(el, "color", "#1f2937");
      setImportantStyle(el, "background-color", "#eef3f8");
      el.style.fontWeight = "700";

      Array.from(el.querySelectorAll("*")).forEach(function (child) {
        setImportantStyle(child, "color", "#1f2937");
        setImportantStyle(child, "background-color", "transparent");
      });

      var parent = el.parentElement;
      var depth = 0;
      while (parent && depth < 3) {
        var parentRect = parent.getBoundingClientRect();
        if (parentRect.height > 12 && parentRect.height < 72 && parentRect.width > rect.width * 0.8 && !isInsideNavigation(parent)) {
          setImportantStyle(parent, "background-color", "#eef3f8");
          setImportantStyle(parent, "color", "#1f2937");
        }
        parent = parent.parentElement;
        depth += 1;
      }
    });
  }

  function markNavigationSurface() {
    var app = document.querySelector("#app");
    if (!app) return;

    Array.from(app.querySelectorAll(".geimser-nav-surface")).forEach(function (nav) {
      if (!isRealSidebarSurface(nav)) {
        nav.classList.remove("geimser-nav-surface");
      }
    });

    var sidebar = findSidebarSurface();
    if (!sidebar) return;
    sidebar.classList.add("geimser-nav-surface");
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

  function passwordToggleIcon(visible) {
    if (visible) {
      return [
        '<svg viewBox="0 0 24 24" aria-hidden="true">',
        '<path d="M17.94 17.94A10.9 10.9 0 0 1 12 20C7 20 2.73 16.89 1 12a11.5 11.5 0 0 1 5.06-5.94"/>',
        '<path d="M9.9 4.24A10.8 10.8 0 0 1 12 4c5 0 9.27 3.11 11 8a11.5 11.5 0 0 1-2.16 3.19"/>',
        '<path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/>',
        '<path d="M1 1l22 22"/>',
        '</svg>'
      ].join("");
    }

    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true">',
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>',
      '<circle cx="12" cy="12" r="3"/>',
      '</svg>'
    ].join("");
  }

  function ensurePasswordVisibilityToggle() {
    var fields = Array.from(document.querySelectorAll(".hero-unit input, .login input")).filter(function (input) {
      var label = [
        input.type,
        input.name,
        input.id,
        input.autocomplete,
        input.placeholder,
        input.getAttribute("aria-label")
      ].join(" ");

      return /password|contrase/i.test(label);
    });

    fields.forEach(function (input) {
      if (input.closest(".geimser-password-field")) return;

      var wrapper = document.createElement("div");
      wrapper.className = "geimser-password-field";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "geimser-password-toggle";
      button.setAttribute("aria-label", "Mostrar contraseña");
      button.setAttribute("title", "Mostrar contraseña");
      button.innerHTML = passwordToggleIcon(false);

      button.addEventListener("click", function () {
        var visible = input.type === "password";
        input.type = visible ? "text" : "password";
        button.classList.toggle("is-visible", visible);
        button.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
        button.setAttribute("title", visible ? "Ocultar contraseña" : "Mostrar contraseña");
        button.innerHTML = passwordToggleIcon(visible);
        input.focus();
      });

      wrapper.appendChild(button);
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

    markActivitySurfaces(app);

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

  function markActivitySurfaces(app) {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var titleRegex = /Flujo de Actividad/i;
    var itemRegex = /(Admin Geimser|inici[oó] nueva sesi[oó]n|actualiz[oó] el usuario|cre[oó] el usuario|Lunes \d{1,2}:\d{2})/i;
    var candidates = Array.from(app.querySelectorAll("aside, section, article, div, nav")).filter(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 160) return false;
      if (rect.left < viewportWidth * 0.68) return false;
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return titleRegex.test(text) || itemRegex.test(text);
    });

    candidates.forEach(function (el) {
      var current = el;
      var best = el;
      var depth = 0;

      while (current && current !== app && depth < 5) {
        var rect = current.getBoundingClientRect();
        if (rect.left >= viewportWidth * 0.68 && rect.width >= 180 && rect.height >= best.getBoundingClientRect().height) {
          best = current;
        }
        current = current.parentElement;
        depth += 1;
      }

      best.classList.add("geimser-activity-surface");
    });
  }

  function forceActivityContrast() {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var surfaces = Array.from(document.querySelectorAll("#app .geimser-activity-surface, #app aside, #app section, #app div")).filter(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width < 170 || rect.height < 150) return false;
      if (rect.left < viewportWidth * 0.68) return false;

      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      var bg = parseRgb(window.getComputedStyle(el).backgroundColor);
      var isDarkBlue = bg && bg.b > bg.r && bg.b >= bg.g && luminance(bg) < 0.16;

      return el.classList.contains("geimser-activity-surface") ||
        /Flujo de Actividad|Admin Geimser|Lunes \d{1,2}:\d{2}/i.test(text) ||
        isDarkBlue;
    });

    surfaces.forEach(function (surface) {
      surface.classList.add("geimser-activity-surface");
      surface.style.setProperty("background", "#173f78", "important");
      surface.style.setProperty("background-color", "#173f78", "important");
      surface.style.setProperty("color", "#ffffff", "important");

      Array.from(surface.querySelectorAll("*")).forEach(function (el) {
        if (el.matches("input, textarea, select, option")) return;

        var text = (el.textContent || "").replace(/\s+/g, " ").trim();
        var rect = el.getBoundingClientRect();
        if (!text && !el.matches("svg, .icon, [class*='icon'], [class*='Icon']")) return;
        if (rect.width < 2 || rect.height < 2) return;

        if (el.matches(".avatar, [class*='avatar'], [class*='Avatar']")) {
          el.style.setProperty("background", "#f28c18", "important");
          el.style.setProperty("background-color", "#f28c18", "important");
          el.style.setProperty("color", "#071c2b", "important");
          return;
        }

        if (el.matches("a, .link, [role='link']")) {
          el.style.setProperty("color", "#d9efff", "important");
          return;
        }

        if (el.matches("small, time, [class*='meta'], [class*='Meta'], [class*='time'], [class*='Time']")) {
          el.style.setProperty("color", "#d7e7f6", "important");
          return;
        }

        el.style.setProperty("color", "#ffffff", "important");
      });
    });
  }

  function enforceGlobalContrast() {
    var app = document.querySelector("#app");
    if (!app) return;

    var selectors = [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "label", "legend", "span", "small", "a", "button",
      "li", "td", "th", "strong", "em", "time", "summary",
      "[role='button']", "[role='link']", "[role='tab']", "[role='menuitem']",
      "[class*='label']", "[class*='Label']", "[class*='title']", "[class*='Title']",
      "[class*='headline']", "[class*='Headline']", "[class*='text']", "[class*='Text']",
      "svg", ".icon", "[class*='icon']", "[class*='Icon']"
    ].join(",");

    Array.from(app.querySelectorAll(selectors)).forEach(function (el) {
      if (el.matches("input, textarea, select, option, canvas, img, video")) return;

      var rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      var isIcon = el.matches("svg, .icon, [class*='icon'], [class*='Icon']");
      if (!text && !isIcon) return;

      var style = window.getComputedStyle(el);
      var fg = parseRgb(style.color);
      var bg = effectiveBackground(el);
      if (!fg || !bg) return;

      var minRatio = /^(H[1-6]|LABEL|LEGEND|BUTTON)$/i.test(el.tagName) || el.matches("button, [role='button']")
        ? 4.5
        : 4.0;
      var ratio = contrastRatio(fg, bg);
      var isWhiteOnLight = luminance(bg) > 0.72 && /rgba?\(255,\s*255,\s*255/i.test(style.color);
      var needsFix = ratio < minRatio || isWhiteOnLight;
      if (!needsFix) return;

      setReadableColor(el, bg, {
        link: el.matches("a, .link, [role='link']"),
        muted: el.matches("small, time, .small, [class*='muted'], [class*='hint'], [class*='meta'], [class*='Meta']")
      });
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

  function meshAgentInstallUrl() {
    return meshLoginUrl("/meshagents");
  }

  function meshDevicesUrl() {
    return meshLoginUrl("/");
  }

  function clientPlatformLabel() {
    var ua = navigator.userAgent || "";
    var platform = navigator.platform || "";
    if (/Win/i.test(platform) || /Windows/i.test(ua)) return "Windows";
    if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua)) return "macOS";
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Linux/i.test(platform) || /Linux/i.test(ua)) return "Linux";
    return "este equipo";
  }

  function clientPlatformInstallerHint() {
    var platform = clientPlatformLabel();
    if (platform === "Windows") return "descarga el instalador Windows (.exe)";
    if (platform === "macOS") return "descarga el instalador macOS";
    if (platform === "Linux") return "descarga el instalador Linux";
    if (platform === "Android" || platform === "iOS") return "usa un equipo Windows, macOS o Linux para instalar el agente remoto";
    return "elige el sistema operativo correcto del equipo";
  }

  function clientPlatformPermissionLabel() {
    var platform = clientPlatformLabel();
    if (platform === "Windows") return "Windows";
    if (platform === "macOS") return "macOS";
    if (platform === "Linux") return "Linux";
    return "el sistema operativo";
  }

  function remoteInstallInstructions() {
    return [
      "Instalacion agente remoto Geimser",
      "",
      "1. Abre el instalador desde Geimser ITSM.",
      "2. En MeshCentral entra a Mis Dispositivos y " + clientPlatformInstallerHint() + ".",
      "3. Ejecuta el instalador una sola vez en el equipo que necesita soporte.",
      "4. Acepta los permisos que pida " + clientPlatformPermissionLabel() + ".",
      "5. Cuando el equipo aparezca online, vuelve a Geimser ITSM y usa Tomar control."
    ].join("\n");
  }

  function maybePromptRemoteInstall(modal, assets, options) {
    if (!internalSidebarAccess() || assets.length) return;
    options = options || {};

    if (options.autocheck) {
      try {
        var key = "geimserRemoteInstallPromptSeenThisTab";
        if (window.sessionStorage && sessionStorage.getItem(key) === "true") return;
        if (window.sessionStorage) sessionStorage.setItem(key, "true");
      } catch (_error) {
        // Best effort only; the prompt should never block normal navigation.
      }
    }

    window.setTimeout(function () {
      if (!document.body.contains(modal)) return;
      openRemoteModal("registrar");
    }, 350);
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

  function formatRemoteDate(value) {
    if (!value) return "Sin dato";

    try {
      return new Date(value).toLocaleString();
    } catch (_error) {
      return String(value);
    }
  }

  function detailValue(value) {
    if (Array.isArray(value)) return value.length ? value.join(" / ") : "Sin dato";
    return value || "Sin dato";
  }

  function cmdbDetailRows(asset) {
    var details = asset.details || {};
    return [
      ["Nombre", asset.name || asset.hostname],
      ["Hostname", asset.hostname || details.computer_name],
      ["Grupo Mesh", asset.group],
      ["Estado", remoteAssetStatusLabel(asset.status)],
      ["Sistema operativo", details.os_caption || asset.os],
      ["Version / build", [details.os_version, details.os_build].filter(Boolean).join(" / ")],
      ["IP principal", asset.ip || details.last_address],
      ["Interfaces de red", details.network_interfaces || []],
      ["Fabricante", details.manufacturer],
      ["Modelo", details.model],
      ["Serie", details.serial],
      ["Agente Mesh", [details.agent_id, details.agent_version].filter(Boolean).join(" / ")],
      ["Capacidades Mesh", details.mesh_capabilities],
      ["Mesh node ID", details.mesh_node_id || asset.id],
      ["Mesh group ID", details.mesh_group_id || asset.mesh_group_id],
      ["Primer contacto", formatRemoteDate(details.first_seen_at)],
      ["Ultima conexion", formatRemoteDate(details.last_connect_at)],
      ["Ultimo ping", formatRemoteDate(details.last_ping_at)],
      ["Actualizado en ITSM", formatRemoteDate(asset.updated_at)]
    ];
  }

  function renderCmdbAssetDetail(container, asset) {
    var isOnline = asset.status === "online";
    var rows = cmdbDetailRows(asset).filter(function (row) {
      return detailValue(row[1]) !== "Sin dato";
    });

    container.innerHTML = [
      '<section class="geimser-cmdb-detail" aria-label="Detalle nativo del equipo">',
      '  <div class="geimser-cmdb-detail-head">',
      '    <div>',
      '      <span>Detalle nativo ITSM</span>',
      '      <strong>' + escapeHtml(asset.name || asset.hostname || "Equipo remoto") + '</strong>',
      '    </div>',
      '    <em class="' + (isOnline ? "is-online" : "is-offline") + '">' + remoteAssetStatusLabel(asset.status) + '</em>',
      '  </div>',
      '  <div class="geimser-cmdb-detail-grid">',
      rows.map(function (row) {
        return [
          '<article>',
          '  <span>' + escapeHtml(row[0]) + '</span>',
          '  <strong>' + escapeHtml(detailValue(row[1])) + '</strong>',
          '</article>'
        ].join("");
      }).join(""),
      '  </div>',
      '  <div class="geimser-cmdb-detail-actions">',
      '    <button type="button" data-cmdb-session="' + escapeHtml(asset.session_url || meshLoginUrl("/")) + '">Tomar control</button>',
      '  </div>',
      '</section>'
    ].join("");

    var control = container.querySelector("[data-cmdb-session]");
    if (control) {
      control.addEventListener("click", function () {
        var sessionUrl = control.getAttribute("data-cmdb-session") || meshLoginUrl("/");
        var modal = ensureRemoteModal();
        openRemoteModal("equipos");
        modal.querySelector(".geimser-remote-frame").src = sessionUrl;
        modal.querySelector(".geimser-remote-open").href = sessionUrl;
      });
    }
  }

  function renderRemoteAssets(modal, payload) {
    var container = modal.querySelector(".geimser-remote-assets");
    if (!container) return;

    var assets = (payload && payload.assets) || [];
    if (!assets.length) {
      container.innerHTML = [
        '<div class="geimser-remote-empty">',
        '  <strong>Este navegador no tiene equipos Mesh sincronizados todavia.</strong>',
        '  <span>No se detecto el agente remoto. Instala el agente Geimser para ' + escapeHtml(clientPlatformLabel()) + ' y cuando aparezca online en MeshCentral quedara registrado aqui.</span>',
        '  <div class="geimser-remote-empty-actions">',
        '    <a href="' + escapeHtml(meshAgentInstallUrl()) + '" target="_blank" rel="noopener">Descargar instalador</a>',
        '    <button type="button" data-remote-empty-install>Ver pasos</button>',
        '    <a href="' + escapeHtml(meshDevicesUrl()) + '" target="_blank" rel="noopener">Abrir MeshCentral</a>',
        '  </div>',
        '</div>'
      ].join("");
      var installButton = container.querySelector("[data-remote-empty-install]");
      if (installButton) {
        installButton.addEventListener("click", function () {
          if (modal.GeimserSetFlow) modal.GeimserSetFlow("registrar");
        });
      }
      maybePromptRemoteInstall(modal, assets);
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

  var remoteInstallAutocheckStarted = false;

  function checkRemoteInstallFirstRun() {
    if (remoteInstallAutocheckStarted || !internalSidebarAccess()) return;

    remoteInstallAutocheckStarted = true;
    window.setTimeout(function () {
      fetch("/geimser/remote/assets", {
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      }).then(function (response) {
        if (!response.ok) throw new Error("remote assets autocheck failed");
        return response.json();
      }).then(function (payload) {
        var modal = ensureRemoteModal();
        maybePromptRemoteInstall(modal, (payload && payload.assets) || [], { autocheck: true });
      }).catch(function () {
        remoteInstallAutocheckStarted = false;
      });
    }, 1400);
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
    view.setAttribute("aria-label", "CMDB Geimser ITSM");
    view.innerHTML = [
      '<div class="geimser-cmdb-shell">',
      '  <header class="geimser-cmdb-header">',
      '    <div>',
      '      <div class="geimser-cmdb-kicker">Geimser ITSM</div>',
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
        '  <span>No se detecto Mesh instalado. Usa Registrar equipo, ' + escapeHtml(clientPlatformInstallerHint()) + ' y vuelve a actualizar cuando aparezca online.</span>',
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
      assets.map(function (asset, index) {
        var isOnline = asset.status === "online";
        return [
          '<div class="geimser-cmdb-row" role="row">',
          '  <span role="cell"><strong>' + escapeHtml(asset.name || asset.hostname || "Equipo remoto") + '</strong><small>' + escapeHtml(asset.hostname || "") + '</small></span>',
          '  <span role="cell">' + escapeHtml(asset.group || "Sin grupo") + '</span>',
          '  <span role="cell">' + escapeHtml(asset.os || "Sistema no informado") + '</span>',
          '  <span role="cell">' + escapeHtml(asset.ip || remoteAssetLastSeen(asset)) + '</span>',
          '  <span role="cell"><em class="' + (isOnline ? "is-online" : "is-offline") + '">' + remoteAssetStatusLabel(asset.status) + '</em></span>',
          '  <span role="cell" class="geimser-cmdb-row-actions"><button type="button" data-cmdb-detail="' + index + '">Detalle</button><button type="button" data-cmdb-session="' + escapeHtml(asset.session_url || meshLoginUrl("/")) + '">Control</button></span>',
          '</div>'
        ].join("");
      }).join(""),
      '</div>',
      '<div class="geimser-cmdb-detail-slot"></div>'
    ].join("");

    var detailSlot = content.querySelector(".geimser-cmdb-detail-slot");
    content.querySelectorAll("[data-cmdb-detail]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = Number(button.getAttribute("data-cmdb-detail"));
        var asset = assets[index];
        if (!asset) return;

        content.querySelectorAll(".geimser-cmdb-row").forEach(function (row) {
          row.classList.remove("is-selected");
        });
        button.closest(".geimser-cmdb-row")?.classList.add("is-selected");
        renderCmdbAssetDetail(detailSlot, asset);
      });
    });

    content.querySelectorAll("[data-cmdb-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        var sessionUrl = button.getAttribute("data-cmdb-session") || meshLoginUrl("/");
        var modal = ensureRemoteModal();
        openRemoteModal("equipos");
        modal.querySelector(".geimser-remote-frame").src = sessionUrl;
        modal.querySelector(".geimser-remote-open").href = sessionUrl;
      });
    });

    if (assets[0]) {
      var firstButton = content.querySelector("[data-cmdb-detail='0']");
      if (firstButton) firstButton.closest(".geimser-cmdb-row")?.classList.add("is-selected");
      renderCmdbAssetDetail(detailSlot, assets[0]);
    }
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

  function userCmdbStateLabel(state) {
    if (state === "online") return "Online";
    if (state === "offline") return "Offline";
    return "Sin equipo";
  }

  function userCmdbPlatformLabel(user) {
    var platform = user.platform || {};
    return [platform.cliente, platform.servicio, platform.campana].filter(Boolean).join(" / ") || "Sin plataforma";
  }

  function ensureUserCmdbView() {
    var existing = document.querySelector(".geimser-user-cmdb-view");
    if (existing) return existing;

    var view = document.createElement("section");
    view.className = "geimser-user-cmdb-view";
    view.setAttribute("aria-label", "Usuarios y equipos CMDB");
    view.innerHTML = [
      '<div class="geimser-user-cmdb-shell">',
      '  <header class="geimser-user-cmdb-header">',
      '    <div>',
      '      <span>Gestion operacional</span>',
      '      <h1>Usuarios y equipos</h1>',
      '      <p>Vista de resolucion para asociar usuarios Geimser con activos remotos, estado y toma de control.</p>',
      '    </div>',
      '    <div class="geimser-user-cmdb-actions">',
      '      <button type="button" class="geimser-user-cmdb-refresh">Actualizar</button>',
      '      <button type="button" class="geimser-user-cmdb-close">Cerrar</button>',
      '    </div>',
      '  </header>',
      '  <section class="geimser-user-cmdb-filters" aria-label="Filtros de usuarios CMDB">',
      '    <label><span>Buscar</span><input class="geimser-user-cmdb-search" type="search" placeholder="Usuario, email, equipo, plataforma"></label>',
      '    <label><span>Estado</span><select class="geimser-user-cmdb-state"><option value="">Todos</option><option value="online">Online</option><option value="offline">Offline</option><option value="unassigned">Sin equipo</option></select></label>',
      '    <label><span>Plataforma</span><select class="geimser-user-cmdb-platform"><option value="">Todas</option></select></label>',
      '  </section>',
      '  <div class="geimser-user-cmdb-stats" aria-label="Resumen usuarios CMDB"></div>',
      '  <div class="geimser-user-cmdb-workspace">',
      '    <div class="geimser-user-cmdb-table-wrap"></div>',
      '    <aside class="geimser-user-cmdb-detail" aria-label="Detalle usuario CMDB"></aside>',
      '  </div>',
      '</div>'
    ].join("");

    view.querySelector(".geimser-user-cmdb-close").addEventListener("click", function () {
      view.classList.remove("is-open");
      if ((window.location.hash || "") === "#geimser/users-cmdb") window.location.hash = "#dashboard";
    });

    view.querySelector(".geimser-user-cmdb-refresh").addEventListener("click", function () {
      loadUserCmdbView(view, true);
    });

    ["input", "change"].forEach(function (eventName) {
      view.querySelector(".geimser-user-cmdb-search").addEventListener(eventName, function () {
        renderUserCmdbView(view);
      });
      view.querySelector(".geimser-user-cmdb-state").addEventListener(eventName, function () {
        renderUserCmdbView(view);
      });
      view.querySelector(".geimser-user-cmdb-platform").addEventListener(eventName, function () {
        renderUserCmdbView(view);
      });
    });

    document.body.appendChild(view);
    return view;
  }

  function userCmdbFilteredUsers(view) {
    var payload = view.__geimserUserCmdbPayload || {};
    var users = payload.users || [];
    var search = (view.querySelector(".geimser-user-cmdb-search").value || "").toLowerCase().trim();
    var state = view.querySelector(".geimser-user-cmdb-state").value || "";
    var platform = view.querySelector(".geimser-user-cmdb-platform").value || "";

    return users.filter(function (user) {
      if (state && user.state !== state) return false;
      if (platform && userCmdbPlatformLabel(user) !== platform) return false;
      if (!search) return true;

      var assetsText = (user.assets || []).map(function (asset) {
        return [asset.name, asset.hostname, asset.ip, asset.group, asset.os].filter(Boolean).join(" ");
      }).join(" ");

      return [
        user.name,
        user.login,
        user.email,
        user.organization,
        user.platform && user.platform.area,
        user.platform && user.platform.cargo,
        userCmdbPlatformLabel(user),
        assetsText
      ].filter(Boolean).join(" ").toLowerCase().indexOf(search) >= 0;
    });
  }

  function populateUserCmdbPlatforms(view, users) {
    var select = view.querySelector(".geimser-user-cmdb-platform");
    var current = select.value || "";
    var platforms = Array.from(new Set(users.map(userCmdbPlatformLabel))).sort();
    select.innerHTML = '<option value="">Todas</option>' + platforms.map(function (label) {
      return '<option value="' + escapeHtml(label) + '">' + escapeHtml(label) + '</option>';
    }).join("");
    if (platforms.indexOf(current) >= 0) select.value = current;
  }

  function renderUserCmdbStats(view, users, filtered) {
    var stats = view.querySelector(".geimser-user-cmdb-stats");
    var summary = {
      total: users.length,
      shown: filtered.length,
      online: filtered.filter(function (user) { return user.state === "online"; }).length,
      offline: filtered.filter(function (user) { return user.state === "offline"; }).length,
      unassigned: filtered.filter(function (user) { return user.state === "unassigned"; }).length
    };

    stats.innerHTML = [
      '<article><span>Total usuarios</span><strong>' + summary.total + '</strong></article>',
      '<article><span>Vista filtrada</span><strong>' + summary.shown + '</strong></article>',
      '<article><span>Online</span><strong>' + summary.online + '</strong></article>',
      '<article><span>Offline</span><strong>' + summary.offline + '</strong></article>',
      '<article><span>Sin equipo</span><strong>' + summary.unassigned + '</strong></article>'
    ].join("");
  }

  function renderUserCmdbDetail(view, user) {
    var detail = view.querySelector(".geimser-user-cmdb-detail");
    if (!user) {
      detail.innerHTML = '<div class="geimser-user-cmdb-empty"><strong>Selecciona un usuario</strong><span>El detalle mostrara equipos asociados, plataforma y acciones remotas.</span></div>';
      return;
    }

    var assets = user.assets || [];
    detail.innerHTML = [
      '<div class="geimser-user-cmdb-detail-head">',
      '  <span>' + escapeHtml(user.platform?.area || user.organization || "Usuario ITSM") + '</span>',
      '  <strong>' + escapeHtml(user.name || user.login) + '</strong>',
      '  <em class="is-' + escapeHtml(user.state || "unassigned") + '">' + escapeHtml(userCmdbStateLabel(user.state)) + '</em>',
      '</div>',
      '<dl class="geimser-user-cmdb-meta">',
      '  <div><dt>Email</dt><dd>' + escapeHtml(user.email || user.login || "Sin dato") + '</dd></div>',
      '  <div><dt>Cargo</dt><dd>' + escapeHtml(user.platform?.cargo || "Sin dato") + '</dd></div>',
      '  <div><dt>Plataforma</dt><dd>' + escapeHtml(userCmdbPlatformLabel(user)) + '</dd></div>',
      '</dl>',
      '<div class="geimser-user-cmdb-assets">',
      '  <h2>Equipos asociados</h2>',
      assets.length ? assets.map(function (asset) {
        return [
          '<article>',
          '  <div>',
          '    <strong>' + escapeHtml(asset.name || asset.hostname || "Equipo remoto") + '</strong>',
          '    <span>' + escapeHtml([asset.hostname, asset.ip, asset.os].filter(Boolean).join(" | ") || "Sin detalle tecnico") + '</span>',
          '  </div>',
          '  <em class="' + (asset.status === "online" ? "is-online" : "is-offline") + '">' + escapeHtml(remoteAssetStatusLabel(asset.status)) + '</em>',
          '  <button type="button" data-user-cmdb-session="' + escapeHtml(asset.session_url || meshLoginUrl("/")) + '">Control</button>',
          '</article>'
        ].join("");
      }).join("") : '<div class="geimser-user-cmdb-empty"><strong>Sin equipo asociado</strong><span>Queda pendiente para asignacion manual o cruce por inventario.</span></div>',
      '</div>'
    ].join("");

    detail.querySelectorAll("[data-user-cmdb-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        var sessionUrl = button.getAttribute("data-user-cmdb-session") || meshLoginUrl("/");
        var modal = ensureRemoteModal();
        openRemoteModal("equipos");
        modal.querySelector(".geimser-remote-frame").src = sessionUrl;
        modal.querySelector(".geimser-remote-open").href = sessionUrl;
      });
    });
  }

  function renderUserCmdbView(view) {
    var payload = view.__geimserUserCmdbPayload || {};
    var users = payload.users || [];
    populateUserCmdbPlatforms(view, users);

    var filtered = userCmdbFilteredUsers(view);
    renderUserCmdbStats(view, users, filtered);

    var tableWrap = view.querySelector(".geimser-user-cmdb-table-wrap");
    if (!users.length) {
      tableWrap.innerHTML = '<div class="geimser-user-cmdb-empty"><strong>No hay usuarios Geimser para mostrar.</strong><span>Primero carga el subconjunto de usuarios de plataforma o revisa que existan usuarios @geimser.local.</span></div>';
      renderUserCmdbDetail(view, null);
      return;
    }

    tableWrap.innerHTML = [
      '<div class="geimser-user-cmdb-table" role="table" aria-label="Usuarios y equipos">',
      '  <div class="geimser-user-cmdb-row is-head" role="row">',
      '    <span role="columnheader">Usuario</span>',
      '    <span role="columnheader">Plataforma</span>',
      '    <span role="columnheader">Equipo</span>',
      '    <span role="columnheader">Estado</span>',
      '    <span role="columnheader">Accion</span>',
      '  </div>',
      filtered.map(function (user, index) {
        var primary = (user.assets || [])[0];
        return [
          '<button type="button" class="geimser-user-cmdb-row" role="row" data-user-cmdb-index="' + index + '">',
          '  <span role="cell"><strong>' + escapeHtml(user.name || user.login) + '</strong><small>' + escapeHtml(user.email || user.login || "") + '</small></span>',
          '  <span role="cell"><strong>' + escapeHtml(userCmdbPlatformLabel(user)) + '</strong><small>' + escapeHtml([user.platform?.area, user.platform?.cargo].filter(Boolean).join(" | ")) + '</small></span>',
          '  <span role="cell"><strong>' + escapeHtml(primary?.name || primary?.hostname || "Sin equipo") + '</strong><small>' + escapeHtml(primary ? [primary.ip, primary.os].filter(Boolean).join(" | ") : "Pendiente de asociar") + '</small></span>',
          '  <span role="cell"><em class="is-' + escapeHtml(user.state || "unassigned") + '">' + escapeHtml(userCmdbStateLabel(user.state)) + '</em></span>',
          '  <span role="cell" class="geimser-user-cmdb-row-actions">' + (primary ? '<b>Ver / controlar</b>' : '<b>Asignar</b>') + '</span>',
          '</button>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");

    tableWrap.querySelectorAll("[data-user-cmdb-index]").forEach(function (row) {
      row.addEventListener("click", function () {
        tableWrap.querySelectorAll(".geimser-user-cmdb-row").forEach(function (item) { item.classList.remove("is-selected"); });
        row.classList.add("is-selected");
        renderUserCmdbDetail(view, filtered[Number(row.getAttribute("data-user-cmdb-index"))]);
      });
    });

    var first = tableWrap.querySelector("[data-user-cmdb-index='0']");
    if (first) {
      first.classList.add("is-selected");
      renderUserCmdbDetail(view, filtered[0]);
    } else {
      renderUserCmdbDetail(view, null);
    }
  }

  function loadUserCmdbView(view, force) {
    if (!force && view.getAttribute("data-user-cmdb-loaded") === "true") return;
    view.setAttribute("data-user-cmdb-loaded", "true");
    view.querySelector(".geimser-user-cmdb-table-wrap").innerHTML = '<div class="geimser-user-cmdb-empty"><strong>Actualizando usuarios y equipos...</strong><span>Cruzando usuarios Geimser con activos remotos.</span></div>';
    view.querySelector(".geimser-user-cmdb-detail").innerHTML = "";

    fetch("/geimser/cmdb/users", {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("users cmdb failed");
      return response.json();
    }).then(function (payload) {
      view.__geimserUserCmdbPayload = payload || {};
      renderUserCmdbView(view);
    }).catch(function () {
      view.removeAttribute("data-user-cmdb-loaded");
      view.querySelector(".geimser-user-cmdb-table-wrap").innerHTML = '<div class="geimser-user-cmdb-empty is-error"><strong>No pudimos cargar usuarios CMDB.</strong><span>Revisa sesion, usuarios cargados y activos Mesh.</span></div>';
    });
  }

  function openUserCmdbView() {
    var view = ensureUserCmdbView();
    view.classList.add("is-open");
    loadUserCmdbView(view);
  }

  function syncCmdbRoute() {
    var view = document.querySelector(".geimser-cmdb-view");
    if ((window.location.hash || "") === "#geimser/cmdb") {
      if (!adminSidebarAccess()) {
        if (view) view.classList.remove("is-open");
        window.location.hash = "#dashboard";
        return;
      }
      openCmdbView();
    } else if (view) {
      view.classList.remove("is-open");
    }

    var userView = document.querySelector(".geimser-user-cmdb-view");
    if ((window.location.hash || "") === "#geimser/users-cmdb") {
      if (!adminSidebarAccess()) {
        if (userView) userView.classList.remove("is-open");
        window.location.hash = "#dashboard";
        return;
      }
      openUserCmdbView();
    } else if (userView) {
      userView.classList.remove("is-open");
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
      "Hola, necesitamos agregar tu equipo al centro remoto de Geimser ITSM.",
      "",
      "1. Te enviaremos el instalador generado desde Geimser ITSM para tu sistema operativo.",
      "2. Descárgalo y ejecútalo una sola vez en el equipo que necesita soporte.",
      "3. Acepta los permisos que pida el sistema operativo.",
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
      '      <div class="geimser-remote-subtitle">Conecta, registra equipos y toma control desde Geimser ITSM</div>',
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
      '        <span>2</span><strong>Instalador</strong><small>Crea un grupo y descarga el agente para este sistema.</small>',
      '      </button>',
      '      <button type="button" class="geimser-remote-flow" data-remote-flow="enviar">',
      '        <span>3</span><strong>Enviar</strong><small>Adjunta el instalador al ticket o correo del cliente.</small>',
      '      </button>',
      '      <button type="button" class="geimser-remote-flow" data-remote-flow="esperar">',
      '        <span>4</span><strong>Tomar control</strong><small>Cuando el agente aparezca online, entra por Ver equipos.</small>',
      '      </button>',
      '    </aside>',
      '    <main class="geimser-remote-stage">',
      '      <div class="geimser-remote-banner" role="status">',
      '        <strong>Equipos registrados</strong>',
      '        <span>Si el equipo ya existe, selecciónalo y abre escritorio remoto. Si no existe, usa Registrar equipo.</span>',
      '      </div>',
      '      <section class="geimser-remote-assets" aria-label="Activos remotos sincronizados"></section>',
      '      <section class="geimser-remote-install" aria-label="Instalacion de agente remoto" hidden>',
      '        <div class="geimser-remote-install-card">',
      '          <div>',
      '            <strong>Instalar agente en ' + escapeHtml(clientPlatformLabel()) + '</strong>',
      '            <span>No se detecto Mesh instalado en este equipo. El navegador no puede instalarlo en silencio: abre MeshCentral, ' + escapeHtml(clientPlatformInstallerHint()) + ' y ejecutalo una vez.</span>',
      '          </div>',
      '          <div class="geimser-remote-install-actions">',
      '            <a class="geimser-remote-agent-download is-primary" target="_blank" rel="noopener">Descargar instalador</a>',
      '            <a class="geimser-remote-agent-full" target="_blank" rel="noopener">Abrir MeshCentral</a>',
      '            <button type="button" class="geimser-remote-copy-install">Copiar pasos</button>',
      '          </div>',
      '        </div>',
      '        <ol class="geimser-remote-install-steps">',
      '          <li>En MeshCentral abre <strong>Mis Dispositivos</strong>.</li>',
      '          <li>Usa <strong>Agregar agente</strong> y elige <strong>' + escapeHtml(clientPlatformLabel()) + '</strong> o el sistema operativo real del equipo.</li>',
      '          <li>Ejecuta el instalador y espera que el equipo aparezca online.</li>',
      '        </ol>',
      '      </section>',
      '      <div class="geimser-remote-frame-shell">',
      '        <iframe class="geimser-remote-frame" title="Centro remoto Geimser ITSM"></iframe>',
      '      </div>',
      '    </main>',
      '  </div>',
      '</div>'
    ].join("");

    function setFlow(flow) {
      var title = "Equipos registrados";
      var detail = "Si el equipo ya existe, selecciónalo y abre escritorio remoto. Si no existe, usa Registrar equipo.";

      if (flow === "registrar") {
        title = "Descargar agente remoto";
        detail = "No se detecto Mesh instalado. Abre la descarga del agente para " + clientPlatformLabel() + " y ejecuta el instalador una sola vez en el equipo.";
      } else if (flow === "enviar") {
        title = "Enviar al notebook";
        detail = "Adjunta el instalador generado al ticket o correo. El usuario lo ejecuta una vez y el equipo aparecerá online.";
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
      modal.querySelector(".geimser-remote-install").hidden = flow === "equipos";
      modal.querySelector(".geimser-remote-frame-shell").classList.toggle("is-compact", flow === "equipos");
      if (flow === "equipos") {
        loadRemoteAssets(modal);
      }
    }

    modal.querySelector(".geimser-remote-close").addEventListener("click", function () {
      modal.classList.remove("is-open");
    });

    modal.querySelector(".geimser-remote-home").addEventListener("click", function () {
      setFlow("equipos");
    });

    modal.querySelector(".geimser-remote-register").addEventListener("click", function () {
      setFlow("registrar");
    });

    modal.querySelector(".geimser-remote-agent-download").href = meshAgentInstallUrl();
    modal.querySelector(".geimser-remote-agent-full").href = meshDevicesUrl();
    modal.querySelector(".geimser-remote-copy-install").addEventListener("click", function () {
      var button = this;
      var text = remoteInstallInstructions();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          button.textContent = "Pasos copiados";
          window.setTimeout(function () { button.textContent = "Copiar pasos"; }, 1800);
        }).catch(function () {
          window.prompt("Copia estos pasos", text);
        });
      } else {
        window.prompt("Copia estos pasos", text);
      }
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

    // MeshCentral usa una identidad administrativa compartida. Hasta que
    // exista una identidad separada para resolutores, el acceso es solo Admin.
    if (isPublicScreen || !adminSidebarAccess()) {
      if (existing) existing.remove();
      return;
    }

    var isTicketScreen = /^#ticket\/(create|zoom|edit)|^#ticket\//.test(hash);

    if (existing) {
      existing.textContent = isTicketScreen ? "Toma remota" : "Soporte remoto";
      existing.dataset.geimserRemoteFlow = isTicketScreen ? "equipos" : "registrar";
      return;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "geimser-remote-button";
    button.textContent = isTicketScreen ? "Toma remota" : "Soporte remoto";
    button.dataset.geimserRemoteFlow = isTicketScreen ? "equipos" : "registrar";
    button.addEventListener("click", function () {
      openRemoteModal(button.dataset.geimserRemoteFlow || "registrar");
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

  function nativeCmdbMountPoint() {
    if ((window.location.hash || "") !== "#system/integration/idoit") return null;

    var app = document.querySelector("#app");
    if (!app) return null;

    var logsHeading = Array.from(app.querySelectorAll("h1, h2, h3, h4, div, span")).find(function (el) {
      var rect = el.getBoundingClientRect();
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return rect.width > 20 && rect.height > 10 && text === "Logs recientes";
    });

    if (logsHeading) {
      var logsBlock = logsHeading.parentElement;
      while (logsBlock && logsBlock !== app) {
        var blockText = (logsBlock.textContent || "").replace(/\s+/g, " ");
        if (/Logs recientes/i.test(blockText) && /SIN ENTRADAS/i.test(blockText)) {
          return {
            parent: logsBlock.parentElement || app,
            after: logsBlock
          };
        }
        logsBlock = logsBlock.parentElement;
      }
    }

    var candidates = Array.from(app.querySelectorAll("main, section, div")).filter(function (el) {
      if (el.classList.contains("geimser-native-cmdb-assets")) return false;
      var rect = el.getBoundingClientRect();
      var text = (el.textContent || "").replace(/\s+/g, " ");
      return rect.width >= 420 &&
        rect.height >= 160 &&
        /Endpoint/i.test(text) &&
        /Logs recientes|SIN ENTRADAS/i.test(text);
    }).sort(function (a, b) {
      var ar = a.getBoundingClientRect();
      var br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    });

    return candidates[0] ? { parent: candidates[0], after: null } : null;
  }

  function nativeCmdbNativeSections() {
    if ((window.location.hash || "") !== "#system/integration/idoit") return null;

    var app = document.querySelector("#app");
    if (!app) return null;

    function findSection(label, requiredPattern) {
      var headings = Array.from(app.querySelectorAll("h1, h2, h3, h4, div, span")).filter(function (el) {
        var rect = el.getBoundingClientRect();
        var text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return rect.width > 20 && rect.height > 10 && text === label;
      });

      var matches = [];
      headings.forEach(function (heading) {
        var block = heading.parentElement;
        while (block && block !== app) {
          var blockText = (block.textContent || "").replace(/\s+/g, " ");
          var rect = block.getBoundingClientRect();
          if (rect.width >= 360 && rect.height >= 70 && requiredPattern.test(blockText)) {
            matches.push(block);
            break;
          }
          block = block.parentElement;
        }
      });

      return matches.sort(function (a, b) {
        var ar = a.getBoundingClientRect();
        var br = b.getBoundingClientRect();
        return (ar.width * ar.height) - (br.width * br.height);
      })[0] || null;
    }

    return {
      app: app,
      settings: findSection("Ajustes", /Endpoint/i),
      logs: findSection("Logs recientes", /SIN ENTRADAS|Logs recientes/i)
    };
  }

  function ensureNativeCmdbLayout(panel) {
    var sections = nativeCmdbNativeSections();
    if (!sections || !sections.app || !sections.settings) return false;

    var layout = sections.app.querySelector(".geimser-native-cmdb-layout");
    if (!layout) {
      layout = document.createElement("section");
      layout.className = "geimser-native-cmdb-layout";
      layout.setAttribute("aria-label", "Panel CMDB Geimser");
    }

    var main = layout.querySelector(".geimser-native-cmdb-main");
    if (!main) {
      main = document.createElement("div");
      main.className = "geimser-native-cmdb-main";
      layout.appendChild(main);
    }

    var side = layout.querySelector(".geimser-native-cmdb-side");
    if (!side) {
      side = document.createElement("aside");
      side.className = "geimser-native-cmdb-side";
      layout.appendChild(side);
    }

    sections.settings.classList.add("geimser-native-cmdb-settings");
    if (sections.logs) sections.logs.classList.add("geimser-native-cmdb-logs");

    if (!layout.parentElement) {
      sections.settings.parentElement.insertBefore(layout, sections.settings);
    }

    if (panel.parentElement !== main) main.appendChild(panel);
    if (sections.settings.parentElement !== side) side.appendChild(sections.settings);
    if (sections.logs && sections.logs.parentElement !== side) side.appendChild(sections.logs);

    return true;
  }

  function ensureNativeCmdbAssetsPanel() {
    var mount = nativeCmdbMountPoint();

    var panel = document.querySelector(".geimser-native-cmdb-assets");

    if (!panel) {
      panel = document.createElement("section");
      panel.className = "geimser-native-cmdb-assets";
      panel.setAttribute("aria-label", "Equipos registrados en CMDB ITSM");
      panel.innerHTML = [
        '<header class="geimser-native-cmdb-assets-head">',
        '  <div>',
        '    <span>Inventario MeshCentral</span>',
        '    <h2>Equipos registrados</h2>',
        '  </div>',
        '  <button type="button" class="geimser-native-cmdb-refresh">Actualizar</button>',
        '</header>',
        '<div class="geimser-cmdb-stats" aria-label="Resumen de equipos registrados"></div>',
        '<div class="geimser-cmdb-content"></div>'
      ].join("");

      panel.querySelector(".geimser-native-cmdb-refresh").addEventListener("click", function () {
        loadCmdbView(panel, true);
      });
    }

    if (ensureNativeCmdbLayout(panel)) return panel;

    if (!mount || !mount.parent) return null;

    if (panel.parentElement !== mount.parent || (mount.after && panel.previousElementSibling !== mount.after)) {
      if (mount.after && mount.after.parentElement === mount.parent) {
        mount.parent.insertBefore(panel, mount.after.nextSibling);
      } else {
        mount.parent.appendChild(panel);
      }
    }

    return panel;
  }

  function syncNativeCmdbAssetsPanel() {
    if ((window.location.hash || "") !== "#system/integration/idoit") return;

    var panel = ensureNativeCmdbAssetsPanel();
    if (!panel) return;
    loadCmdbView(panel);
  }

  function applyGeimserUi() {
    var app = document.querySelector("#app");
    if (!app) return;

    markRouteState();
    repairActivityFlowLayout();
    removeZammadBranding();
    normalizeVisibleBrandText();
    markNavigationSurface();
    ensureSidebarBrand();
    ensureInternalSidebarShortcuts();
    removeLegacyCmdbOverlay();
    normalizeSidebarTicketLabels();
    ensureRemoteButton();
    checkRemoteInstallFirstRun();
    syncCmdbRoute();
    forcePopupContrast();
    ensureProfileLogoutFallback();
    normalizeNativeCmdbLabels();
    syncNativeCmdbAssetsPanel();
    ensurePasswordVisibilityToggle();
  }

  window.GeimserContrastAudit = function () {
    applyGeimserUi();
    return auditContrast();
  };

  var scheduled = false;
  var applying = false;
  var observer;
  var observerOptions = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-theme", "aria-selected", "aria-current"]
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
