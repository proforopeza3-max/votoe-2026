/**
 * SISTEMA DE VOTO ELECTRÓNICO ESTUDIANTIL
 * Aplicación Principal (UI, Lógica de Negocio y Flujo Electoral)
 * Compatible con GitHub Pages y Google Sheets
 */

// Estado Global de la Aplicación
const AppState = {
  config: {
    adminPass: "admin12345",
    tableCount: 6,
    tablePatterns: {
      "1": "03678",
      "2": "67852",
      "3": "85210",
      "4": "21036",
      "5": "0124678",
      "6": "0367852"
    },
    systemTitle: 'Elecciones Estudiantiles 2026 - IE 23014 "ENRIQUE FRACCHIA"',
    systemInsignia: getDefaultInsigniaSvg()
  },
  candidatos: [
    {
      id: "c386467",
      nombre: "LA VOZ DEL FUTURO",
      imagenBase64: getDefaultCandidateIcon("futuro")
    },
    {
      id: "c372475",
      nombre: "ARBOL DE LA SABIDURIA",
      imagenBase64: getDefaultCandidateIcon("arbol")
    },
    {
      id: "c1",
      nombre: "VOTO BLANCO",
      imagenBase64: getDefaultCandidateIcon("blanco")
    }
  ],
  votos: [
    { timestamp: 1787863093925, mesa: 3, candidatoId: "c386467", hash: "MY1JMZG2NDY3LTE" },
    { timestamp: 1787863104950, mesa: 3, candidatoId: "c372475", hash: "MY1JMZCYNDC1LTE" },
    { timestamp: 1787863632452, mesa: 3, candidatoId: "c1", hash: "MY1JMS0XNZG3ODY" },
    { timestamp: 1787864928027, mesa: 1, candidatoId: "c372475", hash: "MS1JMZCYNDC1LTE" },
    { timestamp: 1792612133298, mesa: 1, candidatoId: "c372475", hash: "MS1JMZCYNDC1LTE" },
    { timestamp: 1792679204603, mesa: 1, candidatoId: "c372475", hash: "MS1JMZCYNDC1LTE" },
    { timestamp: 1794334389197, mesa: 1, candidatoId: "c1", hash: "MS1JMS0XNZK0MZM" }
  ],
  currentMesa: 1,
  adminLoggedIn: false,
  editingCandidateId: null,
  configuringMesaForPattern: 1,
  tempDrawnPattern: ""
};

// Instancias de PatternLock y temporizadores
let unlockPatternLock = null;
let configPatternLock = null;
let autoCloseTimer = null;
let autoCloseInterval = null;

// Inicialización de la Aplicación
document.addEventListener("DOMContentLoaded", () => {
  loadLocalState();
  initUI();
  initPatternLocks();
  initGasSync();
  convertDefaultIconsToPngBase64();
});

/**
 * Carga el estado guardado en localStorage o mantiene los valores por defecto
 */
function loadLocalState() {
  try {
    const savedConfig = localStorage.getItem("votoe_config");
    if (savedConfig) {
      AppState.config = { ...AppState.config, ...JSON.parse(savedConfig) };
    }
    const savedCandidatos = localStorage.getItem("votoe_candidatos");
    if (savedCandidatos) {
      AppState.candidatos = JSON.parse(savedCandidatos);
    }
    const savedVotos = localStorage.getItem("votoe_votos");
    if (savedVotos) {
      AppState.votos = JSON.parse(savedVotos);
    }
  } catch (e) {
    console.error("Error al leer datos locales de localStorage:", e);
  }
}

/**
 * Guarda el estado en localStorage
 */
function saveLocalState() {
  try {
    localStorage.setItem("votoe_config", JSON.stringify(AppState.config));
    localStorage.setItem("votoe_candidatos", JSON.stringify(AppState.candidatos));
    localStorage.setItem("votoe_votos", JSON.stringify(AppState.votos));
  } catch (e) {
    console.error("Error al persistir estado local:", e);
  }
}

/**
 * Inicialización de componentes de la Interfaz
 */
function initUI() {
  updateSystemBranding();
  renderCandidatesInAdmin();
  renderMesaSelector();
  renderAdminResults();

  // Actualizar campo de GAS URL
  const gasUrlInput = document.getElementById("input-gas-url");
  if (gasUrlInput) {
    gasUrlInput.value = GasClient.getGasUrl();
  }
  updateConnectionBadge();
}

/**
 * Inicializa los dos widgets de patrón táctil (Desbloqueo y Configuración)
 */
function initPatternLocks() {
  // Widget de Desbloqueo de Mesa (Para el votante / jurado)
  const unlockContainer = document.getElementById("pattern-container-unlock");
  if (unlockContainer) {
    unlockPatternLock = new PatternLock(unlockContainer, {
      onComplete: (patternStr) => handleUnlockPatternAttempt(patternStr)
    });
  }

  // Widget de Configuración de Patrón (En panel de administración)
  const configContainer = document.getElementById("pattern-container-config");
  if (configContainer) {
    configPatternLock = new PatternLock(configContainer, {
      onComplete: (patternStr) => handleConfigPatternDrawn(patternStr)
    });
  }
}

