// window.onerror = function(message, source, lineno, colno, error) {
//   if (typeof message === 'string' && message.includes('Access to storage is not allowed')) return true;
//   if (typeof message === 'string' && message.includes('Unknown response id')) return true;
//   return false; // Let other errors through
// };

let scene, camera, renderer;
let playerGroup, groundMesh;
// let testCube; // Declare testCube globally for logging
// Keep input state global for now
let leftPressed = false, rightPressed = false;
let textureLoader; // Declare textureLoader globally or pass it around
const roadScrollSpeed = 0.02; // Adjusted scroll speed

let playerRickshawScaledBodyWidth; // Global variable for player's scaled width

let obstacles = [];
const initialObstacleSpeed = 0.3; // Slightly reduced initial speed
let currentObstacleSpeed = initialObstacleSpeed;
const maxObstacleSpeed = 1.0; // Cap for obstacle speed

const initialObstacleSpawnInterval = 120; // MODIFIED - Moved up
let obstacleSpawnTimer = initialObstacleSpawnInterval / 60.0; // Uses the above const
let currentObstacleSpawnInterval = initialObstacleSpawnInterval;
const minObstacleSpawnInterval = 45; // Minimum interval (approx 0.75 seconds)

const laneWidth = 10; // Ground width is 30, so 3 lanes of 10
const lanePositions = [-laneWidth, 0, laneWidth]; // X-coordinates for center of lanes

let gameOver = false; // Add game over state
let score = 0;
let scoreDisplay, finalScoreDisplay, gameOverScreen, restartBtn;
const cameraFollowSpeed = 0.05; // Smoothing factor for camera movement

// New texture variables
let carTexture, truckTexture;

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

let sceneryObjects = [];
const scenerySpawnInterval = 90; // MODIFIED - Moved up
let scenerySpawnTimer = scenerySpawnInterval / 60.0; // Uses the above const
const scenerySpeedFactor = 0.95; // Scenery moves slightly slower than road for parallax

// Scenery Colors & Types
const poleColor = 0x888888; // Grey
const bushColor = 0x228B22; // Forest Green
const buildingColor = 0x778899; // Light Slate Gray
const treeTrunkColor = 0x8B4513; // SaddleBrown
const poleLightMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFE0, emissive: 0x777700 });

let clock = new THREE.Clock(); // Add clock for delta time in animation
let isPlayerModelLoaded = false; // Flag to indicate if the GLTF model has loaded
const desiredRickshawHeight = 3.5; // Define this globally or pass as param
const roadWidth = 30; // Assuming this is defined somewhere, needed for lane boundaries

window.onload = function() {
  // Initialize Three.js Environment First
  initThreeJS();

  // Initialize TextureLoader here as THREE is now defined
  textureLoader = new THREE.TextureLoader();

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
};

function loadRoadTexture() {
    if (!textureLoader || !groundMesh) {
        console.warn("TextureLoader or groundMesh not initialized for loadRoadTexture");
        return;
    }
    textureLoader.load(
        'textures/stone.png', // Path to your road texture
        function(texture) { // onLoad callback
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(roadWidth / 10, 20); // Adjust repeat based on roadWidth and desired look
            groundMesh.material.map = texture;
            groundMesh.material.needsUpdate = true;
            console.log("Road texture loaded and applied.");
        },
        undefined, // onProgress callback (optional)
        function(err) { // onError callback
            console.error('An error occurred loading the road texture:', err);
        }
    );

    // Example for lane lines as a texture (if you want to replace the Line objects)
    // textureLoader.load('textures/lane_lines.png', function(texture) {
    //     texture.wrapS = THREE.RepeatWrapping;
    //     texture.wrapT = THREE.RepeatWrapping;
    //     texture.repeat.set(1, 10); // Adjust as needed
    //     roadLinesMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, side:THREE.DoubleSide });
    //     // You'd then create a plane for these lines and add it to the scene.
    // });
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
  // scene.background = new THREE.Color(0x87CEEB); // Sky blue background // Keep this for now

  // More advanced lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Softer ambient light
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true; // Enable shadows for this light
  // Configure shadow properties (optional, but good for performance/quality)
  directionalLight.shadow.mapSize.width = 1024; // default is 512
  directionalLight.shadow.mapSize.height = 1024; // default is 512
  directionalLight.shadow.camera.near = 0.5;    // default
  directionalLight.shadow.camera.far = 50;     // default
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);


  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  // camera.position.set(0, 5, 10); // Initial fixed camera for debugging
  // camera.lookAt(0, 0, 0);       // Look at scene origin for debugging
  console.log(`DEBUG: Initial Camera Position: ${camera.position.x} ${camera.position.y} ${camera.position.z}`);
  console.log(`DEBUG: Camera is looking at (0,0,0)`);


  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; // Enable shadow mapping in the renderer
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: for softer shadows
  document.getElementById('gameContainer').appendChild(renderer.domElement);


  // Ground
  const groundGeometry = new THREE.PlaneGeometry(roadWidth, 400); // Ground width from variable, increased length
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x404040, // Darker grey for asphalt
    side: THREE.DoubleSide,
    map: null // Will be set by loadRoadTexture
  });
  groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.05; // Slightly below y=0 to avoid z-fighting with model at y=0
  groundMesh.receiveShadow = true; // Ground should receive shadows
  scene.add(groundMesh);
  console.log("DEBUG: Ground mesh created and added to scene.");


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


  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    console.log("DEBUG: Window resized, camera and renderer updated.");
  }, false);
}

