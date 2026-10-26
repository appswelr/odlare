/* PuntoBalance 5.0.0 · MOTOR (copiado del de Mis Finanzas 2.5.0 y adaptado)
   Hace funcionar en el navegador (computadora, tablet) y en el teléfono el mismo Code.gs de la versión de la hoja.
   Imita lo poco de Apps Script que usa Code.gs (SpreadsheetApp, Utilities, PropertiesService...) sobre la API de Google Sheets:
     1. lee la hoja entera (una vez, o si pasaron más de 20 s),
     2. ejecuta la función de Code.gs sobre esa copia en memoria,
     3. manda a Google todos los cambios juntos en una sola petición (batchUpdate).
   Modos: "hoja" (entró con Google; la hoja está en SU Drive) y "demo" (Probar sin cuenta: todo en memoria, no se guarda nada). */
(function () {
  "use strict";
  var MODO = null;          // "hoja" | "demo"
  var HOJA_ID = null;

  /* ---------- llamadas a Google: en el navegador con fetch + token; en Android por el puente window.MF ---------- */
  var pend = {}, n = 0;
  if (window.MF) {
    var anterior = window.mfRespuesta;
    window.mfRespuesta = function (id, estado, texto) {
      var f = pend[id];
      if (!f) return anterior && anterior(id, estado, texto);
      delete pend[id];
      var d = null; try { d = texto ? JSON.parse(texto) : null; } catch (e) { d = { texto: texto }; }
      f({ estado: estado, datos: d });
    };
  }
  function api(metodo, url, cuerpo) {
    if (window.MF && window.MF.api) {
      return new Promise(function (r) { var id = "m" + (++n); pend[id] = r; window.MF.api(id, metodo, url, cuerpo ? JSON.stringify(cuerpo) : ""); });
    }
    return window.pbCuenta.token().then(function (tk) {
      return fetch(url, { method: metodo, headers: Object.assign({ Authorization: "Bearer " + tk }, cuerpo ? { "Content-Type": "application/json" } : {}),
        body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    }).then(function (res) {
      return res.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = { texto: t }; } return { estado: res.status, datos: d }; });
    }, function (e) { if (e && e.sinPermiso) throw e; return { estado: 0, datos: null }; });
  }
  function fallo(r) {
    if (!r.estado) return "No hay conexión a internet. Prueba otra vez.";
    if (r.estado === 401) return "Tu sesión de Google caducó. Vuelve a entrar con Google.";
    if (r.estado === 404) return "No encuentro tu hoja de PuntoBalance. ¿La borraste?";
    if (r.estado === 403) return "Google no me deja abrir tu hoja con esta cuenta.";
    var m = r.datos && r.datos.error && (r.datos.error.message || r.datos.error);
    return "Google dijo: " + (typeof m === "string" ? m : "error " + r.estado);
  }
  var SHEETS = "https://sheets.googleapis.com/v4/spreadsheets/";
  function errorDe(r, antes) {
    var e = new Error((antes || "") + fallo(r));
    if (!r.estado) e.sinRed = true;
    if (r.estado === 401) e.sesion = true;
    return e;
  }
  var TZ_LOCAL = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London"; } catch (e) { return "Europe/London"; } })();

  /* ---------- fechas en la zona horaria de la hoja ---------- */
  var fmtCache = {};
  function partes(fecha, tz) {
    var k = tz || "Europe/London";
    if (!fmtCache[k]) fmtCache[k] = new Intl.DateTimeFormat("en-GB", { timeZone: k, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    var o = {};
    fmtCache[k].formatToParts(fecha).forEach(function (p) { if (p.type !== "literal") o[p.type] = Number(p.value); });
    if (o.hour === 24) o.hour = 0;
    return o; // year, month (1-12), day, hour, minute, second
  }
  /** Momento real en que en la zona tz el reloj marca y-m-d h:mi:s. */
  function deReloj(y, mo, d, h, mi, s, tz) {
    var guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
    var t = guess;
    for (var i = 0; i < 2; i++) {
      var p = partes(new Date(t), tz);
      var visto = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      t += guess - visto;
    }
    return new Date(t);
  }
  function serialAFecha(serial, tz) {
    var ms = Math.round((serial - 25569) * 86400000), u = new Date(ms);
    return deReloj(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds(), tz);
  }
  function fechaASerial(f, tz) {
    var p = partes(f, tz);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 86400000 + 25569;
  }
  function dos(x) { return (x < 10 ? "0" : "") + x; }
  var Utilities = {
    formatDate: function (fecha, tz, patron) {
      var p = partes(fecha, tz);
      return String(patron).replace(/yyyy|MM|M|dd|d|HH|H|mm|ss/g, function (t) {
        switch (t) {
          case "yyyy": return String(p.year);
          case "MM": return dos(p.month);
          case "M": return String(p.month);
          case "dd": return dos(p.day);
          case "d": return String(p.day);
          case "HH": return dos(p.hour);
          case "H": return String(p.hour);
          case "mm": return dos(p.minute);
          case "ss": return dos(p.second);
        }
        return t;
      });
    }
  };

  /* ---------- la hoja en memoria ---------- */
  var SS = null;            // { id, titulo, tz, hojas: [Hoja], cargada: ms }
  var CAMBIOS = [];         // peticiones para batchUpdate, en orden

  function letraACol(l) { var c = 0; for (var i = 0; i < l.length; i++) c = c * 26 + (l.charCodeAt(i) - 64); return c; }
  function colALetra(c) { var s = ""; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function esFechaPatron(f) { return /d/.test(f) && /y/.test(f) && !/[#0]/.test(f.replace(/[dmy\/\-. ]/gi, "")); }

  function Hoja(props, filas) {
    this.id = props.sheetId;
    this.titulo = props.title;
    this.filasMax = (props.gridProperties && props.gridProperties.rowCount) || 1000;
    this.colsMax = (props.gridProperties && props.gridProperties.columnCount) || 26;
    this.v = filas || [];        // valores [fila][col], base 0
    this.colFecha = {};          // columnas (base 0) con formato de fecha
  }
  Hoja.prototype.getName = function () { return this.titulo; };
  Hoja.prototype.setName = function (t) {
    this.titulo = t;
    CAMBIOS.push({ updateSheetProperties: { properties: { sheetId: this.id, title: t }, fields: "title" } });
    return this;
  };
  Hoja.prototype.getLastRow = function () {
    for (var r = this.v.length - 1; r >= 0; r--) {
      var f = this.v[r];
      if (f) for (var c = 0; c < f.length; c++) if (f[c] !== "" && f[c] != null) return r + 1;
    }
    return 0;
  };
  Hoja.prototype.getLastColumn = function () {
    var m = 0;
    this.v.forEach(function (f) { if (f) for (var c = f.length - 1; c >= 0; c--) if (f[c] !== "" && f[c] != null) { m = Math.max(m, c + 1); break; } });
    return m;
  };
  Hoja.prototype.getMaxRows = function () { return this.filasMax; };
  Hoja.prototype.getMaxColumns = function () { return this.colsMax; };
  Hoja.prototype.getRange = function (a, b, c, d) {
    if (typeof a === "string") {
      var m = a.replace(/\$/g, "").match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/);
      if (!m) throw new Error("Rango no válido: " + a);
      var c1 = letraACol(m[1]), r1 = m[2] ? Number(m[2]) : 1;
      var c2 = m[3] ? letraACol(m[3]) : c1, r2 = m[4] ? Number(m[4]) : (m[2] && !m[3] ? r1 : this.filasMax);
      if (m[3] && !m[4] && m[2]) r2 = this.filasMax;
      return new Rango(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1, !m[2]);
    }
    return new Rango(this, a, b, c || 1, d || 1, false);
  };
  Hoja.prototype.deleteRow = function (fila) {
    this.v.splice(fila - 1, 1);
    this.filasMax--;
    CAMBIOS.push({ deleteDimension: { range: { sheetId: this.id, dimension: "ROWS", startIndex: fila - 1, endIndex: fila } } });
  };
  Hoja.prototype.setColumnWidth = function (col, px) {
    CAMBIOS.push({ updateDimensionProperties: { range: { sheetId: this.id, dimension: "COLUMNS", startIndex: col - 1, endIndex: col }, properties: { pixelSize: px }, fields: "pixelSize" } });
    return this;
  };
  Hoja.prototype.setFrozenRows = function (k) {
    CAMBIOS.push({ updateSheetProperties: { properties: { sheetId: this.id, gridProperties: { frozenRowCount: k } }, fields: "gridProperties.frozenRowCount" } });
    return this;
  };
  Hoja.prototype.setTabColor = function (hex) {
    CAMBIOS.push({ updateSheetProperties: { properties: { sheetId: this.id, tabColor: color(hex) }, fields: "tabColor" } });
    return this;
  };
  Hoja.prototype.asegurarFilas = function (hasta) {
    if (hasta > this.filasMax) {
      var mas = Math.max(hasta - this.filasMax, 50);
      CAMBIOS.push({ appendDimension: { sheetId: this.id, dimension: "ROWS", length: mas } });
      this.filasMax += mas;
    }
  };
  Hoja.prototype.asegurarCols = function (hasta) {
    if (hasta > this.colsMax) {
      var mas = hasta - this.colsMax;
      CAMBIOS.push({ appendDimension: { sheetId: this.id, dimension: "COLUMNS", length: mas } });
      this.colsMax += mas;
    }
  };

  function color(hex) {
    var h = String(hex).replace("#", "");
    return { red: parseInt(h.slice(0, 2), 16) / 255, green: parseInt(h.slice(2, 4), 16) / 255, blue: parseInt(h.slice(4, 6), 16) / 255 };
  }

  function Rango(hoja, fila, col, nf, nc, columnaEntera) {
    if (!(fila >= 1) || !(col >= 1) || !(nf >= 1) || !(nc >= 1)) throw new Error("Rango fuera de la hoja.");
    this.h = hoja; this.f = fila; this.c = col; this.nf = nf; this.nc = nc; this.entera = columnaEntera;
  }
  Rango.prototype.getRow = function () { return this.f; };
  Rango.prototype.getColumn = function () { return this.c; };
  Rango.prototype.getNumRows = function () { return this.nf; };
  Rango.prototype.getNumColumns = function () { return this.nc; };
  Rango.prototype.grid = function () {
    return { sheetId: this.h.id, startRowIndex: this.f - 1, endRowIndex: this.f - 1 + this.nf, startColumnIndex: this.c - 1, endColumnIndex: this.c - 1 + this.nc };
  };
  Rango.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nf; i++) {
      var f = this.h.v[this.f - 1 + i] || [], fila = [];
      for (var j = 0; j < this.nc; j++) {
        var x = f[this.c - 1 + j];
        fila.push(x == null ? "" : (x instanceof Date ? new Date(x.getTime()) : x));
      }
      out.push(fila);
    }
    return out;
  };
  Rango.prototype.getValue = function () { return this.getValues()[0][0]; };
  Rango.prototype.getDisplayValues = function () {
    return this.getValues().map(function (f) { return f.map(function (x) { return x instanceof Date ? Utilities.formatDate(x, SS.tz, "dd/MM/yyyy") : String(x); }); });
  };
  /** Escribe en memoria y prepara el cambio para Google. formulas = true si son fórmulas. */
  Rango.prototype.escribir = function (vals, formulas) {
    if (!Array.isArray(vals) || vals.length !== this.nf || vals.some(function (f) { return !Array.isArray(f); }) || vals[0].length !== this.nc) {
      throw new Error("El número de filas o columnas no coincide con el rango.");
    }
    var h = this.h, tz = SS.tz, filasApi = [];
    h.asegurarFilas(this.f - 1 + this.nf);
    h.asegurarCols(this.c - 1 + this.nc);
    for (var i = 0; i < this.nf; i++) {
      var r = this.f - 1 + i;
      while (h.v.length <= r) h.v.push([]);
      var celdas = [];
      for (var j = 0; j < this.nc; j++) {
        var c = this.c - 1 + j, x = vals[i][j], uv = null, mem = x;
        if (x == null || x === "") { mem = ""; }
        else if (x instanceof Date) { uv = { numberValue: fechaASerial(x, tz) }; h.colFecha[c] = true; mem = new Date(x.getTime()); }
        else if (typeof x === "number") { uv = { numberValue: x }; if (h.colFecha[c]) mem = serialAFecha(x, tz); }
        else if (typeof x === "boolean") { uv = { boolValue: x }; }
        else {
          var s = String(x);
          if (formulas || s.charAt(0) === "=") { uv = { formulaValue: s }; mem = s; }
          else { uv = { stringValue: s }; mem = s; }
        }
        while (h.v[r].length <= c) h.v[r].push("");
        h.v[r][c] = mem;
        celdas.push(uv ? { userEnteredValue: uv } : {});
      }
      filasApi.push({ values: celdas });
    }
    CAMBIOS.push({ updateCells: { range: this.grid(), rows: filasApi, fields: "userEnteredValue" } });
    return this;
  };
  Rango.prototype.setValues = function (v) { return this.escribir(v, false); };
  Rango.prototype.setValue = function (v) { return this.escribir([[v]], false); };
  Rango.prototype.setFormulas = function (v) { return this.escribir(v, true); };
  Rango.prototype.setFormula = function (v) { return this.escribir([[v]], true); };
  Rango.prototype.clearContent = function () {
    var h = this.h;
    for (var i = 0; i < this.nf; i++) {
      var f = h.v[this.f - 1 + i];
      if (f) for (var j = 0; j < this.nc; j++) if (this.c - 1 + j < f.length) f[this.c - 1 + j] = "";
    }
    CAMBIOS.push({ updateCells: { range: this.grid(), fields: "userEnteredValue" } });
    return this;
  };
  Rango.prototype.clear = Rango.prototype.clearContent;
  Rango.prototype.formato = function (formato, campos) {
    CAMBIOS.push({ repeatCell: { range: this.grid(), cell: { userEnteredFormat: formato }, fields: campos } });
    return this;
  };
  Rango.prototype.setNumberFormat = function (f) {
    var tipo = f === "@" ? "TEXT" : esFechaPatron(f) ? "DATE" : "NUMBER";
    if (tipo === "DATE") {
      var h = this.h, tz = SS.tz;
      for (var j = 0; j < this.nc; j++) {
        var c = this.c - 1 + j;
        if (this.entera) h.colFecha[c] = true;
        for (var i = 0; i < this.nf && this.f - 1 + i < h.v.length; i++) {
          var fila = h.v[this.f - 1 + i];
          if (fila && typeof fila[c] === "number") fila[c] = serialAFecha(fila[c], tz);
        }
      }
      if (this.c === 1 || this.entera) this.h.colFecha[this.c - 1] = true;
    }
    return this.formato({ numberFormat: { type: tipo, pattern: f } }, "userEnteredFormat.numberFormat");
  };
  Rango.prototype.setNumberFormats = function () { return this; };
  Rango.prototype.setFontWeight = function (w) { return this.formato({ textFormat: { bold: w === "bold" } }, "userEnteredFormat.textFormat.bold"); };
  Rango.prototype.setFontColor = function (c) { return this.formato({ textFormat: { foregroundColor: color(c) } }, "userEnteredFormat.textFormat.foregroundColor"); };
  Rango.prototype.setFontFamily = function (f) { return this.formato({ textFormat: { fontFamily: f } }, "userEnteredFormat.textFormat.fontFamily"); };
  Rango.prototype.setBackground = function (c) { return this.formato({ backgroundColor: color(c) }, "userEnteredFormat.backgroundColor"); };
  Rango.prototype.setHorizontalAlignment = function () { return this; };
  Rango.prototype.setDataValidation = function () { return this; }; // los menús de la hoja se quedan como están
  Rango.prototype.getSheet = function () { return this.h; };

  function Libro() { }
  Libro.prototype.getSheetByName = function (t) {
    for (var i = 0; i < SS.hojas.length; i++) if (SS.hojas[i].titulo === t) return SS.hojas[i];
    return null;
  };
  Libro.prototype.getSheets = function () { return SS.hojas.slice(); };
  Libro.prototype.insertSheet = function (t) {
    if (this.getSheetByName(t)) throw new Error("Ya existe la pestaña " + t);
    var id = Math.floor(Math.random() * 1e9) + 1000;
    var h = new Hoja({ sheetId: id, title: t, gridProperties: { rowCount: 1000, columnCount: 26 } }, []);
    SS.hojas.push(h);
    CAMBIOS.push({ addSheet: { properties: { sheetId: id, title: t, gridProperties: { rowCount: 1000, columnCount: 26 } } } });
    return h;
  };
  Libro.prototype.getSpreadsheetTimeZone = function () { return SS.tz; };
  Libro.prototype.getUrl = function () { return "https://docs.google.com/spreadsheets/d/" + SS.id + "/edit"; };
  Libro.prototype.getId = function () { return SS.id; };
  Libro.prototype.getName = function () { return SS.titulo; };
  var LIBRO = new Libro();

  function validacion() {
    var o = {};
    ["requireValueInList", "requireValueInRange", "setAllowInvalid", "requireNumberBetween", "setHelpText"].forEach(function (k) { o[k] = function () { return o; }; });
    o.build = function () { return {}; };
    return o;
  }

  Hoja.prototype.getDataRange = function () {
    return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1), false);
  };
  Hoja.prototype.getConditionalFormatRules = function () { return []; };
  Hoja.prototype.setConditionalFormatRules = function () { return this; };
  Rango.prototype.copyTo = function () { return this; };

  /* ---------- Apps Script imitado ---------- */
  var SpreadsheetApp = {
    getActive: function () { return LIBRO; },
    getActiveSpreadsheet: function () { return LIBRO; },
    openById: function () { return LIBRO; },
    flush: function () { },
    newDataValidation: validacion,
    newConditionalFormatRule: function () { var o = {}; ["whenTextEqualTo", "setBackground", "setFontColor", "setStrikethrough", "setBold", "setRanges"].forEach(function (k) { o[k] = function () { return o; }; }); o.build = function () { return {}; }; return o; },
    getUi: function () { throw new Error("No disponible en la app."); }
  };
  var Session = {
    getScriptTimeZone: function () { return (SS && SS.tz) || TZ_LOCAL; },
    getEffectiveUser: function () { return { getEmail: function () { return (window.pbCuenta && window.pbCuenta.correo()) || ""; } }; },
    getActiveUser: function () { return Session.getEffectiveUser(); }
  };
  var candado = { waitLock: function () { }, tryLock: function () { return true; }, releaseLock: function () { } };
  var LockService = { getScriptLock: function () { return candado; }, getDocumentLock: function () { return candado; } };
  var MailApp = { sendEmail: function () { throw new Error("En la app el correo se manda desde tu aparato."); } };
  function cadena() { var o = {}; ["timeBased", "everyDays", "atHour", "nearMinute", "everyHours", "onWeekDay"].forEach(function (k) { o[k] = function () { return o; }; }); o.create = function () { return {}; }; return o; }
  var ScriptApp = { getProjectTriggers: function () { return []; }, deleteTrigger: function () { }, newTrigger: function () { return cadena(); } };
  var HtmlService = { createTemplateFromFile: function () { throw new Error("No disponible en la app."); }, createHtmlOutput: function () { throw new Error("No disponible en la app."); } };
  var DriveApp = { getFoldersByName: function () { throw new Error("No disponible en la app."); } };
  var Logger = { log: function (x) { try { console.log(x); } catch (e) { } } };

  /* PropertiesService guardado en la pestaña «AppProps» de la hoja (así sirve en todos los aparatos). */
  function hojaProps() {
    var h = LIBRO.getSheetByName("AppProps");
    if (!h) { h = LIBRO.insertSheet("AppProps"); h.getRange(1, 1, 1, 2).setValues([["CLAVE", "VALOR"]]); h.getRange("B:B").setNumberFormat("@"); }
    return h;
  }
  function filaProp(h, k) { for (var r = 1; r < h.v.length; r++) if (h.v[r] && h.v[r][0] === k) return r + 1; return 0; }
  var PROPS = {
    getProperty: function (k) { var h = LIBRO.getSheetByName("AppProps"); if (!h) return null; var r = filaProp(h, k); return r ? String(h.v[r - 1][1]) : null; },
    setProperty: function (k, v) {
      var h = hojaProps(), r = filaProp(h, k);
      if (!r) { r = Math.max(h.getLastRow(), 1) + 1; }
      h.getRange(r, 1, 1, 2).setValues([[k, String(v)]]);
      return PROPS;
    },
    setProperties: function (o) { Object.keys(o).forEach(function (k) { PROPS.setProperty(k, o[k]); }); return PROPS; },
    deleteProperty: function (k) { var h = LIBRO.getSheetByName("AppProps"); if (!h) return PROPS; var r = filaProp(h, k); if (r) h.getRange(r, 1, 1, 2).setValues([["~", ""]]); return PROPS; },
    getProperties: function () { var o = {}, h = LIBRO.getSheetByName("AppProps"); if (h) h.v.slice(1).forEach(function (f) { if (f && f[0] && f[0] !== "~") o[f[0]] = String(f[1]); }); return o; }
  };
  var PropertiesService = { getScriptProperties: function () { return PROPS; }, getUserProperties: function () { return PROPS; }, getDocumentProperties: function () { return PROPS; } };

  window.PB_GAS = { SpreadsheetApp: SpreadsheetApp, Utilities: Utilities, Session: Session, LockService: LockService, MailApp: MailApp,
    ScriptApp: ScriptApp, HtmlService: HtmlService, PropertiesService: PropertiesService, DriveApp: DriveApp, Logger: Logger };

  /* ---------- leer la hoja de Google ---------- */
  function citar(t) { return "'" + String(t).replace(/'/g, "''") + "'"; }
  function cargar(id) {
    if (MODO === "demo") return Promise.resolve(SS);
    var props;
    return api("GET", SHEETS + id + "?fields=" + encodeURIComponent("properties(title,timeZone),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))"))
      .then(function (r) {
        if (r.estado !== 200) throw errorDe(r);
        props = r.datos;
        var rangos = (props.sheets || []).map(function (s) { return "ranges=" + encodeURIComponent(citar(s.properties.title)); }).join("&");
        if (!rangos) return [null, null];
        var base = SHEETS + id + "/values:batchGet?" + rangos + "&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE";
        return Promise.all([api("GET", base + "&dateTimeRenderOption=SERIAL_NUMBER"), api("GET", base + "&dateTimeRenderOption=FORMATTED_STRING")]);
      })
      .then(function (rr) {
        var a = rr[0], b = rr[1];
        if (a && a.estado !== 200) throw errorDe(a);
        if (b && b.estado !== 200) throw errorDe(b);
        var tz = (props.properties && props.properties.timeZone) || "Europe/London";
        var nuevo = { id: id, titulo: props.properties.title, tz: tz, hojas: [], cargada: Date.now() };
        (props.sheets || []).forEach(function (s, i) {
          var num = (a && a.datos.valueRanges[i] && a.datos.valueRanges[i].values) || [];
          var txt = (b && b.datos.valueRanges[i] && b.datos.valueRanges[i].values) || [];
          var h = new Hoja(s.properties, []);
          var votos = {};
          num.forEach(function (fila, r) {
            var f = [];
            fila.forEach(function (x, c) {
              var t = txt[r] && txt[r][c];
              if (typeof x === "number" && typeof t === "string" && /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(t)) { f.push(serialAFecha(x, tz)); votos[c] = (votos[c] || 0) + 1; }
              else f.push(x == null ? "" : x);
            });
            h.v.push(f);
          });
          Object.keys(votos).forEach(function (c) { h.colFecha[c] = true; });
          nuevo.hojas.push(h);
        });
        SS = nuevo;
        return SS;
      });
  }
  function enviar() {
    if (!CAMBIOS.length) return Promise.resolve();
    var lote = CAMBIOS; CAMBIOS = [];
    if (MODO === "demo") return Promise.resolve();
    return api("POST", SHEETS + SS.id + ":batchUpdate", { requests: lote }).then(function (r) {
      if (r.estado !== 200) { SS = null; throw errorDe(r, "No se pudo guardar en tu hoja. "); }
    });
  }

  /* ---------- plantilla para una persona nueva ---------- */
  var CATS = {
    dj: [["Equipo", "Altavoces, controlador, cables"], ["Música", "Pools de música, software"], ["Transporte", "Taxis, trenes, aparcamiento"], ["Gasolina", "Combustible del coche"],
      ["Publicidad", "Redes, tarjetas, web"], ["Teléfono", "Móvil e internet"], ["Otros gastos", ""]],
    productos: [["Filamento", "Material para imprimir"], ["Resina", ""], ["Luz", "Electricidad del taller"], ["Envíos", "Correos, mensajería"], ["Comisión Wix / Etsy", "Comisiones de venta"],
      ["Repuestos", "Piezas de la impresora"], ["Empaques", "Cajas, bolsas"], ["Publicidad", ""], ["Otros gastos", ""]]
  };
  var CONFIG = [["nombre", "", "Tu nombre o el de tu negocio (sale en la factura)"], ["direccion", "", ""], ["ciudad_postcode", "", ""], ["telefono", "", ""], ["email", "", "Tu correo (copia de las facturas)"],
    ["banco", "", "Sale en la factura para que te paguen"], ["titular", "", ""], ["sort_code", "", ""], ["cuenta", "", ""], ["nota_factura", "Thank you for your business.", ""],
    ["plazo_pago_dias", 14, "Días que tiene el cliente para pagar"], ["email_resumen", "", "A dónde mandar el resumen del periodo"], ["carpeta_facturas", "Facturas PuntoBalance", "Carpeta de tu Drive para los PDF"],
    ["dia_inicio_periodo", 1, "1 = meses normales; 7 = periodos de Universal Credit (del 7 al 6)"]];
  function plantilla(nombre, negocio) {
    var ss = LIBRO, hojas = SS.hojas;
    function cabecera(h, titulos) {
      h.getRange(1, 1, 1, titulos.length).setValues([titulos]).setFontWeight("bold").setFontColor("#FFFFFF").setBackground("#1B2B5B").setFontFamily("Arial");
      h.setFrozenRows(1);
    }
    function nueva(t, titulos, color) {
      var h = ss.getSheetByName(t);
      if (h) return null;
      var libre = hojas.length === 1 && hojas[0].getLastRow() === 0 && !ss.getSheetByName("Ingresos") ? hojas[0] : null;
      h = libre && t === "Ingresos" ? libre.setName(t) : ss.insertSheet(t);
      cabecera(h, titulos); if (color) h.setTabColor(color);
      return h;
    }
    var h;
    if ((h = nueva("Ingresos", ["ID FACTURA", "FECHA FACTURA", "CLIENTE", "DESCRIPCIÓN", "FECHA EVENTO", "UNIDAD", "PRECIO", "CANTIDAD", "SUBTOTAL", "PERIODO UC", "FORMA DE PAGO", "ESTADO", "PROCESADO UC"], "#4F46E5"))) {
      h.getRange("B:B").setNumberFormat("dd/mm/yyyy"); h.getRange("E:E").setNumberFormat("dd/mm/yyyy"); h.getRange("G:G").setNumberFormat("£#,##0.00"); h.getRange("I:I").setNumberFormat("£#,##0.00");
    }
    if ((h = nueva("Gastos", ["ID GASTO", "FECHA", "PROVEEDOR", "DESCRIPCIÓN", "CATEGORÍA UC", "CANTIDAD", "UNIDAD", "PRECIO", "SUBTOTAL", "PERIODO UC", "NOTAS", "PROCESADO UC"], "#DC5A56"))) {
      h.getRange("B:B").setNumberFormat("dd/mm/yyyy"); h.getRange("H:H").setNumberFormat("£#,##0.00"); h.getRange("I:I").setNumberFormat("£#,##0.00");
    }
    nueva("Clientes", ["NOMBRE", "DIRECCIÓN", "CIUDAD", "POSTCODE", "TELÉFONO", "EMAIL"], "#15803D");
    nueva("Proveedores", ["NOMBRE", "NOTAS"], "#94A3B8");
    if ((h = nueva("Categorias", ["NOMBRE", "DESCRIPCIÓN"], "#F59E0B"))) {
      var cats = CATS[negocio] || CATS.dj;
      h.getRange(2, 1, cats.length, 2).setValues(cats);
    }
    if ((h = nueva("Config", ["CLAVE", "VALOR", "DESCRIPCIÓN"], "#94A3B8"))) {
      var cfg = CONFIG.map(function (f) { return f.slice(); });
      if (nombre) cfg[0][1] = nombre;
      var correo = window.pbCuenta && window.pbCuenta.correo();
      if (correo) { cfg[4][1] = correo; cfg[11][1] = correo; }
      h.getRange(2, 1, cfg.length, 3).setValues(cfg);
    }
    if ((h = nueva("Periodos", ["INICIO", "FIN", "ETIQUETA", "", "LISTA PANEL"], "#0EA5E9"))) {
      h.getRange("A:B").setNumberFormat("dd/mm/yyyy");
      var hoy = new Date(), filas = [];
      var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      for (var i = -6; i < 18; i++) {
        var y = hoy.getFullYear(), m = hoy.getMonth() + i;
        var ini = new Date(y, m, 1), fin = new Date(y, m + 1, 0);
        filas.push([ini, fin, ini.getFullYear() + "-" + meses[ini.getMonth()]]);
      }
      h.getRange(2, 1, filas.length, 3).setValues(filas);
      h.getRange(2, 5, filas.length + 1, 1).setValues([["TODOS"]].concat(filas.map(function (f) { return [f[2]]; })));
    }
    if (!ss.getSheetByName("AppProps")) {
      var ap = ss.insertSheet("AppProps");
      cabecera(ap, ["CLAVE", "VALOR"]); ap.getRange("B:B").setNumberFormat("@");
      ap.getRange(2, 1, 1, 2).setValues([["NEGOCIO", negocio || "dj"]]);
    }
  }

  /* ---------- google.script.run ---------- */
  var cola = Promise.resolve();
  var CODE = null;
  var LOCAL = window.PB_LOCAL = window.PB_LOCAL || {};   // funciones que en la app hace el aparato (PDF, correo…)

  function correr(fn, args) {
    if (!CODE) CODE = window.PB_CODE;
    if (!CODE || typeof CODE[fn] !== "function") throw new Error("La app no sabe hacer «" + fn + "».");
    CAMBIOS = [];
    var res;
    try { res = CODE[fn].apply(null, args); }
    catch (e) { CAMBIOS = []; if (MODO !== "demo") SS = null; throw e; }
    return enviar().then(function () {
      if (SS) SS.cargada = Date.now();
      return res === undefined ? null : JSON.parse(JSON.stringify(res));
    });
  }
  /* La app no hace nada hasta que la persona entra con Google o elige «Probar sin cuenta». */
  var listo, arrancar;
  listo = new Promise(function (r) { arrancar = r; });
  function fresco(fn, args) {
    var f = MODO === "demo" || (SS && SS.id === HOJA_ID && Date.now() - SS.cargada < 20000);
    return (f ? Promise.resolve() : cargar(HOJA_ID)).then(function () { return correr(fn, args || []); });
  }
  function ejecutar(fn, args) {
    // 5.0.0-alpha12: con la prueba terminada y sin Premium, la app queda en «solo ver» (licencia.js decide)
    if (window.pbPermitir && !window.pbPermitir(fn)) return Promise.reject(window.pbErrorLicencia ? window.pbErrorLicencia() : new Error("Activa PuntoBalance Premium para seguir."));
    var tarea = cola.then(function () { return listo; }).then(function () {
      if (LOCAL[fn]) return LOCAL[fn].apply(null, args.concat([fresco]));
      return fresco(fn, args);
    });
    cola = tarea.catch(function () { });
    return tarea.catch(function (e) {
      if (e && e.sesion && window.pbCuenta) window.pbCuenta.sesionCaducada();
      throw e;
    });
  }
  function corredor(ok, mal) {
    return new Proxy({}, {
      get: function (o, k) {
        if (k === "withSuccessHandler") return function (f) { return corredor(f, mal); };
        if (k === "withFailureHandler") return function (f) { return corredor(ok, f); };
        if (k === "withUserObject") return function () { return corredor(ok, mal); };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          ejecutar(String(k), args).then(function (r) { if (ok) ok(r); }, function (e) {
            if (mal) mal(e instanceof Error ? e : new Error(String(e && e.message || e)));
          });
        };
      }
    });
  }

  window.pbMotor = {
    modo: function () { return MODO; },
    /** Abre la hoja de la persona (modo «hoja»). */
    usarHoja: function (id) { MODO = "hoja"; HOJA_ID = id; SS = null; arrancar(); },
    /** Probar sin cuenta: todo en memoria con datos de ejemplo. */
    usarDemo: function (negocio) {
      MODO = "demo"; HOJA_ID = "demo";
      SS = { id: "demo", titulo: "PuntoBalance (ejemplo)", tz: TZ_LOCAL, hojas: [new Hoja({ sheetId: 1, title: "Hoja 1" }, [])], cargada: Date.now() };
      CAMBIOS = []; plantilla("Tu negocio", negocio || "dj"); CAMBIOS = [];
      if (window.pbDemo) window.pbDemo(function (fn, args) { if (!CODE) CODE = window.PB_CODE; CAMBIOS = []; var r = CODE[fn].apply(null, args || []); CAMBIOS = []; return r; });
      arrancar();
    },
    /** Prepara una hoja nueva con las pestañas de PuntoBalance si le faltan. */
    preparar: function (id, nombre, negocio) {
      MODO = "hoja"; HOJA_ID = id;
      return cargar(id).then(function () { CAMBIOS = []; plantilla(nombre, negocio); return enviar(); }).then(function () { SS = null; arrancar(); });
    },
    /** Ejecuta una función de Code.gs (para pdf.js y otros). */
    llamar: function (fn) { return ejecutar(fn, Array.prototype.slice.call(arguments, 1)); },
    api: api
  };
  window.google = window.google || {};
  window.google.script = { run: corredor(null, null) };
})();
