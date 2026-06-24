'use strict';

/* ============================================================
   entities.js  –  v0.2 dark-neon entity system
   Handles: player, enemies, particles, dmgTexts, xpGems,
            deathTraces, tombstones, projectiles, effects
   ============================================================ */

// ---- global arrays ----
var enemies      = [];
var particles    = [];
var dmgTexts     = [];
var xpGems       = [];
var deathTraces  = [];
var tombstones   = [];
var projectiles  = [];
var effects      = [];

// ---- player ----
var player = {
  x: 0, y: 0,
  speed: 120, hp: 100, maxHP: 100,
  charId: 'slave', atkMul: 1.0, xpMul: 1.0,
  skills: {}, combos: {}, insurance: 1,
  level: 1, xp: 0, xpToNext: 10,
  shieldCD: 0, invincible: 0, orbAngle: 0,
  facing: 1, magnet: 80, armor: 0
};

// spawn timer internal
var _spawnTimer = 0;
var _enemyRamp  = 0; // tracks total time for difficulty scaling

/* ============================================================
   1. spawnEnemy
   ============================================================ */
function spawnEnemy(type, x, y, hpMult) {
  hpMult = hpMult || 1;
  var def = ENEMY_TYPES[type];
  if (!def) return null;
  var e = {
    type:      type,
    x:         x,
    y:         y,
    hp:        Math.floor((def.hp || 10) * hpMult),
    maxHP:     Math.floor((def.hp || 10) * hpMult),
    speed:     def.speed || 40,
    dmg:       def.dmg || 5,
    size:      def.size || 8,
    color:     def.color || '#f44',
    xp:        def.xp || 1,
    shape:     def.shape || 'circle',
    hitFlash:  0,
    burning:   0,
    burnDmg:   0,
    slow:      0,
    slowTimer: 0,
    dead:      false,
    boss:      false,
    angle:     0,
    timer:     0,
    phase:     0,
    chargeCD:  0,
    charging:  false,
    chargeX:   0,
    chargeY:   0,
    spitterCD: 0,
    children:  def.children || 0,
    acidOnDeath: def.acidOnDeath || false
  };
  enemies.push(e);
  return e;
}

/* ============================================================
   2. spawnBoss
   ============================================================ */
function spawnBoss(bossDef, hpMult) {
  hpMult = hpMult || 1;
  var e = {
    type:      bossDef.id || 'boss',
    x:         player.x + (rnd() > 0.5 ? 1 : -1) * (W * 0.6),
    y:         player.y + (rnd() > 0.5 ? 1 : -1) * (H * 0.6),
    hp:        Math.floor((bossDef.hp || 500) * hpMult),
    maxHP:     Math.floor((bossDef.hp || 500) * hpMult),
    speed:     bossDef.speed || 30,
    dmg:       bossDef.dmg || 20,
    size:      bossDef.size || 20,
    color:     bossDef.color || '#f0f',
    xp:        bossDef.xp || 50,
    shape:     bossDef.shape || 'star',
    hitFlash:  0,
    burning:   0,
    burnDmg:   0,
    slow:      0,
    slowTimer: 0,
    dead:      false,
    boss:      true,
    angle:     0,
    timer:     0,
    phase:     0,
    attackCD:  bossDef.attackCD || 3,
    attackType: bossDef.attackType || 'summon',
    chargeCD:  0,
    charging:  false,
    chargeX:   0,
    chargeY:   0,
    spitterCD: 0,
    children:  0,
    acidOnDeath: false,
    summonCount: bossDef.summonCount || 5,
    breathDmg:   bossDef.breathDmg || 15,
    bossType:    bossDef.id
  };
  enemies.push(e);
  return e;
}

