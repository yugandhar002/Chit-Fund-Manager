const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git') && !file.includes('.expo')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'app'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Remove const db = await getDatabase();
  content = content.replace(/[ \t]*const db = await getDatabase\(\);\r?\n/g, '');
  
  // 2. Remove getDatabase from imports
  content = content.replace(/getDatabase,\s*/g, '');
  content = content.replace(/,\s*getDatabase/g, '');
  content = content.replace(/import { getDatabase } from '.*';\r?\n/g, '');

  // 3. Remove (db) from Repository calls
  content = content.replace(/(new \w+Repository)\(db\)/g, '$1()');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
