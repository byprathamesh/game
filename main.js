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

// --- Particle System ---
let particles = [];
function spawnParticle(x, y, color, vx, vy, life, size=3) {
  particles.push({x, y, color, vx, vy, life, size});
}
function updateParticles(dt) {
  for (let p of particles) {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}
function drawParticles() {
  for (let p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life/0.6);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, 2*Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

// --- Fade-in overlay ---
let fadeAlpha = 1, fadeDir = -1; // -1: fade in, 1: fade out
function drawFade() {
  if (fadeAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}


// --- Starfield ---
function drawStarfield() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  // Starfield: static stars for night effect
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(Math.floor((i*53)%w), Math.floor((i*191)%h), 2, 2);
    ctx.globalAlpha = 1.0;
  }
}

// --- Headlight effect ---
function drawHeadlights() {
  // Headlight cone effect
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y-30);
  ctx.arc(player.x, player.y-120, 120, Math.PI*0.88, Math.PI*0.12, false);
  ctx.lineTo(player.x, player.y-30);
  ctx.closePath();
  var gradient = ctx.createRadialGradient(player.x, player.y-30, 10, player.x, player.y-120, 120);
  gradient.addColorStop(0, 'rgba(255,255,200,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,200,0.0)');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

// --- Near-miss shake ---
let shake = 0, shakeTimer = 0;
function triggerShake(intensity=1) { shake = 18 * intensity; shakeTimer = 0.22 * intensity; }
function applyShake(dt) {
  if (shake > 0) {
    shakeTimer -= dt;
    if (shakeTimer < 0) shake = 0;
  }
}

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
let distance = 0, score = 0, scoreMultiplier = 1;
let speedMultiplier = 1;
let gameOver = false;
let paused = false; // Pause state

// --- Input State ---
let leftPressed = false, rightPressed = false;
window.addEventListener('keydown', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = true;
  if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = true;
  if (e.key === 'p' || e.key === 'P') paused = !paused;
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
  // Reset shake effect
  shake = 0;
  shakeTimer = 0;
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('finalScore').textContent = '0';
  var scoreElem = document.getElementById('score');
  if (scoreElem) scoreElem.textContent = '0 m';
  gameStartTime = Date.now(); // reset spawn timer
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
  // Lane markings (animated)
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
  // Roadside scenery
  for (let i = 0; i < 4; i++) {
    let y = (roadScroll * 0.7 + i * 160) % h;
    // Left side
    drawScenery(roadLeft-24, y);
    // Right side
    drawScenery(roadRight+8, (y+80)%h);
  }
  ctx.restore();
}

function drawScenery(x, y) {
  // Randomly pick a type based on y, and add a little vertical jitter
  let type = Math.floor((y/80)%3);
  let jitter = ((Math.sin(y/27 + x) + Math.cos(y/41 - x))*5)|0;
  ctx.save();
  ctx.translate(x, y + jitter);
  // Draw shadow/ground patch
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.ellipse(0, 18, 16, 7, 0, 0, 2*Math.PI); ctx.fill();
  ctx.restore();
  if (type === 0) {
    // Tree
    ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#8d5524'; ctx.fillRect(-2, 10, 4, 12);
  } else if (type === 1) {
    // Lamp post
    ctx.fillStyle = '#bbb'; ctx.fillRect(-2, -10, 4, 20);
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0,-12,5,0,Math.PI*2); ctx.fill();
    // Lamp glow
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.ellipse(0, 8, 18, 10, 0, 0, 2*Math.PI); ctx.fillStyle = '#ffe066'; ctx.fill();
    ctx.restore();
  } else {
    // Sign
    ctx.fillStyle = '#fff'; ctx.fillRect(-7,-7,14,14);
    ctx.fillStyle = '#f00'; ctx.fillRect(-3,-3,6,6);
  }
  ctx.restore();
}

