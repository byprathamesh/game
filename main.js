window.onerror = function(message, source, lineno, colno, error) {
  if (typeof message === 'string' && message.includes('Access to storage is not allowed')) return true;
  if (typeof message === 'string' && message.includes('Unknown response id')) return true;
  return false; // Let other errors through
};
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
  let roadLeft = Math.round(w * 0.10);
  let roadRight = Math.round(w * 0.90);
  let laneWidth = Math.round((roadRight - roadLeft) / 3);
  for (let i = 0; i < 3; i++) laneCenters.push(Math.round(roadLeft + laneWidth/2 + i*laneWidth));
}
updateLaneCenters();
let player = { x: laneCenters[1], y: h - 100, width: 44, height: 74, speed: 15, color: '#0ff' }; // Larger, more visible player
let obstacles = [], obstacleTimer = 0, obstacleInterval = 180, minInterval = 60;
let distance = 0, score = 0;
let speedMultiplier = 1;
let gameOver = false;

// --- Input State ---
let leftPressed = false, rightPressed = false;
window.addEventListener('keydown', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = true;
  if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = true;
  if (gameOver && (e.key === ' ' || e.key === 'Enter')) restartGame();
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
  updateLaneCenters();
  player.x = laneCenters[1]; // center lane
  player.y = h - 80; // near bottom
  distance = 0;
  score = 0;
  obstacles = [];
  gameOver = false;
  obstacleInterval = 180;
  obstacleTimer = obstacleInterval;
  leftPressed = rightPressed = false;
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('finalScore').textContent = '0';
  lastTime = performance.now();
  requestAnimationFrame(loop);
}
document.getElementById('restartBtn').onclick = restartGame;

function drawRoad() {
  ctx.save();
  // Widen the road for better visibility
  ctx.fillStyle = '#888'; // Road grey
  const roadLeft = Math.round(w * 0.10);
  const roadRight = Math.round(w * 0.90);
  ctx.fillRect(roadLeft, 0, roadRight - roadLeft, h);
  // Lane markings
  ctx.fillStyle = '#fff';
  let laneWidth = Math.round((roadRight - roadLeft) / 3);
  for (let i = 1; i < 3; i++) {
    let x = Math.round(roadLeft + i * laneWidth);
    for (let y = (roadScroll % 32) - 32; y < h; y += 32) ctx.fillRect(x - 2, y, 4, 20);
  }
  // Road edge lines
  ctx.fillStyle = '#222';
  ctx.fillRect(roadLeft - 4, 0, 4, h);
  ctx.fillRect(roadRight, 0, 4, h);
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(Math.round(player.x), Math.round(player.y));
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.strokeRect(-22, -37, 44, 74); // outline
  // Body
  ctx.fillStyle = '#232323';
  ctx.fillRect(-20, -35, 40, 70);
  // Blue window
  ctx.fillStyle = '#5a8fd6';
  ctx.fillRect(-13, -25, 26, 14);
  // Headlights
  ctx.fillStyle = '#fff';
  ctx.fillRect(-10, -37, 8, 6);
  ctx.fillRect(2, -37, 8, 6);
  // Taillights
  ctx.fillStyle = '#ff3c28';
  ctx.fillRect(-10, 31, 8, 6);
  ctx.fillRect(2, 31, 8, 6);
  // Grill
  ctx.fillStyle = '#666';
  ctx.fillRect(-8, -35, 16, 5);
  // Wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-20, -25, 7, 18);
  ctx.fillRect(13, -25, 7, 18);
  ctx.fillRect(-20, 10, 7, 18);
  ctx.fillRect(13, 10, 7, 18);
  ctx.restore();
}

function drawObstacle(obs) {
  ctx.save();
  ctx.translate(Math.round(obs.x), Math.round(obs.y));
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 3;
  ctx.strokeRect(-24, -44, 48, 88); // outline
  // Truck body
  ctx.fillStyle = '#b97a57';
  ctx.fillRect(-22, -42, 44, 84);
  // Cabin
  ctx.fillStyle = '#cfcfcf';
  ctx.fillRect(-16, -42, 32, 28);
  // Grill
  ctx.fillStyle = '#888';
  ctx.fillRect(-10, -42, 20, 7);
  // Headlights
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(-18, -44, 7, 7);
  ctx.fillRect(11, -44, 7, 7);
  // Taillights
  ctx.fillStyle = '#ff3c28';
  ctx.fillRect(-18, 37, 7, 7);
  ctx.fillRect(11, 37, 7, 7);
  // Wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-22, -30, 8, 18);
  ctx.fillRect(14, -30, 8, 18);
  ctx.fillRect(-22, 14, 8, 18);
  ctx.fillRect(14, 14, 8, 18);
  ctx.restore();
}

function spawnObstacle() {
  const lanes = [0, 1, 2];
  // Only allow two trucks if distance > 1000, otherwise always one
  let allowTwo = distance > 1000;
  let numTrucks = allowTwo && Math.random() < 0.5 ? 2 : 1;
  // Shuffle lanes and pick which lanes to spawn in
  let shuffled = lanes.slice().sort(() => Math.random() - 0.5);
  let truckLanes = shuffled.slice(0, numTrucks);
  const spawnY = -120;

  // Prevent vertical overlap in the same lane
  let minGap = 100; // min vertical gap between trucks in same lane
  for (let lane of truckLanes) {
    let overlap = obstacles.some(o => o.lane === lane && Math.abs(o.y - spawnY) < minGap);
    if (overlap) return; // If any overlap, skip spawning this row entirely
  }

  // Guarantee at least one open lane in this vertical region
  // Check for every lane if it will be blocked in this region
  let futureObstacles = truckLanes.slice();
  let openLaneExists = lanes.some(lane => !futureObstacles.includes(lane));
  if (!openLaneExists) return; // Never allow all 3 lanes blocked

  // Only spawn a new row if previous row is far enough down
  let lastRowY = Math.max(...obstacles.map(o => o.y), 0);
  if (lastRowY > spawnY + minGap) return;

  // Place trucks in chosen lanes for this row
  for (let lane of truckLanes) {
    let baseSpeed = 8 + Math.random() * 2 + distance / 600; // speed increases with distance
    obstacles.push({
      x: laneCenters[lane],
      y: spawnY,
      lane,
      width: 48,
      height: 88,
      speed: baseSpeed,
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
      document.getElementById('gameOverScreen').style.display = 'flex';
      document.getElementById('finalScore').textContent = score;
      break;
    }
  }
  // Make spawn interval decrease more aggressively as distance increases
// Truck spawn interval gets much faster as distance increases
obstacleInterval = Math.max(minInterval, 180 - distance/10);
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
