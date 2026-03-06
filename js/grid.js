/**
 * ABEND — Perspective Grid + Falling Tetrominoes Background
 * Matches the in-game SynthwaveBackgroundScene:
 *   - Grid fades from magenta (horizon) to cyan (viewer)
 *   - Falling tetrominoes with slow rotation and drift
 */
(function () {
  'use strict';

  var canvas = document.getElementById('grid-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  // --- Brand colors ---
  // Horizon: magenta  rgb(179, 25, 115)  approx (0.7, 0.1, 0.45)
  // Viewer:  cyan     rgb(0, 153, 179)   approx (0.0, 0.6, 0.7)
  var HORIZON_R = 179, HORIZON_G = 25,  HORIZON_B = 115;
  var VIEWER_R  = 0,   VIEWER_G  = 153, VIEWER_B  = 179;

  // Tetromino colors (matching SynthwaveBackgroundScene)
  var PIECE_COLORS = [
    'rgba(0, 255, 255, A)',    // cyan
    'rgba(255, 0, 255, A)',    // magenta
    'rgba(255, 102, 0, A)',    // orange
    'rgba(102, 255, 102, A)',  // green
    'rgba(255, 255, 77, A)',   // yellow
    'rgba(153, 51, 255, A)',   // purple
    'rgba(255, 77, 77, A)',    // red
  ];

  // 7 standard tetromino shapes (row-major, origin top-left)
  var SHAPES = [
    [[1,1,1,1]],                          // I
    [[1,1],[1,1]],                         // O
    [[0,1,0],[1,1,1]],                     // T
    [[0,1,1],[1,1,0]],                     // S
    [[1,1,0],[0,1,1]],                     // Z
    [[1,0],[1,0],[1,1]],                   // L
    [[0,1],[0,1],[1,1]],                   // J
  ];

  // --- Config ---
  var HORIZON_Y_FRAC = 0.35;
  var VERTICAL_LINES = 20;
  var HORIZONTAL_COUNT = 40;
  var GRID_ALPHA_CORE = 0.35;
  var GRID_ALPHA_GLOW = 0.12;

  var MAX_PIECES = 13;
  var SPAWN_INTERVAL = 2000; // ms
  var BLOCK_SIZE = 6;
  var PIECE_SPEED_MIN = 15;
  var PIECE_SPEED_MAX = 25;
  var PIECE_ALPHA_MIN = 0.25;
  var PIECE_ALPHA_MAX = 0.40;

  var w, h, dpr;
  var pieces = [];
  var lastSpawn = 0;
  var animId;

  // --- Helpers ---
  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

  function lerpColor(t) {
    // t=0 → horizon (magenta), t=1 → viewer (cyan)
    var clamped = Math.max(0, Math.min(1, t));
    var r = HORIZON_R + (VIEWER_R - HORIZON_R) * clamped;
    var g = HORIZON_G + (VIEWER_G - HORIZON_G) * clamped;
    var b = HORIZON_B + (VIEWER_B - HORIZON_B) * clamped;
    return [r | 0, g | 0, b | 0];
  }

  // --- Resize ---
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // --- Tetrominoes ---
  function spawnPiece(randomY) {
    var shapeIdx = randInt(0, SHAPES.length - 1);
    var colorIdx = randInt(0, PIECE_COLORS.length - 1);
    var alpha = rand(PIECE_ALPHA_MIN, PIECE_ALPHA_MAX);
    var speed = rand(PIECE_SPEED_MIN, PIECE_SPEED_MAX);
    var piece = {
      shape: SHAPES[shapeIdx],
      color: PIECE_COLORS[colorIdx].replace('A', alpha.toFixed(2)),
      x: rand(0, w),
      y: randomY ? rand(-h * 0.2, h * 0.8) : -40,
      speed: speed,
      driftX: rand(-20, 20),
      driftDuration: (h + 100) / speed,
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-0.3, 0.3),
      elapsed: 0,
    };
    return piece;
  }

  function initPieces() {
    pieces = [];
    for (var i = 0; i < 5; i++) {
      pieces.push(spawnPiece(true));
    }
  }

  function drawPiece(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    var shape = p.shape;
    var rows = shape.length;
    var cols = shape[0].length;
    var ox = -(cols * BLOCK_SIZE) / 2;
    var oy = -(rows * BLOCK_SIZE) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (shape[r][c]) {
          ctx.fillRect(ox + c * BLOCK_SIZE, oy + r * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }
      }
    }
    ctx.restore();
  }

  // --- Grid Drawing ---
  // Use a continuously increasing scroll value — no modulo reset.
  // Each horizontal line is placed at a perspective-mapped Y using a phase
  // that wraps smoothly per-line.
  var scrollAccum = 0;

  function drawGrid(dt) {
    scrollAccum += dt * 0.08; // slow continuous scroll

    var horizonPx = h * HORIZON_Y_FRAC;
    var groundH = h - horizonPx;
    var vanishX = w * 0.5;

    // --- Horizontal lines ---
    ctx.lineWidth = 1;
    for (var i = 0; i < HORIZONTAL_COUNT; i++) {
      // Each line has a base phase; scrollAccum offsets them continuously.
      // Modulo per-line ensures each wraps individually (no global reset).
      var phase = ((i / HORIZONTAL_COUNT) + scrollAccum) % 1;
      if (phase < 0) phase += 1;

      // Exponential perspective mapping
      var perspT = phase * phase;
      var y = horizonPx + perspT * groundH;

      // Fade near horizon
      var fade = Math.min(1, perspT / 0.12);
      if (fade < 0.01) continue;

      var rgb = lerpColor(perspT);
      var isMajor = (i % 5 === 0);
      var alpha = (isMajor ? GRID_ALPHA_CORE : GRID_ALPHA_GLOW) * fade;

      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // --- Vertical lines ---
    ctx.lineWidth = 1;
    for (var v = -VERTICAL_LINES; v <= VERTICAL_LINES; v++) {
      var spread = v / VERTICAL_LINES;
      var bottomX = vanishX + spread * w * 0.9;

      var isMajorV = (v % 5 === 0);
      var baseAlpha = isMajorV ? 0.18 : 0.06;
      var centerFade = 1 - Math.abs(spread) * 0.4;

      // Color at midpoint of gradient
      var midRgb = lerpColor(0.5);
      ctx.strokeStyle = 'rgba(' + midRgb[0] + ',' + midRgb[1] + ',' + midRgb[2] + ',' + (baseAlpha * centerFade).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(vanishX, horizonPx);
      ctx.lineTo(bottomX, h);
      ctx.stroke();
    }

    // --- Horizon glow ---
    var hRgb = lerpColor(0);
    var grad = ctx.createLinearGradient(0, horizonPx - 2, 0, horizonPx + 40);
    grad.addColorStop(0, 'rgba(' + hRgb[0] + ',' + hRgb[1] + ',' + hRgb[2] + ', 0.10)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonPx - 2, w, 42);

    ctx.strokeStyle = 'rgba(' + hRgb[0] + ',' + hRgb[1] + ',' + hRgb[2] + ', 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonPx);
    ctx.lineTo(w, horizonPx);
    ctx.stroke();
  }

  // --- Main Loop ---
  var lastTime = 0;

  function draw(time) {
    var dt = lastTime ? (time - lastTime) / 1000 : 0.016;
    if (dt > 0.1) dt = 0.016; // cap after tab switch
    lastTime = time;

    ctx.clearRect(0, 0, w, h);

    // Grid
    drawGrid(dt);

    // Tetrominoes
    // Spawn
    if (pieces.length < MAX_PIECES && time - lastSpawn > SPAWN_INTERVAL) {
      pieces.push(spawnPiece(false));
      lastSpawn = time;
    }

    // Update & draw
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
      p.elapsed += dt;
      p.y += p.speed * dt;
      p.x += (p.driftX / p.driftDuration) * dt;
      p.rotation += p.rotationSpeed * dt;

      if (p.y > h + 60) {
        // Recycle to top
        var shapeIdx = randInt(0, SHAPES.length - 1);
        var colorIdx = randInt(0, PIECE_COLORS.length - 1);
        var alpha = rand(PIECE_ALPHA_MIN, PIECE_ALPHA_MAX);
        p.shape = SHAPES[shapeIdx];
        p.color = PIECE_COLORS[colorIdx].replace('A', alpha.toFixed(2));
        p.x = rand(0, w);
        p.y = -40;
        p.speed = rand(PIECE_SPEED_MIN, PIECE_SPEED_MAX);
        p.driftX = rand(-20, 20);
        p.driftDuration = (h + 100) / p.speed;
        p.rotation = rand(0, Math.PI * 2);
        p.rotationSpeed = rand(-0.3, 0.3);
        p.elapsed = 0;
      }

      drawPiece(p);
    }

    animId = requestAnimationFrame(draw);
  }

  // --- Lifecycle ---
  window.addEventListener('resize', function () {
    resize();
    // Re-spread pieces across new width
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].x > w) pieces[i].x = rand(0, w);
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(animId);
      lastTime = 0;
    } else {
      animId = requestAnimationFrame(draw);
    }
  });

  resize();
  initPieces();
  animId = requestAnimationFrame(draw);
})();
