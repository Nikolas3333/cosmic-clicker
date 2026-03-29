import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';




// ===============================
// PLAYER MODEL (локально)
// ===============================

let player = {
  id: "local_player",
  nickname: "Commander",
  level: 1,
  experience: 0,
  credits: 500,
  ships: [],
  staff_role: 'player'
};

// 🔥 ТЕСТОВЫЙ КОРАБЛЬ (можешь потом удалить)
player.ships.push({
  id: 1,
  name: "Scout",
  level: 1,
  hp: 100,
  attack: 10,
  speed: 5
});

/* ================= GAME STATE ================= */

let gameState = "AUTH";
let currentRoom = null;
let playerShip = null;
let keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
};
let shipVelocity = new THREE.Vector3();
let shipRotationVelocity = new THREE.Vector3();
let mouseSensitivity = 0.004;
let activeLasers = [];
let lastLaserShotAt = 0;
const laserCooldown = 95;
const BASE_BG_MUSIC_VOLUME = 0.4;
const BASE_BOSS_MUSIC_VOLUME = 0.6;
const BASE_CLICK_VOLUME = 0.5;

const gameSettings = {
    mouseSensitivity: 1,
    invertY: false,
    soundEnabled: true,
    soundVolume: 1,
    musicEnabled: true,
    musicVolume: 0.4
};

let enemyBot = null;
let enemyLasers = [];
let battleObjects = [];
let battleMapPlanet = null;
let selectedLobbyMap = null;
let lastBotShotAt = 0;
const botShotCooldown = 900;
let playerHp = 100;
let playerMaxHp = 100;
const battleStats = { playerKills:0, playerDeaths:0, botKills:0, botDeaths:0 };
let playerControl = { yaw:0, pitch:0, roll:0 };
let lobbyBgTimer = null;

// ===== MOUSE CONTROL =====
let mouseDeltaX = 0;
let firing = false;
let mouseDeltaY = 0;
let battleObserverMode = false;
let observerBots = [];
let debrisPieces = [];
let battleObstacles = [];

let observerCameraYaw = 0;
let observerCameraPitch = -0.2;
let observerCameraDistance = 34;
let observerCameraTarget = new THREE.Vector3();
let observerFreeCameraPosition = new THREE.Vector3(0, 18, 48);
let battlePlanetVisualScale = 1;
let battleShipCrash = null;

const authState = {
    mode: 'guest',
    email: '',
    password: '',
    rememberedEmail: '',
    rememberedPassword: '',
    isAuthenticated: false,
    playerId: 0,
    emailVerified: false,
    pendingVerificationEmail: '',
    pendingVerificationCode: ''
};

function getDisplayPlayerTag(){
    const safeNickname = (player?.nickname || 'Commander').trim() || 'Commander';
    return safeNickname;
}


function getActiveSaveKey(){
    if(authState.mode === 'account'){
        const accountKey = authState.playerId ? String(authState.playerId) : (authState.email || '').trim().toLowerCase();
        if(accountKey) return `galaxySave:${accountKey}`;
    }
    return null;
}

let inventory = {
    syncFromPlayerResources(){},
    render(){},
    addResource(){}
};

function resetPlayerProgress(){
    points = 0;
    critChance = 0;
    autoDamage = 0;
    currentLevel = 1;
    damage = 1;
    Object.keys(playerResources).forEach(key => playerResources[key] = 0);
    planets.forEach((planet, index) => {
        planet.unlocked = index === 0;
        planet.currentResourceAmount = planet.maxResourceAmount;
        planet.lastResourceRegenAt = null;
    });
    if(typeof sunOrbitData !== 'undefined'){
        sunOrbitData.currentResourceAmount = sunOrbitData.maxResourceAmount;
        sunOrbitData.lastResourceRegenAt = null;
    }
    selectedPlanet = null;
    isPlanetFocused = false;
    battleStats.playerKills = 0;
    battleStats.playerDeaths = 0;
    battleStats.botKills = 0;
    battleStats.botDeaths = 0;
    playerHp = playerMaxHp;
    battleWeapon.ammoInClip = battleWeapon.clipSize;
    battleWeapon.isReloading = false;
    battleWeapon.reloadEndsAt = 0;
    inventory.syncFromPlayerResources?.();
    updateHUD?.();
    updateUI?.();
    updateBattlePlayerHud?.();
}

function showAuthMessage(text){
    const authMessage = document.getElementById('auth-message');
    if(authMessage) authMessage.textContent = text || '';
}

const battleWeapon = {
    clipSize: 50,
    ammoInClip: 50,
    reserveAmmo: Infinity,
    damage: 12,
    reloadTime: 1800,
    isReloading: false,
    reloadEndsAt: 0
};

let battleChatOpen = false;
const battleMessages = [];
const killFeedMessages = [];

function isBattleTyping(){
    const input = document.getElementById('battle-chat-input');
    return battleChatOpen && input && document.activeElement === input;
}

function resetBattleInputState(){
    keys.w = false;
    keys.a = false;
    keys.s = false;
    keys.d = false;
    keys.space = false;
    firing = false;
    mouseDeltaX = 0;
    mouseDeltaY = 0;
}



document.addEventListener("mousedown", (event) => {
    if(event.button !== 0) return;
    if(gameState !== "BATTLE") return;
    if(battleObserverMode) return;
    if(isBattleTyping()) return;
    event.preventDefault();
    firing = true;
    tryFireLaser();
});


document.addEventListener("mouseup", (event) => {
    if(event.button === 0) firing = false;
});


document.addEventListener("mousemove", (event) => {
const canvas = document.querySelector("canvas");
    if (gameState !== "BATTLE" && gameState !== "OBSERVE") return;
    if (document.pointerLockElement !== canvas) return;

    if(gameState === "OBSERVE" || battleObserverMode){
        observerCameraYaw += event.movementX * 0.0035 * gameSettings.mouseSensitivity;
        const invertFactor = gameSettings.invertY ? -1 : 1;
        observerCameraPitch -= event.movementY * 0.0026 * gameSettings.mouseSensitivity * invertFactor;
        observerCameraPitch = THREE.MathUtils.clamp(observerCameraPitch, -1.15, 1.15);
        return;
    }

   mouseDeltaX += event.movementX;
   mouseDeltaY += event.movementY;

});



  // ================= KEY SYSTEM =================

let mouseControl = false;

document.addEventListener("keydown", (e) => {

    if(isBattleTyping()) return;
    if (e.code === "KeyW") keys.w = true;
    if (e.code === "KeyA") keys.a = true;
    if (e.code === "KeyS") keys.s = true;
    if (e.code === "KeyD") keys.d = true;
    if (e.code === "KeyR") startBattleReload();

    // Включить / выключить управление мышкой
    if (e.code === "KeyM") {

        mouseControl = !mouseControl;

        if(mouseControl){
            const canvas = document.querySelector("canvas");
        safeRequestPointerLock(canvas);
        }else{
            document.exitPointerLock();
        }

    }

});

document.addEventListener("keyup", (e) => {

    if (e.code === "KeyW") keys.w = false;
    if (e.code === "KeyA") keys.a = false;
    if (e.code === "KeyS") keys.s = false;
    if (e.code === "KeyD") keys.d = false;

});

const battle = document.getElementById("battle-screen");
if(battle) battle.style.display = "none";

function safeRequestPointerLock(targetCanvas){
    const canvas = targetCanvas || document.querySelector('canvas');
    if(!canvas || document.pointerLockElement === canvas) return;
    try{
        const result = canvas.requestPointerLock?.();
        if(result && typeof result.catch === 'function'){
            result.catch(() => {});
        }
    }catch(_){ }
}



function pushKillFeed(text, type='kill'){
    const feed = document.getElementById('kill-feed');
    if(!feed) return;
    const item = document.createElement('div');
    item.className = `kill-feed-item ${type}`;
    item.textContent = text;
    feed.prepend(item);
    while(feed.children.length > 8){
        feed.removeChild(feed.lastChild);
    }
    setTimeout(() => item.remove(), type === 'chat' ? 9000 : 7000);
}

function pushBattleChatMessage(author, text){
    const log = document.getElementById('battle-chat-log');
    if(log){
        const row = document.createElement('div');
        const authorSpan = document.createElement('span');
        authorSpan.style.color = '#8deaff';
        authorSpan.textContent = `${author}: `;
        row.appendChild(authorSpan);
        row.appendChild(document.createTextNode(text));
        log.appendChild(row);
        log.scrollTop = log.scrollHeight;
        while(log.children.length > 20){
            log.removeChild(log.firstChild);
        }
    }
    pushKillFeed(`${author}: ${text}`, 'chat');
}

function setBattleChatOpen(open){
    battleChatOpen = open;
    const box = document.getElementById('battle-chat-box');
    const input = document.getElementById('battle-chat-input');

    const inputOnlyMode = gameState === 'BATTLE' && !canWriteBattleAnnouncementChat();

    if(box){
        box.classList.toggle('hidden', !open);
        box.classList.toggle('input-only', !!open && inputOnlyMode);
    }

    if(open){
        resetBattleInputState();
        if(document.pointerLockElement) document.exitPointerLock();
    }
    if(input){
        if(open){
            input.value = '';
            setTimeout(() => input.focus(), 0);
        }else{
            input.blur();
        }
    }
}

async function sendSceneMapMessage(text) {
    if (!window.supabaseClient) return false;
    if (!canWriteSceneMapChat()) return false;

    const ownPublicId = getOwnPublicChatId?.() || "";
    const cleanText = String(text || "").trim();
    if (!cleanText) return false;

    const scenePayload = {
        channel: "scene",
        room_id: getSceneChatRoomId(),
        player_id: getValidChatPlayerId(),
        player_public_id: ownPublicId,
        recipient_public_id: null,
        player_nickname: getOwnChatLabel(),
        message: cleanText
    };

    const battlePayload = {
        channel: "battle",
        room_id: scenePayload.room_id,
        player_id: scenePayload.player_id,
        player_public_id: scenePayload.player_public_id,
        recipient_public_id: null,
        player_nickname: scenePayload.player_nickname,
        message: cleanText
    };

    const { error } = await window.supabaseClient
        .from("chat_messages")
        .insert([scenePayload, battlePayload]);

    if (error) {
        console.error("❌ Ошибка отправки scene/battle сообщения:", error);
        return false;
    }

    return true;
}

function initBattleChat(){
    const input = document.getElementById('battle-chat-input');
    if(!input || input.dataset.bound) return;
    input.dataset.bound = '1';

    document.addEventListener('keydown', async (e) => {
        if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;

        if(e.key === 'Enter'){
            if(gameState === 'OBSERVE' && !canWriteBattleAnnouncementChat()){
                e.preventDefault();
                return;
            }

            if(!battleChatOpen){
                e.preventDefault();
                setBattleChatOpen(true);
            }else{
                e.preventDefault();
                const text = input.value.trim();

                if(window.playerMuted || player.isMuted){
                    pushKillFeed('🔇 Мут активен. Сообщение не отправлено.', 'chat');
                    setBattleChatOpen(false);
                    return;
                }

                if(text){
                    let sent = false;
                    if(gameState === 'BATTLE' && !canWriteBattleAnnouncementChat()){
                        sent = await sendSceneMapMessage(text);
                    }else{
                        sent = await sendMessage('battle', text);
                    }
                    if(sent) input.value = '';
                }
                setBattleChatOpen(false);
            }
        } else if(e.key === 'Escape' && battleChatOpen){
            setBattleChatOpen(false);
        }
    });
}

// ===== LOBBY STATIC BACKGROUNDS + LIGHT PARALLAX =====
const lobbyBackgrounds = [
    "images/lobby_space_1.png",
    "images/lobby_space_2.png",
    "images/lobby_space_3.png"
];

let currentLobbyBg = 0;
let lobbyParallaxTargetX = 0;
let lobbyParallaxTargetY = 0;
let lobbyParallaxCurrentX = 0;
let lobbyParallaxCurrentY = 0;

function initLobbyBackground(){
    const lobbyBg = document.getElementById("lobby-bg");
    const lobbyScreen = document.getElementById("lobby-screen");
    if(!lobbyBg || !lobbyScreen) return;

    function applyLobbyBackground(index){
        currentLobbyBg = (index + lobbyBackgrounds.length) % lobbyBackgrounds.length;
        lobbyBg.style.backgroundImage = `url(${lobbyBackgrounds[currentLobbyBg]})`;
    }

    applyLobbyBackground(Math.floor(Math.random() * lobbyBackgrounds.length));

    if(lobbyBgTimer) clearInterval(lobbyBgTimer);
    lobbyBgTimer = setInterval(() => {
        if(gameState === 'LOBBY'){
            applyLobbyBackground(currentLobbyBg + 1);
        }
    }, 12000);

    if(!lobbyScreen.dataset.parallaxBound){
        lobbyScreen.dataset.parallaxBound = '1';
        lobbyScreen.addEventListener("mousemove", (event) => {
            const x = (event.clientX / window.innerWidth) - 0.5;
            const y = (event.clientY / window.innerHeight) - 0.5;
            lobbyParallaxTargetX = x * 18;
            lobbyParallaxTargetY = y * 12;
        });
        lobbyScreen.addEventListener("mouseleave", () => {
            lobbyParallaxTargetX = 0;
            lobbyParallaxTargetY = 0;
        });
    }
}


function resetOrbitView(forcePlanetReset=false){
    camera.position.set(0, 60, 140);
    camera.lookAt(0, 0, 0);
    isObservationMode = false;
    mouseDeltaX = 0;
    mouseDeltaY = 0;
    if(typeof shipVelocity !== "undefined" && shipVelocity){
        shipVelocity.set(0, 0, 0);
    }

    if(forcePlanetReset){
        if(selectedPlanet){
            selectedPlanet.updateResourceLabelPosition?.(false);

            if(scene.children.includes(selectedPlanet.mesh)){
                scene.remove(selectedPlanet.mesh);
            }

            if(selectedPlanet.orbitPivot && !selectedPlanet.orbitPivot.children.includes(selectedPlanet.mesh)){
                selectedPlanet.orbitPivot.add(selectedPlanet.mesh);
            }

            if(selectedPlanet.originalLocalPosition){
                selectedPlanet.mesh.position.copy(selectedPlanet.originalLocalPosition);
            }else{
                selectedPlanet.mesh.position.set(selectedPlanet.orbitRadius || 0, 0, 0);
            }

            selectedPlanet.mesh.scale.set(1, 1, 1);
        }

        selectedPlanet = null;
        isPlanetFocused = false;
        solarSystem.position.set(0, 0, 0);
        solarSystem.rotation.set(0.22, 0, 0);
    }
}

function clearBattleScene(){
    resetBattleInputState();
    battleChatOpen = false;
    const chatBox = document.getElementById('battle-chat-box');
    if(chatBox) chatBox.classList.add('hidden');
    const cross = document.getElementById('battle-crosshair');
    if(cross) cross.style.display = 'block';
    const hud = document.getElementById('enemy-hud');
    if(hud) hud.style.display = 'block';
    if(playerShip){
        scene.remove(playerShip);
        playerShip = null;
    }

    if(enemyBot){
        scene.remove(enemyBot);
        enemyBot = null;
    }

    if(Array.isArray(activeLasers)){
        activeLasers.forEach(laser => {
            if(laser && laser.mesh) scene.remove(laser.mesh);
        });
        activeLasers = [];
    }

    if(Array.isArray(enemyLasers)){
        enemyLasers.forEach(laser => {
            if(laser && laser.mesh) scene.remove(laser.mesh);
        });
        enemyLasers = [];
    }

    if(Array.isArray(battleObjects)){
        battleObjects.forEach(obj => {
            if(obj) scene.remove(obj);
        });
        battleObjects = [];
    }

    if(battleMapPlanet){
        scene.remove(battleMapPlanet);
        battleMapPlanet = null;
    }

    shipVelocity.set(0, 0, 0);
    shipRotationVelocity.set(0, 0, 0);
    mouseDeltaX = 0;
    mouseDeltaY = 0;
    lastBotShotAt = 0;
    lastLaserShotAt = 0;
    playerHp = playerMaxHp;
    playerControl.yaw = 0;
    playerControl.pitch = 0;
    playerControl.roll = 0;
    battleObserverMode = false;
    observerCameraYaw = 0;
    observerCameraPitch = -0.2;
    observerCameraDistance = 34;
    battlePlanetVisualScale = 1;
    battleShipCrash = null;
    battleWeapon.ammoInClip = battleWeapon.clipSize;
    battleWeapon.isReloading = false;
    battleWeapon.reloadEndsAt = 0;
    observerBots.forEach(bot => { if(bot) scene.remove(bot); });
    observerBots = [];
    debrisPieces.forEach(piece => { if(piece?.mesh) scene.remove(piece.mesh); });
    debrisPieces = [];
    battleObstacles.forEach(obj => { if(obj) scene.remove(obj); });
    battleObstacles = [];
    stopLiveBattleSync();
    firing = false;
    setBattleChatOpen(false);
    const feed = document.getElementById('kill-feed'); if(feed) feed.innerHTML = "";
    const log = document.getElementById('battle-chat-log'); if(log) log.innerHTML = "";
}

function switchState(newState){

    if(document.pointerLockElement){
        document.exitPointerLock();
    }

    console.log("STATE:", newState);
    gameState = newState;

    const canvas = document.querySelector("canvas");
    const lobby = document.getElementById("lobby-screen");
    const orbitExit = document.getElementById("orbit-exit");
    const topNav = document.getElementById("top-nav");
    const battleScreen = document.getElementById("battle-screen");
    const resourceBar = document.getElementById("resource-bar");
    const ui = document.getElementById("ui");
    const premiumBar = document.getElementById("premium-bar");
    const authScreen = document.getElementById("auth-screen");

    if(canvas) canvas.style.display = "none";
    if(lobby) lobby.style.display = "none";
    if(authScreen) authScreen.style.display = "none";
    if(orbitExit) orbitExit.style.display = "none";
    if(topNav) topNav.style.display = "none";
    if(battleScreen) battleScreen.style.display = "none";
    if(resourceBar) resourceBar.style.display = "none";
    if(ui) ui.style.display = "none";
    if(premiumBar) premiumBar.style.display = "none";

    if(newState !== "BATTLE" && newState !== "OBSERVE"){
        clearBattleScene();
    }

    const windows = [
        document.getElementById("profile-window"),
        document.getElementById("hangar-window"),
        document.getElementById("create-match-window"),
        document.getElementById("inventory-window"),
        document.getElementById("settings-window")
    ];

    windows.forEach(win => {
        if(win) win.classList.add("hidden");
    });

    if(gameState === "AUTH"){
        if(authScreen) authScreen.style.display = "flex";
    }

    if(gameState === "LOBBY"){
        if(lobby) lobby.style.display = "flex";
        if(topNav) topNav.style.display = "flex";
        updatePremiumAccountInfo();
        if(premiumBar) premiumBar.style.display = "flex";
        if(typeof renderRoomsInLobby === 'function'){
            renderRoomsInLobby();
        }
    }

    if(gameState === "ORBIT"){
        if(canvas) canvas.style.display = "block";
        if(orbitExit) orbitExit.style.display = "block";
        if(resourceBar) resourceBar.style.display = "flex";
        if(ui) ui.style.display = "none";

        if(typeof scene !== "undefined" && typeof solarSystem !== "undefined" && !scene.children.includes(solarSystem)){
            scene.add(solarSystem);
        }

        resetOrbitView(true);
        updateHUD();
    }

   if(gameState === "COMBAT"){
    alert("⚔ Combat Mode (в разработке)");
}

if(gameState === "BATTLE"){
    if(battleScreen) battleScreen.style.display = "block";
    updateBattlePlayerHud();

    if(canvas){
        canvas.style.display = "block";

        setTimeout(() => {
            safeRequestPointerLock(canvas);
        }, 100);
    }

    if(typeof scene !== "undefined" && typeof solarSystem !== "undefined" && scene.children.includes(solarSystem)){
        scene.remove(solarSystem);
    }

    const targetMap = currentRoom?.map || selectedLobbyMap?.real || selectedLobbyMap?.name || "Земля";
    battleObserverMode = false;
    enterBattleMap(targetMap);
    initBattleChat();
    if(battleObserverMode){
        setupObserverBattle(targetMap);
        const hud = document.getElementById('enemy-hud'); if(hud) hud.style.display = 'none';
        const cross = document.getElementById('battle-crosshair'); if(cross) cross.style.display = 'none';
    } else {
        const cross = document.getElementById('battle-crosshair'); if(cross) cross.style.display = 'block';
        spawnPlayer();
        updateEnemyHud();
        updateBattleScoreboard();
        startLiveBattleSync();
    }
}

if(gameState === "OBSERVE"){
    battleObserverMode = true;
    updateBattlePlayerHud();
    if(battleScreen) battleScreen.style.display = "block";
    if(canvas){
        canvas.style.display = "block";
        setTimeout(() => {
            safeRequestPointerLock(canvas);
        }, 100);
    }
    if(typeof scene !== "undefined" && typeof solarSystem !== "undefined" && scene.children.includes(solarSystem)){
        scene.remove(solarSystem);
    }
    const targetMap = currentRoom?.map || selectedLobbyMap?.real || selectedLobbyMap?.name || "Земля";
    setupObserverBattle(targetMap);
    const hud = document.getElementById('enemy-hud'); if(hud) hud.style.display = 'none';
    const cross = document.getElementById('battle-crosshair'); if(cross) cross.style.display = 'none';
    const chatBox = document.getElementById('battle-chat-box'); if(chatBox) chatBox.classList.add('hidden');
    startLiveBattleSync();
    setTimeout(() => {
        loadChatHistory?.("battle");
        renderBattleMessages?.();
    }, 50);
}

if(gameState === "INVENTORY"){
    alert("📦 Inventory (в разработке)");
}

stopLiveRoomsRefresh();

setTimeout(() => {
    try{ handleChatStateChange?.(); }catch(_){ }
}, 0);
}

/* ================= CREATE MATCH LOGIC ================= */

const createMatchBtn = document.getElementById("create-match-btn");
const createWindow = document.getElementById("create-match-window");
const cancelCreate = document.getElementById("cancel-create");

if (createMatchBtn) {
    createMatchBtn.addEventListener("click", () => {

        if(createWindow){
            createWindow.classList.remove("hidden");
            
        }

    });
}

if(cancelCreate){
    cancelCreate.addEventListener("click", () => {

        if(createWindow){
            createWindow.classList.add("hidden");
        }

    });
}



window.switchState = switchState;




// ===============================
// REALISTIC PLANET SIZE SCALE
// ===============================

const EARTH_RADIUS = 2; // Базовый размер Земли

const PLANET_SIZES = {
  mercury: EARTH_RADIUS * 0.38,
  venus: EARTH_RADIUS * 0.95,
  earth: EARTH_RADIUS,
  mars: EARTH_RADIUS * 0.53,
  jupiter: EARTH_RADIUS * 3.5,   // уменьшено для игрового баланса
  saturn: EARTH_RADIUS * 3.2,
  uranus: EARTH_RADIUS * 2,
  neptune: EARTH_RADIUS * 2
};

const PLANET_NAME_MAP = {
  "Меркурий": "mercury",
  "Венера": "venus",
  "Земля": "earth",
  "Марс": "mars",
  "Юпитер": "jupiter",
  "Сатурн": "saturn",
  "Уран": "uranus",
  "Нептун": "neptune"
};

const RESOURCE_REGEN_INTERVAL_MS = 10 * 60 * 1000;

function formatRegenTime(ms){
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const PLANETS = {

    // PLANET CONFIG
    // ===============================


  mercury: {
    name: "Mercury",
    resources: ["iron", "ice"],
    dropChances: {
      coins: 0.05,      // 5%
      crystals: 0.005   // 0.5%
    }
  },

  mars: {
    name: "Mars",
    resources: ["ironOxide", "ice"],
    dropChances: {
      coins: 0.06,
      crystals: 0.01
    }
  },

  outer: {
    name: "OuterPlanets",
    resources: ["hydrogen", "helium"],
    dropChances: {
      coins: 0.08,
      crystals: 0.02
    }
  }

}

// ===============================
// PLAYER RESOURCES (GLOBAL)
// ===============================

const playerResources = {

  mercury_ore: 0,
  venus_gas: 0,
  earth_water: 0,
  mars_crystal: 0,
  jupiter_hydrogen: 0,
  saturn_ice: 0,
  uranus_ammonia: 0,
  neptune_methane: 0,
  solar_energy: 0,

  coins: 0,
  crystals: 0
}

const RESOURCE_SYNC_KEYS = [
  'mercury_ore',
  'venus_gas',
  'earth_water',
  'mars_crystal',
  'jupiter_hydrogen',
  'saturn_ice',
  'uranus_ammonia',
  'neptune_methane',
  'solar_energy',
  'crystals'
];

let remotePlayerSyncTimer = null;

function applyPlayerResourcesFromRow(row = {}) {
  if(!row || typeof row !== 'object') return;

  RESOURCE_SYNC_KEYS.forEach(key => {
    if(typeof row[key] !== 'undefined' && row[key] !== null){
      playerResources[key] = Number(row[key]) || 0;
    }
  });

  if(typeof row.credits !== 'undefined' && row.credits !== null){
    const creditsValue = Number(row.credits) || 0;
    player.credits = creditsValue;
    playerResources.coins = creditsValue;
  }

  updatePremiumAccountInfo?.();
  updateHUD?.();
  updateUI?.();
  inventory.syncFromPlayerResources?.();
  inventory.render?.();
}

function getPlayerResourceColumnsSelect(){
  return ['credits', ...RESOURCE_SYNC_KEYS, 'staff_role', 'is_banned', 'ban_reason', 'ban_until', 'is_muted', 'mute_reason', 'mute_until'].join(',');
}

async function loadPlayerResourcesFromSupabase(){
  if(!window.supabaseReady || !window.supabaseClient || authState.mode !== 'account' || !authState.playerId) return null;

  try{
    const { data, error } = await window.supabaseClient
      .from('players')
      .select(getPlayerResourceColumnsSelect())
      .eq('public_id', authState.playerId)
      .maybeSingle();

    if(error){
      console.warn('Не удалось загрузить ресурсы игрока:', error.message);
      return null;
    }

    if(data){
      applyPlayerIdentityRow(data);
      applyPlayerResourcesFromRow(data);
      const isMutedNow = !!data.is_muted && (!data.mute_until || new Date(data.mute_until).getTime() > Date.now());
      window.playerMuted = isMutedNow;
      player.isMuted = isMutedNow;
      player.muteReason = data.mute_reason || '';
      player.muteUntil = data.mute_until || null;

      if(data.is_banned && (!data.ban_until || new Date(data.ban_until).getTime() > Date.now())){
        stopRemotePlayerSync();
        showAuthMessage?.('Аккаунт заблокирован: ' + (data.ban_reason || 'без причины'));
        setTimeout(() => logoutToAuth('Аккаунт заблокирован: ' + (data.ban_reason || 'без причины')), 50);
      }
    }

    return data || null;
  }catch(error){
    console.warn('Ошибка загрузки ресурсов игрока:', error?.message || error);
    return null;
  }
}

function startRemotePlayerSync(){
  if(remotePlayerSyncTimer) clearInterval(remotePlayerSyncTimer);
  if(authState.mode !== 'account' || !authState.playerId) return;
  remotePlayerSyncTimer = setInterval(() => {
    loadPlayerResourcesFromSupabase();
  }, 3000);
}

function stopRemotePlayerSync(){
  if(remotePlayerSyncTimer){
    clearInterval(remotePlayerSyncTimer);
    remotePlayerSyncTimer = null;
  }
}

// Active planet (стартуем с Меркурия)
let activePlanet = PLANETS.mercury

/* ================= CORE ENGINE ================= */

const scene = new THREE.Scene();

let spawnPointA = new THREE.Vector3(0, 0, -20);
let spawnPointB = new THREE.Vector3(10, 0, -20);
const solarSystem = new THREE.Group();
scene.add(solarSystem);

//* ===== STARFIELD FOR LOBBY ===== */

const starGeometry = new THREE.BufferGeometry();
const starCount = 2000;

const positions = [];

for(let i=0;i<starCount;i++){
    positions.push(
        (Math.random()-0.5)*2000,
        (Math.random()-0.5)*2000,
        (Math.random()-0.5)*2000
    );
}

starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions,3)
);

const starMaterial = new THREE.PointsMaterial({
    size:1,
    color:0xffffff
});

const stars = new THREE.Points(starGeometry,starMaterial);
scene.add(stars);


const orbitNebulaGroup = new THREE.Group();
orbitNebulaGroup.visible = false;
scene.add(orbitNebulaGroup);

function createNebulaSpriteTexture(coreColor = 'rgba(255,255,255,0.30)', edgeColor = 'rgba(255,255,255,0.0)'){
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 14, 128, 128, 128);
    gradient.addColorStop(0, coreColor);
    gradient.addColorStop(0.38, 'rgba(180,220,255,0.10)');
    gradient.addColorStop(1, edgeColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createOrbitNebula(){
    const spritePalettes = [
        ['rgba(70,120,255,0.22)','rgba(20,30,70,0.0)'],
        ['rgba(120,255,220,0.14)','rgba(20,50,45,0.0)'],
        ['rgba(255,170,120,0.12)','rgba(60,35,20,0.0)'],
        ['rgba(190,140,255,0.12)','rgba(50,25,65,0.0)']
    ];

    for(let i = 0; i < 18; i++){
        const palette = spritePalettes[i % spritePalettes.length];
        const texture = createNebulaSpriteTexture(palette[0], palette[1]);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            depthTest: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(
            (Math.random() - 0.5) * 1700,
            (Math.random() - 0.5) * 900,
            -700 - Math.random() * 700
        );
        const scale = 260 + Math.random() * 420;
        sprite.scale.set(scale, scale * (0.56 + Math.random() * 0.35), 1);
        sprite.material.rotation = Math.random() * Math.PI * 2;
        orbitNebulaGroup.add(sprite);
    }

    const gasGeometry = new THREE.BufferGeometry();
    const gasCount = 3000;
    const gasPositions = [];
    for(let i = 0; i < gasCount; i++){
        gasPositions.push(
            (Math.random() - 0.5) * 1800,
            (Math.random() - 0.5) * 1000,
            -900 - Math.random() * 1200
        );
    }
    gasGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gasPositions, 3));

    const gasMaterial = new THREE.PointsMaterial({
        size: 3.2,
        color: 0xaed6ff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const gasPoints = new THREE.Points(gasGeometry, gasMaterial);
    orbitNebulaGroup.add(gasPoints);
}

createOrbitNebula();

const camera = new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.1,
2000
);

camera.position.z = 25;

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);



