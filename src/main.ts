// src/main.ts
import * as THREE from "three";
import {
  Body,
  Box as CBox,
  Material,
  Vec3,
  World,
  ContactMaterial,
} from "cannon-es";

const TARGET_SCORE = 10;
const ROUND_TIME = 30; // seconds


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020416);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(4, 8, 2);
scene.add(dirLight);

const world = new World({
  gravity: new Vec3(0, -3, 0), // low gravity for "space"
});

const groundMat = new Material("ground");
const playerMat = new Material("player");

const groundPlayerContact = new ContactMaterial(groundMat, playerMat, {
  friction: 0.4,
  restitution: 0.3,
});
world.addContactMaterial(groundPlayerContact);

function createBox(
  size: Vec3,
  position: Vec3,
  mass: number,
  color: number,
  material?: Material
): { body: Body; mesh: THREE.Mesh } {
  const shape = new CBox(size);
  const body = new Body({
    mass,
    shape,
    position,
    material,
  });

  world.addBody(body);

  const geo = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  return { body, mesh };
}

const ground = createBox(
  new Vec3(10, 0.5, 10),
  new Vec3(0, -0.5, 0),
  0,
  0x222244,
  groundMat
);


createBox(new Vec3(0.5, 2, 10), new Vec3(-10, 2, 0), 0, 0x111122);
createBox(new Vec3(0.5, 2, 10), new Vec3(10, 2, 0), 0, 0x111122);
createBox(new Vec3(10, 2, 0.5), new Vec3(0, 2, -10), 0, 0x111122);
createBox(new Vec3(10, 2, 0.5), new Vec3(0, 2, 10), 0, 0x111122);


const playerStart = new Vec3(0, 1, 5);
const playerSize = new Vec3(0.5, 0.5, 0.5);

const player = createBox(
  playerSize,
  playerStart.clone(),
  1,
  0x33ccff,
  playerMat
);


const buttonSize = new Vec3(0.5, 0.25, 0.5);
const buttonPos = new Vec3(0, 0.25, -5);

const button = createBox(buttonSize, buttonPos.clone(), 0, 0xff3366, groundMat);


(button.mesh.material as THREE.MeshStandardMaterial).emissive =
  new THREE.Color(0xff3366);


const hudScore = document.getElementById("score")!;
const hudTime = document.getElementById("time")!;
const messageBox = document.getElementById("message")!;

let score = 0;
let remainingTime = ROUND_TIME;
let lastTime = performance.now() / 1000;
let gameOver = false;
let hitCooldown = 0;

const keys: Record<string, boolean> = {};

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

function update(dt: number) {
  if (gameOver) return;

  // countdown timer
  remainingTime -= dt;
  if (remainingTime < 0) remainingTime = 0;
  hudTime.textContent = remainingTime.toFixed(1);

  // movement: WASD applies forces
  const moveForce = 10;
  const force = new Vec3(0, 0, 0);

  if (keys["w"]) force.z -= moveForce;
  if (keys["s"]) force.z += moveForce;
  if (keys["a"]) force.x -= moveForce;
  if (keys["d"]) force.x += moveForce;

  if (force.lengthSquared() > 0) {
    player.body.applyForce(force, player.body.position);
  }

  // small jump with space
  if (keys[" "]) {
    // tiny impulse upward
    player.body.applyImpulse(new Vec3(0, 2, 0), player.body.position);
  }

  world.step(1 / 60, dt);

  [player, button, ground].forEach((obj) => {
    obj.mesh.position.set(
      obj.body.position.x,
      obj.body.position.y,
      obj.body.position.z
    );
    obj.mesh.quaternion.set(
      obj.body.quaternion.x,
      obj.body.quaternion.y,
      obj.body.quaternion.z,
      obj.body.quaternion.w
    );
  });


  hitCooldown -= dt;
  const distance = player.body.position.vsub(button.body.position).length();

  if (distance < 1 && hitCooldown <= 0 && !gameOver) {
    score += 1;
    hudScore.textContent = String(score);
    hitCooldown = 0.3;


    button.mesh.scale.set(1, 0.6, 1);
    setTimeout(() => {
      button.mesh.scale.set(1, 1, 1);
    }, 100);

    // win condition
    if (score >= TARGET_SCORE) {
      endGame(true);
    }
  }

  // lose condition
  if (remainingTime <= 0 && !gameOver && score < TARGET_SCORE) {
    endGame(false);
  }
}

function endGame(success: boolean) {
  gameOver = true;
  messageBox.style.display = "block";
  messageBox.textContent = success
    ? `MISSION COMPLETE! Score: ${score}`
    : `MISSION FAILED. Score: ${score}`;

  // freeze the player
  player.body.velocity.setZero();
  player.body.angularVelocity.setZero();
}

// main render loop
function loop() {
  const now = performance.now() / 1000;
  const dt = now - lastTime;
  lastTime = now;

  update(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

loop();

// handle resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
