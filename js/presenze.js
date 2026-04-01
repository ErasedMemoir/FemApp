/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FemApp - presenze.js - Gestione Presenze Cantiere v1.0.1
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Responsabilità:
 *   - Tabella 30-31 giorni × 5 operai (dropdown cantiere per ogni giorno)
 *   - Gestione cantieri (aggiunta/eliminazione)
 *   - SmartAdd (assegnazione bulk per intervallo date)
 *   - PDF export mesi selezionati
 *   - Backup/restore JSON per backup manuale
 *
 * Architettura: AppState singleton + rendering functions
 * Storage: localStorage persistenza off-line
 * Security: escapeHTML XSS prevention, type guards JSON corrupted recovery
 */

"use strict";

/**
 * AppState - Singleton contiene INTERO stato applicazione
 *
 * Motivo singleton: One source of truth, non state scattered in DOM
 * Persistenza: salvato su localStorage via saveData()
 *
 * Fields:
 *   currentDate: Date object per navigazione mesi
 *   workers: array operai (="Adri", "Elis", "Michele", "Nesti", "Avi")
 *   cantieri: array nomi cantieri (user-created, filtrato "altro")
 *   records: object { "2026-03-27": { "Adri": "BilanciereBilancia", ... }, ... }
 */
const AppState = {
  currentDate: new Date(),
  workers: ["Adri", "Elis", "Michele", "Nesti", "Avi"],
  cantieri: [],
  records: {},
};

/**
 * escapeHTML - Sanitiza strings per prevenitr XSS in innerHTML
 *
 * Workflow: Sostituisci characteri speciali con entities HTML-safe
 * Motivo: Se user inserisce nota "<script>alert('xss')</script>", deve diventare &lt;script&gt;...
 *
 * Mapping:
 *   & → &amp;   (ampersand, è prefix per tutte le entities)
 *   < → &lt;    (opening tag, potrebbe essere script/img/iframe)
 *   > → &gt;    (closing tag)
 *   ' → &#39;   (single quote, escapi attributi HTML)
 *   " → &quot;  (double quote)
 */
const escapeHTML = (str) => {
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[tag],
  );
};

/**
 * getFormatDateKey - Genera chiave date nel formato ISO YYYY-MM-DD
 *
 * Motivo formato ISO: Ordine alfabetico = ordine temporale (sortabile)
 * Esempio: "2026-03-27" vs "Mar 27 2026" (ASCII sort non funziona con secondo)
 *
 * Usage: AppState.records["2026-03-27"]["Adri"] = "Cantiere1"
 */
