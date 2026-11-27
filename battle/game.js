(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const waveEl = document.getElementById("wave");
  const hpEl = document.getElementById("hp");
  const hpFill = document.getElementById("hp-fill");
  const killsEl = document.getElementById("kills");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const startBtn = document.getElementById("start");
  const muteBtn = document.getElementById("mute");
  const leftBtn = document.getElementById("left");
  const rightBtn = document.getElementById("right");
  const jumpBtn = document.getElementById("jump");
  const attackBtn = document.getElementById("attack");

  let W = 400;
  let H = 280;
  let groundY = 220;
  let running = false;
  let muted = false;
  let audioCtx = null;
  let raf = 0;
  let lastT = 0;

  const MAX_HP = 5;
  const keys = { left: false, right: false, jump: false, attack: false };
  let jumpPressed = false;
  let attackPressed = false;

  const hero = {
    x: 80,
    y: 0,
    w: 28,
    h: 36,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    jumps: 0,
    maxJumps: 2,
    hp: MAX_HP,
    invuln: 0,
    attackCd: 0,
    attacking: 0,
    swing: 0,
  };

  let wave = 1;
  let kills = 0;
  let monsters = [];
  let particles = [];
  let spawnLeft = 0;
  let spawnTimer = 0;
  let waveClearTimer = 0;
  let shake = 0;
  let best = Number(localStorage.getItem("battle-best") || 0);

  const MONSTER_KINDS = [
    { name: "史莱姆", color: "#5ad67a", eye: "#1e3a28", hp: 2, speed: 1.1, w: 30, h: 24, score: 1 },
    { name: "小蝙蝠", color: "#7a6cff", eye: "#2a1848", hp: 1, speed: 1.8, w: 28, h: 20, score: 1, fly: true },
    { name: "石怪", color: "#8a8f9a", eye: "#2c3038", hp: 4, speed: 0.7, w: 34, h: 32, score: 2 },
    { name: "火焰怪", color: "#ff6a3a", eye: "#3a1208", hp: 3, speed: 1.35, w: 30, h: 30, score: 2 },
  ];

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur = 0.08, type = "square", vol = 0.07) {
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
    const cssH = Math.max(160, wrap.clientHeight);
    canvas.width = cssW * devicePixelRatio;
    canvas.height = cssH * devicePixelRatio;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    W = cssW;
    H = cssH;
    groundY = H * 0.82;
    if (!running) hero.y = groundY - hero.h;
  }

  function updateHud() {
    waveEl.textContent = String(wave);
    hpEl.textContent = String(Math.max(0, hero.hp));
    hpFill.style.width = `${Math.max(0, (hero.hp / MAX_HP) * 100)}%`;
    killsEl.textContent = String(kills);
  }

  function spawnBurst(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 1.5 + Math.random() * 2.5;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: 18 + Math.random() * 10,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function makeMonster(kindIndex) {
    const kind = MONSTER_KINDS[kindIndex % MONSTER_KINDS.length];
    const fromRight = Math.random() > 0.35;
    const hpBoost = Math.floor((wave - 1) / 2);
    return {
      kind,
      x: fromRight ? W + 20 : -40,
      y: kind.fly ? groundY - 70 - Math.random() * 40 : groundY - kind.h,
      w: kind.w,
      h: kind.h,
      hp: kind.hp + hpBoost,
      maxHp: kind.hp + hpBoost,
      speed: kind.speed + Math.min(1.2, wave * 0.08),
      facing: fromRight ? -1 : 1,
      hurt: 0,
      bob: Math.random() * Math.PI * 2,
      flash: 0,
    };
  }

  function beginWave() {
    spawnLeft = Math.min(3 + wave, 8);
    spawnTimer = 20;
    waveClearTimer = 0;
    updateHud();
  }

  function resetGame() {
    wave = 1;
    kills = 0;
    monsters = [];
    particles = [];
    hero.x = Math.max(40, W * 0.22);
    hero.y = groundY - hero.h;
    hero.vx = 0;
    hero.vy = 0;
    hero.facing = 1;
    hero.hp = MAX_HP;
    hero.invuln = 0;
    hero.attackCd = 0;
    hero.attacking = 0;
    hero.jumps = 0;
    hero.onGround = true;
    shake = 0;
    beginWave();
    updateHud();
  }

  function showOverlay(title, sub, btn = "再来一局") {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    startBtn.textContent = btn;
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function hitTest(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function doJump() {
    if (hero.jumps >= hero.maxJumps) return;
    hero.vy = -11.2;
    hero.jumps += 1;
    hero.onGround = false;
    tone(520, 0.07, "triangle", 0.06);
  }

  function doAttack() {
    if (hero.attackCd > 0 || hero.attacking > 0) return;
    hero.attacking = 10;
    hero.attackCd = 16;
    hero.swing = hero.facing;
    tone(280, 0.05, "sawtooth", 0.05);
    tone(440, 0.06, "square", 0.04);
  }

  function hurtHero(amount = 1) {
    if (hero.invuln > 0) return;
    hero.hp -= amount;
    hero.invuln = 50;
    shake = 10;
    tone(120, 0.12, "sawtooth", 0.08);
    updateHud();
    if (hero.hp <= 0) {
      running = false;
      if (kills > best) {
        best = kills;
        localStorage.setItem("battle-best", String(best));
      }
      showOverlay("被打败了…", `击败 ${kills} 只 · 最高 ${best} · 第 ${wave} 波`, "再战");
    }
  }

  function update(dt) {
    const step = Math.min(dt, 32) / 16.67;

    if (jumpPressed) {
      doJump();
      jumpPressed = false;
    }
    if (attackPressed) {
      doAttack();
      attackPressed = false;
    }

    const move = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    hero.vx = move * 3.6;
    if (move !== 0) hero.facing = move;

    hero.vy += 0.55 * step;
    hero.x += hero.vx * step;
    hero.y += hero.vy * step;

    if (hero.x < 8) hero.x = 8;
    if (hero.x + hero.w > W - 8) hero.x = W - 8 - hero.w;

    if (hero.y + hero.h >= groundY) {
      hero.y = groundY - hero.h;
      hero.vy = 0;
      hero.onGround = true;
      hero.jumps = 0;
    } else {
      hero.onGround = false;
    }

    if (hero.attackCd > 0) hero.attackCd -= step;
    if (hero.attacking > 0) hero.attacking -= step;
    if (hero.invuln > 0) hero.invuln -= step;
    if (shake > 0) shake -= step;

    const sword = hero.attacking > 0
      ? {
          x: hero.facing > 0 ? hero.x + hero.w - 4 : hero.x - 30,
          y: hero.y + 8,
          w: 34,
          h: 18,
        }
      : null;

    if (spawnLeft > 0) {
      spawnTimer -= step;
      if (spawnTimer <= 0) {
        const kind = Math.min(
          MONSTER_KINDS.length - 1,
          Math.floor(Math.random() * Math.min(MONSTER_KINDS.length, 1 + Math.floor(wave / 2)))
        );
        monsters.push(makeMonster(kind));
        spawnLeft -= 1;
        spawnTimer = 35 + Math.random() * 25;
      }
    } else if (monsters.length === 0) {
      waveClearTimer += step;
      if (waveClearTimer > 40) {
        wave += 1;
        tone(660, 0.08, "sine", 0.06);
        tone(880, 0.1, "sine", 0.05);
        beginWave();
      }
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.bob += 0.12 * step;
      if (m.hurt > 0) m.hurt -= step;
      if (m.flash > 0) m.flash -= step;

      const dx = hero.x + hero.w / 2 - (m.x + m.w / 2);
      m.facing = dx >= 0 ? 1 : -1;
      const chase = Math.sign(dx) * m.speed;
      m.x += chase * step;

      if (m.kind.fly) {
        m.y = groundY - 70 + Math.sin(m.bob) * 16;
      } else {
        m.y = groundY - m.h;
      }

      if (sword && hitTest(sword.x, sword.y, sword.w, sword.h, m.x, m.y, m.w, m.h) && m.hurt <= 0) {
        m.hp -= 1;
        m.hurt = 12;
        m.flash = 8;
        m.x += hero.facing * 10;
        spawnBurst(m.x + m.w / 2, m.y + m.h / 2, m.kind.color, 5);
        tone(360 + Math.random() * 80, 0.06, "triangle", 0.06);
        if (m.hp <= 0) {
          spawnBurst(m.x + m.w / 2, m.y + m.h / 2, "#ffe56a", 12);
          kills += m.kind.score;
          monsters.splice(i, 1);
          tone(720, 0.1, "sine", 0.07);
          updateHud();
          continue;
        }
      }

      if (
        hero.invuln <= 0 &&
        hitTest(hero.x + 4, hero.y + 4, hero.w - 8, hero.h - 6, m.x + 2, m.y + 2, m.w - 4, m.h - 4)
      ) {
        hurtHero(1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 0.15 * step;
      p.life -= step;
      if (p.life <= 0) particles.splice(i, 1);
    }
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

  function drawHero() {
    const blink = hero.invuln > 0 && Math.floor(hero.invuln / 3) % 2 === 0;
    if (blink) return;

    const x = hero.x;
    const y = hero.y;
    ctx.save();
    if (hero.facing < 0) {
      ctx.translate(x + hero.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + hero.w / 2), 0);
    }

    // body
    ctx.fillStyle = "#3db7ff";
    roundRect(x + 4, y + 14, 20, 18, 6);
    ctx.fill();
    // head
    ctx.fillStyle = "#ffd7c2";
    ctx.beginPath();
    ctx.arc(x + 14, y + 12, 11, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = "#3a2740";
    ctx.beginPath();
    ctx.ellipse(x + 14, y + 6, 11, 7, 0, Math.PI, 0);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#243248";
    ctx.beginPath();
    ctx.arc(x + 10, y + 12, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 18, y + 12, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // legs
    ctx.fillStyle = "#2a6fb0";
    roundRect(x + 6, y + 30, 6, 7, 2);
    roundRect(x + 16, y + 30, 6, 7, 2);
    ctx.fill();

    // sword swing
    if (hero.attacking > 0) {
      const t = 1 - hero.attacking / 10;
      ctx.strokeStyle = "#ffe56a";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      const sx = x + hero.w - 2;
      const sy = y + 18;
      ctx.arc(sx, sy, 22, -0.9 + t * 1.4, -0.2 + t * 1.6);
      ctx.stroke();
      ctx.fillStyle = "#fff6b0";
      ctx.beginPath();
      ctx.arc(sx + Math.cos(-0.2 + t * 1.6) * 22, sy + Math.sin(-0.2 + t * 1.6) * 22, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#c0c8d8";
      roundRect(x + hero.w - 6, y + 16, 5, 16, 2);
      ctx.fill();
      ctx.fillStyle = "#ffe56a";
      roundRect(x + hero.w - 8, y + 12, 9, 6, 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMonster(m) {
    const hurtFlash = m.flash > 0;
    ctx.save();
    ctx.translate(m.x + m.w / 2, m.y + m.h / 2);
    if (m.facing < 0) ctx.scale(-1, 1);
    ctx.translate(-(m.x + m.w / 2), -(m.y + m.h / 2));

    ctx.fillStyle = hurtFlash ? "#fff" : m.kind.color;
    if (m.kind.fly) {
      // wings
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(m.x + 4, m.y + 10, 10, 6 + Math.sin(m.bob) * 2, -0.4, 0, Math.PI * 2);
      ctx.ellipse(m.x + m.w - 4, m.y + 10, 10, 6 + Math.sin(m.bob + 1) * 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      roundRect(m.x + 6, m.y + 4, m.w - 12, m.h - 6, 8);
      ctx.fill();
    } else if (m.kind.name === "史莱姆") {
      ctx.beginPath();
      ctx.ellipse(m.x + m.w / 2, m.y + m.h * 0.6, m.w * 0.48, m.h * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRect(m.x, m.y, m.w, m.h, 8);
      ctx.fill();
      if (m.kind.name === "火焰怪") {
        ctx.fillStyle = hurtFlash ? "#fff" : "#ffd56a";
        ctx.beginPath();
        ctx.moveTo(m.x + 8, m.y + 4);
        ctx.quadraticCurveTo(m.x + m.w / 2, m.y - 10, m.x + m.w - 8, m.y + 4);
        ctx.fill();
      }
    }

    // eyes
    ctx.fillStyle = m.kind.eye;
    const ey = m.y + m.h * 0.38;
    ctx.beginPath();
    ctx.arc(m.x + m.w * 0.35, ey, 3, 0, Math.PI * 2);
    ctx.arc(m.x + m.w * 0.65, ey, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(m.x + m.w * 0.35 + 1, ey - 1, 1.1, 0, Math.PI * 2);
    ctx.arc(m.x + m.w * 0.65 + 1, ey - 1, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // hp pips
    if (m.maxHp > 1) {
      const barW = m.w;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      roundRect(m.x, m.y - 8, barW, 4, 2);
      ctx.fill();
      ctx.fillStyle = "#ff6a5a";
      roundRect(m.x, m.y - 8, barW * (m.hp / m.maxHp), 4, 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function draw() {
    const ox = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const oy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(ox, oy);

    // sky fill already in css; arena ground
    ctx.clearRect(-20, -20, W + 40, H + 40);

    // hills
    ctx.fillStyle = "rgba(90, 190, 120, 0.35)";
    ctx.beginPath();
    ctx.ellipse(W * 0.2, groundY + 10, 90, 40, 0, Math.PI, 0);
    ctx.ellipse(W * 0.7, groundY + 16, 120, 50, 0, Math.PI, 0);
    ctx.fill();

    // ground
    ctx.fillStyle = "#5ecf7a";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "#49b866";
    ctx.fillRect(0, groundY, W, 8);

    // soft path
    ctx.fillStyle = "rgba(255, 230, 170, 0.55)";
    roundRect(20, groundY - 2, W - 40, 14, 8);
    ctx.fill();

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 24);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    monsters.forEach(drawMonster);
    drawHero();

    if (running && spawnLeft === 0 && monsters.length === 0 && waveClearTimer > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `700 18px ${getComputedStyle(document.body).getPropertyValue("--font-display") || "Fredoka"}`;
      ctx.textAlign = "center";
      ctx.fillText(`第 ${wave} 波清除！`, W / 2, H * 0.28);
    }

    ctx.restore();
  }

  function loop(t) {
    const dt = lastT ? t - lastT : 16;
    lastT = t;
    if (running) update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function bindHold(btn, key) {
    const down = (e) => {
      e.preventDefault();
      keys[key] = true;
      btn.classList.add("held");
      ensureAudio();
      if (key === "jump") jumpPressed = true;
      if (key === "attack") attackPressed = true;
    };
    const up = (e) => {
      e.preventDefault();
      keys[key] = false;
      btn.classList.remove("held");
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  bindHold(leftBtn, "left");
  bindHold(rightBtn, "right");
  bindHold(jumpBtn, "jump");
  bindHold(attackBtn, "attack");

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    ensureAudio();
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
      e.preventDefault();
      jumpPressed = true;
    }
    if (e.key === "j" || e.key === "J" || e.key === "k" || e.key === "K" || e.key === "z" || e.key === "Z") {
      attackPressed = true;
    }
    if (!running && (e.key === "Enter" || e.key === " ")) startBtn.click();
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });

  startBtn.addEventListener("click", () => {
    ensureAudio();
    hideOverlay();
    resetGame();
    running = true;
    tone(520, 0.08, "triangle", 0.06);
  });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "✕" : "♪";
    muteBtn.setAttribute("aria-label", muted ? "取消静音" : "声音");
  });

  window.addEventListener("resize", resize);
  resize();
  updateHud();
  showOverlay("小人出击！", "左右移动 · 跳跃 · 攻击打败怪物", "开始战斗");
  raf = requestAnimationFrame(loop);
})();
