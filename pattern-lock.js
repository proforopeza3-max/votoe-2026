/**
 * COMPONENTE REUTILIZABLE: PATTERN LOCK (Desbloqueo por Patrón 3x3)
 * Soporta Touch (Móviles / Tablets) y Mouse (Escritorio / Kioscos)
 * Formato de salida: Secuencia numérica tipo "03678"
 */

class PatternLock {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.onComplete = options.onComplete || function () {};
    this.minPoints = options.minPoints || 4;

    this.canvas = this.container.querySelector("canvas");
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.className = "pattern-canvas";
      this.container.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext("2d");

    this.dots = [];
    this.selectedDots = [];
    this.isDrawing = false;
    this.currentPoint = { x: 0, y: 0 };
    this.disabled = false;

    this.initDOM();
    this.resizeCanvas();
    this.bindEvents();

    window.addEventListener("resize", () => {
      this.resizeCanvas();
      this.redraw();
    });
  }

  initDOM() {
    // Si no existen los puntos superpuestos, crearlos
    let overlay = this.container.querySelector(".pattern-dots-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "pattern-dots-overlay";
      for (let i = 0; i < 9; i++) {
        const dot = document.createElement("div");
        dot.className = "pattern-dot";
        dot.dataset.index = i;
        overlay.appendChild(dot);
      }
      this.container.appendChild(overlay);
    }
    this.dotElements = Array.from(overlay.querySelectorAll(".pattern-dot"));
  }

  resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;

    // Calcular centros de los 9 puntos (3 filas x 3 columnas)
    this.dots = [];
    const colStep = this.width / 3;
    const rowStep = this.height / 3;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;
        this.dots.push({
          index: idx,
          x: colStep * c + colStep / 2,
          y: rowStep * r + rowStep / 2,
          radius: 28 // radio de detección
        });
      }
    }
  }

  bindEvents() {
    // Eventos Mouse
    this.container.addEventListener("mousedown", (e) => this.handleStart(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => {
      if (this.isDrawing) this.handleMove(e.clientX, e.clientY);
    });
    window.addEventListener("mouseup", () => {
      if (this.isDrawing) this.handleEnd();
    });

    // Eventos Touch
    this.container.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          this.handleStart(t.clientX, t.clientY);
          e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener(
      "touchmove",
      (e) => {
        if (this.isDrawing && e.touches.length > 0) {
          const t = e.touches[0];
          this.handleMove(t.clientX, t.clientY);
          e.preventDefault();
        }
      },
      { passive: false }
    );

    window.addEventListener("touchend", () => {
      if (this.isDrawing) this.handleEnd();
    });
  }

  getPointerPos(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  handleStart(clientX, clientY) {
    if (this.disabled) return;
    this.resetState();
    this.isDrawing = true;
    const pos = this.getPointerPos(clientX, clientY);
    this.currentPoint = pos;
    this.checkHitDot(pos.x, pos.y);
    this.redraw();
  }

  handleMove(clientX, clientY) {
    if (!this.isDrawing || this.disabled) return;
    const pos = this.getPointerPos(clientX, clientY);
    this.currentPoint = pos;
    this.checkHitDot(pos.x, pos.y);
    this.redraw();
  }

  handleEnd() {
    if (!this.isDrawing || this.disabled) return;
    this.isDrawing = false;
    this.redraw();

    const patternString = this.selectedDots.map((d) => d.index).join("");
    if (typeof this.onComplete === "function") {
      this.onComplete(patternString);
    }
  }

  checkHitDot(x, y) {
    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i];
      const dist = Math.hypot(x - dot.x, y - dot.y);
      if (dist <= dot.radius) {
        if (!this.selectedDots.some((d) => d.index === dot.index)) {
          this.selectedDots.push(dot);
          if (this.dotElements[dot.index]) {
            this.dotElements[dot.index].classList.add("active");
          }
          if (navigator.vibrate) {
            navigator.vibrate(20);
          }
        }
        break;
      }
    }
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.selectedDots.length === 0) return;

    // Determinar color de línea según estado
    let strokeColor = "#38BDF8";
    if (this.container.classList.contains("error")) strokeColor = "#EF4444";
    if (this.container.classList.contains("success")) strokeColor = "#10B981";

    this.ctx.save();
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 5;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Líneas entre puntos ya seleccionados
    this.ctx.beginPath();
    this.ctx.moveTo(this.selectedDots[0].x, this.selectedDots[0].y);
    for (let i = 1; i < this.selectedDots.length; i++) {
      this.ctx.lineTo(this.selectedDots[i].x, this.selectedDots[i].y);
    }

    // Línea al puntero actual si se está arrastrando
    if (this.isDrawing && this.selectedDots.length > 0) {
      const last = this.selectedDots[this.selectedDots.length - 1];
      this.ctx.moveTo(last.x, last.y);
      this.ctx.lineTo(this.currentPoint.x, this.currentPoint.y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  setError() {
    this.container.classList.add("error", "shake");
    this.redraw();
    setTimeout(() => {
      this.container.classList.remove("error", "shake");
      this.resetState();
    }, 700);
  }

  setSuccess() {
    this.container.classList.add("success");
    this.redraw();
  }

  resetState() {
    this.selectedDots = [];
    this.container.classList.remove("error", "success", "shake");
    if (this.dotElements) {
      this.dotElements.forEach((el) => el.classList.remove("active"));
    }
    this.redraw();
  }

  disable() {
    this.disabled = true;
  }

  enable() {
    this.disabled = false;
  }
}