/**
 * Sincronización inicial con Google Apps Script si está configurado
 */
async function initGasSync() {
  if (GasClient.isConfigured()) {
    showToast("Conectando con Google Sheets...", "info");
    try {
      const data = await GasClient.loadAllData();
      if (data && data.success) {
        if (data.config && Object.keys(data.config).length > 0) {
          AppState.config = { ...AppState.config, ...data.config };
        }
        if (data.candidatos && Array.isArray(data.candidatos) && data.candidatos.length > 0) {
          AppState.candidatos = data.candidatos;
        }
        if (data.votos && Array.isArray(data.votos)) {
          AppState.votos = data.votos;
        }
        saveLocalState();
        updateSystemBranding();
        renderCandidatesInAdmin();
        renderMesaSelector();
        renderAdminResults();
        updateConnectionBadge(true);
        showToast("Datos sincronizados con Google Sheets", "success");

        // Enviar votos offline si hubieran quedado pendientes
        GasClient.flushOfflineQueue();
      }
    } catch (err) {
      console.warn("No se pudo sincronizar en el arranque con Google Sheets:", err);
      updateConnectionBadge(false);
    }
  }
}

/**
 * Actualiza logotipo, títulos y textos dinámicos en toda la pantalla
 */
function updateSystemBranding() {
  const headerTitle = document.getElementById("header-system-title");
  if (headerTitle) {
    headerTitle.textContent = AppState.config.systemTitle || "Elecciones Estudiantiles";
  }
  document.title = AppState.config.systemTitle || "Sistema de Voto Electrónico";

  const homeInsignia = document.getElementById("home-school-insignia");
  if (homeInsignia) {
    homeInsignia.src = AppState.config.systemInsignia || getDefaultInsigniaSvg();
  }

  // Actualizar campos en el panel de control
  const inputTitle = document.getElementById("admin-input-title");
  if (inputTitle) {
    inputTitle.value = AppState.config.systemTitle || "";
  }

  const inputPass = document.getElementById("admin-input-pass");
  if (inputPass) {
    inputPass.value = AppState.config.adminPass || "admin12345";
  }

  const inputTables = document.getElementById("admin-input-tables");
  if (inputTables) {
    inputTables.value = AppState.config.tableCount || 6;
  }

  updateMesaDropdownInConfig();
}

/**
 * Actualiza el selector desplegable de mesas en la pestaña de configuración
 */