// === BACKGROUND MUSIC (HTML AUDIO) ===
const bgMusic = new Audio("audio/bg.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.4;

function saveGameSettings(){
    localStorage.setItem("cosmicGameSettings", JSON.stringify(gameSettings));
}

function loadGameSettings(){
    try{
        const raw = localStorage.getItem("cosmicGameSettings");
        if(!raw) return;
        const saved = JSON.parse(raw);
        if(typeof saved.mouseSensitivity === "number") gameSettings.mouseSensitivity = saved.mouseSensitivity;
        if(typeof saved.invertY === "boolean") gameSettings.invertY = saved.invertY;
        if(typeof saved.soundEnabled === "boolean") gameSettings.soundEnabled = saved.soundEnabled;
        if(typeof saved.soundVolume === "number") gameSettings.soundVolume = saved.soundVolume;
        if(typeof saved.musicEnabled === "boolean") gameSettings.musicEnabled = saved.musicEnabled;
        if(typeof saved.musicVolume === "number") gameSettings.musicVolume = saved.musicVolume;
    }catch(error){
        console.warn("Не удалось загрузить настройки:", error);
    }
}

function updateSettingsLabels(){
    const mouseValue = document.getElementById("mouse-sensitivity-value");
    const soundValue = document.getElementById("sound-volume-value");
    const musicValue = document.getElementById("music-volume-value");

    if(mouseValue) mouseValue.textContent = gameSettings.mouseSensitivity.toFixed(2) + "x";
    if(soundValue) soundValue.textContent = Math.round(gameSettings.soundVolume * 100) + "%";
    if(musicValue) musicValue.textContent = Math.round(gameSettings.musicVolume * 100) + "%";
}

function applyAudioSettings(){
    mouseSensitivity = 0.004 * gameSettings.mouseSensitivity;

    bgMusic.muted = !gameSettings.musicEnabled;
    bgMusic.volume = BASE_BG_MUSIC_VOLUME * gameSettings.musicVolume;

    if(typeof clickSound !== "undefined" && clickSound.buffer){
        clickSound.setVolume(BASE_CLICK_VOLUME * (gameSettings.soundEnabled ? gameSettings.soundVolume : 0));
    }

    if(typeof bossMusic !== "undefined" && bossMusic.buffer){
        bossMusic.setVolume(BASE_BOSS_MUSIC_VOLUME * (gameSettings.musicEnabled ? gameSettings.musicVolume : 0));
    }
}

function initSettingsUI(){
    loadGameSettings();

    const settingsTab = document.getElementById("settings-tab");
    const settingsWindow = document.getElementById("settings-window");
    const closeSettings = document.getElementById("close-settings");
    const saveNicknameBtn = document.getElementById("save-nickname-btn");
    const premiumLogoutBtn = document.getElementById("premium-logout-btn");

    const mouseInput = document.getElementById("mouse-sensitivity");
    const invertY = document.getElementById("invert-y");
    const soundEnabled = document.getElementById("sound-enabled");
    const soundVolume = document.getElementById("sound-volume");
    const musicEnabled = document.getElementById("music-enabled");
    const musicVolume = document.getElementById("music-volume");

    if(mouseInput) mouseInput.value = String(gameSettings.mouseSensitivity);
    if(invertY) invertY.checked = gameSettings.invertY;
    if(soundEnabled) soundEnabled.checked = gameSettings.soundEnabled;
    if(soundVolume) soundVolume.value = String(gameSettings.soundVolume);
    if(musicEnabled) musicEnabled.checked = gameSettings.musicEnabled;
    if(musicVolume) musicVolume.value = String(gameSettings.musicVolume);

    updateSettingsLabels();
    applyAudioSettings();

    if(settingsTab && settingsWindow){
        settingsTab.addEventListener("click", () => {
            settingsWindow.classList.remove("hidden");
            updateNicknameSettingsState();
        });
    }

    if(closeSettings && settingsWindow){
        closeSettings.addEventListener("click", () => {
            settingsWindow.classList.add("hidden");
        });
    }


    if(saveNicknameBtn && !saveNicknameBtn.dataset.bound){
        saveNicknameBtn.dataset.bound = '1';
        saveNicknameBtn.addEventListener('click', saveNicknameFromSettings);
    }

    if(premiumLogoutBtn && !premiumLogoutBtn.dataset.bound){
        premiumLogoutBtn.dataset.bound = '1';
        premiumLogoutBtn.addEventListener('click', () => logoutToAuth('Выход выполнен. Теперь можно сменить аккаунт или сервер.'));
    }

    if(mouseInput){
        mouseInput.addEventListener("input", () => {
            gameSettings.mouseSensitivity = parseFloat(mouseInput.value);
            updateSettingsLabels();
            applyAudioSettings();
            saveGameSettings();
        });
    }

    if(invertY){
        invertY.addEventListener("change", () => {
            gameSettings.invertY = invertY.checked;
            saveGameSettings();
        });
    }

    if(soundEnabled){
        soundEnabled.addEventListener("change", () => {
            gameSettings.soundEnabled = soundEnabled.checked;
            applyAudioSettings();
            saveGameSettings();
        });
    }

    if(soundVolume){
        soundVolume.addEventListener("input", () => {
            gameSettings.soundVolume = parseFloat(soundVolume.value);
            updateSettingsLabels();
            applyAudioSettings();
            saveGameSettings();
        });
    }

    if(musicEnabled){
        musicEnabled.addEventListener("change", () => {
            gameSettings.musicEnabled = musicEnabled.checked;
            applyAudioSettings();
            saveGameSettings();
        });
    }

    if(musicVolume){
        musicVolume.addEventListener("input", () => {
            gameSettings.musicVolume = parseFloat(musicVolume.value);
            updateSettingsLabels();
            applyAudioSettings();
            saveGameSettings();
        });
    }
}

/* ================= SIMPLE SOUND ================= */

const listener = new THREE.AudioListener();
camera.add(listener);

const audioLoader = new THREE.AudioLoader();

const clickSound = new THREE.Audio(listener);
const bossMusic = new THREE.Audio(listener);
let bgLoaded = false;

// ЗАГРУЗКА ЗВУКОВ

audioLoader.load("audio/click.mp3", function(buffer){
    clickSound.setBuffer(buffer);
    applyAudioSettings();
});

audioLoader.load("audio/boss.mp3", function(buffer){
    bossMusic.setBuffer(buffer);
    bossMusic.setLoop(true);
    applyAudioSettings();
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/* ================= PLANET TEXTURES ================= */

const textureLoader = new THREE.TextureLoader();

const earthDiffuse = textureLoader.load("textures/earth_diffuse.jpg");
earthDiffuse.colorSpace = THREE.SRGBColorSpace;
const earthClouds = textureLoader.load("textures/earth_clouds.png");

const earthNormal = textureLoader.load("textures/earth_normal.jpg");
const earthSpecular = textureLoader.load("textures/earth_specular.jpg");


/* ================= PLANET SYSTEM ================= */

class Planet {

constructor(name,level,isBoss=false,resourceType="iron"){

this.name = name;
this.level = level;
this.isBoss = isBoss;
this.resourceType = resourceType;

this.unlocked = true;

// ================= RESOURCE SYSTEM =================

this.maxResourceAmount = 100 + level * 50;
this.currentResourceAmount = this.maxResourceAmount;

this.resourceRegenTime = RESOURCE_REGEN_INTERVAL_MS;
this.lastResourceRegenAt = null;
this.radius = 0;

this.mesh = this.createMesh();
this.resourceLabel = this.createResourceLabel();

}

/* ================= ORBIT + MESH ================= */

createMesh(){

this.orbitRadius = 25 + this.level * 20;
this.orbitSpeed = 0.02 / Math.sqrt(this.orbitRadius);

this.orbitPivot = new THREE.Object3D();
solarSystem.add(this.orbitPivot);

// orbit line
const curve = new THREE.EllipseCurve(
0,0,
this.orbitRadius,this.orbitRadius,
0,2*Math.PI,false,0
);

const points = curve.getPoints(100);
const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);

const orbitMaterial = new THREE.LineBasicMaterial({
color:0xffffff,
transparent:true,
opacity:0.25
});

const orbitLine = new THREE.LineLoop(orbitGeometry,orbitMaterial);
orbitLine.rotation.x = Math.PI/2;
solarSystem.add(orbitLine);

// ================= SIZE UPDATE =================

// определяем реальный размер планеты
let radius;

if(this.isBoss){
    radius = 6;
}else{
    const key = PLANET_NAME_MAP[this.name];
    radius = PLANET_SIZES[key] || 4;
}

this.radius = radius;

const geometry = new THREE.SphereGeometry(
radius,
64,
64
);

const material = new THREE.MeshStandardMaterial({
map: earthDiffuse,
normalMap: earthNormal,
metalness:0.2,
roughness:0.8
});

/* ВАЖНО — теперь mesh это this.mesh */
this.mesh = new THREE.Mesh(geometry,material);

this.mesh.position.x = this.orbitRadius;
this.mesh.userData.planet = this;
this.mesh.userData.radius = radius;

this.orbitPivot.add(this.mesh);


// ===============================
// EARTH CLOUDS
// ===============================

if(this.name === "Земля"){

    const cloudGeometry = new THREE.SphereGeometry(
        radius * 1.01, // меньше зазор
        64,
        64
    );

    const cloudMaterial = new THREE.MeshLambertMaterial({
        map: earthClouds,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
    });

    this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);

    this.mesh.add(this.cloudMesh);
}



// ===============================
// SATURN RING (GAME REALISTIC)
// ===============================

if (this.name === "Сатурн") {

    const innerRadius = radius * 1.5;
    const outerRadius = radius * 2.6;

    const ringGeometry = new THREE.RingGeometry(
        innerRadius,
        outerRadius,
        256
    );

    // создаём мягкий градиент прозрачности
    const pos = ringGeometry.attributes.position;
    const colors = [];

    for (let i = 0; i < pos.count; i++) {

        const x = pos.getX(i);
        const y = pos.getY(i);

        const dist = Math.sqrt(x * x + y * y);
        const t = (dist - innerRadius) / (outerRadius - innerRadius);

        // светлее в центре, темнее к краям
        const shade = 1.0 - t * 0.5;

        colors.push(shade, shade * 0.9, shade * 0.8);
    }

    ringGeometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3)
    );

    ringGeometry.rotateX(-Math.PI / 2);

    const ringMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        roughness: 1,
        metalness: 0,
        depthWrite: false
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);

    ring.rotation.z = THREE.MathUtils.degToRad(27);

    this.mesh.add(ring);
}



/* сохраняем правильную позицию для возврата */
this.originalLocalPosition = this.mesh.position.clone();

return this.mesh;
}

/* ================= RESOURCE LABEL ================= */

createResourceLabel(){

const canvas = document.createElement("canvas");
canvas.width = 512;
canvas.height = 128;

const ctx = canvas.getContext("2d");

const texture = new THREE.CanvasTexture(canvas);

const material = new THREE.SpriteMaterial({
map: texture,
transparent: true
});

const sprite = new THREE.Sprite(material);

sprite.scale.set(12,3,1);
this.mesh.add(sprite);

this.resourceCanvas = canvas;
this.resourceContext = ctx;
this.resourceTexture = texture;
this.resourceLabel = sprite;
this.updateResourceLabelPosition(false);

return sprite;
}

updateResourceLabelPosition(isFocused = false){
if(!this.resourceLabel) return;
const currentScale = this.mesh?.scale?.y || 1;
const baseOffset = (this.radius || 4) * (isFocused ? currentScale : 1) + (isFocused ? 6.5 : 4.2);
this.resourceLabel.position.set(0, -baseOffset, 0);
}

getNextRegenRemainingMs(){
if(this.currentResourceAmount >= this.maxResourceAmount || !this.lastResourceRegenAt) return 0;
const elapsed = Date.now() - this.lastResourceRegenAt;
return Math.max(0, this.resourceRegenTime - elapsed);
}

updateResourceLabel(){

if(!this.resourceContext) return;

const ctx = this.resourceContext;
const canvas = this.resourceCanvas;

ctx.clearRect(0,0,canvas.width,canvas.height);

ctx.fillStyle = "white";
ctx.textAlign = "center";
ctx.shadowColor = 'rgba(0,0,0,0.55)';
ctx.shadowBlur = 6;

ctx.font = "42px Arial";
ctx.fillText(this.name, canvas.width/2, 35);

const resourceInfoForPlanet = resourceInfo[this.resourceType] || { name:'Ресурс' };
ctx.font = "30px Arial";
ctx.fillText(`${resourceInfoForPlanet.name}: ${this.currentResourceAmount} / ${this.maxResourceAmount}`, canvas.width/2, 75);

if(this.currentResourceAmount < this.maxResourceAmount && this.lastResourceRegenAt){
const remaining = this.getNextRegenRemainingMs();
ctx.font = "28px Arial";
ctx.fillText(`+1 через ${formatRegenTime(remaining)}`, canvas.width/2, 110);
}

this.updateResourceLabelPosition(selectedPlanet === this);
this.resourceTexture.needsUpdate = true;
}

updateResourceSystem(){

if(this.currentResourceAmount < this.maxResourceAmount && this.lastResourceRegenAt){
const elapsed = Date.now() - this.lastResourceRegenAt;
if(elapsed >= this.resourceRegenTime){
const steps = Math.floor(elapsed / this.resourceRegenTime);
this.currentResourceAmount = Math.min(this.maxResourceAmount, this.currentResourceAmount + steps);
if(this.currentResourceAmount >= this.maxResourceAmount){
this.lastResourceRegenAt = null;
}else{
this.lastResourceRegenAt += steps * this.resourceRegenTime;
}
updateUI?.();
updateHUD?.();
}
}

this.updateResourceLabel();

}

updateOrbit(){

// вращаем pivot (орбиту)
this.orbitPivot.rotation.y += this.orbitSpeed;

}

}

/* ================= SUN ================= */

const sunGeometry = new THREE.SphereGeometry(8, 64, 64);

const sunMaterial = new THREE.MeshStandardMaterial({
    emissive: 0xffaa00,
    emissiveIntensity: 2,
    color: 0xffdd88,
    roughness: 1,
    metalness: 0
});

const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0,0,0);

solarSystem.add(sun);

const sunOrbitData = {
    name: "Солнце",
    level: 0,
    isBoss: false,
    resourceType: "solar_energy",
    unlocked: true,
    maxResourceAmount: 600,
    currentResourceAmount: 600,
    resourceRegenTime: RESOURCE_REGEN_INTERVAL_MS,
    lastResourceRegenAt: null,
    mesh: sun,
    orbitPivot: solarSystem,
    originalLocalPosition: sun.position.clone(),
    radius: 8,
    orbitSpeed: 0
};
sun.userData.planet = sunOrbitData;
sun.userData.radius = 8;
sunOrbitData.createResourceLabel = Planet.prototype.createResourceLabel;
sunOrbitData.updateResourceLabelPosition = Planet.prototype.updateResourceLabelPosition;
sunOrbitData.getNextRegenRemainingMs = Planet.prototype.getNextRegenRemainingMs;
sunOrbitData.updateResourceLabel = Planet.prototype.updateResourceLabel;
sunOrbitData.updateResourceSystem = Planet.prototype.updateResourceSystem;
sunOrbitData.updateOrbit = function(){
    this.mesh.rotation.y += 0.0015;
};
sunOrbitData.createResourceLabel();

/* ================= LIGHTING ================= */

scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const sunLight = new THREE.PointLight(0xffffff, 5, 5000);
sunLight.position.set(0,0,0);
scene.add(sunLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(300, 300, 300);
scene.add(directionalLight);

/* ================= GAME STATE ================= */

let points = 0;
let critChance = 0;
let autoDamage = 0;

const realNames = [
"Меркурий",
"Венера",
"Земля",
"Марс",
"Юпитер",
"Сатурн",
"Уран",
"Нептун"
];

/* ================= MAP DATA ================= */

const MAPS = [
    { id: 0, name: "Меркурий", img: "maps/mercury.jpg" },
    { id: 1, name: "Венера", img: "maps/venus.jpg" },
    { id: 2, name: "Земля", img: "maps/earth.jpg" },
    { id: 3, name: "Марс", img: "maps/mars.jpg" },
    { id: 4, name: "Юпитер", img: "maps/jupiter.jpg" },
    { id: 5, name: "Сатурн", img: "maps/saturn.jpg" },
    { id: 6, name: "Уран", img: "maps/uranus.jpg" },
    { id: 7, name: "Нептун", img: "maps/neptune.jpg" },
    { id: 8, name: "Солнце", img: "maps/sun.jpg" }
];

/* ================= RESOURCE MAP ================= */

const planetResources = {

"Меркурий": ["mercury_ore"],
"Венера": ["venus_gas"],
"Земля": ["earth_water"],
"Марс": ["mars_crystal"],
"Юпитер": ["jupiter_hydrogen"],
"Сатурн": ["saturn_ice"],
"Уран": ["uranus_ammonia"],
"Нептун": ["neptune_methane"],
"Солнце": ["solar_energy"]

};

/* ================= RESOURCE INFO ================= */

const resourceInfo = {

"mercury_ore": { icon: "🪨", name: "Руда" },
"venus_gas": { icon: "☁️", name: "Газ" },
"earth_water": { icon: "💧", name: "Вода" },
"mars_crystal": { icon: "🔴", name: "Кристалл" },
"jupiter_hydrogen": { icon: "🌪", name: "Водород" },
"saturn_ice": { icon: "🧊", name: "Лёд" },
"uranus_ammonia": { icon: "🧪", name: "Аммиак" },
"neptune_methane": { icon: "🔵", name: "Метан" },
"solar_energy": { icon: "⚡", name: "Энергия" },

"coins": { icon: "🪙", name: "Монеты" },
"crystals": { icon: "💎", name: "Кристаллы" }

};

const planets = [];

/* Создаём только реальные планеты */
for(let i = 0; i < realNames.length; i++){

const name = realNames[i];

planets.push(
new Planet(
name,
i+1,
false,
planetResources[name]
)
);

}

let currentLevel = 1;
let damage = 1;

let selectedPlanet = null;
let isPlanetFocused = false;

function getCurrentPlanet(){
return planets[currentLevel-1];
}

/* ================= UI ================= */

const planetNameEl = document.getElementById("planetName");
const hpBarEl = document.getElementById("hpBar");
const hpTextEl = document.getElementById("hpText");
const levelTextEl = document.getElementById("levelText");
const damageTextEl = document.getElementById("damageText");
const structuresUIEl = document.getElementById("structuresUI");
const pointsTextEl = document.getElementById("pointsText");

function updateUI(){

const planet = getCurrentPlanet();
if(!planet || !planetNameEl || !hpBarEl || !hpTextEl || !levelTextEl || !damageTextEl || !structuresUIEl || !pointsTextEl) return;

planetNameEl.innerText = planet.name;

hpBarEl.style.width = (planet.currentResourceAmount/planet.maxResourceAmount*100)+"%";
hpTextEl.innerText =
Math.floor(planet.currentResourceAmount)+" / "+
planet.maxResourceAmount;


levelTextEl.innerText = currentLevel;
damageTextEl.innerText = damage;
pointsTextEl.innerText = points;

structuresUIEl.innerHTML="";

const row = document.createElement("div");

if(planet.currentResourceAmount < planet.maxResourceAmount && planet.lastResourceRegenAt){

row.innerText =
"Следующий ресурс через: "+
formatRegenTime(planet.getNextRegenRemainingMs());

}else{

row.innerText =
"Ресурсы полные";

}

structuresUIEl.appendChild(row);

}


/* ================= CAMERA ================= */

let isObservationMode = false;

let cameraTargetPosition = new THREE.Vector3();
let cameraTargetLookAt = new THREE.Vector3();

// стартовая игровая позиция
camera.position.set(0, 60, 140);
camera.lookAt(0, 0, 0);

function updateCamera(){

    if(isObservationMode){
        // лёгкий дрейф в режиме наблюдения
        const time = Date.now() * 0.00001;

        camera.position.x += Math.sin(time) * 0.01;
        camera.position.z += Math.cos(time) * 0.01;

        camera.lookAt(0, 0, 0);
    }

}

function toggleObservationMode(){

    isObservationMode = !isObservationMode;

    if(isObservationMode){
        // Переход в режим наблюдения
        cameraTargetPosition.set(0, 80, 160);
        cameraTargetLookAt.set(0, 0, 0);
    }else{
        // Возврат в игровой режим
        cameraTargetPosition.set(0, 40, 90);
        cameraTargetLookAt.set(0, 0, 0);
    }

}

window.addEventListener("keydown",(e)=>{

    if(e.key === "Escape"){

        if(selectedPlanet){

            const planet = selectedPlanet;

            // вернуть в pivot
            scene.remove(planet.mesh);
            planet.orbitPivot.add(planet.mesh);

            // ставим строго на радиус
            planet.mesh.position.set(
                planet.orbitRadius,
                0,
                0
            );

            planet.mesh.scale.set(1,1,1);
            planet.updateResourceLabelPosition?.(false);

            selectedPlanet = null;
            isPlanetFocused = false;

        } else {

            toggleObservationMode();

        }

    }

});

/* ================= CLICK SYSTEM ================= */

window.addEventListener("click",(event)=>{

    if(gameState !== "ORBIT" && gameState !== "BATTLE") return;

    if (bgMusic.paused && gameSettings.musicEnabled) {
        bgMusic.play().catch(() => {});
    }

    mouse.x = (event.clientX / window.innerWidth)*2 -1;
    mouse.y = -(event.clientY / window.innerHeight)*2 +1;

    raycaster.setFromCamera(mouse,camera);

    const orbitTargets = [sun, ...planets.map(p=>p.mesh)];
    const intersects = raycaster.intersectObjects(
        orbitTargets,
        true
    );

    if(intersects.length === 0) return;

    const clickedMesh = intersects[0].object;

    const planet = (clickedMesh === sun || clickedMesh.parent === sun)
        ? sunOrbitData
        : planets.find(p =>
            p.mesh === clickedMesh ||
            p.mesh.children.includes(clickedMesh)
        );

    if(!planet) return;

    const damage = 1;

    if (typeof planet.takeDamage === "function") {
        if (planet.takeDamage(damage)) {
            tryPremiumDrop();
        }
    }

    /* ===== ДОБЫЧА РЕСУРСА ===== */
if(planet.currentResourceAmount > 0){

    planet.currentResourceAmount -= damage;

    if(planet.currentResourceAmount < 0)
        planet.currentResourceAmount = 0;

    const planetResList = planetResources[planet.name] || [];
    const randomResource = planetResList[0];

    if(randomResource){
        if(!playerResources[randomResource])
            playerResources[randomResource] = 0;

        playerResources[randomResource] += damage;
        inventory.addResource(randomResource, damage, planet.name);
    }

    playEffectSound(clickSound);

    if(!planet.lastResourceRegenAt){
        planet.lastResourceRegenAt = Date.now();
    }

    updateUI();
    updateHUD();
}

/* ===== ФОКУС ===== */
if(selectedPlanet === planet){
    return;
}

if(selectedPlanet){

    scene.remove(selectedPlanet.mesh);
    selectedPlanet.mesh.position.copy(selectedPlanet.originalLocalPosition);
    selectedPlanet.orbitPivot.add(selectedPlanet.mesh);
    selectedPlanet.mesh.scale.set(1,1,1);
    selectedPlanet.updateResourceLabelPosition?.(false);
}

selectedPlanet = planet;
isPlanetFocused = true;

planet.orbitPivot.remove(planet.mesh);
scene.add(planet.mesh);

const direction = new THREE.Vector3();
camera.getWorldDirection(direction);

planet.mesh.position.copy(
    camera.position.clone().add(direction.multiplyScalar(30))
);

});

/* ================= PLANET DESTROYED ================= */

function handlePlanetDestroyed(){

    const planet = selectedPlanet;
    if(!planet) return;

    planet.mesh.material.emissive.setHex(0x000000);

    setTimeout(()=>{

        // сброс трансформации
        planet.mesh.scale.set(1,1,1);
        planet.mesh.rotation.set(0,0,0);

        scene.remove(planet.mesh);
        planet.orbitPivot.add(planet.mesh);
        planet.mesh.position.set(planet.orbitRadius, 0, 0);

        // 🔥 корректно определяем следующую планету
        const currentIndex = planets.indexOf(planet);
        const nextIndex = currentIndex + 1;

        if(nextIndex < planets.length){

            // ОБНОВЛЯЕМ currentLevel
            currentLevel = nextIndex;

            planets[nextIndex].unlocked = true;
            planets[nextIndex].lockSprite.visible = false;

            // Щиты удалены — вызов убираем
            // planets[nextIndex].createShield();
        }

        planet.updateResourceLabelPosition?.(false);
        selectedPlanet = null;
        isPlanetFocused = false;

        updateUI();

    },800);

}
/* ================= DEBUG MENU ================= */

function createDebugMenu(){

const panel = document.createElement("div");

panel.style.position="fixed";
panel.style.top="20px";
panel.style.right="20px";
panel.style.background="rgba(0,0,0,0.8)";
panel.style.padding="15px";
panel.style.border="1px solid #00ffff";
panel.style.borderRadius="8px";
panel.style.zIndex="9999";
panel.style.color="#00ffff";

panel.innerHTML = `
<b>DEBUG PANEL</b><br><br>
<button id="resetGame">🔄 Reset</button><br><br>
<button id="unlockAll">🌍 Unlock All</button><br><br>
<button id="maxDamage">💥 x10 Damage</button>
`;

document.body.appendChild(panel);

document.getElementById("resetGame").onclick=()=>{
localStorage.removeItem("galaxySave");
location.reload();
};

document.getElementById("unlockAll").onclick=()=>{
planets.forEach(p=>{
p.unlocked=true;



});
};

document.getElementById("maxDamage").onclick=()=>{
damage*=10;
updateUI();
};

}

createDebugMenu();

/* ================= SAVE SYSTEM ================= */

function applySaveData(save){
    if(!save || typeof save !== 'object') return;
    currentLevel = Number(save.level || 1);
    damage = Number(save.damage || 1);
    player.level = Number(save.playerLevel || currentLevel || 1);
    player.credits = Number(save.credits || player.credits || 0);
    playerResources.coins = Number(save.credits || playerResources.coins || player.credits || 0);
    if(save.nickname) player.nickname = String(save.nickname).slice(0, 20);
    if(save.playerResources){
        for(const key in playerResources){
            if(typeof save.playerResources[key] === 'number') playerResources[key] = save.playerResources[key];
        }
    }
    for(let i=0;i<planets.length;i++) planets[i].unlocked = i < currentLevel;
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
}

async function loadRemoteSaveFromSupabase(){
    if(!window.supabaseReady || !window.supabaseClient || authState.mode !== 'account' || !authState.playerId) return null;
    try{
        const { data, error } = await window.supabaseClient
            .from('player_saves')
            .select('save_data')
            .eq('player_public_id', authState.playerId)
            .maybeSingle();
        if(error){
            console.warn('Не удалось загрузить remote save:', error.message);
            return null;
        }
        return data?.save_data || null;
    }catch(error){
        console.warn('Remote save load error:', error?.message || error);
        return null;
    }
}

async function loadGame(){
    const saveKey = getActiveSaveKey();
    if(saveKey){
        const localData = localStorage.getItem(saveKey);
        if(localData){
            try{ applySaveData(JSON.parse(localData)); }catch(error){ console.warn('Ошибка чтения local save:', error); }
        }
    }
    const remoteSave = await loadRemoteSaveFromSupabase();
    if(remoteSave) applySaveData(remoteSave);
}

function buildSavePayload(){
    return {
        level: currentLevel,
        damage: damage,
        credits: player.credits,
        playerLevel: player.level,
        nickname: player.nickname,
        playerResources: playerResources
    };
}

async function saveRemoteProgress(){
    if(!window.supabaseReady || !window.supabaseClient || authState.mode !== 'account' || !authState.playerId) return;
    const payload = buildSavePayload();
    try{
        await window.supabaseClient.from('players').update({
            nickname: player.nickname,
            level: player.level,
            credits: Number(playerResources.coins || player.credits || 0),
            mercury_ore: Number(playerResources.mercury_ore || 0),
            venus_gas: Number(playerResources.venus_gas || 0),
            earth_water: Number(playerResources.earth_water || 0),
            mars_crystal: Number(playerResources.mars_crystal || 0),
            jupiter_hydrogen: Number(playerResources.jupiter_hydrogen || 0),
            saturn_ice: Number(playerResources.saturn_ice || 0),
            uranus_ammonia: Number(playerResources.uranus_ammonia || 0),
            neptune_methane: Number(playerResources.neptune_methane || 0),
            solar_energy: Number(playerResources.solar_energy || 0),
            crystals: Number(playerResources.crystals || 0)
        }).eq('public_id', authState.playerId);

        const { error } = await window.supabaseClient.from('player_saves').upsert({
            player_public_id: authState.playerId,
            save_data: payload,
            updated_at: new Date().toISOString()
        }, { onConflict: 'player_public_id' });
        if(error) console.warn('Не удалось сохранить remote progress:', error.message);
    }catch(error){
        console.warn('Remote progress save error:', error?.message || error);
    }
}

function saveGame(){
    const saveKey = getActiveSaveKey();
    const payload = buildSavePayload();
    if(saveKey){
        localStorage.setItem(saveKey, JSON.stringify(payload));
    }
    saveRemoteProgress();
}

setInterval(() => {
    if(authState?.isAuthenticated) saveGame();
}, 20000);

window.addEventListener('beforeunload', () => {
    try{ saveGame(); }catch(_e){}
});

/* ================= ZOOM ================= */

window.addEventListener("wheel",(e)=>{

camera.position.z += e.deltaY * 0.01;

if(camera.position.z < 10) camera.position.z = 10;
if(camera.position.z > 200) camera.position.z = 200;

});



/* ================= DRAG ROTATION + MOVE MODE ================= */

let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

let velocityX = 0;
let velocityY = 0;

let autoRotateSpeed = 0.0008;
let isMoveMode = false;

// НАЖАТИЕ

renderer.domElement.addEventListener("mousedown",(e)=>{

    // 🔥 ВАЖНО — если не бой, выключаем pointer lock
    if(gameState !== "BATTLE"){
        if(document.pointerLockElement){
            document.exitPointerLock();
        }
    }

    if(gameState !== "ORBIT") return;

    isDragging = true;
    previousMouseX = e.clientX;
    previousMouseY = e.clientY;

    velocityX = 0;
    velocityY = 0;

});

// ДВИЖЕНИЕ
renderer.domElement.addEventListener("mousemove",(e)=>{
    if(!isDragging) return;

    const deltaX = e.clientX - previousMouseX;
    const deltaY = e.clientY - previousMouseY;
    previousMouseX = e.clientX;
    previousMouseY = e.clientY;

    if(isMoveMode){
        solarSystem.position.x += deltaX * 0.05;
        solarSystem.position.y -= deltaY * 0.05;
    } else {
        velocityX = -deltaX * 0.005;
        velocityY = -deltaY * 0.005;
    }
});

// ОТПУСКАНИЕ
renderer.domElement.addEventListener("mouseup",()=>{
    isDragging = false;
});

renderer.domElement.addEventListener("mouseleave",()=>{
    isDragging = false;
});

// SHIFT для перемещения
window.addEventListener("keydown",(e)=>{
    if(e.key === "Shift"){
        isMoveMode = true;
    }
});

window.addEventListener("keyup",(e)=>{
    if(e.key === "Shift"){
        isMoveMode = false;
    }
});

/* ================= RESIZE ================= */

window.addEventListener("resize",()=>{
camera.aspect = window.innerWidth/window.innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(window.innerWidth,window.innerHeight);
});


/* ================= ANIMATION ================= */

function animate(){

    requestAnimationFrame(animate);

    // вращение облаков
    planets.forEach(p => {
        if(p.cloudMesh){
            p.cloudMesh.rotation.y += 0.002;
        }
    });

    // фон
    if(stars){
        stars.rotation.y += 0.0005;
    }
    if(orbitNebulaGroup){
        orbitNebulaGroup.visible = gameState === "ORBIT";
        orbitNebulaGroup.rotation.y += 0.00008;
        orbitNebulaGroup.position.x = Math.sin(Date.now() * 0.00008) * 24;
    }

    // лёгкий parallax у лобби-фона
    const lobbyBg = document.getElementById("lobby-bg");
    if(lobbyBg && gameState === "LOBBY") {
        lobbyParallaxCurrentX += (lobbyParallaxTargetX - lobbyParallaxCurrentX) * 0.06;
        lobbyParallaxCurrentY += (lobbyParallaxTargetY - lobbyParallaxCurrentY) * 0.06;
        lobbyBg.style.transform = `translate3d(${lobbyParallaxCurrentX}px, ${lobbyParallaxCurrentY}px, 0) scale(1.05)`;
    }

    // режим наблюдения
    if(isObservationMode){
        const time = Date.now() * 0.00001;
        camera.position.x += Math.sin(time) * 0.01;
        camera.position.z += Math.cos(time) * 0.01;
    }

    // обновляем орбиты
    planets.forEach(p=>{
        p.updateOrbit();
        p.updateResourceSystem();
    });
    if(typeof sunOrbitData !== 'undefined'){
        sunOrbitData.updateOrbit();
        sunOrbitData.updateResourceSystem();
    }








    // ================= ROTATION SYSTEM =================

    if(!selectedPlanet){

        if(isDragging){

            solarSystem.rotation.y += velocityX;
            solarSystem.rotation.x += velocityY;

        }
        else{

            solarSystem.rotation.y += autoRotateSpeed;

            solarSystem.rotation.y += velocityX;
            solarSystem.rotation.x += velocityY;

            velocityX *= 0.95;
            velocityY *= 0.95;
        }
    }

    // ограничение наклона
    solarSystem.rotation.x = Math.max(
        -Math.PI/2,
        Math.min(Math.PI/2, solarSystem.rotation.x)
    );

    // ===== FOCUS EFFECT =====

    if(selectedPlanet){

        solarSystem.position.z += (-40 - solarSystem.position.z) * 0.08;

        selectedPlanet.mesh.scale.x += 
            (1.8 - selectedPlanet.mesh.scale.x) * 0.08;

        selectedPlanet.mesh.scale.y += 
            (1.8 - selectedPlanet.mesh.scale.y) * 0.08;

        selectedPlanet.mesh.scale.z += 
            (1.8 - selectedPlanet.mesh.scale.z) * 0.08;

        selectedPlanet.updateResourceLabelPosition?.(true);

    }
    else{

        solarSystem.position.z += (0 - solarSystem.position.z) * 0.08;
        planets.forEach(p => p.updateResourceLabelPosition?.(false));
        sunOrbitData.updateResourceLabelPosition?.(false);
    }

    // ================= SHIP MOVEMENT =================

    animateRemoteBattleShips();

const BATTLE_LIMIT = 920;

if (gameState === "BATTLE" && playerShip) {
    updateBattleReloadState();
    if(battleShipCrash){
        updateShipCrashAnimation();
    } else {
    if(firing) tryFireLaser();

    const yawStep = 0.0021 * gameSettings.mouseSensitivity;
    const pitchStep = 0.0017 * gameSettings.mouseSensitivity;
    const invertFactor = gameSettings.invertY ? -1 : 1;
    const maxPitch = Math.PI / 3.1;
    const maxRoll = 0.72;
    const forwardAcceleration = 0.14;
    const backwardAcceleration = 0.07;
    const strafeAcceleration = 0.045;
    const damping = 0.985;
    const maxSpeed = 4.2;

    playerControl.yaw -= mouseDeltaX * yawStep;
    playerControl.pitch += mouseDeltaY * pitchStep * invertFactor;
    playerControl.pitch = THREE.MathUtils.clamp(playerControl.pitch, -maxPitch, maxPitch);

    let targetRoll = THREE.MathUtils.clamp(-mouseDeltaX * 0.01, -maxRoll, maxRoll);
    if (keys.a) targetRoll = Math.min(maxRoll, targetRoll + 0.28);
    if (keys.d) targetRoll = Math.max(-maxRoll, targetRoll - 0.28);
    playerControl.roll += (targetRoll - playerControl.roll) * 0.16;

    playerShip.rotation.order = 'YXZ';
    playerShip.rotation.y = playerControl.yaw;
    playerShip.rotation.x = playerControl.pitch;
    playerShip.rotation.z = playerControl.roll;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerShip.quaternion).normalize();

    if (keys.w) shipVelocity.add(forward.clone().multiplyScalar(forwardAcceleration));
    if (keys.s) shipVelocity.add(forward.clone().multiplyScalar(-backwardAcceleration));
    if (keys.a) shipVelocity.add(right.clone().multiplyScalar(-strafeAcceleration));
    if (keys.d) shipVelocity.add(right.clone().multiplyScalar(strafeAcceleration));

    shipVelocity.clampLength(0, maxSpeed);
    playerShip.position.add(shipVelocity);
    handleBattleCollisions(playerShip, shipVelocity);
    updateBattlePlanetEffects();
    shipVelocity.multiplyScalar(damping);
    }

    mouseDeltaX = 0;
    mouseDeltaY = 0;

    for (let i = activeLasers.length - 1; i >= 0; i--) {
        const laser = activeLasers[i];
        laser.mesh.position.add(laser.velocity);
        laser.life -= 1;

        if (enemyBot && laser.mesh.position.distanceTo(enemyBot.position) < 2.5) {
            enemyBot.userData.hp -= laser.damage;
            scene.remove(laser.mesh);
            activeLasers.splice(i, 1);
            updateEnemyHud();
            if (enemyBot.userData.hp <= 0) {
                spawnShipDebris(enemyBot.position.clone(), 0xff7755);
                scene.remove(enemyBot);
                enemyBot = null;
                battleStats.playerKills += 1;
                battleStats.botDeaths += 1;
                pushKillFeed(`${player?.nickname || 'Commander'} уничтожил ${enemyBot?.userData?.name || 'Drone_x1'}`);
                updateEnemyHud();
                updateBattleScoreboard();
                // live PvP: bot respawn отключен
            }
            continue;
        }

        if (laser.life <= 0) {
            scene.remove(laser.mesh);
            activeLasers.splice(i, 1);
        }
    }

    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        const laser = enemyLasers[i];
        laser.mesh.position.add(laser.velocity);
        laser.life -= 1;

        if (battleObserverMode) {
            let hitObserver = null;
            for (const bot of observerBots) {
                if(bot && bot.userData.alive && (!laser.shooter || laser.shooter !== bot) && laser.mesh.position.distanceTo(bot.position) < 2.0){ hitObserver = bot; break; }
            }
            if(hitObserver){
                hitObserver.userData.hp = Math.max(0, hitObserver.userData.hp - laser.damage);
                if(hitObserver.userData.hp <= 0){
                    spawnShipDebris(hitObserver.position.clone(), 0xffe38a);
                    hitObserver.userData.alive = false;
                    hitObserver.userData.respawnAt = Date.now() + 3000;
                    pushKillFeed(`${laser.shooter?.userData?.name || 'Drone'} уничтожил ${hitObserver.userData.name}`, 'kill');
                    hitObserver.visible = false;
                }
                scene.remove(laser.mesh);
                enemyLasers.splice(i, 1);
                continue;
            }
        }

        if (playerShip && laser.mesh.position.distanceTo(playerShip.position) < 2.1) {
            playerHp = Math.max(0, playerHp - laser.damage);
            if(playerHp <= 0){
                battleStats.botKills += 1;
                battleStats.playerDeaths += 1;
                pushKillFeed(`${enemyBot?.userData?.name || 'Drone_x1'} уничтожил ${player?.nickname || 'Commander'}`);
                updateBattleScoreboard();
                playerHp = playerMaxHp;
                if(playerShip){
                    spawnShipDebris(playerShip.position.clone(), 0x64d8ff);
                    playerShip.position.copy(spawnPointA);
                }
                shipVelocity.set(0,0,0);
            }
            scene.remove(laser.mesh);
            enemyLasers.splice(i, 1);
            continue;
        }

        if (laser.life <= 0) {
            scene.remove(laser.mesh);
            enemyLasers.splice(i, 1);
        }
    }

    if (enemyBot && playerShip) {
        enemyBot.userData.strafePhase += 0.025;
        const desiredForward = playerShip.position.clone().sub(enemyBot.position).normalize();
        const side = new THREE.Vector3(1,0,0).cross(desiredForward).normalize();
        const desiredPos = playerShip.position.clone()
            .add(desiredForward.clone().multiplyScalar(-18))
            .add(side.multiplyScalar(Math.sin(enemyBot.userData.strafePhase) * 7));
        desiredPos.y += Math.cos(enemyBot.userData.strafePhase * 1.7) * 2.2;
        enemyBot.position.lerp(desiredPos, 0.045);
        handleBattleCollisions(enemyBot);
        enemyBot.lookAt(playerShip.position.clone().add(shipVelocity.clone().multiplyScalar(6)));
        enemyBot.rotation.z += ((Math.sin(enemyBot.userData.strafePhase) * 0.45) - enemyBot.rotation.z) * 0.08;

        if (Date.now() - lastBotShotAt > botShotCooldown) {
            lastBotShotAt = Date.now();
            fireBotLaser();
        }
    }

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();
    const desiredPosition = playerShip.position.clone()
        .add(direction.clone().multiplyScalar(-16))
        .add(new THREE.Vector3(0, 5.5, 0));

    camera.position.lerp(desiredPosition, 0.10);
    camera.lookAt(playerShip.position.clone().add(direction.clone().multiplyScalar(35)));
}

