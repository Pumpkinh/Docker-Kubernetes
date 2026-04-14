import * as THREE from "three";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

const count = 3000;
const geometry = new THREE.BufferGeometry();

const positions = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 20;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
  positions[i * 3 + 2] = Math.random() * -50;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const material = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.05,
});

const stars = new THREE.Points(geometry, material);
scene.add(stars);

function animate() {
  requestAnimationFrame(animate);

  const pos = geometry.attributes.position;

  for (let i = 0; i < count; i++) {
    pos.array[i * 3 + 2] += 0.5;

    if (pos.array[i * 3 + 2] > 1) {
      pos.array[i * 3 + 2] = -50;
    }
  }

  pos.needsUpdate = true;

  renderer.render(scene, camera);
}

animate();
