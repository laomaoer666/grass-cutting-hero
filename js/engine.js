// ============================================================
// engine.js - 游戏引擎（画布、相机、输入、游戏循环）
// ============================================================
'use strict';

// ============ 画布 ============
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W, H, shortDim, spawnRadius;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    shortDim = Math.min(W, H);
    spawnRadius = Math.max(300, Math.min(500, shortDim * 0.6));
}
window.addEventListener('resize', resize);
resize();

// ============ 相机 ============
const cam = { x: 0, y: 0, shake: 0 };

function addShake(amount) {
    cam.shake = Math.min(cam.shake + amount, 15);
}

function updateCam(target, dt) {
    cam.x += (target.x - cam.x) * 0.12;
    cam.y += (target.y - cam.y) * 0.12;
    if (cam.shake > 0) {
        cam.shake *= 0.9;
        if (cam.shake < 0.1) cam.shake = 0;
    }
}

// ============ 输入 ============
const input = {
    dx: 0, dy: 0, active: false,
    sx: 0, sy: 0, id: null,
};

// 统一触控管理 - 所有touch事件通过这个处理
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    ensureAudio();
    const t = e.changedTouches[0];
    input.active = true;
    input.sx = t.clientX;
    input.sy = t.clientY;
    input.id = t.identifier;
    input.dx = 0; input.dy = 0;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!input.active) return;
    for (const t of e.changedTouches) {
        if (t.identifier === input.id) {
            const dx = t.clientX - input.sx;
            const dy = t.clientY - input.sy;
            const d = Math.hypot(dx, dy);
            if (d > 15) {
                input.dx = dx / d;
                input.dy = dy / d;
            } else {
                input.dx = 0; input.dy = 0;
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    // 先检查是否点击了HUD按钮
    if (GAME.state === 'playing') {
        for (const t of e.changedTouches) {
            if (handleHUDClick(t.clientX, t.clientY)) {
                input.active = false; input.dx = 0; input.dy = 0;
                return;
            }
        }
    }
    // 检查角色选择
    if (GAME.state === 'charSelect') {
        const chars = Object.values(CHARACTERS);
        for (const t of e.changedTouches) {
            for (const ch of chars) {
                if (ch._cardRect) {
                    const r = ch._cardRect;
                    if (t.clientX >= r.x && t.clientX <= r.x + r.w &&
                        t.clientY >= r.y && t.clientY <= r.y + r.h) {
                        startGame(ch.id);
                        input.active = false; input.dx = 0; input.dy = 0;
                        return;
                    }
                }
            }
        }
    }
    // 菜单/游戏结束
    if (GAME.state === 'menu') {
        GAME.state = 'charSelect';
        input.active = false; input.dx = 0; input.dy = 0;
        return;
    }
    if (GAME.state === 'gameover') {
        restartGame();
        input.active = false; input.dx = 0; input.dy = 0;
        return;
    }
    // 清除移动输入
    for (const t of e.changedTouches) {
        if (t.identifier === input.id) {
            input.active = false;
            input.dx = 0; input.dy = 0;
        }
    }
});

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; ensureAudio(); });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function getMovement() {
    let mx = input.dx, my = input.dy;
    if (keys['w'] || keys['arrowup'])    my = -1;
    if (keys['s'] || keys['arrowdown'])  my = 1;
    if (keys['a'] || keys['arrowleft'])  mx = -1;
    if (keys['d'] || keys['arrowright']) mx = 1;
    const d = Math.hypot(mx, my);
    if (d > 1) { mx /= d; my /= d; }
    return { x: mx, y: my };
}

