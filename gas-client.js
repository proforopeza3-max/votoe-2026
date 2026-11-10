/**
 * SISTEMA DE VOTO ELECTRÓNICO ESTUDIANTIL
 * Cliente de Sincronización con Google Apps Script (Google Sheets)
 * Compatible con GitHub Pages (CORS, Modo Offline, Sincronización en segundo plano)
 */

const GasClient = (function () {
  const STORAGE_KEY_GAS_URL = "votoe_gas_url";
  const STORAGE_KEY_OFFLINE_VOTES = "votoe_offline_queue";

  // Obtiene la URL configurada de Google Apps Script
  function getGasUrl() {
    return localStorage.getItem(STORAGE_KEY_GAS_URL) || "";
  }

  // Guarda la URL de Google Apps Script
  function setGasUrl(url) {
    if (url) {
      localStorage.setItem(STORAGE_KEY_GAS_URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_GAS_URL);
    }
  }

  // Verifica si hay una URL configurada
  function isConfigured() {
    const url = getGasUrl();
    return url && url.startsWith("https://script.google.com/macros/s/");
  }

  /**
   * Realiza una petición GET al backend de Google Apps Script
   */
  async function fetchGet(action = "getAllData") {
    const url = getGasUrl();
    if (!url) {
      throw new Error("No hay URL de Google Apps Script configurada.");
    }

    const separator = url.includes("?") ? "&" : "?";
    const requestUrl = `${url}${separator}action=${encodeURIComponent(action)}&_t=${Date.now()}`;

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar Google Sheets`);
    }

    return await response.json();
  }

  /**
   * Realiza una petición POST al backend de Google Apps Script.
   * Google Apps Script requiere text/plain para evitar bloqueos CORS por preflight OPTIONS.
   */
  async function fetchPost(action, payload = {}) {
    const url = getGasUrl();
    if (!url) {
      throw new Error("No hay URL de Google Apps Script configurada.");
    }

    const bodyData = {
      action: action,
      ...payload
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} en la sincronización con Google Sheets`);
    }

    return await response.json();
  }

  /**
   * Registra un voto:
   * Si hay conexión con GAS, lo envía directamente.
   * Si falla o no hay conexión, lo guarda en la cola local para no interrumpir la votación escolar.
   */
  async function recordVote(mesa, candidatoId) {
    const timestamp = Date.now();
    const rawStr = `${mesa}-${candidatoId}-${timestamp}`;
    let hash = "";
    try {
      hash = btoa(rawStr).toUpperCase().substring(0, 16);
    } catch (e) {
      hash = `HASH-${timestamp}`;
    }

    const voteData = {
      timestamp: timestamp,
      mesa: mesa,
      candidatoId: candidatoId,
      hash: hash
    };

    if (isConfigured()) {
      try {
        const result = await fetchPost("vote", voteData);
        if (result && result.success) {
          return { success: true, synced: true, vote: voteData };
        }
      } catch (err) {
        console.warn("Fallo al registrar voto en vivo en Google Sheets, encolando offline:", err);
      }
    }

    // Guardado en cola local de respaldo
    enqueueOfflineVote(voteData);
    return { success: true, synced: false, vote: voteData, queued: true };
  }

  /**
   * Guarda un voto en la cola offline de localStorage
   */
  function enqueueOfflineVote(vote) {
    try {
      const queue = JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE_VOTES) || "[]");
      queue.push(vote);
      localStorage.setItem(STORAGE_KEY_OFFLINE_VOTES, JSON.stringify(queue));
    } catch (e) {
      console.error("Error al almacenar voto en cola local:", e);
    }
  }

  /**
   * Obtiene la cola de votos pendientes
   */
  function getOfflineQueue() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_OFFLINE_VOTES) || "[]");
    } catch (e) {
      return [];
    }
  }

  /**
   * Sincroniza los votos pendientes acumulados con Google Sheets
   */
  async function flushOfflineQueue() {
    if (!isConfigured()) return { success: false, pending: getOfflineQueue().length };
    const queue = getOfflineQueue();
    if (queue.length === 0) return { success: true, syncedCount: 0 };

    const remaining = [];
    let syncedCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const v = queue[i];
      try {
        await fetchPost("vote", v);
        syncedCount++;
      } catch (e) {
        remaining.push(v);
      }
    }

    localStorage.setItem(STORAGE_KEY_OFFLINE_VOTES, JSON.stringify(remaining));
    return { success: remaining.length === 0, syncedCount: syncedCount, remaining: remaining.length };
  }

  /**
   * Prueba la conexión con el script de Google
   */
  async function testConnection(testUrl) {
    const urlToTest = testUrl ? testUrl.trim() : getGasUrl();
    if (!urlToTest) {
      return { success: false, message: "Debe ingresar una URL válida de Google Apps Script." };
    }

    try {
      const separator = urlToTest.includes("?") ? "&" : "?";
      const pingUrl = `${urlToTest}${separator}action=ping&_t=${Date.now()}`;
      const response = await fetch(pingUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        return { success: false, message: `Error HTTP ${response.status}. Verifique permisos de la Web App.` };
      }

      const data = await response.json();
      if (data && data.status === "ok") {
        return { success: true, message: `Conexión exitosa con la hoja: "${data.spreadsheetName || 'Google Sheet'}"` };
      } else {
        return { success: false, message: "El script respondió pero no devolvió el formato esperado." };
      }
    } catch (err) {
      return {
        success: false,
        message: "No se pudo conectar. Asegúrese de haber desplegado como 'Aplicación Web' con acceso para 'Cualquier usuario' (Anyone)."
      };
    }
  }

  /**
   * Guarda la configuración general en Google Sheets
   */
  async function saveConfig(config) {
    if (!isConfigured()) return { success: false, localOnly: true };
    return await fetchPost("saveConfig", { config: config });
  }

  /**
   * Guarda los candidatos en Google Sheets
   */
  async function saveCandidatos(candidatos) {
    if (!isConfigured()) return { success: false, localOnly: true };
    return await fetchPost("saveCandidatos", { candidatos: candidatos });
  }

  /**
   * Reinicia los votos en Google Sheets
   */
  async function resetVotes(adminPass) {
    if (!isConfigured()) return { success: false, localOnly: true };
    return await fetchPost("resetVotes", { adminPass: adminPass });
  }

  /**
   * Carga todos los datos desde Google Sheets
   */
  async function loadAllData() {
    if (!isConfigured()) return null;
    return await fetchGet("getAllData");
  }

  return {
    getGasUrl,
    setGasUrl,
    isConfigured,
    testConnection,
    recordVote,
    flushOfflineQueue,
    getOfflineQueue,
    saveConfig,
    saveCandidatos,
    resetVotes,
    loadAllData
  };
})();
