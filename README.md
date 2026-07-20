# My Arabic TV

Personal IPTV playlist manager (HTML + CSS + JavaScript). No backend.

## Live playlist URL (for Samsung SS IPTV)

```text
https://raw.githubusercontent.com/SulanYasin/m3u/main/m3u/MyArabicTV.m3u
```

Paste the URL into SS IPTV as an **external playlist**, then refresh after GitHub updates.

## Local web app

```bash
npx --yes serve .
```

Open the shown URL, browse channels, or click **Download Playlist**.

## Playlist organization

**316 channels** organized as `Country | Category` using `#EXTGRP:` folders (SS IPTV compatible).

Examples: `Syria | National`, `Saudi Arabia | Makkah Live`, `UAE | Documentary`.

Alternate stream URLs are included as `(Alt)` entries in the M3U when available.

## Rebuild channels

```bash
node rebuild-channels.mjs
```

## Files

| File | Purpose |
|------|---------|
| `index.html` / `app.js` / `style.css` | Web UI + HLS player + M3U download |
| `channels.json` | Channel database (name, country, category, format, alt URLs) |
| `MyArabicTV.m3u` | Playlist for IPTV apps |
| `rebuild-channels.mjs` | Reorganize, dedupe, verify, and export playlist |
