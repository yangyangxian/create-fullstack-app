#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { generateProject } from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TARGET_DIR = path.join(REPO_ROOT, 'playground');
const DEFAULT_BACKEND = 'hono';
const VALID_COMMANDS = new Set(['generate', 'install', 'dev']);

function parseArgs(argv) {
  const [maybeCommand, ...rest] = argv;
  const command = VALID_COMMANDS.has(maybeCommand) ? maybeCommand : 'generate';
  const tokens = VALID_COMMANDS.has(maybeCommand) ? rest : argv;
  const options = {
    command,
    backend: DEFAULT_BACKEND,
    targetDir: DEFAULT_TARGET_DIR,
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--backend' || token === '-b') {
      options.backend = tokens[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--backend=')) {
      options.backend = token.slice('--backend='.length);
      continue;
    }

    if (token === '--target-dir' || token === '-t') {
      options.targetDir = tokens[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--target-dir=')) {
      options.targetDir = token.slice('--target-dir='.length);
      continue;
    }
  }

  return options;
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runCommand(args, cwd) {
  const result = spawnSync(npmCommand(), args, {
    cwd,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function generatePlayground({ backend, targetDir }) {
  const resolvedTargetDir = path.resolve(targetDir);
  fs.rmSync(resolvedTargetDir, { recursive: true, force: true });
  generateProject(resolvedTargetDir, {
    projectName: path.basename(resolvedTargetDir),
    backend,
  });

  return resolvedTargetDir;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const targetDir = generatePlayground(options);

  process.stdout.write(`Generated ${targetDir} with ${options.backend}.\n`);

  if (options.command === 'generate') {
    return;
  }

  runCommand(['install'], targetDir);

  if (options.command === 'install') {
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(npmCommand(), ['run', 'dev'], {
      cwd: targetDir,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Playground dev server exited with code ${code ?? 1}.`));
    });
    child.on('error', reject);
  });
}

run().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
