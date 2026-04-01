# FemApp - Gestione Edile Avanzata

![Version](https://imgshields.io/badge/version-1.0.1-blue)
![Platform](https://img.shields.io/badge/platform-PWA-brightgreen)
![Tech](https://img.shields.io/badge/tech-Vanilla_JS-yellow)
![Responsive](https://img.shields.io/badge/responsive-Mobile%2BDesktop-success)

## 📋 Panoramica
**FemApp** è un'applicazione web progressiva (PWA) offline-first progettata specificamente per la gestione operativa nei cantieri edili e per l'ufficio. Permette di tracciare le presenze degli operai e generare preventivi o fatture direttamente sul campo o dall'ufficio, senza necessità di una connessione internet. L'app è completamente responsive e ottimizzata per fornire un'esperienza di qualità sia su dispositivi mobili che su desktop.

## ✨ Funzionalità Principali
* **Gestione Presenze:** Tracciamento giornaliero degli operai con supporto per cantieri multipli, note personalizzate e inserimento massivo (SmartAdd).
* **Motore Preventivi:** Calcolo in tempo reale di subtotali, IVA e sconti, con supporto per descrizioni estese e formattazione valutaria automatica.
* **Esportazione PDF:** Generazione nativa e offline di documenti PDF per i resoconti mensili delle presenze e per i preventivi da consegnare ai clienti.
* **Backup e Ripristino:** Sistema di salvataggio sicuro in formato JSON per esportare o trasferire i dati aziendali tra dispositivi.
* **Drag & Drop Reordering:** Riordina le righe dei preventivi con semplice trascinamento (SortableJS integrato).
* **Design Fully Responsive:** Ottimizzato per mobile, tablet, e desktop con una visualizzazione adattiva che mantiene la leggibilità e l'usabilità su qualsiasi schermo.
* **Auto-Update System:** L'app controlla automaticamente ogni 5 minuti se sono disponibili aggiornamenti e notifica l'utente con una finestra elegante (non intrusiva). Niente reload forzato - l'utente sceglie quando aggiornare.

### 🔄 Come funziona il Sistema Auto-Update

FemApp implementa un sistema innovativo di aggiornamento automatico che non disturba l'utente:

1. **Polling Silenzioso:** Ogni 5 minuti, l'app controlla il file `version.txt` sul server per verificare se esiste una versione più recente.
2. **Notifica Non-Intrusive:** Se una nuova versione è disponibile, appare una notifica elegante in basso schermo con il pulsante "Aggiorna ora".
3. **Scelta dell'Utente:** L'utente può aggiornare immediatamente cliccando il pulsante, oppure ignorare la notifica (scompare dopo 10 secondi).
4. **Cache Intelligente:** Il Service Worker gestisce il cache in modo intelligente - quando si aggiorna, il vecchio cache viene rimosso automaticamente e il nuovo viene installato.
5. **Zero Downtime:** L'intera operazione avviene senza forzare un reload, garantendo una transizione liscia tra versioni.

**Vantaggio chiave:** I deploy non disturbano gli utenti che stanno lavorando. L'aggiornamento avviene nel momento giusto per loro, non imposto dal sistema.

## 🏗️ Architettura Tecnica
Il progetto è stato sviluppato seguendo rigorosi standard ingegneristici per garantire la massima reattività su dispositivi mobili in condizioni di cantiere e su workstation desktop:
* **Vanilla "Bare-Metal" JS:** Nessun framework esterno. L'app è scritta in puro JavaScript ES6+ per azzerare i tempi di caricamento.
* **Ottimizzazione Memoria:** Utilizzo nativo dell'Event Delegation per mantenere l'impronta in RAM dell'applicazione quasi nulla (gestione di interi moduli con singoli listener).
* **Rendering a 120 FPS:** Le mutazioni del DOM e i calcoli matematici complessi sono sincronizzati con il refresh rate del monitor tramite `requestAnimationFrame`.
* **Protezione Dati (I/O Debouncing):** Le scritture sul disco (`localStorage`) sono regolate da algoritmi di debouncing per azzerare l'usura della memoria flash del dispositivo e preservare la batteria.
* **Safe JSON Parsing:** Architettura di tolleranza agli errori (Type Guards) per prevenire crash applicativi in caso di corruzione dei dati locali.
* **Responsive Design:** Media query per mobile (<768px), tablet (768px-1023px), e desktop (1024px+) con una grafica e layout adattivi che forniscono un'esperienza nativa su ogni dispositivo.

## 📱 Installazione
Essendo una PWA, FemApp non richiede app store.
1. Visita l'URL dell'applicazione tramite Safari (iOS) o Chrome (Android).
2. Seleziona l'opzione "Aggiungi alla schermata Home".
3. L'app sarà da ora disponibile offline sul dispositivo.

### Uso su Desktop
Per una migliore esperienza su computer desktop o laptop:
1. Visita l'URL dell'applicazione tramite Chrome, Firefox, Safari, o Edge.
2. L'interfaccia si adatterà automaticamente al tuo schermo con layout ottimizzato per desktop.
3. Puoi salvare l'app come scorciatoia o installare il PWA dal menu del browser.