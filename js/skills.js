'use strict';

/* ===== skills.js — Weapons / Combos / Upgrades / Insurance ===== */

/* ── helper: nearest enemy within range ── */
function _nearestEnemy(range) {
    let best = null, bd = range;
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (e.dead) continue;
        let d = dist(player, e);
        if (d < bd) { bd = d; best = e; }
    }
    return best;
}

/* ── helper: all enemies within range ── */
function _enemiesInRange(range) {
    let arr = [];
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (e.dead) continue;
        if (dist(player, e) <= range) arr.push(e);
    }
    return arr;
}

/* ── helper: pick N random enemies in range ── */
function _randomEnemies(range, n) {
    let pool = _enemiesInRange(range);
    let arr = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
        let idx = rndI(pool.length);
        arr.push(pool.splice(idx, 1)[0]);
    }
    return arr;
}

/* ── combo explosion helper ── */
function _comboExplosion(x, y, dmg) {
    let r = 80;
    effects.push({
        type: 'explosion', x: x, y: y, r: r,
        t: 0, dur: 0.4, color: '#ff6600'
    });
    addShake(6, 0.3);
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (e.dead) continue;
        if (dist({ x: x, y: y }, e) <= r) {
            let d = Math.floor(dmg * player.atkMul);
            e.hp -= d;
            spawnDmgText(e.x, e.y, d);
            if (e.hp <= 0) killEnemy(e);
        }
    }
}

/* ── burning status helper ── */
function _applyBurning(e, dur) {
    e.burning = dur || 3;
    e.burningDps = 8;
}

/* ── slow status helper ── */
function _applySlow(e, dur) {
    e.slowed = dur || 2;
    e.slowMul = 0.4;
}

/* ===== Weapon update ===== */

