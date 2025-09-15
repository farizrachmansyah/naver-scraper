const express = require('express');
const { scrapeProduct } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/naver', async (req, res) => {
  const productUrl = req.query.productUrl;
  if (!productUrl) {
    return res.status(400).json({ error: 'productUrl is required' });
  }

  try {
    const data = await scrapeProduct(productUrl);
    if (!data) {
      return res.status(500).json({ error: 'Failed to scrape product' });
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
