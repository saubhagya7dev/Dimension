import { initFpvFilm } from './fpv-film';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
root.classList.add('motion-ready');

// Native scrolling stays intact. All motion follows the browser's own scroll position.
const revealElements = document.querySelectorAll<HTMLElement>('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -15px 0px' });
  revealElements.forEach((element, index) => {
    if (element.classList.contains('project-card')) element.style.setProperty('--reveal-delay', `${(index % 3) * 65}ms`);
    revealObserver.observe(element);
  });
} else revealElements.forEach(element => element.classList.add('is-visible'));

const sections = Array.from(document.querySelectorAll<HTMLElement>('.tracked-section'));
const compass = document.querySelector<HTMLElement>('.section-compass');
const compassLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-compass]'));
const progress = document.querySelector<HTMLElement>('.page-progress');
const percentage = progress?.querySelector('b');
const parallax = document.querySelector<HTMLElement>('[data-parallax]');
let activeSection = '';
let framePending = false;
let compassTimer: ReturnType<typeof setTimeout>;
let sectionTops: number[] = [];
let maxScroll = 0;
let viewportHeight = 0;
let markerTravel = 0;
let parallaxTop = 0;
let parallaxHeight = 0;
let lastPercentage = -1;

// Layout reads happen when layout changes, never after writes in the scroll loop.
function measureScrollLayout() {
  const y = window.scrollY;
  viewportHeight = window.innerHeight;
  maxScroll = Math.max(0, root.scrollHeight - viewportHeight);
  sectionTops = sections.map(section => section.getBoundingClientRect().top + y);
  markerTravel = progress?.clientHeight || 0;
  const bounds = parallax?.parentElement?.getBoundingClientRect();
  parallaxTop = bounds ? bounds.top + y : 0;
  parallaxHeight = bounds?.height || 0;
  scheduleScroll();
}

function updateScroll() {
  const amount = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
  progress?.style.setProperty('--scroll-offset', `${amount * markerTravel}px`);
  const rounded = Math.round(amount * 100);
  if (percentage && rounded !== lastPercentage) {
    percentage.textContent = rounded.toString().padStart(3, '0');
    lastPercentage = rounded;
  }
  const trigger = window.scrollY + viewportHeight * 0.36;
  let active = sections[0];
  sections.forEach((section, i) => { if (sectionTops[i] <= trigger) active = section; });
  if (active && active.id !== activeSection) {
    activeSection = active.id;
    const activeIndex = compassLinks.findIndex(link => link.dataset.compass === activeSection);
    compassLinks.forEach((link, i) => {
      link.classList.toggle('is-current', i === activeIndex);
      link.classList.toggle('is-before', i < activeIndex);
      link.classList.toggle('is-after', i > activeIndex);
      link.classList.toggle('is-distant', i > activeIndex + 2);
      const hidden = i < activeIndex || i > activeIndex + 2;
      link.tabIndex = hidden ? -1 : 0;
      link.setAttribute('aria-hidden', String(hidden));
      if (i === activeIndex) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    compass?.classList.remove('is-transitioning');
    if (compass && !reducedMotion.matches) {
      compass.classList.add('is-transitioning');
      clearTimeout(compassTimer);
      compassTimer = setTimeout(() => compass.classList.remove('is-transitioning'), 750);
    }
    document.querySelectorAll<HTMLAnchorElement>('.desktop-nav a').forEach(link => link.classList.toggle('is-active', link.hash === `#${activeSection}`));
  }
  if (parallax && !reducedMotion.matches && window.innerWidth > 600) {
    const top = parallaxTop - window.scrollY;
    if (top + parallaxHeight > 0 && top < viewportHeight) {
      const offset = Math.max(-50, Math.min(50, (viewportHeight / 2 - (top + parallaxHeight / 2)) * .09));
      parallax.style.transform = `translate3d(0,${offset}px,0)`;
    }
  }
  framePending = false;
}
function scheduleScroll() {
  if (!framePending) { requestAnimationFrame(updateScroll); framePending = true; }
}
window.addEventListener('scroll', scheduleScroll, { passive: true });
window.addEventListener('resize', measureScrollLayout, { passive: true });
new ResizeObserver(measureScrollLayout).observe(document.body);
void document.fonts.ready.then(measureScrollLayout);
measureScrollLayout();

// A light perspective response adds depth without WebGL or continuous rendering.
const tiltTargets = document.querySelectorAll<HTMLElement>('[data-tilt]');
tiltTargets.forEach(target => {
  target.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType !== 'mouse' || window.innerWidth < 901) return;
    const bounds = target.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    target.style.transform = `perspective(1000px) rotateX(${-y * 5}deg) rotateY(${x * 7}deg)`;
  });
  target.addEventListener('pointerleave', () => { target.style.transform = ''; });
});
reducedMotion.addEventListener('change', () => {
  tiltTargets.forEach(target => { target.style.transform = ''; });
  if (parallax) parallax.style.transform = '';
  // The optional orbital renderer owns background-film playback so that
  // manual pause, mobile mode and offscreen suspension stay coordinated.
});

// Filtering uses real buttons and announces the new project count.
const filters = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
const cards = document.querySelectorAll<HTMLElement>('.project-card');
const count = document.querySelector<HTMLElement>('.project-count');
filters.forEach(button => {
  button.addEventListener('click', () => {
    let visible = 0;
    filters.forEach(filter => {
      const selected = filter === button;
      filter.classList.toggle('is-active', selected);
      filter.setAttribute('aria-pressed', String(selected));
    });
    cards.forEach(card => {
      const show = button.dataset.filter === 'All work' || card.dataset.category === button.dataset.filter;
      card.hidden = !show;
      if (show) { visible++; card.classList.add('is-visible'); }
    });
    if (count) count.textContent = `${visible.toString().padStart(2, '0')} project${visible === 1 ? '' : 's'}`;
    measureScrollLayout();
  });
});

const menuButton = document.querySelector<HTMLButtonElement>('.menu-toggle');
const menu = document.querySelector<HTMLElement>('#mobile-menu');
function closeMenu() {
  if (menu) menu.hidden = true;
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open menu');
}
menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
  if (menu) menu.hidden = expanded;
});
menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu && !menu.hidden) { closeMenu(); menuButton?.focus(); } });
document.addEventListener('click', event => {
  if (menu && !menu.hidden && event.target instanceof Node && !menu.contains(event.target) && !menuButton?.contains(event.target)) closeMenu();
});

function connectDialog(triggerSelector: string, dialogSelector: string) {
  const trigger = document.querySelector<HTMLButtonElement>(triggerSelector);
  const dialog = document.querySelector<HTMLDialogElement>(dialogSelector);
  if (!trigger || !dialog) return;
  trigger.addEventListener('click', () => {
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    if (dialogSelector === '.film-dialog') void dialog.querySelector('video')?.play().catch(() => {});
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    dialog.querySelector('video')?.pause();
    trigger.focus();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
}
connectDialog('[data-open-art]', '.art-dialog');
initFpvFilm();
if (reducedMotion.matches) document.querySelectorAll<HTMLVideoElement>('.hero-video').forEach(video => video.pause());
