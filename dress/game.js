(() => {
  const el = {
    character: document.getElementById("character"),
    stageFrame: document.getElementById("stage-frame"),
    sceneBg: document.getElementById("scene-bg"),
    cats: document.getElementById("cats"),
    tray: document.getElementById("tray"),
    tip: document.getElementById("tip"),
    random: document.getElementById("random"),
    reset: document.getElementById("reset"),
    pose: document.getElementById("pose"),
  };

  const CATS = [
    { id: "hair", label: "发型" },
    { id: "face", label: "表情" },
    { id: "top", label: "上衣" },
    { id: "bottom", label: "下装" },
    { id: "shoes", label: "鞋子" },
    { id: "accessory", label: "配饰" },
    { id: "scene", label: "场景" },
  ];

  const SKIN = "#ffd7c2";
  const LINE = "#5a3a48";
  const svg = (inner) =>
    `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  const bodyBase = svg(`
    <ellipse cx="100" cy="248" rx="42" ry="8" fill="rgba(90,58,72,0.12)"/>
    <path d="M72 150 C70 186 74 220 78 238 L92 238 C90 210 90 180 92 156 Z" fill="${SKIN}"/>
    <path d="M128 150 C130 186 126 220 122 238 L108 238 C110 210 110 180 108 156 Z" fill="${SKIN}"/>
    <ellipse cx="100" cy="168" rx="38" ry="48" fill="${SKIN}"/>
    <circle cx="100" cy="88" r="42" fill="${SKIN}"/>
  `);

  const ITEMS = {
    hair: [
      // Paths frame the crown/sides only — bangs stop above the eyes (y≈70) so the face stays clear.
      { id: "bob", name: "短发", swatch: "#5b3a2e", icon: "💇", html: svg(`
        <path d="M56 96 C52 52 74 24 100 24 C126 24 148 52 144 96 C138 118 128 124 120 116 C118 108 116 96 116 88 C116 68 108 56 100 56 C92 56 84 68 84 88 C84 96 82 108 80 116 C72 124 62 118 56 96 Z" fill="#5b3a2e"/>
        <path d="M72 58 C82 48 92 52 100 50 C108 52 118 48 128 58 C120 66 110 64 100 62 C90 64 80 66 72 58 Z" fill="#5b3a2e"/>
      `) },
      { id: "twin", name: "双马尾", swatch: "#2d1f4a", icon: "🎀", html: svg(`
        <path d="M56 94 C52 48 74 22 100 22 C126 22 148 48 144 94 C136 116 126 122 118 112 C116 100 114 90 114 82 C114 64 108 54 100 54 C92 54 86 64 86 82 C86 90 84 100 82 112 C74 122 64 116 56 94 Z" fill="#2d1f4a"/>
        <path d="M74 56 C84 46 94 50 100 48 C106 50 116 46 126 56 C118 64 108 62 100 60 C92 62 82 64 74 56 Z" fill="#2d1f4a"/>
        <ellipse cx="42" cy="118" rx="16" ry="28" fill="#2d1f4a"/><ellipse cx="158" cy="118" rx="16" ry="28" fill="#2d1f4a"/>
        <circle cx="48" cy="92" r="7" fill="#ff6aa8"/><circle cx="152" cy="92" r="7" fill="#ff6aa8"/>
      `) },
      { id: "long", name: "长发", swatch: "#c45c26", icon: "🧡", html: svg(`
        <path d="M50 98 C46 44 74 16 100 16 C126 16 154 44 150 98 C152 150 144 198 134 218 C124 180 122 140 120 112 C118 102 116 92 116 84 C116 64 108 52 100 52 C92 52 84 64 84 84 C84 92 82 102 80 112 C78 140 76 180 66 218 C56 198 48 150 50 98 Z" fill="#c45c26"/>
        <path d="M70 54 C82 42 92 48 100 46 C108 48 118 42 130 54 C120 64 110 60 100 58 C90 60 80 64 70 54 Z" fill="#c45c26"/>
      `) },
      { id: "curly", name: "卷卷头", swatch: "#f2c14e", icon: "💛", html: svg(`
        <circle cx="68" cy="52" r="16" fill="#f2c14e"/><circle cx="100" cy="36" r="18" fill="#f2c14e"/><circle cx="132" cy="52" r="16" fill="#f2c14e"/>
        <circle cx="56" cy="78" r="14" fill="#f2c14e"/><circle cx="144" cy="78" r="14" fill="#f2c14e"/>
        <path d="M62 100 C60 58 80 40 100 40 C120 40 140 58 138 100 C130 118 120 116 116 104 C114 92 110 82 100 82 C90 82 86 92 84 104 C80 116 70 118 62 100 Z" fill="#f2c14e"/>
        <path d="M78 58 C88 50 96 54 100 52 C104 54 112 50 122 58 C114 66 106 62 100 60 C94 62 86 66 78 58 Z" fill="#f2c14e"/>
      `) },
      { id: "pixie", name: "精灵剪", swatch: "#3d6b5a", icon: "🌿", html: svg(`
        <path d="M60 92 C54 56 76 30 100 28 C126 26 148 52 142 90 C134 74 120 66 112 74 C108 56 92 56 88 74 C80 66 68 72 60 92 Z" fill="#3d6b5a"/>
        <path d="M78 54 C88 46 96 50 100 48 C104 50 112 46 122 54 C114 60 106 58 100 56 C94 58 86 60 78 54 Z" fill="#3d6b5a"/>
      `) },
      { id: "bun", name: "丸子头", swatch: "#4a2c1a", icon: "🍡", html: svg(`
        <circle cx="100" cy="30" r="18" fill="#4a2c1a"/><circle cx="100" cy="30" r="8" fill="#ff8fbf"/>
        <path d="M58 96 C54 50 76 28 100 28 C124 28 146 50 142 96 C134 116 124 120 118 110 C116 98 114 88 114 80 C114 62 108 52 100 52 C92 52 86 62 86 80 C86 88 84 98 82 110 C76 120 66 116 58 96 Z" fill="#4a2c1a"/>
        <path d="M74 54 C86 44 94 48 100 46 C106 48 114 44 126 54 C116 62 108 58 100 56 C92 58 84 62 74 54 Z" fill="#4a2c1a"/>
      `) },
    ],
    face: [
      { id: "smile", name: "微笑", swatch: "#fff", icon: "😊", html: svg(`<ellipse cx="84" cy="86" rx="7" ry="9" fill="${LINE}"/><ellipse cx="116" cy="86" rx="7" ry="9" fill="${LINE}"/><circle cx="86" cy="84" r="2.2" fill="#fff"/><circle cx="118" cy="84" r="2.2" fill="#fff"/><path d="M90 104 C96 110 104 110 110 104" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/><ellipse cx="72" cy="96" rx="7" ry="4" fill="#ff9aa8" opacity="0.55"/><ellipse cx="128" cy="96" rx="7" ry="4" fill="#ff9aa8" opacity="0.55"/>`) },
      { id: "wink", name: "眨眼", swatch: "#fff", icon: "😉", html: svg(`<ellipse cx="84" cy="86" rx="7" ry="9" fill="${LINE}"/><circle cx="86" cy="84" r="2.2" fill="#fff"/><path d="M108 86 Q116 80 124 86" fill="none" stroke="${LINE}" stroke-width="3.2" stroke-linecap="round"/><path d="M92 104 C98 111 106 111 112 104" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`) },
      { id: "sparkle", name: "星星眼", swatch: "#fff", icon: "✨", html: svg(`<ellipse cx="84" cy="86" rx="8" ry="10" fill="${LINE}"/><ellipse cx="116" cy="86" rx="8" ry="10" fill="${LINE}"/><path d="M84 78 L86 84 L92 86 L86 88 L84 94 L82 88 L76 86 L82 84 Z" fill="#ffe56a"/><path d="M116 78 L118 84 L124 86 L118 88 L116 94 L114 88 L108 86 L114 84 Z" fill="#ffe56a"/><path d="M94 106 Q100 112 106 106" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`) },
      { id: "shy", name: "害羞", swatch: "#fff", icon: "😳", html: svg(`<path d="M76 88 Q84 82 92 88" fill="none" stroke="${LINE}" stroke-width="3.2" stroke-linecap="round"/><path d="M108 88 Q116 82 124 88" fill="none" stroke="${LINE}" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="100" cy="108" rx="8" ry="5" fill="#ff7a9a"/><ellipse cx="70" cy="98" rx="9" ry="5" fill="#ff9aa8" opacity="0.7"/><ellipse cx="130" cy="98" rx="9" ry="5" fill="#ff9aa8" opacity="0.7"/>`) },
      { id: "cool", name: "酷酷", swatch: "#222", icon: "😎", html: svg(`<rect x="70" y="78" width="60" height="16" rx="8" fill="#2a2438"/><rect x="74" y="80" width="22" height="12" rx="6" fill="#7ec8ff"/><rect x="104" y="80" width="22" height="12" rx="6" fill="#7ec8ff"/><path d="M94 106 C98 110 102 110 106 106" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`) },
    ],
    top: [
      { id: "tee", name: "T恤", swatch: "#7ec8ff", icon: "👕", html: svg(`<path d="M62 132 C70 122 86 120 100 120 C114 120 130 122 138 132 L148 148 L130 156 L126 148 L126 188 L74 188 L74 148 L70 156 L52 148 Z" fill="#7ec8ff"/><circle cx="100" cy="150" r="5" fill="#fff" opacity="0.7"/>`) },
      { id: "hoodie", name: "卫衣", swatch: "#ff8fbf", icon: "🧥", html: svg(`<path d="M62 130 C72 118 86 116 100 116 C114 116 128 118 138 130 L152 150 L132 160 L128 150 L128 192 L72 192 L72 150 L68 160 L48 150 Z" fill="#ff8fbf"/><path d="M86 118 C90 108 110 108 114 118" fill="#ff8fbf"/><rect x="92" y="148" width="16" height="28" rx="6" fill="#ffd6ec"/>`) },
      { id: "dress", name: "连衣裙", swatch: "#c7a0ff", icon: "👗", html: svg(`<path d="M68 128 C78 118 90 116 100 116 C110 116 122 118 132 128 L140 150 L128 154 L150 210 L50 210 L72 154 L60 150 Z" fill="#c7a0ff"/>`) },
      { id: "jacket", name: "外套", swatch: "#ff9a4a", icon: "🧡", html: svg(`<path d="M60 132 C72 118 88 116 100 116 C112 116 128 118 140 132 L154 152 L134 162 L128 152 L128 192 L72 192 L72 152 L66 162 L46 152 Z" fill="#ff9a4a"/><path d="M100 120 L100 192" stroke="#fff" stroke-width="4" opacity="0.55"/>`) },
      { id: "tank", name: "吊带", swatch: "#6fe3c0", icon: "💚", html: svg(`<path d="M78 128 L86 120 L94 132 L106 132 L114 120 L122 128 L124 188 L76 188 Z" fill="#6fe3c0"/>`) },
      { id: "startee", name: "星星衫", swatch: "#5b8cff", icon: "⭐", html: svg(`<path d="M62 132 C70 122 86 120 100 120 C114 120 130 122 138 132 L148 148 L130 156 L126 148 L126 188 L74 188 L74 148 L70 156 L52 148 Z" fill="#5b8cff"/><path d="M100 142 L104 152 L114 154 L106 160 L108 170 L100 164 L92 170 L94 160 L86 154 L96 152 Z" fill="#ffe56a"/>`) },
    ],
    bottom: [
      { id: "skirt", name: "短裙", swatch: "#ff7eb3", icon: "👗", html: svg(`<path d="M74 186 L126 186 L142 230 L58 230 Z" fill="#ff7eb3"/>`) },
      { id: "jeans", name: "牛仔裤", swatch: "#4f7cff", icon: "👖", html: svg(`<path d="M76 186 L124 186 L128 238 L104 238 L100 210 L96 238 L72 238 Z" fill="#4f7cff"/>`) },
      { id: "shorts", name: "短裤", swatch: "#ffd56a", icon: "🩳", html: svg(`<path d="M76 186 L124 186 L132 220 L104 220 L100 204 L96 220 L68 220 Z" fill="#ffd56a"/>`) },
      { id: "pleats", name: "百褶裙", swatch: "#a78bfa", icon: "💜", html: svg(`<path d="M74 186 L126 186 L146 232 L54 232 Z" fill="#a78bfa"/><path d="M86 186 L78 232 M100 186 L100 232 M114 186 L122 232" stroke="#8b6cf0" stroke-width="3" opacity="0.65"/>`) },
      { id: "leggings", name: "打底裤", swatch: "#3a2740", icon: "🖤", html: svg(`<path d="M78 186 L122 186 L126 238 L106 238 L102 214 L98 238 L74 238 Z" fill="#3a2740"/>`) },
      { id: "none", name: "无", swatch: "#eee", icon: "", none: true, html: "" },
    ],
    shoes: [
      { id: "sneakers", name: "球鞋", swatch: "#fff", icon: "👟", html: svg(`<ellipse cx="82" cy="242" rx="16" ry="8" fill="#fff"/><ellipse cx="118" cy="242" rx="16" ry="8" fill="#fff"/><rect x="70" y="232" width="24" height="10" rx="5" fill="#7ec8ff"/><rect x="106" y="232" width="24" height="10" rx="5" fill="#7ec8ff"/>`) },
      { id: "boots", name: "短靴", swatch: "#5b3a2e", icon: "🥾", html: svg(`<path d="M70 220 L94 220 L96 246 L68 246 Z" fill="#5b3a2e"/><path d="M106 220 L130 220 L132 246 L104 246 Z" fill="#5b3a2e"/>`) },
      { id: "heels", name: "小高跟", swatch: "#ff4d8d", icon: "👠", html: svg(`<path d="M70 234 L96 234 L94 244 L84 244 L82 250 L74 250 L76 244 L68 244 Z" fill="#ff4d8d"/><path d="M104 234 L130 234 L132 244 L124 244 L122 250 L114 250 L116 244 L106 244 Z" fill="#ff4d8d"/>`) },
      { id: "sandals", name: "凉鞋", swatch: "#ffd56a", icon: "🩴", html: svg(`<ellipse cx="82" cy="244" rx="15" ry="6" fill="#ffd56a"/><ellipse cx="118" cy="244" rx="15" ry="6" fill="#ffd56a"/>`) },
      { id: "socks", name: "袜子", swatch: "#ffb4d4", icon: "🧦", html: svg(`<path d="M72 228 L94 228 L96 246 L70 246 Z" fill="#ffb4d4"/><path d="M106 228 L128 228 L130 246 L104 246 Z" fill="#ffb4d4"/>`) },
      { id: "none", name: "无", swatch: "#eee", icon: "", none: true, html: "" },
    ],
    accessory: [
      { id: "bow", name: "蝴蝶结", swatch: "#ff4d8d", icon: "🎀", html: svg(`<path d="M118 42 L138 30 L138 54 Z" fill="#ff4d8d"/><path d="M138 42 L158 30 L158 54 Z" fill="#ff4d8d"/><circle cx="138" cy="42" r="6" fill="#ffe56a"/>`) },
      { id: "crown", name: "小皇冠", swatch: "#ffd56a", icon: "👑", html: svg(`<path d="M74 48 L84 28 L94 44 L100 24 L106 44 L116 28 L126 48 L74 48 Z" fill="#ffd56a"/>`) },
      { id: "glasses", name: "圆眼镜", swatch: "#5a3a48", icon: "👓", html: svg(`<circle cx="84" cy="88" r="12" fill="none" stroke="#5a3a48" stroke-width="3"/><circle cx="116" cy="88" r="12" fill="none" stroke="#5a3a48" stroke-width="3"/><path d="M96 88 H104" stroke="#5a3a48" stroke-width="3"/>`) },
      { id: "scarf", name: "围巾", swatch: "#ff9a4a", icon: "🧣", html: svg(`<path d="M70 126 C84 138 116 138 130 126 C124 146 112 152 100 152 C88 152 76 146 70 126 Z" fill="#ff9a4a"/>`) },
      { id: "bag", name: "小包", swatch: "#6fe3c0", icon: "👜", html: svg(`<rect x="140" y="168" width="28" height="22" rx="6" fill="#6fe3c0"/><path d="M146 168 Q154 156 162 168" fill="none" stroke="#3fb894" stroke-width="3"/>`) },
      { id: "none", name: "无", swatch: "#eee", icon: "", none: true, html: "" },
    ],
    scene: [
      { id: "pink", name: "甜心粉", swatch: "#ffd6ec", icon: "💗", scene: "linear-gradient(165deg, #ffd6ec 0%, #ffe8f4 42%, #d9f0ff 100%)", frame: "rgba(255,255,255,0.28)", html: "" },
      { id: "mint", name: "清新绿", swatch: "#c9f5e4", icon: "🌿", scene: "linear-gradient(165deg, #c9f5e4 0%, #e8fff8 45%, #dff3ff 100%)", frame: "rgba(255,255,255,0.3)", html: "" },
      { id: "sunset", name: "日落橙", swatch: "#ffd9a0", icon: "🌅", scene: "linear-gradient(165deg, #ffb070 0%, #ffe0b0 40%, #ffc1d8 100%)", frame: "rgba(255,255,255,0.28)", html: "" },
      { id: "night", name: "星夜", swatch: "#4a3f8c", icon: "🌙", scene: "linear-gradient(165deg, #2a2450 0%, #4a3f8c 50%, #7a5f9a 100%)", frame: "rgba(255,255,255,0.12)", html: "" },
      { id: "candy", name: "糖果屋", swatch: "#ffb4d4", icon: "🍬", scene: "radial-gradient(circle at 30% 20%, #fff7c2, transparent 35%), linear-gradient(165deg, #ffb4d4 0%, #d9c2ff 50%, #9ad4ff 100%)", frame: "rgba(255,255,255,0.32)", html: "" },
      { id: "beach", name: "海边", swatch: "#7ec8ff", icon: "🏖️", scene: "linear-gradient(180deg, #7ec8ff 0%, #b8e4ff 45%, #ffe9b0 100%)", frame: "rgba(255,255,255,0.28)", html: "" },
    ],
  };

  const DEFAULTS = {
    hair: "twin",
    face: "smile",
    top: "hoodie",
    bottom: "skirt",
    shoes: "sneakers",
    accessory: "bow",
    scene: "pink",
  };

  const state = { ...DEFAULTS };
  let activeCat = "hair";
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tapSound(bright = true) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(bright ? 880 : 620, t0);
    osc.frequency.exponentialRampToValueAtTime(bright ? 1320 : 420, t0 + 0.08);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  function sparkleSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [980, 1240, 1560].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + i * 0.045;
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  function findItem(cat, id) {
    return ITEMS[cat].find((x) => x.id === id) || ITEMS[cat][0];
  }

  function renderCharacter(popCat) {
    const parts = {
      body: bodyBase,
      hair: findItem("hair", state.hair).html,
      face: findItem("face", state.face).html,
      top: findItem("top", state.top).html,
      bottom: findItem("bottom", state.bottom).html,
      shoes: findItem("shoes", state.shoes).html,
      accessory: findItem("accessory", state.accessory).html,
    };
    if (state.top === "dress") parts.bottom = "";

    el.character.replaceChildren();
    // Face above hair so eyes stay visible; accessory on top for bows/crowns.
    ["body", "bottom", "top", "shoes", "hair", "face", "accessory"].forEach((key) => {
      if (!parts[key]) return;
      const layer = document.createElement("div");
      layer.className = "layer" + (popCat === key ? " pop" : "");
      layer.dataset.layer = key;
      layer.insertAdjacentHTML("afterbegin", parts[key]);
      el.character.append(layer);
    });

    const scene = findItem("scene", state.scene);
    el.sceneBg.style.background = scene.scene;
    el.stageFrame.style.background = `radial-gradient(circle at 50% 18%, rgba(255,255,255,0.55), transparent 42%), ${scene.frame}`;
  }

  function renderCats() {
    el.cats.replaceChildren();
    CATS.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat" + (c.id === activeCat ? " active" : "");
      btn.dataset.cat = c.id;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", c.id === activeCat ? "true" : "false");
      btn.textContent = c.label;
      el.cats.append(btn);
    });
  }

  function renderTray() {
    el.tray.replaceChildren();
    ITEMS[activeCat].forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "item" + (state[activeCat] === item.id ? " selected" : "");
      btn.dataset.id = item.id;
      btn.setAttribute("aria-label", item.name);
      btn.title = item.name;
      if (item.none) {
        const mark = document.createElement("span");
        mark.className = "none-mark";
        mark.textContent = "无";
        btn.append(mark);
      } else {
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = item.swatch;
        swatch.textContent = item.icon || "";
        btn.append(swatch);
      }
      el.tray.append(btn);
    });
  }

  function selectItem(id) {
    if (state[activeCat] === id) return;
    state[activeCat] = id;
    const item = findItem(activeCat, id);
    el.tip.textContent = activeCat === "scene" ? `场景：${item.name}` : `已换上：${item.name}`;
    tapSound(true);
    renderCharacter(activeCat === "scene" ? null : activeCat);
    renderTray();
  }

  function randomOutfit() {
    CATS.forEach((c) => {
      const pool = ITEMS[c.id].filter((x) => !x.none || Math.random() > 0.7);
      state[c.id] = pool[Math.floor(Math.random() * pool.length)].id;
    });
    if (state.top === "dress") state.bottom = "none";
    else if (state.bottom === "none") state.bottom = "skirt";
    sparkleSound();
    el.tip.textContent = "随机新造型！";
    renderCharacter("hair");
    renderTray();
    el.stageFrame.classList.remove("pose");
    void el.stageFrame.offsetWidth;
    el.stageFrame.classList.add("pose");
  }

  function resetOutfit() {
    Object.assign(state, DEFAULTS);
    tapSound(false);
    el.tip.textContent = "已还原默认造型";
    renderCharacter("top");
    renderTray();
  }

  function doPose() {
    sparkleSound();
    el.tip.textContent = "可爱～";
    el.stageFrame.classList.remove("pose");
    void el.stageFrame.offsetWidth;
    el.stageFrame.classList.add("pose");
  }

  el.cats.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat");
    if (!btn) return;
    activeCat = btn.dataset.cat;
    tapSound(false);
    renderCats();
    renderTray();
  });

  el.tray.addEventListener("click", (e) => {
    const btn = e.target.closest(".item");
    if (!btn) return;
    selectItem(btn.dataset.id);
  });

  el.random.addEventListener("click", randomOutfit);
  el.reset.addEventListener("click", resetOutfit);
  el.pose.addEventListener("click", doPose);

  const unlock = () => {
    ensureAudio();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock);

  renderCats();
  renderTray();
  renderCharacter();
})();