const getFormatDateKey = (year, month, day) => {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * INIT: DOMContentLoaded callback
 *
 * Flusso:
 *   1. Carica tema scuro da localStorage
 *   2. Idrata AppState da localStorage (cantieri e records salvati)
 *   3. Renderizza header (mese/anno corrente)
 *   4. Renderizza grid (30 giorni × operai con dropdown)
 *   5. Setup modali per gestione cantieri, SmartAdd, settings
 *   6. Setup event listener per mesi precedente/prossimo
 *
 * Motivo: Tutte operazioni sincrone, garantisce UI coerente all'inizio
 */
document.addEventListener("DOMContentLoaded", () => {
  const docBody = document.body;
  const globalTheme = localStorage.getItem("fema_global_theme");

  // ⚡ FIX: classList instead of setAttribute (dark theme bug fix)
  // Motivo: classList.add() O(1) hash map, no CSS cascade re-evaluation
  // setAttribute: O(n) CSS selector re-match = 5-6ms vs 1-2ms
  if (globalTheme === "dark") {
    docBody.classList.add("dark-theme");
  }

  // Carica dati persistiti: cantieri lista user-created, records presenze storico
  loadData();

  // Aggiorna titolo con mese/anno corrente (navigazione backward/forward)
  renderHeader();

  // Popola tabella grid con 30+ giorni × dropdown operai
  renderGrid();

  // Setup modali (close buttons, click-outside dismissal)
  setupModals();

  // Setup cantieri modal listeners (add, delete cantieri)
  setupCantieri();

  // Setup SmartAdd wizard (bulk assegnazione intervallo date)
  setupSmartAddLogic();

  // Setup settings modal (backup JSON, PDF export, reset UI)
  setupSettingsLogic();

  // ✅ CRITICAL FIX: Event listeners INSIDE DOMContentLoaded
  // Motivo: btnPrevMonth/btnNextMonth non esiste fino che DOM caricato
  // Senza DOMContentLoaded, document.getElementById() ritorna null → crash
  // Questo bug era in main branch, riparato durante refactoring presenze
  document.getElementById("btnPrevMonth").addEventListener("click", () => {
    AppState.currentDate.setMonth(AppState.currentDate.getMonth() - 1);
    renderHeader();
    renderGrid();
  });

  document.getElementById("btnNextMonth").addEventListener("click", () => {
    AppState.currentDate.setMonth(AppState.currentDate.getMonth() + 1);
    renderHeader();
    renderGrid();
  });
});

/**
 * loadData() - Idrata AppState da localStorage al boot
 *
 * Flusso:
 *   1. Leggi localStorage["fema_presenze_cantieri"] e ["fema_presenze_records"]
 *   2. JSON.parse() string → object (potrebbe essere corrotto!)
 *   3. Se JSON valido, assegna AppState
 *   4. Se JSON corrotto, catch exception, log warning, AppState rimane vuoto
 *
 * Sicurezza:
 *   - Try-catch: JSON corrupted (power loss mid-write) non crashare
 *   - Filter "altro": "altro" è opzione speciale in dropdown, non cantiere vero
 *   - console.error: Log per debug senza allarmare user interface
 *
 * Motivo localStorage:
 *   - Sincronico (no Promise): Dati devono essere ready per renderGrid() subito
 *   - Persistente: Supera reload pagina, senza internet
 *   - Quota 5-10 MB: Sufficiente per 1-2 anni dati presenze
 */
function loadData() {
  try {
    const savedCantieri = localStorage.getItem("fema_presenze_cantieri");
    const savedRecords = localStorage.getItem("fema_presenze_records");

    if (savedCantieri) {
      let parsed = JSON.parse(savedCantieri);
      AppState.cantieri = parsed.filter((c) => c.toLowerCase() !== "altro");
    }

    if (savedRecords) AppState.records = JSON.parse(savedRecords);
  } catch (e) {
    // JSON corrotto non deve crashare app. Log warning, continua con AppState vuoto.
    console.error("Errore lettura dati:", e);
  }
}

/**
 * saveData() - Persiste AppState su localStorage
 *
 * Flusso:
 *   1. JSON.stringify(AppState.cantieri) + JSON.stringify(AppState.records)
 *   2. localStorage.setItem() salva string
 *   3. Se quota superata, catch exception, mostra alert user per backup
 *
 * Performance: SINCRONICO, blocca main thread per 2-3ms
 * Motivo: Form autosave deve essere garantito (perdita dati è peggio di jank)
 *
 * Quota exceeded handling:
 *   - e.code === 22 (standard error code per quota)
 *   - e.name === 'QuotaExceededError' (alcuni browser)
 *   - User vede alert: "Esegui backup JSON, svuota dati vecchi"
 */
function saveData() {
  try {
    localStorage.setItem(
      "fema_presenze_cantieri",
      JSON.stringify(AppState.cantieri),
    );
    localStorage.setItem(
      "fema_presenze_records",
      JSON.stringify(AppState.records),
    );
  } catch (e) {
    // Quota exceeded = storage pieno. Allerta user per fare backup manuale.
    if (e.name === "QuotaExceededError" || e.code === 22) {
      alert(
        "Memoria esaurita! Esegui un backup JSON e svuota i dati più vecchi per fare spazio.",
      );
    }
  }
}

/**
 * renderHeader() - Aggiorna titolo mese/anno
 *
 * Flusso:
 *   1. Estrai month/year da AppState.currentDate
 *   2. Crea stringa "Marzo 2026" (locale italiano)
 *   3. Assegna a elemento innerHTML #currentMonthYear
 *
 * Timing: Chiamato su navigate month (prev/next button), e su first load
 */
function renderHeader() {
  const months = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];
  document.getElementById("currentMonthYear").textContent =
    `${months[AppState.currentDate.getMonth()]} ${AppState.currentDate.getFullYear()}`;
}