updateDebrisPieces();
if((gameState === "BATTLE" || gameState === "OBSERVE") && battleObserverMode){
    updateObserverBattle();
}
limitBattleArea();
updateBattlePlayerHud();
renderer.render(scene,camera);
}


function playEffectSound(sound){
    if(!gameSettings.soundEnabled) return;
    if(!sound || !sound.buffer) return;

    if(sound.isPlaying) sound.stop();
    sound.play();
}

function tryFireLaser(){
    const now = Date.now();
    if(!playerShip || battleShipCrash || battleWeapon.isReloading || now - lastLaserShotAt < laserCooldown) return;
    if(battleWeapon.ammoInClip <= 0){
        startBattleReload();
        return;
    }

    lastLaserShotAt = now;
    battleWeapon.ammoInClip = Math.max(0, battleWeapon.ammoInClip - 1);

    const laserGeometry = new THREE.BoxGeometry(0.14, 0.14, 2.2);
    const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff3355 });
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();

    [-1.1, 1.1].forEach(offsetX => {
        const laserMesh = new THREE.Mesh(laserGeometry, laserMaterial);
        const localOffset = new THREE.Vector3(offsetX, 0, -2.2).applyQuaternion(playerShip.quaternion);
        laserMesh.position.copy(playerShip.position.clone().add(localOffset));
        laserMesh.lookAt(playerShip.position.clone().add(forward));
        scene.add(laserMesh);
        activeLasers.push({
            mesh: laserMesh,
            velocity: forward.clone().multiplyScalar(3.2),
            life: 100,
            damage: battleWeapon.damage
        });
    });

    if(battleWeapon.ammoInClip <= 0){
        startBattleReload();
    }
    updateBattlePlayerHud();
    playEffectSound(clickSound);
}




function formatAmmoReserve(){
    return battleWeapon.reserveAmmo === Infinity ? '∞' : String(battleWeapon.reserveAmmo);
}

function updateBattlePlayerHud(){
    const hud = document.getElementById('battle-player-hud');
    const hpFill = document.getElementById('battle-player-hp-fill');
    const hpText = document.getElementById('battle-player-hp-text');
    const ammoText = document.getElementById('battle-ammo-text');
    const damageText = document.getElementById('battle-damage-text');
    const reloadText = document.getElementById('battle-reload-text');
    if(!hud || !hpFill || !hpText || !ammoText || !damageText || !reloadText) return;
    const visible = gameState === 'BATTLE' && !battleObserverMode;
    hud.style.display = visible ? 'block' : 'none';
    if(!visible) return;
    const hpPercent = THREE.MathUtils.clamp((playerHp / Math.max(1, playerMaxHp)) * 100, 0, 100);
    hpFill.style.width = hpPercent + '%';
    hpText.textContent = `HP: ${Math.round(playerHp)} / ${playerMaxHp}`;
    ammoText.textContent = `Боеприпасы: ${battleWeapon.ammoInClip} / ${battleWeapon.clipSize} | запас ${formatAmmoReserve()}`;
    damageText.textContent = `Урон: ${battleWeapon.damage}`;
    if(battleShipCrash){
        reloadText.textContent = 'Корабль разбивается...';
    }else if(battleWeapon.isReloading){
        const remain = Math.max(0, battleWeapon.reloadEndsAt - Date.now());
        reloadText.textContent = `Перезарядка: ${(remain / 1000).toFixed(1)}с`;
    }else{
        reloadText.textContent = 'R — перезарядка';
    }
}

function startBattleReload(force=false){
    if(gameState !== 'BATTLE' || !playerShip || battleShipCrash) return;
    if(battleWeapon.isReloading) return;
    if(!force && battleWeapon.ammoInClip >= battleWeapon.clipSize) return;
    battleWeapon.isReloading = true;
    battleWeapon.reloadEndsAt = Date.now() + battleWeapon.reloadTime;
    updateBattlePlayerHud();
}

function updateBattleReloadState(){
    if(!battleWeapon.isReloading) return;
    if(Date.now() < battleWeapon.reloadEndsAt) return;
    battleWeapon.isReloading = false;
    battleWeapon.ammoInClip = battleWeapon.clipSize;
    updateBattlePlayerHud();
}

function startShipCrashAnimation(){
    if(!playerShip || !battleMapPlanet || battleShipCrash) return;
    battleShipCrash = {
        startAt: Date.now(),
        duration: 1800,
        startPosition: playerShip.position.clone(),
        targetPosition: battleMapPlanet.position.clone().add(playerShip.position.clone().sub(battleMapPlanet.position).normalize().multiplyScalar((battleMapPlanet.userData?.crashRadius || 0.1) - 0.4))
    };
    firing = false;
    shipVelocity.multiplyScalar(0);
    pushKillFeed(`${player?.nickname || 'Commander'} разбился о планету`, 'kill');
}

function updateShipCrashAnimation(){
    if(!battleShipCrash || !playerShip) return;
    const t = THREE.MathUtils.clamp((Date.now() - battleShipCrash.startAt) / battleShipCrash.duration, 0, 1);
    playerShip.position.lerpVectors(battleShipCrash.startPosition, battleShipCrash.targetPosition, t);
    playerShip.rotation.z += 0.18;
    playerShip.rotation.x += 0.06;
    if(t >= 1){
        spawnShipDebris(playerShip.position.clone(), 0xffa36a);
        battleStats.playerDeaths += 1;
        updateBattleScoreboard();
        battleShipCrash = null;
        spawnPlayer();
    }
}

function updateBattlePlanetEffects(){
    if(!battleMapPlanet || !playerShip || battleObserverMode) return;

    const toPlanet = battleMapPlanet.position.clone().sub(playerShip.position);
    const distance = toPlanet.length();
    const radius = battleMapPlanet.userData?.radius || 50;
    const atmosphereRadius = battleMapPlanet.userData?.atmosphereRadius || radius + 26;
    const crashRadius = battleMapPlanet.userData?.crashRadius || radius + 4;
    const nearSurfaceRadius = battleMapPlanet.userData?.nearSurfaceRadius || radius + 10;

    const scaleBoost = THREE.MathUtils.clamp(1 + ((320 - Math.max(0, distance - radius)) / 320) * 0.5, 1, 1.5);
    battlePlanetVisualScale += (scaleBoost - battlePlanetVisualScale) * 0.08;
    battleMapPlanet.scale.setScalar(battlePlanetVisualScale);

    if(distance <= crashRadius){
        startShipCrashAnimation();
        return;
    }

    if(distance < atmosphereRadius){
        const towardPlanet = toPlanet.clone().normalize();
        const gravityStrength = THREE.MathUtils.clamp((atmosphereRadius - distance) / atmosphereRadius, 0, 1);
        shipVelocity.add(towardPlanet.multiplyScalar(0.028 * gravityStrength));

        if(distance < nearSurfaceRadius){
            shipVelocity.multiplyScalar(0.96);
        }
    }
}
// ===== POINTER LOCK =====
const canvas = renderer.domElement;



document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
        console.log("Pointer locked");
    } else {
        console.log("Pointer unlocked");
    }
});




/* ================= HUD SYSTEM ================= */

function updateHUD(){

    const bar = document.getElementById("resource-bar");
    if(!bar) return;

    let html = "";

    for(const planetName in planetResources){

        html += `<div class="planet-block">`;
        html += `<div class="planet-title">${planetName}</div>`;

        const resources = planetResources[planetName];

        for(const resId of resources){

            if(!playerResources[resId])
                playerResources[resId] = 0;

            const info = resourceInfo[resId];

            html += `
                <div class="resource-item">
                    <span class="icon">${info.icon}</span>
                    <span class="amount">${playerResources[resId]}</span>
                    <span class="tooltip">${info.name}</span>
                </div>
            `;
        }

        html += `</div>`;
    }

    bar.innerHTML = html;
    inventory.syncFromPlayerResources?.();
    if(!playerResources.coins) playerResources.coins = 0;
    if(!playerResources.crystals) playerResources.crystals = 0;
    const premiumBar = document.getElementById('premium-bar');
    const crystalsEl = document.getElementById('premium-crystals');
    const coinsEl = document.getElementById('premium-coins');
    if(crystalsEl) crystalsEl.textContent = `💎 ${playerResources.crystals || 0}`;
    if(coinsEl) coinsEl.textContent = `🪙 ${playerResources.coins || 0}`;
    updatePremiumAccountInfo();
    if(premiumBar){
        premiumBar.style.display = gameState === 'LOBBY' ? 'flex' : 'none';
    }
}

/* ================= PREMIUM DROP SYSTEM ================= */

function tryPremiumDrop() {

    const coinChance = 0.08;      // 8%
    const crystalChance = 0.02;   // 2%

    let dropped = false;

    if (Math.random() < coinChance) {
        playerResources.coins += 1;
        dropped = true;
    }

    if (Math.random() < crystalChance) {
        playerResources.crystals += 1;
        dropped = true;
    }

    if (dropped) {
        updateHUD();
    }
}

initSettingsUI();
initLobbyBackground();
initAuthScreen();
updateHUD();
updateUI();
switchState('AUTH');
animate();

// ===== INVENTORY MANAGER =====

class InventoryManager {
  constructor() {
    this.items = [];
  }

  render(items = this.items) {
    const container = document.getElementById("inventory");
    if (!container) return;

    container.innerHTML = "";

    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "inventory-item";
      div.innerHTML = `
        <span>${item.icon} ${item.name}</span>
        <span>x${item.amount}</span>
      `;
      container.appendChild(div);
    });
  }

  addResource(resourceId, amount = 1, planetName = "") {
    const config = resourceInfo[resourceId];
    if (!config) {
      console.warn("Unknown resource:", resourceId);
      return;
    }

    let existing = this.items.find(r => r.id === resourceId);
    if (existing) {
      existing.amount += amount;
    } else {
      this.items.push({
        id: resourceId,
        name: config.name,
        icon: config.icon,
        planet: planetName,
        amount
      });
    }

    this.items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    this.render();
  }

  syncFromPlayerResources() {
    this.items = [];
    Object.keys(resourceInfo).forEach(resourceId => {
      if(resourceId === 'coins' || resourceId === 'crystals') return;
      const amount = Number(playerResources[resourceId] || 0);
      if(amount > 0){
        this.items.push({
          id: resourceId,
          name: resourceInfo[resourceId].name,
          icon: resourceInfo[resourceId].icon,
          planet: '',
          amount
        });
      }
    });
    this.items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    this.render();
  }
}

inventory = new InventoryManager();
inventory.syncFromPlayerResources();

// ===== INVENTORY UI LOGIC =====

const inventoryButton = document.getElementById("inventory-button");
const inventoryWindow = document.getElementById("inventory-window");
const closeInventory = document.getElementById("close-inventory");

if(inventoryButton && inventoryWindow){
  inventoryButton.addEventListener("click", () => {
    inventoryWindow.classList.toggle("hidden");
  });
}

if(closeInventory && inventoryWindow){
  closeInventory.addEventListener("click", () => {
    inventoryWindow.classList.add("hidden");
  });
}
window.switchState = switchState;
// старт только через AUTH





/* ===== SOLAR SYSTEM MAP DATA ===== */

const mapImages = {

  "Солнце": "maps/sun.jpg",
  "Меркурий": "maps/mercury.jpg",
  "Венера": "maps/venus.jpg",
  "Земля": "maps/earth.jpg",
  "Марс": "maps/mars.jpg",
  "Юпитер": "maps/jupiter.jpg",
  "Сатурн": "maps/saturn.jpg",
  "Уран": "maps/uranus.jpg",
  "Нептун": "maps/neptune.jpg"

};

const mapPlayers = {

  "Солнце": [],
  "Меркурий": [],
  "Венера": [],
  "Земля": [],
  "Марс": [],
  "Юпитер": [],
  "Сатурн": [],
  "Уран": [],
  "Нептун": []

};








/* ===== MATCH SELECT SYSTEM ===== */

const matchItems = document.querySelectorAll(".match-item");
const preview = document.getElementById("map-mini-preview");

matchItems.forEach(item => {

  item.addEventListener("click", () => {

    // убрать выделение со всех
    matchItems.forEach(i => i.classList.remove("selected"));

    // выделить выбранную
    item.classList.add("selected");

  });

});



// ================= MAP SLIDER INIT =================

let currentMapIndex = 0;

const mapImage = document.getElementById("map-image");
const mapName = document.getElementById("map-name");
const prevBtn = document.getElementById("map-prev");
const nextBtn = document.getElementById("map-next");

function updateMap(){
    const map = MAPS[currentMapIndex];

    if(mapImage) mapImage.src = map.img;
    if(mapName) mapName.textContent = map.name;

    console.log("Текущая карта:", map.name);
}

if(prevBtn){
    prevBtn.onclick = () => {
        currentMapIndex = (currentMapIndex - 1 + MAPS.length) % MAPS.length;
        updateMap();
    };
}

if(nextBtn){
    nextBtn.onclick = () => {
        currentMapIndex = (currentMapIndex + 1) % MAPS.length;
        updateMap();
    };
}

updateMap();



/* ================= CHAT SYSTEM ================= */

const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const chatMessages = document.getElementById("chat-messages");
const chatTabsWrap = document.getElementById("chat-tabs");

let currentChat = "global";
let chatRealtimeChannel = null;
const CHAT_MESSAGE_LIMIT = 50;
const chatCache = {
    global: [],
    clan: [],
    battle: [],
    pm: {}
};
const privateChatTabs = {};
const chatUnread = {
    global: 0,
    clan: 0,
    battle: 0,
    pm: {}
};
const onlinePmPeers = new Set();
const inGamePmPeers = new Set();
const CHAT_UI_STATE_KEY = 'cosmicChatUiState:v27';

const playerStaffRoleCache = {};
const STAFF_ROLE_META = {
    player: { short: "", label: "Игрок", color: "#9fd7ff" },
    mod: { short: "mod", label: "Moderator", color: "#ff2a2a" },
    adm: { short: "adm", label: "Admin", color: "#ff8a1c" },
    owr: { short: "owr", label: "Owner", color: "#ffd400" }
};

function normalizeStaffRole(role = "player") {
    const value = String(role || "player").trim().toLowerCase();
    if (value === "mod" || value === "adm" || value === "owr") return value;
    return "player";
}

function getStaffRoleMeta(role = "player") {
    return STAFF_ROLE_META[normalizeStaffRole(role)] || STAFF_ROLE_META.player;
}

function setCachedStaffRole(publicId, role = "player") {
    const key = String(publicId || "").trim();
    if (!key) return;
    playerStaffRoleCache[key] = normalizeStaffRole(role);
}

function getCachedStaffRole(publicId) {
    const key = String(publicId || "").trim();
    if (!key) return "player";
    if (authState?.playerId && key === String(authState.playerId)) {
        return normalizeStaffRole(player?.staff_role || "player");
    }
    return normalizeStaffRole(playerStaffRoleCache[key] || "player");
}

function getOwnStaffRole() {
    return normalizeStaffRole(player?.staff_role || "player");
}

function isStaffRole(role = "player") {
    const normalized = normalizeStaffRole(role);
    return normalized === "mod" || normalized === "adm" || normalized === "owr";
}

function canWriteInObserverChat() {
    return isStaffRole(getOwnStaffRole());
}

function canWriteBattleAnnouncementChat() {
    const role = getOwnStaffRole();
    return role === "adm" || role === "owr";
}

function getSceneChatRoomId() {
    const fromCurrentRoom = currentRoom?.id || currentRoom?.roomId || null;
    const fallbackMap = currentRoom?.map || selectedLobbyMap?.real || selectedLobbyMap?.name || "scene";
    return String(fromCurrentRoom || `scene_${String(fallbackMap).toLowerCase()}`);
}

function canWriteSceneMapChat() {
    return gameState === "BATTLE";
}

function getPlayerClanChatId() {
    const directClanId = player?.clan_id || player?.clanId || authState?.clanId || null;
    if (directClanId !== null && typeof directClanId !== 'undefined' && String(directClanId).trim()) {
        return String(directClanId).trim();
    }
    try {
        const saved = localStorage.getItem('cosmicClanChatId');
        if (saved && String(saved).trim()) return String(saved).trim();
    } catch (_) {}
    return null;
}

function canUseClanChat() {
    return !!getPlayerClanChatId();
}

function getClanChatRoomId() {
    const clanId = getPlayerClanChatId();
    return clanId ? `clan_${clanId}` : null;
}

function getPmPresenceState(peerId) {
    const key = String(peerId || '').trim();
    if (!key) return 'offline';
    if (inGamePmPeers.has(key)) return 'in-game';
    if (onlinePmPeers.has(key)) return 'online';
    return 'offline';
}

function saveChatUiState() {
    try {
        localStorage.setItem(CHAT_UI_STATE_KEY, JSON.stringify({
            currentChat: currentChat || 'global',
            privateTabs: privateChatTabs,
            savedAt: Date.now()
        }));
    } catch (error) {
        console.warn('Не удалось сохранить состояние чата:', error);
    }
}

function restoreChatUiState() {
    try {
        const raw = localStorage.getItem(CHAT_UI_STATE_KEY);
        if (!raw) return;
        const state = JSON.parse(raw);
        const tabs = state?.privateTabs && typeof state.privateTabs === 'object' ? state.privateTabs : {};
        Object.keys(privateChatTabs).forEach(key => delete privateChatTabs[key]);
        Object.entries(tabs).forEach(([peerId, meta]) => {
            const safePeerId = String(peerId || '').trim();
            if (!safePeerId || !/^\d+$/.test(safePeerId)) return;
            privateChatTabs[safePeerId] = {
                label: String(meta?.label || `ID ${safePeerId}`),
                updatedAt: Number(meta?.updatedAt) || Date.now(),
                pinned: !!meta?.pinned,
                preview: String(meta?.preview || '')
            };
        });
        const savedCurrent = String(state?.currentChat || 'global');
        if (savedCurrent === 'global' || savedCurrent === 'battle' || savedCurrent === 'clan' || savedCurrent.startsWith('pm:')) {
            currentChat = savedCurrent;
        }
    } catch (error) {
        console.warn('Не удалось восстановить состояние чата:', error);
    }
}

const chatRateLimitState = {
    lastSentAt: 0,
    cooldownMs: 1800
};

function canBypassChatRateLimit() {
    return isStaffRole(getOwnStaffRole());
}

function getChatCooldownRemainingMs() {
    if (canBypassChatRateLimit()) return 0;
    return Math.max(0, chatRateLimitState.cooldownMs - (Date.now() - chatRateLimitState.lastSentAt));
}

function markChatMessageSentNow() {
    chatRateLimitState.lastSentAt = Date.now();
}

function getChatRoleCssClassByRole(role = "player") {
    const normalized = normalizeStaffRole(role);
    if (normalized === "mod") return "role-mod";
    if (normalized === "adm") return "role-adm";
    if (normalized === "owr") return "role-owr";
    return "";
}

function getChatRoleCssClassByPublicId(publicId) {
    return getChatRoleCssClassByRole(getCachedStaffRole(publicId));
}

function getChatRoleBadgeHtmlByRole(role = "player") {
    const meta = getStaffRoleMeta(role);
    const roleClass = getChatRoleCssClassByRole(role);
    if (!meta.short) return "";
    return `<span class="chat-role-badge ${roleClass}">[${escapeChatHtml(meta.short)}]</span>`;
}

function getResolvedStaffRole(publicId, explicitRole = "") {
    const directRole = String(explicitRole || "").trim().toLowerCase();
    if (directRole) return directRole;
    return String(getCachedStaffRole(publicId) || "").trim().toLowerCase();
}

function getChatRoleBadgeHtmlByPublicId(publicId, explicitRole = "") {
    return getChatRoleBadgeHtmlByRole(getResolvedStaffRole(publicId, explicitRole));
}

function getChatRoleCssClassByPublicIdOrRole(publicId, explicitRole = "") {
    return getChatRoleCssClassByRole(getResolvedStaffRole(publicId, explicitRole));
}

function shouldHideStaffIdentityInScene(publicId, explicitRole = "") {
    return isStaffRole(getResolvedStaffRole(publicId, explicitRole));
}

function getSceneRoleBadgeHtml(publicId, explicitRole = "") {
    const role = getResolvedStaffRole(publicId, explicitRole);
    const meta = getStaffRoleMeta(role);
    const roleClass = getChatRoleCssClassByRole(role);
    if (!meta || !meta.short) return "";
    return `<span class="scene-role-badge ${roleClass}">[${escapeChatHtml(meta.short)}]</span>`;
}

function applyPlayerIdentityRow(row = {}) {
    if (!row || typeof row !== "object") return;
    if (typeof row.staff_role !== "undefined") {
        player.staff_role = normalizeStaffRole(row.staff_role);
        if (row.public_id) {
            setCachedStaffRole(String(row.public_id), player.staff_role);
        } else if (authState?.playerId) {
            setCachedStaffRole(String(authState.playerId), player.staff_role);
        }
    } else if (!player.staff_role) {
        player.staff_role = "player";
    }
}

async function hydrateStaffRolesForMessages(messages = []) {
    if (!window.supabaseClient || !Array.isArray(messages) || !messages.length) return;

    const idsToLoad = [...new Set(
        messages
            .map(msg => msg?.player_public_id ? String(msg.player_public_id).trim() : "")
            .filter(Boolean)
            .filter(id => !(id in playerStaffRoleCache))
            .filter(id => !(authState?.playerId && id === String(authState.playerId)))
            .map(id => Number(id))
            .filter(Number.isFinite)
    )];

    if (!idsToLoad.length) return;

    const { data, error } = await window.supabaseClient
        .from('players')
        .select('public_id,staff_role')
        .in('public_id', idsToLoad);

    if (error) {
        console.warn('Не удалось загрузить staff_role для чата:', error.message || error);
        return;
    }

    (data || []).forEach(row => {
        if (row?.public_id) {
            setCachedStaffRole(String(row.public_id), row.staff_role || 'player');
        }
    });
}

function escapeChatHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function canUsePrivateChat() {
    return !!(typeof authState !== "undefined" && authState?.mode === "account" && authState?.playerId);
}

function getOwnPublicChatId() {
    if (canUsePrivateChat()) {
        return String(authState.playerId);
    }
    return null;
}

function getOwnChatLabel() {
    return typeof getDisplayPlayerTag === "function"
        ? getDisplayPlayerTag()
        : (player?.nickname || "Commander");
}

function getValidChatPlayerId(){
    const rawId = player?.id ?? null;
    if(rawId === null || typeof rawId === "undefined") return null;

    const value = String(rawId).trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value) ? value : null;
}

function sanitizeOnlineRoomId(roomId) {
    if (roomId === null || typeof roomId === 'undefined') return null;
    const value = String(roomId).trim();
    if (!value) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value) ? value : null;
}

function getPrivateScopeKey(peerId) {
    return `pm:${String(peerId)}`;
}

function parseChatScope(scopeName = currentChat) {
    if (scopeName === "clan") {
        return { key: "clan", channel: "clan", roomId: getClanChatRoomId() };
    }
    if (scopeName === "battle") {
        return { key: "battle", channel: "battle" };
    }
    if (scopeName && String(scopeName).startsWith("pm:")) {
        const peerId = String(scopeName).slice(3);
        return {
            key: getPrivateScopeKey(peerId),
            channel: "pm",
            peerId
        };
    }
    return { key: "global", channel: "global" };
}

function getChatCacheList(scope) {
    if (scope.channel === "clan") return chatCache.clan;
    if (scope.channel === "battle") return chatCache.battle;
    if (scope.channel === "pm") {
        const peerId = String(scope.peerId || "");
        if (!chatCache.pm[peerId]) chatCache.pm[peerId] = [];
        return chatCache.pm[peerId];
    }
    return chatCache.global;
}

function getUnreadCount(scopeName) {
    const scope = parseChatScope(scopeName);
    if (scope.channel === "clan") return Number(chatUnread.clan || 0);
    if (scope.channel === "battle") return Number(chatUnread.battle || 0);
    if (scope.channel === "pm") return Number(chatUnread.pm[String(scope.peerId)] || 0);
    return Number(chatUnread.global || 0);
}

function setUnreadCount(scopeName, count = 0) {
    const safeCount = Math.max(0, Number(count) || 0);
    const scope = parseChatScope(scopeName);
    if (scope.channel === "clan") {
        chatUnread.clan = safeCount;
    } else if (scope.channel === "battle") {
        chatUnread.battle = safeCount;
    } else if (scope.channel === "pm") {
        chatUnread.pm[String(scope.peerId)] = safeCount;
    } else {
        chatUnread.global = safeCount;
    }
}

function incrementUnread(scopeName, amount = 1) {
    setUnreadCount(scopeName, getUnreadCount(scopeName) + Math.max(1, Number(amount) || 1));
}

function getLastMessagePreview(scopeName) {
    const scope = parseChatScope(scopeName);
    const list = getChatCacheList(scope);
    const last = list[list.length - 1];
    if (!last?.message) return "";
    const trimmed = String(last.message).replace(/\s+/g, ' ').trim();
    if (!trimmed) return "";
    return trimmed.length > 32 ? trimmed.slice(0, 32) + '…' : trimmed;
}

function setPrivateTabPreview(peerId, preview = "") {
    const key = String(peerId || "").trim();
    if (!key) return;
    if (!privateChatTabs[key]) {
        privateChatTabs[key] = { label: `ID ${key}`, updatedAt: Date.now(), pinned: false, preview: "" };
    }
    privateChatTabs[key].preview = preview || "";
    saveChatUiState();
}

function isPmPeerOnline(peerId) {
    return onlinePmPeers.has(String(peerId || ""));
}

function syncPrivateTabFromScope(scopeName) {
    const scope = parseChatScope(scopeName);
    if (scope.channel !== "pm" || !scope.peerId) return;
    setPrivateTabPreview(scope.peerId, getLastMessagePreview(scopeName));
    if (privateChatTabs[String(scope.peerId)]) {
        privateChatTabs[String(scope.peerId)].updatedAt = Date.now();
    }
}

function pushChatToCache(scope, msg) {
    const list = getChatCacheList(scope);
    if (list.some(item => String(item.id) === String(msg.id))) return false;
    list.push(msg);
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    while (list.length > CHAT_MESSAGE_LIMIT) list.shift();
    return true;
}

