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

  // ── State ─────────────────────────────────────
  let stream       = null;
  let selectedFrame = 'white';
  let fontReady    = false;

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

  // ── 4. Countdown → capture ────────────────────
  captureBtn.addEventListener('click', () => {
    captureBtn.disabled = true;
    runCountdown([3, 2, 1], () => {
      triggerFlash();
      capturePhoto();
      captureBtn.disabled = false;
    });
  });

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
    // Clear canvases
    const ctx = polaroidCanvas.getContext('2d');
    ctx.clearRect(0, 0, polaroidCanvas.width, polaroidCanvas.height);
    startCamera();
  });

  // ── Init ──────────────────────────────────────
  waitForFont();
  startCamera();
})();
