// Global Types for Chart.js
declare const Chart: any;

interface GameScores {
  reaction: number;
  avoidance: number;
  parking: number;
  gear: number;
}

interface GameDetails {
  reactionMs: number[];
  avoidedCount: number;
  parkingTimeLeft: number;
  gearSuccesses: number;
}

interface SurveyAnswers {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  q5: number | null;
}

interface CarRecommendation {
  carName: string;
  carImgUrl: string;
  carReason: string;
  musicName: string;
  musicReason: string;
}

// Global Game States
const gameSequence = ["reaction", "avoidance", "parking", "gear"] as const;
let currentStepIndex = 0;

const gameScores: GameScores = {
  reaction: 0,
  avoidance: 0,
  parking: 0,
  gear: 0
};

const gameDetails: GameDetails = {
  reactionMs: [],
  avoidedCount: 0,
  parkingTimeLeft: 0,
  gearSuccesses: 0
};

let surveyAnswers: SurveyAnswers = {
  q1: null,
  q2: null,
  q3: null,
  q4: null,
  q5: null
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animFrameId: number | null = null;
let chartInstance: any = null;
let isUnlicensed = false;

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (canvas) {
    ctx = canvas.getContext('2d');
  }

  const btnStartTest = document.getElementById('btn-start-test');
  const btnRestart = document.getElementById('btn-restart');
  if (btnStartTest) btnStartTest.onclick = startOverallTest;
  if (btnRestart) btnRestart.onclick = startOverallTest;

  const licInput = document.getElementById('prof-license-date') as HTMLInputElement | null;
  const btnUnlic = document.getElementById('btn-unlicensed') as HTMLButtonElement | null;

  if (btnUnlic && licInput) {
    btnUnlic.onclick = () => {
      isUnlicensed = !isUnlicensed;
      if (isUnlicensed) {
        licInput.value = "";
        licInput.disabled = true;
        licInput.classList.add('bg-slate-100', 'text-slate-400');
        btnUnlic.innerText = "취소";
        btnUnlic.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-200');
        showToast("무면허로 설정되었습니다.");
      } else {
        licInput.disabled = false;
        licInput.classList.remove('bg-slate-100', 'text-slate-400');
        btnUnlic.innerText = "무면허";
        btnUnlic.classList.remove('bg-indigo-50', 'text-indigo-600', 'border-indigo-200');
        showToast("면허 취득일 선택이 활성화되었습니다.");
      }
    };
  }

  const btnFortune = document.getElementById('btn-analyze-fortune');
  if (btnFortune) btnFortune.onclick = generateFortuneAnalysis;

  const btnShare = document.getElementById('btn-share');
  if (btnShare) btnShare.onclick = shareResult;
}

function showScreen(screenId: 'intro' | 'game' | 'survey' | 'result') {
  document.getElementById('screen-intro')?.classList.add('hidden');
  document.getElementById('screen-game')?.classList.add('hidden');
  document.getElementById('screen-survey')?.classList.add('hidden');
  document.getElementById('screen-result')?.classList.add('hidden');

  document.getElementById(`screen-${screenId}`)?.classList.remove('hidden');

  const progressTag = document.getElementById('game-progress-tag');
  if (progressTag) {
    if (screenId === 'game') {
      progressTag.classList.remove('hidden');
    } else {
      progressTag.classList.add('hidden');
    }
  }
}

function showToast(msg: string) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.remove('opacity-0');
  setTimeout(() => toast.classList.add('opacity-0'), 2500);
}

function startOverallTest() {
  currentStepIndex = 0;
  gameScores.reaction = 0;
  gameScores.avoidance = 0;
  gameScores.parking = 0;
  gameScores.gear = 0;
  surveyAnswers = { q1: null, q2: null, q3: null, q4: null, q5: null };

  showScreen('game');
  runCurrentMiniGame();
}

function runCurrentMiniGame() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  const stepIndicator = document.getElementById('game-step-indicator');
  if (stepIndicator) {
    stepIndicator.innerText = `${currentStepIndex + 1} / ${gameSequence.length}`;
  }

  const gameType = gameSequence[currentStepIndex];
  if (gameType === "reaction") {
    initReactionGame();
  } else if (gameType === "avoidance") {
    initAvoidanceGame();
  } else if (gameType === "parking") {
    initParkingGame();
  } else if (gameType === "gear") {
    initGearGame();
  }
}

function finishMiniGame() {
  currentStepIndex++;
  if (currentStepIndex < gameSequence.length) {
    runCurrentMiniGame();
  } else {
    showDriverSurveyScreen();
  }
}

function showReadyScreen(title: string, rulesArray: string[], controlsText: string, onStartCallback: () => void) {
  const readyOverlay = document.getElementById('ready-overlay');
  const readyTitle = document.getElementById('ready-title');
  const readyRules = document.getElementById('ready-rules');
  const readyControlsText = document.getElementById('ready-controls-text');
  const btnStart = document.getElementById('btn-start-mission');

  if (!readyOverlay || !readyTitle || !readyRules || !readyControlsText || !btnStart) return;

  readyTitle.innerText = title;
  readyRules.innerHTML = rulesArray.map(r => `<p>${r}</p>`).join('');
  readyControlsText.innerText = `조작법: ${controlsText}`;

  readyOverlay.classList.remove('hidden');

  function startHandler() {
    readyOverlay?.classList.add('hidden');
    btnStart?.removeEventListener('click', startHandler);
    window.removeEventListener('keydown', keyStartHandler);
    onStartCallback();
  }

  function keyStartHandler(e: KeyboardEvent) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      startHandler();
    }
  }

  btnStart.addEventListener('click', startHandler);
  window.addEventListener('keydown', keyStartHandler);
}

// =================================================================
// MINI GAME 1: 신호등 반응속도 (Red & Green Lights Only)
// =================================================================
function initReactionGame() {
  const titleEl = document.getElementById('game-title');
  const hintEl = document.getElementById('game-controls-hint');
  if (titleEl) titleEl.innerText = "1. 신호등 반응속도";
  if (hintEl) hintEl.innerText = "안내: 화면의 [시작하기] 버튼 클릭 후 게임이 시작됩니다.";

  showReadyScreen(
    "🚥 1단계: 신호등 반응속도",
    [
      "• 목표: 빨간불에서 초록불로 바뀔 때 타이밍에 맞춰 스페이스바 누르기!",
      "• 규칙: 총 3번 측정하여 1/3, 2/3, 3/3 회차별 평균 반응 속도를 계산합니다.",
      "• 주의: 빨간불일 때 미리 누르면 부정출발 처리됩니다."
    ],
    "스페이스바 또는 화면 반응 버튼",
    startActualGame
  );

  function startActualGame() {
    if (hintEl) hintEl.innerText = "컴퓨터: [스페이스바] / 모바일: 화면의 반응 버튼 클릭";
    const touchControls = document.getElementById('touch-controls');
    if (touchControls) {
      touchControls.innerHTML = `
        <button id="btn-reaction-tap" class="w-full py-4 bg-indigo-600 active:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-md text-lg">
          <i class="fa-solid fa-hand-pointer mr-2"></i> 반응 클릭 (스페이스바)
        </button>
      `;
    }

    let trials = 0;
    const maxTrials = 3;
    const reactionTimes: number[] = [];
    let state: "WAITING" | "RED" | "GREEN" = "WAITING";
    let startTime = 0;
    let timerId: ReturnEventTimeout | null = null;
    type ReturnEventTimeout = ReturnType<typeof setTimeout>;

    function drawTrafficLight(activeLight: "RED" | "GREEN", message: string) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 - 20;

      // Traffic light housing
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(centerX - 45, centerY - 80, 90, 160, 20);
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Red Light
      ctx.beginPath();
      ctx.arc(centerX, centerY - 40, 28, 0, Math.PI * 2);
      ctx.fillStyle = activeLight === "RED" ? "#ef4444" : "#475569";
      ctx.fill();
      if (activeLight === "RED") {
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Green Light
      ctx.beginPath();
      ctx.arc(centerX, centerY + 40, 28, 0, Math.PI * 2);
      ctx.fillStyle = activeLight === "GREEN" ? "#22c55e" : "#475569";
      ctx.fill();
      if (activeLight === "GREEN") {
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Indicator
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Pretendard, sans-serif";
      ctx.textAlign = "center";
      const stepText = trials === 0 ? "1/3" : trials === 1 ? "2/3" : "3/3";
      ctx.fillText(`측정: ${trials + 1} / ${maxTrials} (${stepText})`, centerX, 45);

      ctx.font = "bold 20px Pretendard, sans-serif";
      ctx.fillStyle = activeLight === "GREEN" ? "#4ade80" : "#f87171";
      ctx.fillText(message, centerX, centerY + 120);
    }

    function startTrial() {
      state = "RED";
      drawTrafficLight("RED", "빨간불: 정지 대기 중...");

      const greenDelay = 1200 + Math.random() * 1800;
      timerId = setTimeout(() => {
        state = "GREEN";
        startTime = performance.now();
        drawTrafficLight("GREEN", "초록불! 지금 누르세요!");
      }, greenDelay);
    }

    function handleInput() {
      if (state === "RED") {
        if (timerId) clearTimeout(timerId);
        drawTrafficLight("RED", "⚠️ 부정출발! 초록불이 켜질 때 누르세요.");
        state = "WAITING";
        setTimeout(startTrial, 1500);
      } else if (state === "GREEN") {
        const elapsed = Math.round(performance.now() - startTime);
        reactionTimes.push(elapsed);
        trials++;
        state = "WAITING";

        drawTrafficLight("GREEN", `⚡ 반응 속도: ${elapsed}ms`);

        setTimeout(() => {
          if (trials < maxTrials) {
            startTrial();
          } else {
            finishGame();
          }
        }, 1200);
      }
    }

    function finishGame() {
      gameDetails.reactionMs = reactionTimes;
      const avgMs = reactionTimes.length ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length : 350;

      let score = 0;
      if (avgMs <= 170) score = 25;
      else if (avgMs <= 210) score = 22;
      else if (avgMs <= 250) score = 18;
      else if (avgMs <= 300) score = 14;
      else score = 8;

      gameScores.reaction = score;

      cleanup();
      finishMiniGame();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
      }
    }

    const btnTap = document.getElementById('btn-reaction-tap');
    function onClick(e: MouseEvent) {
      e.preventDefault();
      handleInput();
    }

    window.addEventListener('keydown', onKeyDown);
    btnTap?.addEventListener('click', onClick);

    function cleanup() {
      window.removeEventListener('keydown', onKeyDown);
      btnTap?.removeEventListener('click', onClick);
      if (timerId) clearTimeout(timerId);
    }

    startTrial();
  }
}

