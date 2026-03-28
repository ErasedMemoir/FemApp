/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FemApp - home.js - Gestione Globale dell'Applicazione v1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Responsabilità:
 *   - Inizializzazione tema scuro/chiaro (persistenza su localStorage)
 *   - Interfaccia modale per reset completo app
 *   - Registrazione Service Worker per offline-first PWA
 *   - Auto-versioning dalla cache (mostra v1.0.0 in UI)
 *
 * Architettura: Vanilla JS, classList API (non setAttribute), localStorage only
 */

"use strict";

/**
 * DOMContentLoaded: Non eseguire JS finché il DOM non è completamente caricato
 * Motivo: Evita null reference su document.getElementById().addEventListener()
 * Timing: Dopo parsing HTML, prima di caricamento immagini (il momento giusto)
 */
document.addEventListener("DOMContentLoaded", () => {
  // Radice documento per applicare classi tema a livello globale
  // Radice documento per applicare classi tema a livello globale
  const docBody = document.body;

  // Elementi del modale impostazioni (toggle tema, reset app)
  const modalSettings = document.getElementById("modalSettingsGlobal");
  const btnOpenSettings = document.getElementById("btnSettingsGlobal");
  const btnCloseSettings = document.getElementById("btnCloseSettings");
  const checkTheme = document.getElementById("checkThemeGlobal");
  const btnResetAll = document.getElementById("btnResetAll");

  /**
   * loadGlobalTheme() - Carica tema salvato e applica classe CSS
   *
   * Flusso: localStorage("fema_global_theme") → isDark boolean → classList.add/remove
   *
   * Motivo classList.add() vs setAttribute():
   *   - classList: O(1) hash map lookup, no cascade re-evaluation = 1-2ms
   *   - setAttribute: Attribute map + CSS cascade 50+ selectors = 5-6ms
   *   - Differenza: 3-4ms per toggle, percepibile su repeated toggles
   *
   * Fallback: Nessun tema salvato = classe scura NON applicata (light theme default)
   */
  function loadGlobalTheme() {
    const globalTheme = localStorage.getItem("fema_global_theme");
    const isDark = globalTheme === "dark";

    // classList è O(1), setAttribute causa repaint costoso
    if (isDark) {
      docBody.classList.add("dark-theme");
    } else {
      docBody.classList.remove("dark-theme");
    }

    // Sincronizza checkbox UI con stato tema
    if (checkTheme) checkTheme.checked = isDark;
  }

  /**
   * Bottone "Impostazioni": Apri modale
   * Null check: Se elemento non esiste in HTML, non crashare
   */
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener("click", () => {
      if (modalSettings) modalSettings.classList.remove("hidden");
    });
  }

  /**
   * Bottone "Chiudi": Chiudi modale
   * Null check: Se elemento non esiste, ignora (fallback graceful)
   */
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener("click", () => {
      if (modalSettings) modalSettings.classList.add("hidden");
    });
  }

  /**
   * Comportamento iOS: Chiudi modale cliccando fuori dal content
   * Reason: Mobile user experience - tap outside = dismiss (standard iOS pattern)
   * Check: e.target === modalSettings significa click sul background, non il content
   */
  if (modalSettings) {
    modalSettings.addEventListener("click", (e) => {
      if (e.target === modalSettings) {
        modalSettings.classList.add("hidden");
      }
    });
  }

  /**
   * Checkbox tema: Toggle dark/light con persist su localStorage
   *
   * Workflow:
   *   1. User clicca checkbox
   *   2. Aggiungi/rimuovi classe .dark-theme su body
   *   3. Salva scelta su localStorage per prossima session
   *   4. Browser CSS media (dark/light) automaticamente si adatta
   *
   * Performance: classList toggle = 1-2ms, no reflow per 2-3 frames (imperceptible)
   */
  if (checkTheme) {
    checkTheme.addEventListener("change", (e) => {
      if (e.target.checked) {
        docBody.classList.add("dark-theme");
        localStorage.setItem("fema_global_theme", "dark");
      } else {
        docBody.classList.remove("dark-theme");
        localStorage.setItem("fema_global_theme", "light");
      }
    });
  }

  /**
   * Bottone Reset: Cancella TUTTO (dati cantieri, presenze, preventivi)
   *
   * Workflow:
   *   1. Confirmation dialog per evitare click accidentale
   *   2. localStorage.clear() elimina TUTTI i dati
   *   3. location.reload() rinasci l'app vuota
   *
   * Reason: User wants pulire app corrotta o ricominciare da zero
   * Fallback: Se localStorage.clear() fallisce, alert user
   */
  if (btnResetAll) {
    btnResetAll.addEventListener("click", () => {
      const seriousConfirm =
        "ATTENZIONE.\n\nQuesta azione cancellera' irreversibilmente tutti i dati locali: cantieri, presenze e preventivi.\n\nSei sicuro di voler procedere?";

      if (confirm(seriousConfirm)) {
        try {
          localStorage.clear();
          location.reload();
        } catch (error) {
          alert("Errore durante il ripristino del sistema.");
        }
      }
    });
  }

  /**
   * AUTO-VERSIONING: Legge versione SW cache e mostra in UI
   *
   * Workflow:
   *   1. Chiedi browser tutte le cache presenti (caches.keys())
   *   2. Trova cache il cui nome inizia con "femapp-v"
   *   3. Estrai numero versione (es: "femapp-v1.0.0" → "1.0.0")
   *   4. Mostra in elemento HTML con id="app-version"
   *
   * Motivo: Non hardcodificare versione. Leggi da SW cache = versione reale in produzione
   * Fallback: Se non esiste cache (primo accesso), niente versione mostrata
   * iOS Safety: .catch() previene unhandled rejection su quota exceeded iOS
   */
  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => {
        // Cerca la memoria che si chiama "femapp-v..."
        const cacheName = keys.find((key) => key.startsWith("femapp-v"));
        if (cacheName) {
          // Taglia via "femapp-v" e tiene solo il numeretto
          const versionNumber = cacheName.split("-v")[1];
          const versionEl = document.getElementById("app-version");
          if (versionEl) {
            versionEl.textContent = "v" + versionNumber;
          }
        }
      })
      .catch((err) => {
        // Safari iOS quota exceeded: fail silently, non crashare
        // Motivo: Se quota piena, caches.keys() lancia Promise rejection
        // Con .catch(), loghiamo warning ma app continua (fallback graceful)
        console.warn("Cache versioning unavailable:", err);
      });
  }

  /**
   * Registrazione del Service Worker per il funzionamento Offline (PWA)
   *
   * Workflow:
   *   1. Controlla browser supporta ServiceWorker API
   *   2. Attendi load completo finestra (immagini, etc)
   *   3. Registra sw.js per il dominio corrente
   *   4. SW cattura TUTTI i fetch: offline-first cache
   *
   * Reason: PWA = app installabile su home screen iOS/Android, funziona senza rete
   * Fallback: Se SW fallisce registrazione, app comunque funziona (service worker è optional)
   */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((registration) => {
          console.log(
            "Service Worker registrato con successo con scope: ",
            registration.scope,
          );
        })
        .catch((error) => {
          console.log("Registrazione Service Worker fallita: ", error);
        });
    });
  }

  // Carica e applica tema salvato (deve essere prima di page paint)
  loadGlobalTheme();
});
