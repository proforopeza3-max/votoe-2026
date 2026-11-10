/**
 * SISTEMA DE VOTO ELECTRÓNICO ESTUDIANTIL - BACKEND GOOGLE APPS SCRIPT
 * Compatible con Google Sheets y despliegue como Aplicación Web (Web App).
 * Autor base: PIP Jesús Oropeza R
 *
 * Hojas requeridas:
 * 1. CONFIG: Parámetros del sistema (Título, Insignia, Cantidad de Mesas, Patrones, Contraseña)
 * 2. CANDIDATOS: Registro de listas/candidatos (ID, Nombre, ImagenBase64)
 * 3. VOTOS: Registro de votos emitidos (Timestamp, Mesa, CandidatoID, Hash)
 *
 * Si alguna de estas hojas no existe, este script la crea automáticamente
 * con su estructura y valores predeterminados al iniciar.
 */

// Nombres de las hojas
const SHEET_CONFIG = "CONFIG";
const SHEET_CANDIDATOS = "CANDIDATOS";
const SHEET_VOTOS = "VOTOS";

/**
 * Punto de entrada HTTP GET
 * Permite obtener datos iniciales, verificar estado o realizar consultas.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    checkAndInitSheets(ss);

    const action = (e && e.parameter && e.parameter.action) || "getAllData";

    let result = {};

    switch (action) {
      case "ping":
        result = { status: "ok", timestamp: Date.now(), spreadsheetName: ss.getName() };
        break;

      case "getConfig":
        result = { success: true, data: getConfigData(ss) };
        break;

      case "getCandidatos":
        result = { success: true, data: getCandidatosData(ss) };
        break;

      case "getVotos":
      case "getResults":
        result = { success: true, data: getVotosData(ss) };
        break;

      case "getAllData":
      default:
        result = {
          success: true,
          config: getConfigData(ss),
          candidatos: getCandidatosData(ss),
          votos: getVotosData(ss)
        };
        break;
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Punto de entrada HTTP POST
 * Recibe y procesa acciones como: emitir voto, guardar configuración,
 * guardar candidatos o reiniciar la votación.
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    checkAndInitSheets(ss);

    let requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (err) {
        requestData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      requestData = e.parameter;
    }

    const action = requestData.action;
    let result = {};

    switch (action) {
      case "vote":
        result = recordVote(ss, requestData);
        break;

      case "saveConfig":
        result = saveConfigData(ss, requestData.config);
        break;

      case "saveCandidatos":
        result = saveCandidatosData(ss, requestData.candidatos);
        break;

      case "resetVotes":
        result = resetVotesData(ss, requestData.adminPass);
        break;

      case "verifyAdmin":
        result = verifyAdminPassword(ss, requestData.password);
        break;

      default:
        result = { success: false, message: "Acción no reconocida: " + action };
        break;
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Genera una respuesta HTTP JSON con cabeceras CORS
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Verifica si las hojas existen y, si faltan, las crea con su estructura oficial.
 */
function checkAndInitSheets(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Hoja CONFIG
  let sheetConfig = ss.getSheetByName(SHEET_CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(SHEET_CONFIG);
    // Encabezados
    sheetConfig.getRange("A1:B1").setValues([["Clave", "Valor"]]);
    sheetConfig.getRange("A1:B1").setFontWeight("bold").setBackground("#E2E8F0");

    // Valores por defecto
    const defaultPatterns = JSON.stringify({
      "1": "03678",
      "2": "67852",
      "3": "85210",
      "4": "21036",
      "5": "0124678",
      "6": "0367852"
    });

    const configRows = [
      ["adminPass", "admin12345"],
      ["tableCount", 6],
      ["tablePatterns", defaultPatterns],
      ["systemTitle", "Elecciones Estudiantiles 2026 - IE 23014 \"ENRIQUE FRACCHIA\""],
      ["systemInsignia", getDefaultInsigniaSvg()]
    ];

    sheetConfig.getRange(2, 1, configRows.length, 2).setValues(configRows);
    sheetConfig.autoResizeColumns(1, 2);
  }

  // 2. Hoja CANDIDATOS
  let sheetCandidatos = ss.getSheetByName(SHEET_CANDIDATOS);
  if (!sheetCandidatos) {
    sheetCandidatos = ss.insertSheet(SHEET_CANDIDATOS);
    sheetCandidatos.getRange("A1:C1").setValues([["ID", "Nombre", "ImagenBase64"]]);
    sheetCandidatos.getRange("A1:C1").setFontWeight("bold").setBackground("#E2E8F0");

    const defaultCandidatos = [
      ["c386467", "LA VOZ DEL FUTURO", getDefaultCandidateIcon("futuro")],
      ["c372475", "ARBOL DE LA SABIDURIA", getDefaultCandidateIcon("arbol")],
      ["c1", "VOTO BLANCO", getDefaultCandidateIcon("blanco")]
    ];

    sheetCandidatos.getRange(2, 1, defaultCandidatos.length, 3).setValues(defaultCandidatos);
    sheetCandidatos.autoResizeColumns(1, 2);
  }

  // 3. Hoja VOTOS
  let sheetVotos = ss.getSheetByName(SHEET_VOTOS);
  if (!sheetVotos) {
    sheetVotos = ss.insertSheet(SHEET_VOTOS);
    sheetVotos.getRange("A1:D1").setValues([["Timestamp", "Mesa", "CandidatoID", "Hash"]]);
    sheetVotos.getRange("A1:D1").setFontWeight("bold").setBackground("#E2E8F0");
    sheetVotos.autoResizeColumns(1, 4);
  }
}

