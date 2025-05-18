// window.onerror = function(message, source, lineno, colno, error) {
//   if (typeof message === 'string' && message.includes('Access to storage is not allowed')) return true;
//   if (typeof message === 'string' && message.includes('Unknown response id')) return true;
//   return false; // Let other errors through
// };

let scene, camera, renderer;
let playerGroup, groundMesh;
// Keep input state global for now
let leftPressed = false, rightPressed = false;
let textureLoader; // Declare textureLoader globally or pass it around
const roadScrollSpeed = 0.02; // Adjusted scroll speed

let playerRickshawScaledBodyWidth; // Global variable for player's scaled width

let obstacles = [];
const initialObstacleSpeed = 0.3; // Slightly reduced initial speed
let currentObstacleSpeed = initialObstacleSpeed;
const maxObstacleSpeed = 1.0; // Cap for obstacle speed

let obstacleSpawnTimer = 0;
const initialObstacleSpawnInterval = 120; // Approx 2 seconds at 60fps
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
let scenerySpawnTimer = 0;
const scenerySpawnInterval = 90; // Spawn scenery a bit more frequently than obstacles
const scenerySpeedFactor = 0.95; // Scenery moves slightly slower than road for parallax

// Scenery Colors & Types
const poleColor = 0x888888; // Grey
const bushColor = 0x228B22; // Forest Green
const buildingColor = 0x778899; // Light Slate Gray
const treeTrunkColor = 0x8B4513; // SaddleBrown
const poleLightMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFE0, emissive: 0x777700 });

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
        console.warn('TextureLoader or groundMesh not ready for road texture loading');
        // Optionally, retry after a short delay or ensure initThreeJS completes first
        setTimeout(loadRoadTexture, 100); 
        return;
    }

    textureLoader.load(
        'textures/stone.png',
        function (texture) { // onLoad callback
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            
            const planeWidth = groundMesh.geometry.parameters.width;
            const planeHeight = groundMesh.geometry.parameters.height;
            // Assuming the stone texture is roughly square, tile it multiple times
            // Adjust these values to control tiling density
            texture.repeat.set(planeWidth / 10, planeHeight / 10); 

            groundMesh.material.map = texture;
            groundMesh.material.needsUpdate = true;
        },
        undefined, // onProgress callback
        function (err) { // onError callback
            console.error('An error happened loading the road texture:', err);
            // Fallback: Ensure ground is visible even if texture fails
            if (groundMesh) groundMesh.material.color.setHex(0x333333);
        }
    );
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
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element #gameCanvas not found!');
    return;
  }

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222); // Dark grey background, similar to original canvas

  // Camera
  camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  // Initial camera position will be adjusted by follow logic, but set a reasonable start
  camera.position.set(0, 7, 12); // Start a bit further back and higher
  // camera.lookAt is now dynamic in animate()

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Handle canvas resizing
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  });
  resizeObserver.observe(canvas);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Slightly brighter ambient
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Slightly brighter directional
  directionalLight.position.set(8, 15, 10);
  scene.add(directionalLight);

  // Ground Plane (Road)
  const groundGeometry = new THREE.PlaneGeometry(30, 200); // Ground width is 30
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, name: 'GroundMaterial' });
  groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  scene.add(groundMesh);

  // Lane Markings
  const laneMarkingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff }); // White markings
  const markingWidth = 0.2;
  const markingLength = groundMesh.geometry.parameters.height; // Same length as the road plane
  const markingHeight = 0.05; // Very slightly above the road to prevent z-fighting

  // Lane marking 1 (between left and center lane)
  // Ground width 30, 3 lanes of 10. Lane centers: -10, 0, 10.
  // Marking position: -5 and 5
  const laneMarkingGeometry1 = new THREE.BoxGeometry(markingWidth, markingHeight, markingLength);
  const laneMarking1 = new THREE.Mesh(laneMarkingGeometry1, laneMarkingMaterial);
  laneMarking1.position.set(-laneWidth / 2, markingHeight / 2, 0); // Centered on Z with road
  scene.add(laneMarking1);

  // Lane marking 2 (between center and right lane)
  const laneMarkingGeometry2 = new THREE.BoxGeometry(markingWidth, markingHeight, markingLength);
  const laneMarking2 = new THREE.Mesh(laneMarkingGeometry2, laneMarkingMaterial);
  laneMarking2.position.set(laneWidth / 2, markingHeight / 2, 0);
  scene.add(laneMarking2);

  // Player Rickshaw Model (Refined Black and Yellow)
  playerGroup = new THREE.Group();
  playerGroup.name = "PlayerRickshaw";
  scene.add(playerGroup);

  /* --- Start of commented out geometric rickshaw ---
  const rickshawBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700 }); 
  const rickshawCabinMaterial = new THREE.MeshStandardMaterial({ color: 0x0A0A0A }); 
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1A1A1A }); 
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x777777 }); 
  const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x4A3B31 }); 
  const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFE0, emissive: 0x999900 }); 

  const bodyWidth = 1.2 * vehicleScaleFactor, 
        bodyHeight = 0.4 * vehicleScaleFactor, 
        bodyLength = 2.0 * vehicleScaleFactor;
  playerRickshawScaledBodyWidth = bodyWidth; 

  const bodyGeometry = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
  const bodyMesh = new THREE.Mesh(bodyGeometry, rickshawBodyMaterial);
  bodyMesh.name = "RickshawBody";
  
  const playerWheelRadius = 0.35 * vehicleScaleFactor; 
  const playerWheelThickness = 0.15 * vehicleScaleFactor; 
  const playerWheelYPosition = playerWheelRadius; 
  const playerWheelSegments = 16; 

  bodyMesh.position.y = playerWheelYPosition + (bodyHeight / 2) - (0.1 * vehicleScaleFactor); 
  playerGroup.add(bodyMesh);

  const cabinWidth = bodyWidth * 0.95, 
        cabinHeight = 0.6 * vehicleScaleFactor, 
        cabinLength = bodyLength * 0.55;
  const cabinGeometry = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
  const cabinMesh = new THREE.Mesh(cabinGeometry, rickshawCabinMaterial);
  cabinMesh.position.y = bodyMesh.position.y + bodyHeight / 2 + cabinHeight / 2 - (0.05 * vehicleScaleFactor);
  cabinMesh.position.z = -bodyLength * 0.2;
  playerGroup.add(cabinMesh);

  const seatWidth = cabinWidth * 0.9, 
        seatHeight = 0.1 * vehicleScaleFactor, 
        seatDepth = bodyLength * 0.4;
  const seatGeometry = new THREE.BoxGeometry(seatWidth, seatHeight, seatDepth);
  const seatMesh = new THREE.Mesh(seatGeometry, seatMaterial);
  seatMesh.position.y = bodyMesh.position.y - bodyHeight/2 + seatHeight/2 + (0.1 * vehicleScaleFactor); 
  seatMesh.position.z = cabinMesh.position.z + cabinLength/2 - seatDepth/2 - (0.1 * vehicleScaleFactor);
  playerGroup.add(seatMesh);

  const frontCabinWidth = cabinWidth * 0.8, 
        frontCabinHeight = cabinHeight * 0.7, 
        frontCabinDepth = 0.3 * vehicleScaleFactor;
  const frontCabinGeometry = new THREE.BoxGeometry(frontCabinWidth, frontCabinHeight, frontCabinDepth);
  const frontCabinMesh = new THREE.Mesh(frontCabinGeometry, rickshawCabinMaterial);
  frontCabinMesh.position.y = bodyMesh.position.y + bodyHeight/2 + frontCabinHeight/2 - (0.1 * vehicleScaleFactor);
  frontCabinMesh.position.z = bodyMesh.position.z + bodyLength/2 - frontCabinDepth/2 - (0.2 * vehicleScaleFactor);
  playerGroup.add(frontCabinMesh);
  
  const handlebarHeight = 0.5 * vehicleScaleFactor, 
        handlebarRadius = 0.05 * vehicleScaleFactor;
  const handlebarGeometry = new THREE.CylinderGeometry(handlebarRadius, handlebarRadius, handlebarHeight, 8);
  const handlebarMesh = new THREE.Mesh(handlebarGeometry, metalMaterial);
  handlebarMesh.position.y = bodyMesh.position.y + bodyHeight/2 + (0.1 * vehicleScaleFactor);
  handlebarMesh.position.z = frontCabinMesh.position.z + frontCabinDepth/2 + (0.15 * vehicleScaleFactor);
  handlebarMesh.rotation.x = Math.PI / 4;
  playerGroup.add(handlebarMesh);

  const playerHeadlightRadius = 0.15 * vehicleScaleFactor, 
        playerHeadlightDepth = 0.1 * vehicleScaleFactor;
  const headlightGeometry = new THREE.CylinderGeometry(playerHeadlightRadius, playerHeadlightRadius * 0.8, playerHeadlightDepth, 16);
  const headlightMesh = new THREE.Mesh(headlightGeometry, headlightMaterial);
  headlightMesh.position.y = bodyMesh.position.y + bodyHeight / 2 - playerHeadlightRadius / 2 + (0.1 * vehicleScaleFactor);
  headlightMesh.position.z = bodyMesh.position.z + bodyLength / 2 + playerHeadlightDepth / 2;
  headlightMesh.rotation.x = Math.PI / 2; 
  playerGroup.add(headlightMesh);

  const blWheelGeometry = new THREE.CylinderGeometry(playerWheelRadius, playerWheelRadius, playerWheelThickness, playerWheelSegments);
  const blWheelMesh = new THREE.Mesh(blWheelGeometry, wheelMaterial);
  blWheelMesh.rotation.z = Math.PI / 2; 
  blWheelMesh.position.set(-bodyWidth/2 - playerWheelThickness/2 + (0.05 * vehicleScaleFactor), playerWheelYPosition, -bodyLength/2 + playerWheelRadius + (0.2 * vehicleScaleFactor));
  playerGroup.add(blWheelMesh);

  const brWheelGeometry = new THREE.CylinderGeometry(playerWheelRadius, playerWheelRadius, playerWheelThickness, playerWheelSegments);
  const brWheelMesh = new THREE.Mesh(brWheelGeometry, wheelMaterial);
  brWheelMesh.rotation.z = Math.PI / 2; 
  brWheelMesh.position.set(bodyWidth/2 + playerWheelThickness/2 - (0.05 * vehicleScaleFactor), playerWheelYPosition, -bodyLength/2 + playerWheelRadius + (0.2 * vehicleScaleFactor));
  playerGroup.add(brWheelMesh);

  const fWheelGeometry = new THREE.CylinderGeometry(playerWheelRadius, playerWheelRadius, playerWheelThickness, playerWheelSegments);
  const fWheelMesh = new THREE.Mesh(fWheelGeometry, wheelMaterial);
  fWheelMesh.rotation.z = Math.PI / 2; 
  fWheelMesh.position.set(0, playerWheelYPosition, bodyLength/2 - playerWheelRadius + (0.1 * vehicleScaleFactor));
  playerGroup.add(fWheelMesh);
  --- End of commented out geometric rickshaw --- */

  // Load Rickshaw GLTF Model
  const loader = new THREE.GLTFLoader();
  loader.load(
    'models/rickshaw/scene.gltf',
    function (gltf) {
      console.log("Raw GLTF data loaded:", gltf);
      const model = gltf.scene;
      console.log("GLTF Scene object (before transforms):", model);

      // Optional: Traverse to set properties like shadows, if needed later
      // model.traverse(function (child) {
      //   if (child.isMesh) {
      //     child.castShadow = true;
      //     child.receiveShadow = true;
      //   }
      // });

      // --- Scaling ---
      const desiredHeight = 1.5 * vehicleScaleFactor; 
      const initialBox = new THREE.Box3().setFromObject(model);
      const initialSize = new THREE.Vector3();
      initialBox.getSize(initialSize);
      console.log("Initial model size (before scaling):", initialSize);

      let scale = 1.0;
      if (initialSize.y > 0.0001) { // Avoid division by zero/infinity
        scale = desiredHeight / initialSize.y;
      } else {
        console.warn("Model initial height is zero or very small! Using default scale for height based on desiredHeight.");
        scale = desiredHeight / 1.0; // Assume a nominal initial height of 1 if actual is unusable
      }
      model.scale.set(scale, scale, scale);
      console.log("Applied scale factor:", scale);

      // --- Positioning & Centering ---
      // After scaling, get the new bounding box for centering and final positioning
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledSize = new THREE.Vector3();
      scaledBox.getSize(scaledSize);
      console.log("Scaled model size:", scaledSize);

      const center = new THREE.Vector3();
      scaledBox.getCenter(center); // Get center of the scaled bounding box
      
      // Apply offsets to the model's position to effectively move its geometric center to its own origin (0,0,0)
      model.position.x -= center.x;
      model.position.y -= center.y;
      model.position.z -= center.z;
      
      // Now that the model's geometry is centered around its local origin,
      // its new lowest point in its own Y-axis is at -scaledSize.y / 2.
      // We want to lift it so this lowest point is at groundClearance.
      const groundClearance = 0.05 * vehicleScaleFactor; // Small clearance
      model.position.y += (scaledSize.y / 2) + groundClearance;
      console.log("Final model local position set to:", model.position);

      // Clear previous player group children (e.g., old geometric parts) and add the new model
      while(playerGroup.children.length > 0){ 
        playerGroup.remove(playerGroup.children[0]); 
      }
      playerGroup.add(model); 

      // --- Width Calculation for Collision ---
      // Calculate bounding box for the playerGroup, which now contains the fully transformed model
      const finalPlayerGroupBox = new THREE.Box3().setFromObject(playerGroup);
      const finalPlayerGroupSize = new THREE.Vector3();
      finalPlayerGroupBox.getSize(finalPlayerGroupSize);
      
      console.log("Final playerGroup BoundingBox Size (for collision width):", finalPlayerGroupSize);

      if (finalPlayerGroupSize.x > 0.0001 && !isNaN(finalPlayerGroupSize.x)) {
          playerRickshawScaledBodyWidth = finalPlayerGroupSize.x;
      } else {
          playerRickshawScaledBodyWidth = 1.8; // Fallback width
          console.warn(`Calculated collision width (${finalPlayerGroupSize.x}) is invalid or zero. Using fallback width: ${playerRickshawScaledBodyWidth}`);
      }
      console.log('Rickshaw model processed. Final collision width:', playerRickshawScaledBodyWidth);

    },
    undefined, // onProgress callback (optional)
    function (error) {
      console.error('An error happened loading the rickshaw model:', error);
      // Consider re-enabling geometric player as a fallback here if needed
    }
  );

  playerGroup.position.set(0, 0, 3); 
  
  animate(); // Start the 3D animation loop
}

