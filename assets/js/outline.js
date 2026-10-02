/* Document outline: highlights the section you're in, like a word processor's navigator. */
(function () {
  var nav = document.querySelector(".outline");
  if (!nav) return;

  // hideaway drawer
  var btn = document.createElement("button");
  btn.className = "outline-toggle";
  btn.type = "button";
  btn.setAttribute("aria-controls", "outline-panel");
  btn.innerHTML = '<span class="ico"><i></i><i></i><i></i></span><span class="lbl">Sections</span>';
  nav.id = "outline-panel";
  document.body.appendChild(btn);

  function setOpen(on) {
    nav.classList.toggle("open", on);
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    try { localStorage.setItem("outlineOpen", on ? "1" : "0"); } catch (e) {}
  }
  var stored = null;
  try { stored = localStorage.getItem("outlineOpen"); } catch (e) {}
  setOpen(stored === null ? window.innerWidth >= 1500 : stored === "1");

  btn.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A" && window.innerWidth < 1200) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("open")) setOpen(false);
  });
  // scroll-spy only applies when the outline points at in-page anchors
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;
  var targets = links.map(function (a) {
    return document.getElementById(a.getAttribute("href").slice(1));
  });
  function mark(i) {
    links.forEach(function (a, n) { a.classList.toggle("on", n === i); });
  }
  if (!("IntersectionObserver" in window)) return;
  var seen = targets.map(function () { return false; });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var i = targets.indexOf(e.target);
      if (i > -1) seen[i] = e.isIntersecting;
    });
    var first = seen.indexOf(true);
    if (first > -1) mark(first);
  }, { rootMargin: "-20% 0px -70% 0px" });
  targets.forEach(function (t) { if (t) io.observe(t); });
  mark(0);
})();
