// Runs in <head> so the saved theme is applied before first paint (no flash).
(function () {
  try { var t = localStorage.getItem('rh_theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
})();
