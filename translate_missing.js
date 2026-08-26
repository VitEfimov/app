const fs = require('fs');
const path = require('path');
const https = require('https');

const localesDir = path.join(__dirname, 'src', 'locales');
const enFilePath = path.join(localesDir, 'en.json');

function translate(text, targetLang) {
  return new Promise((resolve, reject) => {
    if (targetLang === 'en') return resolve(text);
    
    // Minor lang mapping
    if (targetLang === 'zh') targetLang = 'zh-CN';
    
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json[0][0][0] || text);
        } catch (e) {
          resolve(text); // fallback to English on error
        }
      });
    }).on('error', (e) => {
      resolve(text);
    });
  });
}

async function run() {
  const enData = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
  const enKeys = Object.keys(enData);
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');
  
  for (const file of files) {
    const filePath = path.join(localesDir, file);
    const lang = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let updated = false;
    for (const key of enKeys) {
      if (!data[key]) {
        console.log(`Translating '${key}' to ${lang}...`);
        const translated = await translate(enData[key] || key, lang);
        data[key] = translated;
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Updated ${file}`);
    }
  }
  console.log('All translations up to date!');
}

run().catch(console.error);
