#!/usr/bin/env node
/**
 * Instala/retira únicamente los recursos de Cosmic Andromeda.
 * Prepara todos los cambios antes de escribir, omite contenidos idénticos y
 * verifica la firma incluso cuando no hay cambios. No restaura backups de
 * versiones anteriores del IDE ni modifica la cuarentena de macOS.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CHECKSUM_KEY = 'vs/code/electron-browser/workbench/workbench.html';
const ASSETS = ['cosmic-andromeda.css', 'cosmic-stars.svg', 'cosmic-andromeda-motion.js', 'cosmic-terminal-overlay.js'];
const DEFAULT_APP = '/Applications/Antigravity IDE.app';

export function computeChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('base64').replace(/=+$/, '');
}

function readOptional(file) {
  try { return fs.readFileSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function checkWritableDirectory(directory) {
  // access(W_OK) no equivale a una escritura: no permite que macOS tramite
  // una solicitud de Gestión de aplicaciones. Probar y limpiar un archivo
  // exclusivo comprueba la operación que realmente necesita el instalador.
  const probe = path.join(directory, `.cosmic-andromeda-${crypto.randomUUID()}.probe`);
  let descriptor;
  let created = false;
  let failure;
  try {
    descriptor = fs.openSync(probe, 'wx', 0o600);
    created = true;
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (created) {
      try { fs.unlinkSync(probe); }
      catch (error) { throw new Error(`No se pudo retirar el archivo temporal ${probe} (${error.code}). No se aplicó el parche.`, { cause: error }); }
    }
  }
  if (!failure) return;
  const advice = failure.code === 'EPERM'
    ? [
      'macOS rechazó la escritura. Revisa Ajustes del Sistema → Privacidad y seguridad → Gestión de aplicaciones.',
      'Autoriza la app que ejecuta el comando: Terminal/iTerm, o el IDE si usas su terminal integrada.',
      'Después cierra y vuelve a abrir esa app y repite el comando. Si aparece una solicitud de macOS, elige Permitir.',
    ].join('\n')
    : failure.code === 'EACCES'
      ? 'El usuario actual no tiene acceso de escritura. Revisa el propietario, los permisos y las ACL de esa carpeta.'
      : 'No se pudo completar la prueba de escritura. Revisa el código de error y la ruta indicada.';
  throw new Error(`No se puede escribir en ${directory} (${failure.code}).\n${advice}\nNo se aplicó el parche.`, { cause: failure });
}

function writeAtomic(file, content, mode = 0o644) {
  if (content === null) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { mode, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function removeManagedTags(html) {
  return html
    .replace(/^[\t ]*<!-- Cosmic Andromeda:start -->\r?\n[\s\S]*?<!-- Cosmic Andromeda:end -->[\t ]*(?:\r?\n)?/gm, '')
    .replace(/^[\t ]*<!-- Cosmic Andromeda Stylesheet -->[\t ]*(?:\r?\n)?/gm, '')
    .replace(/[\t ]*<link\b(?=[^>]*\bhref=["']\.\/cosmic-andromeda\.css["'])[^>]*>[\t ]*(?:\r?\n)?/gi, '')
    .replace(/[\t ]*<script\b(?=[^>]*\bsrc=["']\.\/(?:cosmic-andromeda-motion|cosmic-terminal-overlay)\.js["'])[^>]*>\s*<\/script>[\t ]*(?:\r?\n)?/gi, '');
}

const macSigner = {
  sign(appBundle) {
    // Solo cambian recursos: conservar la metadata y las firmas del código anidado.
    execFileSync('/usr/bin/codesign', [
      '--force', '--sign', '-',
      '--preserve-metadata=identifier,entitlements,requirements,flags,runtime', appBundle,
    ], { stdio: 'inherit' });
  },
  verify(appBundle) {
    execFileSync('/usr/bin/codesign', [
      '--verify', '--deep', '--strict', '--verbose=2', appBundle,
    ], { stdio: 'inherit' });
  },
};

export function patchApp({ appBundle = DEFAULT_APP, animated = false, terminalOverlay = false, restore = false, signer = macSigner } = {}) {
  appBundle = path.resolve(appBundle);
  const appRoot = path.join(appBundle, 'Contents/Resources/app');
  const workbench = path.join(appRoot, 'out/vs/code/electron-browser/workbench');
  const htmlFile = path.join(workbench, 'workbench.html');
  const productFile = path.join(appRoot, 'product.json');
  const originalHtml = fs.readFileSync(htmlFile, 'utf8');
  const originalProduct = fs.readFileSync(productFile, 'utf8');
  const product = JSON.parse(originalProduct);
  if (!product.checksums || !Object.hasOwn(product.checksums, CHECKSUM_KEY)) {
    throw new Error(`Falta el checksum esperado en ${productFile}; no se modificó la instalación.`);
  }
  let html = removeManagedTags(originalHtml);
  if (!restore) {
    if (!/<\/head\s*>/i.test(html)) throw new Error('No se encontró </head>; no se modificó la instalación.');
    const newline = html.includes('\r\n') ? '\r\n' : '\n';
    const tags = [
      '\t<!-- Cosmic Andromeda:start -->',
      '\t<link rel="stylesheet" href="./cosmic-andromeda.css">',
      ...(animated ? ['\t<script defer src="./cosmic-andromeda-motion.js"></script>'] : []),
      ...(terminalOverlay ? ['\t<script defer src="./cosmic-terminal-overlay.js"></script>'] : []),
      '\t<!-- Cosmic Andromeda:end -->',
    ].join(newline) + newline;
    html = html.replace(/<\/head\s*>/i, closing => tags + closing);
  }
  const checksum = computeChecksum(html);
  let productText = originalProduct;
  if (product.checksums[CHECKSUM_KEY] !== checksum) {
    product.checksums[CHECKSUM_KEY] = checksum;
    productText = JSON.stringify(product, null, '\t') + '\n';
  }
  // Leer todas las fuentes antes de modificar el bundle.
  const plan = new Map([[htmlFile, Buffer.from(html)], [productFile, Buffer.from(productText)]]);
  for (const asset of ASSETS) {
    const enabled = !restore && (asset !== 'cosmic-andromeda-motion.js' || animated)
      && (asset !== 'cosmic-terminal-overlay.js' || terminalOverlay);
    plan.set(path.join(workbench, asset), enabled ? fs.readFileSync(path.join(SOURCE_DIR, asset)) : null);
  }
  const changes = [];
  for (const [file, content] of plan) {
    const previous = readOptional(file);
    if (previous === null && content === null) continue;
    if (previous !== null && content !== null && previous.equals(content)) continue;
    changes.push({ file, content, previous, mode: previous === null ? 0o644 : fs.statSync(file).mode & 0o777 });
  }
  // macOS puede impedir modificar aplicaciones aun cuando pertenezcan al usuario.
  // Comprobar todos los directorios antes de modificar los archivos del IDE.
  for (const directory of new Set(changes.map(change => path.dirname(change.file)))) {
    checkWritableDirectory(directory);
  }
  const written = [];
  let signatureTouched = false;
  try {
    for (const change of changes) {
      writeAtomic(change.file, change.content, change.mode);
      written.push(change);
    }
    // Incluye modificaciones solo de CSS/SVG/JS, aunque el HTML no cambie.
    if (changes.length) {
      signatureTouched = true;
      signer.sign(appBundle);
    }
    signer.verify(appBundle);
  } catch (error) {
    const rollbackErrors = [];
    for (const change of written.reverse()) {
      try { writeAtomic(change.file, change.previous, change.mode); }
      catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
    }
    const details = rollbackErrors.length ? ` Reversión incompleta: ${rollbackErrors.join('; ')}` : ' Se revirtieron los cambios de archivos de esta ejecución.';
    const signatureDetails = signatureTouched ? ' Revisa la firma del bundle antes de abrir el IDE.' : '';
    throw new Error(`${error.message}.${details}${signatureDetails}`, { cause: error });
  }
  return { changed: changes.map(change => change.file), mode: restore ? 'restored' : animated ? 'animated' : 'static', terminalOverlay: !restore && terminalOverlay };
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--restore') options.restore = true;
    else if (arg === '--animated') options.animated = true;
    else if (arg === '--terminal-overlay') options.terminalOverlay = true;
    else if (arg === '--app') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--app requiere una ruta de aplicación.');
      options.appBundle = args[++i];
    } else if (arg === '--help') return null;
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  if (options.restore && (options.animated || options.terminalOverlay)) throw new Error('--restore no se combina con --animated o --terminal-overlay.');
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options === null) {
      console.log('Uso: node scripts/patch-neon.mjs [--animated] [--terminal-overlay] [--restore] [--app "/Applications/Antigravity IDE.app"]');
    } else {
      if (process.platform !== 'darwin') throw new Error('La instalación y firma requieren macOS.');
      const result = patchApp(options);
      console.log(`[Cosmic Andromeda] ${result.mode}: ${result.changed.length} archivo(s) modificado(s); firma verificada.`);
      if (result.terminalOverlay) console.log('[Terminal] Superposición sobre el editor habilitada.');
      console.log('Ejecuta "Developer: Reload Window" en el IDE para cargar los cambios.');
    }
  } catch (error) {
    console.error(`[Cosmic Andromeda] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