/**
 * Lee la hoja CONFIG y la retorna como objeto clave-valor
 */
function getConfigData(ss) {
  const sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const config = {};

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const val = data[i][1];
    if (key) {
      if (key === "tableCount") {
        config[key] = parseInt(val, 10) || 6;
      } else if (key === "tablePatterns") {
        try {
          config[key] = typeof val === "string" ? JSON.parse(val) : val;
        } catch (e) {
          config[key] = {};
        }
      } else {
        config[key] = val;
      }
    }
  }

  return config;
}

/**
 * Guarda o actualiza los valores de la hoja CONFIG
 */
function saveConfigData(ss, newConfig) {
  if (!newConfig) return { success: false, message: "Datos de configuración vacíos" };

  const sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet) return { success: false, message: "Hoja CONFIG no encontrada" };

  const data = sheet.getDataRange().getValues();
  const keyMap = {};
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    if (key) {
      keyMap[key] = i + 1; // Fila en hoja (base 1)
    }
  }

  const keys = Object.keys(newConfig);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    let val = newConfig[key];

    if (key === "tablePatterns" && typeof val !== "string") {
      val = JSON.stringify(val);
    }

    if (keyMap[key]) {
      // Actualizar fila existente
      sheet.getRange(keyMap[key], 2).setValue(val);
    } else {
      // Insertar nueva clave
      sheet.appendRow([key, val]);
    }
  }

  return { success: true, message: "Configuración guardada exitosamente" };
}

/**
 * Lee la lista de candidatos
 */
function getCandidatosData(ss) {
  const sheet = ss.getSheetByName(SHEET_CANDIDATOS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const candidatos = [];

  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]).trim();
    const nombre = String(data[i][1]).trim();
    const imagenBase64 = data[i][2] || "";

    if (id && nombre) {
      candidatos.push({
        id: id,
        nombre: nombre,
        imagenBase64: imagenBase64
      });
    }
  }

  return candidatos;
}

/**
 * Guarda y reemplaza la lista completa de candidatos
 */
function saveCandidatosData(ss, candidatos) {
  if (!Array.isArray(candidatos)) {
    return { success: false, message: "Lista de candidatos inválida" };
  }

  const sheet = ss.getSheetByName(SHEET_CANDIDATOS);
  if (!sheet) return { success: false, message: "Hoja CANDIDATOS no encontrada" };

  // Limpiar candidatos existentes (conservando encabezado)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }

  if (candidatos.length > 0) {
    const rows = candidatos.map(function(c) {
      return [c.id, c.nombre, c.imagenBase64 || ""];
    });
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }

  return { success: true, message: "Candidatos guardados exitosamente", total: candidatos.length };
}

/**
 * Lee el listado de votos
 */
function getVotosData(ss) {
  const sheet = ss.getSheetByName(SHEET_VOTOS);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const votos = [];

  for (let i = 0; i < data.length; i++) {
    const timestamp = data[i][0];
    const mesa = data[i][1];
    const candidatoId = String(data[i][2]).trim();
    const hash = data[i][3];

    if (timestamp && mesa && candidatoId) {
      votos.push({
        timestamp: timestamp,
        mesa: mesa,
        candidatoId: candidatoId,
        hash: hash
      });
    }
  }

  return votos;
}

/**
 * Registra un nuevo voto en la hoja VOTOS
 */
function recordVote(ss, payload) {
  const mesa = payload.mesa;
  const candidatoId = payload.candidatoId;

  if (!mesa || !candidatoId) {
    return { success: false, message: "Faltan parámetros de mesa o candidato" };
  }

  const sheet = ss.getSheetByName(SHEET_VOTOS);
  if (!sheet) {
    return { success: false, message: "Hoja VOTOS no encontrada" };
  }

  const timestamp = Date.now();
  // Formato Hash: Base64 en mayúsculas de mesa-candidato-timestamp recortado a 16 caracteres
  const rawStr = mesa + "-" + candidatoId + "-" + timestamp;
  const hash = Utilities.base64Encode(rawStr).toUpperCase().substring(0, 16);

  sheet.appendRow([timestamp, mesa, candidatoId, hash]);

  return {
    success: true,
    message: "Voto registrado exitosamente",
    timestamp: timestamp,
    mesa: mesa,
    candidatoId: candidatoId,
    hash: hash
  };
}

