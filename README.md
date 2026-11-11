# 🗳️ Sistema de Voto Electrónico Estudiantil (Multi-Institucional)

Sistema web moderno, intuitivo y seguro de **Voto Electrónico Estudiantil**, configurable para cualquier Institución Educativa (I.E.), con soporte para desbloqueo por patrón gestual por mesa, recuento en tiempo real y **sincronización automática con Google Sheets a través de Google Apps Script**.

Desarrollado originalmente para elecciones escolares (Municipios Escolares / Consejos Estudiantiles) bajo estándares de transparencia electoral y usabilidad táctil.

---

## 🌟 Características Principales

1. **Configuración Multi-Institucional (*White-Label*):**
   * Título del certamen y nombre de la institución totalmente editables.
   * Carga de insignia o escudo del colegio (PNG/JPG autoescalable).
   * Definición flexible del número de mesas electorales (de 1 a 10 mesas).

2. **Seguridad con Patrón Gestual de 9 Puntos (Estilo Android):**
   * Cada mesa electoral cuenta con su propio patrón de desbloqueo configurado por el comité electoral.
   * El miembro de mesa (jurado) desbloquea la pantalla para cada votante.
   * Al finalizar la emisión del voto, el sistema emite un **sonido positivo en alto volumen**, muestra la confirmación con **cierre automático en 3 segundos** (si no se presiona *Finalizar*) y **rebloquea automáticamente la pantalla de inmediato**, garantizando que ningún estudiante pueda votar dos veces ni manipular la terminal.

3. **Cédula de Sufragio Electrónica y Feedback Auditivo:**
   * Lista de candidatos con fotografía/símbolo en formato Base64.
   * Voto en blanco incorporado.
   * Sonido triunfal de confirmación en alto volumen sintetizado mediante *Web Audio API* (funciona 100% offline y sin requerir archivos externos).
   * Interfaz adaptada tanto para pantallas táctiles (tablets/smartphones) como computadoras de escritorio o laptops.

4. **Panel de Control y Escrutinio en Tiempo Real:**
   * Métricas instantáneas: *Total de Votos Emitidos*, *Candidato Líder*, *Mesas Activas*.
   * Barras de porcentaje por candidato.
   * **Matriz de Votos por Mesa:** Tabla detallada de escrutinio cruzado (Candidatos vs. Mesas) para auditoría de actas.
   * Botón de impresión o exportación directa del acta final.

5. **Sincronización con Google Sheets (Costo $0 de Hosting y Servidores):**
   * Funciona directamente alojado en **GitHub Pages**.
   * Los datos se guardan en una hoja de Google Sheets en la nube mediante un script de **Google Apps Script**.
   * **Autocreación de hojas:** Si las hojas `CONFIG`, `CANDIDATOS` y `VOTOS` no existen, el script las crea automáticamente con su diseño, cabeceras y valores iniciales.
   * **Modo Offline Resiliente:** Si el internet del colegio fluctúa, los votos se resguardan de forma segura en la memoria local del navegador y se sincronizan apenas se reestablece la conexión.

---

## 📋 Estructura de las Hojas en Google Sheets

El backend gestiona automáticamente 3 hojas en el mismo libro de cálculo:

### 1. Hoja `CONFIG`
| Clave | Valor |
| :--- | :--- |
| `adminPass` | `admin12345` |
| `tableCount` | `6` |
| `tablePatterns` | `{"1":"03678","2":"67852","3":"85210","4":"21036","5":"0124678","6":"0367852"}` |
| `systemTitle` | `Elecciones Estudiantiles 2026 - IE 23014 "ENRIQUE FRACCHIA"` |
| `systemInsignia` | `data:image/png;base64,...` |

### 2. Hoja `CANDIDATOS`
| ID | Nombre | ImagenBase64 |
| :--- | :--- | :--- |
| `c386467` | `LA VOZ DEL FUTURO` | `data:image/png;base64,...` |
| `c372475` | `ARBOL DE LA SABIDURIA` | `data:image/png;base64,...` |
| `c1` | `VOTO BLANCO` | `data:image/png;base64,...` |

### 3. Hoja `VOTOS`
| Timestamp | Mesa | CandidatoID | Hash |
| :--- | :--- | :--- | :--- |
| `1787863093925` | `3` | `c386467` | `MY1JMZG2NDY3LTE` |
| `1787863104950` | `3` | `c372475` | `MY1JMZCYNDC1LTE` |
| `1787863632452` | `3` | `c1` | `MY1JMS0XNZG3ODY` |

---

## 🚀 Guía de Despliegue Paso a Paso

### Paso 1: Subir a GitHub y Activar GitHub Pages

