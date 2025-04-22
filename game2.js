// canvas un spēles iestatījumi
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = 600;
const HEIGHT = 600;
const BORDER_PADDING = 40;
const CIRCLE_RADIUS = 10;
const MAX_REFLECTIONS = 10;
const MAX_LASER_DISTANCE = 3000;
const MIRROR_WIDTH = 30;
const MIRROR_HEIGHT = 3;
const REFLECT_OFFSET = 2;

let x = WIDTH / 2;
let y = HEIGHT / 2;
let angle = Math.random() * 2 * Math.PI;
let isDragging = false;

const TRIGGER_RADIUS = 10;  // Rādiuss, kur lāzers apstājas un sāk rotēt spogulis

function generateMirrorPosition(existingMirrors) {
  let mx, my, tooClose;
  do {
    mx = BORDER_PADDING + Math.random() * (WIDTH - 2 * BORDER_PADDING);
    my = BORDER_PADDING + Math.random() * (HEIGHT - 2 * BORDER_PADDING);
    tooClose = false;
    if (Math.hypot(mx - x, my - y) < 80) tooClose = true;
    for (const mirror of existingMirrors) {
      if (Math.hypot(mx - mirror.x, my - mirror.y) < 60) {
        tooClose = true;
        break;
      }
    }
  } while (tooClose);
  return { x: mx, y: my, angle: Math.random() * 2 * Math.PI, rotating: false };
}

const mirrors = [];
while (mirrors.length < 9) {
  mirrors.push(generateMirrorPosition(mirrors));
}

let mirrorDraggingIndex = -1;
let rotatingMirrorIndex = -1;
let rotating = false;