function loadGLTFModel() {
    const loader = new THREE.GLTFLoader();
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
  if (gameOver) return;

  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Update road texture offset for scrolling effect
  if (groundMesh.material && groundMesh.material.map) {
    if (!groundMesh.material.map.offset) groundMesh.material.map.offset = new THREE.Vector2();
    groundMesh.material.map.offset.y -= roadScrollSpeed * delta * 10;
  }

  // Player movement
  const movementSpeed = 5; 
  if (playerGroup && isPlayerModelLoaded) { 
    if (leftPressed) {
      playerGroup.position.x -= movementSpeed * delta;
    }
    if (rightPressed) {
      playerGroup.position.x += movementSpeed * delta;
    }

    const halfPlayerWidth = playerRickshawScaledBodyWidth / 2;
    const laneBoundary = roadWidth / 2 - halfPlayerWidth - 0.1; 
    playerGroup.position.x = Math.max(-laneBoundary, Math.min(laneBoundary, playerGroup.position.x));
    
    playerGroup.updateMatrixWorld(true); // Important for consistent position data
  }

  // Obstacle/Scenery/Collision (Still disabled for model visibility debugging)
  // ...

  // NEW Obstacle and Scenery Management
  if (!gameOver) {
    obstacleSpawnTimer -= delta;
    if (obstacleSpawnTimer <= 0) {
      spawnObstacle();
      obstacleSpawnTimer = currentObstacleSpawnInterval / 60.0; // Reset timer (assumes interval is in frames)
    }

    scenerySpawnTimer -= delta;
    if (scenerySpawnTimer <= 0) {
      spawnSceneryObject();
      scenerySpawnTimer = scenerySpawnInterval / 60.0; // Reset timer (assumes interval is in frames)
    }
  }

  // Move obstacles and check for collisions
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    obstacle.position.z += currentObstacleSpeed * delta * 60; // Adjust speed factor as needed

    // Basic 3D Collision Detection
    if (playerGroup && obstacle.children.length > 0 && !gameOver) {
        // Ensure matrices are up to date for accurate bounding boxes
        playerGroup.updateMatrixWorld(true);
        obstacle.updateMatrixWorld(true);

        const playerBox = new THREE.Box3().setFromObject(playerGroup);
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);
        
        if (playerBox.intersectsBox(obstacleBox)) {
            triggerGameOver();
            break; 
        }
    }

    // Despawn off-screen (passed player and camera)
    if (obstacle.position.z > camera.position.z + 30) { // Despawn if well behind camera (camera.position.z is 15)
      scene.remove(obstacle);
      obstacles.splice(i, 1);
    }
  }

  // Move scenery
  for (let i = sceneryObjects.length - 1; i >= 0; i--) {
    const scenery = sceneryObjects[i];
    // Scenery moves at a speed relative to obstacles/road
    scenery.position.z += currentObstacleSpeed * scenerySpeedFactor * delta * 60; 

    // Despawn off-screen scenery
    if (scenery.position.z > camera.position.z + 60) { // Despawn further back
        scene.remove(scenery);
        // It's good practice to also dispose of geometry and material if they are unique to this object
        // scenery.traverse(child => {
        //   if (child.isMesh) {
        //     child.geometry.dispose();
        //     if (child.material.isMaterial) {
        //       child.material.dispose();
        //     } else if (Array.isArray(child.material)) {
        //       child.material.forEach(m => m.dispose());
        //     }
        //   }
        // });
        sceneryObjects.splice(i, 1);
    }
  }

  if (!gameOver) {
    score += delta * 10; 
    updateScoreDisplay();
    updateDifficulty(); // MODIFIED - Call updateDifficulty
  }

  // Fixed camera for debugging model visibility
  camera.position.set(0, 5, 15); 
  camera.lookAt(0, 0, 0); 

  // Simplified Debug Logs for animate loop
  if (isPlayerModelLoaded && playerGroup && playerGroup.position) {
    const pgPos = playerGroup.position;
    // console.log(`DEBUG Anim: PlayerGroup XYZ: ${pgPos.x.toFixed(2)}, ${pgPos.y.toFixed(2)}, ${pgPos.z.toFixed(2)}`); //MODIFIED
  } else if (!isPlayerModelLoaded) {
    // console.log('DEBUG Anim: Waiting for player model...'); // Optional: can be spammy
  }

  if (testCube && testCube.position){ // Log test cube if it exists
    const tcPos = testCube.position;
    // console.log(`DEBUG Anim: TestCube XYZ: ${tcPos.x.toFixed(2)}, ${tcPos.y.toFixed(2)}, ${tcPos.z.toFixed(2)}`); // Optional: can be spammy
  }
  
  renderer.render(scene, camera);
}

