(() => {
  const el = {
    canvas: document.getElementById("mouth"),
    level: document.getElementById("level"),
    cleanPct: document.getElementById("clean-pct"),
    barFill: document.getElementById("bar-fill"),
    score: document.getElementById("score"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlaySub: document.getElementById("overlay-sub"),
    start: document.getElementById("start"),
    mute: document.getElementById("mute"),
    hint: document.getElementById("hint"),
    toast: document.getElementById("toast"),
    tools: [...document.querySelectorAll(".tool")],
  };

  const ctx = el.canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const TOOLS = {
    brush: { name: "牙刷", power: 1, foam: 1.1 },
    paste: { name: "牙膏", power: 1.55, foam: 1.6 },
    floss: { name: "牙线", power: 2.1, foam: 0.55 },
  };

  let W = 0;
  let H = 0;
  let playing = false;
  let level = 1;
  let score = 0;
  let tool = "brush";
  let muted = false;
  let audioCtx = null;
  let teeth = [];
  let plaques = [];
  let bubbles = [];
  let sparks = [];
  let pointer = { x: 0, y: 0, down: false, active: false };
  let brushAngle = -0.55;
  let brushBob = 0;
  let lastScrubAt = 0;
  let toastTimer = 0;
  let mouthSmile = 0;
  let levelDone = false;
  let raf = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx?.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur = 0.08, type = "sine", vol = 0.05) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function showToast(text) {
    el.toast.textContent = text;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1100);
  }

  function resize() {
    const rect = el.canvas.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    el.canvas.width = Math.floor(W * dpr);
    el.canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layoutTeeth() {
    const count = 8;
    const marginX = W * 0.08;
    const toothW = (W - marginX * 2) / count;
    const compact = H < 360;
    const upperY = H * (compact ? 0.22 : 0.28);
    const lowerY = H * (compact ? 0.52 : 0.58);
    const toothH = Math.min(H * (compact ? 0.2 : 0.22), compact ? 56 : 78);
    teeth = [];

    for (let i = 0; i < count; i += 1) {
      const x = marginX + toothW * i + toothW * 0.08;
      const w = toothW * 0.84;
      teeth.push({
        id: `u${i}`,
        row: "upper",
        x,
        y: upperY,
        w,
        h: toothH,
        clean: 0,
      });
      teeth.push({
        id: `l${i}`,
        row: "lower",
        x,
        y: lowerY,
        w,
        h: toothH,
        clean: 0,
      });
    }
  }

  function spawnPlaques() {
    plaques = [];
    const density = Math.min(0.35 + level * 0.08, 0.85);
    const tartarChance = Math.min(0.12 + level * 0.06, 0.45);

    teeth.forEach((tooth) => {
      const n = 1 + Math.floor(Math.random() * (1 + Math.min(2, Math.floor(level / 2))));
      for (let i = 0; i < n; i += 1) {
        if (Math.random() > density && i > 0) continue;
        const isTartar = Math.random() < tartarChance;
        const pw = tooth.w * (0.28 + Math.random() * 0.28);
        const ph = tooth.h * (0.22 + Math.random() * 0.28);
        const px = tooth.x + tooth.w * (0.12 + Math.random() * 0.5);
        const py = tooth.y + tooth.h * (0.15 + Math.random() * 0.45);
        plaques.push({
          toothId: tooth.id,
          x: px,
          y: py,
          w: pw,
          h: ph,
          kind: isTartar ? "tartar" : "plaque",
          hp: isTartar ? 42 + level * 8 : 22 + level * 5,
          max: isTartar ? 42 + level * 8 : 22 + level * 5,
          rot: (Math.random() - 0.5) * 0.7,
        });
      }
    });

    if (plaques.length < 6) {
      const extras = teeth.slice(0, 6 - plaques.length);
      extras.forEach((tooth) => {
        plaques.push({
          toothId: tooth.id,
          x: tooth.x + tooth.w * 0.25,
          y: tooth.y + tooth.h * 0.3,
          w: tooth.w * 0.4,
          h: tooth.h * 0.3,
          kind: "plaque",
          hp: 24 + level * 4,
          max: 24 + level * 4,
          rot: 0.1,
        });
      });
    }
  }

  function cleanProgress() {
    if (levelDone) return 1;
    if (!playing || !plaques.length) return 0;
    let left = 0;
    let total = 0;
    plaques.forEach((p) => {
      left += Math.max(0, p.hp);
      total += p.max;
    });
    if (total <= 0) return 1;
    return 1 - left / total;
  }

  function updateHud() {
    const pct = Math.round(cleanProgress() * 100);
    el.level.textContent = String(level);
    el.cleanPct.textContent = `${pct}%`;
    el.barFill.style.width = `${pct}%`;
    el.score.textContent = String(score);
    mouthSmile = pct / 100;
  }

  function pointerPos(e) {
    const rect = el.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function hitPlaque(x, y) {
    const radius = tool === "floss" ? 14 : tool === "paste" ? 22 : 18;
    for (let i = plaques.length - 1; i >= 0; i -= 1) {
      const p = plaques[i];
      if (p.hp <= 0) continue;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= (radius + Math.max(p.w, p.h) * 0.35) ** 2) {
        return p;
      }
    }
    return null;
  }

  function scrubAt(x, y, dt) {
    const p = hitPlaque(x, y);
    const t = TOOLS[tool];
    if (!p) {
      if (Math.random() < 0.08) spawnBubble(x, y, 0.5);
      return;
    }

    const power = t.power * (16 + dt * 60);
    const before = p.hp;
    p.hp = Math.max(0, p.hp - power);
    const removed = before - p.hp;
    if (removed <= 0) return;

    score += Math.ceil(removed * (p.kind === "tartar" ? 1.4 : 1));
    spawnBubble(x, y, t.foam);
    if (performance.now() - lastScrubAt > 70) {
      lastScrubAt = performance.now();
      const base = p.kind === "tartar" ? 220 : 360;
      tone(base + Math.random() * 120, 0.05, "triangle", 0.035);
    }

    if (p.hp <= 0) {
      score += p.kind === "tartar" ? 40 : 20;
      spawnSparks(p.x + p.w / 2, p.y + p.h / 2);
      tone(620, 0.09, "sine", 0.05);
      showToast(p.kind === "tartar" ? "牙结石清掉啦！" : "牙菌斑刷掉！");
    }

    updateHud();
    if (cleanProgress() >= 0.999) winLevel();
  }

  function spawnBubble(x, y, amount) {
    const n = Math.floor(2 + amount * 3);
    for (let i = 0; i < n; i += 1) {
      bubbles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 12,
        r: 3 + Math.random() * 7 * amount,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -0.4 - Math.random() * 1.1,
        life: 1,
      });
    }
  }

  function spawnSparks(x, y) {
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI * 2 * i) / 10;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * (1.2 + Math.random()),
        vy: Math.sin(a) * (1.2 + Math.random()),
        life: 1,
      });
    }
  }

  function winLevel() {
    playing = false;
    levelDone = true;
    score += 100 + level * 30;
    updateHud();
    tone(523, 0.1, "sine", 0.06);
    setTimeout(() => tone(659, 0.12, "sine", 0.06), 90);
    setTimeout(() => tone(784, 0.16, "sine", 0.07), 180);
    el.overlayTitle.textContent = `第 ${level} 关完成！`;
    el.overlaySub.textContent = "牙齿闪闪发光～准备下一关更顽强的牙菌斑";
    el.start.textContent = "下一关";
    el.start.dataset.mode = "next";
    el.overlay.classList.remove("hidden");
    el.hint.textContent = "太棒了！继续保持洁白";
  }

  function beginLevel(resetScore) {
    if (resetScore) {
      level = 1;
      score = 0;
    }
    playing = true;
    levelDone = false;
    bubbles = [];
    sparks = [];
    layoutTeeth();
    spawnPlaques();
    updateHud();
    el.overlay.classList.add("hidden");
    el.hint.textContent =
      tool === "floss"
        ? "用牙线抠掉缝里的牙结石"
        : tool === "paste"
          ? "挤上牙膏大力刷"
          : "按住拖动牙刷清理牙菌斑";
    tone(480, 0.07, "triangle", 0.05);
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawMouthBg() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#ffe4d6");
    g.addColorStop(0.45, "#ffb5a4");
    g.addColorStop(1, "#f28880");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // gums upper
    ctx.fillStyle = "#ff8f9a";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.18);
    ctx.quadraticCurveTo(W * 0.5, H * 0.08 + mouthSmile * 8, W, H * 0.18);
    ctx.lineTo(W, H * 0.34);
    ctx.quadraticCurveTo(W * 0.5, H * 0.28, 0, H * 0.34);
    ctx.closePath();
    ctx.fill();

    // gums lower
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    ctx.quadraticCurveTo(W * 0.5, H * 0.78 - mouthSmile * 10, W, H * 0.72);
    ctx.lineTo(W, H * 0.9);
    ctx.quadraticCurveTo(W * 0.5, H * 0.98, 0, H * 0.9);
    ctx.closePath();
    ctx.fill();

    // tongue
    ctx.fillStyle = "#ff6f86";
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.52 + mouthSmile * 6, W * 0.28, H * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTooth(tooth) {
    const dirty = plaques.some((p) => p.toothId === tooth.id && p.hp > 0);
    const shine = !dirty;

    ctx.save();
    roundRect(tooth.x, tooth.y, tooth.w, tooth.h, Math.min(12, tooth.w * 0.28));
    const tg = ctx.createLinearGradient(tooth.x, tooth.y, tooth.x, tooth.y + tooth.h);
    if (shine) {
      tg.addColorStop(0, "#ffffff");
      tg.addColorStop(0.55, "#f4fffb");
      tg.addColorStop(1, "#d7f7ef");
    } else {
      tg.addColorStop(0, "#fffaf0");
      tg.addColorStop(0.55, "#f5ecd8");
      tg.addColorStop(1, "#e8d9b8");
    }
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (shine) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      roundRect(tooth.x + tooth.w * 0.18, tooth.y + tooth.h * 0.14, tooth.w * 0.28, tooth.h * 0.18, 6);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlaque(p) {
    if (p.hp <= 0) return;
    const alpha = 0.35 + 0.65 * (p.hp / p.max);
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(p.rot);
    ctx.globalAlpha = alpha;
    if (p.kind === "tartar") {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(p.w, p.h) * 0.6);
      g.addColorStop(0, "#c9a06a");
      g.addColorStop(1, "#8a5a2e");
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(p.w, p.h) * 0.65);
      g.addColorStop(0, "#ffe56a");
      g.addColorStop(1, "#d4a83a");
      ctx.fillStyle = g;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, p.w * 0.55, p.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBrush() {
    if (!pointer.active && !pointer.down) return;
    const x = pointer.x;
    const y = pointer.y;
    brushBob += 0.35;
    const bob = Math.sin(brushBob) * (pointer.down ? 2.5 : 1);

    ctx.save();
    ctx.translate(x, y + bob);

    if (tool === "floss") {
      ctx.rotate(-0.2);
      ctx.strokeStyle = "#5a6a78";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-14, 18);
      ctx.lineTo(-10, -8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, 18);
      ctx.lineTo(10, -8);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.quadraticCurveTo(0, -28 + (pointer.down ? Math.sin(brushBob) * 3 : 0), 10, -8);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.rotate(brushAngle);

    // handle
    ctx.fillStyle = tool === "paste" ? "#7ee0c8" : "#5ad6b8";
    roundRect(-8, 8, 16, 54, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    roundRect(-5, 14, 10, 12, 4);
    ctx.fill();

    // head
    ctx.fillStyle = "#e8fbff";
    roundRect(-16, -18, 32, 28, 10);
    ctx.fill();
    ctx.strokeStyle = "#b8e8f0";
    ctx.lineWidth = 2;
    ctx.stroke();

    // bristles
    ctx.strokeStyle = tool === "paste" ? "#2eb89a" : "#7ec8ff";
    ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, -16);
      ctx.lineTo(i + (pointer.down ? Math.sin(brushBob + i) * 2 : 0), -28);
      ctx.stroke();
    }

    if (tool === "paste") {
      ctx.fillStyle = "rgba(126, 224, 200, 0.7)";
      ctx.beginPath();
      ctx.ellipse(0, -22, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawFx(dt) {
    bubbles = bubbles.filter((b) => b.life > 0);
    bubbles.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;
      b.life -= dt * 0.9;
      ctx.globalAlpha = Math.max(0, b.life) * 0.7;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(126, 224, 200, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    sparks = sparks.filter((s) => s.life > 0);
    sparks.forEach((s) => {
      s.x += s.vx;
      s.y += s.vy;
      s.life -= dt * 1.4;
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = "#ffe56a";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (!W || !H) resize();

    drawMouthBg();
    teeth.forEach(drawTooth);
    plaques.forEach(drawPlaque);
    drawFx(dt);

    if (pointer.down && playing) {
      scrubAt(pointer.x, pointer.y, dt);
    }
    drawBrush();

    raf = requestAnimationFrame(frame);
  }

  function onDown(e) {
    if (!playing) return;
    e.preventDefault();
    ensureAudio();
    const p = pointerPos(e);
    pointer = { ...p, down: true, active: true };
    el.canvas.setPointerCapture?.(e.pointerId);
    scrubAt(p.x, p.y, 0.016);
  }

  function onMove(e) {
    const p = pointerPos(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.active = true;
    if (!pointer.down || !playing) return;
    e.preventDefault();
  }

  function onUp() {
    pointer.down = false;
  }

  el.canvas.addEventListener("pointerdown", onDown);
  el.canvas.addEventListener("pointermove", onMove);
  el.canvas.addEventListener("pointerup", onUp);
  el.canvas.addEventListener("pointercancel", onUp);
  el.canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  el.tools.forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureAudio();
      tool = btn.dataset.tool;
      el.tools.forEach((b) => b.classList.toggle("active", b === btn));
      tone(520, 0.05, "sine", 0.04);
      if (playing) {
        el.hint.textContent =
          tool === "floss"
            ? "用牙线抠掉缝里的牙结石"
            : tool === "paste"
              ? "挤上牙膏大力刷"
              : "按住拖动牙刷清理牙菌斑";
      }
    });
  });

  el.mute.addEventListener("click", () => {
    muted = !muted;
    el.mute.classList.toggle("muted", muted);
    el.mute.setAttribute("aria-label", muted ? "取消静音" : "声音");
  });

  el.start.addEventListener("click", () => {
    ensureAudio();
    if (el.start.dataset.mode === "next") {
      level += 1;
      el.start.dataset.mode = "";
      beginLevel(false);
      return;
    }
    beginLevel(true);
  });

  window.addEventListener("resize", () => {
    const prevW = W || 1;
    const prevH = H || 1;
    resize();
    if (!teeth.length) return;
    const sx = W / prevW;
    const sy = H / prevH;
    layoutTeeth();
    plaques.forEach((p) => {
      p.x *= sx;
      p.y *= sy;
      p.w *= sx;
      p.h *= sy;
    });
    updateHud();
  });

  resize();
  layoutTeeth();
  updateHud();
  raf = requestAnimationFrame(frame);
})();
