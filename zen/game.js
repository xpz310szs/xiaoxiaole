(() => {
  const COLS = 6;
  const ROWS = 8;
  const BEST_KEY = "zen-pop-best-streak";

  const wrapEl = document.getElementById("wrap");
  const switchWall = document.getElementById("switch-wall");
  const doughEl = document.getElementById("dough");
  const popsEl = document.getElementById("pops");
  const streakEl = document.getElementById("streak");
  const bestEl = document.getElementById("best");
  const resetBtn = document.getElementById("reset");
  const tabs = [...document.querySelectorAll(".tab")];
  const panels = {
    bubbles: document.getElementById("panel-bubbles"),
    dough: document.getElementById("panel-dough"),
    switches: document.getElementById("panel-switches"),
  };

  const COLORS = ["#9ad8ff", "#7defc4", "#ffb4a2", "#ffe08a", "#c4b5fd", "#f9a8d4"];

  let pops = 0;
  let streak = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let streakTimer = null;
  let audioCtx = null;
  let popping = false;

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function popSound(pitch = 1) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420 * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(180 * pitch, t0 + 0.08);
    g1.gain.setValueAtTime(0.05, t0);
    g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    g2.gain.setValueAtTime(0.04, t0);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    osc.connect(g1);
    noise.connect(g2);
    g1.connect(ctx.destination);
    g2.connect(ctx.destination);
    osc.start(t0);
    noise.start(t0);
    osc.stop(t0 + 0.1);
    noise.stop(t0 + 0.06);
  }

  let masterGain = null;

  function outNode() {
    const ctx = ensureAudio();
    if (!ctx) return null;
    if (!masterGain) {
      masterGain = ctx.createGain();
      masterGain.gain.value = 1.35;
      masterGain.connect(ctx.destination);
    }
    return masterGain;
  }

  function noiseBurst(ctx, seconds, colorFn) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = colorFn(i, n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /** Loud wall-switch clack: travel scrape then hard plastic latch. */
  function clickSound(on) {
    const ctx = ensureAudio();
    const dest = outNode();
    if (!ctx || !dest) return;
    const t0 = ctx.currentTime;
    const seatAt = t0 + (on ? 0.028 : 0.034);

    // 1) Lever travel / friction
    const scrape = noiseBurst(ctx, 0.04, (i, n) => {
      const p = i / n;
      return (Math.random() * 2 - 1) * Math.pow(1 - p, 1.2) * (0.55 + 0.45 * Math.sin(p * 40));
    });
    const scrapeBp = ctx.createBiquadFilter();
    scrapeBp.type = "bandpass";
    scrapeBp.frequency.value = on ? 1450 : 980;
    scrapeBp.Q.value = 0.7;
    const scrapeGain = ctx.createGain();
    scrapeGain.gain.setValueAtTime(0.0001, t0);
    scrapeGain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.004);
    scrapeGain.gain.exponentialRampToValueAtTime(0.0001, seatAt);
    scrape.connect(scrapeBp);
    scrapeBp.connect(scrapeGain);
    scrapeGain.connect(dest);
    scrape.start(t0);
    scrape.stop(seatAt + 0.01);

    // 2) Hard latch impact (the “咔”)
    const impact = noiseBurst(ctx, 0.035, (i, n) => {
      const p = i / n;
      return (Math.random() * 2 - 1) * Math.pow(1 - p, 5.5);
    });
    const impactHp = ctx.createBiquadFilter();
    impactHp.type = "highpass";
    impactHp.frequency.value = on ? 900 : 450;
    const impactLp = ctx.createBiquadFilter();
    impactLp.type = "lowpass";
    impactLp.frequency.value = on ? 5200 : 3200;
    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0.0001, seatAt);
    impactGain.gain.exponentialRampToValueAtTime(0.55, seatAt + 0.0015);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, seatAt + 0.05);
    impact.connect(impactHp);
    impactHp.connect(impactLp);
    impactLp.connect(impactGain);
    impactGain.connect(dest);
    impact.start(seatAt);
    impact.stop(seatAt + 0.06);

    // 3) Low thump through the wall plate
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(on ? 160 : 110, seatAt);
    thump.frequency.exponentialRampToValueAtTime(on ? 70 : 48, seatAt + 0.08);
    thumpGain.gain.setValueAtTime(0.0001, seatAt);
    thumpGain.gain.exponentialRampToValueAtTime(0.28, seatAt + 0.002);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, seatAt + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(dest);
    thump.start(seatAt);
    thump.stop(seatAt + 0.11);

    // 4) Bright plastic ring
    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = "triangle";
    ring.frequency.setValueAtTime(on ? 1650 : 980, seatAt);
    ring.frequency.exponentialRampToValueAtTime(on ? 720 : 420, seatAt + 0.06);
    ringGain.gain.setValueAtTime(0.0001, seatAt);
    ringGain.gain.exponentialRampToValueAtTime(0.16, seatAt + 0.002);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, seatAt + 0.07);
    ring.connect(ringGain);
    ringGain.connect(dest);
    ring.start(seatAt);
    ring.stop(seatAt + 0.08);

    try {
      if (navigator.vibrate) navigator.vibrate(on ? [8, 12, 18] : [14, 10, 22]);
    } catch (_) {
      /* ignore */
    }
  }

  function squishSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12);
    g.gain.value = 0.025;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  function updateHud() {
    popsEl.textContent = String(pops);
    streakEl.textContent = String(streak);
    bestEl.textContent = String(best);
  }

  function bumpStreak() {
    streak += 1;
    if (streak > best) {
      best = streak;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {
        /* ignore */
      }
    }
    updateHud();
    clearTimeout(streakTimer);
    streakTimer = setTimeout(() => {
      streak = 0;
      updateHud();
    }, 900);
  }

  function buildBubbles() {
    wrapEl.innerHTML = "";
    for (let i = 0; i < COLS * ROWS; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bubble";
      btn.style.setProperty("--bubble", COLORS[i % COLORS.length]);
      btn.setAttribute("aria-label", `泡泡 ${i + 1}`);
      btn.dataset.i = String(i);
      wrapEl.appendChild(btn);
    }
  }

  function popBubble(btn) {
    if (!btn || btn.classList.contains("popped") || btn.classList.contains("popping")) return;
    ensureAudio();
    btn.classList.add("popping");
    const pitch = 0.85 + Math.random() * 0.4;
    popSound(pitch);
    pops += 1;
    bumpStreak();
    setTimeout(() => {
      btn.classList.remove("popping");
      btn.classList.add("popped");
      const left = wrapEl.querySelectorAll(".bubble:not(.popped)").length;
      if (left === 0) {
        setTimeout(() => {
          buildBubbles();
        }, 280);
      }
    }, 240);
  }

  function buildSwitches() {
    switchWall.innerHTML = "";
    const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    labels.forEach((label, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "switch rocker";
      btn.innerHTML = `
        <span class="rocker-plate">
          <span class="rocker-paddle"><span class="rocker-face up">ON</span><span class="rocker-face down">OFF</span></span>
        </span>
        <span class="switch-label">${label}</span>`;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        ensureAudio();
        const on = !btn.classList.contains("on");
        btn.classList.add("pressing");
        btn.classList.toggle("on", on);
        clickSound(on);
        bumpStreak();
        pops += 1;
        updateHud();
        setTimeout(() => btn.classList.remove("pressing"), 120);
      });
      if (idx % 3 === 0) btn.classList.add("on");
      switchWall.appendChild(btn);
    });
  }

  function showPanel(name) {
    tabs.forEach((tab) => {
      const on = tab.dataset.panel === name;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panels).forEach(([key, el]) => {
      const on = key === name;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.panel));
  });

  wrapEl.addEventListener(
    "pointerdown",
    (e) => {
      const bubble = e.target.closest(".bubble");
      if (!bubble) return;
      popping = true;
      try {
        wrapEl.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      popBubble(bubble);
    },
    { passive: true }
  );

  wrapEl.addEventListener(
    "pointermove",
    (e) => {
      if (!popping) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const bubble = el && el.closest ? el.closest(".bubble") : null;
      if (bubble && wrapEl.contains(bubble)) popBubble(bubble);
    },
    { passive: true }
  );

  function endPop() {
    popping = false;
  }

  wrapEl.addEventListener("pointerup", endPop);
  wrapEl.addEventListener("pointercancel", endPop);

  let doughPointer = null;
  doughEl.addEventListener(
    "pointerdown",
    (e) => {
      ensureAudio();
      squishSound();
      doughPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      doughEl.style.setProperty("--sx", "1.12");
      doughEl.style.setProperty("--sy", "0.88");
      try {
        doughEl.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    },
    { passive: true }
  );

  doughEl.addEventListener(
    "pointermove",
    (e) => {
      if (!doughPointer || doughPointer.id !== e.pointerId) return;
      const dx = (e.clientX - doughPointer.x) / 80;
      const dy = (e.clientY - doughPointer.y) / 80;
      const sx = Math.min(1.35, Math.max(0.75, 1 + dy * 0.35 + Math.abs(dx) * 0.1));
      const sy = Math.min(1.35, Math.max(0.7, 1 - dy * 0.35 + Math.abs(dx) * 0.08));
      doughEl.style.setProperty("--sx", String(sx));
      doughEl.style.setProperty("--sy", String(sy));
    },
    { passive: true }
  );

  function endDough(e) {
    if (!doughPointer || (e && doughPointer.id !== e.pointerId)) return;
    doughPointer = null;
    doughEl.style.setProperty("--sx", "1");
    doughEl.style.setProperty("--sy", "1");
    pops += 1;
    bumpStreak();
    updateHud();
  }

  doughEl.addEventListener("pointerup", endDough);
  doughEl.addEventListener("pointercancel", endDough);

  resetBtn.addEventListener("click", () => {
    pops = 0;
    streak = 0;
    updateHud();
    buildBubbles();
    buildSwitches();
    doughEl.style.setProperty("--sx", "1");
    doughEl.style.setProperty("--sy", "1");
    showPanel("bubbles");
  });

  bestEl.textContent = String(best);
  updateHud();
  buildBubbles();
  buildSwitches();
})();