function updateWeapons(dt) {
    let sk = player.skills;

    /* ─── sword ─── */
    if (sk.sword) {
        let s = sk.sword;
        let lv = s.lv;
        let range = 90 + lv * 15;
        s.cd -= dt;
        if (s.cd <= 0) {
            let target = _nearestEnemy(range);
            if (target) {
                let dmg = Math.floor((18 + lv * 6) * player.atkMul);
                target.hp -= dmg;
                spawnDmgText(target.x, target.y, dmg);
                if (target.hp <= 0) killEnemy(target);

                /* combo: bbq_sword — sword applies burning */
                if (player.combos.bbq_sword) _applyBurning(target, 2.5);

                /* combo: thunder_blade — chain to 2 nearby */
                if (player.combos.thunder_blade) {
                    let chain = _randomEnemies(160, 2);
                    for (let c of chain) {
                        let cd = Math.floor(dmg * 0.6);
                        c.hp -= cd;
                        spawnDmgText(c.x, c.y, cd);
                        effects.push({
                            type: 'lightning', x1: target.x, y1: target.y,
                            x2: c.x, y2: c.y, t: 0, dur: 0.25
                        });
                        if (c.hp <= 0) killEnemy(c);
                    }
                }

                /* slash visual */
                let a = angle(player, target);
                effects.push({
                    type: 'slash', x: player.x, y: player.y,
                    a: a, r: range, t: 0, dur: 0.2
                });
                if (SFX && SFX.slash) SFX.slash();

                s.cd = 0.7 * Math.pow(0.92, lv - 1);
            }
        }
    }

    /* ─── orb ─── */
    if (sk.orb) {
        let s = sk.orb;
        let lv = s.lv;
        let count = Math.floor(2 + lv / 2);
        let range = 65 + lv * 10;
        if (!s.angle) s.angle = 0;
        s.angle += dt * 2.5;
        for (let i = 0; i < count; i++) {
            let a = s.angle + PI2 * i / count;
            let ox = player.x + Math.cos(a) * range;
            let oy = player.y + Math.sin(a) * range;
            for (let j = enemies.length - 1; j >= 0; j--) {
                let e = enemies[j];
                if (e.dead) continue;
                if (dist({ x: ox, y: oy }, e) < 30) {
                    if (!e._orbHit) e._orbHit = {};
                    if (!e._orbHit[i] || e._orbHit[i] <= 0) {
                        let dmg = Math.floor((8 + lv * 3) * player.atkMul);
                        e.hp -= dmg;
                        spawnDmgText(e.x, e.y, dmg);
                        e._orbHit[i] = 0.3;
                        /* combo: ice_cream — orbs slow */
                        if (player.combos.ice_cream) _applySlow(e, 2);
                        if (e.hp <= 0) killEnemy(e);
                    }
                }
                if (e._orbHit && e._orbHit[i] > 0) e._orbHit[i] -= dt;
            }
        }
        /* orb visual effect */
        effects.push({
            type: 'orb_group', x: player.x, y: player.y,
            count: count, r: range, angle: s.angle, t: 0, dur: 0.05
        });
    }

    /* ─── lightning ─── */
    if (sk.lightning) {
        let s = sk.lightning;
        let lv = s.lv;
        let count = Math.floor(1 + lv / 3);
        let range = 220 + lv * 30;
        s.cd -= dt;
        if (s.cd <= 0) {
            let targets = _randomEnemies(range, count);
            for (let e of targets) {
                let dmg = Math.floor((30 + lv * 10) * player.atkMul);
                let isFrozen = e.frozen && e.frozen > 0;
                let isBurning = e.burning && e.burning > 0;
                let isSlowed = e.slowed && e.slowed > 0;

                /* combo: iced_lightning — 3x on frozen */
                if (player.combos.iced_lightning && isFrozen) dmg *= 3;

                e.hp -= dmg;
                spawnDmgText(e.x, e.y, dmg);

                /* combo: bbq — explosion on burning */
                if (player.combos.bbq && isBurning) {
                    _comboExplosion(e.x, e.y, dmg * 0.5);
                }

                /* combo: spa — steam explosion on slowed */
                if (player.combos.spa && isSlowed) {
                    _comboExplosion(e.x, e.y, dmg * 0.4);
                    effects.push({
                        type: 'steam', x: e.x, y: e.y,
                        t: 0, dur: 0.6, r: 60
                    });
                }

                effects.push({
                    type: 'lightning', x1: e.x, y1: e.y - 120,
                    x2: e.x, y2: e.y, t: 0, dur: 0.25
                });
                if (e.hp <= 0) killEnemy(e);
            }
            if (SFX && SFX.lightning) SFX.lightning();
            s.cd = 1.2 * Math.pow(0.93, lv - 1);
        }
    }

    /* ─── fire ─── */
    if (sk.fire) {
        let s = sk.fire;
        let lv = s.lv;
        let range = 130 + lv * 20;
        s.cd -= dt;
        if (s.cd <= 0) {
            let targets = _enemiesInRange(range);
            let dmg = Math.floor((15 + lv * 5) * player.atkMul);
            for (let e of targets) {
                let isSlowed = e.slowed && e.slowed > 0;
                e.hp -= dmg;
                spawnDmgText(e.x, e.y, dmg);
                _applyBurning(e, 3);

                /* combo: spa */
                if (player.combos.spa && isSlowed) {
                    _comboExplosion(e.x, e.y, dmg * 0.4);
                }

                if (e.hp <= 0) killEnemy(e);
            }
            effects.push({
                type: 'fire_burst', x: player.x, y: player.y,
                r: range, t: 0, dur: 0.4
            });
            if (SFX && SFX.fire) SFX.fire();
            s.cd = 1.5 * Math.pow(0.93, lv - 1);
        }
    }

    /* ─── ice ─── */
    if (sk.ice) {
        let s = sk.ice;
        let lv = s.lv;
        let range = 100 + lv * 15;
        s.cd -= dt;
        if (s.cd <= 0) {
            let targets = _enemiesInRange(range);
            let dmg = Math.floor((10 + lv * 4) * player.atkMul);
            for (let e of targets) {
                e.hp -= dmg;
                spawnDmgText(e.x, e.y, dmg);
                _applySlow(e, 2.5);
                e.frozen = 1.5;
                if (e.hp <= 0) killEnemy(e);
            }
            effects.push({
                type: 'ice_burst', x: player.x, y: player.y,
                r: range, t: 0, dur: 0.35
            });
            if (SFX && SFX.ice) SFX.ice();
            s.cd = 2.0 * Math.pow(0.93, lv - 1);
        }
    }

    /* ─── shield ─── */
    if (sk.shield) {
        let s = sk.shield;
        let lv = s.lv;
        s.cd -= dt;
        if (s.cd <= 0) {
            s.ready = true;
        }
        /* shield visual when ready */
        if (s.ready) {
            effects.push({
                type: 'shield_aura', x: player.x, y: player.y,
                r: 45, t: 0, dur: 0.05
            });
        }
    }

    /* ─── run combo check ─── */
    checkCombos();
}

