// ------------ Tooltip ------------
function initTooltips() {
    const SPACING = 8;

    function positionBox(tooltip) {
        const box = tooltip.querySelector('.tooltip-box');
        if (!box) return;

        const trigger = tooltip.querySelector('.tooltip-trigger') || tooltip;

        const triggerRects = trigger.getClientRects();
        const tooltipRects = tooltip.getClientRects();
        if (!triggerRects.length || !tooltipRects.length) return;

        const triggerRect = triggerRects[0]; 
        const tooltipRect = tooltipRects[0]; 

        const boxWidth = box.getBoundingClientRect().width || box.offsetWidth;
        const vw = document.documentElement.clientWidth || window.innerWidth;

        let leftTarget = triggerRect.left + triggerRect.width / 2 - boxWidth / 2;
        leftTarget = Math.max(SPACING, Math.min(vw - boxWidth - SPACING, leftTarget));

        box.style.left = (leftTarget - tooltipRect.left) + 'px';
        box.style.transform = 'none';

        if (window.location.search.indexOf('tooltip-debug=1') !== -1) {
            console.log('[tooltip]', {
                triggerFirstLineLeft: triggerRect.left,
                triggerWidth: triggerRect.width,
                tooltipFirstLineLeft: tooltipRect.left,
                boxWidth: boxWidth,
                vw: vw,
                leftTarget: leftTarget,
                boxLeft: box.style.left,
            });
        }
    }

    function repositionAll() {
        document.querySelectorAll('.article-content.prose .tooltip').forEach(tooltip => {
            if (tooltip.querySelector('.tooltip-box')) positionBox(tooltip);
        });
    }

    repositionAll();

    document.querySelectorAll('.article-content.prose .tooltip').forEach(tooltip => {
        if (!tooltip.querySelector('.tooltip-box')) return;
        tooltip.addEventListener('mouseenter', () => positionBox(tooltip));
        tooltip.addEventListener('focusin', () => positionBox(tooltip));
    });

    window.addEventListener('resize', repositionAll);

    window.__initTooltipsReposition = repositionAll;
}

// ------------ Tabs ------------
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        const nav = tab.querySelector('.tab-nav');
        const content = tab.querySelector('.tab-content');
        if (!nav || !content) return;

        const panels = content.querySelectorAll('.tab-panel');
        panels.forEach((panel, index) => {
            const title = panel.getAttribute('data-title') || 'Tab ' + (index + 1);
            panel.setAttribute('data-tab', index);

            const btn = document.createElement('button');
            btn.className = 'tab-nav-item' + (index === 0 ? ' active' : '');
            btn.setAttribute('data-tab', index);
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            btn.textContent = title;
            nav.appendChild(btn);
        });

        panels.forEach((panel, index) => {
            if (index === 0) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    });

    document.querySelectorAll('.tab-nav').forEach(nav => {
        nav.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-nav-item');
            if (!btn) return;

            const tab = btn.closest('.tab');
            if (!tab) return;

            tab.querySelectorAll('.tab-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const index = btn.getAttribute('data-tab');
            tab.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
                if (panel.getAttribute('data-tab') === index) {
                    panel.classList.add('active');
                }
            });
        });
    });
}

// ------------ Accordion ------------
function initAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const accordion = header.closest('.accordion');
            if (!accordion) return;

            const content = accordion.querySelector('.accordion-content');
            if (!content) return;

            const isOpen = header.getAttribute('aria-expanded') === 'true';

            if (isOpen) {
                header.setAttribute('aria-expanded', 'false');
                header.classList.remove('active');
                content.hidden = true;
            } else {
                header.setAttribute('aria-expanded', 'true');
                header.classList.add('active');
                content.hidden = false;
            }
        });
    });
}

