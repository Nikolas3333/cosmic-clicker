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
  ownedShipIds: ['scout_1'],
  selectedShipId: 'scout_1',
  ownedModuleIds: [],
  activeModulesByShip: {},
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
let activeBattleChatRoomId = null;

function persistBattleChatRoomId(roomId) {
    const safeRoomId = String(roomId || '').trim();
    if (!safeRoomId) return;
    activeBattleChatRoomId = safeRoomId;
    window.currentRoomId = safeRoomId;
    try { localStorage.setItem('cosmicLastBattleChatRoomId', safeRoomId); } catch (_) {}
}

function getPersistedBattleChatRoomId() {
    const direct = String(activeBattleChatRoomId || window.currentRoomId || '').trim();
    if (direct) return direct;
    try {
        const saved = localStorage.getItem('cosmicLastBattleChatRoomId');
        if (saved && String(saved).trim()) return String(saved).trim();
    } catch (_) {}
    return '';
}
let playerShip = null;
let keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false,
    shift: false
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
let battlePendingRespawnAt = 0;
let battlePlanetCapture = null;

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


// ===== EARLY SHOP HELPERS =====
function getAllShopShips(){
    try{
        const source = (typeof SHOP_DATA !== 'undefined' && SHOP_DATA)
            ? SHOP_DATA
            : (window.__cosmicShopData || null);
        return Object.values(source?.shipsByType || {}).flat();
    }catch(_){
        return [];
    }
}

function getShopShipById(shipId){
    try{
        const safeId = String(shipId || '').trim();
        if(!safeId) return null;
        return getAllShopShips().find(item => String(item?.id || '').trim() === safeId) || null;
    }catch(_){
        return null;
    }
}

function getShipCoinPrice(item){
    return Math.max(0, Number(item?.price || 0) || 0);
}

function getShipDiamondPrice(item){
    const coins = getShipCoinPrice(item);
    const tier = String(item?.tier || '').toLowerCase();
    const extra = tier.includes('топ') ? 12 : (tier.includes('соврем') ? 7 : 3);
    return Math.max(0, Math.round(coins / 220 + extra));
}

// ===== EARLY SHOP SAFETY =====
function closeShopView(){
    const shopWindow = document.getElementById('shop-window');
    if(shopWindow) shopWindow.classList.add('hidden');
}

function ensureShopOwnershipDefaults(){
    try{
        if(!player || typeof player !== 'object') return;
        if(!Array.isArray(player.ownedShipIds) || !player.ownedShipIds.length){
            player.ownedShipIds = ['scout_1'];
        }
        player.ownedShipIds = Array.from(new Set(
            player.ownedShipIds.map(id => String(id || '').trim()).filter(Boolean)
        ));
        if(!player.ownedShipIds.includes('scout_1')){
            player.ownedShipIds.unshift('scout_1');
        }
        if(!player.selectedShipId || !player.ownedShipIds.includes(player.selectedShipId)){
            player.selectedShipId = player.ownedShipIds[0] || 'scout_1';
        }
    }catch(_){}
}

function refreshOwnedShipsInventory(){
    try{
        ensureShopOwnershipDefaults();
        ensureModuleOwnershipDefaults();
        if(!Array.isArray(player.ships)) player.ships = [];
    }catch(_){}
}


let lobbyModeV27 = (typeof window !== 'undefined' && window.lobbyModeV27) ? window.lobbyModeV27 : 'battle';

function getLobbyModeSafe(){
    const safeMode = String((typeof window !== 'undefined' && window.lobbyModeV27) || lobbyModeV27 || 'battle').trim();
    if(safeMode === 'solo' || safeMode === 'tournament' || safeMode === 'battle') return safeMode;
    return 'battle';
}

function ensureSunStable(){
    try{
        if(typeof sun === 'undefined' || !sun || typeof solarSystem === 'undefined' || !solarSystem) return;
        sun.visible = true;
        if(!solarSystem.children.includes(sun)) solarSystem.add(sun);
        sun.position.set(0,0,0);
    }catch(_){}
}

function normalizePreviewPlayerEntry(rawPlayer, entry = {}, index = 0){
    const ownerId = String(entry?.owner_id || entry?.host_id || entry?.creator_id || entry?.player_id || '').trim();
    const ownerName = String(entry?.owner || entry?.host || entry?.host_name || entry?.creator || '').trim().toLowerCase();

    let id = '';
    let nickname = '';
    if(typeof rawPlayer === 'string'){
        nickname = rawPlayer.trim();
    }else if(rawPlayer && typeof rawPlayer === 'object'){
        id = String(rawPlayer.public_id || rawPlayer.player_id || rawPlayer.id || rawPlayer.user_id || '').trim();
        nickname = String(rawPlayer.nickname || rawPlayer.name || rawPlayer.player_nickname || rawPlayer.display_name || '').trim();
    }

    if(!nickname){
        nickname = `Игрок ${index + 1}`;
    }

    const isOwner = !!(
        (ownerId && id && ownerId === id) ||
        (ownerName && nickname.toLowerCase() === ownerName) ||
        (!ownerId && !ownerName && index === 0)
    );

    return { id, nickname, isOwner };
}

window.renderPlayersOnPlanet = function(entry = {}){
    const overlay = document.getElementById('map-player-overlay');
    if(!overlay) return;

    overlay.innerHTML = '';

    const rawPlayers = Array.isArray(entry?.currentPlayers) && entry.currentPlayers.length
        ? entry.currentPlayers
        : (Array.isArray(entry?.players) ? entry.players : []);

    const normalizedPlayers = rawPlayers.slice(0, 8).map((p, index) => normalizePreviewPlayerEntry(p, entry, index));

    for(let i = 0; i < normalizedPlayers.length; i++){
        const playerMeta = normalizedPlayers[i];
        const chip = document.createElement('div');
        chip.className = 'map-player-chip';

        

        if(playerMeta.isOwner){
            const crown = document.createElement('span');
            crown.className = 'map-player-owner';
            crown.textContent = '👑';
            chip.appendChild(crown);
        }

        const name = document.createElement('span');
        name.className = 'map-player-name';
        name.textContent = playerMeta.nickname;
        chip.appendChild(name);

        chip.addEventListener('click', async (event) => {
            event.stopPropagation();
            if(typeof openPlayerProfile === 'function'){
                await openPlayerProfile(playerMeta.id || '', playerMeta.nickname);
            }
        });

        overlay.appendChild(chip);
    }
};

function renderPlayersOnPlanet(entry = {}){
    return window.renderPlayersOnPlanet(entry);
}


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
    keys.shift = false;
    firing = false;
    mouseDeltaX = 0;
    mouseDeltaY = 0;
}

function isSettingsWindowOpen(){
    const settingsWindow = document.getElementById('settings-window');
    return !!(settingsWindow && !settingsWindow.classList.contains('hidden'));
}

function isBattleMenuOpen(){
    const pauseMenu = document.getElementById('battle-pause-menu');
    return !!((pauseMenu && !pauseMenu.classList.contains('hidden')) || isSettingsWindowOpen());
}

function isBattlePlanetCaptureActive(){
    return !!(battlePlanetCapture && !isBattleRespawning() && !battleShipCrash);
}

function startBattlePlanetCapture(){
    if(!playerShip || !battleMapPlanet || battleShipCrash || isBattleRespawning() || battlePlanetCapture) return;
    const lookDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();
    battlePlanetCapture = {
        startedAt: Date.now(),
        duration: 900,
        freezeCameraPosition: camera.position.clone(),
        freezeCameraLookAt: playerShip.position.clone().add(lookDirection.multiplyScalar(40)),
        startPosition: playerShip.position.clone(),
        normal: playerShip.position.clone().sub(battleMapPlanet.position).normalize()
    };
    if(!Number.isFinite(battlePlanetCapture.normal.x) || battlePlanetCapture.normal.lengthSq() === 0){
        battlePlanetCapture.normal.set(0, 1, 0);
    }
    resetBattleInputState();
}

function updateBattlePlanetCapture(){
    if(!battlePlanetCapture || !playerShip || !battleMapPlanet) return;
    const progress = THREE.MathUtils.clamp((Date.now() - battlePlanetCapture.startedAt) / battlePlanetCapture.duration, 0, 1);
    const radius = battleMapPlanet.userData?.radius || 100;
    const impactRadius = Math.max(radius + 8, battleMapPlanet.userData?.captureRadius || (radius + 26));
    const target = battleMapPlanet.position.clone().add(battlePlanetCapture.normal.clone().multiplyScalar(impactRadius));
    playerShip.position.lerp(target, 0.04 + progress * 0.16);
    shipVelocity.set(0, 0, 0);
    camera.position.copy(battlePlanetCapture.freezeCameraPosition);
    camera.lookAt(battlePlanetCapture.freezeCameraLookAt);
    if(progress >= 1){
        startShipCrashAnimation();
    }
}



