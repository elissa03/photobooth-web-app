let stream = null;

export async function startCamera(viewfinder) {
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

export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}
