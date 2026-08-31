const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.tsx?$/.test(f)) {
      let c = fs.readFileSync(p, 'utf8');
      const n = c
        .replaceAll('#42A5F5', '#E53935')
        .replaceAll('rgba(66, 165, 245', 'rgba(229, 57, 53');
      if (n !== c) {
        fs.writeFileSync(p, n, 'utf8');
        console.log(p);
      }
    }
  }
}

walk(path.join(__dirname, '../app'));
walk(path.join(__dirname, '../src'));
