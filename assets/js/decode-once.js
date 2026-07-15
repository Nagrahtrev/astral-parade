document.addEventListener('DOMContentLoaded', () => {

    const charSet = 'AXYZB01CDEF23GHIJKLMNOPQR45STUV6789&$#%@!';

    // 大小写匹配逻辑
    function getScrambledChar(originalChar) {
        const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
        if (/^[a-z]$/.test(originalChar)) {
            return randomChar.toLowerCase();
        }        
        return randomChar; 
    }

    // 入场乱码
    const decodeTitles = document.querySelectorAll('.decode-once');

    decodeTitles.forEach(title => {
        let globalCharIndex = 0;
        const animatedSpans = [];

        const processNode = (node) => {
            const nodes = Array.from(node.childNodes);
            nodes.forEach(child => {
                if (child.nodeType === 3) {
                    const text = child.textContent;
                    const fragment = document.createDocumentFragment();
                    
                    text.split('').forEach(char => {
                        if (char.trim() === '') {
                            fragment.appendChild(document.createTextNode(char));
                        } else {
                            const span = document.createElement('span');
                            span.innerText = char;
                            span.style.opacity = '0';
                            span.style.transition = 'opacity 0.2s';
                            fragment.appendChild(span);
                            
                            animatedSpans.push({ span, char, index: globalCharIndex });
                            globalCharIndex++;
                        }
                    });
                    node.replaceChild(fragment, child);
                } else if (child.nodeType === 1) {
                    processNode(child);
                }
            });
        };

        processNode(title);

        animatedSpans.forEach(({ span, char, index }) => {
            setTimeout(() => {
                span.style.opacity = '1';

                const iterations = Math.floor(Math.random() * 8) + 12;
                let iteration = 0;

                const decodeInterval = setInterval(() => {
                    // 大小写匹配
                    if (iteration < iterations) {
                        span.innerText = getScrambledChar(char);
                        span.style.transform = `translateX(${Math.random() * 2 - 1}px) translateY(${Math.random() * 2 - 1}px)`;
                        span.style.display = 'inline-block'; 
                        iteration++;
                    } else {
                        span.innerText = char;
                        span.style.transform = 'translate(0, 0)';
                        span.style.display = ''; 
                        span.style.color = '';
                        clearInterval(decodeInterval);
                    }
                }, 80);
            }, index * 40);
        });
    });

    // 悬停乱码
    const hoverTargets = document.querySelectorAll('.hover-decode');

    hoverTargets.forEach(el => {

        const textSpans = [];
        
        const processHoverNode = (node) => {
            const nodes = Array.from(node.childNodes);
            nodes.forEach(child => {
                if (child.nodeType === 3) {
                    const text = child.textContent;
                    const fragment = document.createDocumentFragment();
                    
                    text.split('').forEach(char => {
                        if (char.trim() === '') {
                            fragment.appendChild(document.createTextNode(char));
                        } else {
                            const span = document.createElement('span');
                            span.innerText = char;
                            fragment.appendChild(span);
                            // 收集 span 和它的原始字符，方便后面只改变文字
                            textSpans.push({ span, originalChar: char });
                        }
                    });
                    node.replaceChild(fragment, child);
                } else if (child.nodeType === 1) {
                    processHoverNode(child);
                }
            });
        };

        processHoverNode(el);

        let hoverInterval;

        el.addEventListener('mouseenter', () => {
            clearInterval(hoverInterval);
            
            hoverInterval = setInterval(() => {
                textSpans.forEach(({ span, originalChar }) => {
                    if (originalChar === '@' || originalChar === '.') return;
                    span.innerText = getScrambledChar(originalChar);
                });
            }, 60); 
        });

        el.addEventListener('mouseleave', () => {
            clearInterval(hoverInterval);
            textSpans.forEach(({ span, originalChar }) => {
                span.innerText = originalChar;
            });
        });
    });

});
