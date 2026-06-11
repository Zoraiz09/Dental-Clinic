// Generate launcher/splash/favicon assets from the NOOR brand logo.
// The tooth-and-face mark (top portion of logo-black-vertical.png) becomes
// the app icon on the brand cream background; the wordmark stays out — it
// would be illegible at launcher size.
// Run: node scripts/make-icons.js
const sharp = require('sharp');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const LOGO = path.join(ASSETS, 'logo-black-vertical.png');
const CREAM = '#F6EEE3';

async function main() {
  const meta = await sharp(LOGO).metadata();
  console.log('logo:', meta.width, 'x', meta.height);

  // The golden tooth artwork lives in the top ~56% of the lockup
  // (below that is the NOOR wordmark). Crop, then trim to content.
  const cropped = await sharp(LOGO)
    .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.68) })
    .png()
    .toBuffer();

  // The crop catches the tops of the black NOOR letters. The artwork is
  // gold and the wordmark pure black, so erase near-black pixels.
  const { data, info } = await sharp(cropped).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) data[i + 3] = 0;
    // The gold sparkle that sits between the roots and the wordmark gets
    // sliced in half by the crop — drop the leftover (bottom-left corner).
    const px = (i / 4) % info.width;
    const py = Math.floor(i / 4 / info.width);
    if (px < info.width * 0.34 && py > info.height * 0.86) data[i + 3] = 0;
  }
  const cleaned = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  const tooth = await sharp(cleaned).trim().toBuffer();

  const fit = (size) => sharp(tooth).resize(size, size, { fit: 'inside' }).png().toBuffer();

  // 1. Main icon (iOS + fallback): tooth centered on cream, 1024².
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CREAM } })
    .composite([{ input: await fit(660) }])
    .png()
    .toFile(path.join(ASSETS, 'icon.png'));

  // 2. Android adaptive foreground: transparent, content inside the ~66%
  //    safe zone so round/squircle masks never clip it.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await fit(560) }])
    .png()
    .toFile(path.join(ASSETS, 'android-icon-foreground.png'));

  // 3. Adaptive background: solid brand cream.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CREAM } })
    .png()
    .toFile(path.join(ASSETS, 'android-icon-background.png'));

  // 4. Monochrome (Android 13+ themed icons): the tooth as a white glyph —
  //    the launcher tints it to match the user's theme.
  const toothSized = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await fit(560) }])
    .png()
    .toBuffer();
  const alpha = await sharp(toothSized).ensureAlpha().extractChannel(3).toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#FFFFFF' } })
    .joinChannel(alpha)
    .png()
    .toFile(path.join(ASSETS, 'android-icon-monochrome.png'));

  // 5. Splash icon: the tooth mark (replaces the template grid placeholder).
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await fit(840) }])
    .png()
    .toFile(path.join(ASSETS, 'splash-icon.png'));

  // 6. Web favicon.
  await sharp({ create: { width: 196, height: 196, channels: 4, background: CREAM } })
    .composite([{ input: await fit(160) }])
    .png()
    .toFile(path.join(ASSETS, 'favicon.png'));

  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
