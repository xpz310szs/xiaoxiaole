(() => {
  const SIZE = 8;
  const TYPES = ["ruby", "amber", "jade", "azure", "violet"];
  const MOVE_LIMIT = 30;
  const TIME_LIMIT = 60;
  const SWAP_MS = 180;
  const POP_MS = 220;
  const FALL_MS = 260;
  const HINT_IDLE_MS = 4500;

  const boardEl = document.getElementById("board");
  const fxLayer = document.getElementById("fx-layer");
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
  const hintBtn = document.getElementById("hint");
  const toastEl = document.getElementById("toast");
  const modeBtns = [...document.querySelectorAll(".mode-btn")];

  /** @type {{type:string,special:null|'bomb'}[][]} */
  let grid = [];
  /** @type {HTMLButtonElement[][]} */
  let cells = [];
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
  let hintTimer = null;
  let toastTimer = null;
  let audioCtx = null;

  function tile(type, special = null) {
    return { type, special };
  }

  function randType() {
    return TYPES[(Math.random() * TYPES.length) | 0];
  }

  function sameColor(a, b) {
    return a && b && a.type === b.type;
  }

  function cellKey(r, c) {
    return `${r}-${c}`;
  }

  function parseKey(key) {
    const [r, c] = key.split("-").map(Number);
    return { r, c };
  }

  function createFilledGrid() {
    const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        let type;
        do {
          type = randType();
        } while (
          (c >= 2 && next[r][c - 1]?.type === type && next[r][c - 2]?.type === type) ||
          (r >= 2 && next[r - 1][c]?.type === type && next[r - 2][c]?.type === type)
        );
        next[r][c] = tile(type);
      }
    }
    return next;
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function beep(freq, dur = 0.06, gain = 0.035, type = "sine") {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function showToast(text, ms = 1400) {
    toastEl.textContent = text;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
  }

  function clearHints() {
    boardEl.querySelectorAll(".cell.hint").forEach((el) => el.classList.remove("hint"));
  }

  function resetHintTimer() {
    clearTimeout(hintTimer);
    if (gameOver || busy) return;
    hintTimer = setTimeout(() => {
      if (!busy && !gameOver) showHint(false);
    }, HINT_IDLE_MS);
  }

  function buildBoardDom() {
    boardEl.innerHTML = "";
    cells = Array.from({ length: SIZE }, () => Array(SIZE));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute("role", "gridcell");
        cells[r][c] = cell;
        boardEl.appendChild(cell);
      }
    }
  }

  function paintGem(r, c, anim) {
    const cell = cells[r][c];
    const t = grid[r][c];
    cell.classList.remove("selected", "hint", "shake");
    cell.innerHTML = "";
    if (!t) {
      cell.setAttribute("aria-label", `${r + 1} 行 ${c + 1} 列 空`);
      return;
    }
    const gem = document.createElement("span");
    gem.className = `gem gem-${t.type}`;
    if (t.special) gem.classList.add("special", t.special);
    gem.setAttribute("aria-hidden", "true");
    if (typeof anim === "object" && anim?.kind === "falling") {
      gem.classList.add("falling");
      gem.style.setProperty("--fall-from", String(anim.dist || 1));
    } else if (anim === "spawning") {
      gem.classList.add("spawning");
    } else if (anim === "popping") {
      gem.classList.add("popping");
    }
    cell.appendChild(gem);
    const label = t.special ? `${t.type} 炸弹` : t.type;
    cell.setAttribute("aria-label", `${r + 1} 行 ${c + 1} 列 ${label}`);
    if (selected && selected.r === r && selected.c === c) cell.classList.add("selected");
  }

  function renderAll(anims = {}) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        paintGem(r, c, anims[cellKey(r, c)]);
      }
    }
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    comboEl.textContent = `×${combo}`;
    if (mode === "moves") {
      limitLabelEl.textContent = "步数";
      limitValueEl.textContent = String(movesLeft);
      limitValueEl.classList.toggle("warn", movesLeft <= 5);
    } else {
      limitLabelEl.textContent = "时间";
      limitValueEl.textContent = `${timeLeft}s`;
      limitValueEl.classList.toggle("warn", timeLeft <= 10);
    }
  }

  function pulse(el) {
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
  }

  function floatScoreAt(keys, points, isCombo) {
    if (!keys.length) return;
    const mid = parseKey(keys[(keys.length / 2) | 0]);
    const cell = cells[mid.r][mid.c];
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = `float-score${isCombo ? " combo" : ""}`;
    el.textContent = isCombo ? `连击 +${points}` : `+${points}`;
    el.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
    el.style.top = `${cellRect.top - boardRect.top + cellRect.height / 2}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 720);
  }

  function findMatchGroups() {
    const matched = new Set();
    const groups = [];

    for (let r = 0; r < SIZE; r++) {
      let run = 1;
      for (let c = 1; c <= SIZE; c++) {
        const same = c < SIZE && sameColor(grid[r][c], grid[r][c - 1]);
        if (same) run++;
        else {
          if (run >= 3) {
            const keys = [];
            for (let k = c - run; k < c; k++) {
              const key = cellKey(r, k);
              matched.add(key);
              keys.push(key);
            }
            groups.push({ keys, len: run, orient: "h", r, c0: c - run });
          }
          run = 1;
        }
      }
    }

    for (let c = 0; c < SIZE; c++) {
      let run = 1;
      for (let r = 1; r <= SIZE; r++) {
        const same = r < SIZE && sameColor(grid[r][c], grid[r - 1][c]);
        if (same) run++;
        else {
          if (run >= 3) {
            const keys = [];
            for (let k = r - run; k < r; k++) {
              const key = cellKey(k, c);
              matched.add(key);
              keys.push(key);
            }
            groups.push({ keys, len: run, orient: "v", c, r0: r - run });
          }
          run = 1;
        }
      }
    }

    return { matched, groups };
  }

  function expandBombs(matched) {
    const extra = new Set();
    for (const key of matched) {
      const { r, c } = parseKey(key);
      const t = grid[r][c];
      if (!t?.special) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
            extra.add(cellKey(nr, nc));
          }
        }
      }
    }
    for (const key of extra) matched.add(key);
    return matched;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function animateSwap(a, b) {
    const gemA = cells[a.r][a.c].querySelector(".gem");
    const gemB = cells[b.r][b.c].querySelector(".gem");
    if (!gemA || !gemB) return;
    const rectA = cells[a.r][a.c].getBoundingClientRect();
    const rectB = cells[b.r][b.c].getBoundingClientRect();
    const dx = rectB.left - rectA.left;
    const dy = rectB.top - rectA.top;
    gemA.classList.add("swapping");
    gemB.classList.add("swapping");
    gemA.style.transform = `translate(${dx}px, ${dy}px)`;
    gemB.style.transform = `translate(${-dx}px, ${-dy}px)`;
    await sleep(SWAP_MS);
  }

  async function shakeCells(a, b) {
    cells[a.r][a.c].classList.add("shake");
    cells[b.r][b.c].classList.add("shake");
    beep(180, 0.08, 0.03, "triangle");
    await sleep(320);
    cells[a.r][a.c].classList.remove("shake");
    cells[b.r][b.c].classList.remove("shake");
  }

  function pickBombSpot(group, focus) {
    if (focus) {
      const focusKey = cellKey(focus.r, focus.c);
      if (group.keys.includes(focusKey)) return focus;
    }
    const mid = group.keys[(group.keys.length / 2) | 0];
    return parseKey(mid);
  }

  async function clearAndCascade(initialMatched, focus) {
    let matched = new Set(initialMatched);
    combo = 1;

    while (matched.size > 0) {
      matched = expandBombs(matched);
      const { groups } = findMatchGroups();
      const bombsToSpawn = [];

      for (const group of groups) {
        if (group.len >= 4) {
          const spot = pickBombSpot(group, focus);
          const color = grid[spot.r][spot.c]?.type || grid[parseKey(group.keys[0]).r][parseKey(group.keys[0]).c]?.type;
          if (color) bombsToSpawn.push({ ...spot, type: color });
        }
      }

      const points = matched.size * 10 * combo + bombsToSpawn.length * 25 * combo;
      score += points;
      updateHud();
      pulse(scoreEl);
      if (combo > 1) pulse(comboEl);
      floatScoreAt([...matched], points, combo > 1);
      beep(420 + combo * 60, 0.07, 0.04);

      const anims = {};
      for (const key of matched) anims[key] = "popping";
      renderAll(anims);
      await sleep(POP_MS);

      for (const key of matched) {
        const { r, c } = parseKey(key);
        grid[r][c] = null;
      }

      for (const bomb of bombsToSpawn) {
        if (grid[bomb.r][bomb.c] == null) {
          grid[bomb.r][bomb.c] = tile(bomb.type, "bomb");
        }
      }

      const fallAnims = {};
      for (let c = 0; c < SIZE; c++) {
        let write = SIZE - 1;
        for (let r = SIZE - 1; r >= 0; r--) {
          if (grid[r][c] != null) {
            if (write !== r) {
              grid[write][c] = grid[r][c];
              grid[r][c] = null;
              fallAnims[cellKey(write, c)] = { kind: "falling", dist: write - r };
            }
            write--;
          }
        }
      }

      for (let c = 0; c < SIZE; c++) {
        for (let r = 0; r < SIZE; r++) {
          if (grid[r][c] == null) {
            grid[r][c] = tile(randType());
            fallAnims[cellKey(r, c)] = "spawning";
          }
        }
      }

      renderAll(fallAnims);
      await sleep(FALL_MS + 40);

      combo += 1;
      focus = null;
      matched = findMatchGroups().matched;
    }

    combo = 1;
    updateHud();
    renderAll();
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function swapInPlace(r1, c1, r2, c2) {
    const t = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = t;
  }

  function hasAnyMove() {
    return Boolean(findHintMove());
  }

  function findHintMove() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (c + 1 < SIZE) {
          swapInPlace(r, c, r, c + 1);
          const ok = findMatchGroups().matched.size > 0;
          swapInPlace(r, c, r, c + 1);
          if (ok) return { a: { r, c }, b: { r, c: c + 1 } };
        }
        if (r + 1 < SIZE) {
          swapInPlace(r, c, r + 1, c);
          const ok = findMatchGroups().matched.size > 0;
          swapInPlace(r, c, r + 1, c);
          if (ok) return { a: { r, c }, b: { r: r + 1, c } };
        }
      }
    }
    return null;
  }

  function showHint(fromButton) {
    clearHints();
    const move = findHintMove();
    if (!move) {
      if (fromButton) showToast("暂无提示，正在重排");
      reshuffleUntilPlayable();
      renderAll();
      return;
    }
    cells[move.a.r][move.a.c].classList.add("hint");
    cells[move.b.r][move.b.c].classList.add("hint");
    if (fromButton) beep(660, 0.05, 0.03);
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
    } while ((findMatchGroups().matched.size > 0 || !hasAnyMove()) && guard < 50);

    if (findMatchGroups().matched.size > 0 || !hasAnyMove()) {
      grid = createFilledGrid();
    }
    showToast("棋盘已重排");
    beep(520, 0.08, 0.03);
  }

  async function trySwap(a, b) {
    if (busy || gameOver) return;
    if (!isAdjacent(a, b)) {
      selected = b;
      clearHints();
      renderAll();
      resetHintTimer();
      return;
    }

    busy = true;
    clearTimeout(hintTimer);
    clearHints();
    selected = null;
    ensureAudio();

    await animateSwap(a, b);
    swapInPlace(a.r, a.c, b.r, b.c);
    renderAll();

    let matched = findMatchGroups().matched;
    if (matched.size === 0) {
      await shakeCells(a, b);
      await animateSwap(a, b);
      swapInPlace(a.r, a.c, b.r, b.c);
      renderAll();
      busy = false;
      resetHintTimer();
      return;
    }

    if (mode === "moves") {
      movesLeft = Math.max(0, movesLeft - 1);
      updateHud();
      pulse(limitValueEl);
    }

    await clearAndCascade(matched, b);

    if (mode === "moves" && movesLeft <= 0) {
      endGame();
    } else if (!hasAnyMove()) {
      reshuffleUntilPlayable();
      renderAll();
    }

    busy = false;
    resetHintTimer();
  }

  function onCellTap(r, c) {
    if (busy || gameOver) return;
    ensureAudio();
    clearHints();
    if (!selected) {
      selected = { r, c };
      renderAll();
      beep(700, 0.03, 0.02);
      resetHintTimer();
      return;
    }
    if (selected.r === r && selected.c === c) {
      selected = null;
      renderAll();
      resetHintTimer();
      return;
    }
    trySwap(selected, { r, c });
  }

  function endGame() {
    gameOver = true;
    busy = false;
    stopTimer();
    clearTimeout(hintTimer);
    clearHints();
    finalScoreEl.textContent = String(score);
    if (mode === "timed" && timeLeft <= 0) {
      overlayKickerEl.textContent = "时间到";
      overlayTitleEl.textContent = score >= 1000 ? "星光闪耀！" : score >= 500 ? "不错哦" : "再试一次";
    } else if (mode === "moves" && movesLeft <= 0) {
      overlayKickerEl.textContent = "步数用尽";
      overlayTitleEl.textContent = score >= 1500 ? "完美消除！" : score >= 800 ? "漂亮！" : "本局结束";
    } else {
      overlayKickerEl.textContent = "本局结束";
      overlayTitleEl.textContent = "漂亮！";
    }
    overlayEl.classList.remove("hidden");
    beep(320, 0.12, 0.04, "triangle");
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
      if (gameOver) return;
      timeLeft -= 1;
      updateHud();
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHud();
        endGame();
      }
    }, 1000);
  }

  function startGame() {
    stopTimer();
    clearTimeout(hintTimer);
    clearTimeout(toastTimer);
    toastEl.classList.add("hidden");
    fxLayer.innerHTML = "";
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
    buildBoardDom();
    updateHud();
    renderAll();
    startTimer();
    resetHintTimer();
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
  hintBtn.addEventListener("click", () => {
    if (busy || gameOver) return;
    showHint(true);
    resetHintTimer();
  });

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
      try {
        boardEl.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    },
    { passive: true }
  );

  boardEl.addEventListener(
    "pointermove",
    (e) => {
      if (!pointerStart || pointerStart.id !== e.pointerId) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) pointerStart.moved = true;
    },
    { passive: true }
  );

  function endPointer(e) {
    if (!pointerStart || pointerStart.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 16;
    const start = pointerStart;
    pointerStart = null;
    try {
      boardEl.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }

    if (absX > threshold || absY > threshold) {
      let tr = start.r;
      let tc = start.c;
      if (absX > absY) tc += dx > 0 ? 1 : -1;
      else tr += dy > 0 ? 1 : -1;
      if (tr >= 0 && tr < SIZE && tc >= 0 && tc < SIZE) {
        e.preventDefault();
        selected = null;
        trySwap(start, { r: tr, c: tc });
      }
      return;
    }

    if (!start.moved) onCellTap(start.r, start.c);
  }

  boardEl.addEventListener("pointerup", endPointer);
  boardEl.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  startGame();
})();
