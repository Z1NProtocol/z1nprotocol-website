#!/usr/bin/env node
// Submit sitemap URLs to IndexNow. The key file is public: <32 hex>.txt at the site root.
// https://www.indexnow.org/documentation

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const host = 'www.z1nprotocol.xyz';
const endpoint = 'https://api.indexnow.org/indexnow';

const keyName = readdirSync(root).find((name) => /^[0-9a-f]{32}\.txt$/.test(name));
if (!keyName) {
  console.error('No IndexNow key file (<32 hex chars>.txt) at the site root.');
  process.exit(1);
}

const key = readFileSync(join(root, keyName), 'utf8').trim();
if (key !== keyName.slice(0, -4)) {
  console.error(`Key file ${keyName} does not contain its own filename key.`);
  process.exit(1);
}

const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]);
if (urlList.length === 0) {
  console.error('sitemap.xml has no <loc> entries.');
  process.exit(1);
}

const body = {
  host,
  key,
  keyLocation: `https://${host}/${keyName}`,
  urlList,
};

if (process.env.INDEXNOW_DRY_RUN === '1') {
  console.log(JSON.stringify({ dryRun: true, keyLocation: body.keyLocation, urlCount: urlList.length, urlList }, null, 2));
  process.exit(0);
}

const delaysMs = [0, 20000, 40000, 60000];
let lastStatus = 0;
let lastText = '';

for (let attempt = 0; attempt < delaysMs.length; attempt++) {
  if (delaysMs[attempt] > 0) {
    console.log(`Retrying in ${delaysMs[attempt] / 1000}s (deploy may still be publishing the key file).`);
    await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  lastStatus = response.status;
  lastText = (await response.text()).trim();
  console.log(`IndexNow ${lastStatus} for ${urlList.length} URLs (${body.keyLocation})${lastText ? `: ${lastText}` : ''}`);

  if (lastStatus === 200 || lastStatus === 202) process.exit(0);
  if (lastStatus !== 403 && lastStatus !== 422 && lastStatus !== 429) break;
}

process.exit(1);
