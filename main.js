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
const roadLeft = Math.round(w * 0.10);
const roadRight = Math.round(w * 0.90);
const laneWidth = Math.round((roadRight - roadLeft) / 3);
const laneCenters = [
  Math.round(roadLeft + laneWidth/2),
  Math.round(roadLeft + laneWidth/2 + laneWidth),
  Math.round(roadLeft + laneWidth/2 + 2*laneWidth)
];
let player = { x: laneCenters[1], y: Math.round(h * 0.65), width: 44, height: 74, speed: 15, color: '#0ff' }; // Centered player
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

// --- Player movement bounds ---
function clampPlayerX(x) {
  // Player can move fully within the road, not just lanes
  const minX = roadLeft + player.width/2;
  const maxX = roadRight - player.width/2;
  return Math.max(minX, Math.min(maxX, x));
}


function restartGame() {
  player.x = laneCenters[1]; // center lane
  player.y = Math.round(h * 0.65); // more vertically centered
  distance = 0;
  score = 0;
  obstacles = [];
  particles = []; // Clear particles to prevent stray dots
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
  // Randomly pick a type based on y
  let type = Math.floor((y/80)%3);
  ctx.save();
  ctx.translate(x, y+28); // 28px down so base sits on road edge
  // Draw larger, darker oval shadow/ground patch
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#181818';
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 9, 0, 0, 2*Math.PI); ctx.fill();
  ctx.restore();
  if (type === 0) {
    // Tree
    ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(0,-18,13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#8d5524'; ctx.fillRect(-2, -8, 4, 16);
  } else if (type === 1) {
    // Lamp post
    ctx.fillStyle = '#bbb'; ctx.fillRect(-2, -24, 4, 24);
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(0,-28,5,0,Math.PI*2); ctx.fill();
    // Lamp glow
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.beginPath(); ctx.ellipse(0, -12, 19, 11, 0, 0, 2*Math.PI); ctx.fillStyle = '#ffe066'; ctx.fill();
    ctx.restore();
  } else {
    // Sign
    ctx.fillStyle = '#fff'; ctx.fillRect(-7,-20,14,14);
    ctx.fillStyle = '#f00'; ctx.fillRect(-3,-16,6,6);
  }
  ctx.restore();
} // No jitter, no vibration

function drawPlayer() {
  // Sleek black modern car, no yellow dot, retro style
  if (!gameOver && Math.random() < 0.6) {
    spawnParticle(player.x, player.y+38, '#888', (Math.random()-0.5)*0.8, 1.5+Math.random()*0.8, 0.5, 4);
  }
  ctx.save();
  ctx.translate(Math.round(player.x), Math.round(player.y));
  // Outer white border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.strokeRect(-20, -36, 40, 72);
  // Main black body
  ctx.fillStyle = '#18191c';
  ctx.fillRect(-18, -34, 36, 68);
  // Sleek blue windshield
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(-10, -24, 20, 14);
  // Side gray highlights
  ctx.fillStyle = '#444';
  ctx.fillRect(-18, -20, 4, 34);
  ctx.fillRect(14, -20, 4, 34);
  // Headlights
  ctx.fillStyle = '#fff';
  ctx.fillRect(-10, -36, 8, 6);
  ctx.fillRect(2, -36, 8, 6);
  // Taillights
  ctx.fillStyle = '#ff3c28';
  ctx.fillRect(-10, 30, 8, 6);
  ctx.fillRect(2, 30, 8, 6);
  // Grill
  ctx.fillStyle = '#666';
  ctx.fillRect(-8, -34, 16, 5);
  // Wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-18, -22, 6, 16);
  ctx.fillRect(12, -22, 6, 16);
  ctx.fillRect(-18, 8, 6, 16);
  ctx.fillRect(12, 8, 6, 16);
  ctx.restore();
}

function drawObstacle(obs) {
  
  
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
    let overlap = obstacles.some(o => o.type === 'truck' && o.lane === lane && Math.abs(o.y - spawnY) < minGap);
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
      fast: isFast,
      // Trucks always stay in their assigned lane
      update: function(dt) {
        this.y += Math.abs(this.speed) * dt * (1 + distance/1000);
      }
    });
  }
  // No coins/powerups spawned

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
  // Speed lines (only white, never gray)
  if (!gameOver && distance > 600) {
    for (let i = 0; i < Math.min(12, Math.floor(distance/200)); i++) {
      let sx = player.x + (Math.random()-0.5)*40;
      let sy = player.y - 50 - Math.random()*120;
      let lineEndY = sy + 30 + Math.random()*20;
      // Only draw white speed lines above the car
      if (lineEndY < player.y - 36) {
        ctx.save();
        ctx.globalAlpha = 0.22 + Math.random()*0.13;
        ctx.strokeStyle = '#fff'; // Only white
        ctx.lineWidth = 2 + Math.random();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, lineEndY);
        ctx.stroke();
        ctx.restore();
      }
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
    score = Math.floor(distance / 10); // Simple, reliable score: 1 point per 10 meters


    roadScroll += dt * 320 * 0.5;
    if (leftPressed) player.x -= player.speed * dt * 60;
    if (rightPressed) player.x += player.speed * dt * 60;
    player.x = clampPlayerX(player.x); // always keep car within road

    player.x = Math.max(laneCenters[0], Math.min(laneCenters[2], player.x));
    obstacleTimer += dt * 1000;
    if (obstacleTimer >= obstacleInterval) {
      spawnObstacle();
      obstacleTimer = 0;
    }
  }
  for (let obs of obstacles) {
    if (obs.type === 'truck' && typeof obs.update === 'function') {
      obs.update(dt);
    } else if (obs.type !== 'truck') {
      obs.y += Math.abs(obs.speed) * dt * (1 + distance/1000);
    }
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
  // No coin or power-up logic

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
