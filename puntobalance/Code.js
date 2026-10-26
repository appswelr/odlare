/* GENERADO por herramientas/generar_code_js.py a partir de servidor/Code.gs. No editar a mano. */
window.PB_CODE = (function (SpreadsheetApp, Utilities, Session, LockService, MailApp, ScriptApp, HtmlService, PropertiesService, DriveApp, Logger) {
/**
 * PuntoBalance (de Odlare) · Facturación, gastos y resumen Universal Credit
 * Pegar en: Extensiones → Apps Script → Code.gs
 *
 * Hojas que usa (deben existir con estos nombres):
 * Panel, Ingresos, Gastos, Clientes, Proveedores, Categorias, Periodos, Config
 */

/** Versión de la aplicación. Súbela cada vez que cambies algo (se ve en el título de cada ventana).
 *  2.0.0  Menú, formularios y panel rediseñados; TODOS los periodos; facturas canceladas
 *  2.1.0  Colores en tarjetas y Dashboard; aviso de nota al pie al crear el PDF; número de versión
 *  3.0.0  Todo en un solo Index.html con menú lateral; versión web a pantalla completa
 *  3.0.1  El aviso de la versión web ya no muestra el enlace /dev que fallaba
 *  3.0.2  El enlace web se pega una sola vez y queda guardado
 *  3.0.3  Botones Editar/Eliminar con color e icono; vista para celular; título sin versión
 *  3.1.0  Logo cambiable desde Ajustes (logo genérico por defecto); icono para el celular
 *  3.2.0  Movimientos de gastos e ingresos con filtros y Copiar; Impuestos (HMRC); Acerca de (Odlare)
 *  4.0.0  Nuevo nombre PuntoBalance e icono; "Mi negocio" en Ajustes (DJ o venta de productos); categorías sugeridas
 *  5.0.0  App instalable (web y Android): el mismo Code.gs corre en el navegador/teléfono con el motor (motor.js).
 *         SUBTOTAL y PERIODO se escriben como valor (no fórmula); periodos de cualquier día de inicio.
 *         alpha2: movimientos en tabla tipo hoja de cálculo (con Nº); el formulario queda en blanco al guardar.
 *         alpha3: «Acerca de» en pantalla completa (como Mis Finanzas), buscar actualizaciones y novedades.
 *         alpha4: «Tus datos» (copias de seguridad, exportar, cambiar de hoja); menú con los colores de Odlare.
 *         alpha5: «Importar mi hoja anterior» con el selector de Google (Picker).
 *         alpha6: solo instalada (como un programa); «¿Cómo quieres empezar?»; diálogos propios.
 *         alpha7: el selector de la hoja anterior se abre en «Mi unidad», con carpetas.
 *         alpha8: varios negocios en una sola hoja (pestaña Negocios, columnas NEGOCIO y Nº FACTURA);
 *                 formularios arriba y movimientos abajo; listas de clientes, proveedores y categorías.
 *         alpha9: PuntoBalance arriba del menú; logos de negocio en color; factura de cada negocio (fecha, nota, email, teléfono).
 *         alpha10: movimientos con todas las columnas (vista completa o sencilla).
 *         alpha11: modo oscuro; Dashboard con «Periodo UC» y «Año HMRC»; movimientos con fechas, resumen y editar/borrar;
 *                  Inicio «Hola» con tarjetas de estado; bloqueo por inactividad.
 *         alpha12: licencias Premium (30 días de prueba, luego «solo ver»), códigos firmados y envío por correo.
 *         alpha13: licencias activadas (llave pública de Odlare).
 *         alpha14: logo de Odlare en el correo de la licencia.
 * Formato MAYOR.MENOR.PARCHE (igual que Mis Finanzas): sube el último número en arreglos pequeños,
 * el del medio al añadir algo nuevo, y el primero en cambios grandes. Cambia también VERSION_FECHA.
 */
const VERSION = '5.0.0-alpha14';
const VERSION_FECHA = '26 oct 2026';

// ───────────────────────── Menú ─────────────────────────
function onOpen() {
  try { PropertiesService.getScriptProperties().setProperty('SS_ID', SpreadsheetApp.getActive().getId()); } catch (e) {}
  SpreadsheetApp.getUi()
    .createMenu('PuntoBalance')
    .addItem('Abrir menú principal', 'abrirMenu')
    .addItem('Abrir en pantalla completa (web)', 'mostrarEnlaceWeb')
    .addSeparator()
    .addItem('Abrir dashboard', 'abrirDashboard')
    .addSeparator()
    .addItem('Abrir panel (facturas y PDF)', 'abrirPanel')
    .addSeparator()
    .addItem('Editar o eliminar registros', 'abrirFormularioRegistros')
    .addItem('Actualizar libro (TODOS y facturas canceladas)', 'actualizarLibro')
    .addItem('Nuevo ingreso', 'abrirFormularioIngreso')
    .addItem('Nuevo gasto', 'abrirFormularioGasto')
    .addItem('Nuevo proveedor', 'abrirFormularioProveedor')
    .addItem('Nuevo cliente', 'abrirFormularioCliente')
    .addItem('Nueva categoría', 'abrirFormularioCategoria')
    .addItem('Añadir periodos', 'abrirFormularioPeriodos')
    .addItem('Ajustes', 'abrirFormularioAjustes')
    .addSeparator()
    .addItem('Revisar datos', 'mostrarRevision')
    .addItem('Enviarme el resumen del periodo UC', 'enviarResumenPeriodoActual')
    .addItem('Marcar periodo como procesado en UC…', 'marcarProcesadoDialogo')
    .addSeparator()
    .addItem('Activar recordatorio mensual', 'instalarRecordatorio')
    .addItem('Desactivar recordatorio mensual', 'quitarRecordatorio')
    .addToUi();
}

// ───────────────────────── Menú principal (el botón de la hoja ejecuta abrirMenu) ─────────────────────────
function abrirMenu() { abrirApp_('inicio', ''); }

/** Abre la app (Index.html) en una ventana sobre la hoja. vista: inicio | dashboard | panel | form (tab: ingreso, gasto, registros…) */
function abrirApp_(vista, tab) {
  const t = HtmlService.createTemplateFromFile('Index');
  t.vista = vista; t.tab = tab || ''; t.ver = VERSION; t.fecha = VERSION_FECHA;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(1400).setHeight(860), 'PuntoBalance');
}

function getHubData() {
  const p = periodoActual_();
  return {
    version: VERSION,
    versionFecha: VERSION_FECHA,
    periodo: p ? p['ETIQUETA'] : '',
    avisos: revisarDatos_().length,
    recordatorio: ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'enviarResumenSiToca'),
    logo: getLogo_(),
    negocio: getNegocio(),
    negocios: negocios_(),
    logos: logosNegocios_(),
    // 5.0.0-alpha11: tarjetas de estado del Inicio
    periodoFin: p && p['FIN'] instanceof Date ? iso_(p['FIN']) : '',
    pendiente: (function () {
      const pe = leerTabla_('Ingresos').filter(r => r['ESTADO'] === 'PENDING' && r['ID FACTURA'] !== '');
      return { total: Math.round(pe.reduce((t, r) => t + (Number(r['SUBTOTAL']) || 0), 0) * 100) / 100, n: Object.keys(pe.reduce((o, r) => (o[r['ID FACTURA']] = 1, o), {})).length };
    })(),
    hmrc: (function () { const y = anioFiscalDe_(new Date()); return { fecha: '31 ene ' + (y + 2), anio: etiquetaAnio_(y) }; })(),
    nombre: String(config_().nombre || '')
  };
}
function getRevision() { return revisarDatos_(); }
function hubEnviarResumen() {
  const p = periodoActual_();
  if (!p) throw new Error('No encuentro el periodo actual en la hoja Periodos.');
  return enviarResumen_(p['ETIQUETA']);
}
function hubRecordatorio(activar) {
  quitarRecordatorio(true);
  if (activar) ScriptApp.newTrigger('enviarResumenSiToca').timeBased().everyDays(1).atHour(8).create();
  return !!activar;
}

function abrirPanel() { abrirApp_('panel', ''); }

// ───────────────────────── Utilidades ─────────────────────────
const TZ = Session.getScriptTimeZone();
const CAT_MAX = 15;       // categorías que caben en el Panel
const PERIODOS_MAX = 60;  // periodos que caben en el Panel

function hoja_(nombre) {
  const s = ss_().getSheetByName(nombre);
  if (!s) throw new Error('Falta la hoja "' + nombre + '".');
  return s;
}

/** Lee una hoja de datos como lista de objetos con la cabecera como clave. */
function leerTabla_(nombre) {
  const s = hoja_(nombre);
  const v = s.getDataRange().getValues();
  const heads = v[0];
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === '' || v[i][0] === null) continue;
    const o = { _fila: i + 1 };
    heads.forEach((h, j) => (o[h] = v[i][j]));
    out.push(o);
  }
  return out;
}

function config_() {
  const c = {};
  hoja_('Config').getDataRange().getValues().slice(1).forEach(r => { if (r[0]) c[r[0]] = r[1]; });
  return c;
}

function fecha_(d) {
  return d instanceof Date ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy') : '';
}

