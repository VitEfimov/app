const parser = require('@babel/parser');
const fs = require('fs');
const code = fs.readFileSync('src/components/TaskDetailsModal.js', 'utf8');
try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log('SUCCESS: TaskDetailsModal.js parsed without syntax errors!');
} catch (e) {
  console.error('PARSE ERROR:', e.message);
}
