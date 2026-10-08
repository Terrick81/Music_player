"use strict";

const audio = document.querySelector("#audio");
const video = document.querySelector("#video");
const miniPlayer = document.querySelector("#mini-player");
const playerScreen = document.querySelector("#player-screen");
const $ = (selector) => document.querySelector(selector);

let playlist = null;
let currentTrack = null;
let playQueue = [];
let queueIndex = -1;
let shuffleEnabled = false;
let switchingTrack = false;

const icons = {
  play: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor"
        d="M6 4.9c0-.7.8-1.1 1.4-.7l9 5.1a.8.8 0 0 1 0 1.4l-9 5.1c-.6.4-1.4 0-1.4-.7V4.9Z"></path>
    </svg>`,
  pause: `
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor"
        d="M8.25 3.09v13.82a.415.415 0 0 1-.417.416H4.81a.415.415 0 0 1-.417-.416V3.09a.415.415 0 0 1 .417-.416h3.023a.415.415 0 0 1 .416.416m7.358 0v13.82a.415.415 0 0 1-.417.416h-3.022a.416.416 0 0 1-.417-.416V3.09a.415.415 0 0 1 .417-.416h3.022a.415.415 0 0 1 .417.416"></path>
    </svg>`,
  previous: `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor"
        d="M12.798 4.025a.33.33 0 0 0-.342.016L7.503 7.332V4.318a.33.33 0 0 0-.176-.293.33.33 0 0 0-.342.016l-5.54 3.681a.33.33 0 0 0-.15.278c0 .106.05.212.15.278l5.54 3.681c.11.074.24.071.342.016a.33.33 0 0 0 .176-.293V8.668l4.953 3.291c.11.074.24.071.341.016a.33.33 0 0 0 .176-.293V4.318a.33.33 0 0 0-.176-.293"></path>
    </svg>`,
  next: `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor"
        d="M3.202 4.025a.33.33 0 0 1 .342.016l4.953 3.291V4.318a.33.33 0 0 1 .176-.293.33.33 0 0 1 .342.016l5.54 3.681a.33.33 0 0 1 .15.278c0 .106-.05.212-.15.278l-5.54 3.681a.33.33 0 0 1-.342.016.33.33 0 0 1-.176-.293V8.668l-4.953 3.291a.33.33 0 0 1-.341.016.33.33 0 0 1-.176-.293V4.318a.33.33 0 0 1 .176-.293"></path>
    </svg>`,
  shuffle: `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`,
  download: `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`,
  close: `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6.5 9 5.5 5.5L17.5 9"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`
};

$("#mini-play").innerHTML = icons.play;
$("#full-play").innerHTML = icons.play;
$("#previous-track").innerHTML = icons.previous;
$("#full-previous").innerHTML = icons.previous;
$("#next-track").innerHTML = icons.next;
$("#full-next").innerHTML = icons.next;
$("#mini-shuffle").innerHTML = icons.shuffle;
$("#full-shuffle").innerHTML = icons.shuffle;
$("#download-track").innerHTML = icons.download;
$("#close-player").innerHTML = icons.close;

function setImage(img, path) {
  if (!img) return;

  if (!path) {
    img.removeAttribute("src");
    return;
  }

  img.onerror = () => {
    console.warn("Не найдена обложка:", path);
    img.removeAttribute("src");
  };

  img.src = new URL(path, document.baseURI).href;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function parseDuration(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) return null;

  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];

  return null;
}

function displayDuration(value) {
  if (typeof value === "string" && value.trim()) return value.trim();

  const seconds = parseDuration(value);
  return seconds === null ? "--:--" : formatTime(seconds);
}

function getDurationSeconds() {
  const jsonDuration = parseDuration(currentTrack?.duration);
  if (jsonDuration !== null) return jsonDuration;

  return Number.isFinite(audio.duration) ? audio.duration : null;
}

function updateTimeline(input, current, duration) {
  if (!input) return;

  const percent = duration > 0
    ? Math.max(0, Math.min(100, current / duration * 100))
    : 0;

  input.value = String(Math.round(percent * 10));
  input.style.setProperty("--progress", `${percent}%`);
}

function setPlayButtons(playing) {
  const icon = playing ? icons.pause : icons.play;

  $("#mini-play").innerHTML = icon;
  $("#full-play").innerHTML = icon;
  $("#mini-play").setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");
  $("#full-play").setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");

  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }
}