// =================================================================
// MINI GAME 2: 장애물 피하기 (Avoidance Game)
// =================================================================
function initAvoidanceGame() {
  const titleEl = document.getElementById('game-title');
  const hintEl = document.getElementById('game-controls-hint');
  if (titleEl) titleEl.innerText = "2. 장애물 피하기";
  if (hintEl) hintEl.innerText = "안내: 화면의 [시작하기] 버튼 클릭 후 게임이 시작됩니다.";

  showReadyScreen(
    "🚗 2단계: 장애물 피하기",
    [
      "• 목표: 5차선 도로에서 20초 동안 내려오는 차 피하기!",
      "• 조종하는 차량 앞에 헤드라이트(전조등) 표시 추가",
      "• 규칙: 부딪히면 즉시 종료. 시간이 지날수록 차량 속도와 수가 증가합니다."
    ],
    "좌/우 방향키 또는 화면 화살표 버튼",
    startActualGame
  );

  function startActualGame() {
    if (!canvas || !ctx) return;
    if (hintEl) hintEl.innerText = "컴퓨터: [좌/우 방향키] / 모바일: 하단 화살표 버튼";

    const touchControls = document.getElementById('touch-controls');
    if (touchControls) {
      touchControls.innerHTML = `
        <button id="btn-left" class="flex-1 py-3.5 bg-slate-100 active:bg-slate-200 text-slate-700 font-extrabold rounded-2xl shadow-xs text-xl border border-slate-200">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <button id="btn-right" class="flex-1 py-3.5 bg-slate-100 active:bg-slate-200 text-slate-700 font-extrabold rounded-2xl shadow-xs text-xl border border-slate-200">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;
    }

    const totalLanes = 5;
    const laneWidth = canvas.width / totalLanes;
    let targetLane = 2;

    const playerCar = {
      w: 36,
      h: 60,
      x: targetLane * laneWidth + (laneWidth - 36) / 2,
      y: canvas.height - 80,
      tilt: 0
    };

    const totalDuration = 20;
    let timeLeft = totalDuration;
    let avoidedCount = 0;
    let gameOver = false;
    let gameSuccess = false;

    interface Obstacle {
      lane: number;
      y: number;
      w: number;
      h: number;
      speed: number;
      color: string;
    }

    const obstacles: Obstacle[] = [];
    let lastSpawnTime = 0;
    const laneLastY = [-500, -500, -500, -500, -500];

    let lastFrameTime = performance.now();
    const timerInterval = setInterval(() => {
      if (!gameOver) {
        timeLeft--;
        if (timeLeft <= 0) {
          timeLeft = 0;
          gameOver = true;
          gameSuccess = true;
          finishGame();
        }
      }
    }, 1000);

    function gameLoop(now: number) {
      if (gameOver) return;

      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      const targetX = targetLane * laneWidth + (laneWidth - playerCar.w) / 2;
      const dx = targetX - playerCar.x;
      playerCar.x += dx * 0.15;
      playerCar.tilt = dx * 0.008;

      const progressRatio = (totalDuration - timeLeft) / totalDuration;
      const baseSpeed = 290 + progressRatio * 240;
      const spawnInterval = Math.max(220, 600 - progressRatio * 380);

      if (now - lastSpawnTime > spawnInterval) {
        lastSpawnTime = now;

        const numCarsToSpawn = Math.random() < (0.35 + progressRatio * 0.4) ? 2 : 1;
        const availableLanes = [0, 1, 2, 3, 4].filter(l => laneLastY[l] > 140 || laneLastY[l] < -100);

        for (let i = 0; i < numCarsToSpawn; i++) {
          if (availableLanes.length === 0) break;
          const randIdx = Math.floor(Math.random() * availableLanes.length);
          const lane = availableLanes.splice(randIdx, 1)[0];

          const obsCar: Obstacle = {
            lane: lane,
            y: -70,
            w: 36,
            h: 60,
            speed: baseSpeed + (Math.random() * 40 - 20),
            color: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 4)]
          };
          obstacles.push(obsCar);
          laneLastY[lane] = obsCar.y;
        }
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += obs.speed * dt;
        laneLastY[obs.lane] = obs.y;

        const obsX = obs.lane * laneWidth + (laneWidth - obs.w) / 2;

        if (
          playerCar.x < obsX + obs.w &&
          playerCar.x + playerCar.w > obsX &&
          playerCar.y < obs.y + obs.h &&
          playerCar.y + playerCar.h > obs.y
        ) {
          gameOver = true;
          finishGame();
          return;
        }

        if (obs.y > canvas!.height + 80) {
          obstacles.splice(i, 1);
          avoidedCount++;
        }
      }

      render();
      animFrameId = requestAnimationFrame(gameLoop);
    }

    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.setLineDash([15, 15]);
      for (let i = 1; i < totalLanes; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneWidth, 0);
        ctx.lineTo(i * laneWidth, canvas.height);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      obstacles.forEach(obs => {
        const obsX = obs.lane * laneWidth + (laneWidth - obs.w) / 2;
        ctx!.fillStyle = obs.color;
        ctx!.beginPath();
        ctx!.roundRect(obsX, obs.y, obs.w, obs.h, 6);
        ctx!.fill();

        ctx!.fillStyle = "rgba(0,0,0,0.3)";
        ctx!.fillRect(obsX + 4, obs.y + 12, obs.w - 8, obs.h - 24);
      });

      // Player Car
      ctx.save();
      ctx.translate(playerCar.x + playerCar.w / 2, playerCar.y + playerCar.h / 2);
      ctx.rotate(playerCar.tilt);

      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(-playerCar.w / 2, -playerCar.h / 2, playerCar.w, playerCar.h, 6);
      ctx.fill();
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#0284c7";
      ctx.fillRect(-playerCar.w / 2 + 4, -playerCar.h / 2 + 12, playerCar.w - 8, playerCar.h - 24);

      // Front Headlights
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(-playerCar.w / 2 + 3, -playerCar.h / 2 - 2, 6, 4);
      ctx.fillRect(playerCar.w / 2 - 9, -playerCar.h / 2 - 2, 6, 4);

      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Pretendard, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`⏱️ 남은시간: ${timeLeft}초`, 15, 30);
      ctx.textAlign = "right";
      ctx.fillText(`🚗 회피: ${avoidedCount}대`, canvas.width - 15, 30);
    }

    function finishGame() {
      if (!ctx || !canvas) return;
      clearInterval(timerInterval);
      gameDetails.avoidedCount = avoidedCount;

      let score = 0;
      if (gameSuccess) {
        score = 25;
      } else {
        score = Math.min(24, Math.floor((avoidedCount / 22) * 20));
      }
      gameScores.avoidance = score;

      render();
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = gameSuccess ? "#4ade80" : "#f87171";
      ctx.font = "bold 26px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(gameSuccess ? "🎉 20초 완주 성공!" : "💥 부딪혔습니다!", canvas.width / 2, canvas.height / 2 - 15);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "16px Pretendard, sans-serif";
      ctx.fillText(`회피 차량: ${avoidedCount}대 | 획득 점수: ${score}점`, canvas.width / 2, canvas.height / 2 + 25);

      cleanup();
      setTimeout(finishMiniGame, 1800);
    }

    function handleMove(dir: 'left' | 'right') {
      if (gameOver) return;
      if (dir === 'left' && targetLane > 0) targetLane--;
      if (dir === 'right' && targetLane < totalLanes - 1) targetLane++;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') handleMove('left');
      if (e.key === 'ArrowRight') handleMove('right');
    }

    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');

    if (btnLeft) btnLeft.onclick = () => handleMove('left');
    if (btnRight) btnRight.onclick = () => handleMove('right');
    window.addEventListener('keydown', onKeyDown);

    function cleanup() {
      window.removeEventListener('keydown', onKeyDown);
      if (btnLeft) btnLeft.onclick = null;
      if (btnRight) btnRight.onclick = null;
      clearInterval(timerInterval);
    }

    requestAnimationFrame(gameLoop);
  }
}

// =================================================================
// MINI GAME 3: 주차 챌린지 (Parking Challenge)
// =================================================================
function initParkingGame() {
  const titleEl = document.getElementById('game-title');
  const hintEl = document.getElementById('game-controls-hint');
  if (titleEl) titleEl.innerText = "3. 주차 챌린지";
  if (hintEl) hintEl.innerText = "안내: 화면의 [시작하기] 버튼 클릭 후 게임이 시작됩니다.";

  showReadyScreen(
    "🅿️ 3단계: 주차 챌린지",
    [
      "• 목표: 제한 시간 20초 안에 초록색 주차 구역에 정확히 주차하기!",
      "• 조종하는 차량 속도 15% 상향 및 기둥/장애물 2개 추가 배치된 랜덤 맵",
      "• 헤드라이트(전조등)가 달린 앞부분을 확인하여 조종하세요."
    ],
    "상/하/좌/우 방향키 또는 화면 화살표 버튼",
    startActualGame
  );

  function startActualGame() {
    if (!canvas || !ctx) return;
    if (hintEl) hintEl.innerText = "컴퓨터: [방향키] / 모바일: 하단 방향키 버튼";

    const touchControls = document.getElementById('touch-controls');
    if (touchControls) {
      touchControls.innerHTML = `
        <div class="grid grid-cols-3 gap-1.5 w-48 mx-auto">
          <div></div>
          <button id="btn-up" class="py-2.5 bg-slate-800 active:bg-slate-700 text-white rounded-lg"><i class="fa-solid fa-arrow-up"></i></button>
          <div></div>
          <button id="btn-park-left" class="py-2.5 bg-slate-800 active:bg-slate-700 text-white rounded-lg"><i class="fa-solid fa-arrow-left"></i></button>
          <button id="btn-down" class="py-2.5 bg-slate-800 active:bg-slate-700 text-white rounded-lg"><i class="fa-solid fa-arrow-down"></i></button>
          <button id="btn-park-right" class="py-2.5 bg-slate-800 active:bg-slate-700 text-white rounded-lg"><i class="fa-solid fa-arrow-right"></i></button>
        </div>
      `;
    }

    interface ParkingObstacle {
      x: number;
      y: number;
      w: number;
      h: number;
      type: 'car' | 'pillar';
    }

    const maps = [
      {
        name: "T자 주차 심화 맵 A",
        start: { x: 70, y: 350, angle: 0 },
        target: { x: 370, y: 60, w: 75, h: 100 },
        obstacles: [
          { x: 300, y: 60, w: 60, h: 100, type: 'car' as const },
          { x: 200, y: 220, w: 40, h: 40, type: 'pillar' as const },
          { x: 120, y: 150, w: 40, h: 40, type: 'pillar' as const },
          { x: 310, y: 220, w: 55, h: 55, type: 'car' as const }
        ]
      },
      {
        name: "평행 주차 심화 맵 B",
        start: { x: 60, y: 140, angle: Math.PI / 2 },
        target: { x: 190, y: 330, w: 100, h: 65 },
        obstacles: [
          { x: 70, y: 330, w: 100, h: 65, type: 'car' as const },
          { x: 310, y: 330, w: 100, h: 65, type: 'car' as const },
          { x: 210, y: 200, w: 35, h: 35, type: 'pillar' as const },
          { x: 130, y: 200, w: 35, h: 35, type: 'pillar' as const }
        ]
      },
      {
        name: "기둥 미로 주차 맵 C",
        start: { x: 60, y: 60, angle: 0 },
        target: { x: 370, y: 310, w: 80, h: 80 },
        obstacles: [
          { x: 160, y: 140, w: 45, h: 45, type: 'pillar' as const },
          { x: 280, y: 230, w: 45, h: 45, type: 'pillar' as const },
          { x: 250, y: 80, w: 60, h: 90, type: 'car' as const },
          { x: 90, y: 250, w: 45, h: 45, type: 'pillar' as const },
          { x: 340, y: 180, w: 50, h: 50, type: 'pillar' as const }
        ]
      },
      {
        name: "지그재그 협소 주차 맵 D",
        start: { x: 410, y: 360, angle: -Math.PI / 2 },
        target: { x: 60, y: 60, w: 80, h: 80 },
        obstacles: [
          { x: 180, y: 180, w: 50, h: 50, type: 'pillar' as const },
          { x: 300, y: 120, w: 90, h: 60, type: 'car' as const },
          { x: 110, y: 280, w: 40, h: 40, type: 'pillar' as const },
          { x: 330, y: 280, w: 45, h: 45, type: 'pillar' as const }
        ]
      }
    ];

    const selectedMap = maps[Math.floor(Math.random() * maps.length)];

    const car = {
      x: selectedMap.start.x,
      y: selectedMap.start.y,
      angle: selectedMap.start.angle,
      w: 32,
      h: 56,
      speed: 0,
      maxSpeed: 3.2,
      accel: 0.145,
      friction: 0.94
    };

    let timeLeft = 20;
    let penalties = 0;
    let invincibleTimer = 0;
    let isGameOver = false;

    const keys = { up: false, down: false, left: false, right: false };

    const timerInterval = setInterval(() => {
      if (!isGameOver) {
        timeLeft--;
        if (timeLeft <= 0) {
          timeLeft = 0;
          isGameOver = true;
          finishGame(false);
        }
      }
    }, 1000);

    function gameLoop() {
      if (isGameOver) return;

      if (invincibleTimer > 0) invincibleTimer--;

      if (keys.up) car.speed = Math.min(car.speed + car.accel, car.maxSpeed);
      else if (keys.down) car.speed = Math.max(car.speed - car.accel, -car.maxSpeed * 0.5);
      else car.speed *= car.friction;

      if (keys.left) car.angle -= 0.045 * (car.speed / car.maxSpeed);
      if (keys.right) car.angle += 0.045 * (car.speed / car.maxSpeed);

      car.x += Math.sin(car.angle) * car.speed;
      car.y -= Math.cos(car.angle) * car.speed;

      // Boundary checks
      if (canvas) {
        if (car.x < 15 || car.x > canvas.width - 15 || car.y < 15 || car.y > canvas.height - 15) {
          car.x = Math.max(15, Math.min(canvas.width - 15, car.x));
          car.y = Math.max(15, Math.min(canvas.height - 15, car.y));
          car.speed *= -0.4;
          if (invincibleTimer === 0) {
            penalties++;
            invincibleTimer = 40;
          }
        }
      }

      // Obstacle collisions
      const carBox = getCarBoundingBox();
      for (const obs of selectedMap.obstacles) {
        if (
          carBox.x < obs.x + obs.w &&
          carBox.x + carBox.w > obs.x &&
          carBox.y < obs.y + obs.h &&
          carBox.y + carBox.h > obs.y
        ) {
          car.speed *= -0.4;
          if (invincibleTimer === 0) {
            penalties++;
            invincibleTimer = 40;
          }
        }
      }

      // Target check
      const t = selectedMap.target;
      if (
        car.x > t.x && car.x < t.x + t.w &&
        car.y > t.y && car.y < t.y + t.h &&
        Math.abs(car.speed) < 0.2
      ) {
        isGameOver = true;
        finishGame(true);
        return;
      }

      render();
      animFrameId = requestAnimationFrame(gameLoop);
    }

    function getCarBoundingBox() {
      return {
        x: car.x - car.w / 2,
        y: car.y - car.h / 2,
        w: car.w,
        h: car.h
      };
    }

    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Parking Target Zone (Green)
      ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.fillRect(selectedMap.target.x, selectedMap.target.y, selectedMap.target.w, selectedMap.target.h);
      ctx.strokeRect(selectedMap.target.x, selectedMap.target.y, selectedMap.target.w, selectedMap.target.h);
      ctx.setLineDash([]);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("주차 ZONE", selectedMap.target.x + selectedMap.target.w / 2, selectedMap.target.y + selectedMap.target.h / 2 + 4);

      // Obstacles
      selectedMap.obstacles.forEach((obs: ParkingObstacle) => {
        ctx!.fillStyle = obs.type === 'pillar' ? "#64748b" : "#475569";
        ctx!.beginPath();
        ctx!.roundRect(obs.x, obs.y, obs.w, obs.h, 6);
        ctx!.fill();
        ctx!.strokeStyle = "#94a3b8";
        ctx!.lineWidth = 2;
        ctx!.stroke();

        if (obs.type === 'pillar') {
          ctx!.fillStyle = "#cbd5e1";
          ctx!.beginPath();
          ctx!.arc(obs.x + obs.w / 2, obs.y + obs.h / 2, 8, 0, Math.PI * 2);
          ctx!.fill();
        }
      });

      // Player Car
      if (invincibleTimer === 0 || Math.floor(invincibleTimer / 4) % 2 === 0) {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);

        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 6);
        ctx.fill();
        ctx.strokeStyle = "#7dd3fc";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#0284c7";
        ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 10, car.w - 8, car.h - 20);

        // Front Headlights
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(-car.w / 2 + 3, -car.h / 2 - 2, 6, 4);
        ctx.fillRect(car.w / 2 - 9, -car.h / 2 - 2, 6, 4);

        ctx.restore();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Pretendard, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`⏱️ 남은시간: ${timeLeft}초`, 15, 30);
      ctx.textAlign = "right";
      ctx.fillText(`🚨 충돌감점: ${penalties}회`, canvas.width - 15, 30);
    }

    function finishGame(success: boolean) {
      if (!ctx || !canvas) return;
      clearInterval(timerInterval);
      gameDetails.parkingTimeLeft = timeLeft;

      let score = 0;
      if (success) {
        score = Math.max(10, 25 - (penalties * 3) + Math.floor(timeLeft / 2));
        score = Math.min(25, score);
      } else {
        score = Math.max(3, 15 - (penalties * 4));
      }
      gameScores.parking = score;

      render();
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = success ? "#4ade80" : "#f87171";
      ctx.font = "bold 24px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(success ? "🅿️ 주차 성공 완료!" : "⌛ 시간 초과 / 주차 실패", canvas.width / 2, canvas.height / 2 - 15);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "15px Pretendard, sans-serif";
      ctx.fillText(`충돌 감점: ${penalties}회 | 획득 점수: ${score}점`, canvas.width / 2, canvas.height / 2 + 25);

      cleanup();
      setTimeout(finishMiniGame, 1800);
    }

    function setupButton(id: string, keyName: keyof typeof keys) {
      const el = document.getElementById(id);
      if (!el) return;
      el.onmousedown = () => { keys[keyName] = true; };
      el.onmouseup = () => { keys[keyName] = false; };
      el.ontouchstart = (e) => { e.preventDefault(); keys[keyName] = true; };
      el.ontouchend = (e) => { e.preventDefault(); keys[keyName] = false; };
    }

    setupButton('btn-up', 'up');
    setupButton('btn-down', 'down');
    setupButton('btn-park-left', 'left');
    setupButton('btn-park-right', 'right');

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') keys.up = true;
      if (e.key === 'ArrowDown') keys.down = true;
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowRight') keys.right = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') keys.up = false;
      if (e.key === 'ArrowDown') keys.down = false;
      if (e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'ArrowRight') keys.right = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function cleanup() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(timerInterval);
    }

    animFrameId = requestAnimationFrame(gameLoop);
  }
}

// =================================================================
// MINI GAME 4: 기어 변속 타이밍 (Gear Shift Timing)
// =================================================================
function initGearGame() {
  const titleEl = document.getElementById('game-title');
  const hintEl = document.getElementById('game-controls-hint');
  if (titleEl) titleEl.innerText = "4. 기어 변속 타이밍";
  if (hintEl) hintEl.innerText = "안내: 화면의 [시작하기] 버튼 클릭 후 게임이 시작됩니다.";

  showReadyScreen(
    "⚙️ 4단계: 기어 변속 타이밍",
    [
      "• 목표: 총 3라운드 (1단~3단)동안 바늘이 초록 안전 구간에 진입할 때 스페이스바 누르기!",
      "• 라운드가 올라갈수록 초록 안전구간이 좁아지고 바늘 속도가 빨라집니다.",
      "• 바늘 속도 15% 감속 적용"
    ],
    "스페이스바 또는 화면 변속 버튼",
    startActualGame
  );

  function startActualGame() {
    if (!canvas || !ctx) return;
    if (hintEl) hintEl.innerText = "컴퓨터: [스페이스바] / 모바일: 하단 변속 버튼";

    const touchControls = document.getElementById('touch-controls');
    if (touchControls) {
      touchControls.innerHTML = `
        <button id="btn-gear-shift" class="w-full py-4 bg-indigo-600 active:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-md text-lg">
          <i class="fa-solid fa-gauge mr-2"></i> 변속! (스페이스바)
        </button>
      `;
    }

    let round = 1;
    const maxRounds = 3;
    let successes = 0;
    let roundActive = true;
    let feedbackText = "";
    let feedbackColor = "#ffffff";
    let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

    const roundConfigs = [
      { speed: 0.0212, zoneStart: 0.40, zoneEnd: 0.60, name: "1단 (쉬움)" },
      { speed: 0.034,  zoneStart: 0.43, zoneEnd: 0.57, name: "2단 (보통)" },
      { speed: 0.051,  zoneStart: 0.45, zoneEnd: 0.55, name: "3단 (어려움)" }
    ];

    let currentConfig = roundConfigs[0];
    let needleAngle = 0;
    let direction = 1;

    function resetRound() {
      currentConfig = roundConfigs[round - 1];
      needleAngle = 0;
      direction = 1;
      roundActive = true;
    }

    function gameLoop() {
      if (!roundActive) return;

      needleAngle += currentConfig.speed * direction;
      if (needleAngle >= 1) {
        needleAngle = 1;
        direction = -1;
      } else if (needleAngle <= 0) {
        needleAngle = 0;
        direction = 1;
      }

      render();
      animFrameId = requestAnimationFrame(gameLoop);
    }

    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 + 30;
      const radius = 130;

      const startAngle = Math.PI * 0.8;
      const endAngle = Math.PI * 2.2;
      const totalArc = endAngle - startAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 22;
      ctx.stroke();

      const zoneStartAngle = startAngle + totalArc * currentConfig.zoneStart;
      const zoneEndAngle = startAngle + totalArc * currentConfig.zoneEnd;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, zoneStartAngle, zoneEndAngle);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 22;
      ctx.stroke();

      const currentNeedleAngle = startAngle + totalArc * needleAngle;
      const needleTipX = centerX + Math.cos(currentNeedleAngle) * (radius - 15);
      const needleTipY = centerY + Math.sin(currentNeedleAngle) * (radius - 15);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(needleTipX, needleTipY);
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`라운드 ${round} / 3 — ${currentConfig.name}`, centerX, 45);

      if (feedbackText) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.fillRect(centerX - 120, centerY - 80, 240, 60);
        ctx.strokeStyle = feedbackColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - 120, centerY - 80, 240, 60);

        ctx.fillStyle = feedbackColor;
        ctx.font = "bold 26px Pretendard, sans-serif";
        ctx.fillText(feedbackText, centerX, centerY - 42);
      }
    }

    function handleInput() {
      if (!roundActive) return;
      roundActive = false;

      if (needleAngle >= currentConfig.zoneStart && needleAngle <= currentConfig.zoneEnd) {
        successes++;
        feedbackText = "SUCCESS!";
        feedbackColor = "#4ade80";
      } else {
        feedbackText = "FAIL!";
        feedbackColor = "#f87171";
      }

      render();

      feedbackTimer = setTimeout(() => {
        feedbackText = "";
        round++;
        if (round <= maxRounds) {
          resetRound();
          animFrameId = requestAnimationFrame(gameLoop);
        } else {
          finishGame();
        }
      }, 1200);
    }

    function finishGame() {
      gameDetails.gearSuccesses = successes;
      const score = Math.round((successes / maxRounds) * 25);
      gameScores.gear = score;

      cleanup();
      finishMiniGame();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
      }
    }

    const btnShift = document.getElementById('btn-gear-shift');
    function onClick(e: MouseEvent) {
      e.preventDefault();
      handleInput();
    }

    window.addEventListener('keydown', onKeyDown);
    btnShift?.addEventListener('click', onClick);

    function cleanup() {
      window.removeEventListener('keydown', onKeyDown);
      btnShift?.removeEventListener('click', onClick);
      if (feedbackTimer) clearTimeout(feedbackTimer);
    }

    resetRound();
    animFrameId = requestAnimationFrame(gameLoop);
  }
}

// =================================================================
// DRIVER PERSONALITY SURVEY SCREEN (5 Questions)
// =================================================================
function showDriverSurveyScreen() {
  showScreen('survey');
  const container = document.getElementById('survey-questions-container');
  if (!container) return;

  container.innerHTML = `
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
      <div class="text-xs font-extrabold text-indigo-600">Q1. 내 차의 청결 상태는?</div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="window.setSurveyAns(1, 0)" id="q1_opt0" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">어제 먹은 음료수 캔이 그대로 방치되어 있다</button>
        <button onclick="window.setSurveyAns(1, 1)" id="q1_opt1" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">누가 봐도 항상 깔끔하게 손세차 완료</button>
      </div>
    </div>
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
      <div class="text-xs font-extrabold text-indigo-600">Q2. 정체 구간 깜빡이 넣고 끼어들려는 차량이 있다면?</div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="window.setSurveyAns(2, 0)" id="q2_opt0" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">초보인가? 마음 넓게 양보해 준다</button>
        <button onclick="window.setSurveyAns(2, 1)" id="q2_opt1" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">상습범이 분명하다! 절대 안 끼워준다</button>
      </div>
    </div>
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
      <div class="text-xs font-extrabold text-indigo-600">Q3. 내가 생각하는 내 운전 스타일은?</div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="window.setSurveyAns(3, 0)" id="q3_opt0" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">흐름을 주도하는 스포티한 드라이버</button>
        <button onclick="window.setSurveyAns(3, 1)" id="q3_opt1" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">돌다리도 두드리는 100% 방어 운전자</button>
      </div>
    </div>
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
      <div class="text-xs font-extrabold text-indigo-600">Q4. 드라이브 중 음악을 들을 때 나는?</div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="window.setSurveyAns(4, 0)" id="q4_opt0" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">노래방보다 더 신나게 떼창을 부른다</button>
        <button onclick="window.setSurveyAns(4, 1)" id="q4_opt1" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">집중을 위해 잔잔한 재즈나 클래식을 튼다</button>
      </div>
    </div>
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
      <div class="text-xs font-extrabold text-indigo-600">Q5. 내비게이션 길 안내를 받을 때 나는?</div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="window.setSurveyAns(5, 0)" id="q5_opt0" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">내비게이션이 안내하는 대로 온전히 따라간다</button>
        <button onclick="window.setSurveyAns(5, 1)" id="q5_opt1" class="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left">내 지름길 감각을 믿고 다른 길로 빠진다</button>
      </div>
    </div>
  `;

  const btnSubmit = document.getElementById('btn-submit-survey');
  if (btnSubmit) {
    btnSubmit.onclick = () => {
      showResults();
    };
  }
}

// Global hook for survey answer buttons
(window as any).setSurveyAns = function(qNum: 1 | 2 | 3 | 4 | 5, optIdx: 0 | 1) {
  surveyAnswers[`q${qNum}`] = optIdx;

  const btn0 = document.getElementById(`q${qNum}_opt0`);
  const btn1 = document.getElementById(`q${qNum}_opt1`);

  [btn0, btn1].forEach(b => {
    if (b) {
      b.className = "p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-500 transition-all text-left";
    }
  });

  const selectedBtn = document.getElementById(`q${qNum}_opt${optIdx}`);
  if (selectedBtn) {
    selectedBtn.className = "p-3 bg-indigo-50 border-2 border-indigo-600 rounded-xl text-xs font-extrabold text-indigo-900 ring-2 ring-indigo-200 transition-all text-left shadow-sm";
  }
};

// =================================================================
// INTELLIGENT DREAM CAR & MUSIC MATCHING ENGINE
// =================================================================
function calculateDreamCar(totalScore: number, answers: SurveyAnswers): CarRecommendation {
  const { q1, q2, q3, q4, q5 } = answers;

  // 1. Extreme Tier (Score >= 88) + Sporty Drivers
  if (totalScore >= 88 && q3 === 0) {
    if (q4 === 0) {
      // Sporty + Sing-along + Supercar Score
      return {
        carName: "페라리 296 GTB (830마력 미드십 하이브리드 슈퍼카)",
        carImgUrl: "https://images.unsplash.com/photo-1592198084033-aade902d1aae?auto=format&fit=crop&w=800&q=80",
        carReason: "상위 1%의 전광석화 같은 반사 신경과 음악에 몸을 맡기는 폭발적인 열정! 830마력의 사운드로 도로를 지배하는 최고의 하이퍼 드림카입니다.",
        musicName: "심장을 울리는 울트라 EDM & 페스티벌 앤섬",
        musicReason: "제로백 2.9초의 압도적 가속력과 페라리 V6 터보 사운드에 쾌감을 더해주는 강렬한 비트입니다."
      };
    } else {
      // Sporty + Jazz/Classical Focus + Supercar Score
      return {
        carName: "포르쉐 911 GT3 (서킷의 제왕, 궁극의 자연흡기 모터스포츠 머신)",
        carImgUrl: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=800&q=80",
        carReason: "초인적인 순발력과 완벽한 변속 센스를 갖춘 당신, 한 치의 오차도 허용치 않는 9,000RPM의 감동을 그대로 선사하는 트랙 위의 전설입니다.",
        musicName: "전율을 자아내는 시네마틱 오케스트라 & 록 앤섬",
        musicReason: "극도의 집중력을 발휘하는 정밀한 코너링 순간에 아드레날린을 최고조로 끌어올립니다."
      };
    }
  }

  // 2. High-Tech Future EV Enthusiasts (Q5=0 follows nav, Q1=1 clean)
  if (q5 === 0 && q1 === 1 && (q3 === 0 || totalScore >= 75)) {
    return {
      carName: "테슬라 모델 S 플레이드 (1,020마력 하이테크 초고속 EV)",
      carImgUrl: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&q=80",
      carReason: "내비게이션과 오토파일럿의 첨단 알고리즘을 신뢰하며 결벽증에 가까운 깔끔함을 갖춘 당신에게 제로백 2.1초의 미래 모빌리티가 응답합니다.",
      musicName: "미래지향적 신스웨이브 & 사이버 일렉트로닉",
      musicReason: "조용한 전기 모터 속에 네온빛 도시를 활주하는 감각을 완벽히 재현해 줍니다."
    };
  }

  // 3. True Track & Cornering Beast: BMW M3 (Q3=0 Sporty, Q2=1 Competitive/Strict)
  if (q3 === 0 && q2 === 1) {
    return {
      carName: "BMW M3 컴페티션 (칼각 코너링의 도로 위 맹수)",
      carImgUrl: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80",
      carReason: "타협 없는 칼각 차선 변경과 흐름을 주도하는 강인한 승부욕! M xDrive의 민첩한 트랙션이 당신의 공격적인 드라이빙을 완성합니다.",
      musicName: "묵직한 808 베이스 힙합 & 다이나믹 트랩",
      musicReason: "스티어링 휠을 꽉 쥐게 만드는 긴장감과 공격적인 주행 리듬에 완벽히 부합합니다."
    };
  }

  // 4. Wild Off-Road Adventurers (Q5=1 shortcut intuition, Q1=0 free-spirited/cans)
  if (q5 === 1 && q1 === 0 && q4 === 0) {
    return {
      carName: "지프 랭글러 루비콘 (길이 없으면 만들어 달리는 야생의 오프로더)",
      carImgUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80",
      carReason: "내비게이션 지시보다 나만의 감을 믿고, 캔 하나 굴러다녀도 야생의 낭만을 즐기며 목청껏 떼창하는 자유로운 영혼의 상징입니다.",
      musicName: "가슴이 뻥 뚫리는 컨트리 록 & 올드팝 떼창 명곡",
      musicReason: "오픈탑을 젖히고 흙먼지를 가르며 목청 높여 부르기에 가장 잘 어울리는 멜로디입니다."
    };
  }

  // 5. Tough Retro Modern 4x4 (Q5=1 shortcut intuition, Q2=1 strict)
  if (q5 === 1 && q2 === 1) {
    return {
      carName: "포드 브롱코 4도어 (거친 지형을 정복하는 레트로 액티브 SUV)",
      carImgUrl: "https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=800&q=80",
      carReason: "정체 구간 얌체 끼어들기는 용납하지 않고 언제든 험로 지름길로 빠져나갈 줄 아는 결단력 넘치는 모험가형 드라이버입니다.",
      musicName: "심장을 울리는 그런지 록 & 에너제틱 얼터너티브",
      musicReason: "묵직하고 단단한 차체 감각과 함께 주행의 박진감을 북돋워 줍니다."
    };
  }

  // 6. Premium Modern Explorer (Q5=1 shortcut, Q1=1 clean)
  if (q5 === 1 && q1 === 1) {
    return {
      carName: "랜드로버 디펜더 110 (모던 럭셔리와 전천후 탐험의 결정체)",
      carImgUrl: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=80",
      carReason: "지름길을 꿰뚫어 보는 대담한 직관력과 항상 단정하고 세련된 감각을 겸비한 하이엔드 어드벤처 오너에게 가장 잘 어울립니다.",
      musicName: "광활한 대자연을 담은 시네마틱 사운드트랙 & 인디 포크",
      musicReason: "어떤 험로에서도 우아함을 잃지 않는 디펜더의 품격을 완성합니다."
    };
  }

  // 7. Everyday Fun Car with Popcorn Exhaust (Q3=0 Sporty, Q1=0 casual, Q4=0 sing-along)
  if (q3 === 0 && q1 === 0 && q4 === 0) {
    return {
      carName: "현대 아반떼 N (국산 팝콘 배기음의 제왕, 가성비 펀카)",
      carImgUrl: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80",
      carReason: "실내 먼지 따윈 훌훌 털고 팝콘 터지는 배기음과 민첩한 코너링에 신나게 노래 부르는 순수 펀 드라이빙 마니아입니다.",
      musicName: "스트레스를 날려버리는 펑크 록 & 신나는 K-POP 댄스",
      musicReason: "가속 페달을 밟을 때마다 터져 나오는 경쾌한 주행 쾌감과 하나가 됩니다."
    };
  }

  // 8. Open-Air Agile Go-Kart (Q4=0 Sing-along, Q5=1 or high avoidance)
  if (q4 === 0 && q5 === 1) {
    return {
      carName: "미니 쿠퍼 JCW (개성 넘치는 오픈에어링 고카트 필링)",
      carImgUrl: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80",
      carReason: "좁은 골목도 요리조리 칼같이 파고드는 차폭 감각과 음악에 맞춰 어깨춤을 추는 트렌드세터 드라이버의 워너비입니다.",
      musicName: "어깨가 들썩이는 브루노 마스 스타일 펑키 팝 & 디스코",
      musicReason: "꽉 막힌 도심도 순식간에 신나는 드라이빙 파티로 바꾸어 줍니다."
    };
  }

  // 9. Pure Lightweight Roadster (Q3=0 Sporty, Q4=0 Sing-along, Q2=0 Generous)
  if (q3 === 0 && q4 === 0) {
    return {
      carName: "마쓰다 MX-5 미아타 (인마일체, 세계에서 가장 사랑받는 경량 로드스터)",
      carImgUrl: "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80",
      carReason: "출력 경쟁보다 운전자와 차체가 하나가 되어 굽이진 도로를 부드럽게 감아도는 순수 드라이빙의 감동을 즐기는 진정한 낭만파입니다.",
      musicName: "청량한 바닷바람 같은 서프 록 & 90년대 J-POP 명곡",
      musicReason: "지붕을 열고 달릴 때 뺨을 스치는 바람과 가장 조화로운 사운드입니다."
    };
  }

  // 10. Ultimate Luxury Flagship (Q1=1 Ultra-clean, Q4=1 Classical/Jazz, Q2=0 Generous, Q3=1 Defensive)
  if (q1 === 1 && q4 === 1 && q2 === 0) {
    return {
      carName: "메르세데스-벤츠 S-클래스 (도로 위의 퍼스트 클래스, 궁극의 플래그십)",
      carImgUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80",
      carReason: "티끌 하나 없는 완벽한 청결 관리와 마음 넓은 신사적 양보 매너, 클래식 선율 속에 구름 위를 미끄러지듯 달리는 품격의 정점입니다.",
      musicName: "베를린 필하모닉의 정통 클래식 심포니 & 쳇 베이커 재즈",
      musicReason: "세계 최고 수준의 부메스터 오디오가 선사하는 깊은 공간감을 음미할 수 있습니다."
    };
  }

  // 11. Safe Scandinavian Family Sanctuary (Q3=1 Defensive, Q2=0 Generous, Q4=1 Jazz/Calm)
  if (q3 === 1 && q2 === 0 && q4 === 1) {
    return {
      carName: "볼보 XC90 리차지 (지구상에서 가장 안전한 스칸디나비안 패밀리 SUV)",
      carImgUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
      carReason: "초보 운전자도 너그럽게 배려하며 나와 가족의 안전을 무엇보다 소중히 여기는 도로 위의 가장 따뜻한 수호천사입니다.",
      musicName: "마음의 평온을 주는 어쿠스틱 피아노 & 북유럽 감성 로파이",
      musicReason: "차분한 템포로 장거리 운전 피로와 도심 정체 스트레스를 말끔히 씻어줍니다."
    };
  }

  // 12. Futuristic Aerodynamic EV (Q5=0 Follows nav, Q4=1 Calm/Jazz)
  if (q5 === 0 && q4 === 1) {
    return {
      carName: "현대 아이오닉 6 (공기역학 일렉트리파이드 스트림라이너)",
      carImgUrl: "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80",
      carReason: "내비게이션의 지시를 충실히 따르며 조용하고 매끄러운 전비 최적화 주행을 즐기는 스마트 친환경 오너의 모범입니다.",
      musicName: "정숙한 콕핏을 채우는 칠합(Chillhop) & 어반 R&B",
      musicReason: "전기차의 독보적인 정숙성과 감각적인 앰비언트 라이트를 더욱 돋보이게 합니다."
    };
  }

  // 13. Dynamic Urban Luxury Crossover (Q1=1 Clean, Q3=0 Sporty)
  if (q1 === 1 && q3 === 0) {
    return {
      carName: "제네시스 GV70 스포츠 (역동적인 우아함의 도심형 럭셔리 SUV)",
      carImgUrl: "https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=800&q=80",
      carReason: "깔끔한 스타일링 감각과 언제든 치고 나갈 수 있는 파워트레인을 두루 갖춘 트렌디한 도심형 드라이버의 완벽한 매칭입니다.",
      musicName: "감각적이고 세련된 어반 R&B & 시티팝",
      musicReason: "도심 빌딩 숲과 야경 속을 부드럽게 가로지르는 무드를 연출합니다."
    };
  }

  // 14. Friendly Family Camp & Road Trip (Q3=1 Defensive, Q4=0 Sing-along, Q2=0 Generous)
  if (q3 === 1 && q4 === 0 && q2 === 0) {
    return {
      carName: "현대 싼타페 하이브리드 (주말 힐링과 일상을 아우르는 패밀리 SUV)",
      carImgUrl: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80",
      carReason: "동승자와 함께 흥얼거리는 떼창의 즐거움을 알고, 방어 운전과 양보로 모두를 안심시키는 다정하고 든든한 가장입니다.",
      musicName: "온 가족이 함께 부르는 2000년대 명곡 댄스 & 감성 가요",
      musicReason: "장거리 고속도로 여행도 지루할 틈 없이 유쾌한 추억으로 만들어 줍니다."
    };
  }

  // 15. Free-Spirited Big Space Van (Q3=1 Defensive, Q1=0 cans, Q2=0 generous)
  if (q3 === 1 && q1 === 0) {
    return {
      carName: "기아 카니발 하이리무진 (압도적 공간과 편안함의 프리미엄 밴)",
      carImgUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80",
      carReason: "차 안에 짐이나 음료수가 흩어져 있어도 편안함이 최고! 소중한 사람들을 모두 태우고 여유롭게 도로를 달리는 안락한 요새입니다.",
      musicName: "편안한 드라이브 어쿠스틱 팝 & 여행 믹스",
      musicReason: "넓은 실내 공간에서 대화와 휴식을 방해하지 않는 부드러운 멜로디입니다."
    };
  }

  // 16. Cute City Commuter & Beginner Rookie (Score < 50 or isUnlicensed)
  if (totalScore < 50 || isUnlicensed) {
    return {
      carName: "현대 캐스퍼 터보 (귀여운 도심의 골목대장, 청년 루키 펀카)",
      carImgUrl: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80",
      carReason: "좁은 주차공간과 복잡한 골목길도 걱정 없는 앙증맞은 차폭! 부담 없는 운전 재미와 개성 만점 실용성을 갖춘 최고의 파트너입니다.",
      musicName: "발랄하고 통통 튀는 어쿠스틱 인디 팝 & 봄 캐럴",
      musicReason: "운전이 아직 낯선 초보 드라이버의 긴장을 기분 좋게 풀어줍니다."
    };
  }

  // 17. National Standard Premium Choice (Balanced Default)
  return {
    carName: "기아 쏘렌토 하이브리드 (실용성과 안락함을 모두 잡은 대한민국 1등 SUV)",
    carImgUrl: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80",
    carReason: "뛰어난 연비와 넉넉한 공간, 정숙함까지 고루 갖추어 어떤 주행 환경에서도 최상의 밸런스를 선사하는 만능 SUV입니다.",
    musicName: "청량한 드라이브 팝송 & 업템포 신스팝",
    musicReason: "지루할 틈 없는 경쾌한 리듬으로 주행 집중력과 산뜻한 기분 전환을 선사합니다."
  };
}

// =================================================================
// RESULTS & ANALYSIS REPORT
// =================================================================
function showResults() {
  showScreen('result');

  const totalScore = gameScores.reaction + gameScores.avoidance + gameScores.parking + gameScores.gear;
  const totalScoreEl = document.getElementById('result-total-score');
  if (totalScoreEl) totalScoreEl.innerText = String(totalScore);

  let percentile = 15;
  if (totalScore >= 92) percentile = 1;
  else if (totalScore >= 85) percentile = 3;
  else if (totalScore >= 75) percentile = 10;
  else if (totalScore >= 60) percentile = 25;
  else if (totalScore >= 45) percentile = 45;
  else percentile = 70;

  const percEl = document.getElementById('result-percentile');
  const chartPosLabel = document.getElementById('chart-position-label');
  if (percEl) percEl.innerText = `${percentile}%`;
  if (chartPosLabel) chartPosLabel.innerText = `내 위치: 상위 ${percentile}% (${totalScore}점)`;

  let title = "베테랑 로드 마스터";
  let desc = "반응속도, 차폭 감각, 변속 타이밍 전반에 걸쳐 타의 추종을 불허하는 완벽한 드라이빙 센스를 지니고 있습니다.";
  if (totalScore < 50) {
    title = "안전제일 장롱면허 루키";
    desc = "아직 도로 주행 감각과 반사 신경이 익숙치 않으나, 높은 신중함으로 사고 위험이 적은 원석 같은 드라이버입니다.";
  } else if (totalScore < 75) {
    title = "스마트 시티 드라이버";
    desc = "일상적인 출퇴근 및 주행에서 안정적인 기량을 보여주며 위기 대처 능력도 평균 이상인 모범 운전자입니다.";
  }

  const archTitleEl = document.getElementById('result-archetype-title');
  const archDescEl = document.getElementById('result-archetype-desc');
  if (archTitleEl) archTitleEl.innerText = title;
  if (archDescEl) archDescEl.innerText = `"${desc}"`;

  // RUN DEDICATED CAR RECOMMENDATION ENGINE
  const recommendation = calculateDreamCar(totalScore, surveyAnswers);

  const recCarEl = document.getElementById('result-recommended-car');
  const carImgEl = document.getElementById('result-car-img') as HTMLImageElement | null;
  const carReasonEl = document.getElementById('result-car-reason');
  const recMusicEl = document.getElementById('result-recommended-music');
  const musicReasonEl = document.getElementById('result-music-reason');

  if (recCarEl) recCarEl.innerText = recommendation.carName;
  if (carImgEl) carImgEl.src = recommendation.carImgUrl;
  if (carReasonEl) carReasonEl.innerText = recommendation.carReason;
  if (recMusicEl) recMusicEl.innerText = recommendation.musicName;
  if (musicReasonEl) musicReasonEl.innerText = recommendation.musicReason;

  // Category Breakdown List with Icons
  const getReactionDesc = (score: number) => {
    if (score >= 22) return "돌발 상황에서 비상 제동이나 회피 기동을 수행할 수 있는 최상급 반사 신경을 가졌습니다.";
    if (score >= 15) return "평균적인 돌발 반응 속도로 안전 주행에 무리가 없는 무난한 순발력입니다.";
    return "돌발 상황 대처 시 조금 더 전방 주시와 여유 있는 반응 속도 연습이 권장됩니다.";
  };

  const getAvoidanceDesc = (score: number) => {
    if (score >= 22) return "차선 변경과 장애물 회피 시 스티어링 휠 조작이 매우 부드럽고 안정적입니다.";
    if (score >= 15) return "급하지 않은 상황에서 무난하게 차선을 유지하며 주행하는 조향 능력입니다.";
    return "좁은 도로 주행 시 차체 폭과 조향각 감각을 조금 더 다듬을 필요가 있습니다.";
  };

  const getParkingDesc = (score: number) => {
    if (score >= 22) return "복잡하고 좁은 주차 공간에서도 좁은 각도를 완벽히 파악하는 탁월한 차폭 감각입니다.";
    if (score >= 15) return "표준적인 주차 공간에 무난하게 입고할 수 있는 안정적인 공간 지각력입니다.";
    return "후진 주차 및 기둥/장애물 회피 감각을 익히기 위해 여유로운 반복 연습이 좋습니다.";
  };

  const getGearDesc = (score: number) => {
    if (score >= 22) return "RPM과 엔진 부하의 흐름을 정확히 이해하고 최적의 타이밍을 잡아내는 변속 센스입니다.";
    if (score >= 15) return "주행 리듬에 맞춰 적절한 변속 타이밍을 가늠할 수 있는 무난한 감각입니다.";
    return "엔진 소리와 게이지 박자의 합을 맞추는 타이밍 감각을 조금 더 키우면 좋습니다.";
  };

  const catList = document.getElementById('categories-analysis-list');
  if (catList) {
    catList.innerHTML = `
      <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
        <div class="flex justify-between items-center text-xs font-bold">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-[10px]"><i class="fa-solid fa-stopwatch"></i></span>
            <span class="text-slate-800">1. 신호등 반응속도 (순발력)</span>
          </div>
          <span class="text-indigo-600">${gameScores.reaction} / 25점</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full rounded-full" style="width: ${(gameScores.reaction / 25) * 100}%"></div>
        </div>
        <p class="text-[11px] text-slate-500 font-medium">${getReactionDesc(gameScores.reaction)}</p>
      </div>
      <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
        <div class="flex justify-between items-center text-xs font-bold">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-[10px]"><i class="fa-solid fa-car-burst"></i></span>
            <span class="text-slate-800">2. 장애물 피하기 (조향 감각)</span>
          </div>
          <span class="text-indigo-600">${gameScores.avoidance} / 25점</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full rounded-full" style="width: ${(gameScores.avoidance / 25) * 100}%"></div>
        </div>
        <p class="text-[11px] text-slate-500 font-medium">${getAvoidanceDesc(gameScores.avoidance)}</p>
      </div>
      <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
        <div class="flex justify-between items-center text-xs font-bold">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]"><i class="fa-solid fa-square-parking"></i></span>
            <span class="text-slate-800">3. 주차 챌린지 (차폭 감각)</span>
          </div>
          <span class="text-indigo-600">${gameScores.parking} / 25점</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full rounded-full" style="width: ${(gameScores.parking / 25) * 100}%"></div>
        </div>
        <p class="text-[11px] text-slate-500 font-medium">${getParkingDesc(gameScores.parking)}</p>
      </div>
      <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
        <div class="flex justify-between items-center text-xs font-bold">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]"><i class="fa-solid fa-gear"></i></span>
            <span class="text-slate-800">4. 기어 변속 타이밍 (변속 센스)</span>
          </div>
          <span class="text-indigo-600">${gameScores.gear} / 25점</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full rounded-full" style="width: ${(gameScores.gear / 25) * 100}%"></div>
        </div>
        <p class="text-[11px] text-slate-500 font-medium">${getGearDesc(gameScores.gear)}</p>
      </div>
    `;
  }

  renderDistributionChart(totalScore);
}

function renderDistributionChart(userScore: number) {
  const chartCanvas = document.getElementById('distributionChart') as HTMLCanvasElement | null;
  if (!chartCanvas) return;
  const ctxChart = chartCanvas.getContext('2d');
  if (!ctxChart) return;

  if (chartInstance) chartInstance.destroy();

  const userPositionPlugin = {
    id: 'userPositionPlugin',
    afterDraw(chart: any) {
      const { ctx: chartCtx, chartArea: { top, bottom } } = chart;

      let indexVal = 2;
      if (userScore >= 90) indexVal = 5;
      else if (userScore >= 75) indexVal = 4;
      else if (userScore >= 60) indexVal = 3;
      else if (userScore >= 45) indexVal = 2;
      else if (userScore >= 30) indexVal = 1;
      else indexVal = 0;

      const meta = chart.getDatasetMeta(0);
      const point = meta.data[indexVal];
      if (!point) return;

      chartCtx.save();
      chartCtx.beginPath();
      chartCtx.strokeStyle = '#ef4444';
      chartCtx.lineWidth = 2.5;
      chartCtx.setLineDash([4, 4]);
      chartCtx.moveTo(point.x, top + 10);
      chartCtx.lineTo(point.x, bottom);
      chartCtx.stroke();
      chartCtx.restore();

      chartCtx.save();
      chartCtx.fillStyle = '#ef4444';
      chartCtx.font = 'bold 11px Pretendard, sans-serif';
      chartCtx.textAlign = 'center';
      chartCtx.fillText(`★ 내 위치 (${userScore}점)`, point.x, top);
      chartCtx.restore();
    }
  };

  chartInstance = new Chart(ctxChart, {
    type: 'line',
    data: {
      labels: ['20점대', '35점대', '50점대', '65점대', '80점대', '95점대 이상'],
      datasets: [{
        label: '운전자 분포',
        data: [5, 15, 35, 40, 20, 8],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { display: false },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    },
    plugins: [userPositionPlugin]
  });
}

function generateFortuneAnalysis() {
  const nameInput = document.getElementById('prof-name') as HTMLInputElement | null;
  const name = nameInput?.value.trim() || "운전자";
  const birthInput = document.getElementById('prof-birth') as HTMLInputElement | null;
  const birth = birthInput?.value;
  const totalScore = gameScores.reaction + gameScores.avoidance + gameScores.parking + gameScores.gear;

  let fortuneSentence = "";
  if (isUnlicensed) {
    if (totalScore >= 65) {
      fortuneSentence = `🔮 [사주 프로파일링 - 무면허 맞춤 진단] ${name}님은 타고난 드라이빙 감각과 순발력이 매우 뛰어납니다! 실력이 훌륭하므로 당장 면허를 취득하여 도로 위로 진출하는 것을 적극 추천합니다. 머지않아 베스트 드라이버로 명성을 떨칠 운명입니다!`;
    } else {
      fortuneSentence = `🔮 [사주 프로파일링 - 무면허 맞춤 진단] ${name}님은 현재 기초 주행 감각과 순발력이 조금 다듬어질 필요가 있습니다. 하지만 멋진 운전자가 되기 위해 면허 취득 목표를 향해 조금만 더 열심히 노력한다면 반드시 훌륭한 드라이버로 거듭날 수 있으니 힘내세요!`;
    }
  } else {
    if (totalScore >= 80) {
      fortuneSentence = `🔮 [사주 프로파일링] ${name}님(생년월일: ${birth || "미입력"})은 천을귀인이 호위하는 천생 드라이버 사주입니다. 도로 위의 흐름을 동물적으로 읽어내며, 어떤 급커브나 돌발 상황 속에서도 귀인의 조력을 받듯 안전하고 우아하게 위기를 탈출할 운명입니다!`;
    } else if (totalScore >= 55) {
      fortuneSentence = `🔮 [사주 프로파일링] ${name}님(생년월일: ${birth || "미입력"})은 중용의 도를 아는 안정형 드라이버 사주입니다. 조급함을 경계하고 방어 운전을 철저히 할수록 재물운과 교통 안전운이 동시에 상승하여 언제나 평탄한 귀가길이 보장됩니다.`;
    } else {
      fortuneSentence = `🔮 [사주 프로파일링] ${name}님(생년월일: ${birth || "미입력"})은 대기만성형 안전주의자 사주입니다. 초기 주행 감각은 다소 수줍으나, 경험이 쌓일수록 묵묵히 명장이 되는 대형 면허의 기운을 품고 있으니 템포를 조금만 늦추면 만사형통입니다!`;
    }
  }

  const box = document.getElementById('fortune-result-box');
  if (box) {
    box.innerText = fortuneSentence;
    box.classList.remove('hidden');
  }
  showToast("사주형 운전 성향 진단이 완료되었습니다.");
}

function shareResult() {
  const totalScore = gameScores.reaction + gameScores.avoidance + gameScores.parking + gameScores.gear;
  const text = `[드라이빙 종합 진단 결과]\n나의 운전 능력 점수: ${totalScore}점 / 100점!\n순발력, 조향, 주차, 변속 테스트 및 성향 설문을 완료했습니다. 지금 테스트에 도전해보세요!`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("결과 내용이 클립보드에 복사되었습니다!");
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast("결과 내용이 클립보드에 복사되었습니다!");
  } catch (err) {
    showToast("복사 실패. 브라우저 권한을 확인해주세요.");
  }
  document.body.removeChild(textarea);
}
