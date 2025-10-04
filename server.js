const express = require('express');
const axios = require('axios');

// Build Jimp with plugins
const jimp = require('@jimp/custom');
const jimpTypes = require('@jimp/types');
const jimpPrint = require('@jimp/plugin-print');

const Jimp = jimp({
  types: [jimpTypes],
  plugins: [jimpPrint]
});

const app = express();
const PORT = process.env.PORT || 3000;

// Helper: download image into Jimp via axios
async function loadImageFromUrl(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return await Jimp.read(Buffer.from(response.data));
}

app.get('/welcome', async (req, res) => {
  try {
    const backgroundUrl = req.query.background;
    const avatarUrl = req.query.avatar || req.query.user_avatar;
    const username = req.query.username || 'Unknown User';

    if (!backgroundUrl || !avatarUrl) {
      return res.status(400).json({ error: 'Missing required query params: background and avatar.' });
    }

    const bg = await loadImageFromUrl(backgroundUrl);
    const avatar = await loadImageFromUrl(avatarUrl);

    const WIDTH = 800;
    const HEIGHT = 300;

    bg.cover(WIDTH, HEIGHT);

    const base = new Jimp(WIDTH, HEIGHT);
    base.composite(bg, 0, 0);

    // Load plugin fonts
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

    base.print(font, 20, 20, username);

    const buffer = await base.getBufferAsync(Jimp.MIME_PNG);
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate welcome card', details: String(err.message || err) });
  }
});

// Export for Vercel
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));
}
