// window.onerror = function(message, source, lineno, colno, error) {
//   if (typeof message === 'string' && message.includes('Access to storage is not allowed')) return true;
//   if (typeof message === 'string' && message.includes('Unknown response id')) return true;
//   return false; // Let other errors through
// };

let scene, camera, renderer;
let playerGroup, groundMesh;
let backgroundAudio; // Global variable for background audio
// Keep input state global for now
let leftPressed = false, rightPressed = false;
let textureLoader; // Declare textureLoader globally or pass it around
const roadScrollSpeed = 0.03; // MODIFIED - Increased from 0.02 --- This will become initialRoadScrollSpeed
let currentRoadScrollSpeed = roadScrollSpeed; // New variable for dynamic scroll speed
const maxRoadScrollSpeed = 0.08; // Maximum scroll speed for the road

let playerRickshawScaledBodyWidth; // Global variable for player's scaled width

let obstacles = [];
const initialObstacleSpeed = 0.45; // REVERTED - Was 0.70, before that 0.45
let currentObstacleSpeed = initialObstacleSpeed;
const maxObstacleSpeed = 1.5; // MODIFIED - Increased from 1.2

const initialObstacleSpawnInterval = 75; // MODIFIED - Was 30, to allow for ramp-up
let obstacleSpawnTimer = initialObstacleSpawnInterval / 60.0; // Uses the above const
let currentObstacleSpawnInterval = initialObstacleSpawnInterval;
const minObstacleSpawnInterval = 30; // Remains 30 (0.5s at 60FPS)

let globalSpawnCooldownTimer = 0; // New timer for global cooldown
const GLOBAL_SPAWN_COOLDOWN = 0.5; // MODIFIED - Decreased from 0.6s to 0.5s

const laneWidth = 10; // Ground width is 30, so 3 lanes of 10
const lanePositions = [-laneWidth, 0, laneWidth]; // X-coordinates for center of lanes

// Variables for targeted truck spawning
let playerCurrentLaneIndex = 1; // Initial lane (0, 1, or 2) -> Corresponds to lanePositions index
let previousPlayerLaneIndex = 1; // To detect lane changes
let timeInCurrentLane = 0;      // Seconds player has been in the current lane
const TIME_TO_TRIGGER_TARGETED_SPAWN = 5.0; // MODIFIED - Seconds - Increased from 4.0s
let targetedSpawnCooldownTimer = 0; // Cooldown for targeted spawns
const TARGETED_SPAWN_COOLDOWN_DURATION = 6.0; // MODIFIED - Seconds - Increased from 5.0s

// Performance: Max active obstacles
const MAX_ACTIVE_OBSTACLES = 4; // MODIFIED - Increased from 3

let gameOver = false; // Add game over state
let score = 0;
let scoreDisplay, finalScoreDisplay, gameOverScreen, restartBtn;
const cameraFollowSpeed = 0.05; // Smoothing factor for camera movement

// New texture variables
let carTexture, truckTexture;

// Array to hold loaded truck textures
let loadedTruckTextures = [];
const truckTextureFiles = [
    'textures/vehicle1_baseColor.png',
    'textures/vehicle2_baseColor.png',
    'textures/vehicle3_baseColor.png',
    'textures/vehicle4_baseColor.png',
    'textures/vehicle5_baseColor.png',
    'textures/vehicle6_baseColor.png'
];

// Obstacle (Truck) Colors
const truckBodyColor = 0x0033cc; // Dark Blue
const truckCabinColor = 0xaaaaaa; // Light Grey
const truckWheelColor = 0x222222; // Dark Grey

// Pre-define truck component geometries for reuse (optional optimization, but good practice)
const vehicleScaleFactor = 1.5; // General scale factor for vehicles

const truckBodyWidth = 2.2 * vehicleScaleFactor, 
      truckBodyHeight = 1.8 * vehicleScaleFactor, 
      truckBodyLength = 4.5 * vehicleScaleFactor;
const truckCabinWidth = truckBodyWidth * 0.8, // Relative to new body width
      truckCabinHeight = 1.2 * vehicleScaleFactor, 
      truckCabinLength = truckBodyLength * 0.3; // Relative to new body length
const truckWheelRadius = 0.5 * vehicleScaleFactor, 
      truckWheelThickness = 0.3 * vehicleScaleFactor;
const truckWheelSegments = 12; // For cylindrical wheels

const truckBodyGeometry = new THREE.BoxGeometry(truckBodyWidth, truckBodyHeight, truckBodyLength);
const truckCabinGeometry = new THREE.BoxGeometry(truckCabinWidth, truckCabinHeight, truckCabinLength);
const truckWheelGeometry = new THREE.CylinderGeometry(truckWheelRadius, truckWheelRadius, truckWheelThickness, truckWheelSegments);

// Materials for truck lights
const truckHeadlightMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFE0, emissive: 0x888800 });
const truckTaillightMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000, emissive: 0x880000 });

// let sceneryObjects = []; // REMOVED
// const scenerySpawnInterval = 90; // REMOVED
// let scenerySpawnTimer = scenerySpawnInterval / 60.0; // REMOVED
// const scenerySpeedFactor = 0.95; // REMOVED

// Scenery Colors & Types // REMOVED
// const poleColor = 0x888888; // REMOVED
// const bushColor = 0x228B22; // REMOVED
// const buildingColor = 0x778899; // REMOVED
// const treeTrunkColor = 0x8B4513; // REMOVED
// const poleLightMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFE0, emissive: 0x777700 }); // REMOVED

let clock = new THREE.Clock(); // Add clock for delta time in animation
let isPlayerModelLoaded = false; // Flag to indicate if the GLTF model has loaded
const desiredRickshawHeight = 4.5; // MODIFIED - Increased from 4.0 for a larger rickshaw
const roadWidth = 30; // Assuming this is defined somewhere, needed for lane boundaries
const TARGET_ASPECT_RATIO = 9 / 16; // Define the desired fixed aspect ratio

