/** Inline cinematic preview + one borderless, keyboard-accessible film player. */
export function initFpvFilm() {
  const background = document.querySelector<HTMLVideoElement>('[data-inline-film]');
  const trigger = document.querySelector<HTMLButtonElement>('[data-open-film]');
  const dialog = document.querySelector<HTMLDialogElement>('#fpv-player');
  const video = dialog?.querySelector<HTMLVideoElement>('.film-video');
  if (!background || !trigger || !dialog || !video) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;
  let inlineRequest = 0;
  const previousOverflow = { value: '' };
  function syncBackground() {
    const request = ++inlineRequest;
    const shouldPlay = inView && !document.hidden && !reduced.matches && !dialog!.open;
    background!.dataset.playback = shouldPlay ? 'playing' : 'paused';
    if (!shouldPlay) { background!.pause(); return; }
    void background!.play().then(() => {
      // A slow network may resolve play after the user has left the section.
      if (request !== inlineRequest && (!inView || document.hidden || reduced.matches || dialog!.open)) background!.pause();
    }).catch(() => { background!.dataset.playback = 'poster'; });
  }
  background.addEventListener('playing', () => { background.classList.add('has-frame'); });
  const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
  const observer = new IntersectionObserver(entries => {
    inView = entries[0]?.isIntersecting ?? false;
    syncBackground();
  }, { threshold: .08, rootMargin: `-${headerHeight}px 0px 0px 0px` });
  observer.observe(background.closest('.fpv-stage')!);
  document.addEventListener('visibilitychange', syncBackground);
  reduced.addEventListener('change', syncBackground);

  const controls = dialog.querySelector<HTMLElement>('.film-controls');
  const play = dialog.querySelector<HTMLButtonElement>('[data-film-play]');
  const playIcon = dialog.querySelector<HTMLElement>('[data-film-play-icon]');
  const sound = dialog.querySelector<HTMLButtonElement>('[data-film-sound]');
  const seek = dialog.querySelector<HTMLInputElement>('[data-film-seek]');
  const time = dialog.querySelector<HTMLElement>('[data-film-time]');
  const fullscreen = dialog.querySelector<HTMLButtonElement>('[data-film-fullscreen]');
  const player = dialog.querySelector<HTMLElement>('.film-player');

  if (controls) { controls.hidden = false; video.controls = false; }
  function formatTime(value: number) {
    if (!Number.isFinite(value)) return '0:00';
    const seconds = Math.max(0, Math.floor(value));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  function updateControls() {
    if (play) play.setAttribute('aria-label', video!.paused ? 'Play film' : 'Pause film');
    if (playIcon) playIcon.textContent = video!.paused ? '▷' : 'Ⅱ';
    if (sound) {
      sound.textContent = video!.muted ? 'Sound off' : 'Sound on';
      sound.setAttribute('aria-label', video!.muted ? 'Unmute film' : 'Mute film');
      sound.setAttribute('aria-pressed', String(video!.muted));
    }
    const duration = Number.isFinite(video!.duration) ? video!.duration : 0;
    if (video!.videoWidth && video!.videoHeight) dialog!.style.setProperty('--film-aspect', String(video!.videoWidth / video!.videoHeight));
    const position = duration ? video!.currentTime / duration * 100 : 0;
    if (seek) {
      seek.value = String(position);
      seek.disabled = duration === 0;
      seek.setAttribute('aria-valuetext', `${formatTime(video!.currentTime)} of ${formatTime(duration)}`);
    }
    if (time) time.textContent = `${formatTime(video!.currentTime)} / ${formatTime(duration)}`;
  }
  for (const event of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'volumechange', 'ended']) video.addEventListener(event, updateControls);
  play?.addEventListener('click', () => {
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  });
  sound?.addEventListener('click', () => { video.muted = !video.muted; });
  seek?.addEventListener('input', () => {
    if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Number(seek.value) / 100 * video.duration;
  });
  fullscreen?.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else if (player?.requestFullscreen) void player.requestFullscreen().catch(() => {});
  });
  if (fullscreen && (!player?.requestFullscreen || !document.fullscreenEnabled)) fullscreen.hidden = true;
  document.addEventListener('fullscreenchange', () => {
    fullscreen?.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });

  trigger.addEventListener('click', () => {
    previousOverflow.value = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    syncBackground();
    // Continue from the inline preview's moment on the first opening.
    if (video.readyState > 0 && video.currentTime === 0 && background.currentTime > 0) video.currentTime = background.currentTime;
    void video.play().catch(() => { updateControls(); });
  });
  dialog.addEventListener('close', () => {
    video.pause();
    if (document.fullscreenElement && dialog.contains(document.fullscreenElement)) void document.exitFullscreen().catch(() => {});
    document.body.style.overflow = previousOverflow.value;
    trigger.focus({ preventScroll: true });
    syncBackground();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.code === 'Space' && event.target === video) {
      event.preventDefault();
      play?.click();
    }
  });
  window.addEventListener('pagehide', () => { background.pause(); video.pause(); });
  updateControls();
}
