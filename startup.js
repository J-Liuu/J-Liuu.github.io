(() => {
  const stage = document.querySelector('.startup-stage');
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!stage) return;

  const video = stage.querySelector('.startup-video-intro');
  const idleVideo = stage.querySelector('.startup-video-idle');
  const startupWindow = stage.querySelector('.startup-window');
  const workspaceWindow = stage.querySelector('.workspace-window');
  const projectDetails = stage.querySelectorAll('[data-project-details]');
  const projectButtons = stage.querySelectorAll('.project-menu button');
  const exitButtons = stage.querySelectorAll('.project-exit');
  const resumeTrigger = stage.querySelector('.resume-trigger');
  const resumeWindow = stage.querySelector('.resume-window');
  const resumeClose = stage.querySelector('.resume-close');
  const resumeBackdrop = stage.querySelector('.resume-backdrop');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const projects = ['time-heist', 'boberts-mad-dash', 'g-nome', 'p5-flower', 'cult-conspiracy'];
  let popupVisible = false;
  let introFinished = false;
  let activeProject;
  let closeTimer;

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

  function setControlPositions() {
    if (!workspaceWindow || stage.classList.contains('project-open')) return;
    const workspace = workspaceWindow.getBoundingClientRect();
    const set = (name, value) => stage.style.setProperty(name, `${value}px`);

    set('--control-header-left', workspace.left);
    set('--control-header-top', workspace.top + workspace.height * 57 / 912);
    set('--control-header-width', workspace.width * 1190 / 1430);
    set('--control-header-height', workspace.height * 26 / 912);

    set('--control-toolbar-left', workspace.left);
    set('--control-toolbar-top', workspace.top + workspace.height * 83 / 912);
    set('--control-toolbar-width', workspace.width * 54 / 1430);
    set('--control-toolbar-height', workspace.height * 370 / 912);

    set('--control-options-left', workspace.left + workspace.width * 1100 / 1430);
    set('--control-options-top', workspace.top + workspace.height * 83 / 912);
    set('--control-options-width', workspace.width * 90 / 1430);
    set('--control-options-height', workspace.height * 30 / 912);

    set('--control-navigation-left', workspace.left + workspace.width * 1150 / 1430);
    set('--control-navigation-top', workspace.top + workspace.height * 183 / 912);
    set('--control-navigation-width', workspace.width * 40 / 1430);
    set('--control-navigation-height', workspace.height * 140 / 912);
  }

  setControlPositions();
  window.addEventListener('resize', setControlPositions, { passive: true });

  projectButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const project = button.dataset.project;
      if (!projects.includes(project) || activeProject || stage.classList.contains('project-closing') || stage.classList.contains('resume-open')) return;
      window.clearTimeout(closeTimer);
      activeProject = project;
      popupVisible = false;
      video?.pause();
      idleVideo?.pause();
      setControlPositions();
      document.body.classList.add('project-active');
      startupWindow?.setAttribute('aria-hidden', 'true');
      projectDetails.forEach((details) => {
        const isActive = details.dataset.projectDetails === project;
        details.setAttribute('aria-hidden', String(!isActive));
        if (isActive) details.removeAttribute('inert');
        else details.setAttribute('inert', '');
      });
      window.dispatchEvent(new CustomEvent('portfolio:project-open', {
        detail: { project },
      }));
      requestAnimationFrame(() => {
        stage.classList.add('project-open', `project-${project}`);
      });
    });
  });

  function closeProject() {
    if (!activeProject || stage.classList.contains('project-closing')) return;
    const project = activeProject;
    document.activeElement?.blur();
    stage.classList.add('has-started', 'project-closing');
    stage.classList.remove('project-open', `project-${project}`);
    startupWindow?.setAttribute('aria-hidden', 'false');
    popupVisible = true;
    updateVideo();
    window.dispatchEvent(new CustomEvent('portfolio:project-close', {
      detail: { project },
    }));

    closeTimer = window.setTimeout(() => {
      projectDetails.forEach((details) => {
        details.setAttribute('aria-hidden', 'true');
        details.setAttribute('inert', '');
      });
      stage.classList.remove('project-closing');
      document.body.classList.remove('project-active');
      activeProject = undefined;
      setControlPositions();
    }, reducedMotion.matches ? 30 : 1750);
  }

  exitButtons.forEach((button) => {
    button.addEventListener('click', closeProject);
  });

  function openResume() {
    if (!resumeWindow || activeProject || stage.classList.contains('project-closing')) return;
    popupVisible = false;
    video?.pause();
    idleVideo?.pause();
    startupWindow?.setAttribute('inert', '');
    resumeWindow.removeAttribute('inert');
    resumeWindow.setAttribute('aria-hidden', 'false');
    resumeTrigger?.setAttribute('aria-expanded', 'true');
    stage.classList.add('resume-open');
    requestAnimationFrame(() => resumeClose?.focus());
  }

  function closeResume() {
    if (!resumeWindow || !stage.classList.contains('resume-open')) return;
    stage.classList.remove('resume-open');
    resumeWindow.setAttribute('aria-hidden', 'true');
    resumeWindow.setAttribute('inert', '');
    startupWindow?.removeAttribute('inert');
    resumeTrigger?.setAttribute('aria-expanded', 'false');
    popupVisible = true;
    updateVideo();
    resumeTrigger?.focus();
  }

  resumeTrigger?.addEventListener('click', openResume);
  resumeClose?.addEventListener('click', closeResume);
  resumeBackdrop?.addEventListener('click', closeResume);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (stage.classList.contains('resume-open')) closeResume();
    else closeProject();
  });

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
    window.clearTimeout(closeTimer);
    if (audio && audio.state !== 'closed') audio.close().catch(() => {});
    audio = null;
  });
})();
