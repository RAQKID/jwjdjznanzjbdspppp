const express = require('express');
const axios = require('axios');

// ---- Jimp custom build ----
const configure = require('@jimp/custom');
const Jimp = configure({
  plugins: [require('@jimp/plugin-print')],
  types: [require('@jimp/types')]
});

const app = express();
const PORT = process.env.PORT || 3000;

// Helper: download image into Jimp via axios
async function loadImageFromUrl(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return await Jimp.read(Buffer.from(response.data));
}

// Create a circular mask Jimp image (opaque white circle, transparent outside)
function createCircleMask(size) {
  const mask = new Jimp(size, size, 0x00000000); // transparent
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        mask.setPixelColor(0xffffffff, x, y); // solid white
      }
    }
  }
  return mask;
}

// Wrap text to prevent overflowing
function wrapText(text, maxCharsPerLine = 40) {
  if (!text) return '';
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxCharsPerLine) {
      cur = (cur + ' ' + w).trim();
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}

app.get('/welcome', async (req, res) => {
  try {
    const backgroundUrl = req.query.background || req.query.bg;
    const avatarUrl = req.query['user avatar'] || req.query.user_avatar || req.query.avatar;
    const username = req.query.username || 'Unknown User';
    const serverName = req.query.server || 'Server';
    const descriptionRaw = req.query.description || '';
    const borderColorParam = req.query.borderColor || '#1E90FF';

    if (!backgroundUrl || !avatarUrl) {
      return res.status(400).json({ error: 'Missing required query params: background and user avatar (avatar).' });
    }

    const WIDTH = 1200;
    const HEIGHT = 450;

    const [bgImage, avatarImage] = await Promise.all([
      loadImageFromUrl(backgroundUrl),
      loadImageFromUrl(avatarUrl)
    ]);

    bgImage.cover(WIDTH, HEIGHT);

    const base = new Jimp(WIDTH, HEIGHT);
    base.composite(bgImage, 0, 0);

    const overlay = new Jimp(WIDTH, HEIGHT, 0x00000080);
    base.composite(overlay, 0, 0);

    const AV_SIZE = 260;
    avatarImage.cover(AV_SIZE, AV_SIZE);
    const mask = createCircleMask(AV_SIZE);
    avatarImage.mask(mask, 0, 0);

    const border = new Jimp(AV_SIZE + 12, AV_SIZE + 12, 0x00000000);
    const bSize = AV_SIZE + 12;
    const bcx = bSize / 2;
    const bcy = bSize / 2;
    const br = bSize / 2;
    const borderColor = Jimp.cssColorToHex(borderColorParam);

    for (let y = 0; y < bSize; y++) {
      for (let x = 0; x < bSize; x++) {
        const dx = x - bcx;
        const dy = y - bcy;
        if (dx * dx + dy * dy <= br * br) {
          border.setPixelColor(borderColor, x, y);
        }
      }
    }

    const avatarX = 60;
    const avatarY = Math.round((HEIGHT - AV_SIZE) / 2);
    base.composite(border, avatarX - 6, avatarY - 6);
    base.composite(avatarImage, avatarX, avatarY);

    // Load fonts (now safe with @jimp/custom)
    const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontSub   = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

    const textX = avatarX + AV_SIZE + 40;
    const usernameY = avatarY + 10;
    let safeUsername = username.length > 28 ? username.slice(0, 25) + '...' : username;
    base.print(fontTitle, textX, usernameY, {
      text: safeUsername,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, WIDTH - textX - 60, 100);

    const serverY = usernameY + 80;
    let safeServer = serverName.length > 30 ? serverName.slice(0, 27) + '...' : serverName;
    base.print(fontSub, textX, serverY, {
      text: `in ${safeServer}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, WIDTH - textX - 60, 80);

    const descY = serverY + 56;
    const desc = wrapText(descriptionRaw, 60);
    base.print(fontSmall, textX, descY, {
      text: desc,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, WIDTH - textX - 100, 160);

    const buffer = await base.getBufferAsync(Jimp.MIME_PNG);
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error('Error generating welcome card:', err.message || err);
    res.status(500).json({ error: 'Failed to generate welcome card', details: String(err.message || err) });
  }
});

// ✅ Export app for Vercel
module.exports = app;

// ✅ Local dev (only runs if executed directly)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Local server at http://localhost:${PORT}`);
  });
      }
