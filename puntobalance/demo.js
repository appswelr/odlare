/* PuntoBalance 5.0.0 · Datos de ejemplo para «Probar sin cuenta».
   Todo pasa en memoria: no se guarda nada ni se conecta con Google. Nombres inventados. */
(function () {
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function haceDias(n) { var d = new Date(); d.setDate(d.getDate() - n); return iso(d); }
  window.pbDemo = function (run) {
    run("guardarAjustes", [{ nombre: "Alex Rivera", direccion: "12 High Street", ciudad_postcode: "Swansea SA1 1AA", telefono: "07700 900123",
      email: "alex@ejemplo.com", banco: "Banco de ejemplo", titular: "Alex Rivera", sort_code: "00-00-00", cuenta: "****1234" }]);
    [["Salón Las Palmas", "1 Queen St", "Swansea", "SA1 2BB", "", ""], ["Boda Martínez", "", "Cardiff", "CF10 1AA", "", ""], ["Bar El Puerto", "", "Swansea", "SA1 3CC", "", ""]]
      .forEach(function (c) { run("guardarCliente", [{ nombre: c[0], direccion: c[1], ciudad: c[2], postcode: c[3], telefono: c[4], email: c[5] }]); });
    var ing = [[70, "Salón Las Palmas", 300, "PAID"], [56, "Bar El Puerto", 180, "PAID"], [42, "Boda Martínez", 450, "PAID"],
      [28, "Salón Las Palmas", 300, "PAID"], [14, "Bar El Puerto", 200, "PAID"], [3, "Boda Martínez", 500, "PENDING"]];
    ing.forEach(function (x) {
      run("guardarIngreso", [{ cliente: x[1], descripcion: "", fechaEvento: haceDias(x[0]), fechaFactura: haceDias(x[0]), unidad: "Unit",
        precio: x[2], cantidad: 1, formaPago: "TRANSFER", estado: x[3] }]);
    });
    var gas = [[65, "Shell", "Gasolina", "Gasolina", 45.2], [50, "Amazon", "Cables XLR", "Equipo", 32.99], [35, "Spotify", "Suscripción", "Música", 10.99],
      [21, "Shell", "Gasolina", "Gasolina", 48.6], [12, "Vistaprint", "Tarjetas de visita", "Publicidad", 24], [5, "EE", "Móvil", "Teléfono", 18]];
    gas.forEach(function (x) {
      run("guardarGasto", [{ fecha: haceDias(x[0]), proveedor: x[1], descripcion: x[2], categoria: x[3], unidad: "UNIT", cantidad: 1, precio: x[4], notas: "" }]);
    });
  };
})();