/* ============================================================
   3. killEnemy
   ============================================================ */
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;

  // particles burst
  spawnParticle(e.x, e.y, e.color, 12, 80, 0.5, 3);

  // XP gem(s)
  var xv = e.xp * player.xpMul;
  if (xv >= 20) {
    spawnXPGem(e.x, e.y, Math.floor(xv / 2));
    spawnXPGem(e.x + rnd() * 6 - 3, e.y + rnd() * 6 - 3, Math.ceil(xv / 2));
  } else {
    spawnXPGem(e.x, e.y, Math.max(1, Math.floor(xv)));
  }

  // death trace for acid type
  if (e.acidOnDeath && DEATH_TRACES && DEATH_TRACES.acid) {
    var dt = DEATH_TRACES.acid;
    deathTraces.push({
      x: e.x, y: e.y,
      type: 'acid',
      radius: dt.radius || 30,
      life: dt.life || 5,
      maxLife: dt.life || 5,
      color: dt.color || '#0f0',
      effect: dt.effect || 'acid',
      dps: dt.dps || 5,
      slow: dt.slow || 0
    });
  }

  // death trace for poison type
  if (e.type === 'poison' && DEATH_TRACES && DEATH_TRACES.poison) {
    var pt = DEATH_TRACES.poison;
    deathTraces.push({
      x: e.x, y: e.y,
      type: 'poison',
      radius: pt.radius || 25,
      life: pt.life || 4,
      maxLife: pt.life || 4,
      color: pt.color || '#8f0',
      effect: pt.effect || 'poison',
      dps: pt.dps || 3,
      slow: pt.slow || 0
    });
  }

  // splitter: spawn children
  if (e.children > 0) {
    for (var i = 0; i < e.children; i++) {
      var ang = (PI2 / e.children) * i + rnd() * 0.5;
      var d = e.size + 5;
      var child = spawnEnemy('normal', e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d, 0.4);
      if (child) {
        child.size = Math.max(4, e.size * 0.5);
        child.hp = Math.max(1, Math.floor(e.maxHP * 0.25));
        child.maxHP = child.hp;
        child.xp = Math.max(1, Math.floor(e.xp * 0.3));
        child.color = '#fa0';
      }
    }
  }

  // boss tombstone
  if (e.boss) {
    tombstones.push({ x: e.x, y: e.y, bossType: e.bossType || e.type, phase: 0 });
  }

  // SFX
  if (SFX && SFX.kill) { try { SFX.kill(); } catch(_){} }
}

/* ============================================================
   4. spawnParticle
   ============================================================ */
function spawnParticle(x, y, color, count, speed, life, size) {
  count  = count  || 6;
  speed  = speed  || 60;
  life   = life   || 0.4;
  size   = size   || 2;
  for (var i = 0; i < count; i++) {
    var a = rnd() * PI2;
    var s = rnd() * speed;
    particles.push({
      x: x, y: y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life,
      maxLife: life,
      size: size * (0.5 + rnd() * 0.8),
      color: color
    });
  }
}

/* ============================================================
   5. spawnDmgText
   ============================================================ */
function spawnDmgText(x, y, text, color) {
  dmgTexts.push({
    x: x + rnd() * 8 - 4,
    y: y - 8,
    text: String(text),
    color: color || '#ff0',
    life: 0.8,
    vy: -40
  });
}

/* ============================================================
   6. spawnXPGem
   ============================================================ */
function spawnXPGem(x, y, value) {
  value = value || 1;
  var col = value >= 10 ? '#0ff' : (value >= 5 ? '#ff0' : '#0f8');
  var sz = value >= 10 ? 6 : (value >= 5 ? 5 : 4);
  xpGems.push({
    x: x, y: y,
    value: value,
    size: sz,
    color: col,
    life: 30,
    collected: false
  });
}

/* ============================================================
   7. updateEnemies
   ============================================================ */
