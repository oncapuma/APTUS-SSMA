// Aptus — Service Worker
// Guarda uma cópia do app no próprio celular/computador, para que ele abra
// mesmo SEM internet. As respostas ficam na fila do Firestore e sobem sozinhas
// assim que a conexão voltar.

const CACHE = "aptus-v1";

// Instala: baixa e guarda o app e as bibliotecas de que ele depende.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        "./",
        "./RoboDeProvas.html",
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
      ]).catch(() => {})
    )
  );
  self.skipWaiting();
});

// Ativa: limpa versões antigas do cache.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Responde os pedidos: tenta a rede primeiro (para pegar atualizações),
// e cai para a cópia guardada quando estiver offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Chamadas ao Firestore nunca passam pelo cache — o próprio Firestore
  // já tem a fila offline dele.
  if (req.url.includes("firestore.googleapis.com") || req.url.includes("google.com")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./RoboDeProvas.html")))
  );
});
