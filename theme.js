// Runs first, in the page head, so the right colours show before anything is drawn.
(function () {
  try {
    var t = localStorage.getItem("chamaLedger.theme") || "auto";
    var dark = t === "dark" || (t === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {}
})();
