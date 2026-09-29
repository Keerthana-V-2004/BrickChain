const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const artifactsDir = path.join(root, 'artifacts', 'contracts');
const destDir = path.join(root, 'frontend', 'abis');

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const filesToCopy = [
  { src: path.join(artifactsDir, 'RealEstate.sol', 'RealEstate.json'), dest: path.join(destDir, 'RealEstate.json') },
  { src: path.join(artifactsDir, 'Escrow.sol', 'Escrow.json'), dest: path.join(destDir, 'Escrow.json') },
];

filesToCopy.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
  } else {
    console.warn(`Missing ABI: ${src}`);
  }
});
