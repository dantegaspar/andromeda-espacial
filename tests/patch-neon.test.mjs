import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeChecksum, patchApp } from '../scripts/patch-neon.mjs';

const checksumKey = 'vs/code/electron-browser/workbench/workbench.html';
const originalHtml = '<!doctype html>\n<html>\n<head>\n</head>\n<body></body>\n<script src="./workbench.js" type="module"></script>\n</html>\n';

function fixture(t, html = originalHtml) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'andromeda-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const appBundle = path.join(temp, 'Test IDE.app');
  const appRoot = path.join(appBundle, 'Contents/Resources/app');
  const workbench = path.join(appRoot, 'out/vs/code/electron-browser/workbench');
  fs.mkdirSync(workbench, { recursive: true });
  const htmlFile = path.join(workbench, 'workbench.html');
  const productFile = path.join(appRoot, 'product.json');
  fs.writeFileSync(htmlFile, html);
  fs.writeFileSync(productFile, JSON.stringify({ version: '1', checksums: { [checksumKey]: computeChecksum(html) } }));
  const calls = [];
  const signer = { sign: app => calls.push(['sign', app]), verify: app => calls.push(['verify', app]) };
  return { appBundle, htmlFile, productFile, workbench, calls, signer };
}

function checkChecksum(f) {
  assert.equal(JSON.parse(fs.readFileSync(f.productFile)).checksums[checksumKey], computeChecksum(fs.readFileSync(f.htmlFile)));
}

test('static installation is idempotent and a CSS-only update is signed', t => {
  const f = fixture(t);
  const result = patchApp(f);
  assert.equal(result.mode, 'static');
  assert.deepEqual(f.calls.map(c => c[0]), ['sign', 'verify']);
  assert.equal(fs.existsSync(path.join(f.workbench, 'cosmic-andromeda-motion.js')), false);
  checkChecksum(f);
  const stamp = fs.statSync(f.htmlFile).mtimeMs;
  assert.deepEqual(patchApp(f).changed, []);
  assert.equal(fs.statSync(f.htmlFile).mtimeMs, stamp);
  assert.deepEqual(f.calls.map(c => c[0]), ['sign', 'verify', 'verify']);
  fs.appendFileSync(path.join(f.workbench, 'cosmic-andromeda.css'), '\n/* outdated */');
  const update = patchApp(f);
  assert.deepEqual(update.changed, [path.join(f.workbench, 'cosmic-andromeda.css')]);
  assert.deepEqual(f.calls.slice(-2).map(c => c[0]), ['sign', 'verify']);
});

test('animated mode adds a deferred script once and static mode removes it', t => {
  const f = fixture(t);
  patchApp({ ...f, animated: true });
  assert.match(fs.readFileSync(f.htmlFile, 'utf8'), /<script defer src="\.\/cosmic-andromeda-motion.js"><\/script>/);
  assert.equal(fs.existsSync(path.join(f.workbench, 'cosmic-andromeda-motion.js')), true);
  assert.deepEqual(patchApp({ ...f, animated: true }).changed, []);
  patchApp(f);
  assert.doesNotMatch(fs.readFileSync(f.htmlFile, 'utf8'), /cosmic-andromeda-motion/);
  assert.equal(fs.existsSync(path.join(f.workbench, 'cosmic-andromeda-motion.js')), false);
  checkChecksum(f);
});

test('terminal overlay is opt-in, idempotent, and removed by docking or restoring', t => {
  const f = fixture(t);
  patchApp({ ...f, terminalOverlay: true });
  const script = path.join(f.workbench, 'cosmic-terminal-overlay.js');
  assert.equal(fs.existsSync(script), true);
  assert.match(fs.readFileSync(f.htmlFile, 'utf8'), /defer src="\.\/cosmic-terminal-overlay.js"/);
  assert.deepEqual(patchApp({ ...f, terminalOverlay: true }).changed, []);
  checkChecksum(f);
  patchApp(f);
  assert.equal(fs.existsSync(script), false);
  assert.doesNotMatch(fs.readFileSync(f.htmlFile, 'utf8'), /cosmic-terminal-overlay/);
  patchApp({ ...f, terminalOverlay: true, animated: true });
  patchApp({ ...f, restore: true });
  assert.equal(fs.readFileSync(f.htmlFile, 'utf8'), originalHtml);
  assert.equal(fs.existsSync(script), false);
  checkChecksum(f);
});