function libras_(n) {
  const x = Number(n) || 0;
  return (x < 0 ? '-' : '') + '£' + Math.abs(x).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Periodo UC al que pertenece una fecha (inicio el día 7). */
function periodoDe_(fecha) {
  const filas = leerTabla_('Periodos');
  for (const p of filas) {
    if (fecha >= p['INICIO'] && fecha <= new Date(p['FIN'].getTime() + 86399000)) return p;
  }
  return null;
}

function periodoActual_() { return periodoDe_(new Date()); }

// ───────────────────────── Datos para el panel ─────────────────────────
function getPanelData(etiquetaPeriodo, negocio) {
  const periodos = leerTabla_('Periodos');
  const actual = etiquetaPeriodo || (periodoActual_() || periodos[0])['ETIQUETA'];
  const todos = actual === 'TODOS';
  const ing = filtrarNeg_(leerTabla_('Ingresos'), negocio);
  const gas = filtrarNeg_(leerTabla_('Gastos'), negocio);

  const ingP = ing.filter(r => (todos || r['PERIODO UC'] === actual) && r['ESTADO'] !== 'CANCELLED' && r['ID FACTURA'] !== '');
  const gasP = gas.filter(r => (todos || r['PERIODO UC'] === actual) && r['ID GASTO'] !== '');
  const suma = (a, k) => a.reduce((t, r) => t + (Number(r[k]) || 0), 0);

  const cats = {};
  gasP.forEach(r => { const k = r['CATEGORÍA UC'] || 'Sin categoría'; cats[k] = (cats[k] || 0) + (Number(r['SUBTOTAL']) || 0); });

  const ids = {};
  ing.forEach(r => { (ids[r['ID FACTURA']] = ids[r['ID FACTURA']] || []).push(r); });
  const facturas = Object.keys(ids).map(id => {
    const filas = ids[id];
    return {
      id: Number(id),
      num: numDe_(filas[0]),
      negocio: negDe_(filas[0]),
      cliente: filas[0]['CLIENTE'],
      fecha: fecha_(filas[0]['FECHA FACTURA']),
      evento: fecha_(filas[0]['FECHA EVENTO']),
      periodo: filas[0]['PERIODO UC'],
      total: suma(filas, 'SUBTOTAL'),
      estado: filas[0]['ESTADO']
    };
  }).sort((a, b) => b.id - a.id);

  return {
    periodos: ['TODOS'].concat(periodos.map(p => p['ETIQUETA'])),
    actual: actual,
    resumen: {
      ingresos: suma(ingP, 'SUBTOTAL'),
      gastos: suma(gasP, 'SUBTOTAL'),
      ganancia: suma(ingP, 'SUBTOTAL') - suma(gasP, 'SUBTOTAL'),
      pendiente: suma(ing.filter(r => r['ESTADO'] === 'PENDING'), 'SUBTOTAL'),
      nIngresos: ingP.length,
      nGastos: gasP.length
    },
    categorias: Object.keys(cats).map(k => ({ nombre: k, importe: cats[k] })).sort((a, b) => b.importe - a.importe),
    facturas: facturas,
    avisos: revisarDatos_()
  };
}

// ───────────────────────── Facturas en PDF ─────────────────────────
function construirFactura_(id) {
  const filas = leerTabla_('Ingresos').filter(r => Number(r['ID FACTURA']) === Number(id));
  if (!filas.length) throw new Error('No existe la factura ' + id + '.');
  const num = numDe_(filas[0]), neg = negocioPorId_(negDe_(filas[0]));
  if (filas[0]['ESTADO'] === 'CANCELLED') throw new Error('La factura ' + num + ' está cancelada: no se crea PDF ni se envía.');
  const cfg = config_();
  if (neg) {
    if (neg.nombreFactura.trim()) cfg.nombre = neg.nombreFactura.trim();
    if (neg.email) cfg.email = neg.email;
    if (neg.telefono) cfg.telefono = neg.telefono;
    // la nota: la de su negocio; el primer negocio, si no tiene, usa la de Ajustes (la de siempre)
    cfg.nota_factura = neg.nota || (neg.id === negPrimero_() ? (cfg.nota_factura || '') : '');
  }
  const fechaCol = neg ? FECHA_LINEA[neg.fechaLinea] : 'Date';
  const cli = leerTabla_('Clientes').find(c => c['NOMBRE'] === filas[0]['CLIENTE']) || {};
  const fechaFactura = filas[0]['FECHA FACTURA'];
  const vence = new Date(fechaFactura.getTime());
  vence.setDate(vence.getDate() + (Number(cfg.plazo_pago_dias) || 0));

  const lineas = filas.map(r => ({
    desc: r['DESCRIPCIÓN'],
    fecha: fechaCol ? fecha_(r['FECHA EVENTO']) : '',
    qty: r['CANTIDAD'],
    unidad: r['UNIDAD'],
    precio: libras_(r['PRECIO']),
    total: libras_(r['SUBTOTAL'])
  }));
  const total = filas.reduce((t, r) => t + (Number(r['SUBTOTAL']) || 0), 0);

  return {
    cfg: cfg,
    negocio: neg ? neg.id : '',
    f: {
      id: num,
      idInterno: Number(id),
      fechaCol: fechaCol,
      fecha: fecha_(fechaFactura),
      vencimiento: fecha_(vence),
      cliente: cli,
      clienteNombre: filas[0]['CLIENTE'],
      lineas: lineas,
      total: libras_(total),
      estado: filas[0]['ESTADO'],
      formaPago: filas[0]['FORMA DE PAGO']
    }
  };
}

/** En la app: datos de la factura para dibujar el PDF en el navegador o el teléfono. */
function getFacturaDatos(id, nota) {
  const d = construirFactura_(id);
  if (nota !== undefined && nota !== null) d.cfg.nota_factura = String(nota).trim();
  d.logo = getLogo_(prefLogo_(d.negocio)) || getLogo_() || LOGO_DEFECTO;
  d.carpeta = d.cfg.carpeta_facturas || 'Facturas PuntoBalance';
  d.nombreArchivo = 'INVOICE_' + d.f.id + '_' + String(d.f.clienteNombre).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  d.para = d.f.cliente['EMAIL'] || '';
  return d;
}

/** En la app: el resumen del periodo actual para mandarlo por correo desde el aparato. */
function getResumenActual() {
  const p = periodoActual_();
  if (!p) throw new Error('No encuentro el periodo actual en la hoja Periodos.');
  const r = resumenPeriodo_(p['ETIQUETA']);
  r.para = config_().email_resumen || '';
  r.avisos = revisarDatos_().map(a => a.texto);
  return r;
}

function pdfFactura_(id, nota) {
  const d = construirFactura_(id);
  if (nota !== undefined && nota !== null) d.cfg.nota_factura = String(nota).trim();
  const t = HtmlService.createTemplateFromFile('Factura');
  t.logo = getLogo_(prefLogo_(d.negocio)) || getLogo_() || LOGO_DEFECTO;
  t.cfg = d.cfg;
  t.f = d.f;
  const html = t.evaluate().getContent();
  const nombre = 'INVOICE_' + d.f.id + '_' + String(d.f.clienteNombre).trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const blob = Utilities.newBlob(html, 'text/html', nombre + '.html').getAs('application/pdf').setName(nombre + '.pdf');
  return { blob: blob, datos: d };
}

function carpeta_(nombre) {
  const it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}

/** Genera el PDF, lo guarda en Drive y devuelve el enlace. */
function generarFactura(id, nota) {
  const r = pdfFactura_(id, nota);
  const cfg = r.datos.cfg;
  const archivo = carpeta_(cfg.carpeta_facturas || 'Facturas DJ').createFile(r.blob);
  return { nombre: archivo.getName(), url: archivo.getUrl() };
}

/** Genera el PDF, lo guarda y lo envía al email del cliente (con copia a ti). */
function enviarFactura(id, nota) {
  const r = pdfFactura_(id, nota);
  const d = r.datos;
  const para = d.f.cliente['EMAIL'];
  if (!para) throw new Error('El cliente "' + d.f.clienteNombre + '" no tiene email en la hoja Clientes.');
  const archivo = carpeta_(d.cfg.carpeta_facturas || 'Facturas DJ').createFile(r.blob);
  MailApp.sendEmail({
    to: para,
    cc: d.cfg.email || '',
    subject: 'Invoice #' + d.f.id + ' – ' + d.cfg.nombre,
    htmlBody: '<p>Hello,</p><p>Please find attached invoice #' + esc_(d.f.id) + ' for ' + esc_(d.f.total) +
      ', due on ' + esc_(d.f.vencimiento) + '.</p><p>Kind regards,<br>' + esc_(d.cfg.nombre) + '</p>',
    attachments: [r.blob]
  });
  return { nombre: archivo.getName(), url: archivo.getUrl(), para: para };
}

// ───────────────────────── Revisión de datos ─────────────────────────
function revisarDatos_() {
  const av = [];
  const hoy = new Date();
  const ing = leerTabla_('Ingresos');
  const gas = leerTabla_('Gastos');
  const cli = leerTabla_('Clientes').map(c => c['NOMBRE']);

  ing.forEach(r => {
    const id = r['ID FACTURA'];
    if (!(r['FECHA FACTURA'] instanceof Date)) av.push({ nivel: 'error', texto: 'Factura ' + id + ': la fecha de factura no es una fecha válida.' });
    if (!(r['FECHA EVENTO'] instanceof Date)) av.push({ nivel: 'error', texto: 'Factura ' + id + ': falta la fecha del evento (sin ella no tiene periodo UC).' });
    if (r['ESTADO'] === 'CANCELLED') return;
    if (!(Number(r['PRECIO']) > 0)) av.push({ nivel: 'error', texto: 'Factura ' + id + ': falta el precio, el subtotal sale en £0.' });
    if (cli.indexOf(r['CLIENTE']) < 0) av.push({ nivel: 'error', texto: 'Factura ' + id + ': el cliente no está en la hoja Clientes.' });
    if (r['ESTADO'] === 'PENDING' && r['FECHA FACTURA'] instanceof Date) {
      const dias = Math.floor((hoy - r['FECHA FACTURA']) / 86400000);
      if (dias > 14) av.push({ nivel: 'aviso', texto: 'Factura ' + id + ' pendiente de cobro desde hace ' + dias + ' días.' });
    }
  });
  gas.forEach(r => {
    const id = r['ID GASTO'];
    if (!(r['FECHA'] instanceof Date)) av.push({ nivel: 'error', texto: 'Gasto ' + id + ': la fecha no es una fecha válida.' });
    if (!(Number(r['PRECIO']) > 0)) av.push({ nivel: 'error', texto: 'Gasto ' + id + ': falta el precio.' });
    if (!r['CATEGORÍA UC']) av.push({ nivel: 'error', texto: 'Gasto ' + id + ': falta la categoría UC.' });
  });

  // Periodos ya cerrados con filas sin procesar en UC
  const actual = periodoActual_();
  const sinProcesar = {};
  ing.concat(gas).forEach(r => {
    const p = r['PERIODO UC'];
    if (r['PROCESADO UC'] === 'NO' && p && (!actual || p !== actual['ETIQUETA'])) {
      const pp = leerTabla_('Periodos').find(x => x['ETIQUETA'] === p);
      if (pp && pp['FIN'] < hoy) sinProcesar[p] = (sinProcesar[p] || 0) + 1;
    }
  });
  Object.keys(sinProcesar).forEach(p =>
    av.push({ nivel: 'aviso', texto: p + ': ' + sinProcesar[p] + ' filas sin marcar como procesadas en UC.' }));

  return av;
}

function mostrarRevision() {
  const av = revisarDatos_();
  const ui = SpreadsheetApp.getUi();
  if (!av.length) return ui.alert('Todo en orden', 'No he encontrado nada que revisar.', ui.ButtonSet.OK);
  ui.alert('Revisión de datos (' + av.length + ')', av.map(a => '• ' + a.texto).join('\n'), ui.ButtonSet.OK);
}

// ───────────────────────── Resumen para Universal Credit ─────────────────────────
function resumenPeriodo_(etiqueta) {
  const ing = leerTabla_('Ingresos').filter(r => r['PERIODO UC'] === etiqueta && r['ESTADO'] !== 'CANCELLED');
  const gas = leerTabla_('Gastos').filter(r => r['PERIODO UC'] === etiqueta);
  const suma = (a) => a.reduce((t, r) => t + (Number(r['SUBTOTAL']) || 0), 0);
  const cats = {};
  gas.forEach(r => { const k = r['CATEGORÍA UC'] || 'Sin categoría'; cats[k] = (cats[k] || 0) + (Number(r['SUBTOTAL']) || 0); });
  const negs = negocios_();
  const porNegocio = negs.length > 1 ? negs.map(n => {
    const i = suma(ing.filter(r => negDe_(r) === n.id)), g = suma(gas.filter(r => negDe_(r) === n.id));
    return { nombre: n.nombre, ingresos: i, gastos: g, ganancia: i - g };
  }) : [];
  return { etiqueta: etiqueta, ingresos: suma(ing), gastos: suma(gas), ganancia: suma(ing) - suma(gas), cats: cats, nIng: ing.length, nGas: gas.length, porNegocio: porNegocio };
}

function htmlResumen_(r, avisos) {
  const filas = Object.keys(r.cats).map(k =>
    '<tr><td style="padding:6px 0;color:#1F2540">' + esc_(k) + '</td><td style="padding:6px 0;text-align:right;font-weight:600">' + libras_(r.cats[k]) + '</td></tr>').join('');
  const av = avisos.length
    ? '<p style="color:#B54708"><b>Antes de enviarlo a UC, revisa:</b><br>' + avisos.slice(0, 10).map(a => '• ' + esc_(a.texto)).join('<br>') + '</p>' : '';
  return '<div style="font-family:Arial,sans-serif;max-width:520px;color:#151A2D">' +
    '<h2 style="margin:0 0 4px">Resumen UC · ' + esc_(r.etiqueta) + '</h2>' +
    '<p style="color:#6B7194;margin:0 0 16px">Copia estas cifras en tu cuenta de Universal Credit.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:15px">' +
    '<tr><td style="padding:8px 0">Ingresos (' + r.nIng + ')</td><td style="text-align:right;font-weight:700">' + libras_(r.ingresos) + '</td></tr>' +
    '<tr><td style="padding:8px 0">Gastos (' + r.nGas + ')</td><td style="text-align:right;font-weight:700">' + libras_(r.gastos) + '</td></tr>' +
    '<tr style="border-top:1px solid #E3E6F0"><td style="padding:8px 0">Ganancia</td><td style="text-align:right;font-weight:700;color:' + (r.ganancia < 0 ? '#D92D20' : '#12B76A') + '">' + libras_(r.ganancia) + '</td></tr></table>' +
    '<h3 style="margin:20px 0 4px;font-size:14px">Gastos por categoría</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' + filas + '</table>' + av + '</div>';
}

function enviarResumen_(etiqueta) {
  const cfg = config_();
  const para = cfg.email_resumen;
  if (!para) throw new Error('Rellena email_resumen en la hoja Config.');
  const r = resumenPeriodo_(etiqueta);
  MailApp.sendEmail({ to: para, subject: 'Resumen UC · ' + etiqueta, htmlBody: htmlResumen_(r, revisarDatos_()) });
  return para;
}

function enviarResumenPeriodoActual() {
  const p = periodoActual_();
  if (!p) return SpreadsheetApp.getUi().alert('No encuentro el periodo actual en la hoja Periodos.');
  const para = enviarResumen_(p['ETIQUETA']);
  SpreadsheetApp.getActive().toast('Resumen enviado a ' + para, 'PuntoBalance', 5);
}

/** Lo ejecuta el disparador diario: el día 7 envía el periodo que acaba de cerrar. */
function enviarResumenSiToca() {
  const hoy = new Date();
  if (Number(Utilities.formatDate(hoy, TZ, 'd')) !== 7) return;
  const ayer = new Date(hoy.getTime() - 86400000);
  const p = periodoDe_(ayer);
  if (p) enviarResumen_(p['ETIQUETA']);
}

function instalarRecordatorio() {
  quitarRecordatorio(true);
  ScriptApp.newTrigger('enviarResumenSiToca').timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getUi().alert('Recordatorio activado',
    'El día 7 de cada mes, sobre las 8:00, recibirás por email el resumen del periodo UC que acaba de cerrar.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function quitarRecordatorio(silencioso) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'enviarResumenSiToca').forEach(t => ScriptApp.deleteTrigger(t));
  if (silencioso !== true) SpreadsheetApp.getActive().toast('Recordatorio desactivado', 'PuntoBalance', 4);
}

// ───────────────────────── Marcar como procesado ─────────────────────────
function marcarProcesadoDialogo() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Marcar periodo como procesado',
    'Escribe el periodo tal como aparece en la hoja (por ejemplo: 2026-sep (7 al 6)).\nSe marcarán como "SI" todos sus ingresos y gastos.', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const etiqueta = resp.getResponseText().trim();
  if (!leerTabla_('Periodos').some(p => p['ETIQUETA'] === etiqueta)) return ui.alert('Ese periodo no existe en la hoja Periodos.');
  const n = marcarProcesado_(etiqueta);
  SpreadsheetApp.getActive().toast(n + ' filas marcadas como procesadas', 'PuntoBalance', 5);
}

function marcarProcesado_(etiqueta) {
  let n = 0;
  [['Ingresos', 'PROCESADO UC'], ['Gastos', 'PROCESADO UC']].forEach(([hojaNombre, col]) => {
    const s = hoja_(hojaNombre);
    const v = s.getDataRange().getValues();
    const iPer = v[0].indexOf('PERIODO UC');
    const iCol = v[0].indexOf(col);
    for (let i = 1; i < v.length; i++) {
      if (v[i][iPer] === etiqueta && v[i][iCol] !== 'SI') { s.getRange(i + 1, iCol + 1).setValue('SI'); n++; }
    }
  });
  return n;
}

function marcarPeriodoProcesado(etiqueta) { return marcarProcesado_(etiqueta); }

// ───────────────────────── Formularios de entrada ─────────────────────────
function abrirFormulario(tab) { abrirApp_('form', tab || 'ingreso'); }
function abrirFormularioIngreso() { abrirFormulario('ingreso'); }
function abrirFormularioRegistros() { abrirFormulario('registros'); }
function abrirFormularioGasto() { abrirFormulario('gasto'); }
function abrirFormularioProveedor() { abrirFormulario('proveedor'); }
function abrirFormularioCliente() { abrirFormulario('cliente'); }
function abrirFormularioCategoria() { abrirFormulario('categoria'); }
function abrirFormularioPeriodos() { abrirFormulario('periodos'); }
function abrirFormularioAjustes() { abrirFormulario('ajustes'); }

function iso_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }

function fechaIso_(s, campo) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) throw new Error('Falta la fecha (' + campo + ').');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function numero_(v, campo, minimo) {
  const n = Number(String(v).replace(',', '.'));
  if (v === '' || v === null || isNaN(n)) throw new Error('Revisa el número en "' + campo + '".');
  if (n < minimo) throw new Error('"' + campo + '" no puede ser menor que ' + minimo + '.');
  return n;
}

function siguienteId_(nombreHoja) {
  const s = hoja_(nombreHoja);
  const v = s.getRange(2, 1, Math.max(s.getLastRow() - 1, 1), 1).getValues();
  return v.reduce((m, r) => (typeof r[0] === 'number' && r[0] > m ? r[0] : m), 0) + 1;
}

/** Primera fila con la columna A vacía. Si no queda ninguna, añade una y copia las fórmulas de las columnas I:J. */
function filaLibre_(s, conFormulas) {
  const v = s.getRange(2, 1, Math.max(s.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < v.length; i++) if (v[i][0] === '' || v[i][0] === null) return i + 2;
  const r = s.getLastRow() + 1;
  return r;
}

/** SUBTOTAL y PERIODO UC calculados aquí (antes eran fórmulas de la hoja). */
function calcFila_(precio, cantidad, fecha, estado) {
  const sub = estado === 'CANCELLED' ? 0 : Math.round(Number(precio) * Number(cantidad) * 100) / 100;
  const p = fecha instanceof Date ? periodoDe_(fecha) : null;
  return [sub, p ? p['ETIQUETA'] : ''];
}

function getFormData() {
  return {
    hoy: iso_(new Date()),
    clientes: leerTabla_('Clientes').map(c => c['NOMBRE']),
    proveedores: leerTabla_('Proveedores').map(c => c['NOMBRE']),
    categorias: leerTabla_('Categorias').map(c => c['NOMBRE']),
    idIngreso: siguienteId_('Ingresos'),
    idGasto: siguienteId_('Gastos'),
    nCategorias: leerTabla_('Categorias').length,
    catMax: CAT_MAX,
    nPeriodos: leerTabla_('Periodos').length,
    perMax: PERIODOS_MAX,
    ultimoPeriodo: (leerTabla_('Periodos').slice(-1)[0] || {})['ETIQUETA'] || '',
    periodos: leerTabla_('Periodos').map(p => ({ ini: iso_(p['INICIO']), fin: iso_(p['FIN']), etiqueta: p['ETIQUETA'] })),
    negocio: getNegocio(),
    negocios: negocios_().map(n => Object.assign({ tipoInfo: NEGOCIOS[n.tipo] || NEGOCIOS.dj, numSig: siguienteNum_(n.id) }, n)),
    tipos: Object.keys(NEGOCIOS).map(k => ({ clave: k, nombre: NEGOCIOS[k].nombre }))
  };
}

function conBloqueo_(fn) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function guardarIngreso(o) {
  return conBloqueo_(() => {
    const clientes = leerTabla_('Clientes').map(c => c['NOMBRE']);
    if (clientes.indexOf(o.cliente) < 0) throw new Error('Elige un cliente de la lista. Si es nuevo, añádelo primero en la pestaña Cliente.');
    const precio = numero_(o.precio, 'Precio', 0);
    const cantidad = numero_(o.cantidad, 'Cantidad', 0.01);
    const neg = negocioPorId_(o.negocio || negPrimero_());
    if (!neg) throw new Error('Elige de qué negocio es este ingreso.');
    const s = hoja_('Ingresos');
    const id = siguienteId_('Ingresos');
    const num = siguienteNum_(neg.id);
    const r = filaLibre_(s, true);
    const fe = fechaIso_(o.fechaEvento, 'fecha del evento');
    const calc = calcFila_(precio, cantidad, fe, o.estado);
    s.getRange(r, 1, 1, 13).setValues([[id, fechaIso_(o.fechaFactura, 'fecha de factura'), o.cliente,
      String(o.descripcion || '').trim() || (NEGOCIOS[neg.tipo] || NEGOCIOS.dj).desc, fe, o.unidad, precio, cantidad, calc[0], calc[1], o.formaPago, o.estado, 'NO']]);
    s.getRange(r, colDe_('Ingresos', 'NEGOCIO')).setValue(neg.id);
    s.getRange(r, colDe_('Ingresos', 'Nº FACTURA')).setValue(num);
    SpreadsheetApp.flush();
    return { id: id, num: num, subtotal: calc[0], periodo: calc[1] };
  });
}

function guardarGasto(o) {
  return conBloqueo_(() => {
    let proveedor = String(o.proveedor || '').trim();
    if (!proveedor) throw new Error('Falta el proveedor.');
    const cats = leerTabla_('Categorias').map(c => c['NOMBRE']);
    if (cats.indexOf(o.categoria) < 0) throw new Error('Elige una categoría de la lista.');
    const precio = numero_(o.precio, 'Precio', 0);
    const cantidad = numero_(o.cantidad, 'Cantidad', 0.01);
    const fecha = fechaIso_(o.fecha, 'fecha del gasto');

    // Si el proveedor no existe, se añade a la lista automáticamente.
    const existente = leerTabla_('Proveedores').map(p => p['NOMBRE']).find(n => String(n).toLowerCase() === proveedor.toLowerCase());
    if (existente) proveedor = existente; else anadirProveedor_(proveedor, '');

    const neg = negocioPorId_(o.negocio || negPrimero_());
    if (!neg) throw new Error('Elige de qué negocio es este gasto.');
    const s = hoja_('Gastos');
    const id = siguienteId_('Gastos');
    const r = filaLibre_(s, true);
    const calc = calcFila_(precio, cantidad, fecha, '');
    s.getRange(r, 1, 1, 12).setValues([[id, fecha, proveedor, String(o.descripcion || '').trim(), o.categoria, cantidad, o.unidad, precio, calc[0], calc[1], String(o.notas || '').trim(), 'NO']]);
    s.getRange(r, colDe_('Gastos', 'NEGOCIO')).setValue(neg.id);
    SpreadsheetApp.flush();
    return { id: id, subtotal: calc[0], periodo: calc[1], proveedorNuevo: !existente };
  });
}

function anadirProveedor_(nombre, notas) {
  const s = hoja_('Proveedores');
  const r = filaLibre_(s, false);
  s.getRange(r, 1, 1, 2).setValues([[nombre, notas || '']]);
}

function guardarProveedor(nombre, notas) {
  return conBloqueo_(() => {
    nombre = String(nombre || '').trim();
    if (!nombre) throw new Error('Escribe el nombre del proveedor.');
    if (leerTabla_('Proveedores').some(p => String(p['NOMBRE']).toLowerCase() === nombre.toLowerCase())) throw new Error('Ese proveedor ya existe.');
    anadirProveedor_(nombre, notas);
    return { nombre: nombre };
  });
}

function guardarCliente(o) {
  return conBloqueo_(() => {
    const nombre = String(o.nombre || '').trim();
    if (!nombre) throw new Error('Escribe el nombre del cliente.');
    if (leerTabla_('Clientes').some(c => String(c['NOMBRE']).toLowerCase() === nombre.toLowerCase())) throw new Error('Ese cliente ya existe.');
    const s = hoja_('Clientes');
    const r = filaLibre_(s, false);
    s.getRange(r, 1, 1, 6).setValues([[nombre, o.direccion || '', o.ciudad || '', o.postcode || '', o.telefono || '', o.email || '']]);
    return { nombre: nombre };
  });
}

function marcarFacturaPagada(id) {
  return conBloqueo_(() => {
    const s = hoja_('Ingresos');
    const v = s.getDataRange().getValues();
    let n = 0;
    for (let i = 1; i < v.length; i++) if (Number(v[i][0]) === Number(id)) { s.getRange(i + 1, 12).setValue('PAID'); n++; }
    return n;
  });
}

// ───────────────────────── Categorías, periodos y ajustes ─────────────────────────
function guardarCategoria(nombre, descripcion) {
  return conBloqueo_(() => {
    nombre = String(nombre || '').trim();
    if (!nombre) throw new Error('Escribe el nombre de la categoría.');
    const filas = leerTabla_('Categorias');
    if (filas.some(c => String(c['NOMBRE']).toLowerCase() === nombre.toLowerCase())) throw new Error('Esa categoría ya existe.');
    if (filas.length >= CAT_MAX) throw new Error('El panel tiene espacio para ' + CAT_MAX + ' categorías y ya las has usado todas.');
    const s = hoja_('Categorias');
    const r = filaLibre_(s, false);
    s.getRange(r, 1, 1, 2).setValues([[nombre, String(descripcion || '').trim()]]);
    return { nombre: nombre };
  });
}

/** Añade los n periodos siguientes al último que haya en la hoja Periodos (del 7 al 6). */
/** Un periodo que empieza el día «dia» del mes m (0-11) del año y. Día 1 = mes natural. */
function periodoNuevo_(y, m, dia) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fin = dia === 1 ? new Date(y, m + 1, 0) : new Date(y, m + 1, dia - 1);
  return [new Date(y, m, dia), fin, y + '-' + meses[m] + (dia === 1 ? '' : ' (' + dia + ' al ' + fin.getDate() + ')')];
}

