document.addEventListener('DOMContentLoaded', () => {
    // 简介框初始定位
    if (!document.body.classList.contains('about-page')) return;
    const introCard = document.getElementById('intro-card');
    if (!introCard) return;

    const cardRect = introCard.getBoundingClientRect();
    const cardHeight = cardRect.height;
    const viewportHeight = window.innerHeight;

    let scrollTarget;

    if (cardHeight > viewportHeight) {
        scrollTarget = window.scrollY + cardRect.top - 20;
    } else {
        const cardCenter = cardRect.top + cardHeight / 2;
        scrollTarget = window.scrollY + cardCenter - viewportHeight * 0.55;
    }

    window.scrollTo(0, scrollTarget);

    // 电脑端初始隐藏静态 Header
    if (window.matchMedia('(min-width: 48rem)').matches) {
        const staticHeader = document.getElementById('static-header');
        if (!staticHeader) return;

        let hasShown = false;
        let lastScrollY = window.scrollY;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            if (!hasShown && currentScrollY < lastScrollY && currentScrollY > 10) {
                staticHeader.classList.add('header-shown');
                hasShown = true;
            }
            lastScrollY = currentScrollY;
        }, { passive: true });
    }
});
