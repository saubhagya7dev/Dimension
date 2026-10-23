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

function updateScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const amount = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
  progress?.style.setProperty('--scroll-progress', `${amount * 100}%`);
  if (percentage) percentage.textContent = Math.round(amount * 100).toString().padStart(3, '0');
  const trigger = window.innerHeight * 0.36;
  let active = sections[0];
  sections.forEach(section => { if (section.getBoundingClientRect().top <= trigger) active = section; });
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
      void compass.offsetWidth;
      compass.classList.add('is-transitioning');
      clearTimeout(compassTimer);
      compassTimer = setTimeout(() => compass.classList.remove('is-transitioning'), 750);
    }
    document.querySelectorAll<HTMLAnchorElement>('.desktop-nav a').forEach(link => link.classList.toggle('is-active', link.hash === `#${activeSection}`));
  }
  if (parallax && !reducedMotion.matches && window.innerWidth > 600) {
    const rect = parallax.parentElement!.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < innerHeight) {
      const offset = Math.max(-50, Math.min(50, (innerHeight / 2 - (rect.top + rect.height / 2)) * .09));
      parallax.style.transform = `translateY(${offset}px)`;
    }
  }
  framePending = false;
}
window.addEventListener('scroll', () => {
  if (!framePending) { requestAnimationFrame(updateScroll); framePending = true; }
}, { passive: true });
window.addEventListener('resize', updateScroll, { passive: true });
updateScroll();

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
  document.querySelectorAll<HTMLVideoElement>('.hero-video').forEach(video => {
    if (reducedMotion.matches) video.pause();
    else void video.play().catch(() => {});
  });
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
    updateScroll();
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
connectDialog('[data-open-film]', '.film-dialog');
if (reducedMotion.matches) document.querySelectorAll<HTMLVideoElement>('.hero-video').forEach(video => video.pause());