function updateEnemies(dt) {
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e.dead) continue;

    // burn DOT
    if (e.burning > 0) {
      e.burning -= dt;
      e.hp -= e.burnDmg * dt;
      if (e.hp <= 0) { killEnemy(e); continue; }
    }

    // slow decay
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) { e.slow = 0; }
    }

    // hit flash decay
    if (e.hitFlash > 0) e.hitFlash -= dt * 5;

    e.timer += dt;
    var spd = e.speed * (1 - e.slow * 0.5);
    if (spd < 5) spd = 5;

    var dx = player.x - e.x;
    var dy = player.y - e.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dx / d;
    var ny = dy / d;

    // ---- charger behavior ----
    if (e.type === 'charger' || e.charging !== undefined && e.boss === false && e.type === 'charger') {
      if (!e.charging) {
        e.chargeCD -= dt;
        e.x += nx * spd * 0.5 * dt;
        e.y += ny * spd * 0.5 * dt;
        if (e.chargeCD <= 0 && d < 250) {
          e.charging = true;
          e.chargeCD = 1.5;
          e.chargeX = nx;
          e.chargeY = ny;
          e.timer = 0;
        }
      } else {
        var cs = spd * 4;
        e.x += e.chargeX * cs * dt;
        e.y += e.chargeY * cs * dt;
        if (e.timer > 0.6) {
          e.charging = false;
          e.timer = 0;
        }
      }
    }
    // ---- spitter behavior ----
    else if (e.type === 'spitter') {
      e.spitterCD -= dt;
      // move closer but keep distance
      if (d > 150) {
        e.x += nx * spd * dt;
        e.y += ny * spd * dt;
      } else if (d < 100) {
        e.x -= nx * spd * 0.5 * dt;
        e.y -= ny * spd * 0.5 * dt;
      }
      if (e.spitterCD <= 0 && d < 300) {
        e.spitterCD = 2;
        var pa = Math.atan2(ny, nx) + (rnd() - 0.5) * 0.3;
        projectiles.push({
          x: e.x, y: e.y,
          vx: Math.cos(pa) * 120,
          vy: Math.sin(pa) * 120,
          dmg: e.dmg * 0.7,
          life: 3
        });
        if (SFX && SFX.spit) { try { SFX.spit(); } catch(_){} }
      }
    }
    // ---- boss behavior ----
    else if (e.boss) {
      e.attackCD -= dt;
      e.x += nx * spd * dt;
      e.y += ny * spd * dt;

      if (e.attackCD <= 0) {
        e.attackCD = e.attackType === 'breath' ? 4 : (e.attackType === 'layEggs' ? 6 : 5);

        if (e.attackType === 'summon') {
          for (var s = 0; s < (e.summonCount || 5); s++) {
            var sa = rnd() * PI2;
            var sd = 40 + rnd() * 30;
            spawnEnemy('normal', e.x + Math.cos(sa) * sd, e.y + Math.sin(sa) * sd, 0.5);
          }
          effects.push({ type: 'summon', x: e.x, y: e.y, life: 0.5, maxLife: 0.5 });
          if (SFX && SFX.bossSummon) { try { SFX.bossSummon(); } catch(_){} }
        }
        else if (e.attackType === 'breath') {
          // fire breath – spawn cone of projectiles
          var ba = Math.atan2(player.y - e.y, player.x - e.x);
          for (var b = -3; b <= 3; b++) {
            var fa = ba + b * 0.15;
            projectiles.push({
              x: e.x, y: e.y,
              vx: Math.cos(fa) * 140,
              vy: Math.sin(fa) * 140,
              dmg: e.breathDmg || 15,
              life: 2.5,
              color: '#f80'
            });
          }
          effects.push({ type: 'fireWave', x: e.x, y: e.y, angle: ba, life: 0.4, maxLife: 0.4 });
          if (SFX && SFX.fire) { try { SFX.fire(); } catch(_){} }
        }
        else if (e.attackType === 'layEggs') {
          for (var g = 0; g < 3; g++) {
            var ga = rnd() * PI2;
            var gd = 50 + rnd() * 40;
            spawnEnemy('normal', e.x + Math.cos(ga) * gd, e.y + Math.sin(ga) * gd, 0.3);
          }
          effects.push({ type: 'summon', x: e.x, y: e.y, life: 0.6, maxLife: 0.6 });
        }
      }
    }
    // ---- normal movement ----
    else {
      e.x += nx * spd * dt;
      e.y += ny * spd * dt;
    }

    e.angle = Math.atan2(ny, nx);

    // ---- collision with player ----
    var pdist = dist(e, player);
    if (pdist < e.size + 10) {
      if (player.invincible <= 0) {
        var edmg = e.dmg;
        // skills mitigation could go here (handled in combat.js)
        player.hp -= edmg;
        player.invincible = 0.3;
        addShake(4);
        spawnDmgText(player.x, player.y, edmg, '#f44');
        spawnParticle(player.x, player.y, '#f44', 5, 40, 0.3, 2);
        if (SFX && SFX.hit) { try { SFX.hit(); } catch(_){} }
        if (player.hp <= 0) {
          player.hp = 0;
          showBigText('YOU DIED', '#f44');
        }
      }
      // push enemy back slightly
      e.x -= nx * 5;
      e.y -= ny * 5;
    }
  }
}

