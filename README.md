# FemApp - Gestione Edile Avanzata

![Version](https://imgshields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-PWA-brightgreen)
![Tech](https://img.shields.io/badge/tech-Vanilla_JS-yellow)

## 📋 Panoramica
**FemApp** è un'applicazione web progressiva (PWA) offline-first progettata specificamente per la gestione operativa nei cantieri edili. Permette di tracciare le presenze degli operai e generare preventivi o fatture direttamente sul campo, senza necessità di una connessione internet.

## ✨ Funzionalità Principali
* **Gestione Presenze:** Tracciamento giornaliero degli operai con supporto per cantieri multipli, note personalizzate e inserimento massivo (SmartAdd).
* **Motore Preventivi:** Calcolo in tempo reale di subtotali, IVA e sconti, con supporto per descrizioni estese e formattazione valutaria automatica.
* **Esportazione PDF:** Generazione nativa e offline di documenti PDF per i resoconti mensili delle presenze e per i preventivi da consegnare ai clienti.
* **Backup e Ripristino:** Sistema di salvataggio sicuro in formato JSON per esportare o trasferire i dati aziendali tra dispositivi.

## 🏗️ Architettura Tecnica
Il progetto è stato sviluppato seguendo rigorosi standard ingegneristici per garantire la massima reattività su dispositivi mobili in condizioni di cantiere:
* **Vanilla "Bare-Metal" JS:** Nessun framework esterno. L'app è scritta in puro JavaScript ES6+ per azzerare i tempi di caricamento.
* **Ottimizzazione Memoria:** Utilizzo nativo dell'Event Delegation per mantenere l'impronta in RAM dell'applicazione quasi nulla (gestione di interi moduli con singoli listener).
* **Rendering a 120 FPS:** Le mutazioni del DOM e i calcoli matematici complessi sono sincronizzati con il refresh rate del monitor tramite `requestAnimationFrame`.
* **Protezione Dati (I/O Debouncing):** Le scritture sul disco (`localStorage`) sono regolate da algoritmi di debouncing per azzerare l'usura della memoria flash del dispositivo e preservare la batteria.
* **Safe JSON Parsing:** Architettura di tolleranza agli errori (Type Guards) per prevenire crash applicativi in caso di corruzione dei dati locali.

## 📱 Installazione
Essendo una PWA, FemApp non richiede app store.
1. Visita l'URL dell'applicazione tramite Safari (iOS) o Chrome (Android).
2. Seleziona l'opzione "Aggiungi alla schermata Home".
3. L'app sarà da ora disponibile offline sul dispositivo.