function drawPlayer() {
  // Exhaust smoke
  if (!gameOver && Math.random() < 0.6) {
    spawnParticle(player.x, player.y+38, '#888', (Math.random()-0.5)*0.8, 1.5+Math.random()*0.8, 0.5, 4);
  }
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
  if (obs.type === 'coin') {
    ctx.save();
    ctx.translate(Math.round(obs.x), Math.round(obs.y));
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(0,0,13,0,2*Math.PI); ctx.fillStyle = '#ffd700'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
    return;
  }
  if (obs.type === 'power') {
    ctx.save();
    ctx.translate(Math.round(obs.x), Math.round(obs.y));
    ctx.globalAlpha = 0.82;
    ctx.beginPath(); ctx.arc(0,0,13,0,2*Math.PI); ctx.fillStyle = '#0ff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(Math.round(obs.x), Math.round(obs.y));
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 3;
  ctx.strokeRect(-24, -44, 48, 88); // outline
  // Truck body: random color
  ctx.fillStyle = obs.color || '#b97a57';
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
  // Taillights (blink if fast truck)
  if (obs.fast && Math.floor(Date.now()/200)%2 === 0) {
    ctx.fillStyle = '#fff';
  } else {
    ctx.fillStyle = '#ff3c28';
  }
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

// Track game start time for spawn delay
let gameStartTime = Date.now();

function spawnObstacle() {
  // Wait 1 second after game start before spawning trucks
  if (Date.now() - gameStartTime < 1000) return;

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
  let futureObstacles = truckLanes.slice();
  let openLaneExists = lanes.some(lane => !futureObstacles.includes(lane));
  if (!openLaneExists) return; // Never allow all 3 lanes blocked

  // Only spawn a new row if previous row is far enough down
  if (obstacles.length > 0) {
    let lastRowY = Math.max(...obstacles.map(o => o.y), 0);
    if (lastRowY > spawnY + minGap) return;
  }

  // Place trucks in chosen lanes for this row
  for (let lane of truckLanes) {
    // Add truck variety: random color, rare fast truck
    let truckColors = ['#b97a57', '#8d5524', '#d35400', '#2e7d32', '#1976d2'];
    let color = truckColors[Math.floor(Math.random()*truckColors.length)];
    let isFast = Math.random() < 0.12; // 12% chance
    let baseSpeed = 8 + Math.random() * 2 + distance / 600 + (isFast ? 4 : 0);
    obstacles.push({
      x: laneCenters[lane],
      y: spawnY,
      lane,
      width: 48,
      height: 88,
      speed: baseSpeed,
      type: 'truck',
      color,
      fast: isFast
    });
  }
  // Occasionally spawn coins/powerups
  if (Math.random() < 0.13) {
    let lane = truckLanes[Math.floor(Math.random()*truckLanes.length)];
    let kind = Math.random() < 0.7 ? 'coin' : 'power';
    obstacles.push({
      x: laneCenters[lane],
      y: spawnY-40,
      lane,
      width: 26,
      height: 26,
      speed: 10,
      type: kind
    });
  }
}

// --- Main Draw Function ---
function draw(dt) {
  // Fade in at game start
  if (fadeAlpha > 0 && fadeDir < 0) fadeAlpha = Math.max(0, fadeAlpha - dt*1.2);
  if (fadeAlpha > 0 && fadeDir > 0) fadeAlpha = Math.min(1, fadeAlpha + dt*2.5);

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
  // Speed lines
  if (!gameOver && distance > 600) {
    for (let i = 0; i < Math.min(12, Math.floor(distance/200)); i++) {
      let sx = player.x + (Math.random()-0.5)*40;
      let sy = player.y - 50 - Math.random()*120;
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.random()*0.13;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 + Math.random();
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy+30+Math.random()*20);
      ctx.stroke();
      ctx.restore();
    }
  }
  drawPlayer();
  drawParticles();
  for (let obs of obstacles) drawObstacle(obs);
  ctx.restore();
}

function update(dt) {
  if (paused) return;
  if (!gameOver) {
    distance += dt * 200;
    score += Math.floor(dt * 20 * scoreMultiplier); // slower, but with multiplier
    // Lane narrowing
    if (distance > 800) {
      let shrink = Math.min(0.23, (distance-800)/6000);
      let roadLeft = Math.round(w * (0.10 + shrink));
      let roadRight = Math.round(w * (0.90 - shrink));
      let laneWidth = Math.round((roadRight - roadLeft) / 3);
      for (let i = 0; i < 3; i++) laneCenters[i] = Math.round(roadLeft + laneWidth/2 + i*laneWidth);
    }

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
    // Near-miss shake: if player is close but not colliding
    let nearMiss = !gameOver && Math.abs(player.x - obs.x) < (player.width + obs.width)/2 + 10 &&
        Math.abs(player.y - obs.y) < (player.height + obs.height)/2 + 10 &&
        !(Math.abs(player.x - obs.x) < (player.width + obs.width)/2 && Math.abs(player.y - obs.y) < (player.height + obs.height)/2);
    if (nearMiss) {
      triggerShake(0.2);
      spawnParticle(player.x, player.y-24, '#ffe066', (Math.random()-0.5)*2, -2-Math.random()*1.5, 0.35, 3);
      scoreMultiplier = 2; // Double score for brief period
    }
  }
  // Power-up/coin pickup logic
  for (let obs of obstacles) {
    if (obs.type === 'coin' && Math.abs(player.x - obs.x) < (player.width + obs.width)/2 && Math.abs(player.y - obs.y) < (player.height + obs.height)/2) {
      score += 100;
      spawnParticle(obs.x, obs.y, '#ffd700', (Math.random()-0.5)*2, -2, 0.6, 6);
      obs.y = h+200; // Remove coin
    }
    if (obs.type === 'power' && Math.abs(player.x - obs.x) < (player.width + obs.width)/2 && Math.abs(player.y - obs.y) < (player.height + obs.height)/2) {
      scoreMultiplier = 5;
      spawnParticle(obs.x, obs.y, '#0ff', (Math.random()-0.5)*2, -2, 0.7, 8);
      obs.y = h+200; // Remove powerup
    }
  }
  obstacles = obstacles.filter(obs => obs.y - obs.height/2 < h);
  for (let obs of obstacles) {
    if (
      Math.abs(player.x - obs.x) < (player.width + obs.width) / 2 &&
      Math.abs(player.y - obs.y) < (player.height + obs.height) / 2
    ) {
      gameOver = true;
      triggerShake(2.5);
      document.getElementById('gameOverScreen').style.display = 'flex';
      document.getElementById('finalScore').textContent = score;
      break;
    }
  }
  // Make spawn interval decrease more aggressively as distance increases
// Truck spawn interval and speed get much harder, much faster
let difficulty = distance > 2000 ? 2.5 : distance > 1000 ? 1.7 : 1.0;
obstacleInterval = Math.max(minInterval, 140 - (distance/7)*difficulty); // faster spawn
for (let obs of obstacles) {
  if (obs.type === 'truck') {
    obs.speed = 8 + (distance/350)*difficulty + (obs.fast ? 4 : 0) + Math.random()*2;
  }
}
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
