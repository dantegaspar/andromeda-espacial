import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVSIX } from '@vscode/vsce';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'dist', `${manifest.name}-${manifest.version}.vsix`);
fs.mkdirSync(path.dirname(output), { recursive: true });
await createVSIX({ cwd: root, packagePath: output, dependencies: false, githubBranch: 'main' });
console.log(output);
