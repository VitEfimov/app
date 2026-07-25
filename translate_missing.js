const fs = require('fs');
const path = require('path');
const https = require('https');

const localesDir = path.join(__dirname, 'src', 'locales');
const enFilePath = path.join(localesDir, 'en.json');

const missingStrings = [
  "Customize theme",
  "Task Automations",
  "Accent Color",
  "Increase when overdue",
  "Delete overdue after",
  "Morning reminder",
  "Evening reminder",
  "Summary",
  "Never",
  "3 days",
  "7 days",
  "30 days",
  "When overdue",
  "Frequency",
  "Next Workday"
];

function translate(text, targetLang) {
  return new Promise((resolve, reject) => {
    if (targetLang === 'en') return resolve(text);
    
    // Some minor lang mapping
    if (targetLang === 'zh') targetLang = 'zh-CN';
    
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json[0][0][0]);
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
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(localesDir, file);
    const lang = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let updated = false;
    for (const str of missingStrings) {
      if (!data[str]) {
        console.log(`Translating '${str}' to ${lang}...`);
        const translated = await translate(str, lang);
        data[str] = translated;
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Updated ${file}`);
    }
  }
}

run().catch(console.error);
