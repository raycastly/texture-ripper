const fs = require('fs');
const pkg = require('../package.json');

// Update version.json
fs.writeFileSync('version.json', JSON.stringify({version: pkg.version}, null, 2));
console.log('✓ Updated version.json to version:', pkg.version);