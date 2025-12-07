const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const srcWorker = path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.js');
const destWorker = path.join(publicDir, 'pdf.worker.js');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
  console.log('Created public directory');
}

fs.copyFileSync(srcWorker, destWorker);
console.log('Copied pdf.worker.js to public folder');
