(function () {
  var query = new URLSearchParams(window.location.search);
  if (query.get("geimserautoconnect") !== "1") return;

  var attempts = 0;
  var connectAttempts = 0;
  var timer = window.setInterval(function () {
    attempts += 1;

    try {
      var connectButton = document.getElementById("connectbutton1");
      var disconnectButton = document.getElementById("disconnectbutton1");
      var status = document.getElementById("deskstatus");
      var statusText = status ? status.textContent.toLowerCase() : "";
      if (typeof go === "function" && typeof xxcurrentView !== "undefined" && xxcurrentView !== 11) {
        go(11);
      }

      var nodeReady = typeof currentNode !== "undefined" &&
        currentNode &&
        (currentNode.conn & 1) &&
        currentNode.agent &&
        (currentNode.agent.caps & 1);
      var connected = typeof desktop !== "undefined" && desktop && desktop.State === 3;
      var failed = typeof desktop !== "undefined" &&
        desktop &&
        desktop.State !== 3 &&
        statusText.indexOf("desconect") !== -1;
      var desktopReady = nodeReady &&
        typeof desktop !== "undefined" &&
        !desktop &&
        connectButton &&
        !connectButton.disabled;

      window.geimserMeshAutoconnect = {
        attempts: attempts,
        connectAttempts: connectAttempts,
        nodeReady: !!nodeReady,
        desktopState: typeof desktop !== "undefined" && desktop ? desktop.State : null,
        status: statusText
      };

      if (connected) {
        window.clearInterval(timer);
      } else if (failed && disconnectButton && connectAttempts < 6 && attempts % 6 === 0) {
        disconnectButton.click();
      } else if (desktopReady && connectAttempts < 6) {
        connectAttempts += 1;
        connectButton.click();
      } else if (attempts >= 180) {
        window.clearInterval(timer);
      }
    } catch (_error) {
      if (attempts >= 180) window.clearInterval(timer);
    }
  }, 500);
})();
