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

## Stream formats

Most channels use **HLS (.m3u8)** — best for SS IPTV and the web player.

Playlists are HLS-only (`.m3u8`) for SS IPTV compatibility.

## Playlist organization

Channels are grouped by **country** only using `#EXTGRP:` folders (SS IPTV compatible).

Examples: `Syria`, `Saudi Arabia`, `UAE`.

Radio, Shia, Christian, and adult channels are excluded.

## Rebuild channels

```bash
node rebuild-channels.mjs
```

## Files

| File | Purpose |
|------|---------|
| `index.html` / `app.js` / `style.css` | Web UI + HLS player + M3U download |
| `channels.json` | Channel database (name, country, category, format) |
| `MyArabicTV.m3u` | Playlist for IPTV apps |
| `rebuild-channels.mjs` | Reorganize, dedupe, verify, and export playlist |