function anadirPeriodos(n) {
  return conBloqueo_(() => {
    n = Math.floor(Number(n));
    if (!(n >= 1 && n <= 36)) throw new Error('Elige entre 1 y 36 periodos.');
    const s = hoja_('Periodos');
    const filas = leerTabla_('Periodos');
    if (filas.length + n > PERIODOS_MAX)
      throw new Error('El panel tiene espacio para ' + PERIODOS_MAX + ' periodos y ya hay ' + filas.length + '. Puedes añadir como máximo ' + (PERIODOS_MAX - filas.length) + '.');
    const hoy = new Date();
    const ultimo = filas.reduce((m, p) => (p['INICIO'] > m ? p['INICIO'] : m), null);
    const dia = ultimo ? ultimo.getDate() : (Number(config_().dia_inicio_periodo) || 1);
    let y = ultimo ? ultimo.getFullYear() : hoy.getFullYear(), m = ultimo ? ultimo.getMonth() : hoy.getMonth() - 1;
    const nuevos = [];
    for (let i = 0; i < n; i++) {
      m++;
      if (m > 11) { m = 0; y++; }
      nuevos.push(periodoNuevo_(y, m, dia));
    }
    nuevos.forEach(f => { const r = filaLibre_(s, false); s.getRange(r, 1, 1, 3).setValues([f]); s.getRange(r + 1, 5).setValue(f[2]); });
    return { anadidos: n, ultimo: nuevos[n - 1][2] };
  });
}

/** Nota al pie guardada en Ajustes (se muestra en el aviso antes de crear el PDF). */
function getNotaFactura(id) {
  if (id) { try { return String(construirFactura_(id).cfg.nota_factura || ''); } catch (e) { } }
  return String(config_().nota_factura || '');
}

/** «Guardar esta nota para las próximas»: se guarda en el negocio de esa factura (5.0.0-alpha9). */
function guardarNotaNegocio(id, nota) {
  const filas = leerTabla_('Ingresos').filter(r => Number(r['ID FACTURA']) === Number(id));
  const neg = filas.length ? negocioPorId_(negDe_(filas[0])) : negocioPorId_(negPrimero_());
  if (!neg) return false;
  guardarNegocioDatos(Object.assign({}, neg, { nota: String(nota || '') }));
  return true;
}

function getAjustes() {
  return hoja_('Config').getDataRange().getValues().slice(1).filter(r => r[0] && r[0] !== 'color_factura')
    .map(r => ({ clave: r[0], valor: r[1], desc: r[2] }));
}

function guardarAjustes(cambios) {
  return conBloqueo_(() => {
    const s = hoja_('Config');
    const v = s.getDataRange().getValues();
    let n = 0;
    for (let i = 1; i < v.length; i++) {
      const k = v[i][0];
      if (k && Object.prototype.hasOwnProperty.call(cambios, k) && String(cambios[k]) !== String(v[i][1])) {
        const nuevo = k === 'plazo_pago_dias' ? numero_(cambios[k], 'Días para pagar', 0) : String(cambios[k]).trim();
        s.getRange(i + 1, 2).setValue(nuevo);
        n++;
      }
    }
    return n;
  });
}

// ───────────────────────── Dashboard (escritorio y móvil) ─────────────────────────
/** Hoja de cálculo activa; si se ejecuta como aplicación web, usa la guardada al abrir la hoja. */
function ss_() {
  let a = null;
  try { a = SpreadsheetApp.getActive(); } catch (e) {}
  if (a) return a;
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (!id) throw new Error('Abre la hoja de cálculo una vez para activar el dashboard web.');
  return SpreadsheetApp.openById(id);
}

/** La app en pantalla completa (enlace web). Opcional: ?vista=dashboard | panel | form (&tab=ingreso, gasto, registros…) */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const vista = { inicio: 'inicio', dashboard: 'dashboard', panel: 'panel', impuestos: 'impuestos', form: 'form', formulario: 'form' }[p.vista] || 'inicio';
  const t = HtmlService.createTemplateFromFile('Index');
  t.vista = vista; t.tab = p.tab || ''; t.ver = VERSION; t.fecha = VERSION_FECHA;
  const out = t.evaluate().setTitle('PuntoBalance').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  if (ICONO_URL) out.setFaviconUrl(ICONO_URL);
  return out;
}

function abrirDashboard() { abrirApp_('dashboard', ''); }

function mostrarEnlaceWeb() {
  // El enlace /exec se pega una sola vez (Implementar → Administrar implementaciones → copiar URL).
  const url = PropertiesService.getScriptProperties().getProperty('URL_WEB') || '';
  const base = '<div style="font:14px Arial;line-height:1.5;color:#1F2540">';
  const cuerpo = url
    ? base + '<p><b>Tu app en pantalla completa</b> (la hoja queda solo como base de datos):</p>' +
      '<p><a href="' + esc_(url) + '" target="_blank" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-weight:bold">Abrir la app</a></p>' +
      '<p style="color:#555">Guárdala en favoritos del navegador y úsala como tu pantalla principal. Se abre en una pestaña normal: puedes agrandarla, moverla o ponerla a pantalla completa.</p>' +
      '<p style="color:#555;font-size:12px">Cuando cambies el código, ve a <b>Implementar → Administrar implementaciones</b>, pulsa el lápiz y elige <b>Nueva versión → Implementar</b>. ' +
      '<a href="#" onclick="google.script.run.cambiarEnlaceWeb();return false;">Cambiar el enlace guardado</a></p></div>'
    : base + '<p><b>Pega aquí el enlace de tu app web</b> (solo una vez):</p>' +
      '<p style="color:#555;font-size:13px">En Apps Script ve a <b>Implementar → Administrar implementaciones</b>, pulsa el icono de copiar junto a la URL de la aplicación web (termina en /exec) y pégala abajo.</p>' +
      '<input id="u" placeholder="https://script.google.com/macros/s/…/exec" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:8px;font:13px Arial">' +
      '<p id="m" style="color:#D92D20;font-size:13px;min-height:18px;margin:6px 0"></p>' +
      '<button onclick="var b=this;b.disabled=true;google.script.run.withSuccessHandler(function(){google.script.run.mostrarEnlaceWeb();}).withFailureHandler(function(e){b.disabled=false;document.getElementById(\'m\').textContent=e.message.replace(/^Exception: /,\'\');}).guardarEnlaceWeb(document.getElementById(\'u\').value)" ' +
      'style="background:#4F46E5;color:#fff;border:0;padding:11px 18px;border-radius:9px;font:bold 14px Arial;cursor:pointer">Guardar enlace</button></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(cuerpo).setWidth(520).setHeight(url ? 330 : 330), 'PuntoBalance · App en pantalla completa');
}

function guardarEnlaceWeb(url) {
  url = String(url || '').trim();
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^\/]+|a\/[^\/]+\/macros|macros)\/s\/[\w-]+\/exec$/.test(url)) {
    throw new Error('Ese enlace no es válido. Debe empezar con https://script.google.com/macros/s/ y terminar en /exec.');
  }
  PropertiesService.getScriptProperties().setProperty('URL_WEB', url);
}

function cambiarEnlaceWeb() {
  PropertiesService.getScriptProperties().deleteProperty('URL_WEB');
  mostrarEnlaceWeb();
}

