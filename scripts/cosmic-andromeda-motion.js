/* Instalado solo con --animated. Sin polling ni observadores del DOM. */
(() => {
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const activityClass = 'andromeda-motion-active';
  let timeout;

  function stop() {
    clearTimeout(timeout);
    timeout = undefined;
    root.classList.remove(activityClass);
  }

  function activity() {
    if (document.hidden || !document.hasFocus() || reducedMotion.matches) {
      stop();
      return;
    }
    // Una ráfaga finita por interacción. No se reinicia por cada tecla/frame.
    if (timeout !== undefined) return;
    root.classList.add(activityClass);
    timeout = setTimeout(stop, 1800);
  }

  window.addEventListener('blur', stop);
  window.addEventListener('focus', activity);
  document.addEventListener('visibilitychange', stop);
  reducedMotion.addEventListener('change', stop);
  for (const event of ['keydown', 'pointerdown', 'wheel']) {
    document.addEventListener(event, activity, { passive: true });
  }
})();
