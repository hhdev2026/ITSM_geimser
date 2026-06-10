(function () {
  var query = new URLSearchParams(window.location.search);
  if (query.get("geimserautoconnect") !== "1") return;

  var attempts = 0;
  var readyTicks = 0;
  var timer = window.setInterval(function () {
    attempts += 1;

    try {
      var connectButton = document.getElementById("connectbutton1");
      var status = document.getElementById("deskstatus");
      var statusText = status ? status.textContent.toLowerCase() : "";
      var currentView = typeof xxcurrentView !== "undefined" ? xxcurrentView : null;

      var nodeReady = typeof currentNode !== "undefined" &&
        currentNode &&
        (currentNode.conn & 1) &&
        currentNode.agent &&
        (currentNode.agent.caps & 1);
      var connected = typeof desktop !== "undefined" && desktop && desktop.State === 3;
      var desktopReady = nodeReady &&
        currentView === 11 &&
        typeof desktop !== "undefined" &&
        !desktop &&
        connectButton &&
        !connectButton.disabled;
      readyTicks = desktopReady ? readyTicks + 1 : 0;

      window.geimserMeshAutoconnect = {
        attempts: attempts,
        readyTicks: readyTicks,
        nodeReady: !!nodeReady,
        currentView: currentView,
        desktopState: typeof desktop !== "undefined" && desktop ? desktop.State : null,
        status: statusText
      };

      if (connected) {
        window.clearInterval(timer);
      } else if (readyTicks >= 2) {
        connectButton.click();
        window.clearInterval(timer);
      } else if (attempts >= 60) {
        window.clearInterval(timer);
      }
    } catch (_error) {
      if (attempts >= 60) window.clearInterval(timer);
    }
  }, 500);
})();