/** Datos en bruto para el dashboard; la página calcula todo en el navegador. */
function getDashboardData() {
  const n = v => Number(v) || 0;
  const f = v => (v instanceof Date ? iso_(v) : '');
  const periodos = leerTabla_('Periodos').filter(p => p['INICIO'] instanceof Date && p['FIN'] instanceof Date)
    .map(p => ({ etiqueta: String(p['ETIQUETA']), ini: iso_(p['INICIO']), fin: iso_(p['FIN']) }));
  const ingresos = leerTabla_('Ingresos').filter(r => r['ESTADO'] !== 'CANCELLED').map(r => ({
    id: n(r['ID FACTURA']), fecha: f(r['FECHA EVENTO']), factura: f(r['FECHA FACTURA']),
    cliente: String(r['CLIENTE'] || ''), desc: String(r['DESCRIPCIÓN'] || ''), total: n(r['SUBTOTAL']),
    estado: String(r['ESTADO'] || ''), periodo: String(r['PERIODO UC'] || ''), pago: String(r['FORMA DE PAGO'] || ''),
    negocio: negDe_(r), num: numDe_(r)
  }));
  const gastos = leerTabla_('Gastos').map(r => ({
    id: n(r['ID GASTO']), fecha: f(r['FECHA']), proveedor: String(r['PROVEEDOR'] || ''), desc: String(r['DESCRIPCIÓN'] || ''),
    categoria: String(r['CATEGORÍA UC'] || ''), total: n(r['SUBTOTAL']), periodo: String(r['PERIODO UC'] || ''), negocio: negDe_(r)
  }));
  return { negocios: negocios_(), hoy: iso_(new Date()), actualizado: Utilities.formatDate(new Date(), TZ, 'HH:mm'), periodos: periodos, ingresos: ingresos, gastos: gastos };
}

// ───────────────────────── Editar y eliminar registros ─────────────────────────
function cfgHoja_(tipo) {
  return tipo === 'ingreso' ? { hoja: 'Ingresos', id: 'ID FACTURA' } : { hoja: 'Gastos', id: 'ID GASTO' };
}

function filaDe_(s, id) {
  const v = s.getRange(2, 1, Math.max(s.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < v.length; i++) if (typeof v[i][0] === 'number' && v[i][0] === Number(id)) return i + 2;
  throw new Error('No encuentro el registro ' + id + '. Puede que ya se haya eliminado.');
}

/** Lista de ingresos o gastos para buscar, del más reciente al más antiguo. */
function listarRegistros(tipo) {
  const c = cfgHoja_(tipo);
  const f = v => (v instanceof Date ? iso_(v) : '');
  return leerTabla_(c.hoja).map(r => tipo === 'ingreso'
    ? { id: Number(r[c.id]), num: numDe_(r), negocio: negDe_(r), fecha: f(r['FECHA EVENTO']), titulo: String(r['CLIENTE'] || ''), detalle: String(r['DESCRIPCIÓN'] || ''), total: Number(r['SUBTOTAL']) || 0, estado: String(r['ESTADO'] || '') }
    : { id: Number(r[c.id]), num: String(r[c.id]), negocio: negDe_(r), fecha: f(r['FECHA']), titulo: String(r['PROVEEDOR'] || ''), detalle: String(r['DESCRIPCIÓN'] || ''), total: Number(r['SUBTOTAL']) || 0, estado: '' }
  ).sort((a, b) => b.id - a.id);
}

/** Devuelve un registro con la misma forma que usa el formulario. */
function getRegistro(tipo, id) {
  const c = cfgHoja_(tipo);
  const r = leerTabla_(c.hoja).find(x => Number(x[c.id]) === Number(id));
  if (!r) throw new Error('No encuentro el registro ' + id + '.');
  const f = v => (v instanceof Date ? iso_(v) : '');
  return tipo === 'ingreso'
    ? { id: Number(id), num: numDe_(r), negocio: negDe_(r), cliente: r['CLIENTE'], descripcion: r['DESCRIPCIÓN'], fechaEvento: f(r['FECHA EVENTO']), fechaFactura: f(r['FECHA FACTURA']),
        unidad: r['UNIDAD'], precio: r['PRECIO'], cantidad: r['CANTIDAD'], formaPago: r['FORMA DE PAGO'], estado: r['ESTADO'] }
    : { id: Number(id), negocio: negDe_(r), fecha: f(r['FECHA']), proveedor: r['PROVEEDOR'], descripcion: r['DESCRIPCIÓN'], categoria: r['CATEGORÍA UC'],
        unidad: r['UNIDAD'], cantidad: r['CANTIDAD'], precio: r['PRECIO'], notas: r['NOTAS'] };
}

function actualizarIngreso(id, o) {
  return conBloqueo_(() => {
    if (leerTabla_('Clientes').map(c => c['NOMBRE']).indexOf(o.cliente) < 0) throw new Error('Elige un cliente de la lista.');
    const precio = numero_(o.precio, 'Precio', 0), cantidad = numero_(o.cantidad, 'Cantidad', 0.01);
    const ff = fechaIso_(o.fechaFactura, 'fecha de factura'), fe = fechaIso_(o.fechaEvento, 'fecha del evento');
    const s = hoja_('Ingresos'), r = filaDe_(s, id);
    const antes = leerTabla_('Ingresos').find(x => Number(x['ID FACTURA']) === Number(id)) || {};
    const neg = negocioPorId_(o.negocio || negDe_(antes)) || negocioPorId_(negPrimero_());
    // No toca ID ni PROCESADO UC. SUBTOTAL y PERIODO se recalculan. Si cambia de negocio, la factura toma el número de ese negocio.
    const calc = calcFila_(precio, cantidad, fe, o.estado);
    s.getRange(r, 2, 1, 11).setValues([[ff, o.cliente, String(o.descripcion || '').trim() || (NEGOCIOS[neg.tipo] || NEGOCIOS.dj).desc, fe, o.unidad, precio, cantidad, calc[0], calc[1], o.formaPago, o.estado]]);
    let num = numDe_(antes);
    if (neg.id !== negDe_(antes)) { num = siguienteNum_(neg.id); s.getRange(r, colDe_('Ingresos', 'Nº FACTURA')).setValue(num); }
    s.getRange(r, colDe_('Ingresos', 'NEGOCIO')).setValue(neg.id);
    SpreadsheetApp.flush();
    return { id: Number(id), num: num, subtotal: calc[0], periodo: calc[1] };
  });
}

function actualizarGasto(id, o) {
  return conBloqueo_(() => {
    let proveedor = String(o.proveedor || '').trim();
    if (!proveedor) throw new Error('Falta el proveedor.');
    if (leerTabla_('Categorias').map(c => c['NOMBRE']).indexOf(o.categoria) < 0) throw new Error('Elige una categoría de la lista.');
    const precio = numero_(o.precio, 'Precio', 0), cantidad = numero_(o.cantidad, 'Cantidad', 0.01);
    const fecha = fechaIso_(o.fecha, 'fecha del gasto');
    const existente = leerTabla_('Proveedores').map(p => p['NOMBRE']).find(n => String(n).toLowerCase() === proveedor.toLowerCase());
    if (existente) proveedor = existente; else anadirProveedor_(proveedor, '');
    const s = hoja_('Gastos'), r = filaDe_(s, id);
    const calc = calcFila_(precio, cantidad, fecha, '');
    s.getRange(r, 2, 1, 10).setValues([[fecha, proveedor, String(o.descripcion || '').trim(), o.categoria, cantidad, o.unidad, precio, calc[0], calc[1], String(o.notas || '').trim()]]);
    if (o.negocio && negocioPorId_(o.negocio)) s.getRange(r, colDe_('Gastos', 'NEGOCIO')).setValue(o.negocio);
    SpreadsheetApp.flush();
    return { id: Number(id), subtotal: calc[0], periodo: calc[1] };
  });
}

/** Vacía las columnas que se escriben a mano; las fórmulas de la fila se quedan y la fila se reutiliza. */
function eliminarRegistro(tipo, id) {
  return conBloqueo_(() => {
    const s = hoja_(cfgHoja_(tipo).hoja), r = filaDe_(s, id);
    s.getRange(r, 1, 1, Math.max(s.getLastColumn(), tipo === 'ingreso' ? 13 : 12)).clearContent();
    return { id: Number(id) };
  });
}


/** Añade la opción TODOS a la lista de periodos del Panel de la hoja (sin tocar tus datos). */
function activarOpcionTodos_() {
  const p = hoja_('Panel'), per = hoja_('Periodos');
  // 1) Columna E de Periodos: TODOS + todas las etiquetas
  const etiquetas = per.getRange(2, 3, Math.max(per.getLastRow() - 1, 1), 1).getValues().map(r => r[0]).filter(x => x !== '');
  per.getRange(1, 5).setValue('LISTA PANEL');
  per.getRange(2, 5, PERIODOS_MAX + 2, 1).clearContent();
  per.getRange(2, 5, etiquetas.length + 1, 1).setValues([['TODOS']].concat(etiquetas.map(e => [e])));
  // 2) Lista desplegable del Panel
  const regla = SpreadsheetApp.newDataValidation()
    .requireValueInRange(per.getRange(2, 5, PERIODOS_MAX + 1, 1), true).setAllowInvalid(false).build();
  p.getRange('C5').setDataValidation(regla);
  // 3) Fórmulas de las tarjetas
  const T = '$C$5="TODOS"';
  p.getRange('B7:C7').setFormulas([['=IF(' + T + ',"Ingresos totales","Ingresos del periodo")', '=IF(' + T + ',"Gastos totales","Gastos del periodo")']]);
  p.getRange('D7:E7').setValues([['Ganancia', 'Pendiente de cobro']]);
  p.getRange('B8:C8').setFormulas([[
    '=IF(' + T + ',SUM(Ingresos!$I:$I),SUMIFS(Ingresos!$I:$I,Ingresos!$J:$J,$C$5))',
    '=IF(' + T + ',SUM(Gastos!$I:$I),SUMIFS(Gastos!$I:$I,Gastos!$J:$J,$C$5))']]);
  p.getRange('B9:C9').setFormulas([[
    '=IF(' + T + ',COUNT(Ingresos!$I:$I),COUNTIFS(Ingresos!$J:$J,$C$5))&" facturas"',
    '=IF(' + T + ',COUNT(Gastos!$I:$I),COUNTIFS(Gastos!$J:$J,$C$5))&" gastos"']]);
  p.getRange('B11').setFormula('=IF(' + T + ',"Gastos de todos los periodos por categoría","Gastos del periodo por categoría")');
  // 4) Categorías (filas 14 a 28)
  const f = [];
  for (let r = 14; r <= 28; r++)
    f.push(['=IF($B' + r + '="","",IF($C$5="TODOS",SUMIFS(Gastos!$I:$I,Gastos!$E:$E,$B' + r + '),SUMIFS(Gastos!$I:$I,Gastos!$E:$E,$B' + r + ',Gastos!$J:$J,$C$5)))']);
  p.getRange(14, 3, 15, 1).setFormulas(f);
}


/** Aplica las novedades a tu hoja actual sin tocar tus datos: opción TODOS y estado CANCELLED. */
function actualizarLibro() {
  activarOpcionTodos_();
  activarCancelada_();
  actualizarColores_();
  SpreadsheetApp.getUi().alert('Listo', 'Libro actualizado: ya tienes TODOS en el Panel, el estado CANCELLED y los colores de ESTADO y PROCESADO UC.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function activarCancelada_() {
  const s = hoja_('Ingresos');
  const ultima = 201;
  // SUBTOTAL: 0 si la factura está cancelada (el precio y la cantidad se conservan)
  const f = [];
  for (let r = 2; r <= ultima; r++) f.push(['=IF($A' + r + '="","",IF($L' + r + '="CANCELLED",0,N(G' + r + ')*N(H' + r + ')))']);
  s.getRange(2, 9, f.length, 1).setFormulas(f);
  // Lista de estados
  const regla = SpreadsheetApp.newDataValidation().requireValueInList(['PAID', 'PENDING', 'CANCELLED'], true).setAllowInvalid(false).build();
  s.getRange(2, 12, ultima - 1, 1).setDataValidation(regla);
  // Color gris tachado para CANCELLED
  const rango = s.getRange(2, 12, ultima - 1, 1);
  const reglas = s.getConditionalFormatRules().filter(r => {
    const c = r.getBooleanCondition(); return !(c && c.getCriteriaValues && String(c.getCriteriaValues()[0]) === 'CANCELLED');
  });
  reglas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('CANCELLED').setBackground('#E5E7EB').setFontColor('#4B5563').setStrikethrough(true).setBold(true).setRanges([rango]).build());
  s.setConditionalFormatRules(reglas);
  // El Panel no cuenta las canceladas
  const p = hoja_('Panel'), T = '$C$5="TODOS"';
  p.getRange('B9').setFormula('=IF(' + T + ',COUNTIFS(Ingresos!$L:$L,"<>CANCELLED",Ingresos!$I:$I,">=0"),COUNTIFS(Ingresos!$J:$J,$C$5,Ingresos!$L:$L,"<>CANCELLED"))&" facturas"');
}


/** Colores de letra: PAID verde, PENDING naranja, CANCELLED gris tachado; PROCESADO UC: SI verde, NO rojo. */
function actualizarColores_() {
  const VERDE = '#15803D', NARANJA = '#EA580C', ROJO = '#D92D20';
  const texto = (rango, t, color, extra) => {
    const b = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t).setFontColor(color).setBold(true).setRanges([rango]);
    if (extra) b.setBackground('#E5E7EB').setStrikethrough(true);
    return b.build();
  };
  const hoja = (nombre, columnas, crear) => {
    const s = hoja_(nombre), filas = Math.max(s.getMaxRows() - 1, 200);
    const toca = r => r.getRanges().some(g => columnas.some(c => g.getColumn() <= c && c <= g.getLastColumn()));
    const reglas = s.getConditionalFormatRules().filter(r => !toca(r));
    crear(s, filas).forEach(r => reglas.push(r));
    s.setConditionalFormatRules(reglas);
  };
  hoja('Ingresos', [12, 13], (s, n) => {
    const estado = s.getRange(2, 12, n, 1), proc = s.getRange(2, 13, n, 1);
    return [texto(estado, 'PAID', VERDE), texto(estado, 'PENDING', NARANJA), texto(estado, 'CANCELLED', '#4B5563', true),
            texto(proc, 'SI', VERDE), texto(proc, 'NO', ROJO)];
  });
  hoja('Gastos', [12], (s, n) => {
    const proc = s.getRange(2, 12, n, 1);
    return [texto(proc, 'SI', VERDE), texto(proc, 'NO', ROJO)];
  });
}


