// ------------ 全局页面过渡 ------------
function initPageTransitions() {
    const mainContent = document.querySelector('main');
    const body = document.body;

    if (!mainContent) return;

    setTimeout(() => {
        body.classList.add('page-loaded');
    }, 50);

    // 拦截内部链接跳转
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (
                link.hostname === window.location.hostname &&
                link.pathname !== window.location.pathname &&
                !link.hash &&
                link.target !== '_blank' &&
                !e.ctrlKey && !e.metaKey
            ) {
                e.preventDefault();
                const destination = this.href;

                body.classList.remove('page-loaded');
                body.classList.add('page-leaving');

                setTimeout(() => {
                    window.location.href = destination;
                }, 300);
            }
        });
    });

    // BFCache
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            document.body.classList.remove('page-leaving');
            document.body.classList.add('page-loaded');
        }
    });
}

// ------------ 平滑滚动控制 ------------
window.customSmoothScroll = function(targetY, duration = 400) {
    const startY = window.scrollY;
    const distance = targetY - startY;
    let startTime = null;

    const originalScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);

        window.scrollTo(0, startY + distance * easeOutQuart(progress));

        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        } else {
            document.documentElement.style.scrollBehavior = originalScrollBehavior;
        }
    }

    requestAnimationFrame(animation);
};

// ------------ Smart Header ------------
function initSmartHeader() {
    const floatingHeader = document.getElementById('floating-header');
    if (!floatingHeader) return;

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // 触顶隐藏
        if (currentScrollY <= 1) {
            floatingHeader.style.transitionDuration = '0ms';
            floatingHeader.classList.remove('translate-y-0');
            floatingHeader.classList.add('-translate-y-full');
        }
        // 向下滚动隐藏
        else if (currentScrollY > lastScrollY) {
            floatingHeader.style.transitionDuration = '200ms';
            floatingHeader.classList.remove('translate-y-0');
            floatingHeader.classList.add('-translate-y-full');
        }
        // 向上滚动出现
        else if (currentScrollY < lastScrollY && currentScrollY > 10) {
            floatingHeader.style.transitionDuration = '200ms';
            floatingHeader.classList.remove('-translate-y-full');
            floatingHeader.classList.add('translate-y-0');
        }

        lastScrollY = currentScrollY;
    }, { passive: true });
}

// ------------ 瀑布流卡片高度计算 ------------
window.masonryObserver = null;

function initSmartMasonry() {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    window.masonryObserver = new ResizeObserver(entries => {
        entries.forEach(entry => {
            const content = entry.target;
            const item = content.closest('.blog-item');

            if (item) {
                const contentHeight = entry.contentRect.height;
                const rowSpan = Math.ceil(contentHeight + 80);
                item.style.gridRowEnd = `span ${rowSpan}`;
            }
        });
    });

    const cards = document.querySelectorAll('.blog-item .card-content');
    cards.forEach(card => {
        window.masonryObserver.observe(card);
    });

    if (document.fonts) {
        document.fonts.ready.then(() => {
            const updatedCards = document.querySelectorAll('.blog-item .card-content');
            updatedCards.forEach(card => {
                const item = card.closest('.blog-item');
                if (item) {
                    const contentHeight = card.getBoundingClientRect().height;
                    item.style.gridRowEnd = `span ${Math.ceil(contentHeight + 80)}`;
                }
            });
        });
    }
}

// ------------ 移动端 Infinite Scroll ------------
function initInfiniteScroll() {
    const trigger = document.getElementById('mobile-infinite-trigger');
    const grid = document.getElementById('blog-grid');
    if (!trigger || !grid) return;

    let isFetching = false;

    const observer = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && window.innerWidth < 768 && !isFetching) {
            const nextUrl = trigger.getAttribute('data-next');
            if (!nextUrl) return;

            isFetching = true;
            trigger.style.opacity = '1';

            try {
                const response = await fetch(nextUrl);
                const htmlText = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');

                const newItems = doc.querySelectorAll('#blog-grid .blog-item');

                newItems.forEach(item => {
                    item.style.gridRowEnd = `span 200`;
                    grid.appendChild(item);

                    const cardContent = item.querySelector('.card-content');
                    if (cardContent && window.masonryObserver) {
                        window.masonryObserver.observe(cardContent);
                    }
                });

                const newTrigger = doc.getElementById('mobile-infinite-trigger');
                if (newTrigger) {
                    trigger.setAttribute('data-next', newTrigger.getAttribute('data-next'));
                } else {
                    trigger.remove();
                    observer.disconnect();
                }

            } catch (error) {
                console.error('Infinite Scroll Error:', error);
                trigger.innerHTML = "Network Error";
            } finally {
                isFetching = false;
                if (trigger) trigger.style.opacity = '0.5';
            }
        }
    });

    observer.observe(trigger);
}

// ------------ 分页器游标初始化 ------------

function initBlogPaginationCursor() {
    const container = document.getElementById('blog-pagination-controls');
    if (!container) return;

    const activeBtn = container.querySelector('.page-btn.active');
    const cursor = container.querySelector('.bracket-cursor');

    if (activeBtn && cursor) {
        cursor.style.transition = 'none';
        cursor.style.width = `${activeBtn.offsetWidth}px`;
        cursor.style.transform = `translateX(${activeBtn.offsetLeft}px)`;

        void cursor.offsetWidth;
        cursor.style.transition = '';

        window.addEventListener('resize', () => {
            cursor.style.transition = 'none';
            cursor.style.width = `${activeBtn.offsetWidth}px`;
            cursor.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
            void cursor.offsetWidth;
            cursor.style.transition = '';
        });
    }
}

// ------------ 全局回到顶部按钮 ------------
function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    let isVisible = false;
    const scrollThreshold = 300;

    window.addEventListener('scroll', () => {
        const shouldShow = window.scrollY > scrollThreshold;

        if (shouldShow && !isVisible) {
            btn.classList.add('is-visible');
            isVisible = true;
        } else if (!shouldShow && isVisible) {
            btn.classList.remove('is-visible');
            isVisible = false;
        }
    }, { passive: true });

    btn.addEventListener('click', () => {
        customSmoothScroll(0, 800);
    });
}

// ------------ 执行入口 ------------
document.addEventListener('DOMContentLoaded', () => {
    initPageTransitions();
    initSmartHeader();
    initSmartMasonry();
    initInfiniteScroll();
    initBlogPaginationCursor();
    initBackToTop();
});
