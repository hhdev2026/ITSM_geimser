(function () {
  var query = new URLSearchParams(window.location.search);
  if (query.get("geimserautoconnect") !== "1") return;

  var attempts = 0;
  var readyTicks = 0;
  var clickAttempts = 0;
  var lastClickAttempt = 0;

  function isVisible(element) {
    if (!element || !element.getBoundingClientRect) return false;

    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
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

      window.geimserMeshAutoconnect = {
        attempts: attempts,
        readyTicks: readyTicks,
        clickAttempts: clickAttempts,
        nodeReady: !!nodeReady,
        currentView: currentView,
        desktopState: desktopState,
        status: statusText,
        buttonText: buttonText
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
