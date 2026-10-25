/* PuntoBalance 5.0.0 · Detalles de la app instalable (web): instalar, funcionar sin la hoja y quitar lo que es solo de la hoja. */
(function () {
  // lo que solo existe en la versión de la hoja de Google
  var css = document.createElement("style");
  css.textContent = "#b-rec{display:none!important}" +
    ".pb-inst{display:none;margin:10px 0 0;width:100%;border:0;border-radius:10px;padding:9px 10px;background:#F4A62A;color:#1B2B5B;font:inherit;font-weight:800;font-size:13px;cursor:pointer}.pb-inst.on{display:block}";
  document.head.appendChild(css);

  // botón «Instalar la app» en el menú (computadora y tablet)
  var aviso = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); aviso = e; pintar(); });
  window.addEventListener("appinstalled", function () { aviso = null; pintar(); });
  function pintar() {
    var sv = document.getElementById("sh-ver"); if (!sv) return;
    var b = sv.querySelector(".pb-inst");
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "pb-inst"; b.textContent = "⊕ Instalar PuntoBalance"; sv.insertBefore(b, sv.firstChild);
      b.onclick = function () { if (!aviso) return; aviso.prompt(); aviso.userChoice.finally(function () { aviso = null; pintar(); }); }; }
    b.classList.toggle("on", !!aviso);
  }
  document.addEventListener("DOMContentLoaded", pintar);

  /* ===== Actualizaciones (5.0.0-alpha3): como en los celulares =====
     Cada versión publicada lleva version.json con su número y la lista de novedades.
     La app lo revisa al abrirse y cada hora; si hay una más nueva, avisa (aviso arriba, puntito ámbar, «Acerca de»). */
  var EST = { nueva: null, revisado: null, error: false, novedades: [] };
  function actual() { return (window.CFG && window.CFG.ver) || "0"; }
  function compara(a, b) {
    var pa = String(a).split("-"), pb = String(b).split("-");
    var na = pa[0].split("."), nb = pb[0].split(".");
    for (var i = 0; i < 3; i++) { var d = (parseInt(na[i], 10) || 0) - (parseInt(nb[i], 10) || 0); if (d) return d; }
    if (!pa[1] && !pb[1]) return 0;
    if (!pa[1]) return 1;
    if (!pb[1]) return -1;
    return pa[1].localeCompare(pb[1], undefined, { numeric: true });
  }
  function avisarCambio() { document.dispatchEvent(new Event("pb-act")); pintarAviso(); }
  function buscar() {
    return fetch("version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("sin version.json"); return r.json(); })
      .then(function (j) {
        EST.error = false; EST.revisado = new Date(); EST.novedades = j.novedades || [];
        if (compara(j.ver, actual()) > 0) {
          var cambios = [];
          EST.novedades.forEach(function (n) { if (compara(n.ver, actual()) > 0) cambios = cambios.concat(n.cambios || []); });
          EST.nueva = { ver: j.ver, fecha: j.fecha, cambios: cambios };
        } else EST.nueva = null;
      })
      .catch(function () { EST.error = true; })
      .then(avisarCambio);
  }
  function actualizar() {
    var t = document.getElementById("pb-aviso"); if (t) t.querySelector("b").textContent = "Actualizando PuntoBalance…";
    var tareas = [];
    if (window.caches) tareas.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    if (navigator.serviceWorker) tareas.push(navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); }));
    Promise.all(tareas).catch(function () { }).then(function () { location.reload(); });
  }
  window.PB_ACT = { estado: function () { return EST; }, buscar: buscar, actualizar: actualizar };

  function luego(v) { try { if (v) sessionStorage.setItem("pb-luego", v); return sessionStorage.getItem("pb-luego"); } catch (e) { return null; } }
  function pintarAviso() {
    var t = document.getElementById("pb-aviso");
    if (!EST.nueva || luego() === EST.nueva.ver || document.querySelector(".v-acerca")) { if (t) t.remove(); return; }
    if (!t) {
      t = document.createElement("div"); t.id = "pb-aviso"; t.setAttribute("role", "status");
      t.innerHTML = '<b></b><span></span><div class="pb-bt"><button type="button" class="pb-si">Actualizar ahora</button><button type="button" class="pb-nov">Ver novedades</button><button type="button" class="pb-no">Más tarde</button></div>';
      document.body.appendChild(t);
      t.querySelector(".pb-si").onclick = actualizar;
      t.querySelector(".pb-nov").onclick = function () { t.remove(); if (window.SHELL) window.SHELL.ir("acerca"); };
      t.querySelector(".pb-no").onclick = function () { luego(EST.nueva.ver); t.remove(); };
    }
    t.querySelector("b").textContent = "🎉 Hay una versión nueva de PuntoBalance";
    t.querySelector("span").textContent = "Versión " + EST.nueva.ver + " · Tus datos no se tocan.";
  }
  css.textContent += "#pb-aviso{position:fixed;z-index:90;top:58px;left:50%;transform:translateX(-50%);width:min(520px,calc(100% - 24px));background:#1B2B5B;color:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 14px 36px rgba(15,18,32,.35)}" +
    "#pb-aviso b{display:block;font-size:15px}#pb-aviso span{display:block;font-size:13px;color:#C9D2F0;margin-top:2px}" +
    "#pb-aviso .pb-bt{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}#pb-aviso button{border:1px solid #6A78A8;background:none;color:#fff;border-radius:10px;padding:8px 13px;font:inherit;font-weight:600;font-size:13px;cursor:pointer}" +
    "#pb-aviso .pb-si{background:#F4A62A;border-color:#F4A62A;color:#151A2D;font-weight:800}@media(max-width:760px){#pb-aviso{top:62px}}";
  var ultima = 0;
  function quizas() { if (Date.now() - ultima > 3600e3) { ultima = Date.now(); buscar(); } }
  window.addEventListener("load", function () { setTimeout(quizas, 1500); });
  setInterval(quizas, 600e3);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") quizas(); });

  // para que se pueda instalar y abra rápido
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { }); });
  }
})();
