window.onload = function() {
// --- Texture loading (must be global and first) ---
const textures = {
  grass: new Image(),
  dirt: new Image(),
  stone: new Image()
};
textures.grass.src = 'textures/grass.png';
textures.dirt.src = 'textures/dirt.png';
textures.stone.src = 'textures/stone.png';

// --- Game Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const w = canvas.width, h = canvas.height;
let roadScroll = 0;

// --- Starfield ---
function drawStarfield() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.floor(Math.random()*320), Math.floor(Math.random()*480), 2, 2);
  }
}

// --- Headlight effect ---
function drawHeadlights() {}

// --- Near-miss shake ---
let shake = 0, shakeTimer = 0;
function triggerShake(intensity=1) { shake = 18 * intensity; shakeTimer = 0.22 * intensity; }
function applyShake(dt) { if (shake > 0) { shakeTimer -= dt; if (shakeTimer < 0) shake = 0; } }

// --- Game State ---
const NUM_LANES = 3;
let laneCenters = [];
function updateLaneCenters() {
  laneCenters = [];
  let roadLeft = Math.round(w * 0.21);
  let roadRight = Math.round(w * 0.79);
  let laneWidth = Math.round((roadRight - roadLeft) / 3);
  for (let i = 0; i < 3; i++) laneCenters.push(Math.round(roadLeft + laneWidth/2 + i*laneWidth));
}
updateLaneCenters();
let player = { x: laneCenters[1], y: h/2, width: 38, height: 64, speed: 15, color: '#0ff' };
let obstacles = [], obstacleTimer = 0, obstacleInterval = 180, minInterval = 60;
let distance = 0, score = 0;
let speedMultiplier = 1;
let gameOver = false;

// --- Input State ---
let leftPressed = false, rightPressed = false;
window.addEventListener('keydown', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = true;
  if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = true;
});
window.addEventListener('keyup', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = false;
  if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = false;
});
document.getElementById('leftBtn').addEventListener('touchstart', e => { leftPressed = true; e.preventDefault(); });
document.getElementById('leftBtn').addEventListener('touchend', e => { leftPressed = false; e.preventDefault(); });
document.getElementById('leftBtn').addEventListener('mousedown', e => { leftPressed = true; });
document.getElementById('leftBtn').addEventListener('mouseup', e => { leftPressed = false; });
document.getElementById('leftBtn').addEventListener('mouseleave', e => { leftPressed = false; });
document.getElementById('rightBtn').addEventListener('touchstart', e => { rightPressed = true; e.preventDefault(); });
document.getElementById('rightBtn').addEventListener('touchend', e => { rightPressed = false; e.preventDefault(); });
document.getElementById('rightBtn').addEventListener('mousedown', e => { rightPressed = true; });
document.getElementById('rightBtn').addEventListener('mouseup', e => { rightPressed = false; });
document.getElementById('rightBtn').addEventListener('mouseleave', e => { rightPressed = false; });

function restartGame() {
  player.x = w/2; player.y = h/2; distance = 0; score = 0; obstacles = [];
  gameOver = false;
  obstacleInterval = 180;
  obstacleTimer = obstacleInterval;
  leftPressed = rightPressed = false;
  document.getElementById('gameOverScreen').style.display = 'none';
}
document.getElementById('restartBtn').onclick = restartGame;

function drawRoad() {
  ctx.save();
  ctx.fillStyle = '#888';
  ctx.fillRect(w * 0.21, 0, w * 0.58, h);
  ctx.fillStyle = '#fff';
  let roadLeft = Math.round(w * 0.21);
  let roadRight = Math.round(w * 0.79);
  let laneWidth = Math.round((roadRight - roadLeft) / 3);
  for (let i = 1; i < 3; i++) {
    let x = Math.round(roadLeft + i * laneWidth);
    for (let y = (roadScroll % 32) - 32; y < h; y += 32) ctx.fillRect(x - 2, y, 4, 20);
  }
  ctx.fillStyle = '#222';
  ctx.fillRect(roadLeft - 4, 0, 4, h);
  ctx.fillRect(roadRight, 0, 4, h);
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(Math.round(player.x), Math.round(player.y));
  ctx.fillStyle = '#111';
  ctx.fillRect(-19, -32, 38, 64);
  ctx.fillStyle = '#3498db';
  ctx.fillRect(-15, -22, 30, 18);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-11, -16, 22, 8);
  ctx.fillStyle = '#222';
  ctx.fillRect(-19, 24, 8, 8);
  ctx.fillRect(11, 24, 8, 8);
  ctx.fillStyle = '#ff3c28';
  ctx.fillRect(-7, 28, 6, 4);
  ctx.fillRect(1, 28, 6, 4);
  ctx.restore();
}

