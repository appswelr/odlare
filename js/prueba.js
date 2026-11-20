/* 15 nov 2026 · «Pruébala aquí, sin registrarte» con pantallas reales de Mis Finanzas 2.9.9
   (datos de ejemplo de Alex). No se guarda nada y no se envía nada. */
(function () {
  var caja = document.getElementById("prueba"); if (!caja) return;
  var bots = [].slice.call(caja.querySelectorAll("[data-paso]"));
  var imgs = {}; [].forEach.call(caja.querySelectorAll("[data-pimg]"), function (i) { imgs[i.getAttribute("data-pimg")] = i; });
  var n1 = document.getElementById("pNoti1"), n4 = document.getElementById("pNoti4");
  var bG = document.getElementById("pGuardar"), toast = document.getElementById("pToast"), cambio = document.getElementById("pCambio");
  var apuntado = false, relojes = [];
  function lang() { return document.documentElement.lang === "en" ? "en" : "es"; }
  function fotos() { var l = lang(); for (var k in imgs) { var src = "img/prueba-" + k + "-" + l + "-v4.webp"; if (imgs[k].getAttribute("src") !== src) imgs[k].setAttribute("src", src); } }
  function ver(k) { for (var x in imgs) { imgs[x].classList.toggle("on", x === k); imgs[x].style.opacity = ""; } }
  function limpiar() { relojes.forEach(clearTimeout); relojes = []; toast.classList.remove("on"); }
  function marcar(p) { bots.forEach(function (b) { var on = b.getAttribute("data-paso") === String(p); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); }
  function paso(p) {
    limpiar(); marcar(p);
    n1.classList.toggle("on", p === 1); n4.classList.toggle("on", p === 4);
    bG.classList.toggle("on", p === 2);
    if (p === 1) { apuntado = false; cambio.classList.remove("on"); ver("1"); }
    if (p === 2) ver("2");
    if (p === 3) { if (apuntado) { ver("3b"); cambio.classList.add("on"); } else guardar(); }
    if (p === 4) ver(apuntado ? "3b" : "3a");
  }
  function guardar() {
    limpiar(); marcar(3); bG.classList.remove("on"); n1.classList.remove("on"); n4.classList.remove("on");
    ver("3a"); toast.classList.add("on");
    relojes.push(setTimeout(function () { apuntado = true; ver("3b"); cambio.classList.add("on"); }, 900));
    relojes.push(setTimeout(function () { toast.classList.remove("on"); }, 2400));
  }
  bots.forEach(function (b) { b.addEventListener("click", function () { paso(+b.getAttribute("data-paso")); }); });
  n1.addEventListener("click", function () { paso(2); });
  bG.addEventListener("click", guardar);
  new MutationObserver(fotos).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  fotos(); paso(1);
})();
