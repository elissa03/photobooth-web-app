/* ─────────────────────────────────────────────
   Elissa's 23rd Photobooth — app.js
   Single-file, no build step, client-side only
───────────────────────────────────────────── */

(() => {
  'use strict';

  // ── DOM refs ──────────────────────────────────
  const viewfinder      = document.getElementById('viewfinder');
  const countdownOverlay= document.getElementById('countdown-overlay');
  const countdownNumber = document.getElementById('countdown-number');
  const flashOverlay    = document.getElementById('flash-overlay');
  const captureBtn      = document.getElementById('capture-btn');
  const cameraSection   = document.getElementById('camera-section');
  const previewSection  = document.getElementById('preview-section');
  const polaroidCanvas  = document.getElementById('polaroid-canvas');
  const workCanvas      = document.getElementById('work-canvas');
  const retakeBtn       = document.getElementById('retake-btn');
  const downloadBtn     = document.getElementById('download-btn');
  const frameOptions    = document.querySelectorAll('.frame-option');
  const modeOptions     = document.querySelectorAll('.mode-option');
  const photoProgress   = document.getElementById('photo-progress');

  // ── State ─────────────────────────────────────
  let stream        = null;
  let selectedFrame = 'white';
  let selectedMode  = 'polaroid';
  let fontReady     = false;
  let audioContext  = null;

  // ── Frame config ──────────────────────────────
  const FRAMES = {
    white: { border: '#ffffff', shadow: 'rgba(180,180,180,0.4)' },
    black: { border: '#1c1c1c', shadow: 'rgba(0,0,0,0.5)' },
    pink:  { border: '#c9a84c', shadow: 'rgba(201,168,76,0.4)' },
  };

  // ── Polaroid dimensions (px, @2x for crisp output) ──
  const PW   = 560;   // polaroid total width
  const PH   = 680;   // polaroid total height
  const PAD  = 28;    // side padding
  const PTOP = 28;    // top padding
  const PBOT = 110;   // bottom strip height (caption area)
  const ROUNDING = 14;
  const PHOTO_W = PW - PAD * 2;
  const PHOTO_H = PH - PTOP - PBOT - PAD; // photo area height

  // ── Photo strip dimensions ────────────────────
  const STRIP_SIDE_PAD  = 20;
  const STRIP_PHOTO_SZ  = 340;  // square photo size
  const STRIP_GAP       = 10;   // gap between photos
  const STRIP_TOP_PAD   = 24;
  const STRIP_BOT_PAD   = 80;
  const STRIP_W = STRIP_PHOTO_SZ + STRIP_SIDE_PAD * 2;
  const STRIP_H = STRIP_TOP_PAD + 4 * STRIP_PHOTO_SZ + 3 * STRIP_GAP + STRIP_BOT_PAD;

  // ── 1. Font preload ───────────────────────────
  async function waitForFont() {
    if (fontReady) return;
    try {
      await document.fonts.load('700 48px "Dancing Script"');
      fontReady = true;
    } catch (e) {
      // fallback — proceed without waiting
      fontReady = true;
    }
  }

  // ── 2. Start camera ───────────────────────────
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      viewfinder.srcObject = stream;
    } catch (err) {
      alert('Camera access is required to use the photobooth.\n\nPlease allow camera permissions and refresh.');
      console.error('getUserMedia error:', err);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  // ── 3. Frame picker ───────────────────────────
  frameOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      frameOptions.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedFrame = btn.dataset.frame;
    });
  });

  // ── Mode picker ───────────────────────────────
  modeOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      modeOptions.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMode = btn.dataset.mode;
    });
  });

  // ── 4. Countdown → capture ────────────────────
  captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    await prepareAudio();
    if (selectedMode === 'photobooth') {
      await runPhotoboothSequence();
    } else {
      runCountdown([3, 2, 1], () => {
        triggerFlash();
        playShutterSound();
        capturePhoto();
        captureBtn.disabled = false;
      });
    }
  });

  async function prepareAudio() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      audioContext = new AudioContextClass();
    }

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (err) {
        console.warn('Audio resume failed:', err);
      }
    }
  }

  function playShutterSound() {
    if (!audioContext || audioContext.state !== 'running') {
      return;
    }

    const now = audioContext.currentTime;
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.24, now + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    masterGain.connect(audioContext.destination);

    const clickOsc = audioContext.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1800, now);
    clickOsc.frequency.exponentialRampToValueAtTime(380, now + 0.045);

    const clickGain = audioContext.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.7, now + 0.004);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    clickOsc.connect(clickGain);
    clickGain.connect(masterGain);

    const snapBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.08, audioContext.sampleRate);
    const channelData = snapBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i += 1) {
      const decay = 1 - i / channelData.length;
      channelData[i] = (Math.random() * 2 - 1) * decay * 0.35;
    }

    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = snapBuffer;

    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, now);
    noiseFilter.Q.setValueAtTime(0.9, now);

    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.45, now + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    clickOsc.start(now);
    clickOsc.stop(now + 0.055);
    noiseSource.start(now + 0.008);
    noiseSource.stop(now + 0.09);

    noiseSource.addEventListener('ended', () => {
      clickOsc.disconnect();
      clickGain.disconnect();
      noiseSource.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
      masterGain.disconnect();
    }, { once: true });
  }

  function runCountdown(steps, done) {
    if (steps.length === 0) { done(); return; }

    const num = steps[0];
    countdownNumber.textContent = num;
    countdownOverlay.classList.remove('hidden');

    // restart animation each tick
    countdownNumber.style.animation = 'none';
    // force reflow
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = '';

    setTimeout(() => {
      runCountdown(steps.slice(1), done);
    }, 1000);

    if (steps.length === 1) {
      // hide overlay just before capture
      setTimeout(() => countdownOverlay.classList.add('hidden'), 900);
    }
  }

  function runCountdownAsync(steps) {
    return new Promise(resolve => runCountdown(steps, resolve));
  }

  function announceShot(n) {
    return new Promise(resolve => {
      countdownNumber.textContent = `${n} / 4`;
      countdownOverlay.classList.remove('hidden');
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = '';
      setTimeout(() => {
        countdownOverlay.classList.add('hidden');
        resolve();
      }, 800);
    });
  }

  function updateShotDots(activeIndex) {
    document.querySelectorAll('.shot-dot').forEach((dot, i) => {
      dot.classList.remove('active', 'taken');
      if (i < activeIndex) dot.classList.add('taken');
      if (i === activeIndex) dot.classList.add('active');
    });
  }

  function triggerFlash() {
    flashOverlay.classList.remove('hidden');
    flashOverlay.classList.add('flash-active');
    flashOverlay.addEventListener('animationend', () => {
      flashOverlay.classList.add('hidden');
      flashOverlay.classList.remove('flash-active');
    }, { once: true });
  }

  // ── 5. Photo capture + polaroid compositor ────
  async function capturePhoto() {
    // Draw raw video frame to work canvas (mirrored to match preview)
    const vw = viewfinder.videoWidth  || 640;
    const vh = viewfinder.videoHeight || 480;

    workCanvas.width  = vw;
    workCanvas.height = vh;

    const wCtx = workCanvas.getContext('2d');
    // Mirror to match front-facing viewfinder display
    wCtx.save();
    wCtx.translate(vw, 0);
    wCtx.scale(-1, 1);
    wCtx.drawImage(viewfinder, 0, 0, vw, vh);
    wCtx.restore();

    // Wait for font before compositing
    await waitForFont();

    // Build polaroid on display canvas
    composePolaroid(workCanvas, selectedFrame);

    // Switch views
    cameraSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
    stopCamera();
  }

  // ── 5b. Raw frame capture (for strip mode) ───
  function captureRawFrame() {
    const vw = viewfinder.videoWidth  || 640;
    const vh = viewfinder.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width  = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(viewfinder, 0, 0, vw, vh);
    ctx.restore();
    return canvas;
  }

  // ── 5c. Photobooth sequence (4 shots) ────────
  async function runPhotoboothSequence() {
    modeOptions.forEach(b => { b.disabled = true; });
    photoProgress.classList.remove('hidden');
    updateShotDots(0);

    const frames = [];
    for (let i = 0; i < 4; i++) {
      updateShotDots(i);
      await announceShot(i + 1);
      await runCountdownAsync([3, 2, 1]);

      triggerFlash();
      playShutterSound();
      frames.push(captureRawFrame());

      const dots = document.querySelectorAll('.shot-dot');
      dots[i].classList.remove('active');
      dots[i].classList.add('taken');

      if (i < 3) await new Promise(r => setTimeout(r, 900));
    }

    photoProgress.classList.add('hidden');
    modeOptions.forEach(b => { b.disabled = false; });

    await waitForFont();
    composePhotostrip(frames, selectedFrame);

    cameraSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
    stopCamera();
    captureBtn.disabled = false;
  }

  // ── 6. Polaroid compositor ────────────────────
  function composePolaroid(photoSource, frameKey) {
    const frame = FRAMES[frameKey] || FRAMES.white;

    polaroidCanvas.width  = PW;
    polaroidCanvas.height = PH;

    const ctx = polaroidCanvas.getContext('2d');

    // ── Layer 1: Polaroid background ──────────────
    drawRoundRect(ctx, 0, 0, PW, PH, ROUNDING, frame.border);

    // ── Layer 2: Photo window (cover-fit the photo) ─
    const photoX = PAD;
    const photoY = PTOP;

    // clip photo region to rounded inner rect
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, photoX, photoY, PHOTO_W, PHOTO_H, 6);
    ctx.clip();

    // cover-fit: scale photo to fill the photo window
    const srcW = photoSource.width;
    const srcH = photoSource.height;
    const scaleX = PHOTO_W / srcW;
    const scaleY = PHOTO_H / srcH;
    const scale  = Math.max(scaleX, scaleY);
    const drawW  = srcW * scale;
    const drawH  = srcH * scale;
    const drawX  = photoX + (PHOTO_W - drawW) / 2;
    const drawY  = photoY + (PHOTO_H - drawH) / 2;

    ctx.drawImage(photoSource, drawX, drawY, drawW, drawH);
    ctx.restore();

    // ── Layer 3: Bottom white strip ───────────────
    const stripY = PTOP + PHOTO_H + PAD / 2;

    // The strip is already the polaroid background color; just draw the text
    const captionY = stripY + (PBOT - PAD / 2) / 2 + 10;

    ctx.font = '700 46px "Dancing Script", cursive';
    ctx.fillStyle = frameKey === 'black' ? '#c9a84c' : '#9a7530';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Elissa's 23rd 🎀", PW / 2, captionY);

    // ── Outer border / frame color tint ───────────
    // Draw a subtle inset border to show chosen frame
    ctx.save();
    const borderW = 5;
    ctx.strokeStyle = frameKey === 'white' ? '#e0e0e0' :
                      frameKey === 'black' ? '#1c1c1c' : '#c9a84c';
    ctx.lineWidth = borderW * 2;
    roundRectPath(ctx, 0, 0, PW, PH, ROUNDING);
    ctx.stroke();
    ctx.restore();
  }

  // ── Helper: rounded rect fill ─────────────────
  function drawRoundRect(ctx, x, y, w, h, r, fillColor) {
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  // ── Helper: rounded rect path ─────────────────
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y,         x + r, y);
    ctx.closePath();
  }

  // ── 6b. Photo strip compositor ───────────────
  function composePhotostrip(photoSources, frameKey) {
    const frame = FRAMES[frameKey] || FRAMES.white;

    polaroidCanvas.width  = STRIP_W;
    polaroidCanvas.height = STRIP_H;

    const ctx = polaroidCanvas.getContext('2d');

    drawRoundRect(ctx, 0, 0, STRIP_W, STRIP_H, ROUNDING, frame.border);

    for (let i = 0; i < photoSources.length; i++) {
      const src    = photoSources[i];
      const photoX = STRIP_SIDE_PAD;
      const photoY = STRIP_TOP_PAD + i * (STRIP_PHOTO_SZ + STRIP_GAP);

      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, photoX, photoY, STRIP_PHOTO_SZ, STRIP_PHOTO_SZ, 4);
      ctx.clip();

      // Center-crop the video frame to a square
      const srcMin = Math.min(src.width, src.height);
      const srcX   = (src.width  - srcMin) / 2;
      const srcY   = (src.height - srcMin) / 2;
      ctx.drawImage(src, srcX, srcY, srcMin, srcMin, photoX, photoY, STRIP_PHOTO_SZ, STRIP_PHOTO_SZ);
      ctx.restore();
    }

    // Caption
    const captionY = STRIP_TOP_PAD + 4 * STRIP_PHOTO_SZ + 3 * STRIP_GAP + STRIP_BOT_PAD / 2;
    ctx.font = '700 38px "Dancing Script", cursive';
    ctx.fillStyle = frameKey === 'black' ? '#c9a84c' : '#9a7530';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Elissa's 23rd 🎀", STRIP_W / 2, captionY);

    // Outer border
    ctx.save();
    ctx.strokeStyle = frameKey === 'white' ? '#e0e0e0' :
                      frameKey === 'black' ? '#1c1c1c' : '#c9a84c';
    ctx.lineWidth = 10;
    roundRectPath(ctx, 0, 0, STRIP_W, STRIP_H, ROUNDING);
    ctx.stroke();
    ctx.restore();
  }

  // ── 7. Download ───────────────────────────────
  downloadBtn.addEventListener('click', () => {
    const dataURL = polaroidCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href     = dataURL;
    a.download = 'elissas-bday.png';
    a.click();
  });

  // ── 8. Retake ─────────────────────────────────
  retakeBtn.addEventListener('click', () => {
    previewSection.classList.add('hidden');
    cameraSection.classList.remove('hidden');
    photoProgress.classList.add('hidden');
    document.querySelectorAll('.shot-dot').forEach(d => d.classList.remove('active', 'taken'));
    const ctx = polaroidCanvas.getContext('2d');
    ctx.clearRect(0, 0, polaroidCanvas.width, polaroidCanvas.height);
    startCamera();
  });

  // ── Init ──────────────────────────────────────
  waitForFont();
  startCamera();
})();
