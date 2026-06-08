(function () {
  var query = new URLSearchParams(window.location.search);
  if (query.get("geimserautoconnect") !== "1") return;

  var attempts = 0;
  var timer = window.setInterval(function () {
    attempts += 1;

    try {
      var desktopReady = typeof currentNode !== "undefined" &&
        currentNode &&
        (currentNode.conn & 1) &&
        currentNode.agent &&
        (currentNode.agent.caps & 1) &&
        typeof desktop !== "undefined" &&
        desktop === null &&
        typeof connectDesktop === "function";

      if (desktopReady) {
        window.clearInterval(timer);
        connectDesktop(null, 3);
      } else if (attempts >= 120) {
        window.clearInterval(timer);
      }
    } catch (_error) {
      if (attempts >= 120) window.clearInterval(timer);
    }
  }, 500);
})();
