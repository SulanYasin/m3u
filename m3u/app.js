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
    document.querySelectorAll(".channel-btn").forEach((btn, i) => {
      btn.classList.toggle("active", i === index);
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

  function renderChannels() {
    channelListEl.innerHTML = "";

    channels.forEach((channel, index) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "channel-btn";
      btn.innerHTML = `<span class="play-icon" aria-hidden="true">▶</span><span>${channel.name}</span>`;
      btn.addEventListener("click", () => playChannel(channel, index));
      li.appendChild(btn);
      channelListEl.appendChild(li);
    });
  }

  function buildM3u(list) {
    const lines = ["#EXTM3U", ""];
    list.forEach((channel) => {
      lines.push(`#EXTINF:-1,${channel.name}`);
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
