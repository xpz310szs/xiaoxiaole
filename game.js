(() => {
  const SIZE = 8;
  const TYPES = ["ruby", "amber", "jade", "azure", "violet"];
  const SWAP_MS = 160;
  const POP_MS = 200;
  const FALL_MS = 240;
  const HINT_IDLE_MS = 5000;
  const BEST_KEY = "match-jewel-best";

  const boardEl = document.getElementById("board");
  const fxLayer = document.getElementById("fx-layer");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const comboEl = document.getElementById("combo");
  const restartBtn = document.getElementById("restart");
  const hintBtn = document.getElementById("hint");
  const shuffleBtn = document.getElementById("shuffle");
  const toastEl = document.getElementById("toast");

  /** @type {{type:string,special:null|'bomb'}[][]} */
  let grid = [];
  /** @type {HTMLButtonElement[][]} */
  let cells = [];
  let selected = null;
  let busy = false;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let combo = 1;
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
    if (busy) return;
    hintTimer = setTimeout(() => {
      if (!busy) showHint(false);
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
    bestEl.textContent = String(best);
    comboEl.textContent = `×${combo}`;
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {
        /* ignore */
      }
    }
  }

  function pulse(el) {
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
  }

  function cellCenter(r, c) {
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = cells[r][c].getBoundingClientRect();
    return {
      x: cellRect.left - boardRect.left + cellRect.width / 2,
      y: cellRect.top - boardRect.top + cellRect.height / 2,
    };
  }

  function floatScoreAt(keys, points, isCombo) {
    if (!keys.length) return;
    const mid = parseKey(keys[(keys.length / 2) | 0]);
    const pos = cellCenter(mid.r, mid.c);
    const el = document.createElement("div");
    el.className = `float-score${isCombo ? " combo" : ""}`;
    el.textContent = isCombo ? `连击 +${points}` : `+${points}`;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 720);
  }

  function burstAt(keys) {
    const colors = ["#ff5a4e", "#ffb400", "#3fd46a", "#2f9dff", "#ff7a2f", "#fff"];
    for (const key of keys.slice(0, 8)) {
      const { r, c } = parseKey(key);
      const pos = cellCenter(r, c);
      for (let i = 0; i < 5; i++) {
        const p = document.createElement("span");
        p.className = "burst";
        const ang = (Math.PI * 2 * i) / 5 + Math.random() * 0.4;
        const dist = 18 + Math.random() * 22;
        p.style.left = `${pos.x}px`;
        p.style.top = `${pos.y}px`;
        p.style.setProperty("--bx", `${Math.cos(ang) * dist}px`);
        p.style.setProperty("--by", `${Math.sin(ang) * dist}px`);
        p.style.background = colors[(Math.random() * colors.length) | 0];
        fxLayer.appendChild(p);
        setTimeout(() => p.remove(), 480);
      }
    }
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
            groups.push({ keys, len: run });
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
            groups.push({ keys, len: run });
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
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) extra.add(cellKey(nr, nc));
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
    await sleep(300);
    cells[a.r][a.c].classList.remove("shake");
    cells[b.r][b.c].classList.remove("shake");
  }

  function pickBombSpot(group, focus) {
    if (focus) {
      const focusKey = cellKey(focus.r, focus.c);
      if (group.keys.includes(focusKey)) return focus;
    }
    return parseKey(group.keys[(group.keys.length / 2) | 0]);
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
          const first = parseKey(group.keys[0]);
          const color = grid[spot.r][spot.c]?.type || grid[first.r][first.c]?.type;
          if (color) bombsToSpawn.push({ ...spot, type: color });
        }
      }

      const points = matched.size * 10 * combo + bombsToSpawn.length * 25 * combo;
      score += points;
      updateHud();
      pulse(scoreEl);
      if (combo > 1) pulse(comboEl);
      floatScoreAt([...matched], points, combo > 1);
      burstAt([...matched]);
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
      await sleep(FALL_MS + 30);

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

  function clearDragVisual() {
    boardEl.querySelectorAll(".gem.dragging").forEach((g) => {
      g.classList.remove("dragging");
      g.style.transform = "";
    });
  }

  async function trySwap(a, b) {
    if (busy) return;
    clearDragVisual();
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

    const matched = findMatchGroups().matched;
    if (matched.size === 0) {
      await shakeCells(a, b);
      await animateSwap(a, b);
      swapInPlace(a.r, a.c, b.r, b.c);
      renderAll();
      busy = false;
      resetHintTimer();
      return;
    }

    await clearAndCascade(matched, b);

    if (!hasAnyMove()) {
      reshuffleUntilPlayable();
      renderAll();
    }

    busy = false;
    resetHintTimer();
  }

  function onCellTap(r, c) {
    if (busy) return;
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

  function startGame() {
    clearTimeout(hintTimer);
    clearTimeout(toastTimer);
    toastEl.classList.add("hidden");
    fxLayer.innerHTML = "";
    busy = false;
    selected = null;
    score = 0;
    combo = 1;
    grid = createFilledGrid();
    if (!hasAnyMove()) reshuffleUntilPlayable();
    buildBoardDom();
    updateHud();
    renderAll();
    resetHintTimer();
  }

  restartBtn.addEventListener("click", () => {
    startGame();
    showToast("新的一局");
  });

  shuffleBtn.addEventListener("click", () => {
    if (busy) return;
    clearHints();
    selected = null;
    reshuffleUntilPlayable();
    renderAll();
    resetHintTimer();
  });

  hintBtn.addEventListener("click", () => {
    if (busy) return;
    showHint(true);
    resetHintTimer();
  });

  boardEl.addEventListener(
    "pointerdown",
    (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || busy) return;
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
      if (!pointerStart || pointerStart.id !== e.pointerId || busy) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) pointerStart.moved = true;

      const gem = cells[pointerStart.r][pointerStart.c]?.querySelector(".gem");
      if (!gem) return;
      const max = 28;
      const ox = Math.max(-max, Math.min(max, dx * 0.45));
      const oy = Math.max(-max, Math.min(max, dy * 0.45));
      gem.classList.add("dragging");
      gem.style.transform = `translate(${ox}px, ${oy}px) scale(1.08)`;
    },
    { passive: true }
  );

  function endPointer(e) {
    if (!pointerStart || pointerStart.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 14;
    const start = pointerStart;
    pointerStart = null;
    clearDragVisual();
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
    clearDragVisual();
    pointerStart = null;
  });

  updateHud();
  startGame();
})();
