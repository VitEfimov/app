const fs = require('fs');
const path = require('path');
const { WaveFile } = require('wavefile');

const audioDir = path.join(__dirname, 'assets', 'audio');

async function convertFiles() {
  const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.wav'));
  
  for (const file of files) {
    const filePath = path.join(audioDir, file);
    try {
      const buffer = fs.readFileSync(filePath);
      let wav = new WaveFile(buffer);
      
      console.log(`Converting ${file}... Current bit depth: ${wav.bitDepth}`);
      
      // Convert to 16-bit
      wav.toBitDepth('16');
      
      fs.writeFileSync(filePath, wav.toBuffer());
      console.log(`Successfully converted ${file} to 16-bit PCM.`);
    } catch (err) {
      console.error(`Error converting ${file}:`, err);
    }
  }
}

convertFiles();
