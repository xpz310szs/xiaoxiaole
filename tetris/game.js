(() => {
  const COLS = 10;
  const ROWS = 20;
  const BEST_KEY = "block-drop-best";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const nextCanvas = document.getElementById("next");
  const nextCtx = nextCanvas.getContext("2d");
  const holdCanvas = document.getElementById("hold");
  const holdCtx = holdCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const finalScore = document.getElementById("final-score");
  const resumeBtn = document.getElementById("resume");
  const restartBtn = document.getElementById("restart");
  const pauseBtn = document.getElementById("pause");
  const holdBtn = document.getElementById("hold-btn");

  const CELL = canvas.width / COLS;

  const COLORS = {
    I: "#42d6ff",
    O: "#ffd23a",
    T: "#c084fc",
    S: "#4ade80",
    Z: "#fb7185",
    J: "#60a5fa",
    L: "#fb923c",
  };

  const SHAPES = {
    I: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
    ],
    O: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
    T: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
    S: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
    ],
    Z: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
    J: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
    L: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    ],
  };

  const BAG_TYPES = Object.keys(SHAPES);

  let grid = [];
  let bag = [];
  let current = null;
  let nextType = null;
  let holdType = null;
  let holdLocked = false;
  let score = 0;
  let lines = 0;
  let level = 1;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let paused = false;
  let gameOver = false;
  let dropMs = 800;
  let lastDrop = 0;
  let raf = 0;
  let lineFlash = null;

  let pointer = null;
  let lastTap = 0;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function refillBag() {
    const next = [...BAG_TYPES];
    for (let i = next.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [next[i], next[j]] = [next[j], next[i]];
    }
    bag.push(...next);
  }

  function takeFromBag() {
    if (bag.length < 3) refillBag();
    return bag.shift();
  }

  function spawnPiece(type = takeFromBag()) {
    const rotations = SHAPES[type];
    const matrix = rotations[0].map((row) => [...row]);
    const piece = {
      type,
      rot: 0,
      matrix,
      x: ((COLS - matrix[0].length) / 2) | 0,
      y: 0,
    };
    if (collides(piece, 0, 0)) {
      endGame();
      return null;
    }
    return piece;
  }

  function getMatrix(type, rot) {
    const list = SHAPES[type];
    return list[rot % list.length].map((row) => [...row]);
  }

  function collides(piece, dx, dy, matrix = piece.matrix) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = piece.x + c + dx;
        const y = piece.y + r + dy;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && grid[y][x]) return true;
      }
    }
    return false;
  }

  function mergePiece() {
    for (let r = 0; r < current.matrix.length; r++) {
      for (let c = 0; c < current.matrix[r].length; c++) {
        if (!current.matrix[r][c]) continue;
        const x = current.x + c;
        const y = current.y + r;
        if (y >= 0) grid[y][x] = current.type;
      }
    }
  }

  function clearLines() {
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every(Boolean)) full.push(r);
    }
    if (!full.length) return 0;

    lineFlash = { rows: full, until: performance.now() + 120 };
    for (const r of [...full].sort((a, b) => b - a)) {
      grid.splice(r, 1);
      grid.unshift(Array(COLS).fill(null));
    }
    return full.length;
  }

  function addScore(cleared) {
    const table = [0, 100, 300, 500, 800];
    score += (table[cleared] || 800) * level;
    lines += cleared;
    level = 1 + ((lines / 10) | 0);
    dropMs = Math.max(120, 800 - (level - 1) * 60);
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {
        /* ignore */
      }
    }
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
    bestEl.textContent = String(best);
  }

  function hardDropDistance(piece = current) {
    let d = 0;
    while (!collides(piece, 0, d + 1)) d++;
    return d;
  }

  function drawCell(context, x, y, type, alpha = 1, size = CELL) {
    const color = COLORS[type] || "#888";
    context.globalAlpha = alpha;
    const px = x * size;
    const py = y * size;
    const pad = Math.max(1, size * 0.06);
    const g = context.createLinearGradient(px, py, px, py + size);
    g.addColorStop(0, shade(color, 28));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -28));
    context.fillStyle = g;
    roundRect(context, px + pad, py + pad, size - pad * 2, size - pad * 2, size * 0.18);
    context.fill();
    context.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(context, px + pad + 2, py + pad + 2, size * 0.35, size * 0.18, 4);
    context.fill();
    context.globalAlpha = 1;
  }

  function shade(hex, amt) {
    const n = hex.replace("#", "");
    const num = parseInt(n, 16);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0xff) + amt;
    let b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  function roundRect(context, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + rr, y);
    context.arcTo(x + w, y, x + w, y + h, rr);
    context.arcTo(x + w, y + h, x, y + h, rr);
    context.arcTo(x, y + h, x, y, rr);
    context.arcTo(x, y, x + w, y, rr);
    context.closePath();
  }

  function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#101826";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(canvas.width, y * CELL);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) drawCell(ctx, c, r, grid[r][c]);
      }
    }

    if (lineFlash && performance.now() < lineFlash.until) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      for (const r of lineFlash.rows) {
        ctx.fillRect(0, r * CELL, canvas.width, CELL);
      }
    } else {
      lineFlash = null;
    }

    if (current && !gameOver) {
      const ghostY = hardDropDistance();
      for (let r = 0; r < current.matrix.length; r++) {
        for (let c = 0; c < current.matrix[r].length; c++) {
          if (!current.matrix[r][c]) continue;
          drawCell(ctx, current.x + c, current.y + r + ghostY, current.type, 0.22);
        }
      }
      for (let r = 0; r < current.matrix.length; r++) {
        for (let c = 0; c < current.matrix[r].length; c++) {
          if (!current.matrix[r][c]) continue;
          drawCell(ctx, current.x + c, current.y + r, current.type);
        }
      }
    }
  }

  function drawPreview(context, type) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.fillStyle = "#0f1724";
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    if (!type) return;
    const matrix = getMatrix(type, 0);
    const size = 20;
    const w = matrix[0].length * size;
    const h = matrix.length * size;
    const ox = ((context.canvas.width - w) / 2 / size);
    const oy = ((context.canvas.height - h) / 2 / size);
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const px = (ox + c) * size;
        const py = (oy + r) * size;
        const color = COLORS[type];
        const g = context.createLinearGradient(px, py, px, py + size);
        g.addColorStop(0, shade(color, 24));
        g.addColorStop(1, shade(color, -20));
        context.fillStyle = g;
        roundRect(context, px + 1, py + 1, size - 2, size - 2, 4);
        context.fill();
      }
    }
  }

  function lockAndSpawn() {
    mergePiece();
    const cleared = clearLines();
    if (cleared) addScore(cleared);
    holdLocked = false;
    current = spawnPiece(nextType);
    nextType = takeFromBag();
    drawPreview(nextCtx, nextType);
    drawPreview(holdCtx, holdType);
    updateHud();
  }

  function move(dx, dy) {
    if (!current || paused || gameOver) return false;
    if (!collides(current, dx, dy)) {
      current.x += dx;
      current.y += dy;
      return true;
    }
    return false;
  }

  function rotate() {
    if (!current || paused || gameOver) return;
    const list = SHAPES[current.type];
    const nextRot = (current.rot + 1) % list.length;
    const nextMatrix = getMatrix(current.type, nextRot);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(current, k, 0, nextMatrix)) {
        current.rot = nextRot;
        current.matrix = nextMatrix;
        current.x += k;
        return;
      }
    }
  }

  function softDrop() {
    if (!move(0, 1)) {
      lockAndSpawn();
      return false;
    }
    score += 1;
    updateHud();
    return true;
  }

  function hardDrop() {
    if (!current || paused || gameOver) return;
    const d = hardDropDistance();
    current.y += d;
    score += d * 2;
    updateHud();
    lockAndSpawn();
  }

  function hold() {
    if (!current || paused || gameOver || holdLocked) return;
    const swapping = holdType;
    holdType = current.type;
    holdLocked = true;
    current = spawnPiece(swapping || nextType);
    if (!swapping) {
      nextType = takeFromBag();
      drawPreview(nextCtx, nextType);
    }
    drawPreview(holdCtx, holdType);
  }

  function endGame() {
    gameOver = true;
    paused = true;
    overlayKicker.textContent = "游戏结束";
    overlayTitle.textContent = score >= best && score > 0 ? "新纪录！" : "再来一局";
    finalScore.textContent = String(score);
    resumeBtn.classList.add("hidden");
    resumeBtn.style.display = "none";
    overlay.classList.remove("hidden");
  }

  function showPause() {
    if (gameOver) return;
    paused = true;
    overlayKicker.textContent = "暂停";
    overlayTitle.textContent = "休息一下";
    finalScore.textContent = String(score);
    resumeBtn.style.display = "block";
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function startGame() {
    grid = emptyGrid();
    bag = [];
    refillBag();
    score = 0;
    lines = 0;
    level = 1;
    dropMs = 800;
    paused = false;
    gameOver = false;
    holdType = null;
    holdLocked = false;
    lineFlash = null;
    nextType = takeFromBag();
    current = spawnPiece();
    nextType = takeFromBag();
    updateHud();
    drawPreview(nextCtx, nextType);
    drawPreview(holdCtx, holdType);
    hideOverlay();
    resumeBtn.style.display = "block";
    lastDrop = performance.now();
  }

  function tick(now) {
    if (!paused && !gameOver && current) {
      if (now - lastDrop >= dropMs) {
        if (!move(0, 1)) lockAndSpawn();
        lastDrop = now;
      }
    }
    drawBoard();
    raf = requestAnimationFrame(tick);
  }

  function act(name) {
    switch (name) {
      case "left":
        move(-1, 0);
        break;
      case "right":
        move(1, 0);
        break;
      case "rotate":
        rotate();
        break;
      case "soft":
        softDrop();
        break;
      case "hard":
        hardDrop();
        break;
      case "hold":
        hold();
        break;
      default:
        break;
    }
  }

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      act(btn.dataset.act);
    };
    btn.addEventListener("pointerdown", fire);
  });

  holdBtn.addEventListener("click", () => act("hold"));

  pauseBtn.addEventListener("click", () => {
    if (gameOver) return;
    if (paused) {
      paused = false;
      hideOverlay();
      lastDrop = performance.now();
    } else {
      showPause();
    }
  });

  resumeBtn.addEventListener("click", () => {
    if (gameOver) return;
    paused = false;
    hideOverlay();
    lastDrop = performance.now();
  });

  restartBtn.addEventListener("click", () => startGame());

  window.addEventListener("keydown", (e) => {
    if (e.repeat && (e.key === " " || e.key === "ArrowUp")) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        act("left");
        break;
      case "ArrowRight":
        e.preventDefault();
        act("right");
        break;
      case "ArrowDown":
        e.preventDefault();
        act("soft");
        break;
      case "ArrowUp":
      case "x":
      case "X":
        e.preventDefault();
        act("rotate");
        break;
      case " ":
        e.preventDefault();
        act("hard");
        break;
      case "c":
      case "C":
        e.preventDefault();
        act("hold");
        break;
      case "p":
      case "P":
        pauseBtn.click();
        break;
      default:
        break;
    }
  });

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      pointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) pointer.moved = true;

      if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
        act(dx > 0 ? "right" : "left");
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      } else if (dy > 36 && Math.abs(dy) > Math.abs(dx)) {
        act("soft");
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      }
    },
    { passive: true }
  );

  function endPointer(e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    const moved = pointer.moved;
    pointer = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }

    if (!moved) {
      const now = performance.now();
      if (now - lastTap < 280) {
        act("hard");
        lastTap = 0;
      } else {
        act("rotate");
        lastTap = now;
      }
      return;
    }

    if (dy < -40 && Math.abs(dy) > Math.abs(dx)) act("rotate");
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", () => {
    pointer = null;
  });

  bestEl.textContent = String(best);
  startGame();
  raf = requestAnimationFrame(tick);
})();
