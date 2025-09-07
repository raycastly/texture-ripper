const FeedbackManager = (() => {
    let feedbackEl = null;

    function init() {
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'universal-feedback';
            feedbackEl.className = 'universal-feedback';
            Object.assign(feedbackEl.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) scale(0.8)',
                padding: '12px 24px',
                background: 'rgba(0,0,0,0.85)',
                color: '#fff',
                borderRadius: '6px',
                zIndex: 9999,
                fontFamily: 'sans-serif',
                fontSize: '16px',
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                textAlign: 'center',
                maxWidth: '80%',
                wordWrap: 'break-word'
            });
            document.body.appendChild(feedbackEl);
        }
    }

    function show(message, options = {}) {
        init();

        const { duration = 1500, bgColor, textColor } = options;

        feedbackEl.textContent = message;
        feedbackEl.style.background = bgColor || 'rgba(0,0,0,0.85)';
        feedbackEl.style.color = textColor || '#fff';
        feedbackEl.style.opacity = '1';
        feedbackEl.style.transform = 'translate(-50%, -50%) scale(1)';

        // Hide after duration
        setTimeout(() => {
            feedbackEl.style.opacity = '0';
            feedbackEl.style.transform = 'translate(-50%, -50%) scale(0.8)';
        }, duration);
    }

    return { show };
})();
