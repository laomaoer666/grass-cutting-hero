// ============================================================
// ui.js - UI系统（HUD、技能面板、升级面板、游戏结束）
// ============================================================
'use strict';

// ============ 技能面板 ============
let skillPanelOpen = false;

function toggleSkillPanel() {
    skillPanelOpen = !skillPanelOpen;
    const el = document.getElementById('skillPanel');
    if (el) el.style.display = skillPanelOpen ? 'block' : 'none';
    if (skillPanelOpen) updateSkillPanelContent();
}

function updateSkillPanelContent() {
    const el = document.getElementById('panelContent');
    if (!el) return;
    let html = '<h3>📋 技能面板</h3>';
    html += '<span class="close-btn" onclick="toggleSkillPanel()">✕</span>';

    // 已装备技能
    html += '<div class="panel-section"><h4>已装备技能</h4>';
    for (const [id, data] of Object.entries(player.skills)) {
        const w = WEAPONS[id];
        if (w) html += `<div class="skill-row">${w.icon} ${w.name} Lv${data.lv}</div>`;
    }
    if (Object.keys(player.skills).length === 0) html += '<div class="skill-row" style="color:#666">暂无</div>';
    html += '</div>';

    // 组合技
    html += '<div class="panel-section"><h4>组合技</h4>';
    for (const [id, combo] of Object.entries(COMBOS)) {
        const unlocked = player.combos[id];
        const cls = unlocked ? 'combo-unlocked' : 'combo-locked';
        const status = unlocked ? '✅' : '🔒';
        html += `<div class="combo-row ${cls}">${status} ${combo.icon} ${combo.name}: ${combo.desc}</div>`;
    }
    html += '</div>';

    // 属性
    html += '<div class="panel-section"><h4>属性</h4>';
    html += `<div class="skill-row">❤ HP: ${Math.ceil(player.hp)}/${player.maxHP}</div>`;
    html += `<div class="skill-row">🏃 移速: ${Math.round(player.speed)}</div>`;
    html += `<div class="skill-row">⚔ 攻击倍率: ${(player.atkMul * 100).toFixed(0)}%</div>`;
    html += `<div class="skill-row">📈 经验倍率: ${(player.xpMul * 100).toFixed(0)}%</div>`;
    html += `<div class="skill-row">🛡 护盾CD: ${player.shieldCD > 0 ? player.shieldCD.toFixed(1) + 's' : '就绪'}</div>`;
    html += `<div class="skill-row">🐱 ${INSURANCE.name}: ${player.insurance}</div>`;
    html += '</div>';

    el.innerHTML = html;
}

// ============ 升级面板 ============
let upgradeOptions = [];

function showUpgradeUI(options) {
    upgradeOptions = options;
    GAME.state = 'upgrade';
    const el = document.getElementById('upgradeSelect');
    if (!el) return;
    el.style.display = 'flex';

    const container = document.getElementById('upgradeOptions');
    if (!container) return;
    container.innerHTML = '';

    options.forEach((opt, idx) => {
        const btn = document.createElement('div');
        btn.className = 'skill-btn';
        btn.onclick = () => {
            opt.apply();
            closeUpgradeUI();
        };

        let inner = `<div class="sname">${opt.icon} ${opt.name}</div>`;
        inner += `<div class="sdesc">${opt.desc}</div>`;
        if (opt.comboHint) {
            inner += `<div class="combo-hint">${opt.comboHint}</div>`;
        }
        btn.innerHTML = inner;
        container.appendChild(btn);
    });
}

function closeUpgradeUI() {
    GAME.state = 'playing';
    const el = document.getElementById('upgradeSelect');
    if (el) el.style.display = 'none';
}

// 键盘快捷键选择升级
window.addEventListener('keydown', (e) => {
    if (GAME.state !== 'upgrade') return;
    const n = parseInt(e.key);
    if (n >= 1 && n <= 3 && upgradeOptions[n - 1]) {
        upgradeOptions[n - 1].apply();
        closeUpgradeUI();
    }
});

