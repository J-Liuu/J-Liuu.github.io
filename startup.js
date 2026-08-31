(() => {
  const stage = document.querySelector('.startup-stage');
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!stage) return;

  const video = stage.querySelector('.startup-video-intro');
  const idleVideo = stage.querySelector('.startup-video-idle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let popupVisible = false;
  let introFinished = false;

  function updateVideo() {
    if (!popupVisible || document.hidden || reducedMotion.matches) {
      video?.pause();
      idleVideo?.pause();
      return;
    }
    const activeVideo = introFinished ? idleVideo : video;
    if (!activeVideo || !activeVideo.paused) return;
    activeVideo.muted = true;
    activeVideo.play().catch(() => {});
  }

  video?.addEventListener('ended', () => {
    introFinished = true;
    updateVideo();
  });

  // Hold the intro's final image underneath until the loop is ready to display.
  idleVideo?.addEventListener('playing', () => {
    idleVideo.classList.add('is-active');
  });

  document.addEventListener('visibilitychange', updateVideo);
  reducedMotion.addEventListener('change', updateVideo);

  let audio;

  function getAudio() {
    if (!AudioContext) return null;
    if (!audio) {
      try {
        audio = new AudioContext();
      } catch {
        return null;
      }
    }
    return audio;
  }

  function unlockAudio() {
    const context = getAudio();
    if (context && context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    updateVideo();
  }

  function playPop(pitch) {
    const context = getAudio();
    // Never queue a blocked sound to play later, out of sync with its window.
    if (!context || context.state !== 'running' || document.hidden) return;

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const now = context.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(pitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.35, now + 0.085);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.16, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    envelope.gain.linearRampToValueAtTime(0, now + 0.12);

    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  }

  stage.addEventListener('animationstart', (event) => {
    if (event.animationName === 'windowPop') playPop(520);
    if (event.animationName === 'dialogPop') {
      playPop(660);
      popupVisible = true;
      updateVideo();
    }
  });

  // Browsers may require a visitor gesture before allowing Web Audio playback.
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pagehide', () => {
    if (audio && audio.state !== 'closed') audio.close().catch(() => {});
    audio = null;
  });
})();
