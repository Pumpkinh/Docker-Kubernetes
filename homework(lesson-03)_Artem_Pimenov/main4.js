import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

// grid
const size = 50;
const divisions = 50;

const grid = new THREE.GridHelper(size, divisions, 0xff00ff, 0x4444ff);
scene.add(grid);

// light
const light = new THREE.PointLight(0xffffff, 2);
light.position.set(0, 10, 10);
scene.add(light);

function animate() {
  requestAnimationFrame(animate);

  grid.position.z += 0.05;

  if (grid.position.z > 1) {
    grid.position.z = 0;
  }

  renderer.render(scene, camera);
}

animate();
