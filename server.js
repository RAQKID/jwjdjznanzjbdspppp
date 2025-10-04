const express = require("express");
const axios = require("axios");
const Jimp = require("jimp"); // only Jimp 0.22.1

const app = express();
const PORT = process.env.PORT || 3000;

// Load image from URL
async function loadImageFromUrl(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return await Jimp.read(Buffer.from(response.data));
}

// Wrap text
function wrapText(text, maxCharsPerLine = 40) {
  if (!text) return "";
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxCharsPerLine) {
      cur = (cur + " " + w).trim();
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

// Create circular mask manually
function createCircleMask(size) {
  const mask = new Jimp(size, size, 0x00000000);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        mask.setPixelColor(0xffffffff, x, y);
      }
    }
  }
  return mask;
}

app.get("/welcome", async (req, res) => {
  try {
    const {
      background,
      user_avatar,
      username = "Unknown User",
      server = "My Server",
      description = "Welcome!",
      borderColor = "#1E90FF",
    } = req.query;

    if (!background || !user_avatar) {
      return res.status(400).json({
        error: "Missing required query params: background, user_avatar",
      });
    }

    const WIDTH = 1200;
    const HEIGHT = 450;

    const bg = await loadImageFromUrl(background);
    const avatar = await loadImageFromUrl(user_avatar);

    bg.cover(WIDTH, HEIGHT); // resize background

    const base = new Jimp(WIDTH, HEIGHT);
    base.composite(bg, 0, 0);

    const overlay = new Jimp(WIDTH, HEIGHT, 0x00000080);
    base.composite(overlay, 0, 0);

    const AV_SIZE = 260;
    avatar.cover(AV_SIZE, AV_SIZE);
    const mask = createCircleMask(AV_SIZE);
    avatar.mask(mask, 0, 0);

    const border = new Jimp(AV_SIZE + 12, AV_SIZE + 12, 0x00000000);
    const bSize = AV_SIZE + 12;
    const bcx = bSize / 2;
    const bcy = bSize / 2;
    const br = bSize / 2;
    const borderHex = Jimp.cssColorToHex(borderColor);
    for (let y = 0; y < bSize; y++) {
      for (let x = 0; x < bSize; x++) {
        const dx = x - bcx;
        const dy = y - bcy;
        if (dx * dx + dy * dy <= br * br) {
          border.setPixelColor(borderHex, x, y);
        }
      }
    }

    const avatarX = 60;
    const avatarY = Math.round((HEIGHT - AV_SIZE) / 2);
    base.composite(border, avatarX - 6, avatarY - 6);
    base.composite(avatar, avatarX, avatarY);

    const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontSub   = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

    const textX = avatarX + AV_SIZE + 40;
    const usernameY = avatarY + 10;
    const serverY = usernameY + 80;
    const descY = serverY + 56;

    const safeUsername =
      username.length > 28 ? username.slice(0, 25) + "..." : username;
    base.print(fontTitle, textX, usernameY, safeUsername, WIDTH - textX - 60);

    const safeServer = server.length > 30 ? server.slice(0, 27) + "..." : server;
    base.print(fontSub, textX, serverY, `in ${safeServer}`, WIDTH - textX - 60);

    const wrappedDesc = wrapText(description, 60);
    base.print(fontSmall, textX, descY, wrappedDesc, WIDTH - textX - 100);

    const buffer = await base.getBufferAsync(Jimp.MIME_PNG);
    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to generate welcome card",
      details: String(err.message || err),
    });
  }
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`✅ Server running on http://localhost:${PORT}`)
  );
    }
