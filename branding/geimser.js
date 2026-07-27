(function () {
  if (window.__geimserUiLoaded) return;
  window.__geimserUiLoaded = true;

  var GEIMSER_GENERIC_PASSWORD = "GEimser.2026!";
  var GEIMSER_FORCE_PASSWORD_KEY = "geimser_must_change_password";
  var geimserPasswordChangeState = {
    checking: false,
    lastCheck: 0,
    userId: null
  };

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
    var candidates = Array.from(app.querySelectorAll("a, button, [role='button'], li:has(a), li:has(button)")).filter(function (el) {
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
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("border-color", "transparent", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("color", "#d9e2ec", "important");
      el.style.setProperty("border-radius", "0", "important");

      var parent = el.parentElement;
      if (parent) {
        var parentRect = parent.getBoundingClientRect();
        if (parentRect.left >= -1 && parentRect.left < 350 && parentRect.bottom >= viewportHeight - 78) {
          parent.classList.add("geimser-sidebar-dock");
          parent.style.setProperty("background", "#11131a", "important");
          parent.style.setProperty("background-color", "#11131a", "important");
          parent.style.setProperty("border-top", "1px solid rgba(255, 255, 255, 0.08)", "important");
        }
      }

      Array.from(el.querySelectorAll("svg, .icon, [class*='icon'], [class*='Icon']")).forEach(function (icon) {
        icon.style.setProperty("color", "#d9e2ec", "important");
        icon.style.setProperty("fill", "#d9e2ec", "important");
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

  function agentRoleAccess() {
    return /ticket\.agent|(^|[\s._-])agent($|[\s._-])/.test(sessionPermissionText());
  }

  function customerTicketAccess() {
    var permissions = sessionPermissionText();
    return !adminSidebarAccess() &&
      !agentRoleAccess() &&
      /ticket\.customer|(^|[\s._-])(client|cliente|customer)($|[\s._-])/.test(permissions);
  }

  var geimserAccessState = {
    requested: false,
    loaded: false,
    moduleAccess: false
  };

  function requestGeimserAccess() {
    if (geimserAccessState.requested || !currentSession()) return;
    geimserAccessState.requested = true;

    fetch("/geimser/access", {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("access failed");
      return response.json();
    }).then(function (payload) {
      geimserAccessState.loaded = true;
      geimserAccessState.moduleAccess = payload && payload.module_access === true;
      scheduleApply();
    }).catch(function () {
      geimserAccessState.loaded = true;
      geimserAccessState.moduleAccess = false;
      scheduleApply();
    });
  }

  function agentOnlyAccess() {
    var permissions = sessionPermissionText();
    return !adminSidebarAccess() && /ticket\.(agent|customer)|(^|[\s._-])(agent|client|cliente|customer)($|[\s._-])/.test(permissions);
  }

  function geimserAccessKnown() {
    return geimserAccessState.loaded;
  }

  function geimserModuleAccess() {
    return Boolean(currentSession()) && geimserAccessState.loaded && geimserAccessState.moduleAccess;
  }

  function internalSidebarAccess() {
    return geimserModuleAccess();
  }

  window.GeimserAccess = {
    agentOnly: agentOnlyAccess,
    customerTicket: customerTicketAccess,
    known: geimserAccessKnown,
    moduleAccess: geimserModuleAccess
  };

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
    var sessionReady = Boolean(currentSession());
    if (!sessionReady) {
      return;
    }

    if (!geimserModuleAccess()) {
      if (existing) existing.remove();
      return;
    }

    var sidebar = findSidebarSurface();
    if (!sidebar) return;
    var compactSidebar = sidebar.getBoundingClientRect().width < 120;

    if (!existing) {
      existing = document.createElement("nav");
      existing.className = "geimser-sidebar-shortcuts";
      existing.setAttribute("aria-label", "Accesos internos Geimser ITSM");
    }

    if (!existing.querySelector('[data-geimser-shortcut="secrets"]')) {
      existing.innerHTML = [
        '<a class="geimser-sidebar-shortcut" data-geimser-shortcut="cmdb" href="#system/integration/idoit">',
        '  <span class="geimser-sidebar-shortcut-icon geimser-sidebar-shortcut-icon-cmdb" aria-hidden="true"></span>',
        '  <span>CMDB ITSM</span>',
        '</a>',
        '<a class="geimser-sidebar-shortcut" data-geimser-shortcut="map" href="#inventory-map">',
        '  <span class="geimser-sidebar-shortcut-icon" aria-hidden="true" style="display:inline-flex; align-items:center; justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg></span>',
        '  <span>Mapa Interactivo</span>',
        '</a>',
        '<a class="geimser-sidebar-shortcut" data-geimser-shortcut="assistant" href="https://iabot.geimser.cl/dashboard" target="_blank" rel="noopener noreferrer">',
        '  <span class="geimser-sidebar-shortcut-icon" aria-hidden="true" style="display:inline-flex; align-items:center; justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 10.7 7.7 6 9l4.7 1.3L12 15l1.3-4.7L18 9l-4.7-1.3z"/><path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7z"/><path d="M5 15 4.3 17.3 2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7z"/></svg></span>',
        '  <span>Dashboard</span>',
        '</a>',
        '<a class="geimser-sidebar-shortcut" data-geimser-shortcut="secrets" href="#secure-secrets">',
        '  <span class="geimser-sidebar-shortcut-icon" aria-hidden="true" style="display:inline-flex; align-items:center; justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/><path d="M12 9v6"/></svg></span>',
        '  <span>Secretos Seguros</span>',
        '</a>',
        '<button class="geimser-sidebar-shortcut" data-geimser-shortcut="remote" type="button">',
        '  <span class="geimser-sidebar-shortcut-icon geimser-sidebar-shortcut-icon-remote" aria-hidden="true"></span>',
        '  <span>Toma remota</span>',
        '</button>'
      ].join("");
    }

    var remoteShortcut = existing.querySelector('[data-geimser-shortcut="remote"]');
    if (remoteShortcut && !remoteShortcut.dataset.geimserBound) {
      remoteShortcut.dataset.geimserBound = "true";
      remoteShortcut.addEventListener("click", function () {
        openRemoteModal("equipos");
      });
    }

    var mapShortcut = existing.querySelector('[data-geimser-shortcut="map"]');
    if (mapShortcut && !mapShortcut.dataset.geimserBound) {
      mapShortcut.dataset.geimserBound = "true";
      // We no longer intercept the click. The browser will navigate to #inventory-map natively.
    }

    var reference = sidebarReferenceItem(sidebar);
    var insertionNode = reference && reference.parentElement && /^(LI|DD|DT)$/i.test(reference.parentElement.tagName)
      ? reference.parentElement
      : reference;

    existing.classList.remove("is-fixed");
    existing.classList.toggle("is-compact", compactSidebar);
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

  function markRouteState() {
    var app = document.querySelector("#app");
    if (!app) return;
    var hash = window.location.hash || "";
    var isProfile = /^#profile(?:\/|$)/.test(hash);
    /* Zammad mantiene en el DOM las vistas ya visitadas (ocultas). Miramos
       solo el panel activo para evitar que clases de ruta se filtren desde
       vistas ocultas hacia overviews, admin u otros módulos. */
    var activePane = app.querySelector(".content.active") || app;
    var isDashboard = /^#dashboard(?:\/|$)/.test(hash) || hash === "";
    var activityPanel = activePane.querySelector(".js-activityContent") ||
      activePane.querySelector(".content.horizontal > .sidebar.optional .activity-entries");
    var pageText = (activePane.textContent || "").replace(/\s+/g, " ");
    var hasActivityFlow = Boolean(isDashboard && activityPanel);
    var hasProfileDetail = /CORREO ELECTR[ÓO]NICO/i.test(pageText) &&
      /Tickets de Usuario|Tickets de la organizaci[oó]n/i.test(pageText) &&
      /FRECUENCIA|Tickets abiertos|Cerrar tickets/i.test(pageText);
    var isTicketCreate = /^#(?:ticket\/create|customer_ticket_new)(?:\/|$)/.test(hash);
    var isTicket = /^#ticket(?:\/|$)/.test(hash);
    var isCmdb = hash === "#system/integration/idoit";
    var isMap = hash === "#inventory-map";
    var isSecrets = hash === "#secure-secrets";
    app.classList.toggle("geimser-route-profile", isProfile || hasActivityFlow || hasProfileDetail);
    app.classList.toggle("geimser-route-ticket-create", isTicketCreate);
    app.classList.toggle("geimser-route-ticket", isTicket);
    app.classList.toggle("geimser-route-cmdb", isCmdb);
    app.classList.toggle("geimser-route-map", isMap);
    app.classList.toggle("geimser-route-secrets", isSecrets);
    app.classList.toggle("geimser-route-native", isProfile || hasActivityFlow || hasProfileDetail || isTicketCreate);
    app.classList.toggle("geimser-route-activity-flow", hasActivityFlow);
  }

  function agentRouteAllowed(hash) {
    return hash === "" ||
      /^#ticket(?:\/|$)/.test(hash) ||
      /^#customer_ticket_new(?:\/|$)/.test(hash) ||
      /^#dashboard(?:\/|$)/.test(hash) ||
      /^#profile(?:\/|$)/.test(hash) ||
      /^#logout(?:\/|$)/.test(hash);
  }

  function enforceAgentTicketOnlyRoutes() {
    if (!geimserAccessKnown() || geimserModuleAccess()) return;

    var hash = window.location.hash || "";
    if (agentRouteAllowed(hash)) return;

    window.location.hash = "#ticket/view";
  }

  function enforceCustomerTicketCreateRoute() {
    if (!geimserAccessKnown() || !customerTicketAccess()) return;

    var hash = window.location.hash || "";
    if (!/^#ticket\/create(?:\/|$)/.test(hash)) return;

    window.location.hash = "#customer_ticket_new";
  }

  function hideAgentRestrictedNavigation() {
    if (!geimserAccessKnown() || geimserModuleAccess()) return;

    var restrictedHref = /#(?:inventory-map|secure-secrets|system|manage|admin|core_workflow|text_module|template|report|calendar|channel|security|maintenance|monitoring)/i;
    var restrictedText = /\b(Mapa Interactivo|Secretos Seguros|Toma remota|CMDB ITSM|Configuraci[oó]n|Herramientas|Administraci[oó]n|Usuarios|Roles|Grupos|Organizaciones|Canales|Sistema|Reportes)\b/i;

    Array.from(document.querySelectorAll("#app a[href], #app button, #app [role='button']")).forEach(function (item) {
      if (!isInsideNavigation(item)) return;

      var href = item.getAttribute("href") || "";
      var text = (item.textContent || "").replace(/\s+/g, " ").trim();
      var restricted = restrictedHref.test(href) || restrictedText.test(text);
      if (!restricted) return;

      var row = item.closest("li, .menu-item, [role='listitem']") || item;
      row.classList.add("geimser-agent-hidden");
      row.style.setProperty("display", "none", "important");
    });
  }

  function normalizeCmdbAdminNavigation() {
    var app = document.querySelector("#app");
    var sidebar = app && app.querySelector(".sidebar.NavBarAdmin");
    if (!app || !sidebar) return;
    if (!app.classList.contains("geimser-route-cmdb")) {
      sidebar.classList.remove("geimser-admin-focus-menu", "is-expanded");
      var existingPanel = sidebar.querySelector(".geimser-admin-focus-panel");
      if (existingPanel) existingPanel.remove();
      Array.from(sidebar.querySelectorAll(".geimser-admin-focus-hidden, .geimser-admin-focus-kept")).forEach(function (el) {
        el.classList.remove("geimser-admin-focus-hidden", "geimser-admin-focus-kept");
      });
      return;
    }

    sidebar.classList.add("geimser-admin-focus-menu");

    var focusPanel = sidebar.querySelector(".geimser-admin-focus-panel");
    if (!focusPanel) {
      focusPanel = document.createElement("div");
      focusPanel.className = "geimser-admin-focus-panel";
      focusPanel.innerHTML = [
        '<strong>Operación ITSM</strong>',
        '<button type="button" class="geimser-admin-focus-toggle" aria-expanded="false">Más ajustes</button>'
      ].join("");

      var heading = sidebar.querySelector("h1, h2, h3");
      if (heading && heading.parentElement) {
        heading.insertAdjacentElement("afterend", focusPanel);
      } else {
        sidebar.insertBefore(focusPanel, sidebar.firstChild);
      }

      focusPanel.querySelector(".geimser-admin-focus-toggle").addEventListener("click", function () {
        sidebar.classList.toggle("is-expanded");
        normalizeCmdbAdminNavigation();
      });
    }

    var expanded = sidebar.classList.contains("is-expanded");
    var toggle = focusPanel.querySelector(".geimser-admin-focus-toggle");
    if (toggle) {
      toggle.textContent = expanded ? "Menú simple" : "Más ajustes";
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    }

    /* Diseño v4: sin colores inline — la nav de admin se tematiza por CSS. */

    var keepHrefs = [
      "#manage/users",
      "#manage/groups",
      "#manage/roles",
      "#manage/organizations",
      "#system/integration",
      "#system/integration/idoit",
      "#system/api",
      "#system/object_manager",
      "#system/monitoring",
      "#system/sessions"
    ];
    var keepText = /^(Usuarios|Grupos|Roles|Organizaciones|Integraciones|CMDB|API|Objetos|Monitorizaci[oó]n|Sesiones)$/i;

    Array.from(sidebar.querySelectorAll("a[href]")).forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var text = (link.textContent || "").replace(/\s+/g, " ").trim();
      var row = link.closest("li") || link;
      var keep = keepHrefs.indexOf(href) !== -1 || keepText.test(text);
      row.classList.toggle("geimser-admin-focus-kept", keep);
      row.classList.toggle("geimser-admin-focus-hidden", !keep && !expanded);
    });
  }

  function normalizeNativeControlContrast() {
    /* Diseño v4: el color es responsabilidad EXCLUSIVA del CSS por tokens
       (tema claro/oscuro). Este normalizador ya no pinta estilos inline:
       solo LIMPIA residuos inline de versiones anteriores para que el
       tema activo pueda aplicarse. */
    var app = document.querySelector("#app");
    if (!app) return;

    Array.from(app.querySelectorAll(
      ".tabs, .tabs *, .sidebar.NavBarAdmin, .sidebar.NavBarAdmin *, " +
      ".geimser-admin-focus-panel, .geimser-admin-focus-panel *, .geimser-admin-focus-toggle, " +
      ".js-createLink, .js-createLink *"
    )).forEach(function (el) {
      if (!el.style || typeof el.style.removeProperty !== "function") return;
      ["background", "background-color", "color", "-webkit-text-fill-color", "text-shadow"].forEach(function (property) {
        el.style.removeProperty(property);
      });
    });
  }

  function normalizeTicketContrast() {
    var app = document.querySelector("#app");
    if (!app || !app.classList.contains("geimser-route-ticket")) return;

    Array.from(app.querySelectorAll(
      ".scrollPageHeader, .scrollPageHeader *, " +
      ".tabsSidebar .sidebar-header, .tabsSidebar .sidebar-header *, " +
      ".tabsSidebar label, .tabsSidebar label *, .tabsSidebar .text-muted, " +
      ".tabsSidebar .list-item-name, .tabsSidebar .list-item-name *, " +
      ".tabsSidebar .js-tag, .tabsSidebar .js-tag *, " +
      ".attributeBar, .attributeBar *, " +
      ".ticket-title-update, .js-objectTitle, " +
      ".textBubble.js-writeArea, .textBubble.js-writeArea *, " +
      ".ticket-number-copy-header, .ticket-number-copy-header *, " +
      ".ticket-number, .dropdown--actions, .dropdown--actions *, " +
      ".js-secondaryActionButtonLabel, .geimser-ticket-remote-action, " +
      ".geimser-ticket-remote-action *"
    )).forEach(function (el) {
      if (!el.style || typeof el.style.removeProperty !== "function") return;
      ["background", "background-color", "color", "-webkit-text-fill-color", "text-shadow"].forEach(function (property) {
        el.style.removeProperty(property);
      });
    });

    Array.from(app.querySelectorAll(".ticket-title-update, .js-objectTitle")).forEach(function (el) {
      if (!el.style || typeof el.style.removeProperty !== "function") return;
      ["border", "border-color", "box-shadow", "min-height", "padding"].forEach(function (property) {
        el.style.removeProperty(property);
      });
    });

    Array.from(app.querySelectorAll(".textBubble.js-writeArea")).forEach(function (el) {
      if (!el.style || typeof el.style.removeProperty !== "function") return;
      ["border", "border-color", "box-shadow"].forEach(function (property) {
        el.style.removeProperty(property);
      });
    });

    Array.from(app.querySelectorAll(".article-actions .article-action")).forEach(function (action) {
      var label = action.querySelector(".article-action-name");
      var text = label ? (label.textContent || "").replace(/\s+/g, " ").trim() : "";
      if (!text) return;
      action.setAttribute("aria-label", text);
      action.setAttribute("title", text);
    });

    var submit = app.querySelector(".attributeBar .js-submit");
    if (submit) {
      var recipientInput = app.querySelector(".article-new input[name='to']");
      var recipientRect = recipientInput ? recipientInput.getBoundingClientRect() : null;
      var isEmailReply = Boolean(recipientRect && recipientRect.width > 0 && recipientRect.height > 0);
      submit.textContent = isEmailReply ? "Enviar y actualizar" : "Guardar actualización";
      submit.setAttribute(
        "title",
        isEmailReply ? "Enviar la respuesta por correo y actualizar el ticket" : "Guardar la nota y actualizar el ticket"
      );
    }
  }

  function normalizeArticleContentContrast() {
    /* Causa raíz del bajo contraste en la ticketera: el cuerpo de un
       artículo (correo del cliente) es HTML AJENO, no UI nuestra. Los
       remitentes (Outlook, firmas, plantillas de marketing) cada vez más
       fijan sus propios colores con `style="color: ... !important"` para
       defenderse del modo oscuro de Gmail/Outlook. Por cascada CSS, un
       estilo inline con !important SIEMPRE le gana a una regla de hoja de
       estilos con !important, sin importar cuántas capas de selectores se
       apilen en geimser.css — por eso los parches puramente CSS de este
       bloque (ver historial) nunca cierran el problema de raíz.
       La única forma de ganarle de verdad es mutar el propio atributo
       `style` del elemento (no competir con una regla nueva), así que este
       normalizador mide el contraste real ya renderizado y, solo si está
       por debajo de AA (4.5:1), reescribe el color (y si hace falta el
       fondo) directamente sobre ese elemento. Si el correo ya es legible,
       no se toca nada de su diseño original. */
    var app = document.querySelector("#app");
    if (!app || !app.classList.contains("geimser-route-ticket")) return;

    var scopes = Array.from(app.querySelectorAll(
      ".ticket-article-item .richtext-content, .ticket-article-item .article-body"
    )).filter(function (scope) {
      return !scope.closest("[contenteditable], .js-writeArea, .article-new");
    });
    if (!scopes.length) return;

    scopes.forEach(function (scope) {
      var panelBg = effectiveBackground(scope);

      Array.from(scope.querySelectorAll("*")).forEach(function (el) {
        if (el.getAttribute("data-geimser-contrast") === "done") return;
        if (el.closest("[contenteditable]")) return;

        var rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;

        var style = window.getComputedStyle(el);
        var fg = parseRgb(style.color);
        if (!fg) return;

        var ownBg = parseRgb(style.backgroundColor);
        var hasOwnBg = Boolean(ownBg && ownBg.a >= 0.6);
        var bg = hasOwnBg ? ownBg : panelBg;

        if (contrastRatio(fg, bg) >= 4.5) {
          el.setAttribute("data-geimser-contrast", "done");
          return;
        }

        if (hasOwnBg && contrastRatio(fg, ownBg) >= 4.5) {
          // El correo trae su propio fondo y, contra ESE fondo, su texto
          // es legible (p.ej. un resaltado amarillo con texto negro).
          // No lo tocamos: solo nos importa lo que de verdad no se lee.
          el.setAttribute("data-geimser-contrast", "done");
          return;
        }

        if (hasOwnBg) {
          // El fondo propio del correo choca con su propio texto: lo
          // anulamos para que se vea el panel del tema y luego corregimos
          // el texto contra ese panel.
          setImportantStyle(el, "background-color", "transparent");
          setImportantStyle(el, "background-image", "none");
          bg = panelBg;
        }

        var fixedColor = luminance(bg) < 0.5 ? "#f3f7fb" : "#1d1d1f";
        setImportantStyle(el, "color", fixedColor);
        setImportantStyle(el, "-webkit-text-fill-color", fixedColor);
        el.setAttribute("data-geimser-contrast", "done");
      });
    });
  }

  function normalizeProfileContrast() {
    /* Diseño v4: solo marca la superficie de detalle de usuario con una
       clase para que el CSS la tematice; además limpia cualquier estilo
       inline residual de versiones anteriores. Sin colores inline. */
    var app = document.querySelector("#app");
    if (!app || !app.classList.contains("geimser-route-profile")) return;

    var detailSurface = userDetailProfileSurface(app);
    if (detailSurface) {
      detailSurface.classList.add("geimser-user-detail-surface");

      Array.from(detailSurface.querySelectorAll("[class*='action'], [class*='Action'], .dropdown, .dropdown-menu, [role='menu']")).forEach(function (el) {
        el.style.setProperty("position", "relative", "important");
        el.style.setProperty("z-index", "40", "important");
      });
    }

    var cleanupScope = [detailSurface, app].filter(Boolean);
    cleanupScope.forEach(function (scope) {
      Array.from(scope.querySelectorAll(
        ".content, .content > div, .content h1, .content h2, .content h3, .content p, .content span, " +
        ".content div, .content label, .content small, .content a, .content li, .content button, " +
        ".content .avatar, .content [class*='avatar'], .content .tabs, .content .tab, .content [role='tab']"
      )).forEach(function (el) {
        if (!el.style || typeof el.style.removeProperty !== "function") return;
        if (el.closest(".geimser-nav-surface, .geimser-profile-popup")) return;
        ["background", "background-color", "color", "-webkit-text-fill-color", "text-shadow"].forEach(function (property) {
          el.style.removeProperty(property);
        });
      });
    });
  }

  function userDetailProfileSurface(app) {
    var profileText = /CORREO ELECTR[ÓO]NICO/i;
    var ticketText = /Tickets de Usuario|Tickets de la organizaci[oó]n/i;
    var reportText = /FRECUENCIA|Tickets abiertos|Cerrar tickets/i;

    var candidates = Array.from(app.querySelectorAll(".content > div, .content section, .content article, .content main, .content aside, .content div")).filter(function (el) {
      if (el.closest(".geimser-nav-surface, .geimser-profile-popup")) return false;
      var rect = el.getBoundingClientRect();
      if (rect.width < 360 || rect.height < 360) return false;
      var text = (el.textContent || "").replace(/\s+/g, " ");
      return profileText.test(text) && ticketText.test(text) && reportText.test(text);
    });

    return candidates.sort(function (a, b) {
      var ar = a.getBoundingClientRect();
      var br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    })[0] || null;
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

    var anchors = Array.from(app.querySelectorAll(".js-activityContent, .activity-entries")).map(function (el) {
      return el.closest(".content.horizontal > .sidebar.optional, .sidebar.optional, aside, section, article, div");
    }).filter(function (el, index, list) {
      if (!el || list.indexOf(el) !== index) return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 20 && rect.height > 20 && rect.left > 220 && rect.left < viewportWidth - 20;
    });

    anchors.forEach(function (anchor) {
      var current = anchor;
      var depth = 0;
      while (current && current !== app && depth < 8) {
        var rect = current.getBoundingClientRect();
        if (rect.left > 220 && current.querySelector(".js-activityContent, .activity-entries")) {
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
    }, true);
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

    var headerText = /^(INICIAR SESI[ÓO]N|T[ÍI]TULO|CLIENTE|GRUPO|CREADO HACE|NOMBRE|APELLIDO\(S\)|ORGANIZACI[ÓO]N|ORGANIZACIONES SECUNDARIAS|ACCI[ÓO]N|AC\.\.\.|PROTOCOLO|DIRECCI[ÓO]N DE CORREO ELECTR[ÓO]NICO|SALIENTE|EDITAR)$/i;
    var candidates = Array.from(app.querySelectorAll("div, span, th, [role='columnheader'], [class*='column'], [class*='Column']"));

    candidates.forEach(function (el) {
      if (isInsideNavigation(el)) return;
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!headerText.test(text)) return;

      var rect = el.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 8 || rect.left < 520) return;

      /* Diseño v3: los encabezados de tabla son SIEMPRE superficies claras.
         La rama oscura (#2f3542) generaba chips oscuros ilegibles. */
      setImportantStyle(el, "color", "#475569");
      setImportantStyle(el, "-webkit-text-fill-color", "#475569");
      setImportantStyle(el, "background-color", "#f7f9fc");
      el.style.fontWeight = "700";

      Array.from(el.querySelectorAll("*")).forEach(function (child) {
        setImportantStyle(child, "color", "#475569");
        setImportantStyle(child, "-webkit-text-fill-color", "#475569");
        setImportantStyle(child, "background-color", "transparent");
      });

      var parent = el.parentElement;
      var depth = 0;
      while (parent && depth < 3) {
        var parentRect = parent.getBoundingClientRect();
        if (parentRect.height > 12 && parentRect.height < 72 && parentRect.width > rect.width * 0.8 && !isInsideNavigation(parent)) {
          setImportantStyle(parent, "background-color", "#f7f9fc");
          setImportantStyle(parent, "color", "#475569");
          setImportantStyle(parent, "-webkit-text-fill-color", "#475569");
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

  function normalizeNewTicketButton() {
    var app = document.querySelector("#app");
    if (!app) return;
    var forceCustomerCreate = geimserAccessKnown() && customerTicketAccess();

    Array.from(app.querySelectorAll("a[href*='#ticket/create'], a[href*=\"#ticket/create\"], a[href*='#customer_ticket_new'], a[href*=\"#customer_ticket_new\"], button, [role='button']")).forEach(function (control) {
      var href = control.getAttribute("href") || "";
      var explicitCreateHref = /#(?:ticket\/create|customer_ticket_new)/i.test(href);
      if (!explicitCreateHref && !isInsideNavigation(control)) return;

      var rect = control.getBoundingClientRect();
      var label = [
        control.textContent,
        control.getAttribute("title"),
        control.getAttribute("aria-label"),
        control.dataset && control.dataset.action
      ].join(" ");

      var visibleText = (control.textContent || "").replace(/\s+/g, " ").trim();
      var isBottomCreatePlus = visibleText === "+" &&
        rect.bottom >= (window.innerHeight || document.documentElement.clientHeight) - 74 &&
        rect.left >= 0 &&
        rect.left < 280;
      var looksLikeCreateTicket = explicitCreateHref ||
        /(?:nuevo|crear|new|create).{0,12}ticket|ticket.{0,12}(?:nuevo|crear|new|create)/i.test(label) ||
        isBottomCreatePlus;
      if (!looksLikeCreateTicket) return;

      if (/nuevo ticket/i.test(visibleText)) return;

      control.classList.add("geimser-new-ticket-button");
      control.setAttribute("title", "Nuevo Ticket");
      control.setAttribute("aria-label", "Nuevo Ticket");
      if (forceCustomerCreate) {
        if (control.matches("a[href]")) {
          control.setAttribute("href", "#customer_ticket_new");
        }

        if (control.dataset && control.dataset.geimserCustomerCreateBound !== "true") {
          control.dataset.geimserCustomerCreateBound = "true";
          control.addEventListener("click", function (event) {
            if (!customerTicketAccess()) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            if ((window.location.hash || "") !== "#customer_ticket_new") {
              window.location.hash = "#customer_ticket_new";
            }
          }, true);
        }
      }

      var textNode = control.querySelector(".geimser-new-ticket-label");
      if (!textNode) {
        textNode = document.createElement("span");
        textNode.className = "geimser-new-ticket-label";
        textNode.textContent = "Nuevo Ticket";
        control.appendChild(textNode);
      }

      Array.from(control.childNodes).forEach(function (node) {
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim() === "+") {
          node.nodeValue = "";
        }
      });
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
    var fields = Array.from(document.querySelectorAll(
      ".hero-unit input, .login input, .geimser-force-password-form input, #app input"
    )).filter(function (input) {
      if (input.closest(".geimser-password-field")) return false;
      if (input.closest(".geimser-force-password-modal")) return input.type === "password";

      var isPublicPasswordArea = Boolean(input.closest(".hero-unit, .login"));
      var isManageUserArea = Boolean(input.closest("#app")) && (window.location.hash || "").indexOf("#manage/users") === 0;
      if (!isPublicPasswordArea && !isManageUserArea) return false;

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

  function geimserCsrfToken() {
    var meta = document.querySelector("meta[name='csrf-token']");
    return meta ? meta.getAttribute("content") : "";
  }

  function geimserSetInputValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isVisibleElement(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function ensureTemporaryPasswordUserForm() {
    var app = document.querySelector("#app");
    var hash = window.location.hash || "";
    if (!app || !/^#manage\/users(?:\/|$)?/.test(hash)) {
      document.querySelectorAll(".geimser-temp-password-banner").forEach(function (el) {
        el.remove();
      });
      return;
    }

    var passwordInputs = Array.from(app.querySelectorAll("input[type='password'], input[name*='password'], input[id*='password']")).filter(function (input) {
      return !input.closest(".geimser-force-password-modal") && isVisibleElement(input);
    });

    passwordInputs.forEach(function (input) {
      input.classList.add("geimser-temp-password-input");
      input.setAttribute("autocomplete", "new-password");
      if (input.value !== GEIMSER_GENERIC_PASSWORD) {
        geimserSetInputValue(input, GEIMSER_GENERIC_PASSWORD);
      }

      var field = input.closest(".form-group, .controls, .field, label") || input.parentElement;
      if (field && !field.querySelector(".geimser-temp-password-note")) {
        var note = document.createElement("div");
        note.className = "geimser-temp-password-note";
        note.innerHTML = 'Clave temporal: <strong>' + GEIMSER_GENERIC_PASSWORD + '</strong>. El usuario debera cambiarla al iniciar sesion.';
        field.appendChild(note);
      }
    });

    var form = passwordInputs[0] && passwordInputs[0].closest("form");
    if (!form || form.querySelector(".geimser-temp-password-banner")) return;

    var banner = document.createElement("div");
    banner.className = "geimser-temp-password-banner";
    banner.innerHTML = [
      '<strong>Creacion de usuario</strong>',
      '<span>Se asignara automaticamente la clave temporal <code>' + GEIMSER_GENERIC_PASSWORD + '</code> y el usuario debera crear una clave segura en su primer ingreso.</span>'
    ].join("");
    form.insertBefore(banner, form.firstElementChild);
  }

  function sessionNeedsPasswordChange(session) {
    if (!session || !session.preferences) return false;
    return session.preferences[GEIMSER_FORCE_PASSWORD_KEY] === true ||
      session.preferences[GEIMSER_FORCE_PASSWORD_KEY] === "true" ||
      session.preferences[GEIMSER_FORCE_PASSWORD_KEY] === 1;
  }

  function setLocalPasswordChangePreference(value) {
    var session = currentSession();
    if (session) {
      session.preferences = session.preferences || {};
      session.preferences[GEIMSER_FORCE_PASSWORD_KEY] = value;
    }
  }

  function renderPasswordChangeError(modal, message) {
    var error = modal.querySelector(".geimser-force-password-error");
    if (!error) return;
    error.textContent = message || "No se pudo cambiar la contrasena. Revisa los datos e intenta nuevamente.";
    error.hidden = false;
  }

  function extractPasswordChangeNotice(payload) {
    if (!payload) return "";
    if (Array.isArray(payload.notice)) return payload.notice.join(" ");
    if (typeof payload.notice === "string") return payload.notice;
    if (payload.error) return payload.error;
    if (payload.message && payload.message !== "failed") return payload.message;
    return "";
  }

  function securePasswordMessage(value) {
    var uppercase = (value.match(/[A-Z]/g) || []).length;
    var lowercase = (value.match(/[a-z]/g) || []).length;
    if (value.length < 10) return "La nueva contrasena debe tener al menos 10 caracteres.";
    if (uppercase < 2 || lowercase < 2) return "La nueva contrasena debe incluir al menos 2 mayusculas y 2 minusculas.";
    if (!/[0-9]/.test(value)) return "La nueva contrasena debe incluir al menos un numero.";
    if (!/[^A-Za-z0-9]/.test(value)) return "La nueva contrasena debe incluir al menos un simbolo.";
    return "";
  }

  function buildForcedPasswordModal() {
    var existing = document.querySelector(".geimser-force-password-modal");
    if (existing) return existing;

    var modal = document.createElement("div");
    modal.className = "geimser-force-password-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = [
      '<div class="geimser-force-password-card">',
      '  <div class="geimser-force-password-header">',
      '    <span>Seguridad de cuenta</span>',
      '    <h2>Cambia tu contrasena</h2>',
      '    <p>Tu usuario fue creado con una clave temporal. Para continuar, define una contrasena segura que solo tu conozcas.</p>',
      '  </div>',
      '  <form class="geimser-force-password-form">',
      '    <label>Clave actual<input type="password" name="password_old" autocomplete="current-password" required></label>',
      '    <label>Nueva clave<input type="password" name="password_new" autocomplete="new-password" required minlength="10"></label>',
      '    <label>Confirmar nueva clave<input type="password" name="password_confirm" autocomplete="new-password" required minlength="10"></label>',
      '    <div class="geimser-force-password-error" hidden></div>',
      '    <button type="submit">Guardar nueva clave</button>',
      '  </form>',
      '</div>'
    ].join("");

    modal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") event.preventDefault();
    });

    modal.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      submitForcedPasswordChange(modal);
    });

    document.body.appendChild(modal);
    ensurePasswordVisibilityToggle();
    window.setTimeout(function () {
      var firstInput = modal.querySelector("input");
      if (firstInput) firstInput.focus();
    }, 30);
    return modal;
  }

  function submitForcedPasswordChange(modal) {
    var form = modal.querySelector("form");
    var button = modal.querySelector("button[type='submit']");
    var oldPassword = form.elements.password_old.value;
    var newPassword = form.elements.password_new.value;
    var confirmPassword = form.elements.password_confirm.value;

    if (newPassword !== confirmPassword) {
      renderPasswordChangeError(modal, "La nueva contrasena y la confirmacion no coinciden.");
      return;
    }

    var securityMessage = securePasswordMessage(newPassword);
    if (securityMessage) {
      renderPasswordChangeError(modal, securityMessage);
      return;
    }

    button.disabled = true;
    button.textContent = "Guardando...";

    fetch("/api/v1/users/password_change", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": geimserCsrfToken()
      },
      body: JSON.stringify({
        password_old: oldPassword,
        password_new: newPassword
      })
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok || payload.message !== "ok") {
          throw new Error(extractPasswordChangeNotice(payload));
        }
        return payload;
      });
    }).then(function () {
      setLocalPasswordChangePreference(false);
      modal.classList.add("is-success");
      modal.querySelector(".geimser-force-password-header p").textContent = "Clave actualizada correctamente. Ya puedes continuar trabajando.";
      window.setTimeout(function () {
        modal.remove();
      }, 700);
    }).catch(function (error) {
      renderPasswordChangeError(modal, error.message);
    }).finally(function () {
      button.disabled = false;
      button.textContent = "Guardar nueva clave";
    });
  }

  function showForcedPasswordChange() {
    buildForcedPasswordModal();
  }

  function ensureForcedPasswordChange() {
    var session = currentSession();
    var hash = window.location.hash || "";
    var isPublicScreen = /^#(login|password_reset|signup|register)?$/.test(hash) ||
      Boolean(document.querySelector(".hero-unit"));

    if (!session || isPublicScreen) {
      return;
    }

    if (sessionNeedsPasswordChange(session)) {
      showForcedPasswordChange();
      return;
    }

    var now = Date.now();
    if (geimserPasswordChangeState.checking || now - geimserPasswordChangeState.lastCheck < 10000) return;

    geimserPasswordChangeState.checking = true;
    geimserPasswordChangeState.lastCheck = now;

    fetch("/api/v1/users/me", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    }).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function (user) {
      if (!user) return;
      geimserPasswordChangeState.userId = user.id || null;
      if (user.preferences) {
        setLocalPasswordChangePreference(Boolean(user.preferences[GEIMSER_FORCE_PASSWORD_KEY]));
        if (user.preferences[GEIMSER_FORCE_PASSWORD_KEY]) showForcedPasswordChange();
      }
    }).catch(function (_error) {
      // Best effort: the server still keeps the flag until password_change succeeds.
    }).finally(function () {
      geimserPasswordChangeState.checking = false;
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
    var activityRoots = Array.from(app.querySelectorAll(".js-activityContent, .activity-entries")).map(function (el) {
      return el.closest(".content.horizontal > .sidebar.optional, .sidebar.optional, aside, section, article, nav");
    });
    var candidates = activityRoots.filter(function (el, index, list) {
      if (!el || list.indexOf(el) !== index) return false;
      var rect = el.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 160) return false;
      if (rect.left < viewportWidth * 0.68) return false;
      return true;
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
    var surfaces = Array.from(document.querySelectorAll("#app .geimser-activity-surface, #app.geimser-route-activity-flow .content.horizontal > .sidebar.optional")).filter(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.width < 170 || rect.height < 150) return false;
      if (rect.left < viewportWidth * 0.68) return false;

      var bg = parseRgb(window.getComputedStyle(el).backgroundColor);
      var isDarkBlue = bg && bg.b > bg.r && bg.b >= bg.g && luminance(bg) < 0.16;
      var hasActivityMarkup = Boolean(el.querySelector(".js-activityContent, .activity-entries, .activity-entry"));

      return el.classList.contains("geimser-activity-surface") ||
        hasActivityMarkup ||
        isDarkBlue;
    });

    surfaces.forEach(function (surface) {
      surface.classList.add("geimser-activity-surface");
      surface.style.setProperty("background", "#ffffff", "important");
      surface.style.setProperty("background-color", "#ffffff", "important");
      surface.style.setProperty("color", "#111827", "important");

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
          el.style.setProperty("color", "#003d7a", "important");
          return;
        }

        if (el.matches("small, time, [class*='meta'], [class*='Meta'], [class*='time'], [class*='Time']")) {
          el.style.setProperty("color", "#4b5563", "important");
          return;
        }

        el.style.setProperty("color", "#111827", "important");
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

  function meshDesktopSessionUrl(nodeId) {
    var nodeValue = String(nodeId || "").trim();
    var nodeToken = "";
    if (!/^node\/\/[A-Za-z0-9@$_=-]+$/.test(nodeValue)) {
      nodeToken = nodeValue.split("/").filter(Boolean).pop() || "";
      if (!/^[A-Za-z0-9@$_=-]+$/.test(nodeToken)) return meshLoginUrl("/");
      nodeValue = "node//" + nodeToken;
    } else {
      nodeToken = nodeValue.split("/").filter(Boolean).pop() || "";
    }

    return meshLoginUrl("/?" + new URLSearchParams({
      node: nodeValue,
      gotonode: nodeToken,
      viewmode: "11",
      hide: "0",
      geimserautoconnect: "1"
    }).toString());
  }

  function remoteAssetSessionUrl(asset) {
    asset = asset || {};
    var details = asset.details || {};
    var nodeId = details.mesh_node_id || asset.mesh_node_id || asset.node_id;
    if (!nodeId && /^node\/\//.test(String(asset.id || ""))) {
      nodeId = asset.id;
    }
    if (nodeId) return meshDesktopSessionUrl(nodeId);

    return asset.session_url || meshLoginUrl("/");
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
    if (!options.autocheck) return;

    try {
      var key = "geimserRemoteInstallPromptSeenThisTab";
      if (window.sessionStorage && sessionStorage.getItem(key) === "true") return;
      if (window.sessionStorage) sessionStorage.setItem(key, "true");
    } catch (_error) {
      // Best effort only; the prompt should never block normal navigation.
    }

    window.setTimeout(function () {
      if (!document.body.contains(modal)) return;
      openRemoteModal("registrar");
    }, 350);
  }

  function remoteAssetStatusLabel(status) {
    return /^(online|activo)$/i.test(String(status || "")) ? "Online" : "Offline";
  }

  function remoteAssetOnline(asset) {
    asset = asset || {};
    return /^(online|activo)$/i.test(String(asset.raw_status || asset.status || ""));
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
      '    <button type="button" data-cmdb-session="' + escapeHtml(remoteAssetSessionUrl(asset)) + '">Tomar control</button>',
      '  </div>',
      '</section>'
    ].join("");

    var control = container.querySelector("[data-cmdb-session]");
    if (control) {
      control.addEventListener("click", function () {
        var sessionUrl = control.getAttribute("data-cmdb-session") || meshLoginUrl("/");
        var modal = ensureRemoteModal();
        openRemoteSession(modal, sessionUrl);
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
          '    <button type="button" data-remote-session="' + escapeHtml(remoteAssetSessionUrl(asset)) + '">Tomar control</button>',
          '  </div>',
          '</article>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");

    container.querySelectorAll("[data-remote-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        var url = button.getAttribute("data-remote-session") || meshLoginUrl("/");
        openRemoteSession(modal, url);
      });
    });
  }

  function openRemoteSession(modal, url) {
    var sessionUrl = url || meshLoginUrl("/");
    var frame = modal.querySelector(".geimser-remote-frame");
    var openLink = modal.querySelector(".geimser-remote-open");

    frame.src = sessionUrl;
    if (openLink) openLink.href = sessionUrl;
    modal.classList.add("is-open");
    modal.classList.add("is-session-active");
    modal.classList.remove("is-equipment-flow", "is-install-flow");
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
    if (remoteInstallAutocheckStarted || !adminSidebarAccess()) return;

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
      if (remoteAssetOnline(asset)) {
        memo.online += 1;
      } else {
        memo.offline += 1;
      }
      memo.groups[asset.group || "Sin grupo"] = true;
      return memo;
    }, { online: 0, offline: 0, groups: {} });
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
          '  <span role="cell" class="geimser-cmdb-row-actions"><button type="button" data-cmdb-detail="' + index + '">Detalle</button><button type="button" data-cmdb-session="' + escapeHtml(remoteAssetSessionUrl(asset)) + '">Tomar control</button></span>',
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
        openRemoteSession(modal, sessionUrl);
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

  var dashboardInventoryState = {
    loading: false,
    loadedAt: 0
  };

  function isDashboardRoute() {
    var hash = window.location.hash || "";
    return hash === "" || /^#dashboard(?:\/|$)/.test(hash);
  }

  function removeDashboardInventoryPanel() {
    var panel = document.querySelector(".geimser-dashboard-inventory");
    if (panel) panel.remove();
  }

  function dashboardInventoryMount() {
    if (!isDashboardRoute() || !geimserModuleAccess()) {
      removeDashboardInventoryPanel();
      return null;
    }

    var app = document.querySelector("#app");
    if (!app) return null;

    var activePane = app.querySelector(".content.active") || app;
    var dashboard = activePane.querySelector(".dashboard") || activePane.querySelector(".main") || activePane;
    var rect = dashboard.getBoundingClientRect();
    if (rect.width < 320 || rect.height < 120) return null;

    return dashboard;
  }

  function renderDashboardInventory(panel, assets) {
    assets = assets || [];
    var summary = remoteAssetSummary(assets);
    var groupsCount = Object.keys(summary.groups).length;
    var content = panel.querySelector(".geimser-dashboard-inventory-content");

    panel.querySelector(".geimser-dashboard-inventory-stats").innerHTML = [
      '<article><span>Total</span><strong>' + assets.length + '</strong></article>',
      '<article><span>Online</span><strong>' + summary.online + '</strong></article>',
      '<article><span>Offline</span><strong>' + summary.offline + '</strong></article>',
      '<article><span>Grupos</span><strong>' + groupsCount + '</strong></article>'
    ].join("");

    if (!assets.length) {
      content.innerHTML = [
        '<div class="geimser-dashboard-inventory-empty">',
        '  <strong>No hay equipos registrados todavia.</strong>',
        '  <span>Cuando el inventario sincronice equipos, apareceran aqui automaticamente.</span>',
        '</div>'
      ].join("");
      return;
    }

    content.innerHTML = [
      '<div class="geimser-dashboard-inventory-list" role="list">',
      assets.map(function (asset) {
        var online = remoteAssetOnline(asset);
        var name = asset.name || asset.hostname || "Equipo remoto";
        var detail = [asset.group, asset.hostname].filter(Boolean).join(" | ") || asset.os || "Sin detalle";
        var assigned = asset.occupant || asset.user || asset.ip || "Sin usuario informado";
        return [
          '<article class="geimser-dashboard-inventory-row ' + (online ? 'is-online' : 'is-offline') + '" role="listitem">',
          '  <span class="geimser-dashboard-inventory-dot" aria-hidden="true"></span>',
          '  <div class="geimser-dashboard-inventory-main">',
          '    <strong>' + escapeHtml(name) + '</strong>',
          '    <small>' + escapeHtml(detail) + '</small>',
          '  </div>',
          '  <div class="geimser-dashboard-inventory-meta">',
          '    <span>' + escapeHtml(assigned) + '</span>',
          '    <em>' + remoteAssetStatusLabel(asset.raw_status || asset.status) + '</em>',
          '  </div>',
          '  <button type="button" data-dashboard-remote-session="' + escapeHtml(remoteAssetSessionUrl(asset)) + '">Tomar control</button>',
          '</article>'
        ].join("");
      }).join(""),
      '</div>'
    ].join("");

    content.querySelectorAll("[data-dashboard-remote-session]").forEach(function (button) {
      button.addEventListener("click", function () {
        var sessionUrl = button.getAttribute("data-dashboard-remote-session") || meshLoginUrl("/");
        var modal = ensureRemoteModal();
        openRemoteSession(modal, sessionUrl);
      });
    });
  }

  function loadDashboardInventory(panel, force) {
    var now = Date.now();
    if (dashboardInventoryState.loading) return;
    if (!force && panel.getAttribute("data-dashboard-inventory-loaded") === "true" && now - dashboardInventoryState.loadedAt < 60000) {
      return;
    }

    dashboardInventoryState.loading = true;
    panel.setAttribute("data-dashboard-inventory-loaded", "true");
    panel.querySelector(".geimser-dashboard-inventory-content").innerHTML = [
      '<div class="geimser-dashboard-inventory-empty">',
      '  <strong>Actualizando inventario...</strong>',
      '  <span>Estamos leyendo los equipos disponibles en la base.</span>',
      '</div>'
    ].join("");

    fetch("/api/inventory-map/options", {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    }).then(function (response) {
      if (!response.ok) throw new Error("dashboard inventory failed");
      return response.json();
    }).then(function (payload) {
      dashboardInventoryState.loadedAt = Date.now();
      renderDashboardInventory(panel, (payload && payload.assets) || []);
    }).catch(function () {
      panel.removeAttribute("data-dashboard-inventory-loaded");
      panel.querySelector(".geimser-dashboard-inventory-content").innerHTML = [
        '<div class="geimser-dashboard-inventory-empty is-error">',
        '  <strong>No pudimos cargar los equipos.</strong>',
        '  <span>Revisa la conexion con el inventario y vuelve a actualizar.</span>',
        '</div>'
      ].join("");
    }).finally(function () {
      dashboardInventoryState.loading = false;
    });
  }

  function ensureDashboardInventoryPanel() {
    var mount = dashboardInventoryMount();
    if (!mount) return;

    var panel = document.querySelector(".geimser-dashboard-inventory");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "geimser-dashboard-inventory";
      panel.setAttribute("aria-label", "Inventario de equipos");
      panel.innerHTML = [
        '<header class="geimser-dashboard-inventory-head">',
        '  <div>',
        '    <span>Inventario IT</span>',
        '    <h2>Equipos registrados</h2>',
        '  </div>',
        '  <button type="button" class="geimser-dashboard-inventory-refresh">Actualizar</button>',
        '</header>',
        '<div class="geimser-dashboard-inventory-stats" aria-label="Resumen de equipos"></div>',
        '<div class="geimser-dashboard-inventory-content"></div>'
      ].join("");

      panel.querySelector(".geimser-dashboard-inventory-refresh").addEventListener("click", function () {
        loadDashboardInventory(panel, true);
      });
    }

    if (panel.parentElement !== mount) {
      mount.appendChild(panel);
    }

    loadDashboardInventory(panel);
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

  function setRemoteFlow(modal, flow) {
    var equipmentFlow = flow === "equipos";
    modal.classList.remove("is-session-active");
    modal.classList.toggle("is-equipment-flow", equipmentFlow);
    modal.classList.toggle("is-install-flow", !equipmentFlow);
    modal.querySelector(".geimser-remote-frame").src = meshLoginUrl("/");
    modal.querySelector(".geimser-remote-assets").hidden = !equipmentFlow;
    modal.querySelector(".geimser-remote-install").hidden = equipmentFlow;
    if (equipmentFlow) {
      loadRemoteAssets(modal);
    }
  }

  function copyRemoteInstallSteps(button) {
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
  }

  function ensureRemoteModalInteractions() {
    if (window.__geimserRemoteModalInteractions) return;
    window.__geimserRemoteModalInteractions = true;

    window.addEventListener("click", function (event) {
      var target = event.target;
      var modal = target && target.closest ? target.closest(".geimser-remote-modal") : null;
      if (!modal) return;

      if (target === modal || target.closest(".geimser-remote-close")) {
        modal.classList.remove("is-open");
      } else if (target.closest(".geimser-remote-home")) {
        setRemoteFlow(modal, "equipos");
      } else if (target.closest(".geimser-remote-register")) {
        setRemoteFlow(modal, "registrar");
      } else if (target.closest(".geimser-remote-copy-install")) {
        copyRemoteInstallSteps(target.closest(".geimser-remote-copy-install"));
      } else {
        var sessionButton = target.closest("[data-remote-session]");
        if (sessionButton) {
          openRemoteSession(modal, sessionButton.getAttribute("data-remote-session"));
        }
      }
    });
  }

  function ensureRemoteModal() {
    ensureRemoteModalInteractions();
    var existing = document.querySelector(".geimser-remote-modal");
    if (existing && existing.GeimserSetFlow) return existing;
    if (existing) existing.remove();

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
      '    <div class="geimser-remote-actions">',
      '      <button type="button" class="geimser-remote-home">Ver equipos</button>',
      '      <button type="button" class="geimser-remote-register">Instalador</button>',
      '      <a class="geimser-remote-open" target="_blank" rel="noopener">Abrir aparte</a>',
      '      <button type="button" class="geimser-remote-close" aria-label="Cerrar" title="Cerrar">&times;</button>',
      '    </div>',
      '  </div>',
      '  <div class="geimser-remote-body">',
      '    <main class="geimser-remote-stage">',
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

    modal.querySelector(".geimser-remote-agent-download").href = meshAgentInstallUrl();
    modal.querySelector(".geimser-remote-agent-full").href = meshDevicesUrl();
    modal.GeimserSetFlow = function (flow) {
      setRemoteFlow(modal, flow);
    };
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

  function ticketRemoteActionMount(app) {
    return app.querySelector(".tabsSidebar .sidebar-header") ||
      app.querySelector(".ticketZoom .attributeBar") ||
      app.querySelector(".ticketZoom .scrollPageHeader") ||
      app.querySelector(".ticketZoom");
  }

  function ensureTicketRemoteAction() {
    var app = document.querySelector("#app");
    if (!app) return;

    var hash = window.location.hash || "";
    var isPublicScreen = /^#(login|password_reset|signup|register)?$/.test(hash) ||
      Boolean(document.querySelector(".hero-unit"));
    var existing = document.querySelector(".geimser-ticket-remote-action");
    var isTicketScreen = /^#ticket\/(create|zoom|edit)|^#ticket\//.test(hash);

    // MeshCentral usa una identidad administrativa compartida. Hasta que
    // exista una identidad separada para resolutores, el acceso es solo Admin.
    if (isPublicScreen || !adminSidebarAccess() || !isTicketScreen) {
      if (existing) existing.remove();
      return;
    }

    var mount = ticketRemoteActionMount(app);
    if (!mount) {
      if (existing) existing.remove();
      return;
    }

    if (existing) {
      existing.textContent = "Tomar control";
      existing.dataset.geimserRemoteFlow = "equipos";
      if (existing.parentElement !== mount) mount.appendChild(existing);
      return;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "geimser-ticket-remote-action";
    button.textContent = "Tomar control";
    button.dataset.geimserRemoteFlow = "equipos";
    button.addEventListener("click", function () {
      openRemoteModal(button.dataset.geimserRemoteFlow || "registrar");
    });
    mount.appendChild(button);
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

  function completePendingBotLogin() {
    var session = currentSession();
    if (!session) return;

    var origin;
    try {
      origin = window.localStorage.getItem("geimserBotReturnOrigin");
    } catch (_error) {
      origin = "";
    }

    if (!origin) return;

    try {
      window.localStorage.removeItem("geimserBotReturnOrigin");
    } catch (_error) {
      // Best effort only.
    }

    window.location.href = "/geimser/bot/login?return_origin=" + encodeURIComponent(origin);
  }

  function applyGeimserUi() {
    var app = document.querySelector("#app");
    if (!app) return;

    requestGeimserAccess();
    markRouteState();
    enforceAgentTicketOnlyRoutes();
    enforceCustomerTicketCreateRoute();
    normalizeCmdbAdminNavigation();
    normalizeNativeControlContrast();
    normalizeTicketContrast();
    normalizeArticleContentContrast();
    normalizeProfileContrast();
    repairActivityFlowLayout();
    removeZammadBranding();
    normalizeVisibleBrandText();
    markNavigationSurface();
    ensureSidebarBrand();
    ensureInternalSidebarShortcuts();
    hideAgentRestrictedNavigation();
    normalizeSidebarTicketLabels();
    normalizeNewTicketButton();
    ensureDashboardInventoryPanel();
    ensureTicketRemoteAction();
    checkRemoteInstallFirstRun();
    forcePopupContrast();
    ensureProfileLogoutFallback();
    normalizeNativeCmdbLabels();
    syncNativeCmdbAssetsPanel();
    ensurePasswordVisibilityToggle();
    ensureTemporaryPasswordUserForm();
    ensureForcedPasswordChange();
    completePendingBotLogin();
  }

  window.GeimserContrastAudit = function () {
    try {
      applyGeimserUi();
    } catch (error) {
      window.console && window.console.warn && window.console.warn("Geimser UI audit skipped", error);
    }
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
      try {
        if (observer) observer.disconnect();
        patchTranslationPrompt();
        rememberTranslationPromptDismissal();
        applyGeimserUi();
      } catch (error) {
        window.console && window.console.warn && window.console.warn("Geimser UI update skipped", error);
      } finally {
        applying = false;
        observeChanges();
      }
    });
  }

  var attempts = 0;
  var warmup = window.setInterval(function () {
    attempts += 1;
    try {
      patchTranslationPrompt();
      rememberTranslationPromptDismissal();
      applyGeimserUi();
    } catch (error) {
      window.console && window.console.warn && window.console.warn("Geimser UI warmup skipped", error);
    }

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

(function() {
  function moduleAccessAllowed() {
    if (!window.GeimserAccess || !window.GeimserAccess.known || !window.GeimserAccess.known()) return null;
    return window.GeimserAccess.moduleAccess && window.GeimserAccess.moduleAccess();
  }

  function handleMapRoute() {
    var isMapRoute = window.location.hash === '#inventory-map';
    var container = document.getElementById('geimser-map-container');
    var mapVersion = '20260630c';
    
    if (isMapRoute) {
      var allowed = moduleAccessAllowed();
      if (allowed === null) return;
      if (!allowed) {
        if (container) container.style.display = 'none';
        window.location.hash = '#ticket/view';
        return;
      }

      if (!container) {
        container = document.createElement('div');
        container.id = 'geimser-map-container';
      }

      container.className = 'geimser-map-container';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.right = '0';
      container.style.bottom = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.zIndex = '999';
      container.style.backgroundColor = '#0f1522';

      if (container.dataset.geimserVersion !== mapVersion) {
        container.dataset.geimserVersion = mapVersion;
        container.innerHTML = 
          '<div class="geimser-map-shellbar">' +
          '  <h3>Geimser ITSM - Mapa de Activos</h3>' +
          '  <a href="#dashboard">Cerrar Mapa</a>' +
          '</div>' +
          '<iframe title="Mapa de Activos ITSM" src="/assets/inventory-map/index.html?v=' + mapVersion + '-' + Date.now() + '"></iframe>';
      }

      var mainEl = document.querySelector('#app .content.active') ||
        document.querySelector('#app .content.horizontal') ||
        document.querySelector('#app .main-content') ||
        document.querySelector('#app .content') ||
        document.getElementById('main');
      if (!mainEl) return; // Wait until Zammad renders the active content area

      if (container.parentElement !== mainEl) {
        mainEl.style.position = 'relative';
        mainEl.style.overflow = 'hidden';
        mainEl.appendChild(container);
      }
      container.style.display = 'block';
      
      var notFound = mainEl.querySelector('.notFound');
      if(notFound) notFound.style.display = 'none';

    } else {
      if (container) {
        container.style.display = 'none';
      }
    }
  }

  window.addEventListener('hashchange', handleMapRoute);
  
  // Disparar en el load y periodicamente por si Zammad recarga el main
  window.addEventListener('load', handleMapRoute);
  setInterval(handleMapRoute, 500);
})();

(function() {
  var loadedOnce = false;

  function moduleAccessAllowed() {
    if (!window.GeimserAccess || !window.GeimserAccess.known || !window.GeimserAccess.known()) return null;
    return window.GeimserAccess.moduleAccess && window.GeimserAccess.moduleAccess();
  }

  function csrfToken() {
    var meta = document.querySelector("meta[name='csrf-token']");
    return meta ? meta.getAttribute("content") : "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function formatDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch (_error) {
      return value;
    }
  }

  function statusLabel(status) {
    return {
      active: "Activo",
      consumed: "Leido",
      expired: "Expirado",
      deleted: "Eliminado"
    }[status] || status || "-";
  }

  function requestJson(url, options) {
    var request = Object.assign({
      credentials: "include",
      cache: "no-store",
      headers: {}
    }, options || {});

    request.headers = Object.assign({
      "Accept": "application/json"
    }, request.headers || {});

    if (request.body && !request.headers["Content-Type"]) {
      request.headers["Content-Type"] = "application/json";
    }

    var token = csrfToken();
    if (token) request.headers["X-CSRF-Token"] = token;

    return fetch(url, request).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) {
          throw new Error(payload.error || payload.message || ("HTTP " + response.status));
        }
        return payload;
      });
    });
  }

  function pageTemplate() {
    return [
      '<div class="geimser-secrets-page">',
      '  <header class="geimser-secrets-header">',
      '    <div>',
      '      <span class="geimser-secrets-kicker">Seguridad</span>',
      '      <h1>Secretos Seguros</h1>',
      '      <p>Comparte contrasenas, tokens y mensajes sensibles mediante enlaces temporales de una sola lectura.</p>',
      '    </div>',
      '    <a class="geimser-secrets-close" href="#dashboard">Cerrar</a>',
      '  </header>',
      '  <section class="geimser-secrets-grid">',
      '    <form class="geimser-secrets-card geimser-secrets-form" autocomplete="off">',
      '      <div class="geimser-secrets-card-head">',
      '        <h2>Nuevo secreto</h2>',
      '        <span>El contenido no se guarda en texto plano.</span>',
      '      </div>',
      '      <label>Tipo de secreto<select name="secret_type"><option value="password">Contrasena</option><option value="token">Token</option><option value="api_key">API Key</option><option value="code">Codigo</option><option value="credential">Credencial</option><option value="message">Mensaje</option><option value="other">Otro</option></select></label>',
      '      <label>Contenido secreto<div class="geimser-secret-textarea-wrap"><textarea class="geimser-secret-textarea is-masked" name="secret" rows="7" autocomplete="off" spellcheck="false" required maxlength="10240"></textarea><button type="button" class="geimser-secret-eye" title="Mostrar u ocultar">Mostrar</button></div></label>',
      '      <div class="geimser-secrets-two">',
      '        <label>Expiracion<select name="expires_in_seconds"><option value="600">10 minutos</option><option value="1800">30 minutos</option><option value="3600" selected>1 hora</option><option value="21600">6 horas</option><option value="43200">12 horas</option><option value="86400">1 dia</option><option value="259200">3 dias</option><option value="604800">7 dias</option></select></label>',
      '        <label>Lecturas maximas<input name="max_views" type="number" min="1" max="5" value="1" inputmode="numeric"></label>',
      '      </div>',
      '      <label>Descripcion opcional<input name="description" type="text" maxlength="180" autocomplete="off" placeholder="Ej: Credenciales VPN temporal"></label>',
      '      <button class="geimser-secrets-primary" type="submit">Generar enlace seguro</button>',
      '      <p class="geimser-secrets-message" role="status"></p>',
      '    </form>',
      '    <aside class="geimser-secrets-card geimser-secrets-result" aria-live="polite">',
      '      <div class="geimser-secrets-card-head">',
      '        <h2>Enlace generado</h2>',
      '        <span>Disponible solo al crear el secreto.</span>',
      '      </div>',
      '      <div class="geimser-secrets-empty">Cuando generes un enlace aparecera aqui para copiarlo.</div>',
      '    </aside>',
      '  </section>',
      '  <section class="geimser-secrets-card geimser-secrets-history">',
      '    <div class="geimser-secrets-card-head">',
      '      <h2>Historial</h2>',
      '      <button type="button" class="geimser-secrets-secondary" data-action="refresh">Actualizar</button>',
      '    </div>',
      '    <div class="geimser-secrets-table-wrap"><table><thead><tr><th>Descripcion</th><th>Tipo</th><th>Creado por</th><th>Expira</th><th>Estado</th><th>Lecturas</th><th></th></tr></thead><tbody><tr><td colspan="7">Cargando...</td></tr></tbody></table></div>',
      '  </section>',
      '</div>'
    ].join("");
  }

  function renderResult(container, record) {
    var result = container.querySelector(".geimser-secrets-result");
    result.innerHTML = [
      '<div class="geimser-secrets-card-head">',
      '  <h2>Enlace generado</h2>',
      '  <span>Copialo ahora; por seguridad el token no se vuelve a mostrar en el historial.</span>',
      '</div>',
      '<div class="geimser-secrets-linkbox">',
      '  <input type="text" readonly value="' + escapeHtml(record.link || "") + '">',
      '  <button type="button" class="geimser-secrets-secondary" data-action="copy-link">Copiar enlace</button>',
      '</div>',
      '<dl class="geimser-secrets-summary">',
      '  <div><dt>Expira</dt><dd>' + escapeHtml(formatDate(record.expires_at)) + '</dd></div>',
      '  <div><dt>Lecturas</dt><dd>' + escapeHtml(record.max_views) + '</dd></div>',
      '  <div><dt>Estado</dt><dd>' + escapeHtml(statusLabel(record.status)) + '</dd></div>',
      '</dl>',
      '<button type="button" class="geimser-secrets-danger" data-action="delete-created" data-id="' + escapeHtml(record.id) + '">Eliminar enlace</button>'
    ].join("");

    var copy = result.querySelector('[data-action="copy-link"]');
    copy.addEventListener("click", function () {
      var input = result.querySelector("input");
      input.select();
      var value = input.value;
      Promise.resolve(navigator.clipboard ? navigator.clipboard.writeText(value) : document.execCommand("copy")).then(function () {
        copy.textContent = "Copiado";
        setTimeout(function () { copy.textContent = "Copiar enlace"; }, 1400);
      });
    });

    var deleteButton = result.querySelector('[data-action="delete-created"]');
    deleteButton.addEventListener("click", function () {
      deleteSecret(container, record.id);
    });
  }

  function renderHistory(container, records) {
    var tbody = container.querySelector(".geimser-secrets-history tbody");
    if (!records || !records.length) {
      tbody.innerHTML = '<tr><td colspan="7">Todavia no hay secretos creados.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(function (record) {
      return [
        '<tr>',
        '<td><strong>' + escapeHtml(record.description || "Sin descripcion") + '</strong></td>',
        '<td>' + escapeHtml(record.secret_type_label) + '</td>',
        '<td>' + escapeHtml(record.created_by) + '</td>',
        '<td>' + escapeHtml(formatDate(record.expires_at)) + '</td>',
        '<td><span class="geimser-secrets-status is-' + escapeHtml(record.status) + '">' + escapeHtml(statusLabel(record.status)) + '</span></td>',
        '<td>' + escapeHtml(record.view_count) + ' / ' + escapeHtml(record.max_views) + '</td>',
        '<td>' + (record.active ? '<button type="button" class="geimser-secrets-danger" data-action="delete" data-id="' + escapeHtml(record.id) + '">Eliminar</button>' : '') + '</td>',
        '</tr>'
      ].join("");
    }).join("");

    tbody.querySelectorAll('[data-action="delete"]').forEach(function (button) {
      button.addEventListener("click", function () {
        deleteSecret(container, button.getAttribute("data-id"));
      });
    });
  }

  function loadHistory(container) {
    return requestJson("/api/secure-secrets").then(function (payload) {
      var message = container.querySelector(".geimser-secrets-message");
      if (payload.key_configured === false) {
        message.textContent = "Falta configurar GEIMSER_SECURE_SECRETS_KEY para habilitar la creacion.";
        message.classList.add("is-error");
      }
      renderHistory(container, payload.records || []);
    }).catch(function (error) {
      renderHistory(container, []);
      var message = container.querySelector(".geimser-secrets-message");
      message.textContent = error.message || "No fue posible cargar el historial.";
      message.classList.add("is-error");
    });
  }

  function deleteSecret(container, id) {
    if (!id) return;
    requestJson("/api/secure-secrets/" + encodeURIComponent(id), {
      method: "DELETE"
    }).then(function () {
      loadHistory(container);
      var result = container.querySelector(".geimser-secrets-result");
      result.innerHTML = [
        '<div class="geimser-secrets-card-head"><h2>Enlace generado</h2><span>Disponible solo al crear el secreto.</span></div>',
        '<div class="geimser-secrets-empty">El enlace fue eliminado.</div>'
      ].join("");
    }).catch(function (error) {
      var message = container.querySelector(".geimser-secrets-message");
      message.textContent = error.message || "No fue posible eliminar el enlace.";
      message.classList.add("is-error");
    });
  }

  function bindSecretsPage(container) {
    var form = container.querySelector(".geimser-secrets-form");
    var textarea = form.querySelector("textarea[name='secret']");
    var eye = form.querySelector(".geimser-secret-eye");
    var message = form.querySelector(".geimser-secrets-message");

    eye.addEventListener("click", function () {
      var masked = textarea.classList.toggle("is-masked");
      eye.textContent = masked ? "Mostrar" : "Ocultar";
      textarea.focus();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      message.textContent = "";
      message.classList.remove("is-error", "is-ok");

      var data = new FormData(form);
      var payload = {
        secret_type: data.get("secret_type"),
        secret: data.get("secret"),
        expires_in_seconds: Number(data.get("expires_in_seconds")),
        max_views: Number(data.get("max_views")),
        description: data.get("description")
      };

      var submit = form.querySelector("button[type='submit']");
      submit.disabled = true;
      submit.textContent = "Generando...";

      requestJson("/api/secure-secrets", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then(function (response) {
        textarea.value = "";
        form.querySelector("input[name='description']").value = "";
        message.textContent = "Enlace seguro generado.";
        message.classList.add("is-ok");
        renderResult(container, response.record);
        loadHistory(container);
      }).catch(function (error) {
        message.textContent = error.message || "No fue posible crear el secreto.";
        message.classList.add("is-error");
      }).finally(function () {
        submit.disabled = false;
        submit.textContent = "Generar enlace seguro";
      });
    });

    container.querySelector('[data-action="refresh"]').addEventListener("click", function () {
      loadHistory(container);
    });
  }

  function handleSecretsRoute() {
    var isSecretsRoute = window.location.hash === '#secure-secrets';
    var container = document.getElementById('geimser-secrets-container');

    if (isSecretsRoute) {
      var allowed = moduleAccessAllowed();
      if (allowed === null) return;
      if (!allowed) {
        if (container) container.style.display = 'none';
        window.location.hash = '#ticket/view';
        return;
      }

      if (!container) {
        container = document.createElement('div');
        container.id = 'geimser-secrets-container';
        container.className = 'geimser-secrets-container';
        container.innerHTML = pageTemplate();
        bindSecretsPage(container);
      }

      var mainEl = document.querySelector('#app .content.active') ||
        document.querySelector('#app .content.horizontal') ||
        document.querySelector('#app .main-content') ||
        document.querySelector('#app .content') ||
        document.getElementById('main');
      if (!mainEl) return;

      if (container.parentElement !== mainEl) {
        mainEl.style.position = 'relative';
        mainEl.style.overflow = 'hidden';
        mainEl.appendChild(container);
      }

      container.style.display = 'block';
      var notFound = mainEl.querySelector('.notFound');
      if (notFound) notFound.style.display = 'none';
      if (!loadedOnce) {
        loadedOnce = true;
        loadHistory(container);
      }
    } else if (container) {
      container.style.display = 'none';
    }
  }

  window.addEventListener('hashchange', handleSecretsRoute);
  window.addEventListener('load', handleSecretsRoute);
  setInterval(handleSecretsRoute, 500);
})();