function shuffleTracks(tracks) {
  const result = [...tracks];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function updateShuffleButtons() {
  for (const button of [$("#mini-shuffle"), $("#full-shuffle")]) {
    button.classList.toggle("active", shuffleEnabled);
    button.setAttribute("aria-pressed", String(shuffleEnabled));
    button.setAttribute(
      "aria-label",
      shuffleEnabled ? "Выключить перемешивание" : "Перемешать треки"
    );
    button.title = shuffleEnabled
      ? "Выключить перемешивание"
      : "Перемешать треки";
  }
}

function setQueueForTrack(track) {
  if (!playlist?.tracks?.length) return;

  if (shuffleEnabled) {
    playQueue = [
      track,
      ...shuffleTracks(playlist.tracks.filter((item) => item !== track))
    ];
    queueIndex = 0;
  } else {
    playQueue = [...playlist.tracks];
    queueIndex = playQueue.indexOf(track);
  }
}

function setMediaAction(action, handler) {
  if (!("mediaSession" in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Некоторые браузеры не поддерживают все действия Media Session.
  }
}

function updateMediaPosition() {
  if (!("mediaSession" in navigator)) return;

  const duration = getDurationSeconds();
  if (!Number.isFinite(duration) || duration <= 0) return;

  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime || 0, duration)
    });
  } catch {
    // Браузер может не поддерживать отображение позиции.
  }
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || !track) return;

  const imagePath = track.cover || playlist?.cover;
  const artwork = imagePath
    ? [{ src: new URL(imagePath, document.baseURI).href, sizes: "512x512" }]
    : [];

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "Без названия",
      album: "Библиотека СВА",
      artwork
    });

    navigator.mediaSession.playbackState = "playing";
  } catch (error) {
    console.warn("Не удалось обновить данные экрана блокировки:", error);
  }

  setMediaAction("play", () => audio.play().catch(() => {}));
  setMediaAction("pause", () => audio.pause());
  setMediaAction("previoustrack", () => changeTrack(-1));
  setMediaAction("nexttrack", () => changeTrack(1));
  setMediaAction("seekto", (details) => {
    if (Number.isFinite(details.seekTime)) {
      audio.currentTime = details.seekTime;
    }
  });

  updateMediaPosition();
}

function renderPlaylist(data) {
  if (!data || !Array.isArray(data.tracks)) {
    throw new Error("В playlist.json не найден массив tracks.");
  }

  playlist = data;
  document.title = "Библиотека СВА";
  $("#playlist-title").textContent = "Библиотека СВА";
  setImage($("#cover"), data.cover);

  const groups = new Map();

  for (const track of data.tracks) {
    const year = track.year ? String(track.year) : "Без года";
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(track);
  }

  const years = [...groups.keys()].sort((a, b) => {
    if (a === "Без года") return 1;
    if (b === "Без года") return -1;
    return Number(b) - Number(a);
  });

  const list = $("#track-list");
  list.replaceChildren();

  for (const year of years) {
    const heading = document.createElement("h2");
    heading.className = "year-heading";
    heading.textContent = year;
    list.append(heading);

    for (const track of groups.get(year)) {
      const row = document.createElement("button");
      row.className = "track";
      row.type = "button";

      const image = document.createElement("img");
      image.className = "track-cover";
      image.alt = "";
      setImage(image, track.cover || data.cover);

      const info = document.createElement("span");
      info.className = "track-info";

      const title = document.createElement("span");
      title.className = "track-title";
      title.textContent = track.title || "Без названия";

      const duration = document.createElement("span");
      duration.className = "track-duration";
      duration.textContent = displayDuration(track.duration);

      info.append(title);
      row.append(image, info, duration);
      row.addEventListener("click", () => selectTrack(track));
      list.append(row);
    }
  }

  $("#message").textContent =
    data.tracks.length ? "" : "В библиотеке пока нет треков.";

  updateShuffleButtons();
}

function selectTrack(track, fromQueue = false) {
  if (!track?.audio) {
    $("#message").textContent = "У этого трека не указан путь к аудиофайлу.";
    return;
  }

  switchingTrack = true;
  currentTrack = track;

  if (!fromQueue) setQueueForTrack(track);

  // Обновляем карточку блокировки до смены аудиоисточника.
  updateMediaSession(track);

  audio.pause();
  video.pause();
  video.removeAttribute("src");
  video.load();
  $("#video-wrap").classList.remove("visible");

  audio.src = new URL(track.audio, document.baseURI).href;
  audio.load();

  const title = track.title || "Без названия";
  const coverPath = track.cover || playlist?.cover;

  $("#mini-title").textContent = title;
  $("#full-title").textContent = title;
  setImage($("#mini-cover"), coverPath);
  setImage($("#big-cover"), coverPath);

  const download = $("#download-track");
  download.href = new URL(track.audio, document.baseURI).href;
  download.download = track.audio.split("/").pop().split("\\").pop();
  download.setAttribute("aria-disabled", "false");

  const clipSection = $("#clip-section");

if (track.video) {
  video.src = new URL(track.video, document.baseURI).href;
  video.load();
  clipSection.hidden = false;
} else {
  video.removeAttribute("src");
  video.load();
  clipSection.hidden = true;
}
  miniPlayer.hidden = false;
  $("#mini-time").textContent = `0:00 / ${displayDuration(track.duration)}`;
  $("#full-current-time").textContent = "0:00";
  $("#full-duration").textContent = displayDuration(track.duration);

  updateTimeline($("#mini-progress"), 0, getDurationSeconds());
  updateTimeline($("#full-progress"), 0, getDurationSeconds());

  audio.play().then(
    () => {
      switchingTrack = false;
      setPlayButtons(true);
      updateMediaSession(track);
    },
    (error) => {
      switchingTrack = false;
      console.warn("Воспроизведение не запустилось:", error);
      setPlayButtons(false);
    }
  );
}

