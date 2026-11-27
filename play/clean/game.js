(() => {
  const desk = document.getElementById("desk");
  const hint = document.getElementById("hint");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const startBtn = document.getElementById("start");
  const muteBtn = document.getElementById("mute");
  const levelEl = document.getElementById("level");
  const leftEl = document.getElementById("left");
  const scoreEl = document.getElementById("score");
  const barFill = document.getElementById("bar-fill");
  const bins = [...document.querySelectorAll(".bin")];

  const CATALOG = [
    { id: "peel", name: "果皮", emoji: "🍌", bin: "trash" },
    { id: "crumb", name: "纸团", emoji: "🧻", bin: "trash" },
    { id: "cup", name: "空杯", emoji: "🥤", bin: "trash" },
    { id: "wrap", name: "包装", emoji: "🍬", bin: "trash" },
    { id: "leaf", name: "枯叶", emoji: "🍂", bin: "trash" },
    { id: "doc", name: "文件", emoji: "📄", bin: "files" },
    { id: "note", name: "便签", emoji: "📝", bin: "files" },
    { id: "book", name: "本子", emoji: "📓", bin: "files" },
    { id: "mail", name: "信件", emoji: "✉️", bin: "files" },
    { id: "clip", name: "夹子", emoji: "📎", bin: "files" },
    { id: "mug", name: "马克杯", emoji: "☕", bin: "keep" },
    { id: "plant", name: "小盆栽", emoji: "🪴", bin: "keep" },
    { id: "pen", name: "钢笔", emoji: "🖊️", bin: "keep" },
    { id: "keys", name: "钥匙", emoji: "🔑", bin: "keep" },
    { id: "watch", name: "手表", emoji: "⌚", bin: "keep" },
    { id: "phone", name: "手机", emoji: "📱", bin: "keep" },
  ];

  let muted = false;
  let audioCtx = null;
  let playing = false;
  let level = 1;
  let score = 0;
  let total = 0;
  let remaining = 0;
  let best = Number(localStorage.getItem("clean-best") || 0);
  let drag = null;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur = 0.08, type = "sine", vol = 0.07) {
    if (muted) return;
    const a = ensureAudio();
    if (!a) return;
    const t0 = a.currentTime;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function updateHud() {
    levelEl.textContent = String(level);
    leftEl.textContent = String(remaining);
    scoreEl.textContent = String(score);
    const done = total === 0 ? 0 : ((total - remaining) / total) * 100;
    barFill.style.width = `${done}%`;
  }

  function clearDeskItems() {
    desk.querySelectorAll(".clutter").forEach((el) => el.remove());
  }

  function showOverlay(title, sub, btn = "再清一局") {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    startBtn.textContent = btn;
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function spawnLevel() {
    clearDeskItems();
    const count = Math.min(6 + level * 2, 14);
    const pool = shuffle(CATALOG);
    const picks = [];
    for (let i = 0; i < count; i++) picks.push(pool[i % pool.length]);

    const rect = desk.getBoundingClientRect();
    const pad = 8;
    const size = 64;
    picks.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "clutter";
      btn.dataset.bin = item.bin;
      btn.dataset.id = `${item.id}-${i}`;
      btn.setAttribute("aria-label", item.name);
      const emoji = document.createElement("span");
      emoji.className = "emoji";
      emoji.textContent = item.emoji;
      const label = document.createElement("span");
      label.textContent = item.name;
      btn.append(emoji, label);

      const maxX = Math.max(pad, rect.width - size - pad);
      const maxY = Math.max(pad, rect.height - size - 36);
      let x = pad + Math.random() * maxX;
      let y = pad + Math.random() * maxY;
      // slight spiral so early items less stacked identically
      x = Math.min(maxX, Math.max(pad, (x + (i % 5) * 12) % (maxX + 1)));
      y = Math.min(maxY, Math.max(pad, (y + Math.floor(i / 5) * 18) % (maxY + 1)));
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
      desk.append(btn);
    });

    total = picks.length;
    remaining = picks.length;
    hint.textContent = "拖到垃圾桶 / 文件架 / 收纳盒";
    updateHud();
  }

  function binFromPoint(clientX, clientY) {
    const dragging = drag && drag.btn;
    if (dragging) dragging.style.pointerEvents = "none";
    const el = document.elementFromPoint(clientX, clientY);
    if (dragging) dragging.style.pointerEvents = "";
    if (!el) return null;
    const bin = el.closest(".bin");
    return bin ? bin.dataset.bin : null;
  }

  function highlightBin(name) {
    bins.forEach((b) => b.classList.toggle("hot", b.dataset.bin === name));
  }

  function sortItem(btn, targetBin) {
    const need = btn.dataset.bin;
    if (targetBin !== need) {
      btn.classList.remove("shake");
      void btn.offsetWidth;
      btn.classList.add("shake");
      tone(160, 0.1, "sawtooth", 0.05);
      hint.textContent = targetBin
        ? "放错啦，再试试"
        : "拖到下方分类区松手";
      return false;
    }

    remaining -= 1;
    score += 10 + Math.min(10, level * 2);
    btn.classList.add("sorted");
    tone(520, 0.06, "triangle", 0.06);
    tone(740, 0.08, "sine", 0.05);
    hint.textContent = remaining > 0 ? `还剩 ${remaining} 件` : "桌面清爽！";
    updateHud();

    setTimeout(() => btn.remove(), 260);

    if (remaining <= 0) {
      playing = false;
      if (score > best) {
        best = score;
        localStorage.setItem("clean-best", String(best));
      }
      setTimeout(() => {
        showOverlay(
          `第 ${level} 关清理完成！`,
          `得分 ${score} · 最高 ${best}`,
          "下一关"
        );
        startBtn.dataset.mode = "next";
      }, 320);
    }
    return true;
  }

  function onPointerDown(e) {
    if (!playing) return;
    const btn = e.target.closest(".clutter");
    if (!btn || btn.classList.contains("sorted")) return;
    e.preventDefault();
    ensureAudio();
    const deskRect = desk.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    drag = {
      btn,
      ox: e.clientX - br.left,
      oy: e.clientY - br.top,
      startLeft: parseFloat(btn.style.left) || 0,
      startTop: parseFloat(btn.style.top) || 0,
    };
    btn.classList.add("dragging");
    btn.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    const deskRect = desk.getBoundingClientRect();
    let x = e.clientX - deskRect.left - drag.ox;
    let y = e.clientY - deskRect.top - drag.oy;
    const maxX = deskRect.width - 64;
    const maxY = deskRect.height - 64;
    x = Math.max(-20, Math.min(maxX + 20, x));
    y = Math.max(-20, Math.min(maxY + 40, y));
    drag.btn.style.left = `${x}px`;
    drag.btn.style.top = `${y}px`;
    highlightBin(binFromPoint(e.clientX, e.clientY));
  }

  function onPointerUp(e) {
    if (!drag) return;
    const { btn } = drag;
    btn.classList.remove("dragging");
    highlightBin(null);
    const target = binFromPoint(e.clientX, e.clientY);
    const ok = sortItem(btn, target);
    if (!ok) {
      // keep wherever dropped on desk if not on a bin; snap back only if off desk badly
      const deskRect = desk.getBoundingClientRect();
      let x = parseFloat(btn.style.left) || 0;
      let y = parseFloat(btn.style.top) || 0;
      x = Math.max(4, Math.min(deskRect.width - 68, x));
      y = Math.max(4, Math.min(deskRect.height - 68, y));
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
    }
    drag = null;
  }

  desk.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  function beginLevel(resetScore) {
    if (resetScore) {
      level = 1;
      score = 0;
    }
    playing = true;
    hideOverlay();
    spawnLevel();
    tone(480, 0.07, "triangle", 0.05);
  }

  startBtn.addEventListener("click", () => {
    ensureAudio();
    if (startBtn.dataset.mode === "next") {
      level += 1;
      startBtn.dataset.mode = "";
      beginLevel(false);
      return;
    }
    beginLevel(true);
  });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "✕" : "♪";
    muteBtn.setAttribute("aria-label", muted ? "取消静音" : "声音");
  });

  showOverlay("桌面太乱了！", "把垃圾、文件、用品拖到对应区域", "开始清理");
  updateHud();
})();