function animate() {
  requestAnimationFrame(animate);

  if (!gameOver) {
    score++; 
    updateScoreDisplay();
    currentObstacleSpeed = Math.min(maxObstacleSpeed, initialObstacleSpeed + (score / 5000));
    currentObstacleSpawnInterval = Math.max(minObstacleSpawnInterval, initialObstacleSpawnInterval - Math.floor(score / 1000) * 5);

    // Player Movement & Boundary
    if (playerGroup && groundMesh) {
      const moveSpeed = 0.15; // This might need adjustment if player feels too slow/fast due to scale
      if (leftPressed) playerGroup.position.x -= moveSpeed;
      if (rightPressed) playerGroup.position.x += moveSpeed;
      const playerEffectiveBodyWidth = playerRickshawScaledBodyWidth; // Use the new global variable
      const playerHalfEffectiveWidth = playerEffectiveBodyWidth / 2;
      const roadBoundary = groundMesh.geometry.parameters.width / 2 - playerHalfEffectiveWidth;
      playerGroup.position.x = Math.max(-roadBoundary, Math.min(roadBoundary, playerGroup.position.x));
    }

    // Road Texture Scrolling
    if (groundMesh && groundMesh.material && groundMesh.material.map) {
      groundMesh.material.map.offset.y -= roadScrollSpeed;
    }

    // Scenery Spawning
    scenerySpawnTimer++;
    if (scenerySpawnTimer > scenerySpawnInterval) {
        spawnSceneryObject();
        scenerySpawnTimer = 0;
    }

    // Scenery Movement & Despawning
    const sceneryZSpeed = currentObstacleSpeed * scenerySpeedFactor; 
    for (let i = sceneryObjects.length - 1; i >= 0; i--) {
        const scenery = sceneryObjects[i];
        scenery.position.z += sceneryZSpeed; 
        if (scenery.position.z > camera.position.z + 30) { 
            scene.remove(scenery);
            sceneryObjects.splice(i, 1);
        }
    }

    // Obstacle Spawning
    obstacleSpawnTimer++;
    if (obstacleSpawnTimer > currentObstacleSpawnInterval) {
      spawnObstacle();
      obstacleSpawnTimer = 0;
    }

    // Obstacle Movement, Despawning & Collision Detection
    const playerBox = new THREE.Box3();
    if (playerGroup) {
        playerBox.setFromObject(playerGroup);
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.position.z += currentObstacleSpeed;
      if (obstacle.position.z > camera.position.z + 20) {
        scene.remove(obstacle);
        obstacles.splice(i, 1);
        continue;
      }
      if (playerGroup) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);
        if (playerBox.intersectsBox(obstacleBox)) {
          triggerGameOver();
          break; 
        }
      }
    }
  } 

  // Camera Follow Logic
  if (playerGroup) {
    const targetCameraX = playerGroup.position.x;
    camera.position.x += (targetCameraX - camera.position.x) * cameraFollowSpeed;
    const lookAtPosition = new THREE.Vector3(playerGroup.position.x, playerGroup.position.y + 1, playerGroup.position.z - 2);
    camera.lookAt(lookAtPosition);
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
    const lateralOffset = groundMesh.geometry.parameters.width / 2 + 5 + Math.random() * 10; // Spawn 5-15 units away from road edge
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

    if (playerGroup) {
        playerGroup.position.set(0, 0, 3);
        leftPressed = false; 
        rightPressed = false;
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
        scene.remove(obstacles[i]);
    }
    obstacles = [];
    obstacleSpawnTimer = 0;

    // Clear existing scenery objects
    for (let i = sceneryObjects.length - 1; i >= 0; i--) {
        scene.remove(sceneryObjects[i]);
        // Consider disposing geometry/material if not shared and created uniquely
    }
    sceneryObjects = [];
    scenerySpawnTimer = 0;

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