document.addEventListener("mousedown", (event) => {
    if(event.button !== 0) return;
    if(gameState !== "BATTLE") return;
    if(battleObserverMode) return;
    if(isBattleTyping()) return;
    if(isBattleMenuOpen()) return;
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
        observerCameraPitch += event.movementY * 0.0026 * gameSettings.mouseSensitivity * invertFactor;
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
    if (e.code === "Space") keys.space = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.shift = true;
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
    if (e.code === "Space") keys.space = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.shift = false;

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




let battleHudClockTimer = null;
let battleHudPingTimer = null;

function getBattleRoomDisplayName(){
    return String(
        currentRoom?.title ||
        selectedLobbyMap?.title ||
        currentRoom?.real ||
        currentRoom?.map ||
        selectedLobbyMap?.real ||
        selectedLobbyMap?.name ||
        'Комната'
    ).trim() || 'Комната';
}

function formatBattleHudDateTime(now = new Date()){
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function updateBattleHudMeta(){
    const roomName = document.getElementById('battle-room-name');
    const roomDatetime = document.getElementById('battle-room-datetime');
    if(roomName) roomName.textContent = getBattleRoomDisplayName();
    if(roomDatetime) roomDatetime.textContent = formatBattleHudDateTime(new Date());
}

function getBattlePingValue(){
    const browserPing = Number(navigator?.connection?.rtt || 0);
    if(Number.isFinite(window.__battlePingMs) && window.__battlePingMs > 0) return Math.round(window.__battlePingMs);
    if(Number.isFinite(browserPing) && browserPing > 0) return Math.round(browserPing);
    return 0;
}

async function measureBattlePing(){
    try{
        const startedAt = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const pingUrl = String(location.href || '').split('#')[0] + (String(location.href || '').includes('?') ? '&' : '?') + 'ping=' + Date.now();

        await fetch(pingUrl, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const measured = Math.max(1, Math.round(performance.now() - startedAt));
        const previous = Number(window.__battlePingMs || 0);
        window.__battlePingMs = previous > 0
            ? Math.round(previous * 0.55 + measured * 0.45)
            : measured;
        updateBattleScoreboard?.();
        refreshLobbyPingForCurrentPlayer?.();
        return window.__battlePingMs;
    }catch(_){
        const browserPing = Number(navigator?.connection?.rtt || 0);
        if(Number.isFinite(browserPing) && browserPing > 0){
            window.__battlePingMs = Math.round(browserPing);
            updateBattleScoreboard?.();
            refreshLobbyPingForCurrentPlayer?.();
            return window.__battlePingMs;
        }
        return 0;
    }
}

function updateBattleHudPing(){
    const pingValue = document.getElementById('battle-ping-value');
    const value = getBattlePingValue();
    if(pingValue) pingValue.textContent = String(value > 0 ? value : '—');
}

function updateBattleSoundButtonState(){
    const btn = document.getElementById('battle-sound-btn');
    if(!btn) return;
    const muted = !gameSettings.soundEnabled && !gameSettings.musicEnabled;
    btn.classList.toggle('muted', muted);
    btn.textContent = muted ? '🔇' : '🔊';
}

function startBattleHudLoops(){
    stopBattleHudLoops();
    updateBattleHudMeta();
    updateBattleHudPing();
    measureBattlePing?.();
    updateBattleSoundButtonState();
    battleHudClockTimer = setInterval(updateBattleHudMeta, 1000);
    battleHudPingTimer = setInterval(() => {
        updateBattleHudPing();
        measureBattlePing?.();
    }, 4000);
}

function stopBattleHudLoops(){
    if(battleHudClockTimer){
        clearInterval(battleHudClockTimer);
        battleHudClockTimer = null;
    }
    if(battleHudPingTimer){
        clearInterval(battleHudPingTimer);
        battleHudPingTimer = null;
    }
}

function initBattleHudControls(){
    const fsBtn = document.getElementById('battle-fullscreen-btn');
    const soundBtn = document.getElementById('battle-sound-btn');
    const settingsBtn = document.getElementById('battle-settings-icon-btn');
    if(fsBtn && !fsBtn.dataset.bound){
        fsBtn.dataset.bound = '1';
        fsBtn.addEventListener('click', async () => {
            try{
                if(document.fullscreenElement){
                    await document.exitFullscreen();
                }else{
                    await document.documentElement.requestFullscreen?.();
                }
            }catch(_){}
        });
    }
    if(soundBtn && !soundBtn.dataset.bound){
        soundBtn.dataset.bound = '1';
        soundBtn.addEventListener('click', () => {
            const muted = gameSettings.soundEnabled || gameSettings.musicEnabled;
            gameSettings.soundEnabled = !muted;
            gameSettings.musicEnabled = !muted;
            applyAudioSettings();
            saveGameSettings();
            updateBattleSoundButtonState();
        });
    }
    if(settingsBtn && !settingsBtn.dataset.bound){
        settingsBtn.dataset.bound = '1';
        settingsBtn.addEventListener('click', () => {
            const settingsWindow = document.getElementById('settings-window');
            if(settingsWindow){
                settingsWindow.classList.remove('hidden');
                updateNicknameSettingsState?.();
            }
        });
    }
}

function updateBattlePlayerWorldName(){
    const label = document.getElementById('battle-player-world-name');
    if(!label) return;
    label.classList.add('hidden');
}

function refreshLobbyPingForCurrentPlayer(){
    const pingValue = getBattlePingValue();
    const labels = document.querySelectorAll('[data-player-ping-self="1"]');
    labels.forEach(label => {
        label.textContent = pingValue > 0 ? String(pingValue) : '—';
    });
}


function getSelfBattlePlayerId(){
    return String(authState?.playerId || player?.id || '').trim();
}

function getBattleRoomIdSafe(){
    return String(currentRoom?.id || currentRoom?.roomId || '').trim();
}

function getBattleRoomPlayerTeam(entryId = ''){
    const key = String(entryId || '').trim();
    if(!key) return 'blue';
    return String(key).slice(-1).charCodeAt(0) % 2 === 0 ? 'blue' : 'red';
}

const ROOM_PLAYER_STALE_MS = 12000;

function getRoomPlayerFreshCutoffIso(){
    return new Date(Date.now() - ROOM_PLAYER_STALE_MS).toISOString();
}

function isFreshRoomPlayerRow(row = {}){
    const stamp = row?.updated_at || row?.joined_at || null;
    if(!stamp) return false;
    const time = new Date(stamp).getTime();
    if(!Number.isFinite(time)) return false;
    return (Date.now() - time) <= ROOM_PLAYER_STALE_MS;
}

function getBattleShipColorHex(team = 'blue'){
    return String(team || '').trim().toLowerCase() === 'red' ? 0xff6b6b : 0x7ee7ff;
}

function getRemoteShipLabelColor(team = 'blue'){
    return String(team || '').trim().toLowerCase() === 'red' ? '#ff9a9a' : '#8deaff';
}

function tryApplyRemoteShipTeamVisual(entry){
    const mesh = entry?.mesh;
    if(!mesh) return;
    const colorHex = getBattleShipColorHex(entry?.team || 'blue');
    mesh.traverse?.((child) => {
        if(child?.isMesh && child.material && 'color' in child.material){
            try{ child.material.color.setHex(colorHex); }catch(_){}
        }
    });
}

function ensureSelfRoomPlayerState(){
    if(!window.supabaseClient) return;
    const roomId = getBattleRoomIdSafe();
    const playerId = getSelfBattlePlayerId();
    if(!roomId || !playerId || !playerShip) return;

    const team = getBattleRoomPlayerTeam(playerId);
    const payload = {
        room_id: roomId,
        player_id: playerId,
        nickname: player?.nickname || 'Commander',
        team,
        level: Number(player?.level || 1) || 1,
        ping: Number(getBattlePingValue() || 0) || 0,
        position: {
            x: Number(playerShip.position.x || 0),
            y: Number(playerShip.position.y || 0),
            z: Number(playerShip.position.z || 0)
        },
        rotation: {
            x: Number(playerShip.quaternion.x || 0),
            y: Number(playerShip.quaternion.y || 0),
            z: Number(playerShip.quaternion.z || 0),
            w: Number(playerShip.quaternion.w || 1)
        },
        updated_at: new Date().toISOString()
    };

    window.supabaseClient
        .from('room_players')
        .upsert(payload, { onConflict: 'room_id,player_id' })
        .then(() => {})
        .catch((error) => {
                    });
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

    const inputOnlyMode = gameState === 'BATTLE' || gameState === 'OBSERVE';

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

async function sendSceneMapMessage(text, options = {}) {
    if (!window.supabaseClient) return false;
    if (!canWriteSceneMapChat()) return false;

    const cleanText = String(text || "").trim();
    if (!cleanText) return false;

    const identity = typeof getObserveStaffChatIdentity === 'function'
        ? getObserveStaffChatIdentity()
        : {
            isObserveStaff: false,
            publicId: getOwnPublicChatId?.() || '',
            nickname: getOwnChatLabel(),
            staffRole: getOwnStaffRole?.() || 'player'
        };

    const roomId = String(getSceneChatRoomId() || '').trim();
    if (!roomId) return false;
    persistBattleChatRoomId(roomId);

    const mirrorToBattle = options?.mirrorToBattle !== false && (gameState === 'BATTLE' || gameState === 'OBSERVE');

    const scenePayload = {
        channel: "scene",
        room_id: roomId,
        player_id: getValidChatPlayerId(),
        player_public_id: identity.publicId || null,
        recipient_public_id: null,
        player_nickname: identity.nickname,
        staff_role: identity.staffRole || 'player',
        message: cleanText
    };

    const payloads = [scenePayload];

    if (mirrorToBattle) {
        payloads.push({
            channel: "battle",
            room_id: scenePayload.room_id,
            player_id: scenePayload.player_id,
            player_public_id: scenePayload.player_public_id,
            recipient_public_id: null,
            player_nickname: scenePayload.player_nickname,
            staff_role: scenePayload.staff_role,
            message: cleanText
        });
    }

    const { data, error } = await window.supabaseClient
        .from("chat_messages")
        .insert(payloads)
        .select('*');

    if (error) {
        console.error("❌ Ошибка отправки scene сообщения:", error);
        return false;
    }

    const insertedRows = Array.isArray(data) ? data : [];
    const insertedScene = insertedRows.find(row => row?.channel === 'scene');
    const insertedBattle = insertedRows.find(row => row?.channel === 'battle');

    if (insertedScene) {
        markLocalHandledChatMessage(insertedScene.id);
        showSceneMapMessageInActiveScene(insertedScene);
    }

    if (insertedBattle) {
        markLocalHandledChatMessage(insertedBattle.id);
        const battleScope = { key: 'battle', channel: 'battle' };
        pushChatToCache(battleScope, insertedBattle);
        if (currentChat !== 'battle') incrementUnread('battle');
        renderBattleMessages();
        if (currentChat === 'battle') renderLobbyMessages();
        renderChatTabs();
    }

    try {
        renderBattleMessages?.();
        renderLobbyMessages?.();
        renderChatTabs?.();
    } catch (_) {}

    return true;
}

function initBattleChat(){
    const input = document.getElementById('battle-chat-input');
    if(!input) return;
    if(!input.dataset.bound) input.dataset.bound = '1';
    if(window.__battleChatKeydownBound) return;
    window.__battleChatKeydownBound = true;

    document.addEventListener('keydown', async (e) => {
        if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;

        if(e.key === 'Enter'){
            if(e.repeat) return;
            if(!battleChatOpen){
                if(gameState === 'OBSERVE' && !canWriteInObserverChat()) {
                    e.preventDefault();
                    pushKillFeed('🚫 В режиме наблюдения писать может только staff.', 'chat');
                    return;
                }
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

                    if(gameState === 'BATTLE'){
                        sent = await sendSceneMapMessage(text, { mirrorToBattle:true });
                    }else if(gameState === 'OBSERVE'){
                        if(!canWriteInObserverChat()) {
                            pushKillFeed('🚫 В режиме наблюдения писать может только staff.', 'chat');
                        } else {
                            sent = await sendSceneMapMessage(text, { mirrorToBattle:true });
                        }
                    }

                    if(sent) input.value = '';
                }
                setBattleChatOpen(false);
                setTimeout(() => setBattleChatOpen(false), 0);
            }
        } else if(e.key === 'Escape' && battleChatOpen){
            setBattleChatOpen(false);
            setTimeout(() => setBattleChatOpen(false), 0);
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
    closeBattlePauseMenu?.();
    const cross = document.getElementById('battle-crosshair');
    if(cross) cross.style.display = 'block';
    const playerWorldName = document.getElementById('battle-player-world-name');
    if(playerWorldName) playerWorldName.classList.add('hidden');
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
    battlePendingRespawnAt = 0;
    battlePlanetCapture = null;
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
    const prevState = gameState;

    if(document.pointerLockElement){
        document.exitPointerLock();
    }

    if((prevState === "BATTLE" || prevState === "OBSERVE") && newState !== "BATTLE" && newState !== "OBSERVE"){
        cleanupBattleRoomSilently();
    }

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
        stopBattleHudLoops();
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
    updateNicknameSettingsState?.();

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
    startBattleHudLoops();
    initBattleHudControls();

    if(canvas){
        canvas.style.display = "block";

        setTimeout(() => {
            safeRequestPointerLock(canvas);
        }, 100);
    }

    if(typeof scene !== "undefined" && typeof solarSystem !== "undefined" && scene.children.includes(solarSystem)){
        scene.remove(solarSystem);
    }

    const targetMap = currentRoom?.real || selectedLobbyMap?.real || currentRoom?.map || selectedLobbyMap?.name || currentRoom?.title || "Земля";
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
        setTimeout(() => { try{ ensureSelfRoomPlayerState(); }catch(_){} }, 80);
        updateEnemyHud();
        updateBattleScoreboard();
        startLiveBattleSync();
    }
}

if(gameState === "OBSERVE"){
    battleObserverMode = true;
    updateBattlePlayerHud();
    startBattleHudLoops();
    initBattleHudControls();
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
    const targetMap = currentRoom?.real || selectedLobbyMap?.real || currentRoom?.map || selectedLobbyMap?.name || currentRoom?.title || "Земля";
    setupObserverBattle(targetMap);
    const hud = document.getElementById('enemy-hud'); if(hud) hud.style.display = 'none';
    const cross = document.getElementById('battle-crosshair'); if(cross) cross.style.display = 'none';
    const chatBox = document.getElementById('battle-chat-box'); if(chatBox) chatBox.classList.add('hidden');
    const log = document.getElementById('battle-chat-log'); if(log) log.innerHTML = '';
    startLiveBattleSync();
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
      coins: 0.04,
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
let localResourceDirtyUntil = 0;

function markLocalResourceDirty(ms = 6000){
  localResourceDirtyUntil = Math.max(localResourceDirtyUntil || 0, Date.now() + ms);
}

function hasRecentLocalResourceChanges(){
  return Number(localResourceDirtyUntil || 0) > Date.now();
}

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

  if(typeof row.level !== 'undefined' && row.level !== null){
    player.level = Number(row.level) || 1;
  }

  if(typeof row.experience !== 'undefined' && row.experience !== null){
    player.experience = Number(row.experience) || 0;
  }

  updatePremiumAccountInfo?.();
  updateHUD?.();
  updateUI?.();
  inventory.syncFromPlayerResources?.();
  inventory.render?.();
}

function getPlayerResourceColumnsSelect(){
  return ['credits', 'level', 'experience', ...RESOURCE_SYNC_KEYS, 'staff_role', 'is_banned', 'ban_reason', 'ban_until', 'is_muted', 'mute_reason', 'mute_until'].join(',');
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
      if(!hasRecentLocalResourceChanges()){
        applyPlayerResourcesFromRow(data);
      }
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
    bgMusic.volume = gameSettings.musicEnabled ? gameSettings.musicVolume : 0;

    if(typeof clickSound !== "undefined" && clickSound.buffer){
        clickSound.setVolume(gameSettings.soundEnabled ? gameSettings.soundVolume : 0);
    }

    if(typeof bossMusic !== "undefined" && bossMusic.buffer){
        bossMusic.setVolume(gameSettings.musicEnabled ? gameSettings.musicVolume : 0);
    }
    updateBattleSoundButtonState?.();
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
    initBattleHudControls();

    if(settingsTab && settingsWindow){
        settingsTab.addEventListener("click", () => {
            settingsWindow.classList.remove("hidden");
            updateNicknameSettingsState();
        });
    }

    if(closeSettings && settingsWindow && !closeSettings.dataset.bound){
        closeSettings.dataset.bound = '1';
        closeSettings.addEventListener("click", async () => {
            if(gameState === 'BATTLE' || gameState === 'OBSERVE'){
                settingsWindow.classList.add("hidden");
                await cleanupCurrentBattleRoom();
                switchState('LOBBY');
                if(typeof renderRoomsInLobby === 'function'){
                    await renderRoomsInLobby(true);
                }
                return;
            }
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


    const battleSettingsSaveBtn = document.getElementById('battle-settings-save-btn');
    if(battleSettingsSaveBtn && !battleSettingsSaveBtn.dataset.bound){
        battleSettingsSaveBtn.dataset.bound = '1';
        battleSettingsSaveBtn.addEventListener('click', () => {
            updateSettingsLabels();
            applyAudioSettings();
            saveGameSettings();
            if(settingsWindow) settingsWindow.classList.add('hidden');
            if((gameState === 'BATTLE' || gameState === 'OBSERVE') && !battleObserverMode){
                const canvas = document.querySelector('canvas');
                if(canvas) setTimeout(() => safeRequestPointerLock(canvas), 40);
            }
        });
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

const sunTexture = textureLoader.load("textures/2k_sun.jpg");
sunTexture.colorSpace = THREE.SRGBColorSpace;


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

const sunMaterial = new THREE.MeshBasicMaterial({
    map: sunTexture,
    color: 0xffffff
});

const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0,0,0);

const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(9.6, 48, 48),
    new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    })
);
sunGlow.name = 'sunOrbitGlow';
sun.add(sunGlow);

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
    const orbitGlow = this.mesh.getObjectByName('sunOrbitGlow');
    if(orbitGlow){
        const t = performance.now() * 0.001;
        orbitGlow.material.opacity = 0.15 + Math.sin(t * 1.6) * 0.04;
        const scale = 1 + Math.sin(t * 1.2) * 0.015;
        orbitGlow.scale.setScalar(scale);
    }
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
    if(gameState === 'BATTLE' && isBattleMenuOpen()) return;

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
    if(authState?.isAuthenticated){
        markLocalResourceDirty(6000);
        saveGame();
    }
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
    return;


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

// createDebugMenu();

/* ================= SAVE SYSTEM ================= */

function applySaveData(save){
    if(!save || typeof save !== 'object') return;
    currentLevel = Number(save.level || 1);
    damage = Number(save.damage || 1);
    player.level = Number(save.playerLevel || currentLevel || 1);
    player.experience = Number(save.playerExperience || player.experience || 0);
    player.credits = Number(save.credits || player.credits || 0);
    playerResources.coins = Number(save.credits || playerResources.coins || player.credits || 0);
    if(save.nickname) player.nickname = String(save.nickname).slice(0, 20);
    if(save.playerResources){
        for(const key in playerResources){
            if(typeof save.playerResources[key] === 'number') playerResources[key] = save.playerResources[key];
        }
    }
    if(Array.isArray(save.ownedShipIds) && save.ownedShipIds.length){
        player.ownedShipIds = Array.from(new Set(save.ownedShipIds.map(id => String(id || '').trim()).filter(Boolean)));
    }
    if(save.selectedShipId) player.selectedShipId = String(save.selectedShipId || '').trim() || player.selectedShipId;
    if(Array.isArray(save.ownedModuleIds)){
        player.ownedModuleIds = Array.from(new Set(save.ownedModuleIds.map(id => String(id || '').trim()).filter(Boolean)));
    }
    if(save.activeModulesByShip && typeof save.activeModulesByShip === 'object'){
        player.activeModulesByShip = save.activeModulesByShip;
    }
    ensureShopOwnershipDefaults?.();
    ensureModuleOwnershipDefaults?.();
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
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
    ensureShopOwnershipDefaults?.();
    const saveKey = getActiveSaveKey();
    if(saveKey){
        const localData = localStorage.getItem(saveKey);
        if(localData){
            try{ applySaveData(JSON.parse(localData)); }catch(error){ console.warn('Ошибка чтения local save:', error); }
        }
    }
    const remoteSave = await loadRemoteSaveFromSupabase();
    if(remoteSave) applySaveData(remoteSave);
    ensureShopOwnershipDefaults?.();
    ensureModuleOwnershipDefaults?.();
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    refreshOwnedShipsInventory?.();
}

function buildSavePayload(){
    return {
        level: currentLevel,
        damage: damage,
        credits: player.credits,
        playerLevel: player.level,
        playerExperience: player.experience,
        nickname: player.nickname,
        playerResources: playerResources,
        ownedShipIds: Array.isArray(player.ownedShipIds) ? [...player.ownedShipIds] : ['scout_1'],
        selectedShipId: player.selectedShipId || 'scout_1',
        ownedModuleIds: Array.isArray(player.ownedModuleIds) ? [...player.ownedModuleIds] : [],
        activeModulesByShip: player.activeModulesByShip && typeof player.activeModulesByShip === 'object' ? JSON.parse(JSON.stringify(player.activeModulesByShip)) : {}
    };
}

async function saveRemoteProgress(){
    if(!window.supabaseReady || !window.supabaseClient || authState.mode !== 'account' || !authState.playerId) return;
    markLocalResourceDirty(6000);
    const payload = buildSavePayload();
    try{
        await window.supabaseClient.from('players').update({
            nickname: player.nickname,
            level: player.level,
            experience: Number(player.experience || 0),
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
        else localResourceDirtyUntil = 0;
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
    if (typeof battleMapPlanet !== 'undefined' && battleMapPlanet) {
        battleMapPlanet.rotation.y += 0.0025;
    }


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

        solarSystem.position.z += (-40 - solarSystem.position.z) * 0.04;

        selectedPlanet.mesh.scale.x += 
            (1.8 - selectedPlanet.mesh.scale.x) * 0.04;

        selectedPlanet.mesh.scale.y += 
            (1.8 - selectedPlanet.mesh.scale.y) * 0.04;

        selectedPlanet.mesh.scale.z += 
            (1.8 - selectedPlanet.mesh.scale.z) * 0.04;

        selectedPlanet.updateResourceLabelPosition?.(true);

    }
    else{

        solarSystem.position.z += (0 - solarSystem.position.z) * 0.04;
        planets.forEach(p => p.updateResourceLabelPosition?.(false));
        sunOrbitData.updateResourceLabelPosition?.(false);
    }

    // ================= SHIP MOVEMENT =================

    animateRemoteBattleShips();

const BATTLE_LIMIT = 920;

if (gameState === "BATTLE" && playerShip) {
    updateBattleReloadState();
    updateBattleRespawnState();
    updateBattlePlayerWorldHp();
    updateBattlePlayerWorldName();
    if(battleShipCrash){
        updateShipCrashAnimation();
    } else if(isBattlePlanetCaptureActive()){
        updateBattlePlanetCapture();
    } else if(!isBattleRespawning()) {
    if(firing) tryFireLaser();

    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    const yawStep = Number(currentBattleShipStats.turnYaw || 0.0021) * gameSettings.mouseSensitivity;
    const pitchStep = Number(currentBattleShipStats.turnPitch || 0.0017) * gameSettings.mouseSensitivity;
    const invertFactor = gameSettings.invertY ? -1 : 1;
    const maxPitch = Math.PI / 3.1;
    const maxRoll = Number(currentBattleShipStats.rollLimit || 0.72);
    const forwardAcceleration = Number(currentBattleShipStats.forwardAcceleration || 0.14);
    const backwardAcceleration = Number(currentBattleShipStats.backwardAcceleration || 0.07);
    const strafeAcceleration = Number(currentBattleShipStats.strafeAcceleration || 0.045);
    const damping = Number(currentBattleShipStats.damping || 0.985);
    const maxSpeed = Number(currentBattleShipStats.maxSpeed || 4.2);

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
                if(playerShip){
                    spawnShipDebris(playerShip.position.clone(), 0x64d8ff);
                }
                scheduleBattleRespawn(2000);
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
        enemyBot.rotation.z += ((Math.sin(enemyBot.userData.strafePhase) * 0.45) - enemyBot.rotation.z) * 0.04;

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
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    const fireCooldown = Number(currentBattleShipStats?.fireCooldown || laserCooldown) || laserCooldown;
    if(!playerShip || battleShipCrash || battleWeapon.isReloading || isBattlePlanetCaptureActive() || now - lastLaserShotAt < fireCooldown) return;
    if(battleWeapon.ammoInClip <= 0){
        startBattleReload();
        return;
    }

    lastLaserShotAt = now;
    battleWeapon.ammoInClip = Math.max(0, battleWeapon.ammoInClip - 1);

    const projectileWidth = Number(currentBattleShipStats?.projectileWidth || 0.14) || 0.14;
    const projectileLength = Number(currentBattleShipStats?.projectileLength || 2.2) || 2.2;
    const projectileScale = Number(currentBattleShipStats?.laserScale || 1) || 1;
    const projectileVelocity = Number(currentBattleShipStats?.laserVelocity || 3.2) || 3.2;
    const projectileLife = Number(currentBattleShipStats?.projectileLife || 100) || 100;
    const projectileOffset = Number(currentBattleShipStats?.projectileOffset || 0) || 0;
    const spread = Number(currentBattleShipStats?.spread || 0) || 0;
    const burstCount = Math.max(1, Number(currentBattleShipStats?.burstCount || 1) || 1);
    const weaponType = String(currentBattleShipStats?.weaponType || currentBattleShipStats?.ship?.weapon || 'laser').toLowerCase();
    const color = new THREE.Color(currentBattleShipStats?.projectileColor || '#ff3355');
    const coreColor = new THREE.Color(currentBattleShipStats?.projectileCoreColor || '#ffffff');
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();

    const spawnProjectile = (offsetX = 0, spreadOffset = 0) => {
        const projectileGroup = new THREE.Group();

        let shell;
        if(weaponType === 'missile'){
            shell = new THREE.Mesh(
                new THREE.CylinderGeometry(projectileWidth * 0.35, projectileWidth * 0.7, projectileLength, 10),
                new THREE.MeshBasicMaterial({ color })
            );
            shell.rotation.x = Math.PI / 2;
            const tip = new THREE.Mesh(
                new THREE.ConeGeometry(projectileWidth * 0.7, projectileWidth * 1.1, 10),
                new THREE.MeshBasicMaterial({ color: coreColor })
            );
            tip.rotation.x = -Math.PI / 2;
            tip.position.z = -projectileLength * 0.55;
            const flame = new THREE.Mesh(
                new THREE.CylinderGeometry(projectileWidth * 0.18, projectileWidth * 0.45, projectileLength * 0.45, 8),
                new THREE.MeshBasicMaterial({ color: '#ffdd88' })
            );
            flame.rotation.x = Math.PI / 2;
            flame.position.z = projectileLength * 0.55;
            projectileGroup.add(shell, tip, flame);
        }else{
            shell = new THREE.Mesh(
                new THREE.BoxGeometry(projectileWidth * projectileScale, projectileWidth * projectileScale, projectileLength),
                new THREE.MeshBasicMaterial({ color })
            );
            const core = new THREE.Mesh(
                new THREE.BoxGeometry(projectileWidth * 0.45 * projectileScale, projectileWidth * 0.45 * projectileScale, projectileLength * 0.72),
                new THREE.MeshBasicMaterial({ color: coreColor })
            );
            projectileGroup.add(shell, core);
        }

        const localDirection = new THREE.Vector3(spreadOffset, 0, -1).normalize().applyQuaternion(playerShip.quaternion);
        const localOffset = new THREE.Vector3(offsetX, 0, -2.2).applyQuaternion(playerShip.quaternion);
        projectileGroup.position.copy(playerShip.position.clone().add(localOffset));
        projectileGroup.lookAt(projectileGroup.position.clone().add(localDirection));
        scene.add(projectileGroup);

        activeLasers.push({
            mesh: projectileGroup,
            velocity: localDirection.clone().multiplyScalar(projectileVelocity),
            life: projectileLife,
            damage: battleWeapon.damage,
            weaponType
        });
    };

    if(burstCount === 1){
        spawnProjectile(0, 0);
    }else if(burstCount === 2){
        spawnProjectile(-projectileOffset, -spread);
        spawnProjectile(projectileOffset, spread);
    }else{
        const midIndex = (burstCount - 1) / 2;
        for(let i = 0; i < burstCount; i++){
            const offsetIndex = i - midIndex;
            spawnProjectile(offsetIndex * projectileOffset, offsetIndex * spread);
        }
    }

    if(battleWeapon.ammoInClip <= 0){
        startBattleReload();
    }
    updateBattlePlayerHud();
    playEffectSound(clickSound);
}




function formatAmmoReserve(){
    return battleWeapon.reserveAmmo === Infinity ? '∞' : String(battleWeapon.reserveAmmo);
}

function isBattleRespawning(){
    return battlePendingRespawnAt && Date.now() < battlePendingRespawnAt;
}

function scheduleBattleRespawn(delayMs=2000){
    battlePendingRespawnAt = Date.now() + Math.max(0, delayMs);
    if(playerShip){
        playerShip.visible = false;
        playerShip.position.set(99999,99999,99999);
    }
    shipVelocity.set(0,0,0);
    battlePlanetCapture = null;
    firing = false;
    updateBattlePlayerHud();
}

function updateBattleRespawnState(){
    if(!battlePendingRespawnAt) return;
    const remain = battlePendingRespawnAt - Date.now();
    if(remain > 0){
        const reloadText = document.getElementById('battle-reload-text');
        if(reloadText) reloadText.textContent = `Респавн через ${(remain / 1000).toFixed(1)}с`;
        return;
    }
    battlePendingRespawnAt = 0;
    playerHp = playerMaxHp;
    spawnPlayer();
    updateBattlePlayerHud();
}

function updateBattlePlayerWorldHp(){
    const wrap = document.getElementById('battle-player-world-hp');
    const fill = document.getElementById('battle-player-world-hp-fill');
    if(!wrap || !fill) return;
    const visible = gameState === 'BATTLE' && !battleObserverMode;
    wrap.classList.toggle('hidden', !visible);
    if(!visible) return;
    const hpPercent = THREE.MathUtils.clamp((playerHp / Math.max(1, playerMaxHp)) * 100, 0, 100);
    fill.style.width = hpPercent + '%';
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
    if(isBattleRespawning()){
        const remain = Math.max(0, battlePendingRespawnAt - Date.now());
        reloadText.textContent = `Респавн через ${(remain / 1000).toFixed(1)}с`;
    }else if(battleShipCrash){
        reloadText.textContent = 'Корабль уничтожен';
    }else if(battleWeapon.isReloading){
        const remain = Math.max(0, battleWeapon.reloadEndsAt - Date.now());
        reloadText.textContent = `Перезарядка: ${(remain / 1000).toFixed(1)}с`;
    }else{
        reloadText.textContent = 'R — перезарядка';
    }
}

function startBattleReload(force=false){
    if(gameState !== 'BATTLE' || !playerShip || battleShipCrash || isBattleRespawning()) return;
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
    if(!playerShip || !battleMapPlanet || battleShipCrash || isBattleRespawning()) return;
    battleShipCrash = { startAt: Date.now(), duration: 250 };
    spawnShipDebris(playerShip.position.clone(), 0xffa36a);
    battleStats.playerDeaths += 1;
    updateBattleScoreboard();
    pushKillFeed(`${player?.nickname || 'Commander'} разбился о планету`, 'kill');
    scheduleBattleRespawn(2000);
}

function updateShipCrashAnimation(){
    if(!battleShipCrash) return;
    if(Date.now() - battleShipCrash.startAt >= battleShipCrash.duration){
        battleShipCrash = null;
    }
}

function startSunProminenceDeath(){
    if(!playerShip || battleShipCrash || isBattleRespawning()) return;
    spawnShipDebris(playerShip.position.clone(), 0xffd36a);
    battleStats.playerDeaths += 1;
    updateBattleScoreboard();
    pushKillFeed(`${player?.nickname || 'Commander'} сгорел в протуберанце`, 'kill');
    scheduleBattleRespawn(2000);
}

function updateBattlePlanetEffects(){
    if(!battleMapPlanet || !playerShip || battleObserverMode) return;

    const isSunMap = !!battleMapPlanet.userData?.isSunMap;
    const toPlanet = battleMapPlanet.position.clone().sub(playerShip.position);
    const distance = toPlanet.length();
    const radius = battleMapPlanet.userData?.radius || 50;
    const atmosphereRadius = battleMapPlanet.userData?.atmosphereRadius || radius + 42;
    const nearSurfaceRadius = battleMapPlanet.userData?.nearSurfaceRadius || radius + 14;
    const crashRadius = battleMapPlanet.userData?.crashRadius || radius + 10;
    const captureRadius = Math.max(crashRadius + 10, radius + 24);

    const scaleBoost = THREE.MathUtils.clamp(1 + ((320 - Math.max(0, distance - radius)) / 320) * (isSunMap ? 0.64 : 0.5), 1, isSunMap ? 1.65 : 1.5);
    battlePlanetVisualScale += (scaleBoost - battlePlanetVisualScale) * 0.08;
    battleMapPlanet.scale.setScalar(battlePlanetVisualScale);

    if(isSunMap){
        battleMapPlanet.rotation.y += 0.0015;
    }

    const towardPlanet = toPlanet.clone().normalize();
    if(!Number.isFinite(towardPlanet.x) || towardPlanet.lengthSq() === 0) return;

    if(distance <= crashRadius){
        playerShip.position.copy(battleMapPlanet.position.clone().sub(towardPlanet.clone().multiplyScalar(crashRadius)));
        shipVelocity.set(0, 0, 0);
        startShipCrashAnimation();
        return;
    }

    if(distance <= captureRadius){
        if(!battlePlanetCapture){
            startBattlePlanetCapture();
        }
        const lockDistance = Math.max(crashRadius, radius + 10);
        playerShip.position.copy(battleMapPlanet.position.clone().sub(towardPlanet.clone().multiplyScalar(lockDistance)));
        shipVelocity.set(0, 0, 0);
        return;
    }

    if(distance < atmosphereRadius){
        const gravityStrength = THREE.MathUtils.clamp((atmosphereRadius - distance) / Math.max(1, atmosphereRadius - radius), 0, 1);
        shipVelocity.add(towardPlanet.multiplyScalar((isSunMap ? 0.03 : 0.022) + gravityStrength * (isSunMap ? 0.05 : 0.038)));

        if(distance < nearSurfaceRadius){
            shipVelocity.multiplyScalar(isSunMap ? 0.90 : 0.92);
        }
    }
}
// ===== POINTER LOCK =====
const canvas = renderer.domElement;



document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
    } else {
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

    const coinChance = 0.04;      // 8%
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
const localHandledChatMessageIds = new Set();
const BATTLE_HISTORY_SEARCH_LIMIT = 80;
const battleHistorySearchState = {
    playerId: '',
    loading: false,
    error: '',
    messages: [],
    playerLabel: '',
    dateQuery: '',
    keywordQuery: ''
};

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

function canWriteBattleAnnouncementChatByRole(role = "player") {
    const normalizedRole = normalizeStaffRole(role);
    return normalizedRole === "adm" || normalizedRole === "owr";
}

function getSharedBattleChatRoomId() {
    const mapName = String(
        currentRoom?.real ||
        currentRoom?.map ||
        currentRoom?.rawRoom?.map_name ||
        selectedLobbyMap?.real ||
        selectedLobbyMap?.map ||
        selectedLobbyMap?.name ||
        ''
    ).trim().toLowerCase();

    if (!mapName) return '';

    return `public_${mapName}`;
}

function getSceneChatRoomId() {
    const sharedBattleRoomId = String(getSharedBattleChatRoomId() || '').trim();
    if (sharedBattleRoomId) {
        persistBattleChatRoomId(sharedBattleRoomId);
        return sharedBattleRoomId;
    }

    const fromCurrentRoom = currentRoom?.id || currentRoom?.roomId || null;
    if (fromCurrentRoom) {
        const currentRoomId = String(fromCurrentRoom).trim();
        persistBattleChatRoomId(currentRoomId);
        return currentRoomId;
    }

    const rememberedRoomId = getPersistedBattleChatRoomId();
    if (rememberedRoomId) return rememberedRoomId;

    const fallbackMap = currentRoom?.map || currentRoom?.real || selectedLobbyMap?.real || selectedLobbyMap?.name || "scene";
    const fallbackRoomId = String(`scene_${String(fallbackMap).toLowerCase()}`);
    persistBattleChatRoomId(fallbackRoomId);
    return fallbackRoomId;
}

function getBattleChatRoomId() {
    const sharedBattleRoomId = String(getSharedBattleChatRoomId() || '').trim();
    if (sharedBattleRoomId) {
        persistBattleChatRoomId(sharedBattleRoomId);
        return sharedBattleRoomId;
    }

    const sceneRoomId = String(getSceneChatRoomId() || '').trim();
    if (sceneRoomId) {
        persistBattleChatRoomId(sceneRoomId);
        return sceneRoomId;
    }
    return getPersistedBattleChatRoomId();
}

function canWriteSceneMapChat() {
    if (gameState === "BATTLE") return true;
    if (gameState === "OBSERVE") return canWriteInObserverChat();
    return false;
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
    const role = getResolvedStaffRole(publicId, explicitRole);
    const safeId = String(publicId || '').trim();
    return isStaffRole(role) && !safeId;
}

function shouldHideStaffIdentityInObserve(publicId, explicitRole = "") {
    return shouldHideStaffIdentityInScene(publicId, explicitRole);
}

function shouldShowSceneRoleBadgeInCurrentMode(publicId = "", explicitRole = "") {
    return gameState === 'OBSERVE' || shouldHideStaffIdentityInScene(publicId, explicitRole);
}

function getSceneRoleBadgeHtml(publicId, explicitRole = "") {
    const role = getResolvedStaffRole(publicId, explicitRole);
    const meta = getStaffRoleMeta(role);
    const roleClass = getChatRoleCssClassByRole(role);
    if (!meta || !meta.short) return "";
    return `<span class="scene-role-badge ${roleClass}">[${escapeChatHtml(meta.short)}]</span>`;
}

function getForcedSceneRoleBadgeHtml(explicitRole = "") {
    const role = normalizeStaffRole(explicitRole);
    const meta = getStaffRoleMeta(role);
    const roleClass = getChatRoleCssClassByRole(role);
    if (!meta || !meta.short || role === "player") return "";
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

function getObserveStaffChatIdentity() {
    const role = getOwnStaffRole();
    const meta = getStaffRoleMeta(role);
    const isObserveStaff = gameState === 'OBSERVE' && isStaffRole(role);
    return {
        isObserveStaff,
        publicId: isObserveStaff ? null : getOwnPublicChatId(),
        nickname: isObserveStaff ? (meta?.label || 'Staff') : getOwnChatLabel(),
        staffRole: role
    };
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


function markLocalHandledChatMessage(id) {
    const key = String(id || '').trim();
    if (!key) return;
    localHandledChatMessageIds.add(key);
    setTimeout(() => localHandledChatMessageIds.delete(key), 15000);
}

function wasLocalHandledChatMessage(id) {
    const key = String(id || '').trim();
    if (!key) return false;
    if (!localHandledChatMessageIds.has(key)) return false;
    localHandledChatMessageIds.delete(key);
    
try {
    renderBattleMessages && renderBattleMessages();
    renderLobbyMessages && renderLobbyMessages();
    renderChatTabs && renderChatTabs();
} catch(e){}

return true;
}

function pushChatToCache(scope, msg) {
    const list = getChatCacheList(scope);
    if (list.some(item => String(item.id) === String(msg.id))) return false;

    if (scope?.channel === 'battle') {
        const sourceSceneId = String(msg?.source_scene_id || '').trim();
        if (sourceSceneId && list.some(item => String(item?.source_scene_id || '') === sourceSceneId || String(item?.id || '') === sourceSceneId)) {
            return false;
        }

        const msgText = String(msg?.message || '').trim();
        const msgRoom = String(msg?.room_id || '').trim();
        const msgAuthor = String(msg?.player_public_id || msg?.player_id || '').trim();
        const msgTime = new Date(msg?.created_at || 0).getTime();

        if (msgText && msgRoom && msgAuthor && Number.isFinite(msgTime)) {
            const nearDuplicate = list.some(item => {
                const itemText = String(item?.message || '').trim();
                const itemRoom = String(item?.room_id || '').trim();
                const itemAuthor = String(item?.player_public_id || item?.player_id || '').trim();
                const itemTime = new Date(item?.created_at || 0).getTime();
                if (!Number.isFinite(itemTime)) return false;
                return itemText === msgText && itemRoom === msgRoom && itemAuthor === msgAuthor && Math.abs(itemTime - msgTime) < 2500;
            });
            if (nearDuplicate) return false;
        }
    }

    list.push(msg);
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    while (list.length > CHAT_MESSAGE_LIMIT) list.shift();
    
try {
    renderBattleMessages && renderBattleMessages();
    renderLobbyMessages && renderLobbyMessages();
    renderChatTabs && renderChatTabs();
} catch(e){}

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

    const resolvedRole = getResolvedStaffRole(publicId, msg?.staff_role || "");
    const isObserveHiddenStaff = scope.channel === "battle" && shouldHideStaffIdentityInObserve(publicId, resolvedRole);
    const isGlobalStaffAnnouncement = scope.channel === "battle" && String(msg?.room_id || '').trim() === '__all__' && canWriteBattleAnnouncementChatByRole(resolvedRole);

    const shouldShowLobbyRoleBadge =
        (scope.channel === "global" || scope.channel === "clan") &&
        isStaffRole(resolvedRole);

    const showRoleBadge = isGlobalStaffAnnouncement || isObserveHiddenStaff || shouldShowLobbyRoleBadge;
    const roleBadge = showRoleBadge
        ? (shouldShowLobbyRoleBadge
            ? getChatRoleBadgeHtmlByPublicId(publicId, resolvedRole)
            : getForcedSceneRoleBadgeHtml(resolvedRole))
        : '';
    const roleClass = showRoleBadge
        ? (shouldShowLobbyRoleBadge
            ? getChatRoleCssClassByPublicIdOrRole(publicId, resolvedRole)
            : getChatRoleCssClassByRole(resolvedRole))
        : '';
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

    if (isGlobalStaffAnnouncement || isObserveHiddenStaff) {
        return `
          <div class="chat-line${lineClass}" data-message-id="${msg.id}">
            ${prefix}${roleBadge}
            <span class="chat-time">[${time}]</span>
            <span class="chat-text">${text}</span>
          </div>
        `;
    }

    const idHtml = publicId ? `<span class="chat-id">[${safePublicId}]</span>` : '';
    return `
      <div class="chat-line${lineClass}" data-message-id="${msg.id}">
        ${prefix}${roleBadge}
        <button class="chat-nick" type="button"${nickAttrs}>${author}</button>
        ${idHtml}
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
    const isGlobalStaffAnnouncement = String(msg?.room_id || '').trim() === '__all__' && canWriteBattleAnnouncementChatByRole(msg?.staff_role);
    const showRoleBadge = shouldShowSceneRoleBadgeInCurrentMode(publicId, msg.staff_role);
    const roleBadge = isGlobalStaffAnnouncement
        ? getForcedSceneRoleBadgeHtml(msg.staff_role)
        : (showRoleBadge ? getSceneRoleBadgeHtml(publicId, msg.staff_role) : '');
    const roleClass = isGlobalStaffAnnouncement
        ? getChatRoleCssClassByRole(msg.staff_role)
        : (showRoleBadge ? getChatRoleCssClassByPublicIdOrRole(publicId, msg.staff_role) : '');
    const lineClass = roleClass ? `chat-line chat-staff ${roleClass}` : 'chat-line';

    if (shouldHideStaffIdentityInObserve(publicId, msg.staff_role) || isGlobalStaffAnnouncement) {
        return `<div class="${lineClass}" data-message-id="${msg.id}">${roleBadge}<span class="chat-time">[${time}]</span> <span class="chat-text">${text}</span></div>`;
    }

    const idHtml = publicId ? ` <span class="chat-id">[${safePublicId}]</span>` : '';
    return `<div class="${lineClass}" data-message-id="${msg.id}">${roleBadge}<span class="chat-nick-static">${author}</span>${idHtml} <span class="chat-time">[${time}]</span> <span class="chat-text">${text}</span></div>`;
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


function formatBattleHistoryDateTime(dateStr) {
    const d = new Date(dateStr || Date.now());
    const date = d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${date} ${time}`;
}

function buildBattleHistoryMessageHtml(msg) {
    const author = escapeChatHtml(msg.player_nickname || "Unknown");
    const text = escapeChatHtml(msg.message || "");
    const dateTime = formatBattleHistoryDateTime(msg.created_at);
    const publicId = msg.player_public_id ? String(msg.player_public_id) : "";
    const safePublicId = escapeChatHtml(publicId || "0");
    const roleBadge = getSceneRoleBadgeHtml(publicId, msg.staff_role);
    const roleClass = getChatRoleCssClassByPublicIdOrRole(publicId, msg.staff_role);
    const lineClass = roleClass ? ` chat-staff ${roleClass}` : "";
    const idHtml = publicId ? `<span class="chat-id">[${safePublicId}]</span>` : '';
    return `
      <div class="chat-line battle-history-line${lineClass}" data-message-id="${msg.id}">
        ${roleBadge}
        <span class="chat-nick-static">${author}</span>
        ${idHtml}
        <span class="chat-time">[${escapeChatHtml(dateTime)}]</span>
        <span class="chat-text">${text}</span>
      </div>
    `;
}

function ensureBattleHistorySearchUi() {
    const panel = document.getElementById('chat-panel');
    const tabs = document.getElementById('chat-tabs');
    if (!panel || !tabs) return null;

    let wrap = document.getElementById('battle-history-search-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'battle-history-search-wrap';
        wrap.className = 'battle-history-search-wrap hidden';
        wrap.innerHTML = `
            <div class="battle-history-search-bar">
                <input id="battle-history-player-id" type="text" inputmode="numeric" placeholder="ID игрока">
                <button id="battle-history-search-btn" type="button" title="Поиск истории battle">🔎</button>
            </div>
        `;
        tabs.appendChild(wrap);

        let modal = document.getElementById('battle-history-search-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'battle-history-search-modal';
            modal.className = 'battle-history-search-modal hidden';
            modal.innerHTML = `
                <div class="battle-history-search-backdrop" data-role="history-close"></div>
                <div class="battle-history-search-window">
                    <div class="battle-history-search-panel-head">
                        <span id="battle-history-search-caption">История battle</span>
                        <div class="battle-history-search-panel-tools">
                            <input id="battle-history-date-filter" type="text" placeholder="Дата: 30.03.2026">
                            <input id="battle-history-keyword-filter" type="text" placeholder="Ключевые слова">
                            <button id="battle-history-search-close" type="button">×</button>
                        </div>
                    </div>
                    <div id="battle-history-search-results" class="battle-history-search-results"></div>
                </div>
            `;
            const lobbyScreen = document.getElementById('lobby-screen') || document.body;
            lobbyScreen.appendChild(modal);
            modal.querySelector('[data-role="history-close"]')?.addEventListener('click', closeBattleHistorySearchModal);
            modal.querySelector('#battle-history-search-close')?.addEventListener('click', closeBattleHistorySearchModal);
            modal.querySelector('#battle-history-date-filter')?.addEventListener('input', (e) => {
                battleHistorySearchState.dateQuery = String(e.target?.value || '').trim();
                renderBattleHistorySearchUi();
            });
            modal.querySelector('#battle-history-keyword-filter')?.addEventListener('input', (e) => {
                battleHistorySearchState.keywordQuery = String(e.target?.value || '').trim();
                renderBattleHistorySearchUi();
            });
        }

        wrap.querySelector('#battle-history-search-btn')?.addEventListener('click', () => {
            runBattleHistorySearch();
        });
        wrap.querySelector('#battle-history-player-id')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runBattleHistorySearch();
            }
        });
    }
    return wrap;
}

function closeBattleHistorySearchModal() {
    battleHistorySearchState.messages = [];
    battleHistorySearchState.error = '';
    battleHistorySearchState.playerLabel = '';
    battleHistorySearchState.loading = false;
    battleHistorySearchState.dateQuery = '';
    battleHistorySearchState.keywordQuery = '';
    renderBattleHistorySearchUi();
}

function normalizeBattleHistoryDateStrings(createdAt) {
    if (!createdAt) return [];
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return [];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    return [
        `${dd}.${mm}.${yyyy}`,
        `${yyyy}-${mm}-${dd}`,
        `${dd}/${mm}/${yyyy}`
    ];
}

function getFilteredBattleHistoryMessages() {
    const dateQuery = String(battleHistorySearchState.dateQuery || '').trim().toLowerCase();
    const keywordQuery = String(battleHistorySearchState.keywordQuery || '').trim().toLowerCase();
    return (battleHistorySearchState.messages || []).filter(msg => {
        const msgText = String(msg?.message || '').toLowerCase();
        const matchesKeyword = !keywordQuery || msgText.includes(keywordQuery);
        const dateStrings = normalizeBattleHistoryDateStrings(msg?.created_at).map(v => v.toLowerCase());
        const matchesDate = !dateQuery || dateStrings.some(v => v.includes(dateQuery));
        return matchesKeyword && matchesDate;
    });
}

function renderBattleHistorySearchUi() {
    const wrap = ensureBattleHistorySearchUi();
    if (!wrap) return;

    const shouldShowToolbar = currentChat === 'battle';
    wrap.classList.toggle('hidden', !shouldShowToolbar);

    const input = document.getElementById('battle-history-player-id');
    const searchBtn = document.getElementById('battle-history-search-btn');
    const modal = document.getElementById('battle-history-search-modal');
    const caption = document.getElementById('battle-history-search-caption');
    const results = document.getElementById('battle-history-search-results');
    const dateFilterInput = document.getElementById('battle-history-date-filter');
    const keywordFilterInput = document.getElementById('battle-history-keyword-filter');
    if (!input || !searchBtn || !modal || !caption || !results || !dateFilterInput || !keywordFilterInput) return;

    if (document.activeElement !== input) {
        input.value = battleHistorySearchState.playerId || '';
    }
    if (document.activeElement !== dateFilterInput) {
        dateFilterInput.value = battleHistorySearchState.dateQuery || '';
    }
    if (document.activeElement !== keywordFilterInput) {
        keywordFilterInput.value = battleHistorySearchState.keywordQuery || '';
    }

    searchBtn.disabled = !!battleHistorySearchState.loading;
    searchBtn.textContent = battleHistorySearchState.loading ? '…' : '🔎';

    const filteredMessages = getFilteredBattleHistoryMessages();
    const hasVisiblePanel = !!battleHistorySearchState.loading || !!battleHistorySearchState.error || battleHistorySearchState.messages.length > 0;
    modal.classList.toggle('hidden', !hasVisiblePanel || !shouldShowToolbar);

    if (!hasVisiblePanel || !shouldShowToolbar) {
        results.innerHTML = '';
        return;
    }

    const safePlayerId = escapeChatHtml(battleHistorySearchState.playerId || '');
    const safeLabel = escapeChatHtml(battleHistorySearchState.playerLabel || '');
    caption.textContent = safeLabel ? `История Battle: ${safeLabel}` : `История Battle ID ${safePlayerId || '?'}`;

    if (battleHistorySearchState.loading) {
        results.innerHTML = '<div class="chat-line system">Загрузка истории battle...</div>';
        return;
    }

    if (battleHistorySearchState.error) {
        results.innerHTML = `<div class="chat-line system">${escapeChatHtml(battleHistorySearchState.error)}</div>`;
        return;
    }

    if (!battleHistorySearchState.messages.length) {
        results.innerHTML = '<div class="chat-line system">Сообщения battle для этого ID не найдены.</div>';
        return;
    }

    if (!filteredMessages.length) {
        results.innerHTML = '<div class="chat-line system">По выбранным фильтрам ничего не найдено.</div>';
        return;
    }

    const previousTop = results.scrollTop;
    const shouldStickToBottom = (results.scrollHeight - results.scrollTop - results.clientHeight) <= 28;
    const wasEmpty = !results.children.length;
    results.innerHTML = filteredMessages.map(msg => buildBattleHistoryMessageHtml(msg)).join('');
    if (wasEmpty) {
        results.scrollTop = 0;
    } else if (shouldStickToBottom) {
        results.scrollTop = results.scrollHeight;
    } else {
        results.scrollTop = previousTop;
    }
}

async function runBattleHistorySearch(forcedPlayerId = null) {
    if (!window.supabaseClient) {
        battleHistorySearchState.error = 'Supabase ещё не готов.';
        battleHistorySearchState.messages = [];
        renderBattleHistorySearchUi();
        return;
    }

    const input = document.getElementById('battle-history-player-id');
    const safePlayerId = String(forcedPlayerId ?? input?.value ?? battleHistorySearchState.playerId ?? '').trim();
    if (!/^\d+$/.test(safePlayerId)) {
        battleHistorySearchState.playerId = safePlayerId;
        battleHistorySearchState.error = 'Введите числовой ID игрока.';
        battleHistorySearchState.messages = [];
        battleHistorySearchState.playerLabel = '';
        renderBattleHistorySearchUi();
        return;
    }

    battleHistorySearchState.playerId = safePlayerId;
    battleHistorySearchState.loading = true;
    battleHistorySearchState.error = '';
    battleHistorySearchState.messages = [];
    battleHistorySearchState.playerLabel = '';
    renderBattleHistorySearchUi();

    const { data, error } = await window.supabaseClient
        .from('chat_messages')
        .select('*')
        .eq('channel', 'battle')
        .eq('player_public_id', safePlayerId)
        .order('created_at', { ascending: false })
        .limit(BATTLE_HISTORY_SEARCH_LIMIT);

    battleHistorySearchState.loading = false;

    if (error) {
        console.error('❌ Ошибка поиска history battle:', error);
        battleHistorySearchState.error = 'Ошибка поиска истории battle.';
        battleHistorySearchState.messages = [];
        renderBattleHistorySearchUi();
        return;
    }

    const messages = (data || []).slice().reverse();
    await hydrateStaffRolesForMessages(messages);

    battleHistorySearchState.messages = messages;
    battleHistorySearchState.error = '';
    const latest = messages[messages.length - 1] || data?.[0] || null;
    if (latest) {
        const nick = String(latest.player_nickname || '').trim();
        battleHistorySearchState.playerLabel = nick ? `${nick} [${safePlayerId}]` : `ID ${safePlayerId}`;
    } else {
        battleHistorySearchState.playerLabel = `ID ${safePlayerId}`;
    }
    renderBattleHistorySearchUi();
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

            renderChatTabs();
            saveChatUiState();
            await loadChatHistory(currentChat);
            renderLobbyMessages();
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

            renderChatTabs();
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

            renderChatTabs();
        });
    });

    saveChatUiState();
    renderBattleHistorySearchUi();
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
    renderBattleHistorySearchUi();
}

function updateLobbyChatComposerVisibility() {
    const chatInputAreaEl = document.getElementById("chat-input-area");
    const chatInputEl = document.getElementById("chat-input");
    const chatSendEl = document.getElementById("chat-send");
    if (!chatInputAreaEl) return;

    const shouldHide = (currentChat === "battle" && !canWriteBattleAnnouncementChat()) || (currentChat === "clan" && !canUseClanChat());
    chatInputAreaEl.classList.toggle("chat-composer-hidden", shouldHide);

    if (shouldHide) {
        if (chatInputEl) {
            chatInputEl.value = "";
            chatInputEl.blur();
        }
        if (chatSendEl) {
            chatSendEl.blur();
        }
    }
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

    const activeRoomId = String(getBattleChatRoomId() || '').trim();
    const visibleMessages = chatCache.battle.filter(msg => {
        const incomingRoomId = String(msg?.room_id || '').trim();
        if (!activeRoomId) return true;
        return incomingRoomId === activeRoomId || incomingRoomId === '__all__';
    });

    const distanceFromBottom = battleLog.scrollHeight - battleLog.scrollTop - battleLog.clientHeight;
    const shouldStickToBottom = distanceFromBottom <= 28;
    const prevScrollTop = battleLog.scrollTop;

    battleLog.innerHTML = visibleMessages.map(buildBattleChatMessageHtml).join("");

    if (shouldStickToBottom) {
        battleLog.scrollTop = battleLog.scrollHeight;
    } else {
        battleLog.scrollTop = prevScrollTop;
    }
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
    const isGlobalStaffAnnouncement = String(msg?.room_id || '').trim() === '__all__' && canWriteBattleAnnouncementChatByRole(msg?.staff_role);
    const hideIdentity = !isGlobalStaffAnnouncement && shouldHideStaffIdentityInObserve(publicId, msg.staff_role);

    const showRoleBadge = isGlobalStaffAnnouncement || hideIdentity;
    const roleBadge = showRoleBadge ? getForcedSceneRoleBadgeHtml(msg.staff_role) : '';
    const roleClass = showRoleBadge ? getChatRoleCssClassByRole(msg.staff_role) : '';
    const lineClass = roleClass ? ` chat-staff ${roleClass}` : '';

    const item = document.createElement('div');
    item.className = `kill-feed-item chat-announcement${lineClass}`;
    const idHtml = publicId ? ` <span class="chat-id">[${safePublicId}]</span>` : '';

    item.innerHTML = (isGlobalStaffAnnouncement || hideIdentity)
        ? `${roleBadge}<span class="chat-text">${text}</span>`
        : `${roleBadge}<span class="chat-nick-static">${author}</span>${idHtml}<span class="chat-sep">:</span> <span class="chat-text">${text}</span>`;

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
    if (gameState !== "BATTLE" && gameState !== "OBSERVE") return;

    const activeSceneRoomId = String(getSceneChatRoomId() || "").trim();
    const incomingSceneRoomId = String(msg.room_id || "").trim();
    if (incomingSceneRoomId !== "__all__" && incomingSceneRoomId !== activeSceneRoomId) return;

    const feed = document.getElementById('kill-feed');
    if (!feed) return;

    const author = escapeChatHtml(msg.player_nickname || msg.nickname || "Unknown");
    const text = escapeChatHtml(msg.message || "");
    const publicId = msg.player_public_id ? String(msg.player_public_id) : "";
    const safePublicId = escapeChatHtml(publicId || "0");
    const isGlobalStaffAnnouncement = incomingSceneRoomId === '__all__' && canWriteBattleAnnouncementChatByRole(msg?.staff_role);
    const hideIdentity = !isGlobalStaffAnnouncement && shouldHideStaffIdentityInObserve(publicId, msg.staff_role);

    const showRoleBadge = isGlobalStaffAnnouncement || hideIdentity;
    const roleBadge = showRoleBadge ? getForcedSceneRoleBadgeHtml(msg.staff_role) : '';
    const roleClass = showRoleBadge ? getChatRoleCssClassByRole(msg.staff_role) : '';
    const lineClass = roleClass ? ` chat-staff ${roleClass}` : "";

    const item = document.createElement('div');
    item.className = isGlobalStaffAnnouncement
        ? `kill-feed-item chat-announcement${lineClass}`
        : `kill-feed-item chat-announcement scene-chat${lineClass}`;

    if (hideIdentity || isGlobalStaffAnnouncement) {
        item.innerHTML = `${roleBadge}<span class="chat-text">${text}</span>`;
    } else {
        const idHtml = publicId ? ` <span class="chat-id">(${safePublicId})</span>` : '';
        item.innerHTML = `${roleBadge}<span class="chat-nick-static">${author}</span>${idHtml}<span class="chat-sep">:</span> <span class="chat-text">${text}</span>`;
    }

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
        .order("created_at", { ascending: false })
        .limit(CHAT_MESSAGE_LIMIT);

    query = query.eq("channel", scope.channel);

    if (scope.channel === "clan") {
        if (!scope.roomId) {
            const list = getChatCacheList(scope);
            list.length = 0;
            if (currentChat === scopeName) renderLobbyMessages();
            return;
        }
        query = query.eq('room_id', scope.roomId);
    }

    if (scope.channel === "battle") {
        const battleRoomId = String(getBattleChatRoomId() || '').trim();
        if (battleRoomId) {
            query = query.or(`room_id.eq.${battleRoomId},room_id.eq.__all__`);
        } else {
            query = query.eq('room_id', '__all__');
        }
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


async function refreshBattleFeedFromDb() {
    if (!window.supabaseClient) return;
    const roomId = String(getBattleChatRoomId() || '').trim();
    if (!roomId) return;

    const { data, error } = await window.supabaseClient
        .from("chat_messages")
        .select("*")
        .eq("channel", "battle")
        .or(`room_id.eq.${roomId},room_id.eq.__all__`)
        .order("created_at", { ascending: true })
        .limit(CHAT_MESSAGE_LIMIT);

    if (error) {
        console.error('❌ Ошибка обновления battle потока:', error);
        return;
    }

    await hydrateStaffRolesForMessages(data || []);

    const scope = { key: 'battle', channel: 'battle' };
    const roomList = [];
    (data || []).forEach(msg => {
        if (!roomList.some(item => String(item?.id || '') === String(msg?.id || ''))) {
            roomList.push(msg);
        }
    });
    roomList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const otherRooms = chatCache.battle.filter(msg => String(msg?.room_id || '') !== roomId);
    chatCache.battle.length = 0;
    otherRooms.forEach(msg => chatCache.battle.push(msg));
    roomList.forEach(msg => pushChatToCache(scope, msg));

    renderBattleMessages();
    if (currentChat === 'battle') renderLobbyMessages();
    renderChatTabs();
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
        const activeBattleRoomId = String(getBattleChatRoomId() || '').trim();
        const incomingRoomId = String(msg.room_id || '').trim();
        if (activeBattleRoomId && incomingRoomId !== activeBattleRoomId && incomingRoomId !== '__all__') {
            return;
        }
        const scope = { key: 'battle', channel: 'battle' };
        if (!pushChatToCache(scope, msg)) {
            return;
        }
        if (currentChat !== "battle") incrementUnread("battle");
        renderBattleMessages();
        if (currentChat === 'battle') renderLobbyMessages();
        renderChatTabs();
        return;
    }

    if (msg.channel === "scene") {
        const activeSceneRoomId = String(getSceneChatRoomId() || '').trim();
        const incomingSceneRoomId = String(msg.room_id || '').trim();
        if (incomingSceneRoomId !== '__all__' && activeSceneRoomId && incomingSceneRoomId !== activeSceneRoomId) return;

        if (!wasLocalHandledChatMessage(msg.id)) {
            showSceneMapMessageInActiveScene(msg);
        }

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
            addSystemLobbyChatMessage("⚠ У вас нет прав писать в Battle чат.");
            updateLobbyChatComposerVisibility?.();
            return false;
        }
    }

    const payload = {
        channel: scope.channel,
        room_id: scope.channel === 'clan'
            ? getClanChatRoomId()
            : (scope.channel === 'battle'
                ? getBattleChatRoomId()
                : null),
        player_id: getValidChatPlayerId(),
        player_public_id: ownPublicId,
        recipient_public_id: scope.channel === "pm" ? String(scope.peerId || "") : null,
        player_nickname: getOwnChatLabel(),
        message: text
    };
    if (scope.channel === 'battle' && canWriteBattleAnnouncementChat() && !battleObserverMode) {
        payload.room_id = '__all__';
    }

    if (scope.channel === 'battle' && !payload.room_id) {
        addSystemBattleChatMessage("⚠ Не найден battle room_id для отправки сообщения.");
        return false;
    }


    console.log('📤 SEND MESSAGE:', {
        scopeName,
        channel: payload.channel,
        room_id: payload.room_id,
        player_id: payload.player_id,
        player_public_id: payload.player_public_id,
        nickname: payload.player_nickname,
        currentChat,
        gameState,
        battleRoomId: getBattleChatRoomId ? getBattleChatRoomId() : null,
        sceneRoomId: getSceneChatRoomId ? getSceneChatRoomId() : null,
        observerMode: !!battleObserverMode,
        text
    });

    if (scope.channel === 'clan' && !payload.room_id) {
        addSystemLobbyChatMessage('⚠ Не найден room_id клана для отправки сообщения.');
        return false;
    }

    if (scope.channel === "pm" && !payload.recipient_public_id) {
        addSystemLobbyChatMessage("⚠ Не выбран получатель для личного сообщения.");
        return false;
    }

    const payloadsToInsert = [payload];

    if (scope.channel === "battle" && canWriteBattleAnnouncementChat() && !battleObserverMode) {
        payloadsToInsert.push({
            channel: "scene",
            room_id: "__all__",
            player_id: payload.player_id,
            player_public_id: payload.player_public_id,
            recipient_public_id: null,
            player_nickname: payload.player_nickname,
            staff_role: getOwnStaffRole(),
            message: text
        });
    }

    const { data, error } = await window.supabaseClient
        .from("chat_messages")
        .insert(payloadsToInsert)
        .select('*');

    if (error) {
        console.error("❌ Ошибка отправки сообщения:", error);
        if (scope.channel === "battle") addSystemBattleChatMessage("Ошибка отправки сообщения");
        else addSystemLobbyChatMessage("Ошибка отправки сообщения");
        return false;
    }

    const insertedRows = Array.isArray(data) ? data : [];
    const insertedBattle = insertedRows.find(row => row?.channel === "battle");
    const insertedScene = insertedRows.find(row => row?.channel === "scene");

    if (insertedBattle) {
        markLocalHandledChatMessage(insertedBattle.id);
    }
    if (insertedScene) {
        markLocalHandledChatMessage(insertedScene.id);
    }

    markChatMessageSentNow();

    if (scope.channel === "battle") {
        const battleMessage = insertedBattle || {
            id: `local-${Date.now()}`,
            channel: "battle",
            room_id: payload.room_id,
            created_at: new Date().toISOString(),
            player_public_id: ownPublicId,
            player_nickname: getOwnChatLabel(),
            staff_role: getOwnStaffRole(),
            message: text
        };
        pushChatToCache(scope, battleMessage);
        if (currentChat === "battle") {
            renderLobbyMessages();
        }
        renderBattleMessages?.();
    }

    if (insertedScene) {
        showSceneMapMessageInActiveScene(insertedScene);
    }

    if (scope.channel === "battle") {
        try {
            await loadChatHistory("battle");
            if (currentChat === "battle") {
                renderLobbyMessages();
            }
            renderBattleMessages?.();
        } catch (e) {
            console.warn("⚠ Не удалось сразу обновить battle-чат:", e);
        }
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
    
try {
    renderBattleMessages && renderBattleMessages();
    renderLobbyMessages && renderLobbyMessages();
    renderChatTabs && renderChatTabs();
} catch(e){}

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

    if (gameState === "OBSERVE") {
        if (currentChat === "battle") clearUnreadForCurrentScope();
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


    return roomId;
}


// ================= CREATE ROOM BUTTON =================

const confirmCreateBtn = document.getElementById("confirm-create");

if (false && confirmCreateBtn) {

    confirmCreateBtn.addEventListener("click", () => {

        if (!selectedMap) {
            alert("Выберите карту!");
            return;
        }

        const roomTitleInput = document.getElementById('room-title');
        const roomTitle = roomTitleInput?.value?.trim() || `${selectedMap.name} Room`;
        const roomId = createRoom(selectedMap.name, null, roomTitle);


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

if (false && joinButton) {

    joinButton.onclick = () => {

        if (!selectedMap) {
            alert("Сначала выберите карту");
            return;
        }


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

    if(raw.includes('sun') || raw.includes('солн')) return 'sun';
    if(raw.includes('mercury') || raw.includes('меркур')) return 'mercury';
    if(raw.includes('venus') || raw.includes('венер')) return 'venus';
    if(raw.includes('earth') || raw.includes('земл')) return 'earth';
    if(raw.includes('mars') || raw.includes('марс')) return 'mars';
    if(raw.includes('jupiter') || raw.includes('юпит')) return 'jupiter';
    if(raw.includes('saturn') || raw.includes('сатур')) return 'saturn';
    if(raw.includes('uranus') || raw.includes('уран')) return 'uranus';
    if(raw.includes('neptune') || raw.includes('нептун')) return 'neptune';

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
  // FIX: reset orbit leftovers
  try {
    if (window.selectedPlanet) {
      if (window.selectedPlanet.mesh && window.selectedPlanet.mesh.parent) {
        window.selectedPlanet.mesh.parent.remove(window.selectedPlanet.mesh);
      }
      if (window.selectedPlanet.resourceLabel && window.selectedPlanet.resourceLabel.parent) {
        window.selectedPlanet.resourceLabel.parent.remove(window.selectedPlanet.resourceLabel);
      }
    }
    window.selectedPlanet = null;
  } catch(e){}

    const mapKey = normalizeBattleMapName(mapName);
    selectedLobbyMap = { ...(selectedLobbyMap || {}), real: mapKey, name: mapKey };

    clearBattleScene();
    battleStats.playerKills = 0;
    battleStats.playerDeaths = 0;

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
    battleMapPlanet.userData.solidRadius = config.size + 10;
    battleMapPlanet.userData.atmosphereRadius = config.size + 42;
    battleMapPlanet.userData.nearSurfaceRadius = config.size + 14;
    battleMapPlanet.userData.crashRadius = config.size + 10;
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
var liveBattlePresencePushTimer = null;
var liveBattlePresenceChannel = null;
var liveBattlePresenceChannelName = '';

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
    if(typeof liveBattlePresencePushTimer !== 'undefined' && liveBattlePresencePushTimer){
        clearInterval(liveBattlePresencePushTimer);
        liveBattlePresencePushTimer = null;
    }
    if(liveBattlePresenceChannel && window.supabaseClient){
        try{ window.supabaseClient.removeChannel(liveBattlePresenceChannel); }catch(_){}
    }
    liveBattlePresenceChannel = null;
    liveBattlePresenceChannelName = '';
    clearRemoteBattleShips();
}

function createRemotePilotLabel(name, team = 'blue'){
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(5,10,18,0.78)';
    ctx.fillRect(0, 18, canvas.width, 50);
    ctx.strokeStyle = getRemoteShipLabelColor(team);
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 18, canvas.width - 6, 50);
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3fbff';
    ctx.fillText(String(name || 'Pilot'), canvas.width / 2, 43);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(9.2, 1.7, 1);
    sprite.position.set(0, 3.4, 0);
    sprite.renderOrder = 1000;
    sprite.center.set(0.5, 0.0);
    return sprite;
}

function createRemoteBattleShipMesh(name, slotIndex, team = 'blue'){
    const shipGroup = new THREE.Group();
    shipGroup.rotation.order = 'YXZ';

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0, 1.2, 7, 10),
        new THREE.MeshStandardMaterial({ color: getBattleShipColorHex(team), metalness: 0.45, roughness: 0.32 })
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

    const labelSprite = createRemotePilotLabel(name, team);
    shipGroup.add(labelSprite);

    const side = slotIndex % 2 === 0 ? 1 : -1;
    const rank = Math.floor(slotIndex / 2);
    shipGroup.position.set(side * (70 + rank * 28), 8 + ((slotIndex % 3) - 1) * 6, -40 - rank * 26);
    shipGroup.lookAt(new THREE.Vector3(0, 0, 0));

    const targetPosition = shipGroup.position.clone();
    const targetQuaternion = shipGroup.quaternion.clone();

    shipGroup.userData = {
        remote: true,
        pilotName: String(name || 'Pilot'),
        orbitSeed: Math.random() * Math.PI * 2,
        slotIndex,
        hp: 100,
        maxHp: 100,
        team
    };
    scene.add(shipGroup);
    return {
        mesh: shipGroup,
        labelSprite,
        targetPosition,
        targetQuaternion,
        lastSeenAt: Date.now(),
        nickname: String(name || 'Pilot'),
        level: 1,
        ping: 0,
        playerId: '',
        team
    };
}

function getLiveBattleChannelName(){
    const roomId = String(currentRoom?.id || currentRoom?.roomId || '').trim();
    if(!roomId || roomId.startsWith('observe_') || roomId.startsWith('tournament_')) return '';
    return `cosmic-battle-room:${roomId}`;
}

function upsertRemoteBattlePresence(payload = {}){
    const entryId = String(payload.playerId || payload.player_id || payload.id || '').trim();
    const myId = String(authState?.playerId || player?.id || '').trim();
    if(!entryId || (myId && entryId === myId)) return;

    const nickname = String(payload.nickname || payload.name || 'Pilot').trim() || 'Pilot';
    const level = Math.max(1, Number(payload.level || 1) || 1);
    const ping = Math.max(0, Number(payload.ping || 0) || 0);
    const team = String(payload.team || getBattleRoomPlayerTeam(entryId)).trim().toLowerCase() === 'red' ? 'red' : 'blue';

    let entry = remoteBattleShips.get(entryId);
    if(!entry){
        entry = createRemoteBattleShipMesh(nickname, remoteBattleShips.size, team);
        remoteBattleShips.set(entryId, entry);
    }

    entry.playerId = entryId;
    entry.nickname = nickname;
    entry.level = level;
    entry.ping = ping;
    entry.team = team;
    entry.lastSeenAt = Date.now();

    if(entry.mesh?.userData){
        entry.mesh.userData.pilotName = nickname;
        entry.mesh.userData.team = team;
    }

    tryApplyRemoteShipTeamVisual(entry);

    const x = Number(payload.x);
    const y = Number(payload.y);
    const z = Number(payload.z);
    if(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)){
        entry.targetPosition.set(x, y, z);
    }

    const qx = Number(payload.qx);
    const qy = Number(payload.qy);
    const qz = Number(payload.qz);
    const qw = Number(payload.qw);
    if(Number.isFinite(qx) && Number.isFinite(qy) && Number.isFinite(qz) && Number.isFinite(qw)){
        entry.targetQuaternion.set(qx, qy, qz, qw);
    }

    updateBattleScoreboard?.();
}

function ensureLiveBattlePresenceChannel(){
    if(!window.supabaseClient) return;
    const channelName = getLiveBattleChannelName();
    if(!channelName) return;
    if(liveBattlePresenceChannel && liveBattlePresenceChannelName === channelName) return;

    if(liveBattlePresenceChannel){
        try{ window.supabaseClient.removeChannel(liveBattlePresenceChannel); }catch(_){}
        liveBattlePresenceChannel = null;
    }

    liveBattlePresenceChannelName = channelName;
    liveBattlePresenceChannel = window.supabaseClient.channel(channelName, {
        config: { broadcast: { self: false, ack: false } }
    });

    liveBattlePresenceChannel
        .on('broadcast', { event: 'pilot-state' }, ({ payload }) => {
            upsertRemoteBattlePresence(payload || {});
        })
        .subscribe();
}

async function broadcastSelfBattleState(){
    if(gameState !== 'BATTLE' || !playerShip || !liveBattlePresenceChannel) return;
    const playerId = String(authState?.playerId || player?.id || '').trim();
    if(!playerId) return;

    try{
        const payload = {
            type: 'broadcast',
            event: 'pilot-state',
            payload: {
                playerId,
                nickname: player?.nickname || 'Commander',
                level: Number(player?.level || 1) || 1,
                team: getBattleRoomPlayerTeam(playerId),
                ping: Number(getBattlePingValue() || 0),
                x: Number(playerShip.position.x || 0),
                y: Number(playerShip.position.y || 0),
                z: Number(playerShip.position.z || 0),
                qx: Number(playerShip.quaternion.x || 0),
                qy: Number(playerShip.quaternion.y || 0),
                qz: Number(playerShip.quaternion.z || 0),
                qw: Number(playerShip.quaternion.w || 1)
            }
        };
        if(typeof liveBattlePresenceChannel.httpSend === 'function'){
            await liveBattlePresenceChannel.httpSend(payload);
        }else{
            await liveBattlePresenceChannel.send(payload);
        }
    }catch(_){}
}

function getObservedRoomId(targetMap = ''){
    const directRoomId = sanitizeOnlineRoomId(selectedLobbyMap?.id || selectedLobbyMap?.roomId || currentRoom?.id || currentRoom?.roomId || null);
    if(directRoomId) return directRoomId;

    const normalizedMap = normalizeBattleMapName(targetMap || selectedLobbyMap?.real || currentRoom?.map || 'earth');
    const publicRoom = (Array.isArray(supabaseBattleRoomsCache) ? supabaseBattleRoomsCache : []).find((room) => {
        const roomMap = normalizeBattleMapName(room?.real || room?.map || room?.rawRoom?.map_name || '');
        return roomMap === normalizedMap && isPublicBattleRoom(room?.rawRoom || room);
    });

    return sanitizeOnlineRoomId(publicRoom?.id || publicRoom?.roomId || null);
}

function buildObserveRoomState(targetMap = ''){
    const normalizedMap = normalizeBattleMapName(targetMap || selectedLobbyMap?.real || currentRoom?.map || 'earth');
    const roomId = getObservedRoomId(normalizedMap);
    return {
        id: roomId || null,
        roomId: roomId || null,
        map: normalizedMap,
        real: normalizedMap,
        observer: true,
        state: 'observe',
        currentPlayers: [],
        players: [],
        title: selectedLobbyMap?.title || currentRoom?.title || normalizedMap
    };
}

async function fetchCurrentRoomLivePlayers(){
    if(!window.supabaseClient || !currentRoom?.id) return [];
    const roomId = String(currentRoom.id || currentRoom.roomId || '').trim();
    if(!roomId || roomId.startsWith('observe_') || roomId.startsWith('tournament_')) return [];

    const { data, error } = await window.supabaseClient
        .from('room_players')
        .select('player_id,nickname,joined_at,team,level,ping,position,rotation,updated_at')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

    if(error){
                return [];
    }

    return (data || [])
        .filter(item => isFreshRoomPlayerRow(item))
        .map((item, index) => ({
        player_id: item.player_id ? String(item.player_id) : `guest_${index}`,
        nickname: item.nickname || `Pilot ${index + 1}`,
        joined_at: item.joined_at || null,
        team: item.team || getBattleRoomPlayerTeam(item.player_id ? String(item.player_id) : `guest_${index}`),
        level: Number(item.level || 1) || 1,
        ping: Number(item.ping || 0) || 0,
        position: item.position || null,
        rotation: item.rotation || null,
        updated_at: item.updated_at || item.joined_at || null
    }));
}

async function syncLiveBattlePlayers(){
    if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;

    if(gameState === 'BATTLE' && playerShip){
        ensureSelfRoomPlayerState();
    }

    const livePlayers = await fetchCurrentRoomLivePlayers();
    const myId = getSelfBattlePlayerId();

    const activeIds = new Set();
    const visiblePlayers = [];

    livePlayers.forEach(entry => {
        const entryId = entry?.player_id ? String(entry.player_id) : '';
        const isMe = !!(entryId && myId && entryId === myId);
        const team = String(entry?.team || getBattleRoomPlayerTeam(entryId)).trim().toLowerCase() === 'red' ? 'red' : 'blue';
        const displayName = String(entry?.nickname || 'Pilot').trim() || 'Pilot';

        if(entryId) activeIds.add(entryId);

        if(isMe){
            return;
        }
        if(!entryId) return;

        let remoteState = remoteBattleShips.get(entryId);
        if(!remoteState){
            remoteState = createRemoteBattleShipMesh(displayName, remoteBattleShips.size, team);
            remoteBattleShips.set(entryId, remoteState);
        }

        remoteState.nickname = displayName;
        remoteState.level = Number(entry?.level || remoteState.level || 1) || 1;
        remoteState.ping = Number(entry?.ping || remoteState.ping || 0) || 0;
        remoteState.team = team;
        remoteState.lastSeenAt = Date.now();

        if(remoteState.mesh?.userData){
            remoteState.mesh.userData.team = team;
            remoteState.mesh.userData.pilotName = displayName;
        }
        tryApplyRemoteShipTeamVisual(remoteState);

        const pos = entry?.position || {};
        const x = Number(pos?.x);
        const y = Number(pos?.y);
        const z = Number(pos?.z);
        if(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)){
            remoteState.targetPosition.set(x, y, z);
            if(remoteState.mesh && !remoteState.mesh.userData.hasInitialSync){
                remoteState.mesh.position.copy(remoteState.targetPosition);
                remoteState.mesh.userData.hasInitialSync = true;
            }
        }

        const rot = entry?.rotation || {};
        const qx = Number(rot?.x);
        const qy = Number(rot?.y);
        const qz = Number(rot?.z);
        const qw = Number(rot?.w);
        if(Number.isFinite(qx) && Number.isFinite(qy) && Number.isFinite(qz) && Number.isFinite(qw)){
            remoteState.targetQuaternion.set(qx, qy, qz, qw);
            if(remoteState.mesh && !remoteState.mesh.userData.hasInitialQuatSync){
                remoteState.mesh.quaternion.copy(remoteState.targetQuaternion);
                remoteState.mesh.userData.hasInitialQuatSync = true;
            }
        }

        visiblePlayers.push({
            nickname: displayName,
            clan: team === 'red' ? 'RED' : 'BLUE',
            level: Number(entry?.level || remoteState.level || 1) || 1,
            deaths: Number(remoteState?.deaths || 0) || 0,
            kills: Number(remoteState?.kills || 0) || 0,
            id: entryId,
            ping: Number(entry?.ping || remoteState?.ping || 0) || 0,
            team
        });
    });

    const expireBefore = Date.now() - 3500;
    Array.from(remoteBattleShips.keys()).forEach(entryId => {
        const item = remoteBattleShips.get(entryId);
        const stale = !!item && Number(item.lastSeenAt || 0) < expireBefore;
        if(!activeIds.has(String(entryId)) || stale){
            removeRemoteBattleShipById(entryId);
        }
    });

    const selfRow = gameState === 'OBSERVE'
        ? null
        : {
            nickname: player?.nickname || 'Commander',
            clan: getBattleRoomPlayerTeam(myId) === 'red' ? 'RED' : 'BLUE',
            level: Number(player?.level || 1) || 1,
            kills: Number(battleStats.playerKills || 0) || 0,
            deaths: Number(battleStats.playerDeaths || 0) || 0,
            id: myId,
            ping: Number(getBattlePingValue() || 0) || 0,
            team: getBattleRoomPlayerTeam(myId)
        };

    if(currentRoom){
        const nextPlayers = [];
        if(selfRow) nextPlayers.push(selfRow);
        nextPlayers.push(...visiblePlayers);
        currentRoom.currentPlayers = nextPlayers;
        currentRoom.players = [...nextPlayers];
    }

    updateBattleScoreboard();
}


function removeRemoteBattleShipById(entryId){
    const key = String(entryId || '').trim();
    if(!key || !remoteBattleShips.has(key)) return;
    const old = remoteBattleShips.get(key);
    if(old?.mesh){
        scene.remove(old.mesh);
        old.mesh.traverse?.((child) => {
            if(child?.geometry) child.geometry.dispose?.();
            if(child?.material){
                if(Array.isArray(child.material)) child.material.forEach(mat => mat?.dispose?.());
                else child.material.dispose?.();
            }
        });
    }
    remoteBattleShips.delete(key);
}

function startLiveBattleSync(){
    stopLiveBattleSync();
    ensureLiveBattlePresenceChannel();
    syncLiveBattlePlayers();
    broadcastSelfBattleState();
    liveBattleSyncTimer = setInterval(syncLiveBattlePlayers, 250);
    liveBattlePresencePushTimer = setInterval(() => {
        broadcastSelfBattleState();
    }, 90);
}

function animateRemoteBattleShips(){
    if(!remoteBattleShips.size) return;
    remoteBattleShips.forEach((entry) => {
        const mesh = entry?.mesh;
        if(!mesh) return;

        if(entry.targetPosition){
            mesh.position.lerp(entry.targetPosition, 0.16);
        }
        if(entry.targetQuaternion){
            mesh.quaternion.slerp(entry.targetQuaternion, 0.18);
        }

        if(entry.labelSprite){
            entry.labelSprite.position.set(0, 3.4, 0);
        }
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

    const myId = getSelfBattlePlayerId();
    const selfTeam = getBattleRoomPlayerTeam(myId);
    const selfRow = (gameState === 'OBSERVE') ? null : {
        nickname: player?.nickname || 'Commander',
        clan: '',
        level: Number(player?.level || 1) || 1,
        kills: Number(battleStats.playerKills || 0) || 0,
        deaths: Number(battleStats.playerDeaths || 0) || 0,
        id: myId,
        ping: Number(getBattlePingValue() || 0) || 0,
        team: selfTeam
    };

    const roomPlayers = Array.isArray(currentRoom?.currentPlayers) && currentRoom.currentPlayers.length
        ? currentRoom.currentPlayers
        : (Array.isArray(currentRoom?.players) ? currentRoom.players : []);

    const rows = [];
    if(selfRow) rows.push(selfRow);

    roomPlayers.forEach((entry) => {
        const entryId = String(entry?.public_id || entry?.player_public_id || entry?.player_id || entry?.id || '').trim();
        const safeName = String(entry?.nickname || entry?.name || entry || '').trim();
        const isYou = (!!entryId && !!myId && entryId === myId) || safeName === (player?.nickname || 'Commander');
        if(isYou) return;

        const team = String(entry?.team || getBattleRoomPlayerTeam(entryId)).trim().toLowerCase() === 'red' ? 'red' : 'blue';
        const remoteState = entryId ? remoteBattleShips.get(entryId) : null;
        rows.push({
            nickname: remoteState?.nickname || safeName || 'Pilot',
            clan: '',
            level: Number(entry?.level || remoteState?.level || 1) || 1,
            kills: Number(entry?.kills || 0) || 0,
            deaths: Number(entry?.deaths || 0) || 0,
            id: entryId,
            ping: Number(entry?.ping || remoteState?.ping || 0) || 0,
            team
        });
    });

    if(gameState === 'OBSERVE' && !rows.length){
      body.innerHTML = '<div class="battle-scoreboard-row enemy"><span></span><span>На карте нет активных игроков</span><span>0</span><span>0</span><span>—</span><span>—</span><span>—</span></div>';
      return;
    }

    body.innerHTML = rows.map((entry) => {
      const safeName = String(entry?.nickname || 'Pilot');
      const entryId = String(entry?.id || '').trim();
      const isYou = !!(myId && entryId && myId === entryId) || safeName === (player?.nickname || 'Commander');
      const team = String(entry?.team || (isYou ? selfTeam : getBattleRoomPlayerTeam(entryId))).trim().toLowerCase() === 'red' ? 'red' : 'blue';
      const kills = Math.max(0, Number(isYou ? battleStats.playerKills : entry?.kills) || 0);
      const deaths = Math.max(0, Number(isYou ? battleStats.playerDeaths : entry?.deaths) || 0);
      const levelValue = Math.max(1, Number(isYou ? player?.level : entry?.level) || 1);
      const publicId = isYou ? (myId || '—') : (entryId || '—');
      const pingValueRaw = Number(isYou ? getBattlePingValue() : entry?.ping || 0);
      const pingValue = Number.isFinite(pingValueRaw) && pingValueRaw > 0 ? Math.round(pingValueRaw) : '—';
      const nickColor = team === 'red' ? '#ff8f8f' : '#8fd8ff';
      return `
      <div class="battle-scoreboard-row ${team === 'red' ? 'enemy' : 'player'}">
        <span></span>
        <span title="${safeName}" style="color:${nickColor};font-weight:700;">${safeName}</span>
        <span>${kills}</span>
        <span>${deaths}</span>
        <span class="battle-level-cell"><span class="battle-level-icon">★</span>${levelValue}</span>
        <span>${publicId}</span>
        <span>${pingValue}</span>
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

    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');

    const shipGroup = createHangarShipMesh(currentBattleShipStats.ship || getSelectedShipItem() || { art:'classic' });
    shipGroup.rotation.order = 'YXZ';
    shipGroup.scale.multiplyScalar(0.52);

    const selfTeam = getBattleRoomPlayerTeam(getSelfBattlePlayerId());
    const spawn = selfTeam === 'red' ? spawnPointB.clone() : spawnPointA.clone();
    const lookTarget = selfTeam === 'red' ? spawnPointA.clone() : spawnPointB.clone();
    const hullColor = getBattleShipColorHex(selfTeam);

    shipGroup.traverse?.((child) => {
        if(child?.isMesh && child.material){
            if(child.material.color){
                try{ child.material.color.lerp(new THREE.Color(hullColor), 0.35); }catch(_){ }
            }
            if(child.material.emissive && child.material.emissive.isColor){
                try{ child.material.emissive = new THREE.Color(hullColor).multiplyScalar(0.08); }catch(_){ }
            }
        }
    });

    playerShip = shipGroup;
    playerShip.position.copy(spawn);
    playerShip.visible = true;
    playerShip.lookAt(lookTarget);
    playerShip.userData = {
        hp: currentBattleShipStats.hp,
        weapon: currentBattleShipStats.ship?.weapon || 'laser',
        speed: currentBattleShipStats.maxSpeed,
        handling: currentBattleShipStats.handlingLabel,
        fireCooldown: currentBattleShipStats.fireCooldown,
        modules: currentBattleShipStats.installedModules
    };

    playerControl.yaw = playerShip.rotation.y;
    playerControl.pitch = 0;
    playerControl.roll = 0;

    playerMaxHp = currentBattleShipStats.hp;
    playerHp = playerMaxHp;
    battleWeapon.damage = currentBattleShipStats.weaponDamage;
    battleWeapon.clipSize = currentBattleShipStats.clipSize;
    battleWeapon.ammoInClip = battleWeapon.clipSize;
    battleWeapon.reloadTime = currentBattleShipStats.reloadTime;
    battleWeapon.isReloading = false;
    battleWeapon.reloadEndsAt = 0;

    scene.add(playerShip);
    camera.lookAt(playerShip.position);
    updateBattlePlayerHud();
}

// ================= KEY SYSTEM =================


document.addEventListener("keydown", (e) => {

    if(isBattleTyping()) return;
    if (e.code === "KeyW") keys.w = true;
    if (e.code === "KeyA") keys.a = true;
    if (e.code === "KeyS") keys.s = true;
    if (e.code === "KeyD") keys.d = true;
    if (e.code === "Space") keys.space = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.shift = true;
    if (e.code === "KeyR") startBattleReload();

});

document.addEventListener("keyup", (e) => {

    if (e.code === "KeyW") keys.w = false;
    if (e.code === "KeyA") keys.a = false;
    if (e.code === "KeyS") keys.s = false;
    if (e.code === "KeyD") keys.d = false;
    if (e.code === "Space") keys.space = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.shift = false;

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
            window.currentRoomId = currentRoom.id || null;
            switchState('BATTLE');
        });
    }
});


function closeBattlePauseMenu(){
    const menu = document.getElementById('battle-pause-menu');
    if(menu) menu.classList.add('hidden');
}

function toggleBattlePauseMenu(forceOpen=null){
    const menu = document.getElementById('battle-pause-menu');
    if(!menu || (gameState !== 'BATTLE' && gameState !== 'OBSERVE')) return;
    const shouldOpen = forceOpen === null ? menu.classList.contains('hidden') : !!forceOpen;
    menu.classList.toggle('hidden', !shouldOpen);
    if(shouldOpen){
        if(document.pointerLockElement) document.exitPointerLock();
    }else{
        const canvas = document.querySelector('canvas');
        if(canvas && gameState === 'BATTLE') setTimeout(() => safeRequestPointerLock(canvas), 40);
    }
}

function initBattleUI(){
    const battleExitBtn = document.getElementById('battle-exit-btn');
    const battleLeaveBtn = document.getElementById('battle-leave-map-btn');
    const battleSaveBtn = document.getElementById('battle-save-settings-btn');
    const battleOpenSettingsBtn = document.getElementById('battle-open-settings-btn');
    const scoreboard = document.getElementById('battle-scoreboard');

    const leaveMap = async () => {
        closeBattlePauseMenu();
        await cleanupCurrentBattleRoom();
        switchState('LOBBY');
        if(typeof renderRoomsInLobby === 'function'){
            await renderRoomsInLobby(true);
        }
    };

    [battleExitBtn, battleLeaveBtn].forEach(btn => {
        if(btn && !btn.dataset.bound){
            btn.dataset.bound = '1';
            btn.addEventListener('click', leaveMap);
        }
    });

    if(battleSaveBtn && !battleSaveBtn.dataset.bound){
        battleSaveBtn.dataset.bound = '1';
        battleSaveBtn.addEventListener('click', () => closeBattlePauseMenu());
    }

    if(battleOpenSettingsBtn && !battleOpenSettingsBtn.dataset.bound){
        battleOpenSettingsBtn.dataset.bound = '1';
        battleOpenSettingsBtn.addEventListener('click', () => {
            const settingsWindow = document.getElementById('settings-window');
            if(settingsWindow) settingsWindow.classList.remove('hidden');
        });
    }

    if(!document.body.dataset.battleUiBound){
        document.body.dataset.battleUiBound = '1';
        document.addEventListener('keydown', (e) => {
            if(e.code === 'Tab'){
                e.preventDefault();
                if(scoreboard && (gameState === 'BATTLE' || gameState === 'OBSERVE')) scoreboard.classList.remove('hidden');
            }
            if(e.code === 'Escape' && (gameState === 'BATTLE' || gameState === 'OBSERVE') && !battleChatOpen){
                e.preventDefault();
                const settingsWindow = document.getElementById('settings-window');
                if(!settingsWindow) return;
                const shouldOpen = settingsWindow.classList.contains('hidden');
                settingsWindow.classList.toggle('hidden', !shouldOpen);
                updateNicknameSettingsState();
                if(shouldOpen){
                    if(scoreboard) scoreboard.classList.add('hidden');
                    resetBattleInputState();
                    if(document.pointerLockElement) document.exitPointerLock();
                }else if(!battleObserverMode){
                    const canvas = document.querySelector('canvas');
                    if(canvas) setTimeout(() => safeRequestPointerLock(canvas), 40);
                }
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


const hangarState = {
    shipIndex: 0,
    moduleIndex: 0,
    shipFilter: 'all',
    renderer: null,
    scene: null,
    camera: null,
    platform: null,
    platformRing: null,
    platformGlowDisc: null,
    shipPivot: null,
    modulePivot: null,
    frameId: 0,
    resizeBound: false,
    shipItem: null,
    moduleItem: null,
    shipYaw: 0,
    shipSpinVelocity: 0,
    isDraggingShip: false,
    dragLastX: 0,
    lastManualRotateAt: 0,
    transitionDirection: 0,
    transitionStartedAt: 0,
    stageBound: false,
    isShipLoading: false
};

function getAllHangarModules(){
    try{
        return Object.entries(SHOP_DATA?.modulesByType || {}).flatMap(([typeId, list]) =>
            (Array.isArray(list) ? list : []).map(item => ({ ...item, typeId }))
        );
    }catch(_){
        return [];
    }
}

function getModuleById(moduleId){
    const safeId = String(moduleId || '').trim();
    return getAllHangarModules().find(item => String(item?.id || '').trim() === safeId) || null;
}

function ensureModuleOwnershipDefaults(){
    try{
        if(!player || typeof player !== 'object') return;
        const allModules = getAllHangarModules();
        if(!Array.isArray(player.ownedModuleIds)) player.ownedModuleIds = [];
        if(!player.ownedModuleIds.length && allModules.length){
            player.ownedModuleIds = allModules.map(item => item.id);
        }
        player.ownedModuleIds = Array.from(new Set(
            player.ownedModuleIds.map(id => String(id || '').trim()).filter(Boolean)
        ));
        if(!player.activeModulesByShip || typeof player.activeModulesByShip !== 'object'){
            player.activeModulesByShip = {};
        }
    }catch(_){ }
}

function isOwnedModule(moduleId){
    ensureModuleOwnershipDefaults();
    const safeId = String(moduleId || '').trim();
    return !!safeId && Array.isArray(player?.ownedModuleIds) && player.ownedModuleIds.includes(safeId);
}

function getOwnedHangarModules(){
    ensureModuleOwnershipDefaults();
    const modules = getAllHangarModules();
    if(!modules.length) return [];
    const owned = modules.filter(item => isOwnedModule(item.id));
    return owned.length ? owned : modules;
}

function getInstalledModulesForShip(shipId){
    ensureModuleOwnershipDefaults();
    const safeShipId = String(shipId || player?.selectedShipId || '').trim();
    const raw = safeShipId ? player?.activeModulesByShip?.[safeShipId] : null;
    if(!raw || typeof raw !== 'object') return [];
    return Object.values(raw).map(moduleId => getModuleById(moduleId)).filter(Boolean);
}

function getInstalledModuleForType(shipId, typeId){
    const safeShipId = String(shipId || player?.selectedShipId || '').trim();
    const safeTypeId = String(typeId || '').trim();
    if(!safeShipId || !safeTypeId) return null;
    return getModuleById(player?.activeModulesByShip?.[safeShipId]?.[safeTypeId] || '');
}

function toggleShipModule(moduleId, shipId){
    ensureModuleOwnershipDefaults();
    const safeShipId = String(shipId || player?.selectedShipId || '').trim();
    const module = getModuleById(moduleId);
    if(!safeShipId || !module || !isOwnedModule(module.id)) return false;
    const typeId = String(module.typeId || module.classId || '').trim();
    if(!typeId) return false;
    if(!player.activeModulesByShip[safeShipId] || typeof player.activeModulesByShip[safeShipId] !== 'object'){
        player.activeModulesByShip[safeShipId] = {};
    }
    const current = String(player.activeModulesByShip[safeShipId][typeId] || '').trim();
    if(current === module.id){
        delete player.activeModulesByShip[safeShipId][typeId];
    }else{
        player.activeModulesByShip[safeShipId][typeId] = module.id;
    }
    try{ saveGame?.(); }catch(_){ }
    return true;
}

function getShipStatNumber(ship, label, fallback){
    const stats = Array.isArray(ship?.stats) ? ship.stats : [];
    const found = stats.find(([key]) => String(key || '').trim().toLowerCase() === String(label || '').trim().toLowerCase());
    if(!found) return Number(fallback || 0) || 0;
    const raw = String(found[1] || '').replace(',', '.');
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : (Number(fallback || 0) || 0);
}

function getSelectedShipItem(){
    const ships = getOwnedHangarShips();
    return ships.find(item => String(item?.id || '') === String(player?.selectedShipId || '')) || ships[0] || null;
}

function computeShipBattleStats(shipId){
    const safeShipId = String(shipId || player?.selectedShipId || '').trim();
    const ship = getShopShipById(safeShipId) || getSelectedShipItem();
    const installedModules = getInstalledModulesForShip(safeShipId);

    const stats = {
        ship,
        installedModules,
        speed: getShipStatNumber(ship, 'Скорость', 6.5),
        armor: getShipStatNumber(ship, 'Броня', 6.0),
        damage: getShipStatNumber(ship, 'Урон', 6.2),
        energy: getShipStatNumber(ship, 'Энергия', 6.5),
        maxSpeed: 4.2,
        forwardAcceleration: 0.14,
        backwardAcceleration: 0.07,
        strafeAcceleration: 0.045,
        damping: 0.985,
        hp: 100,
        weaponDamage: 12,
        clipSize: 50,
        reloadTime: 1800,
        laserVelocity: 3.2,
        laserScale: 1.0,
        fireCooldown: 95,
        weaponType: String(ship?.weapon || 'laser').toLowerCase(),
        projectileColor: '#ff3355',
        projectileCoreColor: '#ffffff',
        projectileLength: 2.2,
        projectileWidth: 0.14,
        projectileLife: 100,
        burstCount: 2,
        projectileOffset: 1.1,
        spread: 0.0,
        turnYaw: 0.0021,
        turnPitch: 0.0017,
        rollLimit: 0.72,
        handlingLabel: 'Стандарт',
        moduleSummary: []
    };

    const speedFactor = THREE.MathUtils.clamp(stats.speed / 7.0, 0.72, 1.62);
    const armorFactor = THREE.MathUtils.clamp(stats.armor / 6.0, 0.72, 1.85);
    const damageFactor = THREE.MathUtils.clamp(stats.damage / 6.0, 0.72, 1.9);
    const energyFactor = THREE.MathUtils.clamp(stats.energy / 7.0, 0.72, 2.0);

    stats.maxSpeed = 3.5 + speedFactor * 0.95;
    stats.forwardAcceleration = 0.095 + speedFactor * 0.034;
    stats.backwardAcceleration = 0.048 + speedFactor * 0.018;
    stats.strafeAcceleration = 0.028 + speedFactor * 0.013;
    stats.damping = 0.979 + Math.min(0.012, speedFactor * 0.0032);
    stats.hp = Math.round(78 + armorFactor * 21);
    stats.weaponDamage = Math.round(7 + damageFactor * 1.7);
    stats.clipSize = Math.round(32 + energyFactor * 4.2);
    stats.reloadTime = Math.max(900, Math.round(2100 - energyFactor * 140));
    stats.laserVelocity = 2.7 + energyFactor * 0.1;
    stats.laserScale = Number((0.9 + damageFactor * 0.08).toFixed(2));

    const shipClass = String(ship?.classId || '').toLowerCase();
    if(shipClass === 'fighters'){
        stats.turnYaw = 0.0027;
        stats.turnPitch = 0.0021;
        stats.rollLimit = 0.95;
        stats.maxSpeed *= 1.08;
        stats.forwardAcceleration *= 1.14;
        stats.strafeAcceleration *= 1.16;
        stats.hp *= 0.92;
        stats.handlingLabel = 'Манёвренный';
    }else if(shipClass === 'tanks'){
        stats.turnYaw = 0.00145;
        stats.turnPitch = 0.00115;
        stats.rollLimit = 0.42;
        stats.maxSpeed *= 0.88;
        stats.forwardAcceleration *= 0.9;
        stats.strafeAcceleration *= 0.82;
        stats.hp *= 1.22;
        stats.weaponDamage *= 1.08;
        stats.handlingLabel = 'Тяжёлый';
    }else if(shipClass === 'assault'){
        stats.turnYaw = 0.00205;
        stats.turnPitch = 0.00165;
        stats.rollLimit = 0.78;
        stats.weaponDamage *= 1.15;
        stats.maxSpeed *= 0.98;
        stats.handlingLabel = 'Штурмовой';
    }else if(shipClass === 'technology'){
        stats.turnYaw = 0.0022;
        stats.turnPitch = 0.00185;
        stats.rollLimit = 0.68;
        stats.clipSize += 8;
        stats.reloadTime *= 0.9;
        stats.laserVelocity += 0.35;
        stats.handlingLabel = 'Точный';
    }else if(shipClass === 'universal'){
        stats.turnYaw = 0.002;
        stats.turnPitch = 0.00165;
        stats.rollLimit = 0.72;
        stats.handlingLabel = 'Универсал';
    }

    switch(stats.weaponType){
        case 'pulse':
            stats.projectileColor = '#57f8ff';
            stats.projectileCoreColor = '#f3ffff';
            stats.projectileLength = 1.7;
            stats.projectileWidth = 0.11;
            stats.projectileLife = 86;
            stats.burstCount = 2;
            stats.projectileOffset = 1.16;
            stats.spread = 0.008;
            stats.fireCooldown = 78;
            stats.weaponDamage *= 0.94;
            stats.laserVelocity += 0.45;
            break;
        case 'beam':
            stats.projectileColor = '#7aa8ff';
            stats.projectileCoreColor = '#ffffff';
            stats.projectileLength = 3.4;
            stats.projectileWidth = 0.09;
            stats.projectileLife = 112;
            stats.burstCount = 1;
            stats.projectileOffset = 0.0;
            stats.spread = 0.0;
            stats.fireCooldown = 120;
            stats.weaponDamage *= 1.12;
            stats.laserVelocity += 0.72;
            stats.laserScale += 0.12;
            break;
        case 'phase':
            stats.projectileColor = '#b56dff';
            stats.projectileCoreColor = '#ffe6ff';
            stats.projectileLength = 2.8;
            stats.projectileWidth = 0.16;
            stats.projectileLife = 106;
            stats.burstCount = 1;
            stats.projectileOffset = 0.0;
            stats.spread = 0.0;
            stats.fireCooldown = 132;
            stats.weaponDamage *= 1.24;
            stats.laserVelocity += 0.38;
            stats.laserScale += 0.2;
            break;
        case 'plasma':
            stats.projectileColor = '#ff8c4d';
            stats.projectileCoreColor = '#fff3dd';
            stats.projectileLength = 2.3;
            stats.projectileWidth = 0.2;
            stats.projectileLife = 92;
            stats.burstCount = 2;
            stats.projectileOffset = 0.95;
            stats.spread = 0.016;
            stats.fireCooldown = 108;
            stats.weaponDamage *= 1.2;
            stats.laserVelocity -= 0.12;
            stats.laserScale += 0.22;
            break;
        case 'missile':
            stats.projectileColor = '#ffb15a';
            stats.projectileCoreColor = '#fff2c8';
            stats.projectileLength = 2.0;
            stats.projectileWidth = 0.24;
            stats.projectileLife = 124;
            stats.burstCount = 1;
            stats.projectileOffset = 0.0;
            stats.spread = 0.0;
            stats.fireCooldown = 168;
            stats.weaponDamage *= 1.45;
            stats.laserVelocity = Math.max(2.25, stats.laserVelocity - 0.35);
            stats.laserScale += 0.34;
            stats.clipSize = Math.max(12, Math.round(stats.clipSize * 0.6));
            stats.reloadTime *= 1.08;
            break;
        default:
            stats.projectileColor = '#ff3355';
            stats.projectileCoreColor = '#ffffff';
            stats.projectileLength = 2.2;
            stats.projectileWidth = 0.14;
            stats.projectileLife = 100;
            stats.burstCount = 2;
            stats.projectileOffset = 1.1;
            stats.spread = 0.003;
            stats.fireCooldown = 95;
            break;
    }

    installedModules.forEach(module => {
        const typeId = String(module?.typeId || module?.classId || '').trim();
        if(typeId === 'engine'){
            stats.maxSpeed *= 1.12;
            stats.forwardAcceleration *= 1.15;
            stats.strafeAcceleration *= 1.12;
            stats.turnYaw *= 1.04;
            stats.turnPitch *= 1.04;
            stats.moduleSummary.push('+скорость');
        }else if(typeId === 'defense'){
            stats.hp *= 1.18;
            stats.damping += 0.002;
            stats.moduleSummary.push('+броня');
        }else if(typeId === 'reactor'){
            stats.clipSize += 8;
            stats.reloadTime *= 0.82;
            stats.laserVelocity += 0.28;
            stats.moduleSummary.push('+энергия');
        }else if(typeId === 'targeting'){
            stats.laserVelocity += 0.55;
            stats.laserScale += 0.22;
            stats.weaponDamage += 1;
            stats.spread *= 0.6;
            stats.moduleSummary.push('+точность');
        }else if(typeId === 'weapon'){
            stats.weaponDamage *= 1.14;
            stats.laserScale += 0.1;
            stats.fireCooldown *= 0.92;
            stats.moduleSummary.push('+урон');
        }
    });

    stats.maxSpeed = Number(stats.maxSpeed.toFixed(2));
    stats.forwardAcceleration = Number(stats.forwardAcceleration.toFixed(3));
    stats.backwardAcceleration = Number(stats.backwardAcceleration.toFixed(3));
    stats.strafeAcceleration = Number(stats.strafeAcceleration.toFixed(3));
    stats.damping = Number(Math.min(0.994, stats.damping).toFixed(3));
    stats.hp = Math.max(80, Math.round(stats.hp));
    stats.weaponDamage = Math.max(8, Math.round(stats.weaponDamage));
    stats.clipSize = Math.max(8, Math.round(stats.clipSize));
    stats.reloadTime = Math.max(650, Math.round(stats.reloadTime));
    stats.laserVelocity = Number(Math.max(2.0, stats.laserVelocity).toFixed(2));
    stats.laserScale = Number(Math.max(0.85, stats.laserScale).toFixed(2));
    stats.fireCooldown = Math.max(60, Math.round(stats.fireCooldown));
    stats.turnYaw = Number(stats.turnYaw.toFixed(4));
    stats.turnPitch = Number(stats.turnPitch.toFixed(4));
    stats.rollLimit = Number(stats.rollLimit.toFixed(2));
    stats.projectileWidth = Number(stats.projectileWidth.toFixed(2));
    stats.projectileLength = Number(stats.projectileLength.toFixed(2));
    stats.projectileOffset = Number(stats.projectileOffset.toFixed(2));
    stats.spread = Number(stats.spread.toFixed(3));

    return stats;
}

let currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');

function getAllOwnedHangarShips(){
    if(Array.isArray(player?.ownedShipIds) && player.ownedShipIds.length && typeof getShopShipById === 'function'){
        const owned = player.ownedShipIds
            .map(id => getShopShipById(id))
            .filter(Boolean);
        if(owned.length) return owned;
    }
    if(Array.isArray(player?.ships) && player.ships.length){
        return player.ships.map((ship, index) => ({
            id: String(ship.id || `legacy_${index}`),
            name: ship.name || `Корабль ${index + 1}`,
            subtitle: 'Старый ангар',
            description: 'Корабль из старого ангара. Для полного отображения открой магазин и купи новые корпуса.',
            tier: 'Legacy',
            classId: 'legacy',
            stats: [
                ['Скорость', ship.speed || 5],
                ['Броня', ship.hp || 100],
                ['Урон', ship.attack || 10],
                ['Энергия', ship.level || 1]
            ],
            neon: '#7efcff',
            engine: '#63d1ff',
            accent: '#7a8cff',
            art: 'classic',
            weapon: 'laser'
        }));
    }
    return [];
}


function findOwnedHangarShipById(shipId){
    const safeId = String(shipId || '').trim();
    if(!safeId) return null;
    return getAllOwnedHangarShips().find(item => String(item?.id || '').trim() === safeId) || null;
}

function syncHangarSelectionState(options = {}){
    const forceClass = options?.forceClass !== false;
    const preferredShip = findOwnedHangarShipById(player?.selectedShipId || '') || getAllOwnedHangarShips()[0] || null;
    if(!preferredShip){
        hangarState.shipFilter = 'all';
        hangarState.shipIndex = 0;
        return;
    }

    const preferredClass = String(preferredShip?.classId || 'all').trim() || 'all';
    if(forceClass){
        hangarState.shipFilter = preferredClass;
    }

    let ships = getOwnedHangarShips();
    let selectedIndex = ships.findIndex(item => String(item?.id || '').trim() === String(preferredShip.id || '').trim());

    if(selectedIndex < 0){
        hangarState.shipFilter = preferredClass || 'all';
        ships = getOwnedHangarShips();
        selectedIndex = ships.findIndex(item => String(item?.id || '').trim() === String(preferredShip.id || '').trim());
    }

    if(selectedIndex < 0){
        hangarState.shipFilter = 'all';
        ships = getOwnedHangarShips();
        selectedIndex = ships.findIndex(item => String(item?.id || '').trim() === String(preferredShip.id || '').trim());
    }

    hangarState.shipIndex = Math.max(0, selectedIndex);
}

function setHangarTransition(direction = 0){
    hangarState.transitionDirection = Number(direction || 0) || 0;
    hangarState.transitionStartedAt = performance.now();
}

function getOwnedHangarShips(){
    const allShips = getAllOwnedHangarShips();
    const filterId = String(hangarState?.shipFilter || 'all').trim();
    if(!filterId || filterId === 'all') return allShips;
    return allShips.filter(item => String(item?.classId || '').trim() === filterId);
}


function updateHangarFilterButtons(){
    const buttons = document.querySelectorAll('.hangar-class-chip[data-hangar-class]');
    buttons.forEach(btn => {
        const cls = String(btn.dataset.hangarClass || 'all').trim();
        btn.classList.toggle('active', cls === String(hangarState.shipFilter || 'all'));
    });
}

function ensureHangarIndexes(){
    const ships = getOwnedHangarShips();
    const modules = getOwnedHangarModules();
    if(hangarState.shipIndex >= ships.length) hangarState.shipIndex = Math.max(0, ships.length - 1);
    if(hangarState.moduleIndex >= modules.length) hangarState.moduleIndex = Math.max(0, modules.length - 1);
    if(hangarState.shipIndex < 0) hangarState.shipIndex = 0;
    if(hangarState.moduleIndex < 0) hangarState.moduleIndex = 0;
    updateHangarFilterButtons();
}

function createHangarPlatform(){
    const group = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(7.6, 8.4, 1.1, 40, 1),
        new THREE.MeshStandardMaterial({ color:0x213b62, metalness:0.72, roughness:0.38 })
    );
    group.add(base);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6.25, 0.22, 20, 56),
        new THREE.MeshBasicMaterial({ color:0x78d9ff, transparent:true, opacity:0.92 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.48;
    group.add(ring);

    const glowDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(5.8, 5.8, 0.08, 36),
        new THREE.MeshBasicMaterial({ color:0x55bfff, transparent:true, opacity:0.18 })
    );
    glowDisc.position.y = 0.6;
    group.add(glowDisc);

    group.userData.ring = ring;
    group.userData.glowDisc = glowDisc;
    return group;
}

function createHangarShipMesh(item){
    const art = String(item?.art || 'classic').toLowerCase();
    const neon = item?.neon || '#7efcff';
    const engine = item?.engine || '#63d1ff';
    const accent = item?.accent || '#7a8cff';

    const group = new THREE.Group();
    const hullColor = new THREE.Color(accent);
    const metal = new THREE.MeshStandardMaterial({ color:hullColor, metalness:0.74, roughness:0.3 });
    const darkMetal = new THREE.MeshStandardMaterial({ color:new THREE.Color(accent).multiplyScalar(0.55), metalness:0.78, roughness:0.45 });
    const lightMetal = new THREE.MeshStandardMaterial({ color:0xdbeeff, metalness:0.35, roughness:0.24 });
    const glowMat = new THREE.MeshBasicMaterial({ color:new THREE.Color(neon) });
    const engineMat = new THREE.MeshBasicMaterial({ color:new THREE.Color(engine) });

    const addEngine = (x, y, z, sx, sy, sz) => {
        const part = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), engineMat);
        part.position.set(x, y, z);
        group.add(part);
        return part;
    };
    const addSymPair = (meshFactory, x) => {
        const left = meshFactory();
        left.position.x = -Math.abs(x);
        const right = meshFactory();
        right.position.x = Math.abs(x);
        group.add(left, right);
        return [left, right];
    };

    if(art === 'arrow' || art === 'dart'){
        const body = new THREE.Mesh(new THREE.ConeGeometry(1.0, art === 'dart' ? 5.9 : 5.4, 8), metal);
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.54, 18, 18), lightMetal);
        cockpit.position.set(0, 0.34, -0.95);
        group.add(cockpit);

        const wingFactory = () => {
            const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, art === 'dart' ? 2.8 : 2.2), darkMetal);
            wing.position.set(0, -0.08, 0.32);
            return wing;
        };
        const [wingL, wingR] = addSymPair(wingFactory, 1.5);
        wingL.rotation.z = -0.42;
        wingR.rotation.z = 0.42;

        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 3.0), glowMat);
        spine.position.set(0, 0.14, 0.2);
        group.add(spine);

        addEngine(-0.42, 0.0, 2.95, 0.2, 0.2, 0.95);
        addEngine(0.42, 0.0, 2.95, 0.2, 0.2, 0.95);
        if(art === 'dart'){
            const noseFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 1.1), glowMat);
            noseFin.position.set(0, 0.35, -2.1);
            group.add(noseFin);
        }
    }else if(art === 'stinger' || art === 'phantom' || art === 'razor'){
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, art === 'razor' ? 1.05 : 0.9, 6.0, 6), metal);
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        const nose = new THREE.Mesh(new THREE.ConeGeometry(art === 'phantom' ? 0.62 : 0.78, 1.9, 6), lightMetal);
        nose.rotation.x = -Math.PI / 2;
        nose.position.z = -3.4;
        group.add(nose);

        const bladeFactory = () => {
            const blade = new THREE.Mesh(new THREE.BoxGeometry(art === 'razor' ? 2.1 : 1.8, 0.08, 2.7), darkMetal);
            blade.position.set(0, -0.06, 0.18);
            return blade;
        };
        const [bladeL, bladeR] = addSymPair(bladeFactory, art === 'phantom' ? 1.22 : 1.42);
        bladeL.rotation.z = art === 'phantom' ? -0.68 : -0.52;
        bladeR.rotation.z = art === 'phantom' ? 0.68 : 0.52;

        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 1.6), glowMat);
        fin.position.set(0, 0.45, 0.68);
        group.add(fin);

        addEngine(-0.56, -0.02, 3.2, 0.2, 0.18, 1.0);
        addEngine(0.56, -0.02, 3.2, 0.2, 0.18, 1.0);
        if(art === 'razor'){
            addEngine(0, -0.05, 3.45, 0.22, 0.22, 1.2);
            const wingGlowL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.12), glowMat);
            wingGlowL.position.set(-1.45, 0.02, 0.4);
            const wingGlowR = wingGlowL.clone();
            wingGlowR.position.x = 1.45;
            group.add(wingGlowL, wingGlowR);
        }
    }else if(art === 'bulwark' || art === 'fortress' || art === 'citadel'){
        const width = art === 'citadel' ? 2.8 : (art === 'fortress' ? 2.45 : 2.2);
        const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.95, 4.8), metal);
        group.add(body);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.74, 2.0), lightMetal);
        tower.position.set(0, 0.7, -0.2);
        group.add(tower);

        const sidePlateFactory = () => {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 2.4), darkMetal);
            plate.position.set(0, -0.06, 0.35);
            return plate;
        };
        const [plateL, plateR] = addSymPair(sidePlateFactory, width * 0.43);
        plateL.rotation.z = -0.08;
        plateR.rotation.z = 0.08;

        const frontArc = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.15, 16, 40, Math.PI), glowMat);
        frontArc.position.set(0, 0.28, -2.05);
        frontArc.rotation.z = Math.PI;
        group.add(frontArc);

        addEngine(-0.8, -0.06, 3.0, 0.32, 0.24, 1.1);
        addEngine(0.8, -0.06, 3.0, 0.32, 0.24, 1.1);
        if(art === 'citadel'){
            addEngine(0, -0.08, 3.18, 0.35, 0.26, 1.22);
        }
    }else if(art === 'lancer' || art === 'destroyer'){
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, art === 'destroyer' ? 1.2 : 0.95, 5.8, 7), metal);
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.46, art === 'destroyer' ? 2.0 : 1.5), lightMetal);
        nose.position.set(0, 0.15, -2.15);
        nose.rotation.y = art === 'destroyer' ? 0 : 0.1;
        group.add(nose);

        const assaultWingFactory = () => {
            const wing = new THREE.Mesh(new THREE.BoxGeometry(art === 'destroyer' ? 1.8 : 1.35, 0.18, 2.6), darkMetal);
            wing.position.set(0, -0.05, 0.45);
            return wing;
        };
        const [wingL, wingR] = addSymPair(assaultWingFactory, art === 'destroyer' ? 1.9 : 1.55);
        wingL.rotation.z = art === 'destroyer' ? -0.24 : -0.36;
        wingR.rotation.z = art === 'destroyer' ? 0.24 : 0.36;

        const missileRackL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 1.2), glowMat);
        missileRackL.position.set(-1.0, -0.2, -0.5);
        const missileRackR = missileRackL.clone();
        missileRackR.position.x = 1.0;
        group.add(missileRackL, missileRackR);

        addEngine(-0.72, -0.02, 3.1, 0.28, 0.22, 1.08);
        addEngine(0.72, -0.02, 3.1, 0.28, 0.22, 1.08);
        if(art === 'destroyer'){
            addEngine(-1.18, -0.02, 2.84, 0.18, 0.18, 0.82);
            addEngine(1.18, -0.02, 2.84, 0.18, 0.18, 0.82);
        }
    }else if(art === 'halo'){
        const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.55, 0), metal);
        body.scale.set(1.25, 0.7, 2.45);
        group.add(body);

        const core = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 18), glowMat);
        core.position.y = 0.2;
        group.add(core);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 18, 54), new THREE.MeshBasicMaterial({ color:new THREE.Color(accent) }));
        ring.rotation.x = Math.PI / 2;
        ring.rotation.z = 0.42;
        group.add(ring);

        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.64, 2.8, 8), darkMetal);
        tail.rotation.x = -Math.PI / 2;
        tail.position.z = 2.1;
        group.add(tail);
        addEngine(-0.58, 0.02, 3.35, 0.22, 0.22, 1.05);
        addEngine(0.58, 0.02, 3.35, 0.22, 0.22, 1.05);
    }else if(art === 'helios'){
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.22, 5.4, 6), metal);
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        const prism = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 2.4), lightMetal);
        prism.position.set(0, 0.18, -0.65);
        prism.rotation.z = 0.22;
        group.add(prism);

        const solarL = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.35), darkMetal);
        solarL.position.set(-2.15, 0.0, 0.42);
        solarL.rotation.z = -0.12;
        const solarR = solarL.clone();
        solarR.position.x = 2.15;
        solarR.rotation.z = 0.12;
        group.add(solarL, solarR);

        const glowStripL = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.04, 0.14), glowMat);
        glowStripL.position.copy(solarL.position).add(new THREE.Vector3(0, 0.05, 0));
        const glowStripR = glowStripL.clone();
        glowStripR.position.copy(solarR.position).add(new THREE.Vector3(0, 0.05, 0));
        group.add(glowStripL, glowStripR);
        addEngine(-0.72, -0.04, 3.05, 0.28, 0.24, 1.0);
        addEngine(0.72, -0.04, 3.05, 0.28, 0.24, 1.0);
    }else{
        const body = new THREE.Mesh(new THREE.ConeGeometry(1.15, 5.2, 8), metal);
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 18), lightMetal);
        cockpit.position.set(0, 0.4, -0.55);
        group.add(cockpit);

        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 2.7), lightMetal);
        spine.position.set(0, 0.18, 0.55);
        group.add(spine);

        const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.05), darkMetal);
        wing.position.set(0, -0.05, 0.25);
        group.add(wing);
        const finL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 1.3), darkMetal);
        finL.position.set(-1.48, 0.22, 0.55);
        const finR = finL.clone();
        finR.position.x = 1.48;
        group.add(finL, finR);
        addEngine(-0.48, -0.02, 2.8, 0.24, 0.24, 0.9);
        addEngine(0.48, -0.02, 2.8, 0.24, 0.24, 0.9);
    }

    const noseGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), glowMat);
    noseGlow.position.set(0, 0.12, -3.15);
    group.add(noseGlow);

    const glowTrail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.38, 1.15, 14), engineMat);
    glowTrail.rotation.x = Math.PI / 2;
    glowTrail.position.set(0, 0, 3.55);
    group.add(glowTrail);

    group.scale.setScalar(1.28);
    return group;
}

function createHangarModuleMesh(item){
    const art = String(item?.art || item?.typeId || 'module').toLowerCase();
    const neon = item?.neon || '#7efcff';
    const accent = item?.accent || '#7a8cff';

    const group = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color:new THREE.Color(accent), metalness:0.58, roughness:0.34 });
    const darkShell = new THREE.MeshStandardMaterial({ color:new THREE.Color(accent).multiplyScalar(0.62), metalness:0.72, roughness:0.42 });
    const glow = new THREE.MeshBasicMaterial({ color:new THREE.Color(neon) });

    if(art.includes('shield')){
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), shell);
        const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 18, 44), glow);
        ringA.rotation.x = Math.PI / 2;
        const ringB = ringA.clone();
        ringB.rotation.y = Math.PI / 2;
        const braces = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), darkShell);
        const braces2 = braces.clone(); braces2.rotation.z = Math.PI / 2;
        group.add(core, ringA, ringB, braces, braces2);
    } else if(art.includes('reactor')){
        const shellOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.8, 18, 1, true), shell);
        shellOuter.rotation.z = Math.PI / 2;
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 16), glow);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 16, 38), darkShell);
        ring.rotation.y = Math.PI / 2;
        group.add(shellOuter, core, ring);
    } else if(art.includes('matrix')){
        const cube = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), shell);
        cube.rotation.set(0.4, 0.6, 0.2);
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), glow);
        const frame = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.08, 12, 28), darkShell);
        frame.rotation.x = Math.PI / 2;
        const frame2 = frame.clone(); frame2.rotation.y = Math.PI / 2;
        group.add(cube, core, frame, frame2);
    } else if(art.includes('plasma')){
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.8, 2.2, 14), shell);
        pod.rotation.z = Math.PI / 2;
        const fins = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.5), darkShell);
        const fins2 = fins.clone(); fins2.rotation.z = Math.PI / 2;
        const plasma = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 1.65, 14), glow);
        plasma.rotation.z = Math.PI / 2;
        group.add(pod, fins, fins2, plasma);
    } else {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 2.0, 16), shell);
        pod.rotation.z = Math.PI / 2;
        const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.3, 0.14), glow);
        glowStrip.position.set(0, 0, 0.78);
        const brace = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.08, 16, 28), darkShell);
        brace.rotation.y = Math.PI / 2;
        group.add(pod, glowStrip, brace);
    }

    group.scale.setScalar(1.28);
    return group;
}

function disposeHangarRenderer(){
    if(hangarState.frameId){
        cancelAnimationFrame(hangarState.frameId);
        hangarState.frameId = 0;
    }
    const stage = document.getElementById('hangar-3d-stage');
    if(hangarState.renderer){
        try{ hangarState.renderer.dispose(); }catch(_){}
        if(stage && hangarState.renderer.domElement.parentNode === stage){
            stage.removeChild(hangarState.renderer.domElement);
        }
    }
    hangarState.renderer = null;
    hangarState.scene = null;
    hangarState.camera = null;
    hangarState.platform = null;
    hangarState.shipPivot = null;
    hangarState.modulePivot = null;
}

function updateHangarHeaderNumbers(){
    const coinsEl = document.getElementById('hangar-coins');
    const diamondsEl = document.getElementById('hangar-diamonds');
    if(coinsEl) coinsEl.textContent = String(Number(playerResources?.coins || player?.credits || 0) || 0);
    if(diamondsEl) diamondsEl.textContent = String(Number(playerResources?.crystals || 0) || 0);
}

function updateHangarButtons(){
    const ships = getOwnedHangarShips();
    const modules = getOwnedHangarModules();

    const leftBtn = document.getElementById('hangar-ship-left');
    const rightBtn = document.getElementById('hangar-ship-right');
    const upBtn = document.getElementById('hangar-module-up');
    const downBtn = document.getElementById('hangar-module-down');
    const actionBtn = document.getElementById('hangar-ship-action');
    const posLabel = document.getElementById('hangar-ship-position');

    if(leftBtn) leftBtn.disabled = hangarState.shipIndex <= 0;
    if(rightBtn) rightBtn.disabled = hangarState.shipIndex >= ships.length - 1;
    if(upBtn) upBtn.disabled = hangarState.moduleIndex <= 0;
    if(downBtn) downBtn.disabled = hangarState.moduleIndex >= modules.length - 1;

    if(posLabel) posLabel.textContent = ships.length ? `${hangarState.shipIndex + 1} / ${ships.length}` : '0 / 0';

    if(actionBtn){
        const currentShip = ships[hangarState.shipIndex];
        const isSelected = !!currentShip && String(player.selectedShipId || '') === String(currentShip.id || '');
        actionBtn.textContent = isSelected ? 'Выбран' : 'Выбрать';
        actionBtn.classList.toggle('equipped', isSelected);
        actionBtn.classList.toggle('locked', !ships.length);
        actionBtn.classList.toggle('ready', !!ships.length && !isSelected);
        actionBtn.disabled = !ships.length;
        actionBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
}


function hideHangarShipPriceRow(){
    const row = document.getElementById('hangar-ship-price-row');
    if(row) row.style.display = 'none';
}

function fillHangarText(){
    hideHangarShipPriceRow();
    const ships = getOwnedHangarShips();
    const modules = getOwnedHangarModules();
    const ship = ships[hangarState.shipIndex] || null;
    const module = modules[hangarState.moduleIndex] || null;
    hangarState.shipItem = ship;
    hangarState.moduleItem = module;

    const stageWrap = document.querySelector('#hangar-window .hangar-stage');
    if(stageWrap){
        stageWrap.classList.toggle('empty-class', !ship);
        stageWrap.classList.toggle('ship-loading', !!ship && !!hangarState.isShipLoading);
    }

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if(el) el.textContent = value || '—';
    };

    const battleStatsView = computeShipBattleStats(ship?.id || player?.selectedShipId || '');
    const installedModules = getInstalledModulesForShip(ship?.id || player?.selectedShipId || '');
    const moduleInstalled = !!(ship && module && getInstalledModuleForType(ship.id, module.typeId));

    setText('hangar-ship-tier', ship?.tier || '—');
    setText('hangar-ship-name', ship?.name || (String(hangarState?.shipFilter || 'all') !== 'all' ? 'Нет кораблей этого класса' : 'Нет кораблей'));
    setText('hangar-ship-subtitle', ship?.subtitle || (String(hangarState?.shipFilter || 'all') !== 'all' ? 'В выбранном классе пока нет доступных корпусов' : 'Покупай корабли в магазине, они появятся здесь'));
    setText('hangar-ship-desc', ship?.description || (String(hangarState?.shipFilter || 'all') !== 'all' ? 'Смени класс выше или купи корабль этого класса в магазине.' : 'Открой магазин и пополни ангар новыми корпусами.'));
    setText('hangar-ship-price-coins', ship && typeof getShipCoinPrice === 'function' ? String(getShipCoinPrice(ship)) : '0');
    setText('hangar-ship-price-diamonds', ship && typeof getShipDiamondPrice === 'function' ? String(getShipDiamondPrice(ship)) : '0');

    setText('hangar-module-name', module?.name || 'Нет модулей');
    setText('hangar-module-tier', module?.tier || '—');
    setText('hangar-module-type', module?.badge ? `${module.badge}${moduleInstalled ? ' • установлен' : ''}` : '—');
    setText('hangar-module-desc', module?.description || 'Модули из магазина будут видны здесь и доступны для просмотра.');

    const moduleBtn = document.getElementById('hangar-module-action');
    if(moduleBtn){
        moduleBtn.disabled = !ship || !module;
        moduleBtn.textContent = !module ? 'Нет модулей' : (moduleInstalled ? 'Снять модуль' : 'Установить модуль');
        moduleBtn.classList.toggle('equipped', moduleInstalled);
        moduleBtn.classList.toggle('locked', !ship || !module);
    }

    const statsWrap = document.getElementById('hangar-ship-stats');
    if(statsWrap){
        const extraModules = installedModules.length ? installedModules.map(item => item.name).join(', ') : 'Нет';
        const weaponLabel = String(ship?.stats?.find?.(row => String(row?.[0] || '').toLowerCase() === 'оружие')?.[1] || battleStatsView.weaponType || '—');
        const stats = [
            ['Скорость', battleStatsView.maxSpeed.toFixed(2)],
            ['Броня', battleStatsView.hp],
            ['Урон', battleStatsView.weaponDamage],
            ['Энергия', battleStatsView.clipSize],
            ['Оружие', weaponLabel],
            ['Управление', battleStatsView.handlingLabel],
            ['Перезарядка', `${(battleStatsView.reloadTime / 1000).toFixed(1)}с`],
            ['Модули', extraModules]
        ];
        statsWrap.innerHTML = stats.map(([key, value]) => `
            <div class="hangar-stat-box">
              <div class="hangar-stat-label">${key}</div>
              <div class="hangar-stat-value">${value}</div>
            </div>
        `).join('');
    }

    updateHangarHeaderNumbers();
    updateHangarButtons();
}



const hangarShipMeshCache = new Map();
let hangarBuildToken = 0;


function createHangarNoShipPlaceholder(){
    const group = new THREE.Group();

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.28, 0.05, 16, 42),
        new THREE.MeshBasicMaterial({ color:0x53d8ff, transparent:true, opacity:0.52 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const lineA = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.035, 0.15),
        new THREE.MeshBasicMaterial({ color:0x8ee7ff, transparent:true, opacity:0.34 })
    );
    lineA.position.y = 0.22;
    group.add(lineA);

    const lineB = lineA.clone();
    lineB.scale.x = 0.7;
    lineB.position.y = 0.02;
    group.add(lineB);

    group.position.set(-0.18, 0.98, 0);
    return group;
}

function createHangarLoadingPlaceholder(){
    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 1.4, 5, 12),
        new THREE.MeshStandardMaterial({
            color: 0x27476d,
            emissive: 0x113355,
            emissiveIntensity: 0.85,
            metalness: 0.35,
            roughness: 0.55,
            transparent: true,
            opacity: 0.95
        })
    );
    body.rotation.z = Math.PI * 0.5;
    group.add(body);

    const wingLeft = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.05, 0.46),
        new THREE.MeshStandardMaterial({ color: 0x6fdcff, emissive: 0x49c8ff, emissiveIntensity: 0.8 })
    );
    wingLeft.position.set(-0.05, -0.10, -0.42);
    wingLeft.rotation.z = -0.16;
    group.add(wingLeft);

    const wingRight = wingLeft.clone();
    wingRight.position.z = 0.42;
    wingRight.rotation.z = 0.16;
    group.add(wingRight);

    group.userData.isHangarPlaceholder = true
    return group;
}

function cloneObject3DDeepSafe(object3d){
    try{
        const cloned = object3d.clone(true);
        cloned.traverse((node) => {
            if(node.isMesh){
                if(node.geometry) node.geometry = node.geometry.clone();
                if(Array.isArray(node.material)){
                    node.material = node.material.map(mat => mat?.clone ? mat.clone() : mat);
                }else if(node.material?.clone){
                    node.material = node.material.clone();
                }
            }
        });
        return cloned;
    }catch(_){
        return object3d?.clone ? object3d.clone(true) : object3d;
    }
}

function queueHangarShipBuild(currentShip){
    if(!currentShip || !hangarState.shipPivot) return;
    const buildToken = ++hangarBuildToken;
    const shipId = String(currentShip.id || '').trim();

    hangarState.isShipLoading = true;
    fillHangarText();

    const cached = hangarShipMeshCache.get(shipId);
    if(cached){
        while(hangarState.shipPivot.children.length) hangarState.shipPivot.remove(hangarState.shipPivot.children[0]);
        const readyMesh = cloneObject3DDeepSafe(cached);
        readyMesh.position.set(0, 0.98, 0);
        hangarState.shipPivot.add(readyMesh);
        hangarState.isShipLoading = false;
        fillHangarText();
        return;
    }

    requestAnimationFrame(() => {
        if(buildToken !== hangarBuildToken || !hangarState.shipPivot) return;
        try{
            const rawShipMesh = createHangarShipMesh(currentShip);
            const shipMesh = normalizeHangarShipMesh(rawShipMesh);
            hangarShipMeshCache.set(shipId, cloneObject3DDeepSafe(shipMesh));

            if(buildToken !== hangarBuildToken || !hangarState.shipPivot) return;
            while(hangarState.shipPivot.children.length) hangarState.shipPivot.remove(hangarState.shipPivot.children[0]);
            shipMesh.position.set(0, 0.86, 0);
            hangarState.shipPivot.add(shipMesh);
        }catch(_){}
    });
}

function normalizeHangarShipMesh(shipMesh){
    try{
        if(!shipMesh) return shipMesh;

        shipMesh.updateMatrixWorld(true);

        const bounds = new THREE.Box3().setFromObject(shipMesh);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());

        const wrap = new THREE.Group();
        wrap.add(shipMesh);

        const maxWidth = 2.8;
        const maxHeight = 1.9;
        const maxDepth = 2.8;

        const scaleX = size.x > 0 ? maxWidth / size.x : 1;
        const scaleY = size.y > 0 ? maxHeight / size.y : 1;
        const scaleZ = size.z > 0 ? maxDepth / size.z : 1;
        const finalScale = Math.min(scaleX, scaleY, scaleZ, 0.52);

        shipMesh.scale.multiplyScalar(finalScale);
        shipMesh.updateMatrixWorld(true);

        const normalizedBounds = new THREE.Box3().setFromObject(shipMesh);
        const normalizedSize = normalizedBounds.getSize(new THREE.Vector3());
        const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());

        shipMesh.position.x -= normalizedCenter.x;
        shipMesh.position.z -= normalizedCenter.z;
        shipMesh.position.y -= normalizedBounds.min.y;
        shipMesh.position.y += 0.02;

        wrap.userData.hangarHeight = normalizedSize.y || 0;
        wrap.userData.hangarWidth = normalizedSize.x || 0;
        wrap.userData.hangarDepth = normalizedSize.z || 0;
        return wrap;
    }catch(_){
        return shipMesh;
    }
}

function rebuildHangarSceneObjects(){
    if(!hangarState.scene || !hangarState.shipPivot || !hangarState.modulePivot) return;

    hangarBuildToken += 1;
    hangarState.isShipLoading = false;

    while(hangarState.shipPivot.children.length) hangarState.shipPivot.remove(hangarState.shipPivot.children[0]);
    while(hangarState.modulePivot.children.length) hangarState.modulePivot.remove(hangarState.modulePivot.children[0]);

    const ships = getOwnedHangarShips();
    const modules = getOwnedHangarModules();
    const currentShip = ships[hangarState.shipIndex];
    const currentModule = modules[hangarState.moduleIndex];

    if(currentShip){
        hangarState.isShipLoading = true;
        const placeholder = createHangarLoadingPlaceholder();
        placeholder.position.set(0, 0.98, 0);
        hangarState.shipPivot.add(placeholder);
        queueHangarShipBuild(currentShip);
    }else{
        hangarState.shipPivot.add(createHangarNoShipPlaceholder());
    }

    if(currentModule){
        const moduleMesh = createHangarModuleMesh(currentModule);
        moduleMesh.position.set(-6.9, 2.9, 0.25);
        hangarState.modulePivot.add(moduleMesh);
    }

    fillHangarText();
}

function ensureHangarRenderer(){
    const stage = document.getElementById('hangar-3d-stage');
    if(!stage) return;

    bindHangarStageInteraction();

    if(!hangarState.renderer){
        hangarState.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
        hangarState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        hangarState.renderer.outputColorSpace = THREE.SRGBColorSpace;
        stage.appendChild(hangarState.renderer.domElement);

        hangarState.scene = new THREE.Scene();
        hangarState.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
        hangarState.camera.position.set(0.18, 3.32, 9.45);
        hangarState.camera.lookAt(0, 1.76, 0);

        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        const key = new THREE.DirectionalLight(0xbbe6ff, 1.45);
        key.position.set(8, 12, 10);
        const rim = new THREE.DirectionalLight(0x7e8dff, 0.8);
        rim.position.set(-9, 6, -8);
        const floorGlow = new THREE.PointLight(0x4ac8ff, 1.8, 38);
        floorGlow.position.set(0, 2.0, 0);

        hangarState.scene.add(ambient, key, rim, floorGlow);

        const stars = new THREE.Points(
            new THREE.BufferGeometry().setAttribute(
                'position',
                new THREE.Float32BufferAttribute([
                    -24, 10, -14, -16, 18, -12, 15, 9, -18, 18, 16, -10, -12, 7, -16, 12, 20, -18,
                    -20, 14, -20, 22, 6, -16, 0, 21, -24, 9, 4, -22, -7, 18, -12, 17, 13, -15
                ], 3)
            ),
            new THREE.PointsMaterial({ color:0x9fdfff, size:0.22 })
        );
        hangarState.scene.add(stars);

        hangarState.platform = createHangarPlatform();
        hangarState.platform.position.set(0, 0.06, 0.38);
        hangarState.platform.scale.set(0.26, 0.26, 0.26);
        hangarState.platformRing = hangarState.platform.userData?.ring || null;
        hangarState.platformGlowDisc = hangarState.platform.userData?.glowDisc || null;
        hangarState.scene.add(hangarState.platform);

        hangarState.shipPivot = new THREE.Group();
        hangarState.modulePivot = new THREE.Group();
        requestAnimationFrame(() => {
            try{
                const shipsToWarm = getOwnedHangarShips().slice(0, 6);
                shipsToWarm.forEach((ship, index) => {
                    setTimeout(() => {
                        try{
                            const shipId = String(ship?.id || '').trim();
                            if(!shipId || hangarShipMeshCache.has(shipId)) return;
                            const raw = createHangarShipMesh(ship);
                            const normalized = normalizeHangarShipMesh(raw);
                            hangarShipMeshCache.set(shipId, cloneObject3DDeepSafe(normalized));
                        }catch(_){}
                    }, 40 * index);
                });
            }catch(_){}
        });

        hangarState.scene.add(hangarState.shipPivot, hangarState.modulePivot);
    }

    const width = stage.clientWidth || 1000;
    const height = stage.clientHeight || 700;
    hangarState.renderer.setSize(width, height, false);
    hangarState.camera.aspect = width / Math.max(1, height);
    hangarState.camera.updateProjectionMatrix();

    if(!hangarState.resizeBound){
        hangarState.resizeBound = true;
        window.addEventListener('resize', () => {
            if(document.getElementById('hangar-window')?.classList.contains('hidden')) return;
            ensureHangarRenderer();
        });
    }

    rebuildHangarSceneObjects();

    const animate = () => {
        if(document.getElementById('hangar-window')?.classList.contains('hidden')){
            hangarState.frameId = 0;
            return;
        }

        const now = performance.now();
        const time = now * 0.001;
        const currentShip = getOwnedHangarShips()[hangarState.shipIndex] || null;
        const isViewedShipSelected = !!currentShip && String(currentShip?.id || '').trim() === String(player?.selectedShipId || '').trim();

        if(hangarState.platform){
            hangarState.platform.rotation.y += 0.0036;
        }
        if(hangarState.platformRing?.material){
            hangarState.platformRing.material.opacity = isViewedShipSelected ? 1 : 0.74;
            hangarState.platformRing.material.color.set(isViewedShipSelected ? 0x8bffb1 : 0x78d9ff);
        }
        if(hangarState.platformGlowDisc?.material){
            hangarState.platformGlowDisc.material.opacity = isViewedShipSelected ? 0.3 : 0.18;
            hangarState.platformGlowDisc.material.color.set(isViewedShipSelected ? 0x58ff95 : 0x55bfff);
        }

        const transitionElapsed = now - hangarState.transitionStartedAt;
        const transitionProgress = Math.min(1, transitionElapsed / 320);
        const transitionEase = 1 - Math.pow(1 - transitionProgress, 3);
        const transitionOffset = transitionProgress < 1 ? (1 - transitionEase) * hangarState.transitionDirection * 1.3 : 0;
        if(transitionProgress >= 1){
            hangarState.transitionDirection = 0;
        }

        if(!hangarState.isDraggingShip && (now - hangarState.lastManualRotateAt) > 1600){
            hangarState.shipSpinVelocity += (0.0062 - hangarState.shipSpinVelocity) * 0.06;
        }else{
            hangarState.shipSpinVelocity *= 0.92;
        }
        hangarState.shipYaw += hangarState.shipSpinVelocity;
        hangarState.shipSpinVelocity *= 0.985;

        if(hangarState.shipPivot){
            hangarState.shipPivot.rotation.y = hangarState.shipYaw;
            hangarState.shipPivot.position.x = transitionOffset;
            hangarState.shipPivot.position.y = 1.02 + Math.sin(time * 1.25) * 0.05;
            hangarState.shipPivot.position.z = 0.02;
        }
        if(hangarState.modulePivot){
            hangarState.modulePivot.rotation.y -= 0.012;
            hangarState.modulePivot.rotation.x = Math.sin(time * 0.8) * 0.16;
            hangarState.modulePivot.position.y = Math.sin(time * 1.5) * 0.12;
        }

        if(hangarState.camera){
            hangarState.camera.lookAt(0, 1.72, 0);
        }
        hangarState.renderer.render(hangarState.scene, hangarState.camera);
        hangarState.frameId = requestAnimationFrame(animate);
    };

    if(!hangarState.frameId){
        hangarState.frameId = requestAnimationFrame(animate);
    }
}


function bindHangarStageInteraction(){
    const stage = document.querySelector('#hangar-window .hangar-stage');
    if(!stage || hangarState.stageBound) return;
    hangarState.stageBound = true;

    const endDrag = () => {
        hangarState.isDraggingShip = false;
        stage.classList.remove('dragging');
    };

    stage.addEventListener('mousedown', (event) => {
        if(event.button !== 0) return;
        if(event.target?.closest?.('.hangar-stage-overlay') || event.target?.closest?.('.hangar-arrow')) return;
        hangarState.isDraggingShip = true;
        hangarState.dragLastX = event.clientX;
        hangarState.lastManualRotateAt = performance.now();
        stage.classList.add('dragging');
        event.preventDefault();
    });

    window.addEventListener('mousemove', (event) => {
        if(!hangarState.isDraggingShip) return;
        const deltaX = event.clientX - hangarState.dragLastX;
        hangarState.dragLastX = event.clientX;
        hangarState.shipYaw += deltaX * 0.015;
        hangarState.shipSpinVelocity = THREE.MathUtils.clamp(deltaX * 0.0018, -0.09, 0.09);
        hangarState.lastManualRotateAt = performance.now();
    });

    window.addEventListener('mouseup', endDrag);
    window.addEventListener('mouseleave', endDrag);
}

function bindHangarControls(){
    const bindOnce = (id, handler) => {
        const el = document.getElementById(id);
        if(!el || el.dataset.hangarBound) return;
        el.dataset.hangarBound = '1';
        el.addEventListener('click', handler);
    };


    const filterButtons = document.querySelectorAll('.hangar-class-chip[data-hangar-class]');
    filterButtons.forEach(btn => {
        if(btn.dataset.hangarBound) return;
        btn.dataset.hangarBound = '1';
        btn.addEventListener('click', () => {
            const nextFilter = String(btn.dataset.hangarClass || 'all').trim() || 'all';
            if(hangarState.shipFilter !== nextFilter){
                setHangarTransition(nextFilter === 'all' ? 0 : 1);
            }
            hangarState.shipFilter = nextFilter;
            hangarState.shipIndex = 0;
            const filteredShips = getOwnedHangarShips();
            const selectedIndex = filteredShips.findIndex(item => String(item?.id || '').trim() === String(player?.selectedShipId || '').trim());
            if(selectedIndex >= 0){
                hangarState.shipIndex = selectedIndex;
            }
            ensureHangarIndexes();
            updateHangarFilterButtons();
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    });

    bindOnce('hangar-ship-left', () => {
        const nextIndex = Math.max(0, hangarState.shipIndex - 1);
        if(nextIndex === hangarState.shipIndex) return;
        hangarState.shipIndex = nextIndex;
        setHangarTransition(-1);
        rebuildHangarSceneObjects();
    });

    bindOnce('hangar-ship-right', () => {
        const ships = getOwnedHangarShips();
        const nextIndex = Math.min(Math.max(0, ships.length - 1), hangarState.shipIndex + 1);
        if(nextIndex === hangarState.shipIndex) return;
        hangarState.shipIndex = nextIndex;
        setHangarTransition(1);
        rebuildHangarSceneObjects();
    });

    bindOnce('hangar-module-up', () => {
        hangarState.moduleIndex = Math.max(0, hangarState.moduleIndex - 1);
        rebuildHangarSceneObjects();
    });

    bindOnce('hangar-module-down', () => {
        const modules = getOwnedHangarModules();
        hangarState.moduleIndex = Math.min(Math.max(0, modules.length - 1), hangarState.moduleIndex + 1);
        rebuildHangarSceneObjects();
    });

    bindOnce('hangar-module-action', () => {
        const ships = getOwnedHangarShips();
        const modules = getOwnedHangarModules();
        const currentShip = ships[hangarState.shipIndex];
        const currentModule = modules[hangarState.moduleIndex];
        if(!currentShip || !currentModule) return;
        if(toggleShipModule(currentModule.id, currentShip.id)){
            currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || currentShip.id);
            fillHangarText();
        }
    });

    bindOnce('hangar-ship-action', () => {
        const ships = getOwnedHangarShips();
        const current = ships[hangarState.shipIndex];
        if(!current) return;
        player.selectedShipId = current.id;
        if(typeof equipOwnedShip === 'function'){
            try{ equipOwnedShip(current.id); }catch(_){}
        }else{
            try{ saveGame?.(); }catch(_){}
        }
        fillHangarText();
    });

    bindOnce('close-hangar', () => {
        document.getElementById('hangar-window')?.classList.add('hidden');
        disposeHangarRenderer();
    });
}

function renderHangarCosmic(forceSyncToSelected = true){
    if(forceSyncToSelected){
        syncHangarSelectionState({ forceClass:true });
    }
    ensureHangarIndexes();
    bindHangarControls();
    updateHangarFilterButtons();
    fillHangarText();
    ensureHangarRenderer();
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
        tab.addEventListener('click', () => { closeAll(); if(winId === 'hangar-window'){ renderer(true); } else { renderer(); } win.classList.remove('hidden'); if(winId === 'hangar-window'){ setTimeout(() => renderHangarCosmic?.(true), 0); } });
      }
    });
    [['close-profile','profile-window'],['close-hangar','hangar-window'],['close-clans','clans-window'],['close-leaders','leaders-window']].forEach(([btnId,winId]) => {
      const btn = document.getElementById(btnId);
      const win = document.getElementById(winId);
      if(btn && win && !btn.dataset.boundExtra){
        btn.dataset.boundExtra = '1';
        btn.addEventListener('click', () => { win.classList.add('hidden'); if(winId === 'hangar-window'){ try{ disposeHangarRenderer?.(); }catch(_){} } });
      }
    });
}

window.addEventListener('load', () => {
    initExtraLobbyWindows();
    renderProfileStats();
    renderHangarCosmic(true);
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
        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.2 + Math.random()*0.7, 0.12 + Math.random()*0.5, 0.2 + Math.random()*0.7), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity:0.04, roughness:0.9, metalness:0.15 }));
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
    observerCameraPitch = 0;
    observerCameraDistance = 34;
    enterBattleMap(mapName);
    observerBots = [];
    observerFreeCameraPosition.set(0, 12, 38);
    camera.position.copy(observerFreeCameraPosition);
    const hud = document.getElementById('enemy-hud');
    if(hud) hud.style.display = 'none';
}

function updateObserverBattle(){
    const lookEuler = new THREE.Euler(observerCameraPitch, observerCameraYaw, 0, 'YXZ');
    const lookQuaternion = new THREE.Quaternion().setFromEuler(lookEuler);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(lookQuaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const move = new THREE.Vector3();
    const flySpeed = 1.15;

    if(keys.w) move.add(forward);
    if(keys.s) move.addScaledVector(forward, -1);
    if(keys.d) move.add(right);
    if(keys.a) move.addScaledVector(right, -1);
    if(keys.space) move.add(up);
    if(keys.shift) move.addScaledVector(up, -1);

    if(move.lengthSq() > 0){
        move.normalize().multiplyScalar(flySpeed);
        observerFreeCameraPosition.add(move);
    }

    camera.position.copy(observerFreeCameraPosition);
    camera.lookAt(observerFreeCameraPosition.clone().add(forward.multiplyScalar(80)));
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
            currentRoom = buildObserveRoomState(targetMap);
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
    const levelEl = document.getElementById('premium-player-level');
    const expEl = document.getElementById('premium-player-exp');
    const crystalEl = document.getElementById('premium-crystals');
    const coinsEl = document.getElementById('premium-coins');
    if(levelEl) levelEl.textContent = `⭐ ${player?.level || 1}`;
    const currentExp = Number(player?.experience || 0);
    const nextExp = Math.max(100, (Number(player?.level || 1) * 600));
    if(expEl) expEl.textContent = `EXP ${currentExp}/${nextExp}`;
    if(crystalEl) crystalEl.textContent = `💎 ${playerResources?.crystals || 0}`;
    if(coinsEl) coinsEl.textContent = `🪙 ${playerResources?.coins || 0}`;
}
function updateNicknameSettingsState(message=''){
    const nicknameInput = document.getElementById('nickname-input');
    const nicknameStatus = document.getElementById('nickname-status');
    const nicknameGroup = document.getElementById('settings-nickname-group');
    const battleSaveBtn = document.getElementById('battle-settings-save-btn');
    const closeSettings = document.getElementById('close-settings');
    const inBattleMenu = gameState === 'BATTLE' || gameState === 'OBSERVE';

    if(nicknameInput) nicknameInput.value = player?.nickname || '';
    if(nicknameStatus) nicknameStatus.textContent = message || (player?.nickname || '—');
    if(nicknameGroup) nicknameGroup.style.display = inBattleMenu ? 'none' : '';
    if(battleSaveBtn) battleSaveBtn.style.display = inBattleMenu ? 'inline-flex' : 'none';
    if(closeSettings) closeSettings.textContent = inBattleMenu ? 'Выйти с карты' : 'Закрыть';
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
                .select('public_id,nickname,email,auth_id,level,experience,credits,created_at,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
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
                        experience: Number(player.experience || 0),
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
                    .select('public_id,nickname,email,auth_id,level,experience,credits,created_at,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
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
            player.experience = Number(playerRow?.experience || player.experience || 0);
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


    function createSunProminenceArc(radius, arcIndex = 0){
        const archHeight = radius * (0.18 + Math.random() * 0.05);
        const sideOffset = radius * (0.12 + Math.random() * 0.04);
        const curve = new THREE.CubicBezierCurve3(
            new THREE.Vector3(-radius * 0.17, 0, 0),
            new THREE.Vector3(-sideOffset, archHeight, 0),
            new THREE.Vector3(sideOffset, archHeight, 0),
            new THREE.Vector3(radius * 0.17, 0, 0)
        );

        const samplePoints = curve.getPoints(12);

        const glowTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 54, Math.max(1.25, radius * 0.010), 14, false),
            new THREE.MeshBasicMaterial({
                color: 0xff8c22,
                transparent: true,
                opacity: 0.22,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );

        const coreTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 54, Math.max(0.45, radius * 0.0038), 12, false),
            new THREE.MeshBasicMaterial({
                color: 0xfff1a8,
                transparent: true,
                opacity: 0.82,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );

        const haloTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 40, Math.max(2.1, radius * 0.016), 10, false),
            new THREE.MeshBasicMaterial({
                color: 0xff5a12,
                transparent: true,
                opacity: 0.08,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );

        const group = new THREE.Group();
        group.add(haloTube);
        group.add(glowTube);
        group.add(coreTube);

        group.position.set(0, 0, radius * 1.013);
        group.rotation.z = (Math.PI * 2 / 3) * arcIndex + (Math.random() - 0.5) * 0.16;
        group.rotation.y = (Math.random() - 0.5) * 0.32;
        group.rotation.x = (Math.random() - 0.5) * 0.22;
        group.userData.baseScale = 0.98 + Math.random() * 0.08;
        group.userData.pulseSpeed = 0.7 + Math.random() * 0.45;
        group.userData.spinSpeed = 0.00035 + Math.random() * 0.00035;
        group.userData.phase = Math.random() * Math.PI * 2;
        group.userData.damageRadius = Math.max(3.8, radius * 0.028);
        group.userData.samplePoints = samplePoints.map(point => point.clone());
        return group;
    }

    function createSunProminenceGroup(radius){
        const group = new THREE.Group();
        group.name = 'sunProminenceGroup';
        for(let i = 0; i < 3; i++){
            group.add(createSunProminenceArc(radius, i));
        }
        return group;
    }

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
        const rawMapName = String(
            mapName ||
            currentRoom?.real ||
            selectedLobbyMap?.real ||
            currentRoom?.map ||
            selectedLobbyMap?.name ||
            currentRoom?.title ||
            ''
        ).trim();
        const mapKey = normalizeBattleMapName(rawMapName);
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
        const isSunMap = mapKey === 'sun';
        const planetMaterial = isSunMap
        ? new THREE.MeshBasicMaterial({
            map: sunTexture,
            color: 0xffffff
        })
        : new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.92, metalness: 0.04 });
        battleMapPlanet = new THREE.Mesh(planetGeometry, planetMaterial);
        battleMapPlanet.position.set(0, -12, -230);
        battleMapPlanet.userData.radius = config.size;
        battleMapPlanet.userData.solidRadius = config.size + 14;
        battleMapPlanet.userData.atmosphereRadius = isSunMap ? config.size + 118 : config.size + 96;
        battleMapPlanet.userData.nearSurfaceRadius = isSunMap ? config.size + 28 : config.size + 22;
        battleMapPlanet.userData.dangerRadius = isSunMap ? config.size + 138 : config.size + 104;
        battleMapPlanet.userData.captureRadius = isSunMap ? config.size + 38 : config.size + 30;
        battleMapPlanet.userData.crashRadius = isSunMap ? config.size + 18 : config.size + 14;
        battleMapPlanet.userData.isSunMap = isSunMap;
        scene.add(battleMapPlanet);

        if(isSunMap){
            const sunBattleGlow = new THREE.Mesh(
                new THREE.SphereGeometry(config.size * 1.08, 40, 40),
                new THREE.MeshBasicMaterial({
                    color: 0xffaa33,
                    transparent: true,
                    opacity: 0.12,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    side: THREE.DoubleSide
                })
            );
            sunBattleGlow.name = 'sunBattleGlow';
            battleMapPlanet.add(sunBattleGlow);

            const sunOuterGlow = new THREE.Mesh(
                new THREE.SphereGeometry(config.size * 1.16, 32, 32),
                new THREE.MeshBasicMaterial({
                    color: 0xff7a1a,
                    transparent: true,
                    opacity: 0.07,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    side: THREE.DoubleSide
                })
            );
            sunOuterGlow.name = 'sunBattleOuterGlow';
            battleMapPlanet.add(sunOuterGlow);

            if(typeof createSunProminenceGroup === 'function'){
                battleMapPlanet.add(createSunProminenceGroup(config.size));
            }
        }

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
        if(!battleMapPlanet || object === playerShip) return;
        const delta = object.position.clone().sub(battleMapPlanet.position);
        const dist = delta.length();
        const solidRadius = battleMapPlanet.userData?.solidRadius || (battleMapPlanet.userData?.radius || 100);
        const minDist = solidRadius + 4.5;
        if(dist < minDist){
            const push = delta.normalize();
            if(!Number.isFinite(push.x)) push.set(0,1,0);
            object.position.copy(battleMapPlanet.position.clone().add(push.multiplyScalar(minDist)));
            if(velocityRef) velocityRef.multiplyScalar(0.18);
        }
    };

    updateBattlePlanetEffects = function(){
        if(!battleMapPlanet || !playerShip || battleObserverMode) return;
        const toPlanet = battleMapPlanet.position.clone().sub(playerShip.position);
        const distance = toPlanet.length();
        const radius = battleMapPlanet.userData?.radius || 100;
        const dangerRadius = battleMapPlanet.userData?.dangerRadius || radius + 104;
        const captureRadius = battleMapPlanet.userData?.captureRadius || radius + 30;
        const nearSurfaceRadius = battleMapPlanet.userData?.nearSurfaceRadius || radius + 22;

        const closeness = THREE.MathUtils.clamp((dangerRadius - distance) / dangerRadius, 0, 1);
        const scaleBoost = THREE.MathUtils.clamp(1 + closeness * 1.1, 1, 2.15);
        battlePlanetVisualScale += (scaleBoost - battlePlanetVisualScale) * 0.1;
        battleMapPlanet.scale.setScalar(battlePlanetVisualScale);

        if(isBattlePlanetCaptureActive()){
            return;
        }

        if(distance <= captureRadius){
            startBattlePlanetCapture();
            return;
        }

        if(distance < dangerRadius){
            const towardPlanet = toPlanet.clone().normalize();
            shipVelocity.add(towardPlanet.multiplyScalar(0.065 * Math.max(0.16, closeness)));
            if(distance < nearSurfaceRadius){
                shipVelocity.multiplyScalar(0.92);
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
        if(battleTab && lobbyMode === 'battle' && !shopState?.open){
            battleTab.style.color = '#00ffff';
            battleTab.style.textShadow = '0 0 10px rgba(0,255,255,0.4)';
        }
        if(soloTab && lobbyMode === 'solo' && !shopState?.open){
            soloTab.style.color = '#00ffff';
            soloTab.style.textShadow = '0 0 10px rgba(0,255,255,0.4)';
        }
        if(shopTab && shopState?.open){
            shopTab.style.color = '#00ffff';
            shopTab.style.textShadow = '0 0 10px rgba(0,255,255,0.4)';
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
                }
                if(mode === 'solo'){
                    window.renderPlayersOnPlanet({ players: [] });
                }else{
                    const players = Array.isArray(entry.currentPlayers) ? entry.currentPlayers : (Array.isArray(entry.players) ? entry.players : []);
                    window.renderPlayersOnPlanet({ ...entry, currentPlayers: players, players: players });
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
                currentRoom = buildObserveRoomState(targetMap);
                switchState('OBSERVE');
                const canvas = document.querySelector('canvas');
                if(canvas){
                    try{ safeRequestPointerLock(canvas); }catch(_){ }
                }
            });
        }
    }




/* ===== V82 SHOP CLASSES ===== */
const SHOP_DATA = {
    types: [
        { id:'fighters', name:'Истребители', subtitle:'Скорость и перехват', badge:'Истребитель' },
        { id:'tanks', name:'Танки', subtitle:'Броня и давление', badge:'Тяжёлый корпус' },
        { id:'assault', name:'Штурмовики', subtitle:'Ракеты и тяжёлый урон', badge:'Штурмовик' },
        { id:'technology', name:'Технологии', subtitle:'Энергия и спецэффекты', badge:'Технологический класс' },
        { id:'universal', name:'Универсалы', subtitle:'Баланс всех систем', badge:'Универсал' }
    ],
    shipsByType: {
        fighters: [
            { id:'scout_1', type:'ship', classId:'fighters', tier:'Старый корпус', name:'Скаут-1', subtitle:'Старый перехватчик', badge:'Истребители', price:900, description:'Базовый старый корпус для быстрых вылетов. Узкий силуэт, простая броня, яркие носовые неоны и лёгкие лазерные пушки.', stats:[['Скорость','9.2'],['Броня','3.2'],['Урон','4.8'],['Энергия','5.4'],['Оружие','Лазеры']], art:'arrow', neon:'#76f7ff', engine:'#59c7ff', weapon:'laser', accent:'#7a8cff' },
            { id:'scout_2', type:'ship', classId:'fighters', tier:'Усиленный корпус', name:'Скаут-2', subtitle:'Форсажная версия', badge:'Истребители', price:1350, description:'Обновлённая версия старой платформы: ярче контуры, мощнее сопла, лучше стабилизация и более чистый лазерный след.', stats:[['Скорость','9.6'],['Броня','3.8'],['Урон','5.5'],['Энергия','5.9'],['Оружие','Импульсный лазер']], art:'dart', neon:'#86fff2', engine:'#65d2ff', weapon:'laser', accent:'#57a8ff' },
            { id:'stinger', type:'ship', classId:'fighters', tier:'Новая серия', name:'Стингер', subtitle:'Клинок перехвата', badge:'Истребители', price:1880, description:'Уже современный и более острый корпус. Пара боковых пушек даёт плотный импульсный огонь, а неоновые жилы подчёркивают скорость.', stats:[['Скорость','9.8'],['Броня','4.2'],['Урон','6.3'],['Энергия','6.4'],['Оружие','Двойной импульс']], art:'stinger', neon:'#7efcff', engine:'#4ab8ff', weapon:'pulse', accent:'#ffd86a' },
            { id:'phantom', type:'ship', classId:'fighters', tier:'Современный stealth', name:'Фантом', subtitle:'Стелс-перехватчик', badge:'Истребители', price:2640, description:'Тонкий скрытный корпус с фиолетово-голубыми неонами. Задние двигатели горят коротким резким факелом, вооружение — тонкие лучевые лазеры.', stats:[['Скорость','10.0'],['Броня','4.7'],['Урон','7.3'],['Энергия','7.4'],['Оружие','Лучевой лазер']], art:'phantom', neon:'#95f1ff', engine:'#8b6cff', weapon:'beam', accent:'#9f6bff' },
            { id:'phantom_x', type:'ship', classId:'fighters', tier:'Топ версия', name:'Фантом-X', subtitle:'Пиковая модель ветки', badge:'Истребители', price:3520, description:'Новая элитная модификация с яркими неоновыми линиями по всему корпусу, усиленными двигателями и плазменным лучом высокой плотности.', stats:[['Скорость','10.4'],['Броня','5.1'],['Урон','8.2'],['Энергия','8.6'],['Оружие','Плазменный луч']], art:'razor', neon:'#7cfbff', engine:'#a36cff', weapon:'plasma', accent:'#ffe07d' }
        ],
        tanks: [
            { id:'bastion_0', type:'ship', classId:'tanks', tier:'Старый корпус', name:'Бастион-0', subtitle:'Старый тяжёлый щит', badge:'Танки', price:980, description:'Старая тяжёлая платформа с широким корпусом и медленными, но мощными двигателями. Лобовые пушки стреляют плотным синим лазером.', stats:[['Скорость','4.2'],['Броня','8.4'],['Урон','5.6'],['Энергия','5.0'],['Оружие','Тяжёлый лазер']], art:'bulwark', neon:'#7fe7ff', engine:'#4aa8ff', weapon:'laser', accent:'#56c9ff' },
            { id:'bastion_1', type:'ship', classId:'tanks', tier:'Усиленный корпус', name:'Бастион-1', subtitle:'Лобовой подавитель', badge:'Танки', price:1480, description:'Усиленная версия с более яркой защитной подсветкой и массивным центральным орудием. Хорошо держит фронт и постоянно светится по краям.', stats:[['Скорость','4.6'],['Броня','9.0'],['Урон','6.3'],['Энергия','5.5'],['Оружие','Осадный лазер']], art:'bulwark', neon:'#85f2ff', engine:'#5cb6ff', weapon:'beam', accent:'#7aa7ff' },
            { id:'goliath', type:'ship', classId:'tanks', tier:'Новая серия', name:'Голиаф', subtitle:'Тяжёлый молот', badge:'Танки', price:2280, description:'Новая тяжёлая рама с боковыми бронеплитами, угловыми неонами и плазменным залпом из центральной башни.', stats:[['Скорость','4.8'],['Броня','9.6'],['Урон','7.1'],['Энергия','6.1'],['Оружие','Плазменный залп']], art:'fortress', neon:'#8bf9ff', engine:'#4fc0ff', weapon:'plasma', accent:'#ffd06c' },
            { id:'titan', type:'ship', classId:'tanks', tier:'Современный тяжёлый', name:'Титан', subtitle:'Фронтовой бастион', badge:'Танки', price:3180, description:'Плотный корпус с яркими броневыми рёбрами, крупными реакторами и медленным тяжёлым лучевым выстрелом.', stats:[['Скорость','5.1'],['Броня','10.0'],['Урон','7.8'],['Энергия','6.6'],['Оружие','Тяжёлый луч']], art:'fortress', neon:'#9dfcff', engine:'#7ab6ff', weapon:'beam', accent:'#7ad7ff' },
            { id:'titan_mk2', type:'ship', classId:'tanks', tier:'Топ версия', name:'Титан-МК2', subtitle:'Броневой доминатор', badge:'Танки', price:4180, description:'Топовая версия ветки: насыщенные неоны, тройной задний выхлоп и тяжёлое фазовое орудие для продавливания линии боя.', stats:[['Скорость','5.4'],['Броня','10.6'],['Урон','8.7'],['Энергия','7.2'],['Оружие','Фазовый заряд']], art:'citadel', neon:'#8ff8ff', engine:'#95c0ff', weapon:'phase', accent:'#9c83ff' }
        ],
        assault: [
            { id:'raider', type:'ship', classId:'assault', tier:'Старый корпус', name:'Рейдер', subtitle:'Старый штурмовой клинок', badge:'Штурмовики', price:950, description:'Старый штурмовой корпус с агрессивным носом и яркими оранжево-голубыми прожилками. Вооружён коротким лазерным залпом.', stats:[['Скорость','7.0'],['Броня','5.4'],['Урон','6.8'],['Энергия','5.2'],['Оружие','Штурмовой лазер']], art:'lancer', neon:'#76f2ff', engine:'#4bc4ff', weapon:'laser', accent:'#ffba63' },
            { id:'raider_mk2', type:'ship', classId:'assault', tier:'Усиленный корпус', name:'Рейдер-МК2', subtitle:'Ракетная версия', badge:'Штурмовики', price:1460, description:'Новая секция под ракетные пилоны и мощнее сопла. Неоны идут по крыльям, а нос несёт импульсно-ракетный пакет.', stats:[['Скорость','7.3'],['Броня','5.9'],['Урон','7.6'],['Энергия','5.7'],['Оружие','Ракеты + импульс']], art:'lancer', neon:'#82fdff', engine:'#63d1ff', weapon:'missile', accent:'#ffd76a' },
            { id:'blitz', type:'ship', classId:'assault', tier:'Новая серия', name:'Блиц', subtitle:'Быстрый штурм', badge:'Штурмовики', price:2140, description:'Скоростной штурмовик со стреловидным корпусом, красочными боковыми неонами и парой плазменных ускорителей.', stats:[['Скорость','7.9'],['Броня','6.3'],['Урон','8.2'],['Энергия','6.4'],['Оружие','Плазменные болты']], art:'stinger', neon:'#7efbff', engine:'#5ed6ff', weapon:'plasma', accent:'#ff9e61' },
            { id:'destroyer', type:'ship', classId:'assault', tier:'Современный штурм', name:'Разрушитель', subtitle:'Тяжёлый атакующий корпус', badge:'Штурмовики', price:3020, description:'Корпус с широкой носовой частью и двойным задним факелом. Пушки стреляют плотными ракетно-плазменными залпами.', stats:[['Скорость','7.2'],['Броня','7.2'],['Урон','9.0'],['Энергия','6.9'],['Оружие','Ракеты + плазма']], art:'destroyer', neon:'#89f9ff', engine:'#ff9e66', weapon:'missile', accent:'#ff7f66' },
            { id:'destroyer_x', type:'ship', classId:'assault', tier:'Топ версия', name:'Разрушитель-X', subtitle:'Топовый дамагер', badge:'Штурмовики', price:3950, description:'Элитный штурмовик с мерцающими неонами по крыльям, перегретыми кормовыми двигателями и тяжёлым алым плазменным выбросом.', stats:[['Скорость','7.5'],['Броня','7.7'],['Урон','9.8'],['Энергия','7.5'],['Оружие','Алый плазмо-залп']], art:'destroyer', neon:'#9ffbff', engine:'#ff8b63', weapon:'plasma', accent:'#ff6a6a' }
        ],
        technology: [
            { id:'echo', type:'ship', classId:'technology', tier:'Старый корпус', name:'Эхо', subtitle:'Старый энергокорабль', badge:'Технологии', price:1020, description:'Старый исследовательский корпус с мягкими бирюзовыми неонами и кольцевой энергетикой вокруг центрального ядра.', stats:[['Скорость','6.0'],['Броня','4.8'],['Урон','5.7'],['Энергия','8.1'],['Оружие','Энерголучи']], art:'halo', neon:'#81fdff', engine:'#6fd8ff', weapon:'beam', accent:'#84a6ff' },
            { id:'echo_2', type:'ship', classId:'technology', tier:'Усиленный корпус', name:'Эхо-2', subtitle:'Улучшенное ядро', badge:'Технологии', price:1580, description:'Модернизированная старая платформа с более ярким центральным ядром и фазовым свечением на крыльях.', stats:[['Скорость','6.3'],['Броня','5.0'],['Урон','6.2'],['Энергия','8.8'],['Оружие','Фазовый луч']], art:'halo', neon:'#95ffff', engine:'#6bc4ff', weapon:'phase', accent:'#9d7cff' },
            { id:'nova', type:'ship', classId:'technology', tier:'Новая серия', name:'Нова', subtitle:'Энергетический фрегат', badge:'Технологии', price:2360, description:'Новый корпус с энергетическими арками, яркими неоновыми кольцами и чистым дальним лучом.', stats:[['Скорость','6.8'],['Броня','5.4'],['Урон','7.1'],['Энергия','9.4'],['Оружие','Квантовый луч']], art:'halo', neon:'#8efbff', engine:'#7dc6ff', weapon:'beam', accent:'#fff184' },
            { id:'helios', type:'ship', classId:'technology', tier:'Современный tech', name:'Гелиос', subtitle:'Солнечная батарея боя', badge:'Технологии', price:3280, description:'Светящийся современный корпус с золотыми прожилками, реактором в центре и стабилизированным плазменным импульсом.', stats:[['Скорость','7.0'],['Броня','5.9'],['Урон','7.8'],['Энергия','10.0'],['Оружие','Солнечная плазма']], art:'helios', neon:'#92ffff', engine:'#8bc8ff', weapon:'plasma', accent:'#ffd96d' },
            { id:'helios_prime', type:'ship', classId:'technology', tier:'Топ версия', name:'Гелиос-Прайм', subtitle:'Пиковая энергомодель', badge:'Технологии', price:4320, description:'Топовый технологический корабль с самыми яркими неонами, пульсирующими орбитальными кольцами и фазовым орудием высокой плотности.', stats:[['Скорость','7.4'],['Броня','6.2'],['Урон','8.5'],['Энергия','10.8'],['Оружие','Фазовая арка']], art:'helios', neon:'#a6ffff', engine:'#93d2ff', weapon:'phase', accent:'#ffd86b' }
        ],
        universal: [
            { id:'pioneer', type:'ship', classId:'universal', tier:'Старый корпус', name:'Пионер', subtitle:'Старый универсал', badge:'Универсалы', price:880, description:'Классический корпус ранней серии: аккуратные синие неоны, пара компактных двигателей и простой лазерный комплект.', stats:[['Скорость','7.0'],['Броня','5.8'],['Урон','5.9'],['Энергия','6.2'],['Оружие','Лазеры']], art:'classic', neon:'#79f4ff', engine:'#62c8ff', weapon:'laser', accent:'#6ba4ff' },
            { id:'pioneer_2', type:'ship', classId:'universal', tier:'Усиленный корпус', name:'Пионер-2', subtitle:'Сбалансированный апгрейд', badge:'Универсалы', price:1320, description:'Улучшенная версия старой платформы с ярче светящимися линиями и более уверенным импульсным вооружением.', stats:[['Скорость','7.3'],['Броня','6.2'],['Урон','6.4'],['Энергия','6.8'],['Оружие','Импульсные пушки']], art:'classic', neon:'#88fbff', engine:'#6ed3ff', weapon:'pulse', accent:'#7ad7ff' },
            { id:'vector', type:'ship', classId:'universal', tier:'Новая серия', name:'Вектор', subtitle:'Баланс во всём', badge:'Универсалы', price:1980, description:'Современный сбалансированный корпус с равномерным неоновым контуром и точным центральным лучом.', stats:[['Скорость','7.8'],['Броня','6.8'],['Урон','7.0'],['Энергия','7.2'],['Оружие','Точный луч']], art:'vector', neon:'#86ffff', engine:'#74d6ff', weapon:'beam', accent:'#8a8fff' },
            { id:'vector_plus', type:'ship', classId:'universal', tier:'Современный плюс', name:'Вектор-Плюс', subtitle:'Усиленная баланс-модель', badge:'Универсалы', price:2780, description:'Прокачанная версия с более густым свечением крыльев, улучшенными соплами и плазменным импульсом средней дальности.', stats:[['Скорость','8.1'],['Броня','7.1'],['Урон','7.6'],['Энергия','7.8'],['Оружие','Плазменный импульс']], art:'vector', neon:'#92ffff', engine:'#82d9ff', weapon:'plasma', accent:'#ffd470' },
            { id:'vector_elite', type:'ship', classId:'universal', tier:'Топ версия', name:'Вектор-Элит', subtitle:'Элитный баланс-класс', badge:'Универсалы', price:3660, description:'Топовый универсал с яркими голубыми неонами, насыщенным свечением двигателей и фазовым многоцелевым орудием.', stats:[['Скорость','8.5'],['Броня','7.5'],['Урон','8.1'],['Энергия','8.5'],['Оружие','Фазовый импульс']], art:'vector', neon:'#9dfdff', engine:'#8edfff', weapon:'phase', accent:'#9b7cff' }
        ]
    },

    moduleTypes: [
        { id:'engine', name:'Двигатели', subtitle:'Скорость и манёвр' },
        { id:'defense', name:'Защита', subtitle:'Броня и щиты' },
        { id:'reactor', name:'Реакторы', subtitle:'Энергия и перегрузка' },
        { id:'targeting', name:'Наведение', subtitle:'Точность и контроль' },
        { id:'weapon', name:'Оружейные', subtitle:'Усиление урона' }
    ],
    modulesByType: {
        engine: [
            { id:'speed_core', type:'module', classId:'engine', tier:'Редкий', name:'Модуль скорости', subtitle:'Ускорители маршевых двигателей', badge:'Двигатели', price:350, description:'Увеличивает максимальную скорость и разгон корабля. Полезен для лёгких и средних истребителей.', stats:[['Бонус','+12% скорость'],['Слот','Двигатель'],['Редкость','Редкий'],['Вес','Лёгкий']], art:'speed' }
        ],
        defense: [
            { id:'shield_lattice', type:'module', classId:'defense', tier:'Редкий', name:'Модуль защиты', subtitle:'Щитовая решётка', badge:'Защита', price:420, description:'Усиливает лобовую и боковую защиту корпуса, снижая урон от прямых попаданий.', stats:[['Бонус','+18% броня'],['Слот','Защита'],['Редкость','Редкий'],['Вес','Средний']], art:'shield' }
        ],
        reactor: [
            { id:'reactor_overdrive', type:'module', classId:'reactor', tier:'Эпический', name:'Реактор Overdrive', subtitle:'Пиковая энергия', badge:'Реакторы', price:560, description:'Ускоряет перезарядку энергии оружия и даёт кораблю стабильность в затяжной дуэли.', stats:[['Бонус','+20% энергия'],['Слот','Реактор'],['Редкость','Эпический'],['Вес','Средний']], art:'reactor' }
        ],
        targeting: [
            { id:'target_matrix', type:'module', classId:'targeting', tier:'Эпический', name:'Прицельная матрица', subtitle:'Контроль огня', badge:'Наведение', price:610, description:'Стабилизирует вооружение, повышает точность и уменьшает разброс лазерных батарей.', stats:[['Бонус','+16% точность'],['Слот','Наведение'],['Редкость','Эпический'],['Вес','Лёгкий']], art:'matrix' }
        ],
        weapon: [
            { id:'plasma_capacitor', type:'module', classId:'weapon', tier:'Эпический', name:'Плазменный конденсатор', subtitle:'Усилитель урона', badge:'Оружие', price:740, description:'Даёт более мощный импульс орудиям. Рекомендуется для штурмовых и снайперских конфигураций.', stats:[['Бонус','+14% урон'],['Слот','Оружие'],['Редкость','Эпический'],['Вес','Средний']], art:'plasma' }
        ]
    }
};
try{ window.__cosmicShopData = SHOP_DATA; }catch(_){}



function getAllShopShipsLegacy(){
    try{
        return Object.values(SHOP_DATA?.shipsByType || {}).flat();
    }catch(_){
        return [];
    }
}

function getShopShipByIdLegacy(shipId){
    const safeId = String(shipId || '').trim();
    return getAllShopShips().find(item => String(item?.id || '').trim() === safeId) || null;
}

function getShipCoinPriceLegacy(item){
    return Math.max(0, Number(item?.price || 0) || 0);
}

function getShipDiamondPriceLegacy(item){
    const coins = getShipCoinPrice(item);
    const tier = String(item?.tier || '').toLowerCase();
    const extra = tier.includes('топ') ? 12 : (tier.includes('соврем') ? 7 : 3);
    return Math.max(0, Math.round(coins / 220 + extra));
}

function isOwnedShip(itemOrId){
    ensureShopOwnershipDefaults();
    const shipId = typeof itemOrId === 'string' ? String(itemOrId || '').trim() : String(itemOrId?.id || '').trim();
    return !!shipId && player.ownedShipIds.includes(shipId);
}

function buyModuleFromShop(moduleId){
    ensureModuleOwnershipDefaults();
    const module = getModuleById(moduleId);
    if(!module) return false;

    if(!isOwnedModule(module.id)){
        const modulePrice = Math.max(0, Number(module.price || 0) || 0);
        const coins = Number(playerResources.coins || player.credits || 0) || 0;
        if(coins < modulePrice){
            alert(`Недостаточно монет для покупки модуля: нужно ${modulePrice}.`);
            return false;
        }
        playerResources.coins = coins - modulePrice;
        player.credits = playerResources.coins;
        player.ownedModuleIds.push(module.id);
        player.ownedModuleIds = Array.from(new Set(player.ownedModuleIds));
    }

    toggleShipModule(module.id, player.selectedShipId || '');
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
    saveGame?.();
    renderShopScreen?.();
    renderHangarCosmic?.();
    return true;
}

function refreshOwnedShipsInventoryFull(){
    ensureShopOwnershipDefaults();
    ensureModuleOwnershipDefaults();
    const ids = Array.isArray(player.ownedShipIds) ? player.ownedShipIds : ['scout_1'];
    player.ships = ids.map(id => {
        const item = getShopShipById(id);
        const stats = computeShipBattleStats(id);
        return {
            id,
            name: item?.name || id,
            level: Math.max(1, Number(player.level || 1) || 1),
            hp: stats.hp,
            attack: stats.weaponDamage,
            speed: stats.maxSpeed
        };
    });
}
refreshOwnedShipsInventory = refreshOwnedShipsInventoryFull;

function equipOwnedShip(shipId){
    const safeId = String(shipId || '').trim();
    if(!safeId || !isOwnedShip(safeId)) return false;
    player.selectedShipId = safeId;
    currentBattleShipStats = computeShipBattleStats(safeId);
    refreshOwnedShipsInventory?.();
    saveGame?.();
    renderShopScreen?.();
    return true;
}

function buyShipFromShop(shipId){
    ensureShopOwnershipDefaults();
    const ship = getShopShipById(shipId);
    if(!ship) return false;
    if(isOwnedShip(ship.id)) return equipOwnedShip(ship.id);

    const coinPrice = getShipCoinPrice(ship);
    const diamondPrice = getShipDiamondPrice(ship);
    const coins = Number(playerResources.coins || player.credits || 0) || 0;
    const diamonds = Number(playerResources.crystals || 0) || 0;

    if(coins < coinPrice || diamonds < diamondPrice){
        const missingCoins = Math.max(0, coinPrice - coins);
        const missingDiamonds = Math.max(0, diamondPrice - diamonds);
        const parts = [];
        if(missingCoins > 0) parts.push(`${missingCoins} монет`);
        if(missingDiamonds > 0) parts.push(`${missingDiamonds} алмазов`);
        alert(`Недостаточно ресурсов: не хватает ${parts.join(' и ')}.`);
        return false;
    }

    playerResources.coins = coins - coinPrice;
    player.credits = playerResources.coins;
    playerResources.crystals = diamonds - diamondPrice;
    player.ownedShipIds.push(ship.id);
    player.ownedShipIds = Array.from(new Set(player.ownedShipIds));
    player.selectedShipId = ship.id;
    refreshOwnedShipsInventory?.();
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
    saveGame?.();
    renderShopScreen?.();
    return true;
}

const shopState = {
    open:false,
    view:'ships',
    shipType:'fighters',
    moduleType:'engine',
    selectedId:'scout_1'
};
ensureShopOwnershipDefaults();
refreshOwnedShipsInventory();

function getCurrentShopShips(){
    return SHOP_DATA.shipsByType[shopState.shipType] || [];
}

function getCurrentShopModules(){
    return SHOP_DATA.modulesByType?.[shopState.moduleType] || [];
}

function getShopSelectedItem(){
    const list = shopState.view === 'modules' ? getCurrentShopModules() : getCurrentShopShips();
    return list.find(item => item.id === shopState.selectedId) || list[0] || null;
}

function buildShopModelSvg(item){
    const common = 'viewBox="0 0 280 280" class="shop-model-svg" xmlns="http://www.w3.org/2000/svg"';
    const neon = item?.neon || '#7efcff';
    const engine = item?.engine || '#63d1ff';
    const accent = item?.accent || '#7a8cff';
    const art = item?.art || 'classic';
    const weapon = item?.weapon || 'laser';
    const defs = `
      <defs>
        <linearGradient id="shipHullA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#edf7ff"/>
          <stop offset="45%" stop-color="#7a9dc7"/>
          <stop offset="100%" stop-color="#22324a"/>
        </linearGradient>
        <linearGradient id="shipHullB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef4d2"/>
          <stop offset="42%" stop-color="#9cb6da"/>
          <stop offset="100%" stop-color="#243248"/>
        </linearGradient>
        <linearGradient id="engineGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff2c8"/>
          <stop offset="55%" stop-color="${engine}"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </linearGradient>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="38%" stop-color="${neon}"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>`;

    const moduleMap = {
        speed: `<circle cx="140" cy="140" r="58" fill="rgba(35,70,120,0.45)" stroke="${neon}" stroke-width="4"/><circle cx="140" cy="140" r="26" fill="url(#coreGlow)" class="shop-neon-dot"/><path d="M140 68 L156 110 L212 110 L166 140 L184 206 L140 164 L96 206 L114 140 L68 110 L124 110 Z" fill="${accent}" opacity="0.94" class="shop-neon-line"/>`,
        shield: `<path d="M140 58 L206 96 V146 C206 182 178 210 140 226 C102 210 74 182 74 146 V96 Z" fill="rgba(32,62,110,0.44)" stroke="${neon}" stroke-width="4"/><path d="M140 84 L178 108 V142 C178 164 162 184 140 194 C118 184 102 164 102 142 V108 Z" fill="rgba(255,255,255,0.14)" stroke="${accent}" stroke-width="3" class="shop-neon-line"/>`,
        reactor: `<circle cx="140" cy="140" r="66" fill="rgba(14,28,58,0.64)" stroke="${neon}" stroke-width="3"/><circle cx="140" cy="140" r="24" fill="#fff2a3" class="shop-neon-dot"/><circle cx="140" cy="140" r="42" fill="none" stroke="${accent}" stroke-width="8" stroke-dasharray="18 10" opacity="0.86" class="shop-neon-line"/><circle cx="140" cy="140" r="58" fill="none" stroke="${neon}" stroke-width="2" opacity="0.5"/>`,
        matrix: `<rect x="92" y="92" width="96" height="96" rx="14" fill="rgba(18,32,64,0.76)" stroke="${neon}" stroke-width="4"/><path d="M108 140 H172 M140 108 V172" stroke="${accent}" stroke-width="8" stroke-linecap="round" class="shop-neon-line"/><circle cx="140" cy="140" r="18" fill="none" stroke="#dffbff" stroke-width="4"/>`,
        plasma: `<circle cx="140" cy="140" r="28" fill="#fff6b2" class="shop-neon-dot"/><path d="M140 72 C174 94 198 108 208 140 C196 174 176 192 140 208 C104 192 84 174 72 140 C84 108 110 94 140 72 Z" fill="none" stroke="${accent}" stroke-width="10" opacity="0.9" class="shop-neon-line"/><path d="M140 92 L158 132 L196 140 L158 148 L140 188 L122 148 L84 140 L122 132 Z" fill="${neon}" opacity="0.92"/>`,
        phase: `<circle cx="140" cy="140" r="58" fill="rgba(16,24,48,0.58)" stroke="${neon}" stroke-width="3"/><ellipse cx="140" cy="140" rx="70" ry="24" fill="none" stroke="${accent}" stroke-width="6" opacity="0.82" transform="rotate(-24 140 140)" class="shop-neon-line"/><ellipse cx="140" cy="140" rx="70" ry="24" fill="none" stroke="${neon}" stroke-width="4" opacity="0.58" transform="rotate(28 140 140)" class="shop-neon-line"/><circle cx="140" cy="140" r="18" fill="#dffbff"/>`
    };

    const shipMap = {
        arrow: '<path class="shop-hull-main" d="M140 24 L174 92 L244 118 L174 144 L140 232 L106 144 L36 118 L106 92 Z" fill="url(#shipHullA)" opacity="0.95"/><path d="M140 60 L158 112 L202 124 L158 136 L140 190 L122 136 L78 124 L122 112 Z" fill="rgba(223,251,255,0.56)"/><path d="M92 168 L124 144 L156 144 L188 168" fill="none" stroke="${neon}" stroke-width="5" class="shop-neon-line"/>',
        dart: '<path class="shop-hull-main" d="M140 28 L182 90 L242 116 L192 132 L166 214 L140 184 L114 214 L88 132 L38 116 L98 90 Z" fill="url(#shipHullB)" opacity="0.97"/><path d="M140 54 L162 118 L204 126 L162 134 L140 188 L118 134 L76 126 L118 118 Z" fill="rgba(223,251,255,0.62)"/><path d="M112 84 L140 66 L168 84" fill="none" stroke="${neon}" stroke-width="4" class="shop-neon-line"/>',
        stinger: '<path class="shop-hull-main" d="M140 24 L170 98 L232 118 L178 140 L140 226 L102 140 L48 118 L110 98 Z" fill="url(#shipHullA)" opacity="0.96"/><path d="M140 56 L158 118 L188 124 L158 134 L140 192 L122 134 L92 124 L122 118 Z" fill="rgba(223,251,255,0.58)"/><path d="M74 118 H206" stroke="${accent}" stroke-width="7" opacity="0.84" class="shop-weapon-glow"/>',
        razor: '<path class="shop-hull-main" d="M140 18 L180 92 L246 120 L180 150 L140 238 L100 150 L34 120 L100 92 Z" fill="url(#shipHullA)" opacity="0.94"/><path d="M140 44 L164 108 L210 120 L164 132 L140 198 L116 132 L70 120 L116 108 Z" fill="rgba(255,255,255,0.46)"/><path d="M94 120 C114 88 166 88 186 120 C166 152 114 152 94 120 Z" fill="${accent}" opacity="0.72" class="shop-neon-line"/>',
        bulwark: '<path class="shop-hull-main" d="M140 26 L194 86 L244 118 L198 146 L178 222 L140 204 L102 222 L82 146 L36 118 L86 86 Z" fill="url(#shipHullB)" opacity="0.96"/><rect x="104" y="106" width="72" height="42" rx="16" fill="rgba(223,251,255,0.38)"/><path d="M88 94 H192" stroke="${neon}" stroke-width="6" class="shop-neon-line"/>',
        fortress: '<path class="shop-hull-main" d="M140 22 L206 86 L248 118 L218 146 L194 230 L140 212 L86 230 L62 146 L32 118 L74 86 Z" fill="url(#shipHullA)" opacity="0.97"/><path d="M140 60 L176 110 L210 122 L176 134 L140 184 L104 134 L70 122 L104 110 Z" fill="rgba(223,251,255,0.54)"/><path d="M74 118 H206" stroke="${accent}" stroke-width="10" opacity="0.78" class="shop-weapon-glow"/>',
        citadel: '<path class="shop-hull-main" d="M140 16 L208 88 L248 120 L214 148 L196 238 L140 220 L84 238 L66 148 L32 120 L72 88 Z" fill="url(#shipHullB)" opacity="0.98"/><rect x="100" y="102" width="80" height="48" rx="18" fill="rgba(223,251,255,0.36)"/><path d="M94 84 H186" stroke="${neon}" stroke-width="5" class="shop-neon-line"/><circle cx="140" cy="126" r="16" fill="${accent}" opacity="0.85" class="shop-neon-dot"/>',
        lancer: '<path class="shop-hull-main" d="M140 26 L170 90 L238 118 L176 142 L140 224 L104 142 L42 118 L110 90 Z" fill="url(#shipHullB)" opacity="0.96"/><path d="M140 56 L158 110 L196 120 L158 130 L140 186 L122 130 L84 120 L122 110 Z" fill="rgba(223,251,255,0.54)"/><path d="M82 104 L66 128 L82 150" fill="none" stroke="${accent}" stroke-width="7" class="shop-weapon-glow"/><path d="M198 104 L214 128 L198 150" fill="none" stroke="${accent}" stroke-width="7" class="shop-weapon-glow"/>',
        destroyer: '<path class="shop-hull-main" d="M140 20 L188 82 L246 118 L196 144 L170 232 L140 214 L110 232 L84 144 L34 118 L92 82 Z" fill="url(#shipHullA)" opacity="0.97"/><path d="M140 52 L164 108 L206 120 L164 132 L140 190 L116 132 L74 120 L116 108 Z" fill="rgba(223,251,255,0.56)"/><path d="M76 118 H204" stroke="${accent}" stroke-width="9" class="shop-weapon-glow"/>',
        halo: '<path class="shop-hull-main" d="M140 30 L170 98 L224 118 L170 138 L140 212 L110 138 L56 118 L110 98 Z" fill="url(#shipHullA)" opacity="0.95"/><circle cx="140" cy="120" r="24" fill="url(#coreGlow)" class="shop-neon-dot"/><ellipse cx="140" cy="120" rx="74" ry="26" fill="none" stroke="${accent}" stroke-width="6" transform="rotate(-24 140 120)" class="shop-neon-line"/>',
        helios: '<path class="shop-hull-main" d="M140 26 L172 96 L228 118 L172 140 L140 222 L108 140 L52 118 L108 96 Z" fill="url(#shipHullB)" opacity="0.97"/><circle cx="140" cy="120" r="20" fill="#fff0a8" class="shop-neon-dot"/><path d="M140 70 L160 118 L140 168 L120 118 Z" fill="${accent}" opacity="0.84" class="shop-neon-line"/>',
        classic: '<path class="shop-hull-main" d="M140 34 L172 98 L230 118 L172 138 L140 214 L108 138 L50 118 L108 98 Z" fill="url(#shipHullA)" opacity="0.95"/><path d="M140 62 L156 114 L140 176 L124 114 Z" fill="rgba(223,251,255,0.56)"/><path d="M88 120 H192" stroke="${neon}" stroke-width="5" class="shop-neon-line"/>',
        vector: '<path class="shop-hull-main" d="M140 24 L176 94 L236 118 L176 142 L140 224 L104 142 L44 118 L104 94 Z" fill="url(#shipHullB)" opacity="0.97"/><path d="M140 54 L160 112 L194 120 L160 128 L140 186 L120 128 L86 120 L120 112 Z" fill="rgba(223,251,255,0.58)"/><path d="M98 92 L140 72 L182 92" fill="none" stroke="${accent}" stroke-width="4" class="shop-neon-line"/>'
    };

    const weaponMap = {
        laser: '<path d="M88 118 H56" stroke="${neon}" stroke-width="6" class="shop-weapon-glow"/><path d="M192 118 H224" stroke="${neon}" stroke-width="6" class="shop-weapon-glow"/>',
        pulse: '<circle cx="60" cy="118" r="8" fill="${accent}" class="shop-weapon-glow"/><circle cx="220" cy="118" r="8" fill="${accent}" class="shop-weapon-glow"/>',
        beam: '<path d="M82 118 H40" stroke="${accent}" stroke-width="8" stroke-linecap="round" class="shop-weapon-glow"/><path d="M198 118 H240" stroke="${accent}" stroke-width="8" stroke-linecap="round" class="shop-weapon-glow"/>',
        plasma: '<path d="M86 118 H50" stroke="${accent}" stroke-width="10" stroke-linecap="round" class="shop-weapon-glow"/><path d="M194 118 H230" stroke="${accent}" stroke-width="10" stroke-linecap="round" class="shop-weapon-glow"/><circle cx="140" cy="118" r="10" fill="${neon}" class="shop-neon-dot"/>',
        missile: '<path d="M72 98 L48 118 L72 138" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" class="shop-weapon-glow"/><path d="M208 98 L232 118 L208 138" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" class="shop-weapon-glow"/>',
        phase: '<ellipse cx="60" cy="118" rx="16" ry="8" fill="none" stroke="${accent}" stroke-width="5" class="shop-weapon-glow"/><ellipse cx="220" cy="118" rx="16" ry="8" fill="none" stroke="${accent}" stroke-width="5" class="shop-weapon-glow"/>'
    };

    if(item?.type === 'module'){
        return `<svg ${common}>${defs}${(moduleMap[art] || moduleMap.speed).replaceAll('${accent}', accent).replaceAll('${neon}', neon)}</svg>`;
    }

    const frame = (shipMap[art] || shipMap.classic)
        .replaceAll('${accent}', accent)
        .replaceAll('${neon}', neon);

    const weapons = (weaponMap[weapon] || weaponMap.laser)
        .replaceAll('${accent}', accent)
        .replaceAll('${neon}', neon);

    const engineSvg = `
      <ellipse cx="120" cy="234" rx="12" ry="30" fill="url(#engineGlow)" class="shop-engine-flame"/>
      <ellipse cx="160" cy="234" rx="12" ry="30" fill="url(#engineGlow)" class="shop-engine-flame-alt"/>
      <circle cx="120" cy="206" r="8" fill="${engine}" class="shop-neon-dot"/>
      <circle cx="160" cy="206" r="8" fill="${engine}" class="shop-neon-dot"/>`;

    return `<svg ${common}>${defs}${frame}${weapons}${engineSvg}</svg>`;
}

function renderShopMainSwitch(){
    const wrap = document.getElementById('shop-main-switch');
    const shop = document.getElementById('shop-screen');
    if(!wrap) return;
    wrap.innerHTML = `
        <button type="button" class="shop-switch-btn ${shopState.view === 'modules' ? '' : 'active'}" data-shop-view="ships">Корабли</button>
        <button type="button" class="shop-switch-btn ${shopState.view === 'modules' ? 'active' : ''}" data-shop-view="modules">Модули</button>
    `;
    wrap.querySelectorAll('[data-shop-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextView = btn.dataset.shopView === 'modules' ? 'modules' : 'ships';
            if(shopState.view === nextView) return;
            shopState.view = nextView;
            const nextList = nextView === 'modules' ? getCurrentShopModules() : getCurrentShopShips();
            shopState.selectedId = nextList[0]?.id || '';
            renderShopScreen();
        });
    });
    if(shop){
        shop.classList.toggle('shop-ships-only', shopState.view !== 'modules');
        shop.classList.toggle('shop-modules-only', shopState.view === 'modules');
    }
}


function renderShopTypeTabs(){
    const wrap = document.getElementById('shop-type-tabs');
    const typeLabel = document.getElementById('shop-type-label');
    const moduleWrap = document.getElementById('shop-module-type-tabs');
    const moduleLabel = document.getElementById('shop-module-type-label');
    if(!wrap) return;

    if(typeLabel) typeLabel.textContent = 'Классы кораблей';
    wrap.innerHTML = SHOP_DATA.types.map(type => `
        <button type="button" class="shop-type-tab ${shopState.view === 'ships' && shopState.shipType === type.id ? 'active' : ''}" data-shop-type="${type.id}">
            <span class="shop-type-name">${type.name}</span>
            <span class="shop-type-sub">${type.subtitle}</span>
        </button>
    `).join('');

    if(moduleLabel) moduleLabel.textContent = 'Классы модулей';
    if(moduleWrap){
        moduleWrap.innerHTML = SHOP_DATA.moduleTypes.map(type => `
            <button type="button" class="shop-type-tab ${shopState.view === 'modules' && shopState.moduleType === type.id ? 'active' : ''}" data-shop-module-type="${type.id}">
                <span class="shop-type-name">${type.name}</span>
                <span class="shop-type-sub">${type.subtitle}</span>
            </button>
        `).join('');
    }

    wrap.querySelectorAll('.shop-type-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            shopState.view = 'ships';
            shopState.shipType = btn.dataset.shopType || 'fighters';
            const nextList = getCurrentShopShips();
            shopState.selectedId = nextList[0]?.id || '';
            renderShopScreen();
        });
    });

    moduleWrap?.querySelectorAll('.shop-type-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            shopState.view = 'modules';
            shopState.moduleType = btn.dataset.shopModuleType || 'engine';
            const nextList = getCurrentShopModules();
            shopState.selectedId = nextList[0]?.id || '';
            renderShopScreen();
        });
    });
}


function renderShopLists(){
    const shipsList = document.getElementById('shop-ships-list');
    const modulesList = document.getElementById('shop-modules-list');
    const shipsLabel = document.getElementById('shop-ships-label');
    const modulesLabel = document.getElementById('shop-modules-label');
    if(shipsLabel) shipsLabel.style.display = 'none';
    if(shipsList) shipsList.style.display = 'none';
    if(modulesLabel) modulesLabel.style.display = 'none';
    if(modulesList) modulesList.style.display = 'none';
}


function splitItemStats(item){
    const stats = Array.isArray(item?.stats) ? item.stats : [];
    if(item?.type === 'module'){
        return {
            left: stats.slice(0, 2),
            right: stats.slice(2)
        };
    }
    return {
        left: stats.slice(0, 4),
        right: stats.slice(4)
    };
}

function getShopCurrentTitle(){
    if(shopState.view === 'modules'){
        const activeModuleType = SHOP_DATA.moduleTypes.find(type => type.id === shopState.moduleType) || SHOP_DATA.moduleTypes[0];
        return {
            title:(activeModuleType?.name || 'МОДУЛИ').toUpperCase(),
            subtitle:''
        };
    }
    const activeType = SHOP_DATA.types.find(type => type.id === shopState.shipType) || SHOP_DATA.types[0];
    return {
        title:(activeType?.name || 'КОРАБЛИ').toUpperCase(),
        subtitle:''
    };
}

function renderShopCatalog(){
    const wrap = document.getElementById('shop-catalog-list');
    const title = document.getElementById('shop-main-title');
    const subtitle = document.getElementById('shop-main-subtitle');
    if(!wrap) return;

    ensureShopOwnershipDefaults?.();

    const head = getShopCurrentTitle();
    if(title) title.textContent = head.title;
    if(subtitle) subtitle.textContent = head.subtitle;

    const list = shopState.view === 'modules' ? getCurrentShopModules() : getCurrentShopShips();

    if(!list.length){
        wrap.innerHTML = '<div class="shop-empty">Тут пока пусто.</div>';
        return;
    }

    wrap.innerHTML = list.map((item, index) => {
        const selected = shopState.selectedId === item.id;
        const cols = splitItemStats(item);
        const owned = item.type === 'ship' ? isOwnedShip(item.id) : false;
        const coinPrice = item.type === 'ship' ? getShipCoinPrice(item) : Number(item.price || 0);
        const diamondPrice = item.type === 'ship' ? getShipDiamondPrice(item) : 0;
        const priceLine = item.type === 'ship'
            ? `<div class="shop-price-line"><span class="shop-price-chip"><span class="shop-coin">🪙</span>${coinPrice}</span><span class="shop-price-chip"><span class="shop-coin">💎</span>${diamondPrice}</span></div>`
            : (item.price ? `<div class="shop-price-line"><span class="shop-price-chip"><span class="shop-coin">🪙</span>${item.price}</span></div>` : '');
        const buyText = item.type === 'module'
            ? 'Установить'
            : (owned ? ((player.selectedShipId === item.id) ? 'Выбран' : 'Выбрать') : 'Купить');

        return `
          <div class="shop-row ${selected ? 'selected' : ''} ${item.type}" data-shop-row="${item.id}">
            <div class="shop-row-level">
              <span class="shop-row-cross"></span>
              <span>${44 + index * 4}</span>
            </div>
            <div class="shop-row-preview">
              ${item.type === 'ship' ? '<div class="shop-row-pedestal"></div>' : ''}
              <div class="shop-row-orbit">${buildShopModelSvg(item)}</div>
            </div>
            <div class="shop-row-info">
              <div class="shop-row-name">${item.name}</div>
              <div class="shop-row-subtitle">${item.subtitle}</div>
              <div class="shop-row-desc">${item.description}</div>
              ${priceLine}
            </div>
            <div class="shop-stats-col">
              <div class="shop-col-title">${item.type === 'ship' ? 'Характеристики' : 'Параметры'}</div>
              ${(cols.left || []).map(([k,v]) => `<div class="shop-stat"><strong>${k}:</strong> ${v}</div>`).join('')}
            </div>
            <div class="shop-stats-col">
              <div class="shop-col-title">${item.type === 'ship' ? 'Системы и оружие' : 'Слоты и класс'}</div>
              ${(cols.right || []).map(([k,v]) => `<div class="shop-stat"><strong>${k}:</strong> ${v}</div>`).join('')}
            </div>
            <div class="shop-buy-wrap">
              <div class="shop-type-badge">${item.tier}</div>
              <button type="button" class="shop-buy-btn" data-shop-buy="${item.id}">${buyText}</button>
            </div>
          </div>
        `;
    }).join('');

    wrap.querySelectorAll('[data-shop-row]').forEach(row => {
        row.addEventListener('click', (event) => {
            if(event.target.closest('.shop-buy-btn')) return;
            shopState.selectedId = row.dataset.shopRow || '';
            renderShopScreen();
        });
    });

    wrap.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const itemId = btn.dataset.shopBuy || '';
            if(!itemId) return;
            const item = (shopState.view === 'modules' ? getModuleById(itemId) : getShopShipById(itemId));
            if(item?.type === 'module') buyModuleFromShop(itemId);
            else buyShipFromShop(itemId);
        });
    });
}

function renderShopScreen(){
    renderShopMainSwitch();
    renderShopTypeTabs();
    renderShopLists();
    renderShopCatalog();
}


function setShopMode(open){
    const shop = document.getElementById('shop-screen');
    const tabs = document.getElementById('lobby-mode-tabs');
    const note = document.getElementById('match-status-note');
    const content = document.getElementById('match-content');
    const buttons = document.getElementById('match-buttons');
    if(!shop || !content || !buttons) return;
    shopState.open = !!open;
    shop.classList.toggle('active', !!open);
    if(tabs) tabs.style.display = open ? 'none' : 'flex';
    if(note) note.style.display = open ? 'none' : 'block';
    content.style.display = open ? 'none' : 'block';
    buttons.style.display = open ? 'none' : 'flex';
    if(!open){ shopState.view = 'ships'; }
    try{ updateLobbyTabStyles?.(); }catch(_){ }
    if(open) renderShopScreen();
}

function openShopView(){
    if(gameState !== 'LOBBY') switchState('LOBBY');
    shopState.view = 'ships';
    setTimeout(() => {
        setShopMode(true);
        try{ updateLobbyTabStyles?.(); }catch(_){}
    }, gameState === 'LOBBY' ? 0 : 80);
}

function closeShopView(){
    if(!shopState.open) return;
    setShopMode(false);
}

    function bindTopNavModes(){
        const battleTab = document.getElementById('battle-zone-tab');
        const soloTab = document.getElementById('solo-tab');
        const shopTab = document.getElementById('shop-tab');

        if(battleTab && !battleTab.dataset.v26Bound){
            battleTab.dataset.v26Bound = '1';
            battleTab.onclick = () => {
                closeShopView();
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
                closeShopView();
                if(gameState !== 'LOBBY') switchState('LOBBY');
                renderLobbyList('solo');
            };
        }
        if(shopTab && !shopTab.dataset.v26Bound){
            shopTab.dataset.v26Bound = '1';
            shopTab.onclick = () => {
                openShopView();
            };
        }
    }

    const prevSwitchState = switchState;
    switchState = function(newState){
        prevSwitchState(newState);
        if(newState === 'LOBBY'){
            closeShopView();
        }
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
            setTimeout(() => {
                try{ loadChatHistory?.('battle'); }catch(_){ }
                try{ renderBattleMessages?.(); }catch(_){ }
            }, 60);
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
        if(typeof window !== 'undefined') window.lobbyModeV27 = mode;
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
        if (window.gameState !== 'BATTLE') ensureSunStable();
        updateNebulaVisibility();
    };

    const prevClearBattleScene = clearBattleScene;
    clearBattleScene = function(){
        prevClearBattleScene();
        if (window.gameState !== 'BATTLE') ensureSunStable();
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
        const lookDirection = new THREE.Vector3(
            Math.sin(observerCameraYaw) * Math.cos(observerCameraPitch),
            Math.sin(observerCameraPitch),
            -Math.cos(observerCameraYaw) * Math.cos(observerCameraPitch)
        ).normalize();
        const rightDirection = new THREE.Vector3().crossVectors(lookDirection, new THREE.Vector3(0, 1, 0)).normalize();
        const moveForward = Number(!!keys.w) - Number(!!keys.s);
        const moveRight = Number(!!keys.d) - Number(!!keys.a);
        const moveUp = Number(!!keys.space) - Number(!!keys.shift);
        const observerSpeed = 1.05;
        if(moveForward || moveRight || moveUp){
            observerFreeCameraPosition.add(lookDirection.clone().multiplyScalar(moveForward * observerSpeed));
            observerFreeCameraPosition.add(rightDirection.clone().multiplyScalar(moveRight * observerSpeed));
            observerFreeCameraPosition.y += moveUp * observerSpeed;
        }
        prevUpdateObserverBattle();
        camera.position.lerp(observerFreeCameraPosition, 0.35);
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
            ? supabaseBattleRoomsCache.filter(room => room && room.id && !isPublicBattleRoom(room.rawRoom || room))
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


function normalizePreviewPlayerEntry(rawPlayer, entry = {}, index = 0){
    const ownerId = String(entry?.owner_id || entry?.host_id || entry?.creator_id || entry?.player_id || '').trim();
    const ownerName = String(entry?.owner || entry?.host || entry?.host_name || entry?.creator || '').trim().toLowerCase();

    let id = '';
    let nickname = '';
    if(typeof rawPlayer === 'string'){
        nickname = rawPlayer.trim();
    }else if(rawPlayer && typeof rawPlayer === 'object'){
        id = String(rawPlayer.public_id || rawPlayer.player_id || rawPlayer.id || rawPlayer.user_id || '').trim();
        nickname = String(rawPlayer.nickname || rawPlayer.name || rawPlayer.player_nickname || rawPlayer.display_name || '').trim();
    }

    if(!nickname){
        nickname = `Игрок ${index + 1}`;
    }

    const isOwner = !!(
        (ownerId && id && ownerId === id) ||
        (ownerName && nickname.toLowerCase() === ownerName) ||
        (!ownerId && !ownerName && index === 0)
    );

    return { id, nickname, isOwner };
}

window.renderPlayersOnPlanet = function(entry = {}){
    const overlay = document.getElementById('map-player-overlay');
    if(!overlay) return;

    overlay.innerHTML = '';

    const rawPlayers = Array.isArray(entry?.currentPlayers) && entry.currentPlayers.length
        ? entry.currentPlayers
        : (Array.isArray(entry?.players) ? entry.players : []);

    const normalizedPlayers = rawPlayers.slice(0, 8).map((p, index) => normalizePreviewPlayerEntry(p, entry, index));

    for(let i = 0; i < normalizedPlayers.length; i++){
        const playerMeta = normalizedPlayers[i];
        const chip = document.createElement('div');
        chip.className = 'map-player-chip';

        

        if(playerMeta.isOwner){
            const crown = document.createElement('span');
            crown.className = 'map-player-owner';
            crown.textContent = '👑';
            chip.appendChild(crown);
        }

        const name = document.createElement('span');
        name.className = 'map-player-name';
        name.textContent = playerMeta.nickname;
        chip.appendChild(name);

        chip.addEventListener('click', async (event) => {
            event.stopPropagation();
            if(typeof openPlayerProfile === 'function'){
                await openPlayerProfile(playerMeta.id || '', playerMeta.nickname);
            }
        });

        overlay.appendChild(chip);
    }
}

    function syncPreview(entry){
        const preview = document.getElementById('planet-preview');
        const playersBox = document.getElementById('map-players');
        const waitNote = document.getElementById('map-waiting-note');
        const statusNote = document.getElementById('match-status-note');
        const overlay = document.getElementById('map-player-overlay');
        if(overlay) overlay.innerHTML = '';
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
        }
        if(lobbyModeV27 === 'solo'){
            window.renderPlayersOnPlanet({ players: [] });
        } else if(lobbyModeV27 === 'tournament'){
            const players = Array.isArray(entry.currentPlayers) ? entry.currentPlayers.filter(Boolean) : [];
            const maxPlayers = Number(entry.maxPlayers || 2);
            window.renderPlayersOnPlanet({ ...entry, currentPlayers: players, players: players });
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
            window.renderPlayersOnPlanet({ ...entry, currentPlayers: players, players: players });
        }
        if(waitNote) waitNote.textContent = '';
        if(statusNote){
            if(lobbyModeV27 === 'solo'){
                statusNote.textContent = entry.mission || 'Миссия против ботов';
            } else {
                statusNote.textContent = entry.title || '';
            }
        }
    }

    function renderLobbyListV27(mode = getLobbyModeSafe()){
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
            window.renderPlayersOnPlanet({ players: [] });
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
                currentRoom = buildObserveRoomState(targetMap);
                window.currentRoomId = currentRoom.id || null;
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
                const uiSelected = (typeof getSelectedLobbyMapFromUI === 'function' ? getSelectedLobbyMapFromUI() : null);
                const selectedBase = uiSelected || (selectedLobbyMap?.isBaseMap ? selectedLobbyMap : null) || (typeof LOBBY_MAP_DATA !== 'undefined' ? LOBBY_MAP_DATA[0] : null);
                if(!selectedBase) return;

                const normalizedMap = normalizeBattleMapName(selectedBase.real || selectedBase.name || selectedBase.title || 'sun');
                const roomTitleInput = document.getElementById('room-title');
                const roomTitleRaw = roomTitleInput?.value?.trim() || '';
                const roomTitle = roomTitleRaw && !/^\d+$/.test(roomTitleRaw)
                    ? roomTitleRaw
                    : `${selectedBase.title || normalizedMap} Room`;
                const playerCount = Number(document.getElementById('player-count')?.value || 8);
                const minLevel = Number(document.getElementById('min-level')?.value || 1);
                const maxLevel = Number(document.getElementById('max-level')?.value || 120);
                const hostName = (typeof player !== 'undefined' && player?.nickname) ? player.nickname : 'Commander';

                const created = await createGameRoom(roomTitle, normalizedMap, playerCount, hostName);
                if(!created) return;

                currentRoom = {
                    id: created.id,
                    title: created.room_name,
                    map: normalizedMap,
                    real: normalizedMap,
                    name: normalizedMap,
                    img: selectedBase.img || normalizedMap,
                    mode: 'DM',
                    minLevel,
                    maxLevel,
                    maxPlayers: created.max_players || playerCount,
                    players:[getDisplayPlayerTag()],
                    currentPlayers:[getDisplayPlayerTag()],
                    state:'battle',
                    isBaseMap:false
                };

                selectedLobbyMap = { ...currentRoom };
                window.currentRoomId = currentRoom.id || null;
                document.getElementById('create-match-window')?.classList.add('hidden');
                if(roomTitleInput) roomTitleInput.value = '';

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
        if (window.gameState !== 'BATTLE') ensureSunStable();
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
        if(newState === 'LOBBY'){
            closeShopView();
        }
        if(newState === 'ORBIT'){
            if (window.gameState !== 'BATTLE') ensureSunStable();
        }
    };
    window.switchState = switchState;

    window.addEventListener('load', () => {
        bindLobbyModeButtons();
        bindActionButtons();
        bindCreateWindows();
        if (window.gameState !== 'BATTLE') ensureSunStable();
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

function isPublicBattleRoom(room){
  const roomName = String(room?.room_name || room?.title || '').trim().toLowerCase();
  return roomName.startsWith('public ');
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

function getRoomOccupantsFromRoomPlayers(room = null){
  return Array.isArray(room?.room_players)
    ? room.room_players
        .slice()
        .sort((a, b) => new Date(a?.joined_at || 0) - new Date(b?.joined_at || 0))
        .map(item => item?.nickname || item?.player_id)
        .filter(Boolean)
    : [];
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

function rebuildBattleMapOccupants(rooms = [], presenceRows = []){
  const next = new Map();
  (rooms || []).forEach(room => {
    if(!isPublicBattleRoom(room)) return;
    const mapKey = normalizeBattleMapName(room?.map_name || room?.real || room?.map || 'earth');
    const livePlayers = getRoomOccupantsFromPresence(room?.id, presenceRows);
    const merged = mergeUniquePlayers(next.get(mapKey) || [], livePlayers);
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
  const joinedPlayers = getRoomOccupantsFromRoomPlayers(room);
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
    experience: Number(playerData.experience || player.experience || 0),
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
    .select('public_id,nickname,level,experience,credits,auth_id,email,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
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
  if(typeof data?.experience !== 'undefined') player.experience = Number(data.experience) || 0;
  if(typeof data?.credits !== 'undefined') player.credits = Number(data.credits) || 0;
  applyPlayerIdentityRow(data || {});
  applyPlayerResourcesFromRow(data || {});
  updatePremiumAccountInfo?.();
  data.map_name = normalizeBattleMapName(data.map_name || data.room_name || 'earth');
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
    
try {
    renderBattleMessages && renderBattleMessages();
    renderLobbyMessages && renderLobbyMessages();
    renderChatTabs && renderChatTabs();
} catch(e){}

return true;
  }

  const insertPayload = {
    id: (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    room_id: roomId,
    player_id: identity.playerId,
    nickname: identity.displayName,
    joined_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    team: getBattleRoomPlayerTeam(identity.playerId),
    level: Number(player?.level || 1) || 1,
    ping: Number(getBattlePingValue() || 0) || 0
  };

  const { data: insertedRow, error } = await window.supabaseClient
    .from('room_players')
    .insert([insertPayload])
    .select('id,room_id,player_id,nickname,joined_at');

  if (error) {
    console.error('Ошибка входа в room_players:', error, insertPayload);
    return false;
  }


  await loadRoomsFromSupabase();
  if(gameState === 'LOBBY' && typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
    renderLobbyListV27('battle');
  }
  
try {
    renderBattleMessages && renderBattleMessages();
    renderLobbyMessages && renderLobbyMessages();
    renderChatTabs && renderChatTabs();
} catch(e){}

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

  try {
    removeRemoteBattleShipById(identity.playerId);
  } catch(_) {}

  const freshCutoff = getRoomPlayerFreshCutoffIso();

  try{
    await window.supabaseClient
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .lt('updated_at', freshCutoff);
  }catch(_){}

  const { count, error: countError } = await window.supabaseClient
    .from('room_players')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .gte('updated_at', freshCutoff);

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

function cleanupBattleRoomSilently(){
  const roomSnapshot = currentRoom ? { ...currentRoom } : null;
  const roomId = roomSnapshot?.id || roomSnapshot?.roomId || null;
  const shouldLeave = !!(roomId && roomSnapshot?.state !== 'solo' && roomSnapshot?.observer !== true);

  currentRoom = null;
  window.currentRoomId = null;
  selectedLobbyMap = null;

  if(shouldLeave){
    leaveRoomPlayers(roomId)
      .then(async (leftCount) => {
        if((leftCount || 0) <= 0 && window.supabaseReady && window.supabaseClient){
          await window.supabaseClient.from('rooms').delete().eq('id', roomId);
        }
        await loadRoomsFromSupabase();
        if(typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
          renderLobbyListV27('battle');
        }
      })
      .catch(async (error) => {
        console.warn('cleanupBattleRoomSilently error:', error);
        try{
          if(window.supabaseReady && window.supabaseClient){
            await window.supabaseClient.from('rooms').delete().eq('id', roomId);
            await loadRoomsFromSupabase();
            if(typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
              renderLobbyListV27('battle');
            }
          }
        }catch(_){}
      });
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
          }
  }, LIVE_ROOMS_REFRESH_MS);
}

async function loadRoomsFromSupabase() {
  if (!window.supabaseReady || !window.supabaseClient) {
        return [];
  }

  const cutoffIso = getOnlineFreshCutoffIso();
  const [roomsResponse, onlineResponse] = await Promise.all([
    window.supabaseClient
      .from('rooms')
      .select('*, room_players(player_id,nickname,joined_at,updated_at,team,level,ping)')
      .order('created_at', { ascending: true }),
    window.supabaseClient
      .from('online_players')
      .select('player_id,nickname,room_id,status,updated_at')
      .eq('status', 'in-game')
      .gte('updated_at', cutoffIso)
  ]);

  const { data, error } = roomsResponse;
  const { data: onlineData, error: onlineError } = onlineResponse;

  if (error) {
    console.error('Ошибка загрузки комнат:', error);
    return [];
  }
  if (onlineError) {
    console.warn('Не удалось загрузить active presence для комнат:', onlineError);
  }

  const presenceRows = Array.isArray(onlineData) ? onlineData.filter(row => row?.room_id) : [];
  let allRooms = Array.isArray(data) ? data : [];

  const staleRoomPlayers = [];
  allRooms.forEach(room => {
    const rows = Array.isArray(room?.room_players) ? room.room_players : [];
    rows.forEach(row => {
      if(row?.room_id && !isFreshRoomPlayerRow(row)){
        staleRoomPlayers.push(row.player_id);
      }
    });
    room.room_players = rows.filter(row => isFreshRoomPlayerRow(row));
  });

  if(staleRoomPlayers.length){
    try{
      await window.supabaseClient
        .from('room_players')
        .delete()
        .in('player_id', staleRoomPlayers);
    }catch(_){}
  }

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
    allRooms = allRooms.filter(room => !emptyRoomIds.includes(room.id));
  }

  rebuildBattleMapOccupants(allRooms, presenceRows);

  const visibleRooms = allRooms.filter(room => room?.id && Array.isArray(room.room_players) && room.room_players.length > 0);
  supabaseBattleRoomsCache = visibleRooms.map(room => {
    const mapped = mapSupabaseRoomToLobbyEntry(room, presenceRows);
    const myName = getDisplayPlayerTag?.() || '';
    const players = Array.isArray(mapped.currentPlayers) ? mapped.currentPlayers : [];
    if(players.includes(myName)){
      mapped.ping = getBattlePingValue();
    }
    return mapped;
  });

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

  return supabaseBattleRoomsCache;
}

async function renderRoomsInLobby(forceBattleMode = false) {
  await loadRoomsFromSupabase();

  if (typeof renderLobbyListV27 === 'function') {
    renderLobbyListV27(forceBattleMode ? 'battle' : getLobbyModeSafe());
    return;
  }

  const matchList = document.getElementById('match-list');
  if (!matchList) {
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
      window.renderPlayersOnPlanet({ ...selectedLobbyMap, currentPlayers: occupants, players: occupants });
      const waitNote = document.getElementById('map-waiting-note');
      if (waitNote) waitNote.textContent = '';
      const statusNote = document.getElementById('match-status-note');
      if (statusNote) statusNote.textContent = entry.title || '';
    });
    matchList.appendChild(el);
  });

  const first = matchList.querySelector('.match-item');
  if (first) first.click();
}

async function createGameRoom(roomName, mapName, maxPlayers, hostName) {
  if (!window.supabaseReady || !window.supabaseClient) {
        return null;
  }

  const normalizedMap = normalizeBattleMapName(mapName);
  const safeRoomName = String(roomName || '').trim() || `Public ${String(normalizedMap || 'earth').toUpperCase()}`;
  const isPublicRoom = /^public\s+/i.test(safeRoomName);

  let existingQuery = window.supabaseClient
    .from('rooms')
    .select('*')
    .eq('map_name', normalizedMap)
    .limit(1);

  if (isPublicRoom) {
    existingQuery = existingQuery.eq('room_name', safeRoomName);
  } else {
    existingQuery = existingQuery.eq('room_name', safeRoomName).eq('host_name', hostName);
  }

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    console.error('Ошибка проверки существующей комнаты:', existingError);
    return null;
  }

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    const existingRoom = existingRows[0];
    const joinedExisting = await joinRoomPlayers(existingRoom.id);
    if (!joinedExisting) return null;
    await loadRoomsFromSupabase();
    if(typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
      renderLobbyListV27('battle');
    }
    existingRoom.map_name = normalizeBattleMapName(existingRoom.map_name || existingRoom.room_name || 'earth');
    return existingRoom;
  }

  const { data, error } = await window.supabaseClient
    .from('rooms')
    .insert([
      {
        room_name: safeRoomName,
        map_name: normalizedMap,
        max_players: maxPlayers,
        host_name: isPublicRoom ? 'SYSTEM' : hostName
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
      <button type="button" class="player-menu-btn" data-action="profile" style="width:100%;display:block;text-align:left;margin:0 0 6px;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.04);color:#fff;cursor:pointer;">👤 Открыть профиль</button>
      <button type="button" class="player-menu-btn" data-action="pm" ${canPm ? '' : 'disabled'} style="width:100%;display:block;text-align:left;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:${canPm ? 'rgba(0,180,255,0.16)' : 'rgba(255,255,255,0.04)'};color:${canPm ? '#dff8ff' : '#7f8a96'};cursor:${canPm ? 'pointer' : 'not-allowed'};">✉️ Личное сообщение</button>
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
