// COSMIC CLICKER v466 - REMOTE SHIELD + BIGGER NICK
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';




// ===============================
// PLAYER MODEL (локально)
// ===============================

let player = {
  id: 0,
  nickname: "Commander",
  level: 1,
  experience: 0,
  credits: 2500,
  ships: [],
  ownedShipIds: ['scout_1'],
  selectedShipId: 'scout_1',
  ownedModuleIds: ['weapon_laser_s1','shield_micro_s1','booster_ion_s1'],
  activeModulesByShip: { scout_1: { weapon: 'weapon_laser_s1', shield: 'shield_micro_s1', booster: 'booster_ion_s1' } },
  hangarDockAssignments: { scout_1: 0 },
  staff_role: 'player'
};

// 🔥 ТЕСТОВЫЙ КОРАБЛЬ (можешь потом удалить)
player.ships.push({
  id: 'scout_1',
  name: "Cargo Drone",
  level: 1,
  hp: 100,
  attack: 10,
  speed: 5,
  art: 'arrow',
  neon: '#7efcff',
  engine: '#63d1ff',
  accent: '#7a8cff',
  modelPath: '/ships/Spaceship.glb'
});

/* ================= GAME STATE ================= */

let gameState = "AUTH";
let currentRoom = null;
let activeBattleChatRoomId = null;
const GLOBAL_BATTLE_ARCHIVE_ROOM_ID = '__global_battle_archive__';

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
const laserCooldown = 120;
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
let soloEnemyBots = [];
let soloBotScoreRows = new Map();
let lastEndlessBotSpawnAt = 0;
const ENDLESS_SOLO_MAX_BOTS = 10;
const ENDLESS_SOLO_BASE_BOTS = 1;
const ENDLESS_SOLO_KILLS_PER_EXTRA_BOT = 20; // controlled spawn
let endlessSoloCurrentStage = 1;
let endlessSoloLastBannerStage = 1;
let endlessSoloLastKillCount = 0;


const ENDLESS_SOLO_SPAWN_COOLDOWN_MS = 2400; // disabled by huge cooldown
let enemyLasers = [];
let battleObjects = [];
let battleMapPlanet = null;
let selectedLobbyMap = null;
let lastBotShotAt = 0;
const botShotCooldown = 1300;
let playerHp = 100;
let playerMaxHp = 100;
let playerShield = 0;
let playerMaxShield = 0;
let playerShieldMeshV460 = null;
let playerShieldFlashUntilV460 = 0;
let playerShieldMeshesV462 = [];
const REMOTE_SHIELD_SCALE_V466 = 1.55;
const REMOTE_SHIELD_OPACITY_V466 = 0.38;
const battleStats = { playerKills:0, playerDeaths:0, botKills:0, botDeaths:0 };

// ===== V438 PROFILE REAL STATS (persistent, not only current battle session) =====
const profileBattleStats = {
    totalKills: 0,
    totalDeaths: 0,
    teamPoints: 0,
    flagsCaptured: 0,
    tournamentWins: 0
};
let profileStatsSaveTimer = null;

function getProfileStatsStorageKeyV439(){
    const accountId = String(authState?.playerId || authState?.email || player?.id || player?.nickname || 'guest').trim() || 'guest';
    return `cosmicProfileBattleStats:${accountId}`;
}

function persistProfileBattleStatsLocalV439(){
    try{
        const key = getProfileStatsStorageKeyV439();
        if(!key) return;
        localStorage.setItem(key, JSON.stringify({
            totalKills: getProfileStatSafeNumberV438(profileBattleStats.totalKills),
            totalDeaths: getProfileStatSafeNumberV438(profileBattleStats.totalDeaths),
            teamPoints: getProfileStatSafeNumberV438(profileBattleStats.teamPoints),
            flagsCaptured: getProfileStatSafeNumberV438(profileBattleStats.flagsCaptured),
            tournamentWins: getProfileStatSafeNumberV438(profileBattleStats.tournamentWins)
        }));
    }catch(_){}
}

function loadProfileBattleStatsLocalV439(){
    try{
        const key = getProfileStatsStorageKeyV439();
        if(!key) return null;
        const raw = localStorage.getItem(key);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object') return parsed;
    }catch(_){}
    return null;
}

function getProfileStatSafeNumberV438(value = 0){
    const num = Number(value || 0);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

function readProfileBattleStatsFromSourceV438(source = {}){
    const stats = (source?.battleStats && typeof source.battleStats === 'object') ? source.battleStats : {};
    return {
        totalKills: Math.max(
            getProfileStatSafeNumberV438(source?.totalKills),
            getProfileStatSafeNumberV438(source?.total_kills),
            getProfileStatSafeNumberV438(source?.killsTotal),
            getProfileStatSafeNumberV438(source?.playerKills),
            getProfileStatSafeNumberV438(stats?.totalKills),
            getProfileStatSafeNumberV438(stats?.playerKills)
        ),
        totalDeaths: Math.max(
            getProfileStatSafeNumberV438(source?.totalDeaths),
            getProfileStatSafeNumberV438(source?.total_deaths),
            getProfileStatSafeNumberV438(source?.deathsTotal),
            getProfileStatSafeNumberV438(source?.playerDeaths),
            getProfileStatSafeNumberV438(stats?.totalDeaths),
            getProfileStatSafeNumberV438(stats?.playerDeaths)
        ),
        teamPoints: Math.max(getProfileStatSafeNumberV438(source?.teamPoints), getProfileStatSafeNumberV438(source?.team_points), getProfileStatSafeNumberV438(stats?.teamPoints)),
        flagsCaptured: Math.max(getProfileStatSafeNumberV438(source?.flagsCaptured), getProfileStatSafeNumberV438(source?.flags_captured), getProfileStatSafeNumberV438(stats?.flagsCaptured)),
        tournamentWins: Math.max(getProfileStatSafeNumberV438(source?.tournamentWins), getProfileStatSafeNumberV438(source?.tournament_wins), getProfileStatSafeNumberV438(stats?.tournamentWins))
    };
}

function syncProfileBattleStatsFromSaveV438(source = {}){
    const localSavedV439 = loadProfileBattleStatsLocalV439?.() || {};
    const next = readProfileBattleStatsFromSourceV438(source || {});
    const localNext = readProfileBattleStatsFromSourceV438(localSavedV439 || {});
    profileBattleStats.totalKills = Math.max(profileBattleStats.totalKills, next.totalKills, localNext.totalKills);
    profileBattleStats.totalDeaths = Math.max(profileBattleStats.totalDeaths, next.totalDeaths, localNext.totalDeaths);
    profileBattleStats.teamPoints = Math.max(profileBattleStats.teamPoints, next.teamPoints, localNext.teamPoints);
    profileBattleStats.flagsCaptured = Math.max(profileBattleStats.flagsCaptured, next.flagsCaptured, localNext.flagsCaptured);
    profileBattleStats.tournamentWins = Math.max(profileBattleStats.tournamentWins, next.tournamentWins, localNext.tournamentWins);
    try{ persistProfileBattleStatsLocalV439(); }catch(_){}
}

function getProfileBattleTotalsForSaveV438(){
    return {
        totalKills: Math.max(getProfileStatSafeNumberV438(profileBattleStats.totalKills), getProfileStatSafeNumberV438(battleStats?.playerKills)),
        totalDeaths: Math.max(getProfileStatSafeNumberV438(profileBattleStats.totalDeaths), getProfileStatSafeNumberV438(battleStats?.playerDeaths)),
        teamPoints: getProfileStatSafeNumberV438(profileBattleStats.teamPoints),
        flagsCaptured: getProfileStatSafeNumberV438(profileBattleStats.flagsCaptured),
        tournamentWins: getProfileStatSafeNumberV438(profileBattleStats.tournamentWins)
    };
}

function scheduleProfileStatsSaveV438(){
    try{
        if(profileStatsSaveTimer) clearTimeout(profileStatsSaveTimer);
        profileStatsSaveTimer = setTimeout(() => {
            profileStatsSaveTimer = null;
            try{ saveGame?.(); }catch(_){}
        }, 1200);
    }catch(_){}
}

function recordProfileBattleStatsV438(killsDelta = 0, deathsDelta = 0){
    const kd = getProfileStatSafeNumberV438(killsDelta);
    const dd = getProfileStatSafeNumberV438(deathsDelta);
    if(!kd && !dd) return;
    try{ syncProfileBattleStatsFromSaveV438(loadProfileBattleStatsLocalV439?.() || {}); }catch(_){}
    profileBattleStats.totalKills = Math.max(0, getProfileStatSafeNumberV438(profileBattleStats.totalKills) + kd);
    profileBattleStats.totalDeaths = Math.max(0, getProfileStatSafeNumberV438(profileBattleStats.totalDeaths) + dd);
    try{ persistProfileBattleStatsLocalV439(); }catch(_){}
    scheduleProfileStatsSaveV438();
}


// ===== V440 PROFILE SKILLS (120 points = 12 skills x 10 levels) =====
const PROFILE_SKILLS_V440 = [
    { id:'health', icon:'❤️', name:'Здоровье', desc:'+ HP корабля' },
    { id:'shield', icon:'🛡️', name:'Щит', desc:'+ прочность щита' },
    { id:'shieldRegen', icon:'♻️', name:'Реген щита', desc:'быстрее восстановление' },
    { id:'speed', icon:'⚡', name:'Скорость', desc:'+ скорость полёта' },
    { id:'boost', icon:'🚀', name:'Форсаж', desc:'+ длительность SHIFT' },
    { id:'energySave', icon:'🔋', name:'Экономия энергии', desc:'меньше расход энергии' },
    { id:'maneuver', icon:'🌀', name:'Манёвренность', desc:'+ скорость поворота' },
    { id:'damage', icon:'💥', name:'Урон', desc:'+ урон оружия' },
    { id:'accuracy', icon:'🎯', name:'Точность', desc:'меньше разброс' },
    { id:'reload', icon:'🔄', name:'Перезарядка', desc:'быстрее перезарядка' },
    { id:'crit', icon:'✨', name:'Крит', desc:'+ шанс крита' },
    { id:'mining', icon:'⛏️', name:'Добыча', desc:'+ ресурсы с орбиты' }
];

const PROFILE_SKILL_MAX_LEVEL_V440 = 10;
let playerSkillLevelsV440 = {};

function ensureProfileSkillLevelsV440(){
    if(!playerSkillLevelsV440 || typeof playerSkillLevelsV440 !== 'object') playerSkillLevelsV440 = {};
    PROFILE_SKILLS_V440.forEach(skill => {
        const value = Number(playerSkillLevelsV440[skill.id] || 0);
        playerSkillLevelsV440[skill.id] = Math.max(0, Math.min(PROFILE_SKILL_MAX_LEVEL_V440, Number.isFinite(value) ? Math.floor(value) : 0));
    });
    Object.keys(playerSkillLevelsV440).forEach(key => {
        if(!PROFILE_SKILLS_V440.some(skill => skill.id === key)) delete playerSkillLevelsV440[key];
    });
    return playerSkillLevelsV440;
}

function getProfileSkillTotalPointsV440(){
    const lvl = Number(player?.level || currentLevel || 1) || 1;
    return Math.max(0, Math.min(120, Math.floor(lvl)));
}

function getProfileSkillSpentPointsV440(){
    const levels = ensureProfileSkillLevelsV440();
    return PROFILE_SKILLS_V440.reduce((sum, skill) => sum + (Number(levels[skill.id] || 0) || 0), 0);
}

function getProfileSkillFreePointsV440(){
    return Math.max(0, getProfileSkillTotalPointsV440() - getProfileSkillSpentPointsV440());
}

function getProfileSkillsForSaveV440(){
    const levels = ensureProfileSkillLevelsV440();
    return JSON.parse(JSON.stringify(levels));
}

const PROFILE_SKILL_RESET_COST_DIAMONDS_V459 = 5;
let isApplyingSaveDataV459 = false;

function getProfileSkillStorageKeyV459(){
    const accountId = String(authState?.playerId || authState?.email || player?.id || player?.nickname || 'guest').trim() || 'guest';
    return `cosmicProfileSkillLevels:${accountId}`;
}

function saveProfileSkillsLocalV459(){
    try{
        localStorage.setItem(getProfileSkillStorageKeyV459(), JSON.stringify(getProfileSkillsForSaveV440()));
    }catch(_){}
}

function loadProfileSkillsLocalV459(){
    try{
        const raw = localStorage.getItem(getProfileSkillStorageKeyV459());
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    }catch(_){
        return null;
    }
}

function getProfileDiamondBalanceV459(){
    return Math.max(
        Number(playerResources?.crystals || 0) || 0,
        Number(playerResources?.diamonds || 0) || 0,
        Number(player?.crystals || 0) || 0,
        Number(player?.diamonds || 0) || 0
    );
}

function spendProfileDiamondsV459(amount = 0){
    const cost = Math.max(0, Number(amount || 0) || 0);
    if(cost <= 0) return true;
    const current = getProfileDiamondBalanceV459();
    if(current < cost) return false;

    const next = Math.max(0, current - cost);
    try{ playerResources.crystals = next; }catch(_){}
    try{ playerResources.diamonds = next; }catch(_){}
    try{ player.crystals = next; }catch(_){}
    try{ player.diamonds = next; }catch(_){}
    try{ markLocalResourceDirty?.(7000); }catch(_){}
    return true;
}

function getProfileSkillLevelV459(skillId = ''){
    const levels = ensureProfileSkillLevelsV440();
    return Math.max(0, Math.min(PROFILE_SKILL_MAX_LEVEL_V440, Number(levels[String(skillId || '').trim()] || 0) || 0));
}

function getProfileSkillBonusV459(skillId = '', perLevel = 0){
    return getProfileSkillLevelV459(skillId) * Number(perLevel || 0);
}

function applyProfileSkillsLocalFallbackV459(){
    const local = loadProfileSkillsLocalV459();
    if(local && typeof local === 'object'){
        applyProfileSkillsFromSaveV440({ skillLevels: local });
    }else{
        ensureProfileSkillLevelsV440();
    }
}


function applyProfileSkillsFromSaveV440(save = {}){
    const source = (save?.skillLevels && typeof save.skillLevels === 'object')
        ? save.skillLevels
        : ((save?.skills && typeof save.skills === 'object') ? save.skills : null);
    if(!source) return;
    playerSkillLevelsV440 = {};
    PROFILE_SKILLS_V440.forEach(skill => {
        const raw = Number(source[skill.id] || 0);
        playerSkillLevelsV440[skill.id] = Math.max(0, Math.min(PROFILE_SKILL_MAX_LEVEL_V440, Number.isFinite(raw) ? Math.floor(raw) : 0));
    });
    ensureProfileSkillLevelsV440();
    try{ saveProfileSkillsLocalV459?.(); }catch(_){}
}

function renderProfileSkillBarsV440(level = 0){
    const safeLevel = Math.max(0, Math.min(PROFILE_SKILL_MAX_LEVEL_V440, Number(level || 0) || 0));
    let html = '<div class="profile-skill-bars-v440">';
    for(let i = 1; i <= PROFILE_SKILL_MAX_LEVEL_V440; i++){
        html += `<span class="profile-skill-bar-v440 ${i <= safeLevel ? 'filled' : ''}"></span>`;
    }
    html += '</div>';
    return html;
}


function getProfileSelectedShipItemV444(sourceProfile = null){
    try{
        const src = (sourceProfile && typeof sourceProfile === 'object') ? sourceProfile : player;
        const selectedId = String(
            src?.selectedShipId ||
            src?.selected_ship_id ||
            src?.selected_ship ||
            src?.shipId ||
            src?.ship_id ||
            player?.selectedShipId ||
            ''
        ).trim();

        const allShips = [];
        try{ if(Array.isArray(player?.ships)) allShips.push(...player.ships); }catch(_){}
        try{ if(Array.isArray(getAllShopShips?.())) allShips.push(...getAllShopShips()); }catch(_){}
        try{ if(window.__cosmicShopData?.shipsByType) allShips.push(...Object.values(window.__cosmicShopData.shipsByType).flat()); }catch(_){}

        if(selectedId){
            const found = allShips.find(s => String(s?.id || '').trim() === selectedId)
                || getShopShipById?.(selectedId)
                || findOwnedHangarShipById?.(selectedId)
                || null;

            if(found) return found;
            return { id:selectedId, name:selectedId, modelPath:'/ships/Spaceship.glb' };
        }

        const fallbackId = String(player?.selectedShipId || 'scout_1').trim();
        return allShips.find(s => String(s?.id || '').trim() === fallbackId)
            || getShopShipById?.(fallbackId)
            || player?.ships?.[0]
            || { id:fallbackId, name:fallbackId, modelPath:'/ships/Spaceship.glb' };
    }catch(_){
        return { id:'scout_1', name:'Cargo Drone', modelPath:'/ships/Spaceship.glb' };
    }
}

function getProfileSelectedShipNameV443(sourceProfile = null){
    try{
        const item = getProfileSelectedShipItemV444?.(sourceProfile || player) || {};
        return String(item?.name || item?.title || item?.label || item?.id || 'Выбранный корабль').trim() || 'Выбранный корабль';
    }catch(_){
        return 'Выбранный корабль';
    }
}

function getProfileSelectedShipIconV444(item = null){
    const safeId = String(item?.id || player?.selectedShipId || '').trim();
    if(safeId === 'xwing_1') return '✦';
    if(safeId === 'scout_1') return '🚀';
    return '🚀';
}

function renderProfileSelectedShipPreviewV443(sourceProfile = null){
    const src = (sourceProfile && typeof sourceProfile === 'object') ? sourceProfile : player;
    const item = getProfileSelectedShipItemV444?.(src) || {};
    const name = getProfileSelectedShipNameV443(src);
    const selectedId = String(item?.id || src?.selectedShipId || src?.selected_ship_id || player?.selectedShipId || 'scout_1').trim();
    const modelPath = String(item?.modelPath || item?.model_path || item?.path || '/ships/Spaceship.glb').trim() || '/ships/Spaceship.glb';

    return `
      <div class="profile-ship-preview-v448" data-selected-ship-id="${escapeProfileHtmlV428(selectedId)}" data-profile-ship-model="${escapeProfileHtmlV428(modelPath)}">
        <div id="profile-ship-3d-canvas-v445" class="profile-ship-3d-canvas-v445"></div>
        <div class="profile-ship-name-v443">Выбран: ${escapeProfileHtmlV428(name)}</div>
      </div>
    `;
}


// ===== V445 PROFILE 3D SELECTED SHIP PREVIEW =====
let profileShipPreview3DV445 = null;

function disposeProfileShipPreview3DV445(){
    try{
        if(profileShipPreview3DV445?.frame){
            cancelAnimationFrame(profileShipPreview3DV445.frame);
        }

        if(profileShipPreview3DV445?.renderer){
            try{
                profileShipPreview3DV445.renderer.setAnimationLoop?.(null);
            }catch(_){}

            try{
                profileShipPreview3DV445.renderer.forceContextLoss?.();
            }catch(_){}

            try{
                profileShipPreview3DV445.renderer.dispose?.();
            }catch(_){}

            try{
                profileShipPreview3DV445.renderer.domElement?.remove?.();
            }catch(_){}
        }

        profileShipPreview3DV445 = null;
    }catch(_){
        profileShipPreview3DV445 = null;
    }
}

function makeProfileFallbackShipV445(){
    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 1.45, 4),
        new THREE.MeshStandardMaterial({ color:0xeefcff, metalness:0.45, roughness:0.32, emissive:0x123344, emissiveIntensity:0.25 })
    );
    body.rotation.z = Math.PI / 2;
    group.add(body);

    const wingMat = new THREE.MeshStandardMaterial({ color:0x7eefff, metalness:0.25, roughness:0.38, emissive:0x004455, emissiveIntensity:0.35 });
    const wing1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.08), wingMat);
    wing1.position.set(-0.12, 0.42, 0);
    wing1.rotation.z = 0.75;
    group.add(wing1);

    const wing2 = wing1.clone();
    wing2.position.y = -0.42;
    wing2.rotation.z = -0.75;
    group.add(wing2);

    const fire = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.42, 16),
        new THREE.MeshBasicMaterial({ color:0xff8a22 })
    );
    fire.rotation.z = -Math.PI / 2;
    fire.position.x = -0.82;
    group.add(fire);

    return group;
}

function normalizeProfileShipObjectV445(object){
    try{
        const pivot = new THREE.Group();

        const boxBefore = new THREE.Box3().setFromObject(object);
        const sizeBefore = boxBefore.getSize(new THREE.Vector3());
        const maxSize = Math.max(sizeBefore.x, sizeBefore.y, sizeBefore.z, 0.001);

        // Размер оставлен нормальным. Не уменьшаем корабль, только центрируем ось.
        const scale = 2.05 / maxSize;
        object.scale.multiplyScalar(scale);

        object.updateMatrixWorld(true);
        const boxAfter = new THREE.Box3().setFromObject(object);
        const centerAfter = boxAfter.getCenter(new THREE.Vector3());

        // ВАЖНО: переносим модель так, чтобы её геометрический центр был в (0,0,0).
        // Тогда вращение идёт от центра корпуса, а не от носа/импортного origin.
        object.position.set(-centerAfter.x, -centerAfter.y, -centerAfter.z);

        pivot.add(object);
        pivot.rotation.set(0.15, -0.45, 0.04);
        return pivot;
    }catch(_){
        return object;
    }
}

function initProfileSelectedShip3DPreviewV445(){
    const host = document.getElementById('profile-ship-3d-canvas-v445');
    if(!host) return;

    disposeProfileShipPreview3DV445();
    host.innerHTML = '';

    const wrap = host.closest('[data-profile-ship-model]');
    const domShipId = String(wrap?.getAttribute('data-selected-ship-id') || player?.selectedShipId || 'scout_1').trim();
    const item = getProfileSelectedShipItemV444?.({ selectedShipId: domShipId }) || {};
    const domModelPath = String(wrap?.getAttribute('data-profile-ship-model') || '').trim();
    const modelPath = String(domModelPath || item?.modelPath || item?.model_path || item?.path || '/ships/Spaceship.glb').trim() || '/ships/Spaceship.glb';

    const width = Math.max(170, host.clientWidth || 230);
    const height = Math.max(116, host.clientHeight || 128);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.42, 4.35);

    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'profile-ship-3d-renderer-v445';
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x9fefff, 1.65));

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key);

    const rim = new THREE.PointLight(0x00eaff, 2.2, 9);
    rim.position.set(-2.5, 1.5, 2.4);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);

    const fallback = normalizeProfileShipObjectV445(makeProfileFallbackShipV445());
    modelRoot.add(fallback);

    try{
        const loader = new GLTFLoader();
        loader.load(modelPath, (gltf) => {
            try{
                modelRoot.clear();
                const src = gltf.scene || gltf.scenes?.[0];
                const centered = normalizeProfileShipObjectV445(src);
                modelRoot.add(centered);
            }catch(error){
                console.warn('profile ship model normalize warning:', error?.message || error);
            }
        }, undefined, (error) => {
            console.warn('profile ship model load warning:', modelPath, error?.message || error);
        });
    }catch(error){
        console.warn('profile ship loader warning:', error?.message || error);
    }

    profileShipPreview3DV445 = { renderer, scene, camera, modelRoot, frame:0, shipId:domShipId };

    const animate = () => {
        if(!document.body.contains(host)){
            disposeProfileShipPreview3DV445();
            return;
        }
        modelRoot.rotation.y += 0.014;
        modelRoot.rotation.x = Math.sin(Date.now() / 900) * 0.025;
        renderer.render(scene, camera);
        if(profileShipPreview3DV445){
            profileShipPreview3DV445.frame = requestAnimationFrame(animate);
        }
    };
    animate();
}





function setSelectedShipIdEverywhereV448(shipId = ''){
    const safeId = String(shipId || '').trim();
    if(!safeId) return;
    try{ player.selectedShipId = safeId; }catch(_){}
    try{ localStorage.setItem('cosmicSelectedShipId', safeId); }catch(_){}
    try{ currentBattleShipStats = computeShipBattleStats?.(safeId) || currentBattleShipStats; }catch(_){}
    try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){}
    try{ setTimeout(() => { refreshProfileShipPreviewIfOpenV446?.(); }, 60); }catch(_){}
}

function restoreSelectedShipFromLocalV447(){
    try{
        const saved = String(localStorage.getItem('cosmicSelectedShipId') || '').trim();
        if(saved && player && String(player.selectedShipId || '').trim() !== saved){
            player.selectedShipId = saved;
            try{ currentBattleShipStats = computeShipBattleStats?.(saved) || currentBattleShipStats; }catch(_){}
        }
    }catch(_){}
}

function refreshProfileShipPreviewIfOpenV446(){
    try{
        const oldWrap = document.querySelector('#profile-window .profile-ship-preview-v443, #profile-window .profile-ship-preview-v448');
        if(!oldWrap) return;

        const selectedId = String(player?.selectedShipId || localStorage.getItem('cosmicSelectedShipId') || 'scout_1').trim();

        const item = getProfileSelectedShipItemV444?.({ selectedShipId:selectedId }) || {};
        const modelPath = String(item?.modelPath || item?.model_path || item?.path || '/ships/Spaceship.glb').trim() || '/ships/Spaceship.glb';
        const name = getProfileSelectedShipNameV443?.({ selectedShipId:selectedId }) || item?.name || selectedId;

        oldWrap.className = 'profile-ship-preview-v448';
        oldWrap.setAttribute('data-selected-ship-id', selectedId);
        oldWrap.setAttribute('data-profile-ship-model', modelPath);

        oldWrap.innerHTML = `
            <div id="profile-ship-3d-canvas-v445" class="profile-ship-3d-canvas-v445"></div>
            <div class="profile-ship-name-v443">Выбран: ${escapeProfileHtmlV428(name)}</div>
        `;

        disposeProfileShipPreview3DV445();

        setTimeout(() => {
            try{
                initProfileSelectedShip3DPreviewV445?.();
            }catch(error){
                console.warn('profile refresh init warning:', error?.message || error);
            }
        }, 40);

    }catch(_){}
}


// v449 removed recursive profile refresh listener

function renderProfileSkillsPanelV440(isSelf = false){
    const levels = ensureProfileSkillLevelsV440();
    const total = getProfileSkillTotalPointsV440();
    const free = getProfileSkillFreePointsV440();

    return `
      <div class="profile-skills-panel-v442">
        <div class="profile-skills-head-v442">
          <span>Навыки пилота</span><small class="profile-skill-reset-cost-v459">− навык: 5 💎</small>
          ${free > 0 ? `<span class="profile-skill-points-v442">Очки: <b>${free}</b></span>` : ``}
        </div>
        <div class="profile-skills-list-v442">
          ${PROFILE_SKILLS_V440.map(skill => {
              const lvl = Number(levels[skill.id] || 0) || 0;
              const canMinus = isSelf && lvl > 0;
              const canPlus = isSelf && free > 0 && lvl < PROFILE_SKILL_MAX_LEVEL_V440;
              let bars = '';
              for(let i = 0; i < PROFILE_SKILL_MAX_LEVEL_V440; i++){
                  bars += `<span class="profile-skill-bar-v442 ${i < lvl ? 'filled' : ''}"></span>`;
              }
              return `
                <div class="profile-skill-line-v442" title="${escapeProfileHtmlV428(skill.desc)}">
                  <div class="profile-skill-title-v442">
                    <span class="profile-skill-icon-v442">${skill.icon}</span>
                    <span class="profile-skill-name-v442">${escapeProfileHtmlV428(skill.name)}</span>
                  </div>
                  <div class="profile-skill-upgrade-v442">
                    ${isSelf ? `<button type="button" class="profile-skill-btn-v442" data-skill-action="minus" data-skill-id="${skill.id}" title="Сброс навыка: 5 💎" ${canMinus ? '' : 'disabled'}>−</button>` : ''}
                    <div class="profile-skill-bars-v442">${bars}</div>
                    <span class="profile-skill-num-v442">${lvl}</span>
                    ${isSelf ? `<button type="button" class="profile-skill-btn-v442 plus" data-skill-action="plus" data-skill-id="${skill.id}" ${canPlus ? '' : 'disabled'}>+</button>` : ''}
                  </div>
                </div>
              `;
          }).join('')}
        </div>
      </div>
    `;
}

function changeProfileSkillV440(skillId = '', delta = 0){
    const safeId = String(skillId || '').trim();
    if(!PROFILE_SKILLS_V440.some(skill => skill.id === safeId)) return;
    ensureProfileSkillLevelsV440();

    const current = Number(playerSkillLevelsV440[safeId] || 0) || 0;

    if(delta > 0){
        if(getProfileSkillFreePointsV440() <= 0) return;
        if(current >= PROFILE_SKILL_MAX_LEVEL_V440) return;
        playerSkillLevelsV440[safeId] = current + 1;
    }else if(delta < 0){
        if(current <= 0) return;

        if(!spendProfileDiamondsV459(PROFILE_SKILL_RESET_COST_DIAMONDS_V459)){
            try{ alert(`Недостаточно диамантов. Сброс 1 навыка стоит ${PROFILE_SKILL_RESET_COST_DIAMONDS_V459} 💎`); }catch(_){}
            return;
        }

        playerSkillLevelsV440[safeId] = current - 1;
    }else{
        return;
    }

    ensureProfileSkillLevelsV440();
    saveProfileSkillsLocalV459();

    try{ currentBattleShipStats = computeShipBattleStats?.(player?.selectedShipId || '') || currentBattleShipStats; }catch(_){}
    try{ inventory?.syncFromPlayerResources?.(); }catch(_){}
    try{ updateHUD?.(); updateUI?.(); updatePremiumAccountInfo?.(); updateBattlePlayerHud?.(); updateHangarHeaderNumbers?.(); }catch(_){}
    try{ saveGame?.(); }catch(_){}
    try{ renderProfileStats?.(); }catch(_){}
}

document.addEventListener('click', (event) => {
    const btn = event.target?.closest?.('[data-skill-action][data-skill-id]');
    if(!btn) return;
    const action = String(btn.getAttribute('data-skill-action') || '');
    const skillId = String(btn.getAttribute('data-skill-id') || '');
    changeProfileSkillV440(skillId, action === 'plus' ? 1 : -1);
});


let battleKillCombo = 0;
let battleLastKillAt = 0;
const BATTLE_COMBO_WINDOW_MS = 1000;
const battleProcessedHitIds = new Set();
const BATTLE_KILL_ACK_DAMAGE = -1;
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
let observerFollowTargetId = '';
let observerCycleCursor = -1;
let observerRoomResolveAt = 0;
let battlePlanetVisualScale = 1;
let battleShipCrash = null;
let battlePendingRespawnAt = 0;
let battleRespawnTimer = null;
let battlePlanetCapture = null;
let battleEnergyPool = 0;
let battleEnergyCapacity = 60;

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

// ===== GUEST HANGAR VIEW (read-only) =====
let hangarViewMode = 'self';
let hangarGuestOwner = null;
let hangarSelfSnapshot = null;

// ===== V411 HANGAR PRESENCE (real online visibility, no DB schema changes) =====
// Используем online_players.status = "hangar:<ownerPublicId>".
// Так не нужен новый столбец в Supabase и не трогаем room_id/rooms.
let currentHangarPresenceOwnerId = '';
let hangarPresenceRenderTimer = null;

function getOwnPublicIdForPresence(){
    const value = (typeof authState !== 'undefined' && authState?.playerId)
        ? String(authState.playerId)
        : (typeof player !== 'undefined' && player?.id ? String(player.id) : '');
    return String(value || '').trim();
}

function getHangarPresenceStatus(ownerId){
    const safeOwnerId = String(ownerId || '').trim();
    return safeOwnerId ? `hangar:${safeOwnerId}` : 'hangar';
}

function getHangarOwnerIdForPresence(){
    if(typeof isHangarGuestView === 'function' && isHangarGuestView() && hangarGuestOwner?.public_id){
        return String(hangarGuestOwner.public_id || '').trim();
    }
    return getOwnPublicIdForPresence();
}

function isHangarWindowOpenNow(){
    const win = document.getElementById('hangar-window');
    if(!win) return false;
    return !win.classList.contains('hidden');
}

async function enterHangarPresence(ownerId = ''){
    const safeOwnerId = String(ownerId || getHangarOwnerIdForPresence() || '').trim();
    if(!safeOwnerId) return;
    currentHangarPresenceOwnerId = safeOwnerId;
    try{ await setPlayerOnlineStatus?.(getHangarPresenceStatusWithPositionV426?.(safeOwnerId) || getHangarPresenceStatus(safeOwnerId), null); }catch(error){ console.warn('hangar presence enter warning:', error?.message || error); }
    try{ startHangarPresenceLoop?.(); }catch(_){}
    try{ renderHangarPresencePanel?.(); }catch(_){}
}

async function enterOwnHangarPresence(){
    await enterHangarPresence(getOwnPublicIdForPresence());
}

async function leaveHangarPresence(){
    const wasInHangar = !!currentHangarPresenceOwnerId || (typeof isHangarGuestView === 'function' && isHangarGuestView());
    currentHangarPresenceOwnerId = '';
    try{ stopHangarPresenceLoop?.(); }catch(_){}
    try{ clearHangarPresencePanel?.(); }catch(_){}
    if(wasInHangar){
        try{ await setPlayerOnlineStatus?.('lobby', null); }catch(error){ console.warn('hangar presence leave warning:', error?.message || error); }
    }
}

function ensureHangarPresencePanel(){
    const win = document.getElementById('hangar-window');
    if(!win) return null;
    let panel = document.getElementById('hangar-presence-panel');
    if(panel) return panel;
    panel = document.createElement('div');
    panel.id = 'hangar-presence-panel';
    panel.style.cssText = 'position:absolute;top:58px;right:22px;min-width:220px;max-width:300px;max-height:240px;overflow:auto;padding:12px 14px;border-radius:14px;background:rgba(4,10,22,0.84);border:1px solid rgba(112,234,255,0.28);box-shadow:0 0 22px rgba(0,210,255,0.18);color:#dffaff;font-size:13px;z-index:30;pointer-events:auto;';
    panel.innerHTML = '<div style="font-weight:800;color:#8ff5ff;margin-bottom:8px;">👥 В ангаре</div><div id="hangar-presence-list" style="display:flex;flex-direction:column;gap:6px;"></div>';
    win.appendChild(panel);
    return panel;
}

function clearHangarPresencePanel(){
    const list = document.getElementById('hangar-presence-list');
    if(list) list.innerHTML = '';
    const avatars = document.getElementById('removed-hangar-presence-avatars');
    if(avatars){ avatars.innerHTML = ''; avatars.remove(); }
}

function /*disabled*/removed_ensureHangarPresenceAvatars(){
    let wrap = document.getElementById('removed-hangar-presence-avatars');
    if(wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'removed-hangar-presence-avatars';
    wrap.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);display:flex;gap:14px;align-items:flex-end;justify-content:center;z-index:999999;pointer-events:auto;';
    document.body.appendChild(wrap);
    return wrap;
}

function /*disabled*/removed_renderHangarPresenceAvatars(rows = [], ownerId = ''){
    const wrap = /*disabled*/removed_ensureHangarPresenceAvatars();
    if(!wrap) return;
    wrap.innerHTML = '';
    const visibleRows = (rows || []).slice(0, 6);
    visibleRows.forEach((p, index) => {
        const pid = String(p?.player_id || '').trim();
        const isOwner = pid && String(ownerId || '').trim() === pid;
        const card = document.createElement('div');
        card.style.cssText = 'min-width:66px;max-width:96px;padding:9px 10px;border-radius:16px;background:rgba(4,12,24,0.92);border:1px solid rgba(130,240,255,0.55);box-shadow:0 0 24px rgba(0,220,255,0.32);text-align:center;color:#e9fbff;font-size:12px;backdrop-filter:blur(6px);';
        const icon = document.createElement('div');
        icon.textContent = isOwner ? '👑🧑‍🚀' : '👁🧑‍🚀';
        icon.style.cssText = 'font-size:28px;line-height:1.1;margin-bottom:4px;filter:drop-shadow(0 0 8px rgba(0,255,255,0.45));';
        const name = document.createElement('div');
        name.textContent = String(p?.nickname || 'Player').slice(0, 12);
        name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.92;';
        card.appendChild(icon);
        card.appendChild(name);
        if(pid){
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => { try{ openPlayerProfile?.(pid, p?.nickname || `ID ${pid}`); }catch(_){} });
        }
        wrap.appendChild(card);
    });
}

async function renderHangarPresencePanel(){
    if(!isHangarWindowOpenNow()) return;
    const ownerId = String(currentHangarPresenceOwnerId || getHangarOwnerIdForPresence() || '').trim();
    if(!ownerId) return;
    const panel = ensureHangarPresencePanel();
    const list = document.getElementById('hangar-presence-list');
    if(!panel || !list) return;

    const myId = getOwnPublicIdForPresence();
    let players = [];
    try{
        players = await loadOnlinePlayersFromSupabase?.() || [];
    }catch(error){
        console.warn('hangar presence load warning:', error?.message || error);
        players = [];
    }

    const neededStatus = getHangarPresenceStatus(ownerId).toLowerCase();
    const rawRows = (players || []).filter(p => String(p?.status || '').toLowerCase().startsWith(neededStatus));
    const rows = Array.isArray(rawRows) ? rawRows.slice() : [];

    rows.sort((a,b) => {
        const aid = String(a?.player_id || '');
        const bid = String(b?.player_id || '');
        if(aid === ownerId && bid !== ownerId) return -1;
        if(bid === ownerId && aid !== ownerId) return 1;
        return String(a?.nickname || '').localeCompare(String(b?.nickname || ''));
    });

    try{ /*disabled*/ }catch(_){}

    list.innerHTML = '';
    if(!rows.length){
        try{ updateHangarAstronautsSafe([]); }catch(e){}
        const empty = document.createElement('div');
        empty.style.opacity = '0.68';
        empty.textContent = 'Пока никого нет';
        list.appendChild(empty);
        return;
    }

    try{ updateHangarAstronautsSafe(rows); }catch(e){}
    rows.forEach(p => {
        const pid = String(p?.player_id || '').trim();
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,0.055);border:1px solid rgba(255,255,255,0.06);';
        item.textContent = `${pid === ownerId ? '👑' : '👁'} ${p?.nickname || 'Player'}`;
        if(pid && pid !== myId){
            item.style.cursor = 'pointer';
            item.title = 'Открыть профиль';
            item.addEventListener('click', () => { try{ openPlayerProfile?.(pid, p?.nickname || `ID ${pid}`); }catch(_){} });
        }
        list.appendChild(item);
    });
}

function startHangarPresenceLoop(){
    if(hangarPresenceRenderTimer) clearInterval(hangarPresenceRenderTimer);
    hangarPresenceRenderTimer = setInterval(() => {
        try{
            if(!isHangarWindowOpenNow()){ stopHangarPresenceLoop(); return; }
            renderHangarPresencePanel();
        }catch(_){}
    }, 2200);
}

function stopHangarPresenceLoop(){
    if(hangarPresenceRenderTimer) clearInterval(hangarPresenceRenderTimer);
    hangarPresenceRenderTimer = null;
}

function isHangarGuestView(){
    return String(hangarViewMode || 'self') === 'guest';
}

function makeHangarPlayerSnapshot(){
    try{
        return {
            player: JSON.parse(JSON.stringify(player || {})),
            playerResources: JSON.parse(JSON.stringify(playerResources || {})),
            currentLevel: typeof currentLevel !== 'undefined' ? currentLevel : 1,
            damage: typeof damage !== 'undefined' ? damage : 1
        };
    }catch(_){
        return null;
    }
}

function restoreOwnHangarAfterGuest(){
    try{
        if(!isHangarGuestView()) return;
        if(hangarSelfSnapshot?.player){
            Object.keys(player || {}).forEach(key => { try{ delete player[key]; }catch(_){} });
            Object.assign(player, JSON.parse(JSON.stringify(hangarSelfSnapshot.player)));
        }
        if(hangarSelfSnapshot?.playerResources && typeof playerResources === 'object'){
            Object.keys(playerResources).forEach(key => { try{ delete playerResources[key]; }catch(_){} });
            Object.assign(playerResources, JSON.parse(JSON.stringify(hangarSelfSnapshot.playerResources)));
        }
        if(typeof currentLevel !== 'undefined' && Number.isFinite(Number(hangarSelfSnapshot?.currentLevel))){
            currentLevel = Number(hangarSelfSnapshot.currentLevel);
        }
        if(typeof damage !== 'undefined' && Number.isFinite(Number(hangarSelfSnapshot?.damage))){
            damage = Number(hangarSelfSnapshot.damage);
        }
    }catch(error){
        console.warn('restoreOwnHangarAfterGuest warning:', error?.message || error);
    }finally{
        hangarViewMode = 'self';
        hangarGuestOwner = null;
        hangarSelfSnapshot = null;
        try{ refreshOwnedShipsInventory?.(); }catch(_){}
        try{ currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || ''); }catch(_){}
        try{ updatePremiumAccountInfo?.(); try{ refreshCosmicLevelShipIcon?.(); }catch(_){} updateHUD?.(); updateUI?.(); }catch(_){}
    }
}


function cosmicLevelShipIconHtml(levelValue = 1){
    const safeLevel = Math.max(1, Math.min(120, Math.floor(Number(levelValue || 1) || 1)));
    const levelText = String(safeLevel);

    return `
        <span class="cosmic-level-ship-badge" title="Уровень ${safeLevel}" aria-label="Уровень ${safeLevel}">
            <svg class="cosmic-level-ship-svg" viewBox="0 0 78 78" role="img" aria-hidden="true">

                <defs>
                    <radialGradient id="cosmicPremiumBg" cx="50%" cy="38%" r="70%">
                        <stop offset="0%" stop-color="#6ffbff"/>
                        <stop offset="42%" stop-color="#1f6fff"/>
                        <stop offset="100%" stop-color="#071122"/>
                    </radialGradient>

                    <linearGradient id="cosmicPremiumHull" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="38%" stop-color="#dfffff"/>
                        <stop offset="100%" stop-color="#5ddcff"/>
                    </linearGradient>

                    <linearGradient id="cosmicPremiumWing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#d7ffff"/>
                        <stop offset="100%" stop-color="#4dc8ff"/>
                    </linearGradient>

                    <radialGradient id="cosmicPremiumCore" cx="50%" cy="35%" r="75%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="48%" stop-color="#f7ffff"/>
                        <stop offset="100%" stop-color="#82eaff"/>
                    </radialGradient>

                    <radialGradient id="cosmicPremiumFire" cx="50%" cy="50%" r="70%">
                        <stop offset="0%" stop-color="#fff7bb"/>
                        <stop offset="50%" stop-color="#ffbf32"/>
                        <stop offset="100%" stop-color="#ff4f00"/>
                    </radialGradient>
                </defs>

                <circle class="cosmic-premium-ring" cx="39" cy="39" r="34"/>
                <circle class="cosmic-premium-inner-ring" cx="39" cy="39" r="28"/>

                <g class="cosmic-premium-stars">
                    <circle cx="18" cy="18" r="1.8"/>
                    <circle cx="59" cy="16" r="1.4"/>
                    <circle cx="63" cy="57" r="1.7"/>
                </g>

                <g class="cosmic-premium-ship">

                    <path class="cosmic-premium-flame-left"
                        d="M31 55 C25 59 23 66 22 71 C27 67 32 63 34 58 Z"/>

                    <path class="cosmic-premium-flame-right"
                        d="M47 55 C53 59 55 66 56 71 C51 67 46 63 44 58 Z"/>

                    <path class="cosmic-premium-wing left"
                        d="M30 41 L12 52 L29 54 L38 45 Z"/>

                    <path class="cosmic-premium-wing right"
                        d="M48 41 L66 52 L49 54 L40 45 Z"/>

                    <path class="cosmic-premium-hull"
                        d="M39 8 C52 24 53 47 39 62 C25 47 26 24 39 8 Z"/>

                    <ellipse class="cosmic-premium-core"
                        cx="39" cy="34" rx="12" ry="14"/>

                    <text class="cosmic-premium-level"
                        x="39"
                        y="39"
                        text-anchor="middle">${levelText}</text>

                    <path class="cosmic-premium-shine"
                        d="M34 16 C37 11 41 11 44 16"/>

                </g>
            </svg>
        </span>
    `;
}

function refreshCosmicLevelShipIcon(){
    try{
        const level = Math.max(1, Number(player?.level || currentLevel || 1) || 1);
        document.querySelectorAll('[data-cosmic-level-ship]').forEach(node => {
            node.innerHTML = cosmicLevelShipIconHtml(level);
        });
    }catch(error){
        console.warn('cosmic level ship icon warning:', error?.message || error);
    }
}

function getDisplayPlayerTag(){
    const sourcePlayer = (typeof isHangarGuestView === 'function' && isHangarGuestView() && hangarSelfSnapshot?.player)
        ? hangarSelfSnapshot.player
        : player;
    const safeNickname = (sourcePlayer?.nickname || 'Commander').trim() || 'Commander';
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
    if(String(item?.id || '').trim() === 'xwing_1') return 0;
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
        const starterHullId = 'scout_1';
        const ownedShipIds = Array.isArray(player.ownedShipIds)
            ? player.ownedShipIds.map(id => String(id || '').trim()).filter(Boolean)
            : [];
        if(!ownedShipIds.includes(starterHullId)) ownedShipIds.unshift(starterHullId);
        player.ownedShipIds = Array.from(new Set(ownedShipIds));

        const selectedShipId = String(player.selectedShipId || '').trim();
        player.selectedShipId = player.ownedShipIds.includes(selectedShipId)
            ? selectedShipId
            : starterHullId;

        if(!player.activeModulesByShip || typeof player.activeModulesByShip !== 'object'){
            player.activeModulesByShip = {};
        }

        for(const shipId of player.ownedShipIds){
            const currentSetup = player.activeModulesByShip[shipId] && typeof player.activeModulesByShip[shipId] === 'object'
                ? player.activeModulesByShip[shipId]
                : {};
            player.activeModulesByShip[shipId] = {
                weapon: String(currentSetup.weapon || 'weapon_laser_s1').trim() || 'weapon_laser_s1',
                shield: String(currentSetup.shield || 'shield_micro_s1').trim() || 'shield_micro_s1',
                booster: String(currentSetup.booster || 'booster_ion_s1').trim() || 'booster_ion_s1'
            };
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

function getHangarDockCapacity(){
    const pads = Array.isArray(hangarState?.supportPlatforms) ? hangarState.supportPlatforms.filter(Boolean).length : 0;
    return Math.max(1, pads || 20);
}

function ensureHangarDockAssignments(){
    try{
        if(!player || typeof player !== 'object') return {};
        const ownedIds = Array.isArray(player.ownedShipIds)
            ? player.ownedShipIds.map(id => String(id || '').trim()).filter(Boolean)
            : [];
        if(!player.hangarDockAssignments || typeof player.hangarDockAssignments !== 'object'){
            player.hangarDockAssignments = {};
        }
        const assignments = player.hangarDockAssignments;
        const capacity = getHangarDockCapacity();
        Object.keys(assignments).forEach(shipId => {
            if(!ownedIds.includes(String(shipId || '').trim())){
                delete assignments[shipId];
            }
        });

        const used = new Set();
        ownedIds.forEach(shipId => {
            const rawIdx = Number(assignments[shipId]);
            if(Number.isFinite(rawIdx) && rawIdx >= 0 && rawIdx < capacity && !used.has(rawIdx)){
                used.add(rawIdx);
            }else{
                delete assignments[shipId];
            }
        });

        const nextFreeDock = () => {
            for(let i = 0; i < capacity; i++){
                if(!used.has(i)) return i;
            }
            return used.size;
        };

        ownedIds.forEach(shipId => {
            if(!Object.prototype.hasOwnProperty.call(assignments, shipId)){
                const idx = nextFreeDock();
                assignments[shipId] = idx;
                used.add(idx);
            }
        });

        if(ownedIds[0] && !Object.prototype.hasOwnProperty.call(assignments, ownedIds[0])){
            assignments[ownedIds[0]] = 0;
        }

        return assignments;
    }catch(_){
        return player?.hangarDockAssignments || {};
    }
}

function getHangarDockAssignment(shipId){
    const safeId = String(shipId || '').trim();
    if(!safeId) return -1;
    const assignments = ensureHangarDockAssignments();
    const idx = Number(assignments?.[safeId]);
    return Number.isFinite(idx) ? idx : -1;
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
    battleKillCombo = 0;
    battleLastKillAt = 0;
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

function forceOpenLobbyAfterAuth(email = ''){
    try{
        authState.mode = 'account';
        authState.email = String(email || authState.email || '').trim().toLowerCase();
        authState.isAuthenticated = true;
        authState.emailVerified = true;

        const safeId = getSafePlayerPublicId();
        authState.playerId = safeId || 0;

        const mailNick = authState.email ? authState.email.split('@')[0] : '';
        if(!player.nickname || player.nickname === 'Commander' || player.nickname === 'Guest Pilot'){
            player.nickname = mailNick || 'Pilot';
        }
        player.id = safeId || 0;
        window.currentRoomId = null;

        try{ document.body.classList.add('cosmic-auth-passed'); document.body.classList.add('cosmic-in-lobby'); document.body.classList.remove('cosmic-in-battle','cosmic-in-auth'); }catch(_){}
        try{ clearBattleKillFeed?.(); }catch(_){}
        try{ clearBattleBotNameLabels?.(); }catch(_){}
        try{ updateNicknameSettingsState?.(); }catch(_){}
        try{ updatePremiumAccountInfo?.(); }catch(_){}
        try{ renderProfileStats?.(); try{ refreshCosmicLevelShipIcon?.(); }catch(_){} }catch(_){}

        try{ switchState('LOBBY'); }catch(switchErr){ console.warn('switchState LOBBY warning:', switchErr?.message || switchErr); }

        const authScreen = document.getElementById('auth-screen');
        const lobby = document.getElementById('lobby-screen');
        const topNav = document.getElementById('top-nav');
        const premiumBar = document.getElementById('premium-bar');
        const battleScreen = document.getElementById('battle-screen');
        const canvas = document.querySelector('canvas');

        if(authScreen){
            authScreen.classList.add('hidden');
            authScreen.style.setProperty('display', 'none', 'important');
            authScreen.style.setProperty('visibility', 'hidden', 'important');
            authScreen.style.setProperty('pointer-events', 'none', 'important');
        }
        if(lobby){
            lobby.classList.remove('hidden');
            lobby.style.setProperty('display', 'flex', 'important');
            lobby.style.setProperty('visibility', 'visible', 'important');
        }
        if(topNav){
            topNav.style.setProperty('display', 'flex', 'important');
        }
        if(premiumBar){
            premiumBar.style.setProperty('display', 'flex', 'important');
        }
        if(battleScreen){
            battleScreen.style.setProperty('display', 'none', 'important');
        }
        if(canvas){
            canvas.style.setProperty('display', 'none', 'important');
        }

        try{ renderRoomsInLobby?.(); }catch(_){}
        try{ window.gameState = 'LOBBY'; }catch(_){}
        gameState = 'LOBBY';

        // Do not save remotely before a real numeric Supabase public_id exists.
        try{ if(getSafePlayerPublicId()) saveGame?.(); }catch(_){}
        return true;
    }catch(err){
        console.error('forceOpenLobbyAfterAuth failed:', err);
        return false;
    }
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


// ================= SOLO MISSIONS DAILY STATE =================
const SOLO_BOT_MODEL_PATH = 'ships/Flying saucer.glb';
const SOLO_MISSION_STORAGE_PREFIX = 'cosmicSoloMissionCompleted';
let activeSoloMission = null;
let activeSoloMissionCompleted = false;
let activeSoloMissionEnded = false;
let battleSolarSystemGroup = null;
const SOLO_DEFAULT_PLAYER_LIVES = 5;
const SOLO_KILL_EXP_REWARD = 1;
const SOLO_KILL_COIN_REWARD = 1;
const SOLO_WIN_CRYSTAL_REWARD = 3;
function isEndlessSoloBattle(){ return !!(isSoloBattleActive() && (activeSoloMission?.endless || currentRoom?.endless)); }
function addPlayerBattleCurrency(kind = 'coins', amount = 0){
    const value = Math.max(0, Number(amount || 0) || 0);
    if(!value) return;

    if(typeof playerResources !== 'object' || !playerResources){
        try{ window.playerResources = window.playerResources || {}; }catch(_){}
    }

    if(kind === 'crystals'){
        if(typeof playerResources === 'object' && playerResources){
            playerResources.crystals = Math.max(0, Number(playerResources.crystals || 0) + value);
            playerResources.diamonds = Math.max(0, Number(playerResources.diamonds || 0) + value);
        }
        if(player){
            player.crystals = Math.max(0, Number(player.crystals || 0) + value);
            player.diamonds = Math.max(0, Number(player.diamonds || 0) + value);
        }
    }else{
        if(typeof playerResources === 'object' && playerResources){
            playerResources.coins = Math.max(0, Number(playerResources.coins || 0) + value);
            playerResources.credits = Math.max(0, Number(playerResources.credits || 0) + value);
        }
        if(player){
            player.credits = Math.max(0, Number(player.credits || 0) + value);
            player.coins = Math.max(0, Number(player.coins || 0) + value);
        }
    }

    try{ inventory?.syncFromPlayerResources?.(); }catch(_){}
    try{ updateHUD?.(); updateUI?.(); updatePremiumBar?.(); updateBattlePlayerHud?.(); }catch(_){}
    try{ saveGame?.(); }catch(_){}
}
function awardSoloBotKillReward(worldPosition = null){
    const expReward = Math.max(0, Number(SOLO_KILL_EXP_REWARD || 0) || 0);
    const coinReward = Math.max(0, Number(SOLO_KILL_COIN_REWARD || 0) || 0);

    if(player){
        player.experience = Math.max(0, Number(player.experience || 0) + expReward);
        player.credits = Math.max(0, Number(player.credits || 0) + coinReward);
        player.coins = Math.max(0, Number(player.coins || 0) + coinReward);
    }

    if(typeof playerResources === 'object' && playerResources){
        playerResources.coins = Math.max(0, Number(playerResources.coins || player?.credits || 0) + coinReward);
    }

    try{ showBattleFloatingReward(expReward, coinReward, worldPosition || playerShip?.position || null); }catch(_){}
    try{ inventory?.syncFromPlayerResources?.(); }catch(_){}
    try{ updateHUD?.(); updateUI?.(); updatePremiumAccountInfo?.(); updateBattlePlayerHud?.(); updateBattleScoreboard?.(); updateProfileUI?.(); try{ refreshCosmicLevelShipIcon?.(); }catch(_){} }catch(_){}
    try{ saveGame?.(); }catch(_){}
}
function awardSoloMissionWinReward(){
    if(isEndlessSoloBattle()) return;
    addPlayerBattleCurrency('crystals', SOLO_WIN_CRYSTAL_REWARD);
    try{ pushKillFeed(`Награда за победу: 💎 +${SOLO_WIN_CRYSTAL_REWARD}`, 'kill'); }catch(_){}
    try{ updateHUD?.(); updateUI?.(); updatePremiumBar?.(); updateBattlePlayerHud?.(); saveGame?.(); }catch(_){}
}
function getCosmicLocalDateKey(){ const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
function getSoloMissionPlayerKey(){ return String(authState?.playerId || player?.id || authState?.email || player?.nickname || 'guest').trim() || 'guest'; }
function getSoloMissionId(entry = {}){ return String(entry?.real || entry?.map || entry?.name || entry?.title || '').trim().toLowerCase() || 'mission'; }
function getSoloMissionStorageKey(entry = {}){ return `${SOLO_MISSION_STORAGE_PREFIX}:${getSoloMissionPlayerKey()}:${getCosmicLocalDateKey()}:${getSoloMissionId(entry)}`; }
function isSoloMissionCompletedToday(entry = {}){ try{ return localStorage.getItem(getSoloMissionStorageKey(entry)) === '1'; }catch(_){ return false; } }
function markSoloMissionCompletedToday(entry = {}){ try{ localStorage.setItem(getSoloMissionStorageKey(entry), '1'); }catch(_){ } }
function isSoloBattleActive(){ return !!(currentRoom?.solo || currentRoom?.state === 'solo' || activeSoloMission); }
function getActiveSoloMissionGoal(){ return Math.max(1, Number(activeSoloMission?.goalKills || currentRoom?.goalKills || 6) || 6); }
function getActiveSoloMissionLives(){ return Math.max(1, Number(activeSoloMission?.playerLives || currentRoom?.playerLives || SOLO_DEFAULT_PLAYER_LIVES) || SOLO_DEFAULT_PLAYER_LIVES); }
function getSoloLivesLeft(){ return Math.max(0, getActiveSoloMissionLives() - (Number(battleStats.playerDeaths || 0) || 0)); }

// ===== V372 SOLO KILLFEED / BOT LABEL / TEAM SCOREBOARD HELPERS =====
function pushBattleKillFeedLine(text = ''){
    try{
        if(gameState !== 'BATTLE') return;
        const battleScreen = document.getElementById('battle-screen');
        if(battleScreen && battleScreen.style.display === 'none') return;
        const safeText = String(text || '').trim();
        if(!safeText) return;
        let feed = document.getElementById('battle-kill-feed');
        if(!feed){
            feed = document.createElement('div');
            feed.id = 'battle-kill-feed';
            document.body.appendChild(feed);
        }
        feed.style.display = 'flex';
        const item = document.createElement('div');
        item.className = 'battle-kill-feed-item';
        item.textContent = safeText;
        feed.prepend(item);
        while(feed.children.length > 5) feed.removeChild(feed.lastElementChild);
        setTimeout(() => {
            try{
                if(gameState !== 'BATTLE'){
                    item.remove();
                    return;
                }
                item.style.opacity = '0';
                setTimeout(() => item.remove(), 350);
            }catch(_){}
        }, 5200);
    }catch(_){}
}

function clearBattleKillFeed(){
    try{
        const feed = document.getElementById('battle-kill-feed');
        if(feed){
            feed.innerHTML = '';
            feed.style.display = 'none';
        }
    }catch(_){}
}


// ===== V379 SOLO BOT NAME SPRITES (REAL FIX) =====
// ВАЖНО: старые DOM-ники (.battle-bot-name-label) больше не используются.
// Имя теперь рисуется как THREE.Sprite прямо над HP-баром бота.
// Поэтому размер реально меняется в бою и не зависит от CSS/HTML-слоёв.
let battleBotNameLabels = new Map();

function clearBattleBotNameLabels(){
    try{
        if(!(battleBotNameLabels instanceof Map)) battleBotNameLabels = new Map();
        battleBotNameLabels.forEach(label => { try{ label.remove(); }catch(_){} });
        battleBotNameLabels.clear();
        const oldSingle = document.getElementById('battle-bot-name-label');
        if(oldSingle) oldSingle.style.display = 'none';
        document.querySelectorAll?.('.battle-bot-name-label')?.forEach(el => { try{ el.remove(); }catch(_){} });
        const bots = getActiveSoloBots?.() || [];
        bots.forEach(bot => {
            try{
                if(bot?.userData?.nameSprite){
                    bot.remove(bot.userData.nameSprite);
                    bot.userData.nameSprite.material?.map?.dispose?.();
                    bot.userData.nameSprite.material?.dispose?.();
                    bot.userData.nameSprite = null;
                }
            }catch(_){}
        });
    }catch(_){}
}

function getBotLabelId(bot, index = 0){
    return String(bot?.userData?.id || bot?.uuid || `bot-${index+1}`);
}

function makeSoloBotNameTexture(name = ''){
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 56;
    const ctx = canvas.getContext('2d');
    const safeName = String(name || '').trim() || 'UFO';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const boxW = 196;
    const boxH = 28;
    const x = (canvas.width - boxW) / 2;
    const y = 16;
    const r = 9;

    ctx.fillStyle = 'rgba(0, 8, 18, 0.46)';
    ctx.strokeStyle = 'rgba(120, 230, 255, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + boxW - r, y);
    ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r);
    ctx.lineTo(x + boxW, y + boxH - r);
    ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r, y + boxH);
    ctx.lineTo(x + r, y + boxH);
    ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c9f6ff';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 3;
    const shortName = safeName.length > 15 ? safeName.slice(0, 14) + '…' : safeName;
    ctx.fillText(shortName, canvas.width / 2, y + boxH / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return { canvas, texture };
}

function ensureSoloBotNameSprite(bot){
    if(!bot || bot.userData?.alive === false) return null;
    const name = String(bot?.userData?.name || bot?.userData?.botName || '').trim();
    if(!name) return null;

    let sprite = bot.userData?.nameSprite || null;
    if(sprite && sprite.parent === bot && sprite.userData?.nameText === name) return sprite;

    try{
        if(sprite){
            bot.remove(sprite);
            sprite.material?.map?.dispose?.();
            sprite.material?.dispose?.();
            bot.userData.nameSprite = null;
        }
    }catch(_){}

    try{
        const data = makeSoloBotNameTexture(name);
        const material = new THREE.SpriteMaterial({
            map: data.texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        sprite = new THREE.Sprite(material);
        sprite.name = 'solo-bot-name-small-sprite';
        sprite.renderOrder = 9999;
        sprite.center.set(0.5, 0.0);
        sprite.userData = { nameText: name, canvas: data.canvas, texture: data.texture };
        bot.userData.nameSprite = sprite;
        bot.add(sprite);
        return sprite;
    }catch(_){
        return null;
    }
}

function updateBattleBotNameLabel(){
    try{
        const oldSingle = document.getElementById('battle-bot-name-label');
        if(oldSingle) oldSingle.style.display = 'none';
        document.querySelectorAll?.('.battle-bot-name-label')?.forEach(el => { try{ el.remove(); }catch(_){} });

        if(gameState !== 'BATTLE' || !isSoloBattleActive()){
            clearBattleBotNameLabels();
            return;
        }

        const bots = getActiveSoloBots?.().filter(bot => bot && bot.userData?.alive !== false) || [];
        bots.forEach(bot => {
            const sprite = ensureSoloBotNameSprite(bot);
            if(!sprite) return;
            const hpOffset = Number(bot?.userData?.hpBarOffsetY || (isEndlessSoloBattle() ? 8.8 : 5.0)) || 5;
            sprite.visible = true;
            sprite.position.set(0, hpOffset + 0.55, 0);
            // Реально меньше старого DOM-ника: ширина около половины HP-бара.
            if(isEndlessSoloBattle()){
                sprite.scale.set(18.0, 4.0, 1);
            }else{
                sprite.scale.set(18.0, 4.0, 1);
            }
        });
    }catch(_){}
}

function startV375BotNameLoop(){
    if(window.__v375BotNameLoopStarted) return;
    window.__v375BotNameLoopStarted = true;
    const tick = () => {
        try{ updateBattleBotNameLabel?.(); }catch(_){}
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
try{ startV375BotNameLoop(); }catch(_){}


function updateSoloMissionHud(){
    const hud = document.getElementById('solo-mission-hud');
    if(!hud) return;
    if(!isSoloBattleActive() || gameState !== 'BATTLE'){
        hud.style.display = 'none';
        return;
    }
    hud.style.display = 'flex';
    const goal = getActiveSoloMissionGoal();
    const kills = Math.max(0, Number(battleStats.playerKills || 0) || 0);
    const lives = getSoloLivesLeft();
    const botKills = Math.max(0, Number(battleStats.botKills || 0) || 0);
    const total = document.getElementById('solo-total-kills');
    const life = document.getElementById('solo-lives-left');
    const botDefeated = document.getElementById('solo-bots-defeated');
    const botScore = document.getElementById('solo-bot-score');
    const goalText = document.getElementById('solo-goal-text');
    if(total) total.textContent = String(kills);
    if(life) life.textContent = String(lives);
    if(botDefeated) botDefeated.textContent = `${kills}/${goal}`;
    if(botScore) botScore.textContent = String(botKills);
    if(goalText) goalText.textContent = isEndlessSoloBattle() ? 'Цель: бесконечный бой с НЛО' : `Цель: уничтожить ${goal} НЛО`;
}
function showSoloMissionResult(victory = true){
    const box = document.getElementById('solo-result-banner');
    if(!box) return;
    box.textContent = victory ? 'ВЫ ПОБЕДИЛИ' : 'ВЫ ПРОИГРАЛИ';
    box.classList.toggle('lost', !victory);
    box.classList.toggle('win', !!victory);
    box.style.display = 'block';
}
function hideSoloMissionResult(){
    const box = document.getElementById('solo-result-banner');
    if(box) box.style.display = 'none';
}
function finishSoloMission(victory = true){
    if(!isSoloBattleActive() || activeSoloMissionEnded) return;
    activeSoloMissionEnded = true;
    activeSoloMissionCompleted = !!victory;
    const mission = activeSoloMission || currentRoom || selectedLobbyMap || {};
    if(victory){
        markSoloMissionCompletedToday(mission);
        awardSoloMissionWinReward?.();
    }
    showSoloMissionResult(!!victory);
    updateSoloMissionHud();
    updateBattleScoreboard?.();
    setTimeout(() => {
        try{
            if(gameState === 'BATTLE' && isSoloBattleActive()){
                clearBattleKillFeed?.();
                    clearBattleBotNameLabels?.();
    switchState('LOBBY');
                setTimeout(() => { try{ renderLobbyListV27?.('solo'); }catch(_){} }, 80);
            }
        }catch(_){ }
    }, 4200);
}
function completeActiveSoloMission(){ finishSoloMission(true); }
function failActiveSoloMission(){ finishSoloMission(false); }

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

function distancePointToSegment(point, segmentStart, segmentEnd){
    const ab = segmentEnd.clone().sub(segmentStart);
    const abLenSq = ab.lengthSq();
    if(abLenSq <= 0.000001) return point.distanceTo(segmentStart);
    const t = THREE.MathUtils.clamp(point.clone().sub(segmentStart).dot(ab) / abLenSq, 0, 1);
    const closest = segmentStart.clone().add(ab.multiplyScalar(t));
    return point.distanceTo(closest);
}

function getRemoteShipHitDistance(entry, segmentStart, segmentEnd){
    if(!entry?.mesh) return Infinity;
    const targetCenter = entry.targetPosition?.clone?.() || entry.mesh.position.clone();
    const radius = Math.max(2.8, Number(entry?.mesh?.userData?.hitRadius || entry?.hitRadius || 0) || 0, 2.8);
    return distancePointToSegment(targetCenter, segmentStart, segmentEnd) - radius;
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
    if((gameState === "OBSERVE" || battleObserverMode) && e.code === "Space"){
        e.preventDefault();
        cycleObserverTarget();
        return;
    }
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
let battlePresenceAnnounceMutedUntil = 0;
let battleJoinMuteByPlayer = new Map();
let battlePresenceRecentEvents = new Map();
let battlePresenceMissingCounts = new Map();
let liveBattlePresenceSubscribePromise = null;

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
    battleHudClockTimer = setInterval(updateBattleHudMeta, 3500);
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

function markBattlePresenceAnnouncementsMuted(durationMs = 0){
    const safeDuration = Math.max(0, Number(durationMs || 0) || 0);
    battlePresenceAnnounceMutedUntil = Math.max(Number(battlePresenceAnnounceMutedUntil || 0) || 0, Date.now() + safeDuration);
}

function markBattleJoinMutedForPlayer(playerId = '', durationMs = 0){
    const entryId = String(playerId || '').trim();
    if(!entryId) return;
    const safeDuration = Math.max(0, Number(durationMs || 0) || 0);
    if(safeDuration <= 0) return;
    battleJoinMuteByPlayer.set(entryId, Date.now() + safeDuration);
}

function isBattleJoinMutedForPlayer(playerId = ''){
    const entryId = String(playerId || '').trim();
    if(!entryId) return false;
    const until = Number(battleJoinMuteByPlayer.get(entryId) || 0) || 0;
    if(!until) return false;
    if(until <= Date.now()){
        battleJoinMuteByPlayer.delete(entryId);
        return false;
    }
    return true;
}

function shouldAnnounceBattlePresenceEvent(kind = '', playerId = '', nickname = ''){
    const safeKind = String(kind || '').trim();
    const safePlayerId = String(playerId || '').trim();
    const safeNickname = String(nickname || '').trim();
    if(!safeKind || !safePlayerId) return false;
    const key = `${safeKind}:${safePlayerId}:${safeNickname}`;
    const now = Date.now();
    for(const [entryKey, entryUntil] of battlePresenceRecentEvents.entries()){
        if(Number(entryUntil || 0) <= now){
            battlePresenceRecentEvents.delete(entryKey);
        }
    }
    const until = Number(battlePresenceRecentEvents.get(key) || 0) || 0;
    if(until > now) return false;
    battlePresenceRecentEvents.set(key, now + 2500);
    return true;
}

function clearBattlePresenceEventCooldown(kind = '', playerId = '', nickname = ''){
    const safeKind = String(kind || '').trim();
    const safePlayerId = String(playerId || '').trim();
    const safeNickname = String(nickname || '').trim();
    if(!safeKind || !safePlayerId) return;
    battlePresenceRecentEvents.delete(`${safeKind}:${safePlayerId}:${safeNickname}`);
}



function isPlayerCurrentlyKnownInBattle(playerId = ''){
    const entryId = String(playerId || '').trim();
    if(!entryId) return false;
    if(lastBattlePresenceSnapshot instanceof Map && lastBattlePresenceSnapshot.has(entryId)) return true;
    if(remoteBattleShips instanceof Map && remoteBattleShips.has(entryId)) return true;
    const lists = [
        ...(Array.isArray(currentRoom?.currentPlayers) ? [currentRoom.currentPlayers] : []),
        ...(Array.isArray(currentRoom?.players) ? [currentRoom.players] : [])
    ];
    return lists.some(list => list.some(row => String(row?.public_id || row?.player_public_id || row?.player_id || row?.id || '').trim() === entryId));
}

function refreshLobbyPingForCurrentPlayer(){
    const pingValue = getBattlePingValue();
    const labels = document.querySelectorAll('[data-player-ping-self="1"]');
    labels.forEach(label => {
        label.textContent = pingValue > 0 ? String(pingValue) : '—';
    });
}


function getSelfBattlePlayerId(){
    const direct = String(authState?.playerId || player?.id || '').trim();
    if(direct && direct !== 'local_player') return direct;
    try{
        const identity = getCurrentPlayerIdentity?.() || {};
        const fallback = String(identity?.playerId || '').trim();
        if(fallback) return fallback;
    }catch(_){}
    return direct && direct !== 'local_player' ? direct : '';
}

function getBattleRoomIdSafe(){
    const rawRoomId = String(currentRoom?.id || currentRoom?.roomId || '').trim();
    if(!rawRoomId) return '';
    if(rawRoomId.startsWith('local_') || rawRoomId.startsWith('observe_') || rawRoomId.startsWith('tournament_')) return '';
    const sanitizedRoomId = sanitizeOnlineRoomId(rawRoomId);
    return sanitizedRoomId || '';
}

function getBattleRoomPlayerTeam(entryId = ''){
    const key = String(entryId || '').trim();
    if(!key) return 'blue';
    return String(key).slice(-1).charCodeAt(0) % 2 === 0 ? 'blue' : 'red';
}

const ROOM_PLAYER_STALE_MS = 12000;
const ROOM_EMPTY_DELETE_GRACE_MS = 20000;

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

function hasMeaningfulBattleVectorDelta(prev = {}, next = {}, epsilon = 0.1){
    return Math.abs(Number(prev?.x || 0) - Number(next?.x || 0)) > epsilon
        || Math.abs(Number(prev?.y || 0) - Number(next?.y || 0)) > epsilon
        || Math.abs(Number(prev?.z || 0) - Number(next?.z || 0)) > epsilon;
}

function hasMeaningfulBattleQuaternionDelta(prev = {}, next = {}, epsilon = 0.01){
    return Math.abs(Number(prev?.x || 0) - Number(next?.x || 0)) > epsilon
        || Math.abs(Number(prev?.y || 0) - Number(next?.y || 0)) > epsilon
        || Math.abs(Number(prev?.z || 0) - Number(next?.z || 0)) > epsilon
        || Math.abs(Number(prev?.w || 1) - Number(next?.w || 1)) > epsilon;
}

function getThrottledRoomPlayerPing(now = Date.now()){
    if((now - lastRoomPlayerPingAt) >= ROOM_PLAYER_PING_UPDATE_MS || !Number.isFinite(lastRoomPlayerPingValue) || lastRoomPlayerPingValue <= 0){
        lastRoomPlayerPingValue = Number(getBattlePingValue() || 0) || 0;
        lastRoomPlayerPingAt = now;
    }
    return Number(lastRoomPlayerPingValue || 0) || 0;
}

function getThrottledPresencePing(now = Date.now()){
    if((now - lastPresencePingAt) >= BATTLE_PRESENCE_PING_UPDATE_MS || !Number.isFinite(lastPresencePingValue) || lastPresencePingValue <= 0){
        lastPresencePingValue = Number(getBattlePingValue() || 0) || 0;
        lastPresencePingAt = now;
    }
    return Number(lastPresencePingValue || 0) || 0;
}


function buildRoomPlayerRowPayload(roomId, playerId, base = {}){
    const nowIso = base.updated_at || new Date().toISOString();
    const payload = {
        room_id: roomId,
        player_id: String(playerId || '').trim(),
        nickname: base.nickname || player?.nickname || 'Commander',
        joined_at: base.joined_at || nowIso,
        updated_at: nowIso,
        team: base.team || getBattleRoomPlayerTeam(playerId),
        level: Number(base.level || player?.level || 1) || 1,
        ping: Number(base.ping || 0) || 0,
        ...(base.position ? { position: base.position } : {}),
        ...(base.rotation ? { rotation: base.rotation } : {})
    };

    // Важно: id не генерируем сами.
    // В таблице room_players id должен оставаться серверным/существующим,
    // иначе Supabase может ловить 409/Conflict при upsert.
    if(base.id) payload.id = base.id;
    return payload;
}


// ===== V458 ROOM PLAYERS SYNC FIX =====
// ВАЖНО: для room_players больше НЕ используем Supabase upsert/on_conflict.
// У пользователя в консоли были постоянные 409 Conflict, поэтому делаем безопасно:
// 1) ищем существующую строку room_id + player_id
// 2) если есть — update по id
// 3) если нет — insert
// 4) если insert ловит duplicate — повторно ищем и update
async function upsertRoomPlayerRow(roomId, playerId, base = {}, selectClause = 'id,room_id,player_id,nickname,joined_at'){
    const client = window.supabaseClient || window.supabase || (typeof supabase !== 'undefined' ? supabase : null);

    try{
        const safeRoomId = sanitizeOnlineRoomId?.(roomId) || String(roomId || '').trim();
        const safePlayerId = String(playerId || authState?.playerId || player?.id || '').trim();

        if(!safeRoomId || !safePlayerId){
            return { data:null, error:new Error('missing roomId/playerId for room_players write') };
        }

        if(!client){
            return { data:null, error:new Error('Supabase client is not ready') };
        }

        const safeBase = (base && typeof base === 'object') ? base : { nickname: String(base || '').trim() };
        const payload = buildRoomPlayerRowPayload(safeRoomId, safePlayerId, {
            ...safeBase,
            nickname: safeBase.nickname || player?.nickname || getDisplayPlayerTag?.() || 'Commander',
            updated_at: safeBase.updated_at || new Date().toISOString()
        });

        const selectedColumns = String(selectClause || 'id,room_id,player_id,nickname,joined_at').trim();

        const findExistingRow = async () => {
            try{
                const found = await client
                    .from('room_players')
                    .select('id')
                    .eq('room_id', safeRoomId)
                    .eq('player_id', safePlayerId)
                    .limit(1);
                const id = Array.isArray(found?.data) && found.data[0]?.id ? String(found.data[0].id) : '';
                return { id, error: found?.error || null };
            }catch(error){
                return { id:'', error };
            }
        };

        const existing = await findExistingRow();

        if(existing.id){
            const updated = await client
                .from('room_players')
                .update({
                    nickname: payload.nickname,
                    updated_at: payload.updated_at,
                    team: payload.team,
                    level: payload.level,
                    ping: payload.ping,
                    ...(payload.position ? { position: payload.position } : {}),
                    ...(payload.rotation ? { rotation: payload.rotation } : {})
                })
                .eq('id', existing.id)
                .select(selectedColumns)
                .limit(1);

            return {
                data: Array.isArray(updated?.data) ? updated.data : (updated?.data ? [updated.data] : []),
                error: updated?.error || null
            };
        }

        const inserted = await client
            .from('room_players')
            .insert(payload)
            .select(selectedColumns)
            .limit(1);

        if(!inserted?.error){
            return {
                data: Array.isArray(inserted?.data) ? inserted.data : (inserted?.data ? [inserted.data] : []),
                error: null
            };
        }

        const msg = String(inserted?.error?.message || '').toLowerCase();
        const code = String(inserted?.error?.code || '').trim();

        if(code === '23505' || msg.includes('duplicate') || msg.includes('already exists')){
            const retryExisting = await findExistingRow();
            if(retryExisting.id){
                const updatedAfterDuplicate = await client
                    .from('room_players')
                    .update({
                        nickname: payload.nickname,
                        updated_at: payload.updated_at,
                        team: payload.team,
                        level: payload.level,
                        ping: payload.ping,
                        ...(payload.position ? { position: payload.position } : {}),
                        ...(payload.rotation ? { rotation: payload.rotation } : {})
                    })
                    .eq('id', retryExisting.id)
                    .select(selectedColumns)
                    .limit(1);

                return {
                    data: Array.isArray(updatedAfterDuplicate?.data) ? updatedAfterDuplicate.data : (updatedAfterDuplicate?.data ? [updatedAfterDuplicate.data] : []),
                    error: updatedAfterDuplicate?.error || null
                };
            }

            // Для duplicate считаем вход успешным, чтобы не ломать переход на карту.
            return { data:[], error:null };
        }

        return {
            data: Array.isArray(inserted?.data) ? inserted.data : (inserted?.data ? [inserted.data] : []),
            error: inserted?.error || null
        };

    }catch(error){
        console.warn('upsertRoomPlayerRow manual write warning:', error?.message || error);
        return { data:null, error:error || new Error('room_players manual write failed') };
    }
}

async function upsertRoomPlayerRowSafe(roomId, playerId, base = {}, selectClause = 'id,room_id,player_id,nickname,joined_at'){
    try{
        const result = await upsertRoomPlayerRow(roomId, playerId, base, selectClause);
        return result || { data:null, error:new Error('empty room_players write result') };
    }catch(error){
        console.warn('upsertRoomPlayerRowSafe warning:', error?.message || error);
        return { data:null, error:error || new Error('upsertRoomPlayerRowSafe failed') };
    }
}




function getJoinedLobbyRoomId(){
    const currentId = String(currentRoom?.id || currentRoom?.roomId || '').trim();
    if(currentId){
        const sanitizedCurrentId = sanitizeOnlineRoomId(currentId);
        if(sanitizedCurrentId) return sanitizedCurrentId;
    }
    const selectedId = String(selectedLobbyMap?.id || selectedLobbyMap?.roomId || '').trim();
    const isBaseMap = !!selectedLobbyMap?.isBaseMap;
    if(selectedId && !isBaseMap){
        const sanitizedSelectedId = sanitizeOnlineRoomId(selectedId);
        if(sanitizedSelectedId) return sanitizedSelectedId;
    }
    return '';
}

async function touchJoinedLobbyRoomPresence(force = false){
    // v437: В лобби нельзя писать игрока в room_players.
    // Иначе после выхода/выбора карты игрок снова появляется в комнате как ghost.
    return;
}

function ensureSelfRoomPlayerState(){
    if(gameState !== 'BATTLE') return;
    if(battleLeavingInProgress) return;
    if(!window.supabaseClient || roomPlayerStateUpsertInFlight) return;
    const roomId = getBattleRoomIdSafe();
    const playerId = getSelfBattlePlayerId();
    if(!roomId || !playerId || !playerShip) return;

    const stateSerial = Number(battleClientResetSerial || 0);
    const now = Date.now();
    const team = getBattleRoomPlayerTeam(playerId);
    const payload = {
        room_id: roomId,
        player_id: playerId,
        nickname: player?.nickname || 'Commander',
        team,
        level: Number(player?.level || 1) || 1,
        ping: getThrottledRoomPlayerPing(now),
        position: {
            x: Number(playerShip.position.x || 0),
            y: Number(playerShip.position.y || 0),
            z: Number(playerShip.position.z || 0),
            hp: Math.round(Number(playerHp || 0) || 0),
            maxHp: Math.round(Number(playerMaxHp || currentBattleShipStats?.hp || 100) || 100),
            shield: Math.round(Number(playerShield || 0) || 0),
            maxShield: Math.round(Number(playerMaxShield || currentBattleShipStats?.shieldCapacity || 0) || 0)
        },
        rotation: {
            x: Number(playerShip.quaternion.x || 0),
            y: Number(playerShip.quaternion.y || 0),
            z: Number(playerShip.quaternion.z || 0),
            w: Number(playerShip.quaternion.w || 1)
        },
        updated_at: new Date(now).toISOString()
    };

    let previousPayload = null;
    if(lastSelfRoomPlayerStatePayload){
        try{ previousPayload = JSON.parse(lastSelfRoomPlayerStatePayload); }catch(_){ previousPayload = null; }
    }

    const needsForceSend = (now - lastSelfRoomPlayerStateSentAt) >= ROOM_PLAYER_STATE_FORCE_INTERVAL_MS;
    const pingWindowPassed = (now - lastRoomPlayerPingAt) <= 60 || (now - lastRoomPlayerPingAt) >= ROOM_PLAYER_PING_UPDATE_MS;
    const changedMeta = !previousPayload
        || previousPayload.room_id !== payload.room_id
        || previousPayload.player_id !== payload.player_id
        || previousPayload.nickname !== payload.nickname
        || previousPayload.team !== payload.team
        || Number(previousPayload.level || 0) !== Number(payload.level || 0)
        || (pingWindowPassed && Number(previousPayload.ping || 0) !== Number(payload.ping || 0));
    const changedPosition = !previousPayload || hasMeaningfulBattleVectorDelta(previousPayload.position, payload.position, ROOM_PLAYER_POSITION_EPSILON);
    const changedRotation = !previousPayload || hasMeaningfulBattleQuaternionDelta(previousPayload.rotation, payload.rotation, ROOM_PLAYER_ROTATION_EPSILON);

    if(!needsForceSend && !changedMeta && !changedPosition && !changedRotation){
        return;
    }

    roomPlayerStateUpsertInFlight = true;

    (async () => {
        try{
            const isStillSameBattleSession = () => {
                if(battleLeavingInProgress) return false;
                if(stateSerial !== Number(battleClientResetSerial || 0)) return false;
                if(gameState !== 'BATTLE') return false;
                if(roomId !== getBattleRoomIdSafe()) return false;
                if(playerId !== getSelfBattlePlayerId()) return false;
                if(!window.supabaseClient) return false;
                return true;
            };

            if(!isStillSameBattleSession()) return;

            const updatePayload = {
                nickname: payload.nickname,
                team: payload.team,
                level: payload.level,
                ping: payload.ping,
                position: payload.position,
                rotation: payload.rotation,
                updated_at: payload.updated_at
            };

            let updateQuery = window.supabaseClient
                .from('room_players')
                .update(updatePayload)
                .eq('room_id', roomId)
                .eq('player_id', playerId)
                .select('id')
                .limit(1);

            if(selfRoomPlayerRowId){
                updateQuery = window.supabaseClient
                    .from('room_players')
                    .update(updatePayload)
                    .eq('id', selfRoomPlayerRowId)
                    .select('id')
                    .limit(1);
            }

            const { data: updatedRows, error: updateError } = await updateQuery;
            if(!isStillSameBattleSession()) return;

            let activeRowId = selfRoomPlayerRowId;
            if(Array.isArray(updatedRows) && updatedRows[0]?.id){
                activeRowId = String(updatedRows[0].id);
                selfRoomPlayerRowId = activeRowId;
            }

            const noUpdatedRows = !Array.isArray(updatedRows) || updatedRows.length <= 0;
            if(updateError || noUpdatedRows){
                if(!isStillSameBattleSession()) return;

                const { data: insertedRows, error: insertError } = await upsertRoomPlayerRowSafe(roomId, playerId, {
                    nickname: payload.nickname,
                    joined_at: payload.updated_at,
                    updated_at: payload.updated_at,
                    team: payload.team,
                    level: payload.level,
                    ping: payload.ping,
                    position: payload.position,
                    rotation: payload.rotation
                }, 'id');

                if(!isStillSameBattleSession()) return;
                if(insertError){
                    return;
                }
                if(Array.isArray(insertedRows) && insertedRows[0]?.id){
                    selfRoomPlayerRowId = String(insertedRows[0].id);
                }
            }

            lastSelfRoomPlayerStatePayload = JSON.stringify(payload);
            lastSelfRoomPlayerStateSentAt = now;
            cachedRoomPlayersFetchedAt = 0;
        }catch(_){
        }finally{
            roomPlayerStateUpsertInFlight = false;
        }
    })();
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

function showBattleFloatingReward(expValue = 0, coinValue = 0, worldPosition = null){
    if(gameState !== 'BATTLE') return;
    if(!camera || !worldPosition || typeof worldPosition.clone !== 'function') return;

    const expAmount = Math.max(0, Number(expValue || 0) || 0);
    const coinAmount = Math.max(0, Number(coinValue || 0) || 0);
    if(!expAmount && !coinAmount) return;

    const anchor = worldPosition.clone();
    anchor.y += 2.6;
    const projected = anchor.project(camera);
    if(projected.z < -1 || projected.z > 1) return;

    const node = document.createElement('div');
    node.className = 'battle-floating-reward';
    node.innerHTML = `${expAmount ? `<span class="reward-chip exp">EXP +${expAmount}</span>` : ''}${coinAmount ? `<span class="reward-chip coin">● +${coinAmount}</span>` : ''}`;
    node.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`;
    node.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`;
    document.body.appendChild(node);

    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => node.classList.add('fade'), 1100);
    setTimeout(() => node.remove(), 2100);
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

    const mirrorToBattle = options?.mirrorToBattle !== false;

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
            room_id: GLOBAL_BATTLE_ARCHIVE_ROOM_ID,
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
    if(Array.isArray(soloEnemyBots)){
        soloEnemyBots.forEach(bot => { try{ if(bot) scene.remove(bot); }catch(_){} });
        soloEnemyBots = [];
    }
    try{ soloBotScoreRows = new Map(); }catch(_){}
    lastEndlessBotSpawnAt = 0;

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

    try{ removeBattleSolarSystemView?.(); }catch(_){}

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
    battleKillCombo = 0;
    battleLastKillAt = 0;
    battleProcessedHitIds.clear();
    battleObserverMode = false;
    observerCameraYaw = 0;
    observerCameraPitch = -0.2;
    observerCameraDistance = 34;
    battlePlanetVisualScale = 1;
    battleShipCrash = null;
    battlePendingRespawnAt = 0;
    battlePlanetCapture = null;
    battleEnergyPool = 0;
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

async function switchState(newState){
    const prevState = gameState;
    const leavingBattle = (prevState === "BATTLE" || prevState === "OBSERVE") && newState !== "BATTLE" && newState !== "OBSERVE";
    const leaveRoomSnapshot = leavingBattle && currentRoom ? { ...currentRoom } : currentRoom;

    if(document.pointerLockElement){
        document.exitPointerLock();
    }

    if(leavingBattle){
        battleLeavingInProgress = true;
        try{
            const leaveRoomId = sanitizeOnlineRoomId(leaveRoomSnapshot?.id || leaveRoomSnapshot?.roomId || '');
            const selfPlayerId = String(getSelfBattlePlayerId() || authState?.playerId || player?.id || '').trim();
            const selfNickname = player?.nickname || 'Commander';
            if(leaveRoomId && selfPlayerId){
                await sendBattlePresenceEvent('pilot-left', {
                    playerId: selfPlayerId,
                    nickname: selfNickname,
                    roomId: leaveRoomId
                });
            }
        }catch(_){}
        hardResetBattleClientState();
        resetBattleSessionCounters();
    }

    gameState = newState;
    try{ window.gameState = newState; }catch(_){ }
    try{
        document.body.classList.toggle('cosmic-in-battle', newState === 'BATTLE' || newState === 'OBSERVE');
        document.body.classList.toggle('cosmic-in-lobby', newState === 'LOBBY');
        document.body.classList.toggle('cosmic-in-auth', newState === 'AUTH');
    }catch(_){ }
    if(newState === "BATTLE" || newState === "OBSERVE") battleLeavingInProgress = false;
    if(newState !== "BATTLE") { try{ updateSoloMissionHud?.(); hideSoloMissionResult?.(); }catch(_){} }

    const canvas = document.querySelector("canvas");
    const lobby = document.getElementById("lobby-screen");
    const orbitExit = document.getElementById("orbit-exit");
    const topNav = document.getElementById("top-nav");
    const battleScreen = document.getElementById("battle-screen");
    const resourceBar = document.getElementById("resource-bar");
    const ui = document.getElementById("ui");
    const premiumBar = document.getElementById("premium-bar");
    const authScreen = document.getElementById("auth-screen");

    if(canvas) canvas.style.setProperty('display', 'none', 'important');
    if(lobby) lobby.style.setProperty('display', 'none', 'important');
    if(authScreen) authScreen.style.setProperty('display', 'none', 'important');
    if(orbitExit) orbitExit.style.setProperty('display', 'none', 'important');
    if(topNav) topNav.style.setProperty('display', 'none', 'important');
    if(battleScreen) battleScreen.style.setProperty('display', 'none', 'important');
    if(resourceBar) resourceBar.style.setProperty('display', 'none', 'important');
    if(ui) ui.style.setProperty('display', 'none', 'important');
    if(premiumBar) premiumBar.style.setProperty('display', 'none', 'important');
    setHangarChatMode(false, false);
        __restoreHangarChatPanel();

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
        if(!document.body.classList.contains('cosmic-auth-passed')){
            if(authScreen) authScreen.style.setProperty('display', 'flex', 'important');
        }
    }

    if(gameState === "LOBBY"){
        if(lobby) lobby.style.setProperty('display', 'flex', 'important');
        if(topNav) topNav.style.setProperty('display', 'flex', 'important');
        updatePremiumAccountInfo();
        if(premiumBar) premiumBar.style.setProperty('display', 'flex', 'important');
        if(typeof renderRoomsInLobby === 'function'){
            renderRoomsInLobby();
        }
    }

    if(gameState === "ORBIT"){
        if(canvas) canvas.style.setProperty('display', 'block', 'important');
        if(orbitExit) orbitExit.style.setProperty('display', 'block', 'important');
        if(resourceBar) resourceBar.style.setProperty('display', 'flex', 'important');
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
    if(battleScreen) battleScreen.style.setProperty('display', 'block', 'important');
    updateBattlePlayerHud();
    startBattleHudLoops();
    initBattleHudControls();

    if(canvas){
        canvas.style.setProperty('display', 'block', 'important');

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
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    battleEnergyCapacity = Math.max(20, Number(currentBattleShipStats?.energyCapacity || 60) || 60);
    battleEnergyPool = Math.min(Math.max(0, Number(playerResources?.solar_energy || 0) || 0), battleEnergyCapacity);
    initBattleChat();
    if(battleObserverMode){
        setupObserverBattle(targetMap);
        const hud = document.getElementById('enemy-hud'); if(hud) hud.style.display = 'none';
        const cross = document.getElementById('battle-crosshair'); if(cross) cross.style.display = 'none';
    } else {
        const cross = document.getElementById('battle-crosshair'); if(cross) cross.style.display = 'block';
        spawnPlayer();
        verifyBattleSceneVisibleV457('switchState-immediate');
        setTimeout(() => { try{ verifyBattleSceneVisibleV457('switchState-delay-180'); }catch(_){} }, 180);
        setTimeout(() => { try{ verifyBattleSceneVisibleV457('switchState-delay-700'); }catch(_){} }, 700);
        if(isSoloBattleActive()){
            activeSoloMission = { ...(currentRoom || selectedLobbyMap || {}), real: targetMap, name: targetMap };
            activeSoloMissionCompleted = false;
            activeSoloMissionEnded = false;
            hideSoloMissionResult?.();
            battleStats.playerKills = 0; battleStats.playerDeaths = 0; battleStats.botKills = 0; battleStats.botDeaths = 0;
            soloBotScoreRows = new Map();
            soloEnemyBots.forEach(bot => { try{ if(bot?.parent) bot.parent.remove(bot); else scene?.remove?.(bot); }catch(_){} });
            soloEnemyBots = [];
            enemyBot = null;
            endlessSoloCurrentStage = 1; endlessSoloLastBannerStage = 1; endlessSoloLastKillCount = 0;
            lastEndlessBotSpawnAt = 0;
            createEnemyBot();
            updateEnemyHud();
            updateSoloMissionHud?.();
            updateBattleScoreboard();
        }else{
            activeSoloMission = null;
            activeSoloMissionCompleted = false;
            activeSoloMissionEnded = false;
            updateSoloMissionHud?.();
            hideSoloMissionResult?.();
            markBattlePresenceAnnouncementsMuted(2500);
            setTimeout(() => { try{ ensureSelfRoomPlayerState(); }catch(_){} }, 80);
            setTimeout(() => { try{ ensureSelfRoomPlayerState(); syncCurrentOnlinePresence?.(); loadRoomsFromSupabase?.(); }catch(_){} }, 450);
            updateEnemyHud();
            updateBattleScoreboard();
            startLiveBattleSync();
        }
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

if(leavingBattle){
    Promise.resolve()
        .then(() => cleanupCurrentBattleRoom(leaveRoomSnapshot))
        .catch(() => {})
        .finally(() => {
            hardResetBattleClientState();
        });
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

  coins: 2500,
  crystals: 50
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
                await clearBattleKillFeed?.();
                    clearBattleBotNameLabels?.();
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

sprite.scale.set(18.0, 4.0, 1);
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

const sunMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
    map: sunTexture,
    color: 0xffffff
});

const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0,0,0);

const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(9.6, 48, 48),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
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
    { id: 'scout_1', name: "Венера", img: "maps/venus.jpg" },
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

"coins": { icon: "🟡", name: "Монеты" },
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

    const miningBonusV459 = Math.max(0, Number(getProfileSkillBonusV459?.('mining', 0.05) || 0) || 0);
    const harvestAmountV459 = Math.max(1, Math.round(Number(damage || 1) * (1 + miningBonusV459)));

    planet.currentResourceAmount -= harvestAmountV459;

    if(planet.currentResourceAmount < 0)
        planet.currentResourceAmount = 0;

    const planetResList = planetResources[planet.name] || [];
    const randomResource = planetResList[0];

    if(randomResource){
        if(!playerResources[randomResource])
            playerResources[randomResource] = 0;

        playerResources[randomResource] += harvestAmountV459;
        inventory.addResource(randomResource, harvestAmountV459, planet.name);
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
    isApplyingSaveDataV459 = true;
    try{ syncProfileBattleStatsFromSaveV438(save); }catch(_){}
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
    if(save.selectedShipId) player.selectedShipId = String(save.selectedShipId || '').trim() || player.selectedShipId; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){}
    if(Array.isArray(save.ownedModuleIds)){
        player.ownedModuleIds = Array.from(new Set(save.ownedModuleIds.map(id => String(id || '').trim()).filter(Boolean)));
    }
    if(save.activeModulesByShip && typeof save.activeModulesByShip === 'object'){
        player.activeModulesByShip = save.activeModulesByShip;
    }
    const savedSelectedShipIdV446 = String(save?.selectedShipId || save?.selected_ship_id || save?.shipId || save?.ship_id || '').trim();
    if(savedSelectedShipIdV446){ player.selectedShipId = savedSelectedShipIdV446; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} }
    const savedSelectedShipIdV448 = String(save?.selectedShipId || save?.selected_ship_id || save?.shipId || save?.ship_id || '').trim();
    if(savedSelectedShipIdV448){ try{ setSelectedShipIdEverywhereV448?.(savedSelectedShipIdV448); }catch(_){ player.selectedShipId = savedSelectedShipIdV448; } }
    try{ applyProfileSkillsFromSaveV440?.(save); }catch(_){}
    ensureShopOwnershipDefaults?.();
    ensureModuleOwnershipDefaults?.();
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    for(let i=0;i<planets.length;i++) planets[i].unlocked = i < currentLevel;
    try{ applyProfileSkillsLocalFallbackV459?.(); }catch(_){}
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
    isApplyingSaveDataV459 = false;
}

function getSafePlayerPublicId(){
    const raw = authState?.playerId;
    if(raw && typeof raw.then === 'function') return 0;
    const num = Number(raw);
    if(Number.isFinite(num) && num > 0) return Math.floor(num);
    return 0;
}

async function loadRemoteSaveFromSupabase(){
    const safePublicId = getSafePlayerPublicId();
    if(!window.supabaseReady || !window.supabaseClient || authState.mode !== 'account' || !safePublicId) return null;
    try{
        const { data, error } = await window.supabaseClient
            .from('player_saves')
            .select('save_data')
            .eq('player_public_id', safePublicId)
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
    try{ syncProfileBattleStatsFromSaveV438(loadProfileBattleStatsLocalV439?.() || {}); }catch(_){}
    try{ applyProfileSkillsLocalFallbackV459?.(); }catch(_){}
    const saveKey = getActiveSaveKey();
    if(saveKey){
        const localData = localStorage.getItem(saveKey);
        if(localData){
            try{ applySaveData(JSON.parse(localData)); }catch(error){ console.warn('Ошибка чтения local save:', error); }
        }
    }
    const remoteSave = await loadRemoteSaveFromSupabase();
    if(remoteSave) applySaveData(remoteSave);
    try{ applyProfileSkillsLocalFallbackV459?.(); }catch(_){}
    try{ syncProfileBattleStatsFromSaveV438(loadProfileBattleStatsLocalV439?.() || {}); }catch(_){}
    ensureShopOwnershipDefaults?.();
    ensureModuleOwnershipDefaults?.();
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    refreshOwnedShipsInventory?.();
}


function toSafeWholeNumber(value, fallback = 0){
    const num = Number(value);
    if(!Number.isFinite(num)) return Math.trunc(Number(fallback || 0)) || 0;
    return num >= 0 ? Math.floor(num) : Math.ceil(num);
}

function isTournamentRespawnMatch(){
    return gameState === 'BATTLE' && !!(
        currentRoom?.mode === 'TOURNAMENT' ||
        currentRoom?.state === 'tournament' ||
        String(currentRoom?.id || currentRoom?.roomId || '').startsWith('tournament_')
    );
}

function sleep(ms = 0){
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function buildSavePayload(){
    try{ syncProfileBattleStatsFromSaveV438(loadProfileBattleStatsLocalV439?.() || {}); }catch(_){}
    const profileTotalsV439 = getProfileBattleTotalsForSaveV438();
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
        activeModulesByShip: player.activeModulesByShip && typeof player.activeModulesByShip === 'object' ? JSON.parse(JSON.stringify(player.activeModulesByShip)) : {},
        selectedShipId: String(player.selectedShipId || 'scout_1'),
        selected_ship_id: String(player.selectedShipId || 'scout_1'),
        skillLevels: getProfileSkillsForSaveV440?.() || {},
        skills: getProfileSkillsForSaveV440?.() || {},
        skillPointsTotal: getProfileSkillTotalPointsV440?.() || 0,
        skillPointsSpent: getProfileSkillSpentPointsV440?.() || 0,
        battleStats: profileTotalsV439,
        totalKills: profileTotalsV439.totalKills,
        totalDeaths: profileTotalsV439.totalDeaths,
        teamPoints: profileTotalsV439.teamPoints,
        flagsCaptured: profileTotalsV439.flagsCaptured,
        tournamentWins: profileTotalsV439.tournamentWins,
        experienceMax: getProfileExperienceMaxV429(player?.level || currentLevel || 1)
    };
}

async function saveRemoteProgress(){
    const safePublicId = getSafePlayerPublicId();
    if(!window.supabaseReady || !window.supabaseClient || authState.mode !== 'account' || !safePublicId) return;
    markLocalResourceDirty(6000);
    const payload = buildSavePayload();
    try{
        /* safePublicId already prepared */
        const { error: playerUpdateError } = await window.supabaseClient.from('players').update({
            nickname: player.nickname,
            level: toSafeWholeNumber(player.level, 1),
            experience: toSafeWholeNumber(player.experience || 0, 0),
            credits: toSafeWholeNumber(playerResources.coins || player.credits || 0, 0),
            mercury_ore: toSafeWholeNumber(playerResources.mercury_ore || 0, 0),
            venus_gas: toSafeWholeNumber(playerResources.venus_gas || 0, 0),
            earth_water: toSafeWholeNumber(playerResources.earth_water || 0, 0),
            mars_crystal: toSafeWholeNumber(playerResources.mars_crystal || 0, 0),
            jupiter_hydrogen: toSafeWholeNumber(playerResources.jupiter_hydrogen || 0, 0),
            saturn_ice: toSafeWholeNumber(playerResources.saturn_ice || 0, 0),
            uranus_ammonia: toSafeWholeNumber(playerResources.uranus_ammonia || 0, 0),
            neptune_methane: toSafeWholeNumber(playerResources.neptune_methane || 0, 0),
            solar_energy: toSafeWholeNumber(playerResources.solar_energy || 0, 0),
            crystals: toSafeWholeNumber(playerResources.crystals || 0, 0)
        }).eq('public_id', safePublicId);

        if(playerUpdateError){
            console.warn('Не удалось обновить players:', playerUpdateError.message || playerUpdateError);
        }

        const { error } = await window.supabaseClient.from('player_saves').upsert({
            player_public_id: safePublicId,
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
    if(isHangarGuestView?.()) return;
    try{ persistProfileBattleStatsLocalV439(); }catch(_){}
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

setInterval(() => {
    if(authState?.isAuthenticated && gameState === 'LOBBY'){
        touchJoinedLobbyRoomPresence();
    }
}, 2500);

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

    // V459: навык регена щита постепенно восстанавливает HP в бою.
    try{
        const regenLevelV459 = getProfileSkillLevelV459?.('shieldRegen') || 0;
        if(regenLevelV459 > 0 && !battleShipCrash && !isBattleRespawning?.()){
            playerHp = Math.min(playerMaxHp, Number(playerHp || 0) + regenLevelV459 * 0.006);
            if(Number(playerMaxShield || 0) > 0){
                playerShield = Math.min(playerMaxShield, Number(playerShield || 0) + Number(currentBattleShipStats?.shieldRegenPerTick || 0));
            }
        }
        updatePlayerShieldFieldV460?.();
    }catch(_){}

    updateBattlePlayerWorldHp();
    updateBattlePlayerWorldName();
    if(battleShipCrash){
        updateShipCrashAnimation();
    } else if(isBattlePlanetCaptureActive()){
        updateBattlePlanetCapture();
    } else if(!isBattleRespawning()) {
    if(firing) tryFireLaser();

    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    const yawStep = Number(currentBattleShipStats.turnYaw || 0.00135) * gameSettings.mouseSensitivity;
    const pitchStep = Number(currentBattleShipStats.turnPitch || 0.0011) * gameSettings.mouseSensitivity;
    const invertFactor = gameSettings.invertY ? -1 : 1;
    const maxPitch = Math.PI / 3.1;
    const maxRoll = Number(currentBattleShipStats.rollLimit || 0.58);
    let forwardAcceleration = Number(currentBattleShipStats.forwardAcceleration || 0.09);
    let backwardAcceleration = Number(currentBattleShipStats.backwardAcceleration || 0.045);
    let strafeAcceleration = Number(currentBattleShipStats.strafeAcceleration || 0.028);
    let damping = Number(currentBattleShipStats.damping || 0.98);
    let maxSpeed = Number(currentBattleShipStats.maxSpeed || 2.4);
    const hasMoveInput = !!(keys.w || keys.s || keys.a || keys.d);
    if(!Number.isFinite(battleEnergyCapacity) || battleEnergyCapacity <= 0){
        battleEnergyCapacity = Math.max(20, Number(currentBattleShipStats?.energyCapacity || 60) || 60);
    }
    if(!Number.isFinite(battleEnergyPool) || battleEnergyPool < 0){
        battleEnergyPool = Math.min(Math.max(0, Number(playerResources?.solar_energy || 0) || 0), battleEnergyCapacity);
    }
    const boostDrain = Math.max(0.0015, 0.0045 * (1 - Number(currentBattleShipStats?.boostEfficiencyBonus || 0)));
    const boostActive = !!(keys.shift && hasMoveInput && battleEnergyPool > boostDrain);
    if(boostActive){
        forwardAcceleration *= (1.62 + Number(currentBattleShipStats?.boostDurationBonus || 0));
        backwardAcceleration *= 1.34;
        strafeAcceleration *= 1.22;
        maxSpeed *= 1.42;
        damping = Math.min(0.992, damping + 0.004);
        battleEnergyPool = Math.max(0, battleEnergyPool - boostDrain);
        playerResources.solar_energy = Math.max(0, Number(playerResources?.solar_energy || 0) - boostDrain);
    }

    playerControl.yaw -= mouseDeltaX * yawStep * 0.62;
    playerControl.pitch += mouseDeltaY * pitchStep * invertFactor * 0.62;
    playerControl.pitch = THREE.MathUtils.clamp(playerControl.pitch, -maxPitch, maxPitch);

    let targetRoll = THREE.MathUtils.clamp(-mouseDeltaX * 0.0034, -maxRoll, maxRoll);
    if (keys.a) targetRoll = Math.min(maxRoll, targetRoll + 0.11);
    if (keys.d) targetRoll = Math.max(-maxRoll, targetRoll - 0.11);
    playerControl.roll += (targetRoll - playerControl.roll) * 0.06;

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
        updateProjectileVisual(laser);
        const previousPosition = laser.mesh.position.clone();
        laser.mesh.position.add(laser.velocity);
        laser.life -= 1;

        const hitBots = isSoloBattleActive() ? getActiveSoloBots() : (enemyBot ? [enemyBot] : []);
        let hitEnemyBot = null;
        for(const bot of hitBots){
            if(bot && bot.userData?.alive !== false && laser.mesh.position.distanceTo(bot.position) < (Number(bot.userData?.hitRadius || 0) || 3.4)){
                hitEnemyBot = bot;
                break;
            }
        }
        if (hitEnemyBot) {
            const armor = Math.max(0, Math.min(0.65, Number(hitEnemyBot.userData?.armor || 0) || 0));
            let rawLaserDamageV459 = Number(laser.damage || 0) || 1;
            try{
                const critChanceV459 = Number(currentBattleShipStats?.critChance || 0) || 0;
                if(critChanceV459 > 0 && Math.random() < critChanceV459){
                    rawLaserDamageV459 *= Number(currentBattleShipStats?.critDamageMult || 1.5) || 1.5;
                    try{ laser.mesh.userData.critical = true; }catch(_){}
                }
            }catch(_){}
            const dealtDamage = Math.max(1, Math.round(rawLaserDamageV459 * (1 - armor)));
            hitEnemyBot.userData.hp -= dealtDamage;
            scene.remove(laser.mesh);
            activeLasers.splice(i, 1);
            enemyBot = hitEnemyBot;
            updateSoloBotHpBar(hitEnemyBot);
            updateEnemyHud();
            if (hitEnemyBot.userData.hp <= 0) {
                const defeatedName = hitEnemyBot?.userData?.name || 'UFO Raider';
                const defeatedId = String(hitEnemyBot?.userData?.id || 'BOT');
                const defeatedPos = hitEnemyBot.position.clone();
                spawnShipDebris(defeatedPos, 0xff7755);
                scene.remove(hitEnemyBot);
                soloEnemyBots = soloEnemyBots.filter(bot => bot !== hitEnemyBot);
                if(enemyBot === hitEnemyBot) enemyBot = soloEnemyBots[0] || null;
                hitEnemyBot.userData.alive = false;
                battleStats.playerKills += 1;
                battleStats.botDeaths += 1;
                try{ recordProfileBattleStatsV438(1, 0); }catch(_){}
                const savedRow = soloBotScoreRows.get(defeatedId) || { id:defeatedId, nickname:defeatedName, kills:0, deaths:0, level:Math.max(1, Number(activeSoloMission?.minLevel || player?.level || 1) || 1), team:'red' };
                savedRow.deaths = Number(savedRow.deaths || 0) + 1;
                savedRow.deadUntil = Date.now() + 3000;
                try{ hitEnemyBot.userData.scoreDeaths = savedRow.deaths; }catch(_){}
                soloBotScoreRows.set(defeatedId, savedRow);
                try{ pushBattleKillFeedLine(`${player?.nickname || 'Commander'} уничтожил ${defeatedName}`); }catch(_){}
                if(isSoloBattleActive()) awardSoloBotKillReward(defeatedPos);
                if(!isSoloBattleActive()) pushKillFeed(`${player?.nickname || 'Commander'} уничтожил ${defeatedName}`, 'kill');
                updateEnemyHud();
                updateSoloMissionHud?.();
                updateBattleScoreboard();
                if(isSoloBattleActive() && !isEndlessSoloBattle() && battleStats.playerKills >= getActiveSoloMissionGoal()) completeActiveSoloMission();
                else if(isSoloBattleActive() && !isEndlessSoloBattle()) setTimeout(() => { if(gameState === 'BATTLE' && isSoloBattleActive() && !activeSoloMissionEnded && !enemyBot) createEnemyBot(); }, 1400);
                else if(isEndlessSoloBattle()) lastEndlessBotSpawnAt = Date.now();
            }
            continue;
        }

        const segmentEnd = laser.mesh.position.clone();
        let hitRemoteShip = false;
        let bestRemoteId = '';
        let bestRemoteEntry = null;
        let bestRemoteDistance = Infinity;
        remoteBattleShips.forEach((entry, entryId) => {
            if(!entry?.mesh) return;
            const hitDistance = getRemoteShipHitDistance(entry, previousPosition, segmentEnd);
            if(hitDistance <= 0 && hitDistance < bestRemoteDistance){
                bestRemoteDistance = hitDistance;
                bestRemoteId = String(entryId || '').trim();
                bestRemoteEntry = entry;
            }
        });
        if(bestRemoteId && bestRemoteEntry){
            hitRemoteShip = true;
            applyPredictedRemoteDamageV338(bestRemoteId, bestRemoteEntry, laser.damage);
            broadcastBattleHit(bestRemoteId, laser.damage, bestRemoteEntry?.nickname || bestRemoteEntry?.mesh?.userData?.pilotName || 'Pilot');
            scene.remove(laser.mesh);
            activeLasers.splice(i, 1);
        }
        if(hitRemoteShip){
            continue;
        }

        if (laser.life <= 0) {
            scene.remove(laser.mesh);
            activeLasers.splice(i, 1);
        }
    }

    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        const laser = enemyLasers[i];
        updateProjectileVisual(laser);
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
            if(laser.pullStrength && laser.shooter){
                const pullDir = laser.shooter.position.clone().sub(playerShip.position).normalize();
                shipVelocity.add(pullDir.multiplyScalar(Number(laser.pullStrength || 0)));
            }
            applyPlayerShieldedDamageV460(laser.damage, laser.shooter || enemyBot);
            if(playerHp <= 0 && !isBattleRespawning() && !activeSoloMissionEnded){
                battleStats.botKills += 1;
                battleStats.playerDeaths += 1;
                try{ recordProfileBattleStatsV438(0, 1); }catch(_){}
    try{ pushBattleKillFeedLine(`${enemyBot?.userData?.name || 'UFO Raider'} уничтожил ${player?.nickname || 'Commander'}`); }catch(_){}
                const killerBot = laser.shooter || enemyBot;
                const killerId = String(killerBot?.userData?.id || 'BOT');
                if(killerId){
                    const row = soloBotScoreRows.get(killerId) || { id:killerId, nickname:killerBot?.userData?.name || 'UFO Raider', kills:0, deaths:0, level:Math.max(1, Number(activeSoloMission?.minLevel || player?.level || 1) || 1), team:'red' };
                    row.kills = Number(row.kills || 0) + 1;
                    soloBotScoreRows.set(killerId, row);
                }
                if(!isSoloBattleActive()) pushKillFeed(`${enemyBot?.userData?.name || 'Drone_x1'} уничтожил ${player?.nickname || 'Commander'}`);
                updateSoloMissionHud?.();
                updateBattleScoreboard();
                if(playerShip){
                    spawnShipDebris(playerShip.position.clone(), 0x64d8ff);
                }
                if(isSoloBattleActive() && getSoloLivesLeft() <= 0){
                    failActiveSoloMission();
                }else{
                    scheduleBattleRespawn(2000);
                }
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

    const activeBots = isSoloBattleActive() ? getActiveSoloBots() : (enemyBot ? [enemyBot] : []);
    if (playerShip && activeBots.length) {
        activeBots.forEach((bot, botIndex) => {
            if(!bot || bot.userData?.alive === false) return;
            const endlessMode = isEndlessSoloBattle();
            bot.userData.strafePhase += (endlessMode ? 0.0045 : 0.010) + botIndex * 0.00045;
            const toPlayerVector = playerShip.position.clone().sub(bot.position);
            const distanceToPlayer = Math.max(1, toPlayerVector.length());
            const desiredForward = toPlayerVector.clone().normalize();
            const sideRaw = new THREE.Vector3(0,1,0).cross(desiredForward);
            const side = sideRaw.lengthSq() > 0.0001 ? sideRaw.normalize() : new THREE.Vector3(1,0,0);

            let desiredPos;
            if(endlessMode){
                const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();
                const slotAngle = (botIndex / Math.max(1, activeBots.length)) * Math.PI * 2 + Number(bot.userData.strafePhase || 0) * 0.13;
                const attackDistance = THREE.MathUtils.clamp(Number(bot.userData?.preferredDistance || 74) || 74, 48, 105);
                const ringOffset = side.clone().multiplyScalar(Math.sin(slotAngle) * (24 + botIndex * 3));
                const verticalOffset = new THREE.Vector3(0, Math.cos(slotAngle * 1.37) * 12, 0);
                const frontOffset = playerForward.clone().multiplyScalar(-(attackDistance + Math.cos(slotAngle) * 12));

                if(distanceToPlayer > 430 || Number(bot.userData.edgeReturnUntil || 0) > Date.now()){
                    desiredPos = playerShip.position.clone()
                        .add(playerForward.clone().multiplyScalar(-Math.min(135, attackDistance + 30)))
                        .add(ringOffset.multiplyScalar(0.55))
                        .add(verticalOffset.multiplyScalar(0.45));
                }else if(distanceToPlayer < 46){
                    desiredPos = playerShip.position.clone()
                        .add(desiredForward.clone().multiplyScalar(-62))
                        .add(ringOffset.multiplyScalar(0.22));
                }else{
                    desiredPos = playerShip.position.clone()
                        .add(frontOffset)
                        .add(ringOffset)
                        .add(verticalOffset);
                }
                desiredPos = clampVectorToEndlessCombatZone(desiredPos, 120);
            }else{
                const preferredDistance = 36;
                const keepOffset = distanceToPlayer < preferredDistance ? -preferredDistance : -Math.min(preferredDistance, Math.max(42, distanceToPlayer * 0.32));
                desiredPos = playerShip.position.clone()
                    .add(desiredForward.clone().multiplyScalar(keepOffset))
                    .add(side.multiplyScalar(Math.sin(bot.userData.strafePhase) * 7));
                desiredPos.y += Math.cos(bot.userData.strafePhase * 1.7) * 2.2;
            }

            if(!bot.userData.botMoveVelocity || typeof bot.userData.botMoveVelocity.add !== 'function') bot.userData.botMoveVelocity = new THREE.Vector3();
            const toDesired = desiredPos.clone().sub(bot.position);
            const desiredDistance = toDesired.length();
            const botMaxStep = endlessMode ? 1.55 : 0.82;
            const botAccel = endlessMode ? 0.062 : 0.036;
            const botDamping = endlessMode ? 0.905 : 0.935;
            if(desiredDistance > 0.001){
                const acceleration = toDesired.normalize().multiplyScalar(Math.min(botAccel * desiredDistance, botMaxStep * 0.28));
                bot.userData.botMoveVelocity.add(acceleration);
            }
            if(endlessMode && distanceToPlayer > 150){
                bot.userData.botMoveVelocity.add(desiredForward.clone().multiplyScalar(0.075));
            }
            bot.userData.botMoveVelocity.clampLength(0, botMaxStep);
            bot.position.add(bot.userData.botMoveVelocity);
            bot.userData.botMoveVelocity.multiplyScalar(botDamping);
            clampEndlessBotToCombatZone(bot);
            handleBattleCollisions(bot);
            const aimTarget = playerShip.position.clone().add(shipVelocity.clone().multiplyScalar(endlessMode ? 1.4 : 4.5));
            bot.lookAt(aimTarget);
            bot.rotation.z += ((Math.sin(bot.userData.strafePhase) * (endlessMode ? 0.16 : 0.34)) - bot.rotation.z) * 0.08;

            const cooldown = endlessMode
                ? (850 + botIndex * 85 + Math.random() * 260)
                : botShotCooldown;
            if (Date.now() - Number(bot.userData.lastShotAt || 0) > cooldown) {
                bot.userData.lastShotAt = Date.now();
                fireBotLaser(bot);
            }
        });
    }
    ensureEndlessSoloBotWave?.();
    updateSoloBotHpBars?.();

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();
    const followDistance = Number(playerShip?.userData?.cameraDistance || 16) || 16;
    const followHeight = Number(playerShip?.userData?.cameraHeight || 5.5) || 5.5;
    const desiredPosition = playerShip.position.clone()
        .add(direction.clone().multiplyScalar(-followDistance))
        .add(new THREE.Vector3(0, followHeight, 0));

    camera.position.lerp(desiredPosition, 0.10);
    camera.lookAt(playerShip.position.clone().add(direction.clone().multiplyScalar(35)));
}

updateDebrisPieces();
if((gameState === "BATTLE" || gameState === "OBSERVE") && battleObserverMode){
    updateObserverBattle();
}
if(gameState === "BATTLE" && isEndlessSoloBattle()){
    if(!battleSolarSystemGroup){ try{ createBattleSolarSystemView?.(); }catch(_){} }
    updateBattleSolarSystemView?.();
}else{
    try{ removeBattleSolarSystemView?.(); }catch(_){}
}
limitBattleArea();
updateBattlePlayerHud();

if(gameState === "BATTLE" && playerShip){
    try{
        const canvas = renderer?.domElement || document.querySelector('canvas');
        if(canvas){
            canvas.style.setProperty('display', 'block', 'important');
            canvas.style.setProperty('visibility', 'visible', 'important');
            canvas.style.setProperty('opacity', '1', 'important');
        }
    }catch(_){}
}

renderer.render(scene,camera);
}


function playEffectSound(sound){
    if(!gameSettings.soundEnabled) return;
    if(!sound || !sound.buffer) return;

    if(sound.isPlaying) sound.stop();
    sound.play();
}


function createProjectileVisual(weaponType, options = {}){
    const group = new THREE.Group();
    const color = new THREE.Color(options.color || '#ff3355');
    const coreColor = new THREE.Color(options.coreColor || '#ffffff');
    const width = Number(options.width || 0.14) || 0.14;
    const length = Number(options.length || 2.2) || 2.2;
    const scale = Number(options.scale || 1) || 1;

    const addGlowShell = (sx, sy, sz, glowColor, opacity = 0.28) => {
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(1, 10, 10),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: glowColor, transparent:true, opacity, depthWrite:false })
        );
        glow.scale.set(sx, sy, sz);
        group.add(glow);
        return glow;
    };

    if(weaponType === 'missile'){
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.34, width * 0.62, length * 0.98, 10),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color })
        );
        body.rotation.x = Math.PI / 2;
        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(width * 0.62, length * 0.34, 10),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: coreColor })
        );
        tip.rotation.x = -Math.PI / 2;
        tip.position.z = -length * 0.64;
        const flame = new THREE.Mesh(
            new THREE.ConeGeometry(width * 0.34, length * 0.48, 8),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#ffd27a', transparent:true, opacity:0.95 })
        );
        flame.rotation.x = Math.PI / 2;
        flame.position.z = length * 0.62;
        const finOffsets = [[0, width * 0.36], [0, -width * 0.36], [width * 0.36, 0], [-width * 0.36, 0]];
        finOffsets.forEach(([x, y]) => {
            const fin = new THREE.Mesh(
                new THREE.BoxGeometry(width * 0.14, width * 0.7, length * 0.26),
                new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: coreColor })
            );
            fin.position.set(x, y, length * 0.22);
            group.add(fin);
        });
        group.add(body, tip, flame);
        addGlowShell(width * 2.1, width * 1.3, length * 0.95, color, 0.22);
        group.userData.visualType = 'missile';
        group.userData.flame = flame;
    }else if(weaponType === 'plasma'){
        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(width * 1.18 * scale, 12, 12),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color })
        );
        const core = new THREE.Mesh(
            new THREE.SphereGeometry(width * 0.62 * scale, 10, 10),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: coreColor })
        );
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(width * 1.3 * scale, width * 0.16 * scale, 8, 18),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: '#ffd59c', transparent:true, opacity:0.7 })
        );
        ring.rotation.y = Math.PI / 2;
        group.add(orb, core, ring);
        addGlowShell(width * 3.1, width * 2.0, width * 3.1, '#ffb380', 0.3);
        group.userData.visualType = 'plasma';
        group.userData.ring = ring;
    }else if(weaponType === 'phase'){
        const shard = new THREE.Mesh(
            new THREE.OctahedronGeometry(width * 1.15 * scale, 0),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color })
        );
        shard.scale.z = length * 0.42;
        const core = new THREE.Mesh(
            new THREE.OctahedronGeometry(width * 0.48 * scale, 0),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: coreColor })
        );
        core.scale.z = length * 0.22;
        const ringA = new THREE.Mesh(
            new THREE.TorusGeometry(width * 1.08 * scale, width * 0.1 * scale, 6, 16),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:'#f4c9ff', transparent:true, opacity:0.78 })
        );
        ringA.rotation.x = Math.PI / 2;
        const ringB = ringA.clone();
        ringB.rotation.y = Math.PI / 2;
        group.add(shard, core, ringA, ringB);
        addGlowShell(width * 2.6, width * 1.6, length * 0.88, '#d39cff', 0.26);
        group.userData.visualType = 'phase';
        group.userData.ringA = ringA;
        group.userData.ringB = ringB;
    }else if(weaponType === 'beam'){
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.22 * scale, width * 0.42 * scale, length * 1.38, 10),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color })
        );
        body.rotation.x = Math.PI / 2;
        const core = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.08 * scale, width * 0.17 * scale, length * 1.28, 8),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: coreColor })
        );
        core.rotation.x = Math.PI / 2;
        const halo = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.42 * scale, width * 0.42 * scale, length * 1.08, 10),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:'#b9d0ff', transparent:true, opacity:0.18, depthWrite:false })
        );
        halo.rotation.x = Math.PI / 2;
        group.add(halo, body, core);
        group.userData.visualType = 'beam';
        group.userData.halo = halo;
    }else if(weaponType === 'pulse'){
        const bolt = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.28 * scale, width * 0.46 * scale, length * 0.96, 10),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color })
        );
        bolt.rotation.x = Math.PI / 2;
        const core = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.1 * scale, width * 0.2 * scale, length * 0.74, 8),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: coreColor })
        );
        core.rotation.x = Math.PI / 2;
        const sideA = new THREE.Mesh(
            new THREE.TorusGeometry(width * 0.72 * scale, width * 0.08 * scale, 6, 16),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:'#b6fcff', transparent:true, opacity:0.65 })
        );
        sideA.rotation.y = Math.PI / 2;
        sideA.position.z = -length * 0.12;
        const sideB = sideA.clone();
        sideB.position.z = length * 0.14;
        group.add(bolt, core, sideA, sideB);
        addGlowShell(width * 2.5, width * 1.15, length * 0.72, '#8fffff', 0.24);
        group.userData.visualType = 'pulse';
        group.userData.sideA = sideA;
        group.userData.sideB = sideB;
    }else{
        const shell = new THREE.Mesh(
            new THREE.BoxGeometry(width * scale, width * scale, length),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color })
        );
        const core = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.45 * scale, width * 0.45 * scale, length * 0.72),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: coreColor })
        );
        const halo = new THREE.Mesh(
            new THREE.BoxGeometry(width * 1.8 * scale, width * 1.8 * scale, length * 0.9),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color, transparent:true, opacity:0.14, depthWrite:false })
        );
        group.add(halo, shell, core);
        group.userData.visualType = 'laser';
        group.userData.halo = halo;
    }

    return group;
}

function updateProjectileVisual(laser){
    const mesh = laser?.mesh;
    if(!mesh) return;
    const visualType = String(mesh.userData?.visualType || laser?.weaponType || 'laser');
    const lifeRatio = THREE.MathUtils.clamp((Number(laser?.life || 0) || 0) / Math.max(1, Number(laser?.maxLife || laser?.life || 1) || 1), 0, 1);
    const pulse = 0.8 + Math.sin(Date.now() * 0.03) * 0.18;

    if(mesh.userData.flame){
        const flame = mesh.userData.flame;
        flame.scale.setScalar(0.88 + Math.sin(Date.now() * 0.06) * 0.18);
        flame.material.opacity = 0.72 + Math.sin(Date.now() * 0.08) * 0.18;
    }
    if(mesh.userData.ring){
        mesh.userData.ring.rotation.z += 0.22;
        mesh.scale.setScalar(0.96 + (1 - lifeRatio) * 0.12 + (pulse - 0.8) * 0.2);
    }
    if(mesh.userData.ringA){
        mesh.userData.ringA.rotation.z += 0.18;
    }
    if(mesh.userData.ringB){
        mesh.userData.ringB.rotation.x += 0.16;
    }
    if(mesh.userData.sideA){
        mesh.userData.sideA.rotation.z += 0.22;
    }
    if(mesh.userData.sideB){
        mesh.userData.sideB.rotation.z -= 0.18;
    }
    if(mesh.userData.halo?.material){
        mesh.userData.halo.material.opacity = Math.max(0.08, 0.18 + (pulse - 0.8) * 0.18) * (0.55 + lifeRatio * 0.45);
    }

    if(visualType === 'beam'){
        mesh.scale.z = 1 + (pulse - 0.8) * 0.18;
    }else if(visualType === 'phase'){
        mesh.rotation.z += 0.14;
    }else if(visualType === 'plasma'){
        mesh.rotation.y += 0.12;
    }else if(visualType === 'pulse'){
        mesh.rotation.z += 0.08;
    }
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
        const projectileGroup = createProjectileVisual(weaponType, {
            color,
            coreColor,
            width: projectileWidth,
            length: projectileLength,
            scale: projectileScale
        });

        // V460: без точности пули летят хаотично, прокачка точности выравнивает полёт.
        const randomChaosX = (Math.random() - 0.5) * spread;
        const randomChaosY = (Math.random() - 0.5) * spread * 0.72;
        const localDirection = new THREE.Vector3(spreadOffset + randomChaosX, randomChaosY, -1).normalize().applyQuaternion(playerShip.quaternion);
        const localOffset = new THREE.Vector3(offsetX, 0, -2.2).applyQuaternion(playerShip.quaternion);
        projectileGroup.position.copy(playerShip.position.clone().add(localOffset));
        projectileGroup.lookAt(projectileGroup.position.clone().add(localDirection));
        scene.add(projectileGroup);

        activeLasers.push({
            mesh: projectileGroup,
            velocity: localDirection.clone().multiplyScalar(projectileVelocity),
            life: projectileLife,
            maxLife: projectileLife,
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
    const safeDelay = Math.max(0, delayMs);
    battlePendingRespawnAt = Date.now() + safeDelay;
    markBattlePresenceAnnouncementsMuted(safeDelay + 4000);
    if(battleRespawnTimer){
        clearTimeout(battleRespawnTimer);
        battleRespawnTimer = null;
    }
    if(playerShip){
        removePlayerShieldFieldV460?.();
        playerShip.visible = false;
        playerShip.position.set(99999,99999,99999);
    }
    shipVelocity.set(0,0,0);
    battlePlanetCapture = null;
    firing = false;
    updateBattlePlayerHud();

    if(isTournamentRespawnMatch() || isSoloBattleActive()){
        battleRespawnTimer = setTimeout(() => {
            battleRespawnTimer = null;
            if(!battlePendingRespawnAt) return;
            if(isSoloBattleActive() && activeSoloMissionEnded) return;
            battlePendingRespawnAt = 0;
            playerHp = playerMaxHp;
            battleShipCrash = null;
            markBattlePresenceAnnouncementsMuted(2500);
            spawnPlayer();
            updateBattlePlayerHud();
        }, safeDelay + 30);
    }
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
    if(battleRespawnTimer){
        clearTimeout(battleRespawnTimer);
        battleRespawnTimer = null;
    }
    playerHp = playerMaxHp;
    battleShipCrash = null;
    markBattlePresenceAnnouncementsMuted(2500);
    spawnPlayer();
    updateBattlePlayerHud();
}

function updateBattlePlayerWorldHp(){
    const wrap = document.getElementById('battle-player-world-hp');
    const fill = document.getElementById('battle-player-world-hp-fill');
    const text = document.getElementById('battle-player-world-hp-text');
    if(!wrap || !fill) return;
    const visible = gameState === 'BATTLE' && !battleObserverMode;
    wrap.classList.toggle('hidden', !visible);
    if(!visible) return;
    const hpPercent = THREE.MathUtils.clamp((playerHp / Math.max(1, playerMaxHp)) * 100, 0, 100);
    fill.style.width = hpPercent + '%';
    if(text) text.textContent = `${Math.round(playerHp)} / ${playerMaxHp}`;
}

function updateBattlePlayerHud(){
    const hud = document.getElementById('battle-player-hud');
    const hudTitle = hud?.querySelector?.('.battle-player-title');
    const hpFill = document.getElementById('battle-player-hp-fill');
    const hpText = document.getElementById('battle-player-hp-text');
    const hpInlineText = document.getElementById('battle-player-hp-inline-text');
    const ammoText = document.getElementById('battle-ammo-text');
    const damageText = document.getElementById('battle-damage-text');
    const energyText = document.getElementById('battle-energy-text');
    const energyFill = document.getElementById('battle-energy-fill');
    const reloadText = document.getElementById('battle-reload-text');
    if(!hud || !hpFill || !hpText || !ammoText || !damageText || !reloadText || !energyText || !energyFill) return;
    const visible = gameState === 'BATTLE' && !battleObserverMode;
    hud.style.display = visible ? 'block' : 'none';
    if(!visible) return;
    if(hudTitle){
        const currentShipName = String(currentBattleShipStats?.ship?.name || getSelectedShipItem?.()?.name || player?.ships?.[0]?.name || 'Cargo Drone').trim() || 'Cargo Drone';
        hudTitle.textContent = currentShipName;
    }
    const hpPercent = THREE.MathUtils.clamp((playerHp / Math.max(1, playerMaxHp)) * 100, 0, 100);
    hpFill.style.width = hpPercent + '%';
    const shieldTextV460 = Number(playerMaxShield || 0) > 0 ? ` | Щит: ${Math.round(playerShield)} / ${playerMaxShield}` : '';
    hpText.textContent = `HP: ${Math.round(playerHp)} / ${playerMaxHp}${shieldTextV460}`;
    if(hpInlineText) hpInlineText.textContent = `${Math.round(playerHp)} / ${playerMaxHp}${Number(playerMaxShield || 0) > 0 ? ` • 🛡 ${Math.round(playerShield)}/${playerMaxShield}` : ''}`;
    ammoText.textContent = `Боеприпасы: ${battleWeapon.ammoInClip} / ${battleWeapon.clipSize} | запас ${formatAmmoReserve()}`;
    damageText.textContent = `Урон: ${battleWeapon.damage}`;
    const energyCap = Math.max(20, Number(currentBattleShipStats?.energyCapacity || battleEnergyCapacity || 60) || 60);
    battleEnergyCapacity = energyCap;
    if(!Number.isFinite(battleEnergyPool) || battleEnergyPool < 0){
        battleEnergyPool = Math.min(Math.max(0, Number(playerResources?.solar_energy || 0) || 0), energyCap);
    }
    const currentEnergy = THREE.MathUtils.clamp(battleEnergyPool, 0, energyCap);
    energyFill.style.display = 'none';
    energyFill.style.width = '0%';
    energyText.textContent = `Энергия: ⚡ ${currentEnergy.toFixed(1)} / ${energyCap}`;
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
    try{ recordProfileBattleStatsV438(0, 1); }catch(_){}
    try{ pushBattleKillFeedLine(`${enemyBot?.userData?.name || 'UFO Raider'} уничтожил ${player?.nickname || 'Commander'}`); }catch(_){}
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
    try{ recordProfileBattleStatsV438(0, 1); }catch(_){}
    try{ pushBattleKillFeedLine(`${enemyBot?.userData?.name || 'UFO Raider'} уничтожил ${player?.nickname || 'Commander'}`); }catch(_){}
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
    try{
        const hangarCanvas = document.querySelector('#hangar-window canvas');
        if(document.pointerLockElement){
            if(hangarCanvas && document.pointerLockElement === hangarCanvas){
                hangarCanvas.style.cursor = 'none';
                document.body.style.cursor = 'none';
            }
        } else {
            if(hangarCanvas) hangarCanvas.style.cursor = 'auto';
            document.body.style.cursor = 'auto';
        }
    }catch(_){ }
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
    if(crystalsEl || coinsEl){
        updatePremiumAccountInfo();
        ensurePremiumCurrencyUi?.();
    }
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




// ===== V398 LOGOUT BUTTON FALLBACK =====
document.addEventListener('click', (event) => {
    try{
        const logoutBtn = event.target?.closest?.('#premium-logout-btn');
        if(!logoutBtn) return;
        event.preventDefault();
        event.stopPropagation();
        logoutToAuth('Выход выполнен. Теперь можно сменить аккаунт или сервер.');
    }catch(err){
        console.warn('logout fallback warning:', err?.message || err);
    }
}, true);

window.cosmicLoginNow = loginLocalAccount;
window.cosmicRegisterNow = registerLocalAccount;
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

let __hangarChatHomeParent = null;
let __hangarChatHomeNextSibling = null;
let __hangarEmojiHomeParent = null;
let __hangarEmojiHomeNextSibling = null;
let __hangarPmPulseUntil = 0;

function __mountHangarChatPanel(){
    try{
        const chatWrapper = document.getElementById('chat-wrapper');
        const emojiPanel = document.getElementById('emoji-panel');
        const hangarWindow = document.getElementById('hangar-window');
        if(!chatWrapper || !hangarWindow) return;

        if(!__hangarChatHomeParent){
            __hangarChatHomeParent = chatWrapper.parentNode;
            __hangarChatHomeNextSibling = chatWrapper.nextSibling;
        }

        if(emojiPanel && !__hangarEmojiHomeParent){
            __hangarEmojiHomeParent = emojiPanel.parentNode;
            __hangarEmojiHomeNextSibling = emojiPanel.nextSibling;
        }

        if(chatWrapper.parentNode !== hangarWindow){
            hangarWindow.appendChild(chatWrapper);
        }

        if(emojiPanel && emojiPanel.parentNode !== hangarWindow){
            hangarWindow.appendChild(emojiPanel);
        }

        chatWrapper.classList.add('hangar-inline-mode');
        if(emojiPanel) emojiPanel.classList.add('hangar-emoji-inline-mode');
    }catch(_){}
}

function __restoreHangarChatPanel(){
    try{
        const chatWrapper = document.getElementById('chat-wrapper');
        const emojiPanel = document.getElementById('emoji-panel');

        document.body.classList.remove('hangar-chat-mode');
        document.body.classList.remove('hangar-chat-lowered');

        if(chatWrapper){
            chatWrapper.classList.remove('hangar-inline-mode');
            chatWrapper.classList.remove('hangar-chat-lowered');
            chatWrapper.classList.remove('hangar-pm-neon');
            

            if(__hangarChatHomeParent && chatWrapper.parentNode !== __hangarChatHomeParent){
                if(__hangarChatHomeNextSibling && __hangarChatHomeNextSibling.parentNode === __hangarChatHomeParent){
                    __hangarChatHomeParent.insertBefore(chatWrapper, __hangarChatHomeNextSibling);
                }else{
                    __hangarChatHomeParent.appendChild(chatWrapper);
                }
            }
        }

        if(emojiPanel){
            emojiPanel.classList.remove('hangar-emoji-inline-mode');
            emojiPanel.classList.remove('hangar-chat-lowered');

            if(__hangarEmojiHomeParent && emojiPanel.parentNode !== __hangarEmojiHomeParent){
                if(__hangarEmojiHomeNextSibling && __hangarEmojiHomeNextSibling.parentNode === __hangarEmojiHomeParent){
                    __hangarEmojiHomeParent.insertBefore(emojiPanel, __hangarEmojiHomeNextSibling);
                }else{
                    __hangarEmojiHomeParent.appendChild(emojiPanel);
                }
            }
        }
    }catch(_){}
}


function setHangarChatMode(active, lowered = false){
    try{
        const chatWrapper = document.getElementById('chat-wrapper');
        const emojiPanel = document.getElementById('emoji-panel');
        document.body.classList.toggle('hangar-chat-mode', !!active);
        document.body.classList.toggle('hangar-chat-lowered', !!(active && lowered));
        if(chatWrapper) chatWrapper.classList.toggle('hangar-chat-lowered', !!(active && lowered));
        if(emojiPanel) emojiPanel.classList.toggle('hangar-chat-lowered', !!(active && lowered));
        __updateHangarPmNeon?.();
        
    }catch(_){}
}


function __appendEmojiToChatInput(symbol){
    try{
        const input = document.getElementById('chat-input');
        if(!input) return;
        const current = String(input.value || '');
        input.value = `${current}${current ? ' ' : ''}${symbol}`.trimStart() + ' ';
        input.focus();
    }catch(_){}
}

function __initHangarEmojiPanel(){
    try{
        const panel = document.getElementById('hangar-emoji-panel');
        if(!panel || panel.dataset.readyHangarEmoji === '1') return;
        panel.dataset.readyHangarEmoji = '1';
        const emojis = ['😀','🚀','🔥','😎','💀','🪐','✴️','⚔️'];
        panel.innerHTML = '';
        emojis.forEach(symbol => {
            const btn = document.createElement('div');
            btn.className = 'hangar-emoji-btn';
            btn.textContent = symbol;
            btn.title = symbol;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                __appendEmojiToChatInput(symbol);
            });
            panel.appendChild(btn);
        });
    }catch(_){}
}


function __getTotalPmUnreadCount(){
    try{
        return Object.values(chatUnread?.pm || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    }catch(_){
        return 0;
    }
}

function __updateHangarPmNeon(){
    try{
        const chatWrapper = document.getElementById('chat-wrapper');
        if(!chatWrapper) return;

        const isLowered = chatWrapper.classList.contains('hangar-chat-lowered') || document.body.classList.contains('hangar-chat-lowered');
        const hasUnreadPm = __getTotalPmUnreadCount() > 0;
        const hasPulse = Date.now() < Number(__hangarPmPulseUntil || 0);
        const shouldGlow = !!(isLowered && (hasUnreadPm || hasPulse) && chatWrapper.classList.contains('hangar-inline-mode'));

        if(shouldGlow){
            chatWrapper.classList.add('hangar-pm-neon');
        }else{
            chatWrapper.classList.remove('hangar-pm-neon');
        }
    }catch(_){}
}

function bindHangarChatControls(){
    const upBtn = document.getElementById('hangar-chat-up');
    const downBtn = document.getElementById('hangar-chat-down');

    if(upBtn && !upBtn.dataset.boundHangarChat){
        upBtn.dataset.boundHangarChat = '1';
        upBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setHangarChatMode(true, false)
        });
    }

    if(downBtn && !downBtn.dataset.boundHangarChat){
        downBtn.dataset.boundHangarChat = '1';
        downBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setHangarChatMode(true, true)
        });
    }
}

function __syncHangarChatVisibility(){
    try{
        const hangarWindow = document.getElementById('hangar-window');
        if(!hangarWindow){
            __restoreHangarChatPanel();
            return;
        }

        const isVisible = !hangarWindow.classList.contains('hidden') && hangarWindow.style.display !== 'none';
        if(isVisible){
            bindHangarChatControls();
            __initHangarEmojiPanel();
            __mountHangarChatPanel();
            const lowered = document.body.classList.contains('hangar-chat-lowered');
            setHangarChatMode(true, lowered);
        }else{
            __restoreHangarChatPanel();
        }
    }catch(_){}
}

function __installHangarChatWatcher(){
    if(window.__hangarChatWatcherInstalled) return;
    window.__hangarChatWatcherInstalled = true;

    const attach = () => {
        const hangarWindow = document.getElementById('hangar-window');
        if(!hangarWindow) return false;

        bindHangarChatControls();
        __syncHangarChatVisibility();

        const observer = new MutationObserver(() => {
            __syncHangarChatVisibility();
        });
        observer.observe(hangarWindow, { attributes:true, attributeFilter:['class','style'] });

        const hangarTab = document.getElementById('hangar-tab');
        if(hangarTab && !hangarTab.dataset.boundHangarWatcher){
            hangarTab.dataset.boundHangarWatcher = '1';
            hangarTab.addEventListener('click', () => {
                setTimeout(__syncHangarChatVisibility, 0);
                setTimeout(__syncHangarChatVisibility, 120);
                setTimeout(__syncHangarChatVisibility, 320);
            });
        }

        document.querySelectorAll('#hangar-window .hangar-close-btn, #hangar-window .close-window').forEach(btn => {
            if(btn.dataset.boundHangarWatcherClose) return;
            btn.dataset.boundHangarWatcherClose = '1';
            btn.addEventListener('click', () => {
                setHangarChatMode(false, false);
                setTimeout(__syncHangarChatVisibility, 0);
            });
        });

        return true;
    };

    if(!attach()){
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if(attach() || tries > 40){
                clearInterval(timer);
            }
        }, 250);
    }
}


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
const pmPeerRoomIds = new Map();
const CHAT_UI_STATE_KEY = 'cosmicChatUiState:v27';
const COSMIC_CLOSED_PM_TABS_KEY_V338 = 'cosmicClosedPmTabs:v338';

function getClosedPmTabsV338(){
    try{
        const raw = localStorage.getItem(COSMIC_CLOSED_PM_TABS_KEY_V338);
        const list = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(list) ? list.map(id => String(id || '').trim()).filter(Boolean) : []);
    }catch(_){
        return new Set();
    }
}

function saveClosedPmTabsV338(set){
    try{ localStorage.setItem(COSMIC_CLOSED_PM_TABS_KEY_V338, JSON.stringify(Array.from(set || []))); }catch(_){ }
}

function markPmTabClosedV338(peerId){
    const key = String(peerId || '').trim();
    if(!key) return;
    const closed = getClosedPmTabsV338();
    closed.add(key);
    saveClosedPmTabsV338(closed);
}

function unmarkPmTabClosedV338(peerId){
    const key = String(peerId || '').trim();
    if(!key) return;
    const closed = getClosedPmTabsV338();
    if(closed.delete(key)) saveClosedPmTabsV338(closed);
}

function isPmTabClosedV338(peerId){
    const key = String(peerId || '').trim();
    return !!(key && getClosedPmTabsV338().has(key));
}
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

var playerStaffRoleCache = {};
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

function updateAuthServerVisibility(){
    try{
        const serverCurrent = document.getElementById('auth-server-current');
        const serverList = document.getElementById('auth-server-list');
        if(!serverList) return;
        const realOption = serverList.querySelector('[data-real-server="true"]') || serverList.querySelector('[data-server="EU"]') || serverList.querySelector('.auth-server-option');
        if(!realOption) return;
        realOption.dataset.server = 'EU';
        realOption.dataset.realServer = 'true';
        realOption.classList.add('active');
        realOption.classList.remove('hidden');
        realOption.disabled = false;
        realOption.style.removeProperty('display');
        serverList.querySelectorAll('.auth-server-option').forEach(btn => { if(btn !== realOption) btn.classList.remove('active'); });
        if(serverCurrent){
            const dot = realOption.querySelector('.server-dot')?.cloneNode(true);
            const text = realOption.textContent.trim() || '1. Europe / Frankfurt (real)';
            serverCurrent.innerHTML = '';
            if(dot) serverCurrent.appendChild(dot);
            const span = document.createElement('span');
            span.textContent = text;
            serverCurrent.appendChild(span);
            const arrow = document.createElement('span');
            arrow.className = 'server-arrow';
            arrow.textContent = '⌄';
            serverCurrent.appendChild(arrow);
        }
        try{ localStorage.setItem('cosmicSelectedServer', 'EU'); }catch(_){}
    }catch(_){}
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

function resolvePmRoomTitleById(roomId = '') {
    const safeRoomId = String(roomId || '').trim();
    if (!safeRoomId) return '';

    const currentId = String(currentRoom?.id || currentRoom?.roomId || '').trim();
    if (currentId && currentId === safeRoomId) {
        return String(currentRoom?.title || currentRoom?.room_name || currentRoom?.real || currentRoom?.map || '').trim();
    }

    const selectedId = String(selectedLobbyMap?.id || selectedLobbyMap?.roomId || '').trim();
    if (selectedId && selectedId === safeRoomId) {
        return String(selectedLobbyMap?.title || selectedLobbyMap?.room_name || selectedLobbyMap?.real || selectedLobbyMap?.map || '').trim();
    }

    const cacheRoom = (Array.isArray(supabaseBattleRoomsCache) ? supabaseBattleRoomsCache : []).find(room => {
        const directId = String(room?.id || room?.roomId || '').trim();
        const rawId = String(room?.rawRoom?.id || '').trim();
        return directId === safeRoomId || rawId === safeRoomId;
    });

    if (cacheRoom) {
        return String(
            cacheRoom?.title ||
            cacheRoom?.room_name ||
            cacheRoom?.real ||
            cacheRoom?.map ||
            cacheRoom?.name ||
            cacheRoom?.rawRoom?.room_name ||
            cacheRoom?.rawRoom?.title ||
            cacheRoom?.rawRoom?.map_name ||
            cacheRoom?.rawRoom?.map ||
            ''
        ).trim();
    }

    return '';
}

function getPmPresenceTitle(peerId) {
    const key = String(peerId || '').trim();
    const presenceState = getPmPresenceState(key);

    if (presenceState === 'online') return 'Онлайн';
    if (presenceState !== 'in-game') return 'Оффлайн';

    const roomId = String(pmPeerRoomIds.get(key) || '').trim();
    const roomTitle = resolvePmRoomTitleById(roomId);
    return roomTitle || 'В игре';
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
            if (isPmTabClosedV338(safePeerId)) return;
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
    __updateHangarPmNeon?.();
}

function incrementUnread(scopeName, amount = 1) {
    setUnreadCount(scopeName, getUnreadCount(scopeName) + Math.max(1, Number(amount) || 1));
    __updateHangarPmNeon?.();
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
    __updateHangarPmNeon?.();
}

function ensurePmTab(peerId, label = null) {
    const key = String(peerId || "").trim();
    if (!key) return;
    unmarkPmTabClosedV338(key);
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
        const presenceTitle = getPmPresenceTitle(peerId);
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
            pmPeerRoomIds.delete(String(peerId));
            markPmTabClosedV338(peerId);
            saveChatUiState();
            try{ __v295_savePmCache?.(); }catch(_){ }

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
        const battleRoomFilters = [
            `room_id.eq.${GLOBAL_BATTLE_ARCHIVE_ROOM_ID}`,
            'room_id.eq.__all__'
        ];
        if (battleRoomId) {
            battleRoomFilters.push(`room_id.eq.${battleRoomId}`);
        }
        query = query.or(battleRoomFilters.join(','));
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
            // v342: PM history is preserved after reading; closed tabs are the only way to hide a conversation.
            // deletePmHistoryWithPeer(peerId);
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

    const battleRoomFilters = [
        `room_id.eq.${GLOBAL_BATTLE_ARCHIVE_ROOM_ID}`,
        'room_id.eq.__all__'
    ];
    if (roomId) {
        battleRoomFilters.push(`room_id.eq.${roomId}`);
    }

    const { data, error } = await window.supabaseClient
        .from("chat_messages")
        .select("*")
        .eq("channel", "battle")
        .or(battleRoomFilters.join(','))
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

    chatCache.battle.length = 0;
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
        const isGlobalBattleArchiveMessage = incomingRoomId === GLOBAL_BATTLE_ARCHIVE_ROOM_ID;
        const isGlobalBattleAnnouncement = incomingRoomId === '__all__';
        const isActiveRoomBattleMessage = !!activeBattleRoomId && incomingRoomId === activeBattleRoomId;
        if (!isGlobalBattleArchiveMessage && !isGlobalBattleAnnouncement && !isActiveRoomBattleMessage) {
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

        const isHangarLowered = document.body.classList.contains('hangar-chat-lowered') || document.getElementById('chat-wrapper')?.classList.contains('hangar-chat-lowered');
        if (currentChat !== scope.key) {
            incrementUnread(scope.key);
        } else if (isHangarLowered) {
            __hangarPmPulseUntil = Date.now() + 12000;
        }

        if (currentChat === scope.key) renderLobbyMessages();
        renderChatTabs();
        __updateHangarPmNeon?.();
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
    try{ restoreOwnHangarAfterGuest?.(); }catch(_){}
    try{ enterOwnHangarPresence?.(); }catch(_){}
    updateHangarUI();
    hangarWindow.classList.remove("hidden");
    hangarWindow.style.cssText = "position:fixed;inset:0;top:0;left:0;width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;z-index:21000;background:rgba(0,0,0,0.82);";
    requestAnimationFrame(() => { try{ ensureHangarRenderer?.(); }catch(_){} try{ renderHangarPresencePanel?.(); }catch(_){} });
  });
}

if(closeHangar && hangarWindow){
  closeHangar.addEventListener("click", () => {
    hangarWindow.classList.add("hidden");
    hangarWindow.style.display='none';
    try{ leaveHangarPresence?.(); }catch(_){}
    try{ restoreOwnHangarAfterGuest?.(); }catch(_){}
  });
}

const profileBtn = document.getElementById("profile-tab");
const profileWindow = document.getElementById("profile-window");
const closeProfile = document.getElementById("close-profile");
const profileInfo = document.getElementById("profile-info");

function updateProfileUI() {
  try{
    if(typeof renderProfileStats === 'function'){
      renderProfileStats();
      return;
    }
  }catch(_){}
  if(!profileInfo) return;
  profileInfo.innerHTML = `<div class="auth-note">Профиль загружается...</div>`;
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

    if(raw.includes('solar') || raw.includes('system') || raw.includes('систем')) return 'solar';
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
        solar:{ color:0xffc84a, size:40, light:0xffdd88 },
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


function resetBattleSessionCounters(){
    try{ stopLiveBattleSync(); }catch(_){ }
    try{ stopBattleHudLoops?.(); }catch(_){ }
    try{ battlePendingRespawnAt = 0; }catch(_){ }
    try{ if(battleRespawnTimer){ clearTimeout(battleRespawnTimer); battleRespawnTimer = null; } }catch(_){ }
    try{ battleShipCrash = null; }catch(_){ }
    try{ battlePlanetCapture = null; }catch(_){ }
    try{ battleChatOpen = false; }catch(_){ }
    try{ battleMessages.length = 0; }catch(_){ }
    try{ killFeedMessages.length = 0; }catch(_){ }
    try{ activeLasers.forEach(laser => { try{ scene?.remove?.(laser?.mesh); }catch(__){} }); activeLasers = []; }catch(_){ }
    try{ enemyLasers.forEach(laser => { try{ scene?.remove?.(laser?.mesh); }catch(__){} }); enemyLasers = []; }catch(_){ }
    try{ selfRoomPlayerRowId = ''; }catch(_){ }
    try{ lastSelfRoomPlayerStatePayload = ''; }catch(_){ }
    try{ lastSelfRoomPlayerStateSentAt = 0; }catch(_){ }
    try{ roomPlayerStateUpsertInFlight = false; }catch(_){ }
    try{ roomPlayersFetchInFlight = false; }catch(_){ }
    try{ cachedRoomPlayersRows = []; }catch(_){ }
    try{ cachedRoomPlayersFetchedAt = 0; }catch(_){ }
    try{ lastRoomPlayerPingValue = 0; }catch(_){ }
    try{ lastRoomPlayerPingAt = 0; }catch(_){ }
    try{ lastBattlePresencePayload = ''; }catch(_){ }
    try{ lastBattlePresenceSentAt = 0; }catch(_){ }
    try{ lastPresencePingValue = 0; }catch(_){ }
    try{ lastPresencePingAt = 0; }catch(_){ }
    try{ battleScoreState = new Map(); }catch(_){ }
}


function removeBattleSolarSystemView(){
    try{
        if(!battleSolarSystemGroup) return;
        const oldGroup = battleSolarSystemGroup;
        scene?.remove?.(oldGroup);
        oldGroup.traverse?.((obj) => {
            try{
                if(obj.geometry) obj.geometry.dispose?.();
                if(obj.material){
                    if(Array.isArray(obj.material)){
                        obj.material.forEach(mat => {
                            try{ mat.map?.dispose?.(); mat.dispose?.(); }catch(_){}
                        });
                    }else{
                        obj.material.map?.dispose?.();
                        obj.material.dispose?.();
                    }
                }
            }catch(_){}
        });
    }catch(_){}
    battleSolarSystemGroup = null;
}

function createBattleSolarSystemView(){
    removeBattleSolarSystemView();
    battleSolarSystemGroup = new THREE.Group();
    battleSolarSystemGroup.name = 'Solo Endless Battle Solar System';

    const makeOrbitLine = (radius, color = 0x7feaff, opacity = 0.26) => {
        const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
        const points = curve.getPoints(220).map(p => new THREE.Vector3(p.x, 0, p.y));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color, transparent:true, opacity });
        const line = new THREE.LineLoop(geometry, material);
        line.name = 'Endless orbit trace';
        return line;
    };

    const makePlanetMaterial = (key, color, emissive = 0x000000, emissiveIntensity = 0) => {
        try{
            if(key === 'sun' && typeof sunTexture !== 'undefined'){
                return new THREE.MeshBasicMaterial({ map:sunTexture, color:0xffffff });
            }
            if(key === 'earth' && typeof earthDiffuse !== 'undefined'){
                return new THREE.MeshStandardMaterial({ map:earthDiffuse, roughness:0.72, metalness:0.04 });
            }
        }catch(_){}
        return new THREE.MeshStandardMaterial({ color, roughness:0.82, metalness:0.035, emissive, emissiveIntensity });
    };

    const planetDefs = [
        { key:'sun', name:'Sun', radius:42, dist:0, color:0xffcc44, emissive:0xff7a22, speed:0.0000 },
        { key:'mercury', name:'Mercury', radius:5.2, dist:92, color:0xb7b7b7, speed:0.0022 },
        { key:'venus', name:'Venus', radius:7.4, dist:128, color:0xe4b382, speed:0.00165 },
        { key:'earth', name:'Earth', radius:8.2, dist:168, color:0x3b7cff, speed:0.0012, clouds:true },
        { key:'mars', name:'Mars', radius:6.4, dist:210, color:0xc1583a, speed:0.00095 },
        { key:'jupiter', name:'Jupiter', radius:18.5, dist:290, color:0xcda27f, speed:0.00062 },
        { key:'saturn', name:'Saturn', radius:16.2, dist:370, color:0xd9c08a, speed:0.00048, ring:true },
        { key:'uranus', name:'Uranus', radius:12.2, dist:445, color:0x86d8dd, speed:0.00038 },
        { key:'neptune', name:'Neptune', radius:12.2, dist:520, color:0x4469ff, speed:0.00032 }
    ];

    planetDefs.forEach((def, index) => {
        const pivot = new THREE.Group();
        pivot.name = `Endless orbit pivot ${def.name}`;
        pivot.userData.orbitSpeed = def.speed || 0;
        pivot.rotation.y = index * 0.78;
        const mat = makePlanetMaterial(def.key, def.color, def.emissive || 0x000000, def.emissive ? 0.55 : 0);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 48, 36), mat);
        mesh.name = `Endless ${def.name}`;
        mesh.position.set(def.dist, 0, 0);
        mesh.userData.selfRotateSpeed = 0.004 + index * 0.00065;
        pivot.add(mesh);

        if(def.key === 'sun'){
            const glow = new THREE.Mesh(
                new THREE.SphereGeometry(def.radius * 1.35, 48, 32),
                new THREE.MeshBasicMaterial({ color:0xff8a20, transparent:true, opacity:0.16, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide })
            );
            mesh.add(glow);
            const sunLight = new THREE.PointLight(0xffdd88, 2.4, 2600);
            sunLight.position.set(0, 0, 0);
            mesh.add(sunLight);
        }

        if(def.clouds && typeof earthClouds !== 'undefined'){
            const clouds = new THREE.Mesh(
                new THREE.SphereGeometry(def.radius * 1.025, 36, 24),
                new THREE.MeshStandardMaterial({ map:earthClouds, transparent:true, opacity:0.38, depthWrite:false })
            );
            clouds.userData.selfRotateSpeed = 0.006;
            mesh.add(clouds);
        }

        if(def.ring){
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(def.radius * 1.45, def.radius * 2.45, 96),
                new THREE.MeshBasicMaterial({ color:def.color, side:THREE.DoubleSide, transparent:true, opacity:0.62 })
            );
            ring.rotation.x = Math.PI / 2.45;
            mesh.add(ring);
        }
        if(def.dist > 0){
            battleSolarSystemGroup.add(makeOrbitLine(def.dist, 0x7feaff, 0.20));
        }
        battleSolarSystemGroup.add(pivot);
    });

    battleSolarSystemGroup.position.set(0, -90, -720);
    battleSolarSystemGroup.rotation.x = 0.18;
    battleSolarSystemGroup.scale.setScalar(1.22);
    scene.add(battleSolarSystemGroup);
}

function updateBattleSolarSystemView(){
    if(!battleSolarSystemGroup) return;
    battleSolarSystemGroup.children.forEach((child) => {
        if(child?.isGroup){
            child.rotation.y += Number(child.userData?.orbitSpeed || 0) || 0;
            child.children.forEach(mesh => {
                if(mesh?.isMesh) mesh.rotation.y += Number(mesh.userData?.selfRotateSpeed || 0.003) || 0.003;
            });
        }
    });
}

function getEndlessCombatRadius(){
    return 1180;
}

function clampVectorToEndlessCombatZone(position, margin = 0){
    if(!position || typeof position.clone !== 'function') return position;
    const safeLimit = Math.max(120, getEndlessCombatRadius() - Math.max(0, Number(margin || 0) || 0));
    const center = new THREE.Vector3(0, 0, 0);
    const offset = position.clone().sub(center);
    const dist = offset.length();
    if(dist <= safeLimit) return position;
    const normal = dist > 0.001 ? offset.normalize() : new THREE.Vector3(0, 0, 1);
    return center.add(normal.multiplyScalar(safeLimit));
}

function clampEndlessBotToCombatZone(bot){
    if(!bot || !isEndlessSoloBattle()) return;
    const clamped = clampVectorToEndlessCombatZone(bot.position, 90);
    if(clamped && clamped !== bot.position){
        bot.position.lerp(clamped, 0.42);
        bot.userData.edgeReturnUntil = Date.now() + 1600;
    }
}

function getSoloBotSpawnPosition(){
    if(isEndlessSoloBattle()){
        const minDist = 340;
        const maxDist = 620;
        const angle = Math.random() * Math.PI * 2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const y = -70 + Math.random() * 140;
        const base = playerShip?.position?.clone?.() || new THREE.Vector3(0, 20, 0);
        const pos = base.add(new THREE.Vector3(Math.cos(angle) * dist, y, Math.sin(angle) * dist));
        return clampVectorToEndlessCombatZone(pos, 180);
    }
    const spawnBase = spawnPointB?.clone?.() || new THREE.Vector3(130, 10, -120);
    return spawnBase.add(new THREE.Vector3((Math.random()-0.5)*34, 8 + Math.random()*12, (Math.random()-0.5)*34));
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
    resetBattleSessionCounters();

    if(solarSystem && scene.children.includes(solarSystem)){
        scene.remove(solarSystem);
    }

    const config = getBattlePlanetConfig(mapKey);
    const endlessSoloMap = isEndlessSoloBattle();

    const ambient = new THREE.AmbientLight(0xffffff, endlessSoloMap ? 1.55 : 1.25);
    const point = new THREE.PointLight(config.light, 2.6, 250);
    point.position.set(12, 9, 10);
    battleObjects.push(ambient, point);
    scene.add(ambient);
    scene.add(point);

    if(endlessSoloMap){
        createBattleSolarSystemView();
        battleMapPlanet = null;
    }else{
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
    }

    if(!endlessSoloMap && mapKey === 'saturn'){
        const ringGeo = new THREE.RingGeometry(config.size * 1.35, config.size * 2.0, 96);
        const ringMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0xd9c08a, side: THREE.DoubleSide, transparent:true, opacity:0.65 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.45;
        battleMapPlanet.add(ring);
    }

    spawnPointA = endlessSoloMap ? new THREE.Vector3(0, 0, 140) : new THREE.Vector3(-150, -10, 120);
    spawnPointB = endlessSoloMap ? new THREE.Vector3(220, 20, -220) : new THREE.Vector3(150, 12, -140);

    camera.position.set(0, 18, 70);
    camera.lookAt(0, 0, 0);

    if(!endlessSoloMap) createBattleObstacles(mapKey);
    updateBattleScoreboard();
}

var remoteBattleShips = new Map();
let battleLeavingInProgress = false;
var lastBattlePresenceSnapshot = new Map();
var battlePresenceBaselineReady = false;
var liveBattleSyncTimer = null;
var liveBattlePresencePushTimer = null;
var liveBattlePresenceChannel = null;
var liveBattlePresenceChannelName = '';
    liveBattlePresenceSubscribePromise = null;
var battleHitPollTimer = null;
var battleHitCursorId = 0;
var battleHitSessionStartedAt = 0;
var roomPlayerStateUpsertInFlight = false;
var roomPlayersFetchInFlight = false;
var battleHitPollInFlight = false;
var selfRoomPlayerRowId = '';
var lastSelfRoomPlayerStatePayload = '';
var lastSelfRoomPlayerStateSentAt = 0;
var lastBattlePresencePayload = '';
var lastBattlePresenceSentAt = 0;
var cachedRoomPlayersRows = [];
var cachedRoomPlayersFetchedAt = 0;
var lastRoomPlayerPingValue = 0;
var lastRoomPlayerPingAt = 0;
var lastPresencePingValue = 0;
var lastPresencePingAt = 0;
var lobbyRoomPresenceInFlight = false;
var lastLobbyRoomPresenceAt = 0;
var battleClientResetSerial = 0;
const ROOM_PLAYER_FETCH_CACHE_MS = 300;
const ROOM_PLAYER_PING_UPDATE_MS = 9000;
const BATTLE_PRESENCE_PING_UPDATE_MS = 9000;
const LIVE_BATTLE_SYNC_INTERVAL_MS = 900;
const LIVE_BATTLE_PRESENCE_PUSH_INTERVAL_MS = 900;
const LIVE_BATTLE_HIT_POLL_INTERVAL_MS = 650;
const ROOM_PLAYER_STATE_FORCE_INTERVAL_MS = 2800;
const ROOM_PLAYER_POSITION_EPSILON = 0.65;
const ROOM_PLAYER_ROTATION_EPSILON = 0.06;
const BATTLE_PRESENCE_FORCE_INTERVAL_MS = 900;
const BATTLE_PRESENCE_POSITION_EPSILON = 0.28;
const BATTLE_PRESENCE_ROTATION_EPSILON = 0.035;
var battleScoreState = new Map();

function getBattleScoreSnapshot(playerId){
    const key = String(playerId || '').trim();
    if(!key) return { kills:0, deaths:0 };
    const current = battleScoreState.get(key) || { kills:0, deaths:0 };
    return {
        kills: Math.max(0, Number(current.kills || 0) || 0),
        deaths: Math.max(0, Number(current.deaths || 0) || 0)
    };
}

function clearRemoteBattleShips(){
    if(!(remoteBattleShips instanceof Map)){
        remoteBattleShips = new Map();
    }
    remoteBattleShips.forEach(entry => {
        try{ disposeRemoteShieldMeshesV463(entry); }catch(_){}
        try{
            if(entry?.labelSprite && entry?.mesh?.remove) entry.mesh.remove(entry.labelSprite);
        }catch(_){ }
        try{
            if(entry?.mesh){
                entry.mesh.visible = false;
                if(entry.mesh.parent) entry.mesh.parent.remove(entry.mesh);
                else scene?.remove?.(entry.mesh);
            }
        }catch(_){ }
    });
    remoteBattleShips.clear();

    if(scene?.traverse){
        const nodesToRemove = [];
        scene.traverse((node) => {
            if(node?.userData?.remote){
                nodesToRemove.push(node);
            }
        });
        nodesToRemove.forEach((node) => {
            try{
                node.visible = false;
                if(node.parent) node.parent.remove(node);
                else scene.remove(node);
            }catch(_){ }
        });
    }

    lastBattlePresenceSnapshot = new Map();
    battlePresenceBaselineReady = false;
    battlePresenceAnnounceMutedUntil = 0;
    try{ battleJoinMuteByPlayer.clear(); }catch(_){}
    try{ battlePresenceRecentEvents.clear(); }catch(_){}
    try{ battlePresenceMissingCounts.clear(); }catch(_){ }
    try{ battleJoinMuteByPlayer = new Map(); }catch(_){ battleJoinMuteByPlayer = new Map(); }
}

function hardResetBattleClientState(){
    battleClientResetSerial += 1;
    try{ cachedRoomPlayersRows = []; }catch(_){ }
    try{ cachedRoomPlayersFetchedAt = 0; }catch(_){ }
    try{ lastBattlePresenceSnapshot = new Map(); }catch(_){ }
    try{ battlePresenceBaselineReady = false; }catch(_){ }
    try{ battleScoreState = new Map(); }catch(_){ }
    try{ clearRemoteBattleShips(); }catch(_){ }

    if(currentRoom){
        try{ currentRoom.currentPlayers = Array.isArray(currentRoom.currentPlayers) ? currentRoom.currentPlayers.filter(row => !row?.id || String(row.id).trim() === String(getSelfBattlePlayerId() || '').trim()) : []; }catch(_){ }
        try{ currentRoom.players = Array.isArray(currentRoom.players) ? currentRoom.players.filter(row => !row?.id || String(row.id).trim() === String(getSelfBattlePlayerId() || '').trim()) : []; }catch(_){ }
    }
}

function stopLiveBattleSync(){
    battleClientResetSerial += 1;
    lastBattlePresenceSnapshot = new Map();
    battlePresenceBaselineReady = false;
    battlePresenceAnnounceMutedUntil = 0;
    if(typeof liveBattleSyncTimer !== 'undefined' && liveBattleSyncTimer){
        clearInterval(liveBattleSyncTimer);
        liveBattleSyncTimer = null;
    }
    if(typeof liveBattlePresencePushTimer !== 'undefined' && liveBattlePresencePushTimer){
        clearInterval(liveBattlePresencePushTimer);
        liveBattlePresencePushTimer = null;
    }
    if(typeof battleHitPollTimer !== 'undefined' && battleHitPollTimer){
        clearInterval(battleHitPollTimer);
        battleHitPollTimer = null;
    }
    battleHitCursorId = 0;
    battleHitSessionStartedAt = 0;
    roomPlayerStateUpsertInFlight = false;
    roomPlayersFetchInFlight = false;
    battleHitPollInFlight = false;
    selfRoomPlayerRowId = '';
    lastSelfRoomPlayerStatePayload = '';
    lastSelfRoomPlayerStateSentAt = 0;
    lastBattlePresencePayload = '';
    lastBattlePresenceSentAt = 0;
    cachedRoomPlayersRows = [];
    cachedRoomPlayersFetchedAt = 0;
    lastRoomPlayerPingValue = 0;
    lastRoomPlayerPingAt = 0;
    lastPresencePingValue = 0;
    lastPresencePingAt = 0;
    battleScoreState = new Map();
    if(liveBattlePresenceChannel && window.supabaseClient){
        try{ window.supabaseClient.removeChannel(liveBattlePresenceChannel); }catch(_){}
    }
    liveBattlePresenceChannel = null;
    liveBattlePresenceChannelName = '';
    liveBattlePresenceSubscribePromise = null;
    clearRemoteBattleShips();
}

function createRemotePilotLabel(name, team = 'blue', levelValue = 1){
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    const safeLevel = Math.max(1, Math.min(120, Math.floor(Number(levelValue || 1) || 1)));
    const safeName = String(name || 'Pilot').slice(0, 16);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // V464: без рамки/плашки. Только значок уровня + ник.
    const iconX = 46;
    const iconY = 45;
    ctx.save();
    ctx.translate(iconX, iconY);

    const grad = ctx.createRadialGradient(0, -5, 3, 0, 0, 19);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#8ff9ff');
    grad.addColorStop(1, '#1c73ff');

    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(160,250,255,0.96)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#eaffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(11, 11);
    ctx.lineTo(0, 5);
    ctx.lineTo(-11, 11);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = '#051525';
    ctx.font = '900 13px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(safeLevel), 0, 1);
    ctx.restore();

    ctx.font = '900 30px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.92)';
    ctx.fillStyle = '#f3fbff';
    ctx.shadowColor = 'rgba(0,245,255,0.72)';
    ctx.shadowBlur = 8;
    ctx.strokeText(safeName, 78, 46);
    ctx.fillText(safeName, 78, 46);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: true
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4.8, 1.12, 1);
    sprite.position.set(0, 4.2, 0);
    sprite.renderOrder = 1000;
    sprite.center.set(0.5, 0.0);
    sprite.userData.staticPilotLabelV461 = true;
    sprite.userData.battleOverlayV462 = true;
    return sprite;
}

function roundRectV461(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}


// ===== V463 REMOTE SHIP-SHAPED SHIELD =====
function disposeRemoteShieldMeshesV463(entry){
    try{
        if(!entry || !Array.isArray(entry.shieldMeshesV463)) return;
        entry.shieldMeshesV463.forEach(mesh => {
            try{
                if(mesh?.parent) mesh.parent.remove(mesh);
                mesh?.geometry?.dispose?.();
                mesh?.material?.map?.dispose?.();
                mesh?.material?.dispose?.();
            }catch(_){}
        });
        entry.shieldMeshesV463 = [];
    }catch(_){}
}

function createRemoteShieldOverlayMaterialV463(){
    return new THREE.MeshBasicMaterial({
        color:0x66f7ff,
        map:makeShieldHoneycombTextureV460(),
        transparent:true,
        opacity:0.24,
        depthWrite:false,
        depthTest:false,
        blending:THREE.AdditiveBlending,
        side:THREE.DoubleSide
    });
}

function attachRemoteShipShieldV463(entry){
    try{
        if(!entry?.mesh) return;
        const maxShield = Math.max(0, Number(entry.maxShield || entry.mesh?.userData?.maxShield || 0) || 0);
        if(maxShield <= 0){
            disposeRemoteShieldMeshesV463(entry);
            return;
        }

        if(Array.isArray(entry.shieldMeshesV463) && entry.shieldMeshesV463.length){
            return;
        }

        entry.shieldMeshesV463 = [];
        let created = 0;

        entry.mesh.traverse((node) => {
            try{
                if(created >= 42) return;
                if(!node?.isMesh || node.userData?.shieldOverlayV462 || node.userData?.remoteShieldOverlayV463 || node.userData?.staticPilotLabelV461) return;
                if(node.material?.isSpriteMaterial) return;
                const geometry = node.geometry?.clone?.();
                if(!geometry) return;

                const shieldMesh = new THREE.Mesh(geometry, createRemoteShieldOverlayMaterialV463());
                shieldMesh.name = 'remote-ship-shaped-shield-overlay-v463';
                shieldMesh.userData.remoteShieldOverlayV463 = true;
                shieldMesh.userData.battleOverlayV462 = true;
                shieldMesh.position.copy(node.position);
                shieldMesh.quaternion.copy(node.quaternion);
                shieldMesh.scale.copy(node.scale).multiplyScalar(1.045);
                shieldMesh.renderOrder = 997;
                node.parent.add(shieldMesh);
                entry.shieldMeshesV463.push(shieldMesh);
                created++;
            }catch(_){}
        });

        // Fallback: если модель ещё не успела дать mesh-детали, всё равно показываем щит.
        if(!entry.shieldMeshesV463.length){
            const hitRadius = Math.max(2.8, Number(entry.mesh?.userData?.hitRadius || 2.8) || 2.8);
            const geometry = new THREE.SphereGeometry(1, 48, 32);
            const material = createRemoteShieldOverlayMaterialV463();
            const shieldMesh = new THREE.Mesh(geometry, material);
            shieldMesh.name = 'remote-fallback-shield-v464';
            shieldMesh.userData.remoteShieldOverlayV463 = true;
            shieldMesh.userData.battleOverlayV462 = true;
            shieldMesh.scale.set(hitRadius * 1.08, hitRadius * 0.44, hitRadius * 1.45);
            shieldMesh.renderOrder = 997;
            entry.mesh.add(shieldMesh);
            entry.shieldMeshesV463.push(shieldMesh);
        }
    }catch(error){
        console.warn('attachRemoteShipShieldV463 warning:', error?.message || error);
    }
}

function flashRemoteShieldV463(entry){
    if(!entry) return;
    entry.shieldFlashUntilV463 = Date.now() + 280;
}

function updateRemoteShipShieldV463(entry){
    try{
        if(!entry?.mesh) return;
        const maxShield = Math.max(0, Number(entry.maxShield || entry.mesh?.userData?.maxShield || 0) || 0);
        const shield = Math.max(0, Number(entry.shield ?? entry.mesh?.userData?.shield ?? maxShield) || 0);

        if(maxShield <= 0){
            disposeRemoteShieldMeshesV463(entry);
            return;
        }

        attachRemoteShipShieldV463(entry);

        const ratio = THREE.MathUtils.clamp(shield / Math.max(1, maxShield), 0, 1);
        const flashing = Date.now() < Number(entry.shieldFlashUntilV463 || 0);
        const targetOpacity = ratio <= 0 ? 0 : (flashing ? 0.82 : 0.26 + ratio * 0.10);
        const color = flashing ? 0xffffff : 0x66f7ff;

        (entry.shieldMeshesV463 || []).forEach(mesh => {
            try{
                if(!mesh?.material) return;
                mesh.visible = targetOpacity > 0.015;
                mesh.material.opacity = mesh.material.opacity + (targetOpacity - mesh.material.opacity) * 0.32;
                mesh.material.color?.setHex?.(color);
                if(mesh.material.map){
                    mesh.material.map.offset.x += flashing ? 0.018 : 0.004;
                    mesh.material.map.offset.y += flashing ? 0.010 : 0.002;
                }
            }catch(_){}
        });
    }catch(_){}
}

function updateRemotePilotLabelDistanceV463(entry){
    try{
        if(!entry?.labelSprite || !entry?.mesh || !camera) return;
        const dist = camera.position.distanceTo(entry.mesh.position);

        // V464: ник не пропадает. Он просто становится меньше на расстоянии.
        entry.labelSprite.visible = true;
        if(entry.labelSprite.material){
            entry.labelSprite.material.opacity = 1;
            entry.labelSprite.material.transparent = true;
        }

        const baseX = 4.8;
        const baseY = 1.12;
        const k = THREE.MathUtils.clamp(36 / Math.max(18, dist), 0.30, 1.0);
        entry.labelSprite.scale.set(baseX * k, baseY * k, 1);
    }catch(_){}
}


function createRemoteBattleShipMesh(name, slotIndex, team = 'blue', playerId = ''){
    const shipGroup = new THREE.Group();
    shipGroup.rotation.order = 'YXZ';

    const labelSprite = createRemotePilotLabel(name, team, 1);
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
        shield: 0,
        maxShield: 0,
        hasRealHpV461: false,
        hitRadius: 2.6,
        team
    };

    const battleShipItem = getSelectedShipItem() || getShopShipById('scout_1') || { id:'scout_1', modelPath:'ships/Spaceship.glb' };
    mountBattleShipVisual(shipGroup, battleShipItem, team).then(() => { try{ const entry = remoteBattleShips.get(shipGroup.userData.playerId || '') || null; ensureRemotePilotLabelV462(entry || { mesh:shipGroup, labelSprite, nickname:String(name || 'Pilot'), level:1, team }); if(entry) updateRemoteShipShieldV463(entry); }catch(_){} });

    scene.add(shipGroup);
    shipGroup.userData.playerId = String(playerId || '').trim();
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
        kills: 0,
        deaths: 0,
        hp: 100,
        maxHp: 100,
        shield: 0,
        maxShield: 0,
        hasRealHpV461: false,
        team
    };
}

function getLiveBattleChannelName(){
    const rawRoomId = String(currentRoom?.id || currentRoom?.roomId || '').trim();
    const roomId = sanitizeOnlineRoomId(rawRoomId);
    if(!roomId || roomId.startsWith('observe_') || roomId.startsWith('tournament_')) return '';
    return `cosmic-battle-room:${roomId}`;
}

function upsertRemoteBattlePresence(payload = {}){
    try{ cachedRoomPlayersFetchedAt = 0; }catch(_){ }
    const entryId = String(payload.playerId || payload.player_id || payload.id || '').trim();
    const myId = String(authState?.playerId || player?.id || '').trim();
    if(!entryId || (myId && entryId === myId)) return;

    const nickname = String(payload.nickname || payload.name || 'Pilot').trim() || 'Pilot';
    const level = Math.max(1, Number(payload.level || 1) || 1);
    const ping = Math.max(0, Number(payload.ping || 0) || 0);
    const team = String(payload.team || getBattleRoomPlayerTeam(entryId)).trim().toLowerCase() === 'red' ? 'red' : 'blue';

    let entry = remoteBattleShips.get(entryId);
    if(!entry){
        return;
    }

    entry.playerId = entryId;
    const scoreSnapshot = getBattleScoreSnapshot(entryId);
    entry.nickname = nickname;
    entry.level = level;
    entry.ping = ping;
    entry.kills = Math.max(0, Number(payload.kills || scoreSnapshot.kills || entry.kills || 0) || 0);
    entry.deaths = Math.max(0, Number(payload.deaths || scoreSnapshot.deaths || entry.deaths || 0) || 0);
    entry.team = team;

    const payloadMaxHpV461 = Math.max(1, Number(payload.maxHp || payload.max_hp || entry.maxHp || 100) || 100);
    const payloadHpV461 = Math.max(0, Number(payload.hp ?? entry.hp ?? payloadMaxHpV461) || payloadMaxHpV461);
    const payloadMaxShieldV461 = Math.max(0, Number(payload.maxShield || payload.max_shield || entry.maxShield || 0) || 0);
    const payloadShieldV461 = Math.max(0, Number(payload.shield ?? entry.shield ?? payloadMaxShieldV461) || 0);

    entry.maxHp = payloadMaxHpV461;
    entry.hp = Math.min(payloadMaxHpV461, payloadHpV461);
    const oldShieldV463 = Math.max(0, Number(entry.shield || 0) || 0);
    entry.maxShield = payloadMaxShieldV461;
    entry.shield = Math.min(payloadMaxShieldV461, payloadShieldV461);
    if(entry.shield < oldShieldV463) flashRemoteShieldV463(entry);
    entry.hasRealHpV461 = true;

    if(entry.mesh?.userData){
        entry.mesh.userData.maxHp = entry.maxHp;
        entry.mesh.userData.hp = entry.hp;
        entry.mesh.userData.maxShield = entry.maxShield;
        entry.mesh.userData.shield = entry.shield;
        entry.mesh.userData.hasRealHpV461 = true;
    }

    entry.lastSeenAt = Date.now();
    if(Number(entry.deadUntil || 0) <= Date.now() && Number(entry.hp || 0) <= 0){
        entry.hp = Math.max(1, Number(entry.maxHp || entry.mesh?.userData?.maxHp || 100) || 100);
        if(entry.mesh?.userData) entry.mesh.userData.hp = entry.hp;
    }

    if(entry.mesh?.userData){
        entry.mesh.userData.pilotName = nickname;
        entry.mesh.userData.team = team;
        entry.mesh.userData.playerId = entryId;
    }

    tryApplyRemoteShipTeamVisual(entry);
    try{
        if(entry.labelSprite && entry.mesh){
            entry.mesh.remove(entry.labelSprite);
            try{ entry.labelSprite.material?.map?.dispose?.(); entry.labelSprite.material?.dispose?.(); }catch(_){}
            entry.labelSprite = createRemotePilotLabel(nickname, team, level);
            entry.mesh.add(entry.labelSprite);
        }
    }catch(_){}


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

function getBattleSelfIdentity(){
    return {
        playerId: String(authState?.playerId || player?.id || '').trim(),
        nickname: String(player?.nickname || 'Commander').trim() || 'Commander'
    };
}

function resolveBattlePlayerNameById(playerId, fallback = 'Pilot'){
    const safeId = String(playerId || '').trim();
    if(!safeId) return String(fallback || 'Pilot').trim() || 'Pilot';

    if(safeId === String(authState?.playerId || player?.id || '').trim()){
        return String(player?.nickname || fallback || 'Pilot').trim() || 'Pilot';
    }

    const remote = (remoteBattleShips instanceof Map) ? remoteBattleShips.get(safeId) : null;
    const remoteName = String(remote?.nickname || remote?.mesh?.userData?.pilotName || '').trim();
    if(remoteName) return remoteName;

    const roomPlayers = Array.isArray(currentRoom?.currentPlayers) ? currentRoom.currentPlayers : (Array.isArray(currentRoom?.players) ? currentRoom.players : []);
    for(const row of roomPlayers){
        const rowId = String(row?.id || row?.player_id || row?.public_id || '').trim();
        if(rowId && rowId === safeId){
            const rowName = String(row?.nickname || row?.name || '').trim();
            if(rowName) return rowName;
        }
    }

    return String(fallback || 'Pilot').trim() || 'Pilot';
}

function applyBattleScoreDelta(playerId, changes = {}){
    const safeId = String(playerId || '').trim();
    if(!safeId) return;

    const killsDelta = Number(changes?.killsDelta || 0) || 0;
    const deathsDelta = Number(changes?.deathsDelta || 0) || 0;
    const snapshot = getBattleScoreSnapshot(safeId);
    const nextKills = Math.max(0, snapshot.kills + killsDelta);
    const nextDeaths = Math.max(0, snapshot.deaths + deathsDelta);
    battleScoreState.set(safeId, { kills: nextKills, deaths: nextDeaths });

    const selfId = getSelfBattlePlayerId();
    const isSelf = !!(selfId && safeId === selfId);

    if(isSelf){
        battleStats.playerKills = nextKills;
        battleStats.playerDeaths = nextDeaths;
        try{ recordProfileBattleStatsV438(killsDelta, deathsDelta); }catch(_){}
    }

    const remoteEntry = (remoteBattleShips instanceof Map) ? remoteBattleShips.get(safeId) : null;
    if(remoteEntry){
        remoteEntry.kills = nextKills;
        remoteEntry.deaths = nextDeaths;
    }

    const lists = [];
    if(Array.isArray(currentRoom?.currentPlayers)) lists.push(currentRoom.currentPlayers);
    if(Array.isArray(currentRoom?.players) && currentRoom.players !== currentRoom.currentPlayers) lists.push(currentRoom.players);

    for(const list of lists){
        const row = list.find((entry) => {
            const entryId = String(entry?.public_id || entry?.player_public_id || entry?.player_id || entry?.id || '').trim();
            return !!entryId && entryId === safeId;
        });
        if(!row) continue;
        row.kills = nextKills;
        row.deaths = nextDeaths;
    }
}

function awardBattleKillRewards(victimName = ''){
    const now = Date.now();
    if(now - battleLastKillAt <= BATTLE_COMBO_WINDOW_MS){
        battleKillCombo = Math.min(10, Math.max(1, Number(battleKillCombo || 0) + 1));
    }else{
        battleKillCombo = 1;
    }
    battleLastKillAt = now;

    const rewardValue = Math.max(1, Math.min(10, Number(battleKillCombo || 1) || 1));
    const killerName = String(getDisplayPlayerTag?.() || player?.nickname || 'Commander').trim() || 'Commander';
    player.experience = Math.max(0, Number(player.experience || 0) + rewardValue);
    player.credits = Math.max(0, Number(player.credits || 0) + rewardValue);
    if(typeof playerResources === 'object' && playerResources){
        playerResources.coins = Math.max(0, Number(playerResources.coins || 0) + rewardValue);
    }

    if(rewardValue >= 2){
        pushKillFeed(`${killerName} уничтожил ${victimName || 'цель'} • комбо x${rewardValue}`, 'kill');
    }else{
        pushKillFeed(`${killerName} уничтожил ${victimName || 'противник'}`, 'kill');
    }

    try{
        if(playerShip?.position){
            showBattleFloatingReward(rewardValue, rewardValue, playerShip.position);
        }
    }catch(_){}
    try{ updateHUD?.(); }catch(_){}
    try{ updateUI?.(); }catch(_){}
    try{ updateBattleScoreboard?.(); }catch(_){}
    try{ saveGame?.(); }catch(_){}
}

async function sendBattlePresenceEvent(eventName, payload = {}){
    if(!eventName || !window.supabaseClient) return false;
    const packet = { type:'broadcast', event:eventName, payload };

    try{
        if(liveBattlePresenceChannel){
            if(typeof liveBattlePresenceChannel.httpSend === 'function'){
                await liveBattlePresenceChannel.httpSend(packet);
            }else{
                await liveBattlePresenceChannel.send(packet);
            }
            return true;
        }
    }catch(_){}

    try{
        const fallbackRoomId = sanitizeOnlineRoomId(
            payload?.roomId || currentRoom?.id || currentRoom?.roomId || ''
        );
        if(!fallbackRoomId) return false;

        const tempChannelName = `cosmic-battle-room:${fallbackRoomId}`;
        const tempChannel = window.supabaseClient.channel(tempChannelName, {
            config: { broadcast: { self: false, ack: false } }
        });

        await new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if(settled) return;
                settled = true;
                resolve(true);
            };
            try{
                tempChannel.subscribe(() => done());
            }catch(_){
                done();
            }
            setTimeout(done, 250);
        });

        try{
            if(typeof tempChannel.httpSend === 'function'){
                await tempChannel.httpSend(packet);
            }else{
                await tempChannel.send(packet);
            }
            return true;
        }finally{
            try{ window.supabaseClient.removeChannel(tempChannel); }catch(_){}
        }
    }catch(_){
        return false;
    }
}

function getBattleHitsRoomId(){
    const rawRoomId = String(currentRoom?.id || currentRoom?.roomId || '').trim();
    return sanitizeOnlineRoomId(rawRoomId);
}

async function insertBattleHitRecord(targetPlayerId, damage, victimName = ''){
    if(!window.supabaseClient) return false;
    const self = getBattleSelfIdentity();
    const roomId = getBattleHitsRoomId();
    const targetId = String(targetPlayerId || '').trim();
    const damageValue = Math.max(0, Number(damage || 0) || 0);
    if(!self.playerId || !roomId || !targetId || !damageValue) return false;

    try{
        const { error } = await window.supabaseClient
            .from('battle_hits')
            .insert({
                room_id: roomId,
                attacker_id: self.playerId,
                target_id: targetId,
                damage: damageValue
            });
        if(error) return false;
        return true;
    }catch(_){
        return false;
    }
}

async function broadcastBattleHit(targetPlayerId, damage, victimName = ''){
    return insertBattleHitRecord(targetPlayerId, damage, victimName);
}

async function insertBattleKillAckRecord(targetPlayerId, victimName = ''){
    if(!window.supabaseClient) return false;
    const self = getBattleSelfIdentity();
    const roomId = getBattleHitsRoomId();
    const targetId = String(targetPlayerId || '').trim();
    if(!self.playerId || !roomId || !targetId) return false;

    try{
        const { error } = await window.supabaseClient
            .from('battle_hits')
            .insert({
                room_id: roomId,
                attacker_id: self.playerId,
                target_id: targetId,
                damage: BATTLE_KILL_ACK_DAMAGE
            });
        if(error) return false;
        return true;
    }catch(_){
        return false;
    }
}

async function broadcastBattleKill(attackerId, attackerName, victimId, victimName){
    return sendBattlePresenceEvent('pilot-kill', {
        attackerId: String(attackerId || '').trim(),
        attackerName: String(attackerName || '').trim() || 'Commander',
        victimId: String(victimId || '').trim(),
        victimName: String(victimName || '').trim() || 'Pilot',
        at: Date.now()
    });
}

function resolveRemoteBattleHp(entry){
    const hp = Number(entry?.hp ?? entry?.mesh?.userData?.hp ?? 100);
    return Number.isFinite(hp) ? hp : 100;
}

function applyPredictedRemoteDamageV338(victimId, entry, damageValue){
    const safeVictimId = String(victimId || '').trim();
    if(!safeVictimId || !entry) return false;
    const damage = Math.max(0, Number(damageValue || 0) || 0);
    if(!damage) return false;
    const now = Date.now();
    if(Number(entry.deadUntil || 0) > now) return true;

    // V461: раньше враг локально считал цель как 100 HP и отправлял kill.
    // Теперь без реального maxHp из presence мы НЕ имеем права считать убийство.
    const hasRealHp = !!(entry.hasRealHpV461 || entry.mesh?.userData?.hasRealHpV461);
    const maxHp = Math.max(1, Number(entry.maxHp || entry.mesh?.userData?.maxHp || (hasRealHp ? 100 : 950)) || 950);
    let hp = Math.max(0, Number(entry.hp ?? entry.mesh?.userData?.hp ?? maxHp) || maxHp);
    let shield = Math.max(0, Number(entry.shield ?? entry.mesh?.userData?.shield ?? 0) || 0);

    let remainingDamage = damage;
    if(shield > 0){
        const absorbed = Math.min(shield, remainingDamage);
        shield = Math.max(0, shield - absorbed);
        remainingDamage -= absorbed;
        try{ flashRemoteShieldV463(entry); }catch(_){}
    }

    hp = Math.max(0, hp - remainingDamage);
    entry.hp = hp;
    entry.maxHp = maxHp;
    entry.shield = shield;
    if(entry.mesh?.userData){
        entry.mesh.userData.hp = hp;
        entry.mesh.userData.maxHp = maxHp;
        entry.mesh.userData.shield = shield;
        entry.mesh.userData.maxShield = Math.max(0, Number(entry.maxShield || entry.mesh.userData.maxShield || 0) || 0);
    }
    try{ updateRemoteShipShieldV463(entry); }catch(_){}

    if(hp > 0 || !hasRealHp) return false;

    entry.deadUntil = now + 2000;
    const self = getBattleSelfIdentity();
    const victimName = String(entry.nickname || entry.mesh?.userData?.pilotName || resolveBattlePlayerNameById(safeVictimId, 'Pilot')).trim() || 'Pilot';
    if(self.playerId){
        handleIncomingBattleKill({
            hitId: 'local-kill:' + safeVictimId + ':' + now,
            attackerId: self.playerId,
            attackerName: self.nickname || 'Commander',
            victimId: safeVictimId,
            victimName,
            source: 'local-predicted'
        });
        broadcastBattleKill(self.playerId, self.nickname || 'Commander', safeVictimId, victimName).catch(() => {});
    }
    return true;
}

async function initializeBattleHitCursor(){
    if(!window.supabaseClient) return;
    const self = getBattleSelfIdentity();
    const roomId = getBattleHitsRoomId();
    battleHitSessionStartedAt = Date.now();
    if(!self.playerId || !roomId){
        battleHitCursorId = 0;
        return;
    }

    try{
        const { data, error } = await window.supabaseClient
            .from('battle_hits')
            .select('id,created_at')
            .eq('room_id', roomId)
            .eq('target_id', self.playerId)
            .order('id', { ascending: false })
            .limit(1);

        if(!error && Array.isArray(data) && data.length){
            battleHitCursorId = Number(data[0]?.id || 0) || 0;
        }else{
            battleHitCursorId = 0;
        }
    }catch(_){
        battleHitCursorId = 0;
    }
}

async function pollIncomingBattleHits(){
    if(battleHitPollInFlight) return;
    if(gameState !== 'BATTLE' || battleObserverMode || !playerShip || !window.supabaseClient) return;
    const self = getBattleSelfIdentity();
    const roomId = getBattleHitsRoomId();
    if(!self.playerId || !roomId) return;

    battleHitPollInFlight = true;
    try{
        let query = window.supabaseClient
            .from('battle_hits')
            .select('id,attacker_id,target_id,damage,created_at')
            .eq('room_id', roomId)
            .eq('target_id', self.playerId)
            .order('id', { ascending: true })
            .limit(50);

        if(Number.isFinite(battleHitCursorId) && battleHitCursorId > 0){
            query = query.gt('id', battleHitCursorId);
        }

        const { data, error } = await query;
        if(error || !Array.isArray(data) || !data.length) return;

        for(const row of data){
            const hitRowId = Number(row?.id || 0) || 0;
            if(hitRowId > battleHitCursorId) battleHitCursorId = hitRowId;

            const createdAtMs = row?.created_at ? new Date(row.created_at).getTime() : 0;
            if(Number.isFinite(battleHitSessionStartedAt) && battleHitSessionStartedAt > 0 && Number.isFinite(createdAtMs) && createdAtMs > 0){
                if(createdAtMs < (battleHitSessionStartedAt - 150)){
                    continue;
                }
            }

            const attackerId = String(row?.attacker_id || '').trim();
            const targetPlayerId = String(row?.target_id || '').trim();
            const damageValue = Number(row?.damage || 0) || 0;
            const attackerName = resolveBattlePlayerNameById(attackerId, 'Pilot');

            if(damageValue <= BATTLE_KILL_ACK_DAMAGE){
                handleIncomingBattleKill({
                    hitId: `db:${hitRowId}`,
                    attackerId: targetPlayerId,
                    attackerName: resolveBattlePlayerNameById(targetPlayerId, 'Commander'),
                    victimId: attackerId,
                    victimName: attackerName,
                    source: 'db-ack'
                });
                continue;
            }

            applyIncomingBattleHit({
                hitId: `db:${hitRowId}`,
                attackerId,
                attackerName,
                targetPlayerId,
                damage: damageValue
            });
        }
    }catch(_){
    }finally{
        battleHitPollInFlight = false;
    }
}


function applyIncomingBattleHit(payload = {}){
    if(gameState !== 'BATTLE' || battleObserverMode || !playerShip || isBattleRespawning() || battleShipCrash) return;
    const self = getBattleSelfIdentity();
    const targetId = String(payload?.targetPlayerId || '').trim();
    if(!self.playerId || !targetId || self.playerId !== targetId) return;
    if(Number(playerHp || 0) <= 0) return;

    const hitId = String(payload?.hitId || '').trim();
    if(hitId){
        if(battleProcessedHitIds.has(hitId)) return;
        battleProcessedHitIds.add(hitId);
        if(battleProcessedHitIds.size > 120){
            const firstKey = battleProcessedHitIds.values().next().value;
            if(firstKey) battleProcessedHitIds.delete(firstKey);
        }
    }

    const damageValue = Math.max(0, Math.min(250, Number(payload?.damage || 0) || 0));
    if(!damageValue) return;

    applyPlayerShieldedDamageV460(damageValue, payload);
    updateBattlePlayerHud?.();
    updateBattlePlayerWorldHp?.();

    if(playerHp > 0) return;

    const attackerId = String(payload?.attackerId || '').trim();
    const attackerName = String(payload?.attackerName || resolveBattlePlayerNameById(attackerId, 'Pilot')).trim() || 'Pilot';
    playerHp = 0;
    battleKillCombo = 0;
    battleLastKillAt = 0;

    applyBattleScoreDelta(self.playerId, { deathsDelta: 1 });
    if(attackerId){
        applyBattleScoreDelta(attackerId, { killsDelta: 1 });
    }

    if(playerShip){
        spawnShipDebris(playerShip.position.clone(), 0x64d8ff);
    }
    pushKillFeed(`${attackerName} уничтожил ${player?.nickname || 'Commander'}`, 'kill');
    scheduleBattleRespawn(2000);
    updateBattleScoreboard?.();

    if(attackerId){
        insertBattleKillAckRecord(attackerId, player?.nickname || 'Commander').catch(() => {});
    }
}

function handleIncomingBattleKill(payload = {}){
    const killHitId = String(payload?.hitId || '').trim();
    if(killHitId){
        if(battleProcessedHitIds.has(killHitId)) return;
        battleProcessedHitIds.add(killHitId);
        if(battleProcessedHitIds.size > 120){
            const firstKey = battleProcessedHitIds.values().next().value;
            if(firstKey) battleProcessedHitIds.delete(firstKey);
        }
    }

    const attackerId = String(payload?.attackerId || '').trim();
    const victimId = String(payload?.victimId || '').trim();
    const victimName = String(payload?.victimName || resolveBattlePlayerNameById(victimId, 'Pilot')).trim() || 'Pilot';
    const attackerName = String(payload?.attackerName || resolveBattlePlayerNameById(attackerId, 'Pilot')).trim() || 'Pilot';
    const self = getBattleSelfIdentity();
    const existingVictimRemote = victimId && remoteBattleShips instanceof Map ? remoteBattleShips.get(victimId) : null;
    if(existingVictimRemote && Number(existingVictimRemote.deadUntil || 0) > Date.now() && String(payload?.source || '') !== 'local-predicted'){
        return;
    }

    const isSelfAttacker = !!(attackerId && self.playerId && attackerId === self.playerId);
    if(attackerId){
        applyBattleScoreDelta(attackerId, { killsDelta: 1 });
    }
    const remoteDeadUntil = Date.now() + 2000;

    if(victimId){
        applyBattleScoreDelta(victimId, { deathsDelta: 1 });
        markBattleJoinMutedForPlayer(victimId, 8000);

        const victimRemoteState = remoteBattleShips.get(victimId);
        if(victimRemoteState){
            victimRemoteState.deadUntil = remoteDeadUntil;
        }

        const roomLists = [
            ...(Array.isArray(currentRoom?.currentPlayers) ? [currentRoom.currentPlayers] : []),
            ...(Array.isArray(currentRoom?.players) ? [currentRoom.players] : [])
        ];
        roomLists.forEach(list => {
            list.forEach(row => {
                const rowId = String(row?.public_id || row?.player_public_id || row?.player_id || row?.id || '').trim();
                if(rowId && rowId === victimId){
                    row.deadUntil = remoteDeadUntil;
                }
            });
        });
    }
    if(isSelfAttacker){
        awardBattleKillRewards(victimName);
    }

    const victimRemote = victimId ? remoteBattleShips.get(victimId) : null;
    if(victimRemote?.mesh){
        spawnShipDebris(victimRemote.mesh.position.clone(), 0xff7755);
        removeRemoteBattleShipById(victimId);
    }

    updateBattleScoreboard?.();
    if(attackerName && victimName && !isSelfAttacker){
        pushKillFeed(`${attackerName} уничтожил ${victimName}`, 'kill');
    }
}

function ensureLiveBattlePresenceChannel(){
    if(!window.supabaseClient) return Promise.resolve(false);
    if(!getBattleRoomIdSafe()) return Promise.resolve(false);
    const channelName = getLiveBattleChannelName();
    if(!channelName) return Promise.resolve(false);
    if(liveBattlePresenceChannel && liveBattlePresenceChannelName === channelName){
        return liveBattlePresenceSubscribePromise || Promise.resolve(true);
    }

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
        .on('broadcast', { event: 'pilot-hit' }, ({ payload }) => {
            applyIncomingBattleHit(payload || {});
        })
        .on('broadcast', { event: 'pilot-kill' }, ({ payload }) => {
            handleIncomingBattleKill(payload || {});
        })
        .on('broadcast', { event: 'pilot-join' }, ({ payload }) => {
            handleIncomingBattleJoin(payload || {});
        })
        .on('broadcast', { event: 'pilot-left' }, ({ payload }) => {
            handleIncomingBattleLeave(payload || {});
        });

    liveBattlePresenceSubscribePromise = new Promise((resolve) => {
        let settled = false;
        const done = (ok) => {
            if(settled) return;
            settled = true;
            resolve(!!ok);
        };
        try{
            liveBattlePresenceChannel.subscribe((status) => {
                if(status === 'SUBSCRIBED') done(true);
                if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') done(false);
            });
        }catch(_){
            done(false);
        }
        setTimeout(() => done(true), 900);
    });

    return liveBattlePresenceSubscribePromise;
}

async function broadcastSelfBattleState(){
    if(battleLeavingInProgress) return;
    if(gameState !== 'BATTLE' || !playerShip || !liveBattlePresenceChannel) return;
    const playerId = String(authState?.playerId || player?.id || '').trim();
    if(!playerId) return;

    const now = Date.now();
    const payload = {
        playerId,
        nickname: player?.nickname || 'Commander',
        level: Number(player?.level || 1) || 1,
        team: getBattleRoomPlayerTeam(playerId),
        ping: getThrottledPresencePing(now),
        kills: Number(battleStats.playerKills || 0) || 0,
        deaths: Number(battleStats.playerDeaths || 0) || 0,
        hp: Math.round(Number(playerHp || 0) || 0),
        maxHp: Math.round(Number(playerMaxHp || currentBattleShipStats?.hp || 100) || 100),
        shield: Math.round(Number(playerShield || 0) || 0),
        maxShield: Math.round(Number(playerMaxShield || currentBattleShipStats?.shieldCapacity || 0) || 0),
        x: Number(playerShip.position.x || 0),
        y: Number(playerShip.position.y || 0),
        z: Number(playerShip.position.z || 0),
        qx: Number(playerShip.quaternion.x || 0),
        qy: Number(playerShip.quaternion.y || 0),
        qz: Number(playerShip.quaternion.z || 0),
        qw: Number(playerShip.quaternion.w || 1)
    };

    let previousPayload = null;
    if(lastBattlePresencePayload){
        try{ previousPayload = JSON.parse(lastBattlePresencePayload); }catch(_){ previousPayload = null; }
    }

    const needsForceSend = (now - lastBattlePresenceSentAt) >= BATTLE_PRESENCE_FORCE_INTERVAL_MS;
    const presencePingWindowPassed = (now - lastPresencePingAt) <= 60 || (now - lastPresencePingAt) >= BATTLE_PRESENCE_PING_UPDATE_MS;
    const changedMeta = !previousPayload
        || previousPayload.playerId !== payload.playerId
        || previousPayload.nickname !== payload.nickname
        || Number(previousPayload.level || 0) !== Number(payload.level || 0)
        || previousPayload.team !== payload.team
        || (presencePingWindowPassed && Number(previousPayload.ping || 0) !== Number(payload.ping || 0))
        || Number(previousPayload.kills || 0) !== Number(payload.kills || 0)
        || Number(previousPayload.deaths || 0) !== Number(payload.deaths || 0)
        || Math.abs(Number(previousPayload.hp || 0) - Number(payload.hp || 0)) >= 1
        || Math.abs(Number(previousPayload.maxHp || 0) - Number(payload.maxHp || 0)) >= 1
        || Math.abs(Number(previousPayload.shield || 0) - Number(payload.shield || 0)) >= 1
        || Math.abs(Number(previousPayload.maxShield || 0) - Number(payload.maxShield || 0)) >= 1;
    const changedPosition = !previousPayload || hasMeaningfulBattleVectorDelta(previousPayload, payload, BATTLE_PRESENCE_POSITION_EPSILON);
    const changedRotation = !previousPayload || hasMeaningfulBattleQuaternionDelta(
        { x: previousPayload?.qx, y: previousPayload?.qy, z: previousPayload?.qz, w: previousPayload?.qw },
        { x: payload.qx, y: payload.qy, z: payload.qz, w: payload.qw },
        BATTLE_PRESENCE_ROTATION_EPSILON
    );

    if(!needsForceSend && !changedMeta && !changedPosition && !changedRotation){
        return;
    }

    try{
        const eventPayload = {
            type: 'broadcast',
            event: 'pilot-state',
            payload
        };
        if(typeof liveBattlePresenceChannel.httpSend === 'function'){
            await liveBattlePresenceChannel.httpSend(eventPayload);
        }else{
            await liveBattlePresenceChannel.send(eventPayload);
        }
        lastBattlePresencePayload = JSON.stringify(payload);
        lastBattlePresenceSentAt = now;
    }catch(_){ }
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


async function resolveObservedRoomBinding(force = false){
    if(gameState !== 'OBSERVE' && currentRoom?.observer !== true) return sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null);

    const now = Date.now();
    if(!force && (now - Number(observerRoomResolveAt || 0)) < 1200){
        return sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null);
    }
    observerRoomResolveAt = now;

    try{
        await loadRoomsFromSupabase();
    }catch(_){}

    const mapName = normalizeBattleMapName(currentRoom?.map || currentRoom?.real || selectedLobbyMap?.real || 'earth');
    const nextRoomId = getObservedRoomId(mapName);
    const prevRoomId = sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null);

    if(nextRoomId && nextRoomId !== prevRoomId){
        try{
            if(remoteBattleShips instanceof Map){
                Array.from(remoteBattleShips.keys()).forEach(entryId => removeRemoteBattleShipById(entryId));
            }
        }catch(_){}
        try{ lastBattlePresenceSnapshot.clear(); }catch(_){}
        try{ battlePresenceMissingCounts.clear(); }catch(_){}
        try{ cachedRoomPlayersFetchedAt = 0; cachedRoomPlayersRows = []; }catch(_){}
        currentRoom = {
            ...(currentRoom || {}),
            id: nextRoomId,
            roomId: nextRoomId,
            map: mapName,
            real: mapName,
            observer: true,
            state: 'observe'
        };
        window.currentRoomId = nextRoomId;
    }

    return sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null);
}

async function fetchCurrentRoomLivePlayers(){
    const now = Date.now();
    const requestSerial = Number(battleClientResetSerial || 0);
    const requestRoomId = (gameState === 'OBSERVE' || currentRoom?.observer === true)
        ? await resolveObservedRoomBinding()
        : sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null);
    if((now - cachedRoomPlayersFetchedAt) < ROOM_PLAYER_FETCH_CACHE_MS && Array.isArray(cachedRoomPlayersRows)){
        return cachedRoomPlayersRows;
    }

    if(roomPlayersFetchInFlight) return null;

    const roomId = requestRoomId;
    if(!window.supabaseClient || !roomId || roomId.startsWith('observe_') || roomId.startsWith('tournament_')){
        return [];
    }

    roomPlayersFetchInFlight = true;

    return (async () => {
        try{
            const { data, error } = await window.supabaseClient
                .from('room_players')
                .select('player_id,nickname,joined_at,team,level,ping,position,rotation,updated_at')
                .eq('room_id', roomId)
                .order('joined_at', { ascending: true });

            if(error){
                roomPlayersFetchInFlight = false;
                return null;
            }

            if(requestSerial !== Number(battleClientResetSerial || 0)){
                roomPlayersFetchInFlight = false;
                return [];
            }

            const currentRoomIdNow = (gameState === 'OBSERVE' || currentRoom?.observer === true)
                ? await resolveObservedRoomBinding(true)
                : sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null);
            if(currentRoomIdNow !== roomId){
                roomPlayersFetchInFlight = false;
                return [];
            }

            const mergedRows = new Map();

            (Array.isArray(data) ? data : []).forEach((item, index) => {
                const entryId = item?.player_id ? String(item.player_id) : `guest_${index}`;
                mergedRows.set(entryId, {
                    player_id: entryId,
                    nickname: item?.nickname || `Pilot ${index + 1}`,
                    joined_at: item?.joined_at || null,
                    team: item?.team || getBattleRoomPlayerTeam(entryId),
                    level: Number(item?.level || 1) || 1,
                    ping: Number(item?.ping || 0) || 0,
                    position: item?.position || null,
                    rotation: item?.rotation || null,
                    updated_at: item?.updated_at || item?.joined_at || null
                });
            });

            const myId = getSelfBattlePlayerId();
            if(gameState === "BATTLE" && playerShip && myId){
                mergedRows.set(myId, {
                    player_id: myId,
                    nickname: player?.nickname || "Commander",
                    joined_at: new Date(now).toISOString(),
                    team: getBattleRoomPlayerTeam(myId),
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
                    updated_at: new Date(now).toISOString()
                });
            }

            // ghost-fix v303:
            // Не подмешиваем remoteBattleShips в live roster.
            // Источником истины остаётся только room_players (+ локальный self),
            // иначе вышедший игрок может визуально зависать у другого клиента.

            cachedRoomPlayersFetchedAt = now;
            cachedRoomPlayersRows = Array.from(mergedRows.values()).filter(item => isFreshRoomPlayerRow(item));
            roomPlayersFetchInFlight = false;
            return cachedRoomPlayersRows;
        }catch(_){
            roomPlayersFetchInFlight = false;
            return null;
        }
    })();
}

async function syncLiveBattlePlayers(){
    if(battleLeavingInProgress) return;
    if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;

    const syncSerial = Number(battleClientResetSerial || 0);
    const syncRoomId = sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null);
    if(!syncRoomId) return;

    if(gameState === 'BATTLE' && playerShip){
        ensureSelfRoomPlayerState();
    }

    const livePlayers = await fetchCurrentRoomLivePlayers();
    if(livePlayers === null) return;
    if(syncSerial !== Number(battleClientResetSerial || 0)) return;
    if(syncRoomId !== sanitizeOnlineRoomId(currentRoom?.id || currentRoom?.roomId || null)) return;
    if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;
    announceBattlePresenceChanges(livePlayers);
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
            remoteState = createRemoteBattleShipMesh(displayName, remoteBattleShips.size, team, entryId);
            remoteBattleShips.set(entryId, remoteState);
        }

        const scoreSnapshot = getBattleScoreSnapshot(entryId);
        remoteState.nickname = displayName;
        remoteState.level = Number(entry?.level || remoteState.level || 1) || 1;
        remoteState.ping = Number(entry?.ping || remoteState.ping || 0) || 0;
        remoteState.team = team;
        remoteState.lastSeenAt = Date.now();
        remoteState.kills = Math.max(0, Number(scoreSnapshot.kills || remoteState.kills || 0) || 0);
        remoteState.deaths = Math.max(0, Number(scoreSnapshot.deaths || remoteState.deaths || 0) || 0);
        const posStatsV464 = entry?.position || {};
        const maxHpFromRoomV464 = Math.max(1, Number(posStatsV464.maxHp || posStatsV464.max_hp || remoteState.maxHp || 100) || 100);
        const hpFromRoomV464 = Math.max(0, Number(posStatsV464.hp ?? remoteState.hp ?? maxHpFromRoomV464) || maxHpFromRoomV464);
        const maxShieldFromRoomV464 = Math.max(0, Number(posStatsV464.maxShield || posStatsV464.max_shield || remoteState.maxShield || 0) || 0);
        const shieldFromRoomV464 = Math.max(0, Number(posStatsV464.shield ?? remoteState.shield ?? maxShieldFromRoomV464) || 0);

        const oldShieldFromRoomV464 = Math.max(0, Number(remoteState.shield || 0) || 0);
        remoteState.maxHp = maxHpFromRoomV464;
        remoteState.hp = Math.min(maxHpFromRoomV464, hpFromRoomV464);
        remoteState.maxShield = maxShieldFromRoomV464;
        remoteState.shield = Math.min(maxShieldFromRoomV464, shieldFromRoomV464);
        remoteState.hasRealHpV461 = true;
        if(remoteState.shield < oldShieldFromRoomV464) flashRemoteShieldV463(remoteState);


        if(remoteState.mesh?.userData){
            remoteState.mesh.userData.team = team;
            remoteState.mesh.userData.pilotName = displayName;
            remoteState.mesh.userData.playerId = entryId;
            remoteState.mesh.userData.hp = remoteState.hp;
            remoteState.mesh.userData.maxHp = remoteState.maxHp;
            remoteState.mesh.userData.shield = remoteState.shield;
            remoteState.mesh.userData.maxShield = remoteState.maxShield;
            remoteState.mesh.userData.hasRealHpV461 = true;
        }
        tryApplyRemoteShipTeamVisual(remoteState);
        try{ updateRemoteShipShieldV463(remoteState); }catch(_){}

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

    const expireBefore = Date.now() - Math.max(ROOM_PLAYER_STALE_MS, 12000);
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


function announceBattlePresenceChanges(livePlayers = []){
    const prevSnapshot = lastBattlePresenceSnapshot instanceof Map ? lastBattlePresenceSnapshot : new Map();
    const nextSnapshot = new Map();
    const selfId = getSelfBattlePlayerId();
    const now = Date.now();

    (Array.isArray(livePlayers) ? livePlayers : []).forEach((entry, index) => {
        const entryId = entry?.player_id ? String(entry.player_id).trim() : '';
        if(!entryId) return;
        const nickname = String(entry?.nickname || `Pilot ${index + 1}`).trim() || `Pilot ${index + 1}`;
        const joinedAt = String(entry?.joined_at || '').trim();
        const updatedAt = String(entry?.updated_at || '').trim();
        nextSnapshot.set(entryId, { nickname, joinedAt, updatedAt });
        battlePresenceMissingCounts.delete(entryId);
    });

    if(battlePresenceBaselineReady){
        nextSnapshot.forEach((info, entryId) => {
            if(entryId === selfId) return;
            if(prevSnapshot.has(entryId)) return;
            if(isBattleRespawning() || Date.now() < (Number(battlePresenceAnnounceMutedUntil || 0) || 0)) return;
            if(isBattleJoinMutedForPlayer(entryId)) return;

            const joinedAtMs = info?.joinedAt ? new Date(info.joinedAt).getTime() : NaN;
            const joinedRecently = Number.isFinite(joinedAtMs) ? (now - joinedAtMs) <= 15000 : true;
            if(!joinedRecently) return;

            const nickname = String(info?.nickname || 'Pilot').trim() || 'Pilot';
            if(!shouldAnnounceBattlePresenceEvent('join', entryId, nickname)) return;
            pushKillFeed(`${nickname} присоединился к игре`, 'chat');
        });

        prevSnapshot.forEach((info, entryId) => {
            if(entryId === selfId) return;
            if(nextSnapshot.has(entryId)) return;

            const nickname = String((info && typeof info === 'object' ? info.nickname : info) || 'Pilot').trim() || 'Pilot';
            clearBattlePresenceEventCooldown('join', entryId, nickname);
            if(!shouldAnnounceBattlePresenceEvent('leave', entryId, nickname)) return;
            pushKillFeed(`${nickname} покинул игру`, 'chat');
            battlePresenceMissingCounts.delete(entryId);
        });
    }

    lastBattlePresenceSnapshot = nextSnapshot;
    battlePresenceBaselineReady = true;
}

function handleIncomingBattleJoin(payload = {}){
    const entryId = String(payload?.playerId || payload?.player_id || '').trim();
    if(!entryId) return;
    const myId = getSelfBattlePlayerId();
    if(entryId === myId) return;
    if(isBattleRespawning() || Date.now() < (Number(battlePresenceAnnounceMutedUntil || 0) || 0)) return;
    if(isBattleJoinMutedForPlayer(entryId)) return;

    const nickname = String(payload?.nickname || payload?.player_nickname || 'Pilot').trim() || 'Pilot';
    lastBattlePresenceSnapshot.set(entryId, nickname);

    if(!shouldAnnounceBattlePresenceEvent('join', entryId, nickname)) return;
    pushKillFeed(`${nickname} присоединился к игре`, 'chat');
}

function handleIncomingBattleLeave(payload = {}){
    const entryId = String(payload?.playerId || payload?.player_id || '').trim();
    if(!entryId) return;
    try{ cachedRoomPlayersFetchedAt = 0; }catch(_){ }
    const myId = getSelfBattlePlayerId();
    if(entryId === myId) return;

    const snapshotEntry = lastBattlePresenceSnapshot.get(entryId);
    const snapshotNickname = snapshotEntry && typeof snapshotEntry === 'object' ? snapshotEntry.nickname : snapshotEntry;
    const nickname = String(payload?.nickname || payload?.player_nickname || snapshotNickname || 'Pilot').trim() || 'Pilot';

    removeRemoteBattleShipById(entryId);
    lastBattlePresenceSnapshot.delete(entryId);

    if(currentRoom){
        const filterList = (list) => Array.isArray(list)
            ? list.filter(row => String(row?.id || row?.player_id || row?.public_id || row?.player_public_id || '').trim() !== entryId)
            : list;
        currentRoom.currentPlayers = filterList(currentRoom.currentPlayers) || [];
        currentRoom.players = filterList(currentRoom.players) || [];
    }

    if(!shouldAnnounceBattlePresenceEvent('leave', entryId, nickname)) return;
    pushKillFeed(`${nickname} покинул игру`, 'chat');
    updateBattleScoreboard?.();
}

function forceRemoveRemoteSceneObjects(entryId){
    const key = String(entryId || '').trim();
    if(!key || !scene) return;

    const nodesToRemove = [];
    scene.traverse?.((node) => {
        const nodePlayerId = String(node?.userData?.playerId || '').trim();
        const isRemote = !!node?.userData?.remote;
        if(isRemote && nodePlayerId && nodePlayerId === key){
            nodesToRemove.push(node);
        }
    });

    nodesToRemove.forEach((node) => {
        try{
            node.visible = false;
            if(node.parent) node.parent.remove(node);
            else scene.remove(node);
            node.traverse?.((child) => {
                if(child?.geometry) child.geometry.dispose?.();
                if(child?.material){
                    if(Array.isArray(child.material)) child.material.forEach(mat => mat?.dispose?.());
                    else child.material.dispose?.();
                }
            });
        }catch(_){}
    });
}

function removeRemoteBattleShipById(entryId){
    const key = String(entryId || '').trim();
    if(!key) return;
    try{ lastBattlePresenceSnapshot.delete(key); }catch(_){ }

    const old = remoteBattleShips instanceof Map ? remoteBattleShips.get(key) : null;
    if(old?.mesh){
        try{
            old.mesh.visible = false;
            old.mesh.userData = { ...(old.mesh.userData || {}), removed: true };
            if(old.mesh.parent) old.mesh.parent.remove(old.mesh);
            else scene.remove(old.mesh);
            old.mesh.traverse?.((child) => {
                if(child?.geometry) child.geometry.dispose?.();
                if(child?.material){
                    if(Array.isArray(child.material)) child.material.forEach(mat => mat?.dispose?.());
                    else child.material.dispose?.();
                }
            });
        }catch(_){}
    }

    if(remoteBattleShips instanceof Map){
        remoteBattleShips.delete(key);
    }

    forceRemoveRemoteSceneObjects(key);
}

async function startLiveBattleSync(){
    if(isSoloBattleActive()) return;
    stopLiveBattleSync();
    const onlineRoomId = getBattleRoomIdSafe();
    if(!onlineRoomId) return;
    await ensureLiveBattlePresenceChannel();
    try{ ensureSelfRoomPlayerState(); }catch(_){}
    await initializeBattleHitCursor();
    syncLiveBattlePlayers();
    broadcastSelfBattleState();
    const selfJoinPayload = {
        playerId: getSelfBattlePlayerId(),
        nickname: player?.nickname || 'Commander',
        roomId: onlineRoomId
    };
    setTimeout(() => {
        if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;
        if(onlineRoomId !== getBattleRoomIdSafe()) return;
        sendBattlePresenceEvent?.('pilot-join', selfJoinPayload);
    }, 250);
    setTimeout(() => {
        if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;
        if(onlineRoomId !== getBattleRoomIdSafe()) return;
        sendBattlePresenceEvent?.('pilot-join', selfJoinPayload);
    }, 550);
    setTimeout(() => {
        if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;
        if(onlineRoomId !== getBattleRoomIdSafe()) return;
        sendBattlePresenceEvent?.('pilot-join', selfJoinPayload);
    }, 2500);
    pollIncomingBattleHits();
    liveBattleSyncTimer = setInterval(syncLiveBattlePlayers, LIVE_BATTLE_SYNC_INTERVAL_MS);
    liveBattlePresencePushTimer = setInterval(() => {
        broadcastSelfBattleState();
    }, LIVE_BATTLE_PRESENCE_PUSH_INTERVAL_MS);
    battleHitPollTimer = setInterval(() => {
        pollIncomingBattleHits();
    }, LIVE_BATTLE_HIT_POLL_INTERVAL_MS);
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

        ensureRemotePilotLabelV462(entry);
        if(entry.labelSprite){
            entry.labelSprite.position.set(0, 4.2, 0);
            entry.labelSprite.quaternion.copy(camera.quaternion);
            updateRemotePilotLabelDistanceV463(entry);
        }
        updateRemoteShipShieldV463(entry);
    });
}

function getActiveSoloBots(){
    if(!Array.isArray(soloEnemyBots)) soloEnemyBots = [];
    soloEnemyBots = soloEnemyBots.filter(bot => bot && bot.parent === scene && bot.userData?.alive !== false);
    if(enemyBot && !soloEnemyBots.includes(enemyBot) && enemyBot.parent === scene && enemyBot.userData?.alive !== false){
        soloEnemyBots.unshift(enemyBot);
    }
    enemyBot = soloEnemyBots[0] || null;
    return soloEnemyBots;
}

function getEndlessBotWeaponType(index = 0){
    const weapons = ['pulse','deathRay','spread','plasma','tractor','sniper','burst'];
    return weapons[Math.abs(Number(index || 0)) % weapons.length] || 'pulse';
}

function getEndlessSoloStage(){
    const kills = Math.max(0, Number(battleStats?.playerKills || 0) || 0);
    return Math.max(1, 1 + Math.floor(kills / ENDLESS_SOLO_KILLS_PER_EXTRA_BOT));
}

function getEndlessSoloDesiredBotCount(){
    const kills = Math.max(0, Number(battleStats?.playerKills || 0) || 0);
    const extra = Math.floor(kills / ENDLESS_SOLO_KILLS_PER_EXTRA_BOT);
    return Math.min(ENDLESS_SOLO_MAX_BOTS, ENDLESS_SOLO_BASE_BOTS + extra);
}


function getEndlessSoloBotSlotId(slot = 1){
    const safeSlot = Math.max(1, Math.min(ENDLESS_SOLO_MAX_BOTS, Number(slot || 1) || 1));
    return `UFO-${String(safeSlot).padStart(2,'0')}`;
}

function getEndlessSoloBotSlotName(slot = 1){
    const safeSlot = Math.max(1, Math.min(ENDLESS_SOLO_MAX_BOTS, Number(slot || 1) || 1));
    return `UFO Raider ${safeSlot}`;
}

function getNextEndlessSoloBotSlot(){
    const desired = Math.max(1, Number(getEndlessSoloDesiredBotCount?.() || 1) || 1);
    const activeIds = new Set(getActiveSoloBots().map(bot => String(bot?.userData?.id || '').trim()).filter(Boolean));
    for(let i = 1; i <= desired; i++){
        const id = getEndlessSoloBotSlotId(i);
        if(!activeIds.has(id)) return i;
    }
    return Math.min(desired, ENDLESS_SOLO_MAX_BOTS);
}

function showEndlessSoloStageBanner(stage = 1){
    try{
        let banner = document.getElementById('solo-stage-banner');
        if(!banner){
            banner = document.createElement('div');
            banner.id = 'solo-stage-banner';
            banner.style.position = 'fixed';
            banner.style.top = '72px';
            banner.style.left = '50%';
            banner.style.transform = 'translateX(-50%)';
            banner.style.padding = '12px 20px';
            banner.style.borderRadius = '12px';
            banner.style.background = 'rgba(4, 12, 28, 0.88)';
            banner.style.border = '1px solid rgba(0,255,255,0.85)';
            banner.style.boxShadow = '0 0 24px rgba(0,255,255,0.55)';
            banner.style.color = '#eaffff';
            banner.style.font = '700 18px Arial';
            banner.style.letterSpacing = '1px';
            banner.style.textAlign = 'center';
            banner.style.zIndex = '99999';
            banner.style.pointerEvents = 'none';
            document.body.appendChild(banner);
        }
        banner.innerHTML = `⚠️ НОВАЯ СТАДИЯ: ${stage}<br><span style="font-size:12px;color:#9fefff">Появилось более мощное НЛО</span>`;
        banner.style.display = 'block';
        clearTimeout(banner._hideTimer);
        banner._hideTimer = setTimeout(() => { banner.style.display = 'none'; }, 2600);
    }catch(_){}
}

function pruneEndlessSoloBotsToLimit(){
    if(!isEndlessSoloBattle()) return;
    const desired = getEndlessSoloDesiredBotCount();
    getActiveSoloBots();
    while(soloEnemyBots.length > desired){
        const extra = soloEnemyBots.pop();
        try{
            if(extra?.userData?.hpBarSprite?.parent) extra.userData.hpBarSprite.parent.remove(extra.userData.hpBarSprite);
            if(extra?.parent) extra.parent.remove(extra);
            else scene?.remove?.(extra);
        }catch(_){}
    }
    enemyBot = soloEnemyBots[0] || null;
}

function ensureEndlessSoloBotWave(){
    if(!isEndlessSoloBattle() || gameState !== 'BATTLE' || activeSoloMissionEnded) return;

    // Главное: во время респавна игрока ничего не добавляем.
    if(typeof isBattleRespawning === 'function' && isBattleRespawning()){
        pruneEndlessSoloBotsToLimit();
        return;
    }

    const alive = getActiveSoloBots();
    const desired = getEndlessSoloDesiredBotCount();
    const stage = getEndlessSoloStage();

    if(stage > endlessSoloLastBannerStage){
        endlessSoloLastBannerStage = stage;
        showEndlessSoloStageBanner(stage);
    }

    pruneEndlessSoloBotsToLimit();

    if(alive.length >= desired) return;

    const now = Date.now();
    // removed instant respawn block

    if((now - lastEndlessBotSpawnAt) < ENDLESS_SOLO_SPAWN_COOLDOWN_MS) return;

    lastEndlessBotSpawnAt = now;
    if(soloEnemyBots.length < getEndlessSoloDesiredBotCount()){ createEnemyBot({ append:true, controlledWave:true }); }
    pruneEndlessSoloBotsToLimit();
}

function createEnemyBot(options = {}){
    if(isSoloBattleActive() && activeSoloMissionEnded) return null;
    const endlessMode = isEndlessSoloBattle();
    if(!endlessMode){
        if(enemyBot){ scene.remove(enemyBot); enemyBot = null; }
        soloEnemyBots.forEach(bot => { try{ if(bot) scene.remove(bot); }catch(_){} });
        soloEnemyBots = [];
        soloBotScoreRows = new Map();
    }else{
        getActiveSoloBots();
        const desiredCount = getEndlessSoloDesiredBotCount();
        if(soloEnemyBots.length >= desiredCount) return enemyBot;
        if(soloEnemyBots.length >= ENDLESS_SOLO_MAX_BOTS) return enemyBot;
    }

    const botGroup = new THREE.Group();
    botGroup.rotation.order = 'YXZ';
    const playerLevel = Math.max(1, Number(player?.level || 1) || 1);
    const missionPower = Math.max(1, Number(activeSoloMission?.minLevel || currentRoom?.minLevel || 1) || 1);
    const botIndex = endlessMode ? getNextEndlessSoloBotSlot() : 1;
    const endlessStage = endlessMode ? getEndlessSoloStage() : 1;
    const weaponType = endlessMode ? getEndlessBotWeaponType(botIndex + endlessStage - 2) : 'pulse';
    const botMaxHp = Math.max(endlessMode ? 185 : 135, Math.round((playerMaxHp || 100) * (endlessMode ? (1.65 + endlessStage * 0.10) : 1.45) + missionPower * 3 + botIndex * 12 + endlessStage * 18));
    const botId = endlessMode ? getEndlessSoloBotSlotId(botIndex) : 'UFO-01';
    const botName = endlessMode ? getEndlessSoloBotSlotName(botIndex) : (activeSoloMission?.botName || 'UFO Raider');
    botGroup.userData = {
        id: botId,
        name: botName,
        hp: botMaxHp,
        maxHp: botMaxHp,
        armor: Math.min(endlessMode ? 0.44 : 0.38, (endlessMode ? 0.22 : 0.18) + playerLevel * 0.006),
        damageBoost: endlessMode ? 1.35 + Math.min(1.25, endlessStage * 0.14 + botIndex * 0.055) : 1.18,
        strafePhase: Math.random() * Math.PI * 2,
        alive: true,
        isSoloBot: true,
        hitRadius: endlessMode ? 7.2 : 3.4,
        weaponType,
        lastShotAt: Date.now() + 600 + Math.random() * 900,
        tractorReadyAt: Date.now() + 60000 + Math.random() * 90000,
        preferredDistance: endlessMode ? (42 + Math.random() * 24) : 36,
        scoreKills: 0,
        scoreDeaths: 0,
        botMoveVelocity: new THREE.Vector3(),
        hpBarOffsetY: endlessMode ? 9.2 : 5.2
    };
    if(!(soloBotScoreRows instanceof Map)) soloBotScoreRows = new Map();
    const existingBotRow = soloBotScoreRows.get(botId);
    if(existingBotRow){
        existingBotRow.id = botId;
        existingBotRow.nickname = existingBotRow.nickname || botName;
        existingBotRow.weaponType = existingBotRow.weaponType || weaponType;
        existingBotRow.level = Math.max(1, Number(existingBotRow.level || activeSoloMission?.minLevel || player?.level || 1) || 1);
        existingBotRow.team = 'red';
        botGroup.userData.scoreKills = Number(existingBotRow.kills || 0) || 0;
        botGroup.userData.scoreDeaths = Number(existingBotRow.deaths || 0) || 0;
    }else{
        soloBotScoreRows.set(botId, {
            id: botId,
            nickname: botName,
            kills: 0,
            deaths: 0,
            weaponType,
            level: Math.max(1, Number(activeSoloMission?.minLevel || player?.level || 1) || 1),
            team: 'blue'
        });
    }

    const placeholderMat = new THREE.MeshStandardMaterial({ color:0x76eaff, emissive:0x124a66, roughness:0.45, metalness:0.35 });
    const placeholder = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 12), placeholderMat);
    placeholder.scale.set(1.45, 0.34, 1.45);
    botGroup.add(placeholder);
    const glow = new THREE.PointLight(0x55ddff, 1.4, 22);
    glow.position.set(0, 0.8, 0);
    botGroup.add(glow);
    botGroup.position.copy(getSoloBotSpawnPosition());
    if(playerShip) botGroup.lookAt(playerShip.position);
    soloEnemyBots.push(botGroup);
    if(endlessMode && soloEnemyBots.length > getEndlessSoloDesiredBotCount()){
        soloEnemyBots.pop();
        return enemyBot;
    }
    enemyBot = soloEnemyBots[0] || botGroup;
    scene.add(botGroup);
    ensureSoloBotHpBar(botGroup);
    try{
        const loader = new GLTFLoader();
        loader.load(SOLO_BOT_MODEL_PATH, (gltf) => {
            if(!botGroup || botGroup.parent !== scene) return;
            const model = gltf.scene;
            model.name = 'Solo UFO Bot Visual';
            model.rotation.set(0, Math.PI, 0);
            model.updateMatrixWorld(true);
            const rawBox = new THREE.Box3().setFromObject(model);
            const rawSize = rawBox.getSize(new THREE.Vector3());
            const rawCenter = rawBox.getCenter(new THREE.Vector3());
            const maxDim = Math.max(rawSize.x || 0, rawSize.y || 0, rawSize.z || 0);
            const targetDim = endlessMode ? 14.5 : 7.2;
            const safeScale = (Number.isFinite(maxDim) && maxDim > 0.001)
                ? THREE.MathUtils.clamp(targetDim / maxDim, 0.0005, 4.5)
                : 1;
            model.scale.setScalar(safeScale);
            model.position.sub(rawCenter.multiplyScalar(safeScale));
            model.traverse?.((child) => {
                if(child?.isMesh){
                    child.frustumCulled = false;
                    if(child.material){
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(mat => { if(mat){ mat.depthWrite = true; mat.depthTest = true; } });
                    }
                }
            });
            while(botGroup.children.length){ botGroup.remove(botGroup.children[0]); }
            botGroup.add(model);
            botGroup.userData.hitRadius = endlessMode ? 7.8 : 4.2;
            const modelLight = new THREE.PointLight(weaponType === 'deathRay' ? 0xff4466 : weaponType === 'tractor' ? 0xaa66ff : 0x66eaff, 1.15, 34);
            modelLight.position.set(0, 1.1, 0);
            botGroup.add(modelLight);
            ensureSoloBotHpBar(botGroup);
        }, undefined, () => {});
    }catch(_){ }
    updateEnemyHud();
    updateBattleScoreboard();
    return botGroup;
}


function ensureSoloBotHpBar(bot){
    if(!bot || bot.userData?.alive === false) return null;
    if(bot.userData.hpBarSprite && bot.userData.hpBarSprite.parent === bot) return bot.userData.hpBarSprite;
    try{
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 18;
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:false, depthWrite:false });
        const sprite = new THREE.Sprite(material);
        sprite.name = 'solo-bot-hp-thin-bar';
        sprite.renderOrder = 9998;
        sprite.position.set(0, Number(bot.userData?.hpBarOffsetY || (isEndlessSoloBattle() ? 8.8 : 5.0)) || 5, 0);
        sprite.scale.set(isEndlessSoloBattle() ? 10.5 : 7.2, 0.72, 1);
        sprite.userData = { canvas, texture };
        bot.userData.hpBarSprite = sprite;
        bot.add(sprite);
        updateSoloBotHpBar(bot);
        return sprite;
    }catch(_){ return null; }
}

function updateSoloBotHpBar(bot){
    if(!bot || bot.userData?.alive === false) return;
    const sprite = ensureSoloBotHpBar(bot);
    if(!sprite) return;
    const data = sprite.userData || {};
    const canvas = data.canvas;
    const texture = data.texture;
    const ctx = canvas?.getContext?.('2d');
    if(!ctx || !texture) return;
    const hp = Math.max(0, Number(bot.userData?.hp || 0) || 0);
    const maxHp = Math.max(1, Number(bot.userData?.maxHp || 1) || 1);
    const ratio = THREE.MathUtils.clamp(hp / maxHp, 0, 1);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 4, canvas.width, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 4.5, canvas.width - 1, 9);
    ctx.fillStyle = ratio > 0.55 ? '#47ff7a' : (ratio > 0.25 ? '#ffd24a' : '#ff4545');
    ctx.fillRect(2, 6, Math.max(0, (canvas.width - 4) * ratio), 6);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(2, 6, Math.max(0, (canvas.width - 4) * ratio), 1);
    texture.needsUpdate = true;
    sprite.visible = !!(gameState === 'BATTLE' && isSoloBattleActive() && hp > 0);
    sprite.position.set(0, Number(bot.userData?.hpBarOffsetY || (isEndlessSoloBattle() ? 8.8 : 5.0)) || 5, 0);
}

function updateSoloBotHpBars(){
    try{
        const bots = getActiveSoloBots?.() || [];
        bots.forEach(bot => updateSoloBotHpBar(bot));
    }catch(_){ }
}

function updateEnemyHud(){
    const hud = document.getElementById('enemy-hud');
    const name = document.getElementById('enemy-name');
    const hpBar = document.getElementById('enemy-hp-bar');
    const hpText = document.getElementById('enemy-hp-text');
    const hpInlineText = document.getElementById('enemy-hp-inline-text');
    if(!hud || !name || !hpBar || !hpText) return;

    const bots = getActiveSoloBots?.() || (enemyBot ? [enemyBot] : []);
    if(!enemyBot && bots.length) enemyBot = bots[0];
    if(!enemyBot){
        hud.style.display = 'none';
        return;
    }

    hud.style.display = 'block';
    const hp = Math.max(0, enemyBot.userData.hp);
    const maxHp = Math.max(1, enemyBot.userData.maxHp);
    const percent = (hp / maxHp) * 100;
    name.textContent = isSoloBattleActive() ? '' : (enemyBot.userData.name || 'BOT DRONE');
    name.style.display = isSoloBattleActive() ? 'none' : 'block';
    hpBar.style.width = percent + '%';
    updateSoloMissionHud?.();
    hpText.textContent = hp + ' / ' + maxHp;
    if(hpInlineText) hpInlineText.textContent = hp + ' / ' + maxHp;
}

function fireBotLaser(bot = enemyBot){
    if(!bot || !playerShip || bot.userData?.alive === false) return;
    const toPlayer = playerShip.position.clone().sub(bot.position).normalize();
    const weaponType = String(bot.userData?.weaponType || 'pulse');
    const now = Date.now();

    if(weaponType === 'tractor' && now >= Number(bot.userData?.tractorReadyAt || 0)){
        bot.userData.tractorReadyAt = now + 120000 + Math.random() * 90000;
        const beamMesh = createProjectileVisual('beam', {
            color:'#b05cff', coreColor:'#ffffff', width:0.32, length:4.8, scale:1.35
        });
        beamMesh.position.copy(bot.position.clone().add(new THREE.Vector3(0, 0, -2.6).applyQuaternion(bot.quaternion)));
        beamMesh.lookAt(bot.position.clone().add(toPlayer));
        scene.add(beamMesh);
        enemyLasers.push({ mesh:beamMesh, velocity:toPlayer.clone().multiplyScalar(1.35), life:150, maxLife:150, damage:7, weaponType:'tractor', pullStrength:0.038, shooter:bot });
        return;
    }

    const patterns = {
        deathRay: { offsets:[0], color:'#ff2d2d', core:'#ffffff', width:0.26, length:5.2, speed:2.45, damage:18, life:120, type:'deathRay' },
        spread: { offsets:[-1.15,0,1.15], color:'#ff8844', core:'#fff6d0', width:0.12, length:1.8, speed:1.75, damage:7, life:105, type:'pulse' },
        plasma: { offsets:[-0.55,0.55], color:'#38ff94', core:'#ffffff', width:0.18, length:2.2, speed:1.62, damage:12, life:120, type:'plasma' },
        sniper: { offsets:[0], color:'#55d7ff', core:'#ffffff', width:0.10, length:3.4, speed:3.1, damage:15, life:95, type:'sniper' },
        burst: { offsets:[-0.75,0.75], color:'#ffd84d', core:'#ffffff', width:0.12, length:1.7, speed:2.15, damage:9, life:100, type:'pulse' },
        pulse: { offsets:[-0.7,0.7], color:'#55d7ff', core:'#ffffff', width:0.13, length:1.9, speed:1.9, damage:8, life:100, type:'pulse' },
        tractor: { offsets:[-0.7,0.7], color:'#aa66ff', core:'#ffffff', width:0.13, length:1.9, speed:1.75, damage:8, life:110, type:'pulse' }
    };
    const pattern = patterns[weaponType] || patterns.pulse;

    pattern.offsets.forEach((offsetX, index) => {
        const laserMesh = createProjectileVisual(pattern.type, {
            color: pattern.color,
            coreColor: pattern.core,
            width: pattern.width,
            length: pattern.length,
            scale: weaponType === 'deathRay' ? 1.45 : 1.05
        });
        const localOffset = new THREE.Vector3(offsetX, 0, -1.8).applyQuaternion(bot.quaternion);
        const aim = toPlayer.clone();
        if(weaponType === 'spread'){
            aim.applyAxisAngle(new THREE.Vector3(0,1,0), (index - 1) * 0.09).normalize();
        }
        laserMesh.position.copy(bot.position.clone().add(localOffset));
        laserMesh.lookAt(bot.position.clone().add(aim));
        scene.add(laserMesh);
        enemyLasers.push({
            mesh: laserMesh,
            velocity: aim.clone().multiplyScalar(pattern.speed),
            life: pattern.life,
            maxLife: pattern.life,
            damage: Math.round(pattern.damage * (Number(bot?.userData?.damageBoost || 1) || 1)),
            weaponType: pattern.type,
            shooter: bot
        });
    });
}

function updateBattleScoreboard(){
    const body = document.getElementById('battle-scoreboard-body');
    if(!body) return;

    const myId = getSelfBattlePlayerId();
    const selfTeam = isSoloBattleActive() ? 'red' : getBattleRoomPlayerTeam(myId);
    const selfRow = (gameState === 'OBSERVE') ? null : {
        nickname: player?.nickname || 'Commander',
        clan: isSoloBattleActive() ? 'RED' : '',
        level: Number(player?.level || 1) || 1,
        kills: Number(battleStats.playerKills || 0) || 0,
        deaths: Number(battleStats.playerDeaths || 0) || 0,
        id: myId,
        ping: Number(getBattlePingValue() || 0) || 0,
        deadUntil: Number(battlePendingRespawnAt || 0) || 0,
        team: selfTeam
    };

    const roomPlayers = Array.isArray(currentRoom?.currentPlayers) && currentRoom.currentPlayers.length
        ? currentRoom.currentPlayers
        : (Array.isArray(currentRoom?.players) ? currentRoom.players : []);

    const rows = [];
    if(selfRow) rows.push(selfRow);
    if(isSoloBattleActive()){
        const activeBots = getActiveSoloBots();
        if(!(soloBotScoreRows instanceof Map)) soloBotScoreRows = new Map();

        activeBots.forEach((bot, idx) => {
            const id = String(bot?.userData?.id || getEndlessSoloBotSlotId(idx + 1));
            let row = soloBotScoreRows.get(id);
            if(!row){
                row = {
                    id,
                    nickname: bot?.userData?.name || id || 'UFO Raider',
                    kills: Number(bot?.userData?.scoreKills || 0) || 0,
                    deaths: Number(bot?.userData?.scoreDeaths || 0) || 0,
                    level: Math.max(1, Number(activeSoloMission?.minLevel || player?.level || 1) || 1),
                    team: 'blue'
                };
                soloBotScoreRows.set(id, row);
            }else{
                row.id = id;
                row.nickname = row.nickname || bot?.userData?.name || id || 'UFO Raider';
                row.level = Math.max(1, Number(row.level || activeSoloMission?.minLevel || player?.level || 1) || 1);
                bot.userData.scoreKills = Number(row.kills || 0) || 0;
                bot.userData.scoreDeaths = Number(row.deaths || 0) || 0;
            }
        });

        const desiredBotRows = isEndlessSoloBattle()
            ? getEndlessSoloDesiredBotCount()
            : Math.max(1, activeBots.length || soloBotScoreRows.size || 1);

        const pushedBotIds = new Set();
        for(let slot = 1; slot <= desiredBotRows; slot++){
            const id = isEndlessSoloBattle() ? getEndlessSoloBotSlotId(slot) : 'UFO-01';
            let row = soloBotScoreRows.get(id);
            const activeBot = activeBots.find(bot => String(bot?.userData?.id || '') === id);
            if(!row && activeBot){
                row = {
                    id,
                    nickname: activeBot?.userData?.name || (isEndlessSoloBattle() ? getEndlessSoloBotSlotName(slot) : 'UFO Raider'),
                    kills: Number(activeBot?.userData?.scoreKills || 0) || 0,
                    deaths: Number(activeBot?.userData?.scoreDeaths || 0) || 0,
                    level: Math.max(1, Number(activeSoloMission?.minLevel || player?.level || 1) || 1),
                    team: 'blue'
                };
                soloBotScoreRows.set(id, row);
            }
            if(!row) continue;
            if(pushedBotIds.has(id)) continue;
            pushedBotIds.add(id);
            rows.push({
                nickname: row.nickname || (isEndlessSoloBattle() ? getEndlessSoloBotSlotName(slot) : 'UFO Raider'),
                clan: row.team === 'blue' ? 'BLUE' : 'RED',
                level: Number(row.level || 1) || 1,
                kills: Number(row.kills || 0) || 0,
                deaths: Number(row.deaths || 0) || 0,
                id,
                ping: 0,
                deadUntil: Number(row.deadUntil || 0) || 0,
                team: 'blue'
            });
        }
    }
    roomPlayers.forEach((entry) => {
        const entryId = String(entry?.public_id || entry?.player_public_id || entry?.player_id || entry?.id || '').trim();
        const safeName = String(entry?.nickname || entry?.name || entry || '').trim();
        const isYou = (!!entryId && !!myId && entryId === myId) || safeName === (player?.nickname || 'Commander');
        if(isYou) return;

        const team = String(entry?.team || getBattleRoomPlayerTeam(entryId)).trim().toLowerCase() === 'red' ? 'red' : 'blue';
        const remoteState = entryId ? remoteBattleShips.get(entryId) : null;
        rows.push({
            nickname: remoteState?.nickname || safeName || 'Pilot',
            clan: team === 'red' ? 'RED' : 'BLUE',
            level: Number(remoteState?.level || entry?.level || 1) || 1,
            kills: Number(remoteState?.kills || entry?.kills || 0) || 0,
            deaths: Number(remoteState?.deaths || entry?.deaths || 0) || 0,
            id: entryId,
            ping: Number(remoteState?.ping || entry?.ping || 0) || 0,
            deadUntil: Number(entry?.deadUntil || remoteState?.deadUntil || 0) || 0,
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
      const deadUntil = Math.max(0, Number(isYou ? battlePendingRespawnAt : entry?.deadUntil) || 0);
      const isDead = deadUntil > Date.now();
      const nickColor = team === 'red' ? '#ff8f8f' : '#8fd8ff';
      const displayName = isDead ? `💀 ${safeName}` : safeName;
      return `
      <div class="battle-scoreboard-row ${team === 'red' ? 'enemy' : 'player'}">
        <span></span>
        <span title="${safeName}" style="color:${nickColor};font-weight:700;">${displayName}</span>
        <span>${kills}</span>
        <span>${deaths}</span>
        <span class="battle-level-cell"><span class="battle-level-icon">★</span>${levelValue}</span>
        <span>${publicId}</span>
        <span>${pingValue}</span>
      </div>`;
    }).join('');
}

// ================= SPAWN PLAYER =================


// ===== V457 BATTLE SCENE VISIBILITY GUARD =====
// Если после входа на карту виден только чёрный экран и прицел,
// принудительно ставим камеру за корабль и проверяем, что сцена реально собрана.
function forceBattleCameraBehindPlayerV457(reason = ''){
    try{
        if(gameState !== 'BATTLE' && gameState !== 'OBSERVE') return;
        if(!playerShip || !camera || !scene) return;

        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();
        const followDistance = Number(playerShip?.userData?.cameraDistance || 16) || 16;
        const followHeight = Number(playerShip?.userData?.cameraHeight || 5.5) || 5.5;

        const camPos = playerShip.position.clone()
            .add(direction.clone().multiplyScalar(-followDistance))
            .add(new THREE.Vector3(0, followHeight, 0));

        camera.position.copy(camPos);
        camera.lookAt(playerShip.position.clone().add(direction.clone().multiplyScalar(35)));
        camera.updateProjectionMatrix?.();

        if(renderer?.domElement){
            renderer.domElement.style.display = 'block';
            renderer.domElement.style.visibility = 'visible';
            renderer.domElement.style.opacity = '1';
        }
    }catch(error){
        console.warn('forceBattleCameraBehindPlayerV457 warning:', reason, error?.message || error);
    }
}

function verifyBattleSceneVisibleV457(reason = ''){
    try{
        if(gameState !== 'BATTLE') return;

        const mapKey = normalizeBattleMapName(currentRoom?.real || selectedLobbyMap?.real || currentRoom?.map || selectedLobbyMap?.name || currentRoom?.title || 'earth');

        if(!battleMapPlanet && !isEndlessSoloBattle()){
            try{
                enterBattleMap(mapKey);
            }catch(error){
                console.warn('verifyBattleSceneVisibleV457 enterBattleMap warning:', error?.message || error);
            }
        }

        if(!playerShip){
            try{
                spawnPlayer();
            }catch(error){
                console.warn('verifyBattleSceneVisibleV457 spawnPlayer warning:', error?.message || error);
            }
        }

        forceBattleCameraBehindPlayerV457(reason || 'verify');

        try{
            if(typeof battleMapPlanet !== 'undefined' && battleMapPlanet){
                battleMapPlanet.visible = true;
            }
            if(playerShip){
                playerShip.visible = true;
            }
            if(typeof stars !== 'undefined' && stars){
                stars.visible = true;
            }
        }catch(_){}

        try{
            const canvas = document.querySelector('canvas');
            if(canvas){
                canvas.style.setProperty('display', 'block', 'important');
                canvas.style.setProperty('visibility', 'visible', 'important');
                canvas.style.setProperty('opacity', '1', 'important');
            }
        }catch(_){}
    }catch(error){
        console.warn('verifyBattleSceneVisibleV457 warning:', reason, error?.message || error);
    }
}


// ===== V460 PLAYER SHIELD FIELD =====
function makeShieldHoneycombTextureV460(){
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.strokeStyle = 'rgba(115,245,255,0.82)';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(0,235,255,0.85)';
    ctx.shadowBlur = 7;

    const r = 14;
    const w = Math.sqrt(3) * r;
    const h = 2 * r;
    const yStep = h * 0.75;

    for(let y = -h; y < canvas.height + h; y += yStep){
        const row = Math.round(y / yStep);
        for(let x = -w; x < canvas.width + w; x += w){
            const cx = x + (row % 2 ? w / 2 : 0);
            const cy = y;
            ctx.beginPath();
            for(let i = 0; i < 6; i++){
                const a = Math.PI / 6 + i * Math.PI / 3;
                const px = cx + Math.cos(a) * r;
                const py = cy + Math.sin(a) * r;
                if(i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.3, 1.7);
    texture.needsUpdate = true;
    return texture;
}

function removePlayerShieldFieldV460(){
    try{
        if(Array.isArray(playerShieldMeshesV462)){
            playerShieldMeshesV462.forEach(mesh => {
                try{
                    if(mesh?.parent) mesh.parent.remove(mesh);
                    mesh?.geometry?.dispose?.();
                    mesh?.material?.map?.dispose?.();
                    mesh?.material?.dispose?.();
                }catch(_){}
            });
        }
    }catch(_){}
    playerShieldMeshesV462 = [];

    try{
        if(playerShieldMeshV460?.parent) playerShieldMeshV460.parent.remove(playerShieldMeshV460);
        if(playerShieldMeshV460?.material){
            try{ playerShieldMeshV460.material.map?.dispose?.(); }catch(_){}
            try{ playerShieldMeshV460.material.dispose?.(); }catch(_){}
        }
        try{ playerShieldMeshV460?.geometry?.dispose?.(); }catch(_){}
    }catch(_){}
    playerShieldMeshV460 = null;
}

function createShieldOverlayMaterialV462(){
    return new THREE.MeshBasicMaterial({
        color:0x66f7ff,
        map:makeShieldHoneycombTextureV460(),
        transparent:true,
        opacity:0.0,
        depthWrite:false,
        depthTest:true,
        blending:THREE.AdditiveBlending,
        side:THREE.DoubleSide
    });
}

function attachPlayerShieldFieldV460(){
    try{
        removePlayerShieldFieldV460();
        if(!playerShip || Number(playerMaxShield || 0) <= 0) return;

        const overlayMat = createShieldOverlayMaterialV462();
        let created = 0;

        // V462: щит не овалом вокруг корабля, а копиями геометрии поверх каждого mesh корабля.
        // Это повторяет форму корпуса/крыльев/деталей.
        playerShip.traverse((node) => {
            try{
                if(created >= 42) return;
                if(!node?.isMesh || node.userData?.shieldOverlayV462 || node.name === 'player-ship-honeycomb-shield-v460') return;
                if(node.material?.isSpriteMaterial) return;

                const clonedGeometry = node.geometry?.clone?.();
                if(!clonedGeometry) return;

                const shieldMesh = new THREE.Mesh(clonedGeometry, overlayMat.clone());
                shieldMesh.name = 'ship-shaped-shield-overlay-v462';
                shieldMesh.userData.shieldOverlayV462 = true;
                shieldMesh.position.copy(node.position);
                shieldMesh.quaternion.copy(node.quaternion);
                shieldMesh.scale.copy(node.scale).multiplyScalar(1.035);
                shieldMesh.renderOrder = 998;
                node.parent.add(shieldMesh);
                playerShieldMeshesV462.push(shieldMesh);
                created++;
            }catch(_){}
        });

        // fallback only if real model meshes are not ready yet.
        if(!playerShieldMeshesV462.length){
            const hitRadius = Math.max(2.8, Number(playerShip?.userData?.hitRadius || 2.8) || 2.8);
            const geometry = new THREE.SphereGeometry(1, 48, 32);
            const material = createShieldOverlayMaterialV462();
            const shield = new THREE.Mesh(geometry, material);
            shield.name = 'player-ship-honeycomb-shield-v460';
            shield.scale.set(hitRadius * 1.0, hitRadius * 0.38, hitRadius * 1.35);
            shield.userData.baseScaleV461 = shield.scale.clone();
            shield.renderOrder = 999;
            playerShip.add(shield);
            playerShieldMeshV460 = shield;
        }

        updatePlayerShieldFieldV460(true);
    }catch(error){
        console.warn('attachPlayerShieldFieldV460 warning:', error?.message || error);
    }
}

function flashPlayerShieldV460(){
    playerShieldFlashUntilV460 = Date.now() + 320;
    try{ updatePlayerShieldFieldV460(true); }catch(_){}
}

function updatePlayerShieldFieldV460(force = false){
    try{
        const ratio = THREE.MathUtils.clamp(Number(playerShield || 0) / Math.max(1, Number(playerMaxShield || 1)), 0, 1);
        const flashing = Date.now() < Number(playerShieldFlashUntilV460 || 0);
        const targetOpacity = ratio <= 0 ? 0 : (flashing ? 0.82 : 0.14 + ratio * 0.08);
        const color = flashing ? 0xffffff : 0x66f7ff;

        const updateMesh = (mesh) => {
            if(!mesh?.material) return;
            mesh.visible = targetOpacity > 0.015;
            mesh.material.opacity = force ? targetOpacity : mesh.material.opacity + (targetOpacity - mesh.material.opacity) * 0.35;
            mesh.material.color?.setHex?.(color);
            try{
                if(mesh.material.map){
                    mesh.material.map.offset.x += flashing ? 0.018 : 0.004;
                    mesh.material.map.offset.y += flashing ? 0.010 : 0.002;
                }
            }catch(_){}
        };

        if(Array.isArray(playerShieldMeshesV462) && playerShieldMeshesV462.length){
            playerShieldMeshesV462.forEach(updateMesh);
        }
        if(playerShieldMeshV460){
            updateMesh(playerShieldMeshV460);
            playerShieldMeshV460.rotation.y += flashing ? 0.045 : 0.009;
            playerShieldMeshV460.rotation.z += flashing ? 0.018 : 0.003;
            const baseScale = playerShieldMeshV460.userData.baseScaleV461;
            if(baseScale){
                const pulse = flashing ? 1.12 : 1.0 + Math.sin(Date.now() / 380) * 0.025;
                playerShieldMeshV460.scale.set(baseScale.x * pulse, baseScale.y * pulse, baseScale.z * pulse);
            }
        }
    }catch(_){}
}

function applyPlayerShieldedDamageV460(amount = 0, source = null){
    let incoming = Math.max(0, Number(amount || 0) || 0);
    if(incoming <= 0) return 0;

    if(Number(playerShield || 0) > 0){
        const absorbed = Math.min(Number(playerShield || 0), incoming);
        playerShield = Math.max(0, Number(playerShield || 0) - absorbed);
        incoming -= absorbed;
        flashPlayerShieldV460();
    }

    if(incoming > 0){
        playerHp = Math.max(0, Number(playerHp || 0) - incoming);
    }

    try{ updateBattlePlayerHud?.(); updateBattlePlayerWorldHp?.(); }catch(_){}
    return incoming;
}

function spawnPlayer() {

    if (playerShip) {
        removePlayerShieldFieldV460?.();
        scene.remove(playerShip);
        playerShip = null;
    }

    shipVelocity.set(0, 0, 0);
    activeLasers.forEach(laser => scene.remove(laser.mesh));
    activeLasers = [];

    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');

    const shipGroup = new THREE.Group();
    shipGroup.rotation.order = 'YXZ';

    const selfTeam = getBattleRoomPlayerTeam(getSelfBattlePlayerId());
    mountBattleShipVisual(shipGroup, currentBattleShipStats.ship || getSelectedShipItem() || { id:'scout_1', modelPath:'ships/Spaceship.glb' }, selfTeam);

    const spawn = selfTeam === 'red' ? spawnPointB.clone() : spawnPointA.clone();
    const lookTarget = selfTeam === 'red' ? spawnPointA.clone() : spawnPointB.clone();
    playerShip = shipGroup;
    playerShip.position.copy(spawn);
    playerShip.visible = true;
    playerShip.lookAt(lookTarget);
    const battleVisualConfig = getBattleShipVisualConfig(currentBattleShipStats?.ship?.id || player?.selectedShipId || '');
    playerShip.userData = {
        ...(playerShip.userData || {}),
        hp: currentBattleShipStats.hp,
        maxHp: currentBattleShipStats.hp,
        shield: Number(currentBattleShipStats?.shieldCapacity || 0) || 0,
        maxShield: Number(currentBattleShipStats?.shieldCapacity || 0) || 0,
        weapon: currentBattleShipStats.ship?.weapon || 'laser',
        speed: currentBattleShipStats.maxSpeed,
        handling: currentBattleShipStats.handlingLabel,
        fireCooldown: currentBattleShipStats.fireCooldown,
        modules: currentBattleShipStats.installedModules,
        cameraDistance: Number(battleVisualConfig?.cameraDistance || 16) || 16,
        cameraHeight: Number(battleVisualConfig?.cameraHeight || 5.5) || 5.5
    };

    playerControl.yaw = playerShip.rotation.y;
    playerControl.pitch = 0;
    playerControl.roll = 0;

    playerMaxHp = currentBattleShipStats.hp;
    playerHp = playerMaxHp;
    playerMaxShield = Math.max(0, Math.round(Number(currentBattleShipStats?.shieldCapacity || 0) || 0));
    playerShield = playerMaxShield;
    battleWeapon.damage = currentBattleShipStats.weaponDamage;
    battleWeapon.clipSize = currentBattleShipStats.clipSize;
    battleWeapon.ammoInClip = battleWeapon.clipSize;
    battleWeapon.reloadTime = currentBattleShipStats.reloadTime;
    battleWeapon.isReloading = false;
    battleWeapon.reloadEndsAt = 0;

    scene.add(playerShip);
    attachPlayerShieldFieldV460();
    setTimeout(() => { try{ attachPlayerShieldFieldV460(); }catch(_){} }, 450);

    // V457: не ждём плавного lerp из animate().
    // Сразу ставим камеру за корабль, иначе после входа на карту можно увидеть только чёрный экран и прицел.
    forceBattleCameraBehindPlayerV457('spawnPlayer');

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
        requestAnimationFrame(() => { try{ ensureHangarRenderer?.(); }catch(_){} });
        profileWindow?.classList.add("hidden");
        bindHangarChatControls();
        setHangarChatMode(true, false);
        __mountHangarChatPanel();
        __updateHangarPmNeon?.();
        setTimeout(() => { __mountHangarChatPanel(); setHangarChatMode(true, false); __updateHangarPmNeon?.(); }, 0);
        setTimeout(() => { __mountHangarChatPanel(); setHangarChatMode(true, false); __updateHangarPmNeon?.(); }, 120);
    });
}

if (profileTab && profileWindow) {
    profileTab.addEventListener("click", () => {
        profileWindow.classList.remove("hidden");
        hangarWindow?.classList.add("hidden");
        __restoreHangarChatPanel();
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
            markCosmicBattleEnterAllowedV444?.();
            selectedLobbyMap = getSelectedLobbyMapFromUI();
            currentRoom = { id: `local_${selectedLobbyMap.real}_${Date.now()}`, map: selectedLobbyMap.real, state: 'battle', players: [], currentPlayers: [] };
            window.currentRoomId = currentRoom.id || null;
            switchState('BATTLE');
        });
    }
});



// ===== V444 SAFE BATTLE ENTER GUARD =====
// Защита от самопроизвольного перекидывания из лобби на карту.
// В BATTLE можно перейти только сразу после реального нажатия игрока на вход/создание боя.
let cosmicBattleEnterAllowedUntilV444 = 0;

function markCosmicBattleEnterAllowedV444(){
    cosmicBattleEnterAllowedUntilV444 = Date.now() + 30000;
}

function isCosmicBattleEnterAllowedV444(){
    return Date.now() <= Number(cosmicBattleEnterAllowedUntilV444 || 0);
}

document.addEventListener('click', (event) => {
    try{
        const target = event.target;
        if(!target?.closest) return;
        const battleButton = target.closest(
            '#join-match-btn, #confirm-create-room, #confirm-tournament-create, #join-map-btn, .join-btn, [data-battle-enter], [data-action="battle-enter"]'
        );
        if(battleButton) markCosmicBattleEnterAllowedV444();
    }catch(_){}
}, true);

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

async function forceLeaveBattleToLobby(){
    if(gameState !== "BATTLE" && gameState !== "OBSERVE") return;

    const roomSnapshot = currentRoom ? { ...currentRoom } : null;

    battleLeavingInProgress = true;
    try{ stopLiveBattleSync(); }catch(_){ }

    try{ if(document.pointerLockElement) document.exitPointerLock(); }catch(_){ }
    try{ closeBattlePauseMenu(); }catch(_){ }
    try{ hardResetBattleClientState(); }catch(_){ }
    try{ resetBattleSessionCounters(); }catch(_){ }

    gameState = 'LOBBY';
    try{ window.gameState = 'LOBBY'; document.body.classList.add('cosmic-in-lobby'); document.body.classList.remove('cosmic-in-battle','cosmic-in-auth'); }catch(_){ }

    const canvas = document.querySelector('canvas');
    const lobby = document.getElementById('lobby-screen');
    const orbitExit = document.getElementById('orbit-exit');
    const topNav = document.getElementById('top-nav');
    const battleScreen = document.getElementById('battle-screen');
    const resourceBar = document.getElementById('resource-bar');
    const ui = document.getElementById('ui');
    const premiumBar = document.getElementById('premium-bar');
    const authScreen = document.getElementById('auth-screen');
    const settingsWindow = document.getElementById('settings-window');
    const pauseMenu = document.getElementById('battle-pause-menu');

    if(canvas) canvas.style.setProperty('display', 'none', 'important');
    if(authScreen) authScreen.style.setProperty('display', 'none', 'important');
    if(orbitExit) orbitExit.style.setProperty('display', 'none', 'important');
    if(battleScreen) battleScreen.style.setProperty('display', 'none', 'important');
    if(resourceBar) resourceBar.style.setProperty('display', 'none', 'important');
    if(ui) ui.style.setProperty('display', 'none', 'important');
    if(settingsWindow) settingsWindow.classList.add('hidden');
    if(pauseMenu) pauseMenu.classList.add('hidden');

    try{ setHangarChatMode(false, false); }catch(_){ }
    try{ __restoreHangarChatPanel(); }catch(_){ }
    try{ clearBattleScene(); }catch(_){ }
    try{ stopBattleHudLoops(); }catch(_){ }
    try{ updateNicknameSettingsState?.(); }catch(_){ }

    if(lobby) lobby.style.setProperty('display', 'flex', 'important');
    if(topNav) topNav.style.setProperty('display', 'flex', 'important');
    updatePremiumAccountInfo?.();
    if(premiumBar) premiumBar.style.setProperty('display', 'flex', 'important');

    currentRoom = null;
    try{ window.currentRoomId = null; }catch(_){ }
    selectedLobbyMap = null;

    try{ renderRoomsInLobby?.(); }catch(_){ }

    Promise.resolve()
        .then(() => cleanupCurrentBattleRoom(roomSnapshot))
        .catch(() => {})
        .finally(() => {
            try{ hardResetBattleClientState(); }catch(_){ }
        });
}


try{ window.forceLeaveBattleToLobby = forceLeaveBattleToLobby; }catch(_){ }

function initBattleUI(){
    const battleExitBtn = document.getElementById('battle-exit-btn');
    const battleLeaveBtn = document.getElementById('battle-leave-map-btn');
    const battleSaveBtn = document.getElementById('battle-save-settings-btn');
    const battleOpenSettingsBtn = document.getElementById('battle-open-settings-btn');
    const scoreboard = document.getElementById('battle-scoreboard');

    const leaveMap = async () => {
        forceLeaveBattleToLobby();
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



// ===== V428 PROFILE SKIN + PUBLIC MODULE UPGRADES =====
function escapeProfileHtmlV428(value){
    try{ return escapeChatHtml(String(value ?? '')); }catch(_){
        return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    }
}

function getProfileSkinKeyV428(source = {}){
    const raw = source?.skin || source?.selectedSkin || source?.selected_skin || source?.characterSkin || source?.character_skin || source?.avatarSkin || source?.avatar_skin || '';
    return String(raw || 'astronaut_blue').trim() || 'astronaut_blue';
}

function getProfileSkinMetaV428(source = {}){
    const key = getProfileSkinKeyV428(source);
    const nice = key.replace(/^astronaut[_-]?/i,'').replace(/[_-]+/g,' ').trim();
    return {
        key,
        title: nice ? `Скин: ${nice.charAt(0).toUpperCase()}${nice.slice(1)}` : 'Скин пилота',
        emoji: key.toLowerCase().includes('red') ? '🧑‍🚀' : (key.toLowerCase().includes('alien') ? '👽' : '🧑‍🚀')
    };
}

function getProfileModuleUpgradeLevelV428(moduleId = '', source = {}){
    const safeId = String(moduleId || '').trim();
    if(!safeId) return 0;
    const bags = [
        source?.moduleLevels,
        source?.module_levels,
        source?.moduleUpgrades,
        source?.module_upgrades,
        source?.moduleUpgradeLevels,
        source?.module_upgrade_levels,
        source?.upgradedModules,
        source?.upgraded_modules
    ];
    for(const bag of bags){
        if(!bag || typeof bag !== 'object') continue;
        const raw = bag[safeId];
        if(raw && typeof raw === 'object'){
            const n = Number(raw.level ?? raw.upgrades ?? raw.count ?? raw.value ?? 0);
            if(Number.isFinite(n) && n > 0) return Math.max(1, Math.min(10, Math.floor(n)));
        }else{
            const n = Number(raw);
            if(Number.isFinite(n) && n > 0) return Math.max(1, Math.min(10, Math.floor(n)));
        }
    }
    return 1;
}

function getProfileSelectedShipIdV428(source = {}){
    return String(source?.selectedShipId || source?.selected_ship_id || player?.selectedShipId || 'scout_1').trim() || 'scout_1';
}

function getProfileEquippedModulesV428(source = {}){
    const selectedShipId = getProfileSelectedShipIdV428(source);
    const active = source?.activeModulesByShip && typeof source.activeModulesByShip === 'object'
        ? source.activeModulesByShip
        : (player?.activeModulesByShip && typeof player.activeModulesByShip === 'object' ? player.activeModulesByShip : {});
    const slots = active?.[selectedShipId] || active?.[String(selectedShipId)] || active?.scout_1 || {};
    const order = ['weapon','shield','booster'];
    const rows = [];
    order.forEach(typeId => {
        const moduleId = String(slots?.[typeId] || '').trim();
        const module = moduleId && typeof getModuleById === 'function' ? getModuleById(moduleId) : null;
        rows.push({
            typeId,
            moduleId,
            module,
            name: module?.name || (typeId === 'weapon' ? 'Оружие не выбрано' : typeId === 'shield' ? 'Щит не выбран' : 'Ускоритель не выбран'),
            badge: module?.badge || (typeId === 'weapon' ? 'Оружие' : typeId === 'shield' ? 'Защита' : 'Двигатель'),
            level: moduleId ? getProfileModuleUpgradeLevelV428(moduleId, source) : 0
        });
    });
    return rows;
}

function renderProfileModuleBarsV428(level = 0){
    const safeLevel = Math.max(0, Math.min(10, Math.floor(Number(level || 0) || 0)));
    let html = '<div class="profile-module-bars" title="Прокачки модуля">';
    for(let i = 1; i <= 10; i++){
        html += `<span class="profile-module-bar ${i <= safeLevel ? 'filled' : ''}"></span>`;
    }
    html += '</div>';
    return html;
}

function getProfileExperienceMaxV429(level = 1){
    const safeLevel = Math.max(1, Math.floor(Number(level || 1) || 1));
    return Math.max(100, safeLevel * 600);
}

function renderProfileSkinStatsV429({ rating = 0, exp = 0, expMax = 50, level = 1, credits = 0, crystals = 0 } = {}){
    const safeRating = Math.max(0, Math.floor(Number(rating || 0) || 0));
    const safeExp = Math.max(0, Math.floor(Number(exp || 0) || 0));
    const safeExpMax = Math.max(1, Math.floor(Number(expMax || 1) || 1));
    const safeLevel = Math.max(1, Math.floor(Number(level || 1) || 1));
    const safeCredits = Math.max(0, Math.floor(Number(credits || 0) || 0));
    const safeCrystals = Math.max(0, Math.floor(Number(crystals || 0) || 0));
    return `
      <div class="profile-skin-stats">
        <div class="profile-rating-bar" title="Рейтинг для будущих таблиц лидеров">
          <span>${safeRating}</span>
        </div>
        <div class="profile-mini-stats-grid">
          <div class="profile-mini-row exp-row"><span class="profile-mini-label exp">EXP</span><b>${safeExp} / ${safeExpMax}</b></div>
          <div class="profile-mini-row profile-level-row-v450"><span id="profile-level-ship-icon" class="profile-mini-icon profile-level-ship-slot-v450" data-cosmic-level-ship>${cosmicLevelShipIconHtml(safeLevel)}</span><b>${safeLevel}</b></div>
          <div class="profile-mini-row"><span class="profile-mini-icon coin-icon" title="Монеты"></span><b>${safeCredits}</b></div>
          <div class="profile-mini-row"><span class="profile-mini-icon">💎</span><b>${safeCrystals}</b></div>
        </div>
      </div>
    `;
}

function getProfileStatNumberV430(...values){
    for(const value of values){
        const n = Number(value);
        if(Number.isFinite(n) && n >= 0) return Math.floor(n);
    }
    return 0;
}

function renderProfileBattleStatsV430({ totalKills = 0, teamPoints = 0, flagsCaptured = 0, tournamentWins = 0, totalDeaths = 0 } = {}){
    const rows = [
        ['🟡', 'Всего убийств', totalKills],
        ['🟡', 'Командные очки', teamPoints],
        ['🟡', 'Флагов захвачено', flagsCaptured],
        ['🟠', 'Турниры (победы)', tournamentWins],
        ['🔴', 'Всего смертей', totalDeaths]
    ];
    return `
      <div class="profile-battle-stat-grid">
        ${rows.map(([icon, label, value]) => `
          <div class="profile-battle-stat-card">
            <div class="profile-battle-stat-label"><span>${icon}</span>${escapeProfileHtmlV428(label)}</div>
            <div class="profile-battle-stat-value">${getProfileStatNumberV430(value)}</div>
          </div>
        `).join('')}
      </div>
    `;
}

function renderProfilePanelV428({ profile = {}, save = null, isSelf = false, fallbackName = 'Player', canPm = false, canHangar = false } = {}){
    if(isSelf){ try{ syncProfileBattleStatsFromSaveV438(loadProfileBattleStatsLocalV439?.() || {}); }catch(_){} }
    const source = save && typeof save === 'object' ? save : {};
    const skin = getProfileSkinMetaV428(source);
    const displayName = profile?.nickname || source?.nickname || fallbackName || player?.nickname || 'Player';
    const profileRole = normalizeStaffRole?.(profile?.staff_role || (isSelf ? player?.staff_role : 'player')) || 'player';
    const roleMeta = getStaffRoleMeta?.(profileRole) || { short:'PLAYER' };
    const level = Number(profile?.level ?? source?.playerLevel ?? source?.level ?? player?.level ?? 1) || 1;
    const exp = Number(profile?.experience ?? source?.playerExperience ?? source?.experience ?? player?.experience ?? 0) || 0;
    const credits = Number(profile?.credits ?? source?.credits ?? player?.credits ?? playerResources?.coins ?? 0) || 0;
    const crystals = Number(profile?.crystals ?? source?.crystals ?? source?.playerResources?.crystals ?? playerResources?.crystals ?? 0) || 0;
    const rating = Number(profile?.rating ?? source?.rating ?? source?.leaderRating ?? source?.leader_rating ?? 0) || 0;
    const expMax = Number(profile?.experience_max ?? profile?.experienceMax ?? source?.experienceMax ?? source?.experience_max ?? getProfileExperienceMaxV429(level)) || getProfileExperienceMaxV429(level);
    const modules = getProfileEquippedModulesV428(source);
    const savedBattleStatsV438 = readProfileBattleStatsFromSourceV438(source || {});
    const localTotalsV438 = isSelf ? getProfileBattleTotalsForSaveV438() : savedBattleStatsV438;
    const localKills = Math.max(Number(localTotalsV438?.totalKills || 0), isSelf ? Number(battleStats?.playerKills || 0) : 0);
    const localDeaths = Math.max(Number(localTotalsV438?.totalDeaths || 0), isSelf ? Number(battleStats?.playerDeaths || 0) : 0);
    const totalKills = getProfileStatNumberV430(
        profile?.total_kills, profile?.totalKills, profile?.kills_total,
        source?.totalKills, source?.total_kills, source?.killsTotal,
        source?.battleStats?.totalKills, source?.battleStats?.playerKills,
        source?.playerKills, source?.kills, localKills
    );
    const teamPoints = getProfileStatNumberV430(
        profile?.team_points, profile?.teamPoints, profile?.team_score, profile?.teamScore,
        source?.teamPoints, source?.team_points, source?.teamScore, source?.team_score,
        source?.battleStats?.teamPoints, source?.battleStats?.teamScore, savedBattleStatsV438.teamPoints
    );
    const flagsCaptured = getProfileStatNumberV430(
        profile?.flags_captured, profile?.flagsCaptured, profile?.captured_flags, profile?.capturedFlags,
        source?.flagsCaptured, source?.flags_captured, source?.capturedFlags, source?.captured_flags,
        source?.battleStats?.flagsCaptured, savedBattleStatsV438.flagsCaptured
    );
    const tournamentWins = getProfileStatNumberV430(
        profile?.tournament_wins, profile?.tournamentWins, profile?.tournaments_won, profile?.tournamentsWon,
        source?.tournamentWins, source?.tournament_wins, source?.tournamentsWon, source?.tournaments_won,
        source?.battleStats?.tournamentWins, savedBattleStatsV438.tournamentWins
    );
    const totalDeaths = getProfileStatNumberV430(
        profile?.total_deaths, profile?.totalDeaths, profile?.deaths_total,
        source?.totalDeaths, source?.total_deaths, source?.deathsTotal,
        source?.battleStats?.totalDeaths, source?.battleStats?.playerDeaths,
        source?.playerDeaths, source?.deaths, localDeaths
    );

    return `
      <div class="profile-v428-shell">
        <div class="profile-v428-header">
          <h2 class="profile-title">Пилот ${escapeProfileHtmlV428(displayName)}</h2>
          <div class="profile-v428-id">ID: ${escapeProfileHtmlV428(profile?.public_id || (isSelf ? authState?.playerId : '') || '—')} • ${escapeProfileHtmlV428(roleMeta.short || 'PLAYER')}</div>
        </div>
        <div class="profile-v428-main">
          <aside class="profile-skin-card">
            <div class="profile-skin-top">
              <div class="profile-skin-frame">
                <div class="profile-skin-figure">${skin.emoji}</div>
                <div class="profile-skin-glow"></div>
              </div>
              <div class="profile-skin-name">${escapeProfileHtmlV428(skin.title)}</div>
              <div class="profile-skin-note">Место под выбранный скин персонажа</div>
            </div>
            ${renderProfileSkinStatsV429({ rating, exp, expMax, level, credits, crystals })}
          </aside>
          <section class="profile-v428-right">
            ${renderProfileBattleStatsV430({ totalKills, teamPoints, flagsCaptured, tournamentWins, totalDeaths })}
            <div class="profile-v440-lower-grid">
              ${renderProfileSkillsPanelV440(isSelf)}
              <div class="profile-module-panel profile-module-panel-v440">
                <div class="profile-section-title">Установленные модули</div>
                <div class="profile-module-list">
                  ${modules.map(row => `
                    <div class="profile-module-row">
                      <div class="profile-module-info">
                        <div class="profile-module-name">${escapeProfileHtmlV428(row.name)}</div>
                        <div class="profile-module-sub">${escapeProfileHtmlV428(row.badge)} • прокачек: ${row.level}</div>
                      </div>
                      ${renderProfileModuleBarsV428(row.level)}
                    </div>
                  `).join('')}
                </div>
                ${renderProfileSelectedShipPreviewV443()}
              </div>
            </div>
          </section>
        </div>
        ${(canPm || canHangar) ? `<div class="profile-v428-actions">
          ${canPm ? '<button id="profile-pm-btn" type="button" class="profile-action-btn">✉️ Написать в ЛС</button>' : ''}
          ${canHangar ? '<button id="profile-view-hangar-btn" type="button" class="profile-action-btn green">🚀 Посмотреть ангар</button>' : ''}
        </div>` : ''}
      </div>
    `;
}

function renderProfileStats(){
    const renderProfileStatsV448PreviewRefresh = true;
    try{ restoreSelectedShipFromLocalV447?.(); }catch(_){}
    try{ restoreSelectedShipFromLocalV447?.(); }catch(_){}
    const profileInfo = document.getElementById('profile-info');
    if(!profileInfo) return;
    const selfSave = (typeof buildSavePayload === 'function') ? buildSavePayload() : {
        selectedShipId: player?.selectedShipId || 'scout_1',
        ownedShipIds: player?.ownedShipIds || ['scout_1'],
        ownedModuleIds: player?.ownedModuleIds || [],
        activeModulesByShip: player?.activeModulesByShip || {}
    };
    profileInfo.innerHTML = renderProfilePanelV428({
        profile: {
            public_id: authState?.playerId || player?.id || '',
            nickname: player?.nickname || 'Commander',
            level: player?.level || currentLevel || 1,
            experience: player?.experience || 0,
            credits: playerResources?.coins || player?.credits || 0,
            crystals: playerResources?.crystals || player?.crystals || 0,
            staff_role: player?.staff_role || 'player',
            mercury_ore: playerResources?.mercury_ore || 0,
            venus_gas: playerResources?.venus_gas || 0,
            earth_water: playerResources?.earth_water || 0,
            mars_crystal: playerResources?.mars_crystal || 0,
            jupiter_hydrogen: playerResources?.jupiter_hydrogen || 0,
            saturn_ice: playerResources?.saturn_ice || 0,
            uranus_ammonia: playerResources?.uranus_ammonia || 0,
            neptune_methane: playerResources?.neptune_methane || 0,
            solar_energy: playerResources?.solar_energy || 0,
            experience_max: getProfileExperienceMaxV429(player?.level || currentLevel || 1)
        },
        save: selfSave,
        isSelf: true,
        fallbackName: player?.nickname || 'Commander',
        canPm: false,
        canHangar: false
    });
    setTimeout(() => { try{ initProfileSelectedShip3DPreviewV445?.(); }catch(_){} }, 0);
}


var hangarState = {
    shipIndex: 0,
    moduleIndex: 0,
    shipFilter: 'all',
    moduleFilter: 'weapon',
    renderer: null,
    scene: null,
    camera: null,
    platform: null,
    platformRing: null,
    platformGlowDisc: null,
    platformBeams: [],
    shipPivot: null,
    modulePivot: null,
    forcedSceneShip: null,
    showcaseGroup: null,
    modulePads: {},
    supportPlatforms: [],
    infoBoards: [],
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
    moveBound: false,
    isShipLoading: false,
    roomLookTarget: 0,
    roomLookCurrent: 0,
    roomTiltTarget: 0,
    roomTiltCurrent: 0,
    envGroup: null,
    envAnimatedMaterials: [],
    envLightBars: [],
    envGlowPanels: [],
    astronaut: null,
    astronautPivot: null,
    astronautKeys: { w:false, a:false, s:false, d:false, shift:false, space:false },
    astronautVelocity: new THREE.Vector3(),
    astronautDirection: new THREE.Vector3(),
    astronautTargetYaw: 0,
    astronautGroundY: -1.72,
    astronautBob: 0,
    cameraFocus: new THREE.Vector3(0.0, -1.1, -1.8),
    cameraPosition: new THREE.Vector3(0.0, 1.2, 16.6),
    planets: [],
    cameraYaw: Math.PI,
    cameraPitch: -0.12,
    cameraYawTarget: Math.PI,
    cameraPitchTarget: -0.12,
    cameraDistance: 10.8,
    pointerActive: false,
    mouseLookActive: false,
    lastMouseX: 0,
    lastMouseY: 0,
    hoverDockIndex: -1,
    selectedDockIndex: -1,
    shipAppearStartedAt: 0,
    supportShipMeshes: [],
    shipTransfer: null,
    sellTerminalGroup: null
};

const STARTER_HULL_IDS = ['scout_1'];
const STARTER_MODULE_IDS = ['weapon_laser_s1','shield_micro_s1','booster_ion_s1'];

function getHangarModuleTypeName(typeId){
    const safe = String(typeId || '').trim().toLowerCase();
    if(safe === 'weapon') return 'Пушки';
    if(safe === 'shield') return 'Щиты';
    if(safe === 'booster') return 'Ускорители';
    return 'Модули';
}

function isStarterHullId(hullId){
    return STARTER_HULL_IDS.includes(String(hullId || '').trim());
}

function isStarterModuleId(moduleId){
    return STARTER_MODULE_IDS.includes(String(moduleId || '').trim());
}

function getHullSellPrice(hullId){
    const ship = getShopShipById(hullId);
    return Math.max(0, Math.floor((Number(ship?.price || 0) || 0) * 0.5));
}

function getModuleSellPrice(moduleId){
    const mod = getModuleById(moduleId);
    return Math.max(0, Math.floor((Number(mod?.price || 0) || 0) * 0.5));
}


function isOwnedShip(itemOrId){
    try{ ensureShopOwnershipDefaults?.(); }catch(_){ }
    const shipId = typeof itemOrId === 'string'
        ? String(itemOrId || '').trim()
        : String(itemOrId?.id || '').trim();
    return !!shipId && Array.isArray(player?.ownedShipIds) && player.ownedShipIds.includes(shipId);
}

function isHangarWindowOpen(){
    const win = document.getElementById('hangar-window');
    return !!(win && !win.classList.contains('hidden'));
}

function renderHangarIfOpen(forceSyncToSelected = true){
    if(!isHangarWindowOpen()) return;
    renderHangarCosmic?.(forceSyncToSelected);
}

function ensurePremiumCurrencyUi(){
    if(typeof document === 'undefined') return;
    if(!document.getElementById('premium-currency-ui-style')){
        const style = document.createElement('style');
        style.id = 'premium-currency-ui-style';
        style.textContent = `
          #premium-account-info .premium-item.currency-item{ position:relative; padding-right:18px; }
          .premium-plus-btn{
            margin-left:6px; width:18px; height:18px; border:none; border-radius:3px; cursor:pointer;
            display:inline-flex; align-items:center; justify-content:center; font-weight:900; font-size:16px; line-height:1;
            color:#fff; background:linear-gradient(180deg,#2d2d2d,#0d0d0d); box-shadow:0 0 8px rgba(0,0,0,0.35);
          }
          .premium-plus-btn:hover{ transform:translateY(-1px); box-shadow:0 0 12px rgba(120,220,255,0.35); }
          .premium-currency-float{
            position:absolute; right:0; top:-18px; pointer-events:none; font-weight:800; font-size:14px; opacity:0;
            transform:translateY(0) scale(0.95); transition:opacity .18s ease, transform .9s ease;
            text-shadow:0 0 10px rgba(0,0,0,0.55);
          }
          .premium-currency-float.show{ opacity:1; transform:translateY(-6px) scale(1); }
          .premium-currency-float.fade{ opacity:0; transform:translateY(-22px) scale(1.04); }
          .premium-currency-float.minus{ color:#ff4d4d; }
          .premium-currency-float.plus{ color:#6dff8e; }
        `;
        document.head.appendChild(style);
    }

    const entries = [
        { id:'premium-coins', type:'coins', title:'Пополнить монеты' },
        { id:'premium-crystals', type:'crystals', title:'Пополнить алмазы' }
    ];
    entries.forEach(({id, type, title}) => {
        const host = document.getElementById(id);
        if(!host) return;
        host.classList.add('currency-item');
        if(!host.querySelector('.premium-plus-btn')){
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'premium-plus-btn';
            btn.dataset.currencyType = type;
            btn.title = title;
            btn.textContent = '+';
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                alert(type === 'crystals' ? 'Пополнение алмазов за деньги будет здесь.' : 'Пополнение монет за деньги будет здесь.');
            });
            host.appendChild(btn);
        }
    });
}

function showCurrencyDelta(kind, amount){
    const safeKind = String(kind || '').trim().toLowerCase();
    const targetId = safeKind === 'crystals' ? 'premium-crystals' : 'premium-coins';
    const host = document.getElementById(targetId);
    if(!host || !Number.isFinite(Number(amount)) || Number(amount) === 0) return;
    ensurePremiumCurrencyUi?.();
    const node = document.createElement('span');
    const numeric = Number(amount);
    node.className = `premium-currency-float ${numeric < 0 ? 'minus' : 'plus'}`;
    node.textContent = `${numeric < 0 ? '' : '+'}${Math.trunc(numeric)}`;
    host.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => node.classList.add('fade'), 900);
    setTimeout(() => node.remove(), 1800);
}

function canSellHull(hullId){
    const safeId = String(hullId || '').trim();
    if(!safeId) return false;
    if(!isOwnedShip(safeId)) return false;
    const ownedCount = Array.isArray(player?.ownedShipIds)
        ? player.ownedShipIds.map(id => String(id || '').trim()).filter(Boolean).length
        : 0;
    if(ownedCount <= 1) return false;
    const equippedShipId = String(player?.selectedShipId || '').trim();
    if(equippedShipId && equippedShipId === safeId) return false;
    return true;
}

function canSellModule(moduleId){
    return !!String(moduleId || '').trim() && !isStarterModuleId(moduleId) && isOwnedModule(moduleId);
}

function getSellActionLabel(kind, itemId){
    const price = kind === 'ship' ? getHullSellPrice(itemId) : getModuleSellPrice(itemId);
    return `Продать за ${price} 🟡`;
}

function getCurrentHangarModuleType(){
    return String(hangarState?.moduleFilter || 'weapon').trim() || 'weapon';
}

function getEquippedModuleTypesForShip(shipId){
    const safeShipId = String(shipId || player?.selectedShipId || '').trim();
    const raw = player?.activeModulesByShip?.[safeShipId];
    return raw && typeof raw === 'object' ? raw : {};
}

function sellHullFromHangar(hullId){
    if(isHangarGuestView?.()) return false;
    const safeId = String(hullId || '').trim();
    if(!canSellHull(safeId)) return false;

    const savedAstronautPosition = hangarState?.astronautPivot?.position?.clone?.() || null;
    const savedAstronautYaw = Number(hangarState?.astronautPivot?.rotation?.y || 0) || 0;
    const savedCameraYaw = Number(hangarState?.cameraYaw || 0) || 0;
    const savedCameraPitch = Number(hangarState?.cameraPitch || -0.08) || -0.08;
    const savedSelectedDockIndex = Number.isFinite(Number(hangarState?.selectedDockIndex)) ? Number(hangarState.selectedDockIndex) : -1;
    const savedHoverDockIndex = Number.isFinite(Number(hangarState?.hoverDockIndex)) ? Number(hangarState.hoverDockIndex) : -1;

    const sellPrice = getHullSellPrice(safeId);
    playerResources.coins = (Number(playerResources.coins || player.credits || 0) || 0) + sellPrice;
    player.credits = playerResources.coins;
    player.ownedShipIds = (player.ownedShipIds || []).filter(id => String(id || '').trim() !== safeId);
    if(player?.activeModulesByShip && player.activeModulesByShip[safeId]){
        delete player.activeModulesByShip[safeId];
    }
    if(player?.hangarDockAssignments && player.hangarDockAssignments[safeId] != null){
        delete player.hangarDockAssignments[safeId];
    }
    if(String(player?.selectedShipId || '').trim() === safeId){
        player.selectedShipId = String(player.ownedShipIds?.[0] || 'scout_1').trim() || 'scout_1'; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){}
    }
    refreshOwnedShipsInventory?.();
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
    showCurrencyDelta?.('coins', sellPrice);
    saveGame?.();
    syncHangarSelectionState?.({ forceClass:true });
    renderHangarCosmic?.(false);
    requestAnimationFrame(() => {
        try{
            if(savedAstronautPosition && hangarState?.astronautPivot){
                hangarState.astronautPivot.position.copy(savedAstronautPosition);
                hangarState.astronautPivot.rotation.y = savedAstronautYaw;
            }
            hangarState.cameraYaw = savedCameraYaw;
            hangarState.cameraPitch = savedCameraPitch;
            hangarState.cameraYawTarget = savedCameraYaw;
            hangarState.cameraPitchTarget = savedCameraPitch;
            hangarState.selectedDockIndex = savedSelectedDockIndex;
            hangarState.hoverDockIndex = savedHoverDockIndex;
            updateHangarPlatformPrompt?.();
        }catch(_){ }
    });
    window.renderShopScreen?.();
    return true;
}

function removeModuleFromAllShips(moduleId){
    const safeId = String(moduleId || '').trim();
    if(!safeId || !player?.activeModulesByShip || typeof player.activeModulesByShip !== 'object') return;
    Object.keys(player.activeModulesByShip).forEach(shipId => {
        const slots = player.activeModulesByShip[shipId];
        if(!slots || typeof slots !== 'object') return;
        Object.keys(slots).forEach(typeId => {
            if(String(slots[typeId] || '').trim() === safeId){
                delete slots[typeId];
            }
        });
    });
}

function sellModuleFromHangar(moduleId){
    if(isHangarGuestView?.()) return false;
    const safeId = String(moduleId || '').trim();
    if(!canSellModule(safeId)) return false;
    const sellPrice = getModuleSellPrice(safeId);
    removeModuleFromAllShips(safeId);
    playerResources.coins = (Number(playerResources.coins || player.credits || 0) || 0) + sellPrice;
    player.credits = playerResources.coins;
    player.ownedModuleIds = (player.ownedModuleIds || []).filter(id => String(id || '').trim() !== safeId);
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
    saveGame?.();
    renderHangarCosmic?.();
    window.renderShopScreen?.();
    return true;
}

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
        const starterModuleIds = [...STARTER_MODULE_IDS];
        if(!Array.isArray(player.ownedModuleIds)) player.ownedModuleIds = [];
        if(!player.ownedModuleIds.length){
            player.ownedModuleIds = [...starterModuleIds];
        }
        player.ownedModuleIds = Array.from(new Set(
            player.ownedModuleIds.map(id => String(id || '').trim()).filter(Boolean)
        ));
        starterModuleIds.forEach(id => {
            if(!player.ownedModuleIds.includes(id)) player.ownedModuleIds.unshift(id);
        });
        if(!player.activeModulesByShip || typeof player.activeModulesByShip !== 'object'){
            player.activeModulesByShip = {};
        }
        if(!player.activeModulesByShip['scout_1'] || typeof player.activeModulesByShip['scout_1'] !== 'object'){
            player.activeModulesByShip['scout_1'] = {};
        }
        if(!player.activeModulesByShip['scout_1'].weapon) player.activeModulesByShip['scout_1'].weapon = 'weapon_laser_s1';
        if(!player.activeModulesByShip['scout_1'].shield) player.activeModulesByShip['scout_1'].shield = 'shield_micro_s1';
        if(!player.activeModulesByShip['scout_1'].booster) player.activeModulesByShip['scout_1'].booster = 'booster_ion_s1';
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
    const filteredOwned = owned.filter(item => {
        const typeId = String(item?.classId || item?.typeId || '').trim();
        return !getCurrentHangarModuleType() || typeId === getCurrentHangarModuleType();
    });
    if(filteredOwned.length) return filteredOwned;
    return owned.length ? owned : modules.filter(item => String(item?.classId || item?.typeId || '').trim() === getCurrentHangarModuleType());
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
        maxSpeed: 2.4,
        forwardAcceleration: 0.09,
        backwardAcceleration: 0.045,
        strafeAcceleration: 0.028,
        damping: 0.98,
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
        turnYaw: 0.00135,
        turnPitch: 0.0011,
        rollLimit: 0.58,
        handlingLabel: 'Стандарт',
        moduleSummary: []
    };

    const speedFactor = THREE.MathUtils.clamp(stats.speed / 7.0, 0.72, 1.62);
    const armorFactor = THREE.MathUtils.clamp(stats.armor / 6.0, 0.72, 1.85);
    const damageFactor = THREE.MathUtils.clamp(stats.damage / 6.0, 0.72, 1.9);
    const energyFactor = THREE.MathUtils.clamp(stats.energy / 7.0, 0.72, 2.0);

    stats.maxSpeed = 1.65 + speedFactor * 0.28;
    stats.forwardAcceleration = 0.04 + speedFactor * 0.012;
    stats.backwardAcceleration = 0.022 + speedFactor * 0.006;
    stats.strafeAcceleration = 0.014 + speedFactor * 0.0045;
    stats.damping = 0.968 + Math.min(0.009, speedFactor * 0.0021);
    stats.hp = Math.round(78 + armorFactor * 21);
    stats.weaponDamage = Math.round(7 + damageFactor * 1.7);
    stats.clipSize = Math.round(32 + energyFactor * 4.2);
    stats.reloadTime = Math.max(900, Math.round(2100 - energyFactor * 140));
    stats.laserVelocity = 2.7 + energyFactor * 0.1;
    stats.laserScale = Number((0.9 + damageFactor * 0.08).toFixed(2));
    stats.energyCapacity = Math.max(60, Math.round(energyFactor * 18));

    const shipClass = String(ship?.classId || '').toLowerCase();
    if(shipClass === 'fighters'){
        stats.turnYaw = 0.0018;
        stats.turnPitch = 0.00145;
        stats.rollLimit = 0.72;
        stats.maxSpeed *= 1.06;
        stats.forwardAcceleration *= 1.08;
        stats.strafeAcceleration *= 1.1;
        stats.hp *= 0.92;
        stats.handlingLabel = 'Манёвренный';
    }else if(shipClass === 'tanks'){
        stats.turnYaw = 0.00095;
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
        if(typeId === 'booster' || typeId === 'engine'){
            stats.maxSpeed *= Number(module?.speedMult || 1.12);
            stats.forwardAcceleration *= Number(module?.accelMult || 1.12);
            stats.strafeAcceleration *= Number(module?.accelMult || 1.08);
            stats.turnYaw *= Number(module?.turnMult || 1.04);
            stats.turnPitch *= Number(module?.turnMult || 1.04);
            stats.moduleSummary.push('+ускоритель');
        }else if(typeId === 'shield' || typeId === 'defense'){
            stats.hp *= Number(module?.hpMult || 1.18);
            stats.damping += Number(module?.dampingBonus || 0.002);
            stats.moduleSummary.push('+щит');
        }else if(typeId === 'weapon'){
            const weaponKind = String(module?.weaponKind || '').trim().toLowerCase();
            if(weaponKind) stats.weaponType = weaponKind;
            stats.weaponDamage *= Number(module?.damageMult || 1.14);
            stats.fireCooldown *= Number(module?.cooldownMult || 0.92);
            stats.laserScale += Number(module?.projectileScaleBonus || 0.1);
            stats.moduleSummary.push(module?.name ? module.name : '+пушка');
        }
    });

    // ===== V460 STRONG PROFILE SKILL BONUSES =====
    // Здоровье 10/10 должно давать итог около 950 HP.
    // Урон должен расти заметно с каждого уровня.
    // Точность делает пули из хаотичных всё более ровными.
    try{
        const skillHealth = getProfileSkillLevelV459('health');
        const skillShield = getProfileSkillLevelV459('shield');
        const skillShieldRegen = getProfileSkillLevelV459('shieldRegen');
        const skillSpeed = getProfileSkillLevelV459('speed');
        const skillBoost = getProfileSkillLevelV459('boost');
        const skillEnergySave = getProfileSkillLevelV459('energySave');
        const skillManeuver = getProfileSkillLevelV459('maneuver');
        const skillDamage = getProfileSkillLevelV459('damage');
        const skillAccuracy = getProfileSkillLevelV459('accuracy');
        const skillReload = getProfileSkillLevelV459('reload');
        const skillCrit = getProfileSkillLevelV459('crit');
        const skillMining = getProfileSkillLevelV459('mining');

        stats.baseHpBeforeSkills = Math.round(stats.hp);
        if(skillHealth > 0){
            // 0/10 остаётся от корабля, 10/10 даёт примерно 950 HP.
            stats.hp = Math.max(stats.hp, 100 + skillHealth * 85);
        }

        // Щит — отдельная полоска/слой поверх HP. Он не смешивается с HP.
        stats.shieldCapacity = Math.round(skillShield * 95);
        stats.shieldRegenPerTick = Number((skillShieldRegen * 0.045).toFixed(4));
        stats.shieldRegenBonus = Number((skillShieldRegen * 0.08).toFixed(3));

        stats.maxSpeed *= (1 + skillSpeed * 0.04);
        stats.forwardAcceleration *= (1 + skillSpeed * 0.03);
        stats.backwardAcceleration *= (1 + skillSpeed * 0.02);
        stats.strafeAcceleration *= (1 + skillSpeed * 0.025);

        stats.boostDurationBonus = Number((skillBoost * 0.08).toFixed(3));
        stats.boostEfficiencyBonus = Number((skillEnergySave * 0.07).toFixed(3));

        stats.turnYaw *= (1 + skillManeuver * 0.04);
        stats.turnPitch *= (1 + skillManeuver * 0.04);
        stats.rollLimit *= (1 + skillManeuver * 0.025);

        // Урон: +6 чистого урона за уровень + 8% множитель за уровень.
        // Даже 1 прокачка должна быть видна в HUD.
        stats.weaponDamage = (stats.weaponDamage + skillDamage * 6) * (1 + skillDamage * 0.08);

        // Вводим базовую хаотичность. Точность постепенно её убирает.
        // 0 точности = заметный разброс, 10 точности = почти ровно.
        stats.accuracyLevel = skillAccuracy;
        stats.chaosSpread = Number(Math.max(0.004, 0.085 * (1 - skillAccuracy * 0.085)).toFixed(4));
        stats.spread = Math.max(Number(stats.spread || 0), stats.chaosSpread);

        stats.fireCooldown *= (1 - skillReload * 0.04);
        stats.reloadTime *= (1 - skillReload * 0.045);

        stats.critChance = Number((skillCrit * 0.022).toFixed(3));
        stats.critDamageMult = Number((1.5 + skillCrit * 0.05).toFixed(2));
        stats.miningBonus = Number((skillMining * 0.075).toFixed(3));

        if(skillHealth || skillShield || skillSpeed || skillManeuver || skillDamage || skillAccuracy || skillReload || skillCrit || skillMining){
            stats.moduleSummary.push('навыки пилота');
        }
    }catch(error){
        console.warn('profile skill stats warning:', error?.message || error);
    }

    stats.maxSpeed *= 0.76;
    stats.forwardAcceleration *= 0.72;
    stats.backwardAcceleration *= 0.72;
    stats.strafeAcceleration *= 0.7;
    stats.turnYaw *= 0.68;
    stats.turnPitch *= 0.68;

    stats.maxSpeed = Number(stats.maxSpeed.toFixed(2));
    stats.forwardAcceleration = Number(stats.forwardAcceleration.toFixed(3));
    stats.backwardAcceleration = Number(stats.backwardAcceleration.toFixed(3));
    stats.strafeAcceleration = Number(stats.strafeAcceleration.toFixed(3));
    stats.damping = Number(Math.min(0.994, stats.damping).toFixed(3));
    stats.hp = Math.max(80, Math.round(stats.hp));
    stats.shieldCapacity = Math.max(0, Math.round(Number(stats.shieldCapacity || 0) || 0));
    stats.weaponDamage = Math.max(8, Math.round(stats.weaponDamage));
    stats.clipSize = Math.max(8, Math.round(stats.clipSize));
    stats.reloadTime = Math.max(650, Math.round(stats.reloadTime));
    stats.laserVelocity = Number(Math.max(2.0, stats.laserVelocity + 0.85).toFixed(2));
    stats.laserScale = Number(Math.max(0.85, stats.laserScale).toFixed(2));
    stats.fireCooldown = Math.max(60, Math.round(stats.fireCooldown));
    stats.turnYaw = Number(stats.turnYaw.toFixed(4));
    stats.turnPitch = Number(stats.turnPitch.toFixed(4));
    stats.rollLimit = Number((stats.rollLimit * 0.82).toFixed(2));
    stats.projectileWidth = Number(stats.projectileWidth.toFixed(2));
    stats.projectileLength = Number(stats.projectileLength.toFixed(2));
    stats.projectileOffset = Number(stats.projectileOffset.toFixed(2));
    stats.spread = Number(Math.max(0, stats.spread).toFixed(4));

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


function getSelectedHangarShipIndex(){
    const ships = getOwnedHangarShips();
    const safeId = String(player?.selectedShipId || '').trim();
    return ships.findIndex(item => String(item?.id || '').trim() === safeId);
}

function getHangarSupportShips(){
    const selectedId = String(player?.selectedShipId || '').trim();
    ensureHangarDockAssignments();
    return getOwnedHangarShips()
        .filter(item => String(item?.id || '').trim() !== selectedId)
        .sort((a, b) => getHangarDockAssignment(a?.id) - getHangarDockAssignment(b?.id));
}

function syncHangarDockSelection(){
    if(!Number.isFinite(hangarState.hoverDockIndex)) hangarState.hoverDockIndex = -1;
    const supportCount = getHangarSupportShips().length;
    const selectedDockIndex = Number(hangarState.selectedDockIndex);
    if(!Number.isFinite(selectedDockIndex) || selectedDockIndex < 0 || selectedDockIndex >= supportCount){
        hangarState.selectedDockIndex = -1;
    }
}

function getHangarDockShipByIndex(dockIndex){
    const safeIndex = Number(dockIndex || 0);
    if(!Number.isFinite(safeIndex) || safeIndex < 0) return null;
    return getHangarSupportShips().find(item => getHangarDockAssignment(item?.id) === safeIndex) || null;
}


function getHangarDockPadByIndex(dockIndex){
    const pads = Array.isArray(hangarState?.supportPlatforms) ? hangarState.supportPlatforms : [];
    const safeIndex = Number(dockIndex || 0);
    return pads[safeIndex] || null;
}

function getHangarDockWorldPosition(dockIndex){
    const pad = getHangarDockPadByIndex(dockIndex);
    if(!pad){
        return new THREE.Vector3(0, 0.6, 0);
    }
    const worldPos = new THREE.Vector3();
    try{ pad.getWorldPosition(worldPos); }catch(_){ worldPos.set(0, 0.6, 0); }
    worldPos.y += 0.78;
    return worldPos;
}

function getHangarCenterWorldPosition(){
    const showcaseGroup = hangarState?.envGroup?.userData?.shipShowcaseGroup || hangarState?.showcaseGroup || null;
    if(showcaseGroup){
        const worldPos = new THREE.Vector3();
        try{ showcaseGroup.getWorldPosition(worldPos); }catch(_){ worldPos.set(0, 2.08, 40); }
        return worldPos;
    }
    return new THREE.Vector3(0, 2.08, 40);
}

function createHangarTransferMesh(ship){
    if(!ship) return null;
    try{
        const mesh = normalizeHangarShipMesh(createHangarShipMesh(ship));
        mesh.rotation.x = 0;
        mesh.rotation.y = Math.PI;
        mesh.rotation.z = 0;
        mesh.scale.setScalar(0.88);
        mesh.traverse?.((child) => {
            if(child?.material){
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat) => {
                    if(!mat) return;
                    if('transparent' in mat) mat.transparent = true;
                    if('opacity' in mat && typeof mat.opacity === 'number') mat.opacity = Math.min(1, Math.max(mat.opacity, 0.92));
                });
            }
        });
        return mesh;
    }catch(_){
        return null;
    }
}

function startHangarShipTransfer(previousShipId, nextShipId, clickedDockIndex = -1){
    if(isHangarGuestView?.()) return;
    const safePrev = String(previousShipId || '').trim();
    const safeNext = String(nextShipId || '').trim();
    if(!hangarState?.scene) return;
    if(!safeNext || safePrev === safeNext) return;

    const showcaseGroup = hangarState?.envGroup?.userData?.shipShowcaseGroup || hangarState?.showcaseGroup || null;
    const centerMesh = showcaseGroup?.children?.[0] || null;
    const supportMesh = (hangarState.supportShipMeshes || []).find(mesh => String(mesh?.userData?.shipId || '').trim() === safeNext) || null;
    if(!centerMesh || !supportMesh){
        player.selectedShipId = safeNext; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){}
        currentBattleShipStats = computeShipBattleStats(safeNext);
        updatePremiumAccountInfo?.();
        updateHUD?.();
        updateUI?.();
        saveGame?.();
        rebuildHangarSceneObjects?.();
        fillHangarText?.();
        return;
    }

    const cloneDisplayedMeshToScene = (sourceMesh) => {
        if(!sourceMesh || !hangarState?.scene) return null;
        const clone = cloneObject3DDeepSafe(sourceMesh);
        if(!clone) return null;
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3(1, 1, 1);
        try{
            sourceMesh.updateMatrixWorld(true);
            sourceMesh.getWorldPosition(worldPos);
            sourceMesh.getWorldQuaternion(worldQuat);
            sourceMesh.getWorldScale(worldScale);
        }catch(_){ }
        hangarState.scene.add(clone);
        clone.position.copy(worldPos);
        clone.quaternion.copy(worldQuat);
        clone.scale.copy(worldScale);
        clone.userData = { ...(clone.userData || {}), isActiveHangarTransferMesh:true };
        return clone;
    };

    const incomingMesh = cloneDisplayedMeshToScene(supportMesh);
    const outgoingMesh = cloneDisplayedMeshToScene(centerMesh);
    if(!incomingMesh || !outgoingMesh) return;

    try{ supportMesh.visible = false; supportMesh.userData.hiddenForTransfer = true; }catch(_){ }
    try{ centerMesh.visible = false; centerMesh.userData.hiddenForTransfer = true; }catch(_){ }

    const previousDockIndex = getHangarDockAssignment(safePrev);
    const nextDockIndex = getHangarDockAssignment(safeNext);

    const transfer = {
        startedAt: performance.now(),
        duration: 7600,
        incoming: null,
        outgoing: null,
        clickedDockIndex: Number(clickedDockIndex || -1),
        previousShipId: safePrev,
        nextShipId: safeNext,
        previousDockIndex,
        nextDockIndex,
        hiddenOriginalIncoming: supportMesh,
        hiddenOriginalOutgoing: centerMesh
    };

    const centerPos = getHangarCenterWorldPosition();
    const outgoingDockPos = Number.isFinite(previousDockIndex) && previousDockIndex >= 0
        ? getHangarDockWorldPosition(previousDockIndex)
        : centerPos.clone().add(new THREE.Vector3(0, 0, -4.2));
    const incomingDockPos = Number.isFinite(nextDockIndex) && nextDockIndex >= 0
        ? getHangarDockWorldPosition(nextDockIndex)
        : centerPos.clone().add(new THREE.Vector3(0, 0, -4.2));

    const incomingFrom = new THREE.Vector3();
    const outgoingFrom = new THREE.Vector3();
    try{ incomingMesh.getWorldPosition(incomingFrom); }catch(_){ incomingFrom.copy(incomingDockPos); }
    try{ outgoingMesh.getWorldPosition(outgoingFrom); }catch(_){ outgoingFrom.copy(centerPos); }

    const getFlightForwardAxis = (shipId) => {
        const safeShipId = String(shipId || '').trim();
        if(safeShipId === 'scout_1') return new THREE.Vector3(0, 0, -1);
        if(safeShipId === 'xwing_1') return new THREE.Vector3(1, 0, 0);
        return new THREE.Vector3(0, 0, -1);
    };

    transfer.incoming = {
        mesh: incomingMesh,
        from: incomingFrom.clone(),
        to: centerPos.clone(),
        fromScale: Number(incomingMesh.scale.x || 1),
        toScale: 1.22,
        lift: 2.6,
        arcOffset: -0.72,
        forwardAxis: getFlightForwardAxis(safeNext)
    };
    transfer.outgoing = {
        mesh: outgoingMesh,
        from: outgoingFrom.clone(),
        to: outgoingDockPos.clone(),
        fromScale: Number(outgoingMesh.scale.x || 1),
        toScale: 0.84,
        lift: 2.1,
        arcOffset: 0.72,
        forwardAxis: getFlightForwardAxis(safePrev)
    };

    hangarState.shipTransfer = transfer;
}

function selectCurrentHangarShip(){
    if(isHangarGuestView?.()) return false;
    if(hangarState.shipTransfer) return false;
    const ships = getOwnedHangarShips();
    const currentShip = ships[hangarState.shipIndex] || null;
    if(!currentShip) return false;
    const previousShipId = String(player?.selectedShipId || '').trim();
    const previousIndex = getSelectedHangarShipIndex();
    const nextShipId = String(currentShip.id || '').trim() || previousShipId;
    if(nextShipId === previousShipId){
        syncHangarDockSelection();
        fillHangarText();
        rebuildHangarSceneObjects();
        return true;
    }
    syncHangarDockSelection();
    setHangarTransition?.(hangarState.shipIndex >= previousIndex ? 1 : -1);
    hangarState.shipAppearStartedAt = performance.now();
    startHangarShipTransfer(previousShipId, nextShipId, hangarState.selectedDockIndex);
    fillHangarText();
    return true;
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
    const moduleButtons = document.querySelectorAll('.hangar-module-chip[data-hangar-module-type]');
    moduleButtons.forEach(btn => {
        const typeId = String(btn.dataset.hangarModuleType || 'weapon').trim();
        btn.classList.toggle('active', typeId === getCurrentHangarModuleType());
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

function createHangarBeamTexture(){
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if(!ctx) return new THREE.CanvasTexture(canvas);

    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    gradient.addColorStop(0.10, 'rgba(255,255,255,0.14)');
    gradient.addColorStop(0.36, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(0.68, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sideFade = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.72, 10, canvas.width * 0.5, canvas.height * 0.6, canvas.width * 0.5);
    sideFade.addColorStop(0.00, 'rgba(255,255,255,0.95)');
    sideFade.addColorStop(0.24, 'rgba(255,255,255,0.60)');
    sideFade.addColorStop(0.54, 'rgba(255,255,255,0.16)');
    sideFade.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = sideFade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const baseGlow = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.86, 2, canvas.width * 0.5, canvas.height * 0.86, canvas.width * 0.42);
    baseGlow.addColorStop(0.00, 'rgba(255,255,255,0.95)');
    baseGlow.addColorStop(0.42, 'rgba(255,255,255,0.32)');
    baseGlow.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = baseGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function createHangarPlatform(){
    const group = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(6.4, 7.2, 0.96, 40, 1),
        new THREE.MeshStandardMaterial({ color:0x213b62, metalness:0.72, roughness:0.38 })
    );
    group.add(base);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(5.18, 0.19, 20, 56),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x78d9ff, transparent:true, opacity:0.92 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.42;
    group.add(ring);

    const glowDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(4.78, 4.78, 0.08, 36),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x55bfff, transparent:true, opacity:0.18 })
    );
    glowDisc.position.y = 0.5;
    group.add(glowDisc);

    const beamTexture = createHangarBeamTexture();
    const beamGroup = new THREE.Group();
    const beamConfigs = [
        { x: 0.0, z: 0.15, sx: 3.6, sy: 8.4, opacity: 0.40 },
        { x: -0.56, z: 0.35, sx: 2.3, sy: 6.6, opacity: 0.24 },
        { x: 0.56, z: 0.35, sx: 2.3, sy: 6.6, opacity: 0.24 }
    ];

    const beams = beamConfigs.map((cfg, idx) => {
        const material = new THREE.SpriteMaterial({
            map: beamTexture,
            color: idx === 0 ? 0x7feaff : 0x8ad7ff,
            transparent: true,
            opacity: cfg.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const beam = new THREE.Sprite(material);
        beam.center.set(0.5, 0.0);
        beam.position.set(cfg.x, 0.56, cfg.z);
        beam.scale.set(cfg.sx, cfg.sy, 1);
        beam.renderOrder = 20;
        beamGroup.add(beam);
        return beam;
    });

    const baseHalo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: beamTexture,
        color: 0x7feaff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }));
    baseHalo.center.set(0.5, 0.5);
    baseHalo.position.set(0, 0.58, 0.2);
    baseHalo.scale.set(6.8, 2.2, 1);
    baseHalo.renderOrder = 19;
    beamGroup.add(baseHalo);

    group.add(beamGroup);

    group.userData.ring = ring;
    group.userData.glowDisc = glowDisc;
    group.userData.beams = beams;
    group.userData.baseHalo = baseHalo;
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
    const glowMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:new THREE.Color(neon) });
    const engineMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:new THREE.Color(engine) });

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

        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 18, 54), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:new THREE.Color(accent) }));
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

    try{
        const equipped = getEquippedModuleTypesForShip(item?.id || '');
        const equippedWeapon = getModuleById(equipped.weapon || '');
        const equippedShield = getModuleById(equipped.shield || '');
        const equippedBooster = getModuleById(equipped.booster || '');

        if(equippedWeapon){
            const weaponColor = new THREE.Color(equippedWeapon?.accent || neon);
            const weaponGlow = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: weaponColor });
            const weaponBody = new THREE.MeshStandardMaterial({ color: weaponColor.clone().multiplyScalar(0.75), metalness:0.72, roughness:0.28 });
            const barrelLength = String(equippedWeapon?.weaponKind || '').trim() === 'beam' ? 2.0 : (String(equippedWeapon?.weaponKind || '').trim() === 'plasma' ? 1.5 : 1.25);
            const mountY = 0.04;
            const mountZ = -2.0;
            [-0.7, 0.7].forEach((x) => {
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, barrelLength, 10), weaponBody);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.set(x, mountY, mountZ);
                const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), weaponGlow);
                tip.position.set(x, mountY, mountZ - barrelLength * 0.55);
                group.add(barrel, tip);
            });
            if(String(equippedWeapon?.weaponKind || '').trim() === 'missile'){
                [-0.95, 0.95].forEach((x) => {
                    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.9), weaponBody);
                    pod.position.set(x, -0.15, -0.8);
                    group.add(pod);
                });
            }
        }

        if(equippedShield){
            const shieldColor = new THREE.Color(equippedShield?.neon || '#66e8ff');
            const shieldMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: shieldColor, transparent:true, opacity:0.34 });
            const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.05, 14, 52), shieldMat);
            shieldRing.rotation.x = Math.PI / 2;
            shieldRing.position.y = 0.15;
            const shieldArc = new THREE.Mesh(new THREE.SphereGeometry(1.78, 18, 18), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:shieldColor, transparent:true, opacity:0.08, wireframe:true }));
            shieldArc.scale.set(1.35, 0.62, 2.1);
            shieldArc.position.y = 0.1;
            group.add(shieldRing, shieldArc);
        }

        if(equippedBooster){
            const boosterColor = new THREE.Color(equippedBooster?.neon || engine);
            const boosterMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: boosterColor });
            [-1.05, 1.05].forEach((x) => {
                const boosterPod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.95, 10), new THREE.MeshStandardMaterial({ color: boosterColor.clone().multiplyScalar(0.75), metalness:0.65, roughness:0.3 }));
                boosterPod.rotation.x = Math.PI / 2;
                boosterPod.position.set(x, -0.08, 2.65);
                const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.15, 0.72, 10), boosterMat);
                flame.rotation.x = Math.PI / 2;
                flame.position.set(x, -0.08, 3.25);
                group.add(boosterPod, flame);
            });
        }
    }catch(_){}

    group.scale.setScalar(1.28);
    return group;
}


function createHangarAstronautFallback(){
    const group = new THREE.Group();
    const suitMat = new THREE.MeshStandardMaterial({ color:0xe7edf6, metalness:0.35, roughness:0.56 });
    const trimMat = new THREE.MeshStandardMaterial({ color:0x2c4e86, metalness:0.58, roughness:0.34 });
    const visorMat = new THREE.MeshStandardMaterial({ color:0x7bd8ff, emissive:0x2cb8ff, emissiveIntensity:0.45, metalness:0.85, roughness:0.12, transparent:true, opacity:0.92 });
    const glowMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x6ee7ff });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.0, 0.42), suitMat);
    torso.position.y = 1.6;
    group.add(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.08), trimMat);
    chest.position.set(0, 1.62, 0.25);
    group.add(chest);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), suitMat);
    helmet.position.y = 2.36;
    group.add(helmet);

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 16, 0, Math.PI), visorMat);
    visor.position.set(0, 2.34, 0.18);
    visor.scale.set(1, 0.82, 0.55);
    group.add(visor);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.22), trimMat);
    backpack.position.set(0, 1.56, -0.28);
    group.add(backpack);

    const addLimb = (geo, x, y, z, rotZ=0) => {
        const mesh = new THREE.Mesh(geo, suitMat);
        mesh.position.set(x, y, z);
        mesh.rotation.z = rotZ;
        group.add(mesh);
        return mesh;
    };

    addLimb(new THREE.CapsuleGeometry(0.1, 0.66, 5, 12), -0.44, 1.6, 0, 0.18);
    addLimb(new THREE.CapsuleGeometry(0.1, 0.66, 5, 12), 0.44, 1.6, 0, -0.18);
    addLimb(new THREE.CapsuleGeometry(0.12, 0.82, 5, 12), -0.18, 0.76, 0, 0.04);
    addLimb(new THREE.CapsuleGeometry(0.12, 0.82, 5, 12), 0.18, 0.76, 0, -0.04);

    [-0.18, 0.18].forEach((x) => {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), trimMat);
        boot.position.set(x, 0.16, 0.06);
        group.add(boot);
    });

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), glowMat);
    lamp.position.set(0.12, 2.42, 0.24);
    group.add(lamp);

    group.userData.walkParts = {
        armL: group.children[4],
        armR: group.children[5],
        legL: group.children[6],
        legR: group.children[7]
    };
    return group;
}

function createHangarAstronaut(){
    const root = new THREE.Group();
    const placeholder = createHangarAstronautFallback();
    root.add(placeholder);
    root.userData.walkParts = placeholder.userData.walkParts || {};
    root.position.set(0, hangarState.astronautGroundY, 7.8);
    root.rotation.y = Math.PI;
    root.userData.externalModel = null;
    return root;
}


function createHangarPlaqueBoard(width = 3.2, height = 1.36){
    const root = new THREE.Group();

    const board = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
            color:0x0a1320,
            emissive:0x0f2238,
            emissiveIntensity:0.48,
            metalness:0.72,
            roughness:0.26,
            side:THREE.DoubleSide,
            transparent:true,
            opacity:0.96
        })
    );
    root.add(board);

    const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(width + 0.12, height + 0.12),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
            color:0x7fd8ff,
            transparent:true,
            opacity:0.16
        })
    );
    frame.position.z = -0.01;
    root.add(frame);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 420;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const textPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.92, height * 0.86),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
            map:texture,
            transparent:true,
            opacity:1
        })
    );
    textPlane.position.z = 0.012;
    root.add(textPlane);

    root.userData.board = board;
    root.userData.frame = frame;
    root.userData.textPlane = textPlane;
    root.userData.canvas = canvas;
    root.userData.texture = texture;
    root.userData.width = width;
    root.userData.height = height;

    const sellCanvas = document.createElement('canvas');
    sellCanvas.width = 360;
    sellCanvas.height = 120;
    const sellTexture = new THREE.CanvasTexture(sellCanvas);
    sellTexture.colorSpace = THREE.SRGBColorSpace;
    const sellButton = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.34, height * 0.22),
        new THREE.MeshBasicMaterial({ map:sellTexture, transparent:true, opacity:0 })
    );
    sellButton.position.set(width * 0.19, -height * 0.27, 0.024);
    sellButton.visible = false;
    sellButton.userData = { hangarSellPlaqueButton:true, hangarDockIndex:-1, hangarSellPlaqueButtonShipId:'' };
    root.add(sellButton);
    root.userData.sellCanvas = sellCanvas;
    root.userData.sellTexture = sellTexture;
    root.userData.sellButton = sellButton;
    return root;
}

function updateHangarPlaqueSellButton(plaque, sellable, shipId, dockIndex){
    const button = plaque?.userData?.sellButton || null;
    const canvas = plaque?.userData?.sellCanvas || null;
    const texture = plaque?.userData?.sellTexture || null;
    if(!button || !canvas || !texture) return;

    const safeShipId = String(shipId || '').trim();
    const canShow = !!sellable && !!safeShipId;
    button.visible = canShow;
    button.material.opacity = canShow ? 1 : 0;
    button.userData.hangarSellPlaqueButtonShipId = canShow ? safeShipId : '';
    button.userData.hangarDockIndex = Number.isFinite(Number(dockIndex)) ? Number(dockIndex) : -1;

    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(!canShow){
        texture.needsUpdate = true;
        return;
    }

    const label = getSellActionLabel('ship', safeShipId);
    const w = canvas.width;
    const h = canvas.height;
    const r = 24;
    ctx.fillStyle = 'rgba(28,170,92,0.96)';
    ctx.strokeStyle = 'rgba(170,255,210,0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(r, 6);
    ctx.lineTo(w-r, 6);
    ctx.quadraticCurveTo(w-6, 6, w-6, r);
    ctx.lineTo(w-6, h-r);
    ctx.quadraticCurveTo(w-6, h-6, w-r, h-6);
    ctx.lineTo(r, h-6);
    ctx.quadraticCurveTo(6, h-6, 6, h-r);
    ctx.lineTo(6, r);
    ctx.quadraticCurveTo(6, 6, r, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4fff8';
    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w/2, h/2 + 2);
    texture.needsUpdate = true;
}

function drawHangarPlaque(plaque, options = {}){
    if(!plaque?.userData?.canvas || !plaque?.userData?.texture) return;

    const canvas = plaque.userData.canvas;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    const title = String(options.title || '').trim();
    const lines = Array.isArray(options.lines) ? options.lines.map(v => String(v || '').trim()).filter(Boolean) : [];
    const hasContent = !!title || lines.length > 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if(hasContent){
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, 'rgba(7,16,28,0.96)');
        grad.addColorStop(1, 'rgba(4,10,18,0.96)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(96,220,255,0.82)';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        let y = 92;
        if(title){
            ctx.fillStyle = '#cfffff';
            ctx.font = '700 60px Arial';
            ctx.fillText(title, 42, y);
            y += 76;
        }

        ctx.fillStyle = '#f3fdff';
        ctx.font = '700 42px Arial';
        lines.slice(0, 4).forEach(line => {
            ctx.fillText(line, 42, y);
            y += 62;
        });
    }

    plaque.userData.texture.needsUpdate = true;
    if(plaque.userData.textPlane?.material){
        plaque.userData.textPlane.material.opacity = hasContent ? 1 : 0;
        plaque.userData.textPlane.visible = hasContent;
    }
    if(plaque.userData.board?.material){
        plaque.userData.board.material.opacity = hasContent ? 0.96 : 0.78;
    }
    if(plaque.userData.frame?.material){
        plaque.userData.frame.material.opacity = hasContent ? 0.16 : 0.10;
    }
}

function getHangarDisplayShipStats(ship){
    const battleStatsView = computeShipBattleStats(ship?.id || player?.selectedShipId || '');
    return [
        `HP: ${Math.round(Number(battleStatsView?.hp || 0) || 0)}`,
        `Урон: ${Math.round(Number(battleStatsView?.weaponDamage || 0) || 0)}`,
        `Скорость: ${Number(battleStatsView?.maxSpeed || 0).toFixed(2)}`
    ];
}

function getForcedHangarDisplayShip(){
    return findOwnedHangarShipById(player?.selectedShipId || '') || getSelectedShipItem?.() || getOwnedHangarShips?.()[hangarState?.shipIndex || 0] || player?.ships?.[0] || {
        id: String(player?.selectedShipId || 'scout_1').trim() || 'scout_1',
        name: 'Cargo Drone',
        hp: 100,
        attack: 10,
        speed: 5,
        art: 'arrow',
        neon: '#7efcff',
        engine: '#63d1ff',
        accent: '#7a8cff',
        modelPath: 'ships/Spaceship.glb'
    };
}

function refreshHangarInfoBoards(){
    const boards = Array.isArray(hangarState?.infoBoards) ? hangarState.infoBoards : [];
    const currentShip = getForcedHangarDisplayShip();

    boards.forEach(entry => {
        const plaque = entry?.plaque || null;
        if(!plaque) return;

        if(entry.kind === 'center_ship'){
            drawHangarPlaque(plaque, {
                title: String(currentShip?.name || 'Cargo Drone').trim() || 'Cargo Drone',
                lines: getHangarDisplayShipStats(currentShip || { id:'scout_1', name:'Cargo Drone', hp:100, attack:10, speed:5 })
            });
        }else if(entry.kind === 'dock_ship'){
            const dockIndex = Number(entry?.dockIndex ?? -1);
            const dockShip = getHangarDockShipByIndex(dockIndex) || null;
            entry.ship = dockShip;
            drawHangarPlaque(plaque, {
                title: String(dockShip?.name || 'Свободный док').trim() || 'Свободный док',
                lines: dockShip ? getHangarDisplayShipStats(dockShip) : ['Пустая платформа']
            });
            updateHangarPlaqueSellButton(plaque, !!dockShip && canSellHull(dockShip.id), dockShip?.id || '', dockIndex);
        }else{
            drawHangarPlaque(plaque, {});
            updateHangarPlaqueSellButton(plaque, false, '', -1);
        }
    });
}

function createHangarExteriorPlanets(){
    const items = [];
    const makePlanet = (radius, color, emissive, x, y, z, scaleX=1, ring=false, glow=true) => {
        const pivot = new THREE.Group();
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 32),
            new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: glow ? 0.38 : 0.22, metalness:0.08, roughness:0.92 })
        );
        mesh.scale.x = scaleX;
        pivot.add(mesh);
        if(ring){
            const ringMesh = new THREE.Mesh(
                new THREE.TorusGeometry(radius * 1.85, radius * 0.16, 18, 72),
                new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0xd7c2ff, transparent:true, opacity:0.42 })
            );
            ringMesh.rotation.x = Math.PI / 2.35;
            ringMesh.rotation.y = 0.4;
            pivot.add(ringMesh);
        }
        if(glow){
            const halo = new THREE.Mesh(
                new THREE.SphereGeometry(radius * 1.22, 24, 24),
                new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color, transparent:true, opacity:0.10 })
            );
            pivot.add(halo);
        }
        pivot.position.set(x,y,z);
        return pivot;
    };

    const sunPivot = new THREE.Group();
    const sunCore = new THREE.Mesh(
        new THREE.SphereGeometry(3.4, 40, 40),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: sunTexture, color: 0xffffff })
    );
    sunPivot.add(sunCore);
    const sunHalo = new THREE.Mesh(
        new THREE.SphereGeometry(4.5, 28, 28),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0xffb347, transparent:true, opacity:0.16 })
    );
    sunPivot.add(sunHalo);
    sunPivot.position.set(0, 15.5, 214);
    items.push(sunPivot);

    items.push(makePlanet(4.2, 0x4f7bff, 0x2746aa, -132, 15.0, 198));
    items.push(makePlanet(3.0, 0xb982ff, 0x5f2bb8, -172, 20.5, 176, 1.12, true));
    items.push(makePlanet(3.8, 0xf2b16d, 0xb85c1b, 142, 17.5, 194));
    items.push(makePlanet(6.6, 0x89a2c7, 0x223355, 182, 26.0, 166, 1.18, true, false));
    return items;
}

function createHangarSidePlatform(labelText = ''){
    const group = new THREE.Group();
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.45, 0.22, 24),
        new THREE.MeshStandardMaterial({ color:0x213757, metalness:0.72, roughness:0.34 })
    );
    group.add(base);
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.98, 0.06, 12, 42),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x74dfff, transparent:true, opacity:0.72 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.14;
    group.add(ring);
    const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.88, 0.88, 0.04, 24),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x39c8ff, transparent:true, opacity:0.16 })
    );
    glow.position.y = 0.16;
    group.add(glow);
    group.userData.ring = ring;
    group.userData.glow = glow;
    group.userData.label = labelText;
    return group;
}

function isHangarDockWithinUseDistance(dockIndex){
    const safeIndex = Number(dockIndex);
    if(!Number.isFinite(safeIndex) || safeIndex < 0) return false;
    const astronautPos = hangarState?.astronautPivot?.position || null;
    const pad = getHangarDockPadByIndex?.(safeIndex) || null;
    if(!astronautPos || !pad) return false;
    const padWorld = new THREE.Vector3();
    try{ pad.getWorldPosition(padWorld); }catch(_){ return false; }
    return astronautPos.distanceTo(padWorld) <= 9.75;
}

function bindHangarMovementControls(){
    if(hangarState.moveBound) return;
    hangarState.moveBound = true;
    const setKey = (code, active) => {
        if(code === 'KeyW') hangarState.astronautKeys.w = active;
        if(code === 'KeyA') hangarState.astronautKeys.a = active;
        if(code === 'KeyS') hangarState.astronautKeys.s = active;
        if(code === 'KeyD') hangarState.astronautKeys.d = active;
        if(code === 'ShiftLeft' || code === 'ShiftRight') hangarState.astronautKeys.shift = active;
        if(code === 'Space') hangarState.astronautKeys.space = active;
    };
    document.addEventListener('keydown', (e) => {
        if(document.getElementById('hangar-window')?.classList.contains('hidden')) return;
        if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space'].includes(e.code)){
            if(e.code === 'Space') e.preventDefault();
            setKey(e.code, true);
        }
        if(e.code === 'KeyE' && !e.repeat){
            const astronautPos = hangarState?.astronautPivot?.position || null;
            const candidates = [];
            const pads = Array.isArray(hangarState?.supportPlatforms) ? hangarState.supportPlatforms : [];
            for(let idx = 0; idx < pads.length; idx++){
                const ship = getHangarDockShipByIndex?.(idx) || null;
                const pad = getHangarDockPadByIndex?.(idx) || pads[idx] || null;
                if(!ship || !pad) continue;
                const padWorld = new THREE.Vector3();
                try{ pad.getWorldPosition(padWorld); }catch(_){ continue; }
                const dist = astronautPos ? astronautPos.distanceTo(padWorld) : Infinity;
                candidates.push({ ship, idx, dist, near: dist <= 9.75 });
            }
            if(!candidates.length) return;

            let target = null;
            const hoverIndex = Number(hangarState.hoverDockIndex);
            if(Number.isFinite(hoverIndex) && hoverIndex >= 0){
                target = candidates.find(item => item.idx === hoverIndex && item.near) || null;
            }
            if(!target){
                candidates.sort((a,b) => a.dist - b.dist);
                target = candidates.find(item => item.near) || null;
            }
            if(!target?.ship) return;

            e.preventDefault();
            e.stopPropagation();
            hangarState.selectedDockIndex = target.idx;
            hangarState.hoverDockIndex = target.idx;
            const allShips = getAllOwnedHangarShips();
            const nextIndex = allShips.findIndex(item => String(item?.id || '').trim() === String(target.ship?.id || '').trim());
            if(nextIndex >= 0){
                hangarState.shipIndex = nextIndex;
            }
            const currentId = String(player?.selectedShipId || '').trim();
            const nextId = String(target.ship?.id || '').trim();
            fillHangarText();
            if(nextId && currentId !== nextId){
                startHangarShipTransfer(currentId, nextId, target.idx);
            }
        }
    });
    document.addEventListener('keyup', (e) => {
        if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space'].includes(e.code)){
            setKey(e.code, false);
        }
    });
}

function resetHangarAstronautState(){
    hangarState.astronautKeys = { w:false, a:false, s:false, d:false, shift:false, space:false };
    hangarState.astronautVelocity.set(0,0,0);
    hangarState.astronautDirection.set(0,0,0);
    if(hangarState.astronautPivot){
        hangarState.astronautPivot.position.set(0, hangarState.astronautGroundY, 26.0);
        hangarState.astronautPivot.rotation.y = 0;
    }
    hangarState.cameraYaw = 0;
    hangarState.cameraPitch = -0.08;
    hangarState.cameraYawTarget = 0;
    hangarState.cameraPitchTarget = -0.08;
    hangarState.cameraDistance = 14.8;
    hangarState.mouseLookActive = false;
    hangarState.lastMouseX = 0;
    hangarState.lastMouseY = 0;
    try{ document.querySelector('#hangar-window .hangar-room-shell')?.classList.remove('dragging'); }catch(_){ }
    try{ const c = document.querySelector('#hangar-window canvas'); if(c) c.style.cursor='auto'; }catch(_){}
    try{ document.body.style.cursor='auto'; }catch(_){}
}


function createHangarModuleMesh(item){
    const art = String(item?.art || item?.typeId || 'module').toLowerCase();
    const neon = item?.neon || '#7efcff';
    const accent = item?.accent || '#7a8cff';

    const group = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color:new THREE.Color(accent), metalness:0.58, roughness:0.34 });
    const darkShell = new THREE.MeshStandardMaterial({ color:new THREE.Color(accent).multiplyScalar(0.62), metalness:0.72, roughness:0.42 });
    const glow = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:new THREE.Color(neon) });

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


function createHangarRoomEnvironment(){
    const group = new THREE.Group();
    const animatedMaterials = [];
    const lightBars = [];
    const glowPanels = [];
    const dockSlotsLeft = [];
    const dockSlotsRight = [];

    const wallMat = new THREE.MeshStandardMaterial({ color:0x101826, metalness:0.78, roughness:0.34 });
    const panelMat = new THREE.MeshStandardMaterial({ color:0x1a2940, metalness:0.82, roughness:0.26 });
    const frameMat = new THREE.MeshStandardMaterial({ color:0x51637e, metalness:0.9, roughness:0.2 });
    const floorMat = new THREE.MeshStandardMaterial({ color:0x090f18, metalness:0.66, roughness:0.46 });
    const catwalkMat = new THREE.MeshStandardMaterial({ color:0x0f1724, metalness:0.84, roughness:0.24 });
    const stripMatBase = new THREE.MeshStandardMaterial({ color:0xe8f8ff, emissive:0x9edcff, emissiveIntensity:1.95, metalness:0.4, roughness:0.2 });
    const cyanGlowMatBase = new THREE.MeshStandardMaterial({ color:0x8cdfff, emissive:0x37bfff, emissiveIntensity:1.35, metalness:0.3, roughness:0.22 });
    const violetGlowMatBase = new THREE.MeshStandardMaterial({ color:0xe0b6ff, emissive:0x8f45ff, emissiveIntensity:0.9, metalness:0.25, roughness:0.24 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(84, 0.65, 124), floorMat.clone());
    floor.position.set(0, -2.8, 0);
    group.add(floor);

    const mainLane = new THREE.Mesh(new THREE.BoxGeometry(18, 0.08, 100), catwalkMat.clone());
    mainLane.position.set(0, -2.42, 0);
    group.add(mainLane);

    const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.12, 16), catwalkMat.clone());
    rearDeck.position.set(0, -2.38, -38);
    group.add(rearDeck);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 38, 124), wallMat.clone());
    leftWall.position.set(-41.5, 14.5, 0);
    group.add(leftWall);
    const rightWall = leftWall.clone();
    rightWall.position.x = 41.5;
    group.add(rightWall);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(84, 42, 0.8), wallMat.clone());
    backWall.position.set(0, 15.5, -61.5);
    group.add(backWall);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(84, 0.7, 124), wallMat.clone());
    ceiling.position.set(0, 34.8, 0);
    group.add(ceiling);

    for(let i = 0; i < 8; i++){
        const beam = new THREE.Mesh(new THREE.BoxGeometry(64, 0.72, 1.2), frameMat.clone());
        beam.position.set(0, 27.5, -49 + i * 13.8);
        group.add(beam);

        const lightBar = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.16, 0.42), stripMatBase.clone());
        lightBar.position.set(0, 26.95, -49 + i * 13.8);
        animatedMaterials.push(lightBar.material);
        lightBars.push(lightBar);
        group.add(lightBar);
    }

    const frontTop = new THREE.Mesh(new THREE.BoxGeometry(52, 0.75, 1.1), frameMat.clone());
    frontTop.position.set(0, 28.5, 58.5);
    group.add(frontTop);
    const frontBottom = new THREE.Mesh(new THREE.BoxGeometry(52, 0.42, 1.1), frameMat.clone());
    frontBottom.position.set(0, -2.15, 58.5);
    group.add(frontBottom);
    const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(0.82, 28.8, 1.1), frameMat.clone());
    frontLeft.position.set(-26.3, 13.2, 58.5);
    group.add(frontLeft);
    const frontRight = frontLeft.clone();
    frontRight.position.x = 26.3;
    group.add(frontRight);

    const frontGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(50.6, 28.8),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x49619a, transparent:true, opacity:REMOTE_SHIELD_OPACITY_V466 })
    );
    frontGlass.position.set(0, 13.2, 58.0);
    group.add(frontGlass);

    const frontGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(49.6, 27.8),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x4eb7ff, transparent:true, opacity:0.07 })
    );
    frontGlow.position.set(0, 13.2, 57.85);
    glowPanels.push(frontGlow);
    group.add(frontGlow);

    for(const side of [-1, 1]){
        const sideWindowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.54, 24.2, 42), frameMat.clone());
        sideWindowFrame.position.set(side * 34.6, 14.2, 0);
        group.add(sideWindowFrame);

        const sideGlass = new THREE.Mesh(
            new THREE.PlaneGeometry(41, 22),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x34486e, transparent:true, opacity:0.1 })
        );
        sideGlass.position.set(side * 34.2, 14.0, 0);
        sideGlass.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        group.add(sideGlass);

        const sideGlow = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 21),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: side < 0 ? 0x42a4ff : 0xb069ff, transparent:true, opacity:0.07 })
        );
        sideGlow.position.set(side * 34.05, 14.0, 0);
        sideGlow.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        glowPanels.push(sideGlow);
        group.add(sideGlow);
    }

    const createDockTable = (x, z, accentMat, label) => {
        const dockGroup = new THREE.Group();
        dockGroup.position.set(x, -1.72, z);

        const base = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.72, 5.4), panelMat.clone());
        base.position.y = 0.0;
        dockGroup.add(base);

        const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 4.5), frameMat.clone());
        top.position.y = 0.98;
        dockGroup.add(top);

        const sideArm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.24, 2.8), frameMat.clone());
        sideArm.position.set(x < 0 ? 2.9 : -2.9, 0.78, 0);
        sideArm.rotation.z = x < 0 ? -0.22 : 0.22;
        dockGroup.add(sideArm);

        const glowPlate = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.06, 0.24), accentMat.clone());
        glowPlate.position.set(0, 1.14, -1.52);
        animatedMaterials.push(glowPlate.material);
        lightBars.push(glowPlate);
        dockGroup.add(glowPlate);

        const pad = createHangarSidePlatform(label);
        pad.position.set(0, 1.22, 0);
        pad.userData.baseY = 1.22;
        pad.scale.setScalar(1.0);
        dockGroup.add(pad);

        const plaqueTilt = new THREE.Group();
        plaqueTilt.position.set(x < 0 ? 4.15 : -4.15, 1.30, 0.22);
        plaqueTilt.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        dockGroup.add(plaqueTilt);

        const plaque = createHangarPlaqueBoard(4.6, 1.86);
        plaque.position.set(0, 0, 0);
        plaque.rotation.x = -0.34;
        plaque.rotation.y = 0;
        plaque.rotation.z = 0;
        plaqueTilt.add(plaque);

        group.add(dockGroup);
        return { group:dockGroup, pad, plaque, topY: dockGroup.position.y + pad.position.y, side: x < 0 ? 'left' : 'right', index: label };
    };

    const dockZs = [-46, -36, -26, -16, -6, 6, 16, 26, 36, 46];
    dockZs.forEach((z, idx) => {
        const left = createDockTable(-23.5, z, cyanGlowMatBase, `left_${idx}`);
        const right = createDockTable(23.5, z, violetGlowMatBase, `right_${idx}`);
        dockSlotsLeft.push(left);
        dockSlotsRight.push(right);
    });

    const centerDockGroup = new THREE.Group();
    centerDockGroup.position.set(0, -1.5, 40);
    const centerBase = new THREE.Mesh(new THREE.BoxGeometry(12.8, 2.05, 8.8), panelMat.clone());
    centerDockGroup.add(centerBase);
    const centerTop = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.34, 7.2), frameMat.clone());
    centerTop.position.y = 1.2;
    centerDockGroup.add(centerTop);
    const centerPad = createHangarSidePlatform('ship');
    centerPad.position.set(0, 1.58, 0);
    centerPad.scale.setScalar(1.34);
    centerPad.userData.baseY = 1.58;
    centerDockGroup.add(centerPad);

    const centerShowcaseGroup = new THREE.Group();
    centerShowcaseGroup.name = 'HANGAR_CENTER_SHOWCASE_GROUP';
    centerShowcaseGroup.position.set(0, 2.08, 0);
    centerDockGroup.add(centerShowcaseGroup);

    const emergencyHull = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.4, 3.2),
        new THREE.MeshStandardMaterial({ color:0x65e9ff, transparent:true, opacity:0.0, emissive:0x1ba8ff, emissiveIntensity:0.0, metalness:0.42, roughness:0.22 })
    );
    emergencyHull.name = 'HANGAR_EMERGENCY_HULL';
    emergencyHull.visible = false;
    emergencyHull.position.set(0, 1.9, 0);
    centerDockGroup.add(emergencyHull);

    const centerPlaque = createHangarPlaqueBoard(5.9, 2.3);
    centerPlaque.position.set(0, 1.58, -5.34);
    centerPlaque.rotation.x = 0.24;
    centerPlaque.rotation.y = Math.PI;
    centerPlaque.rotation.z = 0;
    centerDockGroup.add(centerPlaque);

    group.add(centerDockGroup);

    const rearDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(12.5, 15.5, 0.6), frameMat.clone());
    rearDoorFrame.position.set(0, 5.5, -61.0);
    group.add(rearDoorFrame);
    const rearDoor = new THREE.Mesh(new THREE.BoxGeometry(9.8, 12.5, 0.18), panelMat.clone());
    rearDoor.position.set(0, 5.2, -60.6);
    group.add(rearDoor);

    group.userData.animatedMaterials = animatedMaterials;
    group.userData.lightBars = lightBars;
    group.userData.glowPanels = glowPanels;
    group.userData.dockSlotsLeft = dockSlotsLeft;
    group.userData.dockSlotsRight = dockSlotsRight;
    group.userData.modulePadMap = {
        weapon: dockSlotsLeft[1]?.pad || null,
        shield: dockSlotsRight[1]?.pad || null,
        booster: dockSlotsLeft[2]?.pad || null
    };
    group.userData.shipDock = centerPad;
    group.userData.shipDockPlaque = centerPlaque;
    group.userData.shipShowcaseGroup = centerShowcaseGroup;
    group.userData.shipDockWorld = new THREE.Vector3(0, centerDockGroup.position.y + centerPad.position.y, centerDockGroup.position.z);
    return group;
}

function disposeHangarRenderer(){
    if(hangarState.frameId){
        cancelAnimationFrame(hangarState.frameId);
        hangarState.frameId = 0;
    }
    const stage = document.getElementById('hangar-runtime-stage') || document.getElementById('hangar-3d-stage');
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
    hangarState.platformBeams = [];
    hangarState.envGroup = null;
    hangarState.envAnimatedMaterials = [];
    hangarState.envLightBars = [];
    hangarState.envGlowPanels = [];
    hangarState.modulePads = {};
    hangarState.supportPlatforms = [];
    hangarState.supportShipMeshes = [];
    hangarState.infoBoards = [];
    disposeHangarSellTerminal?.();
    if(hangarState.shipTransfer){
        try{ hangarState.shipTransfer.incoming?.mesh?.parent?.remove?.(hangarState.shipTransfer.incoming?.mesh); }catch(_){ }
        try{ hangarState.shipTransfer.outgoing?.mesh?.parent?.remove?.(hangarState.shipTransfer.outgoing?.mesh); }catch(_){ }
    }
    hangarState.shipTransfer = null;
    hangarState.astronaut = null;
    hangarState.astronautPivot = null;
    hangarState.planets = [];
    hangarState.showcaseGroup = null;
    resetHangarAstronautState();
    try{ if(document.pointerLockElement) document.exitPointerLock(); }catch(_){ }
    try{ document.body.style.cursor='auto'; }catch(_){ }
    try{ const c = document.querySelector('#hangar-window canvas'); if(c) c.style.cursor='auto'; }catch(_){ }
    hangarState.mouseLookActive = false;
    hangarState.lastMouseX = 0;
    hangarState.lastMouseY = 0;
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
    syncHangarDockSelection();

    const leftBtn = document.getElementById('hangar-ship-left');
    const rightBtn = document.getElementById('hangar-ship-right');
    const upBtn = document.getElementById('hangar-module-up');
    const downBtn = document.getElementById('hangar-module-down');
    const actionBtn = document.getElementById('hangar-ship-action');
    const posLabel = document.getElementById('hangar-ship-position');

    if(leftBtn) leftBtn.style.display = 'none';
    if(rightBtn) rightBtn.style.display = 'none';
    if(upBtn) upBtn.disabled = hangarState.moduleIndex <= 0;
    if(downBtn) downBtn.disabled = hangarState.moduleIndex >= modules.length - 1;

    if(posLabel){
        const currentShip = ships[hangarState.shipIndex] || null;
        posLabel.textContent = currentShip ? `В ангаре: ${ships.length} • Активный: ${currentShip.name || currentShip.id || 'Корпус'}` : 'Нет корпусов';
    }

    if(actionBtn){
        actionBtn.style.display = 'none';
        actionBtn.disabled = true;
    }
}


function hideHangarShipPriceRow(){
    const row = document.getElementById('hangar-ship-price-row');
    if(row) row.style.display = 'none';
}

function disposeHangarSellTerminal(){
    const group = hangarState?.sellTerminalGroup || null;
    if(!group) return;
    try{ group.parent?.remove?.(group); }catch(_){ }
    try{
        group.traverse?.((child) => {
            try{ child.geometry?.dispose?.(); }catch(_){ }
            try{
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.filter(Boolean).forEach((mat) => {
                    try{ mat.map?.dispose?.(); }catch(_){ }
                    try{ mat.dispose?.(); }catch(_){ }
                });
            }catch(_){ }
        });
    }catch(_){ }
    hangarState.sellTerminalGroup = null;
}

function buildHangarSellTerminalLabel(textLabel){
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if(ctx){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = 'rgba(4,14,24,0.92)';
        ctx.strokeStyle = 'rgba(64,240,255,0.95)';
        ctx.lineWidth = 6;
        ctx.fillRect(8,8,canvas.width-16,canvas.height-16);
        ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);
        ctx.fillStyle = '#9ffbff';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(textLabel || 'ПРОДАТЬ', canvas.width/2, 44);
        ctx.fillStyle = '#e9ffff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('TERMINAL', canvas.width/2, 86);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function ensureHangarSellTerminal(candidate){
    disposeHangarSellTerminal();
    return;
}


function updateHangarPlatformPrompt(){
    const hint = document.getElementById('hangar-platform-hint');
    const candidates = (Array.isArray(hangarState?.supportPlatforms) ? hangarState.supportPlatforms : [])
        .map((pad, dockIndex) => ({ ship:getHangarDockShipByIndex(dockIndex), idx:dockIndex, pad }))
        .filter(item => item.ship && item.pad);

    let activeCandidate = null;
    const hoverIndex = Number(hangarState?.hoverDockIndex);
    if(Number.isFinite(hoverIndex) && hoverIndex >= 0){
        const hovered = candidates.find(item => item.idx === hoverIndex) || null;
        if(hovered && canSellHull(hovered.ship?.id)){
            activeCandidate = hovered;
        }
    }
    if(!activeCandidate){
        const selectedDockIndex = Number(hangarState?.selectedDockIndex);
        if(Number.isFinite(selectedDockIndex) && selectedDockIndex >= 0){
            const selectedCandidate = candidates.find(item => item.idx === selectedDockIndex) || null;
            if(selectedCandidate && canSellHull(selectedCandidate.ship?.id)){
                activeCandidate = selectedCandidate;
            }
        }
    }
    if(!activeCandidate){
        activeCandidate = candidates.find(item => canSellHull(item.ship?.id)) || null;
    }

    if(hint){ hint.style.display = 'none'; hint.textContent = ''; }
    if(!activeCandidate){
        disposeHangarSellTerminal();
        return;
    }

    const targetShip = activeCandidate.ship || null;
    const safeShipId = String(targetShip?.id || '').trim();
    if(!safeShipId || !canSellHull(safeShipId)){
        disposeHangarSellTerminal();
        return;
    }

    ensureHangarSellTerminal(activeCandidate);
}


function renderHangarModuleList(ship){
    const wrap = document.getElementById('hangar-module-list');
    if(!wrap) return;
    const modules = getOwnedHangarModules();
    const activeType = getCurrentHangarModuleType();
    const equippedByType = getEquippedModuleTypesForShip(ship?.id || player?.selectedShipId || '');
    if(!modules.length){
        wrap.innerHTML = `<div class="hangar-module-list-item empty"><div class="hangar-module-list-name">Нет модулей</div><div class="hangar-module-list-sub">Купи ${getHangarModuleTypeName(activeType).toLowerCase()} в магазине.</div></div>`;
        return;
    }
    wrap.innerHTML = modules.map((item, index) => {
        const typeId = String(item?.typeId || item?.classId || '').trim();
        const equipped = String(equippedByType[typeId] || '').trim() === String(item?.id || '').trim();
        const active = index === hangarState.moduleIndex;
        return `
          <button class="hangar-module-list-item ${active ? 'active' : ''} ${equipped ? 'equipped' : ''}" type="button" data-hangar-module-index="${index}">
            <span class="hangar-module-list-name">${item?.name || 'Модуль'}</span>
            <span class="hangar-module-list-sub">${getHangarModuleTypeName(typeId)}${equipped ? ' • установлен' : ''}</span>
          </button>
        `;
    }).join('');
    wrap.querySelectorAll('[data-hangar-module-index]').forEach(btn => {
        if(btn.dataset.hangarBound) return;
        btn.dataset.hangarBound = '1';
        btn.addEventListener('click', () => {
            const nextIndex = Number(btn.dataset.hangarModuleIndex || 0) || 0;
            if(nextIndex === hangarState.moduleIndex) return;
            hangarState.moduleIndex = nextIndex;
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    });
}


function fillHangarText(){
    hideHangarShipPriceRow();
    const displayedShip = getForcedHangarDisplayShip();
    const ships = getOwnedHangarShips();
    const modules = getOwnedHangarModules();
    const ship = displayedShip || ships[hangarState.shipIndex] || null;
    const module = modules[hangarState.moduleIndex] || null;
    renderHangarModuleList(ship);
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
    const shipName = ship?.name || (String(hangarState?.shipFilter || 'all') !== 'all' ? 'Нет корпусов этого типа' : 'Нет корпусов');
    setText('hangar-ship-name', shipName);
    setText('hangar-ship-subtitle', ship ? 'Текущий выбранный корабль стоит на центральной платформе.' : 'Купи корпус в магазине, и он появится здесь.');
    const stageBadge = document.getElementById('hangar-stage-name-badge');
    if(stageBadge) stageBadge.textContent = shipName;
    const shipDesc = ship
        ? String(ship?.description || '').trim() || `HP ${Math.round(Number(battleStatsView?.hp || ship?.hp || 0) || 0)} • Урон ${Math.round(Number(battleStatsView?.weaponDamage || ship?.attack || 0) || 0)} • Скорость ${Number(battleStatsView?.maxSpeed || ship?.speed || 0).toFixed(2)}`
        : '';
    setText('hangar-ship-desc', shipDesc);
    setText('hangar-ship-price-coins', ship && typeof getShipCoinPrice === 'function' ? String(getShipCoinPrice(ship)) : '0');
    setText('hangar-ship-price-diamonds', ship && typeof getShipDiamondPrice === 'function' ? String(getShipDiamondPrice(ship)) : '0');

    setText('hangar-module-name', module?.name || 'Нет модулей');
    setText('hangar-module-tier', module?.tier || '—');
    setText('hangar-module-type', module ? `${getHangarModuleTypeName(module?.classId || module?.typeId)}${moduleInstalled ? ' • установлен' : ''}` : getHangarModuleTypeName(getCurrentHangarModuleType()));
    setText('hangar-module-desc', module?.description || 'Список слева показывает купленные элементы выбранной категории.');

    const moduleBtn = document.getElementById('hangar-module-action');
    const moduleSellBtn = document.getElementById('hangar-module-sell');
    if(moduleBtn){
        moduleBtn.disabled = !ship || !module;
        moduleBtn.textContent = !module ? 'Нет модулей' : (moduleInstalled ? 'Снять' : 'Установить');
        moduleBtn.classList.toggle('equipped', moduleInstalled);
        moduleBtn.classList.toggle('locked', !ship || !module);
    }
    if(moduleSellBtn){
        const sellable = !!module && canSellModule(module.id);
        moduleSellBtn.disabled = !sellable;
        moduleSellBtn.textContent = !module ? 'Нет модуля' : (sellable ? getSellActionLabel('module', module.id) : 'Стартовый модуль');
        moduleSellBtn.classList.toggle('locked', !sellable);
    }

    const shipSellBtn = document.getElementById('hangar-ship-sell');
    if(shipSellBtn){
        shipSellBtn.style.display = 'none';
        shipSellBtn.disabled = true;
    }

    const shipSlotMap = getEquippedModuleTypesForShip(ship?.id || '');
    const weaponInstalled = getModuleById(shipSlotMap.weapon || '');
    const shieldInstalled = getModuleById(shipSlotMap.shield || '');
    const boosterInstalled = getModuleById(shipSlotMap.booster || '');

    const statsWrap = document.getElementById('hangar-ship-stats');
    if(statsWrap){
        statsWrap.innerHTML = '';
        statsWrap.style.display = 'none';
    }
    const weaponLabel = weaponInstalled?.name || 'Нет';
    const shieldLabel = shieldInstalled?.name || 'Нет';
    const boosterLabel = boosterInstalled?.name || 'Нет';
    const compactHandling = battleStatsView.handlingLabel || 'Стандарт';
    const stats = [
        ['Скорость', battleStatsView.maxSpeed.toFixed(2)],
        ['Броня', battleStatsView.hp],
        ['Урон', battleStatsView.weaponDamage],
        ['Энергия', battleStatsView.clipSize],
        ['Пушка', weaponLabel],
        ['Щит', shieldLabel],
        ['Ускоритель', boosterLabel],
        ['Управление', compactHandling]
    ];
    if(false){
        statsWrap.innerHTML = stats.map(([key, value]) => `
            <div class="hangar-stat-box">
              <div class="hangar-stat-label">${key}</div>
              <div class="hangar-stat-value">${value}</div>
            </div>
        `).join('');
    }

    updateHangarHeaderNumbers();
    updateHangarButtons();
    updateHangarPlatformPrompt();
}



const hangarShipMeshCache = new Map();
const hangarShipMeshPromiseCache = new Map();
const hangarShipModelSourceCache = new Map();
let hangarBuildToken = 0;

function loadExternalHangarShipModel(modelPath = 'ships/Spaceship.glb'){
    const requestedPath = String(modelPath || 'ships/Spaceship.glb').trim() || 'ships/Spaceship.glb';
    const normalized = requestedPath.replace(/^\.\//, '').replace(/^\//, '');
    const candidatePaths = Array.from(new Set([
        requestedPath,
        normalized,
        './' + normalized,
        '/' + normalized
    ].filter(Boolean)));

    if(hangarShipModelSourceCache.has(requestedPath)){
        return Promise.resolve(cloneObject3DDeepSafe(hangarShipModelSourceCache.get(requestedPath)));
    }
    if(hangarShipMeshPromiseCache.has(`src:${requestedPath}`)){
        return hangarShipMeshPromiseCache.get(`src:${requestedPath}`).then(model => cloneObject3DDeepSafe(model));
    }

    const loader = new GLTFLoader();

    const tryLoadAt = (i = 0) => new Promise((resolve, reject) => {
        const activePath = candidatePaths[i];
        if(!activePath){
            reject(new Error('Failed to load GLB from all candidate paths'));
            return;
        }
        loader.load(
            activePath,
            (gltf) => {
                try{
                    const model = gltf?.scene || null;
                    if(!model) throw new Error('GLB scene is empty');
                    model.rotation.y = Math.PI;
                    model.userData = { ...(model.userData || {}), sourcePath: requestedPath };
                    model.traverse((child) => {
                        if(child?.isMesh){
                            child.castShadow = true;
                            child.receiveShadow = true;
                            if(child.material){
                                const materials = Array.isArray(child.material) ? child.material : [child.material];
                                materials.forEach((mat) => {
                                    if(mat && 'metalness' in mat && mat.metalness < 0.45) mat.metalness = 0.45;
                                    if(mat && 'roughness' in mat && mat.roughness > 0.62) mat.roughness = 0.62;
                                });
                            }
                        }
                    });
                    hangarShipModelSourceCache.set(requestedPath, cloneObject3DDeepSafe(model));
                    resolve(cloneObject3DDeepSafe(model));
                }catch(err){
                    reject(err);
                }
            },
            undefined,
            () => {
                tryLoadAt(i + 1).then(resolve).catch(reject);
            }
        );
    });

    const promise = tryLoadAt(0);
    hangarShipMeshPromiseCache.set(`src:${requestedPath}`, promise);
    return promise.then(model => cloneObject3DDeepSafe(model));
}

function buildHangarShipMeshAsync(item){
    const externalPath = String(item?.modelPath || '').trim();
    if(externalPath){
        return loadExternalHangarShipModel(externalPath)
            .then(raw => normalizeHangarShipMesh(raw))
            .catch(() => normalizeHangarShipMesh(createHangarShipMesh({
                ...(item || {}),
                art: String(item?.art || 'arrow').trim() || 'arrow',
                neon: String(item?.neon || '#7efcff').trim() || '#7efcff',
                engine: String(item?.engine || '#63d1ff').trim() || '#63d1ff',
                accent: String(item?.accent || '#7a8cff').trim() || '#7a8cff'
            })));
    }
    return Promise.resolve(normalizeHangarShipMesh(createHangarShipMesh(item)));
}


function getBattleShipVisualConfig(shipId){
    const safeShipId = String(shipId || '').trim();
    if(safeShipId === 'scout_1'){
        return {
            scale: 1.72,
            fallbackScale: 0.40,
            visualYaw: 0,
            cameraDistance: 20.5,
            cameraHeight: 6.2
        };
    }
    if(safeShipId === 'xwing_1'){
        return {
            scale: 2.05,
            fallbackScale: 0.48,
            visualYaw: Math.PI / 2,
            cameraDistance: 16.5,
            cameraHeight: 5.5
        };
    }
    return {
        scale: 2.2,
        fallbackScale: 0.52,
        visualYaw: 0,
        cameraDistance: 16,
        cameraHeight: 5.5
    };
}

function buildBattleShipVisualAsync(item, team = 'blue'){
    const safeShipId = String(item?.id || '').trim();
    const externalPath = String(item?.modelPath || '').trim();
    const tint = new THREE.Color(getBattleShipColorHex(team));
    const visualConfig = getBattleShipVisualConfig(safeShipId);

    const applyBattleVisualTweaks = (root) => {
        if(!root) return root;
        root.rotation.order = 'YXZ';
        root.rotation.y = Number(visualConfig?.visualYaw || 0) || 0;
        root.traverse?.((child) => {
            if(child?.isMesh){
                child.castShadow = true;
                child.receiveShadow = true;
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat) => {
                    if(!mat) return;
                    if(mat.color?.isColor){
                        try{ mat.color.lerp(tint, 0.22); }catch(_){ }
                    }
                    if(mat.emissive?.isColor){
                        try{ mat.emissive.copy(tint).multiplyScalar(0.06); }catch(_){ }
                    }
                    if('metalness' in mat && Number(mat.metalness || 0) < 0.42) mat.metalness = 0.42;
                    if('roughness' in mat && Number(mat.roughness || 0) > 0.7) mat.roughness = 0.7;
                });
            }
        });
        return root;
    };

    if(externalPath){
        return loadExternalHangarShipModel(externalPath)
            .then((raw) => {
                const normalized = normalizeHangarShipMesh(raw);
                if(normalized?.scale?.multiplyScalar){
                    normalized.scale.multiplyScalar(Number(visualConfig?.scale || 2.2) || 2.2);
                }
                return applyBattleVisualTweaks(normalized);
            })
            .catch(() => {
                const fallback = createHangarShipMesh(item);
                fallback.scale.multiplyScalar(Number(visualConfig?.fallbackScale || 0.52) || 0.52);
                return applyBattleVisualTweaks(fallback);
            });
    }

    const procedural = createHangarShipMesh(item);
    procedural.scale.multiplyScalar(Number(visualConfig?.fallbackScale || 0.52) || 0.52);
    return Promise.resolve(applyBattleVisualTweaks(procedural));
}

function preserveBattleOverlaysV462(targetGroup, clearFn){
    if(!targetGroup) return;
    const overlays = [];
    try{
        for(const child of [...targetGroup.children]){
            if(child?.userData?.staticPilotLabelV461 || child?.userData?.battleOverlayV462){
                overlays.push(child);
                targetGroup.remove(child);
            }
        }
        clearFn?.();
    }catch(_){
        try{ clearFn?.(); }catch(__){}
    }
    targetGroup.userData = targetGroup.userData || {};
    targetGroup.userData.preservedBattleOverlaysV462 = overlays;
}

function restoreBattleOverlaysV462(targetGroup){
    try{
        const overlays = targetGroup?.userData?.preservedBattleOverlaysV462 || [];
        overlays.forEach(child => {
            if(child && !child.parent) targetGroup.add(child);
        });
        if(targetGroup?.userData) targetGroup.userData.preservedBattleOverlaysV462 = [];
    }catch(_){}
}

function ensureRemotePilotLabelV462(entry){
    try{
        if(!entry?.mesh) return;
        if(entry.labelSprite && entry.labelSprite.parent === entry.mesh) return;
        if(entry.labelSprite && entry.labelSprite.parent) entry.labelSprite.parent.remove(entry.labelSprite);
        entry.labelSprite = createRemotePilotLabel(entry.nickname || entry.mesh?.userData?.pilotName || 'Pilot', entry.team || entry.mesh?.userData?.team || 'blue', entry.level || 1);
        entry.labelSprite.userData.battleOverlayV462 = true;
        entry.mesh.add(entry.labelSprite);
    }catch(_){}
}

function mountBattleShipVisual(targetGroup, item, team = 'blue'){
    if(!targetGroup) return Promise.resolve(null);
    const loadToken = Date.now() + Math.random();
    targetGroup.userData = targetGroup.userData || {};
    targetGroup.userData.visualLoadToken = loadToken;
    preserveBattleOverlaysV462(targetGroup, () => { while(targetGroup.children.length) targetGroup.remove(targetGroup.children[0]); });

    const immediateFallback = createHangarLoadingPlaceholder();
    immediateFallback.position.set(0, 0, 0);
    targetGroup.add(immediateFallback);
    targetGroup.userData.hitRadius = Math.max(2.6, Number(item?.hitRadius || 0) || 0, 2.6);

    return buildBattleShipVisualAsync(item, team)
        .then((visual) => {
            if(!visual || targetGroup.userData?.visualLoadToken !== loadToken) return null;
            preserveBattleOverlaysV462(targetGroup, () => {
                while(targetGroup.children.length) targetGroup.remove(targetGroup.children[0]);
            });
            visual.position.set(0, 0, 0);
            targetGroup.add(visual);
            targetGroup.userData.hitRadius = Math.max(2.6, Number(visual?.userData?.hangarWidth || 0), Number(visual?.userData?.hangarDepth || 0), 2.6);
            restoreBattleOverlaysV462(targetGroup);
            if(targetGroup === playerShip){
                setTimeout(() => { try{ attachPlayerShieldFieldV460?.(); }catch(_){} }, 60);
            }
            return visual;
        })
        .catch(() => immediateFallback);
}


function createHangarNoShipPlaceholder(){
    const group = new THREE.Group();

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.28, 0.05, 16, 42),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x53d8ff, transparent:true, opacity:0.52 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const lineA = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.035, 0.15),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0x8ee7ff, transparent:true, opacity:0.34 })
    );
    lineA.position.y = 0.22;
    group.add(lineA);

    const lineB = lineA.clone();
    lineB.scale.x = 0.7;
    lineB.position.y = 0.02;
    group.add(lineB);

    group.position.set(0, 0.42, 0.08);
    return group;
}


function createGuaranteedCentralShowcaseShip(){
    const ship = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
        color: 0xeaf8ff,
        emissive: 0x4fd8ff,
        emissiveIntensity: 1.2,
        metalness: 0.74,
        roughness: 0.18
    });

    const wingMat = new THREE.MeshStandardMaterial({
        color: 0xa9dfff,
        emissive: 0x4f8cff,
        emissiveIntensity: 0.72,
        metalness: 0.66,
        roughness: 0.22
    });

    const core = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.35, 9.4), hullMat);
    core.position.set(0, 1.1, 0);
    ship.add(core);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.0, 12), hullMat);
    nose.rotation.x = Math.PI * 0.5;
    nose.position.set(0, 1.1, 6.1);
    ship.add(nose);

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.82, 2.1), wingMat);
    cockpit.position.set(0, 1.95, 1.25);
    ship.add(cockpit);

    const wingL = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 2.3), wingMat);
    wingL.position.set(-2.8, 0.92, -0.2);
    wingL.rotation.z = 0.22;
    ship.add(wingL);

    const wingR = wingL.clone();
    wingR.position.x = 2.8;
    wingR.rotation.z = -0.22;
    ship.add(wingR);

    const topFin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.55, 2.4), wingMat);
    topFin.position.set(0, 2.1, -0.2);
    ship.add(topFin);

    const engineMat = new THREE.MeshStandardMaterial({
        color: 0xb9fbff,
        emissive: 0x63eeff,
        emissiveIntensity: 1.8,
        metalness: 0.24,
        roughness: 0.16
    });

    const engineL = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.9, 14), engineMat);
    engineL.rotation.x = Math.PI * 0.5;
    engineL.position.set(-1.0, 0.86, -5.05);
    ship.add(engineL);

    const engineR = engineL.clone();
    engineR.position.x = 1.0;
    ship.add(engineR);

    ship.scale.setScalar(1.0);
    ship.rotation.y = Math.PI;
    ship.userData.isGuaranteedCentralShip = true;
    return ship;
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
        hangarState.shipPivot.children.slice().forEach(child => { if(!child?.userData?.isGuaranteedCentralShip && !child?.userData?.isHangarEmergencyHull) hangarState.shipPivot.remove(child); });
        const readyMesh = cloneObject3DDeepSafe(cached);
        readyMesh.position.set(0, 1.62, 0);
        hangarState.shipPivot.add(readyMesh);
        hangarState.isShipLoading = false;
        fillHangarText();
        return;
    }

    buildHangarShipMeshAsync(currentShip)
        .then((shipMesh) => {
            if(!shipMesh) return;
            hangarShipMeshCache.set(shipId, cloneObject3DDeepSafe(shipMesh));
            if(buildToken !== hangarBuildToken || !hangarState.shipPivot) return;
            hangarState.shipPivot.children.slice().forEach(child => { if(!child?.userData?.isGuaranteedCentralShip && !child?.userData?.isHangarEmergencyHull) hangarState.shipPivot.remove(child); });
            shipMesh.position.set(0, 1.54, 0);
            shipMesh.scale.setScalar(1.18);
            hangarState.shipPivot.add(shipMesh);
        })
        .catch(() => {
            if(buildToken !== hangarBuildToken || !hangarState.shipPivot) return;
            hangarState.shipPivot.children.slice().forEach(child => { if(!child?.userData?.isGuaranteedCentralShip && !child?.userData?.isHangarEmergencyHull) hangarState.shipPivot.remove(child); });
            const fallback = normalizeHangarShipMesh(createHangarShipMesh(currentShip));
            fallback.position.set(0,1.62,0);
            hangarState.shipPivot.add(fallback);
        })
        .finally(() => {
            if(buildToken !== hangarBuildToken) return;
            hangarState.isShipLoading = false;
            fillHangarText();
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

        const sourcePath = String(shipMesh?.userData?.sourcePath || '').trim().toLowerCase();
        const isStarterHull = sourcePath.includes('spaceship.glb');
        const maxWidth = isStarterHull ? 6.4 : 7.6;
        const maxHeight = isStarterHull ? 3.1 : 4.2;
        const maxDepth = isStarterHull ? 6.4 : 7.6;

        const scaleX = size.x > 0 ? maxWidth / size.x : 1;
        const scaleY = size.y > 0 ? maxHeight / size.y : 1;
        const scaleZ = size.z > 0 ? maxDepth / size.z : 1;
        const finalScale = Math.min(scaleX, scaleY, scaleZ, isStarterHull ? 1.65 : 1.95);

        shipMesh.scale.multiplyScalar(finalScale);
        shipMesh.updateMatrixWorld(true);

        const normalizedBounds = new THREE.Box3().setFromObject(shipMesh);
        const normalizedSize = normalizedBounds.getSize(new THREE.Vector3());
        const normalizedCenter = normalizedBounds.getCenter(new THREE.Vector3());

        shipMesh.position.x -= normalizedCenter.x;
        shipMesh.position.z -= normalizedCenter.z;
        shipMesh.position.y -= normalizedBounds.min.y;
        shipMesh.position.y += 0.04;

        wrap.userData.hangarHeight = normalizedSize.y || 0;
        wrap.userData.hangarWidth = normalizedSize.x || 0;
        wrap.userData.hangarDepth = normalizedSize.z || 0;
        return wrap;
    }catch(_){
        return shipMesh;
    }
}

function rebuildHangarSceneObjects(){
    if(!hangarState.scene || !hangarState.modulePivot) return;

    hangarBuildToken += 1;
    const buildToken = hangarBuildToken;
    hangarState.isShipLoading = false;

    if(hangarState.shipPivot){
        while(hangarState.shipPivot.children.length) hangarState.shipPivot.remove(hangarState.shipPivot.children[0]);
    }
    while(hangarState.modulePivot.children.length) hangarState.modulePivot.remove(hangarState.modulePivot.children[0]);

    const modules = getOwnedHangarModules();
    const currentShip = getForcedHangarDisplayShip();
    const currentModule = modules[hangarState.moduleIndex] || null;

    const showcaseGroup = hangarState?.envGroup?.userData?.shipShowcaseGroup || null;
    const centerPlaque = hangarState?.envGroup?.userData?.shipDockPlaque || null;
    const emergencyHull = hangarState?.envGroup?.getObjectByName?.('HANGAR_EMERGENCY_HULL') || null;
    if(showcaseGroup){
        while(showcaseGroup.children.length) showcaseGroup.remove(showcaseGroup.children[0]);
        showcaseGroup.rotation.set(0, 0, 0);
        showcaseGroup.position.set(0, 2.08, 0);
    }
    (hangarState.supportShipMeshes || []).forEach(mesh => {
        try{ mesh?.parent?.remove?.(mesh); }catch(_){ }
    });
    hangarState.supportShipMeshes = [];
    if(emergencyHull) emergencyHull.visible = false;

    if(currentShip && showcaseGroup){
        const liveItemRaw = currentShip || findOwnedHangarShipById(player?.selectedShipId || '') || getSelectedShipItem?.() || player?.ships?.[0] || null;
        const liveItem = liveItemRaw ? {
            ...liveItemRaw,
            art: String(liveItemRaw?.art || 'arrow').trim() || 'arrow',
            neon: String(liveItemRaw?.neon || '#7efcff').trim() || '#7efcff',
            engine: String(liveItemRaw?.engine || '#63d1ff').trim() || '#63d1ff',
            accent: String(liveItemRaw?.accent || '#7a8cff').trim() || '#7a8cff',
            modelPath: String(liveItemRaw?.modelPath || '/ships/Spaceship.glb').trim() || '/ships/Spaceship.glb'
        } : null;

        const directShipData = {
            ...(liveItem || currentShip || {}),
            art: String((liveItem || currentShip)?.art || 'arrow').trim() || 'arrow',
            neon: String((liveItem || currentShip)?.neon || '#7efcff').trim() || '#7efcff',
            engine: String((liveItem || currentShip)?.engine || '#63d1ff').trim() || '#63d1ff',
            accent: String((liveItem || currentShip)?.accent || '#7a8cff').trim() || '#7a8cff'
        };

        if(centerPlaque){
            drawHangarPlaque(centerPlaque, {
                title: String(directShipData?.name || 'Cargo Drone').trim() || 'Cargo Drone',
                lines: [
                    `HP: ${Math.round(Number(directShipData?.hp || 100) || 100)}`,
                    `ATK: ${Math.round(Number(directShipData?.attack || 10) || 10)}`,
                    `SPD: ${Math.round(Number(directShipData?.speed || 5) || 5)}`
                ]
            });
            if(centerPlaque.userData?.textPlane?.material){
                centerPlaque.userData.textPlane.material.opacity = 1;
                centerPlaque.userData.textPlane.visible = true;
            }
        }

        const cachedCenterMesh = liveItem ? hangarShipMeshCache.get(String(liveItem.id || '').trim()) : null;
        if(cachedCenterMesh){
            const readyMesh = cloneObject3DDeepSafe(cachedCenterMesh);
            readyMesh.position.set(0, 0.18, 0);
            readyMesh.scale.setScalar(1.08);
            readyMesh.userData.appearStartedAt = performance.now();
            readyMesh.userData.appearTargetScale = 1.22;
            readyMesh.rotation.x = 0;
            readyMesh.rotation.y = Math.PI;
            readyMesh.rotation.z = 0;
            showcaseGroup.add(readyMesh);
            hangarState.isShipLoading = false;
        }else{
            hangarState.isShipLoading = true;
        }

        buildHangarShipMeshAsync(liveItem || currentShip)
            .then((shipMesh) => {
                if(buildToken !== hangarBuildToken || !shipMesh || !showcaseGroup) return;
                while(showcaseGroup.children.length) showcaseGroup.remove(showcaseGroup.children[0]);
                shipMesh.position.set(0, 0.18, 0);
                shipMesh.scale.setScalar(1.08);
                shipMesh.userData.appearStartedAt = performance.now();
                shipMesh.userData.appearTargetScale = 1.22;
                shipMesh.rotation.x = 0;
                shipMesh.rotation.y = Math.PI;
                shipMesh.rotation.z = 0;
                showcaseGroup.add(shipMesh);
                if(liveItem){
                    hangarShipMeshCache.set(String(liveItem.id || '').trim(), cloneObject3DDeepSafe(shipMesh));
                }
            })
            .catch(() => {
                if(buildToken !== hangarBuildToken || !showcaseGroup) return;
            })
            .finally(() => {
                if(buildToken !== hangarBuildToken) return;
                hangarState.isShipLoading = false;
                refreshHangarInfoBoards();
                fillHangarText();
            });
    }

    (hangarState.supportPlatforms || []).forEach((pad, dockIndex) => {
        if(!pad) return;
        const dockShip = getHangarDockShipByIndex(dockIndex);
        if(!dockShip) return;
        const shipId = String(dockShip?.id || '').trim();
        if(!shipId) return;
        const placeholder = createHangarNoShipPlaceholder();
        placeholder.position.set(0, 0.96, 0.02);
        placeholder.userData.isNoShipPlaceholder = true;
        pad.add(placeholder);
        buildHangarShipMeshAsync(dockShip)
            .then((sideMesh) => {
                if(buildToken !== hangarBuildToken || !pad || !sideMesh) return;
                try{ pad.remove(placeholder); }catch(_){ }
                sideMesh.position.set(0, 1.06, 0.05);
                sideMesh.rotation.set(0, Math.PI, 0);
                sideMesh.scale.setScalar(1.12);
                sideMesh.userData.hangarDockIndex = dockIndex;
                sideMesh.userData.baseScale = 1.12;
                sideMesh.userData.shipId = shipId;
                pad.add(sideMesh);
                hangarState.supportShipMeshes.push(sideMesh);
            })
            .catch(() => {});
    });

    if(currentModule){
        const moduleMesh = createHangarModuleMesh(currentModule);
        const currentType = String(currentModule?.classId || currentModule?.typeId || getCurrentHangarModuleType()).trim();
        const pad = hangarState.modulePads?.[currentType] || hangarState.modulePads?.weapon || null;
        if(pad){
            const worldPos = new THREE.Vector3();
            pad.getWorldPosition(worldPos);
            moduleMesh.position.set(worldPos.x, worldPos.y + 1.05, worldPos.z);
        }else{
            moduleMesh.position.set(-18, 0.8, -8);
        }
        hangarState.modulePivot.add(moduleMesh);
    }

    refreshHangarInfoBoards();
    fillHangarText();
}

function ensureHangarRenderer(){
    const stage = document.getElementById('hangar-runtime-stage') || document.getElementById('hangar-3d-stage');
    if(!stage) return;

    bindHangarStageInteraction();
    bindHangarMovementControls();

    if(!hangarState.renderer){
        hangarState.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
        hangarState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        hangarState.renderer.outputColorSpace = THREE.SRGBColorSpace;
        stage.appendChild(hangarState.renderer.domElement);
        Object.assign(hangarState.renderer.domElement.style, {
            position:'absolute',
            inset:'0',
            width:'100%',
            height:'100%',
            display:'block'
        });
        hangarState.renderer.domElement.tabIndex = 0;
        hangarState.renderer.domElement.setAttribute('data-hangar-canvas', '1');

        hangarState.scene = new THREE.Scene();
        hangarState.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 320);
        hangarState.camera.position.set(0, 7.2, 14.8);
        hangarState.camera.lookAt(0, 3.4, 40.0);

        const ambient = new THREE.AmbientLight(0xffffff, 1.55);
        const key = new THREE.DirectionalLight(0xccecff, 2.45);
        key.position.set(14, 30, 20);
        const rim = new THREE.DirectionalLight(0x7e8dff, 1.08);
        rim.position.set(-15, 12, -18);
        const floorGlow = new THREE.PointLight(0x4ac8ff, 3.4, 96);
        floorGlow.position.set(0, 3.0, -16);
        const sunLight = new THREE.PointLight(0xffc97a, 10.5, 360, 1.8);
        sunLight.position.set(0, 16, 112);
        const sunFill = new THREE.DirectionalLight(0xffd7a3, 2.6);
        sunFill.position.set(0, 10, 80);

        const windowSun = new THREE.SpotLight(0xffd18a, 5.2, 240, Math.PI / 5, 0.42, 1.2);
        windowSun.position.set(0, 20, 72);
        windowSun.target.position.set(0, 2, 30);

        hangarState.scene.add(ambient, key, rim, floorGlow, sunLight, sunFill, windowSun, windowSun.target);

        const stars = new THREE.Points(
            new THREE.BufferGeometry().setAttribute(
                'position',
                new THREE.Float32BufferAttribute([
                    -40, 22, -26, -26, 31, -18, 24, 20, -22, 30, 26, -14, -18, 15, -24, 20, 34, -24,
                    -32, 26, -28, 38, 14, -20, 0, 33, -36, 14, 7, -26, -12, 29, -20, 29, 22, -18
                ], 3)
            ),
            new THREE.PointsMaterial({ color:0x9fdfff, size:0.26 })
        );
        hangarState.scene.add(stars);

        hangarState.envGroup = createHangarRoomEnvironment();
        hangarState.envAnimatedMaterials = hangarState.envGroup.userData?.animatedMaterials || [];
        hangarState.envLightBars = hangarState.envGroup.userData?.lightBars || [];
        hangarState.envGlowPanels = hangarState.envGroup.userData?.glowPanels || [];
        hangarState.scene.add(hangarState.envGroup);

        hangarState.planets = createHangarExteriorPlanets();
        hangarState.planets.forEach(planet => hangarState.scene.add(planet));

        hangarState.platform = hangarState?.envGroup?.userData?.shipDock || null;
        hangarState.platformRing = hangarState.platform?.userData?.ring || null;
        hangarState.platformGlowDisc = hangarState.platform?.userData?.glow || null;
        hangarState.showcaseGroup = hangarState?.envGroup?.userData?.shipShowcaseGroup || null;
        hangarState.platformBeams = [];
        hangarState.shipPivot = new THREE.Group();
        hangarState.modulePivot = new THREE.Group();
        hangarState.modulePads = hangarState?.envGroup?.userData?.modulePadMap || {};
        const leftDockSlots = [...(hangarState?.envGroup?.userData?.dockSlotsLeft || [])].sort((a, b) => Number(b?.group?.position?.z || 0) - Number(a?.group?.position?.z || 0));
        const rightDockSlots = [...(hangarState?.envGroup?.userData?.dockSlotsRight || [])].sort((a, b) => Number(b?.group?.position?.z || 0) - Number(a?.group?.position?.z || 0));
        const dockOrder = [
            ...leftDockSlots.map((slot, idx) => ({ side:'left', idx })),
            ...rightDockSlots.map((slot, idx) => ({ side:'right', idx }))
        ];
        hangarState.supportPlatforms = dockOrder.map(entry => (entry.side === 'left' ? leftDockSlots[entry.idx] : rightDockSlots[entry.idx])?.pad).filter(Boolean);
        hangarState.supportPlatforms.forEach((pad, idx) => {
            if(pad){
                pad.userData = pad.userData || {};
                pad.userData.hangarDockIndex = idx;
            }
        });
        syncHangarDockSelection();
        hangarState.infoBoards = [
            { kind:'center_ship', plaque: hangarState?.envGroup?.userData?.shipDockPlaque || null },
            ...dockOrder.map((entry, dockIdx) => {
                const source = entry.side === 'left' ? leftDockSlots[entry.idx] : rightDockSlots[entry.idx];
                return { kind:'dock_ship', plaque: source?.plaque || null, ship: getHangarDockShipByIndex(dockIdx), dockIndex:dockIdx };
            })
        ];

        hangarState.astronautGroundY = -1.72;
        hangarState.astronautPivot = createHangarAstronaut();
        hangarState.astronaut = hangarState.astronautPivot;
        hangarState.scene.add(hangarState.astronautPivot);
        hangarState.shipPivot.position.set(0, 0.95, 40.0);
        hangarState.scene.add(hangarState.shipPivot);
        hangarState.scene.add(hangarState.modulePivot);

        hangarState.cameraDistance = 15.2;
        hangarState.cameraYaw = 0;
        hangarState.cameraPitch = -0.08;
        hangarState.cameraYawTarget = 0;
        hangarState.cameraPitchTarget = -0.08;
        hangarState.lastMouseX = window.innerWidth * 0.5;
        hangarState.lastMouseY = window.innerHeight * 0.5;
    }

    bindHangarStageInteraction();

    try{
        const canvas = hangarState?.renderer?.domElement || null;
        if(canvas && document.getElementById('hangar-window') && !document.getElementById('hangar-window').classList.contains('hidden')){
            hangarState.lastMouseX = window.innerWidth * 0.5;
            hangarState.lastMouseY = window.innerHeight * 0.5;
            safeRequestPointerLock(canvas);
        }
    }catch(_){}

    const width = window.innerWidth || stage.clientWidth || 1000;
    const height = window.innerHeight || stage.clientHeight || 700;
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

    const animate = () => {
        if(document.getElementById('hangar-window')?.classList.contains('hidden')){
            hangarState.frameId = 0;
            return;
        }

        const now = performance.now();
        const time = now * 0.001;
        const currentShip = getForcedHangarDisplayShip();
        const isViewedShipSelected = !!currentShip && String(currentShip?.id || '').trim() === String(player?.selectedShipId || '').trim();

        const neonHue = (time * 0.055) % 1;
        const ringColor = new THREE.Color().setHSL(neonHue, 0.95, isViewedShipSelected ? 0.72 : 0.66);
        const glowColor = new THREE.Color().setHSL((neonHue + 0.08) % 1, 1.0, isViewedShipSelected ? 0.56 : 0.5);

        if(hangarState.platformRing?.material){
            hangarState.platformRing.material.opacity = isViewedShipSelected ? 1 : 0.82;
            hangarState.platformRing.material.color.copy(ringColor);
        }
        if(hangarState.platformGlowDisc?.material){
            hangarState.platformGlowDisc.material.opacity = isViewedShipSelected ? 0.30 : 0.2;
            hangarState.platformGlowDisc.material.color.copy(glowColor);
        }

        if(hangarState.showcaseGroup){
            hangarState.shipYaw += 0.0045;
            hangarState.showcaseGroup.rotation.y = hangarState.shipYaw;
        }

        const ownedShips = getOwnedHangarShips();
        (hangarState.supportPlatforms || []).forEach((pad, idx) => {
            const ring = pad?.userData?.ring;
            const glow = pad?.userData?.glow;
            const dockShip = getHangarDockShipByIndex(idx);
            const isSelectedShipDock = !!dockShip && String(dockShip?.id || '').trim() === String(player?.selectedShipId || '').trim();
            const isOccupiedDock = !!dockShip && !isSelectedShipDock;
            const isHoveredDock = idx === Number(hangarState.hoverDockIndex);
            const isSelectedDock = idx === Number(hangarState.selectedDockIndex);
            const baseHue = idx < ((hangarState?.envGroup?.userData?.dockSlotsLeft || []).length || 10) ? 0.54 : 0.82;
            const lightness = isSelectedDock ? 0.80 : (isHoveredDock ? 0.74 : 0.68);
            const opacityBoost = isSelectedDock ? 0.24 : (isHoveredDock ? 0.14 : 0);
            if(ring?.material){
                ring.material.color.setHSL(baseHue, isOccupiedDock ? 0.96 : 0.35, lightness);
                ring.material.opacity = (isOccupiedDock ? 0.76 : 0.32) + Math.sin(time * 1.8 + idx) * 0.05 + opacityBoost;
            }
            if(glow?.material){
                glow.material.opacity = (isOccupiedDock ? 0.16 : 0.05) + Math.sin(time * 1.35 + idx * 0.7) * 0.03 + opacityBoost * 0.7;
            }
            const baseY = pad.userData?.baseY ?? pad.position.y;
            const lift = isSelectedDock ? 0.08 : (isHoveredDock ? 0.04 : 0.0);
            pad.position.y = baseY + Math.sin(time * 1.1 + idx * 0.5) * 0.01 + lift;
            const targetScale = isSelectedDock ? 1.08 : (isHoveredDock ? 1.04 : 1.0);
            const currentScale = Number(pad.scale.x || 1);
            const nextScale = currentScale + (targetScale - currentScale) * 0.12;
            pad.scale.setScalar(nextScale);
            pad.children.forEach((child) => {
                if(!child?.userData?.shipId) return;
                child.rotation.y += 0.0032;
                const baseScale = Number(child.userData.baseScale || 0.74) || 0.74;
                const hoverScale = isHoveredDock ? baseScale * 1.06 : (isSelectedDock ? baseScale * 1.1 : baseScale);
                const currentChildScale = Number(child.scale.x || baseScale);
                const nextChildScale = currentChildScale + (hoverScale - currentChildScale) * 0.14;
                child.scale.setScalar(nextChildScale);
                child.position.y = 1.02 + (isHoveredDock ? 0.05 : 0.0) + Math.sin(time * 1.7 + idx * 0.4) * 0.02;
            });
        });

        if(hangarState.showcaseGroup){
            hangarState.showcaseGroup.children.forEach((child) => {
                const targetScale = Number(child?.userData?.appearTargetScale || child?.scale?.x || 1.0);
                const startedAt = Number(child?.userData?.appearStartedAt || 0);
                if(startedAt > 0){
                    const progress = THREE.MathUtils.clamp((performance.now() - startedAt) / 420, 0, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const startScale = Math.max(0.58, targetScale * 0.6);
                    const nextScale = startScale + (targetScale - startScale) * eased;
                    child.scale.setScalar(nextScale);
                    child.position.y = 0.08 + 0.10 * eased;
                }
            });
        }


        if(hangarState.shipTransfer){
            const transfer = hangarState.shipTransfer;
            const progress = THREE.MathUtils.clamp((now - Number(transfer.startedAt || now)) / Math.max(1, Number(transfer.duration || 1550)), 0, 1);
            const smooth = (value) => value * value * (3 - 2 * value);
            ['incoming','outgoing'].forEach((key) => {
                const entry = transfer[key];
                if(!entry?.mesh) return;
                const from = entry.from.clone();
                const to = entry.to.clone();
                const lift = Number(entry.lift || 2.0);
                let t = 0;
                let y = from.y;
                if(progress < 0.26){
                    t = 0;
                    y = THREE.MathUtils.lerp(from.y, from.y + lift, smooth(progress / 0.26));
                }else if(progress < 0.78){
                    t = smooth((progress - 0.26) / 0.52);
                    y = from.y + lift;
                }else{
                    t = 1;
                    y = THREE.MathUtils.lerp(from.y + lift, to.y, smooth((progress - 0.78) / 0.22));
                }
                const pos = from.clone().lerp(to, t);
                const arc = Math.sin(Math.PI * THREE.MathUtils.clamp((progress - 0.26) / 0.52, 0, 1)) * Number(entry.arcOffset || 0);
                pos.z += arc;
                pos.y = y;
                entry.mesh.position.copy(pos);
                const moveDir = to.clone().sub(from);
                if(moveDir.lengthSq() > 0.0001){
                    const flatDir = moveDir.clone().setY(0);
                    if(flatDir.lengthSq() > 0.0001){
                        const direction = flatDir.normalize();
                        const forwardAxis = entry.forwardAxis instanceof THREE.Vector3
                            ? entry.forwardAxis.clone().normalize()
                            : new THREE.Vector3(1, 0, 0);
                        const targetQuat = new THREE.Quaternion().setFromUnitVectors(forwardAxis, direction);
                        entry.mesh.quaternion.slerp(targetQuat, 0.22);
                    }
                }
                const scaleValue = Number(entry.fromScale || 1) + (Number(entry.toScale || 1) - Number(entry.fromScale || 1)) * smooth(progress);
                entry.mesh.scale.setScalar(scaleValue);
            });
            if(progress >= 1){
                const finalShipId = String(transfer.nextShipId || '').trim();
                if(finalShipId){
                    player.selectedShipId = finalShipId; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){}
                    currentBattleShipStats = computeShipBattleStats(finalShipId);
                    updatePremiumAccountInfo?.();
                    updateHUD?.();
                    updateUI?.();
                    saveGame?.();
                }
                try{ if(transfer.hiddenOriginalIncoming){ transfer.hiddenOriginalIncoming.visible = true; transfer.hiddenOriginalIncoming.userData.hiddenForTransfer = false; } }catch(_){ }
                try{ if(transfer.hiddenOriginalOutgoing){ transfer.hiddenOriginalOutgoing.visible = true; transfer.hiddenOriginalOutgoing.userData.hiddenForTransfer = false; } }catch(_){ }
                try{ transfer.incoming?.mesh && (transfer.incoming.mesh.userData.isActiveHangarTransferMesh = false); }catch(_){ }
                try{ transfer.outgoing?.mesh && (transfer.outgoing.mesh.userData.isActiveHangarTransferMesh = false); }catch(_){ }
                try{ transfer.incoming?.mesh?.parent?.remove?.(transfer.incoming?.mesh); }catch(_){ }
                try{ transfer.outgoing?.mesh?.parent?.remove?.(transfer.outgoing?.mesh); }catch(_){ }
                hangarState.shipTransfer = null;
                hangarState.hoverDockIndex = -1;
                hangarState.selectedDockIndex = -1;
                rebuildHangarSceneObjects();
                fillHangarText();
            }
        }

        if(Array.isArray(hangarState.envAnimatedMaterials)){
            hangarState.envAnimatedMaterials.forEach((mat, idx) => {
                if(!mat) return;
                const pulse = 0.88 + Math.sin(time * 1.25 + idx * 0.7) * 0.22;
                if('emissiveIntensity' in mat) mat.emissiveIntensity = pulse * (idx % 3 === 0 ? 1.6 : 1.1);
            });
        }
        if(Array.isArray(hangarState.envLightBars)){
            hangarState.envLightBars.forEach((mesh, idx) => {
                if(!mesh) return;
                mesh.scale.y = 1 + Math.sin(time * 1.05 + idx * 0.45) * 0.035;
            });
        }
        if(Array.isArray(hangarState.envGlowPanels)){
            hangarState.envGlowPanels.forEach((mesh, idx) => {
                if(!mesh?.material) return;
                mesh.material.opacity = 0.07 + (idx % 2 ? 0.05 : 0.09) + Math.sin(time * 0.85 + idx) * 0.02;
            });
        }

        if(hangarState.astronautPivot){
            const moveX = (hangarState.astronautKeys.d ? 1 : 0) - (hangarState.astronautKeys.a ? 1 : 0);
            const moveZ = (hangarState.astronautKeys.w ? 1 : 0) - (hangarState.astronautKeys.s ? 1 : 0);
            const cameraYawFlat = hangarState.cameraYaw;
            const forward = new THREE.Vector3(Math.sin(cameraYawFlat), 0, Math.cos(cameraYawFlat));
            const right = new THREE.Vector3(-forward.z, 0, forward.x);
            hangarState.astronautDirection.set(0, 0, 0);
            if(moveZ) hangarState.astronautDirection.add(forward.clone().multiplyScalar(moveZ));
            if(moveX) hangarState.astronautDirection.add(right.clone().multiplyScalar(moveX));
            const isMoving = hangarState.astronautDirection.lengthSq() > 0.001;
            const runMul = hangarState.astronautKeys.shift ? 3.1 : 1.35;
            const targetSpeed = isMoving ? 0.26 * runMul : 0;
            if(isMoving){
                hangarState.astronautDirection.normalize();
                hangarState.astronautVelocity.x += (hangarState.astronautDirection.x * targetSpeed - hangarState.astronautVelocity.x) * 0.16;
                hangarState.astronautVelocity.z += (hangarState.astronautDirection.z * targetSpeed - hangarState.astronautVelocity.z) * 0.16;
                hangarState.astronautTargetYaw = Math.atan2(hangarState.astronautDirection.x, hangarState.astronautDirection.z);
            }else{
                hangarState.astronautVelocity.x *= 0.78;
                hangarState.astronautVelocity.z *= 0.78;
            }
            if(hangarState.astronautKeys.space && Math.abs(hangarState.astronautPivot.position.y - hangarState.astronautGroundY) < 0.04){
                hangarState.astronautVelocity.y = 0.18;
            }
            hangarState.astronautVelocity.y -= 0.0095;
            hangarState.astronautPivot.position.x = THREE.MathUtils.clamp(hangarState.astronautPivot.position.x + hangarState.astronautVelocity.x, -30.0, 30.0);
            hangarState.astronautPivot.position.z = THREE.MathUtils.clamp(hangarState.astronautPivot.position.z + hangarState.astronautVelocity.z, -52.0, 52.0);
            hangarState.astronautPivot.position.y += hangarState.astronautVelocity.y;
            if(hangarState.astronautPivot.position.y <= hangarState.astronautGroundY){
                hangarState.astronautPivot.position.y = hangarState.astronautGroundY;
                hangarState.astronautVelocity.y = 0;
            }
            hangarState.astronautPivot.rotation.y += (hangarState.astronautTargetYaw - hangarState.astronautPivot.rotation.y) * 0.18;
            hangarState.astronautBob += isMoving ? 0.22 * runMul : 0.05;
            const walkSwing = isMoving ? Math.sin(hangarState.astronautBob) * 0.55 : 0;
            const parts = hangarState.astronautPivot.userData?.walkParts || {};
            if(parts.armL) parts.armL.rotation.x = walkSwing;
            if(parts.armR) parts.armR.rotation.x = -walkSwing;
            if(parts.legL) parts.legL.rotation.x = -walkSwing;
            if(parts.legR) parts.legR.rotation.x = walkSwing;
        }

        (hangarState.planets || []).forEach((planet, idx) => {
            if(!planet) return;
            planet.rotation.y += 0.0018 + idx * 0.0006;
            planet.rotation.x += 0.0007 + idx * 0.0002;
        });

        if(hangarState.camera){
            const astro = hangarState.astronautPivot?.position || { x:0, y:hangarState.astronautGroundY, z:8 };
            hangarState.cameraYaw += (hangarState.cameraYawTarget - hangarState.cameraYaw) * 0.52;
            hangarState.cameraPitch += (hangarState.cameraPitchTarget - hangarState.cameraPitch) * 0.52;
            const focus = new THREE.Vector3(astro.x, astro.y + 1.85, astro.z);
            const cosPitch = Math.cos(hangarState.cameraPitch);
            const cameraOffset = new THREE.Vector3(
                Math.sin(hangarState.cameraYaw) * cosPitch,
                Math.sin(hangarState.cameraPitch),
                Math.cos(hangarState.cameraYaw) * cosPitch
            ).multiplyScalar(hangarState.cameraDistance);
            const desiredPos = focus.clone().sub(cameraOffset);
            desiredPos.y += 5.4;
            hangarState.camera.position.lerp(desiredPos, 0.28);
            hangarState.camera.lookAt(focus);
        }
        const floatingSellBtn = document.getElementById('hangar-platform-sell');
        if(floatingSellBtn){
            floatingSellBtn.style.display = 'none';
            floatingSellBtn.disabled = true;
            floatingSellBtn.dataset.shipId = '';
            floatingSellBtn.dataset.dockIndex = '';
        }
        hangarState.renderer.render(hangarState.scene, hangarState.camera);
        hangarState.frameId = requestAnimationFrame(animate);
    };

    if(!hangarState.frameId){
        hangarState.frameId = requestAnimationFrame(animate);
    }
}


function bindHangarStageInteraction(){
    const stage = document.getElementById('hangar-runtime-stage') || document.getElementById('hangar-3d-stage') || document.querySelector('#hangar-window .hangar-room-shell');
    if(!stage) return;


    const updateDockHover = (clientX, clientY, activateClick = false) => {
        if(!hangarState.camera || !hangarState.scene) return;
        const rect = stage.getBoundingClientRect();
        if(clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom){
            hangarState.hoverDockIndex = -1;
            updateHangarPlatformPrompt();
            return;
        }
        mouse.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        mouse.y = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
        raycaster.setFromCamera(mouse, hangarState.camera);
        const pads = (hangarState.supportPlatforms || []).filter(Boolean);
        const terminal = null;
        const plaques = (Array.isArray(hangarState?.infoBoards) ? hangarState.infoBoards : []).map(item => item?.plaque).filter(Boolean);
        const targets = pads.flatMap(pad => {
            const nodes = [];
            if(pad) nodes.push(pad);
            try{ pad?.traverse?.(child => { if(child?.isMesh) nodes.push(child); }); }catch(_){}
            return nodes;
        });
        plaques.forEach(plaque => { try{ plaque?.traverse?.(child => { if(child?.isMesh) targets.push(child); }); }catch(_){} });
        const hits = raycaster.intersectObjects(targets, false);
        let hoverIndex = -1;
        let terminalShipId = '';
        if(hits.length){
            let obj = hits[0].object;
            while(obj && hoverIndex < 0 && !terminalShipId){
                if(obj?.userData?.hangarSellPlaqueButtonShipId) terminalShipId = String(obj.userData.hangarSellPlaqueButtonShipId || '').trim();
                if(obj?.userData?.hangarSellPlaqueButton && Number.isFinite(obj?.userData?.hangarDockIndex)) hoverIndex = Number(obj.userData.hangarDockIndex);
                if(Number.isFinite(obj?.userData?.hangarDockIndex)) hoverIndex = Number(obj.userData.hangarDockIndex);
                obj = obj.parent;
            }
        }
        hangarState.hoverDockIndex = hoverIndex;
        updateHangarPlatformPrompt();
        if(!isHangarGuestView?.() && activateClick && terminalShipId && !hangarState.shipTransfer && canSellHull(terminalShipId) && isHangarDockWithinUseDistance(hoverIndex)){
            sellHullFromHangar?.(terminalShipId);
            hangarState.hoverDockIndex = -1;
            hangarState.selectedDockIndex = -1;
            updateHangarPlatformPrompt();
            fillHangarText();
            rebuildHangarSceneObjects();
            return;
        }
        if(!isHangarGuestView?.() && activateClick && hoverIndex >= 0 && !hangarState.shipTransfer && isHangarDockWithinUseDistance(hoverIndex)){
            hangarState.selectedDockIndex = hoverIndex;
            updateHangarPlatformPrompt();
            const nextShip = getHangarDockShipByIndex(hoverIndex);
            if(nextShip){
                const allShips = getAllOwnedHangarShips();
                const nextIndex = allShips.findIndex(item => String(item?.id || '').trim() === String(nextShip?.id || '').trim());
                if(nextIndex >= 0) hangarState.shipIndex = nextIndex;
                const currentId = String(player?.selectedShipId || '').trim();
                const nextId = String(nextShip?.id || '').trim();
                if(nextId && currentId !== nextId){
                    fillHangarText();
                    startHangarShipTransfer(currentId, nextId, hoverIndex);
                }
            }
        }
    };

    const applyDelta = (dx, dy) => {
        const safeDx = THREE.MathUtils.clamp(Number(dx || 0) || 0, -22, 22);
        const safeDy = THREE.MathUtils.clamp(Number(dy || 0) || 0, -22, 22);
        hangarState.cameraYawTarget -= safeDx * 0.00235;
        hangarState.cameraPitchTarget = THREE.MathUtils.clamp(
            hangarState.cameraPitchTarget - safeDy * 0.00185,
            -0.58,
            0.42
        );
    };

    hangarState.mouseLookActive = true;
    try{ stage.style.cursor = 'auto'; }catch(_){}
    try{ document.body.style.cursor='auto'; }catch(_){}

    if(!stage.dataset.hangarHoverBound){
        stage.dataset.hangarHoverBound = '1';
        stage.addEventListener('mousemove', (event) => {
            updateDockHover(event.clientX, event.clientY, false);
        });
        stage.addEventListener('mouseleave', () => {
            hangarState.hoverDockIndex = -1;
            updateHangarPlatformPrompt();
        });
        stage.addEventListener('click', (event) => {
            updateDockHover(event.clientX, event.clientY, true);
        });
    }


    if(!hangarState.stageDocBound){
        hangarState.stageDocBound = true;
        document.addEventListener('mousemove', (event) => {
            const hangarWindow = document.getElementById('hangar-window');
            if(!hangarWindow || hangarWindow.classList.contains('hidden')) return;

            const canvas = hangarState?.renderer?.domElement || null;
            const usingPointerLock = !!(canvas && document.pointerLockElement === canvas);

            let dx = 0;
            let dy = 0;

            if(usingPointerLock){
                dx = Number(event.movementX || 0) || 0;
                dy = Number(event.movementY || 0) || 0;
            }else{
                const nextX = Number(event.clientX || 0) || 0;
                const nextY = Number(event.clientY || 0) || 0;
                dx = nextX - Number(hangarState.lastMouseX || nextX);
                dy = nextY - Number(hangarState.lastMouseY || nextY);
                hangarState.lastMouseX = nextX;
                hangarState.lastMouseY = nextY;

                const insideStage = (() => {
                    try{
                        const rect = stage.getBoundingClientRect();
                        return nextX >= rect.left && nextX <= rect.right && nextY >= rect.top && nextY <= rect.bottom;
                    }catch(_){
                        return true;
                    }
                })();

                if(!insideStage) return;
            }

            applyDelta(dx, dy);
        }, { passive:true });

        document.addEventListener('mouseenter', (event) => {
            hangarState.lastMouseX = Number(event.clientX || 0) || 0;
            hangarState.lastMouseY = Number(event.clientY || 0) || 0;
        }, { passive:true, capture:true });

        window.addEventListener('blur', () => {
            hangarState.lastMouseX = 0;
            hangarState.lastMouseY = 0;
        }, { passive:true });
    }

    const canvas = hangarState?.renderer?.domElement || null;
    if(canvas && !canvas.dataset.hangarLookBound){
        canvas.dataset.hangarLookBound = '1';
        canvas.style.cursor = 'auto';
        canvas.addEventListener('mousemove', (event) => {
            if(document.pointerLockElement !== canvas) return;
            applyDelta(event.movementX || 0, event.movementY || 0);
        }, { passive:true });
    }
}


function bindHangarRuntimeUI(){
    const leftBtn = document.getElementById('hangar-ship-left');
    const rightBtn = document.getElementById('hangar-ship-right');
    const upBtn = document.getElementById('hangar-module-up');
    const downBtn = document.getElementById('hangar-module-down');
    const moduleBtn = document.getElementById('hangar-module-action');
    const moduleSellBtn = document.getElementById('hangar-module-sell');
    const shipActionBtn = document.getElementById('hangar-ship-action');
    const shipSellBtn = document.getElementById('hangar-ship-sell');
    const floatingShipSellBtn = document.getElementById('hangar-platform-sell');
    const classButtons = document.querySelectorAll('.hangar-class-chip[data-hangar-class]');
    const moduleButtons = document.querySelectorAll('.hangar-module-chip[data-hangar-module-type]');

    if(leftBtn && !leftBtn.dataset.boundHangarRuntime){
        leftBtn.dataset.boundHangarRuntime = '1';
        leftBtn.addEventListener('click', () => {
            const ships = getOwnedHangarShips();
            if(!ships.length || hangarState.shipIndex <= 0) return;
            hangarState.shipIndex = Math.max(0, hangarState.shipIndex - 1);
            setHangarTransition?.(-1);
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }
    if(rightBtn && !rightBtn.dataset.boundHangarRuntime){
        rightBtn.dataset.boundHangarRuntime = '1';
        rightBtn.addEventListener('click', () => {
            const ships = getOwnedHangarShips();
            if(!ships.length || hangarState.shipIndex >= ships.length - 1) return;
            hangarState.shipIndex = Math.min(ships.length - 1, hangarState.shipIndex + 1);
            setHangarTransition?.(1);
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }
    if(upBtn && !upBtn.dataset.boundHangarRuntime){
        upBtn.dataset.boundHangarRuntime = '1';
        upBtn.addEventListener('click', () => {
            const modules = getOwnedHangarModules();
            if(!modules.length || hangarState.moduleIndex <= 0) return;
            hangarState.moduleIndex = Math.max(0, hangarState.moduleIndex - 1);
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }
    if(downBtn && !downBtn.dataset.boundHangarRuntime){
        downBtn.dataset.boundHangarRuntime = '1';
        downBtn.addEventListener('click', () => {
            const modules = getOwnedHangarModules();
            if(!modules.length || hangarState.moduleIndex >= modules.length - 1) return;
            hangarState.moduleIndex = Math.min(modules.length - 1, hangarState.moduleIndex + 1);
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }
    if(moduleBtn && !moduleBtn.dataset.boundHangarRuntime){
        moduleBtn.dataset.boundHangarRuntime = '1';
        moduleBtn.addEventListener('click', () => {
            if(isHangarGuestView?.()) return;
            const ship = getForcedHangarDisplayShip();
            const modules = getOwnedHangarModules();
            const module = modules[hangarState.moduleIndex] || null;
            if(!ship || !module) return;
            const moduleType = String(module.classId || module.typeId || '').trim();
            const installed = getInstalledModuleForType(ship.id, moduleType);
            if(installed && String(installed.id || '') === String(module.id || '')){
                unequipModuleFromShip?.(ship.id, moduleType);
            }else{
                equipModuleToShip?.(ship.id, module.id);
            }
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }
    if(moduleSellBtn && !moduleSellBtn.dataset.boundHangarRuntime){
        moduleSellBtn.dataset.boundHangarRuntime = '1';
        moduleSellBtn.addEventListener('click', () => {
            if(isHangarGuestView?.()) return;
            const modules = getOwnedHangarModules();
            const module = modules[hangarState.moduleIndex] || null;
            if(!module) return;
            sellModuleFromHangar?.(module.id);
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }
    if(shipActionBtn && !shipActionBtn.dataset.boundHangarRuntime){
        shipActionBtn.dataset.boundHangarRuntime = '1';
        shipActionBtn.addEventListener('click', () => {
            if(isHangarGuestView?.()) return;
            selectCurrentHangarShip?.();
        });
    }
    if(shipSellBtn && !shipSellBtn.dataset.boundHangarRuntime){
        shipSellBtn.dataset.boundHangarRuntime = '1';
        shipSellBtn.addEventListener('click', () => {
            if(isHangarGuestView?.()) return;
            const ship = getForcedHangarDisplayShip();
            if(!ship) return;
            sellHullFromHangar?.(ship.id);
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }
    if(floatingShipSellBtn && !floatingShipSellBtn.dataset.boundHangarRuntime){
        floatingShipSellBtn.dataset.boundHangarRuntime = '1';
        floatingShipSellBtn.addEventListener('click', () => {
            if(isHangarGuestView?.()) return;
            const shipId = String(floatingShipSellBtn.dataset.shipId || '').trim();
            if(!shipId) return;
            sellHullFromHangar?.(shipId);
            hangarState.hoverDockIndex = -1;
            updateHangarPlatformPrompt();
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    }

    classButtons.forEach((btn) => {
        if(btn.dataset.boundHangarRuntime) return;
        btn.dataset.boundHangarRuntime = '1';
        btn.addEventListener('click', () => {
            hangarState.shipFilter = String(btn.dataset.hangarClass || 'all').trim() || 'all';
            hangarState.shipIndex = 0;
            ensureHangarIndexes();
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    });

    moduleButtons.forEach((btn) => {
        if(btn.dataset.boundHangarRuntime) return;
        btn.dataset.boundHangarRuntime = '1';
        btn.addEventListener('click', () => {
            hangarState.moduleFilter = String(btn.dataset.hangarModuleType || 'weapon').trim() || 'weapon';
            hangarState.moduleIndex = 0;
            ensureHangarIndexes();
            fillHangarText();
            rebuildHangarSceneObjects();
        });
    });
}

function bindHangarControls(){
    const closeBtn = document.getElementById('close-hangar');
    if(closeBtn && !closeBtn.dataset.hangarBound){
        closeBtn.dataset.hangarBound = '1';
        closeBtn.addEventListener('click', () => {
            document.getElementById('hangar-window')?.classList.add('hidden');
            try{ resetHangarAstronautState?.(); }catch(_){ }
            try{ if(document.pointerLockElement) document.exitPointerLock(); }catch(_){ }
            try{ document.body.style.cursor='auto'; }catch(_){ }
            try{ const c = document.querySelector('#hangar-window canvas'); if(c) c.style.cursor='auto'; }catch(_){ }
            try{ disposeHangarRenderer?.(); }catch(_){ }
        });
    }
}


function renderHangarCosmic(forceSyncToSelected = true){
    try{ disposeHangarRenderer?.(); }catch(_){ }
    try{ resetHangarAstronautState?.(); }catch(_){ }
    const win = document.getElementById('hangar-window');
    if(!win) return;
    win.classList.remove('hidden');
    win.classList.toggle('guest-hangar-view', !!isHangarGuestView?.());

    if(forceSyncToSelected !== false){
        try{ syncHangarSelectionState?.({ forceClass:true }); }catch(_){ }
    }
    try{ ensureHangarIndexes?.(); }catch(_){ }

    const shell = win.querySelector('.hangar-empty-shell');
    if(shell){
        shell.innerHTML = `
          <button id="close-hangar" class="hangar-close-btn" type="button">✖</button>
          <div id="hangar-guest-banner" class="hangar-guest-banner" style="display:none;">👁 Просмотр ангара игрока</div>
          <div class="hangar-layout">
            <aside class="hangar-module-side">
              <div class="hangar-side-title">Модули улучшения</div>
              <div class="hangar-module-filter">
                <button class="hangar-module-chip active" type="button" data-hangar-module-type="weapon">Оружие</button>
                <button class="hangar-module-chip" type="button" data-hangar-module-type="shield">Щит</button>
                <button class="hangar-module-chip" type="button" data-hangar-module-type="booster">Ускоритель</button>
              </div>
              <div class="hangar-module-view">
                <button id="hangar-module-up" class="hangar-arrow vertical" type="button">▲</button>
                <div class="hangar-module-preview"></div>
                <div class="hangar-module-meta">
                  <div id="hangar-module-name" class="hangar-module-name">Модуль</div>
                  <div id="hangar-module-tier" class="hangar-module-tier">—</div>
                  <div id="hangar-module-type" class="hangar-module-type">—</div>
                  <div id="hangar-module-desc" class="hangar-module-desc">Список модулей готов.</div>
                </div>
                <div class="hangar-module-actions">
                  <button id="hangar-module-action" class="hangar-main-btn" type="button">Установить</button>
                  <button id="hangar-module-sell" class="hangar-main-btn hangar-sell-btn" type="button">Продать</button>
                </div>
                <div id="hangar-module-list" class="hangar-module-list"></div>
                <button id="hangar-module-down" class="hangar-arrow vertical" type="button">▼</button>
              </div>
            </aside>

            <section class="hangar-stage-wrap full no-ship-arrows">
              <div class="hangar-stage">
                <div id="hangar-runtime-stage" class="hangar-runtime-stage"></div>
                <div class="hangar-runtime-fade"></div>
                <div class="hangar-stage-overlay" style="pointer-events:none;">
                  <div id="hangar-platform-hint" style="display:none !important;position:absolute;left:50%;bottom:24px;transform:translateX(-50%);padding:10px 16px;border-radius:14px;background:rgba(4,10,22,0.76);border:1px solid rgba(98,216,255,0.25);box-shadow:0 0 18px rgba(0,180,255,0.16);font-size:14px;color:#dff7ff;pointer-events:none;white-space:nowrap;"></div>
                  <button id="hangar-platform-sell" class="hangar-main-btn hangar-sell-btn" type="button" style="position:absolute;display:none !important;min-width:170px;pointer-events:none;z-index:0;opacity:0;">Продать</button>
                  <div id="hangar-ship-tier" style="display:none;">Корпус</div>
                  <div id="hangar-ship-name" style="display:none;">Cargo Drone</div>
                  <div id="hangar-ship-subtitle" style="display:none;">Центральная платформа показывает корпус.</div>
                  <div id="hangar-ship-desc" style="display:none;"></div>
                  <div id="hangar-ship-price-row" style="display:none;">
                    <span class="hangar-price-chip">🟡 <b id="hangar-ship-price-coins">0</b></span>
                    <span class="hangar-price-chip">💎 <b id="hangar-ship-price-diamonds">0</b></span>
                  </div>
                  <button id="hangar-ship-action" class="hangar-main-btn ready" type="button" style="display:none;">Выбрать</button>
                  <button id="hangar-ship-sell" class="hangar-main-btn hangar-sell-btn" type="button" style="display:none;">Продать</button>
                  <div id="hangar-ship-stats" class="hangar-stats-grid" style="display:none;"></div>
                  <div class="hangar-footer-row" style="display:none;">
                    <div id="hangar-ship-position" class="hangar-position-label">0 / 0</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        `;
    }

    const guestBanner = document.getElementById('hangar-guest-banner');
    if(guestBanner){
        guestBanner.style.display = isHangarGuestView?.() ? 'block' : 'none';
        guestBanner.textContent = `👁 Просмотр ангара: ${hangarGuestOwner?.nickname || 'игрок'}`;
    }
    try{
        if(isHangarWindowOpenNow?.()){
            const ownerId = getHangarOwnerIdForPresence?.();
            if(ownerId){
                currentHangarPresenceOwnerId = String(ownerId);
                ensureHangarPresencePanel?.();
                renderHangarPresencePanel?.();
                startHangarPresenceLoop?.();
            }
        }
    }catch(_){}
    bindHangarControls();
    bindHangarRuntimeUI();
    updateHangarFilterButtons?.();
    fillHangarText();
    ensureHangarRenderer();
    rebuildHangarSceneObjects();
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
        tab.addEventListener('click', () => {
          closeAll();
          if(winId === 'hangar-window') { try{ restoreOwnHangarAfterGuest?.(); }catch(_){} try{ enterOwnHangarPresence?.(); }catch(_){} }
          win.classList.remove('hidden');
          if(winId === 'hangar-window') win.style.display = 'flex';
          if(winId === 'hangar-window'){
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                try{ renderHangarCosmic?.(true); }catch(_){}
                setTimeout(() => { try{ renderHangarCosmic?.(false); }catch(_){} }, 40);
              });
            });
          } else {
            renderer();
          }
        });
      }
    });
    [['close-profile','profile-window'],['close-hangar','hangar-window'],['close-clans','clans-window'],['close-leaders','leaders-window']].forEach(([btnId,winId]) => {
      const btn = document.getElementById(btnId);
      const win = document.getElementById(winId);
      if(btn && win && !btn.dataset.boundExtra){
        btn.dataset.boundExtra = '1';
        btn.addEventListener('click', () => {
          win.classList.add('hidden');
          if(winId === 'hangar-window'){
            try{ disposeHangarRenderer?.(); }catch(_){}
            try{ leaveHangarPresence?.(); }catch(_){}
            try{ restoreOwnHangarAfterGuest?.(); }catch(_){}
            __restoreHangarChatPanel();
          }
        });
      }
    });
}

window.addEventListener('load', () => {
    initExtraLobbyWindows();
    renderProfileStats();
    renderClansWindow();
    renderLeadersWindow();
    bindHangarChatControls();
    __installHangarChatWatcher();
    __syncHangarChatVisibility();
    
    try{
        const chatWrapper = document.getElementById('chat-wrapper');
        if(chatWrapper && !__hangarChatHomeParent){
            __hangarChatHomeParent = chatWrapper.parentNode;
            __hangarChatHomeNextSibling = chatWrapper.nextSibling;
        }
    }catch(_){}
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
    if(isEndlessSoloBattle()) return;
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
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3,16,16), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0xf4fbff }));
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


function getObserverFollowCandidates(){
    const items = [];
    remoteBattleShips.forEach((entry, entryId) => {
        const mesh = entry?.mesh;
        if(!entryId || !mesh) return;
        if(!mesh.parent) return;
        items.push({
            id: String(entryId),
            mesh,
            distance: mesh.position.distanceTo(observerFreeCameraPosition)
        });
    });
    items.sort((a, b) => a.distance - b.distance);
    return items;
}

function snapObserverCameraToTarget(targetEntry){
    if(!targetEntry?.mesh) return;
    const targetPos = targetEntry.mesh.position.clone();
    observerCameraTarget.copy(targetPos);
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(observerCameraPitch, observerCameraYaw, 0, 'YXZ')).normalize();
    const desiredPos = targetPos.clone()
        .add(new THREE.Vector3(0, 4.5, 0))
        .add(forward.clone().multiplyScalar(-observerCameraDistance));
    observerFreeCameraPosition.copy(desiredPos);
    camera.position.copy(desiredPos);
    camera.lookAt(targetPos);
}

function cycleObserverTarget(){
    if(gameState !== "OBSERVE" && !battleObserverMode) return;
    const candidates = getObserverFollowCandidates();
    if(!candidates.length) return;

    const currentIndex = candidates.findIndex(item => item.id === observerFollowTargetId);
    const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % candidates.length
        : 0;

    const selected = candidates[nextIndex];
    observerFollowTargetId = selected.id;
    observerCycleCursor = nextIndex;
    snapObserverCameraToTarget(selected);
}

function setupObserverBattle(mapName){
    clearBattleScene();
    battleObserverMode = true;
    observerCameraYaw = 0;
    observerCameraPitch = 0;
    observerCameraDistance = 34;
    observerFollowTargetId = '';
    observerCycleCursor = -1;
    enterBattleMap(mapName);
    observerBots = [];
    observerFreeCameraPosition.set(0, 12, 38);
    observerCameraTarget.set(0, 0, 0);
    camera.position.copy(observerFreeCameraPosition);
    const hud = document.getElementById('enemy-hud');
    if(hud) hud.style.display = 'none';
    const observerName = String(player?.nickname || 'Commander').trim() || 'Commander';
    pushKillFeed(`${observerName} наблюдает за игрой`, 'chat');
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
    if(keys.shift) move.addScaledVector(up, -1);

    if(move.lengthSq() > 0){
        move.normalize().multiplyScalar(flySpeed);
        observerFreeCameraPosition.add(move);
        observerFollowTargetId = '';
        observerCycleCursor = -1;
    }

    if(observerFollowTargetId){
        const followed = remoteBattleShips.get(observerFollowTargetId);
        const followedMesh = followed?.mesh;
        if(followedMesh && followedMesh.parent){
            const focus = followedMesh.position.clone();
            observerCameraTarget.lerp(focus, 0.24);
            const desiredPos = observerCameraTarget.clone()
                .add(new THREE.Vector3(0, 4.5, 0))
                .add(forward.clone().multiplyScalar(-observerCameraDistance));
            observerFreeCameraPosition.lerp(desiredPos, 0.32);
            camera.position.copy(observerFreeCameraPosition);
            camera.lookAt(observerCameraTarget);
            return;
        }
        observerFollowTargetId = '';
        observerCycleCursor = -1;
    }

    camera.position.copy(observerFreeCameraPosition);
    camera.lookAt(observerFreeCameraPosition.clone().add(forward.multiplyScalar(80)));
}

function fireObserverLaser(shooter, target){
    const dir = target.position.clone().sub(shooter.position).normalize();
    [-0.8,0.8].forEach(offsetX => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,1.6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color:0xfff1a8 }));
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
    if(crystalEl){
        crystalEl.classList.add('premium-item','currency-item');
        crystalEl.childNodes.forEach(node => {
            if(node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()) node.textContent = '';
        });
        crystalEl.querySelectorAll(':scope > .premium-currency-text').forEach(node => node.remove());
        const textNode = document.createElement('span');
        textNode.className = 'premium-currency-text';
        textNode.textContent = `💎 ${playerResources?.crystals || 0}`;
        crystalEl.prepend(textNode);
    }
    if(coinsEl){
        coinsEl.classList.add('premium-item','currency-item');
        coinsEl.childNodes.forEach(node => {
            if(node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()) node.textContent = '';
        });
        coinsEl.querySelectorAll(':scope > .premium-currency-text').forEach(node => node.remove());
        const textNode = document.createElement('span');
        textNode.className = 'premium-currency-text';
        textNode.textContent = `🟡 ${playerResources?.coins || 0}`;
        coinsEl.prepend(textNode);
    }
    ensurePremiumCurrencyUi?.();
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
    try{ stopRemotePlayerSync?.(); }catch(_e){}
    try{ window.supabaseClient?.auth?.signOut?.(); }catch(_e){}
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

    try{ document.body.classList.remove('cosmic-auth-passed','cosmic-in-lobby','cosmic-in-battle'); document.body.classList.add('cosmic-in-auth'); }catch(_e){}
    try{ resetBattleInputState?.(); }catch(_e){}
    try{ applyAuthUIState(message); }catch(_e){}

    try{ switchState('AUTH'); }catch(_e){}

    const authScreen = document.getElementById('auth-screen');
    const lobby = document.getElementById('lobby-screen');
    const topNav = document.getElementById('top-nav');
    const premiumBar = document.getElementById('premium-bar');
    const battleScreen = document.getElementById('battle-screen');
    const canvas = document.querySelector('canvas');

    if(authScreen){
        authScreen.classList.remove('hidden');
        authScreen.style.setProperty('display', 'flex', 'important');
        authScreen.style.setProperty('visibility', 'visible', 'important');
        authScreen.style.setProperty('pointer-events', 'auto', 'important');
    }
    if(lobby) lobby.style.setProperty('display', 'none', 'important');
    if(topNav) topNav.style.setProperty('display', 'none', 'important');
    if(premiumBar) premiumBar.style.setProperty('display', 'none', 'important');
    if(battleScreen) battleScreen.style.setProperty('display', 'none', 'important');
    if(canvas) canvas.style.setProperty('display', 'none', 'important');

    try{ window.gameState = 'AUTH'; }catch(_e){}
    gameState = 'AUTH';
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
    clearBattleKillFeed?.();
                    clearBattleBotNameLabels?.();
    switchState('LOBBY');
}
function registerLocalAccount(){
    const nickname = document.getElementById('register-nickname')?.value?.trim() || '';
    const email = document.getElementById('register-email')?.value?.trim().toLowerCase() || '';
    const password = document.getElementById('register-password')?.value || '';
    const country = document.getElementById('register-country')?.value || '';
    const day = document.getElementById('register-birth-day')?.value || '';
    const month = document.getElementById('register-birth-month')?.value || '';
    const year = document.getElementById('register-birth-year')?.value || '';
    const registerMessage = document.getElementById('register-message');

    const setRegisterMessage = (text = '') => {
        if(registerMessage) registerMessage.textContent = text;
        showAuthMessage(text);
    };

    if(!nickname || nickname.length < 3){
        setRegisterMessage('Введите ник минимум 3 символа.');
        return;
    }
    if(!email || !password){
        setRegisterMessage('Введите email и пароль.');
        return;
    }
    if(password.length < 6){
        setRegisterMessage('Пароль должен быть минимум 6 символов.');
        return;
    }
    if(!country){
        setRegisterMessage('Выберите страну.');
        return;
    }
    if(!day || !month || !year){
        setRegisterMessage('Укажите дату рождения.');
        return;
    }

    const birthDate = `${year}-${month}-${day}`;

    (async () => {
        try{
            setRegisterMessage('Проверка почты...');

            if(window.supabaseClient){
                try{
                    const existingPlayer = await window.supabaseClient
                        .from('players')
                        .select('email')
                        .eq('email', email)
                        .maybeSingle();

                    if(existingPlayer?.data?.email){
                        setRegisterMessage('Эта почта уже зарегистрирована.');
                        return;
                    }
                }catch(checkErr){
                    console.warn('Проверка email через players не удалась:', checkErr?.message || checkErr);
                }
            }

            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nickname: nickname.slice(0, 20),
                        country,
                        birth_date: birthDate
                    }
                }
            });

            if(error){
                const msg = String(error.message || '').toLowerCase();
                if(msg.includes('already') || msg.includes('registered') || msg.includes('exists')){
                    setRegisterMessage('Эта почта уже зарегистрирована.');
                }else{
                    setRegisterMessage('Ошибка регистрации: ' + error.message);
                }
                return;
            }

            const identities = data?.user?.identities;
            if(Array.isArray(identities) && identities.length === 0){
                setRegisterMessage('Эта почта уже зарегистрирована.');
                return;
            }

            try{
                localStorage.setItem(`cosmicPendingProfile:${email}`, JSON.stringify({
                    nickname: nickname.slice(0, 20),
                    country,
                    birth_date: birthDate
                }));
            }catch(_){}

            const loginEmail = document.getElementById('login-email');
            const loginPassword = document.getElementById('login-password');
            if(loginEmail) loginEmail.value = email;
            if(loginPassword) loginPassword.value = password;

            const registerModal = document.getElementById('register-modal');
            if(registerModal) registerModal.classList.add('hidden');

            showAuthMessage('Регистрация успешна. Теперь войди в аккаунт.');
        }catch(err){
            setRegisterMessage('Ошибка регистрации: ' + (err?.message || err));
        }
    })();
}
function confirmEmailCode(){
    showAuthMessage('Код подтверждения больше не используется. Просто войди в аккаунт.');
}
function loginLocalAccount(){
    if(window.__cosmicLoginInProgress) return;
    window.__cosmicLoginInProgress = true;
    const email = document.getElementById('login-email')?.value?.trim().toLowerCase() || '';
    const password = document.getElementById('login-password')?.value || '';
    const remember = document.getElementById('remember-password');
    const loginBtn = document.getElementById('login-btn');

    if(!email || !password){
        window.__cosmicLoginInProgress = false;
        showAuthMessage('Введите email и пароль.');
        return;
    }

    if(loginBtn){
        loginBtn.disabled = true;
        loginBtn.dataset.oldText = loginBtn.textContent || 'Войти';
        loginBtn.textContent = 'Вход...';
    }
    showAuthMessage('Вход...');

    // V390: вход в игру больше не ждёт Supabase/профиль/ресурсы.
    // Проверка аккаунта запускается ниже, но игрок сразу попадает в лобби.
    forceOpenLobbyAfterAuth(email);
    window.__cosmicLoginInProgress = false;
    try{
        if(loginBtn){
            loginBtn.disabled = false;
            loginBtn.textContent = loginBtn.dataset.oldText || 'Войти';
        }
    }catch(_){}

    (async () => {
        try{
            if(!window.supabaseClient){
                console.warn('Supabase ещё не готов, вход выполнен локально.');
                return;
            }

            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if(error){
                console.warn('Фоновая проверка входа не прошла:', error.message);
                return;
            }

            const user = data?.user || null;
            // V389: авторизация уже прошла успешно — сразу пускаем в лобби.
            // Дальнейшая загрузка профиля/ресурсов больше не должна блокировать вход.
            forceOpenLobbyAfterAuth(email);
            try{
                if(loginBtn){
                    loginBtn.disabled = false;
                    loginBtn.textContent = loginBtn.dataset.oldText || 'Войти';
                }
            }catch(_){}
            authState.mode = 'account';
            authState.email = email;
            authState.password = password;
            authState.isAuthenticated = true;
            authState.emailVerified = true;
            authState.pendingVerificationEmail = '';
            authState.pendingVerificationCode = '';

            let nickname = String(user?.user_metadata?.nickname || '').trim() || email.split('@')[0] || 'Pilot';
            let pendingProfile = {};
            try{
                pendingProfile = JSON.parse(localStorage.getItem(`cosmicPendingProfile:${email}`) || '{}') || {};
                if(pendingProfile.nickname) nickname = String(pendingProfile.nickname || '').trim().slice(0, 20) || nickname;
            }catch(_){}

            let playerRow = null;

            try{
                const existingRes = await window.supabaseClient
                    .from('players')
                    .select('public_id,nickname,email,auth_id,level,experience,credits,created_at,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
                    .eq('auth_id', user?.id || '')
                    .maybeSingle();

                if(existingRes?.error){
                    console.warn('Ошибка чтения players по auth_id:', existingRes.error.message);
                }else{
                    playerRow = existingRes?.data || null;
                }
            }catch(readAuthErr){
                console.warn('players auth_id read warning:', readAuthErr?.message || readAuthErr);
            }

            if(!playerRow){
                try{
                    const emailRes = await window.supabaseClient
                        .from('players')
                        .select('public_id,nickname,email,auth_id,level,experience,credits,created_at,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
                        .eq('email', email)
                        .maybeSingle();

                    if(emailRes?.error){
                        console.warn('Ошибка чтения players по email:', emailRes.error.message);
                    }else if(emailRes?.data){
                        playerRow = emailRes.data;
                        if(!playerRow.auth_id && user?.id){
                            try{ await window.supabaseClient.from('players').update({ auth_id: user.id }).eq('public_id', playerRow.public_id); }catch(_){}
                        }
                    }
                }catch(readEmailErr){
                    console.warn('players email read warning:', readEmailErr?.message || readEmailErr);
                }
            }

            if(!playerRow){
                try{
                    const insertRes = await window.supabaseClient
                        .from('players')
                        .insert({
                            auth_id: user?.id,
                            email,
                            nickname,
                            level: player.level || 1,
                            experience: Number(player.experience || 0),
                            credits: Number(playerResources?.coins || player.credits || 500),
                            mercury_ore: Number(playerResources?.mercury_ore || 0),
                            venus_gas: Number(playerResources?.venus_gas || 0),
                            earth_water: Number(playerResources?.earth_water || 0),
                            mars_crystal: Number(playerResources?.mars_crystal || 0),
                            jupiter_hydrogen: Number(playerResources?.jupiter_hydrogen || 0),
                            saturn_ice: Number(playerResources?.saturn_ice || 0),
                            uranus_ammonia: Number(playerResources?.uranus_ammonia || 0),
                            neptune_methane: Number(playerResources?.neptune_methane || 0),
                            solar_energy: Number(playerResources?.solar_energy || 0),
                            crystals: Number(playerResources?.crystals || 0),
                            created_at: new Date().toISOString()
                        })
                        .select('public_id,nickname,email,auth_id,level,experience,credits,created_at,staff_role,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,crystals')
                        .single();

                    if(insertRes?.error){
                        console.warn('Ошибка создания players при входе:', insertRes.error.message);
                    }else{
                        playerRow = insertRes?.data || null;
                    }
                }catch(insertErr){
                    console.warn('players insert warning:', insertErr?.message || insertErr);
                }
            }

            authState.playerId = Number(playerRow?.public_id) || 0;
            player.id = authState.playerId || 0;
            player.nickname = playerRow?.nickname || nickname;
            player.level = Number(playerRow?.level || player.level || 1);
            player.experience = Number(playerRow?.experience || player.experience || 0);
            player.credits = Number(playerRow?.credits || player.credits || 500);

            try{ applyPlayerIdentityRow(playerRow || { public_id: authState.playerId, staff_role: 'player' }); updateAuthServerVisibility?.(); }catch(identityErr){ console.warn('identity warning:', identityErr?.message || identityErr); }

            if(remember?.checked){
                localStorage.setItem('cosmicRememberedEmail', email);
                localStorage.setItem('cosmicRememberedPassword', password);
            }else{
                localStorage.removeItem('cosmicRememberedEmail');
                localStorage.removeItem('cosmicRememberedPassword');
            }

            try{ resetPlayerProgress(); }catch(resetErr){ console.warn('reset warning:', resetErr?.message || resetErr); }
            try{ await loadGame(); }catch(loadErr){ console.warn('loadGame auth warning:', loadErr?.message || loadErr); }
            try{ await loadPlayerResourcesFromSupabase(); }catch(resErr){ console.warn('loadPlayerResources auth warning:', resErr?.message || resErr); }
            try{ startRemotePlayerSync(); }catch(syncErr){ console.warn('remote sync auth warning:', syncErr?.message || syncErr); }

            window.currentRoomId = null;
            try{ updateNicknameSettingsState(); }catch(_){}
            try{ updatePremiumAccountInfo(); }catch(_){}
            try{ renderProfileStats?.(); }catch(_){}
            try{ clearBattleKillFeed?.(); }catch(_){}
            try{ clearBattleBotNameLabels?.(); }catch(_){}

            switchState('LOBBY');

            try{ saveGame(); }catch(saveErr){ console.warn('save warning:', saveErr?.message || saveErr); }
            try{ localStorage.removeItem(`cosmicPendingProfile:${email}`); }catch(_){}
            showAuthMessage('');
        }catch(err){
            console.warn('Фоновая авторизация завершилась предупреждением:', err?.message || err);
        }finally{
            window.__cosmicLoginInProgress = false;
            if(loginBtn){
                loginBtn.disabled = false;
                loginBtn.textContent = loginBtn.dataset.oldText || 'Войти';
            }
        }
    })();
}
function showForgotPassword(){
    const email = document.getElementById('login-email')?.value?.trim() || '';
    if(!email){ showAuthMessage('Сначала введи email, затем нажми «Забыли пароль?»'); return; }
    showAuthMessage(`Восстановление пароля для ${email} будет доступно позже.`);
}
function initAuthScreen(){
    ensureDeveloperAccount();
    window.cosmicLoginNow = loginLocalAccount;
    window.cosmicRegisterNow = registerLocalAccount;
    applyAuthUIState('');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
        const forgotBtn = document.getElementById('forgot-password-btn');
    const verifyBtn = document.getElementById('verify-email-btn');
    const openRegisterBtn = document.getElementById('open-register');
    const registerModal = document.getElementById('register-modal');
    const closeRegisterBtn = document.getElementById('close-register-modal');
    const serverCurrent = document.getElementById('auth-server-current');
    const serverList = document.getElementById('auth-server-list');
    try{ updateAuthServerVisibility(); }catch(_){}
    const birthDay = document.getElementById('register-birth-day');
    const birthYear = document.getElementById('register-birth-year');
    if(birthDay && !birthDay.dataset.filled){
        birthDay.dataset.filled = '1';
        for(let d = 1; d <= 31; d++){
            const opt = document.createElement('option');
            opt.value = String(d).padStart(2, '0');
            opt.textContent = String(d);
            birthDay.appendChild(opt);
        }
    }
    if(birthYear && !birthYear.dataset.filled){
        birthYear.dataset.filled = '1';
        const nowYear = new Date().getFullYear();
        for(let y = nowYear - 7; y >= nowYear - 100; y--){
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            birthYear.appendChild(opt);
        }
    }
    if(openRegisterBtn && !openRegisterBtn.dataset.bound){
        openRegisterBtn.dataset.bound='1';
        openRegisterBtn.addEventListener('click', () => { if(registerModal) registerModal.classList.remove('hidden'); });
    }
    if(closeRegisterBtn && !closeRegisterBtn.dataset.bound){
        closeRegisterBtn.dataset.bound='1';
        closeRegisterBtn.addEventListener('click', () => { if(registerModal) registerModal.classList.add('hidden'); });
    }
    if(registerModal && !registerModal.dataset.bound){
        registerModal.dataset.bound='1';
        registerModal.addEventListener('click', (e) => { if(e.target === registerModal) registerModal.classList.add('hidden'); });
    }
    if(serverCurrent && serverList && !serverCurrent.dataset.bound){
        serverCurrent.dataset.bound='1';
        serverCurrent.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            serverList.classList.toggle('hidden');
            serverCurrent.setAttribute('aria-expanded', serverList.classList.contains('hidden') ? 'false' : 'true');
        });
        serverList.querySelectorAll('.auth-server-option').forEach(btn => {
            btn.addEventListener('click', () => {
                if(btn.disabled || btn.classList.contains('hidden') || btn.style.display === 'none') return;
                serverList.querySelectorAll('.auth-server-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const dot = btn.querySelector('.server-dot')?.cloneNode(true);
                const text = btn.textContent.trim();
                serverCurrent.innerHTML = '';
                if(dot) serverCurrent.appendChild(dot);
                const span = document.createElement('span');
                span.textContent = text;
                serverCurrent.appendChild(span);
                const arrow = document.createElement('span');
                arrow.className = 'server-arrow';
                arrow.textContent = '⌄';
                serverCurrent.appendChild(arrow);
                serverList.classList.add('hidden');
                serverCurrent.setAttribute('aria-expanded', 'false');
            });
        });
    }

    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    const registerNickname = document.getElementById('register-nickname');
    const registerCountry = document.getElementById('register-country');
    const verifyCode = document.getElementById('verify-code');
    if(loginBtn && !loginBtn.dataset.bound){
        loginBtn.dataset.bound='1';
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginLocalAccount();
        });
    }
    if(registerBtn && !registerBtn.dataset.bound){ registerBtn.dataset.bound='1'; registerBtn.addEventListener('click', registerLocalAccount); }
    if(forgotBtn && !forgotBtn.dataset.bound){ forgotBtn.dataset.bound='1'; forgotBtn.addEventListener('click', showForgotPassword); }
    if(verifyBtn && !verifyBtn.dataset.bound){ verifyBtn.dataset.bound='1'; verifyBtn.addEventListener('click', confirmEmailCode); }
    [loginEmail, loginPassword].forEach((el) => {
        if(el && !el.dataset.enterBound){
            el.dataset.enterBound='1';
            el.addEventListener('keydown', (e) => { if(e.key === 'Enter') loginLocalAccount(); });
        }
    });
    [registerNickname, registerEmail, registerPassword, registerCountry, birthDay, birthYear].forEach((el) => {
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
    const limit = isEndlessSoloBattle() ? getEndlessCombatRadius() : 760;
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
        if(premiumCrystals || premiumCoins){
            updatePremiumAccountInfo();
            ensurePremiumCurrencyUi?.();
        }
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
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
                color: 0xff8c22,
                transparent: true,
                opacity: 0.22,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );

        const coreTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 54, Math.max(0.45, radius * 0.0038), 12, false),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
                color: 0xfff1a8,
                transparent: true,
                opacity: 0.82,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );

        const haloTube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 40, Math.max(2.1, radius * 0.016), 10, false),
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
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

        const endlessSoloMap = isEndlessSoloBattle();
        const isSunMap = mapKey === 'sun';
        if(endlessSoloMap){
            createBattleSolarSystemView?.();
            battleMapPlanet = null;
        }else{
        const planetGeometry = new THREE.SphereGeometry(config.size, 64, 64);
        const planetMaterial = isSunMap
        ? new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
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
                new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
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
                new THREE.MeshBasicMaterial({ side: THREE.DoubleSide,
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

        if(!endlessSoloMap && mapKey === 'saturn'){
            const ringGeo = new THREE.RingGeometry(config.size * 1.42, config.size * 2.2, 128);
            const ringMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0xd9c08a, side: THREE.DoubleSide, transparent:true, opacity:0.66 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2.38;
            battleMapPlanet.add(ring);
        }
        }

        spawnPointA = endlessSoloMap ? new THREE.Vector3(0, 0, 240) : new THREE.Vector3(-320, 12, 260);
        spawnPointB = endlessSoloMap ? new THREE.Vector3(520, 90, -520) : new THREE.Vector3(320, -16, -260);
        if(battleMapPlanet) observerCameraTarget.copy(battleMapPlanet.position);
        else observerCameraTarget.set(0, -90, -720);
        battlePlanetVisualScale = 1;
        camera.position.set(0, 30, 150);
        camera.lookAt(0, 0, 0);
        if(!endlessSoloMap) createBattleObstacles(mapKey);
        updateBattleScoreboard();
    };

    createBattleObstacles = function(mapKey){
        clearBattleObstacles();
        if(isEndlessSoloBattle()) return;
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
        const limit = isEndlessSoloBattle() ? getEndlessCombatRadius() : 1320;
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
        { title:'Патруль Юпитера', real:'jupiter', img:'jupiter', mode:'Solo', mission:'Выжить в тяжёлом секторе', players:'1/1', minLevel:20, maxLevel:60 },
        { title:'Бесконечный бой', real:'solar', img:'sun', mode:'Solo ∞', mission:'Бесконечная охота на усиленные НЛО', players:'1/1', minLevel:1, maxLevel:120, endless:true }
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
                currentRoom = { map: entry.real, state: mode, solo: mode === 'solo', title: entry.title, mission: entry.mission || '', goalKills: entry.goalKills || 6, playerLives: entry.playerLives || 5, minLevel: entry.minLevel || 1, endless: !!entry.endless };
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
                markCosmicBattleEnterAllowedV444?.();
                const selected = selectedLobbyMap || getCurrentLobbyDataset()[0];
                currentRoom = {
                    map: selected.real,
                    state: lobbyMode,
                    solo: lobbyMode === 'solo',
                    goalKills: selectedLobbyMap?.goalKills || 6,
                    playerLives: selectedLobbyMap?.playerLives || 5,
                    endless: !!selectedLobbyMap?.endless,
                    title: selected.title,
                    mission: selected.mission || '',
                    players: []
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
        { id:'fighters', name:'Корпуса ангара', subtitle:'Купить корпус и отправить его в ангар', badge:'Ангар' }
    ],
    shipsByType: {
        fighters: [
            { id:'scout_1', type:'ship', classId:'fighters', tier:'Основной корпус', name:'Cargo Drone', subtitle:'3D модель из ships/Spaceship.glb', badge:'Основной корпус', price:0, description:'Стартовый корпус ангара. Использует загруженную 3D модель Spaceship.glb и остаётся у игрока как базовый корабль.', stats:[['Скорость','9.2'],['Броня','3.2'],['Манёвр','7.4'],['Энергия','5.4'],['Слоты','Пушка / Щит / Ускоритель']], art:'external_glb', modelPath:'ships/Spaceship.glb', neon:'#76f7ff', engine:'#59c7ff', weapon:'laser', accent:'#7a8cff' },
            { id:'xwing_1', type:'ship', classId:'fighters', tier:'Тестовый корпус', name:'T-65 X-Wing', subtitle:'3D модель из ships/T-65 X-Wing.glb', badge:'Тест покупки', price:900, description:'Тестовый второй корпус для проверки магазина и ангара. После покупки должен исчезнуть из магазина и появиться на боковой платформе ангара.', stats:[['Скорость','11.4'],['Броня','4.1'],['Манёвр','8.8'],['Энергия','6.2'],['Слоты','Пушка / Щит / Ускоритель']], art:'external_glb', modelPath:'ships/T-65 X-Wing.glb', neon:'#8fe6ff', engine:'#5bb7ff', weapon:'laser', accent:'#ff6b6b' }
        ],
        tanks: [],
        assault: [],
        technology: [],
        universal: []
    },
    moduleTypes: [
        { id:'weapon', name:'Пушки', subtitle:'Тип снаряда и урон' },
        { id:'shield', name:'Энергощиты', subtitle:'Выживание и запас HP' },
        { id:'booster', name:'Ускорители', subtitle:'Скорость и рывок' }
    ],
    modulesByType: {
        weapon: [
            { id:'weapon_laser_s1', type:'module', classId:'weapon', tier:'Базовая', name:'Лазерная пушка S1', subtitle:'Ровный красный лазер', badge:'Пушки', price:260, description:'Базовая лазерная батарея. Универсальное оружие без перекосов — хороший старт для любого корпуса.', stats:[['Урон','Стабильный'],['Темп','Средний'],['Тип','Лазер'],['Слот','Пушка']], art:'matrix', weaponKind:'laser', damageMult:1.0, cooldownMult:1.0, projectileScaleBonus:0.0 },
            { id:'weapon_pulse_m2', type:'module', classId:'weapon', tier:'Редкая', name:'Импульсная пушка M2', subtitle:'Двойной темп', badge:'Пушки', price:420, description:'Импульсное орудие с более частыми снарядами. Хорошо заходит на скоростных и маневренных корпусах.', stats:[['Урон','Ниже'],['Темп','Высокий'],['Тип','Импульс'],['Слот','Пушка']], art:'plasma', weaponKind:'pulse', damageMult:0.96, cooldownMult:0.82, projectileScaleBonus:0.06 },
            { id:'weapon_beam_x3', type:'module', classId:'weapon', tier:'Эпическая', name:'Лучевая пушка X3', subtitle:'Дальний пробой', badge:'Пушки', price:620, description:'Точный длинный луч с хорошей скоростью полёта. Отличен для спокойной игры и подстрела на дистанции.', stats:[['Урон','Выше'],['Темп','Ниже'],['Тип','Луч'],['Слот','Пушка']], art:'phase', weaponKind:'beam', damageMult:1.14, cooldownMult:1.1, projectileScaleBonus:0.12 },
            { id:'weapon_plasma_r4', type:'module', classId:'weapon', tier:'Легендарная', name:'Плазменная пушка R4', subtitle:'Тяжёлый выстрел', badge:'Пушки', price:860, description:'Плотный плазменный заряд. Медленнее и тяжелее, но ощущается сочнее и бьёт больнее.', stats:[['Урон','Высокий'],['Темп','Ниже'],['Тип','Плазма'],['Слот','Пушка']], art:'plasma', weaponKind:'plasma', damageMult:1.22, cooldownMult:1.08, projectileScaleBonus:0.18 }
        ],
        shield: [
            { id:'shield_micro_s1', type:'module', classId:'shield', tier:'Базовый', name:'Микрощит S1', subtitle:'Стартовая защита', badge:'Энергощиты', price:240, description:'Самый простой энергощит. Даёт небольшой прирост HP и помогает пережить первые размены.', stats:[['HP','+12%'],['Поглощение','Низкое'],['Тип','Щит'],['Слот','Защита']], art:'shield', hpMult:1.12, dampingBonus:0.001 },
            { id:'shield_field_m2', type:'module', classId:'shield', tier:'Редкий', name:'Полевой щит M2', subtitle:'Уплотнение контура', badge:'Энергощиты', price:390, description:'Более плотный энергоконтур. Корпус получает заметно больше живучести без сильной потери динамики.', stats:[['HP','+18%'],['Поглощение','Среднее'],['Тип','Щит'],['Слот','Защита']], art:'shield', hpMult:1.18, dampingBonus:0.002 },
            { id:'shield_bulwark_x', type:'module', classId:'shield', tier:'Эпический', name:'Щит Bulwark-X', subtitle:'Толстый фронт', badge:'Энергощиты', price:610, description:'Тяжёлый энергощит с большим бонусом к HP. Особенно хорош для бронированных корпусов и штурма.', stats:[['HP','+26%'],['Поглощение','Высокое'],['Тип','Щит'],['Слот','Защита']], art:'phase', hpMult:1.26, dampingBonus:0.003 },
            { id:'shield_singularity', type:'module', classId:'shield', tier:'Легендарный', name:'Щит Singularity', subtitle:'Максимум выживания', badge:'Энергощиты', price:880, description:'Самый мощный из доступных щитов. Очень заметно повышает прочность и удерживает инерцию под огнём.', stats:[['HP','+34%'],['Поглощение','Очень высокое'],['Тип','Щит'],['Слот','Защита']], art:'reactor', hpMult:1.34, dampingBonus:0.004 }
        ],
        booster: [
            { id:'booster_ion_s1', type:'module', classId:'booster', tier:'Базовый', name:'Ионный ускоритель S1', subtitle:'Стартовый разгон', badge:'Ускорители', price:240, description:'Простой ускоритель для базового корпуса. Добавляет скорости и делает отклик приятнее.', stats:[['Скорость','+10%'],['Разгон','+8%'],['Тип','Ускоритель'],['Слот','Двигатель']], art:'speed', speedMult:1.1, accelMult:1.08, turnMult:1.03 },
            { id:'booster_vector_m2', type:'module', classId:'booster', tier:'Редкий', name:'Векторный ускоритель M2', subtitle:'Живой разворот', badge:'Ускорители', price:410, description:'Добавляет заметную динамику и помогает быстрее менять направление. Хороший выбор почти под все корпуса.', stats:[['Скорость','+14%'],['Разгон','+12%'],['Тип','Ускоритель'],['Слот','Двигатель']], art:'speed', speedMult:1.14, accelMult:1.12, turnMult:1.05 },
            { id:'booster_afterburn_x', type:'module', classId:'booster', tier:'Эпический', name:'Afterburn-X', subtitle:'Форсажная катушка', badge:'Ускорители', price:640, description:'Мощный ускоритель для скоростных и маневренных корпусов. Даёт очень бодрый разгон и хороший крен.', stats:[['Скорость','+18%'],['Разгон','+16%'],['Тип','Ускоритель'],['Слот','Двигатель']], art:'plasma', speedMult:1.18, accelMult:1.16, turnMult:1.07 },
            { id:'booster_void_rush', type:'module', classId:'booster', tier:'Легендарный', name:'Void Rush', subtitle:'Пиковый форсаж', badge:'Ускорители', price:920, description:'Максимальный ускоритель для топовых сборок. Очень сильно поднимает темп движения и живость корпуса.', stats:[['Скорость','+22%'],['Разгон','+20%'],['Тип','Ускоритель'],['Слот','Двигатель']], art:'phase', speedMult:1.22, accelMult:1.2, turnMult:1.08 }
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
        showCurrencyDelta?.('coins', -modulePrice);
        player.ownedModuleIds.push(module.id);
        player.ownedModuleIds = Array.from(new Set(player.ownedModuleIds));
    }

    toggleShipModule(module.id, player.selectedShipId || 'scout_1');
    currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || '');
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
    saveGame?.();
    window.renderShopScreen?.();
    renderHangarIfOpen?.();
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
    player.selectedShipId = safeId; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){}
    currentBattleShipStats = computeShipBattleStats(safeId);
    refreshOwnedShipsInventory?.();
    saveGame?.();
    const nextShips = getCurrentShopShips();
    shopState.selectedId = nextShips[0]?.id || '';
    window.renderShopScreen?.();
    renderHangarIfOpen?.();
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
    if(coinPrice > 0) showCurrencyDelta?.('coins', -coinPrice);
    if(diamondPrice > 0) showCurrencyDelta?.('crystals', -diamondPrice);
    player.ownedShipIds.push(ship.id);
    player.ownedShipIds = Array.from(new Set(player.ownedShipIds));
    ensureHangarDockAssignments?.();

    const previousSelectedShipId = String(player.selectedShipId || 'scout_1').trim() || 'scout_1';
    player.selectedShipId = previousSelectedShipId; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){}
    if(!player.activeModulesByShip || typeof player.activeModulesByShip !== 'object') player.activeModulesByShip = {};
    if(!player.activeModulesByShip[ship.id] || typeof player.activeModulesByShip[ship.id] !== 'object') player.activeModulesByShip[ship.id] = {};
    const defaultWeapon = player.ownedModuleIds.find(id => getModuleById(id)?.classId === 'weapon') || '';
    const defaultShield = player.ownedModuleIds.find(id => getModuleById(id)?.classId === 'shield') || '';
    const defaultBooster = player.ownedModuleIds.find(id => getModuleById(id)?.classId === 'booster') || '';
    if(defaultWeapon && !player.activeModulesByShip[ship.id].weapon) player.activeModulesByShip[ship.id].weapon = defaultWeapon;
    if(defaultShield && !player.activeModulesByShip[ship.id].shield) player.activeModulesByShip[ship.id].shield = defaultShield;
    if(defaultBooster && !player.activeModulesByShip[ship.id].booster) player.activeModulesByShip[ship.id].booster = defaultBooster;
    refreshOwnedShipsInventory?.();
    updatePremiumAccountInfo?.();
    updateHUD?.();
    updateUI?.();
    saveGame?.();
    const nextShips = getCurrentShopShips();
    shopState.selectedId = nextShips[0]?.id || '';
    window.renderShopScreen?.();
    renderHangarIfOpen?.();
    return true;
}

const shopState = {
    open:false,
    view:'ships',
    shipType:'fighters',
    moduleType:'weapon',
    selectedId:'scout_1'
};
ensureShopOwnershipDefaults();
refreshOwnedShipsInventory();

function getCurrentShopShips(){
    const list = SHOP_DATA.shipsByType[shopState.shipType] || [];
    return list.filter(item => !isOwnedShip(item.id));
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
    const activeMainView = shopState.view === 'ships'
        ? 'ships'
        : (shopState.moduleType === 'weapon' ? 'weapons' : 'modules');
    wrap.innerHTML = `
        <button type="button" class="shop-switch-btn ${activeMainView === 'ships' ? 'active' : ''}" data-shop-view="ships">Корпуса</button>
        <button type="button" class="shop-switch-btn ${activeMainView === 'weapons' ? 'active' : ''}" data-shop-view="weapons">Пушки</button>
        <button type="button" class="shop-switch-btn ${activeMainView === 'modules' ? 'active' : ''}" data-shop-view="modules">Модули</button>
    `;
    wrap.querySelectorAll('[data-shop-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextView = String(btn.dataset.shopView || 'ships');
            if(nextView === 'ships'){
                shopState.view = 'ships';
            }else if(nextView === 'weapons'){
                shopState.view = 'modules';
                shopState.moduleType = 'weapon';
            }else{
                shopState.view = 'modules';
                if(shopState.moduleType === 'weapon') shopState.moduleType = 'shield';
            }
            const nextList = shopState.view === 'ships' ? getCurrentShopShips() : getCurrentShopModules();
            shopState.selectedId = nextList[0]?.id || '';
            renderShopScreen();
        });
    });
    if(shop){
        shop.classList.toggle('shop-ships-only', shopState.view === 'ships');
        shop.classList.toggle('shop-modules-only', shopState.view !== 'ships');
    }
}


function renderShopTypeTabs(){
    const wrap = document.getElementById('shop-type-tabs');
    const typeLabel = document.getElementById('shop-type-label');
    const moduleWrap = document.getElementById('shop-module-type-tabs');
    const moduleLabel = document.getElementById('shop-module-type-label');
    if(!wrap) return;

    if(typeLabel) typeLabel.textContent = 'Типы корпусов';
    wrap.innerHTML = SHOP_DATA.types.map(type => `
        <button type="button" class="shop-type-tab ${shopState.view === 'ships' && shopState.shipType === type.id ? 'active' : ''}" data-shop-type="${type.id}">
            <span class="shop-type-name">${type.name}</span>
            <span class="shop-type-sub">${type.subtitle}</span>
        </button>
    `).join('');

    if(moduleLabel) moduleLabel.textContent = 'Оборудование';
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
            shopState.moduleType = btn.dataset.shopModuleType || 'weapon';
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
            title:(activeModuleType?.name || 'ОБОРУДОВАНИЕ').toUpperCase(),
            subtitle:'Покупай детали отдельно и ставь их на активный корпус'
        };
    }
    const activeType = SHOP_DATA.types.find(type => type.id === shopState.shipType) || SHOP_DATA.types[0];
    return {
        title:(activeType?.name || 'КОРПУСА').toUpperCase(),
        subtitle:'Собери машину из корпуса, пушки, щита и ускорителя'
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
        wrap.innerHTML = shopState.view === 'ships' ? '<div class="shop-empty">Все корпуса этого типа уже куплены.</div>' : '<div class="shop-empty">Тут пока пусто.</div>';
        return;
    }

    wrap.innerHTML = list.map((item, index) => {
        const selected = shopState.selectedId === item.id;
        const cols = splitItemStats(item);
        const owned = item.type === 'ship' ? isOwnedShip(item.id) : isOwnedModule(item.id);
        const coinPrice = item.type === 'ship' ? getShipCoinPrice(item) : Number(item.price || 0);
        const diamondPrice = item.type === 'ship' ? getShipDiamondPrice(item) : 0;
        const priceLine = item.type === 'ship'
            ? `<div class="shop-price-line"><span class="shop-price-chip"><span class="shop-coin">🟡</span>${coinPrice}</span><span class="shop-price-chip"><span class="shop-coin">💎</span>${diamondPrice}</span></div>`
            : (item.price ? `<div class="shop-price-line"><span class="shop-price-chip"><span class="shop-coin">🟡</span>${item.price}</span></div>` : '');
        const moduleInstalled = item.type === 'module' && !!getInstalledModuleForType(player?.selectedShipId || '', item.classId || '');
        const buyText = item.type === 'module'
            ? (owned ? (moduleInstalled && getInstalledModuleForType(player?.selectedShipId || '', item.classId || '')?.id === item.id ? 'Снять' : 'Оснастить') : 'Купить')
            : 'Купить корпус';

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
              <div class="shop-col-title">${item.type === 'ship' ? 'Характеристики корпуса' : 'Параметры'}</div>
              ${(cols.left || []).map(([k,v]) => `<div class="shop-stat"><strong>${k}:</strong> ${v}</div>`).join('')}
            </div>
            <div class="shop-stats-col">
              <div class="shop-col-title">${item.type === 'ship' ? 'Слоты и база' : 'Слот и класс'}</div>
              ${(cols.right || []).map(([k,v]) => `<div class="shop-stat"><strong>${k}:</strong> ${v}</div>`).join('')}
            </div>
            <div class="shop-buy-wrap">
              <div class="shop-type-badge">${owned ? 'Куплено • ' : ''}${item.tier}</div>
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
    if(!open){ shopState.view = 'ships'; shopState.moduleType = 'weapon'; }
    try{ updateLobbyTabStyles?.(); }catch(_){ }
    if(open) renderShopScreen();
}

function openShopView(){
    if(gameState !== 'LOBBY') clearBattleKillFeed?.();
                    clearBattleBotNameLabels?.();
    switchState('LOBBY');
    shopState.view = 'ships';
    shopState.selectedId = getCurrentShopShips()[0]?.id || '';
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
                if(gameState !== 'LOBBY') clearBattleKillFeed?.();
                    clearBattleBotNameLabels?.();
    switchState('LOBBY');
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
                if(gameState !== 'LOBBY') clearBattleKillFeed?.();
                    clearBattleBotNameLabels?.();
    switchState('LOBBY');
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
    switchState = async function(newState){
        if(newState === 'BATTLE' && gameState === 'LOBBY' && !isCosmicBattleEnterAllowedV444()){
            console.warn('BATTLE enter blocked: нет явного нажатия входа в бой');
            return;
        }
        await prevSwitchState(newState);
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
        { title:'Тяжёлый Юпитер', real:'jupiter', img:'jupiter', mode:'Solo', mission:'Выжить в зоне тяжёлых турелей', players:'1/1', minLevel:20, maxLevel:60, goalKills:20 },
        { title:'Бесконечный бой', real:'solar', img:'sun', mode:'Solo ∞', mission:'Бесконечная охота на усиленные НЛО во всей солнечной системе', players:'1/1', minLevel:1, maxLevel:120, goalKills:999999, playerLives:999999, endless:true }
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

    // ===== V383 STRICT LOBBY MODE FILTER =====
    function isSoloLobbyEntryV383(entry = {}){
        try{
            const modeText = String(entry?.mode || entry?.state || '').toLowerCase();
            const titleText = String(entry?.title || '').toLowerCase();
            const hasSoloText = modeText.includes('solo') || titleText.includes('бесконечный бой');
            return !!(
                entry?.solo === true ||
                entry?.private === true ||
                entry?.endless === true ||
                entry?.mission ||
                modeText === 'solo' ||
                hasSoloText
            );
        }catch(_){
            return false;
        }
    }

    function isPublicBattleLobbyEntryV383(entry = {}){
        return !!entry && !isSoloLobbyEntryV383(entry);
    }

    function getBattleMaps(){
        const liveRooms = Array.isArray(supabaseBattleRoomsCache)
            ? supabaseBattleRoomsCache.filter(room => room && room.id && !isPublicBattleRoom(room.rawRoom || room) && isPublicBattleLobbyEntryV383(room))
            : [];

        const sortedLiveRooms = liveRooms
            .slice()
            .sort((a, b) => {
                const aTime = new Date(a?.rawRoom?.created_at || 0).getTime();
                const bTime = new Date(b?.rawRoom?.created_at || 0).getTime();
                return bTime - aTime;
            });

        const baseMaps = (typeof LOBBY_MAP_DATA !== 'undefined' && Array.isArray(LOBBY_MAP_DATA))
            ? LOBBY_MAP_DATA
                .filter(item => isPublicBattleLobbyEntryV383(item))
                .map(item => ({
                    ...item,
                    solo: false,
                    private: false,
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

        return [...sortedLiveRooms, ...baseMaps].filter(isPublicBattleLobbyEntryV383);
    }

    function getTournamentMaps(){
        return tournamentRooms;
    }

    function getCurrentDataset(){
        if(lobbyModeV27 === 'solo') return SOLO_DATA.map(entry => ({ ...entry, solo:true, private:true, state:'solo' }));
        if(lobbyModeV27 === 'tournament') return getTournamentMaps().filter(entry => !isSoloLobbyEntryV383(entry));
        return getBattleMaps().filter(isPublicBattleLobbyEntryV383);
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
        mode = (mode === 'solo' || mode === 'tournament' || mode === 'battle') ? mode : 'battle';
        lobbyModeV27 = mode;
        window.setLobbyModeV27?.(mode);
        const list = document.getElementById('match-list');
        const joinBtn = document.getElementById('join-match-btn');
        const observeBtn = document.getElementById('observe-match-btn');
        const createBtn = document.getElementById('create-match-btn');
        if(!list) return;
        setModeTabUI();
        list.innerHTML = '';
        let dataset = getCurrentDataset();
        if(mode === 'battle') dataset = dataset.filter(isPublicBattleLobbyEntryV383);
        if(mode === 'solo') dataset = dataset.filter(isSoloLobbyEntryV383);
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
                const soloLocked = mode === 'solo' && !entry.endless && isSoloMissionCompletedToday(entry);
                if(soloLocked) item.classList.add('solo-locked');
                item.innerHTML =
                    `<span class="map-title">${entry.title}${soloLocked ? ' ✅' : ''}</span>`+
                    `<span class="map-real">${String(entry.real || '').toUpperCase()}</span>`+
                    `<span class="map-mode">${soloLocked ? 'DONE TODAY' : (entry.endless ? 'SOLO ∞' : (entry.mode || (mode === 'solo' ? 'SOLO' : mode === 'tournament' ? 'TOURNAMENT' : 'DM')))}</span>`+
                    `<span class="map-players">${mode === 'solo' ? '1/1' : (entry.currentPlayers ? entry.currentPlayers.length : (entry.players ? entry.players.length : 0)) + '/' + (entry.maxPlayers || entry.playerCount || 8)}</span>`+
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
                lobbyModeV27 = 'battle';
                window.setLobbyModeV27?.('battle');
                selectedLobbyMap = null;
                currentRoom = null;
                if(typeof renderRoomsInLobby === 'function'){
                    renderRoomsInLobby(true);
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
                markCosmicBattleEnterAllowedV444?.();
                if(!selectedLobbyMap) return;
                if(lobbyModeV27 === 'solo'){
                    if(isGuestAccount()){
                        showGuestOnlyPvpMessage();
                        return;
                    }
                    if(!selectedLobbyMap.endless && isSoloMissionCompletedToday(selectedLobbyMap)){
                        const note = document.getElementById('match-status-note');
                        if(note) note.textContent = '✅ Миссия уже выполнена сегодня. Будет доступна завтра.';
                        return;
                    }
                    currentRoom = { ...selectedLobbyMap, solo:true, state:'solo', private:true, currentPlayers:[{ name:getDisplayPlayerTag() }], players:[{ name:getDisplayPlayerTag() }] };
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
                    players:[],
                    currentPlayers:[],
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
    switchState = async function(newState){
        await prevSwitchState(newState);
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
  const playerPublicId = (typeof player !== 'undefined' && player?.id && String(player.id) !== 'local_player')
    ? String(player.id)
    : '';
  const chatPlayerId = (typeof getValidChatPlayerId === 'function') ? String(getValidChatPlayerId() || '') : '';
  const guestKey = (typeof authState !== 'undefined' && authState?.mode === 'guest')
    ? String(authState?.playerId || player?.id || chatPlayerId || '').trim()
    : '';
  const fallbackId = authPublicId || playerPublicId || guestKey || chatPlayerId || '';
  return {
    playerId: fallbackId,
    nickname: fallbackNickname,
    displayName: (typeof getDisplayPlayerTag === 'function') ? getDisplayPlayerTag() : fallbackNickname
  };
}

async function ensureRoomPlayerRowJoined(roomId, identity){
  const normalizedRoomId = sanitizeOnlineRoomId(roomId);
  const playerId = String(identity?.playerId || '').trim();
  if(!normalizedRoomId || !playerId || !window.supabaseClient) return false;

  const stamp = new Date().toISOString();
  const basePayload = {
      nickname: identity.displayName || player?.nickname || 'Commander',
      joined_at: stamp,
      updated_at: stamp,
      team: getBattleRoomPlayerTeam(playerId),
      level: Number(player?.level || 1) || 1,
      ping: Number(getBattlePingValue() || 0) || 0
  };

  try{
    const { data: rows, error } = await window.supabaseClient
      .from('room_players')
      .select('id,room_id,player_id,nickname')
      .eq('room_id', normalizedRoomId)
      .eq('player_id', playerId)
      .limit(1);

    if(!error && Array.isArray(rows) && rows.length > 0){
      const rowId = String(rows[0]?.id || '').trim();
      if(rowId){
        try{
          await window.supabaseClient
            .from('room_players')
            .update(basePayload)
            .eq('id', rowId)
            .select('id')
            .limit(1);
        }catch(_){}
      }
      return true;
    }

    const inserted = await window.supabaseClient
      .from('room_players')
      .insert(buildRoomPlayerRowPayload(normalizedRoomId, playerId, basePayload))
      .select('id')
      .limit(1);

    if(!inserted?.error) return true;

    const code = String(inserted?.error?.code || '').trim();
    if(code === '23505' || String(inserted?.error?.message || '').toLowerCase().includes('duplicate')){
      return true;
    }
  }catch(_){}

  return false;
}



async function waitForConfirmedRoom(roomId, maxWaitMs = 9000){
  const normalizedRoomId = sanitizeOnlineRoomId(roomId);
  if(!normalizedRoomId || !window.supabaseClient) return false;

  const delays = [0, 180, 420, 760, 1200, 1800, 2600, 3600];
  const startedAt = Date.now();

  for(const waitMs of delays){
    if(waitMs > 0) await sleep(waitMs);
    try{
      const { data: roomProbe, error: roomProbeError } = await window.supabaseClient
        .from('rooms')
        .select('id')
        .eq('id', normalizedRoomId)
        .limit(1);

      if(!roomProbeError && Array.isArray(roomProbe) && roomProbe.length > 0){
        return true;
      }
    }catch(_){}

    if((Date.now() - startedAt) >= maxWaitMs){
      break;
    }
  }

  return false;
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

    // V458: список игроков на плитке карты должен брать room_players тоже.
    // Иначе второй аккаунт в лобби не видит, что первый уже зашёл на карту.
    const joinedPlayers = getRoomOccupantsFromRoomPlayers(room);
    const livePlayers = getRoomOccupantsFromPresence(room?.id, presenceRows);
    const merged = mergeUniquePlayers(next.get(mapKey) || [], mergeUniquePlayers(joinedPlayers, livePlayers));
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

  const normalizedRoomId = sanitizeOnlineRoomId(roomId);
  if(!normalizedRoomId) return false;

  const identity = getCurrentPlayerIdentity();
  if (!identity.playerId) {
    console.error('Ошибка входа в room_players: пустой playerId', identity);
    return false;
  }

  const roomConfirmed = await waitForConfirmedRoom(normalizedRoomId, 9000);
  // v443: не останавливаем вход только из-за задержки чтения rooms.
  // Сразу пробуем записать room_players; если FK реально не готов, обработаем ниже.
  const stamp = new Date().toISOString();
  const { data: joinedRows, error } = await upsertRoomPlayerRowSafe(normalizedRoomId, identity.playerId, {
    nickname: identity.displayName,
    joined_at: stamp,
    updated_at: stamp,
    team: getBattleRoomPlayerTeam(identity.playerId),
    level: Number(player?.level || 1) || 1,
    ping: Number(getBattlePingValue() || 0) || 0
  }, 'id,room_id,player_id,nickname,joined_at');

  if(error){
    const errorCode = String(error?.code || '').trim();
    const errorMessage = String(error?.message || '').toLowerCase();

    if(errorCode === '23503'){
      return false;
    }

    const joinedAfterConflict = await ensureRoomPlayerRowJoined(normalizedRoomId, identity);

    // V458: duplicate/409 не должен ломать вход, потому что строка может уже существовать.
    if(!joinedAfterConflict && !(errorCode === '23505' || errorMessage.includes('duplicate') || errorMessage.includes('conflict'))){
      console.error('Ошибка входа в room_players:', error);
      return false;
    }
  }

  try{
    if(Array.isArray(joinedRows) && joinedRows[0]?.id){
      selfRoomPlayerRowId = String(joinedRows[0].id);
    }
  }catch(_){}

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

  const normalizedRoomId = sanitizeOnlineRoomId(roomId);
  if(!normalizedRoomId) return 0;

  battleLeavingInProgress = true;

  const identity = (typeof getCurrentPlayerIdentity === 'function') ? (getCurrentPlayerIdentity() || {}) : {};
  const selfPlayerId = String(getSelfBattlePlayerId() || authState?.playerId || player?.id || identity?.playerId || '').trim();
  const selfNickname = String(player?.nickname || identity?.displayName || identity?.nickname || (typeof getDisplayPlayerTag === 'function' ? getDisplayPlayerTag() : '') || 'Commander').trim() || 'Commander';

  try{
    selfRoomPlayerRowId = '';
    lastSelfRoomPlayerStatePayload = '';
    lastSelfRoomPlayerStateSentAt = 0;
    roomPlayerStateUpsertInFlight = false;
    roomPlayersFetchInFlight = false;
    cachedRoomPlayersRows = [];
    cachedRoomPlayersFetchedAt = 0;
    lastRoomPlayersFetchAt = 0;
  }catch(_){ }

  if(selfPlayerId){
    try{
      await sendBattlePresenceEvent?.('pilot-left', {
        playerId: selfPlayerId,
        nickname: selfNickname,
        roomId: normalizedRoomId
      });
    }catch(_){ }
    try{ lastBattlePresenceSnapshot?.delete?.(selfPlayerId); }catch(_){ }
    try{ removeRemoteBattleShipById?.(selfPlayerId); }catch(_){ }

    try{
      const { error: deletePlayerError } = await window.supabaseClient
        .from('room_players')
        .delete()
        .eq('room_id', normalizedRoomId)
        .eq('player_id', selfPlayerId);
      if(deletePlayerError){
        console.warn('room_players leave delete warning:', deletePlayerError);
      }
    }catch(error){
      console.warn('room_players leave delete failed:', error);
    }
  }

  const freshCutoff = getRoomPlayerFreshCutoffIso();

  try{
    await window.supabaseClient
      .from('room_players')
      .delete()
      .eq('room_id', normalizedRoomId)
      .lt('updated_at', freshCutoff);
  }catch(_){ }

  let freshCount = 0;
  try{
    const { count, error: countError } = await window.supabaseClient
      .from('room_players')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', normalizedRoomId)
      .gte('updated_at', freshCutoff);

    if(countError){
      console.warn('room_players fresh count warning:', countError);
      freshCount = 0;
    }else{
      freshCount = Number(count || 0) || 0;
    }
  }catch(_){
    freshCount = 0;
  }

  if (freshCount <= 0) {
    try{
      // Перед удалением комнаты чистим все старые строки этой комнаты, чтобы она не оживала в списке.
      await window.supabaseClient
        .from('room_players')
        .delete()
        .eq('room_id', normalizedRoomId);
    }catch(_){ }

    try{
      const { error: roomDeleteError } = await window.supabaseClient
        .from('rooms')
        .delete()
        .eq('id', normalizedRoomId);
      if(roomDeleteError){
        console.warn('empty room delete warning:', roomDeleteError);
      }
    }catch(error){
      console.warn('empty room delete failed:', error);
    }
  }

  try{
    if(typeof setPlayerOnlineStatus === 'function'){
      await setPlayerOnlineStatus('lobby', null);
    }
  }catch(_){ }

  try{
    await loadRoomsFromSupabase?.();
    if(gameState === 'LOBBY' && typeof renderLobbyListV27 === 'function' && getLobbyModeSafe() === 'battle'){
      renderLobbyListV27('battle');
    }
  }catch(_){ }

  return freshCount;
}

async function cleanupCurrentBattleRoom(roomSnapshot = currentRoom) {
  const targetRoom = roomSnapshot ? { ...roomSnapshot } : null;
  const targetRoomId = sanitizeOnlineRoomId(targetRoom?.id || targetRoom?.roomId || null);
  const shouldLeave = !!(targetRoomId && targetRoom?.state !== 'solo' && targetRoom?.observer !== true);

  try{ stopLiveBattleSync?.(); }catch(_){ }

  if (shouldLeave) {
    await leaveRoomPlayers(targetRoomId);
  }

  currentRoom = null;
  window.currentRoomId = null;
  activeBattleChatRoomId = null;
  selectedLobbyMap = null;

  try{
    selfRoomPlayerRowId = '';
    lastSelfRoomPlayerStatePayload = '';
    lastSelfRoomPlayerStateSentAt = 0;
    roomPlayerStateUpsertInFlight = false;
    roomPlayersFetchInFlight = false;
    cachedRoomPlayersRows = [];
    cachedRoomPlayersFetchedAt = 0;
    lastRoomPlayersFetchAt = 0;
    battleLeavingInProgress = false;
  }catch(_){ }

  if(gameState === 'LOBBY' && typeof renderLobbyListV27 === 'function'){
    await loadRoomsFromSupabase?.();
    renderLobbyListV27(getLobbyModeSafe());
  }
}

function cleanupBattleRoomSilently(){
  const roomSnapshot = currentRoom ? { ...currentRoom } : null;
  const roomId = roomSnapshot?.id || roomSnapshot?.roomId || null;
  const shouldLeave = !!(roomId && roomSnapshot?.state !== 'solo' && roomSnapshot?.observer !== true);
  const normalizedRoomId = sanitizeOnlineRoomId(roomId);
  const identity = getCurrentPlayerIdentity?.() || {};
  const selfId = String(getSelfBattlePlayerId() || authState?.playerId || player?.id || identity?.playerId || '').trim();
  const selfNickname = player?.nickname || identity?.displayName || identity?.nickname || 'Commander';

  if(shouldLeave && selfId && roomSnapshot){
    const filterList = (list) => Array.isArray(list)
      ? list.filter(row => String(row?.id || row?.player_id || row?.public_id || row?.player_public_id || '').trim() !== selfId)
      : list;
    roomSnapshot.currentPlayers = filterList(roomSnapshot.currentPlayers) || [];
    roomSnapshot.players = filterList(roomSnapshot.players) || [];
  }

  if(shouldLeave && normalizedRoomId && selfId && window.supabaseReady && window.supabaseClient){
    try{
      sendBattlePresenceEvent?.('pilot-left', {
        playerId: selfId,
        nickname: selfNickname,
        roomId: normalizedRoomId
      });
    }catch(_){}

    try{
      lastBattlePresenceSnapshot.delete(selfId);
    }catch(_){}

    try{
      removeRemoteBattleShipById(selfId);
    }catch(_){}

    window.supabaseClient
      .from('room_players')
      .delete()
      .eq('room_id', normalizedRoomId)
      .eq('player_id', selfId)
      .then(() => {})
      .catch(() => {});
  }

  currentRoom = null;
  window.currentRoomId = null;
  selectedLobbyMap = null;

  if(shouldLeave){
    leaveRoomPlayers(roomId)
      .then(async (leftCount) => {
        if((leftCount || 0) <= 0 && window.supabaseReady && window.supabaseClient){
          await window.supabaseClient.from('rooms').delete().eq('id', sanitizeOnlineRoomId(roomId));
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
            await window.supabaseClient.from('rooms').delete().eq('id', sanitizeOnlineRoomId(roomId));
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
      loadRoomsFromSupabase();
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
      if(row?.room_id && row?.player_id && !isFreshRoomPlayerRow(row)){
        staleRoomPlayers.push({
          room_id: String(row.room_id).trim(),
          player_id: String(row.player_id).trim()
        });
      }
    });
    room.room_players = rows.filter(row => isFreshRoomPlayerRow(row));
  });

  if(staleRoomPlayers.length){
    try{
      for(const staleRow of staleRoomPlayers){
        await window.supabaseClient
          .from('room_players')
          .delete()
          .eq('room_id', staleRow.room_id)
          .eq('player_id', staleRow.player_id);
      }
    }catch(_){}
  }

  const emptyRooms = allRooms.filter(room => {
    if(!room?.id) return false;
    if(Array.isArray(room.room_players) && room.room_players.length > 0) return false;
    const createdAtMs = new Date(room?.created_at || 0).getTime();
    if(Number.isFinite(createdAtMs) && (Date.now() - createdAtMs) < ROOM_EMPTY_DELETE_GRACE_MS){
      return false;
    }
    return true;
  });
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

  const visibleRooms = allRooms.filter(room => {
    if(!room?.id || !Array.isArray(room.room_players) || room.room_players.length <= 0) return false;
    const rawMode = String(room?.mode || room?.state || room?.room_type || room?.type || '').toLowerCase();
    const rawName = String(room?.room_name || '').toLowerCase();
    if(rawMode.includes('solo') || rawName.includes('solo') || rawName.includes('одиноч')) return false;
    return true;
  });
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
    await waitForConfirmedRoom(existingRoom.id, 9000);
    let joinedExisting = await joinRoomPlayers(existingRoom.id);
    if (!joinedExisting) {
      for(const retryDelay of [260, 520, 900, 1400]){
        await sleep(retryDelay);
        joinedExisting = await joinRoomPlayers(existingRoom.id);
        if(joinedExisting) break;
      }
    }
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

  const roomConfirmed = await waitForConfirmedRoom(data.id, 9000);
  if(!roomConfirmed){
    // v443: Supabase иногда задерживает чтение только что созданной комнаты.
    // Это не критическая ошибка — ниже всё равно пробуем вход в room_players.
  }

  let joined = await joinRoomPlayers(data.id);
  if (!joined) {
    for(const retryDelay of [260, 520, 900, 1400, 2200]){
      await sleep(retryDelay);
      try{ await loadRoomsFromSupabase(); }catch(_){}
      joined = await joinRoomPlayers(data.id);
      if(joined) break;
    }
  }

  if (!joined) {
    // v443: без шумного warning в консоли; комната остаётся и повторно подхватится refresh-ом.
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
    const ttl = (typeof ONLINE_TTL_MS !== 'undefined' && Number.isFinite(Number(ONLINE_TTL_MS))) ? Number(ONLINE_TTL_MS) : 45000;
    return new Date(Date.now() - ttl).toISOString();
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
        .select('public_id,nickname,level,experience,credits,email,staff_role,crystals,mercury_ore,venus_gas,earth_water,mars_crystal,jupiter_hydrogen,saturn_ice,uranus_ammonia,neptune_methane,solar_energy,created_at')
        .eq('public_id', Number(targetId))
        .maybeSingle();

    if(error){
        console.error('Ошибка загрузки профиля игрока:', error);
        return null;
    }

    return data || null;
}


async function fetchPlayerHangarSaveData(targetId){
    const safeId = Number(String(targetId || '').trim());
    if(!window.supabaseReady || !window.supabaseClient || !Number.isFinite(safeId) || safeId <= 0) return null;
    try{
        const { data, error } = await window.supabaseClient
            .from('player_saves')
            .select('save_data')
            .eq('player_public_id', Math.floor(safeId))
            .maybeSingle();
        if(error){
            console.warn('Не удалось загрузить ангар игрока:', error.message || error);
            return null;
        }
        return data?.save_data || null;
    }catch(error){
        console.warn('fetchPlayerHangarSaveData error:', error?.message || error);
        return null;
    }
}

function applyGuestHangarPayload(profileData = {}, saveData = null, fallbackNickname = 'Player'){
    if(!hangarSelfSnapshot) hangarSelfSnapshot = makeHangarPlayerSnapshot();
    hangarViewMode = 'guest';
    hangarGuestOwner = {
        public_id: profileData?.public_id || '',
        nickname: profileData?.nickname || fallbackNickname || 'Player'
    };

    const payload = saveData && typeof saveData === 'object' ? saveData : {};
    const guestOwnedShips = Array.isArray(payload.ownedShipIds) && payload.ownedShipIds.length
        ? payload.ownedShipIds.map(id => String(id || '').trim()).filter(Boolean)
        : ['scout_1'];

    // V409: гостевой ангар не должен подменять личность текущего игрока.
    // Поэтому не меняем player.nickname / player.id / level / experience / credits / playerResources.
    // Временно подменяется только витрина ангара: корабли, модули и расстановка.
    player.ownedShipIds = Array.from(new Set(guestOwnedShips.length ? guestOwnedShips : ['scout_1']));
    player.selectedShipId = String(payload.selectedShipId || player.ownedShipIds[0] || 'scout_1').trim() || 'scout_1'; try{ localStorage.setItem("cosmicSelectedShipId", String(player.selectedShipId || "")); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){} try{ if(!isApplyingSaveDataV459) saveGame?.(); }catch(_){} try{ refreshProfileShipPreviewIfOpenV446?.(); }catch(_){}
    player.ownedModuleIds = Array.isArray(payload.ownedModuleIds) ? Array.from(new Set(payload.ownedModuleIds.map(id => String(id || '').trim()).filter(Boolean))) : ['weapon_laser_s1','shield_micro_s1','booster_ion_s1'];
    player.activeModulesByShip = payload.activeModulesByShip && typeof payload.activeModulesByShip === 'object'
        ? JSON.parse(JSON.stringify(payload.activeModulesByShip))
        : { [player.selectedShipId]: { weapon:'weapon_laser_s1', shield:'shield_micro_s1', booster:'booster_ion_s1' } };
    player.hangarDockAssignments = payload.hangarDockAssignments && typeof payload.hangarDockAssignments === 'object'
        ? JSON.parse(JSON.stringify(payload.hangarDockAssignments))
        : {};

    try{ refreshOwnedShipsInventory?.(); }catch(_){}
    try{ ensureHangarDockAssignments?.(); }catch(_){}
    try{ currentBattleShipStats = computeShipBattleStats(player?.selectedShipId || ''); }catch(_){}
    try{ updatePremiumAccountInfo?.(); updateHUD?.(); updateUI?.(); }catch(_){}
}

async function openPlayerHangarAsGuest(targetId, fallbackNickname = 'Player', cachedProfileData = null){
    const normalizedId = String(targetId || '').trim();
    const myId = authState?.playerId ? String(authState.playerId) : '';
    if(!normalizedId) return;
    if(myId && normalizedId === myId){
        hangarViewMode = 'self';
        hangarGuestOwner = null;
        hangarSelfSnapshot = null;
        document.getElementById('profile-window')?.classList.add('hidden');
        const selfHangarWin = document.getElementById('hangar-window');
        selfHangarWin?.classList.remove('hidden');
        if(selfHangarWin) selfHangarWin.style.display = 'flex';
        try{ await enterOwnHangarPresence?.(); }catch(_){}
        renderHangarCosmic?.(true);
        return;
    }

    const profileData = cachedProfileData || await fetchPlayerProfileData(normalizedId) || { public_id: normalizedId, nickname: fallbackNickname };
    const saveData = await fetchPlayerHangarSaveData(normalizedId);
    applyGuestHangarPayload(profileData, saveData, fallbackNickname);
    currentHangarPresenceOwnerId = String(normalizedId);
    document.getElementById('profile-window')?.classList.add('hidden');
    const guestHangarWin = document.getElementById('hangar-window');
    guestHangarWin?.classList.remove('hidden');
    if(guestHangarWin) guestHangarWin.style.display = 'flex';
    try{ await enterHangarPresence?.(normalizedId); }catch(_){}
    requestAnimationFrame(() => {
        try{ renderHangarCosmic?.(true); }catch(error){ console.warn('open guest hangar render warning:', error?.message || error); }
    });
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
    const saveData = normalizedId ? await fetchPlayerHangarSaveData(normalizedId) : null;
    if (data?.public_id) {
        setCachedStaffRole(String(data.public_id), data.staff_role || 'player');
    }
    const displayName = data?.nickname || fallbackNickname || 'Player';
    const canPm = canUsePrivateChat() && isAccountPublicId(normalizedId) && normalizedId !== myId;
    const canHangar = isAccountPublicId(normalizedId);

    profileInfoEl.innerHTML = renderProfilePanelV428({
        profile: data || { public_id: normalizedId, nickname: displayName },
        save: saveData || {},
        isSelf: false,
        fallbackName: displayName,
        canPm,
        canHangar
    }) + (!data ? '<div class="auth-note" style="margin-top:12px;text-align:center;">Профиль загружен частично. Полных данных по игроку пока нет.</div>' : '');

    setTimeout(() => { try{ initProfileSelectedShip3DPreviewV445?.(); }catch(_){} }, 0);

    document.getElementById('profile-pm-btn')?.addEventListener('click', () => {
        openPrivateChat(String(normalizedId), displayName);
    });
    document.getElementById('profile-view-hangar-btn')?.addEventListener('click', async () => {
        await openPlayerHangarAsGuest(String(normalizedId), displayName, data || null);
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
    pmPeerRoomIds.clear();

    for(const p of players || []){
        const targetId = p?.player_id ? String(p.player_id) : '';
        if(!targetId || !isAccountPublicId(targetId)) continue;

        const status = String(p.status || '').toLowerCase();
        const roomId = String(p?.room_id || '').trim();

        if (status === 'lobby') {
            onlinePmPeers.add(targetId);
        } else {
            inGamePmPeers.add(targetId);
            if(roomId) pmPeerRoomIds.set(targetId, roomId);
        }
    }
    renderChatTabs();
}

async function renderOnlinePlayers(){
    const list = document.getElementById('online-list');
    if(!list) return;

    try{
        if(typeof loadRoomsFromSupabase === 'function') await loadRoomsFromSupabase();
    }catch(_){}

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
    if(typeof isHangarWindowOpenNow === 'function' && isHangarWindowOpenNow()){
        const ownerId = String(currentHangarPresenceOwnerId || getHangarOwnerIdForPresence?.() || '').trim();
        if(ownerId){
            currentHangarPresenceOwnerId = ownerId;
            setPlayerOnlineStatus((typeof getHangarPresenceStatusWithPositionV426 === 'function' ? getHangarPresenceStatusWithPositionV426(ownerId) : getHangarPresenceStatus(ownerId)), null);
            return;
        }
    }

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
switchState = async function(newState){
    if(newState === 'AUTH'){
        deleteAllOwnPmHistory();
        resetPrivateChatState();
    }

    if(isGuestAccount() && (newState === 'ORBIT' || newState === 'INVENTORY' || newState === 'COMBAT')){
        showGuestOnlyPvpMessage();
        await previousSwitchStateOnline('LOBBY');
        syncCurrentOnlinePresence();
        setTimeout(renderOnlinePlayers, 300);
        return;
    }

    await previousSwitchStateOnline(newState);
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

// v152 FIX: hangar logic updated (tables, ship spawn, positions)


// ===== HANGAR FIX v188 =====
function cleanupHangarOverlayUi(){
    const selectors = [
        '#hangar-window .hangar-module-side',
        '#hangar-window .hangar-ship-card',
        '#hangar-window .hangar-footer-row',
        '#hangar-window .hangar-stage-name-badge'
    ];
    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => node.remove());
    });
}

const previousOpenHangarWindowV188 = typeof openHangarWindow === 'function' ? openHangarWindow : null;
if(previousOpenHangarWindowV188){
    openHangarWindow = function(...args){
        const result = previousOpenHangarWindowV188.apply(this, args);
        setTimeout(cleanupHangarOverlayUi, 0);
        setTimeout(cleanupHangarOverlayUi, 120);
        setTimeout(__mountHangarChatPanel, 0);
        setTimeout(__mountHangarChatPanel, 120);
        return result;
    };
    window.openHangarWindow = openHangarWindow;
}


try{ ensurePremiumCurrencyUi?.(); }catch(_){ }


if(!window.__hangarPmNeonTicker){
    window.__hangarPmNeonTicker = setInterval(() => {
        try{ __updateHangarPmNeon?.(); }catch(_){}
    }, 250);
}

// ===== V292 NEON FIX =====
function __getPmUnreadCountSafe(){
  try{
    return Object.values(chatUnread?.pm||{}).reduce((a,b)=>a+(+b||0),0);
  }catch(e){return 0;}
}

function __updateNeonV292(){
  try{
    const el=document.getElementById('chat-wrapper');
    if(!el) return;
    const lowered=el.classList.contains('hangar-chat-lowered');
    const unread=__getPmUnreadCountSafe()>0;
    if(lowered && unread){
      el.classList.add('hangar-pm-neon');
    }else{
      el.classList.remove('hangar-pm-neon');
    }
  }catch(e){}
}

setInterval(__updateNeonV292,300);

// force hangar collapsed
setInterval(()=>{
  try{
    if(gameState==='HANGAR'){
      const el=document.getElementById('chat-wrapper');
      if(el){
        el.classList.add('hangar-inline-mode');
        el.classList.add('hangar-chat-lowered');
      }
    }
  }catch(e){}
},500);

// ===== V293 CHAT NEON LOGIC =====
function __v293_getUnread(){
  try{
    return Object.values(chatUnread?.pm||{}).reduce((a,b)=>a+(+b||0),0);
  }catch(e){return 0;}
}

function __v293_updateNeon(){
  const el = document.getElementById('chat-wrapper');
  if(!el) return;

  const lowered = el.classList.contains('hangar-chat-lowered');
  const unread = __v293_getUnread();

  if(lowered && unread > 0){
    el.classList.add('hangar-pm-neon');
  }else{
    el.classList.remove('hangar-pm-neon');
  }
}

setInterval(__v293_updateNeon,200);

// force collapsed in hangar once
document.addEventListener("DOMContentLoaded",()=>{
  setTimeout(()=>{
    if(gameState === "HANGAR"){
      const el=document.getElementById("chat-wrapper");
      if(el){
        el.classList.add("hangar-inline-mode");
        el.classList.add("hangar-chat-lowered");
      }
    }
  },500);
});


// ===== V294 HANGAR CHAT + PM PERSIST FIX =====
const COSMIC_PM_CACHE_KEY_V294 = 'cosmicPmCache:v294';

function __v294_collectPmCacheSnapshot(){
  try{
    const snapshot = { tabs:{}, messages:{}, savedAt: Date.now() };
    Object.entries(privateChatTabs || {}).forEach(([peerId, meta]) => {
      const safePeerId = String(peerId || '').trim();
      if(!safePeerId) return;
      snapshot.tabs[safePeerId] = {
        label: String(meta?.label || `ID ${safePeerId}`),
        updatedAt: Number(meta?.updatedAt) || Date.now(),
        pinned: !!meta?.pinned,
        preview: String(meta?.preview || '')
      };
      const list = Array.isArray(chatCache?.pm?.[safePeerId]) ? chatCache.pm[safePeerId] : [];
      snapshot.messages[safePeerId] = list.slice(-20);
    });
    return snapshot;
  }catch(_){
    return { tabs:{}, messages:{}, savedAt: Date.now() };
  }
}

function __v294_savePmCache(){
  try{
    localStorage.setItem(COSMIC_PM_CACHE_KEY_V294, JSON.stringify(__v294_collectPmCacheSnapshot()));
  }catch(_){ }
}

function __v294_restorePmCache(){
  try{
    const raw = localStorage.getItem(COSMIC_PM_CACHE_KEY_V294);
    if(!raw) return;
    const state = JSON.parse(raw);
    const tabs = state?.tabs && typeof state.tabs === 'object' ? state.tabs : {};
    const messages = state?.messages && typeof state.messages === 'object' ? state.messages : {};

    Object.entries(tabs).forEach(([peerId, meta]) => {
      const safePeerId = String(peerId || '').trim();
      if(!safePeerId || !/^\d+$/.test(safePeerId)) return;
      privateChatTabs[safePeerId] = {
        label: String(meta?.label || `ID ${safePeerId}`),
        updatedAt: Number(meta?.updatedAt) || Date.now(),
        pinned: !!meta?.pinned,
        preview: String(meta?.preview || '')
      };
      if(!Array.isArray(chatCache.pm[safePeerId])) chatCache.pm[safePeerId] = [];
      const list = Array.isArray(messages?.[safePeerId]) ? messages[safePeerId] : [];
      if(!chatCache.pm[safePeerId].length && list.length){
        list.slice(-20).forEach(msg => chatCache.pm[safePeerId].push(msg));
      }
    });
  }catch(_){ }
}

(function(){
  const __origSaveChatUiStateV294 = typeof saveChatUiState === 'function' ? saveChatUiState : null;
  if(__origSaveChatUiStateV294){
    saveChatUiState = function(){
      const result = __origSaveChatUiStateV294.apply(this, arguments);
      try{ __v294_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

const __v294_originalDeletePmHistoryWithPeer = typeof deletePmHistoryWithPeer === 'function' ? deletePmHistoryWithPeer : null;
if(__v294_originalDeletePmHistoryWithPeer){
  deletePmHistoryWithPeer = async function(){ return true; };
}

const __v294_originalDeleteAllOwnPmHistory = typeof deleteAllOwnPmHistory === 'function' ? deleteAllOwnPmHistory : null;
if(__v294_originalDeleteAllOwnPmHistory){
  deleteAllOwnPmHistory = async function(){ return true; };
}

(function(){
  const __origUpdateHangarPmNeonV294 = typeof __updateHangarPmNeon === 'function' ? __updateHangarPmNeon : null;
  __updateHangarPmNeon = function(){
    try{
      const chatWrapper = document.getElementById('chat-wrapper');
      if(!chatWrapper) return;
      const lowered = document.body.classList.contains('hangar-chat-lowered') || chatWrapper.classList.contains('hangar-chat-lowered');
      const hasUnreadPm = (function(){ try{ return Object.values(chatUnread?.pm || {}).reduce((sum, value) => sum + (Number(value) || 0), 0) > 0; }catch(_){ return false; } })();
      const hasPulse = Date.now() < Number(__hangarPmPulseUntil || 0);
      const inHangarMode = document.body.classList.contains('hangar-chat-mode');
      const shouldNeon = !!(inHangarMode && lowered && (hasUnreadPm || hasPulse));
      chatWrapper.classList.toggle('hangar-pm-neon', shouldNeon);
    }catch(_){
      try{ __origUpdateHangarPmNeonV294 && __origUpdateHangarPmNeonV294.apply(this, arguments); }catch(__){}
    }
  };
})();

(function(){
  const __origSetHangarChatModeV294 = typeof setHangarChatMode === 'function' ? setHangarChatMode : null;
  if(__origSetHangarChatModeV294){
    setHangarChatMode = function(active, lowered = false){
      const result = __origSetHangarChatModeV294.apply(this, arguments);
      try{
        const chatWrapper = document.getElementById('chat-wrapper');
        const emojiPanel = document.getElementById('emoji-panel');
        document.body.classList.toggle('hangar-chat-mode', !!active);
        document.body.classList.toggle('hangar-chat-lowered', !!(active && lowered));
        if(chatWrapper){
          chatWrapper.classList.toggle('hangar-inline-mode', !!active);
          chatWrapper.classList.toggle('hangar-chat-lowered', !!(active && lowered));
        }
        if(emojiPanel) emojiPanel.classList.toggle('hangar-chat-lowered', !!(active && lowered));
        __updateHangarPmNeon?.();
      }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origRestoreChatUiStateV294 = typeof restoreChatUiState === 'function' ? restoreChatUiState : null;
  if(__origRestoreChatUiStateV294){
    restoreChatUiState = function(){
      const result = __origRestoreChatUiStateV294.apply(this, arguments);
      try{ __v294_restorePmCache(); }catch(_){ }
      return result;
    };
  }else{
    try{ __v294_restorePmCache(); }catch(_){ }
  }
})();

(function(){
  const __origLoadChatHistoryV294 = typeof loadChatHistory === 'function' ? loadChatHistory : null;
  if(__origLoadChatHistoryV294){
    loadChatHistory = async function(scopeName = currentChat){
      const result = await __origLoadChatHistoryV294.apply(this, arguments);
      try{ __v294_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origPushChatToCacheV294 = typeof pushChatToCache === 'function' ? pushChatToCache : null;
  if(__origPushChatToCacheV294){
    pushChatToCache = function(scope, msg){
      const result = __origPushChatToCacheV294.apply(this, arguments);
      try{ if(scope?.channel === 'pm'){ __v294_savePmCache(); } }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origInitRealtimeChatV294 = typeof initRealtimeChat === 'function' ? initRealtimeChat : null;
  if(__origInitRealtimeChatV294){
    initRealtimeChat = async function(){
      if (!canUsePrivateChat()) {
        resetPrivateChatState();
      }
      restoreChatUiState();
      try{ __v294_restorePmCache(); }catch(_){ }
      chatUnread.global = 0;
      chatUnread.clan = 0;
      chatUnread.battle = 0;
      startRealtimeChat();
      renderChatTabs();
      updateLobbyChatComposerVisibility();
      await loadChatHistory("global");
      if (canUseClanChat()) await loadChatHistory("clan");
      const restoredPmIds = Object.keys(privateChatTabs || {});
      for(const peerId of restoredPmIds){
        try{ await loadChatHistory(`pm:${peerId}`); }catch(_){ }
      }
      if (currentChat !== 'battle') renderLobbyMessages();
      saveChatUiState();
    };
  }
})();

setInterval(() => {
  try{
    if(gameState === 'HANGAR'){
      const chatWrapper = document.getElementById('chat-wrapper');
      if(chatWrapper){
        document.body.classList.add('hangar-chat-mode');
        document.body.classList.add('hangar-chat-lowered');
        chatWrapper.classList.add('hangar-inline-mode');
        chatWrapper.classList.add('hangar-chat-lowered');
      }
      __updateHangarPmNeon?.();
    }
  }catch(_){ }
}, 350);

document.addEventListener('DOMContentLoaded', () => {
  try{ __v294_restorePmCache(); }catch(_){ }
  setTimeout(() => {
    try{
      if(gameState === 'HANGAR') setHangarChatMode?.(true, true);
      __updateHangarPmNeon?.();
      renderChatTabs?.();
    }catch(_){ }
  }, 450);
});


// ===== V295 FINAL HANGAR CHAT FIX =====
const COSMIC_PM_CACHE_KEY_V295 = 'cosmicPmCache:v295';
let __hangarPmBlinkTimerV295 = null;

function __v295_isHangarChatLowered(){
  try{
    const chatWrapper = document.getElementById('chat-wrapper');
    return !!(
      document.body.classList.contains('hangar-chat-mode') &&
      (document.body.classList.contains('hangar-chat-lowered') || chatWrapper?.classList.contains('hangar-chat-lowered'))
    );
  }catch(_){ return false; }
}

function __v295_forceHangarChatLowered(){
  try{
    const chatWrapper = document.getElementById('chat-wrapper');
    const emojiPanel = document.getElementById('emoji-panel');
    if(!chatWrapper) return;
    document.body.classList.add('hangar-chat-mode');
    document.body.classList.add('hangar-chat-lowered');
    chatWrapper.classList.add('hangar-inline-mode');
    chatWrapper.classList.add('hangar-chat-lowered');
    if(emojiPanel) emojiPanel.classList.add('hangar-chat-lowered');
    __updateHangarPmNeon?.();
  }catch(_){ }
}

function __v295_collectPmCacheSnapshot(){
  try{
    const snapshot = { tabs:{}, messages:{}, unread:{}, currentChat: currentChat || 'global', savedAt: Date.now() };
    Object.entries(privateChatTabs || {}).forEach(([peerId, meta]) => {
      const safePeerId = String(peerId || '').trim();
      if(!safePeerId) return;
      snapshot.tabs[safePeerId] = {
        label: String(meta?.label || `ID ${safePeerId}`),
        updatedAt: Number(meta?.updatedAt) || Date.now(),
        pinned: !!meta?.pinned,
        preview: String(meta?.preview || '')
      };
      snapshot.unread[safePeerId] = Number(chatUnread?.pm?.[safePeerId] || 0) || 0;
      const list = Array.isArray(chatCache?.pm?.[safePeerId]) ? chatCache.pm[safePeerId] : [];
      snapshot.messages[safePeerId] = list.slice(-40);
    });
    return snapshot;
  }catch(_){
    return { tabs:{}, messages:{}, unread:{}, currentChat:'global', savedAt: Date.now() };
  }
}

function __v295_savePmCache(){
  try{
    localStorage.setItem(COSMIC_PM_CACHE_KEY_V295, JSON.stringify(__v295_collectPmCacheSnapshot()));
  }catch(_){ }
}

function __v295_restorePmCache(){
  try{
    const raw = localStorage.getItem(COSMIC_PM_CACHE_KEY_V295) || localStorage.getItem(COSMIC_PM_CACHE_KEY_V294);
    if(!raw) return;
    const state = JSON.parse(raw);
    const tabs = state?.tabs && typeof state.tabs === 'object' ? state.tabs : {};
    const messages = state?.messages && typeof state.messages === 'object' ? state.messages : {};
    const unread = state?.unread && typeof state.unread === 'object' ? state.unread : {};

    Object.entries(tabs).forEach(([peerId, meta]) => {
      const safePeerId = String(peerId || '').trim();
      if(!safePeerId) return;
      if(isPmTabClosedV338(safePeerId)) return;
      privateChatTabs[safePeerId] = {
        label: String(meta?.label || `ID ${safePeerId}`),
        updatedAt: Number(meta?.updatedAt) || Date.now(),
        pinned: !!meta?.pinned,
        preview: String(meta?.preview || '')
      };
      if(!Array.isArray(chatCache.pm[safePeerId])) chatCache.pm[safePeerId] = [];
      const list = Array.isArray(messages?.[safePeerId]) ? messages[safePeerId] : [];
      if(list.length){
        chatCache.pm[safePeerId] = list.slice(-40);
      }
      if(chatUnread?.pm){
        chatUnread.pm[safePeerId] = Math.max(0, Number(unread?.[safePeerId] || chatUnread.pm[safePeerId] || 0) || 0);
      }
    });

    const savedCurrent = String(state?.currentChat || currentChat || 'global');
    if(savedCurrent === 'global' || savedCurrent === 'battle' || savedCurrent === 'clan' || savedCurrent.startsWith('pm:')){
      currentChat = savedCurrent;
    }
  }catch(_){ }
}

(function(){
  const __origResetPrivateChatStateV295 = typeof resetPrivateChatState === 'function' ? resetPrivateChatState : null;
  if(__origResetPrivateChatStateV295){
    resetPrivateChatState = function(){
      const shouldPreserve = !!(authState?.mode === 'account' && authState?.playerId);
      if(shouldPreserve){
        try{ __v295_savePmCache(); }catch(_){ }
      }
      const result = __origResetPrivateChatStateV295.apply(this, arguments);
      if(shouldPreserve){
        try{ __v295_restorePmCache(); }catch(_){ }
        try{ renderChatTabs?.(); }catch(_){ }
      }
      return result;
    };
  }
})();

(function(){
  restoreChatUiState = function(){
    try {
      const raw = localStorage.getItem(CHAT_UI_STATE_KEY);
      if (raw) {
        const state = JSON.parse(raw);
        const tabs = state?.privateTabs && typeof state.privateTabs === 'object' ? state.privateTabs : {};
        Object.keys(privateChatTabs).forEach(key => delete privateChatTabs[key]);
        Object.entries(tabs).forEach(([peerId, meta]) => {
          const safePeerId = String(peerId || '').trim();
          if (!safePeerId) return;
          if (isPmTabClosedV338(safePeerId)) return;
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
      }
    } catch (_) {}
    try{ __v295_restorePmCache(); }catch(_){ }
  };
})();

(function(){
  const __origSaveChatUiStateV295 = typeof saveChatUiState === 'function' ? saveChatUiState : null;
  if(__origSaveChatUiStateV295){
    saveChatUiState = function(){
      const result = __origSaveChatUiStateV295.apply(this, arguments);
      try{ __v295_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origPushChatToCacheV295 = typeof pushChatToCache === 'function' ? pushChatToCache : null;
  if(__origPushChatToCacheV295){
    pushChatToCache = function(scope, msg){
      const result = __origPushChatToCacheV295.apply(this, arguments);
      try{ if(scope?.channel === 'pm'){ __v295_savePmCache(); } }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origEnsurePmTabV295 = typeof ensurePmTab === 'function' ? ensurePmTab : null;
  if(__origEnsurePmTabV295){
    ensurePmTab = function(peerId, label = null){
      const result = __origEnsurePmTabV295.apply(this, arguments);
      try{ __v295_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origSetUnreadCountV295 = typeof setUnreadCount === 'function' ? setUnreadCount : null;
  if(__origSetUnreadCountV295){
    setUnreadCount = function(scopeName, count = 0){
      const result = __origSetUnreadCountV295.apply(this, arguments);
      try{ if(String(scopeName || '').startsWith('pm:')) __v295_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origClearUnreadForCurrentScopeV295 = typeof clearUnreadForCurrentScope === 'function' ? clearUnreadForCurrentScope : null;
  if(__origClearUnreadForCurrentScopeV295){
    clearUnreadForCurrentScope = function(){
      const result = __origClearUnreadForCurrentScopeV295.apply(this, arguments);
      try{ __v295_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  __updateHangarPmNeon = function(){
    try{
      const chatWrapper = document.getElementById('chat-wrapper');
      if(!chatWrapper) return;
      const shouldBlink = !!(
        document.body.classList.contains('hangar-chat-mode') &&
        __v295_isHangarChatLowered() &&
        Date.now() < Number(__hangarPmPulseUntil || 0)
      );
      chatWrapper.classList.toggle('hangar-pm-neon', shouldBlink);
    }catch(_){ }
  };
})();

(function(){
  const __origSetHangarChatModeV295 = typeof setHangarChatMode === 'function' ? setHangarChatMode : null;
  if(__origSetHangarChatModeV295){
    setHangarChatMode = function(active, lowered = false){
      const result = __origSetHangarChatModeV295.call(this, active, lowered);
      if(active && lowered){
        setTimeout(__v295_forceHangarChatLowered, 0);
        setTimeout(__v295_forceHangarChatLowered, 60);
        setTimeout(__v295_forceHangarChatLowered, 180);
      }
      return result;
    };
  }
})();

(function(){
  const __origHandleIncomingChatMessageV295 = typeof handleIncomingChatMessage === 'function' ? handleIncomingChatMessage : null;
  if(__origHandleIncomingChatMessageV295){
    handleIncomingChatMessage = function(msg){
      const beforePmKeys = new Set(Object.keys(chatCache?.pm || {}));
      const result = __origHandleIncomingChatMessageV295.apply(this, arguments);
      try{
        if(msg?.channel === 'pm' && document.body.classList.contains('hangar-chat-mode') && __v295_isHangarChatLowered()){
          __hangarPmPulseUntil = Date.now() + 12000;
          if(__hangarPmBlinkTimerV295) clearTimeout(__hangarPmBlinkTimerV295);
          __hangarPmBlinkTimerV295 = setTimeout(() => { try{ __updateHangarPmNeon?.(); }catch(_){} }, 12100);
        }
        if(msg?.channel === 'pm'){
          __v295_savePmCache();
          __updateHangarPmNeon?.();
        }
      }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const hangarTab = document.getElementById('hangar-tab');
  if(hangarTab && !hangarTab.dataset.v295CollapseBound){
    hangarTab.dataset.v295CollapseBound = '1';
    hangarTab.addEventListener('click', () => {
      setTimeout(() => { try{ setHangarChatMode?.(true, true); __v295_forceHangarChatLowered(); }catch(_){} }, 0);
      setTimeout(() => { try{ setHangarChatMode?.(true, true); __v295_forceHangarChatLowered(); }catch(_){} }, 80);
      setTimeout(() => { try{ setHangarChatMode?.(true, true); __v295_forceHangarChatLowered(); }catch(_){} }, 220);
    });
  }
})();

(function(){
  const __origSyncHangarChatVisibilityV295 = typeof __syncHangarChatVisibility === 'function' ? __syncHangarChatVisibility : null;
  if(__origSyncHangarChatVisibilityV295){
    __syncHangarChatVisibility = function(){
      const result = __origSyncHangarChatVisibilityV295.apply(this, arguments);
      try{
        const hangarWindow = document.getElementById('hangar-window');
        const isVisible = !!(hangarWindow && !hangarWindow.classList.contains('hidden') && hangarWindow.style.display !== 'none');
        if(isVisible) {
          setHangarChatMode?.(true, true);
          __v295_forceHangarChatLowered();
        }
      }catch(_){ }
      return result;
    };
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  try{ __v295_restorePmCache(); }catch(_){ }
  setTimeout(() => {
    try{ renderChatTabs?.(); if(currentChat?.startsWith?.('pm:')) renderLobbyMessages?.(); }catch(_){ }
  }, 120);
});


// ===== V296 HANGAR CHAT FINAL MICRO FIX =====
const COSMIC_PM_CACHE_KEY_V296 = 'cosmicPmCache:v296';

function __v296_savePmCache(){
  try{
    const snapshot = (typeof __v295_collectPmCacheSnapshot === 'function')
      ? __v295_collectPmCacheSnapshot()
      : { tabs:{}, messages:{}, unread:{}, currentChat: currentChat || 'global', savedAt: Date.now() };
    localStorage.setItem(COSMIC_PM_CACHE_KEY_V296, JSON.stringify(snapshot));
  }catch(_){ }
}

function __v296_restorePmCache(){
  try{
    const raw = localStorage.getItem(COSMIC_PM_CACHE_KEY_V296)
      || localStorage.getItem('cosmicPmCache:v295')
      || localStorage.getItem('cosmicPmCache:v294');
    if(!raw) return;
    const state = JSON.parse(raw);
    const tabs = state?.tabs && typeof state.tabs === 'object' ? state.tabs : {};
    const messages = state?.messages && typeof state.messages === 'object' ? state.messages : {};
    const unread = state?.unread && typeof state.unread === 'object' ? state.unread : {};

    Object.entries(tabs).forEach(([peerId, meta]) => {
      const safePeerId = String(peerId || '').trim();
      if(!safePeerId) return;
      privateChatTabs[safePeerId] = {
        label: String(meta?.label || `ID ${safePeerId}`),
        updatedAt: Number(meta?.updatedAt) || Date.now(),
        pinned: !!meta?.pinned,
        preview: String(meta?.preview || '')
      };
      if(!chatCache.pm) chatCache.pm = {};
      if(!Array.isArray(chatCache.pm[safePeerId])) chatCache.pm[safePeerId] = [];
      const list = Array.isArray(messages?.[safePeerId]) ? messages[safePeerId] : [];
      if(list.length) chatCache.pm[safePeerId] = list.slice(-60);
      if(chatUnread?.pm) chatUnread.pm[safePeerId] = Math.max(0, Number(unread?.[safePeerId] || chatUnread.pm[safePeerId] || 0) || 0);
    });

    const savedCurrent = String(state?.currentChat || currentChat || 'global');
    if(savedCurrent === 'global' || savedCurrent === 'battle' || savedCurrent === 'clan' || savedCurrent.startsWith('pm:')){
      currentChat = savedCurrent;
    }
  }catch(_){ }
}

(function(){
  const __origLoadChatHistoryV296 = typeof loadChatHistory === 'function' ? loadChatHistory : null;
  if(__origLoadChatHistoryV296){
    loadChatHistory = async function(scopeName, ...rest){
      const result = await __origLoadChatHistoryV296.call(this, scopeName, ...rest);
      try{
        if(String(scopeName || '').startsWith('pm:')){
          __v296_restorePmCache();
          renderChatTabs?.();
          if(currentChat === scopeName) renderLobbyMessages?.();
        }
      }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origDeletePmHistoryWithPeerV296 = typeof deletePmHistoryWithPeer === 'function' ? deletePmHistoryWithPeer : null;
  if(__origDeletePmHistoryWithPeerV296){
    deletePmHistoryWithPeer = async function(peerId){
      const result = await __origDeletePmHistoryWithPeerV296.apply(this, arguments);
      try{ __v296_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origDeleteAllOwnPmHistoryV296 = typeof deleteAllOwnPmHistory === 'function' ? deleteAllOwnPmHistory : null;
  if(__origDeleteAllOwnPmHistoryV296){
    deleteAllOwnPmHistory = async function(){
      const result = await __origDeleteAllOwnPmHistoryV296.apply(this, arguments);
      try{ __v296_savePmCache(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origResetPrivateChatStateV296 = typeof resetPrivateChatState === 'function' ? resetPrivateChatState : null;
  if(__origResetPrivateChatStateV296){
    resetPrivateChatState = function(){
      try{ __v296_savePmCache(); }catch(_){ }
      const result = __origResetPrivateChatStateV296.apply(this, arguments);
      try{ __v296_restorePmCache(); }catch(_){ }
      try{ renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ }
      return result;
    };
  }
})();

(function(){
  const __origHandleIncomingChatMessageV296 = typeof handleIncomingChatMessage === 'function' ? handleIncomingChatMessage : null;
  if(__origHandleIncomingChatMessageV296){
    handleIncomingChatMessage = function(msg){
      const result = __origHandleIncomingChatMessageV296.apply(this, arguments);
      try{
        if(msg?.channel === 'pm'){
          __hangarPmPulseUntil = Date.now() + 15000;
          __v296_savePmCache();
          __updateHangarPmNeon?.();
        }
      }catch(_){ }
      return result;
    };
  }
})();

window.addEventListener('beforeunload', () => {
  try{ __v296_savePmCache(); }catch(_){ }
});

document.addEventListener('visibilitychange', () => {
  try{
    if(document.visibilityState !== 'hidden') return;
    __v296_savePmCache();
  }catch(_){ }
});

document.addEventListener('DOMContentLoaded', () => {
  try{ __v296_restorePmCache(); }catch(_){ }
  setTimeout(() => {
    try{ __v296_restorePmCache(); renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ }
  }, 700);
  setTimeout(() => {
    try{ __v296_restorePmCache(); renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ }
  }, 1800);
});

setInterval(() => {
  try{
    if(gameState === 'HANGAR'){
      setHangarChatMode?.(true, true);
      __v295_forceHangarChatLowered?.();
      __updateHangarPmNeon?.();
    }
  }catch(_){ }
}, 250);



// ===== V339 PM CLOSED TABS + KILL DEDUPE FIX =====
(function(){
  const V339_KILL_DEDUPE_MS = 4500;
  const V339_FEED_DEDUPE_MS = 2600;
  const __v339KillSeen = new Map();
  const __v339FeedSeen = new Map();

  function __v339_now(){ return Date.now(); }
  function __v339_trimMap(map, now){
    try{
      for(const [key, until] of map.entries()){
        if(Number(until || 0) <= now - 500){ map.delete(key); }
      }
    }catch(_){ }
  }
  function __v339_getRoomKey(){
    try{ return String(getBattleHitsRoomId?.() || getBattleRoomIdSafe?.() || currentRoom?.id || currentRoom?.roomId || '').trim(); }catch(_){ return ''; }
  }
  function __v339_getKillKey(payload = {}){
    const room = __v339_getRoomKey();
    const attacker = String(payload?.attackerId || '').trim();
    const victim = String(payload?.victimId || '').trim();
    if(!attacker || !victim) return '';
    return `${room || 'room'}:${attacker}->${victim}`;
  }

  const __origHandleIncomingBattleKillV339 = typeof handleIncomingBattleKill === 'function' ? handleIncomingBattleKill : null;
  if(__origHandleIncomingBattleKillV339){
    handleIncomingBattleKill = function(payload = {}){
      const key = __v339_getKillKey(payload);
      const now = __v339_now();
      __v339_trimMap(__v339KillSeen, now);
      if(key){
        const until = Number(__v339KillSeen.get(key) || 0) || 0;
        if(until > now) return;
        __v339KillSeen.set(key, now + V339_KILL_DEDUPE_MS);
      }
      return __origHandleIncomingBattleKillV339.apply(this, arguments);
    };
    try{ window.handleIncomingBattleKill = handleIncomingBattleKill; }catch(_){ }
  }

  const __origPushKillFeedV339 = typeof pushKillFeed === 'function' ? pushKillFeed : null;
  if(__origPushKillFeedV339){
    pushKillFeed = function(text, type = 'kill'){
      const safeText = String(text || '').trim();
      const safeType = String(type || 'kill').trim();
      const now = __v339_now();
      __v339_trimMap(__v339FeedSeen, now);
      if(safeType === 'kill' && safeText){
        const key = `${safeType}:${safeText}`;
        const until = Number(__v339FeedSeen.get(key) || 0) || 0;
        if(until > now) return;
        __v339FeedSeen.set(key, now + V339_FEED_DEDUPE_MS);
      }
      return __origPushKillFeedV339.apply(this, arguments);
    };
    try{ window.pushKillFeed = pushKillFeed; }catch(_){ }
  }
})();

(function(){
  const V339_CLOSED_KEY = (typeof COSMIC_CLOSED_PM_TABS_KEY_V338 !== 'undefined') ? COSMIC_CLOSED_PM_TABS_KEY_V338 : 'cosmicClosedPmTabs:v338';
  const V339_PM_CACHE_KEYS = ['cosmicPmCache:v294','cosmicPmCache:v295','cosmicPmCache:v296'];

  function __v339_getClosedSet(){
    try{
      const raw = localStorage.getItem(V339_CLOSED_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list.map(id => String(id || '').trim()).filter(Boolean) : []);
    }catch(_){ return new Set(); }
  }

  function __v339_saveClosedSet(set){
    try{ localStorage.setItem(V339_CLOSED_KEY, JSON.stringify(Array.from(set || []))); }catch(_){ }
  }

  function __v339_isClosed(peerId){
    const key = String(peerId || '').trim();
    return !!(key && __v339_getClosedSet().has(key));
  }

  function __v339_safeParse(raw){
    try{ return raw ? JSON.parse(raw) : null; }catch(_){ return null; }
  }

  function __v339_cleanCacheObject(state, closedSet){
    if(!state || typeof state !== 'object') return state;
    const removePeer = (obj) => {
      if(!obj || typeof obj !== 'object') return;
      closedSet.forEach(id => { try{ delete obj[id]; }catch(_){} });
    };
    removePeer(state.tabs);
    removePeer(state.privateTabs);
    removePeer(state.messages);
    removePeer(state.unread);
    if(state.currentChat && String(state.currentChat).startsWith('pm:')){
      const peer = String(state.currentChat).slice(3).trim();
      if(closedSet.has(peer)) state.currentChat = 'global';
    }
    return state;
  }

  function __v339_purgeClosedPmCaches(peerId = ''){
    try{
      const closedSet = __v339_getClosedSet();
      const single = String(peerId || '').trim();
      if(single) closedSet.add(single);
      __v339_saveClosedSet(closedSet);

      if(typeof privateChatTabs === 'object') closedSet.forEach(id => { delete privateChatTabs[id]; });
      if(chatCache?.pm) closedSet.forEach(id => { delete chatCache.pm[id]; });
      if(chatUnread?.pm) closedSet.forEach(id => { delete chatUnread.pm[id]; });
      try{ closedSet.forEach(id => onlinePmPeers?.delete?.(id)); }catch(_){ }
      try{ closedSet.forEach(id => inGamePmPeers?.delete?.(id)); }catch(_){ }
      try{ closedSet.forEach(id => pmPeerRoomIds?.delete?.(id)); }catch(_){ }
      if(String(currentChat || '').startsWith('pm:')){
        const peer = String(currentChat).slice(3).trim();
        if(closedSet.has(peer)) currentChat = 'global';
      }

      const uiKey = (typeof CHAT_UI_STATE_KEY !== 'undefined') ? CHAT_UI_STATE_KEY : 'cosmicChatUiState:v27';
      const uiState = __v339_cleanCacheObject(__v339_safeParse(localStorage.getItem(uiKey)), closedSet);
      if(uiState) localStorage.setItem(uiKey, JSON.stringify(uiState));

      V339_PM_CACHE_KEYS.forEach(storageKey => {
        const state = __v339_cleanCacheObject(__v339_safeParse(localStorage.getItem(storageKey)), closedSet);
        if(state) localStorage.setItem(storageKey, JSON.stringify(state));
      });
    }catch(_){ }
  }

  function __v339_cleanRuntimeClosed(){
    try{ __v339_purgeClosedPmCaches(''); }catch(_){ }
  }

  const __origMarkClosedV339 = typeof markPmTabClosedV338 === 'function' ? markPmTabClosedV338 : null;
  markPmTabClosedV338 = function(peerId){
    if(__origMarkClosedV339) __origMarkClosedV339.apply(this, arguments);
    __v339_purgeClosedPmCaches(peerId);
  };
  try{ window.markPmTabClosedV338 = markPmTabClosedV338; }catch(_){ }

  const __origUnmarkClosedV339 = typeof unmarkPmTabClosedV338 === 'function' ? unmarkPmTabClosedV338 : null;
  unmarkPmTabClosedV338 = function(peerId){
    const key = String(peerId || '').trim();
    if(__origUnmarkClosedV339) __origUnmarkClosedV339.apply(this, arguments);
    if(!key) return;
    try{
      const closed = __v339_getClosedSet();
      if(closed.delete(key)) __v339_saveClosedSet(closed);
    }catch(_){ }
  };
  try{ window.unmarkPmTabClosedV338 = unmarkPmTabClosedV338; }catch(_){ }

  isPmTabClosedV338 = function(peerId){ return __v339_isClosed(peerId); };
  try{ window.isPmTabClosedV338 = isPmTabClosedV338; }catch(_){ }

  const __origEnsurePmTabV339 = typeof ensurePmTab === 'function' ? ensurePmTab : null;
  if(__origEnsurePmTabV339){
    ensurePmTab = function(peerId, label = null){
      const key = String(peerId || '').trim();
      if(key && __v339_isClosed(key) && !window.__v339AllowClosedPmReopen){
        __v339_purgeClosedPmCaches(key);
        try{ renderChatTabs?.(); }catch(_){ }
        return;
      }
      return __origEnsurePmTabV339.apply(this, arguments);
    };
    try{ window.ensurePmTab = ensurePmTab; }catch(_){ }
  }

  const __origOpenPrivateChatV339 = typeof openPrivateChat === 'function' ? openPrivateChat : null;
  if(__origOpenPrivateChatV339){
    openPrivateChat = function(peerId, label = null){
      const key = String(peerId || '').trim();
      if(key) unmarkPmTabClosedV338(key);
      window.__v339AllowClosedPmReopen = true;
      try{ return __origOpenPrivateChatV339.apply(this, arguments); }
      finally{ window.__v339AllowClosedPmReopen = false; }
    };
    try{ window.openPrivateChat = openPrivateChat; }catch(_){ }
  }

  const __origLoadChatHistoryV339 = typeof loadChatHistory === 'function' ? loadChatHistory : null;
  if(__origLoadChatHistoryV339){
    loadChatHistory = async function(scopeName = currentChat, ...rest){
      const scopeText = String(scopeName || '').trim();
      if(scopeText.startsWith('pm:')){
        const peer = scopeText.slice(3).trim();
        if(peer && __v339_isClosed(peer) && !window.__v339AllowClosedPmReopen){
          __v339_purgeClosedPmCaches(peer);
          try{ renderChatTabs?.(); if(currentChat === 'global') renderLobbyMessages?.(); }catch(_){ }
          return;
        }
      }
      const result = await __origLoadChatHistoryV339.call(this, scopeName, ...rest);
      __v339_cleanRuntimeClosed();
      return result;
    };
    try{ window.loadChatHistory = loadChatHistory; }catch(_){ }
  }

  function __v339_wrapRestore(original){
    if(typeof original !== 'function') return null;
    return function(){
      const result = original.apply(this, arguments);
      __v339_cleanRuntimeClosed();
      return result;
    };
  }

  try{ if(typeof restoreChatUiState === 'function') restoreChatUiState = __v339_wrapRestore(restoreChatUiState); }catch(_){ }
  try{ if(typeof __v294_restorePmCache === 'function') __v294_restorePmCache = __v339_wrapRestore(__v294_restorePmCache); }catch(_){ }
  try{ if(typeof __v295_restorePmCache === 'function') __v295_restorePmCache = __v339_wrapRestore(__v295_restorePmCache); }catch(_){ }
  try{ if(typeof __v296_restorePmCache === 'function') __v296_restorePmCache = __v339_wrapRestore(__v296_restorePmCache); }catch(_){ }

  const __origHandleRealtimeV339 = typeof handleIncomingRealtimeMessage === 'function' ? handleIncomingRealtimeMessage : null;
  if(__origHandleRealtimeV339){
    handleIncomingRealtimeMessage = async function(msg){
      if(msg?.channel === 'pm'){
        const peerId = getPeerIdFromPmMessage?.(msg);
        if(peerId && __v339_isClosed(peerId)){
          __v339_purgeClosedPmCaches(peerId);
          return;
        }
      }
      return __origHandleRealtimeV339.apply(this, arguments);
    };
    try{ window.handleIncomingRealtimeMessage = handleIncomingRealtimeMessage; }catch(_){ }
  }

  window.addEventListener('storage', (event) => {
    if(event?.key === V339_CLOSED_KEY) __v339_cleanRuntimeClosed();
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(__v339_cleanRuntimeClosed, 0);
    setTimeout(() => { __v339_cleanRuntimeClosed(); try{ renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ } }, 350);
    setTimeout(() => { __v339_cleanRuntimeClosed(); try{ renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ } }, 1200);
    setTimeout(() => { __v339_cleanRuntimeClosed(); try{ renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ } }, 2500);
  });

  setInterval(() => {
    try{ __v339_cleanRuntimeClosed(); renderChatTabs?.(); }catch(_){ }
  }, 1800);
})();

// ===== V340 PM SELF-DUPLICATE TAB FIX =====
(function(){
  const V340_PM_CACHE_KEYS = ['cosmicPmCache:v294','cosmicPmCache:v295','cosmicPmCache:v296'];
  function __v340_ownId(){ try{ return String(getOwnPublicChatId?.() || authState?.playerId || player?.public_id || '').trim(); }catch(_){ return ''; } }
  function __v340_isSelfPeer(peerId){ const own = __v340_ownId(); const peer = String(peerId || '').trim(); return !!(own && peer && own === peer); }
  function __v340_parse(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(_){ return null; } }
  function __v340_cleanObject(state){
    const own = __v340_ownId();
    if(!own || !state || typeof state !== 'object') return state;
    const removeOwn = (obj) => { if(obj && typeof obj === 'object'){ try{ delete obj[own]; }catch(_){ } } };
    removeOwn(state.tabs); removeOwn(state.privateTabs); removeOwn(state.messages); removeOwn(state.unread);
    if(String(state.currentChat || '') === `pm:${own}`) state.currentChat = 'global';
    return state;
  }
  function __v340_purgeSelfPm(){
    const own = __v340_ownId();
    if(!own) return;
    try{ if(privateChatTabs && typeof privateChatTabs === 'object') delete privateChatTabs[own]; }catch(_){ }
    try{ if(chatCache?.pm) delete chatCache.pm[own]; }catch(_){ }
    try{ if(chatUnread?.pm) delete chatUnread.pm[own]; }catch(_){ }
    try{ onlinePmPeers?.delete?.(own); }catch(_){ }
    try{ inGamePmPeers?.delete?.(own); }catch(_){ }
    try{ pmPeerRoomIds?.delete?.(own); }catch(_){ }
    try{ if(String(currentChat || '') === `pm:${own}`) currentChat = 'global'; }catch(_){ }
    try{ const uiKey = (typeof CHAT_UI_STATE_KEY !== 'undefined') ? CHAT_UI_STATE_KEY : 'cosmicChatUiState:v27'; const state = __v340_cleanObject(__v340_parse(localStorage.getItem(uiKey))); if(state) localStorage.setItem(uiKey, JSON.stringify(state)); }catch(_){ }
    V340_PM_CACHE_KEYS.forEach(key => { try{ const state = __v340_cleanObject(__v340_parse(localStorage.getItem(key))); if(state) localStorage.setItem(key, JSON.stringify(state)); }catch(_){ } });
  }
  const __origGetPeerIdFromPmMessageV340 = typeof getPeerIdFromPmMessage === 'function' ? getPeerIdFromPmMessage : null;
  if(__origGetPeerIdFromPmMessageV340){ getPeerIdFromPmMessage = function(msg){ const peer = __origGetPeerIdFromPmMessageV340.apply(this, arguments); if(__v340_isSelfPeer(peer)) return null; return peer; }; try{ window.getPeerIdFromPmMessage = getPeerIdFromPmMessage; }catch(_){ } }
  const __origEnsurePmTabV340 = typeof ensurePmTab === 'function' ? ensurePmTab : null;
  if(__origEnsurePmTabV340){ ensurePmTab = function(peerId, label = null){ if(__v340_isSelfPeer(peerId)){ __v340_purgeSelfPm(); try{ renderChatTabs?.(); }catch(_){ } return; } return __origEnsurePmTabV340.apply(this, arguments); }; try{ window.ensurePmTab = ensurePmTab; }catch(_){ } }
  const __origOpenPrivateChatV340 = typeof openPrivateChat === 'function' ? openPrivateChat : null;
  if(__origOpenPrivateChatV340){ openPrivateChat = function(peerId, label = null){ if(__v340_isSelfPeer(peerId)){ __v340_purgeSelfPm(); try{ renderChatTabs?.(); }catch(_){ } return; } return __origOpenPrivateChatV340.apply(this, arguments); }; try{ window.openPrivateChat = openPrivateChat; }catch(_){ } }
  const __origPushChatToCacheV340 = typeof pushChatToCache === 'function' ? pushChatToCache : null;
  if(__origPushChatToCacheV340){ pushChatToCache = function(scope, msg){ if(scope?.channel === 'pm'){ const peer = String(scope?.peerId || getPeerIdFromPmMessage?.(msg) || '').trim(); if(__v340_isSelfPeer(peer)){ __v340_purgeSelfPm(); return false; } } const result = __origPushChatToCacheV340.apply(this, arguments); __v340_purgeSelfPm(); return result; }; try{ window.pushChatToCache = pushChatToCache; }catch(_){ } }
  const __origRenderChatTabsV340 = typeof renderChatTabs === 'function' ? renderChatTabs : null;
  if(__origRenderChatTabsV340){ renderChatTabs = function(){ __v340_purgeSelfPm(); return __origRenderChatTabsV340.apply(this, arguments); }; try{ window.renderChatTabs = renderChatTabs; }catch(_){ } }
  const __origSaveChatUiStateV340 = typeof saveChatUiState === 'function' ? saveChatUiState : null;
  if(__origSaveChatUiStateV340){ saveChatUiState = function(){ __v340_purgeSelfPm(); return __origSaveChatUiStateV340.apply(this, arguments); }; try{ window.saveChatUiState = saveChatUiState; }catch(_){ } }
  function __v340_wrapRestore(original){ if(typeof original !== 'function') return original; return function(){ const result = original.apply(this, arguments); __v340_purgeSelfPm(); return result; }; }
  try{ if(typeof restoreChatUiState === 'function') restoreChatUiState = __v340_wrapRestore(restoreChatUiState); }catch(_){ }
  try{ if(typeof __v294_restorePmCache === 'function') __v294_restorePmCache = __v340_wrapRestore(__v294_restorePmCache); }catch(_){ }
  try{ if(typeof __v295_restorePmCache === 'function') __v295_restorePmCache = __v340_wrapRestore(__v295_restorePmCache); }catch(_){ }
  try{ if(typeof __v296_restorePmCache === 'function') __v296_restorePmCache = __v340_wrapRestore(__v296_restorePmCache); }catch(_){ }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { __v340_purgeSelfPm(); try{ renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ } }, 0);
    setTimeout(() => { __v340_purgeSelfPm(); try{ renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ } }, 500);
    setTimeout(() => { __v340_purgeSelfPm(); try{ renderChatTabs?.(); renderLobbyMessages?.(); }catch(_){ } }, 1600);
  });
  setInterval(() => { try{ __v340_purgeSelfPm(); }catch(_){ } }, 2500);
})();

// ===== V341 PM INCOMING RESTORE FIX =====
(function(){
  const __origHandleIncomingRealtimeMessageV341 = typeof handleIncomingRealtimeMessage === 'function' ? handleIncomingRealtimeMessage : null;

  function __v341_ownPublicId(){
    try{ return String(getOwnPublicChatId?.() || '').trim(); }catch(_){ return ''; }
  }

  function __v341_getPeerFromMessage(msg){
    const ownId = __v341_ownPublicId();
    if(!ownId || !msg) return '';
    const senderId = String(msg?.player_public_id || '').trim();
    const recipientId = String(msg?.recipient_public_id || '').trim();
    if(senderId && senderId === ownId) return recipientId;
    if(recipientId && recipientId === ownId) return senderId;
    return '';
  }

  function __v341_isIncomingToMe(msg){
    const ownId = __v341_ownPublicId();
    if(!ownId || !msg) return false;
    const senderId = String(msg?.player_public_id || '').trim();
    const recipientId = String(msg?.recipient_public_id || '').trim();
    return !!(recipientId && recipientId === ownId && senderId && senderId !== ownId);
  }

  function __v341_getLabel(msg, peerId){
    try{
      const ownId = __v341_ownPublicId();
      const senderId = String(msg?.player_public_id || '').trim();
      if(senderId && senderId !== ownId){
        return String(msg?.player_nickname || '').trim() || `ID ${peerId}`;
      }
      return privateChatTabs?.[String(peerId)]?.label || `ID ${peerId}`;
    }catch(_){
      return `ID ${peerId}`;
    }
  }

  if(__origHandleIncomingRealtimeMessageV341){
    handleIncomingRealtimeMessage = async function(msg){
      if(!msg || msg.channel !== 'pm'){
        return __origHandleIncomingRealtimeMessageV341.apply(this, arguments);
      }

      try{ await hydrateStaffRolesForMessages?.([msg]); }catch(_){ }

      const ownId = __v341_ownPublicId();
      if(!ownId) return;

      const peerId = __v341_getPeerFromMessage(msg);
      if(!peerId || peerId === ownId) return;

      const incomingToMe = __v341_isIncomingToMe(msg);
      if(incomingToMe){
        try{ unmarkPmTabClosedV338?.(peerId); }catch(_){ }
      }else{
        try{
          if(typeof isPmTabClosedV338 === 'function' && isPmTabClosedV338(peerId)){
            return;
          }
        }catch(_){ }
      }

      const scope = { key: getPrivateScopeKey(peerId), channel: 'pm', peerId };
      const pushed = pushChatToCache(scope, msg);
      if(!pushed){
        return;
      }

      ensurePmTab(peerId, __v341_getLabel(msg, peerId));
      syncPrivateTabFromScope(scope.key);

      const chatWrapper = document.getElementById('chat-wrapper');
      const isHangarLowered = document.body.classList.contains('hangar-chat-lowered') || chatWrapper?.classList.contains('hangar-chat-lowered');

      if(currentChat !== scope.key){
        incrementUnread(scope.key);
      }else if(isHangarLowered){
        try{ __hangarPmPulseUntil = Date.now() + 12000; }catch(_){ }
      }

      if(currentChat === scope.key){
        try{ renderLobbyMessages?.(); }catch(_){ }
      }
      try{ renderChatTabs?.(); }catch(_){ }
      try{ __updateHangarPmNeon?.(); }catch(_){ }
      try{ saveChatUiState?.(); }catch(_){ }
    };
    try{ window.handleIncomingRealtimeMessage = handleIncomingRealtimeMessage; }catch(_){ }
  }
})();


// ===== V342 PM READ/PERSISTENCE FIX =====
(function(){
  function __v342_isPmScope(scopeName){
    return String(scopeName || '').trim().startsWith('pm:');
  }

  function __v342_clearPmUnread(scopeName){
    const scope = String(scopeName || currentChat || '').trim();
    if(!__v342_isPmScope(scope)) return;
    try{ setUnreadCount?.(scope, 0); }catch(_){
      try{
        const peerId = scope.slice(3).trim();
        if(peerId && chatUnread?.pm) chatUnread.pm[peerId] = 0;
      }catch(__){}
    }
    try{ __updateHangarPmNeon?.(); }catch(_){ }
    try{ __v294_savePmCache?.(); }catch(_){ }
    try{ __v295_savePmCache?.(); }catch(_){ }
    try{ __v296_savePmCache?.(); }catch(_){ }
  }

  const __origClearUnreadForCurrentScopeV342 = typeof clearUnreadForCurrentScope === 'function' ? clearUnreadForCurrentScope : null;
  if(__origClearUnreadForCurrentScopeV342){
    clearUnreadForCurrentScope = function(){
      const result = __origClearUnreadForCurrentScopeV342.apply(this, arguments);
      __v342_clearPmUnread(currentChat);
      try{ saveChatUiState?.(); }catch(_){ }
      return result;
    };
    try{ window.clearUnreadForCurrentScope = clearUnreadForCurrentScope; }catch(_){ }
  }

  const __origLoadChatHistoryV342 = typeof loadChatHistory === 'function' ? loadChatHistory : null;
  if(__origLoadChatHistoryV342){
    loadChatHistory = async function(scopeName = currentChat, ...rest){
      const result = await __origLoadChatHistoryV342.call(this, scopeName, ...rest);
      if(String(scopeName || currentChat || '').trim() === String(currentChat || '').trim()){
        __v342_clearPmUnread(scopeName);
      }
      if(__v342_isPmScope(scopeName)){
        try{ saveChatUiState?.(); }catch(_){ }
      }
      return result;
    };
    try{ window.loadChatHistory = loadChatHistory; }catch(_){ }
  }

  const __origRenderChatTabsV342 = typeof renderChatTabs === 'function' ? renderChatTabs : null;
  if(__origRenderChatTabsV342){
    renderChatTabs = function(){
      if(__v342_isPmScope(currentChat)) __v342_clearPmUnread(currentChat);
      return __origRenderChatTabsV342.apply(this, arguments);
    };
    try{ window.renderChatTabs = renderChatTabs; }catch(_){ }
  }

  const __origHandleIncomingRealtimeMessageV342 = typeof handleIncomingRealtimeMessage === 'function' ? handleIncomingRealtimeMessage : null;
  if(__origHandleIncomingRealtimeMessageV342){
    handleIncomingRealtimeMessage = async function(msg){
      const result = await __origHandleIncomingRealtimeMessageV342.apply(this, arguments);
      try{
        if(msg?.channel === 'pm'){
          const peerId = getPeerIdFromPmMessage?.(msg);
          const scope = peerId ? getPrivateScopeKey(peerId) : '';
          if(scope && String(currentChat || '') === String(scope)){
            __v342_clearPmUnread(scope);
            renderChatTabs?.();
          }
          try{ __v294_savePmCache?.(); }catch(_){ }
          try{ __v295_savePmCache?.(); }catch(_){ }
          try{ __v296_savePmCache?.(); }catch(_){ }
        }
      }catch(_){ }
      return result;
    };
    try{ window.handleIncomingRealtimeMessage = handleIncomingRealtimeMessage; }catch(_){ }
  }

  // PM messages must remain available after refresh/re-login until the user closes the tab.
  deletePmHistoryWithPeer = async function(){ return; };
  deleteAllOwnPmHistory = async function(){ return; };
  try{ window.deletePmHistoryWithPeer = deletePmHistoryWithPeer; window.deleteAllOwnPmHistory = deleteAllOwnPmHistory; }catch(_){ }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try{ if(__v342_isPmScope(currentChat)){ __v342_clearPmUnread(currentChat); renderChatTabs?.(); } }catch(_){ } }, 250);
    setTimeout(() => { try{ if(__v342_isPmScope(currentChat)){ __v342_clearPmUnread(currentChat); renderChatTabs?.(); } }catch(_){ } }, 1200);
  });
})();


// ===== V344 PM OPEN TAB PERSISTENCE FIX =====
(function(){
  const V344_BASE_KEY = 'cosmicPmOpenState:v344';
  const LEGACY_KEYS = ['cosmicPmCache:v343','cosmicPmCache:v343:lastNonEmpty','cosmicPmCache:v342','cosmicPmCache:v296','cosmicPmCache:v295','cosmicPmCache:v294'];

  function ownId(){
    try{ return String(getOwnPublicChatId?.() || authState?.playerId || '').trim(); }catch(_){ return ''; }
  }

  function key(){
    const id = ownId();
    return id ? `${V344_BASE_KEY}:${id}` : V344_BASE_KEY;
  }

  function parse(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(_){ return null; } }
  function isNumericPeer(peerId){ return /^\d+$/.test(String(peerId || '').trim()); }
  function isSelf(peerId){ const me = ownId(); const p = String(peerId || '').trim(); return !!(me && p && me === p); }

  function getClosedSet(){
    try{
      const storageKey = (typeof COSMIC_CLOSED_PM_TABS_KEY_V338 !== 'undefined') ? COSMIC_CLOSED_PM_TABS_KEY_V338 : 'cosmicClosedPmTabs:v338';
      const arr = parse(localStorage.getItem(storageKey)) || [];
      return new Set(Array.isArray(arr) ? arr.map(v => String(v || '').trim()).filter(Boolean) : []);
    }catch(_){ return new Set(); }
  }

  function removeClosedMarker(peerId){
    const p = String(peerId || '').trim();
    if(!p) return;
    try{ unmarkPmTabClosedV338?.(p); }catch(_){
      try{
        const storageKey = (typeof COSMIC_CLOSED_PM_TABS_KEY_V338 !== 'undefined') ? COSMIC_CLOSED_PM_TABS_KEY_V338 : 'cosmicClosedPmTabs:v338';
        const arr = parse(localStorage.getItem(storageKey)) || [];
        const next = (Array.isArray(arr) ? arr : []).map(v => String(v || '').trim()).filter(v => v && v !== p);
        localStorage.setItem(storageKey, JSON.stringify(next));
      }catch(__){}
    }
  }

  function messagePeer(msg){
    try{
      const me = ownId();
      const sender = String(msg?.player_public_id || '').trim();
      const rec = String(msg?.recipient_public_id || '').trim();
      if(sender && sender === me) return rec;
      if(rec && rec === me) return sender;
    }catch(_){ }
    return '';
  }

  function normalizeState(rawState){
    const closed = getClosedSet();
    const state = rawState && typeof rawState === 'object' ? rawState : {};
    const rawTabs = state.tabs && typeof state.tabs === 'object' ? state.tabs : (state.privateTabs && typeof state.privateTabs === 'object' ? state.privateTabs : {});
    const rawMessages = state.messages && typeof state.messages === 'object' ? state.messages : {};
    const rawUnread = state.unread && typeof state.unread === 'object' ? state.unread : {};
    const out = { tabs:{}, messages:{}, unread:{}, currentChat: String(state.currentChat || 'global'), savedAt: Number(state.savedAt || Date.now()) || Date.now() };
    const allPeers = new Set([...Object.keys(rawTabs), ...Object.keys(rawMessages), ...Object.keys(rawUnread)]);
    for(const rawPeer of allPeers){
      const peer = String(rawPeer || '').trim();
      if(!peer || !isNumericPeer(peer) || isSelf(peer) || closed.has(peer)) continue;
      const meta = rawTabs[peer] || {};
      const list = Array.isArray(rawMessages[peer]) ? rawMessages[peer].filter(Boolean).slice(-80) : [];
      if(!rawTabs[peer] && !list.length) continue;
      out.tabs[peer] = {
        label: String(meta?.label || `ID ${peer}`),
        updatedAt: Number(meta?.updatedAt || Date.now()) || Date.now(),
        pinned: !!meta?.pinned,
        preview: String(meta?.preview || (list[list.length - 1]?.message || list[list.length - 1]?.text || ''))
      };
      out.messages[peer] = list;
      out.unread[peer] = Math.max(0, Number(rawUnread[peer] || 0) || 0);
    }
    if(String(out.currentChat || '').startsWith('pm:')){
      const peer = String(out.currentChat).slice(3).trim();
      if(!out.tabs[peer]) out.currentChat = 'global';
    }
    return out;
  }

  function collectState(){
    const out = { tabs:{}, messages:{}, unread:{}, currentChat: String(currentChat || 'global'), savedAt: Date.now() };
    try{
      Object.entries(privateChatTabs || {}).forEach(([peer, meta]) => {
        const p = String(peer || '').trim();
        if(!p || !isNumericPeer(p) || isSelf(p)) return;
        removeClosedMarker(p);
        const list = Array.isArray(chatCache?.pm?.[p]) ? chatCache.pm[p].filter(Boolean).slice(-80) : [];
        out.tabs[p] = {
          label: String(meta?.label || `ID ${p}`),
          updatedAt: Number(meta?.updatedAt || Date.now()) || Date.now(),
          pinned: !!meta?.pinned,
          preview: String(meta?.preview || (list[list.length - 1]?.message || list[list.length - 1]?.text || ''))
        };
        out.messages[p] = list;
        out.unread[p] = Math.max(0, Number(chatUnread?.pm?.[p] || 0) || 0);
      });
    }catch(_){ }
    return normalizeState(out);
  }

  function hasOpenTabs(state){
    return !!(state && state.tabs && Object.keys(state.tabs).length);
  }

  function loadStored(){
    const keys = [key(), V344_BASE_KEY, ...LEGACY_KEYS];
    for(const k of keys){
      try{
        const st = normalizeState(parse(localStorage.getItem(k)));
        if(hasOpenTabs(st)) return st;
      }catch(_){ }
    }
    return normalizeState(null);
  }

  function writeState(state){
    try{ localStorage.setItem(key(), JSON.stringify(normalizeState(state))); }catch(_){ }
  }

  function saveOpenPmState(){
    try{
      const state = collectState();
      if(hasOpenTabs(state)){
        writeState(state);
      }else{
        const old = loadStored();
        if(!hasOpenTabs(old)) writeState(state);
      }
    }catch(_){ }
  }

  function purgePeer(peerId){
    const p = String(peerId || '').trim();
    if(!p) return;
    try{
      const st = loadStored();
      delete st.tabs[p];
      delete st.messages[p];
      delete st.unread[p];
      if(st.currentChat === `pm:${p}`) st.currentChat = 'global';
      writeState(st);
    }catch(_){ }
  }

  function restoreOpenPmState(){
    try{
      const st = loadStored();
      if(!hasOpenTabs(st)) return false;
      Object.entries(st.tabs).forEach(([peer, meta]) => {
        const p = String(peer || '').trim();
        if(!p || isSelf(p)) return;
        removeClosedMarker(p);
        privateChatTabs[p] = {
          label: String(meta?.label || `ID ${p}`),
          updatedAt: Number(meta?.updatedAt || Date.now()) || Date.now(),
          pinned: !!meta?.pinned,
          preview: String(meta?.preview || '')
        };
        if(!chatCache.pm) chatCache.pm = {};
        if(!Array.isArray(chatCache.pm[p])) chatCache.pm[p] = [];
        const list = Array.isArray(st.messages?.[p]) ? st.messages[p].filter(Boolean).slice(-80) : [];
        if(list.length) chatCache.pm[p] = list;
        if(chatUnread?.pm) chatUnread.pm[p] = Math.max(0, Number(st.unread?.[p] || chatUnread.pm[p] || 0) || 0);
      });
      const savedCurrent = String(st.currentChat || 'global');
      if(savedCurrent === 'global' || savedCurrent === 'battle' || savedCurrent === 'clan' || (savedCurrent.startsWith('pm:') && privateChatTabs[savedCurrent.slice(3)])){
        currentChat = savedCurrent;
      }
      return true;
    }catch(_){ return false; }
  }

  window.__v344_saveOpenPmState = saveOpenPmState;
  window.__v344_restoreOpenPmState = restoreOpenPmState;

  const origRestore = typeof restoreChatUiState === 'function' ? restoreChatUiState : null;
  if(origRestore){
    restoreChatUiState = function(){
      const result = origRestore.apply(this, arguments);
      restoreOpenPmState();
      return result;
    };
    try{ window.restoreChatUiState = restoreChatUiState; }catch(_){ }
  }

  const origSave = typeof saveChatUiState === 'function' ? saveChatUiState : null;
  if(origSave){
    saveChatUiState = function(){
      Object.keys(privateChatTabs || {}).forEach(removeClosedMarker);
      const result = origSave.apply(this, arguments);
      saveOpenPmState();
      return result;
    };
    try{ window.saveChatUiState = saveChatUiState; }catch(_){ }
  }

  const origEnsure = typeof ensurePmTab === 'function' ? ensurePmTab : null;
  if(origEnsure){
    ensurePmTab = function(peerId, label = null){
      const p = String(peerId || '').trim();
      if(p) removeClosedMarker(p);
      const result = origEnsure.apply(this, arguments);
      saveOpenPmState();
      return result;
    };
    try{ window.ensurePmTab = ensurePmTab; }catch(_){ }
  }

  const origOpen = typeof openPrivateChat === 'function' ? openPrivateChat : null;
  if(origOpen){
    openPrivateChat = function(peerId, label = null){
      const p = String(peerId || '').trim();
      if(p) removeClosedMarker(p);
      const result = origOpen.apply(this, arguments);
      saveOpenPmState();
      return result;
    };
    try{ window.openPrivateChat = openPrivateChat; }catch(_){ }
  }

  const origPush = typeof pushChatToCache === 'function' ? pushChatToCache : null;
  if(origPush){
    pushChatToCache = function(scope, msg){
      const result = origPush.apply(this, arguments);
      try{
        if(scope?.channel === 'pm'){
          const p = String(scope?.peerId || messagePeer(msg) || '').trim();
          if(p && !isSelf(p)) removeClosedMarker(p);
          saveOpenPmState();
        }
      }catch(_){ }
      return result;
    };
    try{ window.pushChatToCache = pushChatToCache; }catch(_){ }
  }

  const origSetUnread = typeof setUnreadCount === 'function' ? setUnreadCount : null;
  if(origSetUnread){
    setUnreadCount = function(scopeName, count = 0){
      const result = origSetUnread.apply(this, arguments);
      if(String(scopeName || '').startsWith('pm:')) saveOpenPmState();
      return result;
    };
    try{ window.setUnreadCount = setUnreadCount; }catch(_){ }
  }

  const origMarkClosed = typeof markPmTabClosedV338 === 'function' ? markPmTabClosedV338 : null;
  if(origMarkClosed){
    markPmTabClosedV338 = function(peerId){
      const p = String(peerId || '').trim();
      const result = origMarkClosed.apply(this, arguments);
      if(p) purgePeer(p);
      return result;
    };
    try{ window.markPmTabClosedV338 = markPmTabClosedV338; }catch(_){ }
  }

  const origHandle = typeof handleIncomingRealtimeMessage === 'function' ? handleIncomingRealtimeMessage : null;
  if(origHandle){
    handleIncomingRealtimeMessage = async function(msg){
      const p = msg?.channel === 'pm' ? messagePeer(msg) : '';
      if(p && !isSelf(p)) removeClosedMarker(p);
      const result = await origHandle.apply(this, arguments);
      if(msg?.channel === 'pm') saveOpenPmState();
      return result;
    };
    try{ window.handleIncomingRealtimeMessage = handleIncomingRealtimeMessage; }catch(_){ }
  }

  const origLoad = typeof loadChatHistory === 'function' ? loadChatHistory : null;
  if(origLoad){
    loadChatHistory = async function(scopeName = currentChat, ...rest){
      const result = await origLoad.call(this, scopeName, ...rest);
      if(String(scopeName || '').startsWith('pm:')) saveOpenPmState();
      return result;
    };
    try{ window.loadChatHistory = loadChatHistory; }catch(_){ }
  }

  ['__v294_savePmCache','__v295_savePmCache','__v296_savePmCache','__v343_savePmCache'].forEach(name => {
    try{ window[name] = saveOpenPmState; }catch(_){ }
    try{ globalThis[name] = saveOpenPmState; }catch(_){ }
  });
  ['__v294_restorePmCache','__v295_restorePmCache','__v296_restorePmCache','__v343_restorePmCache'].forEach(name => {
    try{ window[name] = restoreOpenPmState; }catch(_){ }
    try{ globalThis[name] = restoreOpenPmState; }catch(_){ }
  });

  window.addEventListener('beforeunload', saveOpenPmState);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') saveOpenPmState(); });
  window.addEventListener('load', () => {
    setTimeout(() => { try{ restoreOpenPmState(); renderChatTabs?.(); if(String(currentChat || '').startsWith('pm:')){ loadChatHistory?.(currentChat).then(() => renderLobbyMessages?.()); } }catch(_){ } }, 650);
    setTimeout(() => { try{ restoreOpenPmState(); renderChatTabs?.(); if(String(currentChat || '').startsWith('pm:')) renderLobbyMessages?.(); }catch(_){ } }, 1800);
  });
})();

try{
    if(typeof updateBattle === 'function' && !updateBattle.__v372BotLabelHooked){
        const __oldUpdateBattleV372 = updateBattle;
        updateBattle = function(){
            const r = __oldUpdateBattleV372.apply(this, arguments);
            updateBattleBotNameLabel?.();
            return r;
        };
        updateBattle.__v372BotLabelHooked = true;
    }
}catch(_){}

try{
    if(typeof switchState === 'function' && !switchState.__v373KillFeedClearHooked){
        const __oldSwitchStateV373 = switchState;
        switchState = function(nextState){
            const result = __oldSwitchStateV373.apply(this, arguments);
            try{
                if(nextState !== 'BATTLE'){
                    clearBattleKillFeed?.();
                    clearBattleBotNameLabels?.();
                    const label = document.getElementById('battle-bot-name-label');
                    if(label) label.style.display = 'none';
                    clearBattleBotNameLabels?.();
                }
            }catch(_){}
            return result;
        };
        switchState.__v373KillFeedClearHooked = true;
    }
}catch(_){}

let __v373BotNameRaf = 0;
function startV373BotNameLoop(){
    if(__v373BotNameRaf) return;
    const tick = () => {
        try{ updateBattleBotNameLabel?.(); }catch(_){}
        __v373BotNameRaf = requestAnimationFrame(tick);
    };
    __v373BotNameRaf = requestAnimationFrame(tick);
}
try{ startV373BotNameLoop(); }catch(_){}

let __v374BotNameLoop = 0;
function startV374BotNameLoop(){
    if(__v374BotNameLoop) return;
    const tick = () => {
        try{ updateBattleBotNameLabel?.(); }catch(_){}
        __v374BotNameLoop = requestAnimationFrame(tick);
    };
    __v374BotNameLoop = requestAnimationFrame(tick);
}
try{ startV374BotNameLoop(); }catch(_){}


/* ================= V405 SINGLE SERVER CLEANUP + ORBIT UI RESTORE ================= */
(function(){
    const REAL_SERVER_ID = 'EU';
    function getServerList(){ return document.getElementById('auth-server-list'); }
    function getServerCurrent(){ return document.getElementById('auth-server-current'); }
    function getRealOption(){
        const list = getServerList();
        return list?.querySelector('[data-real-server="true"]') || list?.querySelector('[data-server="EU"]') || list?.querySelector('.auth-server-option') || null;
    }
    function removeExtraServerOptions(){
        try{
            const list = getServerList();
            const real = getRealOption();
            list?.querySelectorAll('.auth-server-option').forEach(el => { if(el !== real) el.remove(); });
        }catch(_){ }
    }
    function setCurrentServerButtonFromOption(option){
        const current = getServerCurrent();
        if(!current || !option) return;
        const dot = option.querySelector('.server-dot')?.cloneNode(true);
        const text = String(option.textContent || '1. Europe / Frankfurt (real)').trim();
        current.innerHTML = '';
        if(dot) current.appendChild(dot);
        const span = document.createElement('span');
        span.textContent = text;
        current.appendChild(span);
        const arrow = document.createElement('span');
        arrow.className = 'server-arrow';
        arrow.textContent = '⌄';
        current.appendChild(arrow);
    }
    function forceSingleServer(){
        try{
            removeExtraServerOptions();
            const list = getServerList();
            const real = getRealOption();
            if(real){
                real.dataset.server = REAL_SERVER_ID;
                real.dataset.realServer = 'true';
                real.classList.add('active');
                real.classList.remove('hidden');
                real.disabled = false;
                real.style.removeProperty('display');
                real.setAttribute('aria-disabled', 'false');
                setCurrentServerButtonFromOption(real);
            }
            if(list){
                list.querySelectorAll('.auth-server-option').forEach(btn => { if(btn !== real) btn.classList.remove('active'); });
            }
            try{ localStorage.setItem('cosmicSelectedServer', REAL_SERVER_ID); }catch(_){ }
        }catch(_){ }
    }
    window.getSelectedCosmicServer = function(){ return REAL_SERVER_ID; };
    const baseUpdateAuthServerVisibility = typeof updateAuthServerVisibility === 'function' ? updateAuthServerVisibility : null;
    updateAuthServerVisibility = function(){
        try{ baseUpdateAuthServerVisibility?.(); }catch(_){ }
        forceSingleServer();
    };
    window.updateAuthServerVisibility = updateAuthServerVisibility;
    function hardRestoreTopUi(){
        try{
            const state = String(gameState || window.gameState || '').toUpperCase();
            const isOrbit = state === 'ORBIT';
            const isLobby = state === 'LOBBY';
            const isAuth = state === 'AUTH';
            const isBattle = state === 'BATTLE' || state === 'OBSERVE';
            const premiumBar = document.getElementById('premium-bar');
            const accountInfo = document.getElementById('premium-account-info');
            const currencyBox = document.getElementById('premium-currency-box');
            const battleHud = document.getElementById('battle-player-hud');
            const resourceBar = document.getElementById('resource-bar');
            const topNav = document.getElementById('top-nav');
            if(document.body) document.body.classList.toggle('state-orbit', isOrbit);
            [premiumBar, accountInfo, currencyBox, battleHud, resourceBar, topNav].forEach(el => {
                if(!el) return;
                el.style.removeProperty('visibility');
                el.style.removeProperty('pointer-events');
            });
            if(isOrbit){
                [premiumBar, accountInfo, currencyBox, battleHud, topNav].forEach(el => {
                    if(!el) return;
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('pointer-events', 'none', 'important');
                });
                if(resourceBar){
                    resourceBar.style.setProperty('display', 'flex', 'important');
                    resourceBar.style.setProperty('visibility', 'visible', 'important');
                    resourceBar.style.setProperty('pointer-events', 'none', 'important');
                }
                return;
            }
            if(resourceBar) resourceBar.style.setProperty('display', 'none', 'important');
            if(isLobby){
                if(premiumBar) premiumBar.style.setProperty('display', 'flex', 'important');
                if(accountInfo) accountInfo.style.setProperty('display', 'flex', 'important');
                if(currencyBox) currencyBox.style.setProperty('display', 'flex', 'important');
                if(topNav) topNav.style.setProperty('display', 'flex', 'important');
                if(battleHud) battleHud.style.setProperty('display', 'none', 'important');
            }else if(isAuth){
                if(premiumBar) premiumBar.style.setProperty('display', 'none', 'important');
                if(accountInfo) accountInfo.style.removeProperty('display');
                if(currencyBox) currencyBox.style.removeProperty('display');
                if(topNav) topNav.style.setProperty('display', 'none', 'important');
                if(battleHud) battleHud.style.setProperty('display', 'none', 'important');
            }else if(isBattle){
                if(premiumBar) premiumBar.style.setProperty('display', 'none', 'important');
                if(resourceBar) resourceBar.style.setProperty('display', 'none', 'important');
                if(battleHud) battleHud.style.removeProperty('display');
            }
        }catch(_){ }
    }
    const baseSwitchState = typeof switchState === 'function' ? switchState : null;
    if(baseSwitchState){
        switchState = async function(...args){
            const result = await baseSwitchState.apply(this, args);
            forceSingleServer();
            hardRestoreTopUi();
            setTimeout(() => { forceSingleServer(); hardRestoreTopUi(); }, 120);
            setTimeout(() => { hardRestoreTopUi(); }, 600);
            return result;
        };
        window.switchState = switchState;
    }
    const baseUpdateHUD = typeof updateHUD === 'function' ? updateHUD : null;
    if(baseUpdateHUD){
        updateHUD = function(...args){
            const result = baseUpdateHUD.apply(this, args);
            hardRestoreTopUi();
            return result;
        };
        window.updateHUD = updateHUD;
    }
    document.addEventListener('DOMContentLoaded', () => { forceSingleServer(); hardRestoreTopUi(); });
    setInterval(() => { forceSingleServer(); hardRestoreTopUi(); }, 1200);
    setTimeout(() => { forceSingleServer(); hardRestoreTopUi(); }, 100);
    setTimeout(() => { forceSingleServer(); hardRestoreTopUi(); }, 1000);
})();



// v410: hangar presence system placeholder (safe, non-breaking)



// v414 HANGAR PRESENCE OWNER-AWARE SAFETY LOOP
setInterval(() => {
  try{
    if(typeof isHangarWindowOpenNow === 'function' && isHangarWindowOpenNow()){
      const ownerId = String(currentHangarPresenceOwnerId || (typeof getHangarOwnerIdForPresence === 'function' ? getHangarOwnerIdForPresence() : '') || '').trim();
      if(ownerId){
        currentHangarPresenceOwnerId = ownerId;
        setPlayerOnlineStatus?.((typeof getHangarPresenceStatusWithPositionV426 === 'function' ? getHangarPresenceStatusWithPositionV426(ownerId) : getHangarPresenceStatus(ownerId)), null);
        renderHangarPresencePanel?.();
      }
    }
  }catch(_){}
}, 2200);



// v415 HARD HANGAR PRESENCE KEEPALIVE
setInterval(() => {
  try{
    if(typeof isHangarWindowOpenNow === 'function' && isHangarWindowOpenNow()){
      const ownerId = (typeof getHangarOwnerIdForPresence === 'function') ? getHangarOwnerIdForPresence() : '';
      if(ownerId){
        currentHangarPresenceOwnerId = String(ownerId || '').trim();
        setPlayerOnlineStatus?.((typeof getHangarPresenceStatusWithPositionV426 === 'function' ? getHangarPresenceStatusWithPositionV426(ownerId) : getHangarPresenceStatus(ownerId)), null);
        renderHangarPresencePanel?.();
      }
    }
  }catch(_){}
}, 1800);




// ===== V417 HARD HANGAR ASTRONAUT OVERLAY (independent visual layer) =====
// This is intentionally independent from the older hangar-presence panel.
// It creates a visible body-level astronaut strip whenever the hangar is open.
let __cosmicHangarAstronautOverlayTimer = null;

function cosmicIsHangarActuallyOpenV417(){
    try{
        const win = document.getElementById('hangar-window');
        if(!win) return false;
        if(win.classList.contains('hidden')) return false;
        const cs = window.getComputedStyle ? getComputedStyle(win) : null;
        if(cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
        return true;
    }catch(_){
        return false;
    }
}

function cosmicGetHangarPresenceRowsV417(){
    const rows = [];
    const addRow = (entry) => {
        try{
            const pid = String(entry?.player_id || '').trim();
            if(!pid) return;
            if(rows.some(r => String(r?.player_id || '').trim() === pid)) return;
            rows.push(entry);
        }catch(_){}
    };

    try{
        const ownerId = String(
            (typeof currentHangarPresenceOwnerId !== 'undefined' && currentHangarPresenceOwnerId) ||
            (typeof getHangarOwnerIdForPresence === 'function' ? getHangarOwnerIdForPresence() : '') ||
            (authState?.playerId || player?.id || '')
        ).trim();

        const myId = String(
            (typeof getOwnPublicIdForPresence === 'function' ? getOwnPublicIdForPresence() : '') ||
            authState?.playerId ||
            player?.id ||
            ''
        ).trim();

        const ownerName =
            String(hangarGuestOwner?.nickname || '').trim() ||
            String(hangarGuestOwner?.name || '').trim() ||
            String(player?.nickname || '').trim() ||
            'Player';

        if(ownerId){
            addRow({
                player_id: ownerId,
                nickname: ownerName,
                __owner: true
            });
        }

        if(myId){
            addRow({
                player_id: myId,
                nickname: String(player?.nickname || 'Player').trim() || 'Player',
                __owner: ownerId && ownerId === myId
            });
        }

        try{
            const listItems = Array.from(document.querySelectorAll('#hangar-presence-list > div'));
            listItems.forEach((el, index) => {
                const txt = String(el?.textContent || '').trim();
                if(!txt || txt.includes('Пока никого')) return;
                const isOwner = txt.startsWith('👑');
                const clean = txt.replace(/^👑\s*/,'').replace(/^👁\s*/,'').trim();
                addRow({
                    player_id: `dom-${index}-${clean}`,
                    nickname: clean || 'Player',
                    __owner: isOwner
                });
            });
        }catch(_){}
    }catch(_){}

    if(!rows.length){
        rows.push({
            player_id: 'local-preview',
            nickname: String(player?.nickname || 'Player').trim() || 'Player',
            __owner: true
        });
    }

    return rows.slice(0, 6);
}

function cosmicEnsureHangarAstronautOverlayV417(){
    let overlay = document.getElementById('cosmic-hangar-astronaut-overlay-v417');
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'cosmic-hangar-astronaut-overlay-v417';
    overlay.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:28px',
        'transform:translateX(-50%)',
        'display:flex',
        'gap:18px',
        'align-items:flex-end',
        'justify-content:center',
        'z-index:2147483647',
        'pointer-events:auto',
        'padding:10px 14px',
        'border-radius:22px',
        'background:rgba(0,8,18,0.76)',
        'border:1px solid rgba(120,240,255,0.42)',
        'box-shadow:0 0 32px rgba(0,220,255,0.32)',
        'backdrop-filter:blur(7px)'
    ].join(';');

    document.body.appendChild(overlay);
    return overlay;
}

function cosmicRenderHangarAstronautOverlayV417(){
    try{
        const overlay = cosmicEnsureHangarAstronautOverlayV417();

        if(!cosmicIsHangarActuallyOpenV417()){
            overlay.style.display = 'none';
            return;
        }

        const ownerId = String(
            (typeof currentHangarPresenceOwnerId !== 'undefined' && currentHangarPresenceOwnerId) ||
            (typeof getHangarOwnerIdForPresence === 'function' ? getHangarOwnerIdForPresence() : '') ||
            (authState?.playerId || player?.id || '')
        ).trim();

        const rows = cosmicGetHangarPresenceRowsV417();
        overlay.innerHTML = '';
        overlay.style.display = 'flex';

        rows.forEach((p) => {
            const pid = String(p?.player_id || '').trim();
            const isOwner = !!p?.__owner || (!!ownerId && pid === ownerId);
            const box = document.createElement('div');
            box.style.cssText = [
                'width:82px',
                'min-height:92px',
                'display:flex',
                'flex-direction:column',
                'align-items:center',
                'justify-content:center',
                'gap:5px',
                'border-radius:18px',
                'background:linear-gradient(180deg, rgba(8,24,42,0.96), rgba(2,8,18,0.94))',
                'border:1px solid rgba(140,245,255,0.58)',
                'box-shadow:0 0 22px rgba(0,230,255,0.28), inset 0 0 18px rgba(120,240,255,0.08)',
                'color:#eaffff',
                'font-family:Arial,sans-serif',
                'text-align:center'
            ].join(';');

            const badge = document.createElement('div');
            badge.textContent = isOwner ? '👑' : '👁';
            badge.style.cssText = 'font-size:20px;line-height:1;';

            const astro = document.createElement('div');
            astro.textContent = '🧑‍🚀';
            astro.style.cssText = 'font-size:42px;line-height:1;filter:drop-shadow(0 0 12px rgba(0,255,255,0.85));';

            const name = document.createElement('div');
            name.textContent = String(p?.nickname || 'Player').slice(0, 12);
            name.style.cssText = 'max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#dffbff;opacity:0.96;';

            box.appendChild(badge);
            box.appendChild(astro);
            box.appendChild(name);

            if(pid && !String(pid).startsWith('local-preview') && !String(pid).startsWith('dom-')){
                box.style.cursor = 'pointer';
                box.addEventListener('click', () => {
                    try{ openPlayerProfile?.(pid, p?.nickname || `ID ${pid}`); }catch(_){}
                });
            }

            overlay.appendChild(box);
        });
    }catch(_){}
}

function cosmicStartHangarAstronautOverlayV417(){
    if(__cosmicHangarAstronautOverlayTimer) return;
    __cosmicHangarAstronautOverlayTimer = setInterval(() => {
        try{ cosmicRenderHangarAstronautOverlayV417(); }catch(_){}
    }, 700);
    try{ cosmicRenderHangarAstronautOverlayV417(); }catch(_){}
}

try{ /*disabled overlay*/ }catch(_){}



// ===== v425 REAL HANGAR ASTRONAUTS IN HANGAR SCENE =====
// Настоящие 3D-космонавты теперь добавляются в hangarState.scene,
// а не в window.scene. Источник данных — только реальные rows из presence.
if(typeof window.hangarAstronauts === 'undefined'){
  window.hangarAstronauts = {};
}

function createCosmicHangarPresenceNameSpriteV425(name, isOwner){
  try{
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    if(ctx){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = 'rgba(2,10,22,0.72)';
      ctx.strokeStyle = isOwner ? 'rgba(255,220,90,0.9)' : 'rgba(110,235,255,0.9)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(18, 22, canvas.width - 36, 74, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isOwner ? '#ffe27a' : '#dffbff';
      ctx.font = '700 34px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var label = (isOwner ? '👑 ' : '👁 ') + String(name || 'Player').slice(0, 18);
      ctx.fillText(label, canvas.width / 2, 59);
    }
    var texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    var material = new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:false, depthWrite:false });
    var sprite = new THREE.Sprite(material);
    sprite.name = 'hangar-presence-name-v425';
    sprite.renderOrder = 99999;
    sprite.scale.set(3.2, 0.8, 1);
    sprite.position.set(0, 2.75, 0);
    sprite.userData.texture = texture;
    return sprite;
  }catch(_){
    return null;
  }
}

function createCosmicHangarPresenceAstronautV425(row, ownerId){
  var pid = String(row && row.player_id || '').trim();
  var isOwner = !!(pid && String(ownerId || '').trim() === pid);
  var root = new THREE.Group();
  root.name = 'hangar-presence-astronaut-v425';
  root.userData.playerId = pid;
  root.userData.nickname = String(row && row.nickname || 'Player');
  root.userData.isOwner = isOwner;

  var body = null;
  try{
    body = createHangarAstronautFallback();
  }catch(_){
    body = new THREE.Group();
    var suit = new THREE.MeshStandardMaterial({ color:0xeaf3ff, metalness:0.35, roughness:0.55 });
    var trim = new THREE.MeshStandardMaterial({ color:isOwner ? 0xffd861 : 0x57dfff, emissive:isOwner ? 0x5a3c00 : 0x004b66, emissiveIntensity:0.35 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.05, 0.42), suit);
    torso.position.y = 1.45;
    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), suit);
    helmet.position.y = 2.24;
    var visor = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), trim);
    visor.position.set(0,2.22,0.2);
    visor.scale.set(1,0.72,0.32);
    body.add(torso, helmet, visor);
  }

  root.add(body);

  var ringColor = isOwner ? 0xffd861 : 0x5eeaff;
  var ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.026, 8, 36),
    new THREE.MeshBasicMaterial({ color:ringColor, transparent:true, opacity:0.72 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  root.add(ring);

  var glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.025, 36),
    new THREE.MeshBasicMaterial({ color:ringColor, transparent:true, opacity:0.18, depthWrite:false })
  );
  glow.position.y = 0.035;
  root.add(glow);

  var label = createCosmicHangarPresenceNameSpriteV425(row && row.nickname || 'Player', isOwner);
  if(label) root.add(label);

  root.scale.setScalar(1.05);
  root.rotation.y = Math.PI;
  return root;
}

function disposeCosmicHangarPresenceObjectV425(obj){
  try{
    if(!obj) return;
    obj.traverse(function(child){
      try{ child.geometry && child.geometry.dispose && child.geometry.dispose(); }catch(_){ }
      try{
        var mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.filter(Boolean).forEach(function(mat){
          try{ mat.map && mat.map.dispose && mat.map.dispose(); }catch(_){ }
          try{ mat.dispose && mat.dispose(); }catch(_){ }
        });
      }catch(_){ }
      try{ child.userData && child.userData.texture && child.userData.texture.dispose && child.userData.texture.dispose(); }catch(_){ }
    });
  }catch(_){ }
}

function getCosmicHangarPresenceSceneV425(){
  try{
    if(typeof hangarState !== 'undefined' && hangarState && hangarState.scene) return hangarState.scene;
  }catch(_){ }
  return null;
}

function parseCosmicHangarPresenceStatusV426(status){
  try{
    var parts = String(status || '').split(':');
    if(parts.length < 5 || parts[0] !== 'hangar') return null;
    var x = Number(parts[2]);
    var z = Number(parts[3]);
    var yaw = Number(parts[4]);
    if(!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x:x, z:z, yaw:Number.isFinite(yaw) ? yaw : Math.PI };
  }catch(_){ return null; }
}

function clampCosmicHangarPresenceNumberV426(value, min, max){
  var n = Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function getCosmicHangarLocalPositionPayloadV426(){
  try{
    var pivot = (typeof hangarState !== 'undefined' && hangarState && hangarState.astronautPivot) ? hangarState.astronautPivot : null;
    var x = pivot ? pivot.position.x : 0;
    var z = pivot ? pivot.position.z : 20.8;
    var yaw = pivot ? pivot.rotation.y : Math.PI;
    x = clampCosmicHangarPresenceNumberV426(x, -24, 24);
    z = clampCosmicHangarPresenceNumberV426(z, -8, 32);
    yaw = Number.isFinite(Number(yaw)) ? Number(yaw) : Math.PI;
    return {
      x: Math.round(x * 10) / 10,
      z: Math.round(z * 10) / 10,
      yaw: Math.round(yaw * 100) / 100
    };
  }catch(_){
    return { x:0, z:20.8, yaw:Math.PI };
  }
}

function getHangarPresenceStatusWithPositionV426(ownerId){
  var base = (typeof getHangarPresenceStatus === 'function') ? getHangarPresenceStatus(ownerId) : ('hangar:' + String(ownerId || '').trim());
  var pos = getCosmicHangarLocalPositionPayloadV426();
  return base + ':' + pos.x + ':' + pos.z + ':' + pos.yaw;
}

function getCosmicStableSlotPositionV426(playerId, index, isOwner){
  var positions = [
    { x:-3.2, z:20.8 },
    { x: 3.2, z:20.8 },
    { x:-5.4, z:24.4 },
    { x: 5.4, z:24.4 },
    { x: 0.0, z:18.4 },
    { x: 0.0, z:26.4 }
  ];
  if(isOwner) return positions[0];
  var id = String(playerId || '');
  var hash = 0;
  for(var i=0;i<id.length;i++) hash = ((hash * 31) + id.charCodeAt(i)) >>> 0;
  return positions[(hash || index || 1) % positions.length] || positions[0];
}

function getCosmicHangarPresencePositionV425(index, total, isOwner, row){
  var parsed = parseCosmicHangarPresenceStatusV426(row && row.status);
  var groundY = hangarState && Number.isFinite(hangarState.astronautGroundY) ? hangarState.astronautGroundY : -1.72;
  if(parsed){
    return new THREE.Vector3(parsed.x, groundY, parsed.z);
  }
  var pos = getCosmicStableSlotPositionV426(row && row.player_id, index, isOwner);
  return new THREE.Vector3(pos.x, groundY, pos.z);
}

window.updateHangarAstronautsSafe = function(rows){
  try{
    var scene = getCosmicHangarPresenceSceneV425();
    if(!scene || typeof THREE === 'undefined') return;

    var ownerId = String(
      (typeof currentHangarPresenceOwnerId !== 'undefined' && currentHangarPresenceOwnerId) ||
      (typeof getHangarOwnerIdForPresence === 'function' ? getHangarOwnerIdForPresence() : '') ||
      ''
    ).trim();

    var myId = String(
      (typeof getOwnPublicIdForPresence === 'function' ? getOwnPublicIdForPresence() : '') ||
      (authState && authState.playerId) ||
      (player && player.id) ||
      ''
    ).trim();

    var list = Array.isArray(rows) ? rows.slice(0, 6) : [];
    var used = {};
    var visibleIndex = 0;

    for(var i=0;i<list.length;i++){
      var p = list[i] || {};
      var id = String(p.player_id || '').trim();
      if(!id) continue;

      // Свой локальный космонавт уже управляется hangarState.astronautPivot.
      // Дубликат себе не создаём, но других игроков создаём обязательно.
      if(myId && id === myId) continue;

      used[id] = true;
      var isOwner = !!(ownerId && id === ownerId);
      var obj = window.hangarAstronauts[id] || null;

      if(!obj || obj.parent !== scene || obj.userData.isOwner !== isOwner){
        try{ if(obj && obj.parent) obj.parent.remove(obj); }catch(_){ }
        disposeCosmicHangarPresenceObjectV425(obj);
        obj = createCosmicHangarPresenceAstronautV425(p, ownerId);
        scene.add(obj);
        window.hangarAstronauts[id] = obj;
      }

      obj.visible = true;
      obj.userData.nickname = String(p.nickname || 'Player');
      obj.userData.isOwner = isOwner;

      var parsed = parseCosmicHangarPresenceStatusV426(p && p.status);
      var target = getCosmicHangarPresencePositionV425(visibleIndex, list.length, isOwner, p);
      if(!parsed && obj.userData && obj.userData.targetPosition){
        // v427: if an old heartbeat briefly writes plain "hangar:<owner>", keep the last real position.
        target = obj.userData.targetPosition.clone ? obj.userData.targetPosition.clone() : target;
      }
      if(!obj.userData.hasPresencePosition){
        obj.position.copy(target);
        obj.userData.hasPresencePosition = true;
      }
      obj.userData.targetPosition = target.clone ? target.clone() : target;
      obj.userData.targetYaw = parsed ? parsed.yaw : (Number.isFinite(Number(obj.userData.targetYaw)) ? Number(obj.userData.targetYaw) : (isOwner ? Math.PI * 0.92 : Math.PI * 1.08));

      visibleIndex++;
    }

    for(var k in window.hangarAstronauts){
      if(!used[k]){
        try{ window.hangarAstronauts[k].parent && window.hangarAstronauts[k].parent.remove(window.hangarAstronauts[k]); }catch(_){ }
        disposeCosmicHangarPresenceObjectV425(window.hangarAstronauts[k]);
        delete window.hangarAstronauts[k];
      }
    }
  }catch(e){
    try{ console.warn('hangar astronauts v425 warning:', e && e.message ? e.message : e); }catch(_){ }
  }
};


// v427: prevent old hangar keepalive loops from stripping position and causing back-and-forth patrol
var __cosmicHangarPresenceLastSyncV426 = { at:0, status:'' };
async function syncCosmicHangarLocalPresencePositionV426(force){
  try{
    if(typeof isHangarWindowOpenNow === 'function' && !isHangarWindowOpenNow()) return;
    var ownerId = String(
      (typeof currentHangarPresenceOwnerId !== 'undefined' && currentHangarPresenceOwnerId) ||
      (typeof getHangarOwnerIdForPresence === 'function' ? getHangarOwnerIdForPresence() : '') ||
      ''
    ).trim();
    if(!ownerId || typeof setPlayerOnlineStatus !== 'function') return;
    var status = getHangarPresenceStatusWithPositionV426(ownerId);
    var now = Date.now();
    if(!force && status === __cosmicHangarPresenceLastSyncV426.status && now - __cosmicHangarPresenceLastSyncV426.at < 900) return;
    if(!force && now - __cosmicHangarPresenceLastSyncV426.at < 900) return;
    __cosmicHangarPresenceLastSyncV426 = { at:now, status:status };
    await setPlayerOnlineStatus(status, null);
  }catch(_){ }
}

function animateCosmicHangarPresenceAstronautsV426(){
  try{
    if(window.hangarAstronauts){
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      for(var k in window.hangarAstronauts){
        var obj = window.hangarAstronauts[k];
        if(!obj) continue;
        var target = obj.userData && obj.userData.targetPosition;
        if(target && obj.position){
          obj.position.x += (target.x - obj.position.x) * 0.24;
          obj.position.z += (target.z - obj.position.z) * 0.24;
          var bob = Math.sin(now * 0.004 + String(k).length) * 0.035;
          obj.position.y += ((target.y + bob) - obj.position.y) * 0.28;
        }
        if(obj.userData && Number.isFinite(Number(obj.userData.targetYaw))){
          var diff = Number(obj.userData.targetYaw) - obj.rotation.y;
          while(diff > Math.PI) diff -= Math.PI * 2;
          while(diff < -Math.PI) diff += Math.PI * 2;
          obj.rotation.y += diff * 0.18;
        }
      }
    }
  }catch(_){ }
  requestAnimationFrame(animateCosmicHangarPresenceAstronautsV426);
}
try{ requestAnimationFrame(animateCosmicHangarPresenceAstronautsV426); }catch(_){ }
setInterval(function(){ try{ syncCosmicHangarLocalPresencePositionV426(false); }catch(_){ } }, 3500);

setInterval(function(){
  try{
    if(typeof isHangarWindowOpenNow === 'function' && isHangarWindowOpenNow()){
      renderHangarPresencePanel && renderHangarPresencePanel();
    }else if(window.hangarAstronauts){
      for(var k in window.hangarAstronauts){
        try{ window.hangarAstronauts[k].parent && window.hangarAstronauts[k].parent.remove(window.hangarAstronauts[k]); }catch(_){ }
        disposeCosmicHangarPresenceObjectV425(window.hangarAstronauts[k]);
        delete window.hangarAstronauts[k];
      }
    }
  }catch(_){ }
}, 1200);



