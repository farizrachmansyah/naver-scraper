// src/scraper.js
// Naver scraper with single proxy, stealth evasion, retries, throttling, and screenshot debug only
require('dotenv').config();

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Bottleneck = require('bottleneck');

puppeteer.use(StealthPlugin());

const PROXY = process.env.PROXY;

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

const limiter = new Bottleneck({ maxConcurrent: 2, minTime: 900 });

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Parse single proxy into object
function parseProxy(raw) {
  const parts = raw.split(':');
  if (parts.length >= 4) {
    return { host: parts[0], port: parts[1], user: parts[2], pass: parts[3] };
  }
  if (parts.length === 2) return { host: parts[0], port: parts[1] };
  return null;
}
const parsedProxy = parseProxy(PROXY);

async function scrapeProduct(url) {
  return limiter.schedule(() => _scrapeWithRetries(url, 2));
}

async function _scrapeWithRetries(url, retries) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
      return await _scrape(url, attempt);
    } catch (err) {
      lastErr = err;
      console.warn(`[scrape] attempt ${attempt} failed: ${err.message}`);
    }
  }
  throw lastErr;
}

async function _scrape(url, attemptNum = 0) {
  if (!url || typeof url !== 'string') throw new Error('invalid url');

  const ua = UAS[Math.floor(Math.random() * UAS.length)];
  const viewport = { width: 1200 + randInt(0, 200), height: 800 + randInt(0, 200) };

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--lang=ko-KR,ko'
  ];
  if (parsedProxy && parsedProxy.host && parsedProxy.port) {
    launchArgs.push(`--proxy-server=${parsedProxy.host}:${parsedProxy.port}`);
  }

  const browser = await puppeteer.launch({ headless: false, args: launchArgs, defaultViewport: null });
  const debugPrefix = `debug_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  try {
    const page = await browser.newPage();

    // Proxy auth
    if (parsedProxy && parsedProxy.user) {
      try {
        await page.authenticate({ username: parsedProxy.user, password: parsedProxy.pass });
      } catch (e) {
        console.warn('page.authenticate failed', e.message);
      }
    }

    // Headers & UA
    await page.setUserAgent(ua);
    await page.setViewport(viewport);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    // Manual stealth tweaks
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US'] });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [{ name: 'Chrome PDF Plugin' }, { name: 'Chrome PDF Viewer' }]
      });
      const orig = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function () {
        const obj = orig.call(this);
        obj.timeZone = 'Asia/Seoul';
        return obj;
      };
    });

    // Random delay before nav
    await new Promise((r) => setTimeout(r, randInt(800, 2200)));

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});

    await new Promise((r) => setTimeout(r, randInt(1500, 4000)));

    // Try direct extraction
    let state = await page.evaluate(() => window.__PRELOADED_STATE__ || null);

    if (!state) {
      const scriptText = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const s of scripts) {
          if (s.textContent && s.textContent.includes('__PRELOADED_STATE__')) return s.textContent;
        }
        return null;
      });

      if (scriptText) {
        const m = scriptText.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*;?/);
        if (m && m[1]) {
          try {
            state = JSON.parse(m[1]);
          } catch {
            return { error: 'JSON_PARSE_FAILED' };
          }
        } else {
          return { error: 'SCRIPT_FOUND_BUT_NO_MATCH' };
        }
      } else {
        // Blocked → screenshot only
        const snap = `${debugPrefix}_block.png`;
        try {
          await page.screenshot({ path: snap, fullPage: true });
        } catch {}
        return { error: 'BLOCK_OR_ERROR_PAGE', title: await page.title(), screenshot: snap };
      }
    }

    await new Promise((r) => setTimeout(r, randInt(200, 800)));

    return state || null;
  } catch (err) {
    try {
      const snap = `err_${debugPrefix}.png`;
      await page.screenshot({ path: snap, fullPage: true });
    } catch {}
    throw err;
  } finally {
    try {
      await browser.close();
    } catch {}
  }
}

module.exports = { scrapeProduct };
