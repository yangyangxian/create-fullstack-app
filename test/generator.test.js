const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { generateProject, toPackageName } = require('../src/index');

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
  const apiSource = await fs.readFile(path.join(target, 'apps/api/src/index.ts'), 'utf8');
  const webPackage = await readJson(path.join(target, 'apps/web/package.json'));

  assert.deepEqual(rootPackage.workspaces, ['apps/*', 'packages/*']);
  assert.equal(apiPackage.dependencies.hono, '^4.6.15');
  assert.match(apiSource, /new Hono\(\)/);
  assert.equal(webPackage.dependencies['react-router-dom'], '^6.30.1');
  assert.equal(webPackage.devDependencies.vite, '^5.4.11');
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

  assert.equal(apiPackage.dependencies.express, '^4.21.2');
  assert.match(apiSource, /express\(\)/);
  assert.match(apiSource, /backend: 'express'/);
  assert.match(contractsSource, /export type BackendKind = 'express'/);
});

test('sanitizes package names without pathological regex backtracking', () => {
  assert.equal(toPackageName('---My   App---Name___'), 'my-app-name___');
  assert.equal(toPackageName('@@@'), '');
});
