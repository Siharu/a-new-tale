// bake your code here
import { WrongnessState } from '../types.js';
// ─── DrifterAudio ─────────────────────────────────────────────────────────────
// Handles all Web Audio for Drifter's Tale:
//   • Ambient music engine (drone + texture noise + sparse melody)
//   • UI sounds (hover, select, back, deploy, error)
// Sky wrongness state drives filter cutoff, drone detune, and melody density.
export class DrifterAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.volume = 0.65;
        this.droneOscs = [];
        this.droneGains = [];
        this.noiseSource = null;
        this.noiseFilter = null;
        this.noiseGain = null;
        this.melodyTimer = null;
        this.ambientRunning = false;
        this.currentWrongness = WrongnessState.GREY;
    }
    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.master)
            this.master.gain.setTargetAtTime(this.volume * 0.7, this.getCtx().currentTime, 0.1);
    }
    startAmbient(wrongness = WrongnessState.GREY) {
        if (this.ambientRunning) {
            this.applyWrongness(wrongness);
            return;
        }
        this.currentWrongness = wrongness;
        this.ambientRunning = true;
        this.buildAmbient();
        this.scheduleMelody();
    }
    stopAmbient() {
        this.ambientRunning = false;
        if (this.melodyTimer)
            clearTimeout(this.melodyTimer);
        const t = this.ctx?.currentTime ?? 0;
        this.droneGains.forEach(g => g.gain.setTargetAtTime(0, t, 0.8));
        this.noiseGain?.gain.setTargetAtTime(0, t, 0.8);
        setTimeout(() => {
            this.droneOscs.forEach(o => { try {
                o.stop();
            }
            catch (_) { } });
            this.noiseSource?.stop();
            this.droneOscs = [];
            this.droneGains = [];
            this.noiseSource = null;
            this.noiseFilter = null;
            this.noiseGain = null;
        }, 2000);
    }
    applyWrongness(wrongness) {
        this.currentWrongness = wrongness;
        if (!this.ctx || !this.noiseFilter)
            return;
        const t = this.ctx.currentTime;
        const { cutoff, droneDetune, noiseVol } = this.wrongnessParams(wrongness);
        this.noiseFilter.frequency.setTargetAtTime(cutoff, t, 1.5);
        this.noiseGain?.gain.setTargetAtTime(noiseVol * this.volume * 0.18, t, 1.5);
        this.droneOscs.forEach((osc, i) => {
            osc.detune.setTargetAtTime(droneDetune + i * 3, t, 2.0);
        });
    }
    dispose() {
        this.stopAmbient();
        setTimeout(() => { try {
            this.ctx?.close();
        }
        catch (_) { } this.ctx = null; }, 2500);
    }
    playHover() {
        this.uiSound((ctx, out) => {
            const f = 1200 + Math.random() * 200;
            this.staticBurst(ctx, out, f, 0.022, 0.045);
        });
    }
    playSelect() {
        this.uiSound((ctx, out) => {
            this.tone(ctx, out, 1800, 0, 0.04, 0.04);
            this.tone(ctx, out, 900, 0.05, 0.06, 0.035);
            this.staticBurst(ctx, out, 2400, 0.02, 0.03);
        });
    }
    playBack() {
        this.uiSound((ctx, out) => {
            this.tone(ctx, out, 700, 0, 0.05, 0.04);
            this.tone(ctx, out, 400, 0.04, 0.055, 0.04);
        });
    }
    playDeploy() {
        this.uiSound((ctx, out) => {
            this.tone(ctx, out, 80, 0, 0.18, 0.12, 'sine', true);
            this.tone(ctx, out, 440, 0.06, 0.12, 0.08);
            this.tone(ctx, out, 880, 0.10, 0.10, 0.055);
            this.staticBurst(ctx, out, 3200, 0.08, 0.12);
        });
    }
    playAbort() {
        this.uiSound((ctx, out) => {
            this.tone(ctx, out, 320, 0, 0.06, 0.055);
            this.staticBurst(ctx, out, 800, 0.0, 0.07);
            this.tone(ctx, out, 200, 0.06, 0.08, 0.06);
        });
    }
    getCtx() {
        if (!this.ctx) {
            this.ctx = new AudioContext();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume * 0.7;
            this.master.connect(this.ctx.destination);
        }
        return this.ctx;
    }
    wrongnessParams(w) {
        switch (w) {
            case WrongnessState.SUNNY: return { cutoff: 800, droneDetune: 0, noiseVol: 0.4, basePitch: 60 };
            case WrongnessState.BLUE: return { cutoff: 600, droneDetune: -8, noiseVol: 0.5, basePitch: 58 };
            case WrongnessState.GREY: return { cutoff: 400, droneDetune: -18, noiseVol: 0.6, basePitch: 55 };
            case WrongnessState.RAINY: return { cutoff: 300, droneDetune: -28, noiseVol: 0.75, basePitch: 52 };
            case WrongnessState.STATIC: return { cutoff: 200, droneDetune: -40, noiseVol: 0.9, basePitch: 49 };
            case WrongnessState.STORMY: return { cutoff: 160, droneDetune: -55, noiseVol: 1.0, basePitch: 46 };
            default: return { cutoff: 350, droneDetune: -22, noiseVol: 0.65, basePitch: 54 };
        }
    }
    buildAmbient() {
        const ctx = this.getCtx();
        const out = this.master;
        const { cutoff, droneDetune, noiseVol, basePitch } = this.wrongnessParams(this.currentWrongness);
        const droneFreqs = [basePitch, basePitch + 7, basePitch + 12].map(midi => 440 * Math.pow(2, (midi - 69) / 12));
        droneFreqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = i === 0 ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;
            osc.detune.value = droneDetune + i * 3;
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.07 + i * 0.03;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.06;
            lfo.connect(lfoGain);
            const g = ctx.createGain();
            g.gain.value = 0;
            lfoGain.connect(g.gain);
            const filt = ctx.createBiquadFilter();
            filt.type = 'lowpass';
            filt.frequency.value = 180 + i * 40;
            filt.Q.value = 0.6;
            osc.connect(filt);
            filt.connect(g);
            g.connect(out);
            osc.start();
            lfo.start();
            g.gain.setTargetAtTime(0.055 - i * 0.012, ctx.currentTime + i * 1.2, 2.5);
            this.droneOscs.push(osc);
            this.droneGains.push(g);
        });
        const bufferSize = ctx.sampleRate * 4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++)
            data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const noiseF = ctx.createBiquadFilter();
        noiseF.type = 'bandpass';
        noiseF.frequency.value = cutoff;
        noiseF.Q.value = 1.4;
        const noiseG = ctx.createGain();
        noiseG.gain.value = noiseVol * this.volume * 0.18;
        noise.connect(noiseF);
        noiseF.connect(noiseG);
        noiseG.connect(out);
        noise.start();
        this.noiseSource = noise;
        this.noiseFilter = noiseF;
        this.noiseGain = noiseG;
    }
    scheduleMelody() {
        if (!this.ambientRunning)
            return;
        const { basePitch } = this.wrongnessParams(this.currentWrongness);
        const PENTA_MINOR = [0, 3, 5, 7, 10, 12, 15, 17];
        const playNote = () => {
            if (!this.ambientRunning)
                return;
            const ctx = this.getCtx();
            const out = this.master;
            const note = basePitch + PENTA_MINOR[Math.floor(Math.random() * PENTA_MINOR.length)]
                + (Math.random() < 0.3 ? 12 : 0);
            const freq = 440 * Math.pow(2, (note - 69) / 12);
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const g = ctx.createGain();
            const t = ctx.currentTime;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(this.volume * 0.055, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
            osc.connect(g);
            g.connect(out);
            osc.start(t);
            osc.stop(t + 2.5);
            const baseGap = this.wrongnessGap();
            this.melodyTimer = setTimeout(playNote, (baseGap + Math.random() * baseGap * 0.8) * 1000);
        };
        this.melodyTimer = setTimeout(playNote, (3 + Math.random() * 5) * 1000);
    }
    wrongnessGap() {
        switch (this.currentWrongness) {
            case WrongnessState.SUNNY: return 5;
            case WrongnessState.BLUE: return 7;
            case WrongnessState.GREY: return 9;
            case WrongnessState.RAINY: return 12;
            case WrongnessState.STATIC: return 18;
            case WrongnessState.STORMY: return 26;
            default: return 10;
        }
    }
    uiSound(build) {
        try {
            const ctx = this.getCtx();
            if (ctx.state === 'suspended')
                ctx.resume();
            const uiGain = ctx.createGain();
            uiGain.gain.value = this.volume * 0.55;
            uiGain.connect(ctx.destination);
            build(ctx, uiGain);
        }
        catch (_) { }
    }
    tone(ctx, out, freq, startOffset, duration, decay, type = 'square', pitchDrop = false) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        if (pitchDrop)
            osc.frequency.exponentialRampToValueAtTime(freq * 0.2, ctx.currentTime + startOffset + duration);
        const g = ctx.createGain();
        const t = ctx.currentTime + startOffset;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.9, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration + decay);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + duration + decay + 0.05);
    }
    staticBurst(ctx, out, filterFreq, startOffset, duration) {
        const bufSize = Math.ceil(ctx.sampleRate * (duration + 0.02));
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++)
            d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = filterFreq;
        filt.Q.value = 2;
        const g = ctx.createGain();
        const t = ctx.currentTime + startOffset;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.7, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(filt);
        filt.connect(g);
        g.connect(out);
        src.start(t);
    }
}
//# sourceMappingURL=DrifterAudio.js.map