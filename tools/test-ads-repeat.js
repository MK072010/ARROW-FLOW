#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const test = path.join(__dirname, 'test-ads.js');
const runs = 6;
for (let i = 1; i <= runs; i++) {
  console.log(`\n===== Ads test run ${i}/${runs} =====`);
  const r = spawnSync(process.execPath, [test], { stdio: 'inherit', env: process.env });
  if (r.error) { console.error(r.error); process.exit(2); }
  if (r.status !== 0) {
    console.error(`Ads test run ${i}/${runs} failed with exit code ${r.status}`);
    process.exit(r.status || 1);
  }
}
console.log(`\nADS TEST PASSED ${runs}/${runs} RUNS`);