/* ===== Combo unlock check ===== */

function checkCombos() {
    let sk = player.skills;
    let cb = player.combos;
    for (let key in COMBOS) {
        if (cb[key]) continue;
        let combo = COMBOS[key];
        let ok = true;
        for (let req of combo.requires) {
            if (!sk[req] || sk[req].lv < 3) { ok = false; break; }
        }
        if (ok) {
            cb[key] = true;
            showBigText(combo.name + ' 合体!', '#ffdd00');
            if (SFX && SFX.combo) SFX.combo();
        }
    }
}

/* ===== Upgrade system ===== */

/* stat boost options */
var _STAT_OPTS = [
    { id: 'hp',      name: '生命强化',   desc: '最大HP +30', icon: '❤️' },
    { id: 'speed',   name: '疾风之力',   desc: '移速 +10%', icon: '👟' },
    { id: 'magnet',  name: '磁铁',       desc: '拾取范围 +40', icon: '🧲' },
    { id: 'armor',   name: '铁甲',       desc: '护甲 +1', icon: '🛡️' },
    { id: 'atk',     name: '力量药水',   desc: '攻击力 +10%', icon: '⚔️' }
];

function showUpgradeOptions() {
    let sk = player.skills;
    let opts = [];
    let owned = Object.keys(sk);
    let weaponKeys = Object.keys(WEAPONS);

    /* helper: build option object */
    function mkWeapon(key, isNew) {
        let w = WEAPONS[key];
        let o = {
            id: (isNew ? 'new_' : 'up_') + key,
            type: isNew ? 'new_weapon' : 'upgrade',
            weapon: key,
            name: w.name,
            icon: w.icon,
            desc: isNew ? w.desc : '升级到 Lv.' + (sk[key].lv + 1),
            lv: isNew ? 1 : sk[key].lv + 1,
            hint: ''
        };
        /* combo hint */
        let nextLv = o.lv;
        for (let ck in COMBOS) {
            if (player.combos[ck]) continue;
            let combo = COMBOS[ck];
            let canUnlock = true;
            for (let req of combo.requires) {
                if (req === key) {
                    if (nextLv < 3) canUnlock = false;
                } else if (!sk[req] || sk[req].lv < 3) {
                    canUnlock = false;
                }
            }
            if (canUnlock && combo.requires.indexOf(key) >= 0) {
                o.hint = '✨ ' + combo.name + ' 可解锁!';
                break;
            }
        }
        return o;
    }

    /* existing weapon upgrades */
    for (let key of owned) {
        if (sk[key].lv < 8) opts.push(mkWeapon(key, false));
    }

    /* new weapons */
    let newWeapons = weaponKeys.filter(k => !sk[k]);
    if (owned.length < 4) {
        for (let key of newWeapons) opts.push(mkWeapon(key, true));
    }

    /* stat boosts */
    for (let st of _STAT_OPTS) {
        opts.push({
            id: 'stat_' + st.id,
            type: 'stat',
            stat: st.id,
            name: st.name,
            icon: st.icon,
            desc: st.desc,
            hint: ''
        });
    }

    /* insurance chance (rare) */
    if (!player.insurance && rnd() < 0.1) {
        opts.push({
            id: 'insurance',
            type: 'insurance',
            name: '保命猫猫',
            icon: '🐱',
            desc: INSURANCE.desc,
            hint: '稀有!'
        });
    }

    /* shuffle and pick 3 */
    for (let i = opts.length - 1; i > 0; i--) {
        let j = rndI(i + 1);
        let tmp = opts[i]; opts[i] = opts[j]; opts[j] = tmp;
    }
    let picked = opts.slice(0, 3);

    /* build UI */
    let container = document.getElementById('upgrade-options');
    if (!container) {
        container = document.createElement('div');
        container.id = 'upgrade-options';
        document.body.appendChild(container);
    }
    container.innerHTML = '';
    container.style.display = 'flex';

    for (let i = 0; i < picked.length; i++) {
        let o = picked[i];
        let card = document.createElement('div');
        card.className = 'upgrade-card';
        card.setAttribute('data-opt-id', o.id);

        let isWeaponUpgrade = o.type === 'upgrade';
        let hintHtml = o.hint ? '<div class="upgrade-hint">' + o.hint + '</div>' : '';

        card.innerHTML =
            '<div class="upgrade-icon">' + o.icon + '</div>' +
            '<div class="upgrade-name">' + o.name + (isWeaponUpgrade ? ' Lv.' + o.lv : '') + '</div>' +
            '<div class="upgrade-desc">' + o.desc + '</div>' +
            hintHtml;

        /* golden style for combo hints */
        if (o.hint) card.classList.add('combo-hint-card');

        card.onclick = function () { applyUpgrade(o.id); };
        container.appendChild(card);
    }

    GAME.state = 'upgrade';
}

