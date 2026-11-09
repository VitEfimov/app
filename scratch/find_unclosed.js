const fs = require('fs');
const code = fs.readFileSync('src/components/TaskDetailsModal.js', 'utf8');
const lines = code.split('\n');
const startLine = 1300;
const stack = [];
for (let i = startLine; i < 2315; i++) {
  const line = lines[i];
  const tags = line.match(/<\/?([A-Za-z0-9_]+)[^>]*\/?>/g) || [];
  for (const tag of tags) {
    if (tag.endsWith('/>')) continue;
    if (tag.startsWith('</')) {
      const name = tag.slice(2, -1);
      const popped = stack.pop();
      if (popped?.name !== name) {
        console.log(`Mismatch on line ${i+1}: expected </${popped?.name}> (from line ${popped?.line}), got </${name}>`);
      }
    } else {
      const m = tag.match(/<([A-Za-z0-9_]+)/);
      if (m) {
        stack.push({ name: m[1], line: i + 1 });
      }
    }
  }
}
console.log('Remaining unclosed tags in stack:');
console.log(stack);
