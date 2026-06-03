const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const nextCanEl = document.getElementById("nextCan");
const startButton = document.getElementById("startButton");
const message = document.getElementById("message");

const COLS = 6;
const ROWS = 10;
const CELL = canvas.width / COLS;
const DROP_MS = 720;
const FAST_DROP_MS = 70;

const flavors = [
  { id: "maguro", label: "まぐろ", color: "#e85b58", lid: "#fff0d0" },
  { id: "katsuo", label: "かつお", color: "#5da3c9", lid: "#fff3cb" },
  { id: "sasami", label: "ささみ", color: "#f2d06f", lid: "#fff8db" },
  { id: "salmon", label: "サーモン", color: "#f08b55", lid: "#fff0d3" }
];

let board;
let current;
let next;
let score;
let running;
let lastTick;
let dropTimer;
let animationFrame;

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomFlavor() {
  return flavors[Math.floor(Math.random() * flavors.length)];
}

function spawnCan() {
  current = {
    flavor: next || randomFlavor(),
    col: Math.floor(COLS / 2),
    row: 0
  };
  next = randomFlavor();
  updateNext();

  if (board[current.row][current.col]) {
    endGame();
  }
}

function updateNext() {
  nextCanEl.textContent = next ? next.label : "";
  if (next) {
    nextCanEl.style.background = `linear-gradient(180deg, ${next.lid}, ${next.color})`;
  }
}

function startGame() {
  board = makeBoard();
  score = 0;
  running = true;
  current = null;
  next = randomFlavor();
  dropTimer = 0;
  lastTick = performance.now();
  scoreEl.textContent = score;
  message.classList.remove("is-visible");
  startButton.textContent = "仕切り直す";
  spawnCan();
  cancelAnimationFrame(animationFrame);
  loop(lastTick);
}

function endGame() {
  running = false;
  current = null;
  showMessage("閉店です", `得点 ${score} 点。もう一度、猫缶を仕分けましょう。`);
}

function showMessage(title, text) {
  message.innerHTML = `<div><strong>${title}</strong><span>${text}</span></div>`;
  message.classList.add("is-visible");
}

function canMove(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS && !board[row][col];
}

function moveCurrent(delta) {
  if (!running || !current) return;
  const nextCol = current.col + delta;
  if (canMove(nextCol, current.row)) {
    current.col = nextCol;
    draw();
  }
}

function stepDown() {
  if (!running || !current) return;
  if (canMove(current.col, current.row + 1)) {
    current.row += 1;
  } else {
    settleCurrent();
  }
  draw();
}

function hardDrop() {
  if (!running || !current) return;
  while (canMove(current.col, current.row + 1)) {
    current.row += 1;
  }
  settleCurrent();
  draw();
}

function settleCurrent() {
  board[current.row][current.col] = current.flavor;
  current = null;

  let chain = 0;
  let removed = clearMatches();
  while (removed > 0) {
    chain += 1;
    score += removed * (chain === 1 ? 100 : 120 + chain * 20);
    scoreEl.textContent = score;
    collapseBoard();
    removed = clearMatches();
  }

  spawnCan();
}

function clearMatches() {
  const matched = new Set();
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const flavor = board[row][col];
      if (!flavor) continue;

      directions.forEach(([dc, dr]) => {
        const line = [[col, row]];
        let nextCol = col + dc;
        let nextRow = row + dr;

        while (
          nextCol >= 0 &&
          nextCol < COLS &&
          nextRow >= 0 &&
          nextRow < ROWS &&
          board[nextRow][nextCol]?.id === flavor.id
        ) {
          line.push([nextCol, nextRow]);
          nextCol += dc;
          nextRow += dr;
        }

        if (line.length >= 3) {
          line.forEach(([matchCol, matchRow]) => matched.add(`${matchCol},${matchRow}`));
        }
      });
    }
  }

  matched.forEach((key) => {
    const [col, row] = key.split(",").map(Number);
    board[row][col] = null;
  });

  return matched.size;
}

function collapseBoard() {
  for (let col = 0; col < COLS; col += 1) {
    const cans = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (board[row][col]) cans.push(board[row][col]);
    }
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      board[row][col] = cans[ROWS - 1 - row] || null;
    }
  }
}

function loop(now) {
  if (!running) {
    draw();
    return;
  }

  const elapsed = now - lastTick;
  lastTick = now;
  dropTimer += elapsed;

  if (dropTimer >= DROP_MS) {
    stepDown();
    dropTimer = 0;
  } else {
    draw();
  }

  animationFrame = requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board?.[row][col]) {
        drawCan(col, row, board[row][col]);
      }
    }
  }

  if (current) {
    drawCan(current.col, current.row, current.flavor, true);
  }
}

function drawGrid() {
  ctx.fillStyle = "#20140f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255, 236, 185, 0.12)";
  ctx.lineWidth = 1;
  for (let col = 1; col < COLS; col += 1) {
    ctx.beginPath();
    ctx.moveTo(col * CELL, 0);
    ctx.lineTo(col * CELL, canvas.height);
    ctx.stroke();
  }
  for (let row = 1; row < ROWS; row += 1) {
    ctx.beginPath();
    ctx.moveTo(0, row * CELL);
    ctx.lineTo(canvas.width, row * CELL);
    ctx.stroke();
  }
}

function drawCan(col, row, flavor, active = false) {
  const x = col * CELL + 7;
  const y = row * CELL + 8;
  const w = CELL - 14;
  const h = CELL - 14;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = active ? 12 : 5;
  ctx.shadowOffsetY = active ? 6 : 3;

  ctx.fillStyle = flavor.color;
  roundRect(x, y + 5, w, h - 8, 9);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.fillStyle = flavor.lid;
  roundRect(x + 2, y, w - 4, 15, 8);
  ctx.fill();

  ctx.strokeStyle = "#2a170d";
  ctx.lineWidth = 2;
  roundRect(x, y + 5, w, h - 8, 9);
  ctx.stroke();

  ctx.fillStyle = "#2a170d";
  ctx.font = "bold 13px 'Yu Gothic', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(flavor.label, x + w / 2, y + h / 2 + 5, w - 8);

  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

document.addEventListener("keydown", (event) => {
  if (!running && event.code !== "Space") return;

  if (event.code === "ArrowLeft") {
    event.preventDefault();
    moveCurrent(-1);
  }
  if (event.code === "ArrowRight") {
    event.preventDefault();
    moveCurrent(1);
  }
  if (event.code === "ArrowDown") {
    event.preventDefault();
    stepDown();
    dropTimer = Math.min(dropTimer, FAST_DROP_MS);
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (running) hardDrop();
    else startGame();
  }
});

document.querySelectorAll(".touch-controls button").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "left") moveCurrent(-1);
    if (action === "right") moveCurrent(1);
    if (action === "down") stepDown();
    if (action === "drop") hardDrop();
  });
});

startButton.addEventListener("click", startGame);

board = makeBoard();
next = randomFlavor();
score = 0;
running = false;
updateNext();
draw();
