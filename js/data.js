// ============================================================
// data.js - 游戏常量、敌人定义、角色定义、技能定义
// ============================================================
'use strict';

const PI = Math.PI, PI2 = PI * 2;

// 颜色方案 - v0.2 暗黑霓虹风格
const COLORS = {
    bg: '#0a0a1a',
    grid: 'rgba(255,255,255,0.025)',
    player: '#0f8',      // 霓虹绿
    playerGlow: '#0f8',
    hp: '#f44',
    hpBg: '#300',
    xp: '#0f8',
    xpBg: '#111',
    text: '#fff',
    textDim: '#888',
    warning: '#f44',
    combo: '#ff0',
};

// 敌人类型定义
const ENEMY_TYPES = {
    slime: {
        name: '史莱姆', hp: 25, speed: 45, dmg: 8, size: 13, color: '#3a3', xp: 3,
        shape: 'circle', deathTrace: null
    },
    bat: {
        name: '蝙蝠', hp: 15, speed: 90, dmg: 6, size: 9, color: '#a3a', xp: 3,
        shape: 'tri', deathTrace: null, zigzag: true
    },
    skeleton: {
        name: '骷髅', hp: 60, speed: 38, dmg: 15, size: 15, color: '#bbb', xp: 8,
        shape: 'diamond', deathTrace: 'bones'
    },
    ogre: {
        name: '食人魔', hp: 180, speed: 28, dmg: 28, size: 22, color: '#a63', xp: 25,
        shape: 'circle', deathTrace: 'meat', slowOnDeath: true
    },
    ghost: {
        name: '幽灵', hp: 35, speed: 65, dmg: 12, size: 11, color: '#88f', xp: 6,
        shape: 'circle', deathTrace: null, phasing: true
    },
    worm: {
        name: '蠕虫', hp: 45, speed: 30, dmg: 10, size: 10, color: '#6a3', xp: 5,
        shape: 'circle', deathTrace: null
    },
    acid: {
        name: '酸液怪', hp: 40, speed: 50, dmg: 10, size: 12, color: '#6f0', xp: 8,
        shape: 'circle', deathTrace: 'acid'
    },
    tank: {
        name: '肉盾怪', hp: 400, speed: 18, dmg: 35, size: 28, color: '#864', xp: 30,
        shape: 'diamond', deathTrace: 'meat', slowOnDeath: true
    },
    charger: {
        name: '冲锋怪', hp: 50, speed: 40, dmg: 20, size: 14, color: '#f60', xp: 10,
        shape: 'tri', deathTrace: null, chargeTimer: 0, charging: false
    },
    splitter: {
        name: '分裂怪', hp: 55, speed: 55, dmg: 12, size: 15, color: '#c6f', xp: 8,
        shape: 'circle', deathTrace: null, splitOnDeath: true
    },
    spitter: {
        name: '毒液怪', hp: 45, speed: 30, dmg: 8, size: 13, color: '#a0a', xp: 10,
        shape: 'diamond', deathTrace: 'poison', ranged: true, shootCD: 1.5, shootRange: 200
    },
};

// BOSS 定义
const BOSS_TYPES = [
    { id: 'eye', name: '腐化之眼', hp: 2000, speed: 25, dmg: 40, size: 40, color: '#f33', xp: 200, shape: 'star',
      attack: 'summon', summonType: 'slime', summonCount: 3, summonCD: 5 },
    { id: 'dragon', name: '骨龙', hp: 3000, speed: 20, dmg: 50, size: 45, color: '#3f3', xp: 300, shape: 'star',
      attack: 'breath', breathColor: '#0f0' },
    { id: 'meat', name: '肉山', hp: 5000, speed: 12, dmg: 60, size: 55, color: '#a33', xp: 400, shape: 'star',
      attack: 'acid_explosion' },
    { id: 'spider', name: '蜘蛛女王', hp: 2500, speed: 22, dmg: 35, size: 42, color: '#a0a', xp: 350, shape: 'star',
      attack: 'lay_eggs', eggHatchType: 'spitter', eggHatchCount: 2, eggCD: 8 },
];

