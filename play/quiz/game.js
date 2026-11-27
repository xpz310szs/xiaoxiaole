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

  const ROUND = 20;
  const BANK = [
    { tag: "科学", q: "光在真空中的速度大约是多少？", options: ["约 30 万公里/秒", "约 340 米/秒", "约 1 公里/秒", "约 3 公里/时"], answer: 0 },
    { tag: "科学", q: "DNA 双螺旋结构主要由谁提出？", options: ["沃森与克里克", "牛顿与胡克", "达尔文与华莱士", "伽利略与开普勒"], answer: 0 },
    { tag: "科学", q: "元素周期表中，氧元素的化学符号是？", options: ["O", "Ox", "Au", "Om"], answer: 0 },
    { tag: "科学", q: "人体最大的器官是？", options: ["皮肤", "肝脏", "大脑", "心脏"], answer: 0 },
    { tag: "科学", q: "声音不能在哪种环境中传播？", options: ["真空", "水中", "空气中", "钢轨上"], answer: 0 },
    { tag: "科学", q: "下列哪种属于可再生能源？", options: ["太阳能", "煤炭", "石油", "天然气"], answer: 0 },
    { tag: "天文", q: "太阳系中体积最大的行星是？", options: ["木星", "土星", "海王星", "地球"], answer: 0 },
    { tag: "天文", q: "月球绕地球公转大约需要多久？", options: ["约 27 天", "约 7 天", "约 365 天", "约 24 小时"], answer: 0 },
    { tag: "天文", q: "黑洞理论与哪位物理学家关系最密切？", options: ["霍金", "爱迪生", "法拉第", "焦耳"], answer: 0 },
    { tag: "地理", q: "世界上面积最大的大洋是？", options: ["太平洋", "大西洋", "印度洋", "北冰洋"], answer: 0 },
    { tag: "地理", q: "长江最终流入哪片海？", options: ["东海", "渤海", "南海", "黄海深处峡谷"], answer: 0 },
    { tag: "地理", q: "珠穆朗玛峰位于哪条山脉？", options: ["喜马拉雅山脉", "昆仑山脉", "天山山脉", "秦岭"], answer: 0 },
    { tag: "地理", q: "赤道穿过下列哪个大洲？", options: ["非洲", "欧洲", "南极洲", "北美洲全境"], answer: 0 },
    { tag: "历史", q: "秦始皇统一六国后推行的文字是？", options: ["小篆", "甲骨文", "楷书", "草书"], answer: 0 },
    { tag: "历史", q: "丝绸之路主要连接古代中国与？", options: ["中亚与欧洲等地", "南极科考站", "北极圈渔村", "美洲原住民部落"], answer: 0 },
    { tag: "历史", q: "第一次世界大战爆发于哪一年？", options: ["1914 年", "1840 年", "1939 年", "1949 年"], answer: 0 },
    { tag: "历史", q: "《本草纲目》的作者是？", options: ["李时珍", "华佗", "张仲景", "扁鹊"], answer: 0 },
    { tag: "数学", q: "直角三角形中，直角边 a、b 与斜边 c 满足？", options: ["a² + b² = c²", "a + b = c", "a × b = c", "a² − b² = c"], answer: 0 },
    { tag: "数学", q: "圆周率 π 约等于多少？", options: ["3.1416", "2.718", "1.414", "0.577"], answer: 0 },
    { tag: "数学", q: "一个正六边形的每个内角是多少度？", options: ["120°", "90°", "60°", "135°"], answer: 0 },
    { tag: "数学", q: "质数 2 之后的下一个质数是？", options: ["3", "4", "6", "9"], answer: 0 },
    { tag: "语文", q: "“春眠不觉晓”的下一句是？", options: ["处处闻啼鸟", "夜来风雨声", "疑是地上霜", "床前明月光"], answer: 0 },
    { tag: "语文", q: "成语“画蛇添足”比喻？", options: ["多此一举", "雪中送炭", "口若悬河", "守株待兔"], answer: 0 },
    { tag: "语文", q: "《西游记》中去西天取经的主要人物是？", options: ["唐僧师徒", "刘备关张", "宋江林冲", "贾宝玉林黛玉"], answer: 0 },
    { tag: "语文", q: "“但愿人长久，千里共婵娟”写的是？", options: ["月亮", "太阳", "江河", "梅花"], answer: 0 },
    { tag: "常识", q: "电脑里 CPU 的主要作用是？", options: ["运算与控制", "长期存放大文件", "显示画面", "播放音响"], answer: 0 },
    { tag: "常识", q: "红绿灯中，表示可以通行的通常是？", options: ["绿灯", "红灯", "黄灯常亮", "蓝灯"], answer: 0 },
    { tag: "常识", q: "北京时间属于哪个时区？", options: ["东八区", "西五区", "零时区", "东三区"], answer: 0 },
    { tag: "常识", q: "维生素 C 含量通常较高的水果是？", options: ["橙子", "奶油蛋糕", "油条", "巧克力"], answer: 0 },
    { tag: "自然", q: "光合作用主要发生在植物的？", options: ["叶绿体", "细胞核", "细胞壁空隙", "根毛尖端唯一处"], answer: 0 },
    { tag: "自然", q: "地震强度常用什么来表示？", options: ["震级", "温度", "湿度", "气压差唯一指标"], answer: 0 },
    { tag: "自然", q: "臭氧层主要保护地球免受？", options: ["紫外线过量照射", "潮汐涨落", "地磁偏转", "流星雨噪音"], answer: 0 },
    { tag: "动物", q: "蝙蝠导航主要依靠？", options: ["回声定位", "红外照相", "星图导航", "指南针感应"], answer: 0 },
    { tag: "动物", q: "企鹅主要生活在哪个半球？", options: ["南半球", "北半球极圈内唯一", "赤道雨林", "亚洲沙漠"], answer: 0 },
    { tag: "经济", q: "人民币的官方发行机构是？", options: ["中国人民银行", "财政部印刷厂任意店", "证券交易所", "商业银行联盟"], answer: 0 },
    { tag: "科技", q: "万维网（WWW）的英文全称核心是？", options: ["World Wide Web", "Wide Wireless Wave", "Web Word Work", "Wireless World Wire"], answer: 0 },
    { tag: "科技", q: "二进制里 1010 对应十进制是？", options: ["10", "8", "12", "5"], answer: 0 },
    { tag: "科技", q: "智能手机触屏多属于哪种技术？", options: ["电容式触控", "纯机械按钮阵列", "磁悬浮感应", "气味传感"], answer: 0 },
    { tag: "艺术", q: "《蒙娜丽莎》的作者是？", options: ["达·芬奇", "梵高", "毕加索", "莫奈"], answer: 0 },
    { tag: "艺术", q: "钢琴属于哪一类乐器？", options: ["键盘乐器", "管乐器唯一类", "打击乐专用", "弦乐拨片类"], answer: 0 },
    { tag: "体育", q: "足球比赛每方上场通常几人？", options: ["11 人", "5 人", "9 人", "15 人"], answer: 0 },
    { tag: "体育", q: "奥运会现代复兴始于哪一年？", options: ["1896 年", "1900 年", "1948 年", "2008 年"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么东西越洗越脏？", options: ["水", "肥皂", "手", "衣服"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么东西打断了也不会痛？", options: ["话题", "筷子", "树枝", "铅笔芯"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么门永远关不上？", options: ["球门", "房门", "柜门", "电梯门"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么帽不能戴？", options: ["螺帽", "草帽", "冬帽", "棒球帽"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么牛不吃草？", options: ["蜗牛", "水牛", "黄牛", "奶牛"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么布剪不断？", options: ["瀑布", "抹布", "桌布", "纱布"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么东西没脚却能跑？", options: ["水", "石头", "椅子", "书包"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么蛋打不破？", options: ["脸蛋", "鸡蛋", "鸭蛋", "鸟蛋"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么东西越热越爱出来？", options: ["汗", "冰", "雪", "霜"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么东西白天少、夜里多？", options: ["星星", "太阳", "彩虹", "云朵"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么书通常没有“故事情节”？", options: ["字典", "小说", "童话", "连环画"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么路最窄？", options: ["冤家路窄", "高速公路", "乡间小路", "人行道"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么茶不能喝？", options: ["牙茶", "绿茶", "红茶", "花茶"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“点”不能吃？", options: ["小数点", "点心", "汤圆", "包子"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“鸡”没有翅膀？", options: ["田鸡", "公鸡", "母鸡", "雏鸡"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“头”最硬？", options: ["石头", "拳头", "馒头", "芋头"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“花”不能插在花瓶里？", options: ["雪花", "菊花", "梅花", "桃花"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“鱼”不能吃？", options: ["木鱼", "带鱼", "鲤鱼", "草鱼"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“年”人人都喜欢？", options: ["过年", "明年", "去年", "中年"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“气”人人都需要？", options: ["空气", "脾气", "傲气", "雾气"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“洞”填不满？", options: ["无底洞", "山洞", "蚁洞", "树洞"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“包”人人都想要？", options: ["红包", "书包", "邮包", "沙包"], answer: 0 },
    { tag: "脑筋急转弯", q: "什么“手”不能握手？", options: ["扳手", "左手", "右手", "高手"], answer: 0 },
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
    questionEl.textContent = "进阶题 + 脑筋急转弯，连对加分！";
    choicesEl.replaceChildren();
    feedbackEl.textContent = best > 0 ? `历史最高 ${best} 分` : "点下面挑战 20 题";
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
    questionEl.textContent = score >= 30 ? "太厉害了！" : score >= 18 ? "答得不错！" : "再练练会更强！";
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
