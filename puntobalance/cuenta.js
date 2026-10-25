/* PuntoBalance 5.0.0 · Cuenta: pantalla de entrada (aprobada 25 oct 2026), «Entrar con Google» y «Probar sin cuenta».
   Con Google, la app crea (o encuentra) la hoja «PuntoBalance» en el Drive de la persona, con el permiso drive.file:
   solo puede ver los archivos que crea ella misma. Nada pasa por servidores de Odlare. */
(function () {
  var CFG = window.PB_CONFIG || {};
  var ALCANCE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
  function leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function poner(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var CUENTA = leer("pb_cuenta");          // { correo, nombre, hojaId }
  var TK = leer("pb_tk");                  // { t, exp }

  /* ---------- Google Identity Services (token) ---------- */
  var gisListo = new Promise(function (r) {
    if (!CFG.clientId) return r(false);
    var s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = function () { r(true); }; s.onerror = function () { r(false); };
    document.head.appendChild(s);
  });
  var cliente = null, esperando = [];
  function pedirToken(conPantalla) {
    return gisListo.then(function (ok) {
      if (!ok) throw new Error(CFG.clientId ? "No se pudo cargar el acceso de Google. Revisa tu conexión." : "«Entrar con Google» todavía no está activado en esta versión de prueba.");
      return new Promise(function (resolver, rechazar) {
        if (!cliente) {
          cliente = google.accounts.oauth2.initTokenClient({
            client_id: CFG.clientId, scope: ALCANCE,
            callback: function (r) {
              var q = esperando.splice(0);
              if (r.error) { q.forEach(function (p) { p[1](new Error("Google no dio permiso (" + r.error + ").")); }); return; }
              TK = { t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000 }; poner("pb_tk", TK);
              q.forEach(function (p) { p[0](TK.t); });
            },
            error_callback: function (e) { esperando.splice(0).forEach(function (p) { p[1](new Error(e && e.type === "popup_closed" ? "Cerraste la ventana de Google." : "No se pudo entrar con Google.")); }); }
          });
        }
        esperando.push([resolver, rechazar]);
        cliente.requestAccessToken(conPantalla ? { prompt: "select_account" } : { prompt: "", login_hint: CUENTA && CUENTA.correo });
      });
    });
  }
  /** Token válido; si caducó, pide «Continuar» (Google necesita un toque de la persona). */
  var avisoSesion = null;
  function token() {
    if (TK && TK.t && TK.exp > Date.now()) return Promise.resolve(TK.t);
    if (!avisoSesion) {
      avisoSesion = new Promise(function (resolver, rechazar) {
        var v = document.createElement("div"); v.id = "pbSes";
        v.innerHTML = '<div class="c"><img src="iconos/icono-192.png" alt=""><h3>Sigue con Google</h3><p>Por seguridad, Google pide confirmar cada cierto tiempo.' +
          (CUENTA ? "<br><b>" + esc(CUENTA.correo) + "</b>" : "") + '</p><button type="button" class="pri">Continuar</button><div class="err" hidden></div></div>';
        document.body.appendChild(v);
        v.querySelector("button").onclick = function () {
          pedirToken(false).then(function (t) { v.remove(); avisoSesion = null; resolver(t); },
            function (e) { var m = v.querySelector(".err"); m.hidden = false; m.textContent = e.message; });
        };
      });
    }
    return avisoSesion;
  }

  function g(metodo, url, cuerpo) {
    return token().then(function (tk) {
      return fetch(url, { method: metodo, headers: Object.assign({ Authorization: "Bearer " + tk }, cuerpo ? { "Content-Type": "application/json" } : {}), body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error("Google: " + ((j.error && j.error.message) || r.status)); return j; }); });
  }

  window.pbCuenta = {
    token: token,
    correo: function () { return CUENTA ? CUENTA.correo : ""; },
    sesionCaducada: function () { TK = null; poner("pb_tk", null); },
    salir: function () {
      try { if (TK && TK.t && window.google && google.accounts) google.accounts.oauth2.revoke(TK.t, function () { }); } catch (e) { }
      poner("pb_tk", null); poner("pb_cuenta", null); poner("pb_modo", null); location.reload();
    }
  };

  /* ---------- pantalla de entrada ---------- */
  var G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  var css = document.createElement("style");
  css.textContent =
    "#pbEnt{position:fixed;inset:0;z-index:300;background:#E8EAF1;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;font-family:inherit;color:#1F2540}" +
    "#pbEnt .card{width:100%;max-width:820px;min-height:420px;background:#fff;border-radius:28px;display:flex;overflow:hidden;box-shadow:0 22px 50px rgba(20,27,58,.14)}" +
    "#pbEnt .izq{width:46%;background:#1B2B5B;display:flex;align-items:center;justify-content:center;position:relative;padding:30px}" +
    "#pbEnt .izq img{width:150px;height:150px;border-radius:38px;box-shadow:0 20px 40px rgba(0,0,0,.35)}" +
    "#pbEnt .q{position:absolute;font-weight:800;color:#1B2B5B;background:#fff;border-radius:12px;padding:4px 10px;font-size:15px;box-shadow:0 8px 18px rgba(0,0,0,.2)}" +
    "#pbEnt .der{flex:1;padding:34px 38px;display:flex;flex-direction:column}" +
    "#pbEnt h1{font-size:30px;line-height:1.15;margin:4px 0 10px;color:#151A2D;font-weight:800;letter-spacing:-.01em}" +
    "#pbEnt p{margin:0;color:#5B6080;font-size:15px;line-height:1.55}" +
    "#pbEnt ul{list-style:none;margin:18px 0 22px;padding:0;font-size:15px;line-height:2}#pbEnt li:before{content:'✓  ';color:#16A34A;font-weight:800}" +
    "#pbEnt .g{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:10px;border:1.5px solid #D5DAE6;border-radius:14px;padding:13px;font:inherit;font-weight:800;font-size:16px;background:#fff;color:#151A2D;cursor:pointer}" +
    "#pbEnt .g:hover{background:#F6F7FB}#pbEnt .p{border:0;background:transparent;font:inherit;font-weight:700;color:#1B2B5B;font-size:14.5px;padding:10px;cursor:pointer}" +
    "#pbEnt .err{color:#D92D20;font-size:13.5px;font-weight:600;min-height:18px;text-align:center}#pbEnt .odl{font-size:12px;color:#9AA0B8;text-align:center;margin-top:6px}" +
    "#pbEnt .negs{display:grid;gap:10px;margin:18px 0}#pbEnt .neg{text-align:left;border:1.5px solid #D5DAE6;border-radius:14px;padding:14px 16px;background:#fff;font:inherit;cursor:pointer;color:#1F2540}" +
    "#pbEnt .neg b{display:block;font-size:16px}#pbEnt .neg small{color:#7A7F9C;font-size:13px}#pbEnt .neg:hover{border-color:#1B2B5B}" +
    "@media (max-width:760px){#pbEnt{align-items:flex-start;padding:0}#pbEnt .card{flex-direction:column;border-radius:0;min-height:100%;box-shadow:none}#pbEnt .izq{width:auto;min-height:220px}#pbEnt .izq img{width:110px;height:110px;border-radius:28px}#pbEnt .der{padding:24px 22px 28px}#pbEnt h1{font-size:25px}}" +
    "#pbSes{position:fixed;inset:0;z-index:420;background:rgba(15,18,32,.5);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#pbSes .c{background:#fff;border-radius:20px;max-width:360px;width:100%;padding:24px;text-align:center;color:#1F2540;box-shadow:0 20px 50px rgba(0,0,0,.25)}" +
    "#pbSes img{width:64px;height:64px;border-radius:16px}#pbSes h3{margin:10px 0 6px}#pbSes p{margin:0 0 16px;color:#5B6080;font-size:14px;line-height:1.5}" +
    "#pbSes .pri{width:100%;border:0;border-radius:12px;padding:13px;background:#1B2B5B;color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer}#pbSes .err{color:#D92D20;font-size:13px;margin-top:10px}" +
    "#pbDemo{position:fixed;left:50%;transform:translateX(-50%);top:10px;z-index:250;background:#1B2B5B;color:#fff;border:0;border-radius:99px;padding:8px 16px;font:inherit;font-size:13px;font-weight:700;box-shadow:0 8px 20px rgba(0,0,0,.2);cursor:pointer;white-space:nowrap}" +
    "#pbDemo b{color:#F4A62A}@media (max-width:760px){#pbDemo{top:auto;bottom:74px}}" +
    ".pb-cuenta{margin-top:8px;font-size:11.5px;color:#9AA0C8;word-break:break-all}.pb-cuenta button{background:none;border:0;padding:0;color:#A5A0FF;font:inherit;font-weight:600;cursor:pointer;margin-left:4px}";
  document.head.appendChild(css);

  function entrada() {
    var v = document.createElement("div"); v.id = "pbEnt";
    v.innerHTML = '<div class="card"><div class="izq"><img src="iconos/icono-512.png" alt="PuntoBalance"><span class="q" style="right:18%;top:22%">£</span><span class="q" style="left:14%;bottom:24%">PDF</span></div>' +
      '<div class="der" id="pbEntD"></div></div>';
    document.body.appendChild(v);
    paso1();
    function paso1() {
      $("pbEntD").innerHTML = '<h1>Tu negocio, en orden</h1><p>Ingresos, gastos y facturas en un solo sitio, desde tu computadora, tablet o celular.</p>' +
        "<ul><li>Factura en PDF en un minuto</li><li>Sabes cuánto ganas de verdad</li><li>Tus datos en tu propio Google Drive</li></ul>" +
        '<button type="button" class="g" id="pbG">' + G + 'Entrar con Google</button><button type="button" class="p" id="pbP">👀 Probar sin cuenta</button>' +
        '<div class="err" id="pbErr"></div><div class="odl">PuntoBalance · de Odlare</div>';
      $("pbP").onclick = function () { poner("pb_modo", "demo"); v.remove(); demo(); };
      $("pbG").onclick = function () {
        var b = $("pbG"); b.disabled = true; $("pbErr").textContent = "";
        pedirToken(true).then(function () { return g("GET", "https://www.googleapis.com/oauth2/v3/userinfo"); })
          .then(function (u) {
            CUENTA = { correo: u.email, nombre: u.name || "" };
            var q = "appProperties has { key='puntobalance' and value='1' } and trashed=false";
            return g("GET", "https://www.googleapis.com/drive/v3/files?fields=files(id,name)&q=" + encodeURIComponent(q));
          })
          .then(function (j) {
            if (j.files && j.files.length) { CUENTA.hojaId = j.files[0].id; guardarYEntrar(); return; }
            paso2();
          })
          .catch(function (e) { b.disabled = false; $("pbErr").textContent = e.message; });
      };
    }
    function paso2() {
      $("pbEntD").innerHTML = "<h1>¡Hola" + (CUENTA.nombre ? ", " + esc(CUENTA.nombre.split(" ")[0]) : "") + "!</h1><p>Vamos a crear tu hoja de PuntoBalance en tu Google Drive. ¿Qué tipo de negocio tienes? Lo puedes cambiar después en Ajustes.</p>" +
        '<div class="negs"><button type="button" class="neg" data-n="dj"><b>DJ / eventos</b><small>Fecha del evento · Cliente</small></button>' +
        '<button type="button" class="neg" data-n="productos"><b>Venta de productos</b><small>Fecha de venta · Comprador</small></button></div><div class="err" id="pbErr"></div>';
      Array.prototype.forEach.call(document.querySelectorAll("#pbEnt .neg"), function (b) {
        b.onclick = function () {
          $("pbErr").style.color = "#5B6080"; $("pbErr").textContent = "Creando tu hoja…";
          g("POST", "https://www.googleapis.com/drive/v3/files?fields=id", { name: "PuntoBalance", mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { puntobalance: "1" } })
            .then(function (f) { CUENTA.hojaId = f.id; poner("pb_cuenta", CUENTA); return window.pbMotor.preparar(f.id, CUENTA.nombre, b.getAttribute("data-n")); })
            .then(function () { poner("pb_modo", "hoja"); v.remove(); lineaCuenta(); })
            .catch(function (e) { $("pbErr").style.color = ""; $("pbErr").textContent = e.message; });
        };
      });
    }
    function guardarYEntrar() { poner("pb_cuenta", CUENTA); poner("pb_modo", "hoja"); window.pbMotor.usarHoja(CUENTA.hojaId); v.remove(); lineaCuenta(); }
  }

  function demo() {
    window.pbMotor.usarDemo((leer("pb_demo_neg")) || "dj");
    var b = document.createElement("button"); b.id = "pbDemo"; b.type = "button";
    b.innerHTML = "Modo de ejemplo · <b>Entrar con Google</b> para guardar tus datos";
    b.onclick = function () { poner("pb_modo", null); location.reload(); };
    document.body.appendChild(b);
  }

  function lineaCuenta() {
    var sv = $("sh-ver"); if (!sv || !CUENTA || sv.querySelector(".pb-cuenta")) return;
    var d = document.createElement("div"); d.className = "pb-cuenta";
    d.innerHTML = esc(CUENTA.correo) + '<button type="button">Salir</button>';
    d.querySelector("button").onclick = function () { if (confirm("¿Cerrar sesión en este aparato? Tus datos siguen guardados en tu Google Drive.")) window.pbCuenta.salir(); };
    sv.appendChild(d);
  }

  function inicio() {
    var modo = leer("pb_modo");
    if (modo === "demo") return demo();
    if (modo === "hoja" && CUENTA && CUENTA.hojaId) { window.pbMotor.usarHoja(CUENTA.hojaId); return lineaCuenta(); }
    entrada();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicio); else inicio();
})();