window.onload = function() {
  // Initialize Three.js Environment First
  initThreeJS();

  // Initialize TextureLoader here as THREE is now defined
  textureLoader = new THREE.TextureLoader();

  // Load truck textures
  loadTruckTextures();

  // Load the road texture after initThreeJS so groundMesh exists
  loadRoadTexture();

  // Cache UI elements
  scoreDisplay = document.getElementById('score');
  finalScoreDisplay = document.getElementById('finalScore');
  gameOverScreen = document.getElementById('gameOverScreen');
  restartBtn = document.getElementById('restartBtn');

  // Event listeners for input (abbreviated for clarity, no changes here)
  window.addEventListener('keydown', e => {
      if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = true;
      if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = true;
      if (gameOver && (e.key === ' ' || e.key === 'Enter')) restartGame(); // Allow restart with Space/Enter
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

  // Restart button listener
  if(restartBtn) restartBtn.onclick = restartGame;
  
  // Initial UI update
  updateScoreDisplay();

  // --- Texture loading (2D - largely commented out) ---
  // const textures = {
  //   grass: new Image(),
  //   dirt: new Image(),
  //   stone: new Image(), // This one is now loaded via THREE.TextureLoader
  //   car: new Image(),
  //   truck: new Image()
  // };
  // textures.grass.src = 'textures/grass.png';
  // textures.dirt.src = 'textures/dirt.png';
  // // textures.stone.src = 'textures/stone.png'; // Handled by loadRoadTexture
  // textures.car.src = 'sprites/car.png';
  // textures.truck.src = 'sprites/truck.png';

  // --- Game Constants (2D) ---
  // const canvas = document.getElementById('gameCanvas');
  // const ctx = canvas.getContext('2d');
  // const w = canvas.width, h = canvas.height;
  // let roadScroll = 0;

  // --- Particle System (2D) ---
  // let particles = [];
  // function spawnParticle(x, y, color, vx, vy, life, size=3) {
  //   particles.push({x, y, color, vx, vy, life, size});
  // }
  // function updateParticles(dt) {
  //   for (let p of particles) {
  //     p.x += p.vx * dt * 60;
  //     p.y += p.vy * dt * 60;
  //     p.life -= dt;
  //   }
  //   particles = particles.filter(p => p.life > 0);
  // }
  // function drawParticles() {
  //   for (let p of particles) {
  //     ctx.save();
  //     ctx.globalAlpha = Math.max(0, p.life/0.6);
  //     ctx.fillStyle = p.color;
  //     ctx.beginPath();
  //     ctx.arc(p.x, p.y, p.size, 0, 2*Math.PI);
  //     ctx.fill();
  //     ctx.restore();
  //   }
  // }

  // --- Fade-in overlay (2D) ---
  // let fadeAlpha = 1, fadeDir = -1;
  // function drawFade() {
  //   if (fadeAlpha > 0) {
  //     ctx.save();
  //     ctx.globalAlpha = fadeAlpha;
  //     ctx.fillStyle = '#000';
  //     ctx.fillRect(0, 0, w, h);
  //     ctx.restore();
  //   }
  // }

  // --- Starfield (2D) ---
  // function drawStarfield() {
  //   ctx.fillStyle = '#000';
  //   ctx.fillRect(0, 0, w, h);
  //   // Starfield: static, no sparkle or twinkle
  //   for (let i = 0; i < 24; i++) {
  //     ctx.fillStyle = '#fff';
  //     ctx.fillRect(Math.floor((i*53)%w), Math.floor((i*191)%h), 2, 2);
  //   }
  // }

  // --- Headlight effect (2D) ---
  // function drawHeadlights() {
  //   // Headlight cone effect (no vertical lines, just a gradient cone)
  //   ctx.save();
  //   ctx.globalAlpha = 0.45;
  //   ctx.beginPath();
  //   ctx.moveTo(player.x, player.y-30);
  //   ctx.arc(player.x, player.y-120, 120, Math.PI*0.88, Math.PI*0.12, false);
  //   ctx.lineTo(player.x, player.y-30);
  //   ctx.closePath();
  //   var gradient = ctx.createRadialGradient(player.x, player.y-30, 10, player.x, player.y-120, 120);
  //   gradient.addColorStop(0, 'rgba(255,255,200,0.6)');
  //   gradient.addColorStop(1, 'rgba(255,255,200,0.0)');
  //   ctx.fillStyle = gradient;
  //   ctx.fill();
  //   ctx.restore();
  // } // No vertical lines, only cone gradient

  // --- Near-miss shake (2D) ---
  // Removed shake and near-miss sparkle effect: no vibration, no particles, no visual feedback for near-miss.

  // --- Game State (2D elements largely commented out or to be adapted) ---
  // const NUM_LANES = 3; // This might still be useful for 3D lane logic
  // const roadLeft = Math.round(w * 0.10);
  // const roadRight = Math.round(w * 0.90);
  // const laneWidth = Math.round((roadRight - roadLeft) / 3);
  // const laneCenters = [
  //   Math.round(roadLeft + laneWidth/2),
  //   Math.round(roadLeft + laneWidth/2 + laneWidth),
  //   Math.round(roadLeft + laneWidth/2 + 2*laneWidth)
  // ];
  // let player = { x: laneCenters[1], y: Math.round(h * 0.65), width: 44, height: 74, speed: 22, color: '#0ff' }; // Centered player, increased speed
  // let obstacles = [], obstacleTimer = 0, obstacleInterval = 120, minInterval = 38; // Increased difficulty: obstacles appear more frequently
  // let distance = 0, score = 0, scoreMultiplier = 1;
  // let speedMultiplier = 1;
  // let gameOver = false;
  // let paused = false; // Pause state

  // --- Input State (Listeners are kept for 3D control) ---
  // window.addEventListener('keydown', e => {
  //   if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = true;
  //   if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = true;
  //   // if (e.key === 'p' || e.key === 'P') paused = !paused; // Pause logic to be re-implemented for 3D
  //   // if (gameOver && (e.key === ' ' || e.key === 'Enter')) restartGame(); // Restart logic to be re-implemented
  // });
  // window.addEventListener('keyup', e => {
  //   if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = false;
  //   if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = false;
  // });
  // document.getElementById('leftBtn').addEventListener('touchstart', e => { leftPressed = true; e.preventDefault(); });
  // document.getElementById('leftBtn').addEventListener('touchend', e => { leftPressed = false; e.preventDefault(); });
  // document.getElementById('leftBtn').addEventListener('mousedown', e => { leftPressed = true; });
  // document.getElementById('leftBtn').addEventListener('mouseup', e => { leftPressed = false; });
  // document.getElementById('leftBtn').addEventListener('mouseleave', e => { leftPressed = false; });
  // document.getElementById('rightBtn').addEventListener('touchstart', e => { rightPressed = true; e.preventDefault(); });
  // document.getElementById('rightBtn').addEventListener('touchend', e => { rightPressed = false; e.preventDefault(); });
  // document.getElementById('rightBtn').addEventListener('mousedown', e => { rightPressed = true; });
  // document.getElementById('rightBtn').addEventListener('mouseup', e => { rightPressed = false; });
  // document.getElementById('rightBtn').addEventListener('mouseleave', e => { rightPressed = false; });

  // --- Player movement bounds (2D) ---
  // function clampPlayerX(x) {
  //   // Player can move fully within the road, not just lanes
  //   const minX = roadLeft + player.width/2;
  //   const maxX = roadRight - player.width/2;
  //   return Math.max(minX, Math.min(maxX, x));
  // }

  // --- Restart Game (2D) ---
  // function restartGame() {
  //   player.x = laneCenters[1]; // center lane
  //   player.y = Math.round(h * 0.65); // more vertically centered
  //   distance = 0;
  //   score = 0;
  //   obstacles = [];
  //   particles = []; // Clear particles to prevent stray dots
  //   gameOver = false;
  //   obstacleInterval = 180;
  //   obstacleTimer = obstacleInterval;
  //   leftPressed = rightPressed = false;
  //   // Removed shake reset (feature removed)

  //   document.getElementById('gameOverScreen').style.display = 'none';
  //   document.getElementById('finalScore').textContent = '0';
  //   var scoreElem = document.getElementById('score');
  //   if (scoreElem) scoreElem.textContent = '0 m';
  //   gameStartTime = Date.now(); // reset spawn timer
  //   lastTime = performance.now();
  //   requestAnimationFrame(loop);
  // }
  // document.getElementById('restartBtn').onclick = restartGame;

  // --- Drawing Functions (2D) ---
  // function drawRoad() {
  //   ctx.save();
  //   // Widen the road for better visibility
  //   ctx.fillStyle = '#888'; // Road grey
  //   const roadLeft = Math.round(w * 0.10);
  //   const roadRight = Math.round(w * 0.90);
  //   ctx.fillRect(roadLeft, 0, roadRight - roadLeft, h);
  //   // Lane markings (animated)
  //   ctx.fillStyle = '#fff';
  //   let laneWidth = Math.round((roadRight - roadLeft) / 3);
  //   for (let i = 1; i < 3; i++) {
  //     let x = Math.round(roadLeft + i * laneWidth);
  //     for (let y = (roadScroll % 32) - 32; y < h; y += 32) ctx.fillRect(x - 2, y, 4, 20);
  //   }
  //   // Road edge lines
  //   ctx.fillStyle = '#222';
  //   ctx.fillRect(roadLeft - 4, 0, 4, h);
  //   ctx.fillRect(roadRight, 0, 4, h);
  //   // Roadside scenery
  //   for (let i = 0; i < 4; i++) {
  //     let y = (roadScroll * 0.7 + i * 160) % h;
  //     // Left side
  //     drawScenery(roadLeft-24, y);
  //     // Right side
  //     drawScenery(roadRight+8, (y+80)%h);
  //   }
  //   ctx.restore();
  // }

  // function drawScenery(x, y) {
  //   // Randomly pick a type based on y
  //   let type = Math.floor(y/80)%3; // Cycle through 3 scenery types
  //   if (type === 0) { // tree
  //     ctx.fillStyle = '#165a1f';
  //     ctx.fillRect(x-8, y-24, 16, 24); // Trunk
  //     ctx.beginPath();
  //     ctx.arc(x, y-32, 16, Math.PI, 0);
  //     ctx.fill();
  //   } else if (type === 1) { // rock
  //     ctx.fillStyle = '#6b6b6b';
  //     ctx.beginPath();
  //     ctx.moveTo(x-12,y); ctx.lineTo(x+12,y); ctx.lineTo(x+8,y-16); ctx.lineTo(x-8,y-16);
  //     ctx.closePath();
  //     ctx.fill();
  //   } else { // bush
  //     ctx.fillStyle = '#2a8c3d';
  //     ctx.beginPath();
  //     ctx.arc(x, y-8, 12, 0, 2*Math.PI);
  //     ctx.fill();
  //     ctx.beginPath();
  //     ctx.arc(x-8, y-4, 8, 0, 2*Math.PI);
  //     ctx.fill();
  //     ctx.beginPath();
  //     ctx.arc(x+8, y-4, 8, 0, 2*Math.PI);
  //     ctx.fill();
  //   }
  // }

  // function drawPlayer() {
  //   ctx.save();
  //   ctx.translate(player.x, player.y);
  //   // Use sprite if loaded
  //   if (textures.car.complete && textures.car.naturalWidth !== 0) {
  //       const carWidth = 44; // desired display width
  //       const carHeight = 74; // desired display height
  //       ctx.drawImage(textures.car, -carWidth/2, -carHeight/2, carWidth, carHeight);
  //   } else { // Fallback to simple rect if sprite fails
  //       ctx.fillStyle = player.color;
  //       ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
  //   }
  //   ctx.restore();
  // }

  // function drawObstacle(obs) {
  //   ctx.save();
  //   ctx.translate(obs.x, obs.y);
  //   if (obs.type === 'truck' && textures.truck.complete && textures.truck.naturalWidth !== 0) {
  //       const truckWidth = 48; // desired display width
  //       const truckHeight = 92; // desired display height
  //       ctx.drawImage(textures.truck, -truckWidth/2, -truckHeight/2, truckWidth, truckHeight);
  //   } else { // Fallback
  //       ctx.fillStyle = obs.color || '#f00';
  //       ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
  //   }
  //   ctx.restore();
  // }

  // --- Spawning Logic (2D) ---
  // function spawnObstacle() {
  //   const lanes = [0, 1, 2];
  //   const laneToSpawnIn = lanes[Math.floor(Math.random() * lanes.length)];
  //   const newObstacle = {
  //     x: laneCenters[laneToSpawnIn],
  //     y: -50, // Start off-screen
  //     width: 48, // Truck dimensions
  //     height: 92,
  //     speed: 4 + Math.random() * 2, // Random speed
  //     color: '#c00',
  //     type: 'truck' // For sprite rendering
  //   };
  //   obstacles.push(newObstacle);
  // }

  // --- Update Logic (2D) ---
  // function update(dt) {
  //   if (paused || gameOver) return; // Skip updates if paused or game over

  //   // Update player position
  //   if (leftPressed) player.x -= player.speed * dt * 60;
  //   if (rightPressed) player.x += player.speed * dt * 60;
  //   player.x = clampPlayerX(player.x);

  //   // Road scroll
  //   roadScroll += 180 * dt * speedMultiplier; // Base scroll speed of 180 pixels/sec

  //   // Update obstacles
  //   for (let i = obstacles.length - 1; i >= 0; i--) {
  //     let obs = obstacles[i];
  //     obs.y += obs.speed * dt * 60 * speedMultiplier;
  //     if (obs.y > h + obs.height) { // Despawn off-screen
  //       obstacles.splice(i, 1);
  //     }
  //   }

  //   // Spawn new obstacles
  //   obstacleTimer -= dt * 60;
  //   if (obstacleTimer <= 0) {
  //     spawnObstacle();
  //     obstacleTimer = obstacleInterval / speedMultiplier; // Timer affected by speed
  //     obstacleInterval = Math.max(minInterval, obstacleInterval * 0.985); // Gradually decrease interval
  //   }

  //   // Collision detection
  //   for (let obs of obstacles) {
  //     if (Math.abs(player.x - obs.x) < (player.width + obs.width) / 2 - 10 && // -10 for tighter hitbox
  //         Math.abs(player.y - obs.y) < (player.height + obs.height) / 2 - 10) {
  //       gameOver = true;
  //       document.getElementById('gameOverScreen').style.display = 'flex';
  //       document.getElementById('finalScore').textContent = score;
  //       // Removed shake on collision
  //       break;
  //     }
  //   }

  //   // Update score and speed
  //   if (!gameOver) {
  //     distance += 1 * speedMultiplier; // Distance increases with speed
  //     score = Math.floor(distance);
  //     speedMultiplier = 1 + score / 2000; // Speed increases every 2000 points
  //     speedMultiplier = 1 + Math.floor(score/1000); // Score multiplier increases every 1000 points
  //   }
  //   updateParticles(dt);
  // }

  // --- Main Loop (2D) ---
  // let lastTime = performance.now();
  // let gameStartTime = Date.now();
  // function loop(currentTime) {
  //   if (!document.hidden) { // Basic check to not run when tab is inactive
  //       const dt = Math.min(0.1, (currentTime - lastTime) / 1000); // Delta time in seconds, capped to prevent spiral
  //       lastTime = currentTime;

  //       if (!paused) {
  //           update(dt);
  //           // draw(dt); // draw function is in draw.js, which is currently commented out
  //           // Temporary clear for now as we transition
  //           // ctx.clearRect(0,0,w,h);
  //           // drawStarfield();
  //           // drawRoad();
  //           // drawPlayer();
  //           // obstacles.forEach(drawObstacle);
  //           // drawParticles();
  //       }

  //       // Draw score and fade separately (they appear over pause)
  //       // drawScore();
  //       // drawFade();
  //       // if (fadeDir === -1 && fadeAlpha > 0) fadeAlpha = Math.max(0, fadeAlpha - dt*2);
  //       // if (fadeDir === 1 && fadeAlpha < 1) fadeAlpha = Math.min(1, fadeAlpha + dt*2);

  //       if (gameOver) {
  //           // Display game over screen handled by HTML/CSS and collision logic
  //       }
  //   }
  //   requestAnimationFrame(loop);
  // }

  // --- Init Function (Original 2D - now replaced by initThreeJS and its animate loop) ---
  // function init() {
  //   // document.getElementById('bestScore').textContent = localStorage.getItem('rickshaw_best_score') || 0;
  //   restartGame(); // Start the game
  // }
  // init();

  // Handle window resize
  function handleResize() {
    const gameContainer = document.getElementById('gameContainer');
    if (!gameContainer) {
        console.warn("DEBUG: gameContainer not found during resize.");
        // Fallback to window if gameContainer is somehow not available
        const fallbackWidth = window.innerWidth;
        const fallbackHeight = window.innerHeight;
        renderer.setSize(fallbackWidth, fallbackHeight);
        camera.aspect = fallbackWidth / fallbackHeight;
        camera.updateProjectionMatrix();
        return;
    }

    const containerWidth = gameContainer.clientWidth;
    const containerHeight = gameContainer.clientHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    let newCanvasWidth;
    let newCanvasHeight;

    if (containerAspectRatio > TARGET_ASPECT_RATIO) {
        // Container is wider than target (pillarbox)
        newCanvasHeight = containerHeight;
        newCanvasWidth = newCanvasHeight * TARGET_ASPECT_RATIO;
    } else {
        // Container is taller than or equal aspect to target (letterbox or perfect fit)
        newCanvasWidth = containerWidth;
        newCanvasHeight = newCanvasWidth / TARGET_ASPECT_RATIO;
    }

    renderer.setSize(newCanvasWidth, newCanvasHeight);
    camera.aspect = TARGET_ASPECT_RATIO; // Use the fixed target aspect ratio for the camera
    camera.updateProjectionMatrix();
    console.log(`DEBUG: Resized. Container: ${containerWidth}x${containerHeight}, Canvas: ${newCanvasWidth.toFixed(0)}x${newCanvasHeight.toFixed(0)}, Target Aspect: ${TARGET_ASPECT_RATIO.toFixed(2)}`);
  }

  window.addEventListener('resize', handleResize, false);
  handleResize(); // Call once initially to set correct size
};

function loadTruckTextures() {
    if (!textureLoader) {
        console.warn("TextureLoader not initialized for loadTruckTextures. Textures will not be loaded.");
        return;
    }
    if (!renderer) {
        console.warn("Renderer not initialized for loadTruckTextures. Cannot set anisotropy.");
        // return; // Or proceed without anisotropy
    }
    console.log("DEBUG: Loading truck textures...");
    truckTextureFiles.forEach(filePath => {
    textureLoader.load(
            filePath,
        function(texture) { // onLoad callback
                texture.name = filePath.split('/').pop(); // Store filename for debugging
                texture.encoding = THREE.sRGBEncoding; // Color space
                texture.generateMipmaps = true;       // Ensure mipmaps are generated
                texture.minFilter = THREE.LinearMipmapLinearFilter; // Quality filtering
                texture.magFilter = THREE.LinearFilter;
                if (renderer) { // Set anisotropy if renderer is available
                  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                }
                texture.needsUpdate = true; // Important after changing properties
                loadedTruckTextures.push(texture);
                console.log(`DEBUG: Loaded truck texture: ${texture.name}`);
                if (loadedTruckTextures.length === truckTextureFiles.length) {
                    console.log("DEBUG: All truck textures loaded successfully.");
                }
            },
            undefined, // onProgress callback (optional)
            function(err) { // onError callback
                console.error(`An error occurred loading truck texture ${filePath}:`, err);
            }
        );
    });
}

function loadRoadTexture() {
    if (!textureLoader || !groundMesh || !renderer) {
        console.warn("TextureLoader, groundMesh, or renderer not initialized for loadRoadTexture");
        return;
    }

    const texturePath = 'textures/';
    const baseColorFile = 'ThreeLaneRoadWet01_4K_BaseColor.png';
    const normalFile = 'ThreeLaneRoadWet01_4K_Normal.png';
    const roughnessFile = 'ThreeLaneRoadWet01_4K_Roughness.png';
    const aoFile = 'ThreeLaneRoadWet01_4K_AO.png';

    const repeatU = 1;
    const repeatV = 10; // MODIFIED - Increased from 2 to reduce stretching along road length
    const rotationRadians = Math.PI / 2;
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // Function to apply common settings
    function setupTexture(texture, isColorMap = false) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatU, repeatV);
        texture.rotation = rotationRadians;
        texture.center.set(0.5, 0.5);
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter; // High quality minification
        texture.magFilter = THREE.LinearFilter;          // High quality magnification
        texture.anisotropy = maxAnisotropy;
        if (isColorMap) {
            texture.encoding = THREE.sRGBEncoding;
        } else {
            texture.encoding = THREE.LinearEncoding; // Default for data maps
        }
        texture.needsUpdate = true; // Important for mipmaps & anisotropy
    }

    // Base Color Map
    textureLoader.load(
        texturePath + baseColorFile,
        function(texture) {
            setupTexture(texture, true);
            groundMesh.material.map = texture;
            groundMesh.material.needsUpdate = true;
            console.log("Road BaseColor texture loaded, rotated, and applied with quality settings.");
        },
        undefined,
        function(err) { console.error('Error loading BaseColor texture:', err); }
    );

    // Normal Map
    textureLoader.load(
        texturePath + normalFile,
        function(texture) {
            setupTexture(texture);
            groundMesh.material.normalMap = texture;
            groundMesh.material.needsUpdate = true;
            console.log("Road NormalMap texture loaded, rotated, and applied with quality settings.");
        },
        undefined,
        function(err) { console.error('Error loading NormalMap texture:', err); }
    );

    // Roughness Map
    textureLoader.load(
        texturePath + roughnessFile,
        function(texture) {
            setupTexture(texture);
            groundMesh.material.roughnessMap = texture;
            groundMesh.material.needsUpdate = true;
            console.log("Road RoughnessMap texture loaded, rotated, and applied with quality settings.");
        },
        undefined,
        function(err) { console.error('Error loading RoughnessMap texture:', err); }
    );

    // Ambient Occlusion (AO) Map
    textureLoader.load(
        texturePath + aoFile,
        function(texture) {
            setupTexture(texture);
            groundMesh.material.aoMap = texture;
            groundMesh.material.aoMapIntensity = 1; 
            groundMesh.material.needsUpdate = true;
            console.log("Road AOMap texture loaded, rotated, and applied with quality settings.");
        },
        undefined,
        function(err) { console.error('Error loading AOMap texture:', err); }
    );

    groundMesh.material.metalness = 0.1; 
    groundMesh.material.roughness = 1.0; 
    // groundMesh.material.needsUpdate = true; // Material will be updated by texture loads

    console.log("Attempting to load, rotate, and apply all PBR road textures with quality enhancements.");
}

