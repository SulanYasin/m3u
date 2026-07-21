import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const ROOT = import.meta.dirname;

const OUTPUT_FILES = ["channels.json", "MyArabicTV.m3u"];

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

function decodeDisplayName(name) {
  return name
    .replace(/\\u0026/gi, "&")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanName(name) {
  return decodeDisplayName(name)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .trim();
}

function getFormat(url) {
  if (/\.mpd(\?|$)/i.test(url)) return "DASH";
  if (/\.m3u8(\?|$)/i.test(url)) return "HLS";
  if (/\.ts(\?|$)/i.test(url)) return "MPEG-TS";
  if (/\.mp4(\?|$)/i.test(url)) return "MP4";
  if (/^rtmp:\/\//i.test(url)) return "RTMP";
  if (/^rtsp:\/\//i.test(url)) return "RTSP";
  if (/^(udp|rtp):\/\//i.test(url)) return "UDP/RTP";
  if (/\.m3u(\?|$)/i.test(url)) return "M3U";
  return "Stream";
}

function getCountry(name, oldGroup) {
  const n = name.toLowerCase();
  const rules = [
    [/syria|souriya|halab|rojava|ronahi|welat|althania|ugarit|damascus|aleppo/, "Syria"],
    [/nablus|palestine|falastin|ajyal|rajeen|watar tv|al madina|al najah|radio albalad|dr pal/, "Palestine"],
    [/egypt|masr|cbc|nogoum|aghapy|coptic|al ghad|mix hollywood|watantv|watan tv|elsharq|9090/, "Egypt"],
    [/jordan|amman|roya |kaifa|alerth|altaghier/, "Jordan"],
    [/sharjah|ajman|dubai|abu dhabi|al yaum|al qamar|spacetoon|cnbc arabiya/, "UAE"],
    [/\bmbc\b/, "UAE"],
    [/bahrain/, "Bahrain"],
    [/qatar|al rayyan|alkass|al maaref|al jazeera|al araby/, "Qatar"],
    [/^ktv|kuwait/, "Kuwait"],
    [/oman/, "Oman"],
    [/saudi|ksa |sbc\b|ekhbariya|thaqafiya|rotana|makkah|madinah|sunnah|asharq|panorama|iqraa|thikrayat|al saudiya|bab al hara|aflam|tarab|holy quran|quran al kareem|quran radio/, "Saudi Arabia"],
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
  if (oldGroup) {
    const legacy = oldGroup.includes("|") ? oldGroup.split("|")[0].trim() : oldGroup;
    if (COUNTRY_FROM_GROUP[legacy]) return COUNTRY_FROM_GROUP[legacy];
    if (!oldGroup.includes("|")) return oldGroup;
  }
  return "Arab World";
}

function isChristianChannel(name, url = "") {
  const n = name.toLowerCase();
  const u = url.toLowerCase();
  if (
    /aghapy|coptic|noursat|nour al|nour el|nour mar|nour tv|sat-7|sat7|elsharq|emantv|tele lumiere|logos tv|koddas|koddass/i.test(
      n
    )
  ) {
    return true;
  }
  return /aghapy|icopts|nour\d+sat|noursat|sat7|elfaro4|elsharq_live|emantv|aghapykids/.test(u);
}

function getCategory(name, oldGroup) {
  const n = name.toLowerCase();
  const g = (oldGroup || "").toLowerCase();
  if (/makkah tv/.test(n)) return "Makkah Live";
  if (/quran al kareem|al quran al kareem/.test(n) && !/radio/.test(n)) return "Makkah Live";
  if (/sunnah al nabawiyah|madinah|medina/.test(n)) return "Madinah Live";
  if (/radio|\bfm\b|9090|onefm|mosaique|\bmfm\b|nogoumfmtv/.test(n)) return "Radio";
  if (/documentary|discovery|national geographic|nat geo|history hit|autentic|asharq disc|karbala doc|cgtn doc|jazeera documentary|wildearth/.test(n)) return "Documentary";
  if (/sport|alkass|ksa sports|arryadia|sharjah sport|bahrain sport|oman sport|jordan sport/.test(n)) return "Sports";
  if (/spacetoon|kids|koogi|roya kids|atfal|zarok|majid tv/.test(n)) return "Kids";
  if (/drama|movie|aflam|cinema|bollywood|comedy|bab al hara|tarab|entertainment|rotana music|aghani/.test(n)) return "Entertainment";
  if (/education|syrian education/.test(n)) return "Education";
  if (/news|mubasher|hadath|ekhbariya|al arabiya|alarabiya|jazeera|asharq news|cnbc|france 24|sky news|mayadeen|alalam|snews/.test(n)) return "News";
  if (/quran|sunnah|peace tv|iqraa|resalah|imam hussein|religious|nour |noursat|thikrayat/.test(n)) return "Religious";
  if (/mbc/.test(n)) return "Entertainment";
  if (g === "news") return "News";
  if (g === "documentary") return "Documentary";
  if (g === "religious") return "Religious";
  if (g === "kids") return "Kids";
  if (g === "mbc") return "Entertainment";
  if (/tv$|channel|satellite|national|souriya|syria tv|rojava|ronahi|welat|althania|halab|ugarit|syria one/.test(n)) return "National";
  return "General";
}

function applyGroupFields(item) {
  // Folders are Country only (e.g. Syria / Channel), except Radio.
  if (item.category === "Radio") {
    item.country = "Radio";
    item.category = "Radio";
    item.group = "Radio";
  } else {
    item.group = item.country || "Other";
  }
  return item;
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

function probeUrl(url, method) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(
      url,
      { method, timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } },
      (res) => {
        if (method === "GET") res.destroy();
        else res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function checkUrl(url) {
  if (await probeUrl(url, "HEAD")) return true;
  return probeUrl(url, "GET");
}

function getRepoRoot() {
  if (fs.existsSync(path.join(ROOT, "m3u", "channels.json"))) return ROOT;
  if (fs.existsSync(path.join(ROOT, "..", "m3u", "channels.json"))) {
    return path.resolve(ROOT, "..");
  }
  return ROOT;
}

function syncOutputs(repoRoot, jsonContent, m3uContent) {
  const targets = [path.join(repoRoot, "m3u"), path.join(repoRoot, "m3u", "m3u")];
  for (const dir of targets) {
    if (!fs.existsSync(dir)) continue;
    fs.writeFileSync(path.join(dir, "channels.json"), jsonContent);
    fs.writeFileSync(path.join(dir, "MyArabicTV.m3u"), m3uContent);
  }
}

const SHIA_NAME_PATTERNS = [
  /marjaeyat/i,
  /imam hussein/i,
  /beitolabbas/i,
  /al-jawadain/i,
  /al-aimma/i,
  /al-sahat/i,
  /alabbassia/i,
  /alghadeer/i,
  /^aliman tv$/i,
  /alistiqama/i,
  /tanasuh/i,
  /charity\s*tv/i,
  /^alawla tv$/i,
  /karbala documentary/i,
  /samarra tv/i,
  /^al manar$/i,
  /al masirah/i,
];

const SHIA_URL_PARTS = [
  "marjaeyattv.com",
  "alaimma.tv",
  "aljawadain.org",
  "assahat",
  "alabbassia.com",
  "beitolabbas.tv",
  "tanasuh",
  "imamhossaintv.com",
  "al-zahratv.com",
  "alawla.tv",
  "ktvlive.online/stream/hls/ch3",
  "samarra",
  "652930de05533.streamlock.net/live/ngrp:livestream_all",
  "185.105.4.236:1935/live/ngrp:livestream_all",
  "edge.fastpublish.me/live",
  "cdnbridge.tv/Almasirah",
];

function isShiaChannel(name, url) {
  if (SHIA_NAME_PATTERNS.some((pattern) => pattern.test(name))) return true;
  return SHIA_URL_PARTS.some((part) => url.includes(part));
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
  { name: "WildEarth", url: "https://wildearth-plex.amagi.tv/playlist.m3u8", country: "International", category: "Documentary" },
  { name: "Al Quran Al Kareem TV (Globecast)", url: "https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8", country: "Saudi Arabia", category: "Makkah Live" },
  { name: "Al Quran Al Kareem TV (Taghtia)", url: "https://edge.taghtia.com/sa/7.m3u8", country: "Saudi Arabia", category: "Makkah Live" },
  { name: "Al Sunnah Al Nabawiyah TV (Globecast)", url: "https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8", country: "Saudi Arabia", category: "Madinah Live" },
  { name: "Asharq News (Direct)", url: "https://live-news.asharq.com/asharq.m3u8", country: "Saudi Arabia", category: "News" },
  { name: "Asharq News (DASH)", url: "https://svs.itworkscdn.net/bloomberarlive/bloomberg.smil/manifest.mpd", country: "Saudi Arabia", category: "News" },
  { name: "Quran Radio (Taghtia)", url: "https://edge.taghtia.com/sa/13.m3u8", country: "Radio", category: "Radio" },
  { name: "BBC Arabic", url: "https://vs-hls-pushb-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_arabic_tv/pc_hd_abr_v2.m3u8", country: "International", category: "News" },
  { name: "DW Arabic", url: "https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8", country: "International", category: "News" },
  { name: "CGTN Arabic", url: "https://news.cgtn.com/resource/live/arabic/cgtn-a.m3u8", country: "International", category: "News" },
  { name: "Al Masriyah", url: "http://185.9.2.18/chid_247/index.m3u8", country: "Egypt", category: "National" },
  { name: "Dubai TV International", url: "http://185.9.2.18/chid_139/index.m3u8", country: "UAE", category: "National" },
  { name: "Al Jadeed", url: "http://185.9.2.18/chid_391/mono.m3u8", country: "Lebanon", category: "News" },
  { name: "LBC International", url: "http://185.9.2.18/chid_327/index.m3u8", country: "Lebanon", category: "Entertainment" },
  { name: "Qatar Television", url: "https://qatartv.akamaized.net/hls/live/20000609/qtv1/master.m3u8", country: "Qatar", category: "National" },
  { name: "Qatar TV The Holy Quran", url: "https://qatartv.akamaized.net/hls/live/20000612/qtvquran/master.m3u8", country: "Qatar", category: "Religious" },
  { name: "QBC", url: "https://live.kwikmotion.com/qbusinesslive/qbusiness.smil/playlist.m3u8", country: "Qatar", category: "News" },
  { name: "QBC (Alkass)", url: "https://googlecdn1.alkassdigital.net/livestream/qbc4/main.m3u8", country: "Qatar", category: "News" },
  { name: "Kolalnas TV", url: "https://htvint.mada.ps/kolalnas/index.m3u8", country: "Palestine", category: "National" },
  { name: "Raya 1", url: "https://htvmada.mada.ps:4443/raya/index.m3u8", country: "Palestine", category: "National" },
  { name: "Al Sharqiya", url: "http://185.9.2.18/chid_144/index.m3u8", country: "Iraq", category: "National" },
  { name: "2M", url: "http://185.9.2.18/chid_218/index.m3u8", country: "Morocco", category: "National" },
  { name: "Al Maghribia", url: "http://185.9.2.18/chid_205/index.m3u8", country: "Morocco", category: "National" },
  { name: "TV2 Algeria", url: "http://185.9.2.18/chid_347/index.m3u8", country: "Algeria", category: "National" },
  { name: "El-Heddaf TV", url: "https://live.elheddaftv.com:8081/elheddaftv/index.m3u8", country: "Algeria", category: "Sports" },
  { name: "Radio Fann Jordan", url: "http://45.63.116.205/hls2/stream1.m3u8", country: "Radio", category: "Radio" },
  { name: "Radio Yaqeen Jordan", url: "http://45.63.116.205/hls4/stream1.m3u8", country: "Radio", category: "Radio" },
  { name: "Rotana Radio Jordan", url: "http://45.63.116.205/hls/stream1.m3u8", country: "Radio", category: "Radio" },
  { name: "Rotana Tarab Jordan", url: "http://45.63.116.205/hls3/stream1.m3u8", country: "Jordan", category: "Entertainment" },
  // Verified missing from iptv-org MENA + yazki/ara sources (Jul 2026)
  { name: "Elwatania TV", url: "https://livesstream.work.gd:5443/WebRTCApp/streams/stream.m3u8", country: "Algeria", category: "National" },
  { name: "Mekameleen TV", url: "https://mn-nl.mncdn.com/mekameleen/smil:mekameleentv.smil/playlist.m3u8", country: "Egypt", category: "News" },
  { name: "Ahl-Alquran TV", url: "https://al-ekhbaria-prod-dub.shahid.net/out/v1/9885cab0a3ec4008b53bae57a27ca76b/index.m3u8", country: "Saudi Arabia", category: "Religious" },
  { name: "Alhurra", url: "https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038900/MBN_Alhurra_Worldsafe_HLS/master.m3u8", country: "International", category: "News" },
  { name: "Alhurra Iraq", url: "https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038899/MBN_Iraq_Worldsafe_HLS/master.m3u8", country: "Iraq", category: "News" },
  { name: "Al-Naeem TV", url: "http://37.238.136.61/hls/stream.m3u8", country: "Iraq", category: "National" },
  { name: "AVA Family", url: "https://familyhls.avatv.live/hls/stream.m3u8", country: "Iraq", category: "Entertainment" },
  { name: "Hala TV", url: "https://gstream4.panet.co.il/edge/halaTV/playlist.m3u8", country: "Palestine", category: "National" },
  { name: "Melody FM Jordan", url: "https://cdn3.wowza.com/1/OVRrOWxXUEswS2Yv/eGVxSWZy/hls/live/playlist.m3u8", country: "Radio", category: "Radio" },
  { name: "Ch4Teen Documentary", url: "https://ch14.tv/live/ch4teendoc/playlist.m3u8", country: "Kuwait", category: "Documentary" },
  { name: "Al Khalij", url: "https://mn-nl.mncdn.com/khalij/khalij/playlist.m3u8", country: "Kuwait", category: "National" },
  { name: "Assirat TV", url: "https://softverse.b-cdn.net/Assirat/assiratobs/playlist.m3u8", country: "Lebanon", category: "Religious" },
  { name: "Assirat TV (CDN)", url: "https://svs.itworkscdn.net/assiratvlive/assirat/playlist.m3u8", country: "Lebanon", category: "Religious" },
  { name: "Tanasuh TV", url: "https://kilolink.pulsarstarsolutions.com/live/smil:tanasuhtv.smil/manifest.m3u8", country: "Libya", category: "National" },
  { name: "Musawa", url: "https://pbc.furrera.ps/musawahd/index.m3u8", country: "Palestine", category: "National" },
  { name: "Palestine Edu", url: "https://pbc.furrera.ps/PalestineEDU/index.m3u8", country: "Palestine", category: "Education" },
  { name: "Palestine Mubasher", url: "https://pbc.furrera.ps/palestinelivehd/index.m3u8", country: "Palestine", category: "News" },
  { name: "Al-Sahat TV", url: "https://assahat.b-cdn.net/Assahat/assahatobs/index.m3u8", country: "Yemen", category: "Religious" },
  { name: "Alhiwar TV", url: "https://mn-nl.mncdn.com/alhiwar_live/smil:alhiwar.smil/playlist.m3u8", country: "International", category: "News" },
  { name: "Asil TV", url: "https://live.asil.tv/asiltv/index.m3u8", country: "Arab World", category: "Entertainment" },
  { name: "Hala London", url: "https://halalondon-live.ercdn.net/halalondon/halalondon.m3u8", country: "International", category: "Entertainment" },
  // Sunnah / prayer / Quran (grade A–B, Jul 2026)
  { name: "Al Quran Al Kareem TV", url: "http://m.live.net.sa:1935/live/quran/playlist.m3u8", country: "Saudi Arabia", category: "Makkah Live" },
  { name: "Al Sunnah Al Nabawiyah TV", url: "http://m.live.net.sa:1935/live/sunnah/playlist.m3u8", country: "Saudi Arabia", category: "Madinah Live" },
  { name: "Sharjah Quran TV", url: "https://live.kwikmotion.com/sharjahtvquranlive/shqurantv.smil/playlist.m3u8", country: "UAE", category: "Religious" },
  { name: "Sharjah Quran TV (Alt)", url: "https://live.kwikmotion.com/sharjahtvquranlive/shqurantv.smil//sharjahtvquranpublish/shqurantv_source/chunks.m3u8", country: "UAE", category: "Religious" },
  { name: "Azan TV", url: "https://dbcanada.sonarbanglatv.com/azantv/atv/index.m3u8", country: "International", category: "Religious" },
  { name: "Islam Channel Urdu", url: "https://live-islamtv-urdu.simplestreamcdn.com/live13/islamtv_urdu/bitrate1.isml/live.m3u8", country: "International", category: "Religious" },
  { name: "Al Madina", url: "https://streaming.zaytonatube.com:8081/AlMadinatv/almadina21/tracks-a1/index.fmp4.m3u8", country: "Palestine", category: "Religious" },
  { name: "TV Muslim Thailand", url: "https://vdo.plathong.net/tvmuslim/tvmuslim/playlist.m3u8", country: "International", category: "Religious" },
];

const existing = JSON.parse(fs.readFileSync(`${ROOT}/channels.json`, "utf8"));
const byUrl = new Map();

for (const ch of existing) {
  if (!ch.url || !ch.name) continue;
  if (isShiaChannel(ch.name, ch.url)) continue;
  if (isChristianChannel(ch.name, ch.url)) continue;
  const name = cleanName(ch.name);
  const country = getCountry(name, ch.group);
  const category = getCategory(name, ch.group);
  byUrl.set(ch.url, applyGroupFields({
    name,
    url: ch.url,
    country,
    category,
    format: ch.format || getFormat(ch.url),
    verified: ch.verified !== false,
  }));
}

for (const e of extras) {
  if (!byUrl.has(e.url)) {
    byUrl.set(e.url, applyGroupFields({
      name: e.name,
      url: e.url,
      country: e.country,
      category: e.category,
      format: getFormat(e.url),
      verified: e.verified !== false,
    }));
  }
}

// Merge by normalized name
const byName = new Map();
for (const ch of byUrl.values()) {
  const key = nameKey(ch.name.replace(/\s*\((alt|cdn|ottera|mangomolo|globecast|direct|kwikmotion|taghtia|dash|alkass)\)\s*/i, ""));
  if (!byName.has(key)) {
    byName.set(key, []);
  }
  byName.get(key).push(ch);
}

function score(ch) {
  let s = 0;
  if (ch.format === "HLS") s += 12;
  else if (ch.format === "DASH") s += 6;
  else if (ch.format === "MPEG-TS") s += 4;
  else if (ch.format === "MP4") s += 3;
  if (ch.url.startsWith("https://")) s += 5;
  if (ch.verified !== false) s += 3;
  if (!/\(alt\)|\(cdn\)|\(ottera\)|\(mangomolo\)|\(globecast\)|\(direct\)|\(kwikmotion\)|\(taghtia\)|\(dash\)|\(alkass\)/i.test(ch.name)) s += 2;
  return s;
}

const final = [];
for (const entries of byName.values()) {
  entries.sort((a, b) => score(b) - score(a));
  const primary = entries[0];
  const alt_urls = [...new Set(entries.slice(1).map((e) => e.url).filter((u) => u !== primary.url))];
  const item = applyGroupFields({
    name: primary.name.replace(/\s*\((alt|cdn|ottera|mangomolo|globecast|direct|kwikmotion|taghtia|dash|alkass)\)\s*/i, ""),
    url: primary.url,
    country: primary.country,
    category: primary.category,
    format: primary.format,
  });
  if (alt_urls.length) item.alt_urls = alt_urls;
  if (primary.verified === false || entries.some((e) => e.verified === false)) item.verified = false;
  final.push(item);
}

final.sort((a, b) => {
  if (a.group === "Radio" && b.group !== "Radio") return 1;
  if (b.group === "Radio" && a.group !== "Radio") return -1;
  const c = a.group.localeCompare(b.group);
  if (c) return c;
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

const jsonContent = JSON.stringify(final, null, 2) + "\n";
const repoRoot = getRepoRoot();

const m3u = ["#EXTM3U", ""];
for (const ch of final) {
  m3u.push(`#EXTINF:-1,${ch.name}`);
  m3u.push(`#EXTGRP:${ch.group}`);
  m3u.push(ch.url);
  if (ch.alt_urls) {
    ch.alt_urls.forEach((alt, index) => {
      m3u.push(`#EXTINF:-1,${ch.name} (Alt ${index + 1})`);
      m3u.push(`#EXTGRP:${ch.group}`);
      m3u.push(alt);
    });
  }
  m3u.push("");
}
const m3uContent = m3u.join("\n");

fs.writeFileSync(path.join(repoRoot, "channels.json"), jsonContent);
fs.writeFileSync(path.join(repoRoot, "MyArabicTV.m3u"), m3uContent);
syncOutputs(repoRoot, jsonContent, m3uContent);
console.log(`Synced outputs to m3u/ mirror paths under ${repoRoot}`);

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

const fmtCounts = {};
for (const c of final) {
  fmtCounts[c.format] = (fmtCounts[c.format] || 0) + 1;
  if (c.alt_urls) {
    for (const u of c.alt_urls) {
      const f = getFormat(u);
      fmtCounts[`alt:${f}`] = (fmtCounts[`alt:${f}`] || 0) + 1;
    }
  }
}
console.log("--- Formats ---");
Object.entries(fmtCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${v} ${k}`));
