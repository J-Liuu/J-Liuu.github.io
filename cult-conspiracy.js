(() => {
  const stage = document.querySelector('.startup-stage');
  const layers = Array.from(document.querySelectorAll('.cult-gallery-image'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!stage || layers.length < 2) return;

  const gallery = [
    { src: 'assets/projects/cult-conspiracy/screenshot-01.png', alt: 'Hand-drawn Cult Conspiracy cave cutscene' },
    { src: 'assets/projects/cult-conspiracy/screenshot-02.png', alt: 'Cult Conspiracy shooting tutorial gameplay' },
    { src: 'assets/projects/cult-conspiracy/screenshot-03.png', alt: 'Cult Conspiracy boss battle and bullet-hell gameplay' },
  ];

  let galleryIndex = 0;
  let activeLayer = 0;
  let firstAdvanceTimer;
  let galleryTimer;

  function preloadGallery() {
    gallery.forEach(({ src }) => {
      const image = new Image();
      image.src = src;
    });
  }

  function showNextImage() {
    const nextLayer = activeLayer === 0 ? 1 : 0;
    galleryIndex = (galleryIndex + 1) % gallery.length;
    layers[nextLayer].src = gallery[galleryIndex].src;
    layers[nextLayer].alt = gallery[galleryIndex].alt;
    layers[nextLayer].classList.add('is-active');
    layers[activeLayer].classList.remove('is-active');
    activeLayer = nextLayer;
  }

  function stopGallery() {
    window.clearTimeout(firstAdvanceTimer);
    window.clearInterval(galleryTimer);
    firstAdvanceTimer = undefined;
    galleryTimer = undefined;
  }

  function startGallery() {
    stopGallery();
    if (document.hidden || reducedMotion.matches) return;
    firstAdvanceTimer = window.setTimeout(() => {
      showNextImage();
      galleryTimer = window.setInterval(showNextImage, 1400);
    }, 2100);
  }

  function openCultConspiracy() {
    preloadGallery();
    startGallery();
  }

  window.addEventListener('portfolio:project-open', (event) => {
    if (event.detail?.project === 'cult-conspiracy') openCultConspiracy();
  });

  window.addEventListener('portfolio:project-close', (event) => {
    if (event.detail?.project === 'cult-conspiracy') stopGallery();
  });

  document.addEventListener('visibilitychange', () => {
    if (!stage.classList.contains('project-cult-conspiracy')) return;
    if (document.hidden) stopGallery();
    else startGallery();
  });

  reducedMotion.addEventListener('change', () => {
    if (stage.classList.contains('project-cult-conspiracy')) startGallery();
  });

  window.addEventListener('pagehide', stopGallery);
})();
