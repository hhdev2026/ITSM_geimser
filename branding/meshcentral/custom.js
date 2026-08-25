(function () {
  function installResponsiveDesktopLayout() {
    var style = document.createElement('style');
    style.id = 'geimser-responsive-desktop-layout';
    style.textContent = [
      'html,body{width:100%;max-width:100%;min-width:0!important;overflow-x:hidden!important;}',
      '#container{width:100%!important;max-width:100%!important;overflow:hidden!important;}',
      '#topbar,#column_l,#column_r{position:absolute!important;left:104px!important;right:0!important;width:auto!important;max-width:calc(100vw - 104px)!important;box-sizing:border-box!important;}',
      '#topbar{top:64px!important;height:34px!important;}',
      '#column_l,#column_r{top:98px!important;bottom:0!important;height:auto!important;min-width:0!important;padding:12px!important;overflow:hidden!important;}',
      '#p10,#p11{width:100%!important;height:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:hidden!important;}',
      '#p10info{height:calc(100vh - 198px)!important;max-height:calc(100vh - 198px)!important;padding-right:4px!important;box-sizing:border-box!important;overflow-y:auto!important;overflow-x:hidden!important;}',
      '#p10info>table{width:100%!important;table-layout:fixed!important;}',
      '#p10html{min-width:0!important;overflow-wrap:anywhere!important;word-break:break-word!important;}',
      '#p10html2,#p10html3,#p10html4,#p10html5{max-width:100%!important;overflow-x:auto!important;}',
      '#p10info>table td:last-child{width:150px!important;}',
      '#MainComputerImage{width:min(150px,14vw)!important;height:auto!important;max-width:100%!important;}',
      '#deskarea0,#deskarea3x,#DeskParent{max-width:100%!important;min-width:0!important;box-sizing:border-box!important;}',
      '#deskarea3x,#DeskParent{overflow:hidden!important;}',
      '#Desk{max-width:100%;}',
      'body.geimser-remote-desktop #masthead,body.geimser-remote-desktop #topbar,body.geimser-remote-desktop #page_leftbar{display:none!important;}',
      'body.geimser-remote-desktop #column_l{top:0!important;left:0!important;right:0!important;width:100%!important;max-width:100vw!important;height:100vh!important;padding:0!important;}',
      'body.geimser-remote-desktop #p11{padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;}',
      'body.geimser-remote-desktop #p11title{min-height:44px!important;padding:7px 12px!important;}',
      'body.geimser-remote-desktop #deskarea0{margin-top:0!important;border-radius:0!important;border-left:0!important;border-right:0!important;box-shadow:none!important;}',
      '@media(max-width:760px){#topbar,#column_l,#column_r{left:80px!important;max-width:calc(100vw - 80px)!important;}#column_l,#column_r{padding:8px!important;}#p10info{height:calc(100vh - 178px)!important;max-height:calc(100vh - 178px)!important;}#p10info>table{table-layout:auto!important;}#p10info>table td:last-child{display:none!important;}}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);
    window.addEventListener('load', function () {
      // MeshCentral loads its optional custom.css after this script. Moving our
      // responsive layer to the end keeps the Geimser layout in control.
      (document.head || document.documentElement).appendChild(style);
    }, { once: true });

    function fitDesktopToViewport() {
      if (typeof deskAdjust !== 'function' || typeof deskAspectRatio === 'undefined') return;

      // MeshCentral persists a per-browser zoom preference. Zoom mode uses a
      // scroll container; fixed aspect ratio scales the remote canvas without
      // cropping it or creating a horizontal scrollbar.
      if (deskAspectRatio !== 0) {
        deskAspectRatio = 0;
        if (typeof putstore === 'function') putstore('deskAspectRatio', '0');
      }
      deskAdjust();
    }

    function prioritizeRemoteDesktop() {
      var isDesktop = typeof xxcurrentView !== 'undefined' && xxcurrentView === 11;
      var hadDesktopClass = document.body.classList.contains('geimser-remote-desktop');
      document.body.classList.toggle('geimser-remote-desktop', isDesktop);
      if (isDesktop !== hadDesktopClass) window.setTimeout(fitDesktopToViewport, 50);
    }

    window.addEventListener('resize', fitDesktopToViewport);
    window.setInterval(prioritizeRemoteDesktop, 500);
    var attempts = 0;
    var waitForDesktop = window.setInterval(function () {
      attempts += 1;
      fitDesktopToViewport();
      if (typeof deskAdjust === 'function' || attempts >= 40) window.clearInterval(waitForDesktop);
    }, 250);
  }

  installResponsiveDesktopLayout();

  var query = new URLSearchParams(window.location.search);
  if (query.get("geimserautoconnect") !== "1") return;

  var targetGotonode = query.get("gotonode") || "";
  if (!targetGotonode) return;

  // Si la URL tiene node= (modo direct-session de MeshCentral), redirigir a URL limpia.
  // En ese modo nodes={} siempre vacío, connectbutton1 nunca se habilita.
  if (query.get("node")) {
    window.location.replace("/?geimserautoconnect=1&gotonode=" + encodeURIComponent(targetGotonode));
    return;
  }

  // FASE 0 → buscar link del dispositivo en la lista y hacer click (→ viewmode 10)
  // FASE 1 → esperar viewmode 10, luego click en tab Escritorio (→ viewmode 11)
  // FASE 2 → esperar viewmode 11 y connectbutton1 habilitado
  // FASE 3 → click connectbutton1
  // FASE 4 → esperar "Conectado", detener timer

  var phase = 0;
  var attempts = 0;
  var clickAttempts = 0;
  var lastPhaseAttempt = 0;

  window.geimserMeshAutoconnect = { phase: 0, attempts: 0 };

  var timer = window.setInterval(function () {
    attempts += 1;

    try {
      var currentView = typeof xxcurrentView !== "undefined" ? xxcurrentView : -1;
      var statusText = ((document.getElementById("deskstatus") || {}).textContent || "").toLowerCase();
      var connected = /\bconectado\b|\bconnected\b/.test(statusText);

      window.geimserMeshAutoconnect = {
        phase: phase,
        attempts: attempts,
        clickAttempts: clickAttempts,
        currentView: currentView,
        status: statusText,
        connected: connected
      };

      if (connected && phase >= 3) {
        window.clearInterval(timer);
        phase = 4;
        return;
      }

      // ── FASE 0: click en el link del dispositivo en la lista ──────────────
      // Si ya estamos en viewmode >= 10, saltar directo a fase 1 (evitar click redundante que provoca nueva navegación).
      if (phase === 0) {
        if (currentView >= 10) {
          phase = 1;
          lastPhaseAttempt = attempts;
        } else {
          var nodeLinks = document.querySelectorAll("[onclick]");
          var deviceLink = null;
          for (var i = 0; i < nodeLinks.length; i++) {
            var oc = nodeLinks[i].getAttribute("onclick") || "";
            if (oc.indexOf(targetGotonode) !== -1 && oc.indexOf("gotoDevice") !== -1) {
              deviceLink = nodeLinks[i];
              break;
            }
          }
          if (deviceLink) {
            deviceLink.click();
            phase = 1;
            lastPhaseAttempt = attempts;
          }
        }
      }

      // ── FASE 1: esperar viewmode >= 10 y connectbutton1 habilitado ──────────
      // Nota: tras el click del device link (fase 0), el botón conectar queda
      // habilitado en viewmode=10 sin necesidad de navegar a viewmode=11.
      else if (phase === 1 && currentView >= 10) {
        var connectBtn = document.getElementById("connectbutton1");
        if (connectBtn && !connectBtn.disabled) {
          phase = 3; // saltar directo a fase 3 (click)
        }
      }

      // ── FASE 2: (ya no se usa — se salta de fase 1 a fase 3) ─────────────
      else if (phase === 2) {
        phase = 3;
      }

      // ── FASE 3: click connectbutton1 ──────────────────────────────────────
      else if (phase === 3 && clickAttempts < 3) {
        var btn = document.getElementById("connectbutton1");
        if (btn && !btn.disabled) {
          clickAttempts += 1;
          btn.click();
          lastPhaseAttempt = attempts;
        }
      }

      // Timeout de seguridad: 90 segundos
      if (attempts >= 180) {
        window.clearInterval(timer);
      }

      // Si una fase no avanza en 30s, reiniciar desde fase 0
      if (phase > 0 && phase < 3 && (attempts - lastPhaseAttempt) > 60) {
        phase = 0;
        lastPhaseAttempt = attempts;
      }

    } catch (_e) {
      if (attempts >= 180) window.clearInterval(timer);
    }
  }, 500);
})();
