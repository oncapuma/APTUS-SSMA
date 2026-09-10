// Aptus — Service Worker
// Guarda uma cópia do app no próprio aparelho, para que ele abra mesmo SEM internet.
// As respostas ficam na fila do Firestore e sobem sozinhas quando a conexão voltar.

const CACHE = "aptus-v2";

const ARQUIVOS = [
  "./RoboDeProvas.html",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
];

// Instala: guarda cada arquivo SEPARADAMENTE.
// (Com cache.addAll, uma única falha cancelaria todo o cache — era o bug anterior.)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        ARQUIVOS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[Aptus SW] nao consegui guardar:", url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// Ativa: limpa versoes antigas do cache.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // O Firestore tem a propria fila offline — nao interferir.
  if (req.url.includes("firestore.googleapis.com") || req.url.includes("firebaseio.com")) return;

  // Abrir a pagina: tenta a rede, cai para a copia guardada.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put("./RoboDeProvas.html", copia)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match("./RoboDeProvas.html").then((hit) => hit || caches.match(req))
        )
    );
    return;
  }

  // Demais arquivos: copia guardada primeiro, rede como reforco.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
          return res;
        })
        .catch(() => hit);
    })
  );
});
