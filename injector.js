// ==UserScript==
// @name         Arshnoor Era - Extreme Loud & Clear Mic Suite
// @namespace    https://arshnoor.era/
// @version      10.0
// @description  Arshnoor Era Mic Enhancement Suite (Extreme Loud + Crystal Clear Voice + 510kbps Stereo Unlock)
// @match        https://discord.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ARSHNOOR_ERA_LOADED__) return;
    window.__ARSHNOOR_ERA_LOADED__ = true;

    // ================= ARSHNOOR ERA BRANDING =================
    const CONFIG = {
        SUITE_NAME: "ARSHNOOR ERA",
        SUBTITLE: "Mic Enhancement Suite V10",
        BADGE_TEXT: "✨ ARSHNOOR ERA • PREMIUM+ ✨",
        LOGO_URL: "https://cdn-icons-png.flaticon.com/512/4712/4712109.png"
    };

    // ================= 1. WEBRTC 510KBPS STEREO UNLOCK =================
    const origSetLocalDesc = RTCPeerConnection.prototype.setLocalDescription;
    RTCPeerConnection.prototype.setLocalDescription = function (desc) {
        if (desc && desc.sdp) {
            desc.sdp = desc.sdp.replace(
                /useinbandfec=1/g,
                'useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1;usedtx=0'
            );
        }
        return origSetLocalDesc.apply(this, arguments);
    };

    // ================= 2. EXTREME LOUD + CRYSTAL CLEAR AUDIO ENGINE =================
    const audioState = {
        enabled: true,
        clearMode: true,     // 135Hz Mud-Cut + Clean Soft-Clipper for intelligible words at high gain
        masterVol: 1.5,
        gain: 20,            // 1x to 500x
        clarity: 18,         // +0dB to +30dB Vocal Presence (3.2kHz + 6.5kHz)
        distortion: 0,       // Clean to Nuclear
        bass: 0,             // Flat to Sub
        spatialPan: 0,       // -1 (Left) to +1 (Right)
        compRatio: 20,       // Brickwall Compressor Ratio
        ctx: null,
        mudCutNode: null,
        clarityMidNode: null,
        clarityHighNode: null,
        compNode: null,
        bassNode: null,
        distNode: null,
        gainNode: null,
        pannerNode: null,
        masterNode: null,
        analyser: null
    };

    function makeWaveCurve(distAmount, isClearMode) {
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            if (distAmount === 0) {
                curve[i] = isClearMode ? Math.tanh(x * 1.8) : x;
            } else {
                const k = distAmount;
                if (isClearMode) {
                    curve[i] = Math.tanh(x * (1 + k / 25));
                } else {
                    const deg = Math.PI / 180;
                    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
                }
            }
        }
        return curve;
    }

    function updateAudioNodes() {
        if (!audioState.ctx) return;
        const on = audioState.enabled;

        if (audioState.mudCutNode) {
            audioState.mudCutNode.frequency.value = (on && audioState.clearMode) ? 135 : 20;
        }
        if (audioState.clarityMidNode) {
            audioState.clarityMidNode.gain.value = on ? audioState.clarity : 0;
        }
        if (audioState.clarityHighNode) {
            audioState.clarityHighNode.gain.value = on ? (audioState.clarity * 0.65) : 0;
        }
        if (audioState.compNode) {
            audioState.compNode.ratio.value = on ? audioState.compRatio : 1;
        }
        if (audioState.bassNode) {
            audioState.bassNode.gain.value = on ? audioState.bass : 0;
        }
        if (audioState.distNode) {
            audioState.distNode.curve = makeWaveCurve(on ? audioState.distortion : 0, audioState.clearMode);
        }
        if (audioState.gainNode) {
            audioState.gainNode.gain.value = on ? audioState.gain : 1.0;
        }
        if (audioState.pannerNode) {
            audioState.pannerNode.pan.value = on ? audioState.spatialPan : 0;
        }
        if (audioState.masterNode) {
            audioState.masterNode.gain.value = on ? audioState.masterVol : 1.0;
        }
    }

    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function (constraints) {
        if (constraints && constraints.audio) {
            constraints.audio = {
                echoCancellation: false,
                noiseSuppression: true,
                autoGainControl: false,
                channelCount: 2,
                sampleRate: 48000
            };

            const rawStream = await origGetUserMedia(constraints);
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioCtx({ sampleRate: 48000 });
                const source = ctx.createMediaStreamSource(rawStream);
                const dest = ctx.createMediaStreamDestination();

                // Stage 1: 135Hz High-Pass Sub-Mud Blocker
                const mudCutNode = ctx.createBiquadFilter();
                mudCutNode.type = 'highpass';
                mudCutNode.frequency.value = 135;
                mudCutNode.Q.value = 0.707;

                // Stage 2: 3.2kHz Vocal Intelligibility Boost
                const clarityMidNode = ctx.createBiquadFilter();
                clarityMidNode.type = 'peaking';
                clarityMidNode.frequency.value = 3200;
                clarityMidNode.Q.value = 1.1;

                // Stage 3: 6.5kHz Crisp Air Boost
                const clarityHighNode = ctx.createBiquadFilter();
                clarityHighNode.type = 'highshelf';
                clarityHighNode.frequency.value = 6500;

                // Stage 4: Brickwall Vocal Compressor
                const compNode = ctx.createDynamicsCompressor();
                compNode.threshold.value = -32;
                compNode.knee.value = 0;
                compNode.ratio.value = 20;
                compNode.attack.value = 0.001;
                compNode.release.value = 0.04;

                // Stage 5: Bass Shelf Filter
                const bassNode = ctx.createBiquadFilter();
                bassNode.type = 'lowshelf';
                bassNode.frequency.value = 110;

                // Stage 6: Soft Clipper / Distortion
                const distNode = ctx.createWaveShaper();
                distNode.oversample = '4x';

                // Stage 7: Extreme Preamp Gain + Stereo Pan + Master Output
                const gainNode = ctx.createGain();
                const pannerNode = ctx.createStereoPanner();
                const masterNode = ctx.createGain();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 128;

                source
                    .connect(mudCutNode)
                    .connect(clarityMidNode)
                    .connect(clarityHighNode)
                    .connect(compNode)
                    .connect(bassNode)
                    .connect(distNode)
                    .connect(gainNode)
                    .connect(pannerNode)
                    .connect(masterNode)
                    .connect(analyser)
                    .connect(dest);

                Object.assign(audioState, {
                    ctx, mudCutNode, clarityMidNode, clarityHighNode,
                    compNode, bassNode, distNode, gainNode, pannerNode, masterNode, analyser
                });
                updateAudioNodes();
                return dest.stream;
            } catch (err) {
                console.error("Arshnoor Era Audio Hook Error:", err);
                return rawStream;
            }
        }
        return origGetUserMedia(constraints);
    };

    // ================= 3. UI OVERLAY INJECTION =================
    function injectUI() {
        if (document.getElementById('arshnoor-era-root')) return;

        const style = document.createElement('style');
        style.textContent = `
            #arshnoor-badge {
                position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
                background: linear-gradient(90deg, #5a2be2, #00d2ff);
                color: #fff; font-family: sans-serif; font-size: 11px; font-weight: 800;
                padding: 4px 16px; border-radius: 20px; letter-spacing: 1.4px;
                z-index: 999999; box-shadow: 0 0 15px rgba(90,43,226,0.85); pointer-events: none;
                white-space: nowrap;
            }
            #arshnoor-fab {
                position: fixed; bottom: 24px; right: 20px; width: 58px; height: 58px;
                border-radius: 50%; background: linear-gradient(135deg, #8a2be2, #00d2ff);
                padding: 3px; cursor: pointer; z-index: 999999;
                box-shadow: 0 0 22px rgba(138, 43, 226, 0.9);
            }
            #arshnoor-fab img { width: 100%; height: 100%; border-radius: 50%; background: #120d24; object-fit: cover; }
            #arshnoor-modal {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 92%; max-width: 390px; max-height: 84vh; overflow-y: auto;
                background: rgba(14, 10, 28, 0.97); border: 1px solid rgba(138, 43, 226, 0.55);
                border-radius: 22px; padding: 16px; color: #fff; font-family: sans-serif;
                z-index: 999998; box-shadow: 0 0 40px rgba(90, 20, 200, 0.75);
                backdrop-filter: blur(14px); display: none;
            }
            .ae-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
            .ae-brand { display: flex; align-items: center; gap: 10px; }
            .ae-brand img { width: 42px; height: 42px; border-radius: 12px; border: 2px solid #8a2be2; }
            .ae-title { font-size: 15px; font-weight: 800; letter-spacing: 0.6px; }
            .ae-sub { font-size: 11px; color: #00d2ff; }
            .ae-actions button {
                background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18);
                color: #fff; border-radius: 10px; padding: 6px 10px; font-weight: 700; margin-left: 4px; cursor: pointer;
            }
            #ae-rst { color: #ff5e57; border-color: rgba(255,94,87,0.5); }
            #ae-spectrum { width: 100%; height: 56px; background: #070510; border-radius: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.06); }
            .ae-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 12px; }
            .ae-btn-toggle { background: #3b1d7a; border: 1px solid #00d2ff; color: #fff; padding: 6px 10px; border-radius: 10px; font-weight: 800; font-size: 10px; cursor: pointer; }
            .ae-section { margin-bottom: 14px; }
            .ae-sec-head { display: flex; justify-content: space-between; font-size: 11px; color: #a29bfe; font-weight: 700; margin-bottom: 5px; letter-spacing: 0.6px; }
            .ae-slider { width: 100%; accent-color: #8a2be2; margin-bottom: 6px; }
            .ae-presets { display: flex; gap: 5px; }
            .ae-presets button {
                flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(138,43,226,0.3);
                color: #b2bec3; border-radius: 8px; padding: 6px 2px; font-size: 10px; font-weight: 700; cursor: pointer;
            }
            .ae-presets button:active { background: #5a2be2; color: #fff; }
        `;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.id = 'arshnoor-era-root';
        root.innerHTML = `
            <div id="arshnoor-badge">${CONFIG.BADGE_TEXT}</div>
            <div id="arshnoor-fab"><img src="${CONFIG.LOGO_URL}" alt="Arshnoor Era"></div>
            <div id="arshnoor-modal">
                <div class="ae-header">
                    <div class="ae-brand">
                        <img src="${CONFIG.LOGO_URL}">
                        <div>
                            <div class="ae-title">${CONFIG.SUITE_NAME}</div>
                            <div class="ae-sub">${CONFIG.SUBTITLE}</div>
                        </div>
                    </div>
                    <div class="ae-actions">
                        <button id="ae-rst">RST</button>
                        <button id="ae-close">✕</button>
                    </div>
                </div>

                <canvas id="ae-spectrum"></canvas>

                <div class="ae-row">
                    <button id="ae-toggle" class="ae-btn-toggle">ON</button>
                    <button id="ae-clear-mode" class="ae-btn-toggle" style="border-color:#0be881; color:#0be881;">CLEAR LOUD: ON</button>
                    <div style="flex:1">
                        <div class="ae-sec-head"><span>MASTER VOL</span><span id="lbl-master">x1.5</span></div>
                        <input type="range" id="sl-master" class="ae-slider" min="0.5" max="10" step="0.5" value="1.5">
                    </div>
                </div>

                <!-- GAIN -->
                <div class="ae-section">
                    <div class="ae-sec-head"><span>EXTREME GAIN</span><span id="lbl-gain">20x</span></div>
                    <input type="range" id="sl-gain" class="ae-slider" min="1" max="500" step="1" value="20">
                    <div class="ae-presets" id="pre-gain">
                        <button data-val="5">x5</button>
                        <button data-val="20">x20</button>
                        <button data-val="50">x50</button>
                        <button data-val="100">x100</button>
                        <button data-val="200">x200</button>
                        <button data-val="500">x500</button>
                    </div>
                </div>

                <!-- CLARITY -->
                <div class="ae-section">
                    <div class="ae-sec-head"><span>VOICE CLARITY (WORD SHARPNESS)</span><span id="lbl-clarity" style="color:#00d2ff">+18dB</span></div>
                    <input type="range" id="sl-clarity" class="ae-slider" min="0" max="30" step="1" value="18">
                    <div class="ae-presets" id="pre-clarity">
                        <button data-val="0">Flat</button>
                        <button data-val="12">Crisp</button>
                        <button data-val="18">Clear Loud</button>
                        <button data-val="24">Laser</button>
                        <button data-val="30">Piercing</button>
                    </div>
                </div>

                <!-- DISTORTION -->
                <div class="ae-section">
                    <div class="ae-sec-head"><span>CRUNCH / DISTORTION</span><span id="lbl-dist" style="color:#ff9f43">Clean</span></div>
                    <input type="range" id="sl-dist" class="ae-slider" min="0" max="800" step="10" value="0">
                    <div class="ae-presets" id="pre-dist">
                        <button data-val="0">Clean</button>
                        <button data-val="50">Grit</button>
                        <button data-val="150">Crunch</button>
                        <button data-val="400">Destroy</button>
                        <button data-val="800">Nuclear</button>
                    </div>
                </div>

                <!-- BASS SHELF -->
                <div class="ae-section">
                    <div class="ae-sec-head"><span>BASS SHELF</span><span id="lbl-bass" style="color:#0be881">Flat</span></div>
                    <input type="range" id="sl-bass" class="ae-slider" min="0" max="40" step="1" value="0">
                    <div class="ae-presets" id="pre-bass">
                        <button data-val="0">Flat</button>
                        <button data-val="8">Warm</button>
                        <button data-val="16">Thick</button>
                        <button data-val="28">Heavy</button>
                        <button data-val="40">Sub</button>
                    </div>
                </div>

                <!-- SPATIAL PANNING -->
                <div class="ae-section">
                    <div class="ae-sec-head"><span>SPATIAL STEREO PAN</span><span id="lbl-pan" style="color:#a29bfe">Center</span></div>
                    <input type="range" id="sl-pan" class="ae-slider" min="-1" max="1" step="0.1" value="0">
                    <div class="ae-presets" id="pre-pan">
                        <button data-val="-1">Left Ear</button>
                        <button data-val="-0.5">Mid-L</button>
                        <button data-val="0">Center</button>
                        <button data-val="0.5">Mid-R</button>
                        <button data-val="1">Right Ear</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        const modal = document.getElementById('arshnoor-modal');
        document.getElementById('arshnoor-fab').onclick = () => {
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
        };
        document.getElementById('ae-close').onclick = () => (modal.style.display = 'none');

        const btnToggle = document.getElementById('ae-toggle');
        btnToggle.onclick = () => {
            audioState.enabled = !audioState.enabled;
            btnToggle.textContent = audioState.enabled ? 'ON' : 'OFF';
            btnToggle.style.opacity = audioState.enabled ? '1' : '0.5';
            updateAudioNodes();
        };

        const btnClear = document.getElementById('ae-clear-mode');
        btnClear.onclick = () => {
            audioState.clearMode = !audioState.clearMode;
            btnClear.textContent = audioState.clearMode ? 'CLEAR LOUD: ON' : 'CLEAR LOUD: OFF';
            btnClear.style.color = audioState.clearMode ? '#0be881' : '#ff5e57';
            updateAudioNodes();
        };

        const bindSlider = (id, lblId, key, fmt, preId) => {
            const sl = document.getElementById(id);
            sl.oninput = (e) => {
                audioState[key] = parseFloat(e.target.value);
                document.getElementById(lblId).textContent = fmt(audioState[key]);
                updateAudioNodes();
            };
            if (preId) {
                document.querySelectorAll(`#${preId} button`).forEach((b) => {
                    b.onclick = () => {
                        sl.value = b.dataset.val;
                        sl.dispatchEvent(new Event('input'));
                    };
                });
            }
        };

        bindSlider('sl-master', 'lbl-master', 'masterVol', (v) => 'x' + v.toFixed(1));
        bindSlider('sl-gain', 'lbl-gain', 'gain', (v) => v + 'x', 'pre-gain');
        bindSlider('sl-clarity', 'lbl-clarity', 'clarity', (v) => '+' + v + 'dB', 'pre-clarity');
        bindSlider('sl-dist', 'lbl-dist', 'distortion', (v) => v === 0 ? 'Clean' : v <= 50 ? 'Grit' : v <= 150 ? 'Crunch' : v <= 400 ? 'Destroy' : 'Nuclear', 'pre-dist');
        bindSlider('sl-bass', 'lbl-bass', 'bass', (v) => v === 0 ? 'Flat' : v <= 8 ? 'Warm' : v <= 16 ? 'Thick' : v <= 28 ? 'Heavy' : 'Sub', 'pre-bass');
        bindSlider('sl-pan', 'lbl-pan', 'spatialPan', (v) => v === 0 ? 'Center' : v < 0 ? `Left (${Math.round(Math.abs(v)*100)}%)` : `Right (${Math.round(v*100)}%)`, 'pre-pan');

        document.getElementById('ae-rst').onclick = () => {
            ['sl-master', 'sl-gain', 'sl-clarity', 'sl-dist', 'sl-bass', 'sl-pan'].forEach((id) => {
                const el = document.getElementById(id);
                el.value = el.defaultValue;
                el.dispatchEvent(new Event('input'));
            });
        };

        const canvas = document.getElementById('ae-spectrum');
        const cCtx = canvas.getContext('2d');
        (function draw() {
            requestAnimationFrame(draw);
            cCtx.fillStyle = '#070510';
            cCtx.fillRect(0, 0, canvas.width, canvas.height);
            if (!audioState.analyser) return;
            const len = audioState.analyser.frequencyBinCount;
            const data = new Uint8Array(len);
            audioState.analyser.getByteFrequencyData(data);
            const bw = (canvas.width / len) * 2;
            for (let i = 0; i < len; i++) {
                const bh = (data[i] / 255) * canvas.height;
                cCtx.fillStyle = `rgb(${120 + i * 2}, 43, 255)`;
                cCtx.fillRect(i * bw, canvas.height - bh, bw - 1, bh);
            }
        })();
    }

    setInterval(injectUI, 2000);
})();