function loadVehicleTextures() {
    // Commenting out as we are using basic colored geometry for now
    // if (!textureLoader) { ... }
    // carTexture = textureLoader.load('sprites/car.png', ...);
    // truckTexture = textureLoader.load('sprites/truck.png', ...);
}

function updatePlayerMaterial() {
    // Commenting out as we are not applying carTexture for this approach
    // if (playerGroup && carTexture) { ... }
}

function initThreeJS() {
  console.log("DEBUG: initThreeJS called");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100028); // MODIFIED - Darker, slightly more vibrant blue/purple
  scene.fog = new THREE.FogExp2(0x100028, 0.0075); // MODIFIED - Added exponential fog

  // Starfield
  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, sizeAttenuation: true });
  const starVertices = [];
  for (let i = 0; i < 1000; i++) { // 1000 stars
    const x = THREE.MathUtils.randFloatSpread(200); // Spread them out
    const y = THREE.MathUtils.randFloatSpread(200);
    const z = THREE.MathUtils.randFloat(-50, -200); // Position them in the distance
    starVertices.push(x, y, z);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
  console.log("DEBUG: Starfield created.");

  // More advanced lighting
  // const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Softer ambient light
  // scene.add(ambientLight); // Replaced by HemisphereLight

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x303050, 1.6); // MODIFIED - Sky White, Ground lighter, Intensity 1.6
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2); // MODIFIED - Intensity 2.2
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true; // Enable shadows for this light
  directionalLight.shadow.mapSize.width = 512; // MODIFIED - Was 1024 (Performance)
  directionalLight.shadow.mapSize.height = 512; // MODIFIED - Was 1024 (Performance)
  directionalLight.shadow.camera.near = 0.5;    // default
  directionalLight.shadow.camera.far = 50;     // default
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);


  // Camera
  const gameContainer = document.getElementById('gameContainer');
  camera = new THREE.PerspectiveCamera(75, gameContainer.clientWidth / gameContainer.clientHeight, 0.1, 1000);
  // camera.position.set(0, 5, 10); // Initial fixed camera for debugging
  // camera.lookAt(0, 0, 0);       // Look at scene origin for debugging
  console.log(`DEBUG: Initial Camera Position: ${camera.position.x} ${camera.position.y} ${camera.position.z}`);
  console.log(`DEBUG: Camera is looking at (0,0,0)`);

  // Renderer - USE EXISTING CANVAS
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight); // Size based on container
  renderer.shadowMap.enabled = true; // Enable shadow mapping in the renderer
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: for softer shadows
  // document.getElementById('gameContainer').appendChild(renderer.domElement); // REMOVED - Using existing canvas

  // Ground
  const groundGeometry = new THREE.PlaneGeometry(roadWidth, 400); // Ground width from variable, increased length
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x404040, // Darker grey for asphalt
    side: THREE.DoubleSide,
    map: null // Will be set by loadRoadTexture
  });
  groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0; // MODIFIED - Road surface is now at Y=0
  groundMesh.receiveShadow = true; // Ground should receive shadows
  // Add uv2 attribute for AO map
  groundMesh.geometry.setAttribute('uv2', new THREE.BufferAttribute(groundMesh.geometry.attributes.uv.array, 2));
  scene.add(groundMesh);
  console.log("DEBUG: Ground mesh created and added to scene with uv2 attribute.");

  // Player Group (acts as the pivot/center for the player model)
  playerGroup = new THREE.Group();
  playerGroup.position.set(lanePositions[1], 0, 3); // Start in the middle lane, slightly forward
  scene.add(playerGroup);
  console.log(`DEBUG: Player group created at ${playerGroup.position.x}, ${playerGroup.position.y}, ${playerGroup.position.z}`);


  // Test Cube (Commented Out - No longer needed for model visibility debugging)
  // const testGeometry = new THREE.BoxGeometry(1, 1, 1);
  // const testMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  // testCube = new THREE.Mesh(testGeometry, testMaterial);
  // testCube.position.set(0, 0.5, 0); // Position it at the scene origin for reference
  // testCube.castShadow = true;
  // scene.add(testCube);
  // console.log("DEBUG: Test Cube added at scene origin, position:", testCube.position);


  // Load the GLTF model
  loadGLTFModel();
  console.log("DEBUG: loadGLTFModel called from initThreeJS");


  // Initial call to animate
  animate();
  console.log("DEBUG: Initial animate call from initThreeJS");

  // Initialize and play background audio
  try {
    backgroundAudio = new Audio('1c5484fd4960597.mp3');
    backgroundAudio.loop = true;
    console.log("DEBUG: Background audio initialized.");

    const playPromise = backgroundAudio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log("Background audio autoplay started successfully.");
        }).catch(error => {
            console.warn("Background audio autoplay failed. Setting up listener for first user interaction.", error);
            const onFirstInteraction = () => {
                backgroundAudio.play().then(() => {
                    console.log("Background audio started successfully on user interaction.");
                }).catch(e => console.warn("Background audio play on interaction failed:", e));
                window.removeEventListener('mousedown', onFirstInteraction, true);
                window.removeEventListener('keydown', onFirstInteraction, true);
                window.removeEventListener('touchstart', onFirstInteraction, true);
            };
            window.addEventListener('mousedown', onFirstInteraction, true);
            window.addEventListener('keydown', onFirstInteraction, true);
            window.addEventListener('touchstart', onFirstInteraction, true);
        });
    }
  } catch (e) {
    console.error("Error initializing background audio:", e);
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    const gameContainer = document.getElementById('gameContainer'); // Re-fetch container on resize
    if (gameContainer) { // Check if container exists
        camera.aspect = gameContainer.clientWidth / gameContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
        console.log("DEBUG: Window resized, camera and renderer updated based on gameContainer.");
    } else {
        // Fallback or default behavior if gameContainer is not found
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
        console.warn("DEBUG: Window resized, but gameContainer not found. Using window dimensions.");
    }
  }, false);
}

