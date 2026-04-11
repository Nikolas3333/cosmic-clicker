
/* cosmic_main_v149
РЕАЛЬНЫЙ АНГАР
*/

import * as THREE from 'three';

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// СВЕТ
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(0,50,50);
scene.add(light);

// ПОЛ
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(400,400),
  new THREE.MeshStandardMaterial({color:0x111111})
);
floor.rotation.x = -Math.PI/2;
scene.add(floor);

// СТЕНЫ / АНГАР
const walls = new THREE.Mesh(
  new THREE.BoxGeometry(400,120,400),
  new THREE.MeshBasicMaterial({color:0x050510, wireframe:false})
);
walls.position.y = 60;
scene.add(walls);

// СТОЛЫ И ПЛАТФОРМЫ
function createDock(x,z){
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(10,2,10),
    new THREE.MeshStandardMaterial({color:0x222244})
  );
  table.position.set(x,1,z);
  scene.add(table);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3,3,1,32),
    new THREE.MeshStandardMaterial({color:0x00ffff})
  );
  platform.position.set(0,1.5,0);
  table.add(platform);

  return {table, platform};
}

let docks = [];

// 10 слева
for(let i=0;i<10;i++){
  docks.push(createDock(-40, i*15 - 70));
}

// 10 справа
for(let i=0;i<10;i++){
  docks.push(createDock(40, i*15 - 70));
}

// КОРАБЛЬ (простой)
const ship = new THREE.Mesh(
  new THREE.BoxGeometry(3,1,6),
  new THREE.MeshStandardMaterial({color:0xffaa00})
);

docks[0].platform.add(ship);
ship.position.y = 1;

// КАМЕРА
camera.position.set(0,30,120);

function animate(){
  requestAnimationFrame(animate);
  ship.rotation.y += 0.01;
  renderer.render(scene,camera);
}

animate();
