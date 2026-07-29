// ------------ 全局页面过渡 ------------
function initPageTransitions() {
    const mainContent = document.querySelector('main');
    const body = document.body;

    if (!mainContent) return;

    // ===== DEBUG 日志面板 =====
    (function initDebugPanel() {
        if (document.getElementById('__bfcache_debug')) return;
        var panel = document.createElement('div');
        panel.id = '__bfcache_debug';
        panel.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;max-height:30vh;overflow-y:auto;background:rgba(0,0,0,0.9);color:#0f0;font:9px/1.4 monospace;padding:6px 8px;border-bottom:2px solid #0f0;pointer-events:auto;-webkit-text-size-adjust:none;word-break:break-all;';

        var btnBar = document.createElement('div');
        btnBar.style.cssText = 'display:flex;gap:6px;margin-bottom:4px;';
        var copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 复制';
        copyBtn.style.cssText = 'background:#0f0;color:#000;border:none;padding:2px 8px;font:bold 10px monospace;border-radius:3px;';
        copyBtn.addEventListener('click', function(e){
            e.stopPropagation();
            navigator.clipboard.writeText(panel._entries.join('\n')).catch(function(){
                var ta = document.createElement('textarea');
                ta.value = panel._entries.join('\n');
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            });
            copyBtn.textContent = '✅ 已复制';
            setTimeout(function(){ copyBtn.textContent = '📋 复制'; }, 1500);
        });

        var toggleBtn = document.createElement('button');
        toggleBtn.textContent = '🔽 展开';
        toggleBtn.style.cssText = 'background:#333;color:#0f0;border:1px solid #0f0;padding:2px 8px;font:bold 10px monospace;border-radius:3px;';
        toggleBtn.addEventListener('click', function(e){
            e.stopPropagation();
            panel.style.maxHeight = panel.style.maxHeight === '80vh' ? '30vh' : '80vh';
            toggleBtn.textContent = panel.style.maxHeight === '80vh' ? '🔼 收起' : '🔽 展开';
        });

        btnBar.appendChild(copyBtn);
        btnBar.appendChild(toggleBtn);
        panel.appendChild(btnBar);

        var logEl = document.createElement('div');
        logEl.id = '__bfcache_log';
        panel.appendChild(logEl);
        document.body.appendChild(panel);

        panel._entries = [];
        window.__debugLog = function (msg) {
            var t = Date.now() % 100000;
            var m = document.querySelector('main');
            var ms = m ? getComputedStyle(m) : null;
            var line = '['+t+'] '+msg;
            if (ms) line += ' | op:'+ms.opacity+' tY:'+ms.transform+' vis:'+ms.visibility+' disp:'+ms.display;
            line += ' | cls:'+document.body.className;
            panel._entries.push(line);
            if (panel._entries.length > 50) panel._entries.shift();
            logEl.textContent = panel._entries.join('\n');
        };

        window.addEventListener('pageshow', function(e){ window.__debugLog('📥 pageshow persisted='+e.persisted+' '+location.pathname); });
        window.addEventListener('pagehide', function(e){ window.__debugLog('📤 pagehide persisted='+e.persisted+' '+location.pathname); });
        window.addEventListener('visibilitychange', function(){ window.__debugLog('👁 vis='+document.visibilityState); });

        window.__debugLog('🔧 Panel init '+location.pathname);
    })();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.__debugLog('✅ rAF→rAF add page-loaded');
            body.classList.add('page-loaded');
        });
    });

    setTimeout(() => {
        window.__debugLog('⏰ setTimeout 200ms fallback add page-loaded');
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
                window.__debugLog('🔗 click → '+destination);

                body.classList.remove('page-loaded');
                body.classList.add('page-leaving');

                setTimeout(() => {
                    window.__debugLog('🚀 navigate → '+destination);
                    window.location.href = destination;
                }, 300);
            }
        });
    });

    // BFCache
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            window.__debugLog('🔄 bfcache RESTORE');
            document.body.classList.remove('page-leaving');
            document.body.classList.add('page-loaded');
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

// ------------ 移动端汉堡菜单 ------------
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const dropdown = document.getElementById('mobile-menu-dropdown');
    const backdrop = document.getElementById('mobile-menu-backdrop');

    if (!btn || !dropdown || !backdrop) return;

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