function drawCircle() {
  ctx.beginPath();
  ctx.arc(x, y, CIRCLE_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle = "black";
  ctx.fill();
}

function drawMirrors() {
  for (const mirror of mirrors) {
    ctx.save();
    ctx.translate(mirror.x, mirror.y);
    ctx.rotate(mirror.angle);
    ctx.fillStyle = "black";
    ctx.fillRect(-MIRROR_WIDTH / 2, -MIRROR_HEIGHT / 2, MIRROR_WIDTH, MIRROR_HEIGHT);
    ctx.restore();
  }
}

function reflect(angle, boundary) {
  if (boundary === "horizontal") return -angle;
  if (boundary === "vertical") return Math.PI - angle;
  return angle;
}

function reflectByNormal(incidence, normal) {
  const dot = incidence.x * normal.x + incidence.y * normal.y;
  return {
    x: incidence.x - 2 * dot * normal.x,
    y: incidence.y - 2 * dot * normal.y,
  };
}

function mirrorIntersection(px, py, dx, dy, mirror) {
  const cos = Math.cos(mirror.angle);
  const sin = Math.sin(mirror.angle);

  const ex = mirror.x + cos * MIRROR_WIDTH / 2;
  const ey = mirror.y + sin * MIRROR_WIDTH / 2;
  const sx = mirror.x - cos * MIRROR_WIDTH / 2;
  const sy = mirror.y - sin * MIRROR_WIDTH / 2;

  const rdx = dx;
  const rdy = dy;
  const sdx = ex - sx;
  const sdy = ey - sy;

  const denominator = rdx * sdy - rdy * sdx;
  if (Math.abs(denominator) < 1e-6) return null;

  const t = ((sx - px) * sdy - (sy - py) * sdx) / denominator;
  const u = ((sx - px) * rdy - (sy - py) * rdx) / denominator;

  if (t >= 0 && u >= 0 && u <= 1) {
    const totalLen = Math.hypot(dx, dy);
    if (totalLen < 1e-6) return null;

    const shift = Math.min(REFLECT_OFFSET / totalLen, t * 0.9);
    const ix = px + rdx * (t - shift);
    const iy = py + rdy * (t - shift);

    let normal = { x: -sdy, y: sdx };
    const len = Math.hypot(normal.x, normal.y);
    normal.x /= len;
    normal.y /= len;

    const inDir = { x: dx, y: dy };
    const dot = inDir.x * normal.x + inDir.y * normal.y;
    if (dot > 0) {
      normal.x *= -1;
      normal.y *= -1;
    }

    return {
      point: { x: ix, y: iy },
      normal,
      distance: (t - shift) * totalLen
    };
  }

  return null;
}

function drawLaser() {
  let currX = x;
  let currY = y;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let totalDistance = 0;

  for (let i = 0; i < MAX_REFLECTIONS && totalDistance < MAX_LASER_DISTANCE; i++) {
    let reflectInfo = null;
    let mirrorDist = Infinity;
    let closestMirror = null;

    for (const mirror of mirrors) {
      const info = mirrorIntersection(currX, currY, dx, dy, mirror);
      if (info && info.distance < mirrorDist) {
        reflectInfo = info;
        mirrorDist = info.distance;
        closestMirror = mirror;
      }
    }

    let boundary = null;
    let boundDist = Infinity;
    let tx, ty;

    if (dx < 0) {
      tx = (0 - currX) / dx;
      if (tx < boundDist) {
        boundDist = tx;
        boundary = "vertical";
      }
    } else if (dx > 0) {
      tx = (WIDTH - currX) / dx;
      if (tx < boundDist) {
        boundDist = tx;
        boundary = "vertical";
      }
    }

    if (dy < 0) {
      ty = (0 - currY) / dy;
      if (ty < boundDist) {
        boundDist = ty;
        boundary = "horizontal";
      }
    } else if (dy > 0) {
      ty = (HEIGHT - currY) / dy;
      if (ty < boundDist) {
        boundDist = ty;
        boundary = "horizontal";
      }
    }

    let nextX, nextY;
    if (mirrorDist < boundDist) {
      nextX = reflectInfo.point.x;
      nextY = reflectInfo.point.y;

      const hitDistFromCenter = Math.hypot(
        reflectInfo.point.x - closestMirror.x,
        reflectInfo.point.y - closestMirror.y
      );

      if (!rotating && hitDistFromCenter <= TRIGGER_RADIUS) {
        ctx.strokeStyle = `rgba(255, 0, 0, ${1 - totalDistance / MAX_LASER_DISTANCE})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currX, currY);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();

        closestMirror.rotating = true;
        rotatingMirrorIndex = mirrors.indexOf(closestMirror);
        rotating = true;
        return; // apstādinām lāzera ceļu
      }
    } else {
      nextX = currX + dx * boundDist;
      nextY = currY + dy * boundDist;
    }

    const segLength = Math.hypot(nextX - currX, nextY - currY);
    if (totalDistance + segLength > MAX_LASER_DISTANCE) {
      const ratio = (MAX_LASER_DISTANCE - totalDistance) / segLength;
      nextX = currX + (nextX - currX) * ratio;
      nextY = currY + (nextY - currY) * ratio;
    }

    ctx.strokeStyle = `rgba(255, 0, 0, ${1 - totalDistance / MAX_LASER_DISTANCE})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currX, currY);
    ctx.lineTo(nextX, nextY);
    ctx.stroke();

    totalDistance += segLength;
    currX = nextX;
    currY = nextY;

    if (totalDistance >= MAX_LASER_DISTANCE) break;

    if (mirrorDist < boundDist) {
      const reflected = reflectByNormal({ x: dx, y: dy }, reflectInfo.normal);
      dx = reflected.x;
      dy = reflected.y;
    } else {
      const angleDir = Math.atan2(dy, dx);
      const reflectedAngle = reflect(angleDir, boundary);
      dx = Math.cos(reflectedAngle);
      dy = Math.sin(reflectedAngle);
    }
  }
}

function drawGame() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawCircle();
  drawMirrors();
  drawLaser();
}

function autoRotateLaser() {
  if (!rotating) angle += 0.002;
  drawGame();
  if (rotatingMirrorIndex !== -1) mirrors[rotatingMirrorIndex].angle += 0.002;
  requestAnimationFrame(autoRotateLaser);
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const cx = mouseX - x;
  const cy = mouseY - y;
  if (Math.hypot(cx, cy) <= 60) {
    isDragging = true;
    return;
  }

  for (let i = 0; i < mirrors.length; i++) {
    const mdx = mouseX - mirrors[i].x;
    const mdy = mouseY - mirrors[i].y;
    if (Math.hypot(mdx, mdy) < 30) {
      mirrorDraggingIndex = i;
      return;
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (isDragging) {
    angle = Math.atan2(mouseY - y, mouseX - x);
    drawGame();
  } else if (mirrorDraggingIndex !== -1) {
    const mirror = mirrors[mirrorDraggingIndex];
    mirror.angle = Math.atan2(mouseY - mirror.y, mouseX - mirror.x);
    drawGame();
  }
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
  mirrorDraggingIndex = -1;
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
  mirrorDraggingIndex = -1;
});

autoRotateLaser();
