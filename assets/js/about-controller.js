// 禁用浏览器滚动位置恢复
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// 开关
const ABOUT_INTRO_SCROLL_DESKTOP = true;
const ABOUT_INTRO_SCROLL_MOBILE  = true;

// 偏移量
// 卡片高度 > 视口高度时，卡片顶部的位置 (px)
const ABOUT_INTRO_OFFSET_TALL_DESKTOP  = 20;
const ABOUT_INTRO_OFFSET_TALL_MOBILE   = 20;
// 卡片高度 < 视口高度时，卡片中心与视口高度的比例
const ABOUT_INTRO_OFFSET_SHORT_DESKTOP = 0.55;
const ABOUT_INTRO_OFFSET_SHORT_MOBILE  = 0.6;

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
            const offset = isDesktop ? ABOUT_INTRO_OFFSET_TALL_DESKTOP : ABOUT_INTRO_OFFSET_TALL_MOBILE;
            scrollTarget = window.scrollY + cardRect.top - offset;
        } else {
            const ratio = isDesktop ? ABOUT_INTRO_OFFSET_SHORT_DESKTOP : ABOUT_INTRO_OFFSET_SHORT_MOBILE;
            const cardCenter = cardRect.top + cardHeight / 2;
            scrollTarget = window.scrollY + cardCenter - viewportHeight * ratio;
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

// 简介切换语言
function switchAboutLang(lang) {
  const zh = document.getElementById('desc-zh');
  const en = document.getElementById('desc-en');
  const zhSpan = document.getElementById('lang-zh');
  const enSpan = document.getElementById('lang-en');
  if (!zh || !en || !zhSpan || !enSpan) return;

  if (lang === 'en') {
    zh.style.display = 'none';
    en.style.display = 'block';
    zhSpan.className = 'text-color-black/20 hover:text-color-black/35 transition-colors ease-out duration-200';
    zhSpan.style.cursor = 'pointer';
    enSpan.className = 'text-color-black/60';
    enSpan.style.cursor = 'default';
  } else {
    zh.style.display = 'block';
    en.style.display = 'none';
    zhSpan.className = 'text-color-black/60';
    zhSpan.style.cursor = 'default';
    enSpan.className = 'text-color-black/20 hover:text-color-black/35 transition-colors ease-out duration-200';
    enSpan.style.cursor = 'pointer';
  }
}