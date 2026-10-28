import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function renderer() {
  const listeners = new Map();
  const classes = new Set();
  const timers = new Map();
  let focused = true;
  let nextTimer = 0;
  const listen = target => (event, handler) => listeners.set(`${target}:${event}`, handler);
  const document = {
    hidden: false,
    hasFocus: () => focused,
    documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    addEventListener: listen('document'),
  };
  const reducedMotion = { matches: false, addEventListener: listen('media') };
  vm.runInNewContext(fs.readFileSync(new URL('../scripts/cosmic-andromeda-motion.js', import.meta.url), 'utf8'), {
    document,
    window: { addEventListener: listen('window') },
    matchMedia: () => reducedMotion,
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  return {
    document, reducedMotion, classes, timers,
    focus(value) { focused = value; },
    emit(target, event) { listeners.get(`${target}:${event}`)(); },
    expire() { for (const timer of [...timers.values()]) timer.fn(); },
  };
}

test('no animation on load; a finite burst does not restart on every key', () => {
  const r = renderer();
  assert.equal(r.classes.size, 0);
  assert.equal(r.timers.size, 0);
  r.emit('document', 'keydown');
  assert.equal(r.classes.has('andromeda-motion-active'), true);
  const timer = [...r.timers.entries()][0];
  assert.equal(timer[1].ms, 1800);
  r.emit('document', 'wheel');
  assert.deepEqual([...r.timers.keys()], [timer[0]]);
  r.expire();
  assert.equal(r.classes.size, 0);
  assert.equal(r.timers.size, 0);
});

test('blur, occlusion and reduced motion immediately cancel only our activity class', () => {
  const r = renderer();
  r.classes.add('ide-owned-animation');
  r.emit('document', 'pointerdown');
  r.focus(false);
  r.emit('window', 'blur');
  assert.deepEqual([...r.classes], ['ide-owned-animation']);
  assert.equal(r.timers.size, 0);
  r.emit('document', 'keydown');
  assert.equal(r.timers.size, 0);
  r.focus(true);
  r.emit('window', 'focus');
  r.document.hidden = true;
  r.emit('document', 'visibilitychange');
  assert.equal(r.timers.size, 0);
  r.emit('document', 'wheel');
  assert.equal(r.timers.size, 0);
  r.document.hidden = false;
  r.emit('document', 'keydown');
  r.reducedMotion.matches = true;
  r.emit('media', 'change');
  assert.equal(r.timers.size, 0);
  r.emit('document', 'keydown');
  assert.deepEqual([...r.classes], ['ide-owned-animation']);
});