function loadGLTFModel() {
    const loader = new THREE.GLTFLoader(); // NO LoadingManager here
    loader.setPath('models/rickshaw/');
    loader.load('scene.gltf', function (gltf) {
        console.log('Raw GLTF data loaded:', gltf);
        const model = gltf.scene;
        console.log('GLTF Scene object (before transforms):', model);

        model.updateMatrixWorld(true); 

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        console.log('Initial model size (before scaling):', size.x, size.y, size.z);

        let scaleFactor;
        if (size.y === 0 || Math.abs(size.y) < 0.0001) {
            console.warn('Model initial height is zero or near-zero. Defaulting scaleFactor to 1.');
            scaleFactor = 1;
        } else {
            scaleFactor = desiredRickshawHeight / size.y;
        }
        console.log('Calculated scale factor:', scaleFactor);
        
        if (isNaN(scaleFactor) || !isFinite(scaleFactor)) {
            console.warn('Scale factor is NaN or infinite. Defaulting to 1.');
            scaleFactor = 1;
        }

        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        model.updateMatrixWorld(true); 

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        console.log('Scaled model size (used for positioning and width):', scaledSize.x, scaledSize.y, scaledSize.z);

        playerRickshawScaledBodyWidth = scaledSize.x;
        if (isNaN(playerRickshawScaledBodyWidth) || playerRickshawScaledBodyWidth <= 0) {
            console.warn("playerRickshawScaledBodyWidth is NaN or zero/negative after scaling. Defaulting to 1.8.");
            playerRickshawScaledBodyWidth = 1.8; 
        }
        console.log('Rickshaw model scaled. Collision width set to:', playerRickshawScaledBodyWidth);

        const center = scaledBox.getCenter(new THREE.Vector3());
        console.log('Scaled model center (before offsetting):', center.x, center.y, center.z);

        if (isNaN(center.x) || isNaN(center.y) || isNaN(center.z)) {
            console.warn("Model center coordinates are NaN. Defaulting center offset to (0,0,0).");
            center.set(0,0,0);
        }

        model.position.sub(center); 
        model.position.y += scaledSize.y / 2; 
        
        model.updateMatrixWorld(true);

        console.log('Final model local position (relative to playerGroup, after centering and Y adjustment):', model.position.x, model.position.y, model.position.z);
        
        if (!playerGroup) {
            console.error("playerGroup is not initialized before loading model! This should not happen.");
            playerGroup = new THREE.Group(); 
        }
        
        while(playerGroup.children.length > 0){
            playerGroup.remove(playerGroup.children[0]);
        }
        playerGroup.add(model);
        
        playerGroup.position.set(0, 0, 3); 
        scene.add(playerGroup); 
        playerGroup.updateMatrixWorld(true); // Ensure matrix is up-to-date

        // Initialize player's AABB here after model is added and group is positioned
        playerGroup.userData.aabb = new THREE.Box3();
        // Initial calculation (will be updated in animate)
        // playerGroup.userData.aabb.setFromObject(playerGroup); 
        // console.log("DEBUG LoadCB: Initial Player AABB computed:", playerGroup.userData.aabb.min, playerGroup.userData.aabb.max);

        
        // Ensure playerGroup's matrix is updated before logging its position
        playerGroup.updateMatrixWorld(true); 
        console.log('DEBUG LoadCB: playerGroup.position after model add & transform:', playerGroup.position.x.toFixed(2), playerGroup.position.y.toFixed(2), playerGroup.position.z.toFixed(2));
        
        const playerGroupWorldPos = new THREE.Vector3();
        playerGroup.getWorldPosition(playerGroupWorldPos); 
        console.log('DEBUG LoadCB: playerGroup.getWorldPosition():', playerGroupWorldPos.x.toFixed(2), playerGroupWorldPos.y.toFixed(2), playerGroupWorldPos.z.toFixed(2));
        
        // Ensure model's world matrix is updated after being added to group and group is positioned
        model.updateMatrixWorld(true); 
        const finalModelWorldPos = new THREE.Vector3();
        model.getWorldPosition(finalModelWorldPos);
        console.log('DEBUG LoadCB: Loaded Model - World Position (after adding to group):', finalModelWorldPos.x.toFixed(2), finalModelWorldPos.y.toFixed(2), finalModelWorldPos.z.toFixed(2));

        console.log('DEBUG LoadCB: Traversing loaded model children:');
        model.traverse(function (child) {
            let logMsg = `  - Name: ${child.name || 'N/A'}, Type: ${child.type}, Visible: ${child.visible}`;
            if (child.isMesh) {
                logMsg += `, Material: ${child.material ? child.material.type : 'N/A'}`;
                if (child.material && child.material.map) {
                    logMsg += `, Texture: ${child.material.map.name || 'Exists'}`;
                    // Apply texture settings to player model's texture(s)
                    const texture = child.material.map;
                    texture.encoding = THREE.sRGBEncoding;
                    texture.generateMipmaps = true;
                    texture.minFilter = THREE.LinearMipmapLinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    if (renderer) { // Check if renderer is available
                        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                    }
                    texture.needsUpdate = true;
                    child.material.needsUpdate = true; // Also flag material for update

                    // Ensure material is not transparent unless intended by GLTF
                    if (child.material.transparent && child.material.opacity < 1) {
                        console.log(`DEBUG Player GLTF: Material ${child.material.name || 'Unnamed'} on mesh ${child.name} is transparent.`);
                    } else {
                        child.material.transparent = false; // Explicitly set if not already transparent by design
                    }
                    child.material.side = THREE.FrontSide; // Default, but enforce for solidity
                    child.material.depthWrite = true; // Ensure it writes to depth buffer

                } else {
                    logMsg += `, Texture: None`;
                }
            }
            console.log(logMsg);
        });
         console.log("Player model loaded and added to scene. isPlayerModelLoaded = true");
         isPlayerModelLoaded = true;

    }, undefined, function (error) {
        console.error('An error happened during GLTF loading:', error);
        isPlayerModelLoaded = false; 
    });
}