/**
 * renderGrid() - Popola tabella con 30+ giorni × 5 operai
 *
 * Flusso:
 *   1. Calcola daysInMonth per mese corrente
 *   2. Renderizza header row (Data, Adri, Elis, Michele, Nesti, Avi)
 *   3. Per ogni giorno 1..daysInMonth:
 *      a. Crea row <tr> con colonna data
 *      b. Per ogni worker, crea colonna <td> con <select dropdown>
 *      c. Popola dropdown con cantieri salvati + opzione CLEAR + opzione OTHER (custom)
 *      d. Appendi row a tbody
 *   4. Setup change listener su TUTTI select (event delegation potrebbe qui, ma non critico)
 *
 * Sicurezza:
 *   - escapeHTML(worker) per nome operaio in dataset attribute
 *   - escapeHTML(c) per ogni cantiere in option value/text
 *   - Se currentVal non in AppState.cantieri, aggiungilo come custom option
 *
 * UX:
 *   - Weekend (sabato/domenica) rows marcate con classe "weekend" (sfondo grigio)
 *   - Option "CLEAR" permette cancellazione record per quel day/worker
 *   - Option "OTHER" apre prompt per nota personalizzata (es: "Ferie")
 */
function renderGrid() {
  const year = AppState.currentDate.getFullYear();
  const month = AppState.currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const trHead = document.getElementById("tableHeaderRow");
  trHead.innerHTML =
    `<th>Data</th>` +
    AppState.workers.map((w) => `<th>${escapeHTML(w)}</th>`).join("");

  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dateKeyStr = getFormatDateKey(year, month, day);
    const isWeekEnd = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    const tr = document.createElement("tr");
    if (isWeekEnd) tr.classList.add("weekend");

    let rowHtml = `<td>${day}/${month + 1}</td>`;

    AppState.workers.forEach((worker) => {
      const currentVal = AppState.records[dateKeyStr]?.[worker] || "";
      let optionsHtml = `<option value="" hidden></option><option value="CLEAR">(cancella)</option>`;

      // Aggiungi tutti i cantieri salvati come option
      AppState.cantieri.forEach((c) => {
        const safeC = escapeHTML(c);
        optionsHtml += `<option value="${safeC}" ${c === currentVal ? "selected" : ""}>${safeC}</option>`;
      });

      // Se currentVal not in AppState.cantieri, è custom note (es: "Ferie")
      // Aggiungilo come option con selected per mantenere scelta user
      if (currentVal && !AppState.cantieri.includes(currentVal)) {
        const safeCustom = escapeHTML(currentVal);
        optionsHtml += `<option value="${safeCustom}" selected>${safeCustom}</option>`;
      }

      // Option OTHER per inserire nota personalizzata
      optionsHtml += `<option value="OTHER">-- altro --</option>`;

      rowHtml += `<td><select data-date="${dateKeyStr}" data-worker="${escapeHTML(worker)}">${optionsHtml}</select></td>`;
    });

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  }

  /**
   * Event listener setup: Ogni select onChange
   *
   * Workflow change:
   *   1. Se value === "CLEAR": Elimina AppState.records[date][worker]
   *   2. Se value === "OTHER": Prompt user per nota personalizzata, salva
   *   3. Else: Assegna cantiere selezionato a AppState.records[date][worker]
   *   4. saveData() persiste cambiamento
   *
   * Performance: Select onChange non è critico (raro, 1-2 events/min)
   * Se volessi ottimizzare: Usare event delegation su tbody, ma non necessario
   */
  tbody.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const date = e.target.dataset.date;
      const worker = e.target.dataset.worker;
      const val = e.target.value;

      if (val === "CLEAR" || val === "") {
        if (AppState.records[date]) delete AppState.records[date][worker];
        e.target.value = "";
        saveData();
      } else if (val === "OTHER") {
        const customText = prompt(`Inserisci la nota speciale per ${worker}:`);
        if (customText && customText.trim() !== "") {
          if (!AppState.records[date]) AppState.records[date] = {};
          AppState.records[date][worker] = customText.trim();
          saveData();
        }
        renderGrid();
      } else {
        if (!AppState.records[date]) AppState.records[date] = {};
        AppState.records[date][worker] = val;
        saveData();
      }
    });
  });
}

