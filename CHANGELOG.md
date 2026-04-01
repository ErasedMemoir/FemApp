# Changelog - FemApp

Tutte le versioni ufficiali e i relativi aggiornamenti di questo progetto saranno documentati in questo file.

---

## [1.0.1] - 2026-04-01 🚀 Official Release

### 🐛 Bug Fixes
- **Textarea Description Loss**: Risolto bug critico dove le descrizioni delle voci di preventivo perdevano il loro contenuto testuali dopo il ricaricamento dell'app. La causa era una sanitizzazione eccessiva applicata ai campi descrittivi. Ora solo i campi numerici (quantità, prezzo) sono sanitizzati, i testi descrittivi rimangono intatti.

### ✨ Nuove Funzionalità
- **High-Efficiency Auto-Update System**: Implementato un sistema di polling automatico che controlla `version.txt` ogni 5 minuti. Quando viene rilevata una nuova versione, l'app notifica l'utente con una finestra elegante (toast notification). L'utente può aggiornare immediatamente o ignorare la notifica. Il Service Worker pulisce automaticamente i vecchi cache e carica la nuova versione senza forzare un reload intempestivo.
- **Drag & Drop Row Reordering**: Integrate SortableJS per permettere agli utenti di riordinare le righe del preventivo via trascinamento. Ogni riga dispone di un drag handle (6 punti verticali) e le modifiche sono automaticamente salvate su localStorage. 
- **Desktop Responsive Layout**: Aggiunte media query per ottimizzare l'esperienza su desktop (768px+) e grandi schermi (1024px+). Il preventivo ora si visualizza con bordi arrotondati, ombre elevate e una larghezza massima contenuta per un effetto "documento" professionale.

### 🎨 UI/UX Improvements
- Desktop layout centrato con max-width per una lettura ottimale
- Box-shadow sfumato per profondità visiva
- Feedback visuale migliorato durante il drag & drop con effetti di trasparenza e hover
- Colonne tabella espandibili cleanly su schermi larger senza compressione
- Toast notification non-intrusive per aggiornamenti app con possibilità di rinviare

### 🔧 Architettura & Performance
- Service Worker dinamico che legge versione da `version.txt` al boot (nessun hardcoding)
- MessageChannel bidirezionale tra pagina e SW per comunicazione efficiente
- Cache invalidation automatica basata su versione (solo modifica `version.txt` per deploy)
- Zero downtime deployment: vecchio cache rimosso, nuovo installato seamlessly

---

## [1.0.0] - 2026-03-27

### 🎉 Release Inaugurale

Prima release ufficiale di FemApp per l'ambiente di produzione.

### Funzionalità Integrate:
- Architettura PWA Offline-First nativa con Service Worker dedicato.
- Modulo "Presenze" per il tracciamento mensile degli operai e cantieri.
- Modulo "Preventivi" con calcolo automatico di imposte e scarti.
- Sistema di esportazione PDF client-side integrato.
- Gestione persistente dei dati tramite `localStorage` con algoritmi di debouncing.
- Sistema di Backup (Export/Import) in formato JSON.
- Tema Scuro nativo e ottimizzato per dispositivi OLED.