function animate() {
  requestAnimationFrame(animate);
    const deltaTime = clock.getDelta(); // Use deltaTime consistently

    if (gameOver) return;

  // Update road texture offset for scrolling effect
    if (groundMesh && groundMesh.material && groundMesh.material.map) {
    if (!groundMesh.material.map.offset) groundMesh.material.map.offset = new THREE.Vector2();
        // Ensure other maps scroll too if they exist and need to
        groundMesh.material.map.offset.x = (groundMesh.material.map.offset.x + currentRoadScrollSpeed * deltaTime) % 1;
        if (groundMesh.material.normalMap) {
            if (!groundMesh.material.normalMap.offset) groundMesh.material.normalMap.offset = new THREE.Vector2();
            groundMesh.material.normalMap.offset.x = (groundMesh.material.normalMap.offset.x + currentRoadScrollSpeed * deltaTime) % 1;
        }
        if (groundMesh.material.roughnessMap) {
            if (!groundMesh.material.roughnessMap.offset) groundMesh.material.roughnessMap.offset = new THREE.Vector2();
            groundMesh.material.roughnessMap.offset.x = (groundMesh.material.roughnessMap.offset.x + currentRoadScrollSpeed * deltaTime) % 1;
        }
        if (groundMesh.material.aoMap) {
            if (!groundMesh.material.aoMap.offset) groundMesh.material.aoMap.offset = new THREE.Vector2();
            groundMesh.material.aoMap.offset.x = (groundMesh.material.aoMap.offset.x + currentRoadScrollSpeed * deltaTime) % 1;
        }
    }

    // Update global spawn cooldown timer
    if (globalSpawnCooldownTimer > 0) {
        globalSpawnCooldownTimer -= deltaTime;
    }
    
    // Update targeted spawn cooldown timer
    if (targetedSpawnCooldownTimer > 0) {
        targetedSpawnCooldownTimer -= deltaTime;
  }

  // Player movement
    if (isPlayerModelLoaded && playerRickshawScaledBodyWidth > 0) { 
        const playerSpeed = 0.2; 
    if (leftPressed) {
            playerGroup.position.x -= playerSpeed * deltaTime * 60; 
    }
    if (rightPressed) {
            playerGroup.position.x += playerSpeed * deltaTime * 60; 
    }

    const halfPlayerWidth = playerRickshawScaledBodyWidth / 2;
        const roadHalfWidth = roadWidth / 2;
        playerGroup.position.x = Math.max(-roadHalfWidth + halfPlayerWidth + 0.25, Math.min(roadHalfWidth - halfPlayerWidth - 0.25, playerGroup.position.x));
    }
    playerGroup.updateMatrixWorld(true); 

    // Update Player's AABB each frame
    if (playerGroup.userData.aabb) {
        playerGroup.userData.aabb.setFromObject(playerGroup);
    } else {
        // Fallback if aabb was not initialized (should not happen with the loadGLTFModel change)
        playerGroup.userData.aabb = new THREE.Box3().setFromObject(playerGroup);
    }

    // Camera follow player X, with Y and Z fixed for now, looking at player
    const targetCameraX = playerGroup.position.x; // MODIFIED - More direct X follow (removed * 0.5)
    camera.position.x += (targetCameraX - camera.position.x) * cameraFollowSpeed;
    camera.position.y = 4.0; // MODIFIED - Increased from 3.5
    camera.position.z = 17; 
    camera.lookAt(playerGroup.position.x, 1.5, playerGroup.position.z); // MODIFIED - LookAt Y increased from 1.0

    // Determine player's current lane
    const playerX = playerGroup.position.x;
    if (playerX < -roadWidth/6) { 
        playerCurrentLaneIndex = 0; 
    } else if (playerX > roadWidth/6) {
        playerCurrentLaneIndex = 2; 
    } else {
        playerCurrentLaneIndex = 1; 
    }

    // Update time in current lane
    if (playerCurrentLaneIndex === previousPlayerLaneIndex) {
        timeInCurrentLane += deltaTime;
    } else {
        timeInCurrentLane = 0; 
        previousPlayerLaneIndex = playerCurrentLaneIndex;
    }

    // Targeted spawn logic
    if (timeInCurrentLane > TIME_TO_TRIGGER_TARGETED_SPAWN && 
        targetedSpawnCooldownTimer <= 0 && 
        obstacles.length < MAX_ACTIVE_OBSTACLES) {
        // console.log(`Targeted spawn triggered for lane: ${playerCurrentLaneIndex}`);
        spawnObstacle(); 
        timeInCurrentLane = 0; 
        targetedSpawnCooldownTimer = TARGETED_SPAWN_COOLDOWN_DURATION; 
    }

    // Regular obstacle spawning (wave)
    obstacleSpawnTimer -= deltaTime;
    if (obstacleSpawnTimer <= 0 && 
        globalSpawnCooldownTimer <= 0 && 
        obstacles.length < MAX_ACTIVE_OBSTACLES) {
        spawnObstacle(); // Call with no arguments for wave spawn
        obstacleSpawnTimer = currentObstacleSpawnInterval / 60.0; 
  }

  // Move obstacles and check for collisions
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
        obstacle.position.z += currentObstacleSpeed * deltaTime * 60; 
        obstacle.updateMatrixWorld(true); // Ensure obstacle's world matrix is up-to-date

        // Update obstacle's AABB each frame
        if (obstacle.userData.aabb) {
            obstacle.userData.aabb.setFromObject(obstacle);
        } else {
            // Fallback if aabb was not initialized (should not happen)
            obstacle.userData.aabb = new THREE.Box3().setFromObject(obstacle);
        }

        // Update bounding box helper if it exists
        // if (obstacle.userData.boundingBoxHelper) {
        //     obstacle.userData.boundingBoxHelper.update();
        // }

        // 3D Collision Detection using AABB
        if (obstacle.userData.aabb && playerGroup.userData.aabb) {
            if (obstacle.userData.aabb.intersectsBox(playerGroup.userData.aabb)) {
            triggerGameOver();
            break; 
        }
    }

        if (obstacle.position.z > camera.position.z + 60) { 
            if (obstacle.userData.boxHelper) scene.remove(obstacle.userData.boxHelper); // Ensure old helper ref is used
      scene.remove(obstacle);
      obstacles.splice(i, 1);
    }
  }

  if (!gameOver) {
        score += deltaTime * 10; 
    updateScoreDisplay();
        updateDifficulty(); 
    }

    renderer.render(scene, camera);
}

