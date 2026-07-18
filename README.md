# My Arabic TV

Personal IPTV playlist manager (HTML + CSS + JavaScript). No backend.

## Live playlist URL (for Samsung IPTV apps)

After this repo is public, use one of these:

```text
https://raw.githubusercontent.com/SulanYasin/m3u/main/MyArabicTV.m3u
```

or (often more reliable on TVs):

```text
https://cdn.jsdelivr.net/gh/SulanYasin/m3u@main/MyArabicTV.m3u
```

Paste the URL into your Samsung IPTV app as an **external playlist**.

## Local web app

```bash
npx --yes serve .
```

Open the shown URL, browse channels, or click **Download Playlist**.

## Playlist categories

Channels are grouped with M3U `group-title` (Saudi Arabia, Syria, Egypt, News, MBC, …).
SS IPTV and most players show these as folders.

| File | Purpose |
|------|---------|
| `index.html` / `app.js` / `style.css` | Web UI + M3U download |
| `channels.json` | Channel database |
| `MyArabicTV.m3u` | Playlist for IPTV apps |
