// 禁用浏览器滚动位置恢复
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// 开关
const ABOUT_INTRO_SCROLL_DESKTOP = true;
const ABOUT_INTRO_SCROLL_MOBILE  = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('about-page')) return;
    const introCard = document.getElementById('intro-card');
    if (!introCard) return;

    const isDesktop = window.matchMedia('(min-width: 48rem)').matches;

    const scrollEnabled = isDesktop
        ? ABOUT_INTRO_SCROLL_DESKTOP
        : ABOUT_INTRO_SCROLL_MOBILE;

    // 简介框初始定位
    if (scrollEnabled) {
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
    }

    if (isDesktop && scrollEnabled) {
        // 静态 Header 隐藏
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
    } else if (isDesktop) {
        // 静态 Header 显示
        const staticHeader = document.getElementById('static-header');
        if (staticHeader) {
            staticHeader.classList.add('header-shown');
        }
    }
});