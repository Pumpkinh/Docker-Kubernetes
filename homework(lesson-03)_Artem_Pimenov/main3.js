import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const scene = new THREE.Scene();

// 🎥 Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.z = 10;

// 🖥 Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

// 🌟 COMPOSER (BLOOM CORE)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,  // strength
  0.4,  // radius
  0.85  // threshold
);

composer.addPass(bloomPass);

// ☀️ Sun (яскравий)
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffaa00 })
);
scene.add(sun);

// 💡 Light
const light = new THREE.PointLight(0xffffff, 2);
scene.add(light);

// 🪐 Planets
const planets = [];

function createPlanet(size, color, distance, speed) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 32, 32),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
    })
  );

  scene.add(mesh);

  planets.push({
    mesh,
    distance,
    speed,
    angle: Math.random() * Math.PI * 2,
  });
}

createPlanet(0.4, 0x66ccff, 3, 0.02);
createPlanet(0.6, 0xff6699, 5, 0.015);
createPlanet(0.7, 0x66ff66, 7, 0.01);
createPlanet(0.5, 0xff9966, 9, 0.008);

// 🚀 animation
function animate() {
  requestAnimationFrame(animate);

  sun.rotation.y += 0.002;

  planets.forEach((p) => {
    p.angle += p.speed;

    p.mesh.position.x = Math.cos(p.angle) * p.distance;
    p.mesh.position.z = Math.sin(p.angle) * p.distance;

    p.mesh.rotation.y += 0.02;
  });

  composer.render(); // ⚠️ важливо: НЕ renderer.render
}

animate();

// 📱 resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});