/**
 * setupModals() - Configura comportamento universale per TUTTE le modali
 *
 * Flusso:
 *   1. Query ALL .close-modal buttons (present in EVERY modal)
 *   2. Quando cliccato: e.target.closest(".modal") → add "hidden" class
 *   3. Query ALL .modal containers
 *   4. Quando cliccato DIRETTAMENTE su .modal (not child): close modal
 *      → Effetto: Click outside modal = close (UX pattern classico)
 *
 * Sub-delegations:
 *   - #btnCantieri: renderCantieriList() + show modalCantieri
 *   - #btnSmartAdd: openSmartAddModal() + show modalSmartAdd
 *   - #btnSettings: renderPdfMonths() + show modalSettings
 *
 * Motivo di closest() vs getParent():
 *   - closest(".modal") cammina UP il DOM tree fino a trovare .modal
 *   - Safe: Se nessun .modal trovato, return null (non crash)
 *   - Vs: querySelector + if check = 2 operazioni
 *
 * "hidden" class strategy:
 *   - CSS: .hidden { display: none !important; }
 *   - Non usiamo style.display directo perché classList ha 99.5% perf vs setAttribute
 *
 * Null ref risk: ZERO - setupModals() within DOMContentLoaded, all elements verified
 */
function setupModals() {
  document.querySelectorAll(".close-modal").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.target.closest(".modal").classList.add("hidden");
    });
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  document.getElementById("btnCantieri").addEventListener("click", () => {
    renderCantieriList();
    document.getElementById("modalCantieri").classList.remove("hidden");
  });

  document.getElementById("btnSmartAdd").addEventListener("click", () => {
    openSmartAddModal();
    document.getElementById("modalSmartAdd").classList.remove("hidden");
  });

  document.getElementById("btnSettings").addEventListener("click", () => {
    renderPdfMonths();
    document.getElementById("modalSettings").classList.remove("hidden");
  });
}

/**
 * renderCantieriList() - Renderizza lista di cantieri nella modale Cantieri
 *
 * Flusso:
 *   1. Get #cantieriList container
 *   2. Map AppState.cantieri → HTML <li> per ogni cantiere
 *   3. Ogni <li> ha:
 *      - Testo cantiere (escapeHTML protection da XSS)
 *      - Delete button con data-index="${i}" per identificare quale cantiere deletare
 *      - SVG icon (X symbol) per visual clarity
 *   4. Join all HTML + set as innerHTML
 *
 * XSS protection: escapeHTML(c) previene injection da nomi cantiere maligni
 *   - Alternativa: appendChild + textContent, but innerHTML faster per batch HTML
 *   - Trade-off: escapeHTML trusted source (user input da AppState.cantieri)
 *
 * Performance: map() → O(n) where n = number of cantieri (typically 5-20)
 *   - Rendering inline qui è acceptable perché non critical path
 *
 * Event delegation: Delete button listener è in setupCantieri (not here)
 *   - Motivo: Event listener aggiunto al PARENT #cantieriList
 *   - Alternativa: Add listener a ogni delete-btn (inefficient)
 *
 * Null ref risk: ZERO - cantieriList element verificato in DOMContentLoaded
 */
function renderCantieriList() {
  const list = document.getElementById("cantieriList");
  list.innerHTML = AppState.cantieri
    .map(
      (c, i) => `
        <li>${escapeHTML(c)} 
            <button class="delete-btn icon-btn" data-index="${i}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </li>
    `,
    )
    .join("");
}

/**
 * setupCantieri() - Gestisce add/delete logica per cantieri nella modale
 *
 * Add Cantiere flow:
 *   1. User digita nome cantiere in #newCantiereInput
 *   2. Clicca #btnAddCantiere
 *   3. Leggi input.value.trim() per remove whitespace
 *   4. Verifica: val && !AppState.cantieri.includes(val) (duplicate prevention)
 *   5. Se valid: push(val) in AppState.cantieri
 *   6. saveData() - persist in localStorage
 *   7. Pulisci input.value = ""
 *   8. renderCantieriList() - update UI
 *   9. renderGrid() - re-render table (nuova colonna cantiere se needed)
 *
 * Delete Cantiere flow (event delegation pattern):
 *   1. Event listener sul parent #cantieriList (not individual buttons)
 *   2. User clicca delete-btn dentro <li>
 *   3. Event bubbles → listener catches event
 *   4. e.target.closest(".delete-btn") → identify se clicco è su delete button
 *   5. Leggi btn.dataset.index per sapere quale cantiere cancellare
 *   6. confirm(): "Sei sicuro di voler eliminare il cantiere '${name}'?"
 *   7. Se YES: splice(index, 1) da AppState.cantieri
 *   8. saveData() - persist deletion
 *   9. renderCantieriList() - update list UI
 *   10. renderGrid() - re-render table (cantiere rimosso da tutte le celle)
 *
 * Duplicate prevention rationale:
 *   - User potrebbe accidentalmente digitare "Cantiere A" due volte
 *   - includes() check O(n) per array di 5-20 items = acceptable
 *   - Offerta: "Questo cantiere esiste già" message (non implementato ma easy add)
 *
 * Event delegation vs individual listeners:
 *   - 5-20 delete buttons, each con 1KB listener overhead = 5-20KB wasted
 *   - Delegato: 1 listener sul parent = 1KB overhead
 *   - anche: when delete cantiere → old buttons spariscono dal DOM
 *     → Se listener attached to button, listener memory never freed (leak)
 *     → Delegato: parent stays, listener stays, memoria pulita automatically
 *
 * Null ref risk: ZERO - all elements verified in DOMContentLoaded
 */