// ============ 游戏结束 ============
function showGameOver() {
    GAME.state = 'gameover';
    BGM.setMode('none');
    const el = document.getElementById('gameOver');
    if (!el) return;
    el.style.display = 'flex';

    const stats = document.getElementById('goStats');
    if (stats) {
        const mins = Math.floor(GAME.time / 60);
        const secs = Math.floor(GAME.time % 60);
        let comboStr = '';
        for (const cid in player.combos) {
            const c = COMBOS[cid];
            if (c) comboStr += c.icon + c.name + '  ';
        }
        stats.innerHTML = `
            <div class="stat-line">⏱ 存活: ${mins}:${String(secs).padStart(2, '0')}</div>
            <div class="stat-line">💀 击杀: ${GAME.kills}</div>
            <div class="stat-line">⭐ 等级: Lv.${player.level}</div>
            <div class="stat-line">🌊 波次: ${GAME.wave}</div>
            ${comboStr ? `<div class="stat-line">🔗 组合技: ${comboStr}</div>` : ''}
        `;
    }
}

// ============ HUD渲染 (v0.2 风格) ============
function drawHUD(t) {
    const p = player;
    const pad = 10;

    // XP条 - 顶部全宽，醒目
    const xpH = 8;
    ctx.fillStyle = COLORS.xpBg;
    ctx.fillRect(0, 0, W, xpH);
    ctx.fillStyle = COLORS.xp;
    ctx.fillRect(0, 0, W * (p.xp / p.xpToNext), xpH);

    // HP条
    const hpW = 140, hpH = 12;
    ctx.fillStyle = '#222';
    ctx.fillRect(pad, pad + xpH, hpW, hpH);
    const hpPct = Math.max(0, p.hp / p.maxHP);
    ctx.fillStyle = hpPct > 0.3 ? COLORS.hp : '#f00';
    ctx.fillRect(pad, pad + xpH, hpW * hpPct, hpH);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad + xpH, hpW, hpH);
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHP}`, pad + hpW / 2, pad + xpH + 10);

    // 等级
    const lvX = pad + hpW + 8;
    ctx.fillStyle = COLORS.combo;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv.${p.level}`, lvX, pad + xpH + 11);

    // 时间 + 击杀
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px sans-serif';
    ctx.fillText(`⏱ ${fmtTime(GAME.time)}  💀 ${GAME.kills}`, lvX + 45, pad + xpH + 11);

    // 连击提示
    if (typeof comboCount !== 'undefined' && comboCount >= 3) {
        ctx.fillStyle = COLORS.combo;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${comboCount} COMBO!`, pad, pad + xpH + 35);
    }

    // 技能图标栏 (底部左)
    const skillKeys = Object.keys(p.skills);
    if (skillKeys.length > 0) {
        const iconSize = 28, gap = 4;
        const startX = pad;
        const startY = H - iconSize - pad - 60; // 在虚拟摇杆上方
        skillKeys.forEach((id, i) => {
            const w = WEAPONS[id];
            if (!w) return;
            const x = startX + i * (iconSize + gap);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x, startY, iconSize, iconSize);
            ctx.fillStyle = w.color;
            ctx.shadowColor = w.color;
            ctx.shadowBlur = 4;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(w.icon, x + iconSize / 2, startY + iconSize / 2 + 5);
            ctx.shadowBlur = 0;
            // 等级数字
            ctx.fillStyle = '#fff';
            ctx.font = '8px sans-serif';
            ctx.fillText(p.skills[id].lv, x + iconSize / 2, startY + iconSize - 2);
        });
    }

    // BOSS倒计时
    if (!GAME.bossActive && GAME.bossTimer > 0) {
        ctx.fillStyle = '#888';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`下一个BOSS: ${Math.ceil(GAME.bossTimer)}s`, W / 2, pad + xpH + 22);
    }

    // BOSS血条
    if (GAME.bossActive) {
        const boss = enemies.find(e => e.boss && !e.dead);
        if (boss) {
            const bw = W - 40, bh = 10;
            const bx = 20, by = pad + xpH + 18;
            ctx.fillStyle = '#300';
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = '#f00';
            ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHP), bh);
            ctx.strokeStyle = '#600';
            ctx.strokeRect(bx, by, bw, bh);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(boss.name || 'BOSS', W / 2, by + 9);
        }
    }

    // 波次
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`第${GAME.wave}波`, W - 45, pad + xpH + 38);

    // BGM按钮
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(W - 40, pad + xpH, 30, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(BGM.muted ? '🔇' : '🔊', W - 25, pad + xpH + 15);

    // 技能面板按钮 (顶部右上)
    const spX = W - 44, spY = pad + xpH + 28;
    ctx.fillStyle = 'rgba(50,50,200,0.5)';
    ctx.fillRect(spX, spY, 36, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📋', spX + 18, spY + 15);

    // 保险技按钮 (左侧中间)
    const insX = 35, insY = H / 2;
    ctx.fillStyle = p.insurance > 0 ? 'rgba(255,140,0,0.6)' : 'rgba(80,80,80,0.3)';
    ctx.shadowColor = p.insurance > 0 ? '#f80' : 'transparent';
    ctx.shadowBlur = p.insurance > 0 ? 8 : 0;
    ctx.beginPath();
    ctx.arc(insX, insY, 22, 0, PI2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(insX, insY, 22, 0, PI2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🐱×${p.insurance}`, insX, insY + 5);

    // 大字提示
    if (bigTextTimer > 0) {
        ctx.globalAlpha = Math.min(1, bigTextTimer);
        ctx.fillStyle = COLORS.combo;
        ctx.shadowColor = COLORS.combo;
        ctx.shadowBlur = 20;
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bigText, W / 2, H / 2);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // BOSS警告
    if (GAME.bossWarning) {
        ctx.globalAlpha = 0.5 + Math.sin(t / 100) * 0.5;
        ctx.fillStyle = COLORS.warning;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ BOSS来袭！', W / 2, H / 2 - 80);
        ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'left';
}

