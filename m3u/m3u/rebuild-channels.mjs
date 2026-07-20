import fs from "fs";
import https from "https";
import http from "http";

const ROOT = import.meta.dirname;

const COUNTRY_FROM_GROUP = {
  News: "Arab World",
  MBC: "UAE",
  Syria: "Syria",
  "Saudi Arabia": "Saudi Arabia",
  Egypt: "Egypt",
  Documentary: "International",
  Religious: "Saudi Arabia",
  Kids: "Arab World",
  Other: "Arab World",
};

function cleanName(name) {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s*\[[^\]]*\]\s*/g, " ").trim();
}

function getFormat(url) {
  if (/\.m3u8(\?|$)/i.test(url)) return "HLS";
  if (/\.mpd(\?|$)/i.test(url)) return "DASH";
  if (/\.ts(\?|$)/i.test(url)) return "TS";
  if (/^rtmp:\/\//i.test(url)) return "RTMP";
  return "Stream";
}

function getCountry(name, oldGroup) {
  const n = name.toLowerCase();
  const rules = [
    [/syria|souriya|halab|rojava|ronahi|welat|althania|ugarit|damascus|aleppo/, "Syria"],
    [/nablus|palestine|falastin|ajyal|rajeen|watar tv|al madina|al najah|radio albalad|dr pal/, "Palestine"],
    [/saudi|ksa |sbc\b|ekhbariya|thaqafiya|rotana|makkah|madinah|quran|sunnah|asharq|panorama|iqraa|thikrayat|al saudiya|bab al hara|aflam|tarab/, "Saudi Arabia"],
    [/egypt|masr|cbc|nogoum|aghapy|coptic|al ghad|mix hollywood|watantv|watan tv|elsharq|9090/, "Egypt"],
    [/jordan|amman|roya |kaifa|alerth|altaghier/, "Jordan"],
    [/sharjah|ajman|dubai|abu dhabi|al yaum|al qamar|spacetoon|cnbc arabiya/, "UAE"],
    [/qatar|al rayyan|alkass|al maaref|al jazeera|al araby/, "Qatar"],
    [/^ktv|kuwait/, "Kuwait"],
    [/bahrain/, "Bahrain"],
    [/oman/, "Oman"],
    [/lebanon|lbc|mtv lebanon|future tv|tele liban|al manar|otv|noursat|nour /, "Lebanon"],
    [/iraq|kurd|rudaw|dijlah|al iraqia|al rasheed|karbala|imam hussein|samarra|zagros|ishtar|payam|mixkurdy/, "Iraq"],
    [/morocco|2m |al aoula|arryadia|medi 1|chada|\bmfm\b/, "Morocco"],
    [/tunisia|mosaique|watania/, "Tunisia"],
    [/algeria|echorouk/, "Algeria"],
    [/libya/, "Libya"],
    [/yemen|masirah|masar/, "Yemen"],
    [/sudan/, "Sudan"],
    [/france 24/, "France"],
    [/asharq discovery|asharq documentary/, "Saudi Arabia"],
    [/national geographic|nat geo|history hit|autentic|documentary\+|cgtn documentary/, "International"],
  ];
  for (const [re, country] of rules) {
    if (re.test(n)) return country;
  }
  if (oldGroup && COUNTRY_FROM_GROUP[oldGroup]) return COUNTRY_FROM_GROUP[oldGroup];
  if (oldGroup && !oldGroup.includes("|")) return oldGroup;
  return "Arab World";
}

function getCategory(name, oldGroup) {
  const n = name.toLowerCase();
  const g = (oldGroup || "").toLowerCase();
  if (/nablus/.test(n)) return "Religious";
  if (/makkah tv|quran al kareem/.test(n)) return "Makkah Live";
  if (/^holy quran radio$/.test(n)) return "Makkah Live";
  if (/sunnah al nabawiyah|madinah|medina/.test(n)) return "Madinah Live";
  if (/radio|fm\b|9090/.test(n)) return "Radio";
  if (/documentary|discovery|national geographic|nat geo|history hit|autentic|asharq disc|karbala doc|cgtn doc|jazeera documentary/.test(n)) return "Documentary";
  if (/sport|alkass|ksa sports|arryadia|sharjah sport|bahrain sport|oman sport|jordan sport/.test(n)) return "Sports";
  if (/spacetoon|kids|koogi|roya kids|atfal|zarok|majid tv/.test(n)) return "Kids";
  if (/drama|movie|aflam|cinema|bollywood|comedy|bab al hara|tarab|entertainment|rotana music|aghani/.test(n)) return "Entertainment";
  if (/education|syrian education/.test(n)) return "Education";
  if (/news|mubasher|hadath|ekhbariya|alarabiya|jazeera|asharq news|cnbc|france 24|sky news|mayadeen|alalam|snews/.test(n)) return "News";
  if (/quran|sunnah|peace tv|iqraa|resalah|imam hussein|religious|nour |noursat|charity|thikrayat/.test(n)) return "Religious";
  if (/mbc/.test(n)) return "Entertainment";
  if (g === "news") return "News";
  if (g === "documentary") return "Documentary";
  if (g === "religious") return "Religious";
  if (g === "kids") return "Kids";
  if (g === "mbc") return "Entertainment";
  if (/tv$|channel|satellite|national|souriya|syria tv|rojava|ronahi|welat|althania|halab|ugarit|syria one/.test(n)) return "National";
  return "General";
}

function nameKey(name) {
  return cleanName(name).toLowerCase();
}

function parseM3u(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "#EXTM3U") continue;
    if (trimmed.startsWith("#EXTINF")) {
      const m = trimmed.match(/,(.+)$/);
      current = { name: cleanName(m ? m[1] : "Unknown"), url: null };
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    if (current && /^https?:\/\//i.test(trimmed)) {
      current.url = trimmed;
      out.push(current);
      current = null;
    }
  }
  return out;
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: "HEAD", timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on("error", () => {
      const req2 = lib.request(url, { method: "GET", timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        res.destroy();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req2.on("error", () => resolve(false));
      req2.on("timeout", () => {
        req2.destroy();
        resolve(false);
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const extras = [
  { name: "Syria One", url: "https://live.syriaone.tv/live/syriaone.m3u8", country: "Syria", category: "National" },
  { name: "Damascus Radio", url: "https://radiodamascus.ortas.live/RDimshq/RDimshqLive/playlist.m3u8", country: "Syria", category: "Radio" },
  { name: "Halab Today TV (Alt)", url: "https://halabtoday-live.lg.mncdn.com/halabtoday/livestream/playlist.m3u8", country: "Syria", category: "National" },
  { name: "Syria TV (Kwikmotion)", url: "https://live.kwikmotion.com/syriatvlive/syriatv.smil/playlist_dvr.m3u8", country: "Syria", category: "National" },
  { name: "Syria TV (Ottera)", url: "https://stream.ads.ottera.tv/playlist.m3u8?network_id=6017", country: "Syria", category: "National" },
  { name: "Syria Drama", url: "http://82.137.248.21:1935/Drama/DramaLive3/playlist.m3u8", country: "Syria", category: "Entertainment", verified: false },
  { name: "Syria Satellite Channel", url: "http://82.137.248.16:1935/Sat/SatLive3/playlist.m3u8", country: "Syria", category: "National", verified: false },
  { name: "Syrian News Channel", url: "http://82.137.248.16:1935/Snews/SnewsLive3/playlist.m3u8", country: "Syria", category: "News", verified: false },
  { name: "Syrian Education TV", url: "http://82.137.248.20:1935/SEdu/SEduLive3/playlist.m3u8", country: "Syria", category: "Education", verified: false },
  { name: "Ugarit TV", url: "http://82.137.248.21:1935/Ugarit/UgaritLive/playlist.m3u8", country: "Syria", category: "National", verified: false },
  { name: "Makkah TV", url: "https://media2.streambrothers.com:1936/8122/8122/playlist.m3u8", country: "Saudi Arabia", category: "Makkah Live", verified: false },
  { name: "Al Jazeera Documentary", url: "https://live-hls-web-ajd.getaj.net/AJD/index.m3u8", country: "Qatar", category: "Documentary" },
  { name: "National Geographic Abu Dhabi", url: "https://admn-live-cdn-lb.starzplayarabia.com/out/v1/admn_tv_enc/national_geo/national_geo_hls_nd/index.m3u8", country: "UAE", category: "Documentary", verified: false },
  { name: "National Geographic Abu Dhabi (Mangomolo)", url: "https://admdn2.cdn.mangomolo.com/nagtv/smil:nagtv.stream.smil/playlist.m3u8", country: "UAE", category: "Documentary", verified: false },
  { name: "Nat Geo Wild Arabic", url: "https://saran-live.ercdn.net/natgeowild/index.m3u8", country: "International", category: "Documentary", verified: false },
  { name: "Al Quran Al Kareem TV (Globecast)", url: "https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8", country: "Saudi Arabia", category: "Makkah Live" },
  { name: "Al Sunnah Al Nabawiyah TV (Globecast)", url: "https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8", country: "Saudi Arabia", category: "Madinah Live" },
  { name: "Asharq News (Direct)", url: "https://live-news.asharq.com/asharq.m3u8", country: "Saudi Arabia", category: "News" },
];

const existing = JSON.parse(fs.readFileSync(`${ROOT}/channels.json`, "utf8"));
const byUrl = new Map();

for (const ch of existing) {
  if (!ch.url || !ch.name) continue;
  const name = cleanName(ch.name);
  const country = getCountry(name, ch.group);
  const category = getCategory(name, ch.group);
  byUrl.set(ch.url, {
    name,
    url: ch.url,
    country,
    category,
    format: ch.format || getFormat(ch.url),
    group: `${country} | ${category}`,
    verified: ch.verified !== false,
  });
}

for (const e of extras) {
  if (!byUrl.has(e.url)) {
    byUrl.set(e.url, {
      name: e.name,
      url: e.url,
      country: e.country,
      category: e.category,
      format: getFormat(e.url),
      group: `${e.country} | ${e.category}`,
      verified: e.verified !== false,
    });
  }
}

// Merge by normalized name
const byName = new Map();
for (const ch of byUrl.values()) {
  const key = nameKey(ch.name.replace(/\s*\((alt|cdn|ottera|mangomolo|globecast|direct|kwikmotion)\)\s*/i, ""));
  if (!byName.has(key)) {
    byName.set(key, []);
  }
  byName.get(key).push(ch);
}

function score(ch) {
  let s = 0;
  if (ch.format === "HLS") s += 10;
  if (ch.url.startsWith("https://")) s += 5;
  if (ch.verified !== false) s += 3;
  if (!/\(alt\)|\(cdn\)|\(ottera\)|\(mangomolo\)|\(globecast\)|\(direct\)|\(kwikmotion\)/i.test(ch.name)) s += 2;
  return s;
}

const final = [];
for (const entries of byName.values()) {
  entries.sort((a, b) => score(b) - score(a));
  const primary = entries[0];
  const alt_urls = [...new Set(entries.slice(1).map((e) => e.url).filter((u) => u !== primary.url))];
  const item = {
    name: primary.name.replace(/\s*\((alt|cdn|ottera|mangomolo|globecast|direct|kwikmotion)\)\s*/i, ""),
    url: primary.url,
    country: primary.country,
    category: primary.category,
    format: primary.format,
    group: primary.group,
  };
  if (alt_urls.length) item.alt_urls = alt_urls;
  if (primary.verified === false || entries.some((e) => e.verified === false)) item.verified = false;
  final.push(item);
}

final.sort((a, b) => {
  const c = a.country.localeCompare(b.country);
  if (c) return c;
  const g = a.category.localeCompare(b.category);
  if (g) return g;
  return a.name.localeCompare(b.name);
});

// Verify unverified + key new streams
const toVerify = final.filter((c) => c.verified === false).slice(0, 20);
console.log(`Verifying ${toVerify.length} unverified streams...`);
for (const ch of toVerify) {
  const ok = await checkUrl(ch.url);
  if (ok) {
    delete ch.verified;
    console.log(`  OK: ${ch.name}`);
  } else {
    console.log(`  FAIL: ${ch.name}`);
  }
}

fs.writeFileSync(`${ROOT}/channels.json`, JSON.stringify(final, null, 2) + "\n");

const m3u = ["#EXTM3U", ""];
for (const ch of final) {
  m3u.push(`#EXTINF:-1,${ch.name}`);
  m3u.push(`#EXTGRP:${ch.group}`);
  m3u.push(ch.url);
  if (ch.alt_urls) {
    for (const alt of ch.alt_urls) {
      m3u.push(`#EXTINF:-1,${ch.name} (Alt)`);
      m3u.push(`#EXTGRP:${ch.group}`);
      m3u.push(alt);
    }
  }
  m3u.push("");
}
fs.writeFileSync(`${ROOT}/MyArabicTV.m3u`, m3u.join("\n"));

const syria = final.filter((c) => c.country === "Syria");
const makkah = final.filter((c) => c.category === "Makkah Live" || c.category === "Madinah Live");
const docs = final.filter((c) => c.category === "Documentary");

console.log(`\nTotal: ${final.length} channels`);
console.log(`Syria: ${syria.length}`);
syria.forEach((c) => console.log(`  ${c.name} [${c.category}]${c.verified === false ? " (unverified)" : ""}`));
console.log(`Makkah/Madinah: ${makkah.length}`);
makkah.forEach((c) => console.log(`  ${c.name} [${c.category}]${c.verified === false ? " (unverified)" : ""}`));
console.log(`Documentary: ${docs.length}`);
docs.forEach((c) => console.log(`  ${c.name} (${c.country})${c.verified === false ? " (unverified)" : ""}`));
