import { startCamera, stopCamera } from './camera.js';
import { prepareAudio, playShutterSound } from './audio.js';
import { runCountdown, runCountdownAsync, announceShot, updateShotDots, triggerFlash } from './countdown.js';
import { composePolaroid, composePhotostrip } from './compositor.js';

// ── DOM refs ──────────────────────────────────
const viewfinder    = document.getElementById('viewfinder');
const captureBtn    = document.getElementById('capture-btn');
const cameraSection = document.getElementById('camera-section');
const previewSection= document.getElementById('preview-section');
const polaroidCanvas= document.getElementById('polaroid-canvas');
const workCanvas    = document.getElementById('work-canvas');
const retakeBtn     = document.getElementById('retake-btn');
const downloadBtn   = document.getElementById('download-btn');
const frameOptions  = document.querySelectorAll('.frame-option');
const modeOptions   = document.querySelectorAll('.mode-option');
const photoProgress = document.getElementById('photo-progress');

// ── State ─────────────────────────────────────
let selectedFrame = 'white';
let selectedMode  = 'polaroid';
let fontReady     = false;

// ── Font preload ──────────────────────────────
async function waitForFont() {
  if (fontReady) return;
  try {
    await document.fonts.load('700 48px "Dancing Script"');
    fontReady = true;
  } catch {
    fontReady = true;
  }
}

// ── Frame picker ──────────────────────────────
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

// ── Capture button ────────────────────────────
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

// ── Capture single photo ──────────────────────
async function capturePhoto() {
  const vw = viewfinder.videoWidth  || 640;
  const vh = viewfinder.videoHeight || 480;

  workCanvas.width  = vw;
  workCanvas.height = vh;

  const wCtx = workCanvas.getContext('2d');
  wCtx.save();
  wCtx.translate(vw, 0);
  wCtx.scale(-1, 1);
  wCtx.drawImage(viewfinder, 0, 0, vw, vh);
  wCtx.restore();

  await waitForFont();
  composePolaroid(workCanvas, selectedFrame, polaroidCanvas);

  cameraSection.classList.add('hidden');
  previewSection.classList.remove('hidden');
  stopCamera();
}

// ── Capture raw frame (for strip mode) ───────
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

// ── Photobooth sequence (4 shots) ────────────
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
  composePhotostrip(frames, selectedFrame, polaroidCanvas);

  cameraSection.classList.add('hidden');
  previewSection.classList.remove('hidden');
  stopCamera();
  captureBtn.disabled = false;
}

// ── Download ──────────────────────────────────
downloadBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href     = polaroidCanvas.toDataURL('image/png');
  a.download = 'elissas-bday.png';
  a.click();
});

// ── Retake ────────────────────────────────────
retakeBtn.addEventListener('click', () => {
  previewSection.classList.add('hidden');
  cameraSection.classList.remove('hidden');
  photoProgress.classList.add('hidden');
  document.querySelectorAll('.shot-dot').forEach(d => d.classList.remove('active', 'taken'));
  polaroidCanvas.getContext('2d').clearRect(0, 0, polaroidCanvas.width, polaroidCanvas.height);
  startCamera(viewfinder);
});

// ── Init ──────────────────────────────────────
waitForFont();
startCamera(viewfinder);
