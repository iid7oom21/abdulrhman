(() => {
  "use strict";
  const player = document.querySelector("#film-player");
  const stage = document.querySelector(".film-stage");
  const playButton = document.querySelector(".film-play");
  const status = document.querySelector("#playback-status");
  const soundButton = document.querySelector("#sound-toggle");
  const filmDownload = document.querySelector("#film-download");
  const formatButtons = [...document.querySelectorAll("[data-format]")];
  let currentFormat = "landscape";
  player.volume = 0.65;

  playButton.addEventListener("click", async () => {
    try {
      await player.play();
    } catch {
      status.textContent =
        "تعذّر بدء التشغيل. جرّب عناصر تحكم الفيديو أو حمّل النسخة مباشرة.";
    }
  });
  player.addEventListener("play", () => {
    playButton.hidden = true;
    status.textContent = player.muted
      ? "الفيلم يعمل دون صوت. يمكنك تفعيل الأجواء الصوتية."
      : "الفيلم يعمل مع الأجواء الصوتية.";
  });
  player.addEventListener("ended", () => {
    playButton.hidden = false;
    status.textContent = "انتهى الفيلم. يمكنك مشاهدته مجددًا أو تحميله.";
  });
  player.addEventListener("error", () => {
    playButton.hidden = true;
    status.textContent =
      "تعذّر تحميل الفيديو. استخدم رابط التحميل أسفل المشغّل.";
  });
  const syncSound = () => {
    const audible = !player.muted && player.volume > 0;
    soundButton.setAttribute("aria-pressed", String(audible));
    soundButton.textContent = audible ? "كتم الصوت −" : "تفعيل الصوت ＋";
    status.textContent = audible ? "الأجواء الصوتية مفعّلة." : "الصوت مغلق.";
  };
  player.addEventListener("volumechange", syncSound);
  soundButton.addEventListener("click", () => {
    if (player.volume === 0) {
      player.volume = 0.65;
      player.muted = false;
    } else {
      player.muted = !player.muted;
    }
    syncSound();
  });
  for (const button of formatButtons) {
    button.addEventListener("click", () => {
      const format = button.dataset.format;
      if (format === currentFormat) return;
      currentFormat = format;
      player.pause();
      player.src = `media/raven-${format}.mp4`;
      player.poster = `media/poster-${format}.webp`;
      player.setAttribute(
        "aria-label",
        `فيلم RAVEN القصير، النسخة ${format === "landscape" ? "الأفقية" : "العمودية"}`,
      );
      player.load();
      playButton.hidden = false;
      stage.dataset.layout = format;
      for (const item of formatButtons)
        item.setAttribute("aria-pressed", String(item === button));
      filmDownload.href = `media/raven-${format}.mp4`;
      filmDownload.firstChild.textContent = `تحميل النسخة ${format === "landscape" ? "الأفقية" : "العمودية"} `;
      status.textContent = "النسخة جاهزة. اضغط تشغيل للمشاهدة.";
    });
  }

  const dialog = document.querySelector("#scene-viewer");
  const image = document.querySelector("#viewer-image");
  const title = document.querySelector("#viewer-title");
  const count = document.querySelector("#viewer-count");
  const download = document.querySelector("#viewer-download");
  const openButtons = [...document.querySelectorAll(".scene-open")];
  let selected = 0;
  let lastTrigger = null;
  function showScene(index) {
    selected = (index + openButtons.length) % openButtons.length;
    const card = openButtons[selected].closest(".scene-card");
    image.src = card.querySelector("a[download]").getAttribute("href");
    image.alt = card.querySelector("img").alt;
    title.textContent = card.querySelector("h3").textContent;
    count.textContent = `${String(selected + 1).padStart(2, "0")} / 04`;
    download.href = image.src;
    download.download = image.src.split("/").pop();
  }
  for (const button of openButtons) {
    button.addEventListener("click", () => {
      lastTrigger = button;
      showScene(Number(button.dataset.scene));
      if (!player.paused) player.pause();
      dialog.showModal();
      document.body.classList.add("modal-open");
    });
  }
  document
    .querySelector("#viewer-close")
    .addEventListener("click", () => dialog.close());
  document
    .querySelector("#viewer-prev")
    .addEventListener("click", () => showScene(selected - 1));
  document
    .querySelector("#viewer-next")
    .addEventListener("click", () => showScene(selected + 1));
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showScene(selected + (event.key === "ArrowLeft" ? 1 : -1));
    }
  });
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    lastTrigger?.focus({ preventScroll: true });
  });
})();