function togglePlayback() {
  if (!currentTrack) return;

  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function changeTrack(direction) {
  if (!playlist?.tracks?.length) return;

  if (!playQueue.length) {
    playQueue = [...playlist.tracks];
    queueIndex = -1;
  }

  if (queueIndex < 0) {
    queueIndex = direction > 0 ? 0 : playQueue.length - 1;
  } else {
    queueIndex = (queueIndex + direction + playQueue.length) % playQueue.length;
  }

  selectTrack(playQueue[queueIndex], true);
}

function toggleShuffle() {
  shuffleEnabled = !shuffleEnabled;

  if (playlist?.tracks?.length) {
    if (shuffleEnabled && currentTrack) {
      playQueue = [
        currentTrack,
        ...shuffleTracks(
          playlist.tracks.filter((item) => item !== currentTrack)
        )
      ];
      queueIndex = 0;
    } else if (shuffleEnabled) {
      playQueue = shuffleTracks(playlist.tracks);
      queueIndex = -1;
    } else {
      playQueue = [...playlist.tracks];
      queueIndex = currentTrack ? playQueue.indexOf(currentTrack) : -1;
    }
  }

  updateShuffleButtons();
}

function updateProgress() {
  const current = audio.currentTime || 0;
  const duration = getDurationSeconds();

  $("#mini-time").textContent =
    `${formatTime(current)} / ${displayDuration(currentTrack?.duration)}`;
  $("#full-current-time").textContent = formatTime(current);
  $("#full-duration").textContent = displayDuration(currentTrack?.duration);

  updateTimeline($("#mini-progress"), current, duration);
  updateTimeline($("#full-progress"), current, duration);
  updateMediaPosition();
}

function seek(event) {
  const duration = getDurationSeconds();
  if (!duration || duration <= 0) return;

  audio.currentTime = Number(event.currentTarget.value) / 1000 * duration;
  updateProgress();
}

function openPlayer() {
  if (!currentTrack) return;

  playerScreen.classList.add("open");
  playerScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("player-open");
}

function closePlayer() {
  playerScreen.classList.remove("open");
  playerScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("player-open");
  video.pause();
}

$("#mini-play").addEventListener("click", togglePlayback);
$("#full-play").addEventListener("click", togglePlayback);

$("#previous-track").addEventListener("click", () => changeTrack(-1));
$("#full-previous").addEventListener("click", () => changeTrack(-1));
$("#next-track").addEventListener("click", () => changeTrack(1));
$("#full-next").addEventListener("click", () => changeTrack(1));

$("#mini-shuffle").addEventListener("click", toggleShuffle);
$("#full-shuffle").addEventListener("click", toggleShuffle);

$("#mini-progress").addEventListener("input", seek);
$("#full-progress").addEventListener("input", seek);

$("#open-player").addEventListener("click", openPlayer);
$("#open-player").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openPlayer();
  }
});

$("#close-player").addEventListener("click", closePlayer);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && playerScreen.classList.contains("open")) {
    closePlayer();
  }
});


audio.addEventListener("play", () => {
  switchingTrack = false;
  setPlayButtons(true);
});

audio.addEventListener("pause", () => {
  if (!switchingTrack) setPlayButtons(false);
});

audio.addEventListener("loadedmetadata", updateProgress);
audio.addEventListener("durationchange", updateProgress);
audio.addEventListener("timeupdate", updateProgress);

audio.addEventListener("ended", () => {
  if (playlist?.tracks?.length) {
    changeTrack(1);
  } else {
    setPlayButtons(false);
  }
});

video.addEventListener("play", () => audio.pause());

fetch("playlist.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) {
      throw new Error(
        `Не удалось загрузить playlist.json (HTTP ${response.status}).`
      );
    }

    return response.json();
  })
  .then(renderPlaylist)
  .catch((error) => {
    console.error(error);
    $("#message").textContent =
      `${error.message} Проверь, что playlist.json лежит рядом с index.html и содержит корректный JSON.`;
  });