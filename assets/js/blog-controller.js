// ------------ 移动端 Filter 位置恢复 ------------
const FILTER_SCROLL_KEY = 'blog_filter_scroll';

document.addEventListener('click', (e) => {
    const item = e.target.closest('.filter-item');
    if (!item) return;

    const data = {};

    data.pageY = window.scrollY;

    const containers = document.querySelectorAll('.overflow-x-auto');
    data.containers = {};
    containers.forEach((c, index) => {
        const style = getComputedStyle(c);
        if (style.overflowX !== 'auto') return;
        data.containers[index] = c.scrollLeft;
    });

    sessionStorage.setItem(FILTER_SCROLL_KEY, JSON.stringify(data));
});

document.addEventListener('DOMContentLoaded', () => {
    const saved = sessionStorage.getItem(FILTER_SCROLL_KEY);
    let hasRestored = false;

    if (saved) {
        const data = JSON.parse(saved);

        if (typeof data.pageY === 'number') {
            window.scrollTo(0, data.pageY);
        }

        if (data.containers) {
            const containers = document.querySelectorAll('.overflow-x-auto');
            requestAnimationFrame(() => {
                containers.forEach((c, index) => {
                    if (data.containers[index] === undefined) return;
                    const style = getComputedStyle(c);
                    if (style.overflowX !== 'auto') return;
                    c.scrollLeft = data.containers[index];
                });
            });
            hasRestored = true;
        }

        sessionStorage.removeItem(FILTER_SCROLL_KEY);
    }

    // 无已保存位置时居中显示
    if (!hasRestored) {
        const containers = document.querySelectorAll('.overflow-x-auto');
        requestAnimationFrame(() => {
            containers.forEach(container => {
                const style = getComputedStyle(container);
                if (style.overflowX !== 'auto') return;

                const activeItem = container.querySelector('.filter-item.active');
                if (!activeItem) return;

                const containerRect = container.getBoundingClientRect();
                const activeRect = activeItem.getBoundingClientRect();
                const centerScroll = (activeRect.left - containerRect.left + container.scrollLeft)
                    - (container.clientWidth / 2)
                    + (activeRect.width / 2);

                // 限制在有效范围
                const maxScroll = container.scrollWidth - container.clientWidth;
                container.scrollLeft = Math.max(0, Math.min(centerScroll, maxScroll));
            });
        });
    }
});

// ------------ Filter 滑动指示器 ------------
document.addEventListener('DOMContentLoaded', () => {
    const hints = document.querySelectorAll('.filter-slide-hint');
    if (!hints.length) return;

    function isMobile() {
        return !window.matchMedia('(width >= 64rem)').matches;
    }

    function checkOverflow() {
        hints.forEach(hint => {
            if (!isMobile()) {
                hint.style.display = 'none';
                return;
            }

            const matchedSpan = hint.closest('.w-full');
            if (!matchedSpan || !matchedSpan.parentElement) return;

            const section = matchedSpan.parentElement;
            const container = section.querySelector('.overflow-x-auto');
            if (!container) return;

            if (container.scrollWidth > container.clientWidth) {
                hint.style.display = 'inline-flex';
            } else {
                hint.style.display = 'none';
            }
        });
    }

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
});

// ------------ Filter 鼠标拖拽 ------------
document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('.overflow-x-auto');
    if (!containers.length) return;

    containers.forEach(container => {
        let isDown = false;
        let startX, scrollLeft;
        let wasDragged = false;

        container.addEventListener('mousedown', (e) => {
            const style = getComputedStyle(container);
            if (style.overflowX !== 'auto') return;
            if (container.scrollWidth <= container.clientWidth) return;

            isDown = true;
            wasDragged = false;
            startX = e.pageX - container.getBoundingClientRect().left;
            scrollLeft = container.scrollLeft;
            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none';
            e.preventDefault();

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!isDown) return;
            const x = e.pageX - container.getBoundingClientRect().left;
            const walk = (x - startX) * 1.5;
            container.scrollLeft = scrollLeft - walk;
            if (Math.abs(walk) > 3) wasDragged = true;
        }

        function onMouseUp() {
            if (!isDown) return;
            isDown = false;
            container.style.cursor = '';
            container.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        // 拖拽后防止误触
        container.addEventListener('click', (e) => {
            if (wasDragged) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });
});