function updateMesaDropdownInConfig() {
  const select = document.getElementById("config-select-mesa");
  if (!select) return;

  select.innerHTML = "";
  const total = AppState.config.tableCount || 6;
  for (let i = 1; i <= total; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Mesa ${i}`;
    select.appendChild(opt);
  }
}

/**
 * Actualiza el indicador visual de conexión con Google Sheets
 */
function updateConnectionBadge(isConnected = null) {
  const badge = document.getElementById("header-status-badge");
  const dot = document.getElementById("header-status-dot");
  const text = document.getElementById("header-status-text");
  if (!badge || !dot || !text) return;

  const hasUrl = GasClient.isConfigured();
  if (!hasUrl) {
    dot.className = "status-dot local";
    text.textContent = "Modo Local (Demo)";
    badge.title = "Los datos se guardan en el navegador. Configure Google Sheets en el panel.";
  } else if (isConnected === true) {
    dot.className = "status-dot online";
    text.textContent = "Google Sheets Conectado";
    badge.title = "Sincronizado en tiempo real con Google Sheets";
  } else {
    dot.className = "status-dot online";
    text.textContent = "Google Sheets Activo";
    badge.title = "Configurado con Web App de Google";
  }
}

// ==========================================================================
// NAVEGACIÓN Y GESTIÓN DE VISTAS
// ==========================================================================

function showView(viewId) {
  const views = document.querySelectorAll(".view-section");
  views.forEach((v) => v.classList.remove("active"));

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Redimensionar canvas de patrón si aplica
  if (viewId === "view-unlock-mesa" && unlockPatternLock) {
    setTimeout(() => {
      unlockPatternLock.resizeCanvas();
      unlockPatternLock.resetState();
    }, 50);
  }
}

function showHomeView() {
  showView("view-home");
}

function showSelectMesaView() {
  renderMesaSelector();
  showView("view-select-mesa");
}

function openMesaVoting(mesaNum) {
  AppState.currentMesa = parseInt(mesaNum, 10);
  const subtitle = document.getElementById("unlock-mesa-subtitle");
  if (subtitle) {
    subtitle.textContent = `Mesa ${AppState.currentMesa}`;
  }
  showView("view-unlock-mesa");
  if (unlockPatternLock) {
    unlockPatternLock.resetState();
    unlockPatternLock.enable();
  }
}

/**
 * Valida el patrón dibujado para desbloquear la cédula de votación
 */
function handleUnlockPatternAttempt(drawnPattern) {
  const mesa = String(AppState.currentMesa);
  const expectedPattern = (AppState.config.tablePatterns && AppState.config.tablePatterns[mesa]) || "03678";

  if (drawnPattern === expectedPattern) {
    // Éxito: patrón correcto
    unlockPatternLock.setSuccess();
    setTimeout(() => {
      openCedulaView();
    }, 350);
  } else {
    // Error: patrón incorrecto
    unlockPatternLock.setError();
    showToast("Patrón incorrecto para esta mesa", "error");
  }
}

/**
 * Abre la cédula de sufragio tras el desbloqueo exitoso
 */
function openCedulaView() {
  const mesaBadge = document.getElementById("cedula-mesa-badge");
  if (mesaBadge) {
    mesaBadge.textContent = `MESA ${AppState.currentMesa}`;
  }
  renderBallotCards();
  showView("view-cedula");
}

/**
 * Renderiza los candidatos en la cédula de sufragio
 */
function renderBallotCards() {
  const container = document.getElementById("ballot-cards-grid");
  if (!container) return;

  container.innerHTML = "";
  AppState.candidatos.forEach((cand) => {
    const card = document.createElement("div");
    card.className = "ballot-card";
    card.onclick = () => confirmVote(cand);

    const img = document.createElement("img");
    img.className = "ballot-logo";
    img.src = cand.imagenBase64 || getDefaultCandidateIcon("blanco");
    img.alt = cand.nombre;

    const name = document.createElement("div");
    name.className = "ballot-candidate-name";
    name.textContent = cand.nombre;

    card.appendChild(img);
    card.appendChild(name);
    container.appendChild(card);
  });
}

/**
 * Emite un sonido positivo a alto volumen al registrar el voto
 */
function playPositiveVoteSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Ganancia Master en volumen alto (1.0)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Arpegio armónico mayor ascendente: C5 -> E5 -> G5 -> C6
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.14 }, // Do 5
      { freq: 659.25, time: 0.11, dur: 0.14 }, // Mi 5
      { freq: 783.99, time: 0.22, dur: 0.18 }, // Sol 5
      { freq: 1046.50, time: 0.36, dur: 0.65 } // Do 6 (resonante final)
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);

      const tStart = ctx.currentTime + note.time;
      const tEnd = tStart + note.dur;

      noteGain.gain.setValueAtTime(0.001, tStart);
      noteGain.gain.exponentialRampToValueAtTime(0.9, tStart + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, tEnd);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(tStart);
      osc.stop(tEnd);
    });
  } catch (err) {
    console.warn("No se pudo emitir sonido de voto:", err);
  }
}

/**
 * Control del temporizador de cierre automático (3 segundos)
 */
function startAutoCloseSuccessModal() {
  clearAutoCloseSuccessModal();

  let remaining = 3;
  const finishBtn = document.getElementById("btn-success-finish");
  const secondsText = document.getElementById("autoclose-seconds-text");
  const progressBar = document.getElementById("autoclose-progress-bar");

  if (finishBtn) finishBtn.textContent = `Finalizar (${remaining}s)`;
  if (secondsText) secondsText.textContent = remaining;

  if (progressBar) {
    progressBar.style.transition = "none";
    progressBar.style.width = "100%";
    setTimeout(() => {
      progressBar.style.transition = "width 3s linear";
      progressBar.style.width = "0%";
    }, 20);
  }

  autoCloseInterval = setInterval(() => {
    remaining--;
    if (secondsText) secondsText.textContent = Math.max(0, remaining);
    if (finishBtn) finishBtn.textContent = remaining > 0 ? `Finalizar (${remaining}s)` : "Finalizando...";
  }, 1000);

  autoCloseTimer = setTimeout(() => {
    clearAutoCloseSuccessModal();
    finishVoting();
  }, 3000);
}

function clearAutoCloseSuccessModal() {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  if (autoCloseInterval) {
    clearInterval(autoCloseInterval);
    autoCloseInterval = null;
  }
}

/**
 * Emite y registra el voto
 */
async function confirmVote(candidate) {
  const mesa = AppState.currentMesa;
  const candidatoId = candidate.id;

  // Registrar localmente de inmediato para UX instantánea
  const timestamp = Date.now();
  const rawStr = `${mesa}-${candidatoId}-${timestamp}`;
  let hash = "";
  try {
    hash = btoa(rawStr).toUpperCase().substring(0, 16);
  } catch (e) {
    hash = `HASH-${timestamp}`;
  }

  const newVote = {
    timestamp: timestamp,
    mesa: mesa,
    candidatoId: candidatoId,
    hash: hash
  };

  AppState.votos.push(newVote);
  saveLocalState();
  renderAdminResults();

  // 1. Sonido positivo en alto volumen
  playPositiveVoteSound();

  // 2. Abrir modal de éxito y activar cuenta regresiva de 3 segundos
  openModal("modal-success");
  startAutoCloseSuccessModal();

  // 3. Enviar a Google Sheets en segundo plano
  GasClient.recordVote(mesa, candidatoId).then((res) => {
    if (res && res.synced) {
      console.log("Voto sincronizado con Google Sheets exitosamente:", res);
    }
  });
}

/**
 * Finaliza la votación y regresa de inmediato a la pantalla de bloqueo de la misma mesa
 */
function finishVoting() {
  clearAutoCloseSuccessModal();
  closeModal("modal-success");
  // Regresa inmediatamente a la pantalla de patrón de la misma mesa (Imagen 11)
  openMesaVoting(AppState.currentMesa);
}

// ==========================================================================
// MODALES Y VENTANAS FLOTANTES
// ==========================================================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
  }
}

function openAdminLoginModal() {
  const passInput = document.getElementById("admin-password-input");
  if (passInput) {
    passInput.value = "";
  }
  // La contraseña mostrada es solo un ejemplo simulado, NO la contraseña real
  const hintText = document.getElementById("admin-hint-text");
  if (hintText) {
    hintText.textContent = "Contraseña por defecto simulada: admin123";
  }
  openModal("modal-admin-login");
  setTimeout(() => {
    if (passInput) passInput.focus();
  }, 100);
}

function handleAdminLoginSubmit() {
  const passInput = document.getElementById("admin-password-input");
  const enteredPass = passInput ? passInput.value.trim() : "";

  if (enteredPass === (AppState.config.adminPass || "admin12345")) {
    AppState.adminLoggedIn = true;
    closeModal("modal-admin-login");
    showAdminPanelView();
    showToast("Bienvenido al Panel de Control", "success");
  } else {
    showToast("Contraseña incorrecta", "error");
    if (passInput) {
      passInput.classList.add("shake");
      setTimeout(() => passInput.classList.remove("shake"), 500);
    }
  }
}

function showAdminPanelView() {
  renderCandidatesInAdmin();
  renderAdminResults();
  showView("view-admin");
}

function exitAdminPanel() {
  AppState.adminLoggedIn = false;
  showHomeView();
}

function switchAdminTab(tabName) {
  const tabs = document.querySelectorAll(".admin-tab-btn");
  tabs.forEach((t) => t.classList.remove("active"));

  const contents = document.querySelectorAll(".admin-tab-content");
  contents.forEach((c) => c.classList.remove("active"));

  const activeBtn = document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  const activeContent = document.getElementById(`tab-content-${tabName}`);
  if (activeContent) activeContent.classList.add("active");

  if (tabName === "resultados") {
    renderAdminResults();
  }
}

// ==========================================================================
// CONFIGURACIÓN (ADMIN)
// ==========================================================================

function handleSaveGeneralConfig() {
  const titleInput = document.getElementById("admin-input-title");
  const passInput = document.getElementById("admin-input-pass");
  const tablesInput = document.getElementById("admin-input-tables");

  const newTitle = titleInput ? titleInput.value.trim() : AppState.config.systemTitle;
  const newPass = passInput && passInput.value.trim() ? passInput.value.trim() : AppState.config.adminPass;
  const newTables = tablesInput ? Math.max(1, Math.min(10, parseInt(tablesInput.value, 10) || 6)) : 6;

  AppState.config.systemTitle = newTitle;
  AppState.config.adminPass = newPass;
  AppState.config.tableCount = newTables;

  // Asegurar patrones para las nuevas mesas
  if (!AppState.config.tablePatterns) AppState.config.tablePatterns = {};
  for (let i = 1; i <= newTables; i++) {
    if (!AppState.config.tablePatterns[String(i)]) {
      AppState.config.tablePatterns[String(i)] = "03678"; // patrón en L por defecto
    }
  }

  saveLocalState();
  updateSystemBranding();
  renderMesaSelector();
  renderAdminResults();

  showToast("Configuración general guardada exitosamente", "success");

  // Sincronizar en segundo plano con Google Sheets
  GasClient.saveConfig(AppState.config);
}

function handleInsigniaUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast("La imagen excede el límite de 5MB", "error");
    return;
  }

  showToast("Procesando y convirtiendo insignia a Base64...", "info");
  fileToPngBase64(file, 300, 300, (base64Png) => {
    AppState.config.systemInsignia = base64Png;
    saveLocalState();
    updateSystemBranding();
    showToast("Insignia guardada como Base64 en el sistema", "success");
    GasClient.saveConfig(AppState.config);
  });
}

function handleRemoveInsignia() {
  showToast("Restableciendo insignia predeterminada...", "info");
  svgToPngBase64(getDefaultInsigniaSvg(), 260, 300).then((pngB64) => {
    AppState.config.systemInsignia = pngB64;
    saveLocalState();
    updateSystemBranding();
    showToast("Insignia restablecida a la predeterminada", "info");
    GasClient.saveConfig(AppState.config);
  });
}

// Configuración de Patrón por Mesa
function openPatternConfigForSelectedMesa() {
  const select = document.getElementById("config-select-mesa");
  const mesaNum = select ? select.value : 1;
  AppState.configuringMesaForPattern = parseInt(mesaNum, 10);

  const title = document.getElementById("pattern-config-modal-title");
  if (title) {
    title.textContent = `Configurar Patrón Mesa ${AppState.configuringMesaForPattern}`;
  }

  openModal("modal-pattern-config");
  setTimeout(() => {
    if (configPatternLock) {
      configPatternLock.resizeCanvas();
      configPatternLock.resetState();
    }
  }, 100);
}

function handleConfigPatternDrawn(patternStr) {
  if (patternStr.length < 4) {
    showToast("El patrón debe tener al menos 4 puntos", "warning");
    if (configPatternLock) configPatternLock.setError();
    return;
  }

  AppState.tempDrawnPattern = patternStr;
  if (configPatternLock) configPatternLock.setSuccess();

  const mesaKey = String(AppState.configuringMesaForPattern);
  if (!AppState.config.tablePatterns) AppState.config.tablePatterns = {};
  AppState.config.tablePatterns[mesaKey] = patternStr;

  saveLocalState();
  GasClient.saveConfig(AppState.config);

  setTimeout(() => {
    closeModal("modal-pattern-config");
    showToast(`Patrón para Mesa ${AppState.configuringMesaForPattern} guardado`, "success");
  }, 400);
}

function clearConfigPattern() {
  if (configPatternLock) {
    configPatternLock.resetState();
  }
}

// ==========================================================================
// GESTIÓN DE CANDIDATOS (CRUD)
// ==========================================================================

function renderCandidatesInAdmin() {
  const container = document.getElementById("admin-candidates-list");
  const countBadge = document.getElementById("admin-candidates-count");
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `Candidatos (${AppState.candidatos.length})`;
  }

  container.innerHTML = "";
  AppState.candidatos.forEach((cand, idx) => {
    const item = document.createElement("div");
    item.className = "candidate-item";

    const infoGroup = document.createElement("div");
    infoGroup.className = "candidate-info-group";

    const thumb = document.createElement("img");
    thumb.className = "candidate-thumb";
    thumb.src = cand.imagenBase64 || getDefaultCandidateIcon("blanco");
    thumb.alt = cand.nombre;

    const textGroup = document.createElement("div");
    const name = document.createElement("div");
    name.className = "candidate-name";
    name.textContent = cand.nombre;

    const idLabel = document.createElement("div");
    idLabel.className = "candidate-id";
    idLabel.textContent = `ID: ${cand.id}`;

    textGroup.appendChild(name);
    textGroup.appendChild(idLabel);

    infoGroup.appendChild(thumb);
    infoGroup.appendChild(textGroup);

    // Acciones: Subir, Bajar, Editar, Eliminar
    const actions = document.createElement("div");
    actions.className = "candidate-item-actions";

    // Botón Subir
    if (idx > 0) {
      const btnUp = document.createElement("button");
      btnUp.className = "btn-icon";
      btnUp.title = "Subir posición";
      btnUp.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/></svg>`;
      btnUp.onclick = () => moveCandidatePosition(idx, -1);
      actions.appendChild(btnUp);
    }

    // Botón Bajar
    if (idx < AppState.candidatos.length - 1) {
      const btnDown = document.createElement("button");
      btnDown.className = "btn-icon";
      btnDown.title = "Bajar posición";
      btnDown.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"/></svg>`;
      btnDown.onclick = () => moveCandidatePosition(idx, 1);
      actions.appendChild(btnDown);
    }

    // Botón Editar
    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-icon";
    btnEdit.title = "Editar";
    btnEdit.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>`;
    btnEdit.onclick = () => openEditCandidateModal(cand);
    actions.appendChild(btnEdit);

    // Botón Eliminar
    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-icon delete";
    btnDelete.title = "Eliminar";
    btnDelete.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;
    btnDelete.onclick = () => deleteCandidate(cand.id);
    actions.appendChild(btnDelete);

    item.appendChild(infoGroup);
    item.appendChild(actions);
    container.appendChild(item);
  });
}

function openNewCandidateModal() {
  AppState.editingCandidateId = null;
  const title = document.getElementById("candidate-modal-title");
  if (title) title.textContent = "Nuevo Candidato";

  const nameInput = document.getElementById("candidate-name-input");
  if (nameInput) nameInput.value = "";

  const fileInput = document.getElementById("candidate-image-input");
  if (fileInput) fileInput.value = "";

  openModal("modal-candidate");
}

function openEditCandidateModal(candidate) {
  AppState.editingCandidateId = candidate.id;
  const title = document.getElementById("candidate-modal-title");
  if (title) title.textContent = "Editar Candidato";

  const nameInput = document.getElementById("candidate-name-input");
  if (nameInput) nameInput.value = candidate.nombre;

  const fileInput = document.getElementById("candidate-image-input");
  if (fileInput) fileInput.value = "";

  openModal("modal-candidate");
}

function handleSaveCandidate() {
  const nameInput = document.getElementById("candidate-name-input");
  const fileInput = document.getElementById("candidate-image-input");
  const name = nameInput ? nameInput.value.trim() : "";

  if (!name) {
    showToast("Ingrese el nombre de la lista o candidato", "warning");
    return;
  }

  const file = fileInput && fileInput.files && fileInput.files[0];

  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showToast("La imagen no debe superar los 5MB", "error");
      return;
    }
    showToast("Procesando logo del candidato a Base64...", "info");
    fileToPngBase64(file, 250, 250, (base64Png) => {
      finalizeCandidateSave(name, base64Png);
    });
  } else {
    // Si edita sin cambiar imagen o crea con icono genérico en PNG Base64
    let imgBase64 = "";
    if (AppState.editingCandidateId) {
      const existing = AppState.candidatos.find((c) => c.id === AppState.editingCandidateId);
      imgBase64 = existing ? existing.imagenBase64 : "";
      finalizeCandidateSave(name, imgBase64);
    } else {
      svgToPngBase64(getDefaultCandidateIcon("futuro"), 200, 200).then((pngB64) => {
        finalizeCandidateSave(name, pngB64);
      });
    }
  }
}

/**
 * Redimensiona y convierte cualquier archivo de imagen (PNG, JPG, WEBP)
 * en una cadena Base64 PNG optimizada para Sheets (máximo ~20KB a 35KB)
 */
function fileToPngBase64(file, maxWidth, maxHeight, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      let w = img.width;
      let h = img.height;
      const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const base64Png = canvas.toDataURL("image/png");
      callback(base64Png);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Convierte un SVG en memoria a formato PNG Base64
 */
function svgToPngBase64(svgUrl, width, height) {
  return new Promise((resolve) => {
    if (!svgUrl || svgUrl.startsWith("data:image/png;base64,")) {
      resolve(svgUrl);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        resolve(svgUrl);
      }
    };
    img.onerror = function () {
      resolve(svgUrl);
    };
    img.src = svgUrl;
  });
}

/**
 * Convierte las imágenes SVG iniciales por defecto a PNG Base64 nativo
 * para que cuando se sincronicen con Google Sheets se guarden siempre como PNG Base64
 */
function convertDefaultIconsToPngBase64() {
  if (AppState.config.systemInsignia && AppState.config.systemInsignia.startsWith("data:image/svg")) {
    svgToPngBase64(AppState.config.systemInsignia, 260, 300).then((pngB64) => {
      AppState.config.systemInsignia = pngB64;
      saveLocalState();
      updateSystemBranding();
    });
  }

  AppState.candidatos.forEach((cand, idx) => {
    if (cand.imagenBase64 && cand.imagenBase64.startsWith("data:image/svg")) {
      svgToPngBase64(cand.imagenBase64, 200, 200).then((pngB64) => {
        AppState.candidatos[idx].imagenBase64 = pngB64;
        saveLocalState();
        renderCandidatesInAdmin();
      });
    }
  });
}

function finalizeCandidateSave(nombre, imagenBase64) {
  if (AppState.editingCandidateId) {
    // Editar
    const idx = AppState.candidatos.findIndex((c) => c.id === AppState.editingCandidateId);
    if (idx !== -1) {
      AppState.candidatos[idx].nombre = nombre;
      if (imagenBase64) AppState.candidatos[idx].imagenBase64 = imagenBase64;
    }
    showToast("Candidato actualizado", "success");
  } else {
    // Crear nuevo con ID único
    const newId = "c" + Math.floor(100000 + Math.random() * 900000);
    AppState.candidatos.push({
      id: newId,
      nombre: nombre,
      imagenBase64: imagenBase64
    });
    showToast("Candidato registrado", "success");
  }

  saveLocalState();
  renderCandidatesInAdmin();
  closeModal("modal-candidate");
  GasClient.saveCandidatos(AppState.candidatos);
}

function deleteCandidate(candidateId) {
  if (AppState.candidatos.length <= 1) {
    showToast("Debe existir al menos un candidato o voto en blanco", "warning");
    return;
  }

  if (confirm("¿Está seguro de eliminar este candidato?")) {
    AppState.candidatos = AppState.candidatos.filter((c) => c.id !== candidateId);
    saveLocalState();
    renderCandidatesInAdmin();
    renderAdminResults();
    showToast("Candidato eliminado", "info");
    GasClient.saveCandidatos(AppState.candidatos);
  }
}

function moveCandidatePosition(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= AppState.candidatos.length) return;

  const temp = AppState.candidatos[index];
  AppState.candidatos[index] = AppState.candidatos[targetIndex];
  AppState.candidatos[targetIndex] = temp;

  saveLocalState();
  renderCandidatesInAdmin();
  GasClient.saveCandidatos(AppState.candidatos);
}

// ==========================================================================
// RESULTADOS Y MATRIZ POR MESA (ADMIN)
// ==========================================================================

function renderAdminResults() {
  const totalVotes = AppState.votos.length;
  const totalMesas = AppState.config.tableCount || 6;

  // 1. Contador de votos por candidato
  const counts = {};
  AppState.candidatos.forEach((c) => (counts[c.id] = 0));

  AppState.votos.forEach((v) => {
    if (counts[v.candidatoId] !== undefined) {
      counts[v.candidatoId]++;
    } else {
      counts[v.candidatoId] = 1;
    }
  });

  // 2. Determinar Candidato Líder
  let leaderName = "---";
  let maxVotes = -1;
  let isTie = false;

  AppState.candidatos.forEach((c) => {
    const vCount = counts[c.id] || 0;
    if (vCount > maxVotes) {
      maxVotes = vCount;
      leaderName = c.nombre;
      isTie = false;
    } else if (vCount === maxVotes && maxVotes > 0) {
      isTie = true;
    }
  });

  if (totalVotes === 0) leaderName = "Sin votos";
  else if (isTie) leaderName = "Empate";

  // Actualizar Tarjetas KPI
  const kpiTotal = document.getElementById("kpi-total-votes");
  if (kpiTotal) kpiTotal.textContent = totalVotes;

  const kpiLeader = document.getElementById("kpi-leader-candidate");
  if (kpiLeader) {
    kpiLeader.textContent = leaderName.length > 14 ? leaderName.substring(0, 14) + "..." : leaderName;
    kpiLeader.title = leaderName;
  }

  const kpiMesas = document.getElementById("kpi-active-tables");
  if (kpiMesas) kpiMesas.textContent = totalMesas;

  // 3. Renderizar Barras de Resultados Generales
  const generalContainer = document.getElementById("admin-general-results-list");
  if (generalContainer) {
    generalContainer.innerHTML = "";
    AppState.candidatos.forEach((c) => {
      const vCount = counts[c.id] || 0;
      const pct = totalVotes > 0 ? ((vCount / totalVotes) * 100).toFixed(1) : "0.0";

      const row = document.createElement("div");
      row.className = "result-candidate-row";

      row.innerHTML = `
        <div class="result-labels">
          <span>${c.nombre}</span>
          <span>${vCount} votos (${pct}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill" style="width: ${pct}%"></div>
        </div>
      `;
      generalContainer.appendChild(row);
    });
  }

  // 4. Renderizar Matriz de Votos por Mesa
  const matrixHead = document.getElementById("admin-matrix-thead");
  const matrixBody = document.getElementById("admin-matrix-tbody");

  if (matrixHead && matrixBody) {
    // Encabezado
    let headHtml = "<tr><th>MESA</th>";
    AppState.candidatos.forEach((c) => {
      headHtml += `<th>${c.nombre}</th>`;
    });
    headHtml += "<th>TOTAL</th></tr>";
    matrixHead.innerHTML = headHtml;

    // Cuerpo: Filas por Mesa
    let bodyHtml = "";
    const colTotals = {};
    AppState.candidatos.forEach((c) => (colTotals[c.id] = 0));
    let grandTotal = 0;

    for (let m = 1; m <= totalMesas; m++) {
      let rowTotal = 0;
      bodyHtml += `<tr><td><strong>Mesa ${m}</strong></td>`;

      AppState.candidatos.forEach((c) => {
        const mesaCandVotes = AppState.votos.filter((v) => parseInt(v.mesa, 10) === m && v.candidatoId === c.id).length;
        rowTotal += mesaCandVotes;
        colTotals[c.id] += mesaCandVotes;
        bodyHtml += `<td>${mesaCandVotes}</td>`;
      });

      grandTotal += rowTotal;
      bodyHtml += `<td><strong>${rowTotal}</strong></td></tr>`;
    }

    // Fila de Total General
    bodyHtml += `<tr class="total-row"><td>TOTAL</td>`;
    AppState.candidatos.forEach((c) => {
      bodyHtml += `<td>${colTotals[c.id]}</td>`;
    });
    bodyHtml += `<td>${grandTotal}</td></tr>`;

    matrixBody.innerHTML = bodyHtml;
  }
}

/**
 * Reinicia la votación previa confirmación con contraseña de administrador
 */
async function handleResetVotes() {
  const enteredPass = prompt("PELIGRO: Esto borrará TODOS los votos emitidos.\nIngrese la contraseña de administrador para confirmar:");
  if (enteredPass === null) return;

  if (enteredPass.trim() !== (AppState.config.adminPass || "admin12345")) {
    showToast("Contraseña incorrecta. Operación cancelada.", "error");
    return;
  }

  AppState.votos = [];
  saveLocalState();
  renderAdminResults();
  showToast("Votos reiniciados exitosamente a cero", "success");

  if (GasClient.isConfigured()) {
    GasClient.resetVotes(enteredPass.trim());
  }
}

/**
 * Imprimir o Exportar Acta de Escrutinio en PDF
 */
function handlePrintResults() {
  window.print();
}

// ==========================================================================
// SELECTOR DE MESAS (VOTACIÓN)
// ==========================================================================

function renderMesaSelector() {
  const grid = document.getElementById("mesas-selection-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const total = AppState.config.tableCount || 6;

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.className = "btn-mesa-box";
    btn.onclick = () => openMesaVoting(i);

    btn.innerHTML = `
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 14H7v-2h4v2zm0-4H7v-2h4v2zm0-4H7V7h4v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V7h4v2z"/>
      </svg>
      <span>Mesa ${i}</span>
    `;
    grid.appendChild(btn);
  }
}

// ==========================================================================
// CONFIGURACIÓN DE GOOGLE APPS SCRIPT (SETUP)
// ==========================================================================

async function handleTestAndSaveGasUrl() {
  const input = document.getElementById("input-gas-url");
  const url = input ? input.value.trim() : "";

  if (!url) {
    GasClient.setGasUrl("");
    updateConnectionBadge(false);
    showToast("Conexión con Google Sheets desactivada. Modo Local activo.", "info");
    return;
  }

  showToast("Probando conexión con Google Sheets...", "info");
  const res = await GasClient.testConnection(url);

  if (res.success) {
    GasClient.setGasUrl(url);
    updateConnectionBadge(true);
    showToast(res.message, "success");
    // Sincronizar de una vez
    initGasSync();
  } else {
    showToast(res.message, "error");
  }
}

async function handleSyncNowWithGas() {
  if (!GasClient.isConfigured()) {
    showToast("Primero ingrese y guarde la URL de la Web App de Google Apps Script", "warning");
    return;
  }
  showToast("Sincronizando con Google Sheets...", "info");
  await initGasSync();
}

function handleCopyGasCode() {
  const codeEl = document.getElementById("gas-source-code");
  if (!codeEl) return;

  const text = codeEl.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Código Google Apps Script copiado al portapapeles", "success");
  }).catch(() => {
    showToast("Seleccione y copie el código manualmente", "warning");
  });
}

// ==========================================================================
// NOTIFICACIONES TOAST
// ==========================================================================

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==========================================================================
// ASSETS POR DEFECTO (SVGs)
// ==========================================================================

function getDefaultInsigniaSvg() {
  return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 350'><rect width='300' height='350' fill='none'/><path d='M30 40 Q150 10 270 40 L270 200 Q270 310 150 340 Q30 310 30 200 Z' fill='%23FBBF24' stroke='%23B45309' stroke-width='6'/><path d='M45 55 Q150 30 255 55 L255 195 Q255 295 150 325 Q45 295 45 195 Z' fill='%23DC2626'/><path d='M110 55 L190 55 L190 320 L110 320 Z' fill='%23FFFFFF'/><text x='75' y='110' font-family='Arial, sans-serif' font-size='42' font-weight='900' fill='%231E293B' text-anchor='middle'>I</text><text x='225' y='110' font-family='Arial, sans-serif' font-size='42' font-weight='900' fill='%231E293B' text-anchor='middle'>E</text><path d='M150 90 Q130 70 120 75 Q115 95 150 115 Q185 95 180 75 Q170 70 150 90 Z' fill='%23FFFFFF' stroke='%23475569' stroke-width='2'/><path d='M150 90 L150 115' stroke='%23475569' stroke-width='2'/><path d='M50 185 Q150 145 250 185' fill='none' id='textPathCurve'/><text font-family='Arial, sans-serif' font-size='16' font-weight='bold' fill='%231E293B'><textPath href='%23textPathCurve' startOffset='50%' text-anchor='middle'>ENRIQUE FRACCHIA</textPath></text><text x='150' y='245' font-family='Arial, sans-serif' font-size='46' font-weight='900' fill='%231E293B' text-anchor='middle'>23014</text><text x='150' y='285' font-family='Arial, sans-serif' font-size='20' font-weight='bold' fill='%231E293B' text-anchor='middle'>NASCA</text></svg>";
}

function getDefaultCandidateIcon(tipo) {
  if (tipo === "futuro") {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='20' fill='%23FEF3C7'/><path d='M100 35 L120 75 L100 160 L80 75 Z' fill='%23F43F5E'/><rect x='94' y='75' width='12' height='85' fill='%23FDE68A'/><circle cx='60' cy='65' r='14' fill='%2310B981'/><circle cx='140' cy='65' r='14' fill='%2310B981'/><circle cx='80' cy='45' r='10' fill='%2334D399'/><circle cx='120' cy='45' r='10' fill='%2334D399'/><text x='100' y='180' font-family='Arial, sans-serif' font-size='12' font-weight='bold' fill='%23881337' text-anchor='middle'>La Voz Del Futuro</text></svg>";
  } else if (tipo === "arbol") {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='20' fill='%23ECFDF5'/><circle cx='100' cy='85' r='45' fill='%2310B981'/><circle cx='75' cy='75' r='30' fill='%23059669'/><circle cx='125' cy='75' r='30' fill='%23059669'/><path d='M90 120 L110 120 L115 165 L85 165 Z' fill='%2392400E'/><ellipse cx='100' cy='168' rx='40' ry='10' fill='%23D1D5DB'/></svg>";
  } else {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='20' fill='%23FFFFFF' stroke='%23E2E8F0' stroke-width='3'/><rect x='65' y='50' width='70' height='70' rx='6' fill='%23F8FAFC' stroke='%231E293B' stroke-width='5'/><path d='M50 75 L85 110 L160 35' fill='none' stroke='%231E293B' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/><text x='100' y='155' font-family='Arial, sans-serif' font-size='22' font-weight='900' fill='%231E293B' text-anchor='middle'>VOTO EN</text><text x='100' y='180' font-family='Arial, sans-serif' font-size='22' font-weight='900' fill='%231E293B' text-anchor='middle'>BLANCO</text></svg>";
  }
}
