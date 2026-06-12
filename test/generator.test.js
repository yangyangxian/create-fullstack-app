import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { generateProject, toPackageName } from '../src/index.js';

const execFileAsync = promisify(execFile);
const playgroundScript = fileURLToPath(new URL('../scripts/playground.js', import.meta.url));

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

test('generates a Hono project with the expected workspace layout', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'create-fullstack-app-hono-'));
  const target = path.join(root, 'demo-hono');

  await generateProject(target, {
    projectName: 'demo-hono',
    backend: 'hono',
  });

  const rootPackage = await readJson(path.join(target, 'package.json'));
  const apiPackage = await readJson(path.join(target, 'apps/api/package.json'));
  const apiTsconfig = await readJson(path.join(target, 'apps/api/tsconfig.json'));
  const apiSource = await fs.readFile(path.join(target, 'apps/api/src/index.ts'), 'utf8');
  const webPackage = await readJson(path.join(target, 'apps/web/package.json'));

  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
  assert.equal(rootPackage.engines.node, '>=22.12.0');
  assert.equal(apiPackage.dependencies.hono, '^4.12.24');
  assert.deepEqual(apiTsconfig.compilerOptions.types, ['node']);
  assert.match(apiSource, /new Hono\(\)/);
  assert.equal(webPackage.dependencies['react-router-dom'], '^7.17.0');
  assert.equal(webPackage.devDependencies.vite, '^8.0.16');
});

test('generates an Express project with the expected backend scaffold', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'create-fullstack-app-express-'));
  const target = path.join(root, 'demo-express');

  await generateProject(target, {
    projectName: 'demo-express',
    backend: 'express',
  });

  const apiPackage = await readJson(path.join(target, 'apps/api/package.json'));
  const apiSource = await fs.readFile(path.join(target, 'apps/api/src/index.ts'), 'utf8');
  const contractsSource = await fs.readFile(path.join(target, 'packages/contracts/src/index.ts'), 'utf8');

  assert.equal(apiPackage.dependencies.express, '^5.2.1');
  assert.match(apiSource, /express\(\)/);
  assert.match(apiSource, /app\.get\(\/\.\*\//);
  assert.match(apiSource, /backend: 'express'/);
  assert.match(contractsSource, /export type BackendKind = 'express'/);
});

test('sanitizes package names without pathological regex backtracking', () => {
  assert.equal(toPackageName('---My   App---Name___'), 'my-app-name___');
  assert.equal(toPackageName('@@@'), '');
});

test('playground helper regenerates a fixed target directory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'create-fullstack-app-playground-'));
  const target = path.join(root, 'playground-app');

  await execFileAsync(process.execPath, [playgroundScript, 'generate', '--target-dir', target]);
  await fs.writeFile(path.join(target, 'marker.txt'), 'temp', 'utf8');

  await execFileAsync(process.execPath, [
    playgroundScript,
    'generate',
    '--target-dir',
    target,
    '--backend',
    'express',
  ]);

  await assert.rejects(fs.access(path.join(target, 'marker.txt')));

  const apiPackage = await readJson(path.join(target, 'apps/api/package.json'));
  assert.equal(apiPackage.dependencies.express, '^5.2.1');
});