/**
 * Reinicia la votación (elimina los registros de la hoja VOTOS)
 */
function resetVotesData(ss, adminPass) {
  const config = getConfigData(ss);
  if (adminPass !== config.adminPass) {
    return { success: false, message: "Contraseña de administrador incorrecta" };
  }

  const sheet = ss.getSheetByName(SHEET_VOTOS);
  if (!sheet) return { success: false, message: "Hoja VOTOS no encontrada" };

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }

  return { success: true, message: "Votos reiniciados exitosamente" };
}

/**
 * Verifica la contraseña de administrador
 */
function verifyAdminPassword(ss, password) {
  const config = getConfigData(ss);
  const isValid = (password === config.adminPass);
  return { success: isValid, valid: isValid };
}

/**
 * Función auxiliar: Devuelve la insignia institucional por defecto (SVG en Base64 / Data URL)
 */
function getDefaultInsigniaSvg() {
  return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 350'><rect width='300' height='350' fill='none'/><path d='M30 40 Q150 10 270 40 L270 200 Q270 310 150 340 Q30 310 30 200 Z' fill='%23FBBF24' stroke='%23B45309' stroke-width='6'/><path d='M45 55 Q150 30 255 55 L255 195 Q255 295 150 325 Q45 295 45 195 Z' fill='%23DC2626'/><path d='M110 55 L190 55 L190 320 L110 320 Z' fill='%23FFFFFF'/><text x='75' y='110' font-family='Arial, sans-serif' font-size='42' font-weight='900' fill='%231E293B' text-anchor='middle'>I</text><text x='225' y='110' font-family='Arial, sans-serif' font-size='42' font-weight='900' fill='%231E293B' text-anchor='middle'>E</text><path d='M150 90 Q130 70 120 75 Q115 95 150 115 Q185 95 180 75 Q170 70 150 90 Z' fill='%23FFFFFF' stroke='%23475569' stroke-width='2'/><path d='M150 90 L150 115' stroke='%23475569' stroke-width='2'/><path d='M50 185 Q150 145 250 185' fill='none' id='textPathCurve'/><text font-family='Arial, sans-serif' font-size='16' font-weight='bold' fill='%231E293B'><textPath href='%23textPathCurve' startOffset='50%' text-anchor='middle'>ENRIQUE FRACCHIA</textPath></text><text x='150' y='245' font-family='Arial, sans-serif' font-size='46' font-weight='900' fill='%231E293B' text-anchor='middle'>23014</text><text x='150' y='285' font-family='Arial, sans-serif' font-size='20' font-weight='bold' fill='%231E293B' text-anchor='middle'>NASCA</text></svg>";
}

/**
 * Función auxiliar: Íconos por defecto de candidatos
 */
function getDefaultCandidateIcon(tipo) {
  if (tipo === "futuro") {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='20' fill='%23FEF3C7'/><path d='M100 35 L120 75 L100 160 L80 75 Z' fill='%23F43F5E'/><rect x='94' y='75' width='12' height='85' fill='%23FDE68A'/><circle cx='60' cy='65' r='14' fill='%2310B981'/><circle cx='140' cy='65' r='14' fill='%2310B981'/><circle cx='80' cy='45' r='10' fill='%2334D399'/><circle cx='120' cy='45' r='10' fill='%2334D399'/><text x='100' y='180' font-family='Arial, sans-serif' font-size='12' font-weight='bold' fill='%23881337' text-anchor='middle'>La Voz Del Futuro</text></svg>";
  } else if (tipo === "arbol") {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='20' fill='%23ECFDF5'/><circle cx='100' cy='85' r='45' fill='%2310B981'/><circle cx='75' cy='75' r='30' fill='%23059669'/><circle cx='125' cy='75' r='30' fill='%23059669'/><path d='M90 120 L110 120 L115 165 L85 165 Z' fill='%2392400E'/><ellipse cx='100' cy='168' rx='40' ry='10' fill='%23D1D5DB'/></svg>";
  } else {
    // Voto blanco
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' rx='20' fill='%23FFFFFF' stroke='%23E2E8F0' stroke-width='3'/><rect x='65' y='50' width='70' height='70' rx='6' fill='%23F8FAFC' stroke='%231E293B' stroke-width='5'/><path d='M50 75 L85 110 L160 35' fill='none' stroke='%231E293B' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/><text x='100' y='155' font-family='Arial, sans-serif' font-size='22' font-weight='900' fill='%231E293B' text-anchor='middle'>VOTO EN</text><text x='100' y='180' font-family='Arial, sans-serif' font-size='22' font-weight='900' fill='%231E293B' text-anchor='middle'>BLANCO</text></svg>";
  }
}
