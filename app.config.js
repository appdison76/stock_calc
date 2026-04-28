/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {
  // dotenv optional
}

const appJson = require('./app.json');

const expo = {
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    dartApiKey: process.env.DART_API_KEY || '',
  },
};

module.exports = { expo };