function spawnObstacle() {
  const obstacleGroup = new THREE.Group();

  // Truck Body Material & Mesh
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: truckBodyColor });
  const bodyMesh = new THREE.Mesh(truckBodyGeometry, bodyMaterial);
  bodyMesh.position.y = truckBodyHeight / 2; // Assuming group pivot is at ground level
  obstacleGroup.add(bodyMesh);

  // Truck Cabin Material & Mesh
  const cabinMaterial = new THREE.MeshStandardMaterial({ color: truckCabinColor });
  const cabinMesh = new THREE.Mesh(truckCabinGeometry, cabinMaterial);
  // Position cabin on top and front of the truck body
  cabinMesh.position.y = truckBodyHeight + truckCabinHeight / 2;
  cabinMesh.position.z = truckBodyLength / 2 - truckCabinLength / 2 - 0.1; // Front of body
  obstacleGroup.add(cabinMesh);
  
  // Truck Wheels (Cylinders)
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: truckWheelColor });
  const wheelYPos = truckWheelRadius;

  // Front Wheels (paired)
  const flWheelMesh = new THREE.Mesh(truckWheelGeometry, wheelMaterial);
  flWheelMesh.rotation.z = Math.PI / 2; // Rotate cylinder to stand upright
  flWheelMesh.position.set(-truckBodyWidth/2 + truckWheelRadius*0.7, wheelYPos, truckBodyLength/2 - truckWheelRadius * 1.5);
  obstacleGroup.add(flWheelMesh);

  const frWheelMesh = new THREE.Mesh(truckWheelGeometry, wheelMaterial);
  frWheelMesh.rotation.z = Math.PI / 2; // Rotate cylinder to stand upright
  frWheelMesh.position.set(truckBodyWidth/2 - truckWheelRadius*0.7, wheelYPos, truckBodyLength/2 - truckWheelRadius* 1.5);
  obstacleGroup.add(frWheelMesh);

  // Rear Wheels (paired, dually-style or just wider apart)
  const rlWheelMesh = new THREE.Mesh(truckWheelGeometry, wheelMaterial);
  rlWheelMesh.rotation.z = Math.PI / 2; // Rotate cylinder to stand upright
  rlWheelMesh.position.set(-truckBodyWidth/2 + truckWheelRadius*0.7, wheelYPos, -truckBodyLength/2 + truckWheelRadius * 1.5);
  obstacleGroup.add(rlWheelMesh);

  const rrWheelMesh = new THREE.Mesh(truckWheelGeometry, wheelMaterial);
  rrWheelMesh.rotation.z = Math.PI / 2; // Rotate cylinder to stand upright
  rrWheelMesh.position.set(truckBodyWidth/2 + truckWheelRadius*0.7, wheelYPos, -truckBodyLength/2 + truckWheelRadius * 1.5);
  obstacleGroup.add(rrWheelMesh);

  // Truck Headlights
  const truckHeadlightRadius = 0.15 * vehicleScaleFactor, 
        truckHeadlightDepth = 0.1 * vehicleScaleFactor;
  const truckHeadlightGeom = new THREE.CylinderGeometry(truckHeadlightRadius, truckHeadlightRadius * 0.9, truckHeadlightDepth, 12);
  
  const leftHeadlight = new THREE.Mesh(truckHeadlightGeom, truckHeadlightMaterial);
  leftHeadlight.rotation.x = Math.PI / 2;
  leftHeadlight.position.set(
    -truckCabinWidth / 2 + truckHeadlightRadius + (0.1 * vehicleScaleFactor), 
    cabinMesh.position.y - truckCabinHeight / 2 + truckHeadlightRadius + (0.1 * vehicleScaleFactor), 
    cabinMesh.position.z + truckCabinLength / 2 + truckHeadlightDepth / 2
  );
  obstacleGroup.add(leftHeadlight);

  const rightHeadlight = new THREE.Mesh(truckHeadlightGeom, truckHeadlightMaterial);
  rightHeadlight.rotation.x = Math.PI / 2;
  rightHeadlight.position.set(
    truckCabinWidth / 2 - truckHeadlightRadius - (0.1 * vehicleScaleFactor), 
    cabinMesh.position.y - truckCabinHeight / 2 + truckHeadlightRadius + (0.1 * vehicleScaleFactor), 
    cabinMesh.position.z + truckCabinLength / 2 + truckHeadlightDepth / 2
  );
  obstacleGroup.add(rightHeadlight);

  // Truck Taillights
  const truckTaillightWidth = 0.2 * vehicleScaleFactor, 
        truckTaillightHeight = 0.15 * vehicleScaleFactor, 
        truckTaillightDepth = 0.05 * vehicleScaleFactor;
  const truckTaillightGeom = new THREE.BoxGeometry(truckTaillightWidth, truckTaillightHeight, truckTaillightDepth);

  const leftTaillight = new THREE.Mesh(truckTaillightGeom, truckTaillightMaterial);
  leftTaillight.position.set(
    -truckBodyWidth / 2 + truckTaillightWidth / 2 + (0.1 * vehicleScaleFactor),
    bodyMesh.position.y, 
    bodyMesh.position.z - truckBodyLength / 2 - truckTaillightDepth / 2
  );
  obstacleGroup.add(leftTaillight);

  const rightTaillight = new THREE.Mesh(truckTaillightGeom, truckTaillightMaterial);
  rightTaillight.position.set(
    truckBodyWidth / 2 - truckTaillightWidth / 2 - (0.1 * vehicleScaleFactor),
    bodyMesh.position.y, 
    bodyMesh.position.z - truckBodyLength / 2 - truckTaillightDepth / 2
  );
  obstacleGroup.add(rightTaillight);

  // Choose a random lane
  const laneIndex = Math.floor(Math.random() * lanePositions.length);
  obstacleGroup.position.x = lanePositions[laneIndex];
  obstacleGroup.position.y = 0; // Group pivot at ground level
  obstacleGroup.position.z = -100; 

  scene.add(obstacleGroup);
  obstacles.push(obstacleGroup); // Store the group
}

