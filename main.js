// Cosmic Clicker - Hangar Prototype v201
// Standalone Three.js hangar scene built from primitives.
// Designed as a registration-free replacement for downloaded assets.

(function () {
  const HANGAR = {
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    root: null,
    interactive: [],
    colliders: [],
    doors: [],
    shipStands: [],
    modulePods: [],
    keys: {},
    yaw: 0,
    pitch: 0,
    moveSpeed: 18,
    sprintSpeed: 28,
    lookSpeed: 0.0023,
    playerHeight: 1.72,
    playerRadius: 0.65,
    velocityY: 0,
    gravity: -28,
    grounded: true,
    pointerLocked: false,
    useOrbitFallback: false,
    hoverTarget: null,
    selectedShip: 0,
    selectedModule: 0,
    currentRoom: 'hangar',
    ui: {
      root: null,
      hint: null,
      room: null,
      ship: null,
      module: null,
      stats: null,
      help: null,
      crosshair: null
    },
    roomAnchors: {},
    tmpVecA: new THREE.Vector3(),
    tmpVecB: new THREE.Vector3(),
    tmpBox: new THREE.Box3(),
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(0, 0),
    mouseDown: false
  };

  const SHIP_DATA = [
    { name: 'Falcon NX', hp: 120, speed: 72, energy: 85, color: 0x5dd6ff },
    { name: 'Raptor VX', hp: 150, speed: 62, energy: 92, color: 0xff7e57 },
    { name: 'Orion MK-II', hp: 180, speed: 55, energy: 110, color: 0x9d7bff }
  ];

  const MODULE_DATA = [
    { name: 'Лазерный модуль', bonus: '+12 урон', color: 0x58d7ff },
    { name: 'Щитовой модуль', bonus: '+18 защита', color: 0x7dffb2 },
    { name: 'Энергоядро', bonus: '+25 энергия', color: 0xffcc55 },
    { name: 'Двигатель импульса', bonus: '+14 скорость', color: 0xff7eff }
  ];

  function initHangarPrototype() {
    const canvas = document.getElementById('game-canvas') || document.getElementById('bg') || null;
    HANGAR.scene = new THREE.Scene();
    HANGAR.scene.background = new THREE.Color(0x05070d);
    HANGAR.scene.fog = new THREE.Fog(0x05070d, 70, 290);

    HANGAR.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1200);
    HANGAR.camera.position.set(0, HANGAR.playerHeight, 18);
    HANGAR.camera.rotation.order = 'YXZ';

    HANGAR.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas || undefined });
    HANGAR.renderer.setSize(window.innerWidth, window.innerHeight);
    HANGAR.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    HANGAR.renderer.shadowMap.enabled = true;
    HANGAR.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    HANGAR.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    HANGAR.renderer.toneMappingExposure = 1.15;
    if (!canvas) {
      HANGAR.renderer.domElement.id = 'game-canvas';
      document.body.appendChild(HANGAR.renderer.domElement);
    }

    HANGAR.clock = new THREE.Clock();
    HANGAR.root = new THREE.Group();
    HANGAR.root.name = 'hangarRoot';
    HANGAR.scene.add(HANGAR.root);

    buildSkyboxGlow();
    buildLighting();
    buildHangarArchitecture();
    buildWalkableRooms();
    buildShipsArea();
    buildModulesArea();
    buildControlRoom();
    buildUi();
    bindEvents();
    refreshUi();
    animate();
  }

  function buildSkyboxGlow() {
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x1f1454) },
        bottomColor: { value: new THREE.Color(0x04060b) },
        accentColor: { value: new THREE.Color(0x0c5470) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 accentColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          float d = clamp((vWorldPosition.z + 180.0) / 400.0, 0.0, 1.0);
          vec3 color = mix(bottomColor, topColor, h);
          color = mix(color, accentColor, 0.35 * (1.0 - d));
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    HANGAR.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  function buildLighting() {
    const ambient = new THREE.AmbientLight(0x8aa0ff, 0.8);
    HANGAR.scene.add(ambient);

    const topLight = new THREE.DirectionalLight(0xffffff, 1.6);
    topLight.position.set(18, 30, 12);
    topLight.castShadow = true;
    topLight.shadow.mapSize.set(2048, 2048);
    topLight.shadow.camera.left = -80;
    topLight.shadow.camera.right = 80;
    topLight.shadow.camera.top = 80;
    topLight.shadow.camera.bottom = -80;
    HANGAR.scene.add(topLight);

    const blueFill = new THREE.PointLight(0x4da2ff, 22, 140, 2.0);
    blueFill.position.set(-28, 10, 12);
    HANGAR.scene.add(blueFill);

    const magentaFill = new THREE.PointLight(0xa966ff, 18, 140, 2.0);
    magentaFill.position.set(28, 10, -6);
    HANGAR.scene.add(magentaFill);

    const hangarGlow = new THREE.RectAreaLight(0xbfd2ff, 18, 28, 3);
    hangarGlow.position.set(0, 18, -14);
    hangarGlow.lookAt(0, 0, -14);
    HANGAR.scene.add(hangarGlow);
  }

  function buildHangarArchitecture() {
    const root = new THREE.Group();
    root.name = 'mainHangar';
    HANGAR.root.add(root);

    const floorMat = makePbr(0x2b313d, 0.72, 0.24);
    const darkMat = makePbr(0x181c26, 0.75, 0.3);
    const panelMat = makePbr(0x667187, 0.45, 0.42);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xe6eeff, emissive: 0x8ea2ff, emissiveIntensity: 2.4 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(66, 1.2, 90), floorMat);
    floor.position.set(0, -0.6, 0);
    floor.receiveShadow = true;
    root.add(floor);

    const runway = new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 82), darkMat);
    runway.position.set(0, 0.05, 0);
    runway.receiveShadow = true;
    root.add(runway);

    for (let i = -36; i <= 36; i += 6) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 2.2), glowMat);
      strip.position.set(0, 0.08, i);
      root.add(strip);
    }

    buildWallFrame(root, -22);
    buildWallFrame(root, 22);
    buildCeilingFrames(root, glowMat, panelMat);

    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 0.4), new THREE.MeshStandardMaterial({
      color: 0x88a4ff,
      roughness: 0.15,
      metalness: 0.1,
      emissive: 0x182660,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.3
    }));
    rearWindow.position.set(0, 8.5, -40);
    root.add(rearWindow);

    const rearGlow = new THREE.Mesh(new THREE.PlaneGeometry(32, 12), new THREE.MeshBasicMaterial({ color: 0x4d2cff, transparent: true, opacity: 0.22 }));
    rearGlow.position.set(0, 8.5, -39.5);
    root.add(rearGlow);

    const leftDoor = createDoorFrame('Корабли', new THREE.Vector3(-19.5, 0, -6), Math.PI / 2, 0x59d5ff);
    const rightDoor = createDoorFrame('Модули', new THREE.Vector3(19.5, 0, -6), -Math.PI / 2, 0x7cffbd);
    const rearDoor = createDoorFrame('Управление', new THREE.Vector3(0, 0, -31.5), 0, 0xc086ff);
    root.add(leftDoor.group, rightDoor.group, rearDoor.group);

    HANGAR.roomAnchors.hangar = new THREE.Vector3(0, HANGAR.playerHeight, 18);
    HANGAR.roomAnchors.ships = new THREE.Vector3(-44, HANGAR.playerHeight, -6);
    HANGAR.roomAnchors.modules = new THREE.Vector3(44, HANGAR.playerHeight, -6);
    HANGAR.roomAnchors.control = new THREE.Vector3(0, HANGAR.playerHeight, -60);

    addCollider(0, 4.5, 44.5, 66, 10, 1.2);   // front invisible boundary
    addCollider(0, 4.5, -45.5, 66, 10, 1.2);  // rear boundary
    addCollider(-33.4, 5, 0, 1.2, 10, 88);    // left wall
    addCollider(33.4, 5, 0, 1.2, 10, 88);     // right wall
    addCollider(0, 14.4, 0, 66, 1, 90);       // ceiling stop
  }

  function buildWallFrame(root, sideX) {
    const isLeft = sideX < 0;
    const mainMat = makePbr(0x5e6677, 0.46, 0.4);
    const beamMat = makePbr(0x2b3140, 0.75, 0.25);

    for (let z = -32; z <= 24; z += 14) {
      const outer = new THREE.Mesh(new THREE.BoxGeometry(3, 13.5, 7), mainMat);
      outer.position.set(sideX, 6.75, z);
      outer.castShadow = true;
      root.add(outer);

      const braceA = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.8, 0.9), beamMat);
      braceA.position.set(sideX + (isLeft ? 2.1 : -2.1), 4, z - 2.2);
      braceA.rotation.z = isLeft ? -0.62 : 0.62;
      braceA.castShadow = true;
      root.add(braceA);

      const braceB = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.8, 0.9), beamMat);
      braceB.position.set(sideX + (isLeft ? 2.1 : -2.1), 4, z + 2.2);
      braceB.rotation.z = isLeft ? 0.62 : -0.62;
      braceB.castShadow = true;
      root.add(braceB);
    }

    const sideFloor = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 90), beamMat);
    sideFloor.position.set(sideX + (isLeft ? 4.6 : -4.6), 0.22, 0);
    sideFloor.receiveShadow = true;
    root.add(sideFloor);
  }

  function buildCeilingFrames(root, glowMat, panelMat) {
    for (let z = -32; z <= 30; z += 16) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(44, 1.1, 2.8), panelMat);
      beam.position.set(0, 15.6, z);
      beam.castShadow = true;
      root.add(beam);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 12.5), glowMat);
      strip.position.set(0, 15.05, z);
      root.add(strip);

      const sideA = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.7, 2), panelMat);
      sideA.position.set(-18, 14.6, z);
      sideA.rotation.z = 0.45;
      root.add(sideA);

      const sideB = sideA.clone();
      sideB.position.x = 18;
      sideB.rotation.z = -0.45;
      root.add(sideB);
    }
  }

  function buildWalkableRooms() {
    buildShipRoomShell();
    buildModuleRoomShell();
    buildControlRoomShell();
  }

  function buildShipRoomShell() {
    const room = new THREE.Group();
    room.name = 'shipRoom';
    HANGAR.root.add(room);

    const floorMat = makePbr(0x232a35, 0.7, 0.2);
    const wallMat = makePbr(0x67738a, 0.42, 0.44);
    const trimMat = makePbr(0x111724, 0.8, 0.18);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xdce7ff, emissive: 0x59d5ff, emissiveIntensity: 2.1 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 26), floorMat);
    floor.position.set(-44, -0.5, -6);
    floor.receiveShadow = true;
    room.add(floor);

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(36, 14, 1), wallMat);
    wallBack.position.set(-44, 7, -18.5);
    room.add(wallBack);
    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 1), wallMat);
    wallFront.position.set(-56, 7, 6.5);
    room.add(wallFront);
    const wallFrontB = wallFront.clone();
    wallFrontB.position.set(-32, 7, 6.5);
    room.add(wallFrontB);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 26), wallMat);
    leftWall.position.set(-62, 7, -6);
    room.add(leftWall);
    const rightWall = leftWall.clone();
    rightWall.position.set(-26, 7, -6);
    room.add(rightWall);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 26), trimMat);
    ceiling.position.set(-44, 14.5, -6);
    room.add(ceiling);

    for (let x = -58; x <= -30; x += 8) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 16), glowMat);
      strip.position.set(x, 13.9, -6);
      room.add(strip);
    }

    const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(8, 8.5, 0.15), new THREE.MeshBasicMaterial({ color: 0x59d5ff, transparent: true, opacity: 0.2 }));
    doorGlow.position.set(-44, 5, 6.06);
    room.add(doorGlow);

    addCollider(-44, 5, -19.2, 36, 10, 1.2);
    addCollider(-62.6, 5, -6, 1.2, 10, 26);
    addCollider(-25.4, 5, -6, 1.2, 10, 26);
    addCollider(-56, 5, 7.2, 10, 10, 1.2);
    addCollider(-32, 5, 7.2, 10, 10, 1.2);
  }

  function buildModuleRoomShell() {
    const room = new THREE.Group();
    room.name = 'moduleRoom';
    HANGAR.root.add(room);

    const floorMat = makePbr(0x242c37, 0.68, 0.24);
    const wallMat = makePbr(0x6a768d, 0.42, 0.44);
    const trimMat = makePbr(0x111724, 0.8, 0.18);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xe9ffee, emissive: 0x7cffbd, emissiveIntensity: 2.1 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 26), floorMat);
    floor.position.set(44, -0.5, -6);
    floor.receiveShadow = true;
    room.add(floor);

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(36, 14, 1), wallMat);
    wallBack.position.set(44, 7, -18.5);
    room.add(wallBack);
    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 1), wallMat);
    wallFront.position.set(32, 7, 6.5);
    room.add(wallFront);
    const wallFrontB = wallFront.clone();
    wallFrontB.position.set(56, 7, 6.5);
    room.add(wallFrontB);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 26), wallMat);
    leftWall.position.set(26, 7, -6);
    room.add(leftWall);
    const rightWall = leftWall.clone();
    rightWall.position.set(62, 7, -6);
    room.add(rightWall);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 26), trimMat);
    ceiling.position.set(44, 14.5, -6);
    room.add(ceiling);

    for (let x = 30; x <= 58; x += 8) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 16), glowMat);
      strip.position.set(x, 13.9, -6);
      room.add(strip);
    }

    const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(8, 8.5, 0.15), new THREE.MeshBasicMaterial({ color: 0x7cffbd, transparent: true, opacity: 0.2 }));
    doorGlow.position.set(44, 5, 6.06);
    room.add(doorGlow);

    addCollider(44, 5, -19.2, 36, 10, 1.2);
    addCollider(25.4, 5, -6, 1.2, 10, 26);
    addCollider(62.6, 5, -6, 1.2, 10, 26);
    addCollider(32, 5, 7.2, 10, 10, 1.2);
    addCollider(56, 5, 7.2, 10, 10, 1.2);
  }

  function buildControlRoomShell() {
    const room = new THREE.Group();
    room.name = 'controlRoom';
    HANGAR.root.add(room);

    const floorMat = makePbr(0x1d2430, 0.7, 0.22);
    const wallMat = makePbr(0x626e84, 0.42, 0.44);
    const trimMat = makePbr(0x101521, 0.82, 0.18);
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xfff0ff, emissive: 0xc086ff, emissiveIntensity: 2.05 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 34), floorMat);
    floor.position.set(0, -0.5, -60);
    floor.receiveShadow = true;
    room.add(floor);

    const rear = new THREE.Mesh(new THREE.BoxGeometry(28, 14, 1), wallMat);
    rear.position.set(0, 7, -76.5);
    room.add(rear);
    const sideA = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 34), wallMat);
    sideA.position.set(-14, 7, -60);
    room.add(sideA);
    const sideB = sideA.clone();
    sideB.position.x = 14;
    room.add(sideB);
    const frontA = new THREE.Mesh(new THREE.BoxGeometry(9, 14, 1), wallMat);
    frontA.position.set(-9.5, 7, -43.5);
    room.add(frontA);
    const frontB = frontA.clone();
    frontB.position.x = 9.5;
    room.add(frontB);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 34), trimMat);
    ceiling.position.set(0, 14.5, -60);
    room.add(ceiling);

    for (let z = -72; z <= -48; z += 8) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 0.9), glowMat);
      strip.position.set(0, 13.9, z);
      room.add(strip);
    }

    addCollider(0, 5, -77.2, 28, 10, 1.2);
    addCollider(-14.6, 5, -60, 1.2, 10, 34);
    addCollider(14.6, 5, -60, 1.2, 10, 34);
    addCollider(-9.5, 5, -42.8, 9, 10, 1.2);
    addCollider(9.5, 5, -42.8, 9, 10, 1.2);
  }

  function buildShipsArea() {
    const area = new THREE.Group();
    area.name = 'shipsArea';
    HANGAR.root.add(area);

    const platformMat = makePbr(0x2d3442, 0.58, 0.38);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xf6fbff, emissive: 0x57d5ff, emissiveIntensity: 1.8, metalness: 0.32, roughness: 0.28 });

    SHIP_DATA.forEach((ship, index) => {
      const baseX = -52 + index * 8;
      const stand = new THREE.Group();
      stand.position.set(baseX, 0, -7);
      stand.userData.type = 'ship';
      stand.userData.index = index;
      stand.userData.name = ship.name;

      const disk = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.4, 0.9, 32), platformMat);
      disk.position.y = 0.45;
      disk.receiveShadow = true;
      disk.castShadow = true;
      stand.add(disk);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.1, 12, 48), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.58;
      stand.add(ring);

      const shipMesh = createShipModel(ship.color);
      shipMesh.position.y = 2.7;
      shipMesh.rotation.y = index * 0.8;
      stand.add(shipMesh);

      const padLight = new THREE.PointLight(ship.color, 4.5, 18, 2);
      padLight.position.set(0, 2.5, 0);
      stand.add(padLight);

      HANGAR.shipStands.push(stand);
      HANGAR.interactive.push(stand);
      area.add(stand);
    });

    const sign = createSign('ЗАЛ КОРАБЛЕЙ', 0x59d5ff);
    sign.position.set(-44, 10.6, 3.5);
    area.add(sign);
  }

  function buildModulesArea() {
    const area = new THREE.Group();
    area.name = 'modulesArea';
    HANGAR.root.add(area);

    MODULE_DATA.forEach((module, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = 39 + col * 10;
      const z = -3 - row * 9;
      const pod = new THREE.Group();
      pod.position.set(x, 0, z);
      pod.userData.type = 'module';
      pod.userData.index = index;
      pod.userData.name = module.name;

      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 1.1, 24), makePbr(0x26303b, 0.6, 0.3));
      base.position.y = 0.55;
      pod.add(base);

      const core = createModuleModel(module.color, index);
      core.position.y = 2.7;
      pod.add(core);

      const glow = new THREE.PointLight(module.color, 4, 14, 2);
      glow.position.set(0, 3.4, 0);
      pod.add(glow);

      HANGAR.modulePods.push(pod);
      HANGAR.interactive.push(pod);
      area.add(pod);
    });

    const sign = createSign('МОДУЛЬНЫЙ ОТСЕК', 0x7cffbd);
    sign.position.set(44, 10.6, 3.5);
    area.add(sign);
  }

  function buildControlRoom() {
    const area = new THREE.Group();
    area.name = 'controlArea';
    HANGAR.root.add(area);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 4), makePbr(0x2a3441, 0.52, 0.36));
    desk.position.set(0, 1.6, -68);
    desk.castShadow = true;
    desk.receiveShadow = true;
    area.add(desk);

    const screenMat = new THREE.MeshStandardMaterial({ color: 0xeff0ff, emissive: 0xc086ff, emissiveIntensity: 2.3, roughness: 0.22, metalness: 0.18 });
    for (let i = -1; i <= 1; i++) {
      const screen = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.2, 0.12), screenMat);
      screen.position.set(i * 4.4, 4.4, -69.4);
      area.add(screen);
    }

    const holoPad = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8a5dff, emissiveIntensity: 2.1, transparent: true, opacity: 0.82 }));
    holoPad.position.set(0, 1.95, -61);
    area.add(holoPad);

    const holoSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc086ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.55 }));
    holoSphere.position.set(0, 4.2, -61);
    holoSphere.userData.spin = 0.6;
    area.add(holoSphere);

    const sign = createSign('КОМНАТА УПРАВЛЕНИЯ', 0xc086ff);
    sign.position.set(0, 10.6, -46.4);
    area.add(sign);
  }

  function createDoorFrame(label, position, rotationY, color) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const frameMat = makePbr(0x59657a, 0.48, 0.42);
    const sideA = new THREE.Mesh(new THREE.BoxGeometry(1, 9.6, 1.2), frameMat);
    sideA.position.set(-4.5, 4.8, 0);
    const sideB = sideA.clone();
    sideB.position.x = 4.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1.2), frameMat);
    top.position.set(0, 9.1, 0);

    const glow = new THREE.Mesh(new THREE.BoxGeometry(8.1, 7.5, 0.14), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 }));
    glow.position.set(0, 4.4, 0.18);

    const sign = createSign(label, color, 4.2);
    sign.position.set(0, 11.4, 0);

    group.add(sideA, sideB, top, glow, sign);
    return { group };
  }

  function createSign(text, color, width = 6.2) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(10, 14, 24, 0.18)';
    ctx.fillRect(18, 28, canvas.width - 36, canvas.height - 56);
    ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 28, canvas.width - 36, canvas.height - 56);
    ctx.shadowColor = `#${color.toString(16).padStart(6, '0')}`;
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#f4f8ff';
    ctx.font = 'bold 86px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.25), mat);
    return mesh;
  }

  function createShipModel(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.62, roughness: 0.28, emissive: color, emissiveIntensity: 0.15 });
    const darkMat = makePbr(0x1a202b, 0.8, 0.16);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xdde5ff, emissive: 0x4d5fb0, emissiveIntensity: 0.45, metalness: 0.05, roughness: 0.05, transparent: true, opacity: 0.66 });

    const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 4.2, 6, 14), bodyMat);
    fuselage.rotation.z = Math.PI / 2;
    fuselage.castShadow = true;
    group.add(fuselage);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 20), glassMat);
    cockpit.position.set(1.85, 0.35, 0);
    group.add(cockpit);

    const wingGeo = new THREE.BoxGeometry(2.6, 0.12, 1.15);
    const leftWing = new THREE.Mesh(wingGeo, darkMat);
    leftWing.position.set(-0.2, 0, -1.2);
    leftWing.castShadow = true;
    group.add(leftWing);
    const rightWing = leftWing.clone();
    rightWing.position.z = 1.2;
    group.add(rightWing);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.12), bodyMat);
    fin.position.set(-1.4, 0.8, 0);
    fin.castShadow = true;
    group.add(fin);

    const engineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 2.8, roughness: 0.18, metalness: 0.12 });
    const engineA = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.45, 16), engineMat);
    engineA.rotation.z = Math.PI / 2;
    engineA.position.set(-2.4, -0.15, -0.42);
    group.add(engineA);
    const engineB = engineA.clone();
    engineB.position.z = 0.42;
    group.add(engineB);

    group.scale.setScalar(1.2);
    return group;
  }

  function createModuleModel(color, index) {
    const group = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.3, metalness: 0.42, roughness: 0.28 });
    const darkMat = makePbr(0x202733, 0.78, 0.18);

    if (index === 0) {
      const core = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.9), shellMat);
      core.castShadow = true;
      group.add(core);
      const barrelA = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 16), darkMat);
      barrelA.rotation.z = Math.PI / 2;
      barrelA.position.set(1.2, 0.18, -0.24);
      group.add(barrelA);
      const barrelB = barrelA.clone();
      barrelB.position.z = 0.24;
      group.add(barrelB);
    } else if (index === 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 18, 40), shellMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 20), shellMat);
      group.add(orb);
    } else if (index === 2) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), shellMat);
      crystal.castShadow = true;
      group.add(crystal);
      const cage = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 12, 48), darkMat);
      cage.rotation.y = Math.PI / 2;
      group.add(cage);
    } else {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 2.1, 18), shellMat);
      body.rotation.z = Math.PI / 2;
      group.add(body);
      const finA = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.82), darkMat);
      finA.position.set(0, 0.72, 0);
      group.add(finA);
      const finB = finA.clone();
      finB.position.y = -0.72;
      group.add(finB);
    }

    return group;
  }

  function makePbr(color, roughness, metalness) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function addCollider(x, y, z, width, height, depth) {
    HANGAR.colliders.push({ x, y, z, width, height, depth });
  }

  function bindEvents() {
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    HANGAR.renderer.domElement.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        HANGAR.renderer.domElement.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      HANGAR.pointerLocked = document.pointerLockElement === HANGAR.renderer.domElement;
      if (HANGAR.ui.hint) {
        HANGAR.ui.hint.textContent = HANGAR.pointerLocked
          ? 'WASD — ходьба | Shift — бег | E — выбрать | 1/2/3 — комнаты | Esc — отпустить мышь'
          : 'Кликни по сцене, чтобы захватить мышь';
      }
    });
  }

  function onResize() {
    HANGAR.camera.aspect = window.innerWidth / window.innerHeight;
    HANGAR.camera.updateProjectionMatrix();
    HANGAR.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onKeyDown(event) {
    HANGAR.keys[event.code] = true;

    if (event.code === 'Digit1') teleportTo('hangar');
    if (event.code === 'Digit2') teleportTo('ships');
    if (event.code === 'Digit3') teleportTo('modules');
    if (event.code === 'Digit4') teleportTo('control');

    if (event.code === 'KeyE') {
      handleInteraction();
    }
  }

  function onKeyUp(event) {
    HANGAR.keys[event.code] = false;
  }

  function onMouseMove(event) {
    if (HANGAR.pointerLocked) {
      HANGAR.yaw -= event.movementX * HANGAR.lookSpeed;
      HANGAR.pitch -= event.movementY * HANGAR.lookSpeed;
      HANGAR.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, HANGAR.pitch));
    }
  }

  function onMouseDown() { HANGAR.mouseDown = true; }
  function onMouseUp() { HANGAR.mouseDown = false; }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(HANGAR.clock.getDelta(), 0.033);

    updatePlayer(dt);
    updateCameraRotation();
    updateHover();
    updateAnimatedProps(dt);
    refreshUi();

    HANGAR.renderer.render(HANGAR.scene, HANGAR.camera);
  }

  function updatePlayer(dt) {
    const moveVector = new THREE.Vector3();
    const forward = new THREE.Vector3(Math.sin(HANGAR.yaw), 0, Math.cos(HANGAR.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    if (HANGAR.keys.KeyW) moveVector.add(forward.clone().multiplyScalar(-1));
    if (HANGAR.keys.KeyS) moveVector.add(forward);
    if (HANGAR.keys.KeyA) moveVector.add(right.clone().multiplyScalar(-1));
    if (HANGAR.keys.KeyD) moveVector.add(right);

    if (moveVector.lengthSq() > 0) moveVector.normalize();

    const speed = HANGAR.keys.ShiftLeft || HANGAR.keys.ShiftRight ? HANGAR.sprintSpeed : HANGAR.moveSpeed;
    moveVector.multiplyScalar(speed * dt);

    const previous = HANGAR.camera.position.clone();
    HANGAR.camera.position.x += moveVector.x;
    HANGAR.camera.position.z += moveVector.z;

    resolveCollisions(previous);
    detectRoom();
  }

  function resolveCollisions(previous) {
    const p = HANGAR.camera.position;
    const r = HANGAR.playerRadius;

    for (const c of HANGAR.colliders) {
      const minX = c.x - c.width / 2 - r;
      const maxX = c.x + c.width / 2 + r;
      const minZ = c.z - c.depth / 2 - r;
      const maxZ = c.z + c.depth / 2 + r;
      const minY = c.y - c.height / 2;
      const maxY = c.y + c.height / 2;

      if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ && p.y > minY && p.y < maxY) {
        p.x = previous.x;
        p.z = previous.z;
        break;
      }
    }
  }

  function detectRoom() {
    const { x, z } = HANGAR.camera.position;
    if (z < -43) HANGAR.currentRoom = 'control';
    else if (x < -25) HANGAR.currentRoom = 'ships';
    else if (x > 25) HANGAR.currentRoom = 'modules';
    else HANGAR.currentRoom = 'hangar';
  }

  function updateCameraRotation() {
    HANGAR.camera.rotation.y = HANGAR.yaw;
    HANGAR.camera.rotation.x = HANGAR.pitch;
  }

  function updateHover() {
    HANGAR.raycaster.setFromCamera(HANGAR.mouse, HANGAR.camera);
    let bestTarget = null;
    let bestDistance = 4.8;

    for (const target of HANGAR.interactive) {
      HANGAR.tmpVecA.setFromMatrixPosition(target.matrixWorld);
      const distance = HANGAR.camera.position.distanceTo(HANGAR.tmpVecA);
      if (distance > bestDistance) continue;

      HANGAR.tmpVecB.copy(HANGAR.tmpVecA).sub(HANGAR.camera.position).normalize();
      const viewForward = new THREE.Vector3(0, 0, -1).applyQuaternion(HANGAR.camera.quaternion).normalize();
      const alignment = viewForward.dot(HANGAR.tmpVecB);
      if (alignment > 0.92) {
        bestDistance = distance;
        bestTarget = target;
      }
    }

    HANGAR.hoverTarget = bestTarget;

    HANGAR.shipStands.forEach((stand, index) => {
      const active = index === HANGAR.selectedShip || stand === HANGAR.hoverTarget;
      stand.scale.lerp(new THREE.Vector3(active ? 1.06 : 1, active ? 1.06 : 1, active ? 1.06 : 1), 0.12);
    });

    HANGAR.modulePods.forEach((pod, index) => {
      const active = index === HANGAR.selectedModule || pod === HANGAR.hoverTarget;
      pod.scale.lerp(new THREE.Vector3(active ? 1.08 : 1, active ? 1.08 : 1, active ? 1.08 : 1), 0.12);
    });
  }

  function handleInteraction() {
    if (!HANGAR.hoverTarget) return;

    if (HANGAR.hoverTarget.userData.type === 'ship') {
      HANGAR.selectedShip = HANGAR.hoverTarget.userData.index;
    }
    if (HANGAR.hoverTarget.userData.type === 'module') {
      HANGAR.selectedModule = HANGAR.hoverTarget.userData.index;
    }
  }

  function updateAnimatedProps(dt) {
    HANGAR.shipStands.forEach((stand, index) => {
      const shipMesh = stand.children[2];
      if (shipMesh) {
        shipMesh.rotation.y += dt * (0.24 + index * 0.07);
        shipMesh.position.y = 2.7 + Math.sin(performance.now() * 0.0013 + index) * 0.08;
      }
    });

    HANGAR.modulePods.forEach((pod, index) => {
      const core = pod.children[1];
      if (core) {
        core.rotation.x += dt * 0.35;
        core.rotation.y += dt * (0.6 + index * 0.07);
        core.position.y = 2.7 + Math.sin(performance.now() * 0.0018 + index) * 0.25;
      }
    });

    HANGAR.root.traverse((obj) => {
      if (obj.userData.spin) {
        obj.rotation.y += dt * obj.userData.spin;
      }
    });
  }

  function teleportTo(roomKey) {
    const anchor = HANGAR.roomAnchors[roomKey];
    if (!anchor) return;
    HANGAR.camera.position.copy(anchor);
    if (roomKey === 'ships') HANGAR.yaw = -Math.PI / 2;
    else if (roomKey === 'modules') HANGAR.yaw = Math.PI / 2;
    else HANGAR.yaw = Math.PI;
    HANGAR.pitch = 0;
    detectRoom();
  }

  function buildUi() {
    const root = document.createElement('div');
    root.id = 'hangar-ui';
    root.innerHTML = `
      <div class="hangar-crosshair"></div>
      <div class="hangar-topbar">
        <div class="hangar-chip" id="hangar-room-chip">Локация: Главный ангар</div>
        <div class="hangar-chip" id="hangar-ship-chip">Корабль: ${SHIP_DATA[0].name}</div>
        <div class="hangar-chip" id="hangar-module-chip">Модуль: ${MODULE_DATA[0].name}</div>
      </div>
      <div class="hangar-panel hangar-left">
        <div class="hangar-panel-title">Управление</div>
        <div class="hangar-help" id="hangar-help-text">Кликни по сцене, чтобы захватить мышь</div>
        <div class="hangar-list">
          <div>1 — Главный ангар</div>
          <div>2 — Зал кораблей</div>
          <div>3 — Модульный отсек</div>
          <div>4 — Комната управления</div>
          <div>WASD — ходьба</div>
          <div>Shift — бег</div>
          <div>E — выбор</div>
        </div>
      </div>
      <div class="hangar-panel hangar-right">
        <div class="hangar-panel-title">Характеристики</div>
        <div id="hangar-stats-box"></div>
      </div>
      <div class="hangar-bottom-hint" id="hangar-bottom-hint">Подойди ближе к кораблю или модулю и нажми E</div>
    `;
    document.body.appendChild(root);

    HANGAR.ui.root = root;
    HANGAR.ui.crosshair = root.querySelector('.hangar-crosshair');
    HANGAR.ui.hint = document.getElementById('hangar-help-text');
    HANGAR.ui.room = document.getElementById('hangar-room-chip');
    HANGAR.ui.ship = document.getElementById('hangar-ship-chip');
    HANGAR.ui.module = document.getElementById('hangar-module-chip');
    HANGAR.ui.stats = document.getElementById('hangar-stats-box');
    HANGAR.ui.help = document.getElementById('hangar-bottom-hint');
  }

  function refreshUi() {
    if (!HANGAR.ui.root) return;
    const roomLabel = HANGAR.currentRoom === 'ships'
      ? 'Зал кораблей'
      : HANGAR.currentRoom === 'modules'
      ? 'Модульный отсек'
      : HANGAR.currentRoom === 'control'
      ? 'Комната управления'
      : 'Главный ангар';

    HANGAR.ui.room.textContent = `Локация: ${roomLabel}`;
    HANGAR.ui.ship.textContent = `Корабль: ${SHIP_DATA[HANGAR.selectedShip].name}`;
    HANGAR.ui.module.textContent = `Модуль: ${MODULE_DATA[HANGAR.selectedModule].name}`;

    HANGAR.ui.stats.innerHTML = `
      <div class="hangar-stat-row"><span>HP</span><strong>${SHIP_DATA[HANGAR.selectedShip].hp}</strong></div>
      <div class="hangar-stat-row"><span>Скорость</span><strong>${SHIP_DATA[HANGAR.selectedShip].speed}</strong></div>
      <div class="hangar-stat-row"><span>Энергия</span><strong>${SHIP_DATA[HANGAR.selectedShip].energy}</strong></div>
      <div class="hangar-stat-row"><span>Модуль</span><strong>${MODULE_DATA[HANGAR.selectedModule].bonus}</strong></div>
    `;

    if (HANGAR.hoverTarget) {
      HANGAR.ui.help.textContent = `Нажми E: ${HANGAR.hoverTarget.userData.name}`;
    } else {
      HANGAR.ui.help.textContent = 'Подойди ближе к кораблю или модулю и нажми E';
    }
  }

  window.startCosmicHangarPrototype = initHangarPrototype;
})();
