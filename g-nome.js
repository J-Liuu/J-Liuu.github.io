(() => {
  const stage = document.querySelector('.startup-stage');
  const frame = document.querySelector('.g-nome-video-frame iframe');
  const layers = Array.from(document.querySelectorAll('.g-nome-gallery-image'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!stage || !frame || layers.length < 2) return;

  const gallery = [
    { src: 'assets/projects/g-nome/itch-07.png', alt: 'G-NOME multiplayer arena overview' },
    { src: 'assets/projects/g-nome/itch-04.png', alt: 'G-NOME arena with floating islands and bridges' },
    { src: 'assets/projects/g-nome/itch-08.png', alt: 'G-NOME floating island combat space' },
    { src: 'assets/projects/g-nome/itch-06.png', alt: 'G-NOME combat across the central arena stairs' },
    { src: 'assets/projects/g-nome/itch-05.png', alt: 'G-NOME magical projectile combat' },
    { src: 'assets/projects/g-nome/itch-03.png', alt: 'G-NOME ability loadout screen' },
    { src: 'assets/projects/g-nome/itch-02.png', alt: 'G-NOME multiplayer lobby' },
    { src: 'assets/projects/g-nome/itch-01.png', alt: 'G-NOME room browser' },
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

  function openGNOME() {
    if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
    preloadGallery();
    startGallery();
  }

  window.addEventListener('portfolio:project-open', (event) => {
    if (event.detail?.project === 'g-nome') openGNOME();
  });

  document.addEventListener('visibilitychange', () => {
    if (!stage.classList.contains('project-g-nome')) return;
    if (document.hidden) stopGallery();
    else startGallery();
  });

  reducedMotion.addEventListener('change', () => {
    if (stage.classList.contains('project-g-nome')) startGallery();
  });

  window.addEventListener('pagehide', stopGallery);
})();
