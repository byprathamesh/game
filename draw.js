// --- Main Draw Function ---
function draw(dt) {
  document.getElementById('score').textContent = score + ' m';
  document.getElementById('bestScore').textContent = bestScore;

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