/* ============================================================
   8. updateParticles
   ============================================================ */
function updateParticles(dt) {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

/* ============================================================
   9. updateDmgTexts
   ============================================================ */
function updateDmgTexts(dt) {
  for (var i = dmgTexts.length - 1; i >= 0; i--) {
    var d = dmgTexts[i];
    d.y += d.vy * dt;
    d.vy *= 0.95;
    d.life -= dt;
    if (d.life <= 0) {
      dmgTexts.splice(i, 1);
    }
  }
}

/* ============================================================
   10. updateXPGems
   ============================================================ */
function updateXPGems(dt) {
  for (var i = xpGems.length - 1; i >= 0; i--) {
    var g = xpGems[i];
    g.life -= dt;
    if (g.life <= 0) { xpGems.splice(i, 1); continue; }

    var d = dist(g, player);

    // magnetic pull when close
    if (d < 80) {
      var pull = 200 + (80 - d) * 5;
      var a = angle(g.x, g.y, player.x, player.y);
      g.x += Math.cos(a) * pull * dt;
      g.y += Math.sin(a) * pull * dt;
      d = dist(g, player);
    }

    // collect
    if (d < 14) {
      player.xp += g.value;
      // check level up
      while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = Math.floor(player.xpToNext * 1.35) + 5;
        showBigText('LEVEL ' + player.level, '#0ff');
        if (SFX && SFX.levelUp) { try { SFX.levelUp(); } catch(_){} }
        // level-up heal
        player.hp = Math.min(player.maxHP, player.hp + 10);
      }
      g.collected = true;
      xpGems.splice(i, 1);
      if (SFX && SFX.xp) { try { SFX.xp(); } catch(_){} }
    }
  }
}

/* ============================================================
   11. updateDeathTraces
   ============================================================ */
function updateDeathTraces(dt) {
  for (var i = deathTraces.length - 1; i >= 0; i--) {
    var t = deathTraces[i];
    t.life -= dt;
    if (t.life <= 0) { deathTraces.splice(i, 1); continue; }

    // apply effect to player if overlapping
    var d = dist(t, player);
    if (d < t.radius && player.invincible <= 0) {
      if (t.dps > 0) {
        var dmg = t.dps * dt;
        player.hp -= dmg;
        if (Math.random() < dt * 3) {
          spawnDmgText(player.x, player.y, Math.ceil(t.dps), t.color);
        }
      }
      if (t.slow > 0) {
        // slow handled by player check elsewhere
      }
    }
  }
}

/* ============================================================
   12. updateProjectiles
   ============================================================ */
function updateProjectiles(dt) {
  for (var i = projectiles.length - 1; i >= 0; i--) {
    var p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) { projectiles.splice(i, 1); continue; }

    var d = dist(p, player);
    if (d < 14) {
      if (player.invincible <= 0) {
        player.hp -= p.dmg;
        player.invincible = 0.3;
        addShake(3);
        spawnDmgText(player.x, player.y, Math.ceil(p.dmg), '#f80');
        spawnParticle(p.x, p.y, p.color || '#f80', 6, 50, 0.3, 2);
        if (SFX && SFX.hit) { try { SFX.hit(); } catch(_){} }
        if (player.hp <= 0) {
          player.hp = 0;
          showBigText('YOU DIED', '#f44');
        }
      }
      projectiles.splice(i, 1);
    }
  }
}

/* ============================================================
   13. updateEffects
   ============================================================ */
function updateEffects(dt) {
  for (var i = effects.length - 1; i >= 0; i--) {
    var ef = effects[i];
    ef.t += dt;
    if (ef.t >= ef.dur) {
      effects.splice(i, 1);
    }
  }
}

/* ============================================================
   14. drawPlayer
   ============================================================ */
