(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const distEl = document.getElementById("dist");
  const bestEl = document.getElementById("best");
  const starsEl = document.getElementById("stars");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const startBtn = document.getElementById("start");
  const jumpBtn = document.getElementById("jump");
  const muteBtn = document.getElementById("mute");

  let W = 400;
  let H = 240;
  let groundY = 190;
  let running = false;
  let dead = false;
  let muted = false;
  let audioCtx = null;
  let raf = 0;
  let lastT = 0;

  let best = Number(localStorage.getItem("parkour-best") || 0);
  bestEl.textContent = String(best);

  const player = {
    x: 70,
    y: 0,
    w: 26,
    h: 34,
    vy: 0,
    onGround: true,
    jumps: 0,
    maxJumps: 2,
  };

  let speed = 5.2;
  let distance = 0;
  let stars = 0;
  let gravity = 0.55;
  let jumpV = -10.8;
  let obstacles = [];
  let pickups = [];
  let clouds = [];
  let spawnTimer = 0;
  let starTimer = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur = 0.08, type = "sine", vol = 0.08) {
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

  function resize() {
    const wrap = canvas.parentElement;
    const cssW = Math.max(200, wrap.clientWidth);
    const cssH = Math.max(140, wrap.clientHeight);
    canvas.width = cssW * devicePixelRatio;
    canvas.height = cssH * devicePixelRatio;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    W = cssW;
    H = cssH;
    groundY = H * 0.78;
    player.y = groundY - player.h;
  }

  function resetWorld() {
    distance = 0;
    stars = 0;
    speed = 5.2;
    spawnTimer = 40;
    starTimer = 70;
    obstacles = [];
    pickups = [];
    clouds = Array.from({ length: 5 }, () => ({
      x: Math.random() * W,
      y: 18 + Math.random() * (H * 0.28),
      s: 0.4 + Math.random() * 0.7,
      w: 40 + Math.random() * 36,
    }));
    player.vy = 0;
    player.jumps = 0;
    player.onGround = true;
    player.y = groundY - player.h;
    distEl.textContent = "0";
    starsEl.textContent = "0";
    dead = false;
  }

  function rectsHit(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function spawnObstacle() {
    const roll = Math.random();
    if (roll < 0.45) {
      // block
      const h = 28 + Math.floor(Math.random() * 26);
      obstacles.push({
        type: "block",
        x: W + 20,
        y: groundY - h,
        w: 22 + Math.random() * 16,
        h,
      });
    } else if (roll < 0.75) {
      // floating bar to duck under / jump over
      const h = 18;
      obstacles.push({
        type: "bar",
        x: W + 20,
        y: groundY - 58 - Math.random() * 30,
        w: 46 + Math.random() * 20,
        h,
      });
    } else {
      // spike pair
      obstacles.push({
        type: "spike",
        x: W + 20,
        y: groundY - 22,
        w: 24,
        h: 22,
      });
    }
  }

  function spawnStar() {
    pickups.push({
      x: W + 10,
      y: groundY - 70 - Math.random() * 70,
      r: 9,
      got: false,
    });
  }

  function jump() {
    if (!running || dead) {
      startGame();
      return;
    }
    if (player.jumps >= player.maxJumps) return;
    player.vy = jumpV;
    player.onGround = false;
    player.jumps += 1;
    tone(player.jumps === 1 ? 420 : 560, 0.07, "triangle", 0.07);
  }

  function die() {
    dead = true;
    running = false;
    tone(160, 0.2, "sawtooth", 0.06);
    const score = Math.floor(distance);
    if (score > best) {
      best = score;
      localStorage.setItem("parkour-best", String(best));
      bestEl.textContent = String(best);
    }
    overlayTitle.textContent = "撞到了！";
    overlaySub.textContent = `跑了 ${score} 米 · 星星 ${stars}`;
    startBtn.textContent = "再来";
    overlay.classList.remove("hidden");
  }

  function startGame() {
    ensureAudio();
    resetWorld();
    running = true;
    overlay.classList.add("hidden");
    lastT = performance.now();
    tone(660, 0.08, "sine", 0.07);
  }

  function update(dt) {
    const scale = Math.min(2.2, dt / 16.67);
    distance += speed * 0.35 * scale;
    distEl.textContent = String(Math.floor(distance));
    speed = Math.min(11.5, 5.2 + distance / 280);

    // player physics
    player.vy += gravity * scale;
    player.y += player.vy * scale;
    if (player.y >= groundY - player.h) {
      player.y = groundY - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumps = 0;
    }

    spawnTimer -= scale;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = 55 + Math.random() * 45 - Math.min(25, distance / 40);
    }
    starTimer -= scale;
    if (starTimer <= 0) {
      spawnStar();
      starTimer = 90 + Math.random() * 70;
    }

    const move = speed * scale;
    for (const o of obstacles) o.x -= move;
    for (const s of pickups) s.x -= move;
    for (const c of clouds) {
      c.x -= c.s * scale;
      if (c.x + c.w < -20) {
        c.x = W + 20;
        c.y = 18 + Math.random() * (H * 0.28);
      }
    }

    obstacles = obstacles.filter((o) => o.x + o.w > -40);
    pickups = pickups.filter((s) => s.x > -30 && !s.got);

    const pBox = { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 6 };
    for (const o of obstacles) {
      if (rectsHit(pBox, o)) {
        die();
        return;
      }
    }
    for (const s of pickups) {
      const dx = player.x + player.w / 2 - s.x;
      const dy = player.y + player.h / 2 - s.y;
      if (Math.hypot(dx, dy) < s.r + 14) {
        s.got = true;
        stars += 1;
        starsEl.textContent = String(stars);
        tone(880, 0.07, "sine", 0.07);
      }
    }
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4aa7ef");
    g.addColorStop(0.55, "#8fd0ff");
    g.addColorStop(1, "#ffe2a8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const c of clouds) {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      roundRect(c.x, c.y, c.w, 16, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x + c.w * 0.3, c.y + 2, 12, 0, Math.PI * 2);
      ctx.arc(c.x + c.w * 0.6, c.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGround() {
    ctx.fillStyle = "#2f8f5b";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "#3db872";
    ctx.fillRect(0, groundY, W, 10);
    // scrolling stripes
    const offset = (distance * 2.2) % 28;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let x = -offset; x < W; x += 28) {
      ctx.fillRect(x, groundY + 14, 14, 4);
    }
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    // body
    const g = ctx.createLinearGradient(x, y, x, y + player.h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#7ec8ff");
    g.addColorStop(1, "#2f9dff");
    ctx.fillStyle = g;
    roundRect(x, y + 6, player.w, player.h - 6, 8);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.arc(x + player.w / 2, y + 8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#243044";
    ctx.beginPath();
    ctx.arc(x + player.w / 2 + 3, y + 7, 2, 0, Math.PI * 2);
    ctx.fill();
    // trail
    if (running && !dead) {
      ctx.fillStyle = "rgba(126,200,255,0.35)";
      ctx.fillRect(x - 14, y + player.h - 10, 12, 6);
      ctx.fillRect(x - 24, y + player.h - 8, 8, 4);
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === "spike") {
        ctx.fillStyle = "#ff6b6b";
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h);
        ctx.lineTo(o.x + o.w / 2, o.y);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.closePath();
        ctx.fill();
      } else if (o.type === "bar") {
        ctx.fillStyle = "#ff9a4a";
        roundRect(o.x, o.y, o.w, o.h, 6);
        ctx.fill();
      } else {
        ctx.fillStyle = "#2f9dff";
        roundRect(o.x, o.y, o.w, o.h, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(o.x + 4, o.y + 4, o.w * 0.35, 6);
      }
    }
  }

  function drawStars() {
    for (const s of pickups) {
      if (s.got) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(distance * 0.05);
      ctx.fillStyle = "#ffe56a";
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? s.r : s.r * 0.45;
        // use proper star
      }
      // simple diamond star
      ctx.moveTo(0, -s.r);
      ctx.lineTo(s.r * 0.35, -s.r * 0.2);
      ctx.lineTo(s.r, 0);
      ctx.lineTo(s.r * 0.35, s.r * 0.35);
      ctx.lineTo(0, s.r);
      ctx.lineTo(-s.r * 0.35, s.r * 0.35);
      ctx.lineTo(-s.r, 0);
      ctx.lineTo(-s.r * 0.35, -s.r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function frame(t) {
    const dt = Math.min(34, t - lastT || 16);
    lastT = t;
    if (running && !dead) update(dt);
    drawSky();
    drawGround();
    drawObstacles();
    drawStars();
    drawPlayer();
    raf = requestAnimationFrame(frame);
  }

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });
  jumpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    jump();
  });
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    jump();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      jump();
    }
  });
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.classList.toggle("muted", muted);
    muteBtn.textContent = muted ? "✕" : "♪";
  });
  window.addEventListener("resize", () => {
    resize();
  });

  resize();
  resetWorld();
  raf = requestAnimationFrame(frame);
})();