/* ====== Logo de la app (se guarda en las propiedades del script, en trozos) ====== */
const LOGO_TROZO = 8000;
// Pega aquí el enlace del icono (ver instrucciones). Si lo dejas vacío, no se pone icono.
const ICONO_URL = '';
// Logo genérico para la factura cuando no has subido uno propio.
const LOGO_DEFECTO = 'data:image/png;base64,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';

function getLogo_(pref) {
  pref = pref || 'LOGO_';
  const pr = PropertiesService.getScriptProperties();
  const n = Number(pr.getProperty(pref + 'N') || 0);
  if (!n) return '';
  let s = '';
  for (let i = 0; i < n; i++) s += pr.getProperty(pref + i) || '';
  return /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(s) ? s : '';
}

function guardarLogo(dataUrl, pref) {
  pref = pref || 'LOGO_';
  const s = String(dataUrl || '');
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(s)) throw new Error('Esa imagen no es válida. Usa un PNG o JPG.');
  if (s.length > 250000) throw new Error('La imagen es demasiado grande.');
  quitarLogo_(pref);
  const pr = PropertiesService.getScriptProperties();
  const obj = {};
  let n = 0;
  for (let i = 0; i < s.length; i += LOGO_TROZO) obj[pref + n++] = s.substr(i, LOGO_TROZO);
  obj[pref + 'N'] = String(n);
  pr.setProperties(obj);
  return true;
}

function quitarLogo_(pref) {
  pref = pref || 'LOGO_';
  const pr = PropertiesService.getScriptProperties();
  const n = Number(pr.getProperty(pref + 'N') || 0);
  for (let i = 0; i < n; i++) pr.deleteProperty(pref + i);
  pr.deleteProperty(pref + 'N');
}
function quitarLogo() { quitarLogo_(); return true; }


/* ====== Movimientos (historial con filtros) ====== */
function getMovimientos(tipo) {
  const f = v => (v instanceof Date ? iso_(v) : '');
  if (tipo === 'ingreso') {
    return leerTabla_('Ingresos').filter(r => r['ID FACTURA'] !== '' && r['ESTADO'] !== 'CANCELLED').map(r => ({
      id: Number(r['ID FACTURA']), fecha: f(r['FECHA EVENTO']), cliente: String(r['CLIENTE'] || ''), desc: String(r['DESCRIPCIÓN'] || ''),
      unidad: String(r['UNIDAD'] || ''), precio: Number(r['PRECIO']) || 0, cantidad: Number(r['CANTIDAD']) || 0,
      pago: String(r['FORMA DE PAGO'] || ''), estado: String(r['ESTADO'] || ''), periodo: String(r['PERIODO UC'] || ''), total: Number(r['SUBTOTAL']) || 0,
      negocio: negDe_(r), num: numDe_(r), factura: f(r['FECHA FACTURA']), procesado: String(r['PROCESADO UC'] || '')
    })).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
  }
  return leerTabla_('Gastos').filter(r => r['ID GASTO'] !== '').map(r => ({
    id: Number(r['ID GASTO']), fecha: f(r['FECHA']), prov: String(r['PROVEEDOR'] || ''), desc: String(r['DESCRIPCIÓN'] || ''),
    cat: String(r['CATEGORÍA UC'] || ''), unidad: String(r['UNIDAD'] || ''), cantidad: Number(r['CANTIDAD']) || 0, precio: Number(r['PRECIO']) || 0,
    notas: String(r['NOTAS'] || ''), periodo: String(r['PERIODO UC'] || ''), total: Number(r['SUBTOTAL']) || 0,
    negocio: negDe_(r), num: String(r['ID GASTO']), procesado: String(r['PROCESADO UC'] || '')
  })).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id));
}

/* ====== Impuestos (estimación orientativa para el HMRC) ====== */
// Cifras del año fiscal 2026-27 (Reino Unido; Gales usa las mismas tasas que Inglaterra). Cámbialas aquí si cambian.
const FISCAL = {
  PA: 12570,            // Personal Allowance (libre de impuestos)
  BASICA_ANCHO: 37700,  // ancho de la banda básica (20 %)
  ALTA_HASTA: 125140,   // fin de la banda alta (40 %); por encima 45 %
  NI4_INF: 12570, NI4_SUP: 50270, NI4_TASA: 0.06, NI4_TASA_SUP: 0.02,
  TRADING: 1000         // Trading Allowance
};

function impuestoRenta_(imponible) {
  const x = Math.max(0, imponible);
  const basica = Math.min(x, FISCAL.BASICA_ANCHO);
  const alta = Math.min(Math.max(x - FISCAL.BASICA_ANCHO, 0), FISCAL.ALTA_HASTA - FISCAL.PA - FISCAL.BASICA_ANCHO);
  const adicional = Math.max(x - (FISCAL.ALTA_HASTA - FISCAL.PA), 0);
  return basica * 0.2 + alta * 0.4 + adicional * 0.45;
}

/** Cálculo puro (sin leer la hoja). */
function calcularImpuestos_(ingresos, gastos, sueldo) {
  const opcGastos = Math.max(0, ingresos - gastos);
  const opcAllow = Math.max(0, ingresos - FISCAL.TRADING);
  let metodo, beneficio;
  if (ingresos <= FISCAL.TRADING) { metodo = 'bajo'; beneficio = 0; }
  else if (opcGastos <= opcAllow) { metodo = 'gastos'; beneficio = opcGastos; }
  else { metodo = 'allowance'; beneficio = opcAllow; }
  const total = beneficio + sueldo;
  const imponible = Math.max(0, total - FISCAL.PA);
  const impuesto = Math.max(0, impuestoRenta_(imponible) - impuestoRenta_(Math.max(0, sueldo - FISCAL.PA)));
  const ni4 = Math.max(0, Math.min(beneficio, FISCAL.NI4_SUP) - FISCAL.NI4_INF) * FISCAL.NI4_TASA + Math.max(0, beneficio - FISCAL.NI4_SUP) * FISCAL.NI4_TASA_SUP;
  const r2 = n => Math.round(n * 100) / 100;
  return { metodo: metodo, beneficio: r2(beneficio), total: r2(total), imponible: r2(imponible), impuesto: r2(impuesto), ni4: r2(ni4),
           aPagar: r2(impuesto + ni4), tocaPagar: (impuesto + ni4) > 0.005 };
}

