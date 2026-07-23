const initParticipationMarquee = () => {
    const wrappers = document.querySelectorAll('.auto-marquee-wrapper');
    if (wrappers.length === 0) return;

    if (window.matchMedia('(width >= 48rem)').matches) {
        wrappers.forEach(wrapper => {
            const container = wrapper.querySelector('.auto-marquee-container');
            const text = wrapper.querySelector('.auto-marquee-text');
            if (container) container.style.justifyContent = '';
            if (text) text.style.animation = '';
        });
        return;
    }

    wrappers.forEach((wrapper, index) => {
        const container = wrapper.querySelector('.auto-marquee-container');
        const text = wrapper.querySelector('.auto-marquee-text');
        if (!container || !text) return;

        text.style.animation = 'none';
        container.style.justifyContent = 'center';

        requestAnimationFrame(() => {
            const textWidth = text.getBoundingClientRect().width;
            const containerWidth = container.getBoundingClientRect().width - 32;

            const overspill = textWidth - containerWidth;

            if (overspill > 0) {
                container.style.justifyContent = 'flex-start';

                const styleId = `dynamic-marquee-part-${index}`;
                let styleEl = document.getElementById(styleId);
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = styleId;
                    document.head.appendChild(styleEl);
                }

                const animName = `partBounce${index}`;
                const finalSpill = overspill + 24;

                styleEl.innerHTML = `
                    @keyframes ${animName} {
                        0%, 15% { transform: translateX(0); }
                        45%, 55% { transform: translateX(-${finalSpill}px); }
                        85%, 100% { transform: translateX(0); }
                    }
                `;

                const duration = Math.max(7, finalSpill * 0.05);
                text.style.animation = `${animName} ${duration}s ease-in-out infinite`;
            }
        });
    });
};

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
        setTimeout(initParticipationMarquee, 50);
    });
} else {
    window.addEventListener('load', initParticipationMarquee);
}

window.addEventListener('resize', () => {
    setTimeout(initParticipationMarquee, 100);
});