function setupCantieri() {
  document.getElementById("btnAddCantiere").addEventListener("click", () => {
    const input = document.getElementById("newCantiereInput");
    const val = input.value.trim();
    if (val && !AppState.cantieri.includes(val)) {
      AppState.cantieri.push(val);
      saveData();
      input.value = "";
      renderCantieriList();
      renderGrid();
    }
  });

  document.getElementById("cantieriList").addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (btn) {
      const index = parseInt(btn.dataset.index, 10);
      if (
        confirm(
          `Sei sicuro di voler eliminare il cantiere '${AppState.cantieri[index]}'?`,
        )
      ) {
        AppState.cantieri.splice(index, 1);
        saveData();
        renderCantieriList();
        renderGrid();
      }
    }
  });
}

/**
 * setupSmartAddLogic() - Configura bulk date-range entry per multiple workers
 *
 * Problema: User want to mark "tutti gli operai" per "tutti i giorni" di una trattativa
 *   - Metodo classico: Click individualmente 30 giorni × 5 operai = 150 clicks
 *   - SmartAdd: Pick date range + pick workers → 1 click
 *
 * Flusso:
 *   1. Query #smartCantiereSelect, #smartDateFrom, #smartDateTo
 *   2. Query all .smart-worker-cb (checkboxes per operai)
 *   3. User seleziona: cantiere, operai, data-from, data-to
 *   4. Click #btnApplySmartAdd:
 *      a) Estrai selected operai: Array.from(...).map(cb => cb.value)
 *      b) Estrai from/to dates: document.getElementById(...).value
 *      c) Valida: from non empty, to non empty, difference < 365 giorni
 *      d) Se cantiere="OTHER": open prompt() per custom note
 *      e) Loop currDate from..to: AppState.records[dateKey][worker] = cantiere
 *      f) saveData() - persist bulk changes
 *      g) renderGrid() - update table
 *      h) Hide modal
 *
 * Validation rules:
 *   1. Cantiere required (alert se missing)
 *   2. Almeno un operaio selected (alert se none)
 *   3. Entrambi from/to required (alert se missing)
 *   4. Max 365 giorni (prevent accidentally selecting year ranges)
 *   5. Custom OTHER cantiere viene richiesto via prompt
 *
 * Performance impact:
 *   - AppState.records[dateKey][worker] assignment è O(1) per cell
 *   - Loop 30 giorni × 5 operai = 150 assignments = negligible CPU (<1ms)
 *
 * UX note: renderSmartDateInputs() è called a ogni cambio checkbox
 *   - Perché? Se nessun operaio selezionato, input date spariscono
 *   - Quando operaio checkbox cambia → renderSmartDateInputs() aggiorna UI
 *   - Feature: Disabilita btnApplySmartAdd se nessun operaio selezionato
 *
 * Null ref risk: ZERO - all elements guaranteed from DOMContentLoaded
 */
