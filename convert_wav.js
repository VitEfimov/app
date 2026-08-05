const fs = require('fs');
const path = require('path');
const { WaveFile } = require('wavefile');

const audioDir = path.join(__dirname, 'assets', 'audio');

function inspectWav(wav) {
  return {
    bitDepth: wav.bitDepth,
    audioFormat: wav.fmt.audioFormat,
    sampleRate: wav.fmt.sampleRate,
    channels: wav.fmt.numChannels,
    byteRate: wav.fmt.byteRate,
    blockAlign: wav.fmt.blockAlign,
    bitsPerSample: wav.fmt.bitsPerSample,
  };
}

function convertFiles() {
  const files = fs
    .readdirSync(audioDir)
    .filter(file => file.toLowerCase().endsWith('.wav'));

  for (const file of files) {
    const filePath = path.join(audioDir, file);
    const newFile = file.replace('32f', '16');
    const newFilePath = path.join(audioDir, newFile);

    try {
      const input = fs.readFileSync(filePath);
      const wav = new WaveFile(input);

      console.log(`\n${file}`);
      console.log('Before:', inspectWav(wav));

      wav.toBitDepth('16');

      const output = wav.toBuffer();
      
      fs.writeFileSync(newFilePath, output);
      
      if (filePath !== newFilePath) {
        fs.unlinkSync(filePath);
      }

      // Read the written file again to verify the actual output.
      const verifiedWav = new WaveFile(fs.readFileSync(newFilePath));

      console.log('After:', inspectWav(verifiedWav));

      if (
        verifiedWav.bitDepth !== '16' &&
        verifiedWav.fmt.bitsPerSample !== 16
      ) {
        throw new Error('Output was not converted to 16-bit.');
      }

      console.log(`Converted ${file} to ${newFile} successfully.`);
    } catch (error) {
      console.error(`Failed to convert ${file}:`, error);
    }
  }
}

convertFiles();
