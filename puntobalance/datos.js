/* PuntoBalance 5.0.0-alpha4 · «Tus datos»: copias de seguridad, exportar y cambiar de hoja (como «Copias y exportar» de Mis Finanzas).
   Todo vive en el Google Drive de la persona (permiso drive.file: la app solo ve lo que ella crea):
   - carpeta «PuntoBalance» › «Copias de seguridad»  (appProperties puntobalance = carpeta / copias)
   - la hoja de trabajo lleva puntobalance = 1; otras hojas suyas = 2; las copias = copia
   - en la hoja de trabajo: pb_ult (última copia, ms) y pb_auto ("0" = copia automática apagada)
   Así, en una laptop o un celular nuevo, al entrar con el mismo Gmail todo aparece igual. */
(function () {
  var DR = "https://www.googleapis.com/drive/v3/files", SH = "https://sheets.googleapis.com/v4/spreadsheets/";
  var CARPETA = "application/vnd.google-apps.folder", HOJA = "application/vnd.google-apps.spreadsheet";
  var MAX_COPIAS = 4, SEMANA = 7 * 864e5;
  function C() { return window.pbCuenta; }
  function conHoja() { return !!(C() && C().modo() === "hoja" && C().hojaId()); }
  function api(m, u, b) { return C().api(m, u, b); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); }
  function dos(n) { return String(n).padStart(2, "0"); }
  function hoy() { var d = new Date(); return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()); }
  function cuando(ms) {
    if (!ms) return "nunca";
    var d = new Date(Number(ms)), h = dos(d.getHours()) + ":" + dos(d.getMinutes());
    var a = new Date(); a.setHours(0, 0, 0, 0);
    var dias = Math.round((a - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return dias <= 0 ? "hoy, " + h : dias === 1 ? "ayer, " + h : "hace " + dias + " días";
  }
  function prop(clave, valor) { return "appProperties has { key='" + clave + "' and value='" + valor + "' }"; }
  function buscar(q, orden) {
    return api("GET", DR + "?q=" + encodeURIComponent(q) + "&fields=" + encodeURIComponent("files(id,name,createdTime,modifiedTime,appProperties)") +
      "&orderBy=" + encodeURIComponent(orden || "modifiedTime desc") + "&pageSize=100").then(function (o) { return o.files || []; });
  }

  /* ---------- carpetas en el Drive ---------- */
  function carpeta(clave, nombre, padre) {
    return buscar(prop("puntobalance", clave) + " and mimeType='" + CARPETA + "' and trashed=false").then(function (r) {
      if (r.length) return r[0];
      var c = { name: nombre, mimeType: CARPETA, appProperties: { puntobalance: clave } }; if (padre) c.parents = [padre];
      return api("POST", DR + "?fields=id,name", c);
    });
  }
  var carp = null;
  function carpetas() {
    if (!carp) {
      carp = carpeta("carpeta", "PuntoBalance").then(function (r) { return carpeta("copias", "Copias de seguridad", r.id).then(function (c) { return { raiz: r.id, copias: c.id }; }); });
      carp.catch(function () { carp = null; });
    }
    return carp;
  }
  function mover(id, destino) {
    return api("GET", DR + "/" + id + "?fields=parents").then(function (o) {
      var antes = (o.parents || []).join(",");
      if (antes === destino) return;
      return api("PATCH", DR + "/" + id + "?addParents=" + destino + (antes ? "&removeParents=" + antes : "") + "&fields=id", {});
    });
  }
  function info() { return api("GET", DR + "/" + C().hojaId() + "?fields=" + encodeURIComponent("id,name,modifiedTime,appProperties")); }
  function marcar(id, props) { return api("PATCH", DR + "/" + id + "?fields=id", { appProperties: props }); }

  /* ---------- copias ---------- */
  function limpiar() {
    return buscar(prop("puntobalance", "copia") + " and mimeType='" + HOJA + "' and trashed=false", "createdTime desc").then(function (r) {
      return Promise.all(r.slice(MAX_COPIAS).map(function (f) { return api("PATCH", DR + "/" + f.id + "?fields=id", { trashed: true }).catch(function () { }); }));
    });
  }
  function copiar() {
    var id = C().hojaId();
    return carpetas().then(function (c) {
      return api("POST", DR + "/" + id + "/copy?fields=id,name", { name: "PuntoBalance · copia " + hoy(), parents: [c.copias], appProperties: { puntobalance: "copia" } });
    }).then(function (r) {
      return marcar(id, { pb_ult: String(Date.now()) }).then(limpiar).then(function () { avisar(); return r; });
    });
  }
  /* al abrir la app: la hoja va a su carpeta y, si toca, copia automática semanal */
  function automatico() {
    if (!conHoja()) return;
    info().then(function (f) {
      var p = f.appProperties || {};
      try { if (localStorage.getItem("pb_ordenada") !== f.id) carpetas().then(function (c) { return mover(f.id, c.raiz); }).then(function () { localStorage.setItem("pb_ordenada", f.id); }).catch(function () { }); } catch (e) { }
      if (p.pb_auto === "0") return;
      if (Date.now() - Number(p.pb_ult || 0) < SEMANA) return;
      return copiar();
    }).catch(function () { });
  }

  /* ---------- cambiar de hoja ---------- */
  function hojas() {
    var q = "(" + prop("puntobalance", "1") + " or " + prop("puntobalance", "2") + " or " + prop("puntobalance", "copia") + ") and mimeType='" + HOJA + "' and trashed=false";
    return buscar(q);
  }
  function cambiar(id) {
    var actual = C().hojaId();
    if (!id || id === actual) return Promise.resolve();
    return marcar(id, { puntobalance: "1" })
      .then(function () { return marcar(actual, { puntobalance: "2" }).catch(function () { }); })
      .then(function () { return carpetas().then(function (c) { return mover(id, c.raiz); }).catch(function () { }); })
      .then(function () { try { localStorage.removeItem("pb_ordenada"); } catch (e) { } C().usarHoja(id); });
  }

  /* ---------- exportar ---------- */
  function bajar(blob, nombre) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
  }
  function excel() {
    var tipo = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return C().token().then(function (tk) {
      return fetch(DR + "/" + C().hojaId() + "/export?mimeType=" + encodeURIComponent(tipo), { headers: { Authorization: "Bearer " + tk } });
    }).then(function (r) { if (!r.ok) throw new Error("Google no pudo preparar el Excel (" + r.status + ")."); return r.blob(); })
      .then(function (b) { var n = "PuntoBalance " + hoy() + ".xlsx"; bajar(b, n); return n; });
  }
  function csv() {
    return api("GET", SH + C().hojaId() + "/values:batchGet?ranges=Ingresos&ranges=Gastos&valueRenderOption=FORMATTED_VALUE").then(function (o) {
      var celda = function (v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var partes = (o.valueRanges || []).map(function (vr, i) {
        var filas = (vr.values || []).filter(function (f) { return f.some(function (x) { return String(x).trim() !== ""; }); });
        return [[i ? "GASTOS" : "INGRESOS"]].concat(filas).map(function (f) { return f.map(celda).join(","); }).join("\r\n");
      });
      var n = "PuntoBalance ingresos y gastos " + hoy() + ".csv";
      bajar(new Blob(["﻿" + partes.join("\r\n\r\n")], { type: "text/csv;charset=utf-8" }), n);
      return n;
    });
  }

  /* ---------- puntito en el menú cuando cambia algo ---------- */
  function avisar() { document.dispatchEvent(new Event("pb-datos")); }

  /* ---------- estilos ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".v-datos{--ink:#151A2D;--muted:#6B7194;--line:#E6E8F1;height:100%;overflow:auto;padding:28px 30px 40px}" +
    ".v-datos .hidden{display:none!important}" +
    ".v-datos h1{margin:0;font-size:26px;letter-spacing:-.02em;color:var(--ink);font-weight:700}" +
    ".v-datos .lead{margin:4px 0 18px;color:var(--muted);font-size:13.5px}" +
    ".v-datos .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}" +
    ".v-datos .card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px}" +
    ".v-datos .card h2{margin:0 0 4px;font-size:16px;color:var(--ink)}.v-datos .card .d{color:var(--muted);font-size:12.5px;margin-bottom:6px}" +
    ".v-datos .it{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid #EEF0F6}.v-datos .it:first-of-type{border-top:0}" +
    ".v-datos .e{width:38px;height:38px;border-radius:11px;background:#EEF0FA;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}" +
    ".v-datos .tx{flex:1;min-width:0}.v-datos .tx b{display:block;font-size:14px;color:var(--ink)}.v-datos .tx small{color:var(--muted);font-size:12px}" +
    ".v-datos .go{border:1.5px solid #1B2B5B;color:#1B2B5B;background:#fff;border-radius:10px;padding:7px 13px;font:inherit;font-weight:700;font-size:12.5px;white-space:nowrap;cursor:pointer}" +
    ".v-datos .go.p{background:#1B2B5B;color:#fff}.v-datos .go:disabled{opacity:.5;cursor:progress}" +
    ".v-datos .ok{color:#12804A;font-weight:700}" +
    ".v-datos .hoja{display:flex;gap:12px;align-items:center;background:#F4F5FA;border-radius:14px;padding:12px;flex-wrap:wrap}" +
    ".v-datos .gs{width:40px;height:40px;border-radius:10px;background:#1E8E3E;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}" +
    ".v-datos .tog{appearance:none;-webkit-appearance:none;width:44px;height:26px;border-radius:999px;background:#C9CDDC;position:relative;cursor:pointer;flex:none;margin:0;transition:background .15s}" +
    ".v-datos .tog::after{content:'';position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}" +
    ".v-datos .tog:checked{background:#1E60E0}.v-datos .tog:checked::after{left:21px}" +
    ".v-datos .msg{font-size:13px;font-weight:600;margin-top:8px;min-height:18px}.v-datos .msg.ok{color:#12804A}.v-datos .msg.bad{color:#D92D20}.v-datos .msg.w{color:#6B7194}" +
    ".v-datos .nota{background:#EEF4FF;border:1px solid #CFDDFB;border-radius:14px;padding:12px 14px;font-size:13px;color:#1F2540;margin-top:16px;line-height:1.5}" +
    ".v-datos .pronto{font-size:10.5px;font-weight:800;background:#FEF3DC;color:#92580A;border-radius:999px;padding:2px 8px;margin-left:6px}" +
    ".v-datos .demo{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;text-align:center}.v-datos .demo p{color:var(--muted);margin:6px 0 14px}" +
    "@media (max-width:900px){.v-datos .grid{grid-template-columns:1fr}}" +
    "@media (max-width:760px){.v-datos{padding:18px 16px 90px}}" +
    "#pbHojas{position:fixed;inset:0;z-index:400;background:rgba(10,12,28,.5);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#pbHojas .m{background:#fff;border-radius:22px;padding:22px;width:100%;max-width:500px;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(15,18,32,.3);color:#1F2540}" +
    "#pbHojas h3{margin:0 0 4px;font-size:19px;color:#151A2D}#pbHojas p{margin:0 0 12px;color:#6B7194;font-size:13px}" +
    "#pbHojas label{display:flex;gap:12px;align-items:center;border:1.5px solid #E6E8F1;border-radius:14px;padding:11px 12px;margin-bottom:8px;cursor:pointer}" +
    "#pbHojas label:has(input:checked){border-color:#4F46E5;background:#F5F4FF}#pbHojas input{accent-color:#4F46E5;width:18px;height:18px;flex:none}" +
    "#pbHojas b{font-size:14px;color:#151A2D}#pbHojas small{display:block;color:#6B7194;font-size:12px}" +
    "#pbHojas .pill{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:#E8F7EE;color:#12804A;margin-left:6px}#pbHojas .pill.c{background:#EEF0FA;color:#4F46E5}" +
    "#pbHojas .b{display:flex;gap:8px;margin-top:12px}#pbHojas .b button{flex:1;border-radius:12px;padding:12px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;border:1px solid #CBD0E0;background:#fff;color:#151A2D}" +
    "#pbHojas .b .si{background:#1B2B5B;border-color:#1B2B5B;color:#fff}#pbHojas .b .si:disabled{opacity:.45;cursor:default}#pbHojas .err{color:#D92D20;font-size:13px;margin-top:8px}";
  document.head.appendChild(css);

  /* ---------- la pantalla ---------- */
  var TPL = '<div class="v-datos">' +
    '<h1>Tus datos</h1><div class="lead">Todo se guarda en <b>tu</b> Google Drive. Si cambias de computadora o celular, entra con el mismo Gmail y aparece todo.</div>' +
    '<div id="dt-demo" class="demo hidden"><div style="font-size:34px">☁️</div><h2 style="margin:6px 0 0;font-size:18px">Estás en modo de ejemplo</h2>' +
    '<p>Aquí no hay datos tuyos que copiar. Entra con Google y tus datos quedarán guardados en tu propio Drive, con copias de seguridad.</p>' +
    '<button type="button" class="go p" id="dt-entrar">Entrar con Google</button></div>' +
    '<div id="dt-todo">' +
    '<div class="card" style="margin-bottom:16px"><h2>📄 Tu hoja de ahora</h2>' +
    '<div class="hoja"><div class="gs">▦</div><div class="tx"><b id="dt-nom">Cargando…</b><small id="dt-cta"></small></div>' +
    '<button type="button" class="go" id="dt-abrir">Abrir en Google Sheets</button><button type="button" class="go" id="dt-cambiar">🔄 Cambiar de hoja</button></div>' +
    '<div class="msg" id="dt-m0"></div></div>' +
    '<div class="grid">' +
    '<div class="card"><h2>☁️ Copias de seguridad</h2><div class="d">Una foto de todos tus datos, guardada en tu Drive.</div>' +
    '<div class="it"><div class="e">💾</div><div class="tx"><b>Hacer una copia ahora</b><small>Última copia: <span id="dt-ult">…</span></small></div><button type="button" class="go p" id="dt-copiar">Copiar</button></div>' +
    '<label class="it"><div class="e">🔁</div><div class="tx"><b>Copia automática</b><small>Una vez por semana · guarda las 4 últimas</small></div><input type="checkbox" class="tog" id="dt-auto" checked></label>' +
    '<div class="it"><div class="e">📂</div><div class="tx"><b>Abrir mis copias en Drive</b><small>PuntoBalance › Copias de seguridad</small></div><button type="button" class="go" id="dt-carpeta">Abrir</button></div>' +
    '<div class="it"><div class="e">⏪</div><div class="tx"><b>Volver a una copia</b><small>Si algo salió mal, sigue desde una copia</small></div><button type="button" class="go" id="dt-volver">Elegir</button></div>' +
    '<div class="msg" id="dt-m1"></div></div>' +
    '<div class="card"><h2>⬇️ Exportar</h2><div class="d">Para tu contable, para imprimir o para guardar en tu laptop.</div>' +
    '<div class="it"><div class="e">📗</div><div class="tx"><b>Excel (.xlsx)</b><small>Todas tus pestañas: ingresos, gastos, clientes…</small></div><button type="button" class="go" id="dt-xlsx">Bajar</button></div>' +
    '<div class="it"><div class="e">📄</div><div class="tx"><b>CSV de ingresos y gastos</b><small>Para otras apps o tu contable</small></div><button type="button" class="go" id="dt-csv">Bajar</button></div>' +
    '<div class="it"><div class="e">📥</div><div class="tx"><b>Importar mi hoja anterior<span class="pronto">MUY PRONTO</span></b><small>Trae tus datos de otra hoja (ej. DJ_Invoice_v3.3)</small></div><button type="button" class="go" disabled>Importar</button></div>' +
    '<div class="msg" id="dt-m2"></div></div>' +
    '</div></div>' +
    '<div class="nota">💡 <b>¿Compraste una laptop o un celular nuevo?</b> Abre PuntoBalance, pulsa <b>«Entrar con Google»</b> con el mismo Gmail y la app encuentra sola tu hoja. No se pierde nada, porque nada se guarda solo en el aparato.</div>' +
    '</div>';

  function init(ROOT) {
    function $(id) { return ROOT.querySelector("#" + id); }
    function msg(n, t, cl) { var m = $("dt-m" + n); m.className = "msg " + (cl || ""); m.textContent = t || ""; }
    if (!conHoja()) {
      $("dt-demo").classList.remove("hidden"); $("dt-todo").classList.add("hidden");
      $("dt-entrar").onclick = function () { try { localStorage.removeItem("pb_modo"); } catch (e) { } location.reload(); };
      return {};
    }
    var vivo = true;
    function pintar() {
      info().then(function (f) {
        if (!vivo) return;
        var p = f.appProperties || {};
        $("dt-nom").textContent = f.name;
        $("dt-cta").textContent = "Cuenta: " + C().correo() + " · Drive › PuntoBalance";
        var u = $("dt-ult"); u.textContent = cuando(p.pb_ult); u.className = p.pb_ult && Date.now() - Number(p.pb_ult) < SEMANA ? "ok" : "";
        $("dt-auto").checked = p.pb_auto !== "0";
      }).catch(function (e) { if (vivo) msg(0, "No se pudo leer tu hoja: " + e.message, "bad"); });
    }
    function boton(id, n, trabajo, txt) {
      $(id).onclick = function () {
        var b = $(id); b.disabled = true; msg(n, txt, "w");
        trabajo().then(function (t) { msg(n, t, "ok"); pintar(); }, function (e) { msg(n, e.message, "bad"); }).then(function () { b.disabled = false; });
      };
    }
    $("dt-abrir").onclick = function () { window.open("https://docs.google.com/spreadsheets/d/" + C().hojaId() + "/edit", "_blank", "noopener"); };
    boton("dt-copiar", 1, function () { return copiar().then(function () { return "✓ Copia guardada en tu Google Drive."; }); }, "Haciendo la copia…");
    $("dt-auto").onchange = function () {
      var on = this.checked;
      marcar(C().hojaId(), { pb_auto: on ? "1" : "0" }).then(function () { msg(1, on ? "✓ Copia automática encendida." : "Copia automática apagada.", on ? "ok" : "w"); }, function (e) { msg(1, e.message, "bad"); });
    };
    $("dt-carpeta").onclick = function () {
      var w = window.open("about:blank", "_blank");
      carpetas().then(function (c) { var u = "https://drive.google.com/drive/folders/" + c.copias; if (w) w.location = u; else window.open(u, "_blank"); }, function (e) { if (w) w.close(); msg(1, e.message, "bad"); });
    };
    $("dt-cambiar").onclick = function () { elegir(false); };
    $("dt-volver").onclick = function () { elegir(true); };
    boton("dt-xlsx", 2, function () { return excel().then(function (n) { return "✓ Descargado: " + n; }); }, "Preparando el Excel…");
    boton("dt-csv", 2, function () { return csv().then(function (n) { return "✓ Descargado: " + n; }); }, "Preparando el CSV…");
    pintar();
    var f = function () { if (vivo) pintar(); };
    document.addEventListener("pb-datos", f);
    return { destroy: function () { vivo = false; document.removeEventListener("pb-datos", f); } };
  }

  function elegir(soloCopias) {
    var v = document.createElement("div"); v.id = "pbHojas";
    v.innerHTML = '<div class="m"><h3>' + (soloCopias ? "¿A qué copia quieres volver?" : "¿Con qué hoja quieres trabajar?") + "</h3>" +
      "<p>Estas son las hojas de PuntoBalance que hay en tu Drive. No se borra ninguna: la de ahora queda en la lista y puedes volver cuando quieras.</p>" +
      '<div id="pbHl">Buscando tus hojas…</div><div class="err" id="pbHe"></div>' +
      '<div class="b"><button type="button" id="pbHno">Cancelar</button><button type="button" class="si" id="pbHsi" disabled>Usar esta hoja</button></div></div>';
    document.body.appendChild(v);
    var cerrar = function () { v.remove(); };
    v.addEventListener("click", function (e) { if (e.target === v) cerrar(); });
    v.querySelector("#pbHno").onclick = cerrar;
    var actual = C().hojaId();
    hojas().then(function (fs) {
      fs.sort(function (a, b) { return (b.id === actual) - (a.id === actual); });
      if (soloCopias) fs = fs.filter(function (f) { return f.id === actual || (f.appProperties || {}).puntobalance === "copia"; });
      if (fs.length < 2) { v.querySelector("#pbHl").innerHTML = '<p style="margin:0">' + (soloCopias ? "Todavía no tienes copias. Pulsa «Copiar» para hacer la primera." : "Solo tienes esta hoja de PuntoBalance.") + "</p>"; return; }
      v.querySelector("#pbHl").innerHTML = fs.map(function (f) {
        var tipo = (f.appProperties || {}).puntobalance;
        var etiqueta = f.id === actual ? '<span class="pill">la de ahora</span>' : tipo === "copia" ? '<span class="pill c">copia</span>' : "";
        var fecha = tipo === "copia" ? "Hecha " + cuando(Date.parse(f.createdTime)) : "Cambiada " + cuando(Date.parse(f.modifiedTime));
        return '<label><input type="radio" name="pbh" value="' + esc(f.id) + '"' + (f.id === actual ? " checked" : "") + '><span><b>' + esc(f.name) + "</b>" + etiqueta + "<small>" + fecha + "</small></span></label>";
      }).join("");
      var si = v.querySelector("#pbHsi");
      v.querySelector("#pbHl").onchange = function () { var r = v.querySelector("input:checked"); si.disabled = !r || r.value === actual; };
      si.onclick = function () {
        var r = v.querySelector("input:checked"); if (!r) return;
        si.disabled = true; si.textContent = "Cambiando…";
        cambiar(r.value).catch(function (e) { si.disabled = false; si.textContent = "Usar esta hoja"; v.querySelector("#pbHe").textContent = e.message; });
      };
    }, function (e) { v.querySelector("#pbHl").textContent = ""; v.querySelector("#pbHe").textContent = e.message; });
  }

  /* registrar la pantalla y su botón en el menú (Gestionar, antes de Ajustes) */
  window.PB_VISTAS = window.PB_VISTAS || {};
  window.PB_VISTAS.datos = { tpl: TPL, init: init };
  function boton() {
    var aj = document.querySelector('.rail [data-go="form:ajustes"]');
    if (!aj || document.querySelector('.rail [data-go="datos"]')) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "rb"; b.setAttribute("data-go", "datos");
    b.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg><span class="t">Tus datos</span>';
    b.onclick = function () { window.SHELL.ir("datos"); };
    aj.parentNode.insertBefore(b, aj);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boton); else boton();
  window.addEventListener("load", function () { setTimeout(automatico, 6000); });
  window.pbDatos = { copiar: copiar, carpetas: carpetas, hojas: hojas };
})();
