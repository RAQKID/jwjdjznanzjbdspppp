const express = require("express");
const axios = require("axios");
const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Register a font that supports Unicode (like emojis and special characters)
registerFont(path.join(__dirname, "fonts", "NotoSans-Regular.ttf"), { family: "NotoSans" });

// Wrap text helper
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Circular clipping for avatar
function drawCircle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
}

app.get("/welcome", async (req, res) => {
  try {
    const { background, user_avatar, username = "Unknown User", server = "Server", description = "", borderColor = "#1E90FF" } = req.query;

    if (!background || !user_avatar) {
      return res.status(400).json({ error: "Missing required query params: background, user_avatar" });
    }

    const WIDTH = 1200;
    const HEIGHT = 450;
    const AV_SIZE = 260;

    // Load images
    const [bgImage, avatarImage] = await Promise.all([
      loadImage(background),
      loadImage(user_avatar)
    ]);

    // Create canvas
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.drawImage(bgImage, 0, 0, WIDTH, HEIGHT);

    // Dark overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw avatar border
    const avatarX = 60;
    const avatarY = HEIGHT / 2 - AV_SIZE / 2;
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.arc(avatarX + AV_SIZE / 2, avatarY + AV_SIZE / 2, AV_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw circular avatar
    ctx.save();
    drawCircle(ctx, avatarX + AV_SIZE / 2, avatarY + AV_SIZE / 2, AV_SIZE / 2);
    ctx.drawImage(avatarImage, avatarX, avatarY, AV_SIZE, AV_SIZE);
    ctx.restore();

    // Text styles
    const textX = avatarX + AV_SIZE + 40;
    let curY = avatarY + 10;

    // Username
    ctx.fillStyle = "#ffffff";
    ctx.font = "64px NotoSans";
    let displayUsername = username.length > 28 ? username.slice(0, 25) + "..." : username;
    ctx.fillText(displayUsername, textX, curY);
    curY += 80;

    // Server name
    ctx.font = "32px NotoSans";
    let displayServer = server.length > 30 ? server.slice(0, 27) + "..." : server;
    ctx.fillText(`in ${displayServer}`, textX, curY);
    curY += 50;

    // Description
    ctx.font = "28px NotoSans";
    const lines = wrapText(ctx, description, WIDTH - textX - 60);
    lines.forEach(line => {
      ctx.fillText(line, textX, curY);
      curY += 36;
    });

    // Output image
    res.setHeader("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate welcome card", details: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
