document.addEventListener('DOMContentLoaded', () => {
    // ???
    const overlay = document.getElementById('question-overlay');
    const trigger = document.getElementById('avatar-trigger');
    
    if (overlay && trigger) {
        let showTimer = null;
        trigger.addEventListener('mouseenter', () => {
            clearTimeout(showTimer);
            showTimer = setTimeout(() => {
                overlay.classList.remove('opacity-0');
                overlay.classList.add('opacity-100');
            }, 12000);
        });
        trigger.addEventListener('mouseleave', () => {
            clearTimeout(showTimer);
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
        });
    }

    // 初始隐藏静态 Header
    if (!document.body.classList.contains('about-page')) return;
    const staticHeader = document.getElementById('static-header');
    if (!staticHeader) return;

    let hasShown = false;
    let lastScrollY = window.scrollY;

    window.scrollTo(0, 150);    // 150

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (!hasShown && currentScrollY < lastScrollY && currentScrollY > 10) {
            staticHeader.classList.add('header-shown');
            hasShown = true;
        }
        lastScrollY = currentScrollY;
    }, { passive: true });
});
