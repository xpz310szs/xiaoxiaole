(() => {
  const SIZE = 8;
  const TYPES = ["ruby", "amber", "jade", "azure", "violet", "rose"];
  const MOVE_LIMIT = 30;
  const TIME_LIMIT = 60;

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const limitLabelEl = document.getElementById("limit-label");
  const limitValueEl = document.getElementById("limit-value");
  const comboEl = document.getElementById("combo");
  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayKickerEl = document.getElementById("overlay-kicker");
  const finalScoreEl = document.getElementById("final-score");
  const playAgainBtn = document.getElementById("play-again");
  const restartBtn = document.getElementById("restart");
  const modeBtns = [...document.querySelectorAll(".mode-btn")];

  let grid = [];
  let selected = null;
  let busy = false;
  let score = 0;
  let combo = 1;
  let mode = "moves";
  let movesLeft = MOVE_LIMIT;
  let timeLeft = TIME_LIMIT;
  let timerId = null;
  let gameOver = false;
  let pointerStart = null;

  function randType() {
    return TYPES[(Math.random() * TYPES.length) | 0];
  }

  function createFilledGrid() {
    const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        let type;
        do {
          type = randType();
        } while (
          (c >= 2 && next[r][c - 1] === type && next[r][c - 2] === type) ||
          (r >= 2 && next[r - 1][c] === type && next[r - 2][c] === type)
        );
        next[r][c] = type;
      }
    }
    return next;
  }

  function cellKey(r, c) {
    return `${r}-${c}`;
  }

  function renderBoard(opts = {}) {
    const { matching = new Set(), falling = new Set(), spawning = new Set() } = opts;
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `${r + 1} 行 ${c + 1} 列 ${grid[r][c] || "空"}`);

        if (selected && selected.r === r && selected.c === c) cell.classList.add("selected");
        if (matching.has(cellKey(r, c))) cell.classList.add("matching");
        if (falling.has(cellKey(r, c))) cell.classList.add("falling");
        if (spawning.has(cellKey(r, c))) cell.classList.add("spawning");

        if (grid[r][c]) {
          const gem = document.createElement("span");
          gem.className = `gem gem-${grid[r][c]}`;
          gem.setAttribute("aria-hidden", "true");
          cell.appendChild(gem);
        }

        boardEl.appendChild(cell);
      }
    }
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    comboEl.textContent = `×${combo}`;
    if (mode === "moves") {
      limitLabelEl.textContent = "步数";
      limitValueEl.textContent = String(movesLeft);
    } else {
      limitLabelEl.textContent = "时间";
      limitValueEl.textContent = `${timeLeft}s`;
    }
  }

  function pulse(el) {
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
  }

  function findMatches() {
    const matched = new Set();

    for (let r = 0; r < SIZE; r++) {
      let run = 1;
      for (let c = 1; c <= SIZE; c++) {
        const same = c < SIZE && grid[r][c] && grid[r][c] === grid[r][c - 1];
        if (same) {
          run++;
        } else {
          if (run >= 3) {
            for (let k = c - run; k < c; k++) matched.add(cellKey(r, k));
          }
          run = 1;
        }
      }
    }

    for (let c = 0; c < SIZE; c++) {
      let run = 1;
      for (let r = 1; r <= SIZE; r++) {
        const same = r < SIZE && grid[r][c] && grid[r][c] === grid[r - 1][c];
        if (same) {
          run++;
        } else {
          if (run >= 3) {
            for (let k = r - run; k < r; k++) matched.add(cellKey(k, c));
          }
          run = 1;
        }
      }
    }

    return matched;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function clearAndCascade(initialMatched) {
    let matched = initialMatched;
    combo = 1;

    while (matched.size > 0) {
      const points = matched.size * 10 * combo;
      score += points;
      updateHud();
      pulse(scoreEl);
      pulse(comboEl);

      renderBoard({ matching: matched });
      await sleep(280);

      for (const key of matched) {
        const [r, c] = key.split("-").map(Number);
        grid[r][c] = null;
      }

      const falling = new Set();
      for (let c = 0; c < SIZE; c++) {
        let write = SIZE - 1;
        for (let r = SIZE - 1; r >= 0; r--) {
          if (grid[r][c] != null) {
            if (write !== r) {
              grid[write][c] = grid[r][c];
              grid[r][c] = null;
              falling.add(cellKey(write, c));
            }
            write--;
          }
        }
      }

      const spawning = new Set();
      for (let c = 0; c < SIZE; c++) {
        for (let r = 0; r < SIZE; r++) {
          if (grid[r][c] == null) {
            grid[r][c] = randType();
            spawning.add(cellKey(r, c));
          }
        }
      }

      renderBoard({ falling, spawning });
      await sleep(320);

      combo += 1;
      matched = findMatches();
    }

    combo = 1;
    updateHud();
    renderBoard();
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  async function trySwap(a, b) {
    if (busy || gameOver) return;
    if (!isAdjacent(a, b)) {
      selected = b;
      renderBoard();
      return;
    }

    busy = true;
    selected = null;

    const tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
    renderBoard();
    await sleep(160);

    const matched = findMatches();
    if (matched.size === 0) {
      const revert = grid[a.r][a.c];
      grid[a.r][a.c] = grid[b.r][b.c];
      grid[b.r][b.c] = revert;
      renderBoard();
      await sleep(160);
      busy = false;
      return;
    }

    if (mode === "moves") {
      movesLeft = Math.max(0, movesLeft - 1);
      updateHud();
      pulse(limitValueEl);
    }

    await clearAndCascade(matched);

    if (mode === "moves" && movesLeft <= 0) {
      endGame(false);
    } else if (!hasAnyMove()) {
      reshuffleUntilPlayable();
      renderBoard();
    }

    busy = false;
  }

  function hasAnyMove() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (c + 1 < SIZE) {
          swapInPlace(r, c, r, c + 1);
          const ok = findMatches().size > 0;
          swapInPlace(r, c, r, c + 1);
          if (ok) return true;
        }
        if (r + 1 < SIZE) {
          swapInPlace(r, c, r + 1, c);
          const ok = findMatches().size > 0;
          swapInPlace(r, c, r + 1, c);
          if (ok) return true;
        }
      }
    }
    return false;
  }

  function swapInPlace(r1, c1, r2, c2) {
    const t = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = t;
  }

  function reshuffleUntilPlayable() {
    let guard = 0;
    do {
      const flat = grid.flat();
      for (let i = flat.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [flat[i], flat[j]] = [flat[j], flat[i]];
      }
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          grid[r][c] = flat[r * SIZE + c];
        }
      }
      guard++;
    } while ((findMatches().size > 0 || !hasAnyMove()) && guard < 40);

    if (findMatches().size > 0 || !hasAnyMove()) {
      grid = createFilledGrid();
    }
  }

  function onCellTap(r, c) {
    if (busy || gameOver) return;
    if (!selected) {
      selected = { r, c };
      renderBoard();
      return;
    }
    if (selected.r === r && selected.c === c) {
      selected = null;
      renderBoard();
      return;
    }
    trySwap(selected, { r, c });
  }

  function endGame(wonByTime) {
    gameOver = true;
    stopTimer();
    finalScoreEl.textContent = String(score);
    if (mode === "timed" && timeLeft <= 0) {
      overlayKickerEl.textContent = "时间到";
      overlayTitleEl.textContent = score >= 800 ? "星光闪耀！" : "再试一次";
    } else if (mode === "moves" && movesLeft <= 0) {
      overlayKickerEl.textContent = "步数用尽";
      overlayTitleEl.textContent = score >= 1200 ? "完美消除！" : "本局结束";
    } else {
      overlayKickerEl.textContent = wonByTime ? "挑战完成" : "本局结束";
      overlayTitleEl.textContent = "漂亮！";
    }
    overlayEl.classList.remove("hidden");
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (mode !== "timed") return;
    timerId = setInterval(() => {
      if (busy) return;
      timeLeft -= 1;
      updateHud();
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHud();
        endGame(false);
      }
    }, 1000);
  }

  function startGame() {
    stopTimer();
    gameOver = false;
    busy = false;
    selected = null;
    score = 0;
    combo = 1;
    movesLeft = MOVE_LIMIT;
    timeLeft = TIME_LIMIT;
    overlayEl.classList.add("hidden");
    grid = createFilledGrid();
    if (!hasAnyMove()) reshuffleUntilPlayable();
    updateHud();
    renderBoard();
    startTimer();
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      startGame();
    });
  });

  restartBtn.addEventListener("click", startGame);
  playAgainBtn.addEventListener("click", startGame);

  boardEl.addEventListener(
    "pointerdown",
    (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || busy || gameOver) return;
      pointerStart = {
        r: Number(cell.dataset.r),
        c: Number(cell.dataset.c),
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
        moved: false,
      };
    },
    { passive: true }
  );

  boardEl.addEventListener(
    "pointermove",
    (e) => {
      if (!pointerStart || pointerStart.id !== e.pointerId) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) pointerStart.moved = true;
    },
    { passive: true }
  );

  boardEl.addEventListener("pointerup", (e) => {
    if (!pointerStart || pointerStart.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 18;
    const start = pointerStart;
    pointerStart = null;

    if (absX > threshold || absY > threshold) {
      let tr = start.r;
      let tc = start.c;
      if (absX > absY) tc += dx > 0 ? 1 : -1;
      else tr += dy > 0 ? 1 : -1;
      if (tr >= 0 && tr < SIZE && tc >= 0 && tc < SIZE) {
        e.preventDefault();
        trySwap(start, { r: tr, c: tc });
      }
      return;
    }

    // Short tap: select / swap via click path (no setPointerCapture, so click reaches the cell)
    if (!start.moved) onCellTap(start.r, start.c);
  });

  boardEl.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  startGame();
})();