function anioFiscalDe_(d) { const y = d.getFullYear(); return d >= new Date(y, 3, 6) ? y : y - 1; }
function etiquetaAnio_(y) { return y + '-' + String(y + 1).slice(2); }
const MESES_ = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function getImpuestos(opts) {
  opts = opts || {};
  let y = opts.anio ? Number(String(opts.anio).slice(0, 4)) : anioFiscalDe_(new Date());
  if (opts.fechaExtra) { const d = new Date(opts.fechaExtra + 'T12:00:00'); if (!isNaN(d)) y = anioFiscalDe_(d); }
  const ini = new Date(y, 3, 6), fin = new Date(y + 1, 3, 5, 23, 59, 59);
  const ing = leerTabla_('Ingresos').filter(r => r['ID FACTURA'] !== '' && r['ESTADO'] !== 'CANCELLED' && r['FECHA EVENTO'] instanceof Date);
  const gas = leerTabla_('Gastos').filter(r => r['ID GASTO'] !== '' && r['FECHA'] instanceof Date);
  const anios = {}; anios[anioFiscalDe_(new Date())] = 1;
  ing.forEach(r => (anios[anioFiscalDe_(r['FECHA EVENTO'])] = 1));
  gas.forEach(r => (anios[anioFiscalDe_(r['FECHA'])] = 1));
  const ingY = ing.filter(r => r['FECHA EVENTO'] >= ini && r['FECHA EVENTO'] <= fin);
  const gasY = gas.filter(r => r['FECHA'] >= ini && r['FECHA'] <= fin);
  const suma = (a, k) => a.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  const extra = Math.max(0, Number(opts.extra) || 0);
  const ingresos = suma(ingY, 'SUBTOTAL') + extra;
  const gastos = suma(gasY, 'SUBTOTAL');
  const sp = PropertiesService.getScriptProperties().getProperty('SUELDO_WH');
  const sueldo = sp === null || sp === '' ? 0 : Number(sp) || 0;
  const r = calcularImpuestos_(ingresos, gastos, sueldo);
  const idsUnicos = {}; ingY.forEach(x => (idsUnicos[x['ID FACTURA']] = 1));
  r.anio = etiquetaAnio_(y);
  r.inicio = '6 abr ' + y; r.fin = '5 abr ' + (y + 1);
  r.ingresos = Math.round(ingresos * 100) / 100; r.gastos = Math.round(gastos * 100) / 100;
  r.nFacturas = Object.keys(idsUnicos).length + (extra > 0 ? 1 : 0); r.nGastos = gasY.length;
  r.sueldo = sueldo; r.sueldoDado = !(sp === null || sp === '');
  r.registrarte = ingresos > FISCAL.TRADING;
  r.fechaRegistro = '5 oct ' + (y + 1);
  r.fechaDeclaracion = '31 ene ' + (y + 2);
  r.anios = Object.keys(anios).map(Number).sort((a, b) => b - a).map(etiquetaAnio_);
  r.pa = FISCAL.PA; r.trading = FISCAL.TRADING;
  const negs = negocios_();
  r.porNegocio = negs.length > 1 ? negs.map(n => {
    const i = suma(ingY.filter(x => negDe_(x) === n.id), 'SUBTOTAL'), g = suma(gasY.filter(x => negDe_(x) === n.id), 'SUBTOTAL');
    return { id: n.id, nombre: n.nombre, color: n.color, ingresos: Math.round(i * 100) / 100, gastos: Math.round(g * 100) / 100, beneficio: Math.round((i - g) * 100) / 100 };
  }) : [];
  return r;
}

function guardarSueldo(valor) {
  const pr = PropertiesService.getScriptProperties();
  if (valor === '' || valor === null || valor === undefined) { pr.deleteProperty('SUELDO_WH'); return true; }
  const n = Number(valor);
  if (!isFinite(n) || n < 0 || n > 1000000) throw new Error('Pon un número válido, por ejemplo 10800.');
  pr.setProperty('SUELDO_WH', String(Math.round(n * 100) / 100));
  return true;
}


/* ====== Mi negocio (4.0.0): la misma app sirve para un DJ o para quien vende productos ====== */
const NEGOCIOS = {
  dj: { nombre: 'DJ / eventos', fecha: 'Fecha del evento', cliente: 'Cliente', desc: 'DJ SERVICES', unidad: 'Unit (por evento)',
        cats: ['Equipo', 'Música', 'Transporte', 'Gasolina', 'Publicidad', 'Teléfono'] },
  productos: { nombre: 'Venta de productos', fecha: 'Fecha de venta', cliente: 'Comprador', desc: 'VENTA', unidad: 'Unit (por pieza)',
        cats: ['Filamento', 'Resina', 'Luz', 'Envíos', 'Comisión Wix / Etsy', 'Repuestos', 'Empaques', 'Publicidad'] },
  servicios: { nombre: 'Servicios / apps', fecha: 'Fecha del servicio', cliente: 'Cliente', desc: 'SERVICES', unidad: 'Unit (por servicio)',
        cats: ['Software', 'Suscripciones', 'Equipo', 'Internet', 'Dominio y web', 'Publicidad'] }
};

function negocio_() {
  const k = PropertiesService.getScriptProperties().getProperty('NEGOCIO');
  return NEGOCIOS[k] ? k : 'dj';
}

function getNegocio() {
  const k = negocio_();
  return Object.assign({ clave: k }, NEGOCIOS[k]);
}

function guardarNegocio(clave) {
  if (!NEGOCIOS[clave]) throw new Error('Tipo de negocio no válido.');
  PropertiesService.getScriptProperties().setProperty('NEGOCIO', clave);
  try { const n = negocios_()[0]; if (n && n.tipo !== clave) guardarNegocioDatos(Object.assign({}, n, { tipo: clave })); } catch (e) { }
  return getNegocio();
}

/** Añade las categorías sugeridas del tipo de negocio que todavía no existen (sin pasar del máximo). */
function anadirCategoriasSugeridas(tipo) {
  return conBloqueo_(() => {
    const clave = NEGOCIOS[tipo] ? tipo : negocio_();
    const ya = leerTabla_('Categorias').map(c => String(c['NOMBRE']).toLowerCase());
    const s = hoja_('Categorias');
    const anadidas = [], sinSitio = [];
    NEGOCIOS[clave].cats.forEach(n => {
      if (ya.indexOf(n.toLowerCase()) >= 0) return;
      if (ya.length >= CAT_MAX) { sinSitio.push(n); return; }
      const r = filaLibre_(s, false);
      s.getRange(r, 1, 1, 2).setValues([[n, 'Sugerida por PuntoBalance']]);
      ya.push(n.toLowerCase()); anadidas.push(n);
    });
    return { anadidas: anadidas, sinSitio: sinSitio };
  });
}


/* ====== Varios negocios en una sola hoja (5.0.0-alpha8) ======
 * Pestaña «Negocios» (ID, NOMBRE, TIPO, PREFIJO, COLOR, NOMBRE EN FACTURA). El primero es el de siempre:
 * las filas viejas sin NEGOCIO son suyas. Cada negocio numera sus facturas (DJ-013, OD-001…) en la columna Nº FACTURA;
 * las facturas viejas se quedan con su número. ID FACTURA sigue siendo el número interno (único) de la fila. */
const NEG_CABS = ['ID', 'NOMBRE', 'TIPO', 'PREFIJO', 'COLOR', 'NOMBRE EN FACTURA', 'FECHA EN FACTURA', 'NOTA FACTURA', 'EMAIL', 'TELÉFONO'];
const FECHA_LINEA = { event: 'Event date', sale: 'Sale date', service: 'Service date', none: '' };
const FECHA_TIPO = { dj: 'event', productos: 'sale', servicios: 'service' };
const NEG_COLORES = ['#4F46E5', '#F4A62A', '#16A34A', '#DC5A56', '#0EA5E9', '#9333EA', '#0F766E', '#BE185D'];
let NEG_LISTO = false;

function prefijoDe_(nombre) {
  const p = String(nombre || '').trim().split(/\s+/)[0] || '';
  const l = p.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return (l.length <= 4 ? l : l.slice(0, 2)) || 'N';
}

