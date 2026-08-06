// 智能后退
window.smartBackDisco = function(btn) {
    if (document.referrer.includes(window.location.host)) {
        window.history.back();
    } else {
        var category = btn.getAttribute('data-category');
        try { sessionStorage.setItem('discoFilter', category); } catch {}
        try { sessionStorage.setItem('discoPage', '1'); } catch {}
        window.location.href = '/discography';
    }
};

// TR 单行/双行切换
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.track-from-container').forEach(container => {
        const trSpan = container.querySelector('.tr-label');
        const fromSpan = container.querySelector('.from-label');
        if (!trSpan || !fromSpan) return;

        function measureNaturalWidth(el) {
            const orig = el.style.whiteSpace;
            el.style.whiteSpace = 'nowrap';
            const w = el.scrollWidth;
            el.style.whiteSpace = orig;
            return w;
        }

        function update() {
            const trackNum = trSpan.dataset.track;

            trSpan.textContent = `TR-${trackNum}`;
            trSpan.style.display = '';
            trSpan.style.flexDirection = '';
            const trNatural = measureNaturalWidth(trSpan);
            const fromNatural = measureNaturalWidth(fromSpan);
            const containerWidth = container.clientWidth;

            const trOverflows = trNatural > containerWidth;
            const fromOverflows = fromNatural > (containerWidth - trNatural);
            const needsTwoLines = trOverflows || fromOverflows;

            if (needsTwoLines) {
                // 双行
                trSpan.textContent = '';
                trSpan.style.display = 'inline-flex';
                trSpan.style.flexDirection = 'column';
                trSpan.style.alignItems = 'center';
                trSpan.style.lineHeight = '1.1';
                trSpan.style.paddingTop = '';
                trSpan.style.paddingBottom = '';

                const trLine = document.createElement('span');
                trLine.textContent = 'TR';
                const numLine = document.createElement('span');
                numLine.textContent = trackNum;

                trSpan.appendChild(trLine);
                trSpan.appendChild(numLine);
            } else {
                // 单行
                trSpan.textContent = `TR-${trackNum}`;
                trSpan.style.display = '';
                trSpan.style.flexDirection = '';
                trSpan.style.alignItems = '';
                trSpan.style.lineHeight = '';
                trSpan.style.paddingTop = 'calc(0.125rem + 1px)';
                trSpan.style.paddingBottom = 'calc(0.125rem - 1px)';
            }
        }

        update();
        window.addEventListener('resize', update);
    });
});