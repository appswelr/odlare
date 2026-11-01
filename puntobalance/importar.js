/* PuntoBalance 5.0.0-alpha24 · «Importar movimientos» (aprobado con imagen el 1 nov 2026).
   Lee el archivo que baja la persona y lo convierte en ingresos y gastos:
   - eBay: «Transaction report» (Seller Hub › Payments › Reports), CSV.
   - Etsy: «Monthly statement» (Shop Manager › Finances › Monthly statements), CSV.
   - Cualquier otro CSV o Excel: la persona dice una vez qué es cada columna y la app lo recuerda (Config › IMP_PLANTILLAS).
   Dos formas: «Resumen del mes» (una línea por tipo y mes) o «Cada movimiento por separado».
   Lo dudoso (p. ej. una compra con saldo de eBay) sale en «Decide tú». Nada se repite: cada fila lleva una clave en la columna IMPORTADO.
   El Excel se lee subiéndolo un momento a Drive como hoja de Google (permiso drive.file) y borrándolo después. */
(function () {
  var DR = "https://www.googleapis.com/drive/v3/files", UP = "https://www.googleapis.com/upload/drive/v3/files", SH = "https://sheets.googleapis.com/v4/spreadsheets/";
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var MES_EN = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11, ene: 0, abr: 3, ago: 7, dic: 11 };
  function C() { return window.pbCuenta; }
  function conHoja() { return !!(C() && C().modo() === "hoja" && C().hojaId()); }
  function srv(fn) { return window.pbMotor.llamar.apply(null, arguments); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); }
  function libras(n) { var x = Math.round((Number(n) || 0) * 100) / 100; return (x < 0 ? "−" : "") + "£" + Math.abs(x).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function norm(t) { return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase(); }
  function dos(n) { return String(n).padStart(2, "0"); }
  function mesDe(f) { return f.slice(0, 7); }
  function mesTxt(m) { return MESES[Number(m.slice(5, 7)) - 1] + " " + m.slice(0, 4); }
  function fechaCorta(f) { return f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(2, 4); }
  function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

  /* ---------- leer números y fechas de cualquier archivo ---------- */
  function num(v) {
    if (typeof v === "number") return v;
    var s = String(v == null ? "" : v).trim();
    if (!s || s === "--" || s === "-") return null;
    var neg = /^\(.*\)$/.test(s) || /^[−-]/.test(s.replace(/^[£$€\s]+/, "")) || /^[£$€]\s*[−-]/.test(s);
    s = s.replace(/[()£$€\s]|GBP|USD|EUR/gi, "").replace(/^[−-]+/, "").replace(/[−-]/g, "");
    if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    var n = Number(s);
    return isNaN(n) ? null : (neg ? -n : n);
  }
  function fecha(v) {
    if (typeof v === "number" && v > 20000 && v < 80000) { var d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return d.getUTCFullYear() + "-" + dos(d.getUTCMonth() + 1) + "-" + dos(d.getUTCDate()); }
    var s = String(v == null ? "" : v).trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + "-" + dos(m[2]) + "-" + dos(m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(s))) { var y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + dos(m[2]) + "-" + dos(m[1]); }
    if ((m = /^(\d{1,2})\s+([a-zA-Záéíóú]{3,})\.?,?\s+(\d{4})/.exec(s))) { var k = MES_EN[norm(m[2]).slice(0, 3)]; if (k != null) return m[3] + "-" + dos(k + 1) + "-" + dos(m[1]); }
    if ((m = /^([a-zA-Z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s))) { var k2 = MES_EN[norm(m[1]).slice(0, 3)]; if (k2 != null) return m[3] + "-" + dos(k2 + 1) + "-" + dos(m[2]); }
    return null;
  }
  function csvFilas(txt) {
    txt = String(txt).replace(/^﻿/, "");
    var sep = ",", primera = txt.split(/\r?\n/).slice(0, 15).join("\n");
    if ((primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length) sep = ";";
    var filas = [], f = [], c = "", q = false;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { f.push(c); c = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; f.push(c); filas.push(f); f = []; c = ""; }
      else c += ch;
    }
    if (c !== "" || f.length) { f.push(c); filas.push(f); }
    return filas;
  }

  /* ---------- categorías: a qué categoría de la persona va cada tipo ---------- */
  var TIPOS = {
    comisiones: { nombre: "Comisiones de venta", re: /comisi|fee/i, txt: "Comisiones" },
    envios: { nombre: "Envíos", re: /env[ií]o|postage|correo|shipping|mensajer/i, txt: "Envíos" },
    publicidad: { nombre: "Publicidad", re: /publicidad|anuncio|marketing|\bads?\b/i, txt: "Anuncios" },
    reembolsos: { nombre: "Reembolsos", re: /reembols|devoluc|refund/i, txt: "Reembolsos" },
    repuestos: { nombre: "Repuestos", re: /repuesto|piezas/i, txt: "Compras" }
  };
  function catSugerida(tipo, cats) {
    var T = TIPOS[tipo]; if (!T) return cats[0] || "Otros gastos";
    var hay = cats.filter(function (c) { return T.re.test(c); })[0];
    return hay || T.nombre;
  }

  /* ---------- eBay: Transaction report ---------- */
  function leerEbay(filas) {
    var h = -1;
    for (var i = 0; i < Math.min(filas.length, 40); i++) if (filas[i].indexOf("Transaction creation date") >= 0 && filas[i].indexOf("Type") >= 0) { h = i; break; }
    if (h < 0) return null;
    var cab = filas[h], col = function (n) { return cab.indexOf(n); };
    var I = { f: col("Transaction creation date"), t: col("Type"), o: col("Order number"), bn: col("Buyer name"), bu: col("Buyer username"), net: col("Net amount"), gross: col("Gross transaction amount"),
      item: col("Item title"), ref: col("Reference ID"), desc: col("Description"), qty: col("Quantity") };
    var FEES = ["Final value fee – fixed", "Final value fee – variable", "Regulatory operating fee", "Very high 'item not as described' fee", "Below standard performance fee", "International fee"].map(col).filter(function (x) { return x >= 0; });
    var vendedor = ""; for (var j = 0; j < h; j++) if (filas[j][0] === "Seller") vendedor = filas[j][1];
    var movs = [], ordenes = {}, lista = [], cuenta = {};
    function v(f, k) { return k >= 0 ? f[k] : ""; }
    function ref(base) { cuenta[base] = (cuenta[base] || 0) + 1; return cuenta[base] > 1 ? base + "~" + cuenta[base] : base; }
    for (var r = h + 1; r < filas.length; r++) {
      var f = filas[r]; if (!f || f.length < 5) continue;
      var t = String(v(f, I.t)).trim(), fe = fecha(v(f, I.f)); if (!t || !fe) continue;
      var net = num(v(f, I.net)), o = String(v(f, I.o)).replace(/^--$/, ""), nombre = String(v(f, I.bn)).replace(/^--$/, "") || String(v(f, I.bu)).replace(/^--$/, "");
      var it = String(v(f, I.item)).replace(/^--$/, "").trim(), rid = String(v(f, I.ref)).replace(/^--$/, "").trim(), de = String(v(f, I.desc)).replace(/^--$/, "").trim();
      if (t === "Order") {
        var O = ordenes[o]; if (!O) { O = ordenes[o] = { fecha: fe, nombre: nombre, items: [], gross: null, net: null, fees: 0 }; lista.push(o); }
        var g = num(v(f, I.gross)); if (g != null) O.gross = (O.gross || 0) + g; if (net != null) O.net = (O.net || 0) + net;
        if (it) O.items.push(it.replace(/\s+/g, " "));
        FEES.forEach(function (k) { var x = num(f[k]); if (x) O.fees += x; });
        continue;
      }
      if (net == null) continue;
      var m = { fecha: fe, importe: -net, nombre: "eBay", desc: "", ref: "" };
      if (t === "Refund" || t === "Claim" || t === "Payment dispute") { m.tipo = "g"; m.cat = "reembolsos"; m.desc = "Reembolso · " + (it || nombre || o); m.ref = ref(rid || "rf:" + o); }
      else if (t === "Postage label") { m.tipo = "g"; m.cat = "envios"; m.desc = "Etiqueta de envío" + (de ? " · " + de : "") + (rid ? " · " + rid.replace("Tracking no. ", "") : ""); m.ref = ref(rid || "pl:" + o); }
      else if (t === "Other fee") { m.tipo = "g"; m.cat = /promoted/i.test(de) ? "publicidad" : "comisiones"; m.desc = (/promoted/i.test(de) ? "Anuncio promocionado" : de || "Comisión de eBay") + (o ? " · " + o : ""); m.ref = ref(rid || "fee:" + o + ":" + net); }
      else if (t === "Purchase") { m.tipo = "?"; m.cat = "repuestos"; m.desc = it || de || "Compra con saldo de eBay"; m.titulo = "Compra con saldo de eBay"; m.ref = ref("pu:" + o); }
      else if (/payout|transfer|hold|reserve|withheld/i.test(t)) { m.tipo = "x"; m.desc = /payout/i.test(t) ? "Pago a tu banco" + (String(f[col("Payout method")] || "").replace(/^--$/, "") ? " " + String(f[col("Payout method")]).replace(/\s*\*\d+$/, "") : "") : t; m.porque = /payout/i.test(t) ? "es tu propio dinero que pasa de eBay a tu banco, no es venta ni gasto" : "es dinero que eBay guarda o mueve, no es venta ni gasto"; m.ref = ref("x:" + t + ":" + fe + ":" + net); }
      else { m.tipo = "?"; m.cat = "comisiones"; m.desc = de || t; m.titulo = t + " de eBay"; m.ref = ref("o:" + t + ":" + (rid || fe + ":" + net)); }
      movs.push(m);
    }
    lista.forEach(function (o) {
      var O = ordenes[o], total = O.gross != null ? O.gross : O.net;
      if (total == null) return;
      var desc = O.items[0] ? O.items[0] + (O.items.length > 1 ? " + " + (O.items.length - 1) + " más" : "") : "Venta eBay";
      movs.push({ tipo: "i", cat: "ventas", fecha: O.fecha, importe: total, nombre: O.nombre || "eBay", desc: desc, ref: "o:" + o, num: "EBAY-" + o, pedido: o });
      if (O.fees) movs.push({ tipo: "g", cat: "comisiones", fecha: O.fecha, importe: -O.fees, nombre: "eBay", desc: "Comisión de venta · " + o, ref: "fv:" + o });
    });
    return { fuente: "ebay", nombre: "eBay", detalle: "informe de transacciones" + (vendedor ? " · " + vendedor : ""), movs: movs };
  }

  /* ---------- Etsy: Monthly statement ---------- */
  function leerEtsy(filas) {
    var cab = filas[0] || [];
    if (!(cab[0] === "Date" && cab.indexOf("Type") >= 0 && cab.indexOf("Title") >= 0 && cab.indexOf("Net") >= 0 && cab.indexOf("Fees & Taxes") >= 0)) return null;
    var I = { f: 0, t: cab.indexOf("Type"), ti: cab.indexOf("Title"), info: cab.indexOf("Info"), am: cab.indexOf("Amount"), net: cab.indexOf("Net") };
    var movs = [], ventas = {}, items = {}, impuestos = {}, cuenta = {};
    function ref(base) { cuenta[base] = (cuenta[base] || 0) + 1; return cuenta[base] > 1 ? base + "~" + cuenta[base] : base; }
    function pedido(s) { var m = /Order #(\d+)/.exec(s || ""); return m ? m[1] : ""; }
    for (var r = 1; r < filas.length; r++) {
      var f = filas[r]; if (!f || f.length < 5) continue;
      var fe = fecha(f[I.f]), t = String(f[I.t] || "").trim(), ti = String(f[I.ti] || "").trim(), info = String(f[I.info] || "").replace(/^--$/, "").trim(), net = num(f[I.net]);
      if (!fe || !t || net == null) continue;
      var o = pedido(ti) || pedido(info), base = fe + "|" + t + "|" + ti + "|" + info + "|" + net;
      if (t === "Sale") { ventas[o] = { fecha: fe, importe: net, ref: ref("s:" + o) }; continue; }
      if (t === "Tax") { impuestos[o] = (impuestos[o] || 0) + net; continue; }
      if (t === "Fee" && /^Transaction fee: /.test(ti) && !/Shipping$/.test(ti)) (items[o] = items[o] || []).push(ti.replace(/^Transaction fee: /, ""));
      var m = { fecha: fe, importe: -net, nombre: "Etsy", ref: ref(hash(base)) };
      if (t === "Refund") { m.tipo = "g"; m.cat = "reembolsos"; m.desc = "Reembolso" + (o ? " · pedido #" + o : ""); }
      else if (t === "Shipping" || t === "Shipping label" || /postage label/i.test(ti)) { m.tipo = "g"; m.cat = "envios"; m.desc = ti + (info ? " · " + info : ""); }
      else if (t === "Marketing" || /etsy ads|etsy plus|offsite ads/i.test(ti)) { m.iva = t === "VAT"; m.tipo = "g"; m.cat = "publicidad"; m.desc = ti.replace(/^VAT: /, "VAT de ") ; }
      else if (t === "VAT") { m.iva = true; m.tipo = "g"; m.cat = /label|postage/i.test(ti) ? "envios" : "comisiones"; m.desc = ti.replace(/^VAT: /, "VAT de ") + (o ? " · pedido #" + o : ""); }
      else if (t === "Fee") { m.tipo = "g"; m.cat = "comisiones"; m.desc = (/set-up/i.test(ti) ? "Alta de la tienda Etsy (una vez)" : ti) + (o ? " · pedido #" + o : ""); }
      else if (t === "Payment" || t === "Deposit" || /deposit/i.test(t)) { m.tipo = "x"; m.desc = t === "Payment" ? "Pago de tu factura de Etsy" : "Pago a tu banco"; m.porque = t === "Payment" ? "es dinero tuyo que entra para pagar comisiones (las comisiones ya se cuentan aparte)" : "es tu propio dinero que pasa de Etsy a tu banco"; }
      else { m.tipo = "?"; m.cat = "comisiones"; m.desc = ti; m.titulo = t + " de Etsy"; }
      movs.push(m);
    }
    var totalImp = 0;
    Object.keys(ventas).forEach(function (o) {
      var V = ventas[o], imp = impuestos[o] || 0; totalImp += imp;
      var it = items[o] || [];
      movs.push({ tipo: "i", cat: "ventas", fecha: V.fecha, importe: Math.round((V.importe + imp) * 100) / 100, nombre: "Etsy",
        desc: (it[0] ? it[0] + (it.length > 1 ? " + " + (it.length - 1) + " más" : "") : "Venta Etsy") + " · pedido #" + o, ref: V.ref, num: "ETSY-" + o });
    });
    if (totalImp) movs.push({ tipo: "x", fecha: movs.length ? movs[0].fecha : "", importe: -totalImp, desc: "Impuesto que pagó el comprador", porque: "lo cobra y lo paga Etsy; ya está restado de tus ventas", ref: "tax", soloInfo: true });
    return { fuente: "etsy", nombre: "Etsy", detalle: "estado de cuenta mensual", movs: movs };
  }

  /* ---------- cualquier otro archivo: la persona elige las columnas ---------- */
  function filaCab(filas) {
    for (var i = 0; i < Math.min(filas.length, 20); i++) {
      var f = filas[i] || [], llenas = f.filter(function (x) { return String(x == null ? "" : x).trim() !== ""; });
      if (llenas.length >= 2 && llenas.filter(function (x) { return typeof x === "string" && num(x) == null && !fecha(x); }).length >= Math.max(2, llenas.length * 0.6)) return i;
    }
    return 0;
  }
  function adivinar(cab) {
    function busca(re, no) { for (var i = 0; i < cab.length; i++) if (re.test(norm(cab[i])) && no.indexOf(i) < 0) return i; return -1; }
    var usadas = [], o = {};
    o.fecha = busca(/date|fecha|dia\b/, usadas); usadas.push(o.fecha);
    o.importe = busca(/amount|importe|valor|value|net|total|precio|price|cantidad £|paid/, usadas); usadas.push(o.importe);
    o.nombre = busca(/customer|cliente|buyer|comprador|payee|proveedor|merchant|name|nombre|counter/, usadas); usadas.push(o.nombre);
    o.desc = busca(/desc|item|concept|detalle|title|titulo|memo|reference|referencia|producto/, usadas); usadas.push(o.desc);
    o.tipoCol = busca(/^tipo|^type|entrada|in\/out/, usadas);
    o.catCol = busca(/categor/, usadas);
    o.modo = o.tipoCol >= 0 ? "columna" : "signo";
    return o;
  }
  function leerGenerico(filas, P, cats) {
    var h = P.cab, movs = [], cuenta = {};
    for (var r = h + 1; r < filas.length; r++) {
      var f = filas[r] || [];
      var fe = P.fecha >= 0 ? fecha(f[P.fecha]) : null, imp = P.importe >= 0 ? num(f[P.importe]) : null;
      if (!fe || imp == null || imp === 0) continue;
      var tipo;
      if (P.modo === "ingresos") tipo = "i"; else if (P.modo === "gastos") tipo = "g";
      else if (P.modo === "columna") tipo = /entrada|ingreso|income|credit|venta|sale|deposit|abono|^in$|cobro/i.test(norm(f[P.tipoCol])) ? "i" : "g";
      else tipo = imp > 0 ? "i" : "g";
      var nombre = P.nombre >= 0 ? String(f[P.nombre] == null ? "" : f[P.nombre]).trim() : "";
      var desc = P.desc >= 0 ? String(f[P.desc] == null ? "" : f[P.desc]).trim() : "";
      var cat = "";
      if (tipo === "g") {
        var vc = P.catCol >= 0 ? norm(f[P.catCol]) : "";
        cat = (vc && cats.filter(function (c) { return norm(c) === vc; })[0]) || P.catDefecto || cats[0] || "Otros gastos";
      }
      var base = fe + "|" + imp + "|" + nombre + "|" + desc; cuenta[base] = (cuenta[base] || 0) + 1;
      movs.push({ tipo: tipo, cat: tipo === "i" ? "ventas" : "=" + cat, fecha: fe, importe: P.modo === "signo" || tipo === "i" ? Math.abs(imp) : Math.abs(imp), nombre: nombre || (tipo === "i" ? "Varios clientes" : "Varios"), desc: desc, ref: hash(base) + (cuenta[base] > 1 ? "~" + cuenta[base] : "") });
    }
    return movs;
  }

  /* ---------- Excel: se sube un momento a Drive como hoja de Google, se lee y se borra ---------- */
  function leerExcel(file) {
    if (!conHoja()) return Promise.reject(new Error("Para leer archivos de Excel entra con Google. En el modo de ejemplo solo se pueden importar archivos CSV."));
    var tk;
    return C().token().then(function (t) {
      tk = t;
      var b = "pb" + Date.now(), meta = { name: "PuntoBalance · importando " + file.name, mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { puntobalance: "temporal" } };
      var cuerpo = new Blob(["--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + b + "\r\nContent-Type: " + (file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") + "\r\n\r\n", file, "\r\n--" + b + "--"]);
      return fetch(UP + "?uploadType=multipart&fields=id", { method: "POST", headers: { Authorization: "Bearer " + tk, "Content-Type": "multipart/related; boundary=" + b }, body: cuerpo });
    }).then(function (r) { if (!r.ok) throw new Error("Google no pudo abrir ese Excel (" + r.status + ")."); return r.json(); }).then(function (o) {
      var id = o.id;
      var borrar = function () { return fetch(DR + "/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + tk } }).catch(function () { }); };
      return C().api("GET", SH + id + "?fields=" + encodeURIComponent("sheets.properties.title")).then(function (s) {
        var tit = (s.sheets || []).map(function (x) { return x.properties.title; });
        var q = tit.map(function (t) { return "ranges=" + encodeURIComponent("'" + t.replace(/'/g, "''") + "'"); }).join("&");
        return C().api("GET", SH + id + "/values:batchGet?" + q + "&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER").then(function (v) {
          return (v.valueRanges || []).map(function (x, i) { return { titulo: tit[i], filas: x.values || [] }; });
        });
      }).then(function (r) { borrar(); return r; }, function (e) { borrar(); throw e; });
    });
  }

  /* ---------- guardar el archivo original en Drive › PuntoBalance › Importados ---------- */
  function carpetaImportados() {
    return window.pbDatos.carpetas().then(function (c) {
      var q = "appProperties has { key='puntobalance' and value='importados' } and mimeType='application/vnd.google-apps.folder' and trashed=false";
      return C().api("GET", DR + "?q=" + encodeURIComponent(q) + "&fields=files(id)").then(function (o) {
        if (o.files && o.files.length) return o.files[0].id;
        return C().api("POST", DR + "?fields=id", { name: "Importados", mimeType: "application/vnd.google-apps.folder", parents: [c.raiz], appProperties: { puntobalance: "importados" } }).then(function (x) { return x.id; });
      });
    });
  }
  function guardarOriginal(file) {
    return Promise.all([carpetaImportados(), C().token()]).then(function (r) {
      var b = "pb" + Date.now(), meta = { name: file.name, parents: [r[0]], appProperties: { puntobalance: "importado" } };
      var cuerpo = new Blob(["--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + b + "\r\nContent-Type: " + (file.type || "text/csv") + "\r\n\r\n", file, "\r\n--" + b + "--"]);
      return fetch(UP + "?uploadType=multipart&fields=id", { method: "POST", headers: { Authorization: "Bearer " + r[1], "Content-Type": "multipart/related; boundary=" + b }, body: cuerpo });
    }).then(function (r) { if (!r.ok) throw new Error("No se pudo guardar el archivo en tu Drive (" + r.status + ")."); });
  }

  /* ---------- estilos ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".v-imp{--ink:#151A2D;--muted:#6B7194;--line:#E6E8F1;height:100%;overflow:auto;padding:28px 30px 40px;color:var(--ink)}" +
    ".v-imp .hidden{display:none!important}" +
    ".v-imp h1{margin:0;font-size:26px;letter-spacing:-.02em;font-weight:700}.v-imp .lead{margin:4px 0 14px;color:var(--muted);font-size:13.5px}" +
    ".v-imp .steps{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.v-imp .st{padding:6px 14px;border-radius:99px;background:#E9EDF6;color:var(--muted);font-size:12.5px;font-weight:700}" +
    ".v-imp .st.ok{background:#E3F6EA;color:#12804A}.v-imp .st.on{background:#1B2B5B;color:#fff}" +
    ".v-imp .grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:16px;align-items:start}" +
    ".v-imp .card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px;margin-bottom:16px}" +
    ".v-imp .lab{font-size:11px;font-weight:700;letter-spacing:.06em;color:#4B5570;text-transform:uppercase;margin-bottom:6px}" +
    ".v-imp .file{display:flex;align-items:center;gap:14px;border:1.5px dashed #B9C3DA;border-radius:14px;padding:12px 14px;background:#F7F9FD;flex-wrap:wrap}" +
    ".v-imp .file .ic{font-size:28px}.v-imp .file .tx{flex:1;min-width:180px}.v-imp .file b{display:block;font-size:14px;word-break:break-all}" +
    ".v-imp .okt{color:#12804A;font-size:13px;font-weight:700}.v-imp .wt{color:#A24B0B;font-size:13px;font-weight:700}" +
    ".v-imp .drop{border:2px dashed #B9C3DA;border-radius:18px;background:#F7F9FD;padding:30px 20px;text-align:center;cursor:pointer}.v-imp .drop.sobre{border-color:#1E60E0;background:#EEF4FF}" +
    ".v-imp .drop .big{font-size:40px}.v-imp .drop b{display:block;font-size:17px;margin:6px 0 4px}.v-imp .drop small{color:var(--muted);font-size:12.5px}" +
    ".v-imp .btn{border:1px solid #D5DBE8;background:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-weight:700;font-size:13px;color:var(--ink);cursor:pointer}" +
    ".v-imp .btn.p{background:#1E60E0;border-color:#1E60E0;color:#fff}.v-imp .btn:disabled{opacity:.5;cursor:default}" +
    ".v-imp .pri{width:100%;padding:13px;font-size:15px;border-radius:12px;margin-top:12px}" +
    ".v-imp .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:12px}" +
    ".v-imp select{width:100%;border:1px solid #D5DBE8;border-radius:10px;padding:9px 10px;font:inherit;font-size:13.5px;background:#fff;color:var(--ink)}" +
    ".v-imp .chips span{display:inline-block;font-size:12px;padding:4px 10px;border-radius:99px;margin:3px 4px 0 0;background:#EEF1F7;color:#4B5570}.v-imp .chips span.y{background:#E3F6EA;color:#12804A;font-weight:700}" +
    ".v-imp .modo{display:flex;gap:10px;flex-wrap:wrap}.v-imp .modo label{flex:1;min-width:220px;border:1.5px solid #D5DBE8;border-radius:12px;padding:10px 14px;cursor:pointer}" +
    ".v-imp .modo label:has(input:checked){border:2px solid #1E60E0;background:#EEF4FF}.v-imp .modo input{accent-color:#1E60E0}.v-imp .modo small{display:block;color:var(--muted);font-size:12px;margin-top:2px}" +
    ".v-imp .rec{display:inline-block;font-size:10.5px;font-weight:800;background:#1E60E0;color:#fff;border-radius:99px;padding:2px 8px;margin-left:4px}" +
    ".v-imp .chk{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px;color:#4B5570}.v-imp .chk input{accent-color:#1E60E0;width:16px;height:16px}" +
    ".v-imp .rs{position:sticky;top:0}.v-imp .rs .l{display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:6px 0;color:#4B5570}.v-imp .rs .l b{color:var(--ink);text-align:right}" +
    ".v-imp .g{color:#12804A!important}.v-imp .r{color:#D4351C!important}.v-imp .rs hr{border:0;border-top:1px dashed #D5DBE8;margin:8px 0}" +
    ".v-imp .q{background:#FFF8E6;border:1px solid #F4D48A;border-radius:18px;padding:16px 18px;margin-bottom:16px}.v-imp .q h3{margin:0 0 4px;font-size:16px}.v-imp .q p{margin:0 0 10px;color:#6B5A2A;font-size:13px}" +
    ".v-imp .qi{display:grid;grid-template-columns:80px minmax(0,1fr) 80px 190px auto auto;gap:10px;align-items:center;background:#fff;border-radius:12px;padding:10px 12px;font-size:14px;margin-top:8px}" +
    ".v-imp .qi small{display:block;color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v-imp .qi .btn.si[aria-pressed=true]{background:#12804A;border-color:#12804A;color:#fff}.v-imp .qi .btn.no[aria-pressed=true]{background:#6B7194;border-color:#6B7194;color:#fff}" +
    ".v-imp .tw{overflow:auto}.v-imp table{width:100%;border-collapse:collapse;font-size:13px}" +
    ".v-imp th{background:#1B2B5B;color:#fff;text-align:left;padding:8px 10px;font-weight:600;white-space:nowrap}.v-imp th:first-child{border-radius:8px 0 0 0}.v-imp th:last-child{border-radius:0 8px 0 0}" +
    ".v-imp td{padding:7px 10px;border-bottom:1px solid #EDF0F6}.v-imp tr:nth-child(even) td{background:#F8F9FC}.v-imp .num{text-align:right;white-space:nowrap}" +
    ".v-imp .tag{font-size:11px;padding:2px 8px;border-radius:99px;font-weight:700;white-space:nowrap}.v-imp .ti{background:#E3F6EA;color:#12804A}.v-imp .tg{background:#FBE0E0;color:#A11D1D}.v-imp .tc{background:#ECE6FB;color:#5B3BB5}" +
    ".v-imp .h{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}.v-imp .h b{font-size:16px}" +
    ".v-imp .more{color:var(--muted);font-size:12px;margin-top:6px}.v-imp .nc{background:#F1F3F8;border-radius:12px;padding:10px 12px;font-size:13px;color:#4B5570;margin-top:10px}" +
    ".v-imp .aviso{background:#FEF3DC;color:#7A4A06;border-radius:12px;padding:10px 12px;font-size:13px;margin-top:10px}.v-imp .err{color:#D92D20;font-size:13px;font-weight:600;margin-top:8px}" +
    ".v-imp .cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px}.v-imp .cats label{font-size:12px;color:#4B5570;font-weight:700}" +
    ".v-imp .fin{text-align:center;padding:26px 18px}.v-imp .fin .big{font-size:48px}.v-imp .fin h2{margin:6px 0 4px}.v-imp .fin p{color:var(--muted);margin:4px 0}" +
    "@media (max-width:1000px){.v-imp .grid{grid-template-columns:minmax(0,1fr)}.v-imp .rs{position:static}.v-imp .qi{display:flex;flex-wrap:wrap}.v-imp .qi>span:nth-child(2){flex:1;min-width:0}.v-imp .qi select{flex:1 1 100%}.v-imp .qi .btn{flex:1}}" +
    "@media (max-width:760px){.v-imp{padding:18px 14px 100px}.v-imp .modo label{min-width:0;flex:1 1 100%}.v-imp .file .tx{min-width:0}.v-imp .card{padding:14px}}";
  document.head.appendChild(css);

  var TPL = '<div class="v-imp">' +
    '<h1>Importar movimientos</h1><div class="lead" id="im-lead">Trae tus ventas y gastos de eBay, de Etsy o de otro archivo. <b>No se guarda nada hasta que tú pulses «Añadir».</b></div>' +
    '<div class="steps" id="im-steps"></div>' +
    /* paso 1 */
    '<div id="im-p1"><div class="card"><div class="drop" id="im-drop"><div class="big">📂</div><b>Elige el archivo</b><small>CSV o Excel. También puedes arrastrarlo aquí.</small><br><br>' +
    '<button type="button" class="btn p" id="im-elegir">Elegir archivo</button></div><input type="file" id="im-file" accept=".csv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv" class="hidden">' +
    '<div class="row"><div><div class="lab">La app reconoce sola</div><div class="chips"><span class="y">eBay ✓</span><span class="y">Etsy ✓</span><span>Vinted · pronto</span><span>PayPal · pronto</span><span>Banco · pronto</span><span>Otro archivo → eliges columnas</span></div></div></div>' +
    '<div class="nc" style="margin-top:14px">💡 <b>eBay:</b> Seller Hub › Payments › Reports › <i>Transaction report</i> (CSV).<br>💡 <b>Etsy:</b> Shop Manager › Finances › Monthly statements › <i>Generate CSV</i>.</div>' +
    '<div class="err" id="im-e1"></div></div></div>' +
    /* paso 2 */
    '<div id="im-p2" class="hidden"><div class="grid"><div>' +
    '<div class="card"><div class="lab">Archivo</div><div class="file"><div class="ic">📄</div><div class="tx"><b id="im-fnom"></b><span id="im-fok"></span></div><button type="button" class="btn" id="im-otro">Cambiar archivo</button></div>' +
    '<div class="row"><div id="im-negw"><div class="lab">¿De qué negocio?</div><select id="im-neg"></select></div><div id="im-pestw" class="hidden"><div class="lab">Pestaña del Excel</div><select id="im-pest"></select></div></div></div>' +
    '<div class="card hidden" id="im-map"></div>' +
    '<div id="im-rev">' +
    '<div class="card"><div class="lab">¿Cómo lo añadimos?</div><div class="modo">' +
    '<label><input type="radio" name="im-modo" value="r"> <b>Resumen del mes</b> <span class="rec">recomendado</span><small>1 ingreso con el total de ventas + 1 gasto por cada tipo, por mes.</small></label>' +
    '<label><input type="radio" name="im-modo" value="d"> <b>Cada movimiento por separado</b><small>Una línea por cada venta y cada comisión (más detalle, más filas).</small></label></div>' +
    '<label class="chk" id="im-guardw"><input type="checkbox" id="im-guard" checked> <span><b>Guardar el archivo en tu Drive</b> (PuntoBalance › Importados) como comprobante</span></label></div>' +
    '<div class="q hidden" id="im-q"></div>' +
    '</div></div>' +
    '<div class="card rs" id="im-rs"></div></div>' +
    '<div class="card" id="im-tab"></div></div>' +
    /* paso 3 */
    '<div id="im-p3" class="hidden"><div class="card fin" id="im-fin"></div></div>' +
    '</div>';

  function init(ROOT) {
    function $(id) { return ROOT.querySelector("#" + id); }
    var INFO = null, A = null;   // A: el archivo que se está revisando
    var vivo = true;
    function pasos(n, generico) {
      var l = generico ? ["Elige el archivo", "¿Qué es cada columna?", "Revisa", "Listo"] : ["Elige el archivo", "Revisa", "Listo"];
      var k = !generico ? n : n === 1 ? 1 : n === 3 ? 4 : (A && A.mapaListo ? 3 : 2);
      $("im-steps").innerHTML = l.map(function (t, i) { return '<span class="st ' + (i + 1 < k ? "ok" : i + 1 === k ? "on" : "") + '">' + (i + 1 < k ? "✓ " : "") + (i + 1) + " · " + t + "</span>"; }).join("");
    }
    function cargarInfo() { return srv("getImportarInfo").then(function (i) { INFO = i; return i; }); }
    function ver(n) { ["im-p1", "im-p2", "im-p3"].forEach(function (id, i) { $(id).classList.toggle("hidden", i + 1 !== n); }); ROOT.scrollTop = 0; }
    pasos(1); ver(1);
    cargarInfo().catch(function (e) { $("im-e1").textContent = "No se pudo leer tu hoja: " + e.message; });

    /* --- elegir archivo --- */
    $("im-elegir").onclick = function (e) { e.stopPropagation(); $("im-file").click(); };
    $("im-drop").onclick = function () { $("im-file").click(); };
    $("im-drop").ondragover = function (e) { e.preventDefault(); this.classList.add("sobre"); };
    $("im-drop").ondragleave = function () { this.classList.remove("sobre"); };
    $("im-drop").ondrop = function (e) { e.preventDefault(); this.classList.remove("sobre"); if (e.dataTransfer.files[0]) abrir(e.dataTransfer.files[0]); };
    $("im-file").onchange = function () { if (this.files[0]) abrir(this.files[0]); this.value = ""; };
    $("im-otro").onclick = function () { A = null; pasos(1); ver(1); $("im-e1").textContent = ""; };

    function abrir(file) {
      $("im-e1").textContent = "";
      var esCsv = /\.(csv|txt)$/i.test(file.name) || /csv|text\/plain/.test(file.type);
      var dev = esCsv ? file.text().then(function (t) { return [{ titulo: "", filas: csvFilas(t) }]; }) : leerExcel(file);
      $("im-elegir").disabled = true; $("im-elegir").textContent = "Leyendo…";
      Promise.all([dev, INFO ? Promise.resolve(INFO) : cargarInfo()]).then(function (r) {
        $("im-elegir").disabled = false; $("im-elegir").textContent = "Elegir archivo";
        if (!vivo) return;
        var hojas = r[0].filter(function (h) { return h.filas.length; });
        if (!hojas.length) throw new Error("El archivo está vacío.");
        hojas.sort(function (a, b) { return b.filas.length - a.filas.length; });
        preparar(file, hojas);
      }).catch(function (e) { $("im-elegir").disabled = false; $("im-elegir").textContent = "Elegir archivo"; $("im-e1").textContent = e.message; });
    }

    function preparar(file, hojas) {
      A = { file: file, hojas: hojas, hoja: 0, decide: {}, catMap: {} };
      var filas = hojas[0].filas, P = leerEbay(filas) || leerEtsy(filas);
      $("im-fnom").textContent = file.name;
      var negs = INFO.negocios, act = ""; try { act = localStorage.getItem("pb_negocio") || ""; } catch (e) { }
      $("im-neg").innerHTML = negs.map(function (n) { return '<option value="' + esc(n.id) + '"' + (n.id === act ? " selected" : "") + ">" + esc(n.nombre) + "</option>"; }).join("");
      $("im-negw").classList.toggle("hidden", negs.length < 2);
      $("im-guardw").classList.toggle("hidden", !conHoja());
      $("im-pestw").classList.toggle("hidden", hojas.length < 2 || !!P);
      $("im-pest").innerHTML = hojas.map(function (h, i) { return '<option value="' + i + '">' + esc(h.titulo) + " (" + h.filas.length + " filas)</option>"; }).join("");
      $("im-pest").onchange = function () { A.hoja = Number(this.value); A.mapa = null; mapear(); };
      if (P) {
        A.P = P; A.generico = false;
        $("im-fok").className = "okt"; $("im-fok").textContent = "✅ Reconocido: " + P.nombre + " · " + P.detalle + rangoTxt(P.movs);
        $("im-map").classList.add("hidden"); $("im-rev").classList.remove("hidden"); $("im-tab").classList.remove("hidden"); $("im-rs").classList.remove("hidden");
        var pl = (INFO.plantillas || {})["fuente:" + P.fuente] || {};
        A.catMap = pl.cats || {};
        modoInicial(pl.modo || "r");
        pasos(2); ver(2); pintar();
      } else {
        A.generico = true;
        $("im-fok").className = "wt"; $("im-fok").textContent = "🔎 Archivo nuevo · elige las columnas abajo";
        mapear(); ver(2);
      }
    }
    function rangoTxt(movs) {
      var f = movs.map(function (m) { return m.fecha; }).filter(Boolean).sort();
      if (!f.length) return "";
      var a = f[0], b = f[f.length - 1];
      return " · " + Number(a.slice(8)) + " " + MESES[Number(a.slice(5, 7)) - 1] + (a.slice(0, 4) !== b.slice(0, 4) ? " " + a.slice(0, 4) : "") + " – " + Number(b.slice(8)) + " " + MESES[Number(b.slice(5, 7)) - 1] + " " + b.slice(0, 4);
    }
    function modoInicial(m) { ROOT.querySelectorAll('input[name="im-modo"]').forEach(function (x) { x.checked = x.value === m; x.onchange = pintar; }); }
    function modo() { var x = ROOT.querySelector('input[name="im-modo"]:checked'); return x ? x.value : "r"; }
    $("im-neg").onchange = function () { if (A) pintar(); };

    /* --- otro archivo: elegir columnas --- */
    function mapear() {
      var filas = A.hojas[A.hoja].filas, h = filaCab(filas), cab = filas[h] || [];
      var firma = "gen:" + hash(cab.map(norm).join("|"));
      var guardada = (INFO.plantillas || {})[firma];
      var M = A.mapa || (guardada ? Object.assign({}, guardada) : Object.assign(adivinar(cab), { catDefecto: INFO.categorias[0] || "" }));
      M.cab = h; A.mapa = M; A.firma = firma;
      var letra = function (i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
      var ncol = Math.max.apply(null, filas.slice(h, h + 30).map(function (f) { return (f || []).length; }).concat([cab.length]));
      var opts = function (sel, ninguna) {
        var o = ninguna ? '<option value="-1">' + ninguna + "</option>" : "";
        for (var i = 0; i < ncol; i++) o += '<option value="' + i + '"' + (Number(sel) === i ? " selected" : "") + ">Columna " + letra(i) + (cab[i] != null && String(cab[i]).trim() ? " · «" + esc(String(cab[i]).slice(0, 24)) + "»" : "") + "</option>";
        return o;
      };
      var cats = INFO.categorias.map(function (c) { return '<option' + (c === M.catDefecto ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
      $("im-map").classList.remove("hidden");
      $("im-map").innerHTML = (guardada ? '<div class="okt" style="margin-bottom:8px">✓ Ya conozco este archivo: usé las columnas que elegiste la otra vez.</div>' : "") +
        '<div class="lab" style="margin-bottom:0">¿Qué es cada columna?</div>' +
        '<div class="row"><div><div class="lab">Fecha</div><select data-m="fecha">' + opts(M.fecha) + "</select></div>" +
        '<div><div class="lab">Cliente o proveedor</div><select data-m="nombre">' + opts(M.nombre, "— no hay —") + "</select></div>" +
        '<div><div class="lab">Descripción</div><select data-m="desc">' + opts(M.desc, "— no hay —") + "</select></div>" +
        '<div><div class="lab">Importe (£)</div><select data-m="importe">' + opts(M.importe) + "</select></div></div>" +
        '<div class="row"><div style="grid-column:span 2"><div class="lab">¿Cómo sé si es ingreso o gasto?</div><select data-m="modo">' +
        [["signo", "Positivo = ingreso · negativo = gasto"], ["columna", "Lo dice una columna (Entrada / Salida…)"], ["ingresos", "Todo son ingresos"], ["gastos", "Todo son gastos"]].map(function (x) { return '<option value="' + x[0] + '"' + (M.modo === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select></div>" +
        '<div class="' + (M.modo === "columna" ? "" : "hidden") + '"><div class="lab">Columna del tipo</div><select data-m="tipoCol">' + opts(M.tipoCol) + "</select></div>" +
        '<div><div class="lab">Categoría de los gastos</div><select data-m="catDefecto">' + cats + "</select></div>" +
        '<div><div class="lab">Columna de categoría</div><select data-m="catCol">' + opts(M.catCol, "— no hay —") + "</select></div></div>" +
        '<label class="chk"><input type="checkbox" id="im-recordar" checked> <span><b>Recordar estas columnas</b> para la próxima vez</span></label>' +
        '<div class="h" style="margin-top:14px"><b>Primeras filas del archivo</b><small style="color:#6B7194">así lo entiende la app</small></div><div class="tw" id="im-prev"></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button type="button" class="btn p' + (A.mapaListo ? " hidden" : "") + '" id="im-sig">Siguiente: revisar ›</button></div>';
      $("im-map").querySelectorAll("[data-m]").forEach(function (s) {
        s.onchange = function () {
          var k = s.dataset.m; M[k] = k === "modo" || k === "catDefecto" ? s.value : Number(s.value);
          if (k === "modo") { mapear(); return; }
          vistaPrevia(); if (A.mapaListo) pintar();
        };
      });
      $("im-sig").onclick = function () {
        if (M.fecha < 0 || M.importe < 0) return;
        A.mapaListo = true; this.classList.add("hidden"); $("im-rev").classList.remove("hidden"); $("im-tab").classList.remove("hidden"); $("im-rs").classList.remove("hidden");
        modoInicial(modo() || "d"); pasos(2, true); pintar();
        $("im-rev").scrollIntoView({ behavior: "smooth", block: "start" });
      };
      if (!A.mapaListo) { $("im-rev").classList.add("hidden"); $("im-tab").classList.add("hidden"); $("im-rs").classList.add("hidden"); modoInicial("d"); }
      pasos(2, true); vistaPrevia();
    }
    function vistaPrevia() {
      var M = A.mapa, filas = A.hojas[A.hoja].filas, cab = filas[M.cab] || [];
      var movs = leerGenerico(filas, M, INFO.categorias);
      A.P = { fuente: A.firma, nombre: "Archivo", detalle: "", movs: movs };
      var cols = [M.fecha, M.nombre, M.desc, M.importe].filter(function (x) { return x >= 0; });
      var datos = filas.slice(M.cab + 1).filter(function (f) { return f && f.some(function (x) { return String(x == null ? "" : x).trim() !== ""; }); }).slice(0, 5);
      $("im-prev").innerHTML = "<table><tr>" + cols.map(function (i) { return "<th>" + esc(cab[i] == null ? "" : cab[i]) + "</th>"; }).join("") + "<th>→ Será</th></tr>" +
        datos.map(function (f) {
          var fe = fecha(f[M.fecha]), imp = num(f[M.importe]), t = "";
          if (!fe || imp == null) t = '<span class="tag tc">Se salta</span>';
          else { var m = leerGenerico([cab, f], Object.assign({}, M, { cab: 0 }), INFO.categorias)[0]; t = m ? (m.tipo === "i" ? '<span class="tag ti">Ingreso</span>' : '<span class="tag tg">Gasto</span>') : ""; }
          return "<tr>" + cols.map(function (i) { var v = f[i]; if (i === M.fecha && fe) v = fechaCorta(fe); return '<td class="' + (i === M.importe ? "num" : "") + '">' + esc(v == null ? "" : v) + "</td>"; }).join("") + "<td>" + t + "</td></tr>";
        }).join("") + "</table>" + '<div class="more">Se leyeron ' + movs.length + " movimientos con fecha e importe.</div>";
    }

    /* --- calcular lo que se va a añadir --- */
    function catNombre(k) {
      if (k.charAt(0) === "=") return k.slice(1);
      return A.catMap[k] || catSugerida(k, INFO.categorias);
    }
    function calcular() {
      var P = A.P, m = modo(), F = P.fuente, claves = {}, mesYa = {};
      INFO.claves.forEach(function (k) { claves[k] = 1; var p = k.split("|"); if (p.length >= 3) mesYa[p[0] + "|" + p[1]] = mesYa[p[0] + "|" + p[1]] || (p[2].slice(0, 2) === "r:" ? "r" : "d"); });
      var out = [], decide = [], noCuenta = [], saltados = {}, repetidos = 0;
      P.movs.forEach(function (x, i) {
        if (x.tipo === "x") { noCuenta.push(x); return; }
        var mes = mesDe(x.fecha), ya = mesYa[F + "|" + mes];
        if (ya && (m === "r" || ya === "r")) { saltados[mes] = 1; return; }
        if (x.tipo === "?") { x.id = x.id || "q" + i; decide.push(x); }
      });
      var usar = P.movs.filter(function (x) {
        if (x.tipo === "x") return false;
        var mes = mesDe(x.fecha); if (saltados[mes]) return false;
        if (x.tipo === "?") { var d = A.decide[x.id]; return d && d.si; }
        return true;
      });
      if (m === "d") {
        usar.forEach(function (x) {
          var k = F + "|" + mesDe(x.fecha) + "|d:" + x.ref;
          if (claves[k]) { repetidos++; return; }
          var esI = x.tipo === "i", cat = x.tipo === "?" ? A.decide[x.id].cat : catNombre(x.cat);
          out.push({ t: esI ? "i" : "g", f: x.fecha, n: x.nombre, d: x.desc, c: esI ? "" : cat, p: Math.round(x.importe * 100) / 100, k: k, num: x.num || "", cuenta: 1 });
        });
      } else {
        var grupos = {}, orden = [];
        usar.forEach(function (x) {
          var mes = mesDe(x.fecha);
          if (x.tipo === "?") {   // lo que decidió la persona va aparte, con su descripción
            out.push({ t: "g", f: x.fecha, n: x.nombre, d: x.desc, c: A.decide[x.id].cat, p: Math.round(x.importe * 100) / 100, k: F + "|" + mes + "|d:" + x.ref, cuenta: 1 });
            return;
          }
          var cat = x.tipo === "i" ? "ventas" : catNombre(x.cat), clave = mes + "|" + x.tipo + "|" + cat;
          var G = grupos[clave];
          if (!G) { G = grupos[clave] = { t: x.tipo, mes: mes, f: x.fecha, c: x.tipo === "i" ? "" : cat, p: 0, cuenta: 0, tipos: {} }; orden.push(clave); }
          G.p += x.importe; if (!x.iva) G.cuenta++; if (x.fecha > G.f) G.f = x.fecha; G.tipos[x.cat] = 1;
        });
        orden.forEach(function (clave) {
          var G = grupos[clave], nom = P.nombre === "Archivo" ? (G.t === "i" ? "Varios clientes" : "Varios") : P.nombre;
          var txt = G.t === "i" ? "Ventas " + (P.nombre === "Archivo" ? "" : P.nombre + " ") : (Object.keys(G.tipos).length === 1 && TIPOS[Object.keys(G.tipos)[0]] ? TIPOS[Object.keys(G.tipos)[0]].txt + " " + (P.nombre === "Archivo" ? "" : P.nombre + " ") : G.c + " ");
          out.push({ t: G.t, f: G.f, n: nom, d: txt.trim() + " · " + mesTxt(G.mes) + " (" + G.cuenta + ")", c: G.c, p: Math.round(G.p * 100) / 100,
            k: F + "|" + G.mes + "|r:" + (G.t === "i" ? "ventas" : norm(G.c)), num: G.t === "i" ? (P.nombre === "Archivo" ? "" : P.nombre.toUpperCase() + "-" + G.mes) : "", cuenta: G.cuenta });
        });
      }
      out = out.filter(function (x) { return x.p !== 0; });
      out.sort(function (a, b) { var ma = mesDe(a.f), mb = mesDe(b.f); if (ma !== mb) return ma < mb ? -1 : 1; if (a.t !== b.t) return a.t === "i" ? -1 : 1; return m === "r" ? b.p - a.p : (a.f < b.f ? -1 : a.f > b.f ? 1 : 0); });
      return { filas: out, decide: decide, noCuenta: noCuenta, saltados: Object.keys(saltados).sort(), repetidos: repetidos };
    }

    /* --- pintar la revisión --- */
    function pintar() {
      if (!A || !A.P) return;
      var R = calcular(); A.R = R;
      var ing = R.filas.filter(function (x) { return x.t === "i"; }), gas = R.filas.filter(function (x) { return x.t === "g"; });
      var tI = ing.reduce(function (s, x) { return s + x.p; }, 0), tG = gas.reduce(function (s, x) { return s + x.p; }, 0);
      var falta = R.decide.filter(function (x) { return !A.decide[x.id]; }).length;
      var unMes = {}; R.filas.forEach(function (x) { unMes[mesDe(x.f)] = 1; }); var nm = Object.keys(unMes).length;
      /* Decide tú */
      var q = $("im-q");
      if (R.decide.length) {
        q.classList.remove("hidden");
        q.innerHTML = "<h3>❓ Decide tú (" + R.decide.length + ")</h3><p>Esto no está claro si es del negocio. Elige si lo añadimos como gasto.</p>" + R.decide.map(function (x) {
          var d = A.decide[x.id] || {}, cat = d.cat || catSugeridaDecide(x);
          return '<div class="qi" data-q="' + x.id + '"><span>' + fechaCorta(x.fecha) + "</span><span><b>" + esc(x.titulo || "Movimiento") + "</b><small>" + esc(x.desc) + '</small></span><span class="num"><b>' + libras(x.importe) + "</b></span>" +
            '<select data-qc>' + opcionesCat(cat) + "</select>" +
            '<button type="button" class="btn si" aria-pressed="' + (d.si === true) + '">✓ Sí, del negocio</button><button type="button" class="btn no" aria-pressed="' + (d.si === false) + '">✕ No, es personal</button></div>';
        }).join("");
        q.querySelectorAll("[data-q]").forEach(function (fila) {
          var id = fila.dataset.q, sel = fila.querySelector("[data-qc]");
          var poner = function (si) { A.decide[id] = { si: si, cat: sel.value }; pintar(); };
          fila.querySelector(".si").onclick = function () { poner(true); };
          fila.querySelector(".no").onclick = function () { poner(false); };
          sel.onchange = function () { if (A.decide[id]) { A.decide[id].cat = sel.value; pintar(); } };
        });
      } else q.classList.add("hidden");
      /* Resumen */
      $("im-rs").innerHTML = '<div class="lab">Resumen</div>' +
        '<div class="l">Ingresos<b class="g">' + ing.length + " · " + libras(tI) + "</b></div>" +
        '<div class="l">Gastos<b class="r">' + gas.length + " · " + libras(tG) + "</b></div>" +
        (R.decide.length ? '<div class="l">Por decidir<b>' + falta + "</b></div>" : "") +
        '<div class="l">' + (modo() === "r" ? "Mes ya importado" : "Ya estaban (no se repiten)") + "<b>" + (modo() === "r" ? (R.saltados.length ? R.saltados.map(mesTxt).join(", ") : "No") : R.repetidos + R.saltados.length) + "</b></div>" +
        '<div class="l">No se cuenta<b>' + R.noCuenta.filter(function (x) { return !x.soloInfo; }).length + "</b></div>" +
        '<hr><div class="l"><span>Beneficio' + (nm === 1 ? " del mes" : "") + '</span><b class="' + (tI - tG >= 0 ? "g" : "r") + '" style="font-size:20px">' + libras(tI - tG) + "</b></div>" +
        '<button type="button" class="btn p pri" id="im-add"' + (falta || !R.filas.length ? " disabled" : "") + ">" + (falta ? "Primero decide " + falta + " ↑" : R.filas.length ? "Añadir " + R.filas.length + " movimiento" + (R.filas.length === 1 ? "" : "s") : "No hay nada nuevo") + "</button>" +
        '<button type="button" class="btn" style="width:100%;margin-top:8px;padding:10px" id="im-can">Cancelar</button>' +
        '<div style="font-size:12px;color:#6B7194;margin-top:10px">' + (conHoja() ? "Antes de añadir se hace una copia de seguridad." : "Modo de ejemplo: los datos no se guardan en ningún sitio.") + '</div><div class="err" id="im-e2"></div>';
      $("im-add").onclick = anadir;
      $("im-can").onclick = function () { A = null; pasos(1); ver(1); };
      /* Tabla y categorías */
      var tiposG = {};
      if (!A.generico) A.P.movs.forEach(function (x) { if (x.tipo === "g") tiposG[x.cat] = 1; });
      var catsHtml = Object.keys(tiposG).map(function (k) {
        return '<div><label>' + esc(TIPOS[k] ? TIPOS[k].txt : k) + ' →</label><select data-cat="' + k + '">' + opcionesCat(catNombre(k)) + "</select></div>";
      }).join("");
      var MAX = 60, vis = R.filas.slice(0, MAX);
      $("im-tab").innerHTML = '<div class="h"><b>Así quedará en tu hoja</b><small style="color:#6B7194">' + (modo() === "r" ? "1 línea por cada tipo, por mes" : "1 línea por cada movimiento") + "</small></div>" +
        (catsHtml ? '<div class="lab">Categoría de cada tipo de gasto</div><div class="cats">' + catsHtml + "</div>" : "") +
        (R.filas.length ? '<div class="tw"><table><tr><th>Tipo</th><th>Fecha</th><th>Cliente / Proveedor</th><th>Descripción</th><th>Categoría</th><th class="num">Total</th></tr>' +
          vis.map(function (x) {
            return "<tr><td>" + (x.t === "i" ? '<span class="tag ti">Ingreso</span>' : '<span class="tag tg">Gasto</span>') + "</td><td>" + fechaCorta(x.f) + "</td><td>" + esc(x.n) + "</td><td>" + esc(x.d) + "</td><td>" +
              (x.c ? '<span class="tag tc">' + esc(x.c) + (INFO.categorias.indexOf(x.c) < 0 ? " · nueva" : "") + "</span>" : "—") + '</td><td class="num"><b>' + libras(x.p) + "</b></td></tr>";
          }).join("") + "</table></div>" + (R.filas.length > MAX ? '<div class="more">… y ' + (R.filas.length - MAX) + " más</div>" : "") : '<div class="nc">No hay movimientos nuevos para añadir.</div>') +
        (modo() === "r" ? '<div class="more">Si el archivo trae varios meses, sale un grupo igual por cada mes. Si un mes ya se importó, la app avisa y no lo repite.</div>' : "") +
        (R.saltados.length ? '<div class="aviso">⚠️ <b>' + R.saltados.map(mesTxt).join(", ") + "</b> ya se " + (R.saltados.length > 1 ? "importaron" : "importó") + " antes: no se repite" + (R.saltados.length > 1 ? "n" : "") + ".</div>" : "") +
        R.noCuenta.map(function (x) { return '<div class="nc">🚫 <b>No se cuenta:</b> ' + esc(x.desc) + " · " + libras(Math.abs(x.importe)) + " — " + esc(x.porque || "") + ".</div>"; }).join("");
      $("im-tab").querySelectorAll("[data-cat]").forEach(function (s) { s.onchange = function () { A.catMap[s.dataset.cat] = s.value; pintar(); }; });
    }
    function catSugeridaDecide(x) { return catSugerida(x.cat, INFO.categorias); }
    function opcionesCat(sel) {
      var l = INFO.categorias.slice(); if (sel && l.indexOf(sel) < 0) l.unshift(sel);
      return l.map(function (c) { return '<option value="' + esc(c) + '"' + (c === sel ? " selected" : "") + ">" + esc(c) + (INFO.categorias.indexOf(c) < 0 ? " (nueva)" : "") + "</option>"; }).join("");
    }

    /* --- añadir --- */
    function anadir() {
      var R = A.R, b = $("im-add"), err = $("im-e2"); if (!R || !R.filas.length) return;
      b.disabled = true; err.textContent = "";
      var pasoTxt = function (t) { b.textContent = t; };
      var plantilla = null;
      if (A.generico) { if ($("im-recordar") && $("im-recordar").checked) { var M = Object.assign({}, A.mapa); delete M.cab; plantilla = { id: A.firma, datos: M }; } }
      else plantilla = { id: "fuente:" + A.P.fuente, datos: { modo: modo(), cats: A.catMap } };
      var filas = R.filas.map(function (x) { return { t: x.t, f: x.f, n: x.n, d: x.d, c: x.c, p: x.p, k: x.k, num: x.num }; });
      var cadena = Promise.resolve();
      if (conHoja() && $("im-guard").checked) cadena = cadena.then(function () { pasoTxt("Guardando el archivo en tu Drive…"); return guardarOriginal(A.file).catch(function () { }); });
      if (conHoja() && window.pbDatos) cadena = cadena.then(function () { pasoTxt("Haciendo la copia…"); return window.pbDatos.copiar(); });
      cadena.then(function () { pasoTxt("Añadiendo…"); return srv("guardarMovimientosImportados", { negocio: $("im-neg").value, filas: filas, plantilla: plantilla }); }).then(function (r) {
        if (!vivo) return;
        cargarInfo().catch(function () { });
        pasos(3, A.generico); ver(3);
        $("im-fin").innerHTML = '<div class="big">✅</div><h2>¡Listo!</h2>' +
          "<p>Se añadieron <b>" + r.ingresos + " ingreso" + (r.ingresos === 1 ? "" : "s") + "</b> (" + libras(r.totalIngresos) + ") y <b>" + r.gastos + " gasto" + (r.gastos === 1 ? "" : "s") + "</b> (" + libras(r.totalGastos) + ").</p>" +
          (r.categoriasNuevas && r.categoriasNuevas.length ? "<p>Categorías nuevas: " + esc(r.categoriasNuevas.join(", ")) + ".</p>" : "") +
          (r.repetidas ? "<p>" + r.repetidas + " ya estaban y no se repitieron.</p>" : "") +
          (r.sinPeriodo ? '<div class="aviso" style="text-align:left">⚠️ ' + r.sinPeriodo + " movimiento" + (r.sinPeriodo === 1 ? "" : "s") + " quedaron sin periodo porque tu hoja no tiene periodos para esas fechas. Añádelos en <b>Periodos</b> y se verán en el Dashboard.</div>" : "") +
          '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap"><button type="button" class="btn" id="im-mas">Importar otro archivo</button><button type="button" class="btn p" id="im-vergas">Ver mis gastos</button><button type="button" class="btn p" id="im-dash">Ver Dashboard</button></div>';
        $("im-mas").onclick = function () { A = null; pasos(1); ver(1); };
        $("im-vergas").onclick = function () { window.SHELL.ir("form:gasto"); };
        $("im-dash").onclick = function () { window.SHELL.ir("dashboard"); };
      }).catch(function (e) { b.disabled = false; b.textContent = "Añadir " + R.filas.length + " movimientos"; err.textContent = "No se pudo añadir: " + e.message; });
    }
    return { destroy: function () { vivo = false; } };
  }

  window.PB_VISTAS = window.PB_VISTAS || {};
  window.PB_VISTAS.importar = { tpl: TPL, init: init };
  window.pbImportar = { leerEbay: leerEbay, leerEtsy: leerEtsy, csvFilas: csvFilas, num: num, fecha: fecha };
})();
