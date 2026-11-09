const fs = require('fs');
const xml = fs.readFileSync('C:/Users/15717/.gemini/antigravity/brain/b9582c6c-ebd3-4bc4-9b7b-40ec2f81352e/window_dump_swiped.xml', 'utf8');
const regex = /<node[^>]+bounds="([^"]+)"[^>]*>/g;
let match;
while ((match = regex.exec(xml)) !== null) {
  const node = match[0];
  if (node.includes('Snooze') || node.includes('snooze') || node.includes('Delete') || node.includes('More')) {
    console.log('MATCH:', node);
  }
}