// ============ 工具函数 ============
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angle(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function rnd(a, b) { return Math.random() * (b - a) + a; }
function rndI(a, b) { return Math.floor(rnd(a, b + 1)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmtTime(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

// ============ 大字提示 ============
let bigText = '', bigTextTimer = 0;
function showBigText(txt) { bigText = txt; bigTextTimer = 2; }

// ============ HUD按钮点击检测 ============
// 保险技按钮位置：左侧中间
// 技能面板按钮位置：顶部经验条旁边
const HUD_BUTTONS = {
    insurance: { x: 0, y: 0, r: 25 },  // 圆形按钮
    skillPanel: { x: 0, y: 0, w: 36, h: 24 },
    bgm: { x: 0, y: 0, w: 30, h: 24 },
};

function updateHUDButtonPositions() {
    HUD_BUTTONS.insurance = { x: 35, y: H / 2, r: 25 };
    HUD_BUTTONS.skillPanel = { x: W - 44, y: 38, w: 36, h: 24 };
    HUD_BUTTONS.bgm = { x: W - 40, y: 10, w: 30, h: 24 };
}

function handleHUDClick(x, y) {
    if (GAME.state !== 'playing') return false;
    updateHUDButtonPositions();

    // 保险技（圆形按钮）
    const ins = HUD_BUTTONS.insurance;
    if (Math.hypot(x - ins.x, y - ins.y) <= ins.r + 5) {
        requestInsurance();
        return true;
    }
    // 技能面板
    const sp = HUD_BUTTONS.skillPanel;
    if (x >= sp.x && x <= sp.x + sp.w && y >= sp.y && y <= sp.y + sp.h) {
        toggleSkillPanel();
        return true;
    }
    // BGM
    const bg = HUD_BUTTONS.bgm;
    if (x >= bg.x && x <= bg.x + bg.w && y >= bg.y && y <= bg.y + bg.h) {
        BGM.toggle();
        return true;
    }
    return false;
}


// ============ 游戏主状态 ============
const GAME = {
    state: 'menu',  // menu, charSelect, playing, paused, upgrade, gameover
    time: 0,
    kills: 0,
    wave: 0,
    waveTimer: 0,
    bossTimer: 60,
    bossIndex: 0,
    bossCycle: 0,
    bossWarning: false,
    bossActive: false,

    reset() {
        this.state = 'playing';
        this.time = 0; this.kills = 0;
        this.wave = 1; this.waveTimer = 0;
        this.bossTimer = 60; this.bossIndex = 0; this.bossCycle = 0;
        this.bossWarning = false; this.bossActive = false;
    },
};

// ============ 游戏主循环 ============
let lastTime = 0;
let catEffectTimer = 0;
let lastDt = 0;

function gameLoop(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    lastDt = dt;

    if (GAME.state === 'playing') {
        update(dt);
    }

    // 渲染
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // DEBUG: 最简单的测试 - 红色方块
    if (GAME.state === 'playing') {
        ctx.fillStyle = '#f00';
        ctx.fillRect(10, H/2 - 30, 200, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('E=' + (typeof enemies !== 'undefined' ? enemies.length : '?') + ' dt=' + (typeof lastDt !== 'undefined' ? lastDt.toFixed(4) : '?'), 15, H/2 - 15);
    }

    if (GAME.state === 'menu') {
        drawMenu(timestamp);
    } else if (GAME.state === 'charSelect') {
        drawCharSelect();
    } else if (GAME.state === 'playing' || GAME.state === 'paused' || GAME.state === 'upgrade') {
        drawGame(timestamp);
    } else if (GAME.state === 'gameover') {
        drawGame(timestamp);
        drawGameOver();
    }

    // DEBUG: 在最顶层直接画敌人位置
    if (GAME.state === 'playing' && typeof enemies !== 'undefined' && enemies.length > 0) {
        ctx.fillStyle = '#f00';
        ctx.globalAlpha = 0.9;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('ENEMIES:' + enemies.length + ' cam:' + cam.x.toFixed(0) + ',' + cam.y.toFixed(0), 10, H / 2);
        for (var _di = 0; _di < Math.min(enemies.length, 5); _di++) {
            var _de = enemies[_di];
            if (_de.dead) continue;
            var _dsx = _de.x - cam.x + W / 2;
            var _dsy = _de.y - cam.y + H / 2;
            ctx.beginPath();
            ctx.arc(_dsx, _dsy, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText('E' + _di + ':(' + _de.x.toFixed(0) + ',' + _de.y.toFixed(0) + ')→(' + _dsx.toFixed(0) + ',' + _dsy.toFixed(0) + ')', 10, H / 2 + 20 + _di * 18);
            ctx.fillStyle = '#f00';
        }
        ctx.globalAlpha = 1;
    }

    requestAnimationFrame(gameLoop);
}

// ============ 菜单渲染 (v0.2 风格) ============
function drawMenu(t) {
    // 标题
    ctx.fillStyle = COLORS.player;
    ctx.shadowColor = COLORS.playerGlow;
    ctx.shadowBlur = 30;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔ 割草英雄', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;

    // 版本
    ctx.fillStyle = '#888';
    ctx.font = '13px sans-serif';
    ctx.fillText('v0.3 · 真男人不回头', W / 2, H / 2 - 20);

    // 控制说明
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.fillText('触屏滑动控制 · 自动攻击 · 升级强化', W / 2, H / 2 + 10);

    // 闪烁提示
    ctx.globalAlpha = 0.5 + Math.sin(t / 500) * 0.5;
    ctx.fillStyle = COLORS.player;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('点击开始', W / 2, H / 2 + 60);
    ctx.globalAlpha = 1;
}

// ============ 角色选择渲染 ============
function drawCharSelect() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff0';
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('🎭 选择角色', W / 2, 60);
    ctx.shadowBlur = 0;

    const chars = Object.values(CHARACTERS);
    const cardH = 100, gap = 12, startY = 100;
    const cardW = Math.min(320, W - 40);

    chars.forEach((ch, i) => {
        const y = startY + i * (cardH + gap);
        const x = W / 2 - cardW / 2;

        // 卡片背景
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 12);
        ctx.fill(); ctx.stroke();

        // 角色圆形头像
        ctx.fillStyle = ch.color;
        ctx.shadowColor = ch.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x + 40, y + cardH / 2, 22, 0, PI2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 角色名 + emoji
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${ch.emoji} ${ch.name}`, x + 75, y + 30);

        // 描述
        ctx.fillStyle = '#aaa';
        ctx.font = '12px sans-serif';
        ctx.fillText(ch.desc, x + 75, y + 50);

        // 属性
        ctx.fillStyle = '#0f0';
        ctx.font = '12px sans-serif';
        ctx.fillText(ch.stats, x + 75, y + 70);

        // 存储卡片位置用于点击
        ch._cardRect = { x, y, w: cardW, h: cardH };
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = '11px sans-serif';
    ctx.fillText('点击选择角色', W / 2, startY + chars.length * (cardH + gap) + 20);
}


// ============ 启动 ============
function startGame(charId) {
    const ch = CHARACTERS[charId];
    player.charId = charId;
    player.speed = 120 * ch.speedMul;
    player.maxHP = Math.round(100 * ch.hpMul);
    player.hp = player.maxHP;
    player.atkMul = ch.atkMul;
    player.xpMul = ch.xpMul;
    player.x = 0; player.y = 0;
    player.skills = {};
    player.combos = {};
    player.insurance = 1;
    player.shieldCD = 0;
    player.invincible = 0;
    player.orbAngle = 0;

    // 清空所有实体
    enemies.length = 0; particles.length = 0; dmgTexts.length = 0;
    xpGems.length = 0; deathTraces.length = 0; tombstones.length = 0;
    projectiles.length = 0; effects.length = 0;

    GAME.reset();
    BGM.init();
    BGM.setMode('calm');
}

function restartGame() {
    GAME.state = 'menu';
    document.getElementById('gameOver').style.display = 'none';
}

// ============ 初始化 ============
requestAnimationFrame((t) => { lastTime = t; gameLoop(t); });
