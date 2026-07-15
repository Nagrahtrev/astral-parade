document.addEventListener('DOMContentLoaded', () => {
    const playBtns = document.querySelectorAll('.track-play-btn');
    if (playBtns.length === 0) return;

    const playerUI = document.getElementById('floating-player');
    if (!playerUI) return;
    document.body.appendChild(playerUI);

    const globalAudio = new Audio();
    let currentPlayIndex = -1;

    const tracks = Array.from(playBtns).map((btn, idx) => {
        btn.dataset.playIdx = idx;
        return { btn, url: btn.dataset.audio, title: btn.dataset.title };
    });

    const pTitle = document.getElementById('player-title');
    const pTime = document.getElementById('player-time');
    const pProgContainer = document.getElementById('player-progress-container');
    const pProgBar = document.getElementById('player-progress-bar');
    const iconPPlay = document.getElementById('player-icon-play');
    const iconPPause = document.getElementById('player-icon-pause');

    const formatTime = (sec) => {
        if (isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const syncPlayerUI = (isPlaying) => {
        if (isPlaying) {
        iconPPlay.classList.add('hidden');
        iconPPause.classList.remove('hidden');
        } else {
        iconPPlay.classList.remove('hidden');
        iconPPause.classList.add('hidden');
        }
    };

    const loadAndPlay = (index) => {
        if (currentPlayIndex >= 0 && currentPlayIndex !== index) {
        tracks[currentPlayIndex].btn.classList.remove('is-playing');
        }
        currentPlayIndex = index;
        const track = tracks[index];
        globalAudio.src = track.url;

        globalAudio.play().catch(err => {
        console.warn('Failed to load player:', err);
        syncPlayerUI(false);
        });
        
        playerUI.classList.remove('-translate-y-[200%]', 'opacity-0');
        pTitle.textContent = track.title;
        pTitle.style.animation = 'none';
        
        requestAnimationFrame(() => {
            const pTitleWrapper = document.getElementById('player-title-wrapper');
            const overspill = pTitle.scrollWidth - pTitleWrapper.clientWidth;
            
            if (overspill > 0) {
                let styleEl = document.getElementById('dynamic-marquee');
                if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'dynamic-marquee';
                document.head.appendChild(styleEl);
                }
                
                styleEl.innerHTML = `
                @keyframes customBounce {
                    0%, 15% { transform: translateX(0); }
                    45%, 55% { transform: translateX(-${overspill}px); }
                    85%, 100% { transform: translateX(0); }
                }
                `;
                
                const duration = Math.max(7, overspill * 0.06);
                pTitle.style.animation = `customBounce ${duration}s ease-in-out infinite`;
            }
        });  
    };

    playBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.playIdx);
            if (currentPlayIndex === idx) {
                globalAudio.paused ? globalAudio.play() : globalAudio.pause();
            } else {
                loadAndPlay(idx);
            }
        });
    });

    document.getElementById('player-play-pause').addEventListener('click', () => {
        if (currentPlayIndex < 0) return;
        if (globalAudio.paused) {
            globalAudio.play().catch(e => console.warn('播放失败', e));
        } else {
            globalAudio.pause();
        }
    });

    document.getElementById('player-prev').addEventListener('click', () => {
        if (currentPlayIndex > 0) loadAndPlay(currentPlayIndex - 1);
        else loadAndPlay(tracks.length - 1);
    });

    document.getElementById('player-next').addEventListener('click', () => {
        if (currentPlayIndex < tracks.length - 1) loadAndPlay(currentPlayIndex + 1);
        else loadAndPlay(0);
    });

    document.getElementById('player-close').addEventListener('click', () => {
        globalAudio.pause();
        playerUI.classList.add('-translate-y-[200%]', 'opacity-0');
        if (currentPlayIndex >= 0) tracks[currentPlayIndex].btn.classList.remove('is-playing');
        currentPlayIndex = -1;
    });

    globalAudio.addEventListener('play', () => {
        if (currentPlayIndex >= 0) tracks[currentPlayIndex].btn.classList.add('is-playing');
        syncPlayerUI(true);
    });

    globalAudio.addEventListener('pause', () => {
        if (currentPlayIndex >= 0) tracks[currentPlayIndex].btn.classList.remove('is-playing');
        syncPlayerUI(false);
    });

    globalAudio.addEventListener('timeupdate', () => {
        const cur = globalAudio.currentTime;
        const dur = globalAudio.duration;
        pTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        if (dur) pProgBar.style.width = `${(cur / dur) * 100}%`;
    });

    globalAudio.addEventListener('ended', () => {
        if (currentPlayIndex < tracks.length - 1) {
        loadAndPlay(currentPlayIndex + 1);
        } else {
        syncPlayerUI(false);
        tracks[currentPlayIndex].btn.classList.remove('is-playing');
        }
    });

    pProgContainer.addEventListener('click', (e) => {
        if (currentPlayIndex < 0 || !globalAudio.duration) return;
        const rect = pProgContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        globalAudio.currentTime = Math.max(0, Math.min(percent, 1)) * globalAudio.duration;
    });

    const pVolIcon = document.getElementById('player-volume-icon');
    const pVolContainer = document.getElementById('player-volume-container');
    const pVolProg = document.getElementById('player-volume-progress');
    const iconVolOn = document.getElementById('vol-icon-on');
    const iconVolOff = document.getElementById('vol-icon-off');

    if (pVolIcon && pVolContainer && pVolProg && iconVolOn && iconVolOff) {
        
        const syncVolumeUI = (vol) => {
            if (vol === 0) {
                iconVolOn.classList.add('hidden');
                iconVolOff.classList.remove('hidden');
                pVolIcon.classList.add('text-color-black/20');
            } else {
                iconVolOn.classList.remove('hidden');
                iconVolOff.classList.add('hidden');
                pVolIcon.classList.remove('text-color-black/20');
            }
        };

        let savedVol = localStorage.getItem('playerVolume');
        let currentVolume = savedVol !== null ? parseFloat(savedVol) : 0.5;
        let lastVolume = currentVolume > 0 ? currentVolume : 0.5; 
        
        globalAudio.volume = currentVolume;
        pVolProg.style.width = `${currentVolume * 100}%`;
        syncVolumeUI(currentVolume); 

        pVolIcon.addEventListener('click', () => {
            if (globalAudio.volume > 0) {
                lastVolume = globalAudio.volume;
                globalAudio.volume = 0;
                pVolProg.style.width = '0%';
            } else {
                globalAudio.volume = lastVolume;
                pVolProg.style.width = `${lastVolume * 100}%`;
            }
            syncVolumeUI(globalAudio.volume);
            localStorage.setItem('playerVolume', globalAudio.volume);
        });

        let isDraggingVol = false;

        const updateVolume = (e) => {
            const rect = pVolContainer.getBoundingClientRect();
            let percent = (e.clientX - rect.left) / rect.width;
            percent = Math.max(0, Math.min(percent, 1)); 
            
            globalAudio.volume = percent;
            pVolProg.style.width = `${percent * 100}%`;
            
            if (percent > 0) lastVolume = percent;
            
            syncVolumeUI(percent);
            localStorage.setItem('playerVolume', percent);
        };

        pVolContainer.addEventListener('mousedown', (e) => {
            isDraggingVol = true;
            updateVolume(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingVol) updateVolume(e);
        });

        window.addEventListener('mouseup', () => {
            isDraggingVol = false;
        });
    }
});
