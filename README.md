# Naver Scraper

This project challenge is to build a scalable and undetectable API that scrapes product detail data from smartstore.naver.com. The scraper must retrieve JSON data from the page’s global variable **PRELOADED_STATE**.

---

## 📦 Setup Instructions

1. **Clone the repository**

   ```bash
   git clone naver-scraper
   cd naver-scraper
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Proxy**

   Create a `.env` file in the project root:

   ```bash
   PROXY=host:port:user:pass
   ```

---

## ▶️ Run / Test Instructions

1. **Start the API server**

   ```bash
   npm run dev
   ```

   This runs the Express server with `nodemon` at `http://localhost:3000`.

2. **Make a test request** (example product):

   ```bash
   curl "http://localhost:3000/naver?productUrl=https://smartstore.naver.com/rainbows9030/products/11102379008"
   ```

3. **Output**
   - On success: returns the parsed `__PRELOADED_STATE__` JSON.
   - On failure: returns an error object with optional debug screenshot for inspection.

---

## 🔍 Scraper Explanation

The scraper (`src/scraper.js`) implements several strategies:

- **Raw JSON extraction**

  - Attempts to directly read `window.__PRELOADED_STATE__`.
  - Falls back to scanning `<script>` tags for embedded JSON.

- **Evasion strategies**

  - Uses [`puppeteer-extra-plugin-stealth`](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth).
  - Randomized User-Agents and viewport sizes.
  - Fakes WebGL vendor strings, navigator properties, plugins, languages, and time zone (`Asia/Seoul`).
  - Human-like interactions (mouse movement, scrolls, random delays).

- **Proxy usage**

  - Handles authenticated proxies with `page.authenticate()`.

- **Throttling & retries**

  - [`bottleneck`](https://www.npmjs.com/package/bottleneck) ensures request rate-limiting.
  - Each scrape has retry attempts with exponential backoff.

- **Debug artifacts**
  - On error, the scraper saves a screenshot (`*_block.png`) for diagnosis.

---

## 💡 Example API Usage

**Request:**

```bash
curl "http://localhost:3000/naver?productUrl=https://smartstore.naver.com/rainbows9030/products/11102379008"
```
