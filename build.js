import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const files = [
  'platforms/platforms.js',
  'content/metadata.js',
  'content/content.js'
];

mkdirSync('dist', { recursive: true });

let output = '// SelectShare - auto-generated bundle\n';
output += '(function() {\n';

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  // Strip ES module syntax (export/import) for browser bundle
  content = content.replace(/^export\s+/gm, '');
  content = content.replace(/^import\s+.*;\s*$/gm, '');
  output += `\n// --- ${file} ---\n`;
  output += content;
}

output += '\n})();\n';
writeFileSync('dist/selectshare.js', output);
console.log('Built dist/selectshare.js');
