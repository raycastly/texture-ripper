const FeedbackManager = (() => {
    let feedbackEl = null;
    let spinnerOverlay = null;

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
                zIndex: 10000,
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

    function initSpinner() {
        if (!spinnerOverlay) {
            spinnerOverlay = document.createElement('div');
            Object.assign(spinnerOverlay.style, {
                position: 'fixed',
                top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)',
                display: 'none',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999
            });

            const box = document.createElement('div');
            Object.assign(box.style, {
                background: 'rgba(0,0,0,0.85)',
                borderRadius: '8px',
                padding: '24px 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
            });

            const spinner = document.createElement('div');
            Object.assign(spinner.style, {
                width: '32px', height: '32px',
                border: '3px solid rgba(255,255,255,0.2)',
                borderTop: '3px solid #fff',
                borderRadius: '50%',
                animation: 'feedback-spin 0.8s linear infinite'
            });

            const label = document.createElement('div');
            label.className = 'spinner-label';
            Object.assign(label.style, {
                color: '#fff',
                fontFamily: 'sans-serif',
                fontSize: '14px'
            });

            // Add keyframes
            if (!document.getElementById('feedback-spin-style')) {
                const style = document.createElement('style');
                style.id = 'feedback-spin-style';
                style.textContent = '@keyframes feedback-spin { to { transform: rotate(360deg); } }';
                document.head.appendChild(style);
            }

            box.appendChild(spinner);
            box.appendChild(label);
            spinnerOverlay.appendChild(box);
            document.body.appendChild(spinnerOverlay);
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

    function showSpinner(message = 'Please wait...') {
        initSpinner();
        spinnerOverlay.querySelector('.spinner-label').textContent = message;
        spinnerOverlay.style.display = 'flex';
    }

    function hideSpinner() {
        if (spinnerOverlay) {
            spinnerOverlay.style.display = 'none';
        }
    }

    return { show, showSpinner, hideSpinner };
})();