function drawPlayer(t) {
  var px = player.x - cam.x + W / 2;
  var py = player.y - cam.y + H / 2;
  var r = 10;

  ctx.save();
  ctx.translate(px, py);

  // invincibility flash
  if (player.invincible > 0 && Math.floor(player.invincible * 15) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  // ---- body glow ----
  var charDef = (typeof CHARACTERS !== 'undefined' && CHARACTERS[player.charId]) || {};
  var bodyColor = charDef.color || '#0ff';

  ctx.shadowColor = bodyColor;
  ctx.shadowBlur = 15;

  // trail
  ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.25;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(-player.facing * 4, 0, r * 0.7, 0, PI2);
  ctx.fill();
  ctx.globalAlpha = player.invincible > 0 && Math.floor(player.invincible * 15) % 2 === 0 ? 0.5 : 1;

  // main body
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, PI2);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#000';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(-3, -2, 2, 0, PI2);
  ctx.arc(3, -2, 2, 0, PI2);
  ctx.fill();

  // ---- skill body effects ----
  // lightning sparks
  if (player.skills.lightning) {
    ctx.strokeStyle = '#ff0';
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    for (var li = 0; li < 3; li++) {
      var la = t * 8 + li * 2.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(la) * r, Math.sin(la) * r);
      ctx.lineTo(Math.cos(la + 0.5) * (r + 6 + Math.sin(t * 12 + li) * 3),
                 Math.sin(la + 0.5) * (r + 6 + Math.sin(t * 12 + li) * 3));
      ctx.stroke();
    }
  }

  // flame crown
  if (player.skills.fire || player.skills.flame) {
    ctx.shadowColor = '#f80';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#f80';
    for (var fi = 0; fi < 5; fi++) {
      var fa = -PI * 0.7 + fi * 0.35;
      var fh = 5 + Math.sin(t * 10 + fi * 1.5) * 3;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(Math.cos(fa) * (r - 2), Math.sin(fa) * (r - 2), fh * 0.6, 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ice crystals
  if (player.skills.ice || player.skills.frost) {
    ctx.strokeStyle = '#8cf';
    ctx.shadowColor = '#8cf';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
    for (var ii = 0; ii < 4; ii++) {
      var ia = t * 2 + ii * (PI2 / 4);
      var ix = Math.cos(ia) * (r + 3);
      var iy = Math.sin(ia) * (r + 3);
      ctx.beginPath();
      ctx.moveTo(ix, iy - 3);
      ctx.lineTo(ix, iy + 3);
      ctx.moveTo(ix - 2, iy - 1);
      ctx.lineTo(ix + 2, iy + 1);
      ctx.stroke();
    }
  }

  // sword wisps
  if (player.skills.sword || player.skills.blade) {
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1;
    for (var si = 0; si < 2; si++) {
      var sa = t * 5 + si * PI;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, sa, sa + 0.8);
      ctx.stroke();
    }
  }

  // orb glow
  if (player.skills.orb) {
    player.orbAngle += dt * 3;
    var ox = Math.cos(player.orbAngle) * 22;
    var oy = Math.sin(player.orbAngle) * 22;
    ctx.fillStyle = '#0ff';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ox, oy, 4, 0, PI2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ============================================================
   15. drawEnemies
   ============================================================ */
function drawEnemies() {
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e.dead) continue;

    var ex = e.x - cam.x + W / 2;
    var ey = e.y - cam.y + H / 2;

    // off-screen cull
    if (ex < -50 || ex > W + 50 || ey < -50 || ey > H + 50) continue;

    ctx.save();
    ctx.translate(ex, ey);

    var col = e.hitFlash > 0 ? '#fff' : e.color;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = e.boss ? 20 : 8;

    var s = e.size;

    // shape
    if (e.shape === 'circle' || !e.shape) {
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, PI2);
      ctx.fill();
    }
    else if (e.shape === 'tri') {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(-s * 0.87, s * 0.5);
      ctx.lineTo(s * 0.87, s * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    else if (e.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    }
    else if (e.shape === 'star') {
      ctx.beginPath();
      for (var p = 0; p < 10; p++) {
        var a = (p / 10) * PI2 - PI / 2;
        var sr = p % 2 === 0 ? s : s * 0.5;
        var sx = Math.cos(a) * sr;
        var sy = Math.sin(a) * sr;
        if (p === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    }

    // burning flame overlay
    if (e.burning > 0) {
      ctx.fillStyle = '#f80';
      ctx.shadowColor = '#f80';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.6 + Math.sin(e.timer * 15) * 0.2;
      ctx.beginPath();
      ctx.arc(0, -s * 0.5, s * 0.4, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // slow frost overlay
    if (e.slowTimer > 0) {
      ctx.strokeStyle = '#8cf';
      ctx.shadowColor = '#8cf';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, s + 3, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;

    // HP bar (if damaged)
    if (e.hp < e.maxHP) {
      var bw = s * 2;
      var bh = 3;
      var by = -s - 6;
      ctx.fillStyle = '#300';
      ctx.fillRect(-bw / 2, by, bw, bh);
      ctx.fillStyle = e.boss ? '#f0f' : '#0f8';
      ctx.fillRect(-bw / 2, by, bw * (e.hp / e.maxHP), bh);
    }

    ctx.restore();
  }
}

/* ============================================================
   16. drawParticles
   ============================================================ */
function drawParticles() {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var sx = p.x - cam.x + W / 2;
    var sy = p.y - cam.y + H / 2;
    var a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/* ============================================================
   17. drawDmgTexts
   ============================================================ */
function drawDmgTexts() {
  for (var i = 0; i < dmgTexts.length; i++) {
    var d = dmgTexts[i];
    var sx = d.x - cam.x + W / 2;
    var sy = d.y - cam.y + H / 2;
    var a = Math.min(1, d.life * 2);
    ctx.globalAlpha = a;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(d.text, sx, sy);
    ctx.fillStyle = d.color;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 4;
    ctx.fillText(d.text, sx, sy);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/* ============================================================
   18. drawXPGems
   ============================================================ */
function drawXPGems() {
  for (var i = 0; i < xpGems.length; i++) {
    var g = xpGems[i];
    var sx = g.x - cam.x + W / 2;
    var sy = g.y - cam.y + H / 2;
    var s = g.size;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(PI / 4);
    ctx.fillStyle = g.color;
    ctx.shadowColor = g.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/* ============================================================
   19. drawDeathTraces
   ============================================================ */
function drawDeathTraces() {
  for (var i = 0; i < deathTraces.length; i++) {
    var t = deathTraces[i];
    var sx = t.x - cam.x + W / 2;
    var sy = t.y - cam.y + H / 2;
    var a = (t.life / t.maxLife) * 0.35;

    ctx.globalAlpha = a;
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(sx, sy, t.radius, 0, PI2);
    ctx.fill();

    // animation overlays
    if (t.type === 'acid') {
      // bubbling
      ctx.fillStyle = '#0f0';
      ctx.globalAlpha = a * 0.6;
      for (var b = 0; b < 4; b++) {
        var ba = (t.life * 3 + b * 1.5) % PI2;
        var br = t.radius * 0.6;
        var bx = sx + Math.cos(ba) * br;
        var by = sy + Math.sin(ba) * br - Math.sin(t.life * 8 + b) * 4;
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, PI2);
        ctx.fill();
      }
    }
    else if (t.type === 'poison') {
      // smoke
      ctx.fillStyle = '#8f0';
      ctx.globalAlpha = a * 0.4;
      for (var s = 0; s < 3; s++) {
        var sa2 = t.life * 2 + s * 2;
        var sx2 = sx + Math.sin(sa2) * t.radius * 0.4;
        var sy2 = sy - (t.maxLife - t.life) * 8 - s * 6;
        ctx.beginPath();
        ctx.arc(sx2, sy2, 5 + s * 2, 0, PI2);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/* ============================================================
   20. drawTombstones
   ============================================================ */
function drawTombstones() {
  for (var i = 0; i < tombstones.length; i++) {
    var t = tombstones[i];
    var sx = t.x - cam.x + W / 2;
    var sy = t.y - cam.y + H / 2;
    t.phase += 0.02;

    ctx.save();
    ctx.translate(sx, sy);

    // glow
    var glowCol = '#f0f';
    ctx.shadowColor = glowCol;
    ctx.shadowBlur = 12 + Math.sin(t.phase) * 4;

    // tombstone base shape
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(-8, 5);
    ctx.lineTo(-8, -8);
    ctx.arc(0, -8, 8, PI, 0);
    ctx.lineTo(8, 5);
    ctx.closePath();
    ctx.fill();

    // cross or symbol based on boss type
    ctx.strokeStyle = glowCol;
    ctx.lineWidth = 2;
    if (t.bossType === 'dragon' || t.bossType === 'fireboss') {
      // flame symbol
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, -12);
      ctx.moveTo(-4, -8);
      ctx.lineTo(0, -14);
      ctx.lineTo(4, -8);
      ctx.stroke();
    } else if (t.bossType === 'lich' || t.bossType === 'iceboss') {
      // skull-ish
      ctx.beginPath();
      ctx.arc(0, -6, 4, 0, PI2);
      ctx.moveTo(-2, -5);
      ctx.arc(-2, -5, 1, 0, PI2);
      ctx.moveTo(2, -5);
      ctx.arc(2, -5, 1, 0, PI2);
      ctx.stroke();
    } else {
      // generic cross
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -14);
      ctx.moveTo(-4, -8);
      ctx.lineTo(4, -8);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/* ============================================================
   21. drawEffects
   ============================================================ */
function drawEffects() {
  for (var i = 0; i < effects.length; i++) {
    var ef = effects[i];
    var sx = ef.x - cam.x + W / 2;
    var sy = ef.y - cam.y + H / 2;
    var progress = 1 - (ef.life / ef.maxLife);

    ctx.save();
    ctx.translate(sx, sy);

    if (ef.type === 'swordSwing' || ef.type === 'arc') {
      // sword arc
      var sa = ef.angle || 0;
      var arcLen = ef.arcLen || PI * 0.6;
      ctx.strokeStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(0, 0, ef.radius || 30, sa - arcLen / 2, sa - arcLen / 2 + arcLen * (1 - progress));
      ctx.stroke();
    }
    else if (ef.type === 'lightning' || ef.type === 'lightningBolt') {
      // lightning bolt
      ctx.strokeStyle = '#ff0';
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - progress;
      var lx = ef.tx || 0;
      var ly = ef.ty || 0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      var segs = 5;
      for (var s = 1; s <= segs; s++) {
        var lerp = s / segs;
        var jx = (s < segs) ? (rnd() - 0.5) * 20 : 0;
        var jy = (s < segs) ? (rnd() - 0.5) * 20 : 0;
        ctx.lineTo(lx * lerp + jx, ly * lerp + jy);
      }
      ctx.stroke();
    }
    else if (ef.type === 'fireWave') {
      ctx.fillStyle = '#f80';
      ctx.shadowColor = '#f80';
      ctx.shadowBlur = 15;
      ctx.globalAlpha = (1 - progress) * 0.6;
      var fa = ef.angle || 0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      var r2 = 40 + progress * 60;
      ctx.arc(0, 0, r2, fa - 0.4, fa + 0.4);
      ctx.closePath();
      ctx.fill();
    }
    else if (ef.type === 'iceNova' || ef.type === 'frostNova') {
      ctx.strokeStyle = '#8cf';
      ctx.shadowColor = '#8cf';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 3;
      ctx.globalAlpha = (1 - progress);
      var nr = progress * (ef.radius || 60);
      ctx.beginPath();
      ctx.arc(0, 0, nr, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = (1 - progress) * 0.2;
      ctx.fillStyle = '#8cf';
      ctx.fill();
    }
    else if (ef.type === 'summon') {
      ctx.strokeStyle = '#f0f';
      ctx.shadowColor = '#f0f';
      ctx.shadowBlur = 15;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - progress;
      var rr = progress * 40;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, PI2);
      ctx.stroke();
    }
    else {
      // generic circle pulse
      ctx.strokeStyle = ef.color || '#fff';
      ctx.shadowColor = ef.color || '#fff';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(0, 0, (ef.radius || 20) * progress, 0, PI2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ---- cat insurance overlay ----
  if (typeof catEffectTimer !== 'undefined' && catEffectTimer > 0) {
    ctx.save();
    var cx = W / 2;
    var cy = H / 2;
    var pulse = 1 + Math.sin(catEffectTimer * 8) * 0.1;
    ctx.globalAlpha = Math.min(1, catEffectTimer) * 0.7;
    ctx.shadowColor = '#0f8';
    ctx.shadowBlur = 30 + Math.sin(catEffectTimer * 6) * 10;
    if (typeof catImg !== 'undefined' && catImg && catImg.complete) {
      var cw = catImg.width * pulse * 0.5;
      var ch = catImg.height * pulse * 0.5;
      ctx.drawImage(catImg, cx - cw / 2, cy - ch / 2, cw, ch);
    } else {
      // fallback: draw a simple cat shape
      ctx.fillStyle = '#0f8';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CAT', cx, cy);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/* ============================================================
   22. drawGrid
   ============================================================ */
function drawGrid() {
  var gs = 64; // grid spacing
  var ox = (-cam.x % gs + gs) % gs;
  var oy = (-cam.y % gs + gs) % gs;

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;

  for (var x = ox; x < W; x += gs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (var y = oy; y < H; y += gs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

/* ============================================================
   23. updateSpawning
   ============================================================ */
function updateSpawning(dt) {
  _spawnTimer -= dt;
  _enemyRamp += dt;

  if (_spawnTimer > 0) return;

  // spawn interval gets shorter over time
  var baseInterval = 1.5;
  var interval = Math.max(0.3, baseInterval - _enemyRamp * 0.003);
  _spawnTimer = interval;

  if (enemies.length >= 80) return;

  // determine which types are available
  var types = ['slime'];
  if (_enemyRamp >= 15) types.push('bat');
  if (_enemyRamp >= 30) types.push('acid');
  if (_enemyRamp >= 45) types.push('tank');
  if (_enemyRamp >= 60) types.push('charger');
  if (_enemyRamp >= 90) types.push('splitter');
  if (_enemyRamp >= 120) types.push('spitter');

  // pick random type
  var type = types[rndI(0, types.length - 1)];

  // spawn at screen edge + buffer
  var side = rndI(0, 3);
  var bx, by;
  if (side === 0) { bx = player.x - W / 2 - 40; by = player.y + rnd() * H - H / 2; }
  else if (side === 1) { bx = player.x + W / 2 + 40; by = player.y + rnd() * H - H / 2; }
  else if (side === 2) { bx = player.x + rnd() * W - W / 2; by = player.y - H / 2 - 40; }
  else { bx = player.x + rnd() * W - W / 2; by = player.y + H / 2 + 40; }

  // HP multiplier scales with time
  var hpMul = 1 + _enemyRamp * 0.008;

  // spawn extra enemies as time goes on
  var count = 1 + Math.floor(_enemyRamp / 60);
  count = Math.min(count, 5);
  for (var c = 0; c < count; c++) {
    var ox = bx + (rnd() - 0.5) * 60;
    var oy = by + (rnd() - 0.5) * 60;
    spawnEnemy(type, ox, oy, hpMul);
  }

  // boss every 60 seconds
  if (BOSS_TYPES && _enemyRamp > 0 && Math.floor(_enemyRamp) % 60 < Math.floor((_enemyRamp - dt)) % 60 + 1 && Math.floor(_enemyRamp) >= 60) {
    // pick a boss
    var bossKeys = Object.keys(BOSS_TYPES);
    if (bossKeys.length > 0) {
      var bIdx = Math.min(Math.floor(_enemyRamp / 60) - 1, bossKeys.length - 1);
      var bossDef = BOSS_TYPES[bossKeys[bIdx]];
      if (bossDef) {
        spawnBoss(bossDef, hpMul);
        showBigText('BOSS INCOMING!', '#f0f');
        if (SFX && SFX.boss) { try { SFX.boss(); } catch(_){} }
      }
    }
  }
}

/* ============================================================
   23b. drawProjectiles
   ============================================================ */
function drawProjectiles() {
  for (var i = 0; i < projectiles.length; i++) {
    var p = projectiles[i];
    var sx = p.x - cam.x, sy = p.y - cam.y;
    if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
    ctx.fillStyle = p.color || '#f80';
    ctx.shadowColor = p.color || '#f80';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, PI2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/* ============================================================
   24. cleanupDead
   ============================================================ */
function cleanupDead() {
  // enemies
  for (var i = enemies.length - 1; i >= 0; i--) {
    var e = enemies[i];
    if (e.dead) {
      enemies.splice(i, 1);
      continue;
    }
    // remove far enemies
    var d = dist(e, player);
    if (d > 1200) {
      enemies.splice(i, 1);
    }
  }

  // particles are cleaned in update
  // dmgTexts cleaned in update
  // xpGems cleaned in update
  // deathTraces cleaned in update
  // projectiles cleaned in update

  // cap arrays to prevent memory issues
  if (particles.length > 500) particles.splice(0, particles.length - 500);
  if (dmgTexts.length > 100) dmgTexts.splice(0, dmgTexts.length - 100);
}
