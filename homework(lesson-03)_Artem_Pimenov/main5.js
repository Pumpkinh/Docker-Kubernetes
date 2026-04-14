import * as THREE from "three";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

// центр (чорна діра)
const core = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
scene.add(core);

// particles
const geometry = new THREE.BufferGeometry();
const count = 4000;
const positions = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  const r = Math.random() * 8;
  const angle = Math.random() * Math.PI * 2;

  positions[i * 3] = Math.cos(angle) * r;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
  positions[i * 3 + 2] = Math.sin(angle) * r;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: 0x9966ff,
  size: 0.04,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

function animate() {
  requestAnimationFrame(animate);

  particles.rotation.y += 0.01;

  renderer.render(scene, camera);
}

animate();