/* ===== Apply upgrade ===== */

function applyUpgrade(optId) {
    let sk = player.skills;

    /* hide UI */
    let container = document.getElementById('upgrade-options');
    if (container) container.style.display = 'none';

    if (optId === 'insurance') {
        requestInsurance();
        return;
    }

    if (optId.startsWith('new_')) {
        let key = optId.substring(4);
        sk[key] = { lv: 1, cd: 0 };
        if (key === 'orb') sk[key].angle = 0;
        if (key === 'shield') sk[key].ready = false;
        if (SFX && SFX.upgrade) SFX.upgrade();
    } else if (optId.startsWith('up_')) {
        let key = optId.substring(3);
        sk[key].lv++;
        if (SFX && SFX.upgrade) SFX.upgrade();
    } else if (optId.startsWith('stat_')) {
        let stat = optId.substring(5);
        switch (stat) {
            case 'hp':
                player.maxHP += 30;
                player.hp += 30;
                break;
            case 'speed':
                player.speed *= 1.1;
                break;
            case 'magnet':
                player.magnet += 40;
                break;
            case 'armor':
                player.armor += 1;
                break;
            case 'atk':
                player.atkMul += 0.1;
                break;
        }
        if (SFX && SFX.upgrade) SFX.upgrade();
    }

    checkCombos();
    GAME.state = 'playing';
}

/* ===== Insurance ===== */

function requestInsurance() {
    let dialog = document.getElementById('insurance-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'insurance-dialog';
        dialog.innerHTML =
            '<div class="ins-box">' +
            '<div class="ins-icon">🐱</div>' +
            '<div class="ins-title">' + INSURANCE.name + '</div>' +
            '<div class="ins-desc">' + INSURANCE.desc + '</div>' +
            '<div class="ins-buttons">' +
            '<button id="ins-yes" class="ins-btn ins-yes">使用!</button>' +
            '<button id="ins-no" class="ins-btn ins-no">取消</button>' +
            '</div></div>';
        document.body.appendChild(dialog);
        document.getElementById('ins-yes').onclick = function () { activateInsurance(); };
        document.getElementById('ins-no').onclick = function () { closeInsurance(); };
    }
    dialog.style.display = 'flex';
}

function activateInsurance() {
    player.insurance = true;

    /* kill all enemies */
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (!e.dead) {
            spawnParticle(e.x, e.y, 6);
            killEnemy(e);
        }
    }

    /* big screen effects */
    addShake(12, 0.8);
    showBigText('🐱 保命猫猫发动!', '#ff44cc');
    catEffectTimer = 3;

    if (SFX && SFX.insurance) SFX.insurance();

    closeInsurance();
    /* re-show upgrade (insurance doesn't count as a level pick — player still needs to choose) */
    showUpgradeOptions();
}

function closeInsurance() {
    let dialog = document.getElementById('insurance-dialog');
    if (dialog) dialog.style.display = 'none';
    /* go back to upgrade screen so player can pick something else */
    let container = document.getElementById('upgrade-options');
    if (container) container.style.display = 'flex';
}