function spawnObstacle() { 
    if (obstacles.length >= MAX_ACTIVE_OBSTACLES || globalSpawnCooldownTimer > 0) {
        // console.log(`DEBUG: Spawn skipped. Obstacles: ${obstacles.length}, Cooldown: ${globalSpawnCooldownTimer.toFixed(2)}`);
        return; 
    }

    const truckSpawnZ = -200; // Initial Z position for new trucks
    const truckZOffsetMax = 20; // Max Z difference for trucks spawned in the same event
    let chosenLaneIndices = [];

    // Determine if it's a "targeted pressure" situation or a normal spawn
    if (timeInCurrentLane > TIME_TO_TRIGGER_TARGETED_SPAWN && targetedSpawnCooldownTimer <= 0) {
        // console.log("DEBUG: Attempting targeted pressure spawn.");
        let availableLanesForPressure = [0, 1, 2];
        availableLanesForPressure.splice(playerCurrentLaneIndex, 1); // Remove player's current lane

        // Attempt to spawn in the other two lanes
        if (obstacles.length < MAX_ACTIVE_OBSTACLES && availableLanesForPressure.length > 0) {
            chosenLaneIndices.push(availableLanesForPressure[0]);
        }
        if (obstacles.length + chosenLaneIndices.length < MAX_ACTIVE_OBSTACLES && availableLanesForPressure.length > 1) {
            chosenLaneIndices.push(availableLanesForPressure[1]);
        }
        
        if (chosenLaneIndices.length > 0) {
            timeInCurrentLane = 0; // Reset time in lane as we've acted on it
            targetedSpawnCooldownTimer = TARGETED_SPAWN_COOLDOWN_DURATION;
            // console.log(`DEBUG: Targeted pressure: Spawning in lanes ${chosenLaneIndices.join(', ')}`);
        } else {
            // console.log("DEBUG: Targeted pressure condition met, but no lanes chosen (MAX_OBSTACLES likely reached for multi-spawn)");
        }
    } else {
        // Normal spawn: try to spawn two trucks in different lanes, leaving one open, 
        // but be smarter about whether the "open" lane is truly clear.
        // console.log("DEBUG: Attempting smart normal spawn.");
        let allLanes = [0, 1, 2];
        // Shuffle lanes to pick two randomly for potential spawning
        for (let i = allLanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allLanes[i], allLanes[j]] = [allLanes[j], allLanes[i]];
        }

        const potentialLaneA = allLanes[0];
        const potentialLaneB = allLanes[1];
        const potentialOpenLane = allLanes[2]; // The lane intended to be left open by this wave

        let isPotentialOpenLaneClear = true;
        const checkSafeSpawnDistance = truckZOffsetMax * 3; // How far ahead to check in the open lane

        for (const obs of obstacles) {
            if (obs.userData.laneIndex === potentialOpenLane && 
                obs.position.z > (truckSpawnZ - checkSafeSpawnDistance) && 
                obs.position.z < (truckSpawnZ + checkSafeSpawnDistance * 2)) { // Check a zone around spawn Z
                isPotentialOpenLaneClear = false;
                // console.log(`DEBUG: Normal spawn: Potential open lane ${potentialOpenLane} is NOT clear near spawn Z.`);
                break;
            }
        }

        if (isPotentialOpenLaneClear) {
            // console.log(`DEBUG: Normal spawn: Potential open lane ${potentialOpenLane} IS clear. Spawning two trucks.`);
            if (obstacles.length < MAX_ACTIVE_OBSTACLES) {
                chosenLaneIndices.push(potentialLaneA);
            }
            if (obstacles.length + chosenLaneIndices.length < MAX_ACTIVE_OBSTACLES) {
                chosenLaneIndices.push(potentialLaneB);
            }
        } else {
            // console.log(`DEBUG: Normal spawn: Potential open lane ${potentialOpenLane} NOT clear. Spawning one truck.`);
            // Fallback: spawn only one truck in one of the initially selected lanes
            if (obstacles.length < MAX_ACTIVE_OBSTACLES) {
                 // Randomly pick between potentialLaneA or potentialLaneB for the single spawn
                chosenLaneIndices.push(Math.random() < 0.5 ? potentialLaneA : potentialLaneB);
            }
        }
        // console.log(`DEBUG: Normal spawn: Attempting to spawn in lanes ${chosenLaneIndices.join(', ')}`);
    }

    // Now spawn the trucks if any lanes were chosen
    let spawnedCountThisEvent = 0;
    for (let i = 0; i < chosenLaneIndices.length; i++) {
        if (obstacles.length >= MAX_ACTIVE_OBSTACLES) {
            // console.log("DEBUG: Max obstacles reached during multi-truck spawn attempt.");
            break; 
        }
        const laneIdx = chosenLaneIndices[i];
        let currentTruckSpawnZ = truckSpawnZ;

        // If spawning a pair, ensure the second truck has a fixed Z offset from the first.
        if (chosenLaneIndices.length === 2 && i === 1) { 
            currentTruckSpawnZ -= truckZOffsetMax; // Second truck is truckZOffsetMax units behind the first
        }
        // If only one truck is chosen (i will be 0), it uses truckSpawnZ.
        // If it's the first truck of a pair (i will be 0), it also uses truckSpawnZ.
        
        createAndAddObstacle(lanePositions[laneIdx], laneIdx, currentTruckSpawnZ);
        spawnedCountThisEvent++;
    }

    if (spawnedCountThisEvent > 0) {
        globalSpawnCooldownTimer = GLOBAL_SPAWN_COOLDOWN; 
        // console.log(`DEBUG: Spawned ${spawnedCountThisEvent} trucks. Global cooldown set to ${GLOBAL_SPAWN_COOLDOWN.toFixed(2)}s.`);
    }
    // Reset interval timer regardless of spawn success to keep attempts regular
    // This ensures that even if a spawn event results in 0 trucks (e.g., MAX_ACTIVE_OBSTACLES was met just before createAndAddObstacle)
    // the game still tries to spawn again after the currentObstacleSpawnInterval.
    obstacleSpawnTimer = currentObstacleSpawnInterval / 60.0; 
}