1. Suba esta carpeta a un nuevo repositorio público o privado en su cuenta de GitHub:
   ```bash
   git init
   git add .
   git commit -m "Sistema de Voto Electrónico Escolar"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
   git push -u origin main
   ```
2. En GitHub, ingrese a su repositorio y haga clic en **Settings** (Configuración) &rarr; **Pages**.
3. En **Build and deployment &rarr; Branch**, seleccione la rama `main` y la carpeta `/ (root)`.
4. Haga clic en **Save**. En unos segundos, GitHub le entregará su URL pública (ejemplo: `https://tu-usuario.github.io/tu-repositorio/`).

---

### Paso 2: Crear el Backend en Google Sheets con Apps Script

1. Abra su navegador e ingrese a [sheets.new](https://sheets.new) para crear una hoja de cálculo nueva en blanco en su Google Drive. (Puede llamarla *"Elecciones Estudiantiles 2026"*).
2. En el menú superior de Google Sheets, haga clic en:
   **Extensiones &rarr; Apps Script**.
3. Borre el código que aparezca por defecto en el editor.
4. Abra el archivo `google-apps-script/Code.gs` de este proyecto, copie todo su contenido y péguelo en el editor de Apps Script.
5. Guarde los cambios haciendo clic en el ícono de disquete 💾 (o `Ctrl + S`).
6. En la parte superior derecha, haga clic en el botón azul **Implementar &rarr; Nueva implementación**.
7. En la ventana emergente, haga clic en el ícono de engranaje ⚙️ (*Seleccionar tipo*) y elija **Aplicación web**.
8. Configure los siguientes campos:
   * **Descripción:** `Backend Voto Electrónico v1`
   * **Ejecutar como:** `Yo (tu_correo@gmail.com)`
   * **Quién tiene acceso:** `Cualquier usuario` *(Anyone - ¡Esencial para que la página de GitHub pueda guardar los votos!)*.
9. Haga clic en **Implementar**.
10. Google le solicitará autorizar permisos (*"Revisar permisos"* &rarr; Seleccione su cuenta &rarr; Haga clic en *"Avanzado"* o *"Configuración avanzada"* &rarr; *"Ir a Proyecto (no seguro)"* &rarr; *"Permitir"*).
11. Al finalizar, copie la **URL de la aplicación web** (debe terminar en `/exec`).

---

### Paso 3: Conectar la Aplicación Web con Google Sheets

1. Abra su página web (ya sea localmente o desde el enlace de **GitHub Pages**).
2. En la pantalla de inicio, haga clic en el botón **ADMINISTRADOR**.
3. Ingrese la contraseña de administrador (por defecto: `admin12345`).
4. En el Panel de Control, vaya a la pestaña **`</> Código GAS & Setup`**.
5. En el campo *"URL de la Aplicación Web"*, pegue la URL que copió en el Paso 2 y haga clic en **Guardar y Probar**.
6. Verá una notificación verde confirmando: *"Conexión exitosa con la hoja"*.
7. ¡Listo! El script creará automáticamente en su Google Sheet las 3 hojas (`CONFIG`, `CANDIDATOS` y `VOTOS`) y cada voto que se emita desde las computadoras, tablets o celulares de las mesas se registrará en tiempo real.

---

## 🔒 Funcionamiento del Patrón de Desbloqueo en las Mesas

Los 9 puntos del patrón corresponden internamente a las siguientes posiciones (índices 0 al 8):

```text
 0   1   2
 3   4   5
 6   7   8
```

Por ejemplo, un patrón en forma de **"L"** que una los puntos desde la esquina superior izquierda bajando hasta la esquina inferior izquierda y luego a la derecha corresponde al código `"03678"`.

Desde la pestaña **Configuración** del Panel de Control, el administrador puede seleccionar cada mesa (Mesa 1, Mesa 2, etc.) y dibujar de forma táctil un patrón personalizado y exclusivo para cada jurado de mesa.

---

## 🛠️ Tecnologías Empleadas

* **HTML5 Canvas & SVG:** Renderizado interactivo y suave del trazado de patrones táctiles en pantalla con retroalimentación háptica y animaciones.
* **CSS3 Moderno:** Diseño responsivo con paleta institucional, soporte para impresión (*print stylesheet*) y adaptabilidad móvil.
* **JavaScript Puro (Vanilla ES6+):** Cero dependencias externas pesadas para máxima velocidad y carga instantánea en conexiones escolares.
* **Google Apps Script & Google Sheets API:** Persistencia en la nube de alta disponibilidad y costo cero.

---

## 👨‍💻 Créditos y Soporte

* **Desarrollo:** PIP Jesús Oropeza R
* **Contacto / WhatsApp:** [+51 971778886](https://wa.me/51971778886)
