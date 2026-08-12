document.addEventListener('DOMContentLoaded', () => {
  const players = document.querySelectorAll('.inline-audio-player');
  if (players.length === 0) return;

  const formatTime = (sec) => {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  let activeDrag = null;
  const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

  const onDragMove = (e) => {
    if (!activeDrag) return;
    const { audio, progressFill, progressContainer } = activeDrag;
    if (!audio.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    let percent = (getClientX(e) - rect.left) / rect.width;
    percent = Math.max(0, Math.min(percent, 1));
    audio.currentTime = percent * audio.duration;
    progressFill.style.width = `${percent * 100}%`;
  };

  const onDragEnd = () => {
    if (!activeDrag) return;
    activeDrag.progressFill.style.transition = '';
    activeDrag = null;
  };

  window.addEventListener('mousemove', onDragMove, { passive: true });
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchmove', onDragMove, { passive: true });
  window.addEventListener('touchend', onDragEnd);

  const clamp = (v) => Math.max(0, Math.min(1, v));

  const fadeIn = (audio, targetVol, rafRef) => {
    cancelAnimationFrame(rafRef.id);
    audio.volume = 0;
    const start = performance.now();
    const tick = (now) => {
      const vol = clamp((now - start) / 100 * targetVol);
      audio.volume = vol;
      if (vol < targetVol) rafRef.id = requestAnimationFrame(tick);
    };
    rafRef.id = requestAnimationFrame(tick);
  };

  const fadeOutAndPause = (audio, rafRef) => {
    cancelAnimationFrame(rafRef.id);
    const startVol = audio.volume;
    const start = performance.now();
    const tick = (now) => {
      const vol = clamp(startVol * (1 - (now - start) / 100));
      audio.volume = vol;
      if (vol > 0) {
        rafRef.id = requestAnimationFrame(tick);
      } else {
        audio.pause();
        audio.volume = 1;
      }
    };
    rafRef.id = requestAnimationFrame(tick);
  };

  const hasHover = matchMedia('(hover: hover)').matches;

  players.forEach(player => {
    const src = player.dataset.src;
    const audio = new Audio(src);
    audio.preload = 'metadata';
    const fadeRAF = { id: null };

    const playBtn = player.querySelector('.inline-audio-play-btn');
    const iconPlay = player.querySelector('.inline-audio-icon-play');
    const iconPause = player.querySelector('.inline-audio-icon-pause');
    const titleEl = player.querySelector('.inline-audio-title');
    const titleWrapper = player.querySelector('.inline-audio-title-wrapper');
    const timeEl = player.querySelector('.inline-audio-time');
    const progressFill = player.querySelector('.inline-audio-progress-fill');
    const progressContainer = player.querySelector('.inline-audio-progress-container');

    const setPlaying = (playing) => {
      if (playing) {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
        player.classList.add('is-playing');
      } else {
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
        player.classList.remove('is-playing');
      }
    };

    let marqueeFromPos = 0;

    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        players.forEach(other => {
          if (other !== player && other.classList.contains('is-playing')) {
            const otherBtn = other.querySelector('.inline-audio-play-btn');
            if (otherBtn) otherBtn.click();
          }
        });
        setPlaying(true);
        startMarquee(marqueeFromPos);
        fadeIn(audio, 1, fadeRAF);
        audio.play().catch(err => console.warn('Audio playback failed:', err));
      } else {
        marqueeFromPos = captureMarqueePos();
        stopMarquee();
        setPlaying(false);
        fadeOutAndPause(audio, fadeRAF);
      }
    });

    audio.addEventListener('pause', () => {
      setPlaying(false);
      stopMarquee();
    });
    audio.addEventListener('ended', () => {
      setPlaying(false);
      stopMarquee();
      titleEl.style.transform = '';
      audio.currentTime = 0;
      progressFill.style.width = '0%';
      timeEl.textContent = `0:00 / ${formatTime(audio.duration)}`;
      audio.volume = 1;
    });

    let marqueeRAF = null;
    let marqueeRunning = false;
    let marqueeStartTime = 0;
    let marqueePaused = false;
    let marqueePauseStart = 0;

    const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const easeInOutInv = (p) => p < 0.5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2);

    const startMarquee = (fromPos = 0) => {
      stopMarquee();
      marqueeRunning = true;
      marqueeFromPos = 0;

      const overspill = titleEl.scrollWidth - titleWrapper.clientWidth;
      if (overspill <= 0) {
        titleEl.style.transform = '';
        return;
      }

      const totalDur = Math.max(6, overspill * 0.05) * 1000;
      const hold0 = totalDur * 0.05;
      const leftDur = totalDur * 0.40;
      const holdEnd = totalDur * 0.10;
      const rightDur = totalDur * 0.40;

      marqueeStartTime = performance.now();
      if (fromPos < 0) {
        const p = Math.abs(fromPos) / overspill;
        marqueeStartTime -= hold0 + easeInOutInv(p) * leftDur;
      }

      const tick = (now) => {
        if (!marqueeRunning) return;
        if (marqueePaused) {
          marqueeRAF = requestAnimationFrame(tick);
          return;
        }
        const elapsed = (now - marqueeStartTime) % totalDur;
        let p;

        if (elapsed < hold0) {
          p = 0;
        } else if (elapsed < hold0 + leftDur) {
          p = easeInOut((elapsed - hold0) / leftDur);
        } else if (elapsed < hold0 + leftDur + holdEnd) {
          p = 1;
        } else if (elapsed < hold0 + leftDur + holdEnd + rightDur) {
          p = 1 - easeInOut((elapsed - hold0 - leftDur - holdEnd) / rightDur);
        } else {
          p = 0;
        }

        titleEl.style.transform = `translateX(${-p * overspill}px)`;
        marqueeRAF = requestAnimationFrame(tick);
      };

      marqueeRAF = requestAnimationFrame(tick);
    };

    const stopMarquee = () => {
      marqueeRunning = false;
      if (marqueeRAF) {
        cancelAnimationFrame(marqueeRAF);
        marqueeRAF = null;
      }
    };

    const captureMarqueePos = () => {
      const matrix = getComputedStyle(titleEl).transform;
      const match = matrix.match(/matrix\(([^)]+)\)/);
      if (match) {
        const v = match[1].split(',').map(parseFloat);
        return v[4] || 0;
      }
      return 0;
    };

    // 桌面端鼠标悬停在标题时暂停滚动
    if (hasHover) {
      titleWrapper.addEventListener('mouseenter', () => {
        marqueePaused = true;
        marqueePauseStart = performance.now();
      });
      titleWrapper.addEventListener('mouseleave', () => {
        if (marqueePaused) {
          marqueePaused = false;
          marqueeStartTime += performance.now() - marqueePauseStart;
        }
      });
    }

    audio.addEventListener('timeupdate', () => {
      const cur = audio.currentTime;
      const dur = audio.duration;
      timeEl.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      if ((!activeDrag || activeDrag.audio !== audio) && dur) {
        progressFill.style.width = `${(cur / dur) * 100}%`;
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      timeEl.textContent = `0:00 / ${formatTime(audio.duration)}`;
    });

    const onDragStart = (e) => {
      progressFill.style.transition = 'none';
      activeDrag = { audio, progressFill, progressContainer };
      if (audio.duration) {
        const rect = progressContainer.getBoundingClientRect();
        let percent = (getClientX(e) - rect.left) / rect.width;
        percent = Math.max(0, Math.min(percent, 1));
        audio.currentTime = percent * audio.duration;
        progressFill.style.width = `${percent * 100}%`;
      }
    };

    progressContainer.addEventListener('mousedown', onDragStart);
    progressContainer.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onDragStart(e);
    }, { passive: false });
  });
});
