/* GENERADO por herramientas/construir_web.py. PuntoBalance 5.0.0-alpha5 */
const CACHE = "pb-5.0.0-alpha5";
const ARCHIVOS = ['./', 'index.html', 'config.js', 'motor.js', 'Code.js', 'demo.js', 'pdf.js', 'cuenta.js', 'datos.js', 'app.js', 'manifest.json', 'lib/jspdf.umd.min.js', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/favicon-48.png'];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;           // Google y Drive: siempre por internet
  if (u.pathname.endsWith("/version.json")) return;                                     // actualizaciones: siempre por internet
  e.respondWith(fetch(new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" })).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
