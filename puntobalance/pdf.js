/* PuntoBalance 5.0.0 · Factura en PDF hecha en el propio aparato (computadora, tablet o teléfono).
   Dibuja la misma factura que Factura.html (versión de la hoja) con jsPDF, la guarda en la carpeta de facturas
   del Drive de la persona y deja abrirla, descargarla, mandarla por correo o compartirla.
   En «Probar sin cuenta» no se sube nada: solo se abre y se descarga. */
(function () {
  var LOCAL = window.PB_LOCAL = window.PB_LOCAL || {};
  var INK = [21, 26, 45], MUTED = [122, 127, 156], KEY = [154, 159, 184], LINE = [236, 238, 244], ACCENT = [79, 70, 229];

  function texto(v) { return String(v == null ? "" : v); }

  /** Dibuja la factura y devuelve un Blob PDF. d = getFacturaDatos(). */
  function dibujar(d) {
    var J = window.jspdf.jsPDF, doc = new J({ unit: "mm", format: "a4" });
    var W = 210, X0 = 16, X1 = W - 16, y = 16, cfg = d.cfg, f = d.f;
    function col(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function k(t, x, yy, al) { doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); col(KEY); doc.text(texto(t).toUpperCase().split("").join(" "), x, yy, { align: al || "left" }); }
    // cabecera: logo y datos del negocio
    try { if (d.logo) doc.addImage(d.logo, /jpe?g/i.test(d.logo.slice(0, 30)) ? "JPEG" : "PNG", X0, y, 40, 19.5); } catch (e) { }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); col(INK);
    doc.text(texto(cfg.nombre), X1, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.6); col(MUTED);
    [cfg.direccion, cfg.ciudad_postcode, cfg.telefono ? "Tel: " + cfg.telefono : "", cfg.email].filter(Boolean).forEach(function (l, i) { doc.text(texto(l), X1, y + 7.5 + i * 4, { align: "right" }); });
    y += 28;
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.rect(X0, y, 12, 0.8, "F");
    y += 12;
    // INVOICE · fechas · cliente
    doc.setFont("helvetica", "normal"); doc.setFontSize(19); col(INK); doc.text("I N V O I C E", X0, y);
    doc.setFont("helvetica", "bold"); doc.text("No. " + f.id, X0, y + 8);
    var xm = W / 2 + 4;
    k("Invoice date", xm, y - 4, "center"); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); col(INK); doc.text(texto(f.fecha), xm, y + 0.5, { align: "center" });
    k("Due date", xm, y + 6, "center"); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); col(INK); doc.text(texto(f.vencimiento), xm, y + 10.5, { align: "center" });
    k("Invoice to", X1, y - 4, "right");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.2); col(INK); doc.text(texto(f.clienteNombre), X1, y + 0.5, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.6); col(MUTED);
    var c = f.cliente || {};
    [c["DIRECCIÓN"], [c["CIUDAD"], c["POSTCODE"]].filter(Boolean).join(" "), c["TELÉFONO"]].filter(Boolean).forEach(function (l, i) { doc.text(texto(l), X1, y + 5 + i * 4, { align: "right" }); });
    y += 30;
    // tabla
    var cols = [[X0, "Description", "left"], [X0 + 76, "Date", "left"], [X0 + 110, "Qty", "right"], [X0 + 114, "Unit", "left"], [X0 + 152, "Price", "right"], [X1, "Total", "right"]];
    cols.forEach(function (cc) { k(cc[1], cc[0], y, cc[2]); });
    y += 2.5; doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(0.3); doc.line(X0, y, X1, y);
    (f.lineas || []).forEach(function (l) {
      if (y > 250) { doc.addPage(); y = 20; }
      y += 8;
      doc.setFontSize(9.3);
      doc.setFont("helvetica", "bold"); col(INK); doc.text(doc.splitTextToSize(texto(l.desc), 72)[0], X0, y);
      doc.setFont("helvetica", "normal"); col(MUTED); doc.text(texto(l.fecha), X0 + 76, y);
      col(INK); doc.text(texto(l.qty), X0 + 110, y, { align: "right" });
      col(MUTED); doc.text(texto(l.unidad), X0 + 114, y);
      col(INK); doc.text(texto(l.precio), X0 + 152, y, { align: "right" });
      doc.setFont("helvetica", "bold"); doc.text(texto(l.total), X1, y, { align: "right" });
      y += 4; doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(X0, y, X1, y);
    });
    y += 12;
    k("Total amount due", X1, y, "right");
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); col(INK); doc.text(texto(f.total), X1, y + 10, { align: "right" });
    y += 22;
    if (cfg.nota_factura) {
      k("Observations", X0, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); col(MUTED);
      var nl = doc.splitTextToSize(texto(cfg.nota_factura), X1 - X0);
      doc.text(nl, X0, y + 5); y += 8 + nl.length * 4;
    }
    y = Math.max(y + 6, 230);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(X0, y, X1, y);
    y += 8;
    k("Payment details", X0, y); k("Payment method", W / 2 + 4, y);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); col(INK);
    var pagos = [["", cfg.banco], ["Account name  ", cfg.titular], ["Sort code  ", cfg.sort_code], ["Account no.  ", cfg.cuenta]];
    pagos.forEach(function (p, i) {
      var yy = y + 5 + i * 4.6;
      if (p[0]) { col(MUTED); doc.text(p[0], X0, yy); col(INK); doc.text(texto(p[1]), X0 + doc.getTextWidth(p[0]), yy); }
      else { col(INK); doc.text(texto(p[1]), X0, yy); }
    });
    col(INK); doc.text(texto(f.formaPago), W / 2 + 4, y + 5);
    return doc.output("blob");
  }

  /* ---------- Drive (solo con cuenta) ---------- */
  function drive(metodo, url, cuerpo, tipo) {
    return window.pbCuenta.token().then(function (tk) {
      var h = { Authorization: "Bearer " + tk };
      if (tipo) h["Content-Type"] = tipo;
      return fetch(url, { method: metodo, headers: h, body: cuerpo });
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error("Google Drive: " + ((j.error && j.error.message) || r.status)); return j; }); });
  }
  function carpeta(nombre) {
    var q = "name='" + nombre.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    return drive("GET", "https://www.googleapis.com/drive/v3/files?fields=files(id)&q=" + encodeURIComponent(q)).then(function (j) {
      if (j.files && j.files.length) return j.files[0].id;
      return drive("POST", "https://www.googleapis.com/drive/v3/files?fields=id", JSON.stringify({ name: nombre, mimeType: "application/vnd.google-apps.folder" }), "application/json").then(function (x) { return x.id; });
    });
  }
  function subir(blob, nombre, carpetaId) {
    var b = "pb" + Date.now(), meta = { name: nombre, mimeType: "application/pdf", parents: [carpetaId] };
    var cuerpo = new Blob(["--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + b + "\r\nContent-Type: application/pdf\r\n\r\n", blob, "\r\n--" + b + "--"]);
    return drive("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", cuerpo, "multipart/related; boundary=" + b);
  }

  /* ---------- ventana «Factura lista» ---------- */
  var css = document.createElement("style");
  css.textContent = "#pbFac{position:fixed;inset:0;z-index:400;background:rgba(15,18,32,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}" +
    "#pbFac .c{background:#fff;color:#1F2540;border-radius:18px;max-width:420px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25)}" +
    "#pbFac h3{margin:0 0 6px;font-size:18px}#pbFac p{margin:0 0 14px;color:#5B6080;font-size:13.5px;line-height:1.5}" +
    "#pbFac .bs{display:grid;gap:8px}#pbFac button,#pbFac a{display:block;text-align:center;border-radius:12px;padding:12px;font:inherit;font-weight:700;font-size:14.5px;border:1px solid #D5DAE6;background:#fff;color:#1F2540;text-decoration:none;cursor:pointer}" +
    "#pbFac .pri{background:#1B2B5B;border-color:#1B2B5B;color:#fff}#pbFac .x{border:0;background:transparent;color:#7A7F9C;font-weight:600}";
  document.head.appendChild(css);

  function ventana(o) {
    return new Promise(function (resolver) {
      var v = document.createElement("div"); v.id = "pbFac";
      var archivo = new File([o.blob], o.nombre + ".pdf", { type: "application/pdf" });
      var urlLocal = URL.createObjectURL(o.blob);
      var puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [archivo] }));
      v.innerHTML = '<div class="c" role="dialog" aria-modal="true"><h3>Factura nº ' + o.id + ' lista</h3><p>' + o.texto + '</p><div class="bs">' +
        (o.enviar ? (puedeCompartir ? '<button type="button" class="pri" data-a="compartir">Compartir la factura (correo, WhatsApp…)</button>' : "") +
          '<button type="button" class="' + (puedeCompartir ? "" : "pri") + '" data-a="correo">Enviar por correo' + (o.para ? " a " + o.para : "") + "</button>" : "") +
        '<a href="' + (o.urlDrive || urlLocal) + '" target="_blank" rel="noopener" class="' + (o.enviar ? "" : "pri") + '">Abrir el PDF</a>' +
        '<a href="' + urlLocal + '" download="' + o.nombre + '.pdf">Descargar</a>' +
        '<button type="button" class="x" data-a="cerrar">Cerrar</button></div></div>';
      document.body.appendChild(v);
      v.addEventListener("click", function (e) {
        var b = e.target.closest("[data-a]");
        if (!b && e.target !== v) return;
        var a = b ? b.getAttribute("data-a") : "cerrar";
        if (a === "compartir") { navigator.share({ files: [archivo], title: "Invoice " + o.id, text: o.cuerpo }).catch(function () { }); return; }
        if (a === "correo") {
          var dl = document.createElement("a"); dl.href = urlLocal; dl.download = o.nombre + ".pdf"; document.body.appendChild(dl); dl.click(); dl.remove();
          location.href = "mailto:" + encodeURIComponent(o.para || "") + "?subject=" + encodeURIComponent(o.asunto) + "&body=" + encodeURIComponent(o.cuerpo + "\n\n(Adjunta el PDF que se acaba de descargar.)");
          return;
        }
        if (a === "cerrar") { v.remove(); setTimeout(function () { URL.revokeObjectURL(urlLocal); }, 60000); resolver(); }
      });
    });
  }

  function hacer(id, nota, run, enviar) {
    return run("getFacturaDatos", [id, nota]).then(function (d) {
      if (enviar && !d.para) throw new Error('El cliente "' + d.f.clienteNombre + '" no tiene email. Puedes añadirlo en la hoja Clientes, o usar «PDF» y compartirlo.');
      var blob = dibujar(d);
      var conCuenta = window.pbMotor && window.pbMotor.modo() === "hoja";
      var subida = conCuenta ? carpeta(d.carpeta).then(function (cid) { return subir(blob, d.nombreArchivo + ".pdf", cid); }) : Promise.resolve(null);
      return subida.then(function (arch) {
        var asunto = "Invoice #" + id + " – " + (d.cfg.nombre || "");
        var cuerpo = "Hello,\n\nPlease find attached invoice #" + id + " for " + d.f.total + ", due on " + d.f.vencimiento + ".\n\nKind regards,\n" + (d.cfg.nombre || "");
        var res = { nombre: d.nombreArchivo + ".pdf", url: arch ? arch.webViewLink : "#", para: d.para || "" };
        ventana({ id: id, blob: blob, nombre: d.nombreArchivo, urlDrive: arch && arch.webViewLink, enviar: enviar, para: d.para, asunto: asunto, cuerpo: cuerpo,
          texto: (arch ? "Guardada en tu Drive, en la carpeta «" + d.carpeta + "». " : "Modo de ejemplo: no se guarda en ningún sitio. ") +
            (enviar ? "Elige cómo mandarla al cliente." : "Puedes abrirla o descargarla.") });
        return res;
      });
    });
  }
  LOCAL.generarFactura = function (id, nota, run) { return hacer(id, nota, run, false); };
  LOCAL.enviarFactura = function (id, nota, run) { return hacer(id, nota, run, true); };

  /* Resumen del periodo: se abre el correo del aparato con las cifras. */
  LOCAL.hubEnviarResumen = function (run) {
    return run("getResumenActual", []).then(function (r) {
      var gbp = function (n) { return (n < 0 ? "-£" : "£") + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };
      var lineas = ["Resumen · " + r.etiqueta, "", "Ingresos (" + r.nIng + "): " + gbp(r.ingresos), "Gastos (" + r.nGas + "): " + gbp(r.gastos), "Ganancia: " + gbp(r.ganancia), "", "Gastos por categoría:"]
        .concat(Object.keys(r.cats).map(function (k) { return "• " + k + ": " + gbp(r.cats[k]); }))
        .concat(r.avisos.length ? ["", "Antes de enviarlo, revisa:"].concat(r.avisos.slice(0, 10).map(function (a) { return "• " + a; })) : []);
      location.href = "mailto:" + encodeURIComponent(r.para) + "?subject=" + encodeURIComponent("Resumen · " + r.etiqueta) + "&body=" + encodeURIComponent(lineas.join("\n"));
      return r.para || "tu correo";
    });
  };
  LOCAL.hubRecordatorio = function () { return Promise.reject(new Error("En la app, el recordatorio mensual llegará en una próxima versión.")); };
  window.pbDibujarFactura = dibujar; // para pruebas
})();