// 死亡痕迹定义
const DEATH_TRACES = {
    acid:   { color: '#2a0', radius: 35, life: 4, effect: 'dmg', dps: 15 },
    poison: { color: '#60a', radius: 30, life: 3, effect: 'slow+dmg', dps: 5, slow: 0.3 },
    bones:  { color: '#666', radius: 20, life: 2, effect: null },
    meat:   { color: '#600', radius: 25, life: 3, effect: 'slow', slow: 0.3 },
};

// 角色定义
const CHARACTERS = {
    slave: {
        id: 'slave', name: '社畜', emoji: '💻',
        color: '#6a8', trailColor: '#8b6914',
        speedMul: 1.10, hpMul: 1.0, atkMul: 1.0, xpMul: 1.0,
        desc: '格子衫+黑眼圈+咖啡杯',
        stats: '移速 +10%',
    },
    wang: {
        id: 'wang', name: '老王', emoji: '👴',
        color: '#da8', trailColor: '#adf',
        speedMul: 1.0, hpMul: 1.20, atkMul: 0.95, xpMul: 1.0,
        desc: '秃顶+白背心+蒲扇',
        stats: '血量 +20% | 攻速 -5%',
    },
    intern: {
        id: 'intern', name: '实习生', emoji: '📚',
        color: '#8af', trailColor: '#ccc',
        speedMul: 1.0, hpMul: 0.90, atkMul: 1.0, xpMul: 1.15,
        desc: '大眼镜+马尾+文件夹',
        stats: '经验 +15% | 血量 -10%',
    },
};

// 武器/技能定义
const WEAPONS = {
    sword: {
        id: 'sword', name: '键盘侠の反击', icon: '⌨', color: '#0f8',
        desc: '用键盘砸人的感觉', baseDmg: 18, baseCd: 0.7, baseRange: 90,
    },
    orb: {
        id: 'orb', name: '甲方需求', icon: '📋', color: '#0ff',
        desc: '转来转去烦死你', baseDmg: 12, baseCd: 0, baseRange: 65,
    },
    lightning: {
        id: 'lightning', name: 'WiFi信号', icon: '📶', color: '#ff0',
        desc: '自动连接最近的敌人', baseDmg: 30, baseCd: 1.4, baseRange: 220,
    },
    fire: {
        id: 'fire', name: '工资条の怒火', icon: '🔥', color: '#f80',
        desc: '看到工资条就想烧东西', baseDmg: 15, baseCd: 1.8, baseRange: 130,
    },
    ice: {
        id: 'ice', name: '空调16度', icon: '❄', color: '#8cf',
        desc: '冻死所有人的空调', baseDmg: 10, baseCd: 2.5, baseRange: 100,
    },
    shield: {
        id: 'shield', name: '社畜の护盾', icon: '🛡', color: '#fda',
        desc: '996是打不倒我的', baseDmg: 0, baseCd: 5, baseRange: 0,
    },
};

// 组合技定义
const COMBOS = {
    bbq: {
        id: 'bbq', name: '电烤串', icon: '🍢',
        requires: ['lightning', 'fire'],
        desc: '闪电击中燃烧敌人会爆炸',
    },
    spa: {
        id: 'spa', name: '温泉桑拿', icon: '♨',
        requires: ['fire', 'ice'],
        desc: '蒸汽爆炸，大范围减速+持续伤害',
    },
    iced_lightning: {
        id: 'iced_lightning', name: '冰镇雷劈', icon: '🧊',
        requires: ['ice', 'lightning'],
        desc: '冰冻的敌人被雷劈时碎裂',
    },
    bbq_sword: {
        id: 'bbq_sword', name: '烤肉刀', icon: '🥩',
        requires: ['sword', 'fire'],
        desc: '剑气附带火焰，命中后持续燃烧',
    },
    thunder_blade: {
        id: 'thunder_blade', name: '十万伏特刀', icon: '⚡',
        requires: ['sword', 'lightning'],
        desc: '剑气变成链式闪电',
    },
    ice_cream: {
        id: 'ice_cream', name: '冰淇淋搅拌机', icon: '🍦',
        requires: ['orb', 'ice'],
        desc: '护身球变成冰球，经过的敌人全部减速',
    },
};

// 保险技
const INSURANCE = {
    name: '流浪猫猫的抗争', icon: '🐱', max: 2,
    text: '喵星人驾到！',
};
