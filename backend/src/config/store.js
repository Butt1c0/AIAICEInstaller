const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../data/config.json');

function getConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { environments: [], activeEnvironment: null };
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { getConfig, saveConfig };