function createAndAddObstacle(laneX, laneIndex, spawnZ) {
    if (obstacles.length >= MAX_ACTIVE_OBSTACLES) return;

    const manager = new THREE.LoadingManager();
    // Restore and refine the URL modifier
    manager.setURLModifier((url) => {
        let modifiedUrl = url;
        const lowerCaseUrl = url.toLowerCase();
        const originalUrl = url; // Keep original for logging

        // Check if it's an image texture
        const isImageTexture = lowerCaseUrl.endsWith('.png') ||
                               lowerCaseUrl.endsWith('.jpg') ||
                               lowerCaseUrl.endsWith('.jpeg') ||
                               lowerCaseUrl.endsWith('.webp') ||
                               lowerCaseUrl.endsWith('.bmp');

        if (isImageTexture) {
            // Check if the texture is being requested from the truck's expected texture subdirectory
            if (url.includes('models/truck/textures/')) {
                const textureFileName = url.split('/').pop();
                modifiedUrl = `textures/${textureFileName}`; // Remap to the root /textures/ folder
                console.log(`[Truck Texture Remap] Original: ${originalUrl}, New: ${modifiedUrl}`);
            } else {
                // It's an image, but not from the truck's specific texture path we need to remap
                console.log(`[Image Passthrough] URL: ${originalUrl} (Not a truck sub-texture path)`);
            }
        } else {
            // Not an image file (e.g., .gltf, .bin), pass through
            console.log(`[Non-Image Passthrough] URL: ${originalUrl}`);
        }
        return modifiedUrl;
    });

    const loader = new THREE.GLTFLoader(manager);
    loader.load(
        'models/truck/scene.gltf',
        (gltf) => {
            console.log("DEBUG: Truck GLTF loaded successfully via createAndAddObstacle.");
            const obstacleGroup = new THREE.Group();
            const truckModel = gltf.scene;

            // --- Standard model setup (scaling, material properties) ---
            const box = new THREE.Box3().setFromObject(truckModel);
            const size = box.getSize(new THREE.Vector3());
            const desiredTruckWidth = laneWidth * 0.70; // Target 70% of lane width
            const scale = desiredTruckWidth / size.x;

            truckModel.scale.set(scale, scale, scale);
            box.setFromObject(truckModel); // Recalculate bounding box after scaling
            const scaledSize = box.getSize(new THREE.Vector3());
            const scaledCenter = box.getCenter(new THREE.Vector3());

            truckModel.position.y = -scaledCenter.y + scaledSize.y / 2; // Align bottom with ground
            // --- End standard model setup ---

            obstacleGroup.add(truckModel);
            obstacleGroup.position.set(laneX, 0, spawnZ); // Y should be 0 for ground level

            obstacleGroup.userData.isObstacle = true;
            obstacleGroup.userData.type = 'truck';
            obstacleGroup.userData.laneIndex = laneIndex;

            // Calculate bounding box for the obstacle group
            // const obstacleBox = new THREE.Box3().setFromObject(obstacleGroup); // Old name
            // obstacleGroup.userData.boundingBox = obstacleBox; // Old name
            
            // Initialize and set the AABB for the obstacle group
            obstacleGroup.updateMatrixWorld(true); // Ensure matrix is up-to-date before AABB calculation
            obstacleGroup.userData.aabb = new THREE.Box3().setFromObject(obstacleGroup);
            // console.log(`DEBUG: Obstacle AABB for lane ${laneIndex}:`, obstacleGroup.userData.aabb.min, obstacleGroup.userData.aabb.max);


             // Make bounding box visible for debugging (using the new aabb)
            // const helper = new THREE.Box3Helper(obstacleGroup.userData.aabb, 0xffff00);
            // scene.add(helper);
            // obstacleGroup.userData.boxHelper = helper; // Store helper on userData if needed

            truckModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true; // Meshes can also receive shadows
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                if (mat.map) {
                                    mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                                    mat.needsUpdate = true;
                                }
                                // You can set other material properties here if needed
                                // mat.metalness = mat.metalness !== undefined ? mat.metalness : 0.5;
                                // mat.roughness = mat.roughness !== undefined ? mat.roughness : 0.5;
                            });
                        } else {
                            if (child.material.map) {
                                child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                                child.material.needsUpdate = true;
                            }
                            // child.material.metalness = child.material.metalness !== undefined ? child.material.metalness : 0.5;
                            // child.material.roughness = child.material.roughness !== undefined ? child.material.roughness : 0.5;
                        }
                    }
                }
            });

            scene.add(obstacleGroup);
            obstacles.push(obstacleGroup);
            console.log(`DEBUG: Truck obstacle added to scene at X:${laneX}, Z:${spawnZ}. Total obstacles: ${obstacles.length}`);
            console.log("DEBUG: Truck Model Transform:", truckModel.matrixWorld.elements);


        },
        undefined, // onProgress callback (optional)
        (error) => {
            console.error("Error loading truck GLTF:", error);
            if (error.target && error.target.src) {
                 console.error("Failed URL:", error.target.src);
            }
            console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

        }
    );
}

