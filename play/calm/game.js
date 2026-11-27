(() => {
  const sky = document.getElementById("sky");
  const breathBtn = document.getElementById("breath");
  const breathLabel = document.getElementById("breath-label");
  const minutesEl = document.getElementById("minutes");
  const cyclesEl = document.getElementById("cycles");
  const muteBtn = document.getElementById("mute");
  const starStage = document.getElementById("star-stage");
  const pondStage = document.getElementById("pond-stage");
  const starHint = document.getElementById("star-hint");
  const pondHint = document.getElementById("pond-hint");

  const PACE = {
    slow: { inhale: 5, hold: 1.2, exhale: 6, label: "慢" },
    mid: { inhale: 4, hold: 0.8, exhale: 5, label: "适中" },
    soft: { inhale: 3.2, hold: 0.5, exhale: 4.2, label: "轻柔" },
  };

  let mode = "breath";
  let pace = "mid";
  let running = false;
  let muted = false;
  let cycles = 0;
  let startedAt = 0;
  let phaseTimer = null;
  let tickTimer = null;
  let audioCtx = null;
  let master = null;
  let padNodes = [];
  let ambientOn = false;

  const ctx2d = sky.getContext("2d");
  let stars = [];
  let w = 0;
  let h = 0;
  let raf = 0;

  function resize() {
    w = sky.width = window.innerWidth * devicePixelRatio;
    h = sky.height = window.innerHeight * devicePixelRatio;
    sky.style.width = window.innerWidth + "px";
    sky.style.height = window.innerHeight + "px";
    ctx2d.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    if (!stars.length) seedStars();
  }

  function seedStars() {
    const count = Math.floor((window.innerWidth * window.innerHeight) / 14000);
    stars = Array.from({ length: Math.max(28, count) }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * 0.72,
      r: 0.6 + Math.random() * 1.8,
      a: 0.2 + Math.random() * 0.7,
      s: 0.4 + Math.random() * 1.4,
      p: Math.random() * Math.PI * 2,
    }));
  }

  function drawSky(t) {
    ctx2d.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const s of stars) {
      const tw = 0.45 + 0.55 * Math.sin(t * 0.001 * s.s + s.p);
      ctx2d.beginPath();
      ctx2d.fillStyle = `rgba(255,255,255,${s.a * tw})`;
      ctx2d.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx2d.fill();
    }
    raf = requestAnimationFrame(drawSky);
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = muted ? 0.0001 : 0.22;
      master.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function setMuted(next) {
    muted = next;
    muteBtn.classList.toggle("muted", muted);
    muteBtn.textContent = muted ? "✕" : "♪";
    muteBtn.setAttribute("aria-label", muted ? "打开声音" : "静音");
    if (master) {
      const t = audioCtx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(muted ? 0.0001 : 0.22, t + 0.15);
    }
  }

  function startAmbient() {
    const ctx = ensureAudio();
    if (!ctx || !master || ambientOn || muted) return;
    ambientOn = true;
    const tones = [110, 164.81, 196];
    padNodes = tones.map((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      filter.type = "lowpass";
      filter.frequency.value = 480;
      gain.gain.value = 0.0001;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      const t0 = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.045 - i * 0.01, t0 + 2.5);
      osc.start();
      return { osc, gain };
    });
  }

  function stopAmbient() {
    if (!ambientOn || !audioCtx) return;
    const t = audioCtx.currentTime;
    padNodes.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        osc.stop(t + 1);
      } catch (_) {}
    });
    padNodes = [];
    ambientOn = false;
  }

  function chime(kind) {
    const ctx = ensureAudio();
    if (!ctx || !master || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const f = kind === "in" ? 392 : kind === "out" ? 294 : kind === "spark" ? 880 : 520;
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 0.85, t0 + 0.35);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(kind === "spark" ? 0.05 : 0.07, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.45);
  }

  function softBlip() {
    const ctx = ensureAudio();
    if (!ctx || !master || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.5);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function updateHud() {
    if (!startedAt) {
      minutesEl.textContent = "0:00";
      return;
    }
    minutesEl.textContent = formatTime(Date.now() - startedAt);
  }

  function applyPace() {
    const p = PACE[pace];
    const cycle = p.inhale + p.hold + p.exhale + 0.4;
    document.documentElement.style.setProperty("--cycle", `${cycle}s`);
    document.documentElement.style.setProperty("--inhale", `${p.inhale}s`);
    document.documentElement.style.setProperty("--exhale", `${p.exhale}s`);
  }

  function clearPhase() {
    if (phaseTimer) {
      clearTimeout(phaseTimer);
      phaseTimer = null;
    }
  }

  function runPhase(name) {
    const p = PACE[pace];
    if (name === "in") {
      breathLabel.textContent = "吸气…";
      chime("in");
      phaseTimer = setTimeout(() => runPhase("hold"), p.inhale * 1000);
    } else if (name === "hold") {
      breathLabel.textContent = "轻轻停一下";
      phaseTimer = setTimeout(() => runPhase("out"), p.hold * 1000);
    } else if (name === "out") {
      breathLabel.textContent = "呼气…";
      chime("out");
      phaseTimer = setTimeout(() => {
        cycles += 1;
        cyclesEl.textContent = String(cycles);
        runPhase("rest");
      }, p.exhale * 1000);
    } else {
      breathLabel.textContent = "放松";
      phaseTimer = setTimeout(() => runPhase("in"), 400);
    }
  }

  function startBreath() {
    ensureAudio();
    startAmbient();
    running = true;
    breathBtn.classList.add("running");
    if (!startedAt) startedAt = Date.now();
    if (!tickTimer) tickTimer = setInterval(updateHud, 1000);
    applyPace();
    clearPhase();
    runPhase("in");
  }

  function stopBreath() {
    running = false;
    breathBtn.classList.remove("running");
    clearPhase();
    breathLabel.textContent = "点一下继续";
  }

  function switchMode(next) {
    mode = next;
    document.querySelectorAll(".mode").forEach((btn) => {
      const on = btn.dataset.mode === next;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      const on = panel.id === `panel-${next}`;
      panel.classList.toggle("active", on);
      panel.hidden = !on;
    });
    if (next !== "breath" && running) stopBreath();
    ensureAudio();
    startAmbient();
    if (!startedAt) startedAt = Date.now();
    if (!tickTimer) tickTimer = setInterval(updateHud, 1000);
  }

  function spawnSpark(stage, x, y) {
    const el = document.createElement("span");
    el.className = "spark";
    el.style.left = `${x - 5}px`;
    el.style.top = `${y - 5}px`;
    const hue = 160 + Math.random() * 40;
    el.style.background = `radial-gradient(circle, #fff, hsl(${hue} 80% 75%) 40%, transparent 70%)`;
    stage.appendChild(el);
    chime("spark");
    setTimeout(() => el.remove(), 2500);
  }

  function spawnRipple(stage, x, y) {
    const el = document.createElement("span");
    el.className = "ripple";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const size = 70 + Math.random() * 50;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    stage.appendChild(el);
    softBlip();
    setTimeout(() => el.remove(), 2300);
    // secondary softer ripple
    setTimeout(() => {
      const el2 = document.createElement("span");
      el2.className = "ripple";
      el2.style.left = `${x}px`;
      el2.style.top = `${y}px`;
      el2.style.width = `${size * 1.25}px`;
      el2.style.height = `${size * 1.25}px`;
      el2.style.borderColor = "rgba(255,210,160,0.35)";
      stage.appendChild(el2);
      setTimeout(() => el2.remove(), 2300);
    }, 180);
  }

  function localPos(stage, e) {
    const rect = stage.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }

  let lastSpark = 0;
  function onStarPointer(e) {
    e.preventDefault();
    starHint.classList.add("hide");
    const now = performance.now();
    if (now - lastSpark < 40) return;
    lastSpark = now;
    const { x, y } = localPos(starStage, e);
    spawnSpark(starStage, x, y);
    if (!startedAt) startedAt = Date.now();
    if (!tickTimer) tickTimer = setInterval(updateHud, 1000);
    ensureAudio();
    startAmbient();
  }

  let lastRipple = 0;
  function onPondPointer(e) {
    e.preventDefault();
    pondHint.classList.add("hide");
    const now = performance.now();
    if (e.type.includes("move") && now - lastRipple < 160) return;
    if (!e.type.includes("move") && now - lastRipple < 280) return;
    lastRipple = now;
    const { x, y } = localPos(pondStage, e);
    spawnRipple(pondStage, x, y);
    if (!startedAt) startedAt = Date.now();
    if (!tickTimer) tickTimer = setInterval(updateHud, 1000);
    ensureAudio();
    startAmbient();
  }

  document.querySelectorAll(".mode").forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  document.querySelectorAll(".pace-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pace = btn.dataset.pace;
      document.querySelectorAll(".pace-btn").forEach((b) => b.classList.toggle("active", b === btn));
      applyPace();
      if (running) {
        clearPhase();
        runPhase("in");
      }
    });
  });

  breathBtn.addEventListener("click", () => {
    ensureAudio();
    if (running) stopBreath();
    else startBreath();
  });

  muteBtn.addEventListener("click", () => {
    ensureAudio();
    setMuted(!muted);
    if (!muted) startAmbient();
    else stopAmbient();
  });

  starStage.addEventListener("pointerdown", onStarPointer);
  starStage.addEventListener("pointermove", (e) => {
    if (e.buttons || e.pressure > 0) onStarPointer(e);
  });

  pondStage.addEventListener("pointerdown", onPondPointer);
  pondStage.addEventListener("pointermove", (e) => {
    if (e.buttons || e.pressure > 0) onPondPointer(e);
  });

  window.addEventListener("resize", resize);
  applyPace();
  resize();
  raf = requestAnimationFrame(drawSky);
})();
