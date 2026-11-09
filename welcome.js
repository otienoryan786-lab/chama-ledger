// If a screenshot cannot be loaded (for example a file was not uploaded yet), hide that figure
// instead of showing a broken-image icon. Written as a file because the page's security policy
// does not allow inline scripts.
(function () {
  "use strict";
  document.querySelectorAll("figure img").forEach(function (img) {
    var hide = function () { var f = img.closest("figure"); if (f) f.hidden = true; };
    img.addEventListener("error", hide);
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("loading") !== "lazy") hide();
  });
})();
