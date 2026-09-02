(() => {
  const stage = document.querySelector('.startup-stage');
  const viewport = document.querySelector('.flower-showcase');
  const host = document.querySelector('.flower-canvas-host');
  const interactionSurface = document.querySelector('.flower-interaction-surface');
  const status = document.querySelector('.flower-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!stage || !viewport || !host || !interactionSurface) return;

  let instance;
  let loadingPromise;
  let autoRotate = !reducedMotion.matches;
  let rotationX = 80;
  let rotationY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let previousPointerX = 0;
  let previousPointerY = 0;
  let dragging = false;
  let pointerActive = false;

  function updateMotionState() {
    viewport.dataset.motion = autoRotate ? 'auto' : 'manual';
  }

  function toggleRotation() {
    autoRotate = !autoRotate;
    updateMotionState();
  }

  function loadP5() {
    if (window.p5) return Promise.resolve(window.p5);
    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './p5.js';
      script.onload = () => resolve(window.p5);
      script.onerror = () => reject(new Error('Could not load p5.js'));
      document.head.append(script);
    });
    return loadingPromise;
  }

  function flowerSketch(p) {
    function vShape(height, radius, coneSize, bloomAngle, petalLength) {
      return height
        * Math.exp(-bloomAngle * Math.pow(Math.abs(radius), petalLength))
        * Math.pow(Math.abs(radius), coneSize);
    }

    function bumpiness(amount, radius, frequency, angle) {
      return 1 + amount * Math.pow(radius, 2) * p.sin(frequency * angle);
    }

    function resizeCanvas() {
      p.resizeCanvas(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    }

    function drawGrid() {
      p.push();
      p.stroke(54, 11, 32, 0.7);
      p.strokeWeight(1);
      const extent = 720;
      for (let line = -extent; line <= extent; line += 60) {
        p.line(-extent, 250, line, extent, 250, line);
        p.line(line, 250, -extent, line, 250, extent);
      }
      p.pop();
    }

    function drawFlower() {
      p.beginShape(p.POINTS);
      const thetaMax = 60;
      const phiStep = 1.5;

      for (let theta = 0; theta < thetaMax; theta += 1) {
        const bloomProgress = theta / thetaMax;
        p.stroke(48, 8 + bloomProgress * 7, 78 + bloomProgress * 10, 0.94);
        for (let phi = 0; phi < 360; phi += phiStep) {
          const radius = (70 * p.pow(p.abs(p.sin(phi * 5 / 2)), 1) + 225) * bloomProgress;
          const x = radius * p.cos(phi);
          const y = radius * p.sin(phi);
          const z = vShape(300, radius / 100, 0.8, 0.15, 1.5)
            - 200
            + bumpiness(1.5, radius / 100, 12, phi);
          p.vertex(x, y, z);
        }
      }
      p.endShape();
    }

    p.setup = () => {
      const canvas = p.createCanvas(
        Math.max(1, host.clientWidth),
        Math.max(1, host.clientHeight),
        p.WEBGL,
      );
      canvas.parent(host);
      canvas.attribute('aria-hidden', 'true');
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      p.colorMode(p.HSB, 360, 100, 100, 1);
      p.angleMode(p.DEGREES);
      p.strokeWeight(2);
      viewport.classList.add('is-ready');
      viewport.dataset.viewer = 'loaded';
      updateMotionState();
    };

    p.windowResized = resizeCanvas;

    p.draw = () => {
      p.background(225, 10, 10);
      const compact = p.width <= 780;
      const modelScale = Math.min(
        (p.width * (compact ? 0.78 : 0.47)) / 450,
        (p.height * (compact ? 0.48 : 0.72)) / 450,
      );

      p.push();
      p.translate(
        compact ? 0 : -Math.min(p.width * 0.19, 360),
        compact ? -p.height * 0.18 : 8 + p.sin(p.frameCount * 0.8) * 8,
        0,
      );
      p.scale(modelScale);
      drawGrid();

      if (autoRotate) rotationY += 0.2;

      p.rotateX(rotationX);
      p.rotateY(rotationY);
      drawFlower();
      p.pop();
    };

    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        autoRotate = false;
        viewport.dataset.motion = 'manual';
      }
    });
  }

  async function startShowcase() {
    if (instance) return;
    try {
      const P5 = await loadP5();
      instance = new P5(flowerSketch, host);
    } catch (error) {
      viewport.classList.add('is-error');
      if (status) status.textContent = 'Could not generate the flower';
      console.error(error);
    }
  }

  window.addEventListener('portfolio:project-open', (event) => {
    if (event.detail?.project === 'p5-flower') startShowcase();
  });

  interactionSurface.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointerActive = true;
    dragging = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    interactionSurface.setPointerCapture(event.pointerId);
  });

  interactionSurface.addEventListener('pointermove', (event) => {
    if (!pointerActive) return;
    const totalDistance = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
    if (totalDistance > 4) dragging = true;
    if (!dragging) return;

    autoRotate = false;
    rotationY += (event.clientX - previousPointerX) * 0.32;
    rotationX = Math.max(18, Math.min(142, rotationX - (event.clientY - previousPointerY) * 0.28));
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;
    updateMotionState();
  });

  function finishPointer(event) {
    if (!pointerActive) return;
    if (!dragging) toggleRotation();
    pointerActive = false;
    interactionSurface.releasePointerCapture?.(event.pointerId);
  }

  interactionSurface.addEventListener('pointerup', finishPointer);
  interactionSurface.addEventListener('pointercancel', finishPointer);
  interactionSurface.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleRotation();
  });

  window.addEventListener('pagehide', () => {
    instance?.remove();
    instance = undefined;
  });
})();
