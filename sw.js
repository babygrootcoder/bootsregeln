// Service Worker — cached alle App-Dateien für Offline-Betrieb.
// Bei inhaltlichen Updates: CACHE_VERSION hochzählen, dann lädt die App beim
// nächsten Online-Besuch automatisch die neue Version.
const CACHE_VERSION = 'bootsregeln-v44';
const TILE_CACHE = 'bootsregeln-tiles-v1'; // Karten-Kacheln (IGN + OpenSeaMap), separat gecacht
const PLAENE = [
  'sm-uebersicht', 'sm-croisette', 'sm-croisette-zrub', 'sm-centre-ville', 'sm-madrague',
  'sm-sardinaux', 'sm-tourelle-sardinaux', 'sm-nartelle', 'sm-nartelle-zrub', 'sm-elephants',
  'sm-garonnette', 'gr-port-grimaud', 'gr-mures-1', 'gr-mures-2', 'gr-vieuxmoulin-beauvallon',
  'gr-guerrevieille-1', 'gr-cigales-guerrevieille-2', 'st-uebersicht', 'st-5kn-zone',
  'st-bouillabaisse', 'st-ponche', 'st-graniers', 'st-canebiers', 'st-cabine-de-bain',
  'st-moutte', 'st-salins', 'boje-kugel', 'boje-zylinder', 'boje-kegel', 'dirm-strand',
  'boje-lat-a', 'feuer-legende', 'boje-cardinal', 'boje-danger', 'boje-eaux', 'boje-spez'
];
const ASSETS = [
  './',
  './index.html',
  './info.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  ...PLAENE.map((n) => './plaene/' + n + '.jpg')
];

// Installation: alles in den Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Aktivierung: alte Caches aufräumen (Kachel-Cache bleibt)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== TILE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Anfragen: Cache zuerst, Netz als Fallback (offline-first)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Satelliten-Kacheln: cache-first, einmal gesehen = offline verfügbar
  if (url.hostname === 'data.geopf.fr' || url.hostname === 'tiles.openseamap.org') {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) =>
          cached || fetch(event.request).then((response) => {
            if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone());
            return response;
          })
        )
      ).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Nur erfolgreiche Antworten gleicher Herkunft in den Cache legen
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Ersatz-Startseite NUR für Seitenaufrufe — nie für Bilder o.ä.,
        // sonst zeigt der Browser ein kaputtes Bild statt einer Fehlermeldung.
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