function formatChatTime(dateStr) {
    const d = new Date(dateStr || Date.now());
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildLobbyChatMessageHtml(msg, scope = parseChatScope(currentChat)) {
    const author = escapeChatHtml(msg.player_nickname || "Unknown");
    const text = escapeChatHtml(msg.message || "");
    const time = formatChatTime(msg.created_at);
    const recipientId = msg.recipient_public_id ? String(msg.recipient_public_id) : null;
    const ownId = getOwnPublicChatId();
    const publicId = msg.player_public_id ? String(msg.player_public_id) : "";
    const safePublicId = escapeChatHtml(publicId || "0");
    const roleBadge = getSceneRoleBadgeHtml(publicId, msg.staff_role);
    const roleClass = getChatRoleCssClassByPublicIdOrRole(publicId, msg.staff_role);
    const lineClass = roleClass ? ` chat-staff ${roleClass}` : "";
    const nickAttrs = publicId
        ? ` data-player-public-id="${escapeChatHtml(publicId)}" data-player-nickname="${author}"`
        : ` data-player-nickname="${author}"`;

    let prefix = "";
    if (scope.channel === "battle") {
        prefix = '<span class="chat-sep">⚔</span> ';
    } else if (scope.channel === "pm" && ownId && recipientId && ownId === recipientId) {
        prefix = '<span class="chat-sep">→</span> ';
    }

    return `
      <div class="chat-line${lineClass}" data-message-id="${msg.id}">
        ${prefix}${roleBadge}
        <button class="chat-nick" type="button"${nickAttrs}>${author}</button>
        <span class="chat-id">[${safePublicId}]</span>
        <span class="chat-time">[${time}]</span>
        <span class="chat-text">${text}</span>
      </div>
    `;
}

function buildBattleChatMessageHtml(msg) {
    const author = escapeChatHtml(msg.player_nickname || "Unknown");
    const text = escapeChatHtml(msg.message || "");
    const time = formatChatTime(msg.created_at);
    const publicId = msg.player_public_id ? String(msg.player_public_id) : "";
    const safePublicId = escapeChatHtml(publicId || "0");
    const roleBadge = getSceneRoleBadgeHtml(publicId, msg.staff_role);
    const roleClass = getChatRoleCssClassByPublicIdOrRole(publicId, msg.staff_role);
    const lineClass = roleClass ? `chat-line chat-staff ${roleClass}` : 'chat-line';

    if (shouldHideStaffIdentityInScene(publicId)) {
        return `<div class="${lineClass}" data-message-id="${msg.id}">${roleBadge}<span class="chat-time">[${time}]</span> <span class="chat-text">${text}</span></div>`;
    }

    return `<div class="${lineClass}" data-message-id="${msg.id}">${roleBadge}<span class="chat-nick-static">${author}</span> <span class="chat-id">[${safePublicId}]</span> <span class="chat-time">[${time}]</span> <span class="chat-text">${text}</span></div>`;
}

function addSystemLobbyChatMessage(text) {
    if (!chatMessages) return;
    const row = document.createElement("div");
    row.className = "chat-line system";
    row.textContent = text;
    chatMessages.appendChild(row);
    while (chatMessages.children.length > CHAT_MESSAGE_LIMIT) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemBattleChatMessage(text) {
    const battleLog = document.getElementById("battle-chat-log");
    if (!battleLog) return;
    const row = document.createElement("div");
    row.style.color = "#ffd166";
    row.textContent = text;
    battleLog.appendChild(row);
    battleLog.scrollTop = battleLog.scrollHeight;
}

function resetPrivateChatState() {
    Object.keys(privateChatTabs).forEach(key => delete privateChatTabs[key]);
    Object.keys(chatCache.pm).forEach(key => delete chatCache.pm[key]);
    Object.keys(chatUnread.pm).forEach(key => delete chatUnread.pm[key]);
    onlinePmPeers.clear();
    inGamePmPeers.clear();
    currentChat = "global";
    saveChatUiState();
}

async function deletePmHistoryWithPeer(peerId) {
    if (!window.supabaseClient) return;
    const ownId = getOwnPublicChatId();
    const peer = String(peerId || '').trim();
    if (!ownId || !peer) return;

    const { error } = await window.supabaseClient
        .from('chat_messages')
        .delete()
        .eq('channel', 'pm')
        .or(`and(player_public_id.eq.${ownId},recipient_public_id.eq.${peer}),and(player_public_id.eq.${peer},recipient_public_id.eq.${ownId})`);

    if (error) {
        console.warn('Не удалось удалить историю PM:', error);
    }
}

async function deleteAllOwnPmHistory() {
    if (!window.supabaseClient) return;
    const ownId = getOwnPublicChatId();
    if (!ownId) return;

    const { error } = await window.supabaseClient
        .from('chat_messages')
        .delete()
        .eq('channel', 'pm')
        .or(`player_public_id.eq.${ownId},recipient_public_id.eq.${ownId}`);

    if (error) {
        console.warn('Не удалось удалить всю историю PM:', error);
    }
}

function setUnreadForScope(scopeName, state = true) {
    if (typeof state === 'number') {
        setUnreadCount(scopeName, state);
        return;
    }
    if (state) incrementUnread(scopeName);
    else setUnreadCount(scopeName, 0);
}

function clearUnreadForCurrentScope() {
    setUnreadCount(currentChat, 0);
}

function ensurePmTab(peerId, label = null) {
    const key = String(peerId || "").trim();
    if (!key) return;
    const previous = privateChatTabs[key] || {};
    const safeLabel = (label || previous.label || `ID ${key}`).trim();
    privateChatTabs[key] = {
        label: safeLabel,
        updatedAt: Date.now(),
        pinned: !!previous.pinned,
        preview: previous.preview || getLastMessagePreview(getPrivateScopeKey(key)) || ""
    };
    saveChatUiState();
    renderChatTabs();
}

function getPeerIdFromPmMessage(msg) {
    const ownId = getOwnPublicChatId();
    if (!ownId || !msg) return null;
    const senderId = msg.player_public_id ? String(msg.player_public_id) : null;
    const recipientId = msg.recipient_public_id ? String(msg.recipient_public_id) : null;

    if (senderId === ownId) return recipientId;
    if (recipientId === ownId) return senderId;
    return null;
}

function getPeerLabelFromPmMessage(msg, peerId) {
    const ownId = getOwnPublicChatId();
    const senderId = msg?.player_public_id ? String(msg.player_public_id) : null;
    if (senderId && senderId !== ownId) {
        return msg.player_nickname || `ID ${peerId}`;
    }
    return privateChatTabs[String(peerId)]?.label || `ID ${peerId}`;
}

function renderChatTabs() {
    if (!chatTabsWrap) return;

    const pmEntries = Object.entries(privateChatTabs)
        .sort((a, b) => {
            const aPinned = a[1]?.pinned ? 1 : 0;
            const bPinned = b[1]?.pinned ? 1 : 0;
            if (bPinned !== aPinned) return bPinned - aPinned;
            return (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0);
        });

    let html = `
      <button class="chat-tab${currentChat === "global" ? " active" : ""}${getUnreadCount("global") > 0 && currentChat !== "global" ? " notify" : ""}" data-scope="global" type="button">
        <span class="chat-tab-title">Global</span>
        ${getUnreadCount("global") > 0 && currentChat !== "global" ? `<span class="chat-tab-badge">${getUnreadCount("global") > 99 ? '99+' : getUnreadCount("global")}</span>` : ''}
      </button>
      <button class="chat-tab${currentChat === "clan" ? " active" : ""}${getUnreadCount("clan") > 0 && currentChat !== "clan" ? " notify" : ""}${!canUseClanChat() ? " disabled" : ""}" data-scope="clan" type="button" title="${canUseClanChat() ? 'Клановый чат' : 'Сначала нужен clan_id игрока'}">
        <span class="chat-tab-title">Clan</span>
        ${getUnreadCount("clan") > 0 && currentChat !== "clan" ? `<span class="chat-tab-badge">${getUnreadCount("clan") > 99 ? '99+' : getUnreadCount("clan")}</span>` : ''}
      </button>
      <button class="chat-tab${currentChat === "battle" ? " active" : ""}${getUnreadCount("battle") > 0 && currentChat !== "battle" ? " notify" : ""}" data-scope="battle" type="button">
        <span class="chat-tab-title">Battle</span>
        ${getUnreadCount("battle") > 0 && currentChat !== "battle" ? `<span class="chat-tab-badge">${getUnreadCount("battle") > 99 ? '99+' : getUnreadCount("battle")}</span>` : ''}
      </button>
    `;

    pmEntries.forEach(([peerId, meta]) => {
        const label = escapeChatHtml(meta?.label || `ID ${peerId}`);
        const scope = getPrivateScopeKey(peerId);
        const unread = getUnreadCount(scope);
        const notify = unread > 0 && currentChat !== scope ? " notify" : "";
        const preview = escapeChatHtml(meta?.preview || "Без сообщений");
        const pinClass = meta?.pinned ? ' pinned' : '';
        const presenceState = getPmPresenceState(peerId);
        const presenceClass = presenceState === 'in-game' ? ' in-game' : (presenceState === 'online' ? ' online' : '');
        const presenceTitle = presenceState === 'in-game' ? 'В игре' : (presenceState === 'online' ? 'Онлайн' : 'Оффлайн');
        html += `
          <button class="chat-tab pm-tab${currentChat === scope ? " active" : ""}${notify}${pinClass}${presenceClass}" data-scope="${scope}" type="button">
            <span class="pm-online-dot" title="${presenceTitle}"></span>
            <span class="pm-tab-content">
              <span class="pm-tab-main">
                <span class="pm-tab-label">${label}</span>
                ${meta?.pinned ? '<span class="pin-state" title="Закреплён">📌</span>' : ''}
              </span>
              <span class="pm-tab-preview">${preview}</span>
            </span>
            ${unread > 0 && currentChat !== scope ? `<span class="chat-tab-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
            <span class="pin-tab" data-pin="${peerId}" title="Закрепить ЛС">📌</span>
            <span class="close-tab" data-close="${peerId}" title="Закрыть ЛС">×</span>
          </button>
        `;
    });

    chatTabsWrap.innerHTML = html;

    chatTabsWrap.querySelectorAll(".chat-tab").forEach((tab) => {
        tab.addEventListener("click", async (e) => {
            if (e.target.closest(".pin-tab") || e.target.closest(".close-tab")) return;

            currentChat = tab.dataset.scope || "global";
            clearUnreadForCurrentScope();

            requestAnimationFrame(async () => {
                renderChatTabs();
                saveChatUiState();
                await loadChatHistory(currentChat);
                renderLobbyMessages();
            });
        });
    });

    chatTabsWrap.querySelectorAll(".pin-tab").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
        });

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const peerId = btn.dataset.pin;
            if (!peerId || !privateChatTabs[peerId]) return;

            privateChatTabs[peerId].pinned = !privateChatTabs[peerId].pinned;
            saveChatUiState();

            requestAnimationFrame(() => {
                renderChatTabs();
            });
        });
    });

    chatTabsWrap.querySelectorAll(".close-tab").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
        });

        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const peerId = btn.dataset.close;
            if (!peerId) return;

            delete privateChatTabs[peerId];
            delete chatCache.pm[peerId];
            delete chatUnread.pm[peerId];
            onlinePmPeers.delete(String(peerId));
            inGamePmPeers.delete(String(peerId));
            deletePmHistoryWithPeer(peerId);
            saveChatUiState();

            if (currentChat === `pm:${peerId}`) {
                currentChat = "global";
                await loadChatHistory("global");
                renderLobbyMessages();
            }

            requestAnimationFrame(() => {
                renderChatTabs();
            });
        });
    });

    saveChatUiState();
    console.log("CHAT_NOTIFY_STATE", JSON.stringify(chatUnread), "current=", currentChat);
}

function renderLobbyMessages() {
    if (!chatMessages) return;
    const scope = parseChatScope(currentChat);
    if (scope.channel === 'clan' && !canUseClanChat()) {
        chatMessages.innerHTML = '<div class="chat-line system">👥 Клановый чат готов, но для него нужен clan_id игрока/клана из базы.</div>';
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
    }
    const list = getChatCacheList(scope);
    chatMessages.innerHTML = list.map(msg => buildLobbyChatMessageHtml(msg, scope)).join("");
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateLobbyChatComposerVisibility() {
    const chatInputAreaEl = document.getElementById("chat-input-area");
    if (!chatInputAreaEl) return;

    const shouldHide = (currentChat === "battle" && !canWriteBattleAnnouncementChat()) || (currentChat === "clan" && !canUseClanChat());
    chatInputAreaEl.classList.toggle("chat-composer-hidden", shouldHide);
}

if (chatMessages && !chatMessages.dataset.playerActionsBound) {
    chatMessages.dataset.playerActionsBound = '1';
    chatMessages.addEventListener('click', async (e) => {
        const nickBtn = e.target.closest('.chat-nick');
        if (!nickBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const targetId = nickBtn.dataset.playerPublicId ? String(nickBtn.dataset.playerPublicId) : '';
        const nickname = nickBtn.dataset.playerNickname || nickBtn.textContent || 'Player';
        if (!targetId) {
            await openPlayerProfile('', nickname);
            return;
        }
        showPlayerActionMenu(nickBtn, targetId, nickname);
    });
}

function renderBattleMessages() {
    const battleLog = document.getElementById("battle-chat-log");
    if (!battleLog) return;
    battleLog.innerHTML = chatCache.battle.map(buildBattleChatMessageHtml).join("");
    battleLog.scrollTop = battleLog.scrollHeight;
}

function showBattleAnnouncementInActiveScene(msg) {
    if (!msg) return;
    if (gameState !== "BATTLE" && gameState !== "OBSERVE") return;

    const feed = document.getElementById('kill-feed');
    if (!feed) return;

    const author = escapeChatHtml(msg.player_nickname || msg.nickname || "Unknown");
    const text = escapeChatHtml(msg.message || "");
    const publicId = msg.player_public_id ? String(msg.player_public_id) : "";
    const safePublicId = escapeChatHtml(publicId || "0");
    const roleBadge = getSceneRoleBadgeHtml(publicId, msg.staff_role);
    const roleClass = getChatRoleCssClassByPublicIdOrRole(publicId, msg.staff_role);
    const lineClass = roleClass ? ` chat-staff ${roleClass}` : "";

    const item = document.createElement('div');
    item.className = `kill-feed-item chat-announcement${lineClass}`;
    item.innerHTML = shouldHideStaffIdentityInScene(publicId, msg.staff_role)
        ? `${roleBadge}<span class="chat-text">${text}</span>`
        : `${roleBadge}<span class="chat-nick-static">${author}</span> <span class="chat-id">[${safePublicId}]</span><span class="chat-sep">:</span> <span class="chat-text">${text}</span>`;

    feed.prepend(item);

    while (feed.children.length > 8) {
        feed.removeChild(feed.lastChild);
    }

    setTimeout(() => {
        item.remove();
    }, 9000);

    renderBattleMessages?.();
}

function showSceneMapMessageInActiveScene(msg) {
    if (!msg) return;
    if (gameState !== "BATTLE") return;
    if (String(msg.room_id || "") !== String(getSceneChatRoomId() || "")) return;

    const feed = document.getElementById('kill-feed');
    if (!feed) return;

    const author = escapeChatHtml(msg.player_nickname || msg.nickname || "Unknown");
    const text = escapeChatHtml(msg.message || "");
    const publicId = msg.player_public_id ? String(msg.player_public_id) : "";
    const safePublicId = escapeChatHtml(publicId || "0");
    const roleBadge = getSceneRoleBadgeHtml(publicId, msg.staff_role);
    const roleClass = getChatRoleCssClassByPublicIdOrRole(publicId, msg.staff_role);
    const lineClass = roleClass ? ` chat-staff ${roleClass}` : "";

    const item = document.createElement('div');
    item.className = `kill-feed-item chat-announcement scene-chat${lineClass}`;
    item.innerHTML = shouldHideStaffIdentityInScene(publicId, msg.staff_role)
        ? `${roleBadge}<span class="chat-text">${text}</span>`
        : `${roleBadge}<span class="chat-nick-static">${author}</span> <span class="chat-id">[${safePublicId}]</span><span class="chat-sep">:</span> <span class="chat-text">${text}</span>`;

    feed.prepend(item);

    while (feed.children.length > 8) {
        feed.removeChild(feed.lastChild);
    }

    setTimeout(() => {
        item.remove();
    }, 9000);
}

async function loadChatHistory(scopeName = currentChat) {
    if (!window.supabaseClient) return;

    const scope = parseChatScope(scopeName);
    let query = window.supabaseClient
        .from("chat_messages")
        .select("*")
        .eq("channel", scope.channel)
        .order("created_at", { ascending: false })
        .limit(CHAT_MESSAGE_LIMIT);

    if (scope.channel === "clan") {
        if (!scope.roomId) {
            const list = getChatCacheList(scope);
            list.length = 0;
            if (currentChat === scopeName) renderLobbyMessages();
            return;
        }
        query = query.eq('room_id', scope.roomId);
    }

    if (scope.channel === "pm") {
        const ownId = getOwnPublicChatId();
        if (!ownId || !scope.peerId) {
            if (currentChat === scopeName) renderLobbyMessages();
            return;
        }
        query = query.or(`and(player_public_id.eq.${ownId},recipient_public_id.eq.${scope.peerId}),and(player_public_id.eq.${scope.peerId},recipient_public_id.eq.${ownId})`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("❌ Ошибка загрузки чата:", error);
        if (scope.channel === "battle") addSystemBattleChatMessage("Ошибка загрузки боевого чата");
        else addSystemLobbyChatMessage("Ошибка загрузки чата");
        return;
    }

    await hydrateStaffRolesForMessages(data || []);

    const list = getChatCacheList(scope);
    list.length = 0;
    (data || []).slice().reverse().forEach(msg => list.push(msg));

    if (scope.channel === "pm") {
        const peerId = scope.peerId;
        if (peerId && list.length) {
            const sample = list[list.length - 1];
            ensurePmTab(peerId, getPeerLabelFromPmMessage(sample, peerId));
            setPrivateTabPreview(peerId, getLastMessagePreview(scopeName));
            deletePmHistoryWithPeer(peerId);
        }
    }

    if (scopeName === currentChat) clearUnreadForCurrentScope();

    if (currentChat === scopeName) renderLobbyMessages();
    if (scope.channel === "battle" && (gameState === "BATTLE" || gameState === "OBSERVE" || currentChat === "battle")) {
        renderBattleMessages();
    }
}

async function handleIncomingRealtimeMessage(msg) {
    if (!msg || !msg.channel) return;
    await hydrateStaffRolesForMessages([msg]);

    if (msg.channel === "global") {
        const scope = { key: "global", channel: "global" };
        if (!pushChatToCache(scope, msg)) return;
        if (currentChat !== "global") incrementUnread("global");
        if (currentChat === "global") renderLobbyMessages();
        renderChatTabs();
        return;
    }

    if (msg.player_public_id && msg.staff_role) {
        setCachedStaffRole(String(msg.player_public_id), String(msg.staff_role).toLowerCase());
    }

    if (msg.channel === "clan") {
        const activeClanRoomId = getClanChatRoomId();
        if (!activeClanRoomId || String(msg.room_id || '') !== String(activeClanRoomId)) return;
        const scope = { key: 'clan', channel: 'clan', roomId: activeClanRoomId };
        if (!pushChatToCache(scope, msg)) return;
        if (currentChat !== 'clan') incrementUnread('clan');
        if (currentChat === 'clan') renderLobbyMessages();
        renderChatTabs();
        return;
    }

    if (msg.channel === "battle") {
        const scope = { key: "battle", channel: "battle" };
        if (!pushChatToCache(scope, msg)) return;
        if (currentChat !== "battle") incrementUnread("battle");
        if (currentChat === "battle") renderLobbyMessages();
        showBattleAnnouncementInActiveScene(msg);
        renderChatTabs();
        return;
    }

    if (msg.channel === "pm") {
        const ownId = getOwnPublicChatId();
        if (!ownId) return;
        const peerId = getPeerIdFromPmMessage(msg);
        if (!peerId) return;

        const scope = { key: getPrivateScopeKey(peerId), channel: "pm", peerId };
        if (!pushChatToCache(scope, msg)) return;

        ensurePmTab(peerId, getPeerLabelFromPmMessage(msg, peerId));
        syncPrivateTabFromScope(scope.key);
        if (currentChat !== scope.key) incrementUnread(scope.key);

        if (currentChat === scope.key) renderLobbyMessages();
        renderChatTabs();
    }
}

function startRealtimeChat() {
    if (!window.supabaseClient) return;
    if (chatRealtimeChannel) return;

    chatRealtimeChannel = window.supabaseClient
        .channel("cosmic-clicker-chat-realtime")
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "chat_messages" },
            async (payload) => {
                await handleIncomingRealtimeMessage(payload.new);
            }
        )
        .subscribe((status) => {
            console.log("💬 CHAT REALTIME:", status);
        });
}

async function sendMessage(forcedScopeName = null, explicitText = null) {
    if (!window.supabaseClient) {
        addSystemLobbyChatMessage("Supabase ещё не готов для чата.");
        return false;
    }

    if (window.playerMuted || player.isMuted) {
        if ((forcedScopeName || currentChat) === "battle") {
            addSystemBattleChatMessage("🔇 Мут активен. Сообщение не отправлено.");
        } else {
            addSystemLobbyChatMessage("🔇 Мут активен. Вы не можете писать в чат.");
        }
        return false;
    }

    const text = (typeof explicitText === "string" ? explicitText : (chatInput?.value || "")).trim();
    if (!text) return false;

    const cooldownRemainingMs = getChatCooldownRemainingMs();
    if (cooldownRemainingMs > 0) {
        const remainSec = (cooldownRemainingMs / 1000).toFixed(1);
        const spamText = `⏳ Не так быстро. Следующее сообщение через ${remainSec} сек.`;
        if (forcedScopeName === "battle" || currentChat === "battle") addSystemBattleChatMessage(spamText);
        else addSystemLobbyChatMessage(spamText);
        return false;
    }

    const scopeName = forcedScopeName || currentChat;
    const scope = parseChatScope(scopeName);
    const ownPublicId = getOwnPublicChatId();

    if (scope.channel === "pm" && !canUsePrivateChat()) {
        addSystemLobbyChatMessage("⚠ ЛС доступны только для аккаунтов, не для гостя.");
        return false;
    }

    if (scope.channel === "clan" && !canUseClanChat()) {
        addSystemLobbyChatMessage('⚠ Клановый чат пока недоступен: у игрока нет clan_id.');
        return false;
    }

    if (scope.channel === "battle") {
        if (battleObserverMode && !canWriteInObserverChat()) {
            return false;
        }
        if (!battleObserverMode && !canWriteBattleAnnouncementChat()) {
            return false;
        }
    }

    const payload = {
        channel: scope.channel,
        room_id: scope.channel === 'clan' ? getClanChatRoomId() : null,
        player_id: getValidChatPlayerId(),
        player_public_id: ownPublicId,
        recipient_public_id: scope.channel === "pm" ? String(scope.peerId || "") : null,
        player_nickname: getOwnChatLabel(),
        message: text
    };

    if (scope.channel === 'clan' && !payload.room_id) {
        addSystemLobbyChatMessage('⚠ Не найден room_id клана для отправки сообщения.');
        return false;
    }

    if (scope.channel === "pm" && !payload.recipient_public_id) {
        addSystemLobbyChatMessage("⚠ Не выбран получатель для личного сообщения.");
        return false;
    }

    const { error } = await window.supabaseClient
        .from("chat_messages")
        .insert(payload);

    if (error) {
        console.error("❌ Ошибка отправки сообщения:", error);
        if (scope.channel === "battle") addSystemBattleChatMessage("Ошибка отправки сообщения");
        else addSystemLobbyChatMessage("Ошибка отправки сообщения");
        return false;
    }

    markChatMessageSentNow();

    if (scope.channel === "battle") {
        const optimisticMessage = {
            id: `local-${Date.now()}`,
            channel: "battle",
            created_at: new Date().toISOString(),
            player_public_id: ownPublicId,
            player_nickname: getOwnChatLabel(),
            staff_role: getOwnStaffRole(),
            message: text
        };
        pushChatToCache(scope, optimisticMessage);
        if (currentChat === "battle") {
            renderLobbyMessages();
        }
        showBattleAnnouncementInActiveScene(optimisticMessage);
    }

    if (scope.channel === "global" || scope.channel === "pm" || scope.channel === "clan") {
        try {
            await loadChatHistory(scope.key);
            if (currentChat === scope.key) {
                renderLobbyMessages();
            }
        } catch (e) {
            console.warn("⚠ Не удалось сразу обновить лобби-чат:", e);
        }
    }

    if (!forcedScopeName && chatInput) chatInput.value = "";
    return true;
}

function openPrivateChat(peerId, label = null) {
    if (!canUsePrivateChat()) {
        addSystemLobbyChatMessage("⚠ ЛС доступны только после входа в аккаунт.");
        return;
    }

    const safePeerId = String(peerId || "").trim();
    if (!safePeerId || !/^\d+$/.test(safePeerId)) {
        addSystemLobbyChatMessage("⚠ Для гостя ЛС недоступны.");
        return;
    }

    const ownId = getOwnPublicChatId();
    if (ownId && ownId === safePeerId) return;

    ensurePmTab(safePeerId, label || `ID ${safePeerId}`);
    currentChat = getPrivateScopeKey(safePeerId);
    clearUnreadForCurrentScope();
    renderChatTabs();
    updateLobbyChatComposerVisibility();
    saveChatUiState();
    loadChatHistory(currentChat).then(() => {
        syncPrivateTabFromScope(currentChat);
        renderLobbyMessages();
        renderChatTabs();
    });
}

if(chatSend){
    chatSend.addEventListener("click", () => sendMessage());
}

if(chatInput){
    chatInput.addEventListener("focus", () => {
        window.isTypingChat = true;
    });

    chatInput.addEventListener("blur", () => {
        window.isTypingChat = false;
    });

    chatInput.addEventListener("keydown", function(e){
        e.stopPropagation();
        if(e.key === "Enter"){
            e.preventDefault();
            sendMessage();
        }
    });
}

async function handleChatStateChange() {
    if (!canUsePrivateChat()) {
        resetPrivateChatState();
    }

    if (gameState === "BATTLE") {
        currentChat = "battle";
        clearUnreadForCurrentScope();
        renderChatTabs();
        updateLobbyChatComposerVisibility();
        await loadChatHistory("battle");
        renderBattleMessages();
        return;
    }

    if (currentChat === "battle") currentChat = "global";
    if (currentChat === 'clan' && !canUseClanChat()) currentChat = 'global';
    clearUnreadForCurrentScope();
    renderChatTabs();
    updateLobbyChatComposerVisibility();
    await loadChatHistory(currentChat);
    renderLobbyMessages();
}

async function initRealtimeChat() {
    if (!canUsePrivateChat()) {
        resetPrivateChatState();
    }

    await deleteAllOwnPmHistory();
    resetPrivateChatState();
    restoreChatUiState();
    chatUnread.global = 0;
    chatUnread.clan = 0;
    chatUnread.battle = 0;
    startRealtimeChat();
    renderChatTabs();
    updateLobbyChatComposerVisibility();
    await loadChatHistory("global");
    if (canUseClanChat()) await loadChatHistory("clan");
    if (currentChat !== 'battle') renderLobbyMessages();
    saveChatUiState();
}

window.openPrivateChat = openPrivateChat;

window.testChatNotify = function(scope = 'global'){
    if(scope === 'battle'){
        incrementUnread('battle');
    }else if(String(scope).startsWith('pm:')){
        incrementUnread(scope);
    }else{
        incrementUnread('global');
    }
    renderChatTabs();
};

window.addEventListener("load", () => {
    setTimeout(() => {
        initRealtimeChat();
    }, 250);
});

window.addEventListener('beforeunload', saveChatUiState);

// ================= NOTIFICATION SYSTEM =================

// Функция получения сообщения (имитация входящего)
function receiveMessage(chatType, author, text){

    const now = new Date();
    const time = now.getHours().toString().padStart(2,"0") + ":" +
                 now.getMinutes().toString().padStart(2,"0");

    chatData[chatType].push({
        time: time,
        author: author,
        text: text
    });

    if(chatType !== currentChat){

        if(chatType === "general"){
            tabs[0].classList.add("notify");
        } else {
            tabs[1].classList.add("notify");
        }

    } else {
        renderMessages();
    }
}




// ===== EMOJI CLICK SYSTEM =====

document.querySelectorAll(".emoji").forEach(e=>{
  e.addEventListener("click", ()=>{
    const input = document.getElementById("chat-input");
    input.value += e.textContent;
    input.focus();
  });
});


// ===============================
// PROFILE UI LOGIC
// ===============================

window.addEventListener("DOMContentLoaded", () => {

const hangarBtn = document.getElementById("hangar-tab");
const hangarWindow = document.getElementById("hangar-window");
const closeHangar = document.getElementById("close-hangar");
const hangarList = document.getElementById("hangar-list");

function updateHangarUI() {
  if(!hangarList) return;

  hangarList.innerHTML = "";

  if(player.ships.length === 0){
    hangarList.innerHTML = "<p>У вас нет кораблей</p>";
    return;
  }

  player.ships.forEach(ship => {
    const div = document.createElement("div");
    div.className = "ship-card";
    div.innerHTML = `
      <b>${ship.name}</b><br>
      Уровень: ${ship.level}<br>
      HP: ${ship.hp}<br>
      Атака: ${ship.attack}<br>
      Скорость: ${ship.speed}
    `;
    hangarList.appendChild(div);
  });
}

if(hangarBtn && hangarWindow){
  hangarBtn.addEventListener("click", () => {
    updateHangarUI();
    hangarWindow.classList.remove("hidden");
    hangarWindow.style.cssText = "position:fixed;inset:0;top:0;left:0;width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;z-index:21000;background:rgba(0,0,0,0.82);";
  });
}

if(closeHangar && hangarWindow){
  closeHangar.addEventListener("click", () => {
    hangarWindow.classList.add("hidden");
    hangarWindow.style.display='none';
  });
}

const profileBtn = document.getElementById("profile-tab");
const profileWindow = document.getElementById("profile-window");
const closeProfile = document.getElementById("close-profile");
const profileInfo = document.getElementById("profile-info");

function updateProfileUI() {
  if(!profileInfo) return;
  profileInfo.innerHTML = `
    <p>Ник: ${player.nickname}</p>
    <p>Уровень: ${player.level}</p>
    <p>Опыт: ${player.experience}</p>
    <p>Кредиты: ${player.credits}</p>
    <p>Кораблей: ${player.ships.length}</p>
  `;
}

if(profileBtn && profileWindow){
  profileBtn.addEventListener("click", () => {
    updateProfileUI();
    profileWindow.classList.remove("hidden");
  });
}

if(closeProfile && profileWindow){
  closeProfile.addEventListener("click", () => {
    profileWindow.classList.add("hidden");
  });
}

});




// ================= MAP DROPDOWN =================

const mapSelected = document.getElementById("map-selected");
const mapDropdown = document.getElementById("map-dropdown");
const mapPreview = document.getElementById("map-preview");
const mapSelectedName = document.getElementById("map-selected-name");

let selectedMap = null;

// создаём список карт
function initMapDropdown() {

    if (!mapDropdown) return;

    mapDropdown.innerHTML = "";

    MAPS.forEach(map => {

        const option = document.createElement("div");
        option.className = "map-option";

        option.innerHTML = `<span>${map.name}</span>`;

        option.addEventListener("click", () => {

            selectedMap = map;

            mapPreview.src = map.img;
            mapSelectedName.textContent = map.name;

            mapDropdown.classList.add("hidden");

            console.log("Выбрана карта:", map.name);
        });

        mapDropdown.appendChild(option);
    });
}

// открытие списка
if (mapSelected) {
    mapSelected.addEventListener("click", () => {
        mapDropdown.classList.toggle("hidden");
    });
}

initMapDropdown();
initCreateMatchLevels();
if(!selectedMap && MAPS.length){
    selectedMap = MAPS[0];
    if(mapPreview) mapPreview.src = selectedMap.img;
    if(mapSelectedName) mapSelectedName.textContent = selectedMap.name;
}



// ================= ROOM SYSTEM (FAKE SERVER) =================

let rooms = {};

function createRoom(mapName, password = null, title = null) {

    const roomId = "room_" + Date.now();

    rooms[roomId] = {
        id: roomId,
        map: mapName,
        password: password,
        title: title || `Карта ${mapName}`,
        players: [],
        state: "waiting"
    };

    // 👇 ДОБАВЛЯЕМ СОЗДАТЕЛЯ
    const player = {
        id: "player_" + Date.now(),
        name: "Host",
        resources: 0
    };

    rooms[roomId].players.push(player);

    console.log("Создана комната:", rooms[roomId]);

    return roomId;
}


// ================= CREATE ROOM BUTTON =================

const confirmCreateBtn = document.getElementById("confirm-create");

if (confirmCreateBtn) {

    confirmCreateBtn.addEventListener("click", () => {

        if (!selectedMap) {
            alert("Выберите карту!");
            return;
        }

        const roomTitleInput = document.getElementById('room-title');
        const roomTitle = roomTitleInput?.value?.trim() || `${selectedMap.name} Room`;
        const roomId = createRoom(selectedMap.name, null, roomTitle);

        console.log("Игрок создал комнату:", roomId);

        // 👉 ЗАПОМИНАЕМ ТЕКУЩУЮ КОМНАТУ
        currentRoom = rooms[roomId];

        // Закрываем окно
        if (createWindow) {
            createWindow.classList.add("hidden");
        }
        const roomTitleInputEl = document.getElementById('room-title');
        if(roomTitleInputEl) roomTitleInputEl.value = '';
        addCreatedRoomToLobby(currentRoom);

        // 👉 Сначала загружаем карту
        enterMap(currentRoom.map);

        // 👉 Потом меняем состояние
        switchState("BATTLE");
        spawnPlayer();

    });

}



/* JOIN MAP BUTTON */

const joinButton = document.getElementById("join-map-btn");

if (joinButton) {

    joinButton.onclick = () => {

        if (!selectedMap) {
            alert("Сначала выберите карту");
            return;
        }

        console.log("Вход на карту:", selectedMap);

        loadPlanet(selectedMap);

        // запуск игры
        switchState("BATTLE");

    };

}




/* LOAD PLANET BY MAP */

function loadPlanet(map){

    if(map === "Mercury"){
        createPlanet(0xaaaaaa,2);
    }

    if(map === "Venus"){
        createPlanet(0xffcc88,2.2);
    }

    if(map === "Earth"){
        createPlanet(0x3399ff,2.3);
    }

    if(map === "Mars"){
        createPlanet(0xff5533,2.1);
    }

    if(map === "Jupiter"){
        createPlanet(0xffaa88,3.5);
    }

    if(map === "Saturn"){
        createPlanet(0xffddaa,3);
    }

    if(map === "Uranus"){
        createPlanet(0x66ffff,2.8);
    }

    if(map === "Neptune"){
        createPlanet(0x3366ff,2.8);
    }

}



// ================= ENTER MAP =================

function enterMap(mapName) {
    enterBattleMap(mapName);
}

function normalizeBattleMapName(mapName){
    const raw = String(mapName || '').trim().toLowerCase();
    const mapNames = {
        'sun':'sun','солнце':'sun',
        'mercury':'mercury','меркурий':'mercury',
        'venus':'venus','венера':'venus',
        'earth':'earth','земля':'earth',
        'mars':'mars','марс':'mars',
        'jupiter':'jupiter','юпитер':'jupiter',
        'saturn':'saturn','сатурн':'saturn',
        'uranus':'uranus','уран':'uranus',
        'neptune':'neptune','нептун':'neptune'
    };
    return mapNames[raw] || 'earth';
}

function getBattlePlanetConfig(mapKey){
    const configs = {
        sun:{ color:0xffc84a, size:86, light:0xffdd88 },
        mercury:{ color:0xb7b7b7, size:52, light:0xffffff },
        venus:{ color:0xe4b382, size:62, light:0xffe1b3 },
        earth:{ color:0x3b7cff, size:68, light:0xd6edff },
        mars:{ color:0xc1583a, size:58, light:0xffd2b6 },
        jupiter:{ color:0xcda27f, size:96, light:0xfff0db },
        saturn:{ color:0xd9c08a, size:88, light:0xffefcc },
        uranus:{ color:0x86d8dd, size:74, light:0xe1ffff },
        neptune:{ color:0x4469ff, size:74, light:0xdce6ff }
    };
    return configs[mapKey] || configs.earth;
}

function enterBattleMap(mapName){
    const mapKey = normalizeBattleMapName(mapName);
    selectedLobbyMap = { ...(selectedLobbyMap || {}), real: mapKey, name: mapKey };

    clearBattleScene();

    if(solarSystem && scene.children.includes(solarSystem)){
        scene.remove(solarSystem);
    }

    const config = getBattlePlanetConfig(mapKey);

    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    const point = new THREE.PointLight(config.light, 2.6, 250);
    point.position.set(12, 9, 10);
    battleObjects.push(ambient, point);
    scene.add(ambient);
    scene.add(point);

    const planetGeometry = new THREE.SphereGeometry(config.size, 48, 48);
    const planetMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        roughness: 0.9,
        metalness: 0.05
    });
    battleMapPlanet = new THREE.Mesh(planetGeometry, planetMaterial);
    battleMapPlanet.position.set(0, -6, -320);
    battleMapPlanet.userData.radius = config.size;
    battleMapPlanet.userData.atmosphereRadius = config.size + 28;
    battleMapPlanet.userData.nearSurfaceRadius = config.size + 11;
    battleMapPlanet.userData.crashRadius = config.size + 4;
    scene.add(battleMapPlanet);

    if(mapKey === 'saturn'){
        const ringGeo = new THREE.RingGeometry(config.size * 1.35, config.size * 2.0, 96);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xd9c08a, side: THREE.DoubleSide, transparent:true, opacity:0.65 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.45;
        battleMapPlanet.add(ring);
    }

    spawnPointA = new THREE.Vector3(-150, -10, 120);
    spawnPointB = new THREE.Vector3(150, 12, -140);

    camera.position.set(0, 18, 70);
    camera.lookAt(0, 0, 0);

    createBattleObstacles(mapKey);
    updateBattleScoreboard();
}

var remoteBattleShips = new Map();
var liveBattleSyncTimer = null;

function clearRemoteBattleShips(){
    if(!(remoteBattleShips instanceof Map)){
        remoteBattleShips = new Map();
        return;
    }
    remoteBattleShips.forEach(entry => {
        if(entry?.mesh) scene.remove(entry.mesh);
        if(entry?.labelSprite && entry?.mesh?.remove) entry.mesh.remove(entry.labelSprite);
    });
    remoteBattleShips.clear();
}

function stopLiveBattleSync(){
    if(typeof liveBattleSyncTimer !== 'undefined' && liveBattleSyncTimer){
        clearInterval(liveBattleSyncTimer);
        liveBattleSyncTimer = null;
    }
    clearRemoteBattleShips();
}

function createRemotePilotLabel(name){
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,256,64);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(10,14,236,34);
    ctx.strokeStyle = 'rgba(0,255,255,0.35)';
    ctx.strokeRect(10,14,236,34);
    ctx.fillStyle = '#dff9ff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(name || 'Pilot'), 128, 38);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map:texture, transparent:true, depthWrite:false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(18, 4.5, 1);
    sprite.position.set(0, 5.5, 0);
    return sprite;
}

function createRemoteBattleShipMesh(name, slotIndex){
    const shipGroup = new THREE.Group();
    shipGroup.rotation.order = 'YXZ';

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0, 1.2, 7, 10),
        new THREE.MeshStandardMaterial({ color: 0x7ee7ff, metalness: 0.45, roughness: 0.32 })
    );
    body.rotation.z = Math.PI / 2;
    shipGroup.add(body);

    const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 18, 18),
        new THREE.MeshStandardMaterial({ color: 0x9bd6ff, emissive: 0x113355, metalness: 0.15, roughness: 0.2 })
    );
    cockpit.position.set(1.2, 0.25, 0);
    shipGroup.add(cockpit);

    const wingGeo = new THREE.BoxGeometry(0.25, 3.1, 1.3);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x3b6ea8, metalness: 0.4, roughness: 0.45 });
    const wingTop = new THREE.Mesh(wingGeo, wingMat);
    wingTop.position.set(-0.35, 1.7, 0);
    const wingBottom = wingTop.clone();
    wingBottom.position.y = -1.7;
    shipGroup.add(wingTop, wingBottom);

    const engineMat = new THREE.MeshBasicMaterial({ color: 0xffc66b });
    const engine1 = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 10), engineMat);
    engine1.position.set(-3.2, 0.55, 0);
    const engine2 = engine1.clone();
    engine2.position.y = -0.55;
    shipGroup.add(engine1, engine2);

    const labelSprite = createRemotePilotLabel(name);
    shipGroup.add(labelSprite);

    const side = slotIndex % 2 === 0 ? 1 : -1;
    const rank = Math.floor(slotIndex / 2);
    shipGroup.position.set(side * (70 + rank * 28), 8 + ((slotIndex % 3) - 1) * 6, -40 - rank * 26);
    shipGroup.lookAt(new THREE.Vector3(0, 0, 0));
    shipGroup.userData = {
        remote: true,
        pilotName: String(name || 'Pilot'),
        orbitSeed: Math.random() * Math.PI * 2,
        slotIndex,
        hp: 100,
        maxHp: 100
    };
    scene.add(shipGroup);
    return { mesh: shipGroup, labelSprite };
}

async function fetchCurrentRoomLivePlayers(){
    if(!window.supabaseClient || !currentRoom?.id) return [];
    const roomId = String(currentRoom.id || currentRoom.roomId || '').trim();
    if(!roomId || roomId.startsWith('observe_') || roomId.startsWith('tournament_')) return [];

    const { data, error } = await window.supabaseClient
        .from('room_players')
        .select('player_id,nickname,joined_at')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

    if(error){
        console.warn('Не удалось загрузить игроков комнаты:', error);
        return [];
    }

    return (data || []).map((item, index) => ({
        player_id: item.player_id ? String(item.player_id) : `guest_${index}`,
        nickname: item.nickname || `Pilot ${index + 1}`,
        joined_at: item.joined_at || null
    }));
}

async function syncLiveBattlePlayers(){
    if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;

    const livePlayers = await fetchCurrentRoomLivePlayers();
    const myId = (typeof authState !== 'undefined' && authState?.playerId)
        ? String(authState.playerId)
        : (player?.id ? String(player.id) : null);

    const visiblePlayers = [];
    livePlayers.forEach(entry => {
        const entryId = entry?.player_id ? String(entry.player_id) : '';
        const isMe = !!(entryId && myId && entryId === myId);
        const displayName = entry.nickname || `Pilot`;
        visiblePlayers.push(displayName);
        if(isMe) return;
        if(!remoteBattleShips.has(entryId)){
            remoteBattleShips.set(entryId, createRemoteBattleShipMesh(displayName, remoteBattleShips.size));
        }
    });

    Array.from(remoteBattleShips.keys()).forEach(entryId => {
        if(!livePlayers.some(item => String(item?.player_id || '') === String(entryId))){
            const old = remoteBattleShips.get(entryId);
            if(old?.mesh) scene.remove(old.mesh);
            remoteBattleShips.delete(entryId);
        }
    });

    if(currentRoom){
        currentRoom.currentPlayers = visiblePlayers.length ? visiblePlayers : [getDisplayPlayerTag()];
        currentRoom.players = [...currentRoom.currentPlayers];
    }
    updateBattleScoreboard();
}

function startLiveBattleSync(){
    stopLiveBattleSync();
    syncLiveBattlePlayers();
    liveBattleSyncTimer = setInterval(syncLiveBattlePlayers, 1800);
}

function animateRemoteBattleShips(){
    if(!remoteBattleShips.size) return;
    const now = Date.now() * 0.001;
    remoteBattleShips.forEach((entry) => {
        const mesh = entry?.mesh;
        if(!mesh) return;
        const seed = mesh.userData?.orbitSeed || 0;
        const slotIndex = mesh.userData?.slotIndex || 0;
        mesh.position.y += ((8 + Math.sin(now + seed) * 2.4 + (slotIndex % 3) * 1.5) - mesh.position.y) * 0.08;
        mesh.rotation.y += 0.01;
        mesh.rotation.z = Math.sin(now * 1.3 + seed) * 0.08;
    });
}

function createEnemyBot(){
    if(enemyBot){
        scene.remove(enemyBot);
        enemyBot = null;
    }
    updateEnemyHud();
    updateBattleScoreboard();
}

function updateEnemyHud(){
    const hud = document.getElementById('enemy-hud');
    const name = document.getElementById('enemy-name');
    const hpBar = document.getElementById('enemy-hp-bar');
    const hpText = document.getElementById('enemy-hp-text');
    if(!hud || !name || !hpBar || !hpText) return;

    if(!enemyBot){
        hud.style.display = 'none';
        return;
    }

    hud.style.display = 'block';
    const hp = Math.max(0, enemyBot.userData.hp);
    const maxHp = Math.max(1, enemyBot.userData.maxHp);
    const percent = (hp / maxHp) * 100;
    name.textContent = enemyBot.userData.name || 'BOT DRONE';
    hpBar.style.width = percent + '%';
    hpText.textContent = hp + ' / ' + maxHp;
}

function fireBotLaser(){
    if(!enemyBot || !playerShip) return;
    const laserGeometry = new THREE.BoxGeometry(0.14, 0.14, 2.0);
    const laserMaterial = new THREE.MeshBasicMaterial({ color: 0x55d7ff });
    const toPlayer = playerShip.position.clone().sub(enemyBot.position).normalize();

    [-0.7, 0.7].forEach(offsetX => {
        const laserMesh = new THREE.Mesh(laserGeometry, laserMaterial);
        const localOffset = new THREE.Vector3(offsetX, 0, -1.8).applyQuaternion(enemyBot.quaternion);
        laserMesh.position.copy(enemyBot.position.clone().add(localOffset));
        laserMesh.lookAt(enemyBot.position.clone().add(toPlayer));
        scene.add(laserMesh);
        enemyLasers.push({
            mesh: laserMesh,
            velocity: toPlayer.clone().multiplyScalar(1.9),
            life: 100,
            damage: 8
        });
    });
}

function updateBattleScoreboard(){
    const body = document.getElementById('battle-scoreboard-body');
    if(!body) return;

    const roomPlayers = Array.isArray(currentRoom?.currentPlayers) && currentRoom.currentPlayers.length
        ? currentRoom.currentPlayers
        : (Array.isArray(currentRoom?.players) ? currentRoom.players : []);

    const normalizedPlayers = roomPlayers.length ? roomPlayers : [player?.nickname || 'Commander'];

    body.innerHTML = normalizedPlayers.map((name, index) => {
      const safeName = String(name?.name || name || `Pilot ${index + 1}`);
      const isYou = safeName === (player?.nickname || 'Commander') || safeName === (typeof getDisplayPlayerTag === 'function' ? getDisplayPlayerTag() : 'Commander');
      return `
      <div class="battle-scoreboard-row ${isYou ? 'player' : 'enemy'}">
        <span>${isYou ? '[YOU]' : '[PLY]'}</span>
        <span>${safeName}</span>
        <span>${isYou ? battleStats.playerKills : 0}</span>
        <span>${isYou ? battleStats.playerDeaths : 0}</span>
        <span>${player?.level || 1}</span>
        <span>${isYou ? (player?.id || '1001') : 'LIVE'}</span>
      </div>`;
    }).join('');
}

// ================= SPAWN PLAYER =================

function spawnPlayer() {

    if (playerShip) {
        scene.remove(playerShip);
        playerShip = null;
    }

    shipVelocity.set(0, 0, 0);
    activeLasers.forEach(laser => scene.remove(laser.mesh));
    activeLasers = [];

    const shipGroup = new THREE.Group();
    shipGroup.rotation.order = 'YXZ';

    const hull = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 4.4, 8),
        new THREE.MeshStandardMaterial({ color:0x7fd8ff, emissive:0x05263f, roughness:0.45, metalness:0.65 })
    );
    hull.rotation.x = -Math.PI / 2;
    shipGroup.add(hull);

    const wingMaterial = new THREE.MeshStandardMaterial({ color:0x3a7fc9, roughness:0.55, metalness:0.45 });
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 1.0), wingMaterial);
    leftWing.position.set(-1.7, 0, -0.05);
    shipGroup.add(leftWing);
    const rightWing = leftWing.clone();
    rightWing.position.x = 1.7;
    shipGroup.add(rightWing);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), new THREE.MeshBasicMaterial({ color:0xdff6ff }));
    cockpit.position.set(0, 0.18, -1.1);
    shipGroup.add(cockpit);

    const engineLeft = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.8), new THREE.MeshBasicMaterial({ color:0x64d8ff }));
    engineLeft.position.set(-0.6, 0, 2.0);
    shipGroup.add(engineLeft);
    const engineRight = engineLeft.clone();
    engineRight.position.x = 0.6;
    shipGroup.add(engineRight);

    playerShip = shipGroup;
    const spawn = spawnPointA.clone();
    playerShip.position.copy(spawn);
    playerShip.lookAt(spawnPointB.clone());

    playerControl.yaw = playerShip.rotation.y;
    playerControl.pitch = 0;
    playerControl.roll = 0;

    battleWeapon.ammoInClip = battleWeapon.clipSize;
    battleWeapon.isReloading = false;
    battleWeapon.reloadEndsAt = 0;
    playerHp = playerMaxHp;
    scene.add(playerShip);
    camera.lookAt(playerShip.position);
    updateBattlePlayerHud();
    console.log("Игрок заспавнен в:", spawn);
}

// ================= KEY SYSTEM =================


document.addEventListener("keydown", (e) => {

    if(isBattleTyping()) return;
    if (e.code === "KeyW") keys.w = true;
    if (e.code === "KeyA") keys.a = true;
    if (e.code === "KeyS") keys.s = true;
    if (e.code === "KeyD") keys.d = true;
    if (e.code === "KeyR") startBattleReload();

});

document.addEventListener("keyup", (e) => {

    if (e.code === "KeyW") keys.w = false;
    if (e.code === "KeyA") keys.a = false;
    if (e.code === "KeyS") keys.s = false;
    if (e.code === "KeyD") keys.d = false;

});




/* CREATE PLANET */

function createPlanet(color,size){

const geometry = new THREE.SphereGeometry(size,32,32);

const material = new THREE.MeshStandardMaterial({
color:color
});

const planet = new THREE.Mesh(geometry,material);

scene.add(planet);

}



/* ===== SELECT MATCH ===== */

let selectedMatch = null;

document.querySelectorAll(".match-item").forEach(item => {

    item.addEventListener("click", () => {

        document.querySelectorAll(".match-item").forEach(i => {
            i.classList.remove("selected");
        });

        item.classList.add("selected");

        selectedMatch = item;

    });

});




/* ===== LOBBY PLANET MAPS ===== */

window.addEventListener("load", () => {

const lobbyMaps = [

{title:"Sun Arena",real:"sun",mode:"DM",players:"0/8",minLevel:1,maxLevel:10,img:"Sun"},
{title:"Mercury Field",real:"mercury",mode:"DM",players:"0/8",minLevel:1,maxLevel:15,img:"Mercury"},
{title:"Venus Storm",real:"venus",mode:"TDM",players:"0/8",minLevel:5,maxLevel:20,img:"Venus"},
{title:"Earth Core",real:"earth",mode:"DM",players:"0/8",minLevel:1,maxLevel:30,img:"Earth"},
{title:"Mars Colony",real:"mars",mode:"Survival",players:"0/8",minLevel:10,maxLevel:40,img:"Mars"},
{title:"Jupiter Station",real:"jupiter",mode:"Hardcore",players:"0/8",minLevel:20,maxLevel:60,img:"Jupiter"},
{title:"Saturn Rings",real:"saturn",mode:"Hardcore",players:"0/8",minLevel:30,maxLevel:80,img:"Saturn"},
{title:"Uranus Orbit",real:"uranus",mode:"Extreme",players:"0/8",minLevel:40,maxLevel:100,img:"Uranus"},
{title:"Neptune Depths",real:"neptune",mode:"Extreme",players:"0/8",minLevel:50,maxLevel:120,img:"Neptune"}

];

const matchList = document.getElementById("match-list");

lobbyMaps.forEach(mapData => {

const map = document.createElement("div");
map.className = "match-item";

map.innerHTML =
'<span class="map-title">'+mapData.title+'</span>'+
'<span class="map-real">'+mapData.real+'</span>'+
'<span class="map-mode">'+mapData.mode+'</span>'+
'<span class="map-players">'+mapData.players+'</span>'+
'<span class="map-level">★ '+mapData.minLevel+' - ★ '+mapData.maxLevel+'</span>';

map.onclick = () => {

document.querySelectorAll(".match-item").forEach(el=>{
el.classList.remove("selected");
});

map.classList.add("selected");

/* МЕНЯЕМ КАРТИНКУ */

const preview = document.getElementById("planet-preview");

if(preview){
preview.style.backgroundImage = "url(maps/"+mapData.img+".jpg)";
}

};

matchList.appendChild(map);

});

});

/* ===== MAP CLICK SYSTEM ===== */

window.addEventListener("load", () => {

const mapImages = {
Sun: "maps/sun.jpg",
Mercury: "maps/mercury.jpg",
Venus: "maps/venus.jpg",
Earth: "maps/earth.jpg",
Mars: "maps/mars.jpg",
Jupiter: "maps/jupiter.jpg",
Saturn: "maps/saturn.jpg",
Uranus: "maps/uranus.jpg",
Neptune: "maps/neptune.jpg"
};

const mapPlayers = {
Sun: [],
Mercury: [],
Venus: [],
Earth: [],
Mars: [],
Jupiter: [],
Saturn: [],
Uranus: [],
Neptune: []
};

const preview = document.getElementById("planet-preview");
const playersBox = document.getElementById("map-players");
const matchItems = document.querySelectorAll(".match-item");

function updatePlayers(mapName){

    if(!playersBox) return;

    playersBox.innerHTML = "";

    const players = mapPlayers[mapName] || [];

    for(let i=0;i<8;i++){

        const slot = document.createElement("div");
        slot.className = "player-slot";

        if(players[i]){
            slot.textContent = players[i];
        }

        playersBox.appendChild(slot);

    }

}

function updatePreview(mapName){

    if(preview && mapImages[mapName]){

        preview.style.backgroundImage = `url(${mapImages[mapName]})`;
        preview.style.backgroundSize = "cover";
        preview.style.backgroundPosition = "center";

       

    }

    updatePlayers(mapName);

}

matchItems.forEach(item => {

    item.addEventListener("click", () => {

        const mapName = item.textContent
        .split("|")[0]
        .replace("🪐","")
        .trim();

        updatePreview(mapName);

    });

});


/* имитация онлайна */

setInterval(()=>{

    const planets = Object.keys(mapPlayers);
    const randomPlanet = planets[Math.floor(Math.random()*planets.length)];

    if(mapPlayers[randomPlanet].length < 8){

        mapPlayers[randomPlanet].push("Player"+Math.floor(Math.random()*999));

    }

},5000);


updatePreview("Sun");

});


const hangarTab = document.getElementById("hangar-tab");
const profileTab = document.getElementById("profile-tab");

const hangarWindow = document.getElementById("hangar-window");
const profileWindow = document.getElementById("profile-window");

if (hangarTab && hangarWindow) {
    hangarTab.addEventListener("click", () => {
        hangarWindow.classList.remove("hidden"); hangarWindow.style.display='flex';
        profileWindow?.classList.add("hidden");
    });
}

if (profileTab && profileWindow) {
    profileTab.addEventListener("click", () => {
        profileWindow.classList.remove("hidden");
        hangarWindow?.classList.add("hidden");
    });
}


function addCreatedRoomToLobby(room){
    const matchListEl = document.getElementById('match-list');
    if(!matchListEl || !room) return;
    const mapKey = normalizeBattleMapName(room.map);
    const meta = LOBBY_MAP_DATA.find(m => m.real === mapKey) || LOBBY_MAP_DATA[3];
    const item = document.createElement('div');
    item.className = 'match-item';
    item.innerHTML = `
      <span class="map-title">${room.title || meta.title}</span>
      <span class="map-real">${meta.real}</span>
      <span class="map-mode">${meta.mode}</span>
      <span class="map-players">${room.players?.length || 1}/8</span>
      <span class="map-level">★ 1 - ★ 120</span>`;
    item.addEventListener('click', () => {
        document.querySelectorAll('#match-list .match-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedLobbyMap = meta;
        const preview = document.getElementById('planet-preview');
        if(preview){
            preview.style.backgroundImage = `url(maps/${meta.img}.jpg)`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        }
    });
    matchListEl.prepend(item);
}

const LOBBY_MAP_DATA = [
    { title:"Sun Arena", real:"sun", img:"sun", mode:"DM" },
    { title:"Mercury Field", real:"mercury", img:"mercury", mode:"DM" },
    { title:"Venus Storm", real:"venus", img:"venus", mode:"TDM" },
    { title:"Earth Core", real:"earth", img:"earth", mode:"DM" },
    { title:"Mars Colony", real:"mars", img:"mars", mode:"Survival" },
    { title:"Jupiter Station", real:"jupiter", img:"jupiter", mode:"Hardcore" },
    { title:"Saturn Rings", real:"saturn", img:"saturn", mode:"Hardcore" },
    { title:"Uranus Orbit", real:"uranus", img:"uranus", mode:"Extreme" },
    { title:"Neptune Depths", real:"neptune", img:"neptune", mode:"Extreme" }
];

function getSelectedLobbyMapFromUI(){
    const selectedEl = document.querySelector('#match-list .match-item.selected');
    if(!selectedEl) return selectedLobbyMap || LOBBY_MAP_DATA[3];
    const realText = selectedEl.querySelector('.map-real')?.textContent?.trim()?.toLowerCase();
    return LOBBY_MAP_DATA.find(m => m.real === realText) || selectedLobbyMap || LOBBY_MAP_DATA[3];
}

window.addEventListener('load', () => {
    initLobbyBackground();
    initSettingsUI();

    const joinBtn = document.getElementById('join-match-btn');
    const matchListEl = document.getElementById('match-list');
    const preview = document.getElementById('planet-preview');

    function selectLobbyMap(realKey){
        selectedLobbyMap = LOBBY_MAP_DATA.find(m => m.real === realKey) || LOBBY_MAP_DATA[3];
        if(preview && selectedLobbyMap){
            preview.style.backgroundImage = `url(maps/${selectedLobbyMap.img}.jpg)`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        }
    }

    setTimeout(() => {
        const items = document.querySelectorAll('#match-list .match-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const realKey = item.querySelector('.map-real')?.textContent?.trim()?.toLowerCase();
                selectLobbyMap(realKey || 'earth');
            });
        });
        selectLobbyMap('earth');
    }, 60);

    if(joinBtn){
        joinBtn.addEventListener('click', () => {
            selectedLobbyMap = getSelectedLobbyMapFromUI();
            currentRoom = { id: `local_${selectedLobbyMap.real}_${Date.now()}`, map: selectedLobbyMap.real, state: 'battle', players: [{name:'Commander'}] };
            window.currentRoomId = currentRoom.id;
            switchState('BATTLE');
        });
    }
});


function initBattleUI(){
    const battleExitBtn = document.getElementById('battle-exit-btn');
    const scoreboard = document.getElementById('battle-scoreboard');

    if(battleExitBtn && !battleExitBtn.dataset.bound){
        battleExitBtn.dataset.bound = '1';
        battleExitBtn.addEventListener('click', async () => {
            await cleanupCurrentBattleRoom();
            switchState('LOBBY');
            if(typeof renderRoomsInLobby === 'function'){
                await renderRoomsInLobby(true);
            }
        });
    }

    if(!document.body.dataset.battleUiBound){
        document.body.dataset.battleUiBound = '1';
        document.addEventListener('keydown', (e) => {
            if(e.code === 'Tab'){
                e.preventDefault();
                if(scoreboard && gameState === 'BATTLE') scoreboard.classList.remove('hidden');
            }
        });
        document.addEventListener('keyup', (e) => {
            if(e.code === 'Tab'){
                if(scoreboard) scoreboard.classList.add('hidden');
            }
        });
    }
}

initBattleUI();
initBattleChat();


function renderProfileStats(){
    const profileInfo = document.getElementById('profile-info');
    if(!profileInfo) return;
    const totalResources = Object.values(playerResources || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    profileInfo.innerHTML = `
      <h2 class="profile-title">Пилот ${player.nickname}</h2>
      <div class="profile-grid">
        <div class="stat-card"><div class="cosmic-badge">Игровой ID</div><div>${authState.playerId || 0}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Email</div><div>${authState.email || 'Гость'}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Уровень</div><div>${player.level}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Кредиты</div><div>${player.credits}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Фраги</div><div>${battleStats.playerKills}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Смерти</div><div>${battleStats.playerDeaths}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Ресурсов</div><div>${totalResources}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Кораблей</div><div>${player.ships.length}</div></div>
      </div>`;
}

function renderHangarCosmic(){
    const hangarList = document.getElementById('hangar-list');
    if(!hangarList) return;
    hangarList.innerHTML = player.ships.map(ship => `
      <div class="ship-card">
        <div class="cosmic-badge">${ship.name}</div>
        <div>Уровень: ${ship.level}</div>
        <div>HP: ${ship.hp}</div>
        <div>Атака: ${ship.attack}</div>
        <div>Скорость: ${ship.speed}</div>
      </div>`).join('');
}

function renderClansWindow(){
    const clansInfo = document.getElementById('clans-info');
    if(!clansInfo) return;
    clansInfo.innerHTML = `
      <div class="clan-card"><div class="cosmic-badge">Ваш клан</div><div>Пока не выбран</div></div>
      <div class="clan-card"><div class="cosmic-badge">Возможности</div><div>Создать клан, подать заявку, список участников и клановый чат. Вкладка Clan уже добавлена в общий чат; для полной работы нужен clan_id игрока в базе.</div></div>
      <div class="clan-card"><div class="cosmic-badge">Топ кланы</div><div>1. Nova Wolves<br>2. Orbit Guard<br>3. Red Comets</div></div>`;
}

function renderLeadersWindow(){
    const leadersInfo = document.getElementById('leaders-info');
    if(!leadersInfo) return;
    const rows = [
      {place:1, name:'Commander', rating:1200 + battleStats.playerKills*15, wins:battleStats.playerKills, level:player.level},
      {place:2, name:'NovaX', rating:1140, wins:18, level:12},
      {place:3, name:'StarHunter', rating:1090, wins:16, level:11},
      {place:4, name:'Drone_x1', rating:980, wins:battleStats.botKills, level:1}
    ];
    leadersInfo.innerHTML = `<div class="leaders-table">
      <div class="leader-row header"><div>#</div><div>Пилот</div><div>Рейтинг</div><div>Победы</div><div>Уровень</div></div>
      ${rows.map(r => `<div class="leader-row"><div>${r.place}</div><div>${r.name}</div><div>${r.rating}</div><div>${r.wins}</div><div>${r.level}</div></div>`).join('')}
    </div>`;
}

function initExtraLobbyWindows(){
    const openers = [
      ['profile-tab','profile-window', renderProfileStats],
      ['hangar-tab','hangar-window', renderHangarCosmic],
      ['clans-tab','clans-window', renderClansWindow],
      ['leaders-tab','leaders-window', renderLeadersWindow],
    ];
    const allWindows = ['profile-window','hangar-window','clans-window','leaders-window'];
    function closeAll(){ allWindows.forEach(id => document.getElementById(id)?.classList.add('hidden')); }
    openers.forEach(([tabId, winId, renderer]) => {
      const tab = document.getElementById(tabId);
      const win = document.getElementById(winId);
      if(tab && win && !tab.dataset.boundExtra){
        tab.dataset.boundExtra = '1';
        tab.addEventListener('click', () => { closeAll(); renderer(); win.classList.remove('hidden'); });
      }
    });
    [['close-profile','profile-window'],['close-hangar','hangar-window'],['close-clans','clans-window'],['close-leaders','leaders-window']].forEach(([btnId,winId]) => {
      const btn = document.getElementById(btnId);
      const win = document.getElementById(winId);
      if(btn && win && !btn.dataset.boundExtra){
        btn.dataset.boundExtra = '1';
        btn.addEventListener('click', () => win.classList.add('hidden'));
      }
    });
}

window.addEventListener('load', () => {
    initExtraLobbyWindows();
    renderProfileStats();
    renderHangarCosmic();
    renderClansWindow();
    renderLeadersWindow();
});


// ===== V6 BATTLE + OBSERVE EXTENSIONS =====
function initCreateMatchLevels(){
    const minLevel = document.getElementById('min-level');
    const maxLevel = document.getElementById('max-level');
    if(!minLevel || !maxLevel || minLevel.dataset.filled) return;
    minLevel.dataset.filled = '1';
    const values = Array.from({length:120}, (_,i)=>i+1);
    minLevel.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join('');
    maxLevel.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join('');
    minLevel.value = '1';
    maxLevel.value = '120';
}

function createRockMesh(scale=1, color=0x5f6778){
    const geo = new THREE.IcosahedronGeometry(1.1 * scale, 0);
    const pos = geo.attributes.position;
    for(let i=0;i<pos.count;i++){
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const factor = 0.82 + Math.random() * 0.45;
        pos.setXYZ(i, x * factor, y * (0.75 + Math.random()*0.55), z * factor);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness:0.95, metalness:0.05 }));
}

function clearBattleObstacles(){
    battleObstacles.forEach(obj => obj && scene.remove(obj));
    battleObstacles = [];
    firing = false;
    setBattleChatOpen(false);
    const feed = document.getElementById('kill-feed'); if(feed) feed.innerHTML = "";
    const log = document.getElementById('battle-chat-log'); if(log) log.innerHTML = "";
}

function createBattleObstacles(mapKey){
    clearBattleObstacles();
    const obstaclePalette = {
        mercury:0x7f8287, venus:0x946f52, earth:0x5c6575, mars:0x8f523f,
        jupiter:0x8e7563, saturn:0x9b8a69, uranus:0x5d7984, neptune:0x50658c, sun:0x7c4f2e
    };
    const color = obstaclePalette[mapKey] || 0x6b7280;
    const count = mapKey === 'sun' ? 26 : 38;
    for(let i=0;i<count;i++){
        const rock = createRockMesh(0.7 + Math.random()*2.0, color);
        rock.position.set((Math.random()-0.5)*220, (Math.random()-0.5)*72, (Math.random()-0.5)*220);
        if(rock.position.distanceTo(new THREE.Vector3(0,-6,-320)) < 150 || rock.position.length() < 70){ rock.position.x += 90; rock.position.z += 70; }
        rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        rock.userData.radius = 1.8 + Math.random()*1.8;
        battleObstacles.push(rock);
        scene.add(rock);
    }
    for(let i=0;i<6;i++){
        const wreck = new THREE.Group();
        const beamMat = new THREE.MeshStandardMaterial({ color:0x46566d, roughness:0.82, metalness:0.28 });
        const beam1 = new THREE.Mesh(new THREE.BoxGeometry(4 + Math.random()*3,0.3,0.4), beamMat);
        const beam2 = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,3 + Math.random()*3), beamMat);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.12,1.3), new THREE.MeshStandardMaterial({ color:0x2d3f5c, roughness:0.75, metalness:0.45 }));
        beam2.rotation.y = Math.random();
        panel.position.set((Math.random()-0.5)*1.8, (Math.random()-0.5)*0.6, (Math.random()-0.5)*1.8);
        wreck.add(beam1, beam2, panel);
        wreck.position.set((Math.random()-0.5)*210, (Math.random()-0.5)*64, (Math.random()-0.5)*210);
        if(wreck.position.distanceTo(new THREE.Vector3(0,-6,-320)) < 150 || wreck.position.length() < 80){ wreck.position.x -= 80; wreck.position.z -= 80; }
        wreck.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        wreck.userData.radius = 2.8 + Math.random()*2.5;
        battleObstacles.push(wreck);
        scene.add(wreck);
    }
}

function handleBattleCollisions(object, velocityRef=null){
    if(!object) return;
    for(const obstacle of battleObstacles){
        if(!obstacle) continue;
        const radius = obstacle.userData?.radius || 2.5;
        const dist = object.position.distanceTo(obstacle.position);
        if(dist < radius + 2.5){
            const push = object.position.clone().sub(obstacle.position).normalize();
            if(!Number.isFinite(push.x)) push.set(1,0,0);
            object.position.copy(obstacle.position.clone().add(push.multiplyScalar(radius + 2.6)));
            if(velocityRef) velocityRef.multiplyScalar(0.55);
        }
    }
}

function spawnShipDebris(position, color=0xffffff){
    for(let i=0;i<14;i++){
        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.2 + Math.random()*0.7, 0.12 + Math.random()*0.5, 0.2 + Math.random()*0.7), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity:0.08, roughness:0.9, metalness:0.15 }));
        piece.position.copy(position);
        piece.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
        scene.add(piece);
        debrisPieces.push({
            mesh: piece,
            velocity: new THREE.Vector3((Math.random()-0.5)*0.7, (Math.random()-0.5)*0.45, (Math.random()-0.5)*0.7),
            spin: new THREE.Vector3((Math.random()-0.5)*0.12,(Math.random()-0.5)*0.12,(Math.random()-0.5)*0.12),
            ttl: 180
        });
    }
}

function updateDebrisPieces(){
    for(let i=debrisPieces.length-1;i>=0;i--){
        const d = debrisPieces[i];
        d.mesh.position.add(d.velocity);
        d.mesh.rotation.x += d.spin.x;
        d.mesh.rotation.y += d.spin.y;
        d.mesh.rotation.z += d.spin.z;
        d.velocity.multiplyScalar(0.985);
        d.ttl -= 1;
        if(d.ttl <= 0){
            scene.remove(d.mesh);
            debrisPieces.splice(i,1);
        }
    }
}

function createObserverBot(index=0){
    const botGroup = new THREE.Group();
    botGroup.rotation.order = 'YXZ';
    const hues = [0xff6a6a,0x6ad7ff,0xffc66a,0x9f8cff,0x6aff9a,0xff7ad8];
    const baseColor = hues[index % hues.length];
    const body = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.8, 8), new THREE.MeshStandardMaterial({ color:baseColor, emissive:baseColor, emissiveIntensity:0.06, roughness:0.45, metalness:0.55 }));
    body.rotation.x = -Math.PI/2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6,0.12,0.9), new THREE.MeshStandardMaterial({ color:0x324965, roughness:0.65, metalness:0.35 }));
    wing.position.set(-1.45,0,-0.05);
    const wing2 = wing.clone(); wing2.position.x = 1.45;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3,16,16), new THREE.MeshBasicMaterial({ color:0xf4fbff }));
    core.position.set(0,0.18,-1.0);
    botGroup.add(body, wing, wing2, core);
    botGroup.position.set((Math.random()-0.5)*28, (Math.random()-0.5)*9, (Math.random()-0.5)*28);
    botGroup.userData = {
        name: `Drone_${index+1}`,
        hp: 80, maxHp: 80, id: 9100 + index,
        strafePhase: Math.random() * Math.PI * 2,
        velocity: new THREE.Vector3(),
        nextShotAt: 0,
        respawnAt: 0,
        alive: true
    };
    scene.add(botGroup);
    return botGroup;
}

function setupObserverBattle(mapName){
    clearBattleScene();
    battleObserverMode = true;
    observerCameraYaw = 0;
    observerCameraPitch = -0.22;
    observerCameraDistance = 34;
    enterBattleMap(mapName);
    observerBots = Array.from({length:6}, (_,i) => createObserverBot(i));
    const hud = document.getElementById('enemy-hud');
    if(hud) hud.style.display = 'none';
}

function updateObserverBattle(){
    const aliveBots = observerBots.filter(bot => bot && bot.userData.alive);
    for(const bot of observerBots){
        if(!bot) continue;
        const data = bot.userData;
        if(!data.alive){
            if(Date.now() >= data.respawnAt){
                data.alive = true;
                data.hp = data.maxHp;
                bot.visible = true;
                bot.position.set((Math.random()-0.5)*28, (Math.random()-0.5)*10, (Math.random()-0.5)*28);
            }
            continue;
        }
        const targets = aliveBots.filter(other => other !== bot);
        if(!targets.length) continue;
        let target = targets[0];
        let minDist = bot.position.distanceTo(target.position);
        for(const cand of targets.slice(1)){
            const d = bot.position.distanceTo(cand.position);
            if(d < minDist){ minDist = d; target = cand; }
        }
        data.strafePhase += 0.03;
        const desiredForward = target.position.clone().sub(bot.position).normalize();
        const side = new THREE.Vector3(0,1,0).cross(desiredForward).normalize();
        const desiredPos = target.position.clone().add(desiredForward.clone().multiplyScalar(-13)).add(side.multiplyScalar(Math.sin(data.strafePhase)*6));
        desiredPos.y += Math.cos(data.strafePhase*1.6) * 3;
        bot.position.lerp(desiredPos, 0.028);
        handleBattleCollisions(bot, data.velocity);
        bot.lookAt(target.position);
        bot.rotation.z += ((Math.sin(data.strafePhase)*0.48) - bot.rotation.z) * 0.08;
        if(Date.now() >= data.nextShotAt){
            data.nextShotAt = Date.now() + 500 + Math.random()*350;
            fireObserverLaser(bot, target);
        }
    }
    const focus = aliveBots[0];
    if(focus){
        observerCameraTarget.lerp(focus.position, 0.08);
        const offset = new THREE.Vector3(
            Math.sin(observerCameraYaw) * Math.cos(observerCameraPitch),
            Math.sin(observerCameraPitch),
            Math.cos(observerCameraYaw) * Math.cos(observerCameraPitch)
        ).multiplyScalar(observerCameraDistance);
        const camTarget = observerCameraTarget.clone().add(offset);
        camera.position.lerp(camTarget, 0.09);
        camera.lookAt(observerCameraTarget);
    }
}

function fireObserverLaser(shooter, target){
    const dir = target.position.clone().sub(shooter.position).normalize();
    [-0.8,0.8].forEach(offsetX => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,1.6), new THREE.MeshBasicMaterial({ color:0xfff1a8 }));
        const localOffset = new THREE.Vector3(offsetX,0,-1.6).applyQuaternion(shooter.quaternion);
        mesh.position.copy(shooter.position.clone().add(localOffset));
        mesh.lookAt(shooter.position.clone().add(dir));
        scene.add(mesh);
        enemyLasers.push({ mesh, velocity: dir.clone().multiplyScalar(2.5), life: 90, damage: 10, shooter });
    });
}

(function bindObserverButton(){
    const btn = document.getElementById('observe-match-btn');
    if(btn && !btn.dataset.observeBound){
        btn.dataset.observeBound = '1';
        btn.addEventListener('click', () => {
            const targetMap = selectedLobbyMap?.real || currentRoom?.map || 'earth';
            battleObserverMode = true;
            currentRoom = { map: targetMap, observer: true, state:'observe' };
            switchState('OBSERVE');
        });
    }
})();

(function patchCreateMatchPreview(){
    const mapPreview = document.getElementById('map-preview');
    const mapSelectedName = document.getElementById('map-selected-name');
    if(mapPreview && !mapPreview.getAttribute('src')) mapPreview.setAttribute('src', 'maps/mercury.jpg');
    if(mapSelectedName && !mapSelectedName.textContent.trim()) mapSelectedName.textContent = 'Меркурий';
})();

function getStoredAccounts(){
    try{ return JSON.parse(localStorage.getItem('cosmicAccounts') || '[]'); }catch(_){ return []; }
}
function saveStoredAccounts(accounts){ localStorage.setItem('cosmicAccounts', JSON.stringify(accounts)); }
function getNextAccountId(accounts){
    const maxId = accounts.reduce((max, acc) => Math.max(max, Number(acc.id) || 0), 0);
    return maxId + 1;
}
function ensureDeveloperAccount(){
    const devEmail = 'calean3@gmail.com';
    const devPassword = '123';
    const accounts = getStoredAccounts();
    const existing = accounts.find(acc => acc.email.toLowerCase() === devEmail);
    if(existing){
        existing.password = devPassword;
        existing.nickname = existing.nickname || 'Developer';
        existing.id = Number(existing.id) || 3;
        existing.emailVerified = true;
        existing.developer = true;
    } else {
        accounts.push({
            email: devEmail,
            password: devPassword,
            nickname: 'Developer',
            id: 3,
            emailVerified: true,
            developer: true,
            verificationCode: ''
        });
    }
    saveStoredAccounts(accounts);
}
function findStoredAccountByEmail(email){
    return getStoredAccounts().find(acc => acc.email.toLowerCase() === String(email || '').trim().toLowerCase());
}
function updatePremiumAccountInfo(){
    const nameEl = document.getElementById('premium-player-name');
    const idEl = document.getElementById('premium-player-id');
    if(nameEl) nameEl.textContent = player?.nickname || 'Commander';
    if(idEl) idEl.textContent = `ID: ${authState.playerId || 0}`;
    const crystalEl = document.getElementById('premium-crystals');
    const coinsEl = document.getElementById('premium-coins');
    if(crystalEl) crystalEl.textContent = `💎 ${playerResources?.crystals || 0}`;
    if(coinsEl) coinsEl.textContent = `🪙 ${playerResources?.coins || 0}`;
}
function updateNicknameSettingsState(message=''){
    const nicknameInput = document.getElementById('nickname-input');
    const nicknameStatus = document.getElementById('nickname-status');
    if(nicknameInput) nicknameInput.value = player?.nickname || '';
    if(nicknameStatus) nicknameStatus.textContent = message || (player?.nickname || '—');
    updatePremiumAccountInfo();
}
function logoutToAuth(message='Возврат в меню входа.'){
    try{ resetPrivateChatState?.(); }catch(_e){}
    stopRemotePlayerSync?.();
    window.playerMuted = false;
    player.isMuted = false;
    authState.mode = 'guest';
    authState.email = '';
    authState.password = '';
    authState.isAuthenticated = false;
    authState.playerId = 0;
    authState.emailVerified = false;
    authState.pendingVerificationEmail = '';
    authState.pendingVerificationCode = '';
    window.currentRoomId = null;
    try{ saveGame(); }catch(_e){}
    resetBattleInputState();
    applyAuthUIState(message);
    switchState('AUTH');
}
function saveNicknameFromSettings(){
    const nicknameInput = document.getElementById('nickname-input');
    const nextNickname = nicknameInput?.value?.trim() || '';
    if(!nextNickname){ updateNicknameSettingsState('Введите ник'); return; }
    player.nickname = nextNickname.slice(0, 20);
    updateNicknameSettingsState('Сохранено');
    updateHUD?.();
    updatePremiumAccountInfo?.();
    if(authState.mode === 'account' && authState.playerId && window.supabaseClient){
        window.supabaseClient.from('players').update({ nickname: player.nickname }).eq('public_id', authState.playerId)
            .then(({error}) => { if(error) console.warn('Не удалось сохранить ник:', error.message); else saveGame(); });
    } else {
        saveGame();
    }
}
function applyAuthUIState(message=''){
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const verifyCode = document.getElementById('verify-code');
    const remember = document.getElementById('remember-password');
    const authMessage = document.getElementById('auth-message');
    const rememberedEmail = localStorage.getItem('cosmicRememberedEmail') || '';
    const rememberedPassword = localStorage.getItem('cosmicRememberedPassword') || '';
    if(loginEmail) loginEmail.value = rememberedEmail;
    if(loginPassword) loginPassword.value = rememberedPassword;
    if(registerEmail && rememberedEmail) registerEmail.value = rememberedEmail;
    if(registerPassword && rememberedPassword) registerPassword.value = rememberedPassword;
    if(verifyCode) verifyCode.value = '';
    if(remember) remember.checked = !!rememberedEmail;
    if(authMessage) authMessage.textContent = message;
}
function openGameAsGuest(){
    stopRemotePlayerSync?.();
    window.playerMuted = false;
    player.isMuted = false;
    authState.mode='guest';
    authState.email='';
    authState.password='';
    authState.isAuthenticated=true;
    authState.playerId = 0;
    authState.emailVerified = false;
    window.currentRoomId = null;
    player.nickname='Guest Pilot';
    resetPlayerProgress();
    updatePremiumAccountInfo();
    switchState('LOBBY');
}
function registerLocalAccount(){
    const email = document.getElementById('register-email')?.value?.trim() || '';
    const password = document.getElementById('register-password')?.value || '';
    if(!email || !password){
        showAuthMessage('Введите email и пароль для регистрации.');
        return;
    }

    (async () => {
        try{
            const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
            if(error){
                showAuthMessage('Ошибка: ' + error.message);
                return;
            }
            const loginEmail = document.getElementById('login-email');
            const loginPassword = document.getElementById('login-password');
            if(loginEmail) loginEmail.value = email;
            if(loginPassword) loginPassword.value = password;
            showAuthMessage('Регистрация успешна. Теперь войди в аккаунт.');
        }catch(err){
            showAuthMessage('Ошибка: ' + (err?.message || err));
        }
    })();
}
function confirmEmailCode(){
    showAuthMessage('Код подтверждения больше не используется. Просто войди в аккаунт.');
}
function loginLocalAccount(){
    const email = document.getElementById('login-email')?.value?.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const remember = document.getElementById('remember-password');

    if(!email || !password){
        showAuthMessage('Введите email и пароль.');
        return;
    }

    (async () => {
        try{
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if(error){
                showAuthMessage('Ошибка входа: ' + error.message);
                return;
            }

            const user = data?.user;
            authState.mode = 'account';
            authState.email = email;
            authState.password = password;
            authState.isAuthenticated = true;
            authState.emailVerified = true;
            authState.pendingVerificationEmail = '';
            authState.pendingVerificationCode = '';

            const nickname = email.split('@')[0] || 'Pilot';
            let playerRow = null;

            const existingRes = await window.supabaseClient
                .from('players')
                .select('public_id,nickname,email,auth_id,level,credits,created_at,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
                .eq('auth_id', user?.id || '')
                .maybeSingle();

            if(existingRes.error){
                console.warn('Ошибка чтения players:', existingRes.error.message);
            }
            playerRow = existingRes.data || null;

            if(!playerRow){
                const insertRes = await window.supabaseClient
                    .from('players')
                    .insert({
                        auth_id: user?.id,
                        email,
                        nickname,
                        level: player.level || 1,
                        credits: Number(playerResources.coins || player.credits || 500),
                        mercury_ore: Number(playerResources.mercury_ore || 0),
                        venus_gas: Number(playerResources.venus_gas || 0),
                        earth_water: Number(playerResources.earth_water || 0),
                        mars_crystal: Number(playerResources.mars_crystal || 0),
                        jupiter_hydrogen: Number(playerResources.jupiter_hydrogen || 0),
                        saturn_ice: Number(playerResources.saturn_ice || 0),
                        uranus_ammonia: Number(playerResources.uranus_ammonia || 0),
                        neptune_methane: Number(playerResources.neptune_methane || 0),
                        solar_energy: Number(playerResources.solar_energy || 0),
                        crystals: Number(playerResources.crystals || 0),
                        created_at: new Date().toISOString()
                    })
                    .select('public_id,nickname,email,auth_id,level,credits,created_at,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
                    .single();

                if(insertRes.error){
                    console.warn('Ошибка создания players при входе:', insertRes.error.message);
                }else{
                    playerRow = insertRes.data;
                }
            }

            authState.playerId = Number(playerRow?.public_id) || 0;
            player.id = authState.playerId || user?.id || 'local_player';
            player.nickname = playerRow?.nickname || nickname;
            player.level = Number(playerRow?.level || player.level || 1);
            player.credits = Number(playerRow?.credits || player.credits || 500);
            applyPlayerIdentityRow(playerRow || { public_id: authState.playerId, staff_role: 'player' });

            if(remember?.checked){
                localStorage.setItem('cosmicRememberedEmail', email);
                localStorage.setItem('cosmicRememberedPassword', password);
            }else{
                localStorage.removeItem('cosmicRememberedEmail');
                localStorage.removeItem('cosmicRememberedPassword');
            }

            resetPlayerProgress();
            await loadGame();
            await loadPlayerResourcesFromSupabase();
            startRemotePlayerSync();
            window.currentRoomId = null;
            updateNicknameSettingsState();
            updatePremiumAccountInfo();
            renderProfileStats?.();
            switchState('LOBBY');
            saveGame();
        }catch(err){
            showAuthMessage('Ошибка входа: ' + (err?.message || err));
        }
    })();
}
function showForgotPassword(){
    const email = document.getElementById('login-email')?.value?.trim() || '';
    if(!email){ showAuthMessage('Сначала введи email, затем нажми «Забыли пароль?»'); return; }
    showAuthMessage(`Для ${email} используй восстановление пароля через Supabase Dashboard или настрой SMTP позже.`);
}
function initAuthScreen(){
    ensureDeveloperAccount();
    applyAuthUIState('Вход и регистрация работают через Supabase.');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const guestBtn = document.getElementById('guest-login-btn');
    const forgotBtn = document.getElementById('forgot-password-btn');
    const verifyBtn = document.getElementById('verify-email-btn');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const verifyCode = document.getElementById('verify-code');
    if(loginBtn && !loginBtn.dataset.bound){ loginBtn.dataset.bound='1'; loginBtn.addEventListener('click', loginLocalAccount); }
    if(registerBtn && !registerBtn.dataset.bound){ registerBtn.dataset.bound='1'; registerBtn.addEventListener('click', registerLocalAccount); }
    if(guestBtn && !guestBtn.dataset.bound){ guestBtn.dataset.bound='1'; guestBtn.addEventListener('click', openGameAsGuest); }
    if(forgotBtn && !forgotBtn.dataset.bound){ forgotBtn.dataset.bound='1'; forgotBtn.addEventListener('click', showForgotPassword); }
    if(verifyBtn && !verifyBtn.dataset.bound){ verifyBtn.dataset.bound='1'; verifyBtn.addEventListener('click', confirmEmailCode); }
    [loginEmail, loginPassword].forEach((el) => {
        if(el && !el.dataset.enterBound){
            el.dataset.enterBound='1';
            el.addEventListener('keydown', (e) => { if(e.key === 'Enter') loginLocalAccount(); });
        }
    });
    [registerEmail, registerPassword].forEach((el) => {
        if(el && !el.dataset.enterBound){
            el.dataset.enterBound='1';
            el.addEventListener('keydown', (e) => { if(e.key === 'Enter') registerLocalAccount(); });
        }
    });
    if(verifyCode && !verifyCode.dataset.enterBound){
        verifyCode.dataset.enterBound='1';
        verifyCode.addEventListener('keydown', (e) => { if(e.key === 'Enter') confirmEmailCode(); });
    }
    switchState('AUTH');
}

// ===== BATTLE MAP LIMIT =====
function limitBattleArea(){
    if(!playerShip) return;
    const center = new THREE.Vector3(0, 0, 0);
    const toShip = playerShip.position.clone().sub(center);
    const limit = 760;
    const dist = toShip.length();
    if(dist <= limit) return;
    const normal = toShip.normalize();
    const soft = THREE.MathUtils.clamp((dist - limit) / 80, 0, 1);
    const targetPos = center.clone().add(normal.clone().multiplyScalar(limit - 2));
    playerShip.position.lerp(targetPos, 0.12 + soft * 0.18);
    const outwardSpeed = shipVelocity.dot(normal);
    if(outwardSpeed > 0){
        shipVelocity.addScaledVector(normal, -outwardSpeed * (0.35 + soft * 0.35));
    }
    shipVelocity.multiplyScalar(0.96);
}


/* ================= V16 STABILITY PATCH ================= */
(function(){
    function setBodyStateClass(){
        if(!document.body) return;
        document.body.classList.remove('state-auth','state-lobby','state-orbit','state-battle','state-observe');
        const key = String(gameState || 'auth').toLowerCase();
        document.body.classList.add('state-' + key);
    }

    const baseSwitchState = switchState;
    switchState = function(newState){
        baseSwitchState(newState);
        setBodyStateClass();
        const premiumBar = document.getElementById('premium-bar');
        const resourceBar = document.getElementById('resource-bar');
        const ui = document.getElementById('ui');
        if(premiumBar) premiumBar.style.display = gameState === 'LOBBY' ? 'flex' : 'none';
        if(resourceBar) resourceBar.style.display = gameState === 'ORBIT' ? 'flex' : 'none';
        if(ui) ui.style.display = 'none';
        updateBattlePlayerHud();
    };
    window.switchState = switchState;

    const baseUpdateHUD = updateHUD;
    updateHUD = function(){
        const bar = document.getElementById('resource-bar');
        if(bar){
            let html = '';
            for(const planetName in planetResources){
                html += `<div class="planet-block"><div class="planet-title">${planetName}</div>`;
                const resources = planetResources[planetName] || [];
                for(const resId of resources){
                    if(!playerResources[resId]) playerResources[resId] = 0;
                    const info = resourceInfo[resId];
                    if(!info) continue;
                    html += `<div class="resource-item"><span class="icon">${info.icon}</span><span class="amount">${playerResources[resId]}</span><span class="tooltip">${info.name}</span></div>`;
                }
                html += `</div>`;
            }
            bar.innerHTML = html;
        }
        playerResources.coins = playerResources.coins || 0;
        playerResources.crystals = playerResources.crystals || 0;
        const premiumBar = document.getElementById('premium-bar');
        const premiumCrystals = document.getElementById('premium-crystals');
        const premiumCoins = document.getElementById('premium-coins');
        if(premiumCrystals) premiumCrystals.textContent = `💎 ${playerResources.crystals}`;
        if(premiumCoins) premiumCoins.textContent = `🪙 ${playerResources.coins}`;
        updatePremiumAccountInfo();
        if(premiumBar){
            premiumBar.style.display = gameState === 'LOBBY' ? 'flex' : 'none';
        }
        setBodyStateClass();
    };

    getBattlePlanetConfig = function(mapKey){
        const configs = {
            sun:{ color:0xffc84a, size:132, light:0xffdd88 },
            mercury:{ color:0xb7b7b7, size:92, light:0xffffff },
            venus:{ color:0xe4b382, size:108, light:0xffe1b3 },
            earth:{ color:0x3b7cff, size:118, light:0xd6edff },
            mars:{ color:0xc1583a, size:102, light:0xffd2b6 },
            jupiter:{ color:0xcda27f, size:152, light:0xfff0db },
            saturn:{ color:0xd9c08a, size:142, light:0xffefcc },
            uranus:{ color:0x86d8dd, size:126, light:0xe1ffff },
            neptune:{ color:0x4469ff, size:126, light:0xdce6ff }
        };
        return configs[mapKey] || configs.earth;
    };

    enterBattleMap = function(mapName){
        const mapKey = normalizeBattleMapName(mapName);
        selectedLobbyMap = { ...(selectedLobbyMap || {}), real: mapKey, name: mapKey };
        clearBattleScene();
        if(solarSystem && scene.children.includes(solarSystem)) scene.remove(solarSystem);

        const config = getBattlePlanetConfig(mapKey);
        const ambient = new THREE.AmbientLight(0xffffff, 1.3);
        const point = new THREE.PointLight(config.light, 3.1, 4200);
        point.position.set(90, 70, 160);
        battleObjects.push(ambient, point);
        scene.add(ambient, point);

        const planetGeometry = new THREE.SphereGeometry(config.size, 64, 64);
        const planetMaterial = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.92, metalness: 0.04 });
        battleMapPlanet = new THREE.Mesh(planetGeometry, planetMaterial);
        battleMapPlanet.position.set(0, -12, -230);
        battleMapPlanet.userData.radius = config.size;
        battleMapPlanet.userData.solidRadius = config.size + 3;
        battleMapPlanet.userData.atmosphereRadius = config.size + 90;
        battleMapPlanet.userData.nearSurfaceRadius = config.size + 18;
        battleMapPlanet.userData.crashRadius = config.size + 8;
        scene.add(battleMapPlanet);

        if(mapKey === 'saturn'){
            const ringGeo = new THREE.RingGeometry(config.size * 1.42, config.size * 2.2, 128);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xd9c08a, side: THREE.DoubleSide, transparent:true, opacity:0.66 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2.38;
            battleMapPlanet.add(ring);
        }

        spawnPointA = new THREE.Vector3(-320, 12, 260);
        spawnPointB = new THREE.Vector3(320, -16, -260);
        observerCameraTarget.copy(battleMapPlanet.position);
        battlePlanetVisualScale = 1;
        camera.position.set(0, 30, 150);
        camera.lookAt(0, 0, 0);
        createBattleObstacles(mapKey);
        updateBattleScoreboard();
    };

    createBattleObstacles = function(mapKey){
        clearBattleObstacles();
        const obstaclePalette = {
            mercury:0x7f8287, venus:0x946f52, earth:0x5c6575, mars:0x8f523f,
            jupiter:0x8e7563, saturn:0x9b8a69, uranus:0x5d7984, neptune:0x50658c, sun:0x7c4f2e
        };
        const color = obstaclePalette[mapKey] || 0x6b7280;
        const center = battleMapPlanet ? battleMapPlanet.position.clone() : new THREE.Vector3(0,-12,-230);
        for(let i=0;i<48;i++){
            const rock = createRockMesh(1.0 + Math.random()*2.8, color);
            rock.position.set((Math.random()-0.5)*760, (Math.random()-0.5)*180, (Math.random()-0.5)*760);
            if(rock.position.distanceTo(center) < 220 || rock.position.distanceTo(spawnPointA) < 120 || rock.position.distanceTo(spawnPointB) < 120){
                rock.position.x += (rock.position.x < 0 ? -1 : 1) * 140;
                rock.position.z += (rock.position.z < 0 ? -1 : 1) * 140;
            }
            rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            rock.userData.radius = 4.5 + Math.random()*7.5;
            battleObstacles.push(rock);
            scene.add(rock);
        }
        for(let i=0;i<10;i++){
            const wreck = new THREE.Group();
            const beamMat = new THREE.MeshStandardMaterial({ color:0x46566d, roughness:0.82, metalness:0.28 });
            const beam1 = new THREE.Mesh(new THREE.BoxGeometry(8 + Math.random()*8,0.5,0.7), beamMat);
            const beam2 = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.5,7 + Math.random()*7), beamMat);
            const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.18,2.1), new THREE.MeshStandardMaterial({ color:0x2d3f5c, roughness:0.75, metalness:0.45 }));
            beam2.rotation.y = Math.random();
            panel.position.set((Math.random()-0.5)*2.2, (Math.random()-0.5)*0.7, (Math.random()-0.5)*2.2);
            wreck.add(beam1, beam2, panel);
            wreck.position.set((Math.random()-0.5)*720, (Math.random()-0.5)*170, (Math.random()-0.5)*720);
            if(wreck.position.distanceTo(center) < 260 || wreck.position.distanceTo(spawnPointA) < 130 || wreck.position.distanceTo(spawnPointB) < 130){
                wreck.position.x += (wreck.position.x < 0 ? -1 : 1) * 180;
                wreck.position.z += (wreck.position.z < 0 ? -1 : 1) * 180;
            }
            wreck.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            wreck.userData.radius = 8 + Math.random()*8;
            battleObstacles.push(wreck);
            scene.add(wreck);
        }
    };

    handleBattleCollisions = function(object, velocityRef=null){
        if(!object) return;
        for(const obstacle of battleObstacles){
            if(!obstacle) continue;
            const radius = obstacle.userData?.radius || 4;
            const delta = object.position.clone().sub(obstacle.position);
            const dist = delta.length();
            const minDist = radius + 3.2;
            if(dist < minDist){
                const push = delta.normalize();
                if(!Number.isFinite(push.x)) push.set(1,0,0);
                object.position.copy(obstacle.position.clone().add(push.multiplyScalar(minDist + 0.2)));
                if(velocityRef) velocityRef.multiplyScalar(0.42);
            }
        }
        if(!battleMapPlanet) return;
        const delta = object.position.clone().sub(battleMapPlanet.position);
        const dist = delta.length();
        const solidRadius = battleMapPlanet.userData?.solidRadius || (battleMapPlanet.userData?.radius || 100);
        const crashRadius = battleMapPlanet.userData?.crashRadius || solidRadius + 6;
        if(object === playerShip && !battleShipCrash && dist <= crashRadius){
            startShipCrashAnimation();
            return;
        }
        const minDist = solidRadius + 2.6;
        if(dist < minDist){
            const push = delta.normalize();
            if(!Number.isFinite(push.x)) push.set(0,1,0);
            object.position.copy(battleMapPlanet.position.clone().add(push.multiplyScalar(minDist)));
            if(velocityRef) velocityRef.multiplyScalar(0.3);
        }
    };

    updateBattlePlanetEffects = function(){
        if(!battleMapPlanet || !playerShip || battleObserverMode) return;
        const toPlanet = battleMapPlanet.position.clone().sub(playerShip.position);
        const distance = toPlanet.length();
        const radius = battleMapPlanet.userData?.radius || 100;
        const atmosphereRadius = battleMapPlanet.userData?.atmosphereRadius || radius + 90;
        const crashRadius = battleMapPlanet.userData?.crashRadius || radius + 8;
        const nearSurfaceRadius = battleMapPlanet.userData?.nearSurfaceRadius || radius + 18;

        const closeness = THREE.MathUtils.clamp((atmosphereRadius - distance) / atmosphereRadius, 0, 1);
        const scaleBoost = THREE.MathUtils.clamp(1 + closeness * 1.1, 1, 2.15);
        battlePlanetVisualScale += (scaleBoost - battlePlanetVisualScale) * 0.1;
        battleMapPlanet.scale.setScalar(battlePlanetVisualScale);

        if(distance <= crashRadius){
            startShipCrashAnimation();
            return;
        }

        if(distance < atmosphereRadius){
            const towardPlanet = toPlanet.clone().normalize();
            shipVelocity.add(towardPlanet.multiplyScalar(0.055 * Math.max(0.12, closeness)));
            if(distance < nearSurfaceRadius){
                shipVelocity.multiplyScalar(0.88);
            }
        }
    };

    limitBattleArea = function(){
        if(gameState !== 'BATTLE' || !playerShip) return;
        const center = new THREE.Vector3(0, 0, 0);
        const toShip = playerShip.position.clone().sub(center);
        const limit = 1320;
        const dist = toShip.length();
        if(dist <= limit) return;
        const normal = toShip.normalize();
        const soft = THREE.MathUtils.clamp((dist - limit) / 130, 0, 1);
        const targetPos = center.clone().add(normal.clone().multiplyScalar(limit - 2));
        playerShip.position.lerp(targetPos, 0.1 + soft * 0.14);
        const outwardSpeed = shipVelocity.dot(normal);
        if(outwardSpeed > 0) shipVelocity.addScaledVector(normal, -outwardSpeed * (0.45 + soft * 0.25));
        shipVelocity.multiplyScalar(0.97);
    };

    const baseSetupObserverBattle = setupObserverBattle;
    setupObserverBattle = function(mapName){
        baseSetupObserverBattle(mapName);
        observerCameraYaw = 0.2;
        observerCameraPitch = -0.18;
        observerCameraDistance = 120;
        if(battleMapPlanet) observerCameraTarget.copy(battleMapPlanet.position);
        const canvas = document.querySelector('canvas');
        if(canvas) setTimeout(() => canvas.requestPointerLock?.(), 80);
    };

    const baseOpenGameAsGuest = openGameAsGuest;
    openGameAsGuest = function(){
        baseOpenGameAsGuest();
        setBodyStateClass();
        updateHUD();
    };

    const baseLoginLocalAccount = loginLocalAccount;
    loginLocalAccount = function(){
        baseLoginLocalAccount();
        setBodyStateClass();
        updateHUD();
        loadGame();
    };

    const baseRegisterLocalAccount = registerLocalAccount;
    registerLocalAccount = function(){
        baseRegisterLocalAccount();
        setBodyStateClass();
    };

    setBodyStateClass();
    updateHUD();
})();


/* ================= V26 LOBBY + OBSERVE PATCH ================= */
(function(){
    const SOLO_MISSION_DATA = [
        { title:'Разведка Меркурия', real:'mercury', img:'mercury', mode:'Solo', mission:'Уничтожить 1 бота-разведчика', players:'1/1', minLevel:1, maxLevel:10 },
        { title:'Шторм Венеры', real:'venus', img:'venus', mode:'Solo', mission:'Пережить атаку ботов', players:'1/1', minLevel:5, maxLevel:20 },
        { title:'Оборона Земли', real:'earth', img:'earth', mode:'Solo', mission:'Уничтожить 3 волны ботов', players:'1/1', minLevel:1, maxLevel:30 },
        { title:'Марсианская зачистка', real:'mars', img:'mars', mode:'Solo', mission:'Очистить сектор от ботов', players:'1/1', minLevel:10, maxLevel:40 },
        { title:'Патруль Юпитера', real:'jupiter', img:'jupiter', mode:'Solo', mission:'Выжить в тяжёлом секторе', players:'1/1', minLevel:20, maxLevel:60 }
    ];

    let lobbyMode = 'battle';

    function ensureSunBackToOrbit(){
        try{
            if(typeof sun === 'undefined' || !sun || typeof solarSystem === 'undefined' || !solarSystem) return;
            sun.visible = true;
            if(!solarSystem.children.includes(sun)) solarSystem.add(sun);
            sun.position.set(0,0,0);
            if(typeof sunOrbitData !== 'undefined' && sunOrbitData){
                sunOrbitData.mesh = sun;
                sunOrbitData.orbitPivot = solarSystem;
                sunOrbitData.originalLocalPosition = new THREE.Vector3(0,0,0);
                if(sunOrbitData.resourceLabel && !sun.children.includes(sunOrbitData.resourceLabel)){
                    sun.add(sunOrbitData.resourceLabel);
                }
                sunOrbitData.updateResourceLabelPosition?.(false);
                sunOrbitData.updateResourceLabel?.();
            }
        }catch(error){
            console.warn('Sun restore warning:', error);
        }
    }

    function getBattleDataset(){
        return (typeof LOBBY_MAP_DATA !== 'undefined' && Array.isArray(LOBBY_MAP_DATA) && LOBBY_MAP_DATA.length)
            ? LOBBY_MAP_DATA
            : [
                { title:'Earth Core', real:'earth', img:'earth', mode:'DM' },
                { title:'Mars Colony', real:'mars', img:'mars', mode:'Survival' }
            ];
    }

    function getCurrentLobbyDataset(){
        return lobbyMode === 'solo' ? SOLO_MISSION_DATA : getBattleDataset();
    }

    function updateLobbyTabStyles(){
        const battleTab = document.getElementById('battle-zone-tab');
        const soloTab = document.getElementById('solo-tab');
        const shopTab = document.getElementById('shop-tab');
        [battleTab, soloTab, shopTab].forEach(tab => {
            if(!tab) return;
            tab.style.color = '';
            tab.style.textShadow = '';
        });
        if(battleTab && lobbyMode === 'battle'){
            battleTab.style.color = '#00ffff';
            battleTab.style.textShadow = '0 0 10px rgba(0,255,255,0.4)';
        }
        if(soloTab && lobbyMode === 'solo'){
            soloTab.style.color = '#00ffff';
            soloTab.style.textShadow = '0 0 10px rgba(0,255,255,0.4)';
        }
    }

    function renderLobbyList(mode = 'battle'){
        lobbyMode = mode;
        const matchListEl = document.getElementById('match-list');
        const preview = document.getElementById('planet-preview');
        const playersBox = document.getElementById('map-players');
        if(!matchListEl) return;
        matchListEl.innerHTML = '';
        const dataset = getCurrentLobbyDataset();
        dataset.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'match-item';
            item.innerHTML =
              '<span class="map-title">'+entry.title+'</span>'+
              '<span class="map-real">'+entry.real+'</span>'+
              '<span class="map-mode">'+(entry.mode || (mode === 'solo' ? 'Solo' : 'DM'))+'</span>'+
              '<span class="map-players">'+(entry.players || (mode === 'solo' ? '1/1' : '0/8'))+'</span>'+
              '<span class="map-level">★ '+(entry.minLevel || 1)+' - ★ '+(entry.maxLevel || 120)+'</span>';
            item.addEventListener('click', () => {
                document.querySelectorAll('#match-list .match-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                selectedLobbyMap = { ...entry, name: entry.real };
                currentRoom = { map: entry.real, state: mode, solo: mode === 'solo', title: entry.title, mission: entry.mission || '' };
                if(preview){
                    preview.style.backgroundImage = `url(maps/${entry.img}.jpg)`;
                    preview.style.backgroundSize = 'cover';
                    preview.style.backgroundPosition = 'center';
                }
                if(playersBox){
                    playersBox.innerHTML = '';
                    if(mode === 'solo'){
                        // В одиночной игре под квадратом ничего не показываем
                    }else{
                        for(let i=0;i<8;i++){
                            const slot = document.createElement('div');
                            slot.className = 'player-slot';
                            slot.textContent = i === 0 ? 'Свободная карта' : 'Ожидание игрока';
                            playersBox.appendChild(slot);
                        }
                    }
                }
            });
            matchListEl.appendChild(item);
            if(index === 0) item.click();
        });
        const observeBtn = document.getElementById('observe-match-btn');
        if(observeBtn) observeBtn.style.display = mode === 'solo' ? 'none' : 'inline-flex';
        updateLobbyTabStyles();
    }

    function rebindLobbyButtons(){
        const joinBtnOld = document.getElementById('join-match-btn');
        if(joinBtnOld && !joinBtnOld.dataset.v26Bound){
            const joinBtn = joinBtnOld.cloneNode(true);
            joinBtnOld.replaceWith(joinBtn);
            joinBtn.dataset.v26Bound = '1';
            joinBtn.addEventListener('click', () => {
                const selected = selectedLobbyMap || getCurrentLobbyDataset()[0];
                currentRoom = {
                    map: selected.real,
                    state: lobbyMode,
                    solo: lobbyMode === 'solo',
                    title: selected.title,
                    mission: selected.mission || '',
                    players: [{ name: getDisplayPlayerTag() }]
                };
                switchState('BATTLE');
            });
        }

        const observeBtnOld = document.getElementById('observe-match-btn');
        if(observeBtnOld && !observeBtnOld.dataset.v26Bound){
            const observeBtn = observeBtnOld.cloneNode(true);
            observeBtnOld.replaceWith(observeBtn);
            observeBtn.dataset.v26Bound = '1';
            observeBtn.addEventListener('click', () => {
                if(lobbyMode === 'solo') return;
                const targetMap = selectedLobbyMap?.real || currentRoom?.map || 'earth';
                battleObserverMode = true;
                currentRoom = { map: targetMap, observer: true, state:'observe' };
                switchState('OBSERVE');
                const canvas = document.querySelector('canvas');
                if(canvas){
                    try{ safeRequestPointerLock(canvas); }catch(_){ }
                }
            });
        }
    }

    function bindTopNavModes(){
        const battleTab = document.getElementById('battle-zone-tab');
        const soloTab = document.getElementById('solo-tab');
        const shopTab = document.getElementById('shop-tab');

        if(battleTab && !battleTab.dataset.v26Bound){
            battleTab.dataset.v26Bound = '1';
            battleTab.onclick = () => {
                if(gameState !== 'LOBBY') switchState('LOBBY');
                renderLobbyList('battle');
            };
        }
        if(soloTab && !soloTab.dataset.v26Bound){
            soloTab.dataset.v26Bound = '1';
            soloTab.onclick = () => {
                if(isGuestAccount()){
                    showGuestOnlyPvpMessage();
                    return;
                }
                if(gameState !== 'LOBBY') switchState('LOBBY');
                renderLobbyList('solo');
            };
        }
        if(shopTab && !shopTab.dataset.v26Bound){
            shopTab.dataset.v26Bound = '1';
            shopTab.onclick = () => {
                alert('🛒 Магазин скоро появится');
            };
        }
    }

    const prevSwitchState = switchState;
    switchState = function(newState){
        prevSwitchState(newState);
        if(newState === 'ORBIT'){
            ensureSunBackToOrbit();
            if(typeof orbitNebulaGroup !== 'undefined' && orbitNebulaGroup) orbitNebulaGroup.visible = true;
            updateHUD?.();
        }
        if(newState === 'OBSERVE'){
            const canvas = document.querySelector('canvas');
            if(canvas){
                setTimeout(() => {
                    try{ safeRequestPointerLock(canvas); }catch(_){ }
                }, 10);
            }
        }
        if(newState === 'LOBBY'){
            bindTopNavModes();
            rebindLobbyButtons();
            renderLobbyList(lobbyMode || 'battle');
        }
    };
    window.switchState = switchState;

    document.addEventListener('click', (event) => {
        if(gameState !== 'OBSERVE') return;
        const canvas = document.querySelector('canvas');
        if(canvas && document.pointerLockElement !== canvas){
            try{ safeRequestPointerLock(canvas); }catch(_){ }
        }
    }, true);

    window.addEventListener('load', () => {
        bindTopNavModes();
        rebindLobbyButtons();
        ensureSunBackToOrbit();
        if(gameState === 'LOBBY') renderLobbyList('battle');
    });
})();


/* ================= V27 LOBBY MODES + TOURNAMENT + OBSERVER FIX ================= */
(function(){
    const SOLO_DATA = [
        { title:'Разведка Меркурия', real:'mercury', img:'mercury', mode:'Solo', mission:'Уничтожить 5 ботов-разведчиков', players:'1/1', minLevel:1, maxLevel:10, goalKills:10 },
        { title:'Шторм Венеры', real:'venus', img:'venus', mode:'Solo', mission:'Пережить атаку газовых дронов', players:'1/1', minLevel:5, maxLevel:20, goalKills:10 },
        { title:'Оборона Земли', real:'earth', img:'earth', mode:'Solo', mission:'Защитить орбиту от трёх волн', players:'1/1', minLevel:1, maxLevel:30, goalKills:20 },
        { title:'Марсианская зачистка', real:'mars', img:'mars', mode:'Solo', mission:'Очистить сектор от ботов', players:'1/1', minLevel:10, maxLevel:40, goalKills:10 },
        { title:'Тяжёлый Юпитер', real:'jupiter', img:'jupiter', mode:'Solo', mission:'Выжить в зоне тяжёлых турелей', players:'1/1', minLevel:20, maxLevel:60, goalKills:20 }
    ];

    const createdBattleRooms = [];
    const tournamentRooms = [];
    let lobbyModeV27 = 'battle';

    window.getLobbyModeV27 = function(){
        return lobbyModeV27;
    };

    window.setLobbyModeV27 = function(mode){
        if(typeof mode === 'string' && mode.trim()) lobbyModeV27 = mode;
        return lobbyModeV27;
    };

    function ensureSunStable(){
        try{
            if(typeof sun === 'undefined' || !sun || typeof solarSystem === 'undefined' || !solarSystem) return;
            sun.visible = true;
            if(!solarSystem.children.includes(sun)) solarSystem.add(sun);
            sun.position.set(0,0,0);
            sun.rotation.set(0, sun.rotation.y || 0, 0);
            if(typeof sunOrbitData !== 'undefined' && sunOrbitData){
                sunOrbitData.mesh = sun;
                sunOrbitData.orbitPivot = solarSystem;
                sunOrbitData.originalLocalPosition = new THREE.Vector3(0,0,0);
                if(sunOrbitData.resourceLabel && !sun.children.includes(sunOrbitData.resourceLabel)){
                    sun.add(sunOrbitData.resourceLabel);
                }
                sunOrbitData.updateResourceLabelPosition?.(selectedPlanet === sunOrbitData);
                sunOrbitData.updateResourceLabel?.();
            }
        }catch(error){
            console.warn('Sun stabilize warning:', error);
        }
    }

    const mapNebulaGroup = new THREE.Group();
    mapNebulaGroup.visible = false;
    scene.add(mapNebulaGroup);

    function createNebulaLayer(targetGroup, count, sizeMin, sizeMax, depthStart, depthSpread, opacity){
        const palettes = [
            ['rgba(90,150,255,0.22)','rgba(20,35,70,0.0)'],
            ['rgba(120,255,220,0.15)','rgba(20,60,55,0.0)'],
            ['rgba(255,180,120,0.12)','rgba(60,40,20,0.0)'],
            ['rgba(220,150,255,0.12)','rgba(50,20,70,0.0)']
        ];
        for(let i=0;i<count;i++){
            const palette = palettes[i % palettes.length];
            const tex = createNebulaSpriteTexture(palette[0], palette[1]);
            const mat = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                opacity,
                depthWrite: false,
                depthTest: false,
                blending: THREE.AdditiveBlending
            });
            const spr = new THREE.Sprite(mat);
            spr.position.set(
                (Math.random()-0.5)*1900,
                (Math.random()-0.5)*1100,
                depthStart - Math.random()*depthSpread
            );
            const s = sizeMin + Math.random()*(sizeMax-sizeMin);
            spr.scale.set(s, s * (0.55 + Math.random()*0.35), 1);
            spr.material.rotation = Math.random()*Math.PI*2;
            targetGroup.add(spr);
        }
        const gasGeom = new THREE.BufferGeometry();
        const gasCount = 4200;
        const arr = [];
        for(let i=0;i<gasCount;i++){
            arr.push(
                (Math.random()-0.5)*2100,
                (Math.random()-0.5)*1200,
                depthStart - Math.random()*(depthSpread+500)
            );
        }
        gasGeom.setAttribute('position', new THREE.Float32BufferAttribute(arr,3));
        const gasMat = new THREE.PointsMaterial({
            size: 3.5,
            color: 0xaed6ff,
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        targetGroup.add(new THREE.Points(gasGeom, gasMat));
    }
    createNebulaLayer(mapNebulaGroup, 28, 320, 720, -700, 1600, 0.23);

    function updateNebulaVisibility(){
        if(typeof orbitNebulaGroup !== 'undefined' && orbitNebulaGroup){
            orbitNebulaGroup.visible = gameState === 'ORBIT';
        }
        mapNebulaGroup.visible = ['ORBIT','BATTLE','OBSERVE'].includes(gameState);
    }

    const prevResetOrbitView = resetOrbitView;
    resetOrbitView = function(forcePlanetReset=false){
        prevResetOrbitView(forcePlanetReset);
        ensureSunStable();
        updateNebulaVisibility();
    };

    const prevClearBattleScene = clearBattleScene;
    clearBattleScene = function(){
        prevClearBattleScene();
        ensureSunStable();
        updateNebulaVisibility();
    };

    const prevSetupObserverBattle = setupObserverBattle;
    setupObserverBattle = function(mapName){
        prevSetupObserverBattle(mapName);
        battleObserverMode = true;
        observerCameraYaw = 0;
        observerCameraPitch = 0;
        observerCameraDistance = 42;
        observerCameraTarget.set(0,0,0);
        observerFreeCameraPosition.set(0, 18, 48);
        camera.position.copy(observerFreeCameraPosition);
        const canvas = document.querySelector('canvas');
        if(canvas){
            setTimeout(() => {
                try{ safeRequestPointerLock(canvas); }catch(_){ }
            }, 40);
        }
    };

    const prevUpdateObserverBattle = updateObserverBattle;
    updateObserverBattle = function(){
        prevUpdateObserverBattle();
        camera.position.lerp(observerFreeCameraPosition, 0.22);
        const lookDirection = new THREE.Vector3(
            Math.sin(observerCameraYaw) * Math.cos(observerCameraPitch),
            Math.sin(observerCameraPitch),
            -Math.cos(observerCameraYaw) * Math.cos(observerCameraPitch)
        );
        camera.lookAt(camera.position.clone().add(lookDirection));
    };

    document.addEventListener('mousedown', (event) => {
        if(gameState !== 'OBSERVE') return;
        const canvas = document.querySelector('canvas');
        if(canvas && document.pointerLockElement !== canvas){
            try{ safeRequestPointerLock(canvas); }catch(_){ }
        }
    }, true);

    document.addEventListener('wheel', (event) => {
        if(gameState !== 'OBSERVE') return;
        observerCameraDistance = THREE.MathUtils.clamp(observerCameraDistance + event.deltaY * 0.02, 18, 90);
        event.preventDefault();
    }, { passive:false });

    function getBattleMaps(){
        const liveRooms = Array.isArray(supabaseBattleRoomsCache)
            ? supabaseBattleRoomsCache.filter(room => room && room.id)
            : [];

        const sortedLiveRooms = liveRooms
            .slice()
            .sort((a, b) => {
                const aTime = new Date(a?.rawRoom?.created_at || 0).getTime();
                const bTime = new Date(b?.rawRoom?.created_at || 0).getTime();
                return bTime - aTime;
            });

        const baseMaps = (typeof LOBBY_MAP_DATA !== 'undefined' && Array.isArray(LOBBY_MAP_DATA))
            ? LOBBY_MAP_DATA.map(item => ({
                ...item,
                id: null,
                roomId: null,
                isBaseMap: true,
                title: item.title,
                players: getBattleMapOccupants(item.real),
                currentPlayers: getBattleMapOccupants(item.real),
                maxPlayers: Number(item.maxPlayers || item.playerCount || 8),
                map: item.real,
                rawRoom: null
            }))
            : [];

        return [...sortedLiveRooms, ...baseMaps];
    }

    function getTournamentMaps(){
        return tournamentRooms;
    }

    function getCurrentDataset(){
        if(lobbyModeV27 === 'solo') return SOLO_DATA;
        if(lobbyModeV27 === 'tournament') return getTournamentMaps();
        return getBattleMaps();
    }

    function setModeTabUI(){
        ['lobby-battle-tab','lobby-solo-tab','lobby-tournament-tab'].forEach((id) => {
            const el = document.getElementById(id);
            if(!el) return;
            el.classList.remove('active');
        });
        const map = {
            battle:'lobby-battle-tab',
            solo:'lobby-solo-tab',
            tournament:'lobby-tournament-tab'
        };
        const active = document.getElementById(map[lobbyModeV27]);
        if(active) active.classList.add('active');
    }

    function syncPreview(entry){
        const preview = document.getElementById('planet-preview');
        const playersBox = document.getElementById('map-players');
        const waitNote = document.getElementById('map-waiting-note');
        const statusNote = document.getElementById('match-status-note');
        if(preview){
            preview.style.backgroundImage = `url(maps/${entry.img}.jpg)`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        }
        if(lobbyModeV27 === 'solo'){
            if(waitNote) waitNote.textContent = '';
            if(statusNote) statusNote.textContent = '';
        }
        if(playersBox){
            playersBox.innerHTML = '';
            if(lobbyModeV27 === 'solo'){
                // В одиночной игре под квадратом ничего не показываем
            } else if(lobbyModeV27 === 'tournament'){
                const players = entry.currentPlayers || [];
                const maxPlayers = Number(entry.maxPlayers || 2);
                for(let i=0;i<maxPlayers;i++){
                    const slot = document.createElement('div');
                    slot.className = 'player-slot';
                    slot.textContent = players[i] || `Ожидание игрока ${i+1}`;
                    playersBox.appendChild(slot);
                }
                const need = Math.max(0, maxPlayers - players.length);
                if(waitNote) waitNote.textContent = need > 0 ? `Ожидание ${need} игроков до начала` : '';
                const coinsText = Number(entry.stakeCoins || 0) > 0 ? `${entry.stakeCoins} монет` : '';
                const crystalsText = Number(entry.stakeCrystals || 0) > 0 ? `${entry.stakeCrystals} кристаллов` : '';
                const feeText = [coinsText, crystalsText].filter(Boolean).join(' + ') || 'Без ставки';
                if(statusNote) statusNote.textContent = `${entry.title} • Ставка: ${feeText} • Победитель получает 80% банка`;
                return;
            } else {
                const players = entry.isBaseMap
                    ? getBattleMapOccupants(entry.real || entry.map || entry.name)
                    : (entry.currentPlayers || entry.players || []);
                players.forEach((playerName) => {
                    const slot = document.createElement('div');
                    slot.className = 'player-slot';
                    slot.textContent = playerName;
                    playersBox.appendChild(slot);
                });
            }
        }
        if(waitNote) waitNote.textContent = '';
        if(statusNote){
            if(lobbyModeV27 === 'solo'){
                statusNote.textContent = entry.mission || 'Миссия против ботов';
            } else {
                statusNote.textContent = entry.title || 'Свободная карта';
            }
        }
    }

    function renderLobbyListV27(mode = lobbyModeV27){
        lobbyModeV27 = mode;
        window.setLobbyModeV27?.(mode);
        const list = document.getElementById('match-list');
        const joinBtn = document.getElementById('join-match-btn');
        const observeBtn = document.getElementById('observe-match-btn');
        const createBtn = document.getElementById('create-match-btn');
        if(!list) return;
        setModeTabUI();
        list.innerHTML = '';
        const dataset = getCurrentDataset();
        if(!dataset.length){
            const empty = document.createElement('div');
            empty.className = 'match-item';
            empty.textContent = mode === 'tournament' ? 'Пока турниров нет. Создай первый.' : 'Список пока пуст.';
            list.appendChild(empty);
            selectedLobbyMap = null;
            syncPreview({ img:'earth', title:'Ожидание', mission:'', players:[] });
        } else {
            dataset.forEach((entry, index) => {
                const item = document.createElement('div');
                item.className = 'match-item';
                let extra = '';
                if(mode === 'tournament'){
                    const coinsText = Number(entry.stakeCoins || 0) > 0 ? `${entry.stakeCoins} монет` : '';
                    const crystalsText = Number(entry.stakeCrystals || 0) > 0 ? `${entry.stakeCrystals} кристаллов` : '';
                    const feeText = [coinsText, crystalsText].filter(Boolean).join(' + ') || 'Без ставки';
                    extra = `<span class="map-extra">${feeText} • цель ${entry.goalKills || 10}</span>`;
                } else if(mode === 'solo'){
                    extra = `<span class="map-extra">${entry.mission || ''}</span>`;
                } else {
                    extra = '';
                }
                if(entry.id) item.dataset.roomId = entry.id;
                item.innerHTML =
                    `<span class="map-title">${entry.title}</span>`+
                    `<span class="map-real">${String(entry.real || '').toUpperCase()}</span>`+
                    `<span class="map-mode">${entry.mode || (mode === 'solo' ? 'SOLO' : mode === 'tournament' ? 'TOURNAMENT' : 'DM')}</span>`+
                    `<span class="map-players">${entry.currentPlayers ? entry.currentPlayers.length : (entry.players ? entry.players.length : 0)}/${entry.maxPlayers || entry.playerCount || (mode === 'solo' ? 1 : 8)}</span>`+
                    `<span class="map-level">★ ${entry.minLevel || 1} - ★ ${entry.maxLevel || 120}</span>`+
                    extra;
                item.addEventListener('click', () => {
                    document.querySelectorAll('#match-list .match-item').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    const previewEntry = entry.isBaseMap
                        ? { ...entry, name: entry.real, currentPlayers:getBattleMapOccupants(entry.real || entry.map || entry.name), players:getBattleMapOccupants(entry.real || entry.map || entry.name), isBaseMap:true }
                        : entry;
                    selectedLobbyMap = { ...previewEntry, name: previewEntry.real };
                    currentRoom = entry.id ? previewEntry : null;
                    syncPreview(previewEntry);
                });
                list.appendChild(item);
                if(index === 0) item.click();
            });
        }
        if(joinBtn) joinBtn.textContent = mode === 'tournament' ? 'Участвовать' : 'Войти';
        if(createBtn) createBtn.textContent = mode === 'tournament' ? 'Создать турнир' : 'Создать';
        if(observeBtn) observeBtn.style.display = mode === 'battle' ? 'inline-flex' : 'none';
    }

    function openTournamentWindow(){
        const win = document.getElementById('tournament-window');
        const mapSelect = document.getElementById('tournament-map');
        if(!win || !mapSelect) return;
        const source = (typeof LOBBY_MAP_DATA !== 'undefined' && Array.isArray(LOBBY_MAP_DATA)) ? LOBBY_MAP_DATA : [];
        mapSelect.innerHTML = source.map(item => `<option value="${item.real}">${item.title}</option>`).join('');
        if(selectedLobbyMap?.real) mapSelect.value = selectedLobbyMap.real;
        ['tournament-min-level','tournament-max-level'].forEach((id, idx) => {
            const el = document.getElementById(id);
            if(el && !el.dataset.filled){
                el.dataset.filled = '1';
                for(let i=1;i<=120;i++){
                    const op = document.createElement('option');
                    op.value = String(i);
                    op.textContent = String(i);
                    el.appendChild(op);
                }
            }
            if(el) el.value = idx === 0 ? '1' : '120';
        });
        const stakeCoins = document.getElementById('tournament-stake-coins');
        const stakeCrystals = document.getElementById('tournament-stake-crystals');
        if(stakeCoins && !stakeCoins.dataset.boundV28){
            stakeCoins.dataset.boundV28 = '1';
            stakeCoins.innerHTML = ['0','50','100','250','500'].map(v => `<option value="${v}">${v === '0' ? 'Без ставки монетами' : `${v} монет`}</option>`).join('');
        }
        if(stakeCrystals && !stakeCrystals.dataset.boundV28){
            stakeCrystals.dataset.boundV28 = '1';
            stakeCrystals.innerHTML = ['0','1','2','5','10'].map(v => `<option value="${v}">${v === '0' ? 'Без ставки кристаллами' : `${v} кристаллов`}</option>`).join('');
        }
        win.classList.remove('hidden');
    }

    function bindLobbyModeButtons(){
        window.renderLobbyListV27 = renderLobbyListV27;

    const battleTab = document.getElementById('lobby-battle-tab');
        const soloTab = document.getElementById('lobby-solo-tab');
        const tournamentTab = document.getElementById('lobby-tournament-tab');
        if(battleTab && !battleTab.dataset.v27Bound){
            battleTab.dataset.v27Bound = '1';
            battleTab.onclick = async () => {
                if(typeof renderRoomsInLobby === 'function'){
                    await renderRoomsInLobby(true);
                }else{
                    renderLobbyListV27('battle');
                }
            };
        }
        if(soloTab && !soloTab.dataset.v27Bound){
            soloTab.dataset.v27Bound = '1';
            soloTab.onclick = () => {
                if(isGuestAccount()){
                    showGuestOnlyPvpMessage();
                    return;
                }
                renderLobbyListV27('solo');
            };
        }
        if(tournamentTab && !tournamentTab.dataset.v27Bound){
            tournamentTab.dataset.v27Bound = '1';
            tournamentTab.onclick = () => {
                if(isGuestAccount()){
                    showGuestOnlyPvpMessage();
                    return;
                }
                renderLobbyListV27('tournament');
            };
        }
    }

    function bindActionButtons(){
        const createBtnOld = document.getElementById('create-match-btn');
        if(createBtnOld && !createBtnOld.dataset.v27Bound){
            const createBtn = createBtnOld.cloneNode(true);
            createBtnOld.replaceWith(createBtn);
            createBtn.dataset.v27Bound = '1';
            createBtn.addEventListener('click', () => {
                if(lobbyModeV27 === 'tournament'){
                    if(isGuestAccount()){
                        showGuestOnlyPvpMessage();
                        return;
                    }
                    openTournamentWindow();
                }else if(lobbyModeV27 === 'battle'){
                    document.getElementById('create-match-window')?.classList.remove('hidden');
                }
            });
        }
        const joinBtnOld = document.getElementById('join-match-btn');
        if(joinBtnOld && !joinBtnOld.dataset.v27Bound){
            const joinBtn = joinBtnOld.cloneNode(true);
            joinBtnOld.replaceWith(joinBtn);
            joinBtn.dataset.v27Bound = '1';
            joinBtn.addEventListener('click', () => {
                if(!selectedLobbyMap) return;
                if(lobbyModeV27 === 'solo'){
                    if(isGuestAccount()){
                        showGuestOnlyPvpMessage();
                        return;
                    }
                    currentRoom = { ...selectedLobbyMap, solo:true, state:'solo', players:[getDisplayPlayerTag()] };
                    switchState('BATTLE');
                    return;
                }
                if(lobbyModeV27 === 'tournament'){
                    if(isGuestAccount()){
                        showGuestOnlyPvpMessage();
                        return;
                    }
                    const room = tournamentRooms.find(r => r.id === selectedLobbyMap.id) || selectedLobbyMap;
                    if(!room.currentPlayers.includes(getDisplayPlayerTag())){
                        room.currentPlayers.push(getDisplayPlayerTag());
                    }
                    const need = Math.max(0, Number(room.maxPlayers) - room.currentPlayers.length);
                    currentRoom = room;
                    if(need <= 0){
                        room.waiting = false;
                        renderLobbyListV27('tournament');
                        switchState('BATTLE');
                    }else{
                        renderLobbyListV27('tournament');
                    }
                    return;
                }
                (async () => {
                    const room = {
                        ...selectedLobbyMap,
                        players:[...(selectedLobbyMap.currentPlayers || selectedLobbyMap.players || [])],
                        currentPlayers:[...(selectedLobbyMap.currentPlayers || selectedLobbyMap.players || [])],
                        state:'battle'
                    };
                    const me = getDisplayPlayerTag();
                    if(!room.currentPlayers.includes(me)) room.currentPlayers.push(me);
                    if(!room.players.includes(me)) room.players.push(me);

                    if(selectedLobbyMap.id){
                        const joined = await joinRoomPlayers(selectedLobbyMap.id);
                        if(!joined) return;
                        await loadRoomsFromSupabase();
                        const freshRoom = (Array.isArray(supabaseBattleRoomsCache) ? supabaseBattleRoomsCache : [])
                            .find(entry => String(entry?.id || '') === String(selectedLobbyMap.id));
                        if(freshRoom){
                            room.players = [...(freshRoom.currentPlayers || freshRoom.players || [])];
                            room.currentPlayers = [...room.players];
                            room.maxPlayers = freshRoom.maxPlayers || room.maxPlayers;
                            room.host = freshRoom.host || room.host;
                            room.rawRoom = freshRoom.rawRoom || room.rawRoom;
                        }
                    } else if(selectedLobbyMap.real){
                        const publicRoomName = `Public ${String(selectedLobbyMap.real || 'earth').toUpperCase()}`;
                        const createdOrExisting = await createGameRoom(publicRoomName, selectedLobbyMap.real, Number(selectedLobbyMap.maxPlayers || selectedLobbyMap.playerCount || 8), getDisplayPlayerTag());
                        if(!createdOrExisting?.id) return;
                        await loadRoomsFromSupabase();
                        const freshRoom = (Array.isArray(supabaseBattleRoomsCache) ? supabaseBattleRoomsCache : [])
                            .find(entry => String(entry?.id || '') === String(createdOrExisting.id));
                        if(freshRoom){
                            room.id = freshRoom.id;
                            room.roomId = freshRoom.id;
                            room.players = [...(freshRoom.currentPlayers || freshRoom.players || [])];
                            room.currentPlayers = [...room.players];
                            room.maxPlayers = freshRoom.maxPlayers || room.maxPlayers;
                            room.host = freshRoom.host || room.host;
                            room.rawRoom = freshRoom.rawRoom || room.rawRoom;
                        }
                    }

                    currentRoom = room;
                    window.currentRoomId = room.id || room.roomId || null;
                    switchState('BATTLE');
                })();
            });
        }
        const observeBtnOld = document.getElementById('observe-match-btn');
        if(observeBtnOld && !observeBtnOld.dataset.v27Bound){
            const observeBtn = observeBtnOld.cloneNode(true);
            observeBtnOld.replaceWith(observeBtn);
            observeBtn.dataset.v27Bound = '1';
            observeBtn.addEventListener('click', () => {
                if(lobbyModeV27 !== 'battle') return;
                const targetMap = selectedLobbyMap?.real || currentRoom?.real || currentRoom?.map || 'earth';
                currentRoom = { id: `observe_${targetMap}_${Date.now()}`, map: targetMap, observer:true, state:'observe' };
                window.currentRoomId = currentRoom.id;
                switchState('OBSERVE');
            });
        }
        const refreshBtn = document.getElementById('refresh-matches-btn');
        if(refreshBtn && !refreshBtn.dataset.v27Bound){
            refreshBtn.dataset.v27Bound = '1';
            refreshBtn.addEventListener('click', async () => {
                if(typeof renderRoomsInLobby === 'function'){
                    await renderRoomsInLobby();
                }else{
                    renderLobbyListV27(getLobbyModeSafe());
                }
            });
        }
    }

    function bindCreateWindows(){
        const confirmOld = document.getElementById('confirm-create');
        if(confirmOld && !confirmOld.dataset.v27Bound){
            const btn = confirmOld.cloneNode(true);
            confirmOld.replaceWith(btn);
            btn.dataset.v27Bound = '1';
            btn.addEventListener('click', async () => {
                const selected = (typeof getSelectedLobbyMapConfig === 'function' ? getSelectedLobbyMapConfig() : selectedLobbyMap) || selectedLobbyMap || (typeof LOBBY_MAP_DATA !== 'undefined' ? LOBBY_MAP_DATA[0] : null);
                if(!selected) return;

                const roomTitle = document.getElementById('room-title')?.value?.trim() || `${selected.title || selected.name} Room`;
                const playerCount = Number(document.getElementById('player-count')?.value || 8);
                const minLevel = Number(document.getElementById('min-level')?.value || 1);
                const maxLevel = Number(document.getElementById('max-level')?.value || 120);
                const hostName = (typeof player !== 'undefined' && player?.nickname) ? player.nickname : 'Commander';
                const mapName = selected.title || selected.name || selected.real || 'Меркурий';

                const created = await createGameRoom(roomTitle, mapName, playerCount, hostName);
                if(!created) return;

                currentRoom = {
                    id: created.id,
                    title: created.room_name,
                    map: created.map_name,
                    real: selected.real || selected.name || 'earth',
                    img: selected.img || selected.real || 'earth',
                    mode: 'DM',
                    minLevel,
                    maxLevel,
                    maxPlayers: created.max_players || playerCount,
                    players:[getDisplayPlayerTag()],
                    currentPlayers:[getDisplayPlayerTag()],
                    state:'battle'
                };

                window.currentRoomId = currentRoom.id;
                document.getElementById('create-match-window')?.classList.add('hidden');
                const titleInput = document.getElementById('room-title');
                if(titleInput) titleInput.value = '';

                switchState('BATTLE');
            });
        }
        const cancelTournament = document.getElementById('cancel-tournament-create');
        if(cancelTournament && !cancelTournament.dataset.v27Bound){
            cancelTournament.dataset.v27Bound = '1';
            cancelTournament.onclick = () => document.getElementById('tournament-window')?.classList.add('hidden');
        }
        const confirmTournament = document.getElementById('confirm-tournament-create');
        if(confirmTournament && !confirmTournament.dataset.v27Bound){
            confirmTournament.dataset.v27Bound = '1';
            confirmTournament.onclick = () => {
                const mapValue = document.getElementById('tournament-map')?.value || 'earth';
                const baseMap = (typeof LOBBY_MAP_DATA !== 'undefined' ? LOBBY_MAP_DATA.find(m => m.real === mapValue) : null) || { title:mapValue, real:mapValue, img:mapValue };
                const title = document.getElementById('tournament-title')?.value?.trim() || `${baseMap.title} Tournament`;
                const maxPlayers = Number(document.getElementById('tournament-player-count')?.value || 2);
                const minLevel = Number(document.getElementById('tournament-min-level')?.value || 1);
                const maxLevel = Number(document.getElementById('tournament-max-level')?.value || 120);
                const goalKills = Number(document.getElementById('tournament-goal')?.value || 10);
                const stakeCoins = Math.min(500, Number(document.getElementById('tournament-stake-coins')?.value || 0));
                const stakeCrystals = Math.min(10, Number(document.getElementById('tournament-stake-crystals')?.value || 0));
                const room = {
                    id: `tournament_${Date.now()}`,
                    title,
                    real: baseMap.real,
                    img: baseMap.img,
                    mode: 'TOURNAMENT',
                    minLevel,
                    maxLevel,
                    maxPlayers,
                    currentPlayers:[getDisplayPlayerTag()],
                    stakeCoins,
                    stakeCrystals,
                    prizePoolCoins: Math.floor((stakeCoins * maxPlayers) * 0.8),
                    prizePoolCrystals: Math.floor((stakeCrystals * maxPlayers) * 0.8),
                    waiting:true
                };
                tournamentRooms.unshift(room);
                selectedLobbyMap = room;
                currentRoom = room;
                window.currentRoomId = room.id;
                document.getElementById('tournament-window')?.classList.add('hidden');
                renderLobbyListV27('tournament');
                switchState('BATTLE');
            };
        }
    }

    const prevSwitchState = switchState;
    switchState = function(newState){
        prevSwitchState(newState);
        ensureSunStable();
        updateNebulaVisibility();
        if(newState === 'LOBBY'){
            bindLobbyModeButtons();
            bindActionButtons();
            bindCreateWindows();
            renderLobbyListV27(getLobbyModeSafe());
        }
        if(newState === 'OBSERVE'){
            const canvas = document.querySelector('canvas');
            if(canvas){
                setTimeout(() => {
                    try{ safeRequestPointerLock(canvas); }catch(_){ }
                }, 30);
            }
        }
        if(newState === 'ORBIT'){
            ensureSunStable();
        }
    };
    window.switchState = switchState;

    window.addEventListener('load', () => {
        bindLobbyModeButtons();
        bindActionButtons();
        bindCreateWindows();
        ensureSunStable();
        updateNebulaVisibility();
        try{
            if(typeof fillLevelSelects === 'function') fillLevelSelects('tournament-min-level','tournament-max-level');
        }catch(_){ }
        if(gameState === 'LOBBY') renderLobbyListV27(getLobbyModeSafe());
    });
})();



/* ================= SUPABASE ROOMS SYSTEM ================= */

let supabaseBattleRoomsCache = [];
let battleRoomsRenderTimer = null;
let supabaseBattleMapOccupants = new Map();

const DEFAULT_SUPABASE_BATTLE_ROOMS = [];

function getRoomMetaFromMapName(mapName){
  const realKey = normalizeBattleMapName(mapName);
  return (typeof LOBBY_MAP_DATA !== 'undefined' && Array.isArray(LOBBY_MAP_DATA)
    ? LOBBY_MAP_DATA.find(item => item.real === realKey)
    : null) || { title: String(mapName || 'Earth'), real: realKey, img: realKey, mode: 'DM' };
}

function getCurrentPlayerIdentity(){
  const fallbackNickname = (typeof player !== 'undefined' && player?.nickname) ? player.nickname : 'Commander';
  const authPublicId = (typeof authState !== 'undefined' && authState?.mode === 'account' && authState?.playerId)
    ? String(authState.playerId)
    : '';
  const chatPlayerId = (typeof getValidChatPlayerId === 'function') ? String(getValidChatPlayerId() || '') : '';
  const playerPublicId = (typeof player !== 'undefined' && player?.id && String(player.id) !== 'local_player')
    ? String(player.id)
    : '';
  const fallbackId = authPublicId || chatPlayerId || playerPublicId || '';
  return {
    playerId: fallbackId,
    nickname: fallbackNickname,
    displayName: (typeof getDisplayPlayerTag === 'function') ? getDisplayPlayerTag() : fallbackNickname
  };
}

function getRoomOccupantsFromPresence(roomId, presenceRows = []){
  if(!roomId) return [];
  return (presenceRows || [])
    .filter(row => String(row?.room_id || '') === String(roomId))
    .sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0))
    .map(row => row.nickname || row.player_id)
    .filter(Boolean);
}

function mergeUniquePlayers(primary = [], secondary = []){
  const seen = new Set();
  const result = [];
  [ ...(primary || []), ...(secondary || []) ].forEach(name => {
    const value = String(name || '').trim();
    if(!value) return;
    const key = value.toLowerCase();
    if(seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}

function rebuildBattleMapOccupants(rooms = []){
  const next = new Map();
  (rooms || []).forEach(room => {
    const mapKey = normalizeBattleMapName(room?.map_name || room?.real || room?.map || 'earth');
    const roomPlayers = Array.isArray(room?.room_players)
      ? room.room_players
          .slice()
          .sort((a, b) => new Date(a?.joined_at || 0) - new Date(b?.joined_at || 0))
          .map(item => item?.nickname || item?.player_id)
          .filter(Boolean)
      : [];
    const merged = mergeUniquePlayers(next.get(mapKey) || [], roomPlayers);
    next.set(mapKey, merged);
  });
  supabaseBattleMapOccupants = next;
  return next;
}

function getBattleMapOccupants(mapName){
  const mapKey = normalizeBattleMapName(mapName);
  return Array.isArray(supabaseBattleMapOccupants.get(mapKey))
    ? [...supabaseBattleMapOccupants.get(mapKey)]
    : [];
}

function mapSupabaseRoomToLobbyEntry(room, presenceRows = []){
  const meta = getRoomMetaFromMapName(room.map_name);
  const joinedPlayers = Array.isArray(room.room_players)
    ? room.room_players
        .slice()
        .sort((a, b) => new Date(a?.joined_at || 0) - new Date(b?.joined_at || 0))
        .map(item => item?.nickname || item?.player_id)
        .filter(Boolean)
    : [];
  const livePlayers = getRoomOccupantsFromPresence(room.id, presenceRows);
  const players = mergeUniquePlayers(joinedPlayers, livePlayers);

  return {
    id: room.id,
    roomId: room.id,
    title: room.room_name || meta.title,
    real: meta.real,
    img: meta.img,
    mode: meta.mode || 'DM',
    players,
    currentPlayers: [...players],
    maxPlayers: Number(room.max_players || 8),
    minLevel: 1,
    maxLevel: 120,
    host: room.host_name || (players[0] || 'SYSTEM'),
    map: meta.real,
    rawRoom: room
  };
}

async function savePlayerToSupabase(playerData) {
  if (!window.supabaseReady || !window.supabaseClient) {
    console.warn('Supabase не готов');
    return null;
  }
  if (authState?.mode !== 'account' || !authState?.isAuthenticated) {
    return null;
  }

  const payload = {
    auth_id: typeof playerData.auth_id !== 'undefined' ? playerData.auth_id : null,
    email: playerData.email || authState.email || null,
    nickname: playerData.nickname || player.nickname || 'Commander',
    level: Number(playerData.level || player.level || 1),
    credits: Number(playerData.credits || playerResources.coins || player.credits || 0),
    mercury_ore: Number(playerResources.mercury_ore || 0),
    venus_gas: Number(playerResources.venus_gas || 0),
    earth_water: Number(playerResources.earth_water || 0),
    mars_crystal: Number(playerResources.mars_crystal || 0),
    jupiter_hydrogen: Number(playerResources.jupiter_hydrogen || 0),
    saturn_ice: Number(playerResources.saturn_ice || 0),
    uranus_ammonia: Number(playerResources.uranus_ammonia || 0),
    neptune_methane: Number(playerResources.neptune_methane || 0),
    solar_energy: Number(playerResources.solar_energy || 0),
    crystals: Number(playerResources.crystals || 0)
  };

  const { data, error } = await window.supabaseClient
    .from('players')
    .upsert(payload, { onConflict: 'auth_id' })
    .select('public_id,nickname,level,credits,auth_id,email,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
    .single();

  if (error) {
    console.error('Ошибка сохранения игрока:', error);
    return null;
  }

  if(data?.public_id){
    authState.playerId = Number(data.public_id) || 0;
    player.id = authState.playerId;
  }
  if(data?.nickname) player.nickname = data.nickname;
  if(typeof data?.level !== 'undefined') player.level = Number(data.level) || 1;
  if(typeof data?.credits !== 'undefined') player.credits = Number(data.credits) || 0;
  applyPlayerIdentityRow(data || {});
  applyPlayerResourcesFromRow(data || {});
  updatePremiumAccountInfo?.();
  return data;
}

async function ensureDefaultBattleRoomsInSupabase() {
  return [];
}

async function joinRoomPlayers(roomId) {
  if (!window.supabaseReady || !window.supabaseClient || !roomId) return false;

  const identity = getCurrentPlayerIdentity();
  if (!identity.playerId) {
    console.error('Ошибка входа в room_players: пустой playerId', identity);
    return false;
  }

  const { data: existingRows, error: existingError } = await window.supabaseClient
    .from('room_players')
    .select('id,room_id,player_id,nickname')
    .eq('room_id', roomId)
    .eq('player_id', identity.playerId)
    .limit(1);

  if (existingError) {
    console.error('Ошибка проверки room_players:', existingError);
    return false;
  }

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    console.log('room_players уже содержит игрока:', existingRows[0]);
    return true;
  }

  const insertPayload = {
    id: (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    room_id: roomId,
    player_id: identity.playerId,
    nickname: identity.displayName,
    joined_at: new Date().toISOString()
  };

  const { data: insertedRow, error } = await window.supabaseClient
    .from('room_players')
    .insert([insertPayload])
    .select('id,room_id,player_id,nickname,joined_at');

  if (error) {
    console.error('Ошибка входа в room_players:', error, insertPayload);
    return false;
  }

  console.log('room_players insert ok:', insertedRow);

  await loadRoomsFromSupabase();
  if(gameState === 'LOBBY' && typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
    renderLobbyListV27('battle');
  }
  return true;
}

async function leaveRoomPlayers(roomId) {
  if (!window.supabaseReady || !window.supabaseClient || !roomId) return 0;

  const identity = getCurrentPlayerIdentity();

  const { error: deletePlayerError } = await window.supabaseClient
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', identity.playerId);

  if (deletePlayerError) {
    console.error('Ошибка выхода из room_players:', deletePlayerError);
    return -1;
  }

  const { count, error: countError } = await window.supabaseClient
    .from('room_players')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId);

  if (countError) {
    console.error('Ошибка подсчёта игроков в комнате:', countError);
    return -1;
  }

  if ((count || 0) <= 0) {
    const { error: roomDeleteError } = await window.supabaseClient
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (roomDeleteError) {
      console.error('Ошибка удаления пустой комнаты:', roomDeleteError);
    } else {
      console.log('Пустая комната удалена:', roomId);
    }
  }

  await loadRoomsFromSupabase();
  if(gameState === 'LOBBY' && typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
    renderLobbyListV27('battle');
  }
  return count || 0;
}

async function cleanupCurrentBattleRoom() {
  if (currentRoom?.id && currentRoom?.state !== 'solo' && currentRoom?.observer !== true) {
    await leaveRoomPlayers(currentRoom.id);
  }

  currentRoom = null;
  window.currentRoomId = null;
  selectedLobbyMap = null;

  if(gameState === 'LOBBY' && typeof renderLobbyListV27 === 'function'){
    await loadRoomsFromSupabase();
    renderLobbyListV27(getLobbyModeSafe());
  }
}


function stopLiveRoomsRefresh(){
  if(liveRoomsRefreshTimer){
    clearInterval(liveRoomsRefreshTimer);
    liveRoomsRefreshTimer = null;
  }
}

function startLiveRoomsRefresh(){
  stopLiveRoomsRefresh();
  if(!window.supabaseReady || !window.supabaseClient) return;
  liveRoomsRefreshTimer = setInterval(async () => {
    if(gameState !== 'LOBBY') return;
    try{
      await loadRoomsFromSupabase();
      if(typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
        const selectedId = selectedLobbyMap?.id || currentRoom?.id || null;
        renderLobbyListV27('battle');
        if(selectedId){
          const fresh = (Array.isArray(supabaseBattleRoomsCache) ? supabaseBattleRoomsCache : []).find(room => String(room?.id || '') === String(selectedId));
          if(fresh){
            selectedLobbyMap = { ...fresh, name: fresh.real };
            currentRoom = fresh;
            syncPreview?.(fresh);
            const list = document.getElementById('match-list');
            const selectedEl = list?.querySelector(`.match-item[data-room-id="${selectedId}"]`);
            if(selectedEl){
              list?.querySelectorAll('.match-item').forEach(el => el.classList.remove('selected'));
              selectedEl.classList.add('selected');
            }
          }
        }
      }
    }catch(error){
      console.warn('Live refresh rooms error:', error);
    }
  }, LIVE_ROOMS_REFRESH_MS);
}

async function loadRoomsFromSupabase() {
  if (!window.supabaseReady || !window.supabaseClient) {
    console.warn('Supabase не готов');
    return [];
  }

  const { data, error } = await window.supabaseClient
    .from('rooms')
    .select('*, room_players(player_id,nickname,joined_at)')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки комнат:', error);
    return [];
  }

  const allRooms = Array.isArray(data) ? data : [];
  rebuildBattleMapOccupants(allRooms);

  const emptyRooms = allRooms.filter(room => room?.id && (!Array.isArray(room.room_players) || room.room_players.length <= 0));
  if (emptyRooms.length) {
    const emptyRoomIds = emptyRooms.map(room => room.id).filter(Boolean);
    const { error: emptyDeleteError } = await window.supabaseClient
      .from('rooms')
      .delete()
      .in('id', emptyRoomIds);
    if (emptyDeleteError) {
      console.warn('Не удалось удалить пустые комнаты:', emptyDeleteError);
    }
  }

  const visibleRooms = allRooms.filter(room => room?.id && Array.isArray(room.room_players) && room.room_players.length > 0);
  supabaseBattleRoomsCache = visibleRooms.map(room => mapSupabaseRoomToLobbyEntry(room));

  const selectedId = String(selectedLobbyMap?.id || currentRoom?.id || '');
  if(selectedId){
    const freshSelected = supabaseBattleRoomsCache.find(room => String(room?.id || '') === selectedId);
    if(freshSelected){
      if(selectedLobbyMap?.id) selectedLobbyMap = { ...freshSelected, name: freshSelected.real };
      if(currentRoom?.id) currentRoom = { ...currentRoom, ...freshSelected, currentPlayers:[...(freshSelected.currentPlayers||[])], players:[...(freshSelected.players||[])] };
    }
  } else if(selectedLobbyMap?.isBaseMap || (!selectedLobbyMap?.id && selectedLobbyMap?.real)) {
    const occupants = getBattleMapOccupants(selectedLobbyMap.real || selectedLobbyMap.map || selectedLobbyMap.name);
    selectedLobbyMap.currentPlayers = occupants;
    selectedLobbyMap.players = [...occupants];
  }

  console.log('Комнаты из Supabase загружены:', visibleRooms);
  return supabaseBattleRoomsCache;
}

function getLobbyModeSafe(){
  if (typeof window.getLobbyModeV27 === 'function') {
    return window.getLobbyModeV27() || 'battle';
  }
  return 'battle';
}

async function renderRoomsInLobby(forceBattleMode = false) {
  await loadRoomsFromSupabase();

  if (typeof renderLobbyListV27 === 'function') {
    renderLobbyListV27(forceBattleMode ? 'battle' : getLobbyModeSafe());
    return;
  }

  const matchList = document.getElementById('match-list');
  if (!matchList) {
    console.warn('match-list не найден');
    return;
  }

  const baseMaps = (typeof LOBBY_MAP_DATA !== 'undefined' && Array.isArray(LOBBY_MAP_DATA))
    ? LOBBY_MAP_DATA
    : [];

  matchList.innerHTML = '';
  baseMaps.forEach(entry => {
    const el = document.createElement('div');
    el.className = 'match-item';
    el.innerHTML =
      `<span class="map-title">${entry.title}</span>`+
      `<span class="map-real">${String(entry.real || '').toUpperCase()}</span>`+
      `<span class="map-mode">${entry.mode || 'DM'}</span>`+
      `<span class="map-players">${getBattleMapOccupants(entry.real || entry.map || entry.name).length}/${entry.maxPlayers || 8}</span>`+
      `<span class="map-level">★ ${entry.minLevel || 1} - ★ ${entry.maxLevel || 120}</span>`;
    el.addEventListener('click', () => {
      document.querySelectorAll('#match-list .match-item').forEach(node => node.classList.remove('selected'));
      el.classList.add('selected');
      const occupants = getBattleMapOccupants(entry.real || entry.map || entry.name);
      selectedLobbyMap = { ...entry, name: entry.real, currentPlayers:[...occupants], players:[...occupants], isBaseMap:true };
      currentRoom = null;
      const preview = document.getElementById('planet-preview');
      if (preview) {
        preview.style.backgroundImage = `url(maps/${entry.img}.jpg)`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
      }
      const playersBox = document.getElementById('map-players');
      if (playersBox) playersBox.innerHTML = '';
      const waitNote = document.getElementById('map-waiting-note');
      if (waitNote) waitNote.textContent = '';
      const statusNote = document.getElementById('match-status-note');
      if (statusNote) statusNote.textContent = entry.title || 'Свободная карта';
    });
    matchList.appendChild(el);
  });

  const first = matchList.querySelector('.match-item');
  if (first) first.click();
}

async function createGameRoom(roomName, mapName, maxPlayers, hostName) {
  if (!window.supabaseReady || !window.supabaseClient) {
    console.warn('Supabase не готов');
    return null;
  }

  const normalizedMap = normalizeBattleMapName(mapName);

  const { data, error } = await window.supabaseClient
    .from('rooms')
    .insert([
      {
        room_name: roomName,
        map_name: normalizedMap,
        max_players: maxPlayers,
        host_name: hostName
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Ошибка создания комнаты:', error);
    return null;
  }

  const joined = await joinRoomPlayers(data.id);
  if (!joined) {
    console.error('Не удалось добавить создателя в room_players, комната будет удалена:', data);
    await window.supabaseClient.from('rooms').delete().eq('id', data.id);
    return null;
  }

  console.log('Комната создана:', data);
  await loadRoomsFromSupabase();
  if(typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
    renderLobbyListV27('battle');
  }
  return data;
}
/* ================= AUTO LOAD ================= */

window.addEventListener('load', async () => {
  if (typeof player === 'undefined') {
    console.warn('player не найден — проверь код');
    return;
  }

  await loadRoomsFromSupabase();

  if (typeof gameState !== 'undefined' && gameState === 'LOBBY' && typeof renderLobbyListV27 === 'function') {
    renderLobbyListV27('battle');
  }
});





function isGuestAccount(){
    return authState?.mode === 'guest';
}

function showGuestOnlyPvpMessage(){
    alert('Гостям доступен только PvP режим.');
}

// ================= ONLINE PLAYERS (SUPABASE) =================

const ONLINE_TTL_MS = 35000;
const ONLINE_HEARTBEAT_MS = 10000;
let onlineHeartbeatTimer = null;
let onlineRenderTimer = null;
let playerActionMenuEl = null;
var liveRoomsRefreshTimer = null;
const LIVE_ROOMS_REFRESH_MS = 2500;

function isAccountPublicId(value){
    return !!(value && /^\d+$/.test(String(value)));
}

function getOnlineFreshCutoffIso(){
    return new Date(Date.now() - ONLINE_TTL_MS).toISOString();
}

function ensurePlayerActionMenu(){
    if (playerActionMenuEl && document.body.contains(playerActionMenuEl)) return playerActionMenuEl;

    playerActionMenuEl = document.createElement('div');
    playerActionMenuEl.id = 'player-action-menu';
    playerActionMenuEl.className = 'hidden';
    playerActionMenuEl.style.position = 'fixed';
    playerActionMenuEl.style.zIndex = '99999';
    playerActionMenuEl.style.minWidth = '180px';
    playerActionMenuEl.style.padding = '8px';
    playerActionMenuEl.style.borderRadius = '12px';
    playerActionMenuEl.style.border = '1px solid rgba(0,255,255,0.35)';
    playerActionMenuEl.style.background = 'rgba(10,16,30,0.96)';
    playerActionMenuEl.style.boxShadow = '0 12px 30px rgba(0,0,0,0.45)';
    document.body.appendChild(playerActionMenuEl);

    playerActionMenuEl.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => hidePlayerActionMenu());
    window.addEventListener('resize', () => hidePlayerActionMenu());
    window.addEventListener('scroll', () => hidePlayerActionMenu(), true);
    return playerActionMenuEl;
}

function hidePlayerActionMenu(){
    const menu = ensurePlayerActionMenu();
    menu.classList.add('hidden');
    menu.innerHTML = '';
}

function showPlayerActionMenu(anchorEl, targetId, nickname){
    const menu = ensurePlayerActionMenu();
    const safeName = escapeChatHtml(nickname || `ID ${targetId || '?'}`);
    const canPm = canUsePrivateChat() && isAccountPublicId(targetId) && String(targetId) !== String(authState?.playerId || '');

    menu.innerHTML = `
      <div style="color:#9fe7ff;font-weight:700;padding:4px 6px 8px;">${safeName}</div>
      <button type="button" class="player-menu-btn" data-action="profile" style="width:100%;display:block;text-align:left;margin:0 0 6px;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;cursor:pointer;">👤 Открыть профиль</button>
      <button type="button" class="player-menu-btn" data-action="pm" ${canPm ? '' : 'disabled'} style="width:100%;display:block;text-align:left;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:${canPm ? 'rgba(0,180,255,0.16)' : 'rgba(255,255,255,0.04)'};color:${canPm ? '#dff8ff' : '#7f8a96'};cursor:${canPm ? 'pointer' : 'not-allowed'};">✉️ Личное сообщение</button>
    `;

    const rect = anchorEl.getBoundingClientRect();
    menu.style.left = `${Math.min(window.innerWidth - 210, Math.max(8, rect.left))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 120, rect.bottom + 6)}px`;
    menu.classList.remove('hidden');

    menu.querySelector('[data-action="profile"]')?.addEventListener('click', async () => {
        hidePlayerActionMenu();
        await openPlayerProfile(targetId, nickname);
    });

    menu.querySelector('[data-action="pm"]')?.addEventListener('click', () => {
        if (!canPm) return;
        hidePlayerActionMenu();
        openPrivateChat(String(targetId), nickname || `ID ${targetId}`);
    });
}

async function fetchPlayerProfileData(targetId){
    if(!window.supabaseClient || !targetId) return null;

    const { data, error } = await window.supabaseClient
        .from('players')
        .select('public_id,nickname,level,credits,email,staff_role,crystals,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,created_at')
        .eq('public_id', Number(targetId))
        .maybeSingle();

    if(error){
        console.error('Ошибка загрузки профиля игрока:', error);
        return null;
    }

    return data || null;
}

async function openPlayerProfile(targetId, fallbackNickname = 'Player'){
    const profileWindowEl = document.getElementById('profile-window');
    const profileInfoEl = document.getElementById('profile-info');
    if(!profileWindowEl || !profileInfoEl) return;

    const myId = authState?.playerId ? String(authState.playerId) : '';
    const normalizedId = targetId ? String(targetId) : '';

    if(normalizedId && myId && normalizedId === myId){
        if (typeof renderProfileStats === 'function') renderProfileStats();
        profileWindowEl.classList.remove('hidden');
        return;
    }

    profileInfoEl.innerHTML = '<div class="auth-note">Загрузка профиля игрока...</div>';
    profileWindowEl.classList.remove('hidden');

    const data = normalizedId ? await fetchPlayerProfileData(normalizedId) : null;
    if (data?.public_id) {
        setCachedStaffRole(String(data.public_id), data.staff_role || 'player');
    }
    const displayName = data?.nickname || fallbackNickname || 'Player';
    const profileRole = normalizeStaffRole(data?.staff_role || (normalizedId && normalizedId === myId ? player?.staff_role : 'player'));
    const roleMeta = getStaffRoleMeta(profileRole);
    const canPm = canUsePrivateChat() && isAccountPublicId(normalizedId) && normalizedId !== myId;
    const totalResources = [
        data?.mercury_ore,
        data?.venus_gas,
        data?.earth_water,
        data?.mars_crystal,
        data?.jupiter_hydrogen,
        data?.saturn_ice,
        data?.uranus_ammonia,
        data?.neptune_methane,
        data?.solar_energy
    ].reduce((sum, value) => sum + (Number(value) || 0), 0);

    profileInfoEl.innerHTML = `
      <h2 class="profile-title">Пилот ${escapeChatHtml(displayName)}</h2>
      <div class="profile-grid">
        <div class="stat-card"><div class="cosmic-badge">Игровой ID</div><div>${escapeChatHtml(normalizedId || '—')}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Статус</div><div>${isAccountPublicId(normalizedId) ? 'Аккаунт' : 'Гость'}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Роль</div><div>${roleMeta.short || 'PLAYER'}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Уровень</div><div>${Number(data?.level) || 1}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Кредиты</div><div>${Number(data?.credits) || 0}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Кристаллы</div><div>${Number(data?.crystals) || 0}</div></div>
        <div class="stat-card"><div class="cosmic-badge">Ресурсов</div><div>${totalResources}</div></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px;">
        ${canPm ? '<button id="profile-pm-btn" type="button" style="padding:10px 14px;border-radius:10px;border:1px solid rgba(0,255,255,0.35);background:rgba(0,180,255,0.18);color:#fff;cursor:pointer;">✉️ Написать в ЛС</button>' : ''}
      </div>
      ${!data ? '<div class="auth-note" style="margin-top:12px;">Профиль загружен частично. Полных данных по игроку пока нет.</div>' : ''}
    `;

    document.getElementById('profile-pm-btn')?.addEventListener('click', () => {
        openPrivateChat(String(normalizedId), displayName);
    });
}

async function setPlayerOnlineStatus(status = 'lobby', roomId = null){
    if(!window.supabaseClient) return;

    const playerId =
        (typeof authState !== 'undefined' && authState?.playerId)
        ? String(authState.playerId)
        : (typeof player !== 'undefined' && player?.id ? String(player.id) : null);

    const nickname =
        (typeof player !== 'undefined' && player?.nickname)
        ? player.nickname
        : 'Commander';

    if(!playerId) return;

    const safeRoomId = sanitizeOnlineRoomId(roomId);

    const { error } = await window.supabaseClient
        .from('online_players')
        .upsert({
            player_id: playerId,
            nickname: nickname,
            room_id: safeRoomId,
            status: status,
            updated_at: new Date().toISOString()
        });

    if(error){
        console.error('Ошибка записи online_players:', error);
    }
}

async function removePlayerFromOnline(){
    if(!window.supabaseClient) return;

    const playerId =
        (typeof authState !== 'undefined' && authState?.playerId)
        ? String(authState.playerId)
        : (typeof player !== 'undefined' && player?.id ? String(player.id) : null);

    if(!playerId) return;

    const { error } = await window.supabaseClient
        .from('online_players')
        .delete()
        .eq('player_id', playerId);

    if(error){
        console.error('Ошибка удаления online_players:', error);
    }
}

async function cleanupStaleOnlinePlayers(){
    if(!window.supabaseClient) return;
    const cutoffIso = getOnlineFreshCutoffIso();
    const { error } = await window.supabaseClient
        .from('online_players')
        .delete()
        .lt('updated_at', cutoffIso);
    if(error){
        console.warn('Не удалось очистить старый online:', error);
    }
}

async function loadOnlinePlayersFromSupabase(){
    if(!window.supabaseClient) return [];
    const cutoffIso = getOnlineFreshCutoffIso();

    const { data, error } = await window.supabaseClient
        .from('online_players')
        .select('*')
        .gte('updated_at', cutoffIso)
        .order('updated_at', { ascending: false });

    if(error){
        console.error('Ошибка загрузки online_players:', error);
        return [];
    }

    return data || [];
}

function refreshPmOnlineState(players = []){
    onlinePmPeers.clear();
    inGamePmPeers.clear();
    for(const p of players || []){
        const targetId = p?.player_id ? String(p.player_id) : '';
        if(!targetId || !isAccountPublicId(targetId)) continue;
        if (String(p.status || '').toLowerCase() === 'lobby') onlinePmPeers.add(targetId);
        else inGamePmPeers.add(targetId);
    }
    renderChatTabs();
}

async function renderOnlinePlayers(){
    const list = document.getElementById('online-list');
    if(!list) return;

    const players = await loadOnlinePlayersFromSupabase();
    const myId = (typeof authState !== 'undefined' && authState?.playerId) ? String(authState.playerId) : null;
    refreshPmOnlineState(players);
    list.innerHTML = '';

    const lobbyPlayers = players.filter(item => String(item?.status || '').toLowerCase() === 'lobby');

    const appendPlayerRow = (p) => {
        const row = document.createElement('div');
        row.className = 'online-player';

        const targetId = p.player_id ? String(p.player_id) : null;
        const canPmTarget = isAccountPublicId(targetId);
        const isMe = !!(targetId && myId && targetId === myId);

        row.textContent = `${p.nickname || 'Player'}${!canPmTarget ? ' (guest)' : ''}`;
        row.title = isMe ? 'Это вы' : 'Нажмите, чтобы открыть профиль';
        row.dataset.playerId = targetId || '';
        row.dataset.nickname = p.nickname || '';
        if(!canPmTarget) row.style.opacity = '0.7';

        list.appendChild(row);

        if(targetId){
            row.addEventListener('click', async () => {
                await openPlayerProfile(targetId, p.nickname || `ID ${targetId}`);
            });
        }
    };

    if(lobbyPlayers.length){
        lobbyPlayers.forEach(p => appendPlayerRow(p));
    } else {
        const empty = document.createElement('div');
        empty.className = 'online-player';
        empty.style.opacity = '0.7';
        empty.textContent = 'Игроков онлайн пока нет';
        list.appendChild(empty);
    }
}

function getOnlinePresenceStateForGameState(state = gameState){
    const value = String(state || '').toUpperCase();
    if(value === 'LOBBY') return 'lobby';
    if(value === 'BATTLE' || value === 'OBSERVE' || value === 'ORBIT' || value === 'COMBAT') return 'in-game';
    return 'offline';
}

function syncCurrentOnlinePresence(){
    const status = getOnlinePresenceStateForGameState(gameState);
    if(status === 'offline'){
        removePlayerFromOnline();
        return;
    }

    const roomId = status === 'in-game'
        ? sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null)
        : null;

    setPlayerOnlineStatus(status, roomId);
}

function startOnlinePresenceHeartbeat(){
    if(onlineHeartbeatTimer) clearInterval(onlineHeartbeatTimer);
    onlineHeartbeatTimer = setInterval(() => {
        syncCurrentOnlinePresence();
    }, ONLINE_HEARTBEAT_MS);
}

function startOnlineRenderLoop(){
    if(onlineRenderTimer) clearInterval(onlineRenderTimer);
    onlineRenderTimer = setInterval(() => {
        renderOnlinePlayers();
    }, 5000);
}

function startBattleRoomsRenderLoop(){
    if(battleRoomsRenderTimer) clearInterval(battleRoomsRenderTimer);
    battleRoomsRenderTimer = null;
}

const previousSwitchStateOnline = window.switchState || switchState;
switchState = function(newState){
    if(newState === 'AUTH'){
        deleteAllOwnPmHistory();
        resetPrivateChatState();
    }

    if(isGuestAccount() && (newState === 'ORBIT' || newState === 'INVENTORY' || newState === 'COMBAT')){
        showGuestOnlyPvpMessage();
        previousSwitchStateOnline('LOBBY');
        syncCurrentOnlinePresence();
        setTimeout(renderOnlinePlayers, 300);
        return;
    }

    previousSwitchStateOnline(newState);
    syncCurrentOnlinePresence();
    setTimeout(renderOnlinePlayers, 300);
    if(newState === 'LOBBY' && typeof renderRoomsInLobby === 'function'){
        setTimeout(() => { renderRoomsInLobby(true); }, 180);
    }
};

window.switchState = switchState;
window.openPlayerProfile = openPlayerProfile;

window.addEventListener('beforeunload', () => {
    removePlayerFromOnline();
    deleteAllOwnPmHistory();
});

window.addEventListener('pagehide', () => {
    removePlayerFromOnline();
    deleteAllOwnPmHistory();
});

document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible'){
        syncCurrentOnlinePresence();
        setTimeout(renderOnlinePlayers, 250);
    }
});

window.addEventListener('focus', () => {
    syncCurrentOnlinePresence();
    setTimeout(renderOnlinePlayers, 250);
});

startOnlinePresenceHeartbeat();
startOnlineRenderLoop();
// auto refresh rooms disabled
cleanupStaleOnlinePlayers();
syncCurrentOnlinePresence();
renderOnlinePlayers();



(function ensurePlayerUiHelperStyles(){
    if (document.getElementById('player-ui-helper-styles')) return;
    const style = document.createElement('style');
    style.id = 'player-ui-helper-styles';
    style.textContent = `
      .chat-nick{background:none;border:none;padding:0 2px;color:#8deaff;cursor:pointer;font:inherit;font-weight:700;}
      .chat-nick:hover{text-decoration:underline;color:#c8f4ff;}
      #player-action-menu.hidden{display:none !important;}
    `;
    document.head.appendChild(style);
})();
