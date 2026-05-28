const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber  = document.getElementById('countdown-number');
const flashOverlay     = document.getElementById('flash-overlay');

export function runCountdown(steps, done) {
  if (steps.length === 0) { done(); return; }

  const num = steps[0];
  countdownNumber.textContent = num;
  countdownOverlay.classList.remove('hidden');

  countdownNumber.style.animation = 'none';
  void countdownNumber.offsetWidth;
  countdownNumber.style.animation = '';

  setTimeout(() => {
    runCountdown(steps.slice(1), done);
  }, 1000);

  if (steps.length === 1) {
    setTimeout(() => countdownOverlay.classList.add('hidden'), 900);
  }
}

export function runCountdownAsync(steps) {
  return new Promise(resolve => runCountdown(steps, resolve));
}

export function announceShot(n) {
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

export function updateShotDots(activeIndex) {
  document.querySelectorAll('.shot-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'taken');
    if (i < activeIndex) dot.classList.add('taken');
    if (i === activeIndex) dot.classList.add('active');
  });
}

export function triggerFlash() {
  flashOverlay.classList.remove('hidden');
  flashOverlay.classList.add('flash-active');
  flashOverlay.addEventListener('animationend', () => {
    flashOverlay.classList.add('hidden');
    flashOverlay.classList.remove('flash-active');
  }, { once: true });
}
