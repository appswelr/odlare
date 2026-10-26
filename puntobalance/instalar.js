/* PuntoBalance 5.0.0-alpha6/alpha12 · Solo instalada, como un programa (aprobado 25 oct 2026).
   Si la página se abre en una pestaña normal del navegador, NO se muestra la app: solo la pantalla «Instala PuntoBalance».
   La app se usa solo instalada (su propia ventana, icono en el escritorio). Para pruebas: añadir ?navegador=1 a la dirección. */
(function () {
  var standalone = false;
  try { standalone = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches || window.navigator.standalone === true; } catch (e) { }
  var q = new URLSearchParams(location.search);
  var publicada = location.protocol === "https:" && !/claude|anthropic|usercontent/.test(location.hostname);
  if (standalone || !publicada || q.get("navegador") === "1") return;
  window.PB_SOLO_INSTALAR = true;
  // enlace «Activar Premium» del correo: guardamos el código para que la app instalada lo active sola
  var licPend = q.get("licencia");
  if (licPend) { try { localStorage.setItem("pb_lic_pend", licPend); } catch (e) { } try { history.replaceState(null, "", location.pathname); } catch (e) { } }

  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var chromium = !!window.chrome || /Edg\//.test(ua);
  var firefox = /Firefox\//.test(ua);
  var aviso = null, instalada = false;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); aviso = e; pintar(); });
  window.addEventListener("appinstalled", function () { instalada = true; aviso = null; pintar(); });

  var css = document.createElement("style");
  css.textContent =
    "#pbIns{position:fixed;inset:0;z-index:1000;background:#1B2B5B;display:flex;align-items:center;justify-content:center;padding:20px;font-family:'DM Sans',system-ui,'Segoe UI',sans-serif;color:#1F2540;overflow:auto}" +
    "#pbIns .c{background:#fff;border-radius:28px;padding:32px 30px 24px;width:100%;max-width:400px;text-align:center;box-shadow:0 30px 70px rgba(0,0,0,.35)}" +
    "#pbIns img{width:96px;height:96px;border-radius:24px;box-shadow:0 12px 28px rgba(27,43,91,.35)}" +
    "#pbIns h1{margin:14px 0 8px;font-size:26px;color:#151A2D;font-weight:800;letter-spacing:-.01em}" +
    "#pbIns p{margin:0 0 18px;color:#5B6080;font-size:15px;line-height:1.5}" +
    "#pbIns .b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:14px;padding:15px;background:#1B2B5B;color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer}" +
    "#pbIns .b:disabled{opacity:.5;cursor:default}#pbIns .ok{color:#12804A;font-weight:700}" +
    "#pbIns .pasos{text-align:left;background:#F4F5FA;border-radius:14px;padding:12px 16px;font-size:14px;line-height:1.7;margin:0 0 14px}" +
    "#pbIns .m{font-size:12.5px;color:#9AA0B8;margin-top:14px}";
  document.head.appendChild(css);

  var v = null;
  function pintar() {
    if (!v) return;
    var cuerpo;
    if (instalada) {
      cuerpo = '<p class="ok">✓ ¡PuntoBalance está instalada!</p><p>Ábrela desde el <b>icono de tu escritorio</b> o del <b>menú Inicio</b>. Ya puedes cerrar esta pestaña.</p>';
    } else if (aviso) {
      cuerpo = "<p>Se instala en tu computadora o tablet y se abre en su propia ventana, como un programa. Sin anuncios.</p>" +
        '<button type="button" class="b" id="pbInsB">⊕ Instalar PuntoBalance</button>';
    } else if (ios) {
      cuerpo = "<p>En iPhone o iPad se instala desde Safari:</p>" +
        '<div class="pasos">1. Pulsa el botón <b>Compartir</b> (⬆️)<br>2. Elige <b>«Añadir a pantalla de inicio»</b><br>3. Pulsa <b>Añadir</b></div>';
    } else if (firefox || !chromium) {
      cuerpo = "<p>Este navegador no puede instalar apps. Abre esta misma dirección con <b>Chrome</b>, <b>Edge</b> o <b>Brave</b> para instalar PuntoBalance.</p>";
    } else {
      cuerpo = "<p>Se instala en tu computadora o tablet y se abre en su propia ventana, como un programa.</p>" +
        '<div class="pasos">¿Ya la tienes instalada? Ábrela desde el <b>icono de tu escritorio</b> o el <b>menú Inicio</b>.<br>Si no, pulsa el icono <b>⊕ Instalar</b> que sale a la derecha de la barra de direcciones.</div>';
    }
    if (licPend) cuerpo = '<p class="ok" style="background:#E8F7EE;border-radius:12px;padding:10px 12px">🎉 Tu código Premium quedó guardado.</p><p>Abre PuntoBalance (el icono de tu escritorio o del celular) y se <b>activa solo</b>. Si no tienes la app todavía, instálala primero.</p>' + cuerpo;
    v.querySelector("#pbInsC").innerHTML = cuerpo;
    var b = v.querySelector("#pbInsB");
    if (b) b.onclick = function () { if (!aviso) return; b.disabled = true; aviso.prompt(); aviso.userChoice.then(function (r) { if (r && r.outcome === "accepted") instalada = true; aviso = null; pintar(); }); };
  }
  function mostrar() {
    v = document.createElement("div"); v.id = "pbIns";
    v.innerHTML = '<div class="c"><img src="iconos/icono-192.png" alt="PuntoBalance"><h1>Instala PuntoBalance</h1><div id="pbInsC"></div>' +
      '<div class="m">PuntoBalance · de Odlare · Tus datos quedan en tu propio Google Drive</div></div>';
    document.body.appendChild(v);
    pintar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mostrar); else mostrar();
})();
