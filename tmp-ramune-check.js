
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const highScoreEl = document.getElementById("highScore");
    const livesEl = document.getElementById("lives");
    const timeEl = document.getElementById("time");
    const comboEl = document.getElementById("combo");
    const effectTextEl = document.getElementById("effectText");
    const noticeEl = document.getElementById("notice");
    const overlay = document.getElementById("overlay");
    const panelTitle = document.getElementById("panelTitle");
    const panelBody = document.getElementById("panelBody");
    const panelStartBtn = document.getElementById("panelStartBtn");
    const townLink = document.getElementById("townLink");
    const difficultySelect = document.getElementById("difficultySelect");
    const startBtn = document.getElementById("startBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const soundBtn = document.getElementById("soundBtn");

    const W = 540;
    const H = 720;
    const ASSET_VERSION = "1";
    const SCORE_KEY = "showaRamuneHighScore";
    const ASSETS = {
      background: "background.webp",
      catcher: "catcher.webp",
      player: "player.webp",
      ramuneBlue: "ramune-blue.webp",
      ramunePink: "ramune-pink.webp",
      ramuneGold: "ramune-gold.webp",
      marble: "marble.webp",
      dagashi: "dagashi.webp",
      brokenBottle: "broken-bottle.webp",
      emptyBottle: "empty-bottle.webp",
      stone: "stone.webp",
      cat: "cat.webp",
      ice: "ice.webp",
      luckyTicket: "lucky-ticket.webp",
      powerBox: "power-box.webp",
      clock: "clock.webp",
      sparkle: "sparkle.webp"
    };
    const assetUrls = Object.fromEntries(
      Object.entries(ASSETS).map(([key, file]) => [key, `../images/ramune/${file}?v=${ASSET_VERSION}`])
    );
    const images = {};
    const failedAssets = new Set();

    const DIFFICULTY = {
      easy: { label: "のんびり", speed: 0.82, spawn: 0.78, lives: 4, max: 4, score: 1 },
      normal: { label: "ふつう", speed: 1, spawn: 1, lives: 3, max: 6, score: 1 },
      hard: { label: "大忙し", speed: 1.16, spawn: 1.25, lives: 2, max: 8, score: 1.2 }
    };

    const ITEM_TYPES = {
      ramuneBlue: { kind: "good", points: 10, w: 36, h: 56, weight: 34 },
      ramunePink: { kind: "good", points: 20, w: 36, h: 56, weight: 14 },
      ramuneGold: { kind: "good", points: 50, w: 38, h: 58, weight: 5, rare: true },
      marble: { kind: "good", points: 30, w: 38, h: 38, weight: 9, slow: 3000 },
      dagashi: { kind: "good", points: 15, w: 42, h: 42, weight: 17 },
      brokenBottle: { kind: "danger", points: 0, w: 44, h: 44, weight: 8 },
      emptyBottle: { kind: "bad", points: -10, w: 34, h: 54, weight: 8 },
      stone: { kind: "danger", points: 0, w: 42, h: 34, weight: 6, fast: true },
      cat: { kind: "cat", points: 0, w: 58, h: 44, weight: 4 },
      ice: { kind: "special", points: 0, w: 42, h: 42, weight: 5, effect: "ice" },
      luckyTicket: { kind: "special", points: 0, w: 42, h: 48, weight: 4, effect: "double" },
      powerBox: { kind: "special", points: 0, w: 48, h: 42, weight: 4, effect: "wide" },
      clock: { kind: "special", points: 0, w: 42, h: 42, weight: 4, effect: "clock" }
    };

    const keys = { left: false, right: false };
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    let assetLoadPromise = null;
    let audioCtx = null;
    let masterGain = null;
    let soundEnabled = true;
    let difficulty = "normal";
    let score = 0;
    let highScore = loadHighScore();
    let lives = 3;
    let combo = 0;
    let maxCombo = 0;
    let running = false;
    let paused = false;
    let gameEnded = false;
    let lastTime = 0;
    let endAt = 0;
    let remainingTime = 60;
    let spawnTimer = 0;
    let animationId = null;
    let noticeTimer = null;
    let items = [];
    let popups = [];
    let catcher = { x: 210, y: 606, w: 120, h: 58, speed: 310 };
    let freezeUntil = 0;
    let slowUntil = 0;
    let doubleUntil = 0;
    let wideUntil = 0;
    let warnedTime = false;

    function loadHighScore() {
      try {
        return Number(localStorage.getItem(SCORE_KEY)) || 0;
      } catch (error) {
        return 0;
      }
    }

    function saveHighScore(value) {
      try {
        localStorage.setItem(SCORE_KEY, String(value));
      } catch (error) {
        // 保存できない環境でもゲームは続行
      }
    }

    function initAudio() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) {
          audioCtx = new AudioContextClass();
          masterGain = audioCtx.createGain();
          masterGain.gain.value = 0.075;
          masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
      } catch (error) {
        // 音が使えない環境でもゲームは続行
      }
    }

    function playSound(type) {
      if (!soundEnabled) return;
      try {
        initAudio();
        if (!audioCtx || !masterGain) return;
        const now = audioCtx.currentTime;
        const patterns = {
          get: [[660, 0.05], [880, 0.06]],
          bonus: [[880, 0.05], [1170, 0.07], [1480, 0.08]],
          damage: [[180, 0.08], [120, 0.12]],
          combo: [[760, 0.04], [980, 0.04], [1280, 0.07]],
          special: [[520, 0.04], [780, 0.05], [1040, 0.08]],
          start: [[440, 0.05], [660, 0.08]],
          timeup: [[330, 0.09], [260, 0.12]],
          gameover: [[220, 0.1], [150, 0.16]],
          warn: [[980, 0.04], [540, 0.05]]
        }[type] || [[440, 0.05]];
        patterns.forEach(([freq, dur], index) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, now + index * 0.055);
          gain.gain.setValueAtTime(0.045, now + index * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.055 + dur);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + index * 0.055);
          osc.stop(now + index * 0.055 + dur);
        });
      } catch (error) {
        // 音が鳴らなくてもゲームは続行
      }
    }

    function preloadAssets() {
      if (assetLoadPromise) return assetLoadPromise;
      assetLoadPromise = Promise.allSettled(Object.entries(assetUrls).map(([key, src]) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          images[key] = img;
          resolve();
        };
        img.onerror = () => {
          failedAssets.add(key);
          resolve();
        };
        img.src = src;
      })));
      return assetLoadPromise;
    }

    function startGame() {
      initAudio();
      preloadAssets().then(() => {
        difficulty = difficultySelect.value;
        const diff = DIFFICULTY[difficulty];
        score = 0;
        lives = diff.lives;
        combo = 0;
        maxCombo = 0;
        remainingTime = 60;
        spawnTimer = 0;
        items = [];
        popups = [];
        warnedTime = false;
        freezeUntil = 0;
        slowUntil = 0;
        doubleUntil = 0;
        wideUntil = 0;
        catcher = { x: 210, y: 0, w: 120, h: 58, speed: 310 };
        catcher.y = catcherY();
        running = true;
        paused = false;
        gameEnded = false;
        lastTime = performance.now();
        endAt = lastTime + 60000;
        overlay.classList.add("hidden");
        townLink.hidden = true;
        panelStartBtn.textContent = "ゲームスタート";
        pauseBtn.textContent = "一時停止";
        showNotice("スタート！");
        playSound("start");
        updateHud();
        cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(loop);
      });
    }

    function loop(now) {
      if (!running || paused) {
        draw(now || performance.now());
        animationId = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;
      update(dt, now);
      draw(now);
      animationId = requestAnimationFrame(loop);
    }

    function update(dt, now) {
      remainingTime = Math.max(0, Math.ceil((endAt - now) / 1000));
      if (remainingTime <= 8 && !warnedTime) {
        warnedTime = true;
        showNotice("閉店間近！");
        playSound("warn");
      }
      if (remainingTime <= 0) {
        finishGame(false, true);
        return;
      }
      moveCatcher(dt, now);
      updateSpawns(dt, now);
      updateItems(dt, now);
      updatePopups(dt);
      updateHud();
    }

    function moveCatcher(dt, now) {
      if (now < freezeUntil) return;
      const targetW = now < wideUntil ? 174 : 120;
      catcher.w += (targetW - catcher.w) * Math.min(1, dt * 10);
      let dir = 0;
      if (keys.left) dir--;
      if (keys.right) dir++;
      catcher.x += dir * catcher.speed * dt;
      catcher.x = Math.max(12, Math.min(W - catcher.w - 12, catcher.x));
      catcher.y = catcherY();
    }

    function catcherY() {
      const controlSafeArea = mobileQuery.matches ? 108 : 0;
      return H - catcher.h - controlSafeArea - 56;
    }

    function stopHorizontalMove() {
      keys.left = false;
      keys.right = false;
    }

    function updateSpawns(dt, now) {
      const elapsed = 60 - remainingTime;
      const diff = DIFFICULTY[difficulty];
      const pressure = 1 + elapsed / 90;
      const slowRate = now < slowUntil ? 0.72 : 1;
      spawnTimer -= dt * diff.spawn * pressure;
      const maxItems = Math.min(diff.max + Math.floor(elapsed / 18), 9);
      if (spawnTimer <= 0 && items.length < maxItems) {
        spawnItem(elapsed, slowRate);
        spawnTimer = Math.max(0.28, (0.85 - elapsed * 0.008) / diff.spawn);
      }
    }

    function pickType() {
      const pool = [
        ["ramuneBlue", 30],
        ["ramunePink", 12],
        ["ramuneGold", 4],
        ["marble", 8],
        ["dagashi", 17],
        ["brokenBottle", 8],
        ["emptyBottle", 8],
        ["stone", 6],
        ["cat", 3],
        ["ice", 4],
        ["luckyTicket", 3],
        ["powerBox", 3],
        ["clock", 3]
      ];
      const total = pool.reduce((sum, item) => sum + item[1], 0);
      let roll = Math.random() * total;
      for (const [type, weight] of pool) {
        roll -= weight;
        if (roll <= 0) return type;
      }
      return "ramuneBlue";
    }

    function spawnItem(elapsed, slowRate) {
      const type = pickType();
      const spec = ITEM_TYPES[type];
      const speedBase = 118 + elapsed * 2.4;
      const diff = DIFFICULTY[difficulty];
      const fast = spec.fast ? 1.28 : 1;
      const catSide = type === "cat" && Math.random() < 0.7;
      items.push({
        type,
        x: catSide ? (Math.random() < 0.5 ? -64 : W + 24) : 28 + Math.random() * (W - 74),
        y: -70 - Math.random() * 80,
        w: spec.w,
        h: spec.h,
        vx: catSide ? (Math.random() < 0.5 ? 96 : -96) : (Math.random() - 0.5) * 30,
        vy: (speedBase + Math.random() * 55) * diff.speed * slowRate * fast,
        rot: 0,
        spin: type === "marble" || type === "ramuneGold" ? 1.8 : type === "stone" ? 1.2 : 0.35,
        caught: false
      });
    }

    function updateItems(dt, now) {
      const catchBox = catcherHitbox();
      items.forEach((item) => {
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.rot += item.spin * dt;
        if (item.x < -80) item.x = W + 50;
        if (item.x > W + 80) item.x = -50;
        if (!item.caught && rectHit(catchBox, itemHitbox(item))) {
          item.caught = true;
          handleCatch(item, now);
        }
        if (!item.caught && item.y > H + 60) {
          item.caught = true;
          handleMiss(item);
        }
      });
      items = items.filter((item) => !item.caught);
    }

    function handleCatch(item, now) {
      const spec = ITEM_TYPES[item.type];
      if (spec.kind === "good") {
        addScore(spec.points);
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        addPopup(item.x + item.w / 2, item.y, `+${scoreValue(spec.points)}`, item.type === "ramuneGold" ? "#ffe46b" : "#fff4a6");
        if (spec.slow) {
          slowUntil = now + spec.slow;
          showNotice("ビー玉で少しゆっくり！");
        }
        if (item.type === "ramuneGold") playSound("bonus");
        else playSound("get");
        checkComboBonus(item.x + item.w / 2, item.y);
        return;
      }
      combo = 0;
      if (spec.kind === "danger") {
        lives--;
        addPopup(item.x + item.w / 2, item.y, "残機-1", "#ff9d8e");
        showNotice(item.type === "stone" ? "石ころだ！" : "割れた瓶！");
        playSound("damage");
        if (lives <= 0) finishGame(true, false);
        return;
      }
      if (spec.kind === "bad") {
        addScore(spec.points);
        addPopup(item.x + item.w / 2, item.y, "-10", "#ffb09c");
        showNotice("空き瓶だった！");
        playSound("damage");
        return;
      }
      if (spec.kind === "cat") {
        freezeUntil = now + 1000;
        addPopup(item.x + item.w / 2, item.y, "ねこ待ち", "#fff4a6");
        showNotice("猫が乗っかってきた！");
        playSound("special");
        return;
      }
      if (spec.kind === "special") {
        applySpecial(spec.effect, now, item);
      }
    }

    function applySpecial(effect, now, item) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      if (effect === "ice") {
        slowUntil = now + 5000;
        showNotice("ひんやりタイム！");
        addPopup(item.x, item.y, "ひんやり");
      } else if (effect === "double") {
        doubleUntil = now + 5000;
        showNotice("得点2倍！");
        addPopup(item.x, item.y, "得点2倍");
      } else if (effect === "wide") {
        wideUntil = now + 8000;
        showNotice("木箱が広がった！");
        addPopup(item.x, item.y, "ワイド");
      } else if (effect === "clock") {
        endAt += 5000;
        showNotice("時間＋5秒");
        addPopup(item.x, item.y, "時間＋5秒");
      }
      playSound("special");
      checkComboBonus(item.x + item.w / 2, item.y);
    }

    function handleMiss(item) {
      const spec = ITEM_TYPES[item.type];
      if (spec.kind === "good") {
        combo = 0;
        if (item.type === "ramuneGold" || item.type === "marble") showNotice("もったいない！");
      }
    }

    function checkComboBonus(x, y) {
      if (combo > 0 && combo % 5 === 0) {
        const raw = combo >= 15 ? 200 : combo >= 10 ? 100 : 50;
        addScore(raw);
        addPopup(x, y - 20, `${combo} COMBO +${scoreValue(raw)}`, "#ffe46b");
        playSound("combo");
      }
    }

    function addScore(raw) {
      let value = raw;
      if (raw > 0) value = scoreValue(raw);
      score = Math.max(0, score + value);
      highScore = Math.max(highScore, score);
    }

    function scoreValue(raw) {
      const diffMul = DIFFICULTY[difficulty]?.score || 1;
      const doubleMul = performance.now() < doubleUntil ? 2 : 1;
      return Math.round(raw * diffMul * doubleMul);
    }

    function finishGame(gameOver, timeUp) {
      if (gameEnded) return;
      running = false;
      gameEnded = true;
      cancelAnimationFrame(animationId);
      if (score > loadHighScore()) saveHighScore(score);
      highScore = Math.max(highScore, score);
      updateHud();
      const record = score >= highScore && score > 0;
      panelTitle.textContent = gameOver ? "ラムネが割れすぎました！" : "タイムアップ！";
      panelBody.innerHTML = `
        <div class="panel-stats">
          <p>${record ? "新記録！" : timeUp ? "夕焼け横丁の閉店時間です。" : "もう一度挑戦しよう。"}</p>
          <p>今回の得点：${score}点</p>
          <p>最高得点：${highScore}点</p>
          <p>最大コンボ：${maxCombo}</p>
        </div>
      `;
      panelStartBtn.textContent = "もう一度遊ぶ";
      townLink.hidden = false;
      overlay.classList.remove("hidden");
      playSound(gameOver ? "gameover" : "timeup");
    }

    function togglePause(forcePause = false) {
      if (!running || gameEnded) return;
      paused = forcePause ? true : !paused;
      pauseBtn.textContent = paused ? "再開" : "一時停止";
      if (!paused) {
        lastTime = performance.now();
        endAt = performance.now() + remainingTime * 1000;
      }
    }

    function updatePopups(dt) {
      popups.forEach((popup) => {
        popup.y -= 48 * dt;
        popup.life -= dt;
      });
      popups = popups.filter((popup) => popup.life > 0);
    }

    function addPopup(x, y, text, color = "#fff4a6") {
      popups.push({ x, y, text, color, life: 1 });
    }

    function showNotice(message) {
      noticeEl.textContent = message;
      noticeEl.classList.add("show");
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => noticeEl.classList.remove("show"), 1300);
    }

    function catcherHitbox() {
      return {
        x: catcher.x + 12,
        y: catcher.y + 10,
        w: catcher.w - 24,
        h: catcher.h - 12
      };
    }

    function itemHitbox(item) {
      return {
        x: item.x + item.w * 0.16,
        y: item.y + item.h * 0.14,
        w: item.w * 0.68,
        h: item.h * 0.72
      };
    }

    function rectHit(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function updateHud() {
      scoreEl.textContent = score;
      highScoreEl.textContent = highScore;
      livesEl.textContent = lives;
      timeEl.textContent = `${remainingTime}秒`;
      comboEl.textContent = combo;
      const now = performance.now();
      const effects = [];
      if (now < slowUntil) effects.push("ひんやり");
      if (now < doubleUntil) effects.push("得点2倍");
      if (now < wideUntil) effects.push("ワイド木箱");
      if (now < freezeUntil) effects.push("猫待ち");
      effectTextEl.textContent = effects.length ? effects.join(" / ") : "なし";
    }

    function draw(now = performance.now()) {
      ctx.clearRect(0, 0, W, H);
      drawBackground();
      drawFallingItems(now);
      drawCatcher(now);
      popups.forEach(drawPopup);
      if (paused) drawPause();
    }

    function drawBackground() {
      const bg = images.background;
      if (bg && !failedAssets.has("background")) {
        ctx.drawImage(bg, 0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#be5a38");
        grad.addColorStop(1, "#241009");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = "rgba(36, 15, 7, 0.34)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255, 244, 196, 0.16)";
      for (let y = 72; y < H; y += 92) ctx.fillRect(0, y, W, 2);
    }

    function drawFallingItems(now) {
      items.forEach((item) => {
        const glow = item.type === "ramuneGold" ? 10 + Math.sin(now / 130) * 6 : 0;
        if (glow) {
          ctx.save();
          ctx.shadowColor = "#ffe46b";
          ctx.shadowBlur = glow;
          drawAsset(item.type, item.x, item.y, item.w, item.h, item.rot);
          ctx.restore();
        } else {
          drawAsset(item.type, item.x, item.y, item.w, item.h, item.rot);
        }
      });
    }

    function drawCatcher(now) {
      const bob = Math.sin(now / 160) * 2;
      drawAsset("player", catcher.x + catcher.w / 2 - 34, catcher.y + 44 + bob, 68, 68, 0);
      drawAsset("catcher", catcher.x, catcher.y + bob, catcher.w, catcher.h, 0);
    }

    function drawAsset(key, x, y, w, h, rotation = 0) {
      const img = images[key];
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(rotation);
      if (img && !failedAssets.has(key)) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        drawFallback(key, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }

    function drawFallback(key, x, y, w, h) {
      const good = ["ramuneBlue", "ramunePink", "ramuneGold", "marble", "dagashi"].includes(key);
      const danger = ["brokenBottle", "stone"].includes(key);
      ctx.fillStyle = danger ? "#d85b46" : good ? "#9edcf0" : "#ffe082";
      ctx.strokeStyle = "#4b2110";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4b2110";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fallbackLabel(key), x + w / 2, y + h / 2);
    }

    function fallbackLabel(key) {
      return {
        ramuneBlue: "ラムネ",
        ramunePink: "いちご",
        ramuneGold: "金",
        marble: "玉",
        dagashi: "菓子",
        brokenBottle: "危",
        emptyBottle: "空",
        stone: "石",
        cat: "猫",
        ice: "氷",
        luckyTicket: "札",
        powerBox: "箱",
        clock: "時計",
        catcher: "受け皿",
        player: "人"
      }[key] || "?";
    }

    function drawPopup(popup) {
      ctx.globalAlpha = Math.max(0, popup.life);
      ctx.fillStyle = popup.color;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#4a1f10";
      ctx.lineWidth = 4;
      ctx.strokeText(popup.text, popup.x, popup.y);
      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.globalAlpha = 1;
    }

    function drawPause() {
      ctx.fillStyle = "rgba(20, 10, 6, 0.68)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff4c4";
      ctx.font = "bold 38px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("一時停止中", W / 2, H / 2);
    }

    function setDirection(dir, active) {
      keys[dir] = active;
    }

    document.querySelectorAll(".move-button").forEach((button) => {
      const dir = button.dataset.dir;
      if (!dir) return;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        initAudio();
        stopHorizontalMove();
        setDirection(dir, true);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((name) => {
        button.addEventListener(name, stopHorizontalMove);
      });
    });

    window.addEventListener("pointerup", stopHorizontalMove);
    window.addEventListener("pointercancel", stopHorizontalMove);

    document.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D", "Enter"].includes(event.key)) initAudio();
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = true;
      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = true;
      if (event.key === "Enter") startGame();
      if (event.key.toLowerCase() === "p") togglePause();
      if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    });

    document.addEventListener("keyup", (event) => {
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = false;
      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = false;
    });

    document.addEventListener("touchmove", (event) => {
      if (event.target.closest(".stage-wrap") || event.target.closest(".controls")) event.preventDefault();
    }, { passive: false });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) togglePause(true);
    });

    window.addEventListener("resize", () => {
      catcher.y = catcherY();
      draw();
    });

    startBtn.addEventListener("pointerdown", initAudio);
    panelStartBtn.addEventListener("pointerdown", initAudio);
    startBtn.addEventListener("click", startGame);
    panelStartBtn.addEventListener("click", startGame);
    pauseBtn.addEventListener("click", () => togglePause());
    soundBtn.addEventListener("pointerdown", initAudio);
    soundBtn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      soundBtn.textContent = soundEnabled ? "ON" : "OFF";
      if (soundEnabled) initAudio();
    });

    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
        return this;
      };
    }

    catcher.y = catcherY();
    highScoreEl.textContent = highScore;
    preloadAssets().then(() => draw());
    draw();
  
