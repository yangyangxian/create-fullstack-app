#!/usr/bin/env node

import { runCli } from '../src/index.js';

runCli().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
