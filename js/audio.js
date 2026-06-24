// ============================================================
// audio.js - BGM系统 + 音效系统 (Web Audio API)
// ============================================================
'use strict';

let audioCtx = null;

function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ============ 音效系统 ============
const SFX = {
    _play(freq, dur, type, vol, rampTo) {
        if (!audioCtx) return;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        const t = audioCtx.currentTime;
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (rampTo) o.frequency.exponentialRampToValueAtTime(rampTo, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
    },

    hit()     { this._play(400, 0.1, 'square', 0.12, 100); },
    kill()    { this._play(600, 0.2, 'sawtooth', 0.15, 200); },
    pickup()  { this._play(800, 0.08, 'sine', 0.06, 1200); },
    hurt()    { this._play(200, 0.15, 'sawtooth', 0.15, 80); },

    // WoW风格升级音效 - 上行大三和弦
    levelup() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const notes = [523, 659, 784, 1047]; // C5-E5-G5-C6
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, t + i * 0.08);
            g.gain.setValueAtTime(0.15, t + i * 0.08);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.4);
            o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.4);
        });
    },

    // 各技能音效
    sword()     { this._play(300, 0.12, 'triangle', 0.08, 100); },
    orb()       { this._play(500, 0.15, 'sine', 0.04, 600); },
    lightning() { this._play(100, 0.2, 'sawtooth', 0.18, 2000); },
    fire()      { this._play(100, 0.3, 'sawtooth', 0.08, 50); },
    ice()       { this._play(1200, 0.3, 'sine', 0.06, 400); },
    shield()    { this._play(800, 0.15, 'square', 0.1, 600); },

    combo() {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        [800, 1000, 1200].forEach((f, i) => {
            this._play(f, 0.15, 'triangle', 0.1, f * 1.2);
        });
    },

    boss_warn() { this._play(80, 1.0, 'sawtooth', 0.2, 60); },
    boss_die()  { this._play(60, 0.8, 'sawtooth', 0.25, 30); },

    insurance() {
        if (!audioCtx) return;
        // 低频爆炸 + 高频尖啸
        this._play(40, 0.5, 'sawtooth', 0.25, 20);
        setTimeout(() => this._play(1200, 0.3, 'square', 0.1, 400), 100);
    },

    charge()    { this._play(200, 0.3, 'sawtooth', 0.1, 800); },
    acid_bubble() { this._play(400, 0.1, 'sine', 0.03, 200); },
};

// ============ BGM系统 ============
const BGM = {
    mode: 'none',
    muted: false,
    _gain: null,
    _osc: null,
    _bassOsc: null,
    _interval: null,

    init() {
        if (!audioCtx) return;
        this._gain = audioCtx.createGain();
        this._gain.connect(audioCtx.destination);
        this._gain.gain.value = 0.06;
    },

    setMode(mode) {
        if (mode === this.mode || this.muted) return;
        this.stop();
        this.mode = mode;
        if (mode === 'none') return;
        this._startBGM(mode);
    },

    _startBGM(mode) {
        if (!audioCtx || !this._gain) return;
        const t = audioCtx.currentTime;

        // 主旋律振荡器
        this._osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        this._osc.connect(g); g.connect(this._gain);
        g.gain.value = 0.3;

        // 低音振荡器
        this._bassOsc = audioCtx.createOscillator();
        const bg2 = audioCtx.createGain();
        this._bassOsc.connect(bg2); bg2.connect(this._gain);
        bg2.gain.value = 0.2;

        if (mode === 'calm') {
            this._osc.type = 'sine'; this._osc.frequency.value = 220;
            this._bassOsc.type = 'sine'; this._bassOsc.frequency.value = 110;
        } else if (mode === 'combat') {
            this._osc.type = 'sawtooth'; this._osc.frequency.value = 330;
            this._bassOsc.type = 'square'; this._bassOsc.frequency.value = 82;
        } else if (mode === 'boss') {
            this._osc.type = 'sawtooth'; this._osc.frequency.value = 110;
            this._bassOsc.type = 'sawtooth'; this._bassOsc.frequency.value = 55;
            this._gain.gain.value = 0.08;
        }

        this._osc.start(t);
        this._bassOsc.start(t);

        // 简单节奏模式
        const bpm = mode === 'calm' ? 80 : mode === 'combat' ? 120 : 140;
        const interval = 60000 / bpm;
        let beat = 0;
        const notes = mode === 'calm' 
            ? [220, 262, 330, 262] 
            : mode === 'combat' 
            ? [330, 392, 330, 262, 330, 440, 330, 262]
            : [110, 131, 165, 110, 131, 196, 165, 110];

        this._interval = setInterval(() => {
            if (this._osc && !this.muted) {
                this._osc.frequency.setValueAtTime(notes[beat % notes.length], audioCtx.currentTime);
                beat++;
            }
        }, interval);
    },

    stop() {
        try { if (this._osc) { this._osc.stop(); this._osc = null; } } catch(e) {}
        try { if (this._bassOsc) { this._bassOsc.stop(); this._bassOsc = null; } } catch(e) {}
        if (this._interval) { clearInterval(this._interval); this._interval = null; }
        this.mode = 'none';
    },

    toggle() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stop();
        } else {
            this.setMode('calm');
        }
    },
};
