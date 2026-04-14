import * as THREE from "three";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

const starsGeometry = new THREE.BufferGeometry();
const count = 5000;

const positions = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  const r = Math.random() * 5;
  const angle = r * 5;

  positions[i * 3] = Math.cos(angle) * r;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
  positions[i * 3 + 2] = Math.sin(angle) * r;
}

starsGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3)
);

const starsMaterial = new THREE.PointsMaterial({
  color: 0x88ccff,
  size: 0.05,
});

const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

function animate() {
  requestAnimationFrame(animate);

  stars.rotation.y += 0.002;

  renderer.render(scene, camera);
}

animate();
