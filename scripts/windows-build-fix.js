#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Windows Build Fix Script');
console.log('=======================');

// 1. Clear Next.js cache
const nextDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextDir)) {
  console.log('Clearing .next cache...');
  fs.rmSync(nextDir, { recursive: true, force: true });
}

// 2. Clear main build directory
const mainDir = path.join(process.cwd(), 'main');
if (fs.existsSync(mainDir)) {
  console.log('Clearing main build directory...');
  fs.rmSync(mainDir, { recursive: true, force: true });
}

// 3. Clear out directory
const outDir = path.join(process.cwd(), 'out');
if (fs.existsSync(outDir)) {
  console.log('Clearing out directory...');
  fs.rmSync(outDir, { recursive: true, force: true });
}

console.log('✓ Cleanup completed');
console.log('Next steps:');
console.log('1. Run: npm run build');
console.log('2. Run: npm run make');