// ------------ 图片灯箱 ------------
function initImageLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-image');
    const closeBtn = document.getElementById('lightbox-close');
    const container = document.getElementById('lightbox-image-container');

    if (!lightbox || !lightboxImg || !closeBtn || !container) return;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    let lastTouchDist = 0;

    function open(src, alt) {
        lightboxImg.src = src;
        lightboxImg.alt = alt || '';
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
        updateCursor();
        lightbox.classList.remove('opacity-0', 'invisible', 'pointer-events-none');
        lightbox.classList.add('opacity-100', 'visible', 'pointer-events-auto');
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        window.lenis?.stop();
    }

    function close() {
        lightbox.classList.remove('opacity-100', 'visible', 'pointer-events-auto');
        lightbox.classList.add('opacity-0');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        window.lenis?.start();
        setTimeout(() => {
            lightbox.classList.add('invisible', 'pointer-events-none');
            lightboxImg.src = '';
        }, 200);    // 200
    }

    function applyTransform() {
        lightboxImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function updateCursor() {
        if (scale > 1) {
            container.style.cursor = 'grab';
        } else {
            container.style.cursor = 'default';
        }
    }

    function clampTranslate() {
        if (scale <= 1) {
            translateX = 0;
            translateY = 0;
            return;
        }
        const imgRect = lightboxImg.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const overflowX = (imgRect.width - containerRect.width) / 2;
        const overflowY = (imgRect.height - containerRect.height) / 2;

        if (overflowX > 0) {
            translateX = Math.max(-overflowX, Math.min(overflowX, translateX));
        }
        if (overflowY > 0) {
            translateY = Math.max(-overflowY, Math.min(overflowY, translateY));
        }
    }

    document.querySelectorAll('.article-content.prose img').forEach(img => {
        if (img.closest('a')) return;
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            open(img.src, img.alt);
        });
    });

    // 关闭按钮
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
    });

    // 点击背景关闭
    lightbox.addEventListener('click', (e) => {
        const imgRect = lightboxImg.getBoundingClientRect();
        const isOnImage = (
            e.clientX >= imgRect.left &&
            e.clientX <= imgRect.right &&
            e.clientY >= imgRect.top &&
            e.clientY <= imgRect.bottom
        );
        if (!isOnImage) close();
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('opacity-100')) close();
    });

    // 鼠标滚轮缩放
    lightbox.addEventListener('wheel', (e) => {
        if (!lightbox.classList.contains('opacity-100')) return;
        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        scale = Math.max(0.5, Math.min(5, scale + delta));

        clampTranslate();
        applyTransform();
        updateCursor();
    }, { passive: false });

    // 鼠标拖拽
    container.addEventListener('mousedown', (e) => {
        if (scale <= 1) return;
        isDragging = true;
        container.style.cursor = 'grabbing';
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragOffsetX = translateX;
        dragOffsetY = translateY;
        lightboxImg.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = dragOffsetX + (e.clientX - dragStartX);
        translateY = dragOffsetY + (e.clientY - dragStartY);
        clampTranslate();
        applyTransform();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            container.style.cursor = 'grab';
            lightboxImg.style.transition = '';
        }
    });

    let touchCount = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchOffsetX = 0;
    let touchOffsetY = 0;

    container.addEventListener('touchstart', (e) => {
        touchCount = e.touches.length;

        if (touchCount === 1 && scale > 1) {
            // 单指拖拽
            isDragging = true;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchOffsetX = translateX;
            touchOffsetY = translateY;
            lightboxImg.style.transition = 'none';
        } else if (touchCount === 2) {
            // 双指缩放
            isDragging = false;
            lightboxImg.style.transition = '';
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist = Math.sqrt(dx * dx + dy * dy);
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (touchCount === 2 && e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const delta = (dist - lastTouchDist) * 0.01;
            scale = Math.max(0.5, Math.min(5, scale + delta));

            lastTouchDist = dist;
            clampTranslate();
            applyTransform();
            updateCursor();
        } else if (isDragging && e.touches.length === 1) {
            e.preventDefault();
            translateX = touchOffsetX + (e.touches[0].clientX - touchStartX);
            translateY = touchOffsetY + (e.touches[0].clientY - touchStartY);
            clampTranslate();
            applyTransform();
        }
    }, { passive: false });

    container.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            lightboxImg.style.transition = '';
        }
        touchCount = 0;
    }, { passive: true });
}

function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}


onReady(() => {
    initTooltips();
    initTabs();
    initAccordions();
    initImageLightbox();

    // 字体加载完成后重定位 Tooltip
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            const tooltips = document.querySelectorAll('.article-content.prose .tooltip');
            if (tooltips.length && window.__initTooltipsReposition) {
                window.__initTooltipsReposition();
            }
        });
    }
});