// ------------ Filter 滑动指示器 ------------
document.addEventListener('DOMContentLoaded', () => {
    const hints = document.querySelectorAll('.filter-slide-hint');
    if (!hints.length) return;

    function isMobile() {
        return window.innerWidth < 1024;
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