// ============ 游戏结束画面 ============
function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#f44';
    ctx.shadowColor = '#f44';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💀 游戏结束', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`存活 ${fmtTime(GAME.time)}  击杀 ${GAME.kills}  等级 Lv.${player.level}`, W / 2, H / 2 - 15);

    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('点击重新开始', W / 2, H / 2 + 30);
}

// ============ 完整游戏画面渲染 ============
function drawGame(t) {
    ctx.save();

    // 相机震动
    if (cam.shake > 0.5) {
        ctx.translate(rnd(-cam.shake, cam.shake), rnd(-cam.shake, cam.shake));
    }

    drawGrid();
    drawDeathTraces();
    drawXPGems();
    drawEnemies();
    drawPlayer(t);
    drawProjectiles();
    drawEffects(t);
    drawParticles();
    drawDmgTexts();
    drawTombstones();

    ctx.restore();

    drawHUD(t);

    // 猫咪特效
    if (catEffectTimer > 0 && typeof catImg !== 'undefined' && catImg.complete && catImg.naturalWidth > 0) {
        const alpha = Math.min(1, catEffectTimer);
        const scale = 1 + (2.5 - catEffectTimer) * 0.2;
        const imgSize = Math.min(W, H) * 0.4 * scale;
        ctx.globalAlpha = alpha * 0.8;
        ctx.shadowColor = '#f80';
        ctx.shadowBlur = 20 + Math.sin(catEffectTimer * 10) * 10;
        ctx.drawImage(catImg, W / 2 - imgSize / 2, H / 2 - imgSize / 2 - 40, imgSize, imgSize);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}