function updateScoreDisplay() {
    if (scoreDisplay) scoreDisplay.textContent = Math.floor(score);
}

function triggerGameOver() {
    gameOver = true;
    currentObstacleSpeed = 0; // Stop obstacles immediately
    if (finalScoreDisplay) finalScoreDisplay.textContent = Math.floor(score); // Display integer score
    if (gameOverScreen) gameOverScreen.style.display = 'flex'; // Show game over screen
    console.log("Collision Detected! Game Over. Final Score: " + Math.floor(score));

    if (backgroundAudio) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0; // Reset for next game
        console.log("DEBUG: Background audio paused and reset.");
    }
}

function restartGame() {
    obstacles.forEach(obstacle => {
        if (obstacle.userData && obstacle.userData.boundingBoxHelper) { 
            scene.remove(obstacle.userData.boundingBoxHelper);
        }
        scene.remove(obstacle); 
    });
    obstacles = [];
    score = 0;
    currentObstacleSpeed = initialObstacleSpeed;
    currentObstacleSpawnInterval = initialObstacleSpawnInterval;
    obstacleSpawnTimer = currentObstacleSpawnInterval / 60.0; 
    globalSpawnCooldownTimer = 0; 
    gameOver = false;
    if(gameOverScreen) gameOverScreen.style.display = 'none';

    if (playerGroup) {
        // Reset player to middle lane, slightly above ground, at starting Z
        playerGroup.position.set(lanePositions[1], 1.0, 0); 
    }
        leftPressed = false; 
        rightPressed = false;

    // Reset targeted spawn variables
    timeInCurrentLane = 0;
    targetedSpawnCooldownTimer = 0;
    playerCurrentLaneIndex = 1; // Start in middle lane
    previousPlayerLaneIndex = 1; // Reset this too

    updateScoreDisplay();
    if (clock) clock.start();

    if (backgroundAudio) {
        backgroundAudio.play().catch(error => {
            console.warn("Failed to play background audio on restart:", error);
        });
        console.log("DEBUG: Background audio play attempted on restart.");
    }
}

// Placeholder for HUD update if needed
// function updateHUD() {
//   const scoreElement = document.getElementById('score');
//   if (scoreElement) {
//     // scoreElement.textContent = score + ' m'; // score variable is currently commented out
//   }
//   // const bestScoreElement = document.getElementById('bestScore');
//   // if (bestScoreElement) {
//   //   bestScoreElement.textContent = localStorage.getItem('rickshaw_best_score') || 0;
//   // }
// }

// NEW Placeholder function
function updateDifficulty() {
    const scoreFactorSpeed = Math.floor(score / 50); // MODIFIED - Faster speed increase (was 150)
    currentObstacleSpeed = Math.min(initialObstacleSpeed + scoreFactorSpeed * 0.05, maxObstacleSpeed);

    const scoreFactorInterval = Math.floor(score / 10); // MODIFIED - Faster interval decrease (was 30)
    currentObstacleSpawnInterval = Math.max(initialObstacleSpawnInterval - scoreFactorInterval * 5, minObstacleSpawnInterval);

    // Update road scroll speed based on difficulty
    // Initial speed is roadScrollSpeed (0.03), max is maxRoadScrollSpeed (0.08)
    // The increment (0.0015) is chosen to provide a noticeable but not overly jarring increase.
    currentRoadScrollSpeed = Math.min(roadScrollSpeed + scoreFactorSpeed * 0.0015, maxRoadScrollSpeed); // MODIFIED - Multiplier increased from 0.0005
}
