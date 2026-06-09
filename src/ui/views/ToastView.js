export class ToastView {
    constructor() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'success', duration = 3000) {
        const activeToasts = Array.from(this.container.children).filter(t => !t.classList.contains('is-removing'));
        if (activeToasts.length >= 3) {
            const oldestToast = activeToasts[0];
            oldestToast.classList.remove('show');
            oldestToast.classList.add('is-removing');
            oldestToast.addEventListener('transitionend', () => oldestToast.remove());
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        this.container.appendChild(toast);

        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

        const dismiss = () => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        };

        if (duration > 0) {
            setTimeout(dismiss, duration);
        } else {
            const clickToDismiss = () => { dismiss(); window.removeEventListener('pointerdown', clickToDismiss); };
            setTimeout(() => window.addEventListener('pointerdown', clickToDismiss), 1000);
        }
    }
}