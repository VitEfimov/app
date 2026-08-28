const fs = require('fs');
const path = require('path');
const https = require('https');

const localesDir = path.join(__dirname, 'src', 'locales');
const enFilePath = path.join(localesDir, 'en.json');

function translate(text, targetLang) {
  return new Promise((resolve) => {
    if (targetLang === 'en') return resolve(text);
    
    if (targetLang === 'zh') targetLang = 'zh-CN';
    
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json[0] && Array.isArray(json[0])) {
            const fullTranslated = json[0].map(item => item[0]).filter(Boolean).join('');
            resolve(fullTranslated || text);
          } else {
            resolve(text);
          }
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => {
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
      const currentVal = data[key];
      const enVal = enData[key] || key;
      
      const needsTranslation = !currentVal || (currentVal === key && lang !== 'en' && key !== 'PIN');
      
      if (needsTranslation) {
        console.log(`Translating '${key}' to ${lang}...`);
        const translated = await translate(enVal, lang);
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
