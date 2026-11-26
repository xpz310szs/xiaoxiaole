(() => {
  const canvas = document.getElementById("maze");
  const ctx = canvas.getContext("2d");
  const timeEl = document.getElementById("time");
  const stepsEl = document.getElementById("steps");
  const winsEl = document.getElementById("wins");
  const winOverlay = document.getElementById("win");
  const winSub = document.getElementById("win-sub");
  const newBtn = document.getElementById("new-maze");
  const againBtn = document.getElementById("again");

  const DIRS = [
    { key: "up", dx: 0, dy: -1 },
    { key: "right", dx: 1, dy: 0 },
    { key: "down", dx: 0, dy: 1 },
    { key: "left", dx: -1, dy: 0 },
  ];

  let size = 13; // odd
  let grid = [];
  let player = { x: 1, y: 1 };
  let exit = { x: 1, y: 1 };
  let steps = 0;
  let wins = Number(localStorage.getItem("maze-wins") || 0);
  let startedAt = 0;
  let timer = null;
  let won = false;
  let trail = new Set();
  let audioCtx = null;

  winsEl.textContent = String(wins);

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function blip(freq, dur = 0.08, type = "sine", vol = 0.08) {
    const ctxA = ensureAudio();
    if (!ctxA) return;
    const t0 = ctxA.currentTime;
    const osc = ctxA.createOscillator();
    const gain = ctxA.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctxA.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function tick() {
    if (!startedAt || won) return;
    timeEl.textContent = formatTime(Date.now() - startedAt);
  }

  function cell(x, y) {
    return grid[y] && grid[y][x];
  }

  function generate(n) {
    // n must be odd
    const g = Array.from({ length: n }, () => Array(n).fill(1));
    const stack = [[1, 1]];
    g[1][1] = 0;

    const neighbors = (x, y) => {
      const list = [];
      for (const d of DIRS) {
        const nx = x + d.dx * 2;
        const ny = y + d.dy * 2;
        if (nx > 0 && ny > 0 && nx < n - 1 && ny < n - 1 && g[ny][nx] === 1) {
          list.push([nx, ny, x + d.dx, y + d.dy]);
        }
      }
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };

    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const opts = neighbors(x, y);
      if (!opts.length) {
        stack.pop();
        continue;
      }
      const [nx, ny, wx, wy] = opts[0];
      g[wy][wx] = 0;
      g[ny][nx] = 0;
      stack.push([nx, ny]);
    }

    // carve a few loops for friendlier feel on easy/normal
    const loops = n <= 9 ? 8 : n <= 13 ? 5 : 2;
    for (let i = 0; i < loops; i++) {
      const x = 1 + Math.floor(Math.random() * ((n - 1) / 2)) * 2;
      const y = 1 + Math.floor(Math.random() * ((n - 1) / 2)) * 2;
      const d = DIRS[Math.floor(Math.random() * 4)];
      const wx = x + d.dx;
      const wy = y + d.dy;
      if (wx > 0 && wy > 0 && wx < n - 1 && wy < n - 1) g[wy][wx] = 0;
    }

    g[1][1] = 0;
    g[n - 2][n - 2] = 0;
    return g;
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const side = Math.floor(wrap.clientWidth);
    canvas.width = side * devicePixelRatio;
    canvas.height = side * devicePixelRatio;
    canvas.style.width = side + "px";
    canvas.style.height = side + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function draw() {
    const n = size;
    const side = canvas.clientWidth;
    const cellSize = side / n;
    ctx.clearRect(0, 0, side, side);

    // floor
    ctx.fillStyle = "#16352c";
    ctx.fillRect(0, 0, side, side);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = x * cellSize;
        const py = y * cellSize;
        if (grid[y][x] === 1) {
          ctx.fillStyle = "#2f6b58";
          ctx.fillRect(px, py, cellSize + 0.5, cellSize + 0.5);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(px + 2, py + 2, cellSize * 0.35, cellSize * 0.22);
        } else {
          const key = `${x},${y}`;
          if (trail.has(key)) {
            ctx.fillStyle = "rgba(126, 232, 180, 0.22)";
            ctx.fillRect(px, py, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }
    }

    // exit
    const ex = (exit.x + 0.5) * cellSize;
    const ey = (exit.y + 0.5) * cellSize;
    const er = cellSize * 0.28;
    const grad = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 1, ex, ey, er);
    grad.addColorStop(0, "#fff6c2");
    grad.addColorStop(0.5, "#ffd23a");
    grad.addColorStop(1, "#e09a20");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // player
    const px = (player.x + 0.5) * cellSize;
    const py = (player.y + 0.5) * cellSize;
    const pr = cellSize * 0.3;
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 1, px, py, pr);
    pg.addColorStop(0, "#ffffff");
    pg.addColorStop(0.35, "#7ec8ff");
    pg.addColorStop(1, "#2f9dff");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function startTimer() {
    if (!startedAt) startedAt = Date.now();
    if (!timer) timer = setInterval(tick, 250);
  }

  function tryMove(dirKey) {
    if (won) return;
    const d = DIRS.find((x) => x.key === dirKey);
    if (!d) return;
    const nx = player.x + d.dx;
    const ny = player.y + d.dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) return;
    if (grid[ny][nx] === 1) {
      blip(180, 0.05, "square", 0.04);
      return;
    }
    ensureAudio();
    startTimer();
    player.x = nx;
    player.y = ny;
    steps += 1;
    stepsEl.textContent = String(steps);
    trail.add(`${nx},${ny}`);
    blip(520 + Math.random() * 80, 0.06, "triangle", 0.06);
    draw();
    if (player.x === exit.x && player.y === exit.y) onWin();
  }

  function onWin() {
    won = true;
    wins += 1;
    localStorage.setItem("maze-wins", String(wins));
    winsEl.textContent = String(wins);
    const elapsed = formatTime(Date.now() - startedAt);
    winSub.textContent = `用时 ${elapsed} · ${steps} 步`;
    winOverlay.classList.remove("hidden");
    blip(660, 0.12, "sine", 0.1);
    setTimeout(() => blip(880, 0.14, "sine", 0.1), 90);
    setTimeout(() => blip(1100, 0.18, "sine", 0.1), 180);
  }

  function newGame(nextSize = size) {
    size = nextSize % 2 === 0 ? nextSize + 1 : nextSize;
    grid = generate(size);
    player = { x: 1, y: 1 };
    exit = { x: size - 2, y: size - 2 };
    steps = 0;
    startedAt = 0;
    won = false;
    trail = new Set(["1,1"]);
    stepsEl.textContent = "0";
    timeEl.textContent = "0:00";
    winOverlay.classList.add("hidden");
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    resizeCanvas();
    draw();
  }

  document.querySelectorAll(".level").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".level").forEach((b) => b.classList.toggle("active", b === btn));
      newGame(Number(btn.dataset.size));
      blip(440, 0.07, "sine", 0.06);
    });
  });

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("click", () => tryMove(btn.dataset.dir));
  });

  newBtn.addEventListener("click", () => {
    newGame(size);
    blip(400, 0.08, "triangle", 0.07);
  });
  againBtn.addEventListener("click", () => newGame(size));

  window.addEventListener("keydown", (e) => {
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      a: "left",
      s: "down",
      d: "right",
      W: "up",
      A: "left",
      S: "down",
      D: "right",
    };
    if (map[e.key]) {
      e.preventDefault();
      tryMove(map[e.key]);
    }
  });

  // swipe
  let sx = 0;
  let sy = 0;
  canvas.addEventListener("pointerdown", (e) => {
    sx = e.clientX;
    sy = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? "right" : "left");
    else tryMove(dy > 0 ? "down" : "up");
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    draw();
  });

  newGame(size);
})();
