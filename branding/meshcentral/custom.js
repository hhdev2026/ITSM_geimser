(function () {
  var query = new URLSearchParams(window.location.search);
  if (query.get("geimserautoconnect") !== "1") return;

  // Parámetros del nodo objetivo extraídos de la URL
  var targetGotonode = query.get("gotonode") || "";
  var targetViewmode = parseInt(query.get("viewmode") || "11", 10);

  var attempts = 0;
  var readyTicks = 0;
  var clickAttempts = 0;
  var lastClickAttempt = 0;
  var gotoDeviceAttempts = 0;

  function isVisible(element) {
    if (!element || !element.getBoundingClientRect) return false;
    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Reintenta gotoDevice si currentNode es null.
  // MeshCentral llama gotoDevice en initialRender, pero si los nodos aún no
  // llegaron por WebSocket en ese momento, currentNode queda null en silencio.
  // Este retry cubre esa carrera.
  function tryGotoDevice() {
    if (!targetGotonode) return false;
    if (typeof gotoDevice !== "function") return false;

    var domainId = typeof domain !== "undefined" ? (domain || "") : "";
    var nodeId = "node/" + domainId + "/" + targetGotonode;

    try {
      gotoDevice(nodeId, targetViewmode);
      return typeof currentNode !== "undefined" && currentNode != null;
    } catch (_e) {
      return false;
    }
  }

  var timer = window.setInterval(function () {
    attempts += 1;

    try {
      var connectButton = document.getElementById("connectbutton1");
      var status = document.getElementById("deskstatus");
      var statusText = status ? status.textContent.toLowerCase() : "";
      var buttonText = connectButton ? connectButton.textContent.toLowerCase() : "";
      var currentView = typeof xxcurrentView !== "undefined" ? xxcurrentView : null;
      var desktopState = typeof desktop !== "undefined" && desktop ? desktop.State : null;

      // Si currentNode es null y tenemos gotonode, reintentar gotoDevice cada ~2s
      // hasta un máximo de 10 intentos (~20s). Esto cubre la carrera donde
      // initialRender llamó gotoDevice antes de que llegara el nodo por WebSocket.
      if (
        gotoDeviceAttempts < 10 &&
        attempts % 4 === 0 &&
        targetGotonode &&
        (typeof currentNode === "undefined" || currentNode == null)
      ) {
        gotoDeviceAttempts += 1;
        tryGotoDevice();
      }

      var nodeReady = typeof currentNode !== "undefined" &&
        currentNode &&
        (currentNode.conn & 1) &&
        currentNode.agent &&
        (currentNode.agent.caps & 1);
      var connected = desktopState === 3 || /conectado|connected/.test(statusText);
      var connecting = desktopState === 1 ||
        desktopState === 2 ||
        /conectando|connecting|negociando|starting|iniciando/.test(statusText);
      var buttonReady = connectButton &&
        !connectButton.disabled &&
        isVisible(connectButton) &&
        !/desconectar|disconnect/.test(buttonText);
      var desktopReady = nodeReady &&
        currentView === 11 &&
        buttonReady &&
        !connected &&
        !connecting;
      readyTicks = desktopReady ? readyTicks + 1 : 0;

      // Estado diagnóstico — consultable desde consola del iframe:
      // window.geimserMeshAutoconnect
      window.geimserMeshAutoconnect = {
        attempts: attempts,
        readyTicks: readyTicks,
        clickAttempts: clickAttempts,
        gotoDeviceAttempts: gotoDeviceAttempts,
        nodeReady: !!nodeReady,
        currentView: currentView,
        desktopState: desktopState,
        status: statusText,
        buttonText: buttonText,
        targetGotonode: targetGotonode
      };

      if (connected) {
        window.clearInterval(timer);
      } else if (readyTicks >= 2 && clickAttempts < 4 && attempts - lastClickAttempt >= 4) {
        lastClickAttempt = attempts;
        clickAttempts += 1;
        connectButton.click();
        readyTicks = 0;
      } else if (attempts >= 120) {
        window.clearInterval(timer);
      }
    } catch (_error) {
      if (attempts >= 120) window.clearInterval(timer);
    }
  }, 500);
})();
