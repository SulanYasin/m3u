(() => {
  const channelListEl = document.getElementById("channel-list");
  const playerEl = document.getElementById("player");
  const nowPlayingEl = document.getElementById("now-playing");
  const downloadBtn = document.getElementById("download-btn");
  const statusEl = document.getElementById("status");

  let channels = [];
  let hls = null;
  let activeIndex = -1;

  function setStatus(message, isError = false) {
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.classList.remove("error");
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  function playChannel(channel, index) {
    destroyHls();
    playerEl.removeAttribute("src");
    playerEl.load();

    activeIndex = index;
    nowPlayingEl.textContent = `Now playing: ${channel.name}`;
    document.querySelectorAll(".channel-btn").forEach((btn) => {
      const isActive = Number(btn.dataset.index) === index;
      btn.classList.toggle("active", isActive);
      if (isActive) {
        btn.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });

    const url = channel.url;

    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(url);
      hls.attachMedia(playerEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        playerEl.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setStatus(`Could not play ${channel.name}. Stream may be offline.`, true);
        }
      });
      return;
    }

    if (playerEl.canPlayType("application/vnd.apple.mpegurl")) {
      playerEl.src = url;
      playerEl.addEventListener(
        "loadedmetadata",
        () => {
          playerEl.play().catch(() => {});
        },
        { once: true }
      );
      return;
    }

    setStatus("HLS playback is not supported in this browser.", true);
  }

  function getGroup(channel) {
    if (channel.category === "Radio" || channel.group === "Radio") return "Radio";
    if (channel.country) return channel.country;
    if (channel.group) {
      // Legacy "Country | Category" → Country only
      return channel.group.includes("|")
        ? channel.group.split("|")[0].trim()
        : channel.group;
    }
    return "Other";
  }

  function renderChannels() {
    channelListEl.innerHTML = "";

    const byGroup = new Map();
    channels.forEach((channel, index) => {
      const group = getGroup(channel);
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group).push({ channel, index });
    });

    const groups = Array.from(byGroup.keys()).sort((a, b) => {
      if (a === "Radio") return 1;
      if (b === "Radio") return -1;
      return a.localeCompare(b);
    });

    groups.forEach((group) => {
      const header = document.createElement("li");
      header.className = "group-header";
      header.textContent = group;
      channelListEl.appendChild(header);

      byGroup.get(group).forEach(({ channel, index }) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "channel-btn";
        btn.dataset.index = String(index);
        const unverified = channel.verified === false ? ' <span class="unverified">offline?</span>' : "";
        btn.innerHTML = `<span class="play-icon" aria-hidden="true">▶</span><span>${channel.name}${unverified}</span>`;
        btn.addEventListener("click", () => playChannel(channel, index));
        btn.addEventListener("focus", () => {
          btn.scrollIntoView({ block: "nearest", inline: "nearest" });
        });
        li.appendChild(btn);
        channelListEl.appendChild(li);
      });
    });
  }

  function buildM3u(list) {
    // SS IPTV (and many Smart TV players) ignore group-title attributes and
    // show them as part of the channel name. Use #EXTGRP for folders instead.
    const lines = ["#EXTM3U", ""];
    list.forEach((channel) => {
      const group = getGroup(channel);
      lines.push(`#EXTINF:-1,${channel.name}`);
      lines.push(`#EXTGRP:${group}`);
      lines.push(channel.url);
      lines.push("");
    });
    return lines.join("\n");
  }

  function downloadPlaylist() {
    if (!channels.length) {
      setStatus("No channels to export.", true);
      return;
    }

    const content = buildM3u(channels);
    const blob = new Blob([content], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MyArabicTV.m3u";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function init() {
    downloadBtn.addEventListener("click", downloadPlaylist);

    try {
      const response = await fetch("channels.json");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      channels = await response.json();
      if (!Array.isArray(channels) || channels.length === 0) {
        throw new Error("channels.json is empty");
      }
      renderChannels();
      setStatus(`${channels.length} channels loaded`);
    } catch (err) {
      setStatus(
        "Failed to load channels.json. Serve this folder over HTTP (e.g. npx serve .).",
        true
      );
      console.error(err);
    }
  }

  init();
})();
