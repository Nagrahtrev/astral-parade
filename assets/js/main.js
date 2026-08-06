// ------------ 全局页面过渡 ------------
function initPageTransitions() {
    const mainContent = document.querySelector('main');
    const body = document.body;

    if (!mainContent) return;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            body.classList.add('page-loaded');
        });
    });

    setTimeout(() => {
        body.classList.add('page-loaded');
    }, 200);

    // 拦截内部链接跳转
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (link.closest('.filter-item')) return;

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

    // BFCache & 安卓浏览器兼容
    function restorePage() {
        if (document.body.classList.contains('page-leaving')) {
            document.body.classList.remove('page-leaving');
            document.body.classList.add('page-loaded');
        }
    }

    // 默认 - pageshow
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            restorePage();
        }
    });

    // 降级 - visibilitychange
    var wasHidden = false;
    window.addEventListener('pagehide', function () {
        wasHidden = true;
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            wasHidden = true;
        } else if (document.visibilityState === 'visible' && wasHidden) {
            wasHidden = false;
            requestAnimationFrame(function () {
                restorePage();
            });
        }
    });
}

// ------------ 平滑滚动控制 ------------

// 允许打断
window.customSmoothScroll = function(targetY, duration = 400) {
    if (typeof window.__smoothScrollCancel === 'function') {
        window.__smoothScrollCancel();
    }

    const startY = window.scrollY;
    const distance = targetY - startY;
    let startTime = null;
    let cancelled = false;
    let rafId = null;

    const originalScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';

    window.__isSmoothScrolling = true;

    function cleanup() {
        document.removeEventListener('wheel', onInterrupt);
        document.removeEventListener('touchmove', onInterrupt);
        window.__smoothScrollCancel = null;
    }

    function onInterrupt(e) {
        // 过滤惯性滚动
        if (e.type === 'wheel' && Math.abs(e.deltaY) < 8) return;
        if (cancelled) return;
        cancelled = true;
        window.__isSmoothScrolling = false;
        document.documentElement.style.scrollBehavior = originalScrollBehavior;
        if (rafId) cancelAnimationFrame(rafId);
        cleanup();
    }

    document.addEventListener('wheel', onInterrupt, { passive: true });
    document.addEventListener('touchmove', onInterrupt, { passive: true });

    window.__smoothScrollCancel = function() {
        if (cancelled) return;
        cancelled = true;
        window.__isSmoothScrolling = false;
        document.documentElement.style.scrollBehavior = originalScrollBehavior;
        if (rafId) cancelAnimationFrame(rafId);
        cleanup();
    };

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function animation(currentTime) {
        if (cancelled) return;
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);

        window.scrollTo(0, startY + distance * easeOutQuart(progress));

        if (timeElapsed < duration) {
            rafId = requestAnimationFrame(animation);
        } else {
            document.documentElement.style.scrollBehavior = originalScrollBehavior;
            window.__isSmoothScrolling = false;
            cleanup();
        }
    }

    rafId = requestAnimationFrame(animation);
};