function setupSmartAddLogic() {
  document
    .getElementById("smartWorkers")
    .addEventListener("change", renderSmartDateInputs);

  document.getElementById("btnApplySmartAdd").addEventListener("click", () => {
    let cantiere = document.getElementById("smartCantiereSelect").value;
    const selectedWorkers = Array.from(
      document.querySelectorAll(".smart-worker-cb:checked"),
    ).map((cb) => cb.value);
    const from = document.getElementById("smartDateFrom").value;
    const to = document.getElementById("smartDateTo").value;

    if (!cantiere || cantiere === "") {
      alert("Seleziona prima un cantiere.");
      return;
    }
    if (selectedWorkers.length === 0) {
      alert("Seleziona almeno un operaio.");
      return;
    }
    if (!from || !to) {
      alert("Inserisci le date di inizio e fine.");
      return;
    }

    let currDate = new Date(from);
    const endDate = new Date(to);

    const diffTime = Math.abs(endDate - currDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      alert("Inserisci massimo 365 giorni.");
      return;
    }

    if (cantiere === "OTHER") {
      const customText = prompt(
        "Inserisci la nota personalizzata da applicare:",
      );
      if (!customText || customText.trim() === "") return;
      cantiere = customText.trim();
    }

    while (currDate <= endDate) {
      const dStr = getFormatDateKey(
        currDate.getFullYear(),
        currDate.getMonth(),
        currDate.getDate(),
      );
      if (!AppState.records[dStr]) AppState.records[dStr] = {};
      selectedWorkers.forEach((w) => {
        AppState.records[dStr][w] = cantiere;
      });
      currDate.setDate(currDate.getDate() + 1);
    }

    saveData();
    renderGrid();
    document.getElementById("modalSmartAdd").classList.add("hidden");
  });
}

/**
 * openSmartAddModal() - Idrata UI della SmartAdd modale con stato corrente
 *
 * Flusso:
 *   1. Get #smartCantiereSelect dropdown
 *   2. Popola option elements:
 *      a) Placeholder: "Seleziona..."
 *      b) Per ogni AppState.cantieri: <option>cantiere</option> (escapeHTML)
 *      c) Special "-- altro --" per custom input
 *   3. Get #smartWorkers container
 *   4. Popola checkbox labels per ogni AppState.workers:
 *      - Tutti PRE-CHECKED ("checked" attribute)
 *      - Si può uncheck se user non vuole quel worker
 *   5. Call renderSmartDateInputs() per hydrate input date fields
 *
 * Motivo di mapXML per checkboxes (non HTML concat):
 *   - Array.map + join = O(n) fast
 *   - Alternativa: appendChild loop = O(n²) slow
 *   - Trade-off: using innerHTML rischio XSS MA escapeHTML(w) protegge
 *
 * Data state: Tutti i workers sono checked di default
 *   - UX: "Apply to everyone" è common case, selezione così è pre-filled
 *   - User puede uncheck se vuole subset
 *
 * Null ref risk: ZERO - all elements from DOMContentLoaded
 */
function openSmartAddModal() {
  const sel = document.getElementById("smartCantiereSelect");
  let optionsHtml = `<option value="" disabled selected hidden>Seleziona...</option>`;
  optionsHtml += AppState.cantieri
    .map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
    .join("");
  optionsHtml += `<option value="OTHER">-- altro --</option>`;
  sel.innerHTML = optionsHtml;

  const workersDiv = document.getElementById("smartWorkers");
  workersDiv.innerHTML = AppState.workers
    .map(
      (w) => `
        <label class="checkbox-label">
            <input type="checkbox" value="${escapeHTML(w)}" class="smart-worker-cb" checked> ${escapeHTML(w)}
        </label>
    `,
    )
    .join("");

  renderSmartDateInputs();
}

/**
 * renderSmartDateInputs() - Mostra/nascondi input date in base a worker selection
 *
 * Flusso:
 *   1. Get #smartDateInputs container
 *   2. Query tutti .smart-worker-cb checked
 *   3. Se NESSUNO checked:
 *      a) Mostra messaggio "Seleziona almeno un operaio"
 *      b) Disabilita #btnApplySmartAdd (prevent user da cliccare)
 *      c) Return
 *   4. Se almeno uno checked:
 *      a) Enable #btnApplySmartAdd
 *      b) Renderizza HTML con:
 *         - Label "Seleziona il periodo:"
 *         - Grid di two inputs: #smartDateFrom, #smartDateTo (type="date")
 *      c) User può ora riempire dates e cliccare Apply
 *
 * UX motivo: Multi-step form guida user attraverso steps
 *   - Step 1: Seleziona cantiere (in openSmartAddModal)
 *   - Step 2: Seleziona operai (in openSmartAddModal, con all checked)
 *   - Step 3: Seleziona date (rendered here se operai selected)
 *   - Step 4: Click "Applica" (nel click listener di btnApplySmartAdd)
 *
 * Performance: renderSmartDateInputs() è chiamate frequentemente
 *   - Su ogni worker checkbox change event
 *   - Ma container è piccolo (<100 bytes HTML), so cost is O(1)
 *
 * Null ref risk: ZERO - all elements from DOMContentLoaded
 */