/** Crea la pestaña Negocios y las columnas nuevas si faltan (hojas de antes de alpha8). */
function asegurarNegocios_() {
  if (NEG_LISTO) return;
  const ss = ss_();
  if (!ss.getSheetByName('Negocios')) {
    const s = ss.insertSheet('Negocios');
    s.getRange(1, 1, 1, NEG_CABS.length).setValues([NEG_CABS]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1B2B5B');
    s.setFrozenRows(1);
    const nombre = String(config_().nombre || '').trim() || 'Mi negocio';
    s.getRange(2, 1, 1, NEG_CABS.length).setValues([['n1', nombre, negocio_(), prefijoDe_(nombre), NEG_COLORES[0], '', '', '', '', '']]);
  } else {
    const s = ss.getSheetByName('Negocios');
    const cab = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getValues()[0];
    NEG_CABS.forEach(t => { if (cab.indexOf(t) < 0) { let col = cab.length; while (col > 0 && (cab[col - 1] === '' || cab[col - 1] === null)) col--; s.getRange(1, col + 1).setValue(t).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1B2B5B'); cab.splice(col, 0, t); } });
  }
  [['Ingresos', 'NEGOCIO'], ['Ingresos', 'Nº FACTURA'], ['Gastos', 'NEGOCIO']].forEach(x => {
    const h = hoja_(x[0]);
    const cab = h.getRange(1, 1, 1, Math.max(h.getLastColumn(), 1)).getValues()[0];
    if (cab.indexOf(x[1]) >= 0) return;
    let col = cab.length; while (col > 0 && (cab[col - 1] === '' || cab[col - 1] === null)) col--;
    h.getRange(1, col + 1).setValue(x[1]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1B2B5B');
  });
  NEG_LISTO = true;
}

function colDe_(hoja, titulo) {
  asegurarNegocios_();
  const h = hoja_(hoja);
  const i = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].indexOf(titulo);
  if (i < 0) throw new Error('Falta la columna ' + titulo + ' en ' + hoja + '.');
  return i + 1;
}

let NEG_CACHE = null;   // la lista se lee una vez por llamada (se usa en cada fila)
function negocios_() {
  if (NEG_CACHE && Date.now() - NEG_CACHE.t < 15000) return NEG_CACHE.l;
  asegurarNegocios_();
  const l = leerTabla_('Negocios').map((r, i) => ({
    id: String(r['ID']), nombre: String(r['NOMBRE'] || 'Negocio'), tipo: NEGOCIOS[r['TIPO']] ? String(r['TIPO']) : 'dj',
    prefijo: String(r['PREFIJO'] || ''), color: String(r['COLOR'] || NEG_COLORES[i % NEG_COLORES.length]), nombreFactura: String(r['NOMBRE EN FACTURA'] || ''),
    fechaLinea: FECHA_LINEA.hasOwnProperty(r['FECHA EN FACTURA']) ? String(r['FECHA EN FACTURA']) : (FECHA_TIPO[r['TIPO']] || 'event'),
    nota: String(r['NOTA FACTURA'] == null ? '' : r['NOTA FACTURA']), email: String(r['EMAIL'] || ''), telefono: String(r['TELÉFONO'] || '')
  }));
  NEG_CACHE = { t: Date.now(), l: l };
  return l;
}
function negPrimero_() { const l = negocios_(); return l.length ? l[0].id : 'n1'; }
function negocioPorId_(id) { return negocios_().find(n => n.id === String(id)) || null; }
function negDe_(r) { return String(r['NEGOCIO'] || '') || negPrimero_(); }
function numDe_(r) { const n = String(r['Nº FACTURA'] == null ? '' : r['Nº FACTURA']).trim(); return n || String(r['ID FACTURA']); }
function filtrarNeg_(filas, id) { return id ? filas.filter(r => negDe_(r) === String(id)) : filas; }

/** Siguiente número de factura del negocio: sigue desde el más alto que tenga (DJ-013 después de 12). */
function siguienteNum_(id) {
  const n = negocioPorId_(id); if (!n) return '';
  let max = 0;
  leerTabla_('Ingresos').forEach(r => {
    if (negDe_(r) !== n.id) return;
    const m = /(\d+)\s*$/.exec(numDe_(r));
    if (m && Number(m[1]) > max) max = Number(m[1]);
  });
  return n.prefijo ? n.prefijo + '-' + String(max + 1).padStart(3, '0') : String(max + 1);
}

/** El primer negocio usa el logo de siempre (LOGO_…); los demás, el suyo (LOGO_n2_…). */
function prefLogo_(id) { return !id || id === negPrimero_() ? 'LOGO_' : 'LOGO_' + id + '_'; }
function logosNegocios_() { const o = {}; negocios_().forEach(n => { o[n.id] = getLogo_(prefLogo_(n.id)); }); return o; }
function getNegocios() { return { lista: negocios_(), logos: logosNegocios_(), tipos: Object.keys(NEGOCIOS).map(k => Object.assign({ clave: k }, NEGOCIOS[k])) }; }

function guardarNegocioDatos(o) {
  NEG_CACHE = null;
  return conBloqueo_(() => {
    asegurarNegocios_();
    const nombre = String(o.nombre || '').trim();
    if (!nombre) throw new Error('Escribe el nombre del negocio.');
    const tipo = NEGOCIOS[o.tipo] ? o.tipo : 'dj';
    const prefijo = String(o.prefijo || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const lista = negocios_();
    if (lista.some(n => n.id !== o.id && n.nombre.toLowerCase() === nombre.toLowerCase())) throw new Error('Ya tienes un negocio con ese nombre.');
    if (prefijo && lista.some(n => n.id !== o.id && n.prefijo === prefijo)) throw new Error('Ese prefijo ya lo usa otro negocio. Elige otro (por ejemplo ' + prefijo + '2).');
    const s = hoja_('Negocios');
    const nf = String(o.nombreFactura || '').trim();
    const fl = FECHA_LINEA.hasOwnProperty(o.fechaLinea) ? o.fechaLinea : (FECHA_TIPO[tipo] || 'event');
    const extra = [fl, String(o.nota || '').trim(), String(o.email || '').trim(), String(o.telefono || '').trim()];
    if (o.id) {
      const r = lista.findIndex(n => n.id === o.id);
      if (r < 0) throw new Error('No encuentro ese negocio.');
      const fila = leerTabla_('Negocios')[r]._fila;
      s.getRange(fila, 2, 1, 9).setValues([[nombre, tipo, prefijo, lista[r].color, nf].concat(extra)]);
      if (r === 0) PropertiesService.getScriptProperties().setProperty('NEGOCIO', tipo);   // compatibilidad con «Mi negocio»
      NEG_CACHE = null;
      return { id: o.id };
    }
    if (lista.length >= 8) throw new Error('Puedes tener hasta 8 negocios.');
    const id = 'n' + (lista.reduce((m, n) => Math.max(m, Number(String(n.id).replace(/\D/g, '')) || 0), 0) + 1);
    const r = filaLibre_(s, false);
    s.getRange(r, 1, 1, NEG_CABS.length).setValues([[id, nombre, tipo, prefijo || prefijoDe_(nombre), NEG_COLORES[lista.length % NEG_COLORES.length], nf].concat(extra)]);
    NEG_CACHE = null;
    return { id: id };
  });
}
function guardarLogoNegocio(id, dataUrl) { return guardarLogo(dataUrl, prefLogo_(id)); }
function quitarLogoNegocio(id) { quitarLogo_(prefLogo_(id)); return true; }

/* ====== Listas a la par de Nuevo cliente / proveedor / categoría (5.0.0-alpha8) ====== */
function getListas() {
  const ing = leerTabla_('Ingresos').filter(r => r['ID FACTURA'] !== '' && r['ESTADO'] !== 'CANCELLED');
  const gas = leerTabla_('Gastos').filter(r => r['ID GASTO'] !== '');
  const facPorCli = {};
  ing.forEach(r => { const k = String(r['CLIENTE']); (facPorCli[k] = facPorCli[k] || {})[r['ID FACTURA']] = 1; });
  const gasPorProv = {}, porCat = {};
  const y = anioFiscalDe_(new Date()), ini = new Date(y, 3, 6), fin = new Date(y + 1, 3, 5, 23, 59, 59);
  gas.forEach(r => {
    gasPorProv[String(r['PROVEEDOR'])] = (gasPorProv[String(r['PROVEEDOR'])] || 0) + 1;
    if (r['FECHA'] instanceof Date && r['FECHA'] >= ini && r['FECHA'] <= fin) porCat[String(r['CATEGORÍA UC'])] = (porCat[String(r['CATEGORÍA UC'])] || 0) + (Number(r['SUBTOTAL']) || 0);
  });
  const t = v => String(v == null ? '' : v);
  return {
    anio: etiquetaAnio_(y),
    clientes: leerTabla_('Clientes').map(c => ({ nombre: t(c['NOMBRE']), direccion: t(c['DIRECCIÓN']), ciudad: t(c['CIUDAD']), postcode: t(c['POSTCODE']),
      telefono: t(c['TELÉFONO']), email: t(c['EMAIL']), facturas: Object.keys(facPorCli[t(c['NOMBRE'])] || {}).length })),
    proveedores: leerTabla_('Proveedores').map(p => ({ nombre: t(p['NOMBRE']), notas: t(p['NOTAS']), gastos: gasPorProv[t(p['NOMBRE'])] || 0 })),
    categorias: leerTabla_('Categorias').map(c => ({ nombre: t(c['NOMBRE']), descripcion: t(c['DESCRIPCIÓN']), total: Math.round((porCat[t(c['NOMBRE'])] || 0) * 100) / 100 }))
  };
}

/** Corrige los datos de un cliente. Si cambia el nombre, también se cambia en sus ingresos. */
function actualizarCliente(nombreViejo, o) {
  return conBloqueo_(() => {
    const nombre = String(o.nombre || '').trim();
    if (!nombre) throw new Error('Escribe el nombre del cliente.');
    const filas = leerTabla_('Clientes');
    const c = filas.find(x => String(x['NOMBRE']) === String(nombreViejo));
    if (!c) throw new Error('No encuentro ese cliente.');
    if (nombre.toLowerCase() !== String(nombreViejo).toLowerCase() && filas.some(x => String(x['NOMBRE']).toLowerCase() === nombre.toLowerCase())) throw new Error('Ya hay otro cliente con ese nombre.');
    hoja_('Clientes').getRange(c._fila, 1, 1, 6).setValues([[nombre, o.direccion || '', o.ciudad || '', o.postcode || '', o.telefono || '', o.email || '']]);
    let cambiados = 0;
    if (nombre !== String(nombreViejo)) {
      const s = hoja_('Ingresos'), col = 3;
      leerTabla_('Ingresos').forEach(r => { if (String(r['CLIENTE']) === String(nombreViejo)) { s.getRange(r._fila, col).setValue(nombre); cambiados++; } });
    }
    return { nombre: nombre, cambiados: cambiados };
  });
}


/* ====== Licencias (5.0.0-alpha12) ======
 * La app web guarda aquí (pestaña AppProps de la hoja de cada persona) el código de su licencia y el día que empezó la prueba.
 * Comprobar el código lo hace la app (licencia.js) con la llave pública de Odlare: aquí no hay ningún secreto. */
function getLicenciaGuardada() {
  const p = PropertiesService.getScriptProperties();
  return { codigo: String(p.getProperty('LICENCIA') || ''), inicio: String(p.getProperty('PRUEBA_INICIO') || '') };
}
function guardarLicencia(codigo) {
  const c = String(codigo || '').trim();
  if (c && !/^PB1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(c)) throw new Error('Ese código no tiene el formato de PuntoBalance.');
  PropertiesService.getScriptProperties().setProperty('LICENCIA', c);
  return true;
}
function marcarInicioPrueba(iso) {
  const p = PropertiesService.getScriptProperties();
  const ya = String(p.getProperty('PRUEBA_INICIO') || '');
  const nuevo = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? String(iso) : iso_(new Date());
  if (!ya || nuevo < ya) p.setProperty('PRUEBA_INICIO', nuevo);
  return String(p.getProperty('PRUEBA_INICIO'));
}

return { abrirDashboard: abrirDashboard, abrirFormulario: abrirFormulario, abrirFormularioAjustes: abrirFormularioAjustes, abrirFormularioCategoria: abrirFormularioCategoria, abrirFormularioCliente: abrirFormularioCliente, abrirFormularioGasto: abrirFormularioGasto, abrirFormularioIngreso: abrirFormularioIngreso, abrirFormularioPeriodos: abrirFormularioPeriodos, abrirFormularioProveedor: abrirFormularioProveedor, abrirFormularioRegistros: abrirFormularioRegistros, abrirMenu: abrirMenu, abrirPanel: abrirPanel, actualizarCliente: actualizarCliente, actualizarGasto: actualizarGasto, actualizarIngreso: actualizarIngreso, actualizarLibro: actualizarLibro, anadirCategoriasSugeridas: anadirCategoriasSugeridas, anadirPeriodos: anadirPeriodos, cambiarEnlaceWeb: cambiarEnlaceWeb, doGet: doGet, eliminarRegistro: eliminarRegistro, enviarFactura: enviarFactura, enviarResumenPeriodoActual: enviarResumenPeriodoActual, enviarResumenSiToca: enviarResumenSiToca, generarFactura: generarFactura, getAjustes: getAjustes, getDashboardData: getDashboardData, getFacturaDatos: getFacturaDatos, getFormData: getFormData, getHubData: getHubData, getImpuestos: getImpuestos, getLicenciaGuardada: getLicenciaGuardada, getListas: getListas, getMovimientos: getMovimientos, getNegocio: getNegocio, getNegocios: getNegocios, getNotaFactura: getNotaFactura, getPanelData: getPanelData, getRegistro: getRegistro, getResumenActual: getResumenActual, getRevision: getRevision, guardarAjustes: guardarAjustes, guardarCategoria: guardarCategoria, guardarCliente: guardarCliente, guardarEnlaceWeb: guardarEnlaceWeb, guardarGasto: guardarGasto, guardarIngreso: guardarIngreso, guardarLicencia: guardarLicencia, guardarLogo: guardarLogo, guardarLogoNegocio: guardarLogoNegocio, guardarNegocio: guardarNegocio, guardarNegocioDatos: guardarNegocioDatos, guardarNotaNegocio: guardarNotaNegocio, guardarProveedor: guardarProveedor, guardarSueldo: guardarSueldo, hubEnviarResumen: hubEnviarResumen, hubRecordatorio: hubRecordatorio, instalarRecordatorio: instalarRecordatorio, listarRegistros: listarRegistros, marcarFacturaPagada: marcarFacturaPagada, marcarInicioPrueba: marcarInicioPrueba, marcarPeriodoProcesado: marcarPeriodoProcesado, marcarProcesadoDialogo: marcarProcesadoDialogo, mostrarEnlaceWeb: mostrarEnlaceWeb, mostrarRevision: mostrarRevision, onOpen: onOpen, quitarLogo: quitarLogo, quitarLogoNegocio: quitarLogoNegocio, quitarRecordatorio: quitarRecordatorio };
})(window.PB_GAS.SpreadsheetApp, window.PB_GAS.Utilities, window.PB_GAS.Session, window.PB_GAS.LockService, window.PB_GAS.MailApp, window.PB_GAS.ScriptApp, window.PB_GAS.HtmlService, window.PB_GAS.PropertiesService, window.PB_GAS.DriveApp, window.PB_GAS.Logger);
