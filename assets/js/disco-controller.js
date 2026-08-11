document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.filter-btn');
    const items = Array.from(document.querySelectorAll('.disco-item'));
    const paginationContainer = document.getElementById('pagination-ctrls');

    const ITEMS_PER_PAGE = 9;    // 9

    function getStorage(key, fallback) {
        try { return sessionStorage.getItem(key); }
        catch { return null; }
    }
    function setStorage(key, val) {
        try { sessionStorage.setItem(key, val); }
        catch {  }
    }

    let currentPage = parseInt(getStorage('discoPage')) || 1;
    var urlParams = new URL(window.location).searchParams;
    var urlFilter = urlParams.get('filter');
    let currentFilter = urlFilter || getStorage('discoFilter') || 'Releases';

    setStorage('discoFilter', currentFilter);
    let currentTotalPages = 0;

    const isDesktop = () => window.matchMedia('(width >= 48rem)').matches;

    buttons.forEach(btn => {
        if (btn.getAttribute('data-filter') === currentFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // ------------ 封面网格 ------------
    function renderGrid(isResize = false) {
        const filteredItems = items.filter(item => item.getAttribute('data-category') === currentFilter);

        const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;

        let visibleCount = 0;

        items.forEach(item => {
            // 切页动画
            item.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';

            const isMatch = item.getAttribute('data-category') === currentFilter;
            const indexInFiltered = filteredItems.indexOf(item);
            const isPageMatch = !isDesktop() || (indexInFiltered >= startIndex && indexInFiltered < endIndex);

            if (isMatch && isPageMatch) {
                item.style.display = 'block';
                if (!isResize) void item.offsetWidth;
                item.style.opacity = '1';
                item.style.transform = 'scale(1)';
                visibleCount++;
            } else {
                item.style.display = 'none';
                item.style.opacity = '0';
                item.style.transform = 'scale(0.95)';
            }
        });

        // 空槽位
        const grid = document.getElementById('discography-grid');
        grid.querySelectorAll('.disco-empty-slot').forEach(el => el.remove());

        if (visibleCount === 0) {
            // 没有任何条目时也显示占位
            const gridComputedStyle = window.getComputedStyle(grid);
            const cols = gridComputedStyle.getPropertyValue('grid-template-columns').split(' ').length;

            for (let i = 0; i < cols; i++) {
                const slot = document.createElement('div');
                slot.className = 'disco-empty-slot w-full pointer-events-none select-none';
                slot.style.opacity = '0';
                slot.style.transform = 'scale(0.95)';
                slot.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';

                slot.innerHTML = `
                    <div class="flex justify-between items-end border-b-[0.5px] border-color-black/20 pb-2 mb-3 md:mb-4 invisible">
                        <span class="font-mono text-[10px] tracking-widest">0000.00.00</span>
                    </div>

                    <div class="w-full aspect-square border-[0.5px] border-color-black/20 flex flex-col items-center justify-center text-color-black/20">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="0.5" class="mb-2">
                            <path d="M6 0V12M0 6H12" />
                        </svg>
                        <span class="font-mono text-[9px] tracking-[0.2em] uppercase">Empty</span>
                    </div>

                    <div class="mt-4 md:mt-5 flex flex-col items-start w-full pr-2 invisible">
                        <h3 class="font-secondary text-[16px] md:text-[18px] lg:text-[20px] font-bold tracking-tight leading-snug">
                            Slot
                        </h3>
                    </div>
                `;

                grid.appendChild(slot);

                requestAnimationFrame(() => {
                    void slot.offsetWidth;
                    slot.style.opacity = '1';
                    slot.style.transform = 'scale(1)';
                });
            }
        } else if (visibleCount > 0 && isDesktop()) {
            const gridComputedStyle = window.getComputedStyle(grid);
            const cols = gridComputedStyle.getPropertyValue('grid-template-columns').split(' ').length;
            const remainder = visibleCount % cols;
            const slotsNeeded = remainder === 0 ? 0 : cols - remainder;

            for (let i = 0; i < slotsNeeded; i++) {
                const slot = document.createElement('div');
                slot.className = 'disco-empty-slot w-full pointer-events-none select-none';
                slot.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
                slot.style.opacity = '0';
                slot.style.transform = 'scale(0.95)';

                slot.innerHTML = `
                    <div class="flex justify-between items-end border-b-[0.5px] border-color-black/20 pb-2 mb-3 md:mb-4 invisible">
                        <span class="font-mono text-[10px] tracking-widest">0000.00.00</span>
                    </div>

                    <div class="w-full aspect-square border-[0.5px] border-color-black/20 flex flex-col items-center justify-center text-color-black/20">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="0.5" class="mb-2">
                            <path d="M6 0V12M0 6H12" />
                        </svg>
                        <span class="font-mono text-[9px] tracking-[0.2em] uppercase">Empty</span>
                    </div>

                    <div class="mt-4 md:mt-5 flex flex-col items-start w-full pr-2 invisible">
                        <h3 class="font-secondary text-[16px] md:text-[18px] lg:text-[20px] font-bold tracking-tight leading-snug">
                            Slot
                        </h3>
                    </div>
                `;

                grid.appendChild(slot);

                requestAnimationFrame(() => {
                    void slot.offsetWidth;
                    slot.style.opacity = '1';
                    slot.style.transform = 'scale(1)';
                });
            }
        }

        renderPaginationControls(totalPages, isResize);
    }

    // ------------ 分页器 ------------
    function renderPaginationControls(totalPages, isResize = false) {
        if (!paginationContainer) return;

        if (totalPages === currentTotalPages && paginationContainer.children.length > 0) {
            updatePaginationState(isResize);
            return;
        }

        currentTotalPages = totalPages;
        paginationContainer.innerHTML = '';

        if (totalPages <= 1 || !isDesktop()) return;

        const handlePageChange = (newPage) => {
            if (currentPage === newPage) return;
            currentPage = newPage;
            setStorage('discoPage', currentPage);
            updatePaginationState();
            triggerTransition(() => {
                renderGrid();
                const grid = document.getElementById('discography-grid');
                grid.style.height = '';
                scrollToGridTop();
            });
        };

        // 上一页
        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-btn nav-prev font-primary w-24 text-left';
        prevBtn.innerHTML = '< PREV';
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) handlePageChange(currentPage - 1);
        });
        paginationContainer.appendChild(prevBtn);

        // 页码
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn font-primary`;
            btn.innerText = i < 10 ? `0${i}` : i;
            btn.dataset.page = i;

            btn.addEventListener('click', () => handlePageChange(i));
            paginationContainer.appendChild(btn);
        }

        // 下一页
        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-btn nav-next font-primary w-24 text-right';
        nextBtn.innerHTML = 'NEXT >';
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) handlePageChange(currentPage + 1);
        });
        paginationContainer.appendChild(nextBtn);

        updatePaginationState(isResize);
    }

    // 分页器状态
    function updatePaginationState(isResize = false) {
        paginationContainer.style.position = 'relative';

        let activeBtn = null;
        const allBtns = paginationContainer.querySelectorAll('.page-btn');
        allBtns.forEach(btn => {
            if (parseInt(btn.dataset.page) === currentPage) {
                btn.classList.add('active');
                activeBtn = btn;
            } else {
                btn.classList.remove('active');
            }
        });

        let cursor = paginationContainer.querySelector('.bracket-cursor');
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'bracket-cursor font-primary';
            paginationContainer.appendChild(cursor);
            cursor.style.transition = 'none';
        }

        if (activeBtn) {
            if (isResize) cursor.style.transition = 'none';

            cursor.style.width = `${activeBtn.offsetWidth}px`;
            cursor.style.transform = `translateX(${activeBtn.offsetLeft}px)`;

            void cursor.offsetWidth;
            cursor.style.transition = '';
        }

        const prevBtn = paginationContainer.querySelector('.nav-prev');
        if (prevBtn) prevBtn.disabled = currentPage === 1;

        const nextBtn = paginationContainer.querySelector('.nav-next');
        if (nextBtn) nextBtn.disabled = currentPage === currentTotalPages;
    }

    // ------------ 跳转顶部 ------------
    function scrollToGridTop(onComplete) {
        const header = document.getElementById('floating-header');
        const section = document.querySelector('section');
        if (!section) return;

        if (header) {
            header.style.transitionDuration = '200ms';
            header.classList.remove('translate-y-0');
            header.classList.add('-translate-y-full');
        }

        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const offset = headerHeight || 80;

        requestAnimationFrame(() => {
            const sectionTop = section.getBoundingClientRect().top;
            const y = sectionTop + window.scrollY - offset;
            customSmoothScroll(y, 600, onComplete);
        });
    }

    // ------------ 过渡 ------------
    function triggerTransition(updateLogic) {
        const grid = document.getElementById('discography-grid');
        grid.style.height = grid.getBoundingClientRect().height + 'px';

        items.forEach(item => {
            if (item.style.display === 'block') {
                item.style.opacity = '0';
                item.style.transform = 'scale(0.95)';
            }
        });

        const emptySlots = document.querySelectorAll('.disco-empty-slot');
        emptySlots.forEach(slot => {
            slot.style.opacity = '0';
            slot.style.transform = 'scale(0.95)';
        });

        setTimeout(() => {
            updateLogic();
        }, 400);    // 400
    }

    // ------------ 事件绑定 ------------
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            if(button.classList.contains('active')) return;

            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            triggerTransition(() => {
                currentFilter = button.getAttribute('data-filter');
                currentPage = 1;

                setStorage('discoFilter', currentFilter);
                setStorage('discoPage', 1);

                var u = new URL(window.location);
                u.searchParams.set('filter', currentFilter);
                window.history.replaceState({}, '', u);

                renderGrid();
                const grid = document.getElementById('discography-grid');
                grid.style.height = '';
                scrollToGridTop();
            });
        });
    });

    window.addEventListener('resize', () => {
        renderGrid(true);
    });

    renderGrid(true);
});
