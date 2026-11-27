(() => {
  const progressEl = document.getElementById("progress");
  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");
  const tagEl = document.getElementById("tag");
  const questionEl = document.getElementById("question");
  const choicesEl = document.getElementById("choices");
  const feedbackEl = document.getElementById("feedback");
  const panel = document.getElementById("panel");
  const startBtn = document.getElementById("start");
  const nextBtn = document.getElementById("next");
  const muteBtn = document.getElementById("mute");

  const ROUND = 10;
  const BANK = [
    { tag: "自然", q: "太阳从哪边升起？", options: ["东方", "西方", "南方", "北方"], answer: 0 },
    { tag: "自然", q: "一年大约有多少天？", options: ["365 天", "100 天", "30 天", "7 天"], answer: 0 },
    { tag: "自然", q: "下雨后天空常出现什么？", options: ["彩虹", "雪人", "流星", "火山"], answer: 0 },
    { tag: "自然", q: "蜜蜂最喜欢采什么？", options: ["花蜜", "石头", "沙子", "冰块"], answer: 0 },
    { tag: "动物", q: "熊猫最爱吃什么？", options: ["竹子", "汉堡", "西瓜籽", "辣椒"], answer: 0 },
    { tag: "动物", q: "哪种动物会汪汪叫？", options: ["狗", "猫", "鱼", "鸡"], answer: 0 },
    { tag: "动物", q: "青蛙小时候叫什么？", options: ["蝌蚪", "小鸡", "幼龙", "蛹"], answer: 0 },
    { tag: "动物", q: "哪种动物会下蛋？", options: ["鸡", "狗", "牛", "羊"], answer: 0 },
    { tag: "科学", q: "水在零度时会变成什么？", options: ["冰", "蒸汽", "沙子", "油"], answer: 0 },
    { tag: "科学", q: "人体呼吸主要需要什么气体？", options: ["氧气", "氮气气球", "氢气", "氦气"], answer: 0 },
    { tag: "科学", q: "地球绕着什么转？", options: ["太阳", "月亮", "火星", "北斗"], answer: 0 },
    { tag: "科学", q: "哪种东西能导电？", options: ["金属", "木头干枝", "橡胶手套", "棉花"], answer: 0 },
    { tag: "数学", q: "7 + 5 等于多少？", options: ["12", "10", "15", "9"], answer: 0 },
    { tag: "数学", q: "一个正方形有几条边？", options: ["4", "3", "5", "6"], answer: 0 },
    { tag: "数学", q: "一半的一半是多少？", options: ["四分之一", "三分之一", "全部", "零"], answer: 0 },
    { tag: "数学", q: "10 减去 3 等于？", options: ["7", "6", "8", "13"], answer: 0 },
    { tag: "生活", q: "过马路要先看什么？", options: ["红绿灯", "云彩", "月亮", "气球"], answer: 0 },
    { tag: "生活", q: "刷牙主要保护什么？", options: ["牙齿", "耳朵", "指甲", "头发"], answer: 0 },
    { tag: "生活", q: "饿了通常该做什么？", options: ["吃饭", "睡觉装饿", "只喝墨水", "对着墙说话"], answer: 0 },
    { tag: "生活", q: "下雨出门最好带什么？", options: ["雨伞", "泳圈", "雪橇", "风扇"], answer: 0 },
    { tag: "常识", q: "一周有几天？", options: ["7 天", "5 天", "10 天", "3 天"], answer: 0 },
    { tag: "常识", q: "中国的首都是哪里？", options: ["北京", "上海", "广州", "成都"], answer: 0 },
    { tag: "常识", q: "一天有几个小时？", options: ["24", "12", "60", "100"], answer: 0 },
    { tag: "常识", q: "哪种颜色混红和黄会接近？", options: ["橙色", "绿色", "紫色", "蓝色"], answer: 0 },
    { tag: "天文", q: "晚上天空最亮的通常是？", options: ["月亮", "蚂蚁", "石头", "树叶"], answer: 0 },
    { tag: "天文", q: "太空人穿的衣服叫什么？", options: ["宇航服", "雨衣", "睡衣", "校服"], answer: 0 },
    { tag: "植物", q: "树主要靠什么“喝水”？", options: ["根", "花瓣", "果实皮", "鸟窝"], answer: 0 },
    { tag: "植物", q: "向日葵喜欢朝向哪里？", options: ["太阳", "冰箱", "地底", "影子"], answer: 0 },
  ];

  let muted = false;
  let audioCtx = null;
  let deck = [];
  let index = 0;
  let score = 0;
  let streak = 0;
  let best = Number(localStorage.getItem("quiz-best") || 0);
  let locked = false;
  let playing = false;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur = 0.08, type = "sine", vol = 0.07) {
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

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function updateHud() {
    progressEl.textContent = playing ? `${Math.min(index + 1, ROUND)}/${ROUND}` : `0/${ROUND}`;
    scoreEl.textContent = String(score);
    streakEl.textContent = String(streak);
  }

  function withShuffledOptions(item) {
    const paired = item.options.map((text, i) => ({ text, i }));
    const shuffled = shuffle(paired);
    return {
      tag: item.tag,
      q: item.q,
      options: shuffled.map((p) => p.text),
      answer: shuffled.findIndex((p) => p.i === item.answer),
    };
  }

  function showStart() {
    playing = false;
    locked = true;
    tagEl.textContent = "准备";
    questionEl.textContent = "答对得分，连对还有加分！";
    choicesEl.replaceChildren();
    feedbackEl.textContent = best > 0 ? `历史最高 ${best} 分` : "点下面开始";
    feedbackEl.className = "feedback";
    startBtn.classList.remove("hidden");
    startBtn.textContent = "开始答题";
    nextBtn.classList.add("hidden");
    updateHud();
  }

  function renderQuestion() {
    const item = deck[index];
    locked = false;
    tagEl.textContent = item.tag;
    questionEl.textContent = item.q;
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";
    nextBtn.classList.add("hidden");
    startBtn.classList.add("hidden");

    panel.classList.remove("pop");
    void panel.offsetWidth;
    panel.classList.add("pop");

    const labels = ["A", "B", "C", "D"];
    choicesEl.replaceChildren();
    item.options.forEach((text, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.i = String(i);
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = labels[i];
      const span = document.createElement("span");
      span.textContent = text;
      btn.append(mark, span);
      choicesEl.append(btn);
    });
    updateHud();
  }

  function finish() {
    playing = false;
    locked = true;
    if (score > best) {
      best = score;
      localStorage.setItem("quiz-best", String(best));
    }
    tagEl.textContent = "完成";
    questionEl.textContent = score >= 16 ? "太厉害了！" : score >= 10 ? "答得不错！" : "再练练会更强！";
    choicesEl.replaceChildren();
    feedbackEl.textContent = `本局 ${score} 分 · 最高 ${best} 分`;
    feedbackEl.className = "feedback ok";
    startBtn.classList.remove("hidden");
    startBtn.textContent = "再来一局";
    nextBtn.classList.add("hidden");
    tone(660, 0.1, "sine", 0.06);
    tone(880, 0.12, "sine", 0.05);
    updateHud();
  }

  function pickAnswer(i) {
    if (!playing || locked) return;
    locked = true;
    const item = deck[index];
    const buttons = [...choicesEl.querySelectorAll(".choice")];
    buttons.forEach((b) => {
      b.disabled = true;
      const bi = Number(b.dataset.i);
      if (bi === item.answer) b.classList.add("correct");
      if (bi === i && i !== item.answer) b.classList.add("wrong");
    });

    if (i === item.answer) {
      streak += 1;
      const bonus = Math.min(2, streak - 1);
      score += 1 + bonus;
      feedbackEl.textContent = bonus > 0 ? `答对了！连对 +${1 + bonus}` : "答对了！+1";
      feedbackEl.className = "feedback ok";
      tone(620, 0.07, "triangle", 0.07);
      tone(840, 0.08, "sine", 0.05);
    } else {
      streak = 0;
      feedbackEl.textContent = `不对，答案是：${item.options[item.answer]}`;
      feedbackEl.className = "feedback bad";
      tone(180, 0.1, "sawtooth", 0.05);
    }

    updateHud();
    if (index >= ROUND - 1) {
      nextBtn.classList.add("hidden");
      startBtn.classList.remove("hidden");
      startBtn.textContent = "查看结果";
      startBtn.dataset.mode = "finish";
    } else {
      nextBtn.classList.remove("hidden");
      startBtn.classList.add("hidden");
      startBtn.dataset.mode = "";
    }
  }

  function startRound() {
    ensureAudio();
    deck = shuffle(BANK).slice(0, ROUND).map(withShuffledOptions);
    index = 0;
    score = 0;
    streak = 0;
    playing = true;
    startBtn.dataset.mode = "";
    renderQuestion();
    tone(520, 0.08, "triangle", 0.06);
  }

  choicesEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".choice");
    if (!btn) return;
    pickAnswer(Number(btn.dataset.i));
  });

  startBtn.addEventListener("click", () => {
    if (startBtn.dataset.mode === "finish") {
      finish();
      startBtn.dataset.mode = "";
      return;
    }
    startRound();
  });

  nextBtn.addEventListener("click", () => {
    if (!playing) return;
    index += 1;
    if (index >= ROUND) {
      finish();
      return;
    }
    renderQuestion();
    tone(440, 0.05, "sine", 0.04);
  });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "✕" : "♪";
    muteBtn.setAttribute("aria-label", muted ? "取消静音" : "声音");
  });

  showStart();
})();
