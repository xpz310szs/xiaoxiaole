(() => {
  const el = {
    world: document.getElementById("world"),
    book: document.getElementById("book"),
    guide: document.getElementById("guide"),
    subjects: document.getElementById("subjects"),
    palette: document.getElementById("palette"),
    made: document.getElementById("made"),
    mute: document.getElementById("mute"),
    clear: document.getElementById("clear"),
    makeReal: document.getElementById("make-real"),
    undo: document.getElementById("undo"),
    hint: document.getElementById("hint"),
    toast: document.getElementById("toast"),
  };

  const wctx = el.world.getContext("2d");
  const bctx = el.book.getContext("2d", { willReadFrequently: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const COLORS = [
    "#2f2a28",
    "#ff5a4a",
    "#ff8a3d",
    "#ffd23a",
    "#5ad67a",
    "#3db7ff",
    "#ff6b9d",
    "#a67c52",
    "#7ec8ff",
    "#ffffff",
  ];

  const SUBJECTS = [
    { id: "flower", name: "小花", emoji: "🌸", color: "#ff6b9d" },
    { id: "bird", name: "小鸟", emoji: "🐦", color: "#3db7ff" },
    { id: "fish", name: "小鱼", emoji: "🐟", color: "#5ad6c8" },
    { id: "balloon", name: "气球", emoji: "🎈", color: "#ff5a4a" },
    { id: "star", name: "星星", emoji: "⭐", color: "#ffd23a" },
    { id: "cat", name: "小猫", emoji: "🐱", color: "#ffb070" },
    { id: "tree", name: "小树", emoji: "🌳", color: "#5ad67a" },
    { id: "butterfly", name: "蝴蝶", emoji: "🦋", color: "#7ec8ff" },
  ];

  let WW = 0;
  let WH = 0;
  let BW = 0;
  let BH = 0;
  let subject = SUBJECTS[0];
  let penColor = subject.color;
  let drawing = false;
  let last = null;
  let ink = false;
  let muted = false;
  let audioCtx = null;
  let toastTimer = 0;
  let madeCount = 0;
  let entities = [];
  let flying = [];
  let history = [];
  const HISTORY_MAX = 14;
  let animT = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx?.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur = 0.07, type = "sine", vol = 0.045) {
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

  function resizeCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function paintBookPaper() {
    bctx.save();
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, BW, BH);
    bctx.restore();
  }

  function pushHistory() {
    try {
      history.push(bctx.getImageData(0, 0, el.book.width, el.book.height));
      if (history.length > HISTORY_MAX) history.shift();
    } catch (_) {
      /* ignore */
    }
  }

  function hasInk() {
    try {
      const data = bctx.getImageData(0, 0, el.book.width, el.book.height).data;
      for (let i = 3; i < data.length; i += 16) {
        if (data[i] > 20) return true;
      }
    } catch (_) {
      return ink;
    }
    return false;
  }

  function pointerPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function drawStroke(a, b) {
    bctx.save();
    bctx.lineCap = "round";
    bctx.lineJoin = "round";
    bctx.strokeStyle = penColor;
    bctx.lineWidth = 7;
    bctx.beginPath();
    bctx.moveTo(a.x, a.y);
    bctx.lineTo(b.x, b.y);
    bctx.stroke();
    bctx.restore();
    ink = true;
    el.guide.classList.add("hidden");
  }

  function setPenColor(c) {
    penColor = c;
    if (!el.palette) return;
    [...el.palette.children].forEach((n) => {
      n.classList.toggle("active", n.dataset.color === c);
    });
  }

  function buildPalette() {
    if (!el.palette) return;
    el.palette.innerHTML = "";
    COLORS.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch" + (c === penColor ? " active" : "");
      btn.dataset.color = c;
      btn.style.background = c;
      btn.setAttribute("aria-label", `颜色 ${i + 1}`);
      if (c === "#ffffff") {
        btn.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.14), 0 2px 0 rgba(80,40,10,0.18)";
      }
      btn.addEventListener("click", () => {
        ensureAudio();
        setPenColor(c);
        tone(500, 0.04, "sine", 0.03);
        showToast("笔的颜色换好了");
      });
      el.palette.appendChild(btn);
    });
  }

  function buildSubjects() {
    el.subjects.innerHTML = "";
    SUBJECTS.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "subject" + (s.id === subject.id ? " active" : "");
      btn.dataset.id = s.id;
      btn.innerHTML = `<span aria-hidden="true">${s.emoji}</span><span>${s.name}</span>`;
      btn.addEventListener("click", () => {
        ensureAudio();
        subject = s;
        setPenColor(s.color);
        [...el.subjects.children].forEach((n) =>
          n.classList.toggle("active", n.dataset.id === s.id)
        );
        el.guide.textContent = s.emoji;
        if (!hasInk()) el.guide.classList.remove("hidden");
        el.hint.textContent = `画一只${s.name}：画成什么样，上面就长什么样`;
        tone(500, 0.04, "sine", 0.03);
      });
      el.subjects.appendChild(btn);
    });
    el.guide.textContent = subject.emoji;
  }

  function cropDoodle() {
    const w = el.book.width;
    const h = el.book.height;
    let data;
    try {
      data = bctx.getImageData(0, 0, w, h).data;
    } catch (_) {
      const fallback = document.createElement("canvas");
      fallback.width = Math.max(1, Math.floor(BW));
      fallback.height = Math.max(1, Math.floor(BH));
      fallback.getContext("2d").drawImage(el.book, 0, 0, fallback.width, fallback.height);
      return fallback;
    }

    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let found = false;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 18) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return null;

    const pad = Math.round(10 * dpr);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = Math.max(1, maxX - minX + 1);
    const ch = Math.max(1, maxY - minY + 1);

    const cropped = document.createElement("canvas");
    cropped.width = cw;
    cropped.height = ch;
    cropped.getContext("2d").drawImage(el.book, minX, minY, cw, ch, 0, 0, cw, ch);
    return cropped;
  }

  function drawEntitySprite(ctx, ent, x, y, scale, bob) {
    if (!ent.doodle) return;
    const dw = ent.doodle.width;
    const dh = ent.doodle.height;
    const maxSide = 56 * scale;
    const ratio = Math.min(maxSide / dw, maxSide / dh);
    const w = dw * ratio;
    const h = dh * ratio;

    ctx.save();
    ctx.translate(x, y + bob);
    // gentle life motion by subject type, but keep the drawing itself
    if (ent.kind === "bird" || ent.kind === "butterfly") {
      ctx.rotate(Math.sin(animT * 0.08 + ent.phase) * 0.08);
    } else if (ent.kind === "fish") {
      ctx.rotate(Math.sin(animT * 0.06 + ent.phase) * 0.05);
    } else {
      ctx.rotate((ent.tilt || 0) * 0.5);
    }

    // soft ground shadow
    ctx.fillStyle = "rgba(40, 60, 40, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.48, w * 0.38, Math.max(4, h * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();

    // the user's actual drawing — WYSIWYG
    ctx.drawImage(ent.doodle, -w / 2, -h / 2, w, h);

    // sparkle rim so it feels "alive"
    ctx.globalAlpha = 0.55 + Math.sin(animT * 0.12 + ent.phase) * 0.25;
    ctx.fillStyle = "#ffe56a";
    ctx.beginPath();
    ctx.arc(-w * 0.42, -h * 0.4, 2.2, 0, Math.PI * 2);
    ctx.arc(w * 0.4, -h * 0.35, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWorld() {
    wctx.save();
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = wctx.createLinearGradient(0, 0, 0, WH);
    g.addColorStop(0, "#7ec8ff");
    g.addColorStop(0.55, "#b8e4ff");
    g.addColorStop(0.55, "#b8ef9a");
    g.addColorStop(1, "#7ed46a");
    wctx.fillStyle = g;
    wctx.fillRect(0, 0, WW, WH);

    // sun
    wctx.fillStyle = "#ffe56a";
    wctx.beginPath();
    wctx.arc(WW * 0.82, WH * 0.18, 18, 0, Math.PI * 2);
    wctx.fill();

    // clouds
    wctx.fillStyle = "rgba(255,255,255,0.75)";
    [[0.2, 0.2], [0.45, 0.12], [0.65, 0.28]].forEach(([fx, fy], i) => {
      const x = WW * fx + Math.sin(animT * 0.01 + i) * 6;
      const y = WH * fy;
      wctx.beginPath();
      wctx.arc(x, y, 12, 0, Math.PI * 2);
      wctx.arc(x + 14, y - 4, 14, 0, Math.PI * 2);
      wctx.arc(x + 28, y, 11, 0, Math.PI * 2);
      wctx.fill();
    });

    entities.forEach((ent) => {
      const floaty = ent.kind === "balloon" || ent.kind === "bird" || ent.kind === "butterfly" || ent.kind === "star";
      const bob = Math.sin(animT * 0.05 + ent.phase) * (floaty ? 5 : 2);
      if (ent.vx) {
        ent.x += ent.vx;
        if (ent.x < 28 || ent.x > WW - 28) ent.vx *= -1;
      }
      drawEntitySprite(wctx, ent, ent.x, ent.y, ent.scale, bob);
    });

    flying.forEach((f) => {
      const p = f.t;
      const x = f.x0 + (f.x1 - f.x0) * p;
      const y = f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * 50;
      const dw = f.img.width;
      const dh = f.img.height;
      const maxSide = 36 + p * 28;
      const ratio = Math.min(maxSide / dw, maxSide / dh);
      const w = dw * ratio;
      const h = dh * ratio;
      wctx.save();
      wctx.globalAlpha = 1 - p * 0.08;
      wctx.translate(x, y);
      wctx.rotate(p * 0.25);
      wctx.drawImage(f.img, -w / 2, -h / 2, w, h);
      wctx.fillStyle = "#ffe56a";
      for (let i = 0; i < 4; i += 1) {
        const a = animT * 0.2 + i;
        wctx.beginPath();
        wctx.arc(Math.cos(a) * (w * 0.55), Math.sin(a) * (h * 0.5), 2.5, 0, Math.PI * 2);
        wctx.fill();
      }
      wctx.restore();
    });

    wctx.restore();
  }

  function spawnEntity(kind, doodle, x, y) {
    const floats = kind === "bird" || kind === "butterfly" || kind === "balloon" || kind === "star";
    entities.push({
      kind,
      doodle,
      x: x ?? 40 + Math.random() * (WW - 80),
      y: y ?? WH * (0.35 + Math.random() * 0.4),
      vx: floats ? (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.4) : 0,
      scale: 1.05 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      tilt: (Math.random() - 0.5) * 0.15,
      color: penColor || subject.color,
    });
    if (entities.length > 12) entities.shift();
  }

  function makeReal() {
    ensureAudio();
    if (!hasInk()) {
      showToast(`先画一只${subject.name}吧`);
      tone(220, 0.08, "triangle", 0.04);
      return;
    }

    const doodle = cropDoodle();
    if (!doodle) {
      showToast(`先画一只${subject.name}吧`);
      return;
    }

    const targetX = 40 + Math.random() * Math.max(40, WW - 80);
    const targetY = WH * (0.32 + Math.random() * 0.38);

    flying.push({
      img: doodle,
      x0: WW * 0.5,
      y0: WH + 10,
      x1: targetX,
      y1: targetY,
      t: 0,
      kind: subject.id,
      doodle,
      done: false,
    });

    // clear book for next drawing
    paintBookPaper();
    history = [];
    ink = false;
    el.guide.classList.remove("hidden");

    madeCount += 1;
    el.made.textContent = String(madeCount);
    tone(523, 0.08, "sine", 0.05);
    setTimeout(() => tone(659, 0.1, "sine", 0.05), 80);
    setTimeout(() => tone(784, 0.12, "sine", 0.055), 160);
    showToast(`你的${subject.name}飞上去啦！`);
    el.hint.textContent = "画成什么样，上面就长什么样";
  }

  function undo() {
    if (!history.length) {
      showToast("没有可撤销的了");
      return;
    }
    const img = history.pop();
    bctx.putImageData(img, 0, 0);
    ink = hasInk();
    el.guide.classList.toggle("hidden", ink);
    tone(320, 0.05, "triangle", 0.03);
  }

  function clearBook() {
    pushHistory();
    paintBookPaper();
    ink = false;
    el.guide.classList.remove("hidden");
    tone(240, 0.06, "sine", 0.035);
    showToast("画本擦干净了");
  }

  function onDown(e) {
    e.preventDefault();
    ensureAudio();
    pushHistory();
    drawing = true;
    last = pointerPos(el.book, e);
    el.book.setPointerCapture?.(e.pointerId);
    drawStroke(last, last);
    tone(400, 0.03, "triangle", 0.02);
  }

  function onMove(e) {
    if (!drawing || !last) return;
    e.preventDefault();
    const p = pointerPos(el.book, e);
    drawStroke(last, p);
    last = p;
  }

  function onUp() {
    drawing = false;
    last = null;
  }

  function frame() {
    animT += 1;
    flying = flying.filter((f) => {
      f.t += 0.028;
      if (f.t >= 1) {
        spawnEntity(f.kind, f.doodle, f.x1, f.y1);
        return false;
      }
      return true;
    });
    drawWorld();
    requestAnimationFrame(frame);
  }

  function resizeAll() {
    let bookSnap = null;
    if (BW && BH) {
      try {
        bookSnap = bctx.getImageData(0, 0, el.book.width, el.book.height);
      } catch (_) {
        bookSnap = null;
      }
    }
    const wr = resizeCanvas(el.world, wctx);
    WW = wr.w;
    WH = wr.h;
    const br = resizeCanvas(el.book, bctx);
    BW = br.w;
    BH = br.h;
    paintBookPaper();
    if (bookSnap) {
      const tmp = document.createElement("canvas");
      tmp.width = bookSnap.width;
      tmp.height = bookSnap.height;
      tmp.getContext("2d").putImageData(bookSnap, 0, 0);
      bctx.drawImage(tmp, 0, 0, BW, BH);
      ink = hasInk();
      el.guide.classList.toggle("hidden", ink);
    }
  }

  el.book.addEventListener("pointerdown", onDown);
  el.book.addEventListener("pointermove", onMove);
  el.book.addEventListener("pointerup", onUp);
  el.book.addEventListener("pointercancel", onUp);

  el.makeReal.addEventListener("click", makeReal);
  el.clear.addEventListener("click", () => {
    ensureAudio();
    clearBook();
  });
  el.undo.addEventListener("click", () => {
    ensureAudio();
    undo();
  });
  el.mute.addEventListener("click", () => {
    muted = !muted;
    el.mute.classList.toggle("muted", muted);
  });

  window.addEventListener("resize", resizeAll);

  buildPalette();
  buildSubjects();
  setPenColor(penColor);
  resizeAll();
  el.hint.textContent = `画一只${subject.name}：画成什么样，上面就长什么样`;
  requestAnimationFrame(frame);
})();
