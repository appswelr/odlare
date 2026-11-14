/* 14 nov 2026 · «Pruébala aquí, sin registrarte». Datos inventados, no se guarda nada, no se envía nada. */
(function () {
  var caja = document.getElementById("prueba"); if (!caja) return;
  var bots = [].slice.call(caja.querySelectorAll("[data-paso]"));
  var partes = [].slice.call(caja.querySelectorAll("[data-ver]"));
  var num = document.getElementById("dNum"), antes = document.getElementById("dAntes");
  var apuntado = false, reloj = null;
  function dinero(v) { return "£" + v.toFixed(2); }
  function bajar(desde, hasta) {
    clearInterval(reloj); var i = 0, n = 18;
    reloj = setInterval(function () { i++; num.textContent = dinero(desde + (hasta - desde) * (i / n)); if (i >= n) clearInterval(reloj); }, 30);
  }
  function paso(p) {
    bots.forEach(function (b) { var on = b.getAttribute("data-paso") === String(p); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    partes.forEach(function (el) {
      var lista = el.getAttribute("data-ver").split(" "), ver = lista.indexOf(String(p)) > -1;
      if (el.hasAttribute("data-si-apuntado") && !apuntado) ver = false;
      if (el.hasAttribute("data-no-apuntado") && apuntado) ver = false;
      if (ver && el.hidden) { el.hidden = false; el.classList.remove("ent"); void el.offsetWidth; el.classList.add("ent"); }
      else if (!ver) el.hidden = true;
    });
  }
  function apuntar() {
    if (!apuntado) { apuntado = true; antes.hidden = false; bajar(42.51, 25.08); }
    paso(3);
  }
  bots.forEach(function (b) { b.addEventListener("click", function () { var p = +b.getAttribute("data-paso"); if (p === 3 && !apuntado) { apuntar(); return; } paso(p); }); });
  var ba = document.getElementById("dApuntar"); if (ba) ba.addEventListener("click", apuntar);
  var bn = document.getElementById("dNoti"); if (bn) bn.addEventListener("click", function () { paso(2); });
  paso(1);
})();
