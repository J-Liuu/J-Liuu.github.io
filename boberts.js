(() => {
  const stage = document.querySelector('.startup-stage');
  const frame = document.querySelector('.boberts-video-frame iframe');
  const layers = Array.from(document.querySelectorAll('.boberts-gallery-image'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!stage || !frame || layers.length < 2) return;

  const gallery = [
    { src: 'assets/projects/boberts/itch-01.png', alt: 'Bobert character artwork' },
    { src: 'assets/projects/boberts/itch-02.png', alt: 'Bobert skating through the city' },
    { src: 'assets/projects/boberts/itch-03.png', alt: 'Boberts Mad Dash forest gameplay' },
    { src: 'assets/projects/boberts/itch-04.png', alt: 'Bobert skating through an urban course' },
    { src: 'assets/projects/boberts/itch-05.png', alt: 'Development view of city barriers' },
    { src: 'assets/projects/boberts/itch-06.png', alt: 'Penguin City environment artwork' },
    { src: 'assets/projects/boberts/development-frog.png', alt: 'Toon shader development on Bobert' },
    { src: 'assets/projects/boberts/development-city.png', alt: 'Toon city environment development' },
    { src: 'assets/projects/boberts/development-car.png', alt: 'Toon vehicle environment development' },
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
      galleryTimer = window.setInterval(showNextImage, 1000);
    }, 1900);
  }

  function openBoberts() {
    if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
    preloadGallery();
    startGallery();
  }

  window.addEventListener('portfolio:project-open', (event) => {
    if (event.detail?.project === 'boberts-mad-dash') openBoberts();
  });

  window.addEventListener('portfolio:project-close', (event) => {
    if (event.detail?.project !== 'boberts-mad-dash') return;
    stopGallery();
    frame.removeAttribute('src');
  });

  document.addEventListener('visibilitychange', () => {
    if (!stage.classList.contains('project-boberts-mad-dash')) return;
    if (document.hidden) stopGallery();
    else startGallery();
  });

  reducedMotion.addEventListener('change', () => {
    if (stage.classList.contains('project-boberts-mad-dash')) startGallery();
  });

  window.addEventListener('pagehide', stopGallery);
})();
