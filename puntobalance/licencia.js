/* PuntoBalance 5.0.0-alpha12 · Licencias (aprobado por Wilber el 26 oct 2026).
   - 30 días de prueba con todo, sin tarjeta. Después, sin Premium, la app queda en «solo ver»: se ve y se exporta, pero no se apunta.
   - Premium con código firmado (ECDSA P-256). La app solo lleva la llave PÚBLICA: puede comprobar códigos, no crearlos.
     La llave privada se crea y se guarda en el Drive del administrador (archivo creado por la app, permiso drive.file).
   - Código: «PB1.» + datos (JSON en base64url) + «.» + firma. Datos: m = Gmail, p = plan, h = válida hasta (AAAA-MM-DD), n = nº de licencia.
   - La licencia y el día de inicio de la prueba se guardan en la hoja de la persona (AppProps): valen en todos sus aparatos.
   - Administración (solo los Gmail de PB_CONFIG.licencias.admins): «Licencias» → crear y enviar por correo (Gmail API, desde apps.welr@gmail.com). */
(function () {
  var CFG = (window.PB_CONFIG && window.PB_CONFIG.licencias) || {};
  var ADMINS = (CFG.admins || []).map(function (x) { return String(x).toLowerCase(); });
  var PRUEBA = Number(CFG.prueba) || 30;
  var PLANES = {
    mes: { nombre: "Mensual", precio: "£4.99", txt: "al mes", meses: 1 },
    anio: { nombre: "Anual", precio: "£44.99", txt: "al año", meses: 12 },
    fundador: { nombre: "Anual · Fundador", precio: "£34.99", txt: "al año", meses: 12 },
    regalo: { nombre: "Regalo · para siempre", precio: "", txt: "", meses: 0 }
  };
  var EST = { estado: "cargando" };
  var DR = "https://www.googleapis.com/drive/v3/files";

  function C() { return window.pbCuenta; }
  function correo() { return String((C() && C().correo()) || "").toLowerCase(); }
  function esAdmin() { return ADMINS.indexOf(correo()) >= 0; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); }
  function dos(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()); }
  function hoyIso() { return iso(new Date()); }
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function fechaLarga(s) { if (!s || s >= "9999") return "para siempre"; var p = s.split("-"); return Number(p[2]) + " de " + MESES[Number(p[1]) - 1] + " de " + p[0]; }
  function sumarMeses(s, n) { var p = s.split("-").map(Number), d = new Date(p[0], p[1] - 1 + n, p[2]); return iso(d); }
  function diasEntre(a, b) { var x = a.split("-").map(Number), y = b.split("-").map(Number); return Math.round((new Date(y[0], y[1] - 1, y[2]) - new Date(x[0], x[1] - 1, x[2])) / 864e5); }

  /* ---------- base64url y firma ---------- */
  function b64u(bytes) { var s = ""; new Uint8Array(bytes).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function deb64u(t) { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; var s = atob(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function utf8(t) { return new TextEncoder().encode(t); }
  var ALG = { name: "ECDSA", namedCurve: "P-256" }, FIRMA = { name: "ECDSA", hash: "SHA-256" };
  function llavePublica(pub) { return crypto.subtle.importKey("jwk", typeof pub === "string" ? JSON.parse(pub) : pub, ALG, false, ["verify"]); }
  /** Comprueba un código. Devuelve los datos si es válido (firma buena), o null. */
  function leerCodigo(codigo, pub) {
    try {
      var c = String(codigo || "").trim(), p = c.split(".");
      if (p.length !== 3 || p[0] !== "PB1" || !pub) return Promise.resolve(null);
      var datos = JSON.parse(new TextDecoder().decode(deb64u(p[1])));
      return llavePublica(pub).then(function (k) { return crypto.subtle.verify(FIRMA, k, deb64u(p[2]), utf8(p[0] + "." + p[1])); })
        .then(function (ok) { return ok ? datos : null; }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function firmar(datos, priv) {
    var cuerpo = "PB1." + b64u(utf8(JSON.stringify(datos)));
    return crypto.subtle.importKey("jwk", priv, ALG, false, ["sign"])
      .then(function (k) { return crypto.subtle.sign(FIRMA, k, utf8(cuerpo)); })
      .then(function (f) { return cuerpo + "." + b64u(f); });
  }

  /* ---------- estado de la licencia ---------- */
  function avisar() { document.dispatchEvent(new Event("pb-licencia")); pintarBarra(); }
  function pendiente() {
    var q = new URLSearchParams(location.search).get("licencia");
    if (q) { try { localStorage.setItem("pb_lic_pend", q); history.replaceState(null, "", location.pathname); } catch (e) { } return q; }
    try { return localStorage.getItem("pb_lic_pend") || ""; } catch (e) { return ""; }
  }
  function olvidarPendiente() { try { localStorage.removeItem("pb_lic_pend"); } catch (e) { } }
  /** Estado: demo · admin · activa · prueba · vencida. */
  function calcular() {
    if (!C() || C().modo() !== "hoja" || !C().hojaId()) { EST = { estado: "demo" }; return Promise.resolve(EST); }
    if (esAdmin()) { EST = { estado: "admin" }; return Promise.resolve(EST); }
    var M = window.pbMotor;
    return Promise.all([M.llamar("getLicenciaGuardada"),
      C().api("GET", DR + "/" + C().hojaId() + "?fields=createdTime").catch(function () { return {}; })])
      .then(function (r) {
        var g = r[0] || {}, creada = r[1].createdTime ? iso(new Date(r[1].createdTime)) : hoyIso();
        var inicio = g.inicio && g.inicio < creada ? g.inicio : creada;
        var marcar = g.inicio !== inicio ? M.llamar("marcarInicioPrueba", inicio).catch(function () { }) : null;
        var pend = pendiente();
        var probar = pend && pend !== g.codigo ? activar(pend, true).catch(function () { return null; }) : Promise.resolve(null);
        return Promise.all([marcar, probar]).then(function (x) {
          if (x[1]) return EST;   // se activó con el código pendiente
          return estadoCon(g.codigo, inicio);
        });
      });
  }
  function estadoCon(codigo, inicio) {
    var hoy = hoyIso();
    return leerCodigo(codigo, CFG.pub).then(function (d) {
      if (d && String(d.m).toLowerCase() === correo()) {
        if (d.h >= hoy) { EST = { estado: "activa", plan: d.p, hasta: d.h, num: d.n, dias: diasEntre(hoy, d.h) }; return EST; }
        EST = { estado: "vencida", caducada: true, plan: d.p, hasta: d.h, num: d.n }; return EST;
      }
      var quedan = PRUEBA - diasEntre(inicio, hoy);
      if (quedan > 0 || !CFG.pub) EST = { estado: "prueba", dias: Math.max(quedan, 0), sinCorte: !CFG.pub, inicio: inicio };
      else EST = { estado: "vencida", inicio: inicio };
      return EST;
    });
  }
  /** Activa un código para la cuenta de ahora. */
  function activar(codigo, silencio) {
    codigo = String(codigo || "").replace(/\s+/g, "");
    if (!CFG.pub) return Promise.reject(new Error("Las licencias todavía no están activadas en esta versión."));
    return leerCodigo(codigo, CFG.pub).then(function (d) {
      if (!d) throw new Error("Ese código no es válido. Cópialo completo, desde «PB1.» hasta el final.");
      if (String(d.m).toLowerCase() !== correo()) throw new Error("Este código es para " + d.m + ". Entra en PuntoBalance con esa cuenta de Google.");
      if (d.h < hoyIso()) throw new Error("Este código ya caducó el " + fechaLarga(d.h) + ". Escríbenos para renovarlo.");
      return window.pbMotor.llamar("guardarLicencia", codigo).then(function () {
        olvidarPendiente();
        EST = { estado: "activa", plan: d.p, hasta: d.h, num: d.n, dias: diasEntre(hoyIso(), d.h) };
        avisar();
        if (!silencio && window.pbDialogo) window.pbDialogo({ icono: "🎉", titulo: "¡Premium activado!", texto: "Plan " + esc((PLANES[d.p] || {}).nombre || d.p) + " · " + (d.h >= "9999" ? "para siempre" : "hasta el " + fechaLarga(d.h)) + ". Gracias por confiar en PuntoBalance.", si: "Genial", no: "Cerrar" });
        return EST;
      });
    }).catch(function (e) { if (silencio) olvidarPendiente(); throw e; });
  }

  /* ---------- «solo ver»: qué se frena ---------- */
  var ESCRIBE = /^(guardar|actualizar|eliminar|anadir|marcar|generarFactura|enviarFactura|quitarLogo|hubEnviarResumen|hubRecordatorio|activarCancelada|actualizarLibro)/;
  var LIBRE = { guardarLicencia: 1, marcarInicioPrueba: 1 };
  window.pbPermitir = function (fn) {
    if (EST.estado !== "vencida" || LIBRE[fn] || !ESCRIBE.test(fn)) return true;
    setTimeout(pedirPremium, 0);
    return false;
  };
  window.pbErrorLicencia = function () { return new Error("🔒 Tu " + (EST.caducada ? "Premium terminó" : "prueba de " + PRUEBA + " días terminó") + ". Activa PuntoBalance Premium para seguir apuntando. Tus datos siguen ahí y puedes exportarlos."); };
  var pidiendo = false;
  function pedirPremium() {
    if (pidiendo || !window.pbDialogo) return; pidiendo = true;
    window.pbDialogo({ icono: "🔒", titulo: EST.caducada ? "Tu Premium terminó" : "Tu prueba gratis terminó", texto: "Puedes ver y exportar tus datos. Para seguir apuntando ingresos, gastos y facturas, activa PuntoBalance Premium.", si: "Ver Premium", no: "Ahora no" })
      .then(function (si) { pidiendo = false; if (si && window.SHELL) window.SHELL.ir("premium"); });
  }

  /* ---------- estilos ---------- */
  var css = document.createElement("style");
  css.textContent =
    "#pbLicBar{position:fixed;top:10px;right:14px;z-index:240;border:0;border-radius:99px;padding:7px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.15);background:#FEF3C7;color:#7A4A06}" +
    "#pbLicBar.fin{background:#FDE2E1;color:#9B1C1C}#pbLicBar.ok{display:none}" +
    "@media (max-width:760px){#pbLicBar{top:auto;bottom:108px;right:10px}}" +
    ".v-prem{--ink:#151A2D;--muted:#6B7194;--line:#E6E8F1;height:100%;overflow:auto;padding:52px 30px 40px}" +
    ".v-prem .in{max-width:640px;margin:0 auto}.v-prem .hero{text-align:center}.v-prem .hero img{width:84px;height:84px;border-radius:22px;box-shadow:0 10px 24px rgba(27,43,91,.3)}" +
    ".v-prem h1{margin:12px 0 6px;font-size:26px;color:var(--ink);letter-spacing:-.01em}.v-prem .hero p{margin:0;color:var(--muted);font-size:14.5px;line-height:1.5}" +
    ".v-prem .chip{display:inline-block;margin-top:10px;border-radius:99px;padding:5px 12px;font-weight:800;font-size:12.5px;background:#FEF3C7;color:#8A5300}.v-prem .chip.ok{background:#DCFCE7;color:#166534}.v-prem .chip.mal{background:#FDE2E1;color:#9B1C1C}" +
    ".v-prem .lista{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 18px;margin:20px 0 0;font-size:14px;line-height:1.9;color:var(--ink)}.v-prem .lista i{font-style:normal;color:#12804A;font-weight:800;margin-right:8px}" +
    ".v-prem .planes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.v-prem .pl{background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:14px 8px;text-align:center}" +
    ".v-prem .pl.dest{border-color:#1E60E0;background:#F2F6FF}.v-prem .pl small{display:block;color:var(--muted);font-size:12px}.v-prem .pl b{display:block;font-size:24px;color:var(--ink);margin:2px 0}" +
    ".v-prem .tag{display:inline-block;margin-top:5px;font-size:10.5px;font-weight:800;border-radius:99px;padding:2px 8px}.v-prem .tag.g{background:#DCFCE7;color:#166534}.v-prem .tag.a{background:#FEF3C7;color:#8A5300}" +
    ".v-prem .bt{display:block;width:100%;text-align:center;border:0;border-radius:14px;padding:14px;font:inherit;font-weight:800;font-size:15px;margin-top:10px;cursor:pointer;text-decoration:none}" +
    ".v-prem .b1{background:#1B2B5B;color:#fff}.v-prem .b2{background:#EEF2FF;color:#1B2B5B}.v-prem .b3{background:#25D366;color:#fff}" +
    ".v-prem .cod{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-top:16px}.v-prem .cod h3{margin:0 0 4px;font-size:16px;color:var(--ink)}" +
    ".v-prem textarea{width:100%;min-height:74px;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;font:12.5px Consolas,monospace;resize:vertical;margin-top:8px;background:#F8F9FC;color:var(--ink)}" +
    ".v-prem .msg{min-height:18px;margin-top:8px;font-size:13.5px;font-weight:600}.v-prem .msg.ok{color:#12804A}.v-prem .msg.mal{color:#D92D20}" +
    ".v-prem .datos{background:#fff;border:1px solid var(--line);border-radius:16px;margin-top:18px;overflow:hidden}.v-prem .datos div{display:flex;justify-content:space-between;padding:11px 16px;border-top:1px solid #EEF0F6;font-size:14px}.v-prem .datos div:first-child{border-top:0}.v-prem .datos span{color:var(--muted)}" +
    ".v-prem .nota{font-size:12.5px;color:var(--muted);margin-top:12px;text-align:center;line-height:1.5}" +
    "@media (max-width:760px){.v-prem{padding:18px 16px 90px}.v-prem .planes{grid-template-columns:1fr}}" +
    /* administración */
    ".v-lic{--ink:#151A2D;--muted:#6B7194;--line:#E6E8F1;height:100%;overflow:auto;padding:52px 30px 40px}" +
    ".v-lic h1{margin:0;font-size:26px;color:var(--ink)}.v-lic .lead{margin:4px 0 18px;color:var(--muted);font-size:13.5px}" +
    ".v-lic .grid2{display:grid;grid-template-columns:minmax(300px,430px) minmax(0,1fr);gap:16px;align-items:start}" +
    ".v-lic .card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px 20px}.v-lic .card h2{margin:0 0 4px;font-size:17px;color:var(--ink)}" +
    ".v-lic label{display:block;font-size:11.5px;font-weight:800;letter-spacing:.05em;color:var(--muted);margin:14px 0 6px;text-transform:uppercase}" +
    ".v-lic input{width:100%;border:1.5px solid var(--line);background:#F8F9FC;border-radius:12px;padding:11px 12px;font:inherit;font-size:14px;color:var(--ink)}" +
    ".v-lic .planes{display:flex;gap:6px;flex-wrap:wrap}.v-lic .planes button{border:1.5px solid var(--line);background:#fff;border-radius:99px;padding:8px 13px;font:inherit;font-weight:700;font-size:13px;cursor:pointer;color:var(--ink)}" +
    ".v-lic .planes button[aria-pressed=true]{background:#1B2B5B;border-color:#1B2B5B;color:#fff}" +
    ".v-lic .dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".v-lic .bt{display:block;width:100%;border:0;border-radius:14px;padding:13px;font:inherit;font-weight:800;font-size:14.5px;margin-top:12px;cursor:pointer}.v-lic .bt:disabled{opacity:.5;cursor:progress}" +
    ".v-lic .b1{background:#1B2B5B;color:#fff}.v-lic .b2{background:#EEF2FF;color:#1B2B5B}" +
    ".v-lic .msg{min-height:18px;margin-top:10px;font-size:13.5px;font-weight:600;line-height:1.45}.v-lic .msg.ok{color:#12804A}.v-lic .msg.mal{color:#D92D20}.v-lic .msg.w{color:var(--muted)}" +
    ".v-lic .hint{font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.45}" +
    ".v-lic .pub{background:#FFF7E0;border:1px solid #F6D58B;border-radius:14px;padding:14px 16px;margin-bottom:16px;font-size:13.5px;line-height:1.5}" +
    ".v-lic .pub textarea{width:100%;min-height:70px;font:11.5px Consolas,monospace;border:1px solid #E6D3A4;border-radius:10px;padding:8px;margin-top:8px;background:#fff}" +
    ".v-lic table{width:100%;border-collapse:collapse;font-size:13px}.v-lic th{text-align:left;font-size:11.5px;color:#fff;background:#1B2B5B;padding:8px}.v-lic td{padding:8px;border-bottom:1px solid #EEF0F6;white-space:nowrap}" +
    ".v-lic .tw{overflow:auto;border:1px solid var(--line);border-radius:12px;margin-top:10px}" +
    ".v-lic .p{font-size:11px;font-weight:800;border-radius:99px;padding:2px 8px}.v-lic .p.ok{background:#DCFCE7;color:#166534}.v-lic .p.mal{background:#FDE2E1;color:#9B1C1C}.v-lic .p.pr{background:#FEF3C7;color:#8A5300}" +
    ".v-lic .copiar{border:1px solid #CBD0E0;background:#fff;border-radius:8px;padding:4px 9px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}" +
    "@media (max-width:1000px){.v-lic .grid2{grid-template-columns:1fr}}@media (max-width:760px){.v-lic{padding:18px 16px 90px}}" +
    "html[data-tema=oscuro] .v-prem .lista,html[data-tema=oscuro] .v-prem .pl,html[data-tema=oscuro] .v-prem .cod,html[data-tema=oscuro] .v-prem .datos,html[data-tema=oscuro] .v-lic .card{background:#131D38;border-color:#26365F;color:#E7EAF5}" +
    "html[data-tema=oscuro] .v-prem,html[data-tema=oscuro] .v-lic{--ink:#EEF1FA;--muted:#93A0C8;--line:#26365F}" +
    "html[data-tema=oscuro] .v-prem .pl.dest{background:#18254C}html[data-tema=oscuro] .v-prem textarea,html[data-tema=oscuro] .v-lic input{background:#0F1830;color:#EEF1FA;border-color:#26365F}" +
    "html[data-tema=oscuro] .v-prem .b2,html[data-tema=oscuro] .v-lic .b2{background:#1C2A52;color:#DDE3F7}html[data-tema=oscuro] .v-lic .planes button{background:#0F1830;color:#DDE3F7;border-color:#26365F}";
  document.head.appendChild(css);

  /* ---------- aviso arriba a la derecha ---------- */
  function pintarBarra() {
    var b = document.getElementById("pbLicBar");
    if (!b) { b = document.createElement("button"); b.id = "pbLicBar"; b.type = "button"; b.onclick = function () { if (window.SHELL) window.SHELL.ir("premium"); }; document.body.appendChild(b); }
    var e = EST.estado;
    if (e === "prueba") { b.className = EST.dias <= 3 ? "fin" : ""; b.textContent = "⏳ " + (EST.dias === 1 ? "Te queda 1 día" : "Te quedan " + EST.dias + " días") + " de prueba · Activar Premium"; }
    else if (e === "vencida") { b.className = "fin"; b.textContent = "🔒 Solo ver · Activar Premium"; }
    else if (e === "activa" && EST.dias <= 7) { b.className = ""; b.textContent = "⏳ Tu Premium termina en " + EST.dias + (EST.dias === 1 ? " día" : " días") + " · Renovar"; }
    else b.className = "ok";
  }

  /* ---------- pantalla «Premium» ---------- */
  var ICONO = "iconos/icono-192.png";
  var TPL_PREM = '<div class="v-prem"><div class="in" id="pr-in"></div></div>';
  function initPremium(ROOT) {
    var box = ROOT.querySelector("#pr-in");
    function pintar() {
      var e = EST.estado, h = "";
      var tit = e === "activa" ? "Tienes PuntoBalance Premium" : e === "admin" ? "PuntoBalance Premium · administrador" : e === "vencida" ? (EST.caducada ? "Tu Premium terminó" : "Tu prueba gratis terminó")
        : e === "prueba" ? (EST.dias === 1 ? "Te queda 1 día de prueba" : "Te quedan " + EST.dias + " días de prueba") : e === "demo" ? "PuntoBalance Premium" : "Cargando…";
      var sub = e === "activa" ? "Gracias por confiar en PuntoBalance. Tienes todo sin límites." : e === "admin" ? "Con tu cuenta tienes Premium para siempre y puedes crear licencias."
        : e === "vencida" ? "Puedes ver y exportar tus datos. Para seguir apuntando ingresos, gastos y facturas, activa Premium."
        : e === "prueba" ? "Ahora tienes todo. Cuando termine la prueba, activa Premium para seguir trabajando." : "Entra con Google para empezar tu prueba de " + PRUEBA + " días.";
      var chip = e === "activa" ? '<span class="chip ok">✓ ' + esc((PLANES[EST.plan] || {}).nombre || EST.plan) + "</span>" : e === "vencida" ? '<span class="chip mal">🔒 SOLO VER</span>'
        : e === "prueba" ? '<span class="chip">⏳ ' + EST.dias + (EST.dias === 1 ? " DÍA" : " DÍAS") + "</span>" : e === "admin" ? '<span class="chip ok">★ PARA SIEMPRE</span>' : "";
      h += '<div class="hero"><img src="' + ICONO + '" alt=""><h1>' + tit + "</h1><p>" + sub + "</p>" + chip + "</div>";
      if (e === "activa") {
        h += '<div class="datos"><div><span>Nº de licencia</span><b>' + esc(EST.num || "—") + "</b></div><div><span>Plan</span><b>" + esc((PLANES[EST.plan] || {}).nombre || EST.plan) + "</b></div>" +
          "<div><span>Cuenta de Google</span><b>" + esc(correo()) + "</b></div><div><span>Válida hasta</span><b>" + fechaLarga(EST.hasta) + "</b></div></div>";
      }
      if (e !== "activa" && e !== "admin") {
        h += '<div class="lista"><i>✓</i>Ingresos, gastos y facturas en PDF sin límite<br><i>✓</i>Hecha para Universal Credit (periodos del 7 al 6)<br><i>✓</i>Año HMRC e impuesto estimado<br><i>✓</i>Varios negocios, tu logo y copias en tu Drive</div>' +
          '<div class="planes"><div class="pl"><small>Mensual</small><b>£4.99</b><small>al mes</small></div><div class="pl"><small>Anual</small><b>£44.99</b><small>al año</small><span class="tag g">AHORRAS 25%</span></div>' +
          '<div class="pl dest"><small>Fundador</small><b>£34.99</b><small>al año</small><span class="tag a">SOLO 100 PLAZAS</span></div></div>';
      }
      if (e !== "admin" && e !== "demo") {
        var asunto = encodeURIComponent("Quiero PuntoBalance Premium"), cuerpo = encodeURIComponent("Hola, quiero PuntoBalance Premium.\nMi cuenta de Google: " + correo() + "\nPlan: (Mensual / Anual / Fundador)\n");
        h += '<a class="bt b1" href="mailto:' + esc(CFG.envio || "apps.welr@gmail.com") + "?subject=" + asunto + "&body=" + cuerpo + '" target="_blank" rel="noopener">✉️ ' + (e === "activa" ? "Renovar · escribir a Odlare" : "Quiero Premium · escribir a Odlare") + "</a>";
        if (CFG.whatsapp) h += '<a class="bt b3" href="https://wa.me/' + esc(String(CFG.whatsapp).replace(/\D/g, "")) + "?text=" + cuerpo + '" target="_blank" rel="noopener">💬 Escribir por WhatsApp</a>';
        h += '<div class="cod"><h3>🎁 Tengo un código</h3><div class="hint" style="font-size:13px;color:var(--muted)">Pega el código que te llegó por correo (empieza por «PB1.»).</div>' +
          '<textarea id="pr-cod" placeholder="PB1.…" spellcheck="false"></textarea><button type="button" class="bt b2" id="pr-act">Activar</button><div class="msg" id="pr-msg"></div></div>';
        h += '<div class="nota">Tras la compra te llega un correo de Odlare con tu licencia. El código solo funciona con tu cuenta <b>' + esc(correo()) + "</b>.</div>";
      }
      if (e === "admin") h += '<button type="button" class="bt b1" id="pr-adm">🔑 Crear y enviar licencias</button>';
      box.innerHTML = h;
      var a = box.querySelector("#pr-act");
      if (a) a.onclick = function () {
        var m = box.querySelector("#pr-msg"); a.disabled = true; m.className = "msg"; m.textContent = "Comprobando…";
        activar(box.querySelector("#pr-cod").value).then(function () { pintar(); }, function (er) { a.disabled = false; m.className = "msg mal"; m.textContent = er.message; });
      };
      var ad = box.querySelector("#pr-adm"); if (ad) ad.onclick = function () { window.SHELL.ir("licencias"); };
    }
    pintar();
    var f = function () { pintar(); };
    document.addEventListener("pb-licencia", f);
    return { destroy: function () { document.removeEventListener("pb-licencia", f); } };
  }

  /* ---------- administración: llave, crear y enviar ---------- */
  var LLAVE = null;   // { priv, pub, emitidas: [] , id }
  function buscarLlave() {
    var q = "appProperties has { key='pbllave' and value='1' } and trashed=false";
    return C().api("GET", DR + "?q=" + encodeURIComponent(q) + "&fields=files(id)").then(function (o) {
      if (!o.files || !o.files.length) return null;
      var id = o.files[0].id;
      return C().token().then(function (tk) { return fetch(DR + "/" + id + "?alt=media", { headers: { Authorization: "Bearer " + tk } }); })
        .then(function (r) { if (!r.ok) throw new Error("No pude leer tu llave (" + r.status + ")."); return r.json(); })
        .then(function (j) { j.id = id; j.emitidas = j.emitidas || []; return j; });
    });
  }
  function guardarLlave(L) {
    var cuerpo = JSON.stringify({ aviso: "Llave privada de licencias de PuntoBalance. NO la compartas con nadie.", priv: L.priv, pub: L.pub, creada: L.creada, emitidas: L.emitidas });
    return C().token().then(function (tk) {
      if (L.id) return fetch("https://www.googleapis.com/upload/drive/v3/files/" + L.id + "?uploadType=media", { method: "PATCH", headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: cuerpo });
      var b = "pb" + Date.now(), meta = { name: "PuntoBalance · llave de licencias (NO COMPARTIR).json", mimeType: "application/json", appProperties: { pbllave: "1" } };
      var p = (window.pbDatos && window.pbDatos.carpetas) ? window.pbDatos.carpetas().then(function (c) { meta.parents = [c.raiz]; }, function () { }) : Promise.resolve();
      return p.then(function () {
        var multi = "--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + b + "\r\nContent-Type: application/json\r\n\r\n" + cuerpo + "\r\n--" + b + "--";
        return fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { Authorization: "Bearer " + tk, "Content-Type": "multipart/related; boundary=" + b }, body: multi });
      });
    }).then(function (r) { if (!r.ok) throw new Error("No pude guardar tu llave en Drive (" + r.status + ")."); return r.json(); })
      .then(function (j) { if (j && j.id) L.id = j.id; return L; });
  }
  function crearLlave() {
    return crypto.subtle.generateKey(ALG, true, ["sign", "verify"]).then(function (k) {
      return Promise.all([crypto.subtle.exportKey("jwk", k.privateKey), crypto.subtle.exportKey("jwk", k.publicKey)]);
    }).then(function (j) {
      var pub = { kty: j[1].kty, crv: j[1].crv, x: j[1].x, y: j[1].y };
      return guardarLlave({ priv: j[0], pub: pub, creada: hoyIso(), emitidas: [] });
    });
  }
  function pubTexto(pub) { return JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }); }

  /* correo con la licencia (HTML para el email, con estilos en línea) */
  function htmlCorreo(o) {
    var base = location.origin + location.pathname.replace(/[^/]*$/, ""), icono = base + "iconos/icono-192.png", enlace = base + "?licencia=" + encodeURIComponent(o.codigo);
    var fila = function (a, b) { return '<tr><td style="padding:10px 6px 10px 14px;border-top:1px solid #EEF0F6;color:#6B7194;font-size:14px;white-space:nowrap;width:1%">' + a + '</td><td style="padding:10px 14px 10px 6px;border-top:1px solid #EEF0F6;text-align:right;font-weight:700;color:#151A2D;font-size:14px;overflow-wrap:break-word">' + b + "</td></tr>"; };
    var plan = (PLANES[o.plan] || {}).nombre || o.plan;
    return '<!doctype html><html><body style="margin:0;background:#F2F4F9;font-family:Segoe UI,Arial,sans-serif">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F9;padding:26px 0"><tr><td align="center">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E3E6EF">' +
      '<tr><td style="background:#1B2B5B;padding:22px 28px"><table role="presentation" width="100%"><tr><td width="56"><img src="' + icono + '" width="46" height="46" alt="" style="display:block;border-radius:12px"></td>' +
      '<td style="color:#ffffff"><div style="font-size:20px;font-weight:800">PuntoBalance</div><div style="font-size:12px;color:#B9C6EA">Tu negocio, en orden</div></td>' +
      '<td align="right"><img src="https://appswelr.github.io/odlare/img/odlare-blanco.png" width="88" height="36" alt="Odlare" style="display:block;border:0;color:#ffffff;font-weight:900;font-size:18px"></td></tr></table></td></tr>' +
      '<tr><td style="padding:28px 32px 8px;color:#1F2540;font-size:15px;line-height:1.6">' +
      '<div style="font-size:22px;font-weight:800;color:#151A2D;margin-bottom:6px">¡Gracias' + (o.nombre ? ", " + esc(o.nombre.split(" ")[0]) : "") + "! 🎉</div>" +
      "Tu <b>PuntoBalance Premium</b> ya está listo. Gracias por confiar en nosotros" + (o.plan === "fundador" ? " y por ser de los primeros: tienes el <b>precio de fundador</b>" : o.plan === "regalo" ? ". Es un <b>regalo</b> de Odlare" : "") + "." +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E6EF;border-radius:14px;margin:18px 0;border-collapse:separate">' +
      fila("Nº de licencia", esc(o.num)).replace("border-top:1px solid #EEF0F6;", "").replace("border-top:1px solid #EEF0F6;", "") + fila("Plan", esc(plan)) + fila("Cuenta de Google", esc(o.gmail).replace("@", "<wbr>@")) + fila("Válida hasta", fechaLarga(o.hasta)) + (o.importe ? fila("Importe pagado", esc(o.importe)) : "") + "</table>" +
      '<div style="text-align:center;margin:22px 0 6px"><a href="' + enlace + '" style="display:inline-block;background:#1E60E0;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:14px 46px;border-radius:12px">Activar Premium</a></div>' +
      '<div style="text-align:center;font-size:12.5px;color:#6B7194">Pulsa el botón y abre PuntoBalance: se activa solo.</div>' +
      '<p style="margin:20px 0 6px;font-size:13.5px"><b>¿El botón no funciona?</b> Copia este código:</p>' +
      '<div style="background:#F4F6FC;border:1.5px dashed #9AA8D6;border-radius:12px;padding:12px 14px;font-family:Consolas,monospace;font-size:12px;color:#1B2B5B;word-break:break-all">' + esc(o.codigo) + "</div>" +
      '<p style="font-size:13.5px;margin:16px 0 0">1. Abre PuntoBalance en tu computadora o celular.<br>2. Ve a <b>Premium › Tengo un código</b>.<br>3. Pega el código y pulsa <b>Activar</b>. ¡Listo!</p>' +
      '<p style="font-size:13px;margin:16px 0 8px;color:#3A4058">El código solo funciona con tu cuenta <b>' + esc(o.gmail) + "</b>. Guarda este correo por si cambias de computadora.</p></td></tr>" +
      '<tr><td style="background:#F7F8FC;padding:16px 32px;font-size:12px;color:#6B7194;line-height:1.6;border-top:1px solid #EEF0F6">¿Dudas? Escríbenos a <b style="color:#1B2B5B">' + esc(CFG.envio || "apps.welr@gmail.com") + "</b> · Responderemos lo antes posible.<br>PuntoBalance es una app de <b style=\"color:#1B2B5B\">Odlare</b> · Reino Unido · " +
      '<a href="https://appswelr.github.io/odlare/privacidad-puntobalance.html" style="color:#1E60E0">Política de privacidad</a></td></tr></table></td></tr></table></body></html>';
  }
  function textoCorreo(o) {
    var base = location.origin + location.pathname.replace(/[^/]*$/, "");
    return "¡Gracias" + (o.nombre ? ", " + o.nombre.split(" ")[0] : "") + "!\n\nTu PuntoBalance Premium ya está listo.\n\nNº de licencia: " + o.num + "\nPlan: " + ((PLANES[o.plan] || {}).nombre || o.plan) +
      "\nCuenta de Google: " + o.gmail + "\nVálida hasta: " + fechaLarga(o.hasta) + (o.importe ? "\nImporte pagado: " + o.importe : "") +
      "\n\nActívalo aquí: " + base + "?licencia=" + encodeURIComponent(o.codigo) + "\n\nO copia este código en PuntoBalance › Premium › Tengo un código:\n" + o.codigo + "\n\nOdlare · " + (CFG.envio || "apps.welr@gmail.com");
  }
  function b64Utf8(t) { return btoa(unescape(encodeURIComponent(t))); }
  function mime(o) {
    var b = "pbm" + Date.now(), asunto = "=?UTF-8?B?" + b64Utf8("✅ Tu licencia de PuntoBalance Premium · " + o.num) + "?=";
    var desde = "=?UTF-8?B?" + b64Utf8("Odlare · PuntoBalance") + "?= <" + (CFG.envio || "apps.welr@gmail.com") + ">";
    var m = "From: " + desde + "\r\nTo: " + o.gmail + "\r\nSubject: " + asunto + "\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"" + b + "\"\r\n\r\n" +
      "--" + b + "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + b64Utf8(textoCorreo(o)).replace(/.{76}/g, "$&\r\n") + "\r\n" +
      "--" + b + "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + b64Utf8(htmlCorreo(o)).replace(/.{76}/g, "$&\r\n") + "\r\n--" + b + "--";
    return b64Utf8(m).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  /* permiso «enviar correo» solo para el administrador, aparte de la sesión normal */
  var GTK = null, gcli = null, gesp = [];
  function tokenGmail() {
    if (GTK && GTK.exp > Date.now()) return Promise.resolve(GTK);
    if (!window.google || !google.accounts || !google.accounts.oauth2) return Promise.reject(new Error("No se pudo cargar el acceso de Google."));
    return new Promise(function (ok, mal) {
      if (!gcli) gcli = google.accounts.oauth2.initTokenClient({
        client_id: window.PB_CONFIG.clientId, scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
        callback: function (r) {
          var q = gesp.splice(0);
          if (r.error) { q.forEach(function (p) { p[1](new Error("Google no dio permiso para enviar correos (" + r.error + ").")); }); return; }
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + r.access_token } }).then(function (x) { return x.json(); }).catch(function () { return {}; })
            .then(function (u) { GTK = { t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000, correo: u.email || "" }; q.forEach(function (p) { p[0](GTK); }); });
        },
        error_callback: function () { gesp.splice(0).forEach(function (p) { p[1](new Error("Se cerró la ventana de Google.")); }); }
      });
      gesp.push([ok, mal]);
      gcli.requestAccessToken({ prompt: "select_account", login_hint: CFG.envio || "" });
    });
  }
  function enviarCorreo(o) {
    return tokenGmail().then(function (g) {
      return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: "Bearer " + g.t, "Content-Type": "application/json" }, body: JSON.stringify({ raw: mime(o) }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error("Gmail: " + ((j.error && j.error.message) || r.status)); return { desde: g.correo }; }); });
    });
  }

  var TPL_LIC = '<div class="v-lic"><h1>Licencias</h1><div class="lead">Crea la licencia cuando el cliente te pague. Le llega por correo, con su botón para activarla.</div><div id="lc-pub"></div>' +
    '<div class="grid2"><div class="card"><h2>Crear licencia</h2>' +
    '<label for="lc-nom">Nombre del cliente</label><input id="lc-nom" placeholder="Ej. Carlos Rivas">' +
    '<label for="lc-mail">Gmail del cliente</label><input id="lc-mail" type="email" placeholder="cliente@gmail.com">' +
    '<label>Plan</label><div class="planes" id="lc-plan"><button type="button" data-p="mes">Mensual</button><button type="button" data-p="anio">Anual</button><button type="button" data-p="fundador" aria-pressed="true">Fundador</button><button type="button" data-p="regalo">🎁 Regalo</button></div>' +
    '<label for="lc-imp">Importe pagado (opcional)</label><input id="lc-imp" placeholder="Ej. £34.99 · Transferencia">' +
    '<button type="button" class="bt b1" id="lc-env">✉️ Crear y enviar por correo</button><button type="button" class="bt b2" id="lc-cop">Solo crear y copiar el código</button>' +
    '<div class="msg" id="lc-msg"></div><div class="hint">Se envía desde <b>' + esc(CFG.envio || "apps.welr@gmail.com") + '</b>. La primera vez Google te pedirá elegir esa cuenta y darle permiso para enviar correos.</div></div>' +
    '<div class="card"><h2>Licencias creadas</h2><div class="hint" id="lc-res"></div><div id="lc-lista"></div></div></div></div>';

  function initLic(ROOT) {
    function $(id) { return ROOT.querySelector("#" + id); }
    function msg(t, cl) { var m = $("lc-msg"); m.className = "msg " + (cl || ""); m.innerHTML = t || ""; }
    var PLAN = "fundador";
    $("lc-plan").addEventListener("click", function (e) { var b = e.target.closest("button[data-p]"); if (!b) return; PLAN = b.dataset.p; this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); });
    function pintarPub() {
      var box = $("lc-pub");
      if (!LLAVE) {
        box.innerHTML = '<div class="pub"><b>🔑 Primer paso (una sola vez): crea tu llave de licencias.</b><br>Se guarda solo en <b>tu</b> Google Drive. Con ella firmas los códigos; nadie más puede crearlos.<button type="button" class="bt b1" id="lc-llave" style="max-width:320px">Crear mi llave</button></div>';
        $("lc-llave").onclick = function () {
          var b = this; b.disabled = true; b.textContent = "Creando…";
          crearLlave().then(function (L) { LLAVE = L; pintarPub(); pintarLista(); }, function (e) { b.disabled = false; b.textContent = "Crear mi llave"; msg(e.message, "mal"); });
        };
        return;
      }
      var t = pubTexto(LLAVE.pub), cfg = CFG.pub ? pubTexto(typeof CFG.pub === "string" ? JSON.parse(CFG.pub) : CFG.pub) : "";
      if (cfg === t) { box.innerHTML = ""; return; }
      box.innerHTML = '<div class="pub"><b>Falta un paso (una sola vez):</b> copia esta llave <b>pública</b> y pégasela a Claude en el chat para que la ponga en la app. ' +
        'Es pública: no es secreta, solo sirve para comprobar códigos. Hasta entonces los clientes no pueden activar sus licencias.' +
        '<textarea readonly id="lc-pubt">' + esc(t) + '</textarea><button type="button" class="copiar" id="lc-pubc">Copiar llave pública</button></div>';
      $("lc-pubc").onclick = function () { var a = $("lc-pubt"); a.select(); try { navigator.clipboard.writeText(a.value); } catch (e) { document.execCommand("copy"); } this.textContent = "✓ Copiada"; };
    }
    function pintarLista() {
      var l = (LLAVE && LLAVE.emitidas) || [], hoy = hoyIso();
      var vig = l.filter(function (x) { return x.hasta >= hoy; }).length;
      $("lc-res").textContent = l.length ? l.length + (l.length === 1 ? " licencia" : " licencias") + " · " + vig + " vigentes" : "Todavía no has creado ninguna.";
      if (!l.length) { $("lc-lista").innerHTML = ""; return; }
      $("lc-lista").innerHTML = '<div class="tw"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Gmail</th><th>Plan</th><th>Hasta</th><th>Estado</th><th>Importe</th><th></th></tr></thead><tbody>' +
        l.slice().reverse().map(function (x, i) {
          var d = x.hasta >= "9999" ? 99999 : diasEntre(hoy, x.hasta), est = d < 0 ? '<span class="p mal">Vencida</span>' : d <= 15 ? '<span class="p pr">Renovar en ' + d + " d</span>" : '<span class="p ok">Vigente</span>';
          return "<tr><td><b>" + esc(x.num) + "</b></td><td>" + esc(x.nombre) + "</td><td>" + esc(x.gmail) + "</td><td>" + esc((PLANES[x.plan] || {}).nombre || x.plan) + "</td><td>" + (x.hasta >= "9999" ? "para siempre" : esc(x.hasta.split("-").reverse().join("/"))) +
            "</td><td>" + est + "</td><td>" + esc(x.importe || "") + '</td><td><button type="button" class="copiar" data-c="' + (l.length - 1 - i) + '">Copiar código</button></td></tr>';
        }).join("") + "</tbody></table></div>";
    }
    $("lc-lista").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-c]"); if (!b) return;
      var x = LLAVE.emitidas[Number(b.dataset.c)]; try { navigator.clipboard.writeText(x.codigo); } catch (er) { } b.textContent = "✓ Copiado";
    });
    function crear(enviar) {
      var nom = $("lc-nom").value.trim(), mail = $("lc-mail").value.trim().toLowerCase(), imp = $("lc-imp").value.trim();
      if (!LLAVE) return Promise.reject(new Error("Primero crea tu llave de licencias (arriba)."));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return Promise.reject(new Error("Escribe bien el Gmail del cliente."));
      var hoy = hoyIso(), anio = hoy.slice(0, 4);
      // si ya tiene una licencia vigente, la nueva empieza cuando acabe esa (renovación)
      var desde = (LLAVE.emitidas || []).filter(function (x) { return x.gmail === mail && x.hasta >= hoy && x.hasta < "9999"; }).reduce(function (m, x) { return x.hasta > m ? x.hasta : m; }, hoy);
      var hasta = PLAN === "regalo" ? "9999-12-31" : sumarMeses(desde, PLANES[PLAN].meses);
      var n = (LLAVE.emitidas || []).filter(function (x) { return String(x.num).indexOf("PB-" + anio + "-") === 0; }).length + 1;
      var num = "PB-" + anio + "-" + String(n).padStart(4, "0");
      var o = { num: num, nombre: nom, gmail: mail, plan: PLAN, hasta: hasta, importe: imp, fecha: hoy };
      return firmar({ m: mail, p: PLAN, h: hasta, n: num }, LLAVE.priv).then(function (codigo) {
        o.codigo = codigo;
        var paso = enviar ? enviarCorreo(o) : Promise.resolve({});
        return paso.then(function (r) {
          o.enviado = enviar ? hoy : ""; o.desde = r.desde || "";
          LLAVE.emitidas.push(o);
          return guardarLlave(LLAVE).then(function () { pintarLista(); return Object.assign({}, o, r); });
        });
      });
    }
    function boton(id, enviar) {
      $(id).onclick = function () {
        var b = this; b.disabled = true; msg(enviar ? "Creando y enviando…" : "Creando…", "w");
        crear(enviar).then(function (o) {
          b.disabled = false;
          if (enviar) msg("✓ Licencia <b>" + esc(o.num) + "</b> enviada a <b>" + esc(o.gmail) + "</b>" + (o.desde && o.desde.toLowerCase() !== String(CFG.envio).toLowerCase() ? " (desde " + esc(o.desde) + ")" : "") + ".", "ok");
          else { try { navigator.clipboard.writeText(o.codigo); } catch (e) { } msg("✓ Licencia <b>" + esc(o.num) + "</b> creada y código copiado. Pégalo donde quieras.", "ok"); }
          ["lc-nom", "lc-mail", "lc-imp"].forEach(function (x) { $(x).value = ""; });
        }, function (e) { b.disabled = false; msg(esc(e.message), "mal"); });
      };
    }
    boton("lc-env", true); boton("lc-cop", false);
    msg("Cargando tu llave…", "w");
    buscarLlave().then(function (L) { LLAVE = L; msg(""); pintarPub(); pintarLista(); }, function (e) { msg(esc(e.message), "mal"); pintarPub(); });
    return {};
  }

  /* ---------- registrar pantallas y botones del menú ---------- */
  window.PB_VISTAS = window.PB_VISTAS || {};
  window.PB_VISTAS.premium = { tpl: TPL_PREM, init: initPremium };
  window.PB_VISTAS.licencias = { tpl: TPL_LIC, init: function (R) { return esAdmin() ? initLic(R) : (R.innerHTML = '<div class="v-lic"><h1>Licencias</h1><p class="lead">Esta pantalla es solo para Odlare.</p></div>', {}); } };
  var IC_PREM = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  var IC_LLAVE = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="m16 7 3 3"/><path d="m19 4 2 2"/></svg>';
  function botonMenu(go, txt, ic) {
    var aj = document.querySelector('.rail [data-go="form:ajustes"]');
    if (!aj || document.querySelector('.rail [data-go="' + go + '"]')) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "rb"; b.setAttribute("data-go", go);
    b.innerHTML = ic + '<span class="t">' + txt + "</span>";
    b.onclick = function () { window.SHELL.ir(go); };
    aj.parentNode.insertBefore(b, aj.nextSibling);
  }
  function menus() {
    if (EST.estado === "demo") return;
    botonMenu("premium", "Premium", IC_PREM);
    if (esAdmin()) botonMenu("licencias", "Licencias", IC_LLAVE);
  }

  function arrancar() {
    calcular().then(function () { avisar(); menus(); }, function () { EST = { estado: "prueba", dias: PRUEBA, sinCorte: true }; avisar(); menus(); });
  }
  window.pbLicencia = { estado: function () { return EST; }, activar: activar, recalcular: arrancar, _leer: leerCodigo, _firmar: firmar, _mime: mime, _html: htmlCorreo, _forzar: function (e) { EST = e; avisar(); menus(); } };
  window.addEventListener("load", function () { setTimeout(arrancar, 1200); });
})();