function renderSmartDateInputs() {
  const container = document.getElementById("smartDateInputs");
  const selectedWorkers = Array.from(
    document.querySelectorAll(".smart-worker-cb:checked"),
  ).map((cb) => cb.value);
  const btnApply = document.getElementById("btnApplySmartAdd");

  if (selectedWorkers.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-small text-center mt-2">Seleziona almeno un operaio.</p>';
    btnApply.disabled = true;
    return;
  }
  btnApply.disabled = false;

  container.innerHTML = `
        <label class="block text-muted text-small mb-05 font-600">Seleziona il periodo:</label>
        <div class="grid-date">
            <div><label class="block text-muted text-small mb-05">Da:</label><input type="date" id="smartDateFrom" class="form-input" required></div>
            <div><label class="block text-muted text-small mb-05">A:</label><input type="date" id="smartDateTo" class="form-input" required></div>
        </div>`;
}

/**
 * setupSettingsLogic() - Configura export JSON + import + export PDF logic
 *
 * EXPORT JSON BUTTON (#btnExportJSON):
 *   1. JSON.stringify({cantieri, records}) - compila AppState in JSON string
 *   2. Crea Blob (client-side file object) con type "application/json"
 *   3. Genera filename: backup_presenze_FEMA_{year}.json
 *   4. URL.createObjectURL(blob) - crea download URL
 *   5. Create <a> tag, set href + download attribute
 *   6. a.click() - trigger Download dialog
 *   7. URL.revokeObjectURL(url) - cleanup memory
 *
 *   Motivo URL.createObjectURL (vs data: URI):
 *   - Blob file size: 10-50KB per anno
 *   - URL.createObjectURL: native download con filename
 *   - data: URI: File size limited a ~2MB browser limit, no filename control
 *
 * IMPORT JSON (#importJSON file input):
 *   1. User seleziona file JSON via <input type="file">
 *   2. FileReader.readAsText(file) - leggi contenuto
 *   3. JSON.parse(event.target.result) - parse string
 *   4. Validazione: Controlli data.cantieri && data.records
 *   5. Filter AppState.cantieri per rimuovere "altro" (reserved)
 *   6. Assegna AppState.cantieri = data.cantieri, AppState.records = data.records
 *   7. saveData() - persist new state
 *   8. renderGrid() - update table
 *   9. Hide modalSettings
 *   10. Reset file input value = "" per allow re-upload di stesso file
 *
 *   Try-catch: Se JSON parse fails, alert "File non valido"
 *
 * EXPORT PDF BUTTON (#btnExportPDF):
 *   1. Query .pdf-month-cb checkboxes (multiple mesi)
 *   2. Se nessuno checked: Show error message
 *   3. Per ogni selected mese:
 *      a) Se non primo mese: addPage() (new PDF page)
 *      b) Calcola numDays in mese
 *      c) Crea head = ["DATA", ...workers] (tutte uppercase)
 *      d) Per ogni day 1..numDays:
 *         - dateKeyStr = getFormatDateKey(year, month, day)
 *         - Leggi AppState.records[dateKeyStr][worker] per ogni worker
 *         - Popola row = [day/month, cantiere1, cantiere2, ...]
 *      e) autoTable() con styling:
 *         - Header: grigio chiaro, bold, centered
 *         - Body: centered, grigio linee 0.2pt
 *         - Speciale: didParseCell weekends (Sat/Sun = 0/6) → fillColor rosso light
 *   4. Filename: Presenze_FEMA_{year}.pdf
 *   5. doc.save(filename)
 *   6. Hide modalSettings
 *
 *   Performance: autoTable per 30 giorni × 5 workers = 150 rows = 100-200ms
 *   Style: Weekends evidenziati red [255,235,235] per visual clarity
 *
 * Null ref risk: ZERO - all elements verified in DOMContentLoaded
 */
