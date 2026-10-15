# 🎂 Birthday Surprise Website

Flow: Name → Birthday celebration (cake, candles, confetti, gallery, countdown) → Feedback question → **₹500 / ₹1000 message at the top + your QR shown directly** → Replay / Certificate

## Run
VS Code → open this folder → right-click `index.html` → **Open with Live Server**.

## Change the song
Put your song in `assets/` and name it **`song.mp3`**. (If missing, a built-in "Happy Birthday" melody plays.)

## Change your QR codes (easiest way – works on every phone)
Put your images in `assets/`:
- `qr-500.png`  → shown for **Nachindhi** (₹500)
- `qr-1000.png` → shown for **Nachaledhu** (₹1000)

`.jpg` / `.jpeg` also work. Replace the file any time.

Optional: the ⚙️ button (top right) lets you upload QR images in your own browser instead. Those are saved only on that browser/device, so for sharing a link use the `assets/` files.

## Share
Upload the whole folder to Netlify Drop / GitHub Pages / Vercel and send the link.

Note: the site can't verify payments – you check your own UPI app.
