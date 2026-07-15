document.addEventListener('DOMContentLoaded', () => {
    const permanentTitles = document.querySelectorAll('.decode-permanent');
    const charSet = 'AXYZB01CDEF23GHIJKLMNOPQR45STUV6789&$#%@!';

    permanentTitles.forEach(title => {
        const allSpans = [];

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

                            span.innerText = charSet[Math.floor(Math.random() * charSet.length)];
                            fragment.appendChild(span);
                            allSpans.push(span);
                        }
                    });
                    node.replaceChild(fragment, child);
                } else if (child.nodeType === 1) {
                    processNode(child);
                }
            });
        };

        processNode(title);

        setInterval(() => {
            allSpans.forEach(span => {
                span.innerText = charSet[Math.floor(Math.random() * charSet.length)];
            });
        }, 200);
    });
});
