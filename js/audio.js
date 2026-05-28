let audioContext = null;

export async function prepareAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
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

export function playShutterSound() {
  if (!audioContext || audioContext.state !== 'running') return;

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
  for (let i = 0; i < channelData.length; i++) {
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