function spawnSceneryObject() {
    const objectType = Math.random(); // Randomly determine scenery type
    let sceneryGroup = new THREE.Group(); // Use a group for all scenery types for consistency

    const side = Math.random() < 0.5 ? -1 : 1; // -1 for left, 1 for right
    const lateralOffset = roadWidth / 2 + 5 + Math.random() * 10; // Spawn 5-15 units away from road edge
    const spawnZ = -150; // Spawn further back than obstacles

    if (objectType < 0.33) { // Type 1: Pole with Light
        const poleHeight = Math.random() * 5 + 5;
        const poleRadius = 0.15;
        const poleGeometry = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: poleColor });
        const poleMesh = new THREE.Mesh(poleGeometry, poleMaterial);
        poleMesh.position.y = poleHeight / 2;
        sceneryGroup.add(poleMesh);

        const lightFixtureSize = 0.4;
        const lightFixtureGeom = new THREE.BoxGeometry(lightFixtureSize, lightFixtureSize * 0.8, lightFixtureSize);
        const lightFixtureMesh = new THREE.Mesh(lightFixtureGeom, poleLightMaterial);
        lightFixtureMesh.position.y = poleHeight + (lightFixtureSize * 0.8) / 2;
        // Optionally, position it slightly forward
        // lightFixtureMesh.position.z = lightFixtureSize / 2;
        sceneryGroup.add(lightFixtureMesh);

    } else if (objectType < 0.66) { // Type 2: Tree
        const trunkHeight = Math.random() * 3 + 2;
        const trunkRadius = Math.random() * 0.3 + 0.2;
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: treeTrunkColor });
        const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunkMesh.position.y = trunkHeight / 2;
        sceneryGroup.add(trunkMesh);

        const foliageRadius = Math.random() * 1.5 + 1;
        const foliageSegments = 8; // Keep it low poly
        const foliageGeometry = new THREE.SphereGeometry(foliageRadius, foliageSegments, foliageSegments);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: bushColor });
        const foliageMesh = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliageMesh.position.y = trunkHeight + foliageRadius * 0.8; // Position foliage on top of trunk
        sceneryGroup.add(foliageMesh);
        
    } else { // Type 3: Taller Building Silhouette (remains a single mesh, added to group)
        const buildingWidth = Math.random() * 6 + 4; // Slightly larger and more varied
        const buildingHeight = Math.random() * 10 + 8;
        const buildingDepth = Math.random() * 5 + 3;
        const buildingGeometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
        const buildingMaterial = new THREE.MeshStandardMaterial({ color: buildingColor });
        const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial); // Create mesh
        buildingMesh.position.y = buildingGeometry.parameters.height / 2;
        sceneryGroup.add(buildingMesh); // Add mesh to group
    }

    sceneryGroup.position.x = side * lateralOffset;
    sceneryGroup.position.z = spawnZ;
    sceneryGroup.position.y = 0; // Ensure base of group is at Y=0, individual components are offset internally
    
    scene.add(sceneryGroup);
    sceneryObjects.push(sceneryGroup); // Store the group
}