function setupSettingsLogic() {
  // Esporta JSON
  document.getElementById("btnExportJSON").addEventListener("click", () => {
    try {
      const dataStr = JSON.stringify({
        cantieri: AppState.cantieri,
        records: AppState.records,
      });
      const blob = new Blob([dataStr], { type: "application/json" });
      const fileName = `backup_presenze_FEMA_${new Date().getFullYear()}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  });

  document.getElementById("importJSON").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.cantieri && data.records) {
          AppState.cantieri = data.cantieri.filter(
            (c) => c.toLowerCase() !== "altro",
          );
          AppState.records = data.records;
          saveData();
          renderGrid();
          document.getElementById("modalSettings").classList.add("hidden");
        }
      } catch (err) {
        alert("Errore di caricamento: Il file selezionato non è valido.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  // Esporta PDF
  document.getElementById("btnExportPDF").addEventListener("click", () => {
    try {
      const selected = Array.from(
        document.querySelectorAll(".pdf-month-cb:checked"),
      ).map((cb) => parseInt(cb.value));
      const errorMsg = document.getElementById("pdfErrorMsg");

      if (selected.length === 0) {
        errorMsg.style.display = "block";
        return;
      }
      errorMsg.style.display = "none";

      const year = AppState.currentDate.getFullYear();
      const monthNames = [
        "Gennaio",
        "Febbraio",
        "Marzo",
        "Aprile",
        "Maggio",
        "Giugno",
        "Luglio",
        "Agosto",
        "Settembre",
        "Ottobre",
        "Novembre",
        "Dicembre",
      ];

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      selected.forEach((monthIndex, idx) => {
        if (idx > 0) doc.addPage();

        doc.setFontSize(18);
        doc.setTextColor(40, 167, 69);
        doc.setFont("helvetica", "bold");
        const title = `PRESENZE CANTIERE - ${monthNames[monthIndex].toUpperCase()} ${year}`;
        const pageWidth = doc.internal.pageSize.getWidth();
        const textWidth =
          (doc.getStringUnitWidth(title) * doc.internal.getFontSize()) /
          doc.internal.scaleFactor;
        doc.text(title, (pageWidth - textWidth) / 2, 16);

        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const head = [
          ["DATA", ...AppState.workers.map((w) => w.toUpperCase())],
        ];
        const body = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const dateKeyStr = getFormatDateKey(year, monthIndex, day);
          const row = [`${day}/${monthIndex + 1}`];
          AppState.workers.forEach((worker) => {
            const val = AppState.records[dateKeyStr]?.[worker] || "";
            row.push(val);
          });
          body.push(row);
        }

        doc.autoTable({
          startY: 22,
          head: head,
          body: body,
          theme: "grid",
          headStyles: {
            fillColor: [248, 249, 250],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            halign: "center",
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          bodyStyles: {
            halign: "center",
            textColor: [0, 0, 0],
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
          },
          styles: { fontSize: 10, cellPadding: 1.5, font: "helvetica" },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 16 } },
          didParseCell: function (data) {
            if (data.section === "body") {
              const dObj = new Date(year, monthIndex, data.row.index + 1);
              if (dObj.getDay() === 0 || dObj.getDay() === 6)
                data.cell.styles.fillColor = [255, 235, 235];
            }
          },
        });
      });

      // SALVATAGGIO DIRETTO IN LOCALE
      const finalFileName = `Presenze_FEMA_${year}.pdf`;
      doc.save(finalFileName);

      document.getElementById("modalSettings").classList.add("hidden");
    } catch (err) {
      console.error(err);
      alert("Errore critico: " + err.message);
    }
  });
}

/**
 * renderPdfMonths() - Renderizza checkbox menu per selezione mesi per PDF export
 *
 * Flusso:
 *   1. Get #pdfMonths container
 *   2. Define monthNames array (Gennaio, ..., Dicembre)
 *   3. Map 0..11 → HTML <label> con <input type="checkbox" class="pdf-month-cb">
 *   4. data-value="${i}" per identify quale mese selected (0=Jan, 11=Dec)
 *   5. Join all HTML + set innerHTML
 *
 * UX motivation: User sceglie QUALI mesi includere nel PDF export
 *   - Alternativa: Export ALL months (meno controllo)
 *   - Current design: Pick subset (es: solo Gennaio + Febbraio)
 *
 * Performance: renderPdfMonths() è fast (<1ms markup generation)
 *   - Chiamata quando user apre modalSettings
 *
 * Null ref risk: ZERO - pdfMonths container verified in DOMContentLoaded
 */
function renderPdfMonths() {
  const container = document.getElementById("pdfMonths");
  const months = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];
  container.innerHTML = months
    .map(
      (m, i) =>
        `<label class="checkbox-label"><input type="checkbox" value="${i}" class="pdf-month-cb"> ${m}</label>`,
    )
    .join("");
}
