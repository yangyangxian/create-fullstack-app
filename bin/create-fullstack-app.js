#!/usr/bin/env node

const { runCli } = require('../src/index');

runCli().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
