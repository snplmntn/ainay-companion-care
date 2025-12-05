/**
 * Post-build script to copy netlify.toml to dist folder
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcFile = join(rootDir, 'netlify.toml');
const destDir = join(rootDir, 'dist');
const destFile = join(destDir, 'netlify.toml');

// Ensure dist directory exists
if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

// Copy the file
try {
  copyFileSync(srcFile, destFile);
  console.log('✓ Copied netlify.toml to dist/');
} catch (error) {
  console.error('✗ Failed to copy netlify.toml:', error.message);
  process.exit(1);
}