test('migrates the old stylesheet link without duplicates', t => {
  const legacy = originalHtml.replace('</head>', '\t<!-- Cosmic Andromeda Stylesheet -->\n\t<link rel="stylesheet" href="./cosmic-andromeda.css">\n</head>');
  const f = fixture(t, legacy);
  patchApp(f);
  assert.equal(fs.readFileSync(f.htmlFile, 'utf8').match(/href="\.\/cosmic-andromeda.css"/g).length, 1);
  patchApp({ ...f, restore: true });
  assert.equal(fs.readFileSync(f.htmlFile, 'utf8'), originalHtml);
});

test('restore preserves newer IDE data and ignores stale backups', t => {
  const f = fixture(t);
  patchApp({ ...f, animated: true });
  fs.writeFileSync(f.htmlFile + '.bak', 'obsolete HTML');
  fs.writeFileSync(f.productFile + '.bak', '{"version":"obsolete"}');
  fs.writeFileSync(f.htmlFile, fs.readFileSync(f.htmlFile, 'utf8').replace('<body>', '<body data-updated="yes">'));
  const product = JSON.parse(fs.readFileSync(f.productFile));
  product.version = '2';
  product.unrelated = 'keep';
  fs.writeFileSync(f.productFile, JSON.stringify(product));
  patchApp({ ...f, restore: true });
  assert.equal(fs.readFileSync(f.htmlFile, 'utf8'), originalHtml.replace('<body>', '<body data-updated="yes">'));
  assert.equal(JSON.parse(fs.readFileSync(f.productFile)).version, '2');
  assert.equal(JSON.parse(fs.readFileSync(f.productFile)).unrelated, 'keep');
  for (const name of ['cosmic-andromeda.css', 'cosmic-stars.svg', 'cosmic-andromeda-motion.js']) {
    assert.equal(fs.existsSync(path.join(f.workbench, name)), false);
  }
  checkChecksum(f);
  assert.deepEqual(patchApp({ ...f, restore: true }).changed, []);
});

for (const stage of ['sign', 'verify']) {
  test(`a ${stage} failure is reported and file changes are rolled back`, t => {
    const f = fixture(t);
    const originalProduct = fs.readFileSync(f.productFile);
    const signer = { sign() {}, verify() {} };
    signer[stage] = () => { throw new Error(`${stage} failed`); };
    assert.throws(() => patchApp({ ...f, signer }), new RegExp(`${stage} failed`));
    assert.equal(fs.readFileSync(f.htmlFile, 'utf8'), originalHtml);
    assert.deepEqual(fs.readFileSync(f.productFile), originalProduct);
    assert.deepEqual(fs.readdirSync(f.workbench), ['workbench.html']);
  });
}

test('unsupported HTML or missing checksums fail before modifying files', t => {
  const f = fixture(t, '<html><body></body></html>');
  assert.throws(() => patchApp(f), /head/);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(fs.readdirSync(f.workbench), ['workbench.html']);
  fs.writeFileSync(f.htmlFile, originalHtml);
  fs.writeFileSync(f.productFile, '{}');
  assert.throws(() => patchApp(f), /checksum/);
  assert.equal(fs.readFileSync(f.htmlFile, 'utf8'), originalHtml);
});

test('CRLF HTML is preserved through install and restore', t => {
  const html = originalHtml.replaceAll('\n', '\r\n');
  const f = fixture(t, html);
  patchApp(f);
  assert.deepEqual(patchApp(f).changed, []);
  patchApp({ ...f, restore: true });
  assert.equal(fs.readFileSync(f.htmlFile, 'utf8'), html);
});

test('read-only directories are detected before any installation writes', t => {
  const f = fixture(t);
  fs.chmodSync(f.workbench, 0o555);
  try {
    assert.throws(() => patchApp(f), /No se puede escribir/);
    assert.equal(fs.readFileSync(f.htmlFile, 'utf8'), originalHtml);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(fs.readdirSync(f.workbench), ['workbench.html']);
  } finally {
    fs.chmodSync(f.workbench, 0o755);
  }
});
