const express = require("express");
const axios = require("axios");

// Setup Jimp with custom plugins & types
const jimp = require("@jimp/custom");
const jimpTypes = require("@jimp/types");
const jimpPrint = require("@jimp/plugin-print");

const Jimp = jimp({
  types: [jimpTypes],
  plugins: [jimpPrint],
});

const app = express();
const PORT = process.env.PORT || 3000;

// Helper to fetch image from URL
async function loadImageFromUrl(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return await Jimp.read(Buffer.from(response.data));
}

app.get("/welcome", async (req, res) => {
  try {
    const {
      background,
      user_avatar,
      username = "Unknown User",
      server = "My Server",
      description = "Welcome!",
      borderColor = "#ffffff",
    } = req.query;

    if (!background || !user_avatar) {
      return res
        .status(400)
        .json({ error: "Missing required query params: background, user_avatar" });
    }

    // Canvas size
    const WIDTH = 1200;
    const HEIGHT = 450;

    // Load images
    const bg = await loadImageFromUrl(background);
    const avatar = await loadImageFromUrl(user_avatar);

    // Prepare background
    bg.resize(WIDTH, HEIGHT); // 🔹 replace .cover() with .resize()
    const base = new Jimp(WIDTH, HEIGHT, borderColor);
    base.composite(bg, 0, 0);

    // Circle avatar
    avatar.resize(256, 256);
    const mask = new Jimp(256, 256, 0x00000000);
    mask.circle();
    avatar.mask(mask, 0, 0);

    // Place avatar with border
    const avatarX = 50;
    const avatarY = HEIGHT / 2 - 128;
    base.composite(avatar, avatarX, avatarY);

    // Fonts
    const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontSub = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

    // Text positions
    const textX = avatarX + 300;
    const serverY = 100;
    const usernameY = serverY + 70;
    const descY = usernameY + 50;

    // Draw text
    base.print(fontTitle, textX, serverY, server);
    base.print(fontSub, textX, usernameY, username);
    base.print(fontSmall, textX, descY, description);

    // Output PNG
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
  app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
}
