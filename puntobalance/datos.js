/* PuntoBalance 5.0.0-alpha6 · «Tus datos»: copias de seguridad, exportar y cambiar de hoja (como «Copias y exportar» de Mis Finanzas).
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

  /* ---------- importar mi hoja anterior (5.0.0-alpha5) ----------
     La persona elige su hoja vieja en el selector de Google (Picker): con drive.file la app recibe permiso SOLO para esa hoja.
     Se copian las pestañas por nombre de columna (no por posición). La hoja vieja solo se lee. Antes, copia de seguridad de la nueva. */
  var PESTANAS = ["Ingresos", "Gastos", "Clientes", "Proveedores", "Categorias", "Periodos"];
  function norm(t) { return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase(); }
  function rango(t, r) { return "'" + t.replace(/'/g, "''") + "'" + (r ? "!" + r : ""); }
  var pickerListo = null;
  function cargarPicker() {
    if (!pickerListo) pickerListo = new Promise(function (ok, mal) {
      var s = document.createElement("script"); s.src = "https://apis.google.com/js/api.js";
      s.onload = function () { window.gapi.load("picker", { callback: ok, onerror: function () { mal(new Error("No se pudo abrir el selector de Google.")); } }); };
      s.onerror = function () { pickerListo = null; mal(new Error("No se pudo abrir el selector de Google. Revisa tu conexión.")); };
      document.head.appendChild(s);
    });
    return pickerListo;
  }
  function elegirHojaGoogle() {
    var CFG = window.PB_CONFIG || {};
    if (!CFG.pickerKey) return Promise.reject(new Error("El selector de archivos todavía no está activado."));
    return Promise.all([cargarPicker(), C().token()]).then(function (r) {
      var tk = r[1];
      return new Promise(function (ok) {
        var P = window.google.picker;
        // 5.0.0-alpha7: primero «Mi unidad» con carpetas (como en Drive), y aparte la lista de todas las hojas
        var carpetas = new P.DocsView(P.ViewId.SPREADSHEETS).setMode(P.DocsViewMode.LIST).setIncludeFolders(true).setSelectFolderEnabled(false).setParent("root");
        if (carpetas.setLabel) carpetas.setLabel("Mi unidad (carpetas)");
        var todas = new P.DocsView(P.ViewId.SPREADSHEETS).setMode(P.DocsViewMode.LIST).setIncludeFolders(false);
        if (todas.setLabel) todas.setLabel("Todas las hojas");
        new P.PickerBuilder().addView(carpetas).addView(todas).setOAuthToken(tk).setDeveloperKey(CFG.pickerKey).setAppId(CFG.appId)
          .setLocale("es").setTitle("Elige tu hoja anterior")
          .setCallback(function (d) {
            if (d.action === P.Action.PICKED && d.docs && d.docs[0]) ok({ id: d.docs[0].id, nombre: d.docs[0].name });
            else if (d.action === P.Action.CANCEL) ok(null);
          }).build().setVisible(true);
      });
    });
  }
  /** Lee la hoja vieja y prepara lo que se va a escribir en la nueva (sin escribir nada todavía). */
  function preparar(viejaId) {
    var nueva = C().hojaId(), R = { pest: {}, cuenta: {}, ultimaFactura: 0, config: null };
    return api("GET", SH + viejaId + "?fields=" + encodeURIComponent("sheets.properties.title")).then(function (o) {
      var hay = (o.sheets || []).map(function (x) { return x.properties.title; });
      var porNorm = {}; hay.forEach(function (t) { porNorm[norm(t)] = t; });
      var leer = PESTANAS.filter(function (t) { return porNorm[norm(t)]; });
      if (!leer.length) throw new Error("Esa hoja no parece de PuntoBalance / DJ Facturación: no tiene pestañas de Ingresos ni Gastos.");
      R.viejas = leer.map(function (t) { return porNorm[norm(t)]; });
      R.leer = leer; R.tieneConfig = !!porNorm["CONFIG"]; R.configVieja = porNorm["CONFIG"];
      var rv = R.viejas.map(function (t) { return "ranges=" + encodeURIComponent(rango(t)); });
      if (R.tieneConfig) rv.push("ranges=" + encodeURIComponent(rango(R.configVieja, "A:C")));
      var rn = leer.map(function (t) { return "ranges=" + encodeURIComponent(rango(t, "1:1")); }).concat(["ranges=" + encodeURIComponent(rango("Config", "A:C"))]);
      return Promise.all([
        api("GET", SH + viejaId + "/values:batchGet?" + rv.join("&") + "&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER"),
        api("GET", SH + nueva + "/values:batchGet?" + rn.join("&") + "&valueRenderOption=UNFORMATTED_VALUE")
      ]);
    }).then(function (r) {
      var viejo = r[0].valueRanges || [], nuevo = r[1].valueRanges || [];
      R.leer.forEach(function (t, i) {
        var vals = viejo[i].values || [], cab = (vals[0] || []).map(norm);
        var dest = ((nuevo[i].values || [])[0] || []);
        var filas = vals.slice(1).filter(function (f) { return f[0] !== undefined && f[0] !== null && String(f[0]).trim() !== ""; });
        if (t === "Periodos") {   // INICIO, FIN, ETIQUETA (+ la lista del panel se rehace)
          var ix = ["INICIO", "FIN", "ETIQUETA"].map(function (h) { return cab.indexOf(h); });
          filas = filas.filter(function (f) { return typeof f[ix[0]] === "number" && typeof f[ix[1]] === "number"; });
          var etq = filas.map(function (f) { return f[ix[2]]; });
          var out = filas.map(function (f, k) { return [f[ix[0]], f[ix[1]], f[ix[2]], "", k === 0 ? "TODOS" : etq[k - 1]]; });
          if (etq.length) out.push(["", "", "", "", etq[etq.length - 1]]);
          R.pest[t] = out; R.cuenta[t] = filas.length;
          if (filas.length) R.diaInicio = new Date(Math.round((filas[0][ix[0]] - 25569) * 864e5)).getUTCDate();
          return;
        }
        var mapa = dest.map(function (h) { return cab.indexOf(norm(h)); });
        R.pest[t] = filas.map(function (f) { return mapa.map(function (j) { var v = j < 0 ? "" : f[j]; return v == null ? "" : v; }); });
        R.cuenta[t] = filas.length;
        if (t === "Ingresos") {
          var ic = dest.map(norm).indexOf("ID FACTURA"), ids = {};
          R.pest[t].forEach(function (f) { var n = Number(f[ic]); if (n) { ids[n] = 1; if (n > R.ultimaFactura) R.ultimaFactura = n; } });
          R.facturas = Object.keys(ids).length;
        }
      });
      // Config: los valores de la hoja vieja para las claves que existan; el resto se queda como está
      var cfgN = nuevo[R.leer.length].values || [], cfgV = R.tieneConfig ? (viejo[R.leer.length].values || []) : [];
      if (cfgN.length) {
        var old = {}; cfgV.slice(1).forEach(function (f) { if (f[0]) old[String(f[0]).trim()] = f[1]; });
        var cambio = 0;
        var filas = cfgN.slice(1).map(function (f) {
          var k = String(f[0] || "").trim(), v = f[1];
          if (k && Object.prototype.hasOwnProperty.call(old, k) && old[k] !== "" && old[k] != null) { v = old[k]; cambio++; }
          if (k === "dia_inicio_periodo" && !Object.prototype.hasOwnProperty.call(old, k) && R.diaInicio) { v = R.diaInicio; cambio++; }
          return [f[0] == null ? "" : f[0], v == null ? "" : v, f[2] == null ? "" : f[2]];
        });
        Object.keys(old).forEach(function (k) { if (!cfgN.some(function (f) { return String(f[0]).trim() === k; })) { filas.push([k, old[k], ""]); cambio++; } });
        R.config = filas; R.configCambios = cambio;
      }
      return R;
    });
  }
  function escribir(R) {
    var nueva = C().hojaId();
    var limpiar = R.leer.map(function (t) { return rango(t, "A2:Z"); });
    var datos = R.leer.filter(function (t) { return R.pest[t].length; }).map(function (t) { return { range: rango(t, "A2"), values: R.pest[t] }; });
    if (R.config) { limpiar.push(rango("Config", "A2:C")); datos.push({ range: rango("Config", "A2"), values: R.config }); }
    return api("POST", SH + nueva + "/values:batchClear", { ranges: limpiar })
      .then(function () { return datos.length ? api("POST", SH + nueva + "/values:batchUpdate", { valueInputOption: "RAW", data: datos }) : null; });
  }
  function importar(aviso) {
    if (!conHoja()) return aviso("Entra con Google para importar tus datos.", "bad");
    elegirHojaGoogle().then(function (h) {
      if (!h) return;
      if (h.id === C().hojaId()) return aviso("Esa es la hoja que ya estás usando.", "bad");
      aviso("Leyendo «" + h.nombre + "»…", "w");
      return preparar(h.id).then(function (R) { aviso(""); confirmar(h, R); });
    }).catch(function (e) { aviso(e.message, "bad"); });
  }
  function confirmar(h, R) {
    var N = { Ingresos: "Ingresos (filas)", Gastos: "Gastos", Clientes: "Clientes", Proveedores: "Proveedores", Categorias: "Categorías", Periodos: "Periodos" };
    var v = document.createElement("div"); v.id = "pbHojas";
    var filas = R.leer.map(function (t) {
      var extra = t === "Ingresos" && R.ultimaFactura ? " · " + R.facturas + " facturas, hasta la nº " + R.ultimaFactura : t === "Periodos" && R.diaInicio === 7 ? " (del 7 al 6)" : "";
      return "<div><span>" + N[t] + "</span><b>" + R.cuenta[t] + extra + "</b></div>";
    }).join("") + (R.config ? "<div><span>Tus datos de factura (nombre, banco…)</span><b>✓</b></div>" : "");
    v.innerHTML = '<div class="m"><h3>¿Importar «' + esc(h.nombre) + '»?</h3><p>Encontré esto en tu hoja anterior:</p>' +
      '<div class="lst">' + filas + "</div>" +
      '<div class="wn">⚠️ Tu hoja de ahora se llenará con estos datos (lo que tenga se reemplaza). Antes, la app hace una <b>copia de seguridad</b> por si acaso.</div>' +
      '<p style="margin:0 0 4px">Tu hoja vieja <b>no se toca ni se borra</b>: la app solo la lee.</p><div class="err" id="pbHe"></div>' +
      '<div class="b"><button type="button" id="pbHno">Cancelar</button><button type="button" class="si" id="pbHsi">Importar</button></div></div>';
    document.body.appendChild(v);
    v.querySelector("#pbHno").onclick = function () { v.remove(); };
    v.querySelector("#pbHsi").onclick = function () {
      var b = this, no = v.querySelector("#pbHno"); b.disabled = no.disabled = true;
      b.textContent = "Haciendo la copia…";
      copiar().then(function () { b.textContent = "Importando…"; return escribir(R); }).then(function () {
        var res = R.leer.map(function (t) { return R.cuenta[t] + " " + N[t].toLowerCase().replace(" (filas)", ""); }).join(" · ");
        v.querySelector(".m").innerHTML = '<div style="font-size:44px;text-align:center">✅</div><h3 style="text-align:center">¡Datos importados!</h3>' +
          '<div class="okb">✓ ' + esc(res) + "</div>" +
          (R.ultimaFactura ? "<p>Tu próxima factura será la <b>nº " + (R.ultimaFactura + 1) + "</b>. Ya puedes seguir metiendo datos aquí.</p>" : "<p>Ya puedes seguir metiendo datos aquí.</p>") +
          "<p>Tu logo se sube otra vez en <b>Ajustes</b>. Si algo no se ve bien, en <b>Tus datos › Volver a una copia</b> vuelves a como estaba.</p>" +
          '<div class="b"><button type="button" class="si" id="pbHfin">Ver mi Inicio</button></div>';
        v.querySelector("#pbHfin").onclick = function () { location.reload(); };
      }).catch(function (e) {
        b.disabled = no.disabled = false; b.textContent = "Importar";
        v.querySelector("#pbHe").textContent = "No se pudo importar: " + e.message + " Tu hoja no cambió (o vuelve a la copia en «Tus datos»).";
      });
    };
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
    "#pbHojas .b .si{background:#1B2B5B;border-color:#1B2B5B;color:#fff}#pbHojas .b .si:disabled{opacity:.45;cursor:default}#pbHojas .err{color:#D92D20;font-size:13px;margin-top:8px}" +
    "#pbHojas .lst{border:1px solid #E6E8F1;border-radius:14px;overflow:hidden;margin:6px 0 12px}#pbHojas .lst div{display:flex;justify-content:space-between;gap:10px;padding:10px 14px;border-top:1px solid #EEF0F6;font-size:14px}#pbHojas .lst div:first-child{border-top:0}#pbHojas .lst b{color:#1B2B5B;text-align:right}" +
    "#pbHojas .wn{background:#FEF3DC;color:#7A4A06;border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:10px}#pbHojas .okb{background:#E8F7EE;color:#12804A;border-radius:12px;padding:10px 12px;font-size:13px;margin:8px 0 10px}#pbHojas .m p{line-height:1.45}";
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
    '<div class="it"><div class="e">📥</div><div class="tx"><b>Importar mi hoja anterior</b><small>Trae tus datos de otra hoja (ej. DJ_Invoice_v3.3)</small></div><button type="button" class="go" id="dt-imp">Importar</button></div>' +
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
    $("dt-imp").onclick = function () { msg(2, ""); importar(function (t, cl) { msg(2, t, cl); }); };
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
  window.pbDatos = { copiar: copiar, carpetas: carpetas, hojas: hojas, preparar: preparar, escribir: escribir, elegirHojaGoogle: elegirHojaGoogle };
})();
