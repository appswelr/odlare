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
     La app lo revisa al abrirse y cada 10 minutos; si hay una más nueva, avisa (aviso arriba, puntito ámbar, «Acerca de»). */
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
    var t = document.getElementById("pb-aviso"); if (t) t.querySelector(".pb-tx").textContent = "Actualizando…";
    var tareas = [];
    if (window.caches) tareas.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    if (navigator.serviceWorker) tareas.push(navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); }));
    Promise.all(tareas).catch(function () { }).then(function () { location.reload(); });
  }
  window.PB_ACT = { estado: function () { return EST; }, buscar: buscar, actualizar: actualizar };

  function luego(v) { try { if (v) sessionStorage.setItem("pb-luego", v); return sessionStorage.getItem("pb-luego"); } catch (e) { return null; } }
  /* 5.0.0-alpha22: pastilla en la barra de arriba (computadora/tablet) o justo debajo (celular y modo de ejemplo) */
  function vista(v) { try { if (v) localStorage.setItem("pb_ver_vista", v); return localStorage.getItem("pb_ver_vista"); } catch (e) { return null; } }
  function corta(v) { return window.innerWidth <= 760 ? String(v).replace(/^\d+\.\d+\.\d+-/, "") : v; }
  function pintarAviso() {
    var t = document.getElementById("pb-aviso");
    var nueva = EST.nueva && luego() !== EST.nueva.ver;
    var ant = vista();
    if (!ant) { vista(actual()); ant = actual(); }               // primera vez en este aparato: no hay nada que contar
    var hecha = !nueva && ant !== actual() && compara(actual(), ant) > 0;
    if ((!nueva && !hecha) || document.querySelector(".v-acerca")) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement("div"); t.id = "pb-aviso"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.classList.toggle("bajo", !!document.getElementById("pbDemo"));
    if (nueva) {
      t.innerHTML = '<span class="pb-tx">🎉 Versión nueva · <b>' + corta(EST.nueva.ver) + '</b></span><button type="button" class="pb-si">Actualizar</button><button type="button" class="pb-x" aria-label="Más tarde">✕</button>';
      t.querySelector(".pb-si").onclick = actualizar;
      t.querySelector(".pb-x").onclick = function () { luego(EST.nueva.ver); t.remove(); };
    } else {
      t.innerHTML = '<span class="pb-tx">✅ Actualizada a <b>' + corta(actual()) + '</b></span><button type="button" class="pb-si">Ver novedades</button><button type="button" class="pb-x" aria-label="Cerrar">✕</button>';
      t.querySelector(".pb-si").onclick = function () { vista(actual()); t.remove(); if (window.SHELL) window.SHELL.ir("acerca"); };
      t.querySelector(".pb-x").onclick = function () { vista(actual()); t.remove(); };
    }
  }
  css.textContent += "#pb-aviso{position:fixed;z-index:95;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:#24376F;border:1px solid #3B4F8C;color:#fff;border-radius:999px;padding:5px 6px 5px 14px;font-size:13.5px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.25);max-width:calc(100% - 24px)}" +
    "#pb-aviso.bajo{top:66px}#pb-aviso .pb-tx{overflow:hidden;text-overflow:ellipsis}" +
    "#pb-aviso .pb-si{background:#F4A62A;border:0;color:#151A2D;font:inherit;font-weight:800;font-size:12.5px;border-radius:999px;padding:6px 12px;cursor:pointer}" +
    "#pb-aviso .pb-x{background:none;border:0;color:#C9D2F0;font-size:15px;padding:0 8px;cursor:pointer}" +
    "@media(max-width:760px){#pb-aviso{top:62px}#pb-aviso.bajo{top:62px}}";
  window.addEventListener("resize", function () { if (document.getElementById("pb-aviso")) pintarAviso(); });
  document.addEventListener("DOMContentLoaded", function () { setTimeout(pintarAviso, 1200); });
  var ultima = 0;
  function quizas() { if (Date.now() - ultima > 540e3) { ultima = Date.now(); buscar(); } }   // 5.0.0-alpha22: cada 10 minutos
  window.addEventListener("load", function () { setTimeout(quizas, 1500); });
  setInterval(quizas, 600e3);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") quizas(); });

  // para que se pueda instalar y abra rápido
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { }); });
  }
})();
