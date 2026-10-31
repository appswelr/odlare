/* PuntoBalance · ajustes de la versión web.
   clientId: el «ID de cliente» de Google Cloud (tipo Aplicación web) para «Entrar con Google».
   Mientras esté vacío, la app funciona en «Probar sin cuenta». */
window.PB_CONFIG = {
  clientId: "949374739841-85a6qtj1erdde9igqs5l8esdu9vf7vko.apps.googleusercontent.com",
  // «Importar mi hoja anterior»: selector de archivos de Google (Picker). Clave limitada a appswelr.github.io y odlare.uk y a Picker API.
  pickerKey: "AIzaSyDrtgM0fIfrw-B2qV0ydzPQHNg8SSzZiA8",
  appId: "949374739841",
  // 5.0.0-alpha12 · Licencias. «pub» es la llave PÚBLICA (solo sirve para comprobar códigos). La privada vive en el Drive de Wilber.
  // Mientras «pub» esté vacía, la prueba no se corta (nadie se queda bloqueado).
  licencias: {
    pub: {"kty":"EC","crv":"P-256","x":"KAM0wr6LTk3hXVwhPoGRyzbEgUPQ7WwWMA2krpi6H_g","y":"ec996UXrVltLLZkHcCUiZnduej80itjOVZbazzn0OJg"},
    admins: ["djwinkeyodlare@gmail.com", "apps.welr@gmail.com"],
    envio: "apps.welr@gmail.com",
    whatsapp: "",
    prueba: 30
  }
};
