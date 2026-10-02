import {
  AmbientLight,
  DirectionalLight,
  ExtrudeGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  WebGLRenderer,
} from "three";

// The keys the game uses, which shouldn't scroll the page.
const GAME_KEYS = new Set([
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);
// Above 2, the extra pixels rarely justify their cost.
const MAX_PIXEL_RATIO = 2;

// The Arcadible mark: a chevron, 8 units wide and 6 tall, centered.
const MARK = [
  [0, -3],
  [4, 3],
  [2, 3],
  [0, 0],
  [-2, 3],
  [-4, 3],
];
// The resting spin, in radians per second.
const SPEED = Math.PI / 2;
// The fastest a flick spins it: a turn a second.
const MAX_SPEED = Math.PI * 2;
// How far a drag turns the mark, in radians per CSS pixel.
const DRAG = Math.PI / 200;
// How quickly a flick eases back to the resting spin, per second.
const FRICTION = 1.5;
// A flick spins at this fraction of the drag's speed.
const FLICK = 0.1;
// A drag held still this long before release, in milliseconds, isn't a flick.
const FLICK_MS = 100;

const canvas = document.getElementById("main");
const renderer = new WebGLRenderer({ canvas, antialias: true });
const scene = new Scene();
const camera = new PerspectiveCamera(50, 1, 0.1, 100);

// Three.js's y points up, so the mark is flipped.
const shape = new Shape(MARK.map(([x, y]) => ({ x, y: -y })));
const geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
geometry.center();

const mark = new Mesh(geometry, new MeshStandardMaterial({ color: "white" }));
const light = new DirectionalLight("white", 2);
light.position.set(1, 2, 3);
scene.add(mark, light, new AmbientLight("white", 1));

let angle = 0;
let velocity = SPEED;
let direction = 1;
let drag = null;
let last = 0;
let paused = false;

// The game's keys reverse the spin, and don't scroll the page.
function press(e) {
  if (!GAME_KEYS.has(e.code)) return;
  e.preventDefault();
  if (!e.repeat) direction = -direction;
}

// Dragging turns the mark. A flick keeps its speed and direction after
// release, then eases back to the resting spin.
function grab(e) {
  canvas.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, time: e.timeStamp, x: e.clientX };
  velocity = 0;
}

function turn(e) {
  if (e.pointerId !== drag?.id) return;
  const delta = (e.clientX - drag.x) * DRAG;
  const dt = (e.timeStamp - drag.time) / 1000;
  angle += delta;
  // Smoothed, since a single move is noisy.
  if (dt > 0) velocity = 0.8 * (delta / dt) + 0.2 * velocity;
  drag.time = e.timeStamp;
  drag.x = e.clientX;
}

function release(e) {
  if (e.pointerId !== drag?.id) return;
  if (e.timeStamp - drag.time > FLICK_MS) velocity = 0;
  velocity = Math.max(-MAX_SPEED, Math.min(velocity * FLICK, MAX_SPEED));
  if (velocity) direction = Math.sign(velocity);
  drag = null;
}

function draw() {
  mark.rotation.y = angle;
  renderer.render(scene, camera);
}

// Size the canvas to its displayed size, in device pixels, and keep the mark
// in view when the screen is taller than it is wide.
function resize() {
  const { clientWidth: width, clientHeight: height } = canvas;
  const aspect = width / height;
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(width, height, false);
  camera.aspect = aspect;
  camera.position.z = 20 / Math.min(aspect, 1);
  camera.updateProjectionMatrix();
}

// Step by the time since the last frame, so the speed is the same at any
// refresh rate, and skip ahead after a long pause.
function frame(time) {
  const dt = Math.min((time - last) / 1000, 0.1);
  last = time;
  if (!paused && !drag) {
    velocity += (SPEED * direction - velocity) * Math.min(FRICTION * dt, 1);
    angle += velocity * dt;
  }
  draw();
  requestAnimationFrame(frame);
}

addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("keydown", press);
document.addEventListener("visibilitychange", () => (paused = document.hidden));
canvas.addEventListener("pointerdown", grab);
canvas.addEventListener("pointermove", turn);
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(frame);