function updateScoreDisplay() {
    if (scoreDisplay) scoreDisplay.textContent = score + ' m';
}

function triggerGameOver() {
    gameOver = true;
    currentObstacleSpeed = 0; // Stop obstacles immediately
    if (finalScoreDisplay) finalScoreDisplay.textContent = score;
    if (gameOverScreen) gameOverScreen.style.display = 'flex'; // Show game over screen
    console.log("Collision Detected! Game Over. Final Score: " + score);
}

function restartGame() {
    gameOver = false;
    score = 0;
    updateScoreDisplay();
    currentObstacleSpeed = initialObstacleSpeed; // Reset speed
    currentObstacleSpawnInterval = initialObstacleSpawnInterval; // Reset spawn interval

    obstacleSpawnTimer = currentObstacleSpawnInterval / 60.0; // MODIFIED - Reset timer
    scenerySpawnTimer = scenerySpawnInterval / 60.0;   // MODIFIED - Reset timer

    if (playerGroup) {
        playerGroup.position.set(0, 0, 3);
        leftPressed = false; 
        rightPressed = false;
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
        scene.remove(obstacles[i]);
    }
    obstacles = [];

    // Clear existing scenery objects
    for (let i = sceneryObjects.length - 1; i >= 0; i--) {
        scene.remove(sceneryObjects[i]);
        // Consider disposing geometry/material if not shared and created uniquely
    }
    sceneryObjects = [];

    if (gameOverScreen) gameOverScreen.style.display = 'none';
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
    // This function can be expanded to increase game difficulty over time
    // For example, by increasing currentObstacleSpeed or decreasing currentObstacleSpawnInterval
    // based on score or time.
    // console.log("DEBUG: updateDifficulty called, current speed:", currentObstacleSpeed, "spawn interval:", currentObstacleSpawnInterval);

    if (!gameOver) { // Only update if game is running
        // Example: Increase speed slightly based on score
        // currentObstacleSpeed = initialObstacleSpeed + (score / 5000); // Increase speed every 500 score points
        // currentObstacleSpeed = Math.min(currentObstacleSpeed, maxObstacleSpeed); // Cap speed

        // Example: Decrease spawn interval based on score
        // currentObstacleSpawnInterval = initialObstacleSpawnInterval - (score / 100); // Decrease interval every 100 score
        // currentObstacleSpawnInterval = Math.max(currentObstacleSpawnInterval, minObstacleSpawnInterval);
    }
}
