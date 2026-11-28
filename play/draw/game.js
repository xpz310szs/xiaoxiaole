(() => {
  const el = {
    canvas: document.getElementById("board"),
    strokes: document.getElementById("strokes"),
    mute: document.getElementById("mute"),
    hint: document.getElementById("hint"),
    toast: document.getElementById("toast"),
    palette: document.getElementById("palette"),
    tools: [...document.querySelectorAll(".tool")],
    sizes: [...document.querySelectorAll(".size-btn")],
  };

  const ctx = el.canvas.getContext("2d", { willReadFrequently: true });
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
    "#ffffff",
  ];

  const STAMPS = {
    star: (c, x, y, s, color) => {
      c.fillStyle = color;
      c.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? s : s * 0.42;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    },
    heart: (c, x, y, s, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x, y + s * 0.3);
      c.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.2, x - s, y + s * 0.2);
      c.bezierCurveTo(x - s, y + s * 0.7, x, y + s, x, y + s);
      c.bezierCurveTo(x, y + s, x + s, y + s * 0.7, x + s, y + s * 0.2);
      c.bezierCurveTo(x + s, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3);
      c.fill();
    },
    smile: (c, x, y, s, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, s * 0.85, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#2f2a28";
      c.beginPath();
      c.arc(x - s * 0.3, y - s * 0.15, s * 0.12, 0, Math.PI * 2);
      c.arc(x + s * 0.3, y - s * 0.15, s * 0.12, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#2f2a28";
      c.lineWidth = Math.max(2, s * 0.12);
      c.lineCap = "round";
      c.beginPath();
      c.arc(x, y + s * 0.1, s * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
    },
  };

  let W = 0;
  let H = 0;
  const STAMP_ORDER = [
    { id: "star", icon: "⭐", name: "星星" },
    { id: "heart", icon: "♥", name: "爱心" },
    { id: "smile", icon: "☺", name: "笑脸" },
  ];

  let color = COLORS[1];
  let size = 10;
  let mode = "pen";
  let stampIndex = 0;
  let drawing = false;
  let last = null;
  let strokeCount = 0;
  let muted = false;
  let audioCtx = null;
  let history = [];
  const HISTORY_MAX = 18;
  let toastTimer = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx?.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur = 0.06, type = "sine", vol = 0.04) {
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
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1000);
  }

  function updateHud() {
    el.strokes.textContent = String(strokeCount);
  }

  function currentStamp() {
    return STAMP_ORDER[stampIndex];
  }

  function refreshStampButton() {
    const s = currentStamp();
    const icon = document.getElementById("stamp-icon");
    const label = document.getElementById("stamp-label");
    if (icon) icon.textContent = s.icon;
    if (label) label.textContent = s.name;
  }

  function updateHint() {
    if (mode === "eraser") el.hint.textContent = "橡皮：拖动擦掉笔迹";
    else if (mode === "stamp") el.hint.textContent = `点一下盖${currentStamp().name}；再点印章可换款`;
    else el.hint.textContent = "选颜色，按住拖动画画";
  }

  function resize() {
    const rect = el.canvas.getBoundingClientRect();
    const nextW = Math.max(1, Math.floor(rect.width));
    const nextH = Math.max(1, Math.floor(rect.height));
    let snapshot = null;
    if (W && H) {
      try {
        snapshot = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height);
      } catch (_) {
        snapshot = null;
      }
    }
    W = nextW;
    H = nextH;
    el.canvas.width = Math.floor(W * dpr);
    el.canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintPaper();
    if (snapshot) {
      const tmp = document.createElement("canvas");
      tmp.width = snapshot.width;
      tmp.height = snapshot.height;
      tmp.getContext("2d").putImageData(snapshot, 0, 0);
      ctx.drawImage(tmp, 0, 0, W, H);
    }
  }

  function paintPaper() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fffaf3";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255, 200, 150, 0.08)";
    for (let i = 0; i < 18; i += 1) {
      ctx.beginPath();
      ctx.arc(
        (i * 97) % W,
        (i * 53) % H,
        18 + (i % 5) * 6,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function pushHistory() {
    try {
      history.push(ctx.getImageData(0, 0, el.canvas.width, el.canvas.height));
      if (history.length > HISTORY_MAX) history.shift();
    } catch (_) {
      /* ignore */
    }
  }

  function undo() {
    if (!history.length) {
      showToast("没有可撤销的了");
      return;
    }
    const img = history.pop();
    ctx.putImageData(img, 0, 0);
    strokeCount = Math.max(0, strokeCount - 1);
    updateHud();
    tone(320, 0.05, "triangle", 0.035);
    showToast("撤销一步");
  }

  function clearBoard() {
    pushHistory();
    paintPaper();
    strokeCount = 0;
    updateHud();
    tone(240, 0.08, "sine", 0.04);
    showToast("画布清空啦");
  }

  function pointerPos(e) {
    const rect = el.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function drawLine(a, b) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (mode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = size * 2.2;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function stampAt(x, y) {
    const id = currentStamp().id;
    const fn = STAMPS[id];
    if (!fn) return;
    pushHistory();
    fn(ctx, x, y, size * 1.6, color);
    strokeCount += 1;
    updateHud();
    tone(620, 0.05, "sine", 0.04);
  }

  function onDown(e) {
    e.preventDefault();
    ensureAudio();
    const p = pointerPos(e);
    el.canvas.setPointerCapture?.(e.pointerId);

    if (mode === "stamp") {
      stampAt(p.x, p.y);
      drawing = false;
      last = null;
      return;
    }

    pushHistory();
    drawing = true;
    last = p;
    drawLine(p, p);
    strokeCount += 1;
    updateHud();
    tone(420, 0.03, "triangle", 0.025);
  }

  function onMove(e) {
    if (!drawing || !last) return;
    e.preventDefault();
    const p = pointerPos(e);
    drawLine(last, p);
    last = p;
  }

  function onUp() {
    drawing = false;
    last = null;
  }

  function buildPalette() {
    el.palette.innerHTML = "";
    COLORS.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch" + (c === color ? " active" : "");
      btn.style.background = c;
      btn.setAttribute("aria-label", `颜色 ${i + 1}`);
      if (c === "#ffffff") btn.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.12), 0 3px 0 rgba(160,70,30,0.14)";
      btn.addEventListener("click", () => {
        color = c;
        [...el.palette.children].forEach((n) => n.classList.toggle("active", n === btn));
        if (mode === "eraser") setMode("pen");
        tone(500, 0.04, "sine", 0.03);
      });
      el.palette.appendChild(btn);
    });
  }

  function setMode(next) {
    mode = next;
    el.tools.forEach((b) => b.classList.toggle("active", b.dataset.tool === mode));
    updateHint();
  }

  el.tools.forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureAudio();
      const t = btn.dataset.tool;
      if (t === "undo") {
        undo();
        return;
      }
      if (t === "clear") {
        clearBoard();
        return;
      }
      if (t === "stamp") {
        if (mode === "stamp") {
          stampIndex = (stampIndex + 1) % STAMP_ORDER.length;
          refreshStampButton();
          showToast(`换成${currentStamp().name}`);
        }
        setMode("stamp");
        refreshStampButton();
        tone(540, 0.04, "sine", 0.03);
        return;
      }
      setMode(t);
      tone(520, 0.04, "sine", 0.03);
    });
  });

  el.sizes.forEach((btn) => {
    btn.addEventListener("click", () => {
      size = Number(btn.dataset.size) || 10;
      el.sizes.forEach((b) => b.classList.toggle("active", b === btn));
      tone(480, 0.03, "triangle", 0.025);
    });
  });

  el.mute.addEventListener("click", () => {
    muted = !muted;
    el.mute.classList.toggle("muted", muted);
    el.mute.setAttribute("aria-label", muted ? "取消静音" : "声音");
  });

  el.canvas.addEventListener("pointerdown", onDown);
  el.canvas.addEventListener("pointermove", onMove);
  el.canvas.addEventListener("pointerup", onUp);
  el.canvas.addEventListener("pointercancel", onUp);

  window.addEventListener("resize", () => {
    resize();
  });

  buildPalette();
  refreshStampButton();
  setMode("pen");
  updateHud();
  resize();
})();