function drawObstacle(obs) {
  ctx.save();
  ctx.translate(Math.round(obs.x), Math.round(obs.y));
  ctx.fillStyle = '#b97a57';
  ctx.fillRect(-16, -32, 32, 64);
  ctx.fillStyle = '#cfcfcf';
  ctx.fillRect(-12, -32, 24, 18);
  ctx.fillStyle = '#888';
  ctx.fillRect(-8, -32, 16, 4);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(-14, -32, 6, 4);
  ctx.fillRect(8, -32, 6, 4);
  ctx.fillStyle = '#ff3c28';
  ctx.fillRect(-14, 28, 6, 4);
  ctx.fillRect(8, 28, 6, 4);
  ctx.fillStyle = '#222';
  ctx.fillRect(-16, 24, 8, 8);
  ctx.fillRect(8, 24, 8, 8);
  ctx.restore();
}

function spawnObstacle() {
  const lanes = [0, 1, 2];
  let lanesToBlock = lanes.slice();
  for (let i = lanesToBlock.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanesToBlock[i], lanesToBlock[j]] = [lanesToBlock[j], lanesToBlock[i]];
  }
  let blocks = Math.floor(Math.random() * 2) + 1;
  lanesToBlock = lanesToBlock.slice(0, blocks);
  const spawnY = -80;
  for (let lane = 0; lane < 3; lane++) {
    if (!lanesToBlock.includes(lane)) continue;
    const laneX = laneCenters[lane];
    let laneBlocked = obstacles.some(o => o.lane === lane && o.y < h && o.y > -120);
    if (laneBlocked) continue;
    obstacles.push({
      x: laneX,
      y: spawnY,
      lane,
      width: 32,
      height: 64,
      speed: 8 + Math.random() * 2,
      type: 'truck'
    });
  }
}

// --- Main Draw Function ---
function draw(dt) {
  var scoreElem = document.getElementById('score');
  if (scoreElem) scoreElem.textContent = score + ' m';
  if (!window.DEBUG_ONCE_DRAW) { console.log('DRAW RUNNING'); window.DEBUG_ONCE_DRAW = true; }
  drawStarfield();
  drawRoad();
  drawHeadlights();
  let dx = 0;
  if (shake > 0) dx = (Math.random()-0.5)*shake;
  ctx.save();
  ctx.translate(dx, 0);
  drawPlayer();
  for (let obs of obstacles) drawObstacle(obs);
  ctx.restore();
}

function update(dt) {
  if (!gameOver) {
    distance += dt * 200;
    score = Math.floor(distance);
    roadScroll += dt * 320 * 0.5;
    if (leftPressed) player.x -= player.speed * dt * 60;
    if (rightPressed) player.x += player.speed * dt * 60;
    player.x = Math.max(laneCenters[0], Math.min(laneCenters[2], player.x));
    obstacleTimer += dt * 1000;
    if (obstacleTimer >= obstacleInterval) {
      spawnObstacle();
      obstacleTimer = 0;
    }
  }
  for (let obs of obstacles) {
    obs.y += Math.abs(obs.speed) * dt * (1 + distance/1000);
  }
  obstacles = obstacles.filter(obs => obs.y - obs.height/2 < h);
  for (let obs of obstacles) {
    if (
      Math.abs(player.x - obs.x) < (player.width + obs.width) / 2 &&
      Math.abs(player.y - obs.y) < (player.height + obs.height) / 2
    ) {
      gameOver = true;
      document.getElementById('gameOverScreen').style.display = 'block';
      break;
    }
  }
  obstacleInterval = Math.max(minInterval, 180 - distance/3);
}

let lastTime = 0;
function loop(ts) {
  let dt = (ts - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1;
  lastTime = ts;
  update(dt);
  draw(dt);
  if (!gameOver) requestAnimationFrame(loop);
}

function init() {
  restartGame();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}
init();
};
