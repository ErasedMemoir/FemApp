/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FemApp Service Worker - v1.0.1 (Release Ufficiale)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Ruolo: Gestione cache PWA offline-first per accesso indipendente dalla rete.
 * Strategia: Cache-first con fallback a fetch (user non perde dati senza connessione).
 * Lifecycle: Install → Activate → Fetch (ripete per ogni navigazione/cambio pagina).
 * Auto-Update: Controlla version.txt per aggiornamenti automatici (no reload manuale)
 */

// Nome cache con versione per invalidazione automatica tra releases
// Inizializzato dinamicamente dalla version.txt (non hardcodato)
// Quando version.txt cambia, il SW crea nuovo CACHE_NAME automaticamente
let CACHE_NAME = null;
let CURRENT_VERSION = null;

/**
 * initVersion() - Carica versione da version.txt al boot del SW
 * 
 * Workflow:
 *   1. SW avvia, fetch version.txt dal server (no-cache per essere aggiornato)
 *   2. Parse versione (es: "1.0.2" → trim whitespace)
 *   3. Crea CACHE_NAME = "femapp-v1.0.2"
 *   4. Usa CACHE_NAME per install/activate
 *
 * Vantaggio: User modifica SOLO version.txt, mai il SW!
 * Fallback: Se version.txt non trovato, usa default fallback
 */
async function initVersion() {
  try {
    const response = await fetch("./version.txt", { cache: "no-store" });
    if (response.ok) {
      CURRENT_VERSION = (await response.text()).trim();
      CACHE_NAME = `femapp-v${CURRENT_VERSION}`;
      console.log(`[SW Init] Caricato versione: ${CURRENT_VERSION}`);
    } else {
      throw new Error("version.txt non trovato");
    }
  } catch (error) {
    // Fallback: Se non riesce a leggere version.txt, usa default
    CURRENT_VERSION = "1.0.1";
    CACHE_NAME = "femapp-v1.0.1";
    console.warn(`[SW Init] Impossibile leggere version.txt, uso default v${CURRENT_VERSION}`, error);
  }
}

// Inizializza versione immediatamente (before qualunque evento)
initVersion();

/**
 * Lista di asset da caricare in cache al primo install
 * Include: pagine HTML, fogli CSS, script JS, librerie esterne, icone PWA
 * Strategia: Caricare tutto per garantire offline completo anche su prima visita
 */
const ASSETS_TO_CACHE = [
  // Pagine web principali (entry point dell'app)
  "./",
  "./index.html",
  "./presenze.html",
  "./preventivi.html",

  // Fogli di stile (temi scuro/chiaro, layout, responsive iOS)
  "./css/global.css",
  "./css/presenze.css",
  "./css/preventivi.css",

  // Script dell'app (logica business, PWA, gestione dati)
  "./js/home.js",
  "./js/presenze.js",
  "./js/preventivi.js",

  // Librerie esterne minificate (PDF generation, table formatting)
  "./js/jspdf.min.js",
  "./js/autotable.min.js",
  "./js/sortable.min.js",

  // Icone PWA (display app in home screen iOS)
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

/**
 * EVENT: INSTALL - Eseguito una sola volta quando il browser registra il SW
 *
 * Operazione: Carica tutti gli asset dalla lista ASSETS_TO_CACHE nel cache
 * Motivo: Prepara l'app offline-first. Se anche UNO dei file fallisce, tutto il cache fallisce
 * Effetto: skipWaiting() velocizza l'attivazione, bypassa il vecchio SW ancora attivo
 * Fallback: Su errore di rete, l'install fallisce e verrà ritentato al prossimo caricamento
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Apre il named cache (crea se inesistente), poi aggiunge tutti gli asset
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
  // skipWaiting() forza il nuovo SW ad attivarsi immediatamente
  // Senza questo, l'app attende che tutte le schede vengano chiuse
  self.skipWaiting();
});

/**
 * EVENT: ACTIVATE - Eseguito dopo install, quando il SW diventa attivo
 *
 * Operazione: Pulisce i vecchi cache per evitare accumulo di storage
 * Motivo: Quando upgradiamo CACHE_NAME, il vecchio nome rimane nel browser
 *         Questo evento rimuove tutti i cache con nome diverso da CACHE_NAME
 * Vantaggio: Storage device liberato automaticamente, niente accumulo dati stantii
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Ottiene lista di TUTTI i cache presenti nel browser per questo dominio
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Elimina cache il cui nome NON corrisponde a quello corrente
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  // clients.claim() forza il nuovo SW a controllare TUTTI i client (schede) immediatamente
  // Senza questo, le schede vecchie continuano a usare il vecchio SW fino a reload manuale
  self.clients.claim();
});

/**
 * EVENT: FETCH - Eseguito per OGNI richiesta HTTP dalla pagina (immagini, CSS, JS, API calls)
 *
 * Strategia: "Cache First, Fallback to Network" (offline-first)
 *   1. Controlla cache: se l'asset è in cache, restituiscilo (accesso istantaneo)
 *   2. SE non in cache: chiedi al server (might fail on no internet)
 *   3. SE fallisce: user rimane con app non aggiornata ma FUNZIONANTE
 *
 * Motivo: L'app funziona senza internet. Con internet, user ha versione sempre in cache.
 * Aggiornamento: Nuovo SW (nuovo CACHE_NAME) porterà versione aggiornata
 */
self.addEventListener("fetch", (event) => {
  event.respondWith(
    // Prova a trovare la richiesta nel cache
    caches.match(event.request).then((response) => {
      // Se la richiesta è in cache, restituiscila (velocissimo, niente latenza)
      // Se non in cache, chiedi al network (potrebbe fallire senza connessione)
      return response || fetch(event.request);
    }),
  );
});

/**
 * EVENT: MESSAGE - Comunicazione con pagina client per update check
 *
 * Workflow client:
 *   1. Page invia messaggio con type: "CHECK_UPDATE"
 *   2. SW controlla se c'è una versione più recente in version.txt
 *   3. Risponde con {currentVersion, newVersion}
 *   4. Se mismatch, page notifica user con "Rilasciamento disponibile"
 *
 * Motivo: Controlla aggiornamenti senza reload automatico
 * Fallback: Se version.txt non accessibile, mantieni versione corrente
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CHECK_UPDATE") {
    // Fetch versione dal server (bust cache con timestamp)
    fetch("./version.txt?ts=" + Date.now(), { cache: "no-store" })
      .then((response) => response.text())
      .then((serverVersion) => {
        serverVersion = serverVersion.trim();
        const hasUpdate = serverVersion !== CURRENT_VERSION;

        // Invia risposta al client (page)
        event.ports[0].postMessage({
          success: true,
          currentVersion: CURRENT_VERSION,
          newVersion: serverVersion,
          hasUpdate: hasUpdate,
        });

        // Se c'è un aggiornamento, aggiorna il cache name
        if (hasUpdate) {
          CURRENT_VERSION = serverVersion;
          CACHE_NAME = `femapp-v${serverVersion}`;
          console.log(
            `[SW Update] Nuova versione disponibile: ${serverVersion}`,
          );
        }
      })
      .catch((error) => {
        // Network error o file non trovato
        event.ports[0].postMessage({
          success: false,
          error: error.message,
          currentVersion: CURRENT_VERSION,
        });
      });
  }
});

// Trigger clean 1.0.1 update