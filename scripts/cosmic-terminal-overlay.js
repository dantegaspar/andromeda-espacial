/* Panel flotante sobre el editor. No copia código ni modifica el layout interno
 * de Monaco. El IDE conserva su espacio de panel para poder acoplarlo de nuevo.
 * Solo se activa para la terminal inferior; otros paneles conservan su posición.
 */
(() => {
  const panelClass = 'andromeda-terminal-overlay';
  let frame;
  let docked = false;

  function attach() {
    const workbench = document.querySelector('.monaco-workbench');
    const panel = workbench?.querySelector('.part.panel');
    const editor = workbench?.querySelector('.part.editor');
    const slot = panel?.closest('.split-view-view');
    const title = panel?.querySelector(':scope > .title');
    if (!workbench || !panel || !editor || !slot || !title) return false;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'andromeda-overlay-toggle';
    title.appendChild(button);

    function update() {
      frame = undefined;
      const terminal = panel.querySelector('.pane-body.integrated-terminal');
      const source = slot.getBoundingClientRect();
      const code = editor.getBoundingClientRect();
      const terminalVisible = terminal && terminal.getBoundingClientRect().height > 0;
      // Si el panel está al lado, maximizado u oculto, conservar el layout nativo.
      const bottomPanel = source.top >= code.bottom - 2 && source.width > 0 && source.height > 0;
      const active = !docked && terminalVisible && bottomPanel && code.height >= 100 && !workbench.classList.contains('nopanel');
      button.hidden = !terminalVisible;
      button.disabled = !bottomPanel || code.height < 100;
      const label = active ? 'Acoplar' : 'Superponer';
      if (button.textContent !== label) button.textContent = label;
      button.title = active ? 'Devolver la terminal a su posición inferior' : 'Ver el código detrás de la terminal';
      button.setAttribute('aria-pressed', String(Boolean(active)));
      if (active) {
        const top = Math.max(code.top, code.bottom - source.height);
        for (const [name, value] of [
          ['--andromeda-terminal-left', `${source.left}px`],
          ['--andromeda-terminal-top', `${top}px`],
        ]) {
          if (panel.style.getPropertyValue(name) !== value) panel.style.setProperty(name, value);
        }
      } else {
        panel.style.removeProperty('--andromeda-terminal-left');
        panel.style.removeProperty('--andromeda-terminal-top');
      }
      panel.classList.toggle(panelClass, Boolean(active));
    }

    function schedule() {
      if (frame === undefined) frame = requestAnimationFrame(update);
    }

    button.addEventListener('click', () => { docked = !docked; schedule(); });
    const resize = new ResizeObserver(schedule);
    resize.observe(slot);
    resize.observe(editor);
    const panelObserver = new MutationObserver(schedule);
    panelObserver.observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    const workbenchObserver = new MutationObserver(schedule);
    workbenchObserver.observe(workbench, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pagehide', () => {
      resize.disconnect();
      panelObserver.disconnect();
      workbenchObserver.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame !== undefined) cancelAnimationFrame(frame);
    }, { once: true });
    schedule();
    return true;
  }

  if (!attach()) {
    // Solo durante el arranque: dejar de observar el workbench al encontrarlo.
    const startup = new MutationObserver(() => { if (attach()) startup.disconnect(); });
    startup.observe(document.body, { subtree: true, childList: true });
    window.addEventListener('pagehide', () => startup.disconnect(), { once: true });
  }
})();
