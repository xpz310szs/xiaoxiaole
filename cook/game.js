(() => {
  const el = {
    score: document.getElementById("score"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    customer: document.getElementById("customer"),
    orderName: document.getElementById("order-name"),
    orderSteps: document.getElementById("order-steps"),
    timerBar: document.getElementById("timer-bar"),
    plate: document.getElementById("plate"),
    hint: document.getElementById("hint"),
    tray: document.getElementById("tray"),
    clear: document.getElementById("clear"),
    serve: document.getElementById("serve"),
    mute: document.getElementById("mute"),
    toast: document.getElementById("toast"),
  };

  const INGS = {
    bun: { name: "面包", emoji: "🍞", color: "#e8c07a" },
    patty: { name: "肉饼", emoji: "🥩", color: "#8b4513" },
    lettuce: { name: "生菜", emoji: "🥬", color: "#6fbf4a" },
    cheese: { name: "芝士", emoji: "🧀", color: "#ffd56a" },
    tomato: { name: "番茄", emoji: "🍅", color: "#ff5a4a" },
    rice: { name: "米饭", emoji: "🍚", color: "#f5f0e6" },
    fish: { name: "鱼肉", emoji: "🐟", color: "#7ec8ff" },
    seaweed: { name: "海苔", emoji: "🪸", color: "#2f6b58" },
    noodle: { name: "面条", emoji: "🍜", color: "#f0c878" },
    egg: { name: "鸡蛋", emoji: "🥚", color: "#fff4c8" },
    onion: { name: "葱花", emoji: "🧅", color: "#c8e6a0" },
    berry: { name: "莓果", emoji: "🍓", color: "#ff6a9a" },
    milk: { name: "牛奶", emoji: "🥛", color: "#f7f7f7" },
    banana: { name: "香蕉", emoji: "🍌", color: "#ffe56a" },
    taco: { name: "饼皮", emoji: "🫓", color: "#e0b070" },
    salsa: { name: "酱料", emoji: "🌶️", color: "#ff7a3a" },
  };

  const RECIPES = [
    {
      id: "burger",
      name: "星星汉堡",
      face: "😋",
      time: 18,
      steps: ["bun", "patty", "lettuce", "cheese", "bun"],
    },
    {
      id: "cheese-burger",
      name: "双层芝士堡",
      face: "🤩",
      time: 20,
      steps: ["bun", "patty", "cheese", "tomato", "bun"],
    },
    {
      id: "sushi",
      name: "海苔寿司",
      face: "🙂",
      time: 16,
      steps: ["rice", "fish", "seaweed"],
    },
    {
      id: "ramen",
      name: "暖暖拉面",
      face: "🤤",
      time: 18,
      steps: ["noodle", "egg", "onion", "lettuce"],
    },
    {
      id: "smoothie",
      name: "莓果奶昔",
      face: "😎",
      time: 14,
      steps: ["milk", "berry", "banana"],
    },
    {
      id: "taco",
      name: "脆脆塔可",
      face: "🥳",
      time: 16,
      steps: ["taco", "patty", "lettuce", "salsa", "cheese"],
    },
    {
      id: "salad",
      name: "活力沙拉",
      face: "😊",
      time: 15,
      steps: ["lettuce", "tomato", "cheese", "onion"],
    },
  ];

  const ALL_KEYS = Object.keys(INGS);

  let score = 0;
  let streak = 0;
  let best = Number(localStorage.getItem("cook-best") || 0);
  let built = [];
  let order = null;
  let timeLeft = 0;
  let timeMax = 1;
  let muted = false;
  let audioCtx = null;
  let raf = 0;
  let lastT = 0;
  let toastTimer = null;

  el.best.textContent = String(best);

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

  function showToast(text) {
    el.toast.textContent = text;
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 900);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function renderTray(keys) {
    el.tray.innerHTML = keys.map((key) => {
      const ing = INGS[key];
      return `<button type="button" class="ing" data-key="${key}" aria-label="${ing.name}">
        <span class="emoji">${ing.emoji}</span>
        <span class="name">${ing.name}</span>
      </button>`;
    }).join("");
  }

  function trayForOrder(recipe) {
    const need = [...new Set(recipe.steps)];
    const others = ALL_KEYS.filter((k) => !need.includes(k));
    shuffle(others);
    const extras = others.slice(0, Math.max(0, 8 - need.length));
    return shuffle([...need, ...extras]);
  }

  function renderPlate() {
    el.plate.innerHTML = built
      .map((key) => `<span class="bit">${INGS[key].emoji}</span>`)
      .join("");
  }

  function nextNeeded() {
    if (!order) return null;
    return order.steps[built.length] || null;
  }

  function updateHint() {
    const need = nextNeeded();
    if (!need) {
      el.hint.textContent = "完成了！点「上菜」";
      return;
    }
    el.hint.textContent = `下一步：${INGS[need].emoji} ${INGS[need].name}`;
  }

  function newOrder() {
    const pick = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    order = pick;
    built = [];
    timeMax = pick.time;
    timeLeft = pick.time;
    el.customer.textContent = pick.face;
    el.orderName.textContent = pick.name;
    el.orderSteps.textContent = pick.steps.map((k) => INGS[k].emoji).join(" → ");
    el.timerBar.style.transform = "scaleX(1)";
    renderTray(trayForOrder(pick));
    renderPlate();
    updateHint();
  }

  function addIng(key) {
    ensureAudio();
    if (!order) return;
    if (built.length >= order.steps.length) {
      showToast("已经装好了，快上菜");
      tone(280, 0.06, "square", 0.04);
      return;
    }
    const need = nextNeeded();
    if (key !== need) {
      streak = 0;
      el.streak.textContent = "0";
      showToast(`错了，要 ${INGS[need].emoji}`);
      tone(180, 0.1, "sawtooth", 0.05);
      // small time penalty
      timeLeft = Math.max(2, timeLeft - 1.2);
      return;
    }
    built.push(key);
    renderPlate();
    updateHint();
    tone(520 + built.length * 40, 0.07, "triangle", 0.07);
  }

  function clearPlate() {
    built = [];
    renderPlate();
    updateHint();
    tone(320, 0.06, "sine", 0.05);
  }

  function serve() {
    ensureAudio();
    if (!order) return;
    const ok =
      built.length === order.steps.length &&
      built.every((k, i) => k === order.steps[i]);
    if (!ok) {
      streak = 0;
      el.streak.textContent = "0";
      showToast("还没做好哦");
      tone(200, 0.1, "square", 0.05);
      return;
    }
    const speedBonus = Math.ceil(timeLeft * 2);
    const streakBonus = streak * 5;
    const gain = 50 + speedBonus + streakBonus;
    score += gain;
    streak += 1;
    if (score > best) {
      best = score;
      localStorage.setItem("cook-best", String(best));
      el.best.textContent = String(best);
    }
    el.score.textContent = String(score);
    el.streak.textContent = String(streak);
    showToast(`完美 +${gain}`);
    tone(720, 0.08, "sine", 0.08);
    setTimeout(() => tone(960, 0.1, "sine", 0.08), 70);
    newOrder();
  }

  function failOrder() {
    streak = 0;
    el.streak.textContent = "0";
    showToast("超时了…");
    tone(140, 0.18, "sawtooth", 0.05);
    newOrder();
  }

  function tick(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (order) {
      timeLeft -= dt;
      const p = Math.max(0, timeLeft / timeMax);
      el.timerBar.style.transform = `scaleX(${p})`;
      if (timeLeft <= 0) failOrder();
    }
    raf = requestAnimationFrame(tick);
  }

  el.tray.addEventListener("click", (e) => {
    const btn = e.target.closest(".ing");
    if (!btn) return;
    addIng(btn.dataset.key);
  });
  el.clear.addEventListener("click", clearPlate);
  el.serve.addEventListener("click", serve);
  el.mute.addEventListener("click", () => {
    muted = !muted;
    el.mute.classList.toggle("muted", muted);
    el.mute.textContent = muted ? "✕" : "♪";
  });

  newOrder();
  lastT = performance.now();
  raf = requestAnimationFrame(tick);
})();
