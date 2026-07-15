document.addEventListener('DOMContentLoaded', () => {
    // 阅读时间计时器
    const timerElement = document.getElementById('reading-timer');
    if (timerElement) {
        let totalSeconds = 0;
        setInterval(() => {
            totalSeconds++;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            const displayMinutes = String(minutes).padStart(2, '0');
            const displaySeconds = String(seconds).padStart(2, '0');

            timerElement.innerText = `${displayMinutes}:${displaySeconds}`;
        }, 1000);
    }

    // Top 按钮放到 body 最外层
    const fab = document.getElementById('mobile-fab');
    if (fab) {
        document.body.appendChild(fab);
    }
});

// 智能后退
window.smartBack = function() {
    if (document.referrer.includes(window.location.host)) {
        window.history.back();
    } else {
        window.location.href = '/blog';
    }
};

// Navigator 移动端折叠控制
window.toggleMobileToc = function() {
    if (window.innerWidth >= 1024) return;

    const wrapper = document.getElementById('toc-wrapper');
    const iconV = document.getElementById('toc-icon-v');
    const iconBox = document.getElementById('toc-icon-box');
    const dot = document.getElementById('toc-dot');
    
    if (!wrapper || !iconV || !iconBox || !dot) return;

    wrapper.classList.toggle('is-open');
    
    if (wrapper.classList.contains('is-open')) {
        iconV.style.transform = 'translate(-50%, 0) scaleY(0)';
        iconBox.style.borderColor = 'rgba(0,0,0,0.4)';
        dot.classList.replace('opacity-40', 'opacity-100'); 
    } else {
        iconV.style.transform = 'translate(-50%, 0) scaleY(1)';
        iconBox.style.borderColor = 'rgba(0,0,0,0.2)';
        dot.classList.replace('opacity-100', 'opacity-40'); 
    }
};