// ------------ Smart Header ------------
function initSmartHeader() {
    const floatingHeader = document.getElementById('floating-header');
    if (!floatingHeader) return;

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        // 程序化滚动时跳过
        if (window.__isSmoothScrolling) return;

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

function applyRowSpan(item) {
    if (!item) return;
    const height = item.getBoundingClientRect().height;
    const rowSpan = Math.max(1, Math.ceil(height));

    if (item.dataset.rowSpan !== String(rowSpan)) {
        item.dataset.rowSpan = String(rowSpan);
        item.style.gridRowEnd = `span ${rowSpan}`;
    }
}

function initSmartMasonry() {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    window.masonryObserver = new ResizeObserver(entries => {
        entries.forEach(entry => applyRowSpan(entry.target));
    });

    const items = grid.querySelectorAll('.blog-item');
    items.forEach(item => {
        window.masonryObserver.observe(item);
        applyRowSpan(item);
    });

    if (document.fonts) {
        document.fonts.ready.then(() => {
            grid.querySelectorAll('.blog-item').forEach(applyRowSpan);
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
        if (entries[0].isIntersecting && !window.matchMedia('(width >= 48rem)').matches && !isFetching) {
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
                    item.style.gridRowEnd = `span 500`;
                    grid.appendChild(item);

                    if (window.masonryObserver) {
                        window.masonryObserver.observe(item);
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

// ------------ 移动端汉堡菜单 ------------
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const dropdown = document.getElementById('mobile-menu-dropdown');
    const backdrop = document.getElementById('mobile-menu-backdrop');

    if (!btn || !dropdown || !backdrop) return;

    if (btn.dataset.menuReady === 'true') {
        let touchStartY = 0;

        function handleTouchStart(e) {
            touchStartY = e.touches[0].clientY;
        }

        function handleTouchMove(e) {
            e.preventDefault();
            const deltaY = touchStartY - e.touches[0].clientY;
            if (deltaY > 50) {
                backdrop.click();
            }
        }

        dropdown.addEventListener('touchstart', handleTouchStart, { passive: true });
        dropdown.addEventListener('touchmove', handleTouchMove, { passive: false });
        backdrop.addEventListener('touchstart', handleTouchStart, { passive: true });
        backdrop.addEventListener('touchmove', handleTouchMove, { passive: false });
        return;
    }

    function openMenu() {
        document.body.classList.add('overflow-hidden');

        btn.classList.add('is-hidden');
        dropdown.classList.remove('-translate-y-full', 'opacity-0', 'invisible');
        dropdown.classList.add('translate-y-0', 'opacity-100', 'visible');
        backdrop.classList.remove('opacity-0', 'invisible');
        backdrop.classList.add('opacity-100', 'visible');
    }

    function closeMenu() {
        dropdown.classList.remove('translate-y-0', 'opacity-100', 'visible');
        dropdown.classList.add('-translate-y-full', 'opacity-0', 'invisible');
        backdrop.classList.remove('opacity-100', 'visible');
        backdrop.classList.add('opacity-0', 'invisible');

        setTimeout(() => {
            document.body.classList.remove('overflow-hidden');
            const shouldShow = window.scrollY <= 100;
            if (shouldShow) {
                btn.classList.remove('is-hidden');
            }
            btn.dataset.hiddenByScroll = shouldShow ? 'false' : 'true';
        }, 500);    // 500
    }

    // 点击背板关闭菜单
    backdrop.addEventListener('click', () => {
        closeMenu();
    });

    // 上滑手势关闭菜单
    let touchStartY = 0;

    function handleTouchStart(e) {
        touchStartY = e.touches[0].clientY;
    }

    function handleTouchMove(e) {
        e.preventDefault();
        const deltaY = touchStartY - e.touches[0].clientY;
        if (deltaY > 50) {
            closeMenu();
        }
    }

    dropdown.addEventListener('touchstart', handleTouchStart, { passive: true });
    dropdown.addEventListener('touchmove', handleTouchMove, { passive: false });
    backdrop.addEventListener('touchstart', handleTouchStart, { passive: true });
    backdrop.addEventListener('touchmove', handleTouchMove, { passive: false });

    // 汉堡按钮状态
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('visible');
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });
}

// ------------ 移动端汉堡按钮 ------------
function initMobileFloatingButton() {
    const btn = document.getElementById('mobile-menu-btn');
    if (!btn) return;
    if (!btn.dataset.hiddenByScroll) {
        btn.dataset.hiddenByScroll = 'false';
    }

    let lastScrollY = window.scrollY;
    const SCROLL_THRESHOLD = 30;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        let isHiddenByScroll = btn.dataset.hiddenByScroll === 'true';

        // 页面在顶部时显示
        if (currentScrollY <= 0) {
            if (isHiddenByScroll) {
                btn.dataset.hiddenByScroll = 'false';
                btn.classList.remove('is-hidden');
            }
            lastScrollY = currentScrollY;
            return;
        }

        const delta = currentScrollY - lastScrollY;

        const dropdown = document.getElementById('mobile-menu-dropdown');
        if (!dropdown) return;
        const menuOpen = dropdown.classList.contains('visible');
        if (menuOpen) return;

        if (delta > SCROLL_THRESHOLD && currentScrollY > 100) {
            if (!isHiddenByScroll) {
                btn.dataset.hiddenByScroll = 'true';
                btn.classList.add('is-hidden');
            }
        } else if (delta < -SCROLL_THRESHOLD) {
            if (isHiddenByScroll) {
                btn.dataset.hiddenByScroll = 'false';
                btn.classList.remove('is-hidden');
            }
        }

        lastScrollY = currentScrollY;
    }, { passive: true });
}

// ------------ 首页按钮指示器 ------------
function initMobileMenuHint() {
    const hint = document.getElementById('mobile-menu-hint');
    const btn = document.getElementById('mobile-menu-btn');
    if (!hint || !btn) return;

    if (!document.body.classList.contains('page-home')) return;

    requestAnimationFrame(() => {
        hint.classList.remove('opacity-0');
    });

    function hideHint() {
        hint.classList.add('opacity-0');
        setTimeout(() => {
            hint.style.display = 'none';
        }, 200);
    }

    // 点击按钮后隐藏
    btn.addEventListener('click', hideHint);

    // 滑动后隐藏
    window.addEventListener('scroll', hideHint, { once: true });
}

// ------------ 执行入口 ------------
document.addEventListener('DOMContentLoaded', () => {
    initPageTransitions();
    initSmartHeader();
    initMobileMenu();
    initMobileFloatingButton();
    initMobileMenuHint();
    initSmartMasonry();
    initInfiniteScroll();
    initBlogPaginationCursor();
    initBackToTop();
});