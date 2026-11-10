#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPkg = join(root, 'packages/contracts');
const dest = join(root, 'functions/vendor/contracts');

const distDir = join(srcPkg, 'dist');
const tscCandidates = [
  join(root, 'node_modules/typescript/bin/tsc'),
  join(root, 'node_modules/.bin/tsc'),
  join(srcPkg, 'node_modules/typescript/bin/tsc'),
  join(srcPkg, 'node_modules/.bin/tsc'),
];
const tsc = tscCandidates.find((p) => {
  try {
    return !!readFileSync(p);
  } catch {
    return false;
  }
});

if (tsc) {
  execSync(`"${tsc}" -p tsconfig.json`, {
    cwd: srcPkg,
    stdio: 'inherit',
  });
} else {
  try {
    readFileSync(join(distDir, 'index.js'));
    console.warn('tsc not found; reusing existing packages/contracts/dist');
  } catch {
    throw new Error('Cannot vendor @lux/contracts: tsc missing and dist/ absent. Run npm install at repo root.');
  }
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(distDir, join(dest, 'dist'), { recursive: true });

const pkg = JSON.parse(readFileSync(join(srcPkg, 'package.json'), 'utf8'));
writeFileSync(
  join(dest, 'package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      main: pkg.main,
      types: pkg.types,
      exports: pkg.exports,
      dependencies: { zod: pkg.dependencies?.zod ?? '^3.24.2' },
    },
    null,
    2,
  ),
);

console.log(`Vendored ${pkg.name} -> functions/vendor/contracts`);
