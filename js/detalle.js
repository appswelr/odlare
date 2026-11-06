/* Pantalla de detalle de cada app: se abre al tocar una app (Mis Finanzas, PuntoBalance, Mis Compras).
   Las pantallas del celular / laptop cambian solas; el idioma sigue al de la web (data-es / data-en). */
(function () {
  "use strict";
  var ov = document.getElementById("dv");
  if (!ov) return;
  var raiz = document.documentElement, velo = document.getElementById("velo");
  var DUR = 3600;
  var quieto = false;
  try { quieto = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }
  if (quieto) ov.classList.add("dv-still");
  ov.style.setProperty("--dur", DUR + "ms");

  var P = {}, tabs = [].slice.call(ov.querySelectorAll(".dv-tab"));
  [].forEach.call(ov.querySelectorAll(".dv-p"), function (el) {
    P[el.getAttribute("data-p")] = {
      el: el,
      steps: [].slice.call(el.querySelectorAll(".dv-st")),
      shots: [].slice.call(el.querySelectorAll("[data-i].dv-shot")),
      chips: [].slice.call(el.querySelectorAll(".dv-chip[data-i]")),
      scr: el.querySelector(".phone .scr"),
      i: 0
    };
  });

  var cur = null, abierta = false, timer = null, volver = null, lang = function () { return raiz.lang === "en" ? "en" : "es"; };

  function fuentes(p) {
    [].forEach.call(p.el.querySelectorAll("img[data-src-es]"), function (im) {
      var s = im.getAttribute("data-src-" + lang()) || im.getAttribute("data-src-es");
      if (im.getAttribute("src") !== s) im.setAttribute("src", s);
    });
  }

  function mostrar(i) {
    var p = P[cur]; if (!p || !p.steps.length) return;
    var n = p.steps.length; i = ((i % n) + n) % n;
    p.steps.forEach(function (s, k) {
      var on = k === i;
      if (on) { s.classList.remove("on"); void s.offsetWidth; s.classList.add("on"); s.setAttribute("aria-current", "step"); }
      else { s.classList.remove("on"); s.removeAttribute("aria-current"); }
    });
    p.shots.forEach(function (x) { x.classList.toggle("on", +x.getAttribute("data-i") === i); });
    p.chips.forEach(function (x) { x.classList.toggle("on", +x.getAttribute("data-i") === i); });
    if (p.scr) p.scr.classList.toggle("dk", p.steps[i].getAttribute("data-dark") === "1");
    p.i = i;
  }

  function parar() { if (timer) { clearInterval(timer); timer = null; } }
  function seguir() {
    parar();
    var p = P[cur];
    if (!abierta || quieto || !p || p.steps.length < 2) return;
    timer = setInterval(function () { if (!document.hidden) mostrar(p.i + 1); }, DUR);
  }

  function elegir(k) {
    if (!P[k]) k = "fin";
    cur = k;
    Object.keys(P).forEach(function (x) { P[x].el.hidden = x !== k; });
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === k;
      t.setAttribute("aria-selected", on ? "true" : "false");
      if (on) { try { t.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) { } }
    });
    fuentes(P[k]);
    mostrar(0); seguir();
    ov.scrollTop = 0;
  }

  function foco() { return [].slice.call(ov.querySelectorAll("a[href],button:not([disabled])")).filter(function (e) { return e.offsetParent !== null; }); }
  function bloquear(b) {
    [].forEach.call(document.querySelectorAll("body > header, body > main, body > footer"), function (e) { try { e.inert = b; } catch (x) { } });
    raiz.classList.toggle("dv-lock", b);
  }

  function abrir(k) {
    volver = document.activeElement;
    abierta = true; ov.hidden = false; bloquear(true);
    try { history.pushState({ dv: 1 }, ""); } catch (e) { }
    elegir(k);
    var x = document.getElementById("dvX"); if (x) x.focus({ preventScroll: true });
  }
  function cerrar(desdeAtras) {
    if (!abierta) return;
    abierta = false; ov.hidden = true; parar(); bloquear(false);
    if (!desdeAtras) { try { if (history.state && history.state.dv) history.back(); } catch (e) { } }
    if (volver && volver.focus) { try { volver.focus({ preventScroll: true }); } catch (e) { } }
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-app]");
    if (!a || ov.contains(a)) return;
    e.preventDefault();
    abrir(a.getAttribute("data-app"));
  });
  document.addEventListener("pointerover", function (e) {
    var a = e.target.closest && e.target.closest("[data-app]");
    if (a && !ov.contains(a) && P[a.getAttribute("data-app")]) fuentes(P[a.getAttribute("data-app")]);
  });
  tabs.forEach(function (t) { t.addEventListener("click", function () { elegir(t.getAttribute("data-tab")); }); });
  [].forEach.call(ov.querySelectorAll(".dv-st"), function (b) {
    b.addEventListener("click", function () { mostrar(+b.getAttribute("data-i")); seguir(); });
  });
  document.getElementById("dvX").addEventListener("click", function () { cerrar(false); });
  addEventListener("popstate", function () { if (abierta) cerrar(true); });
  addEventListener("keydown", function (e) {
    if (!abierta) return;
    if (e.key === "Escape" && velo && velo.hidden) { cerrar(false); return; }
    if (e.key === "Tab" && velo && velo.hidden) {
      var f = foco(); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }, true);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) seguir(); });

  /* «Avísame» de Mis Compras: abre el formulario ya con el tema elegido */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-dv-form]");
    if (!b) return;
    var t = document.getElementById("fTema"), m = document.getElementById("fMsg");
    if (t) t.selectedIndex = 2;
    if (m && !m.value) m.value = lang() === "en" ? "Please let me know when My Shopping is out." : "Quiero que me avisen cuando salga Mis Compras.";
  }, true);

  /* Cambio de idioma: las pantallas de ejemplo siguen al idioma (si existe esa captura) */
  new MutationObserver(function () { if (cur) fuentes(P[cur]); }).observe(raiz, { attributes: true, attributeFilter: ["lang"] });
})();
