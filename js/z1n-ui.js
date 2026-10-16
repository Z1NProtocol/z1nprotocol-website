/* Z1N shared UI: theme toggle and mobile menu.
   Pair with this inline snippet in <head>, before any stylesheet, so the
   saved theme applies before first paint:
   <script>try{if(localStorage.getItem('z1n-theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}</script>
*/
(function () {
  "use strict";

  var root = document.documentElement;

  function isLight() { return root.getAttribute("data-theme") === "light"; }

  function syncToggle(btn) {
    var light = isLight();
    btn.textContent = light ? "☾" : "☀";
    btn.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
    btn.setAttribute("title", light ? "Dark mode" : "Light mode");
  }

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    syncToggle(toggle);
    toggle.addEventListener("click", function () {
      if (isLight()) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", "light");
      try { localStorage.setItem("z1n-theme", isLight() ? "light" : "dark"); } catch (e) {}
      syncToggle(toggle);
    });
  }

  var menu = document.getElementById("menuToggle");
  var nav = document.getElementById("navLinks");
  if (menu && nav) {
    menu.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
      }
    });
  }
})();
