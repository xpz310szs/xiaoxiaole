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

  const RESIDUE_RATIO = 0.24;

  let W = 0;
  let H = 0;
  let playing = false;
  let level = 1;
  let score = 0;
  let tool = "brush";
  let pasteLoad = 0;
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
  let lastHintAt = 0;
  let toastTimer = 0;
  let mouthSmile = 0;
  let levelDone = false;
  let raf = 0;

  function setTool(next) {
    tool = next;
    el.tools.forEach((b) => {
      const id = b.dataset.tool;
      b.classList.toggle("active", id === tool);
    });
    refreshPasteBadge();
    updateHint();
  }

  function refreshPasteBadge() {
    const brushBtn = el.tools.find((b) => b.dataset.tool === "brush");
    if (!brushBtn) return;
    brushBtn.classList.toggle("has-paste", pasteLoad > 0.05);
    brushBtn.dataset.paste = pasteLoad > 0.05 ? "已挤牙膏" : "";
  }

  function updateHint() {
    if (!playing) return;
    if (tool === "floss") {
      el.hint.textContent = "牙线只清牙缝残渣，大块先刷掉";
    } else if (pasteLoad > 0.05) {
      el.hint.textContent = "牙刷已有牙膏，按住拖动刷大块牙菌斑";
    } else {
      el.hint.textContent = "先点「牙膏」挤到牙刷上，再刷牙";
    }
  }

  function softHint(text) {
    if (performance.now() - lastHintAt < 900) return;
    lastHintAt = performance.now();
    showToast(text);
  }

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

  function makePlaque(tooth, opts) {
    const fx = opts.fx;
    const fy = opts.fy;
    const fw = opts.fw;
    const fh = opts.fh;
    return {
      toothId: tooth.id,
      fx,
      fy,
      fw,
      fh,
      x: tooth.x + tooth.w * fx,
      y: tooth.y + tooth.h * fy,
      w: tooth.w * fw,
      h: tooth.h * fh,
      kind: opts.kind,
      hp: opts.hp,
      max: opts.max,
      rot: opts.rot,
    };
  }

  function syncPlaquesToTeeth() {
    const byId = Object.create(null);
    teeth.forEach((t) => {
      byId[t.id] = t;
    });
    plaques.forEach((p) => {
      const tooth = byId[p.toothId];
      if (!tooth) return;
      p.x = tooth.x + tooth.w * p.fx;
      p.y = tooth.y + tooth.h * p.fy;
      p.w = tooth.w * p.fw;
      p.h = tooth.h * p.fh;
    });
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
        const hp = isTartar ? 42 + level * 8 : 22 + level * 5;
        plaques.push(
          makePlaque(tooth, {
            fx: 0.12 + Math.random() * 0.5,
            fy: 0.15 + Math.random() * 0.45,
            fw: 0.28 + Math.random() * 0.28,
            fh: 0.22 + Math.random() * 0.28,
            kind: isTartar ? "tartar" : "plaque",
            hp,
            max: hp,
            rot: (Math.random() - 0.5) * 0.7,
          })
        );
      }
    });

    if (plaques.length < 6) {
      const extras = teeth.slice(0, 6 - plaques.length);
      extras.forEach((tooth) => {
        const hp = 24 + level * 4;
        plaques.push(
          makePlaque(tooth, {
            fx: 0.25,
            fy: 0.3,
            fw: 0.4,
            fh: 0.3,
            kind: "plaque",
            hp,
            max: hp,
            rot: 0.1,
          })
        );
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

  function isResidue(p) {
    return p.kind === "residue" || p.hp / p.max <= RESIDUE_RATIO + 0.001;
  }

  function hitPlaque(x, y, preferResidue) {
    const radius = tool === "floss" ? 13 : 19;
    let best = null;
    let bestDist = Infinity;
    for (let i = plaques.length - 1; i >= 0; i -= 1) {
      const p = plaques[i];
      if (p.hp <= 0) continue;
      if (preferResidue && !isResidue(p)) continue;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = dx * dx + dy * dy;
      const reach = (radius + Math.max(p.w, p.h) * 0.35) ** 2;
      if (dist <= reach && dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  }

  function toResidue(p) {
    if (p.kind === "residue") return;
    // Keep original max so brush progress is not undone when leftover becomes residue.
    p.kind = "residue";
    p.hp = Math.max(6, p.max * RESIDUE_RATIO);
    p.fw *= 0.55;
    p.fh *= 0.55;
    p.fx += (1 - 0.55) * 0.2;
    p.fy += (1 - 0.55) * 0.15;
    syncPlaquesToTeeth();
    softHint("残渣留给牙线清理～");
  }

  function scrubAt(x, y, dt) {
    if (tool === "floss") {
      scrubFloss(x, y, dt);
      return;
    }
    scrubBrush(x, y, dt);
  }

  function scrubBrush(x, y, dt) {
    const p = hitPlaque(x, y, false);
    if (!p) {
      if (Math.random() < 0.06) spawnBubble(x, y, 0.35);
      return;
    }

    if (isResidue(p)) {
      softHint("残渣用牙线清，更干净");
      if (Math.random() < 0.05) spawnBubble(x, y, 0.3);
      return;
    }

    if (pasteLoad <= 0.02) {
      softHint("先点「牙膏」挤到牙刷上");
      // bare brush only weakly scuffs thick plaque
      const weak = 3 + dt * 10;
      p.hp = Math.max(p.max * (RESIDUE_RATIO + 0.15), p.hp - weak);
      updateHud();
      return;
    }

    const power = 22 + dt * 90;
    const before = p.hp;
    const floor = p.max * RESIDUE_RATIO;
    p.hp = Math.max(floor, p.hp - power);
    pasteLoad = Math.max(0, pasteLoad - 0.012 - dt * 0.08);
    refreshPasteBadge();
    if (pasteLoad <= 0.02) updateHint();

    const removed = before - p.hp;
    if (removed <= 0) return;

    score += Math.ceil(removed * (p.kind === "tartar" ? 1.3 : 1));
    spawnBubble(x, y, 1.4);
    if (performance.now() - lastScrubAt > 70) {
      lastScrubAt = performance.now();
      tone(340 + Math.random() * 140, 0.05, "triangle", 0.035);
    }

    if (p.hp <= floor + 0.5) {
      const wasTartar = p.kind === "tartar";
      toResidue(p);
      score += wasTartar ? 18 : 12;
      tone(520, 0.07, "sine", 0.045);
    }

    updateHud();
    if (cleanProgress() >= 0.999) winLevel();
  }

  function scrubFloss(x, y, dt) {
    const residue = hitPlaque(x, y, true);
    if (!residue) {
      const thick = hitPlaque(x, y, false);
      if (thick) softHint("大块牙菌斑要先用牙膏牙刷刷");
      return;
    }

    const power = 28 + dt * 110;
    const before = residue.hp;
    residue.hp = Math.max(0, residue.hp - power);
    const removed = before - residue.hp;
    if (removed <= 0) return;

    score += Math.ceil(removed * 1.6);
    spawnBubble(x, y, 0.45);
    if (performance.now() - lastScrubAt > 80) {
      lastScrubAt = performance.now();
      tone(480 + Math.random() * 100, 0.04, "sine", 0.03);
    }

    if (residue.hp <= 0) {
      score += 30;
      spawnSparks(residue.x + residue.w / 2, residue.y + residue.h / 2);
      tone(700, 0.09, "sine", 0.05);
      showToast("残渣清干净啦！");
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
    pasteLoad = 0;
    bubbles = [];
    sparks = [];
    layoutTeeth();
    spawnPlaques();
    setTool("brush");
    updateHud();
    el.overlay.classList.add("hidden");
    updateHint();
    tone(480, 0.07, "triangle", 0.05);
  }

  function squeezePaste() {
    ensureAudio();
    pasteLoad = 1;
    setTool("brush");
    refreshPasteBadge();
    tone(660, 0.06, "sine", 0.05);
    setTimeout(() => tone(740, 0.07, "triangle", 0.04), 70);
    showToast("牙膏挤到牙刷上啦！");
    updateHint();
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
    if (p.kind === "residue") {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, Math.max(p.w, p.h) * 0.55);
      g.addColorStop(0, "#efe0b8");
      g.addColorStop(1, "#c8a878");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.w * 0.42, p.h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "tartar") {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(p.w, p.h) * 0.6);
      g.addColorStop(0, "#c9a06a");
      g.addColorStop(1, "#8a5a2e");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.w * 0.55, p.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(p.w, p.h) * 0.65);
      g.addColorStop(0, "#ffe56a");
      g.addColorStop(1, "#d4a83a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.w * 0.55, p.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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
    ctx.fillStyle = pasteLoad > 0.05 ? "#7ee0c8" : "#5ad6b8";
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
    ctx.strokeStyle = pasteLoad > 0.05 ? "#2eb89a" : "#7ec8ff";
    ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, -16);
      ctx.lineTo(i + (pointer.down ? Math.sin(brushBob + i) * 2 : 0), -28);
      ctx.stroke();
    }

    if (pasteLoad > 0.05) {
      const blob = 6 + pasteLoad * 7;
      ctx.fillStyle = `rgba(126, 224, 200, ${0.45 + pasteLoad * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(0, -22, blob, blob * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(-3, -24, blob * 0.28, blob * 0.18, -0.4, 0, Math.PI * 2);
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
      const next = btn.dataset.tool;
      if (next === "paste") {
        if (!playing) {
          softHint("先点开始刷牙");
          return;
        }
        squeezePaste();
        return;
      }
      setTool(next);
      tone(520, 0.05, "sine", 0.04);
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
    resize();
    if (!teeth.length) return;
    layoutTeeth();
    syncPlaquesToTeeth();
    updateHud();
  });

  resize();
  layoutTeeth();
  updateHud();
  raf = requestAnimationFrame(frame);
})();
