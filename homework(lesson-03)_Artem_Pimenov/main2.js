import * as THREE from "three";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

const count = 2000;
const geometry = new THREE.BufferGeometry();

const positions = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 2;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: 0xff66cc,
  size: 0.03,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

function animate() {
  requestAnimationFrame(animate);

  particles.rotation.x += 0.002;
  particles.rotation.y += 0.002;

  renderer.render(scene, camera);
}

animate();
