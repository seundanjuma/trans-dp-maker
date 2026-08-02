# TRANS DP Maker

A simple web app for creating a custom profile picture for TRANS 2026 (Towards Revival Among The Nations).

Upload a photo, position and zoom it, and download it with the official event frame — ready to share and show you're coming.

**Live site:** https://trans-dp-maker.vercel.app/

## How it works

1. Upload or drag in a photo (PNG or JPG)
2. Drag to reposition, use the zoom slider to adjust
3. Download the finished picture (1280×1280 PNG) with the frame applied

## Local development

```bash
git clone https://github.com/seundanjuma/trans-dp-maker.git
cd trans-dp-maker
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Or use the VS Code "Live Server" extension for auto-reload on save.

## Files

- `index.html` — structure and styling
- `frame.png` — the overlay frame composited onto uploaded photos
- `logo.png` — site logo

© mrkazuda 2026
