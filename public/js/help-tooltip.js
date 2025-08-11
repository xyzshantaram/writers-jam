class HelpTooltip extends HTMLElement {
    connectedCallback() {
        const text = this.getAttribute('text') || '';
        const icon = this.getAttribute('icon') || '❔';

        this.attachShadow({ mode: 'open' }).innerHTML = `
        <style>
            :host {
                display: inline-flex;
                position: relative;
                align-items: center;
            }
            button {
                all: unset;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
            }

            [part="tooltip"] {
                position: absolute;
                top: 0;
                left: 100%;
                /* transform: translateX(-50%); */
                background: var(--body-primary, black);
                color: var(--body-bg, white);
                border: 1px solid var(--body-secondary, gray);
                padding: 0.4rem;
                width: calc(100vw - 0.8rem);
                max-width: 20ch;
                white-space: normal;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s ease-in-out;
                z-index: 10;
            }
            :host(:hover) [part="tooltip"],
            :host(:focus-within) [part="tooltip"] {
                opacity: 1;
                pointer-events: auto;
            }
        </style>
        <button aria-describedby="tip"><slot>${icon}</slot></button>
        <span part="tooltip" role="tooltip" id="tip">${text}</span>`;

        // Prevent clicks from toggling a parent label’s associated input
        const btn = this.shadowRoot?.querySelector('button');
        btn?.addEventListener('mousedown', (e) => e.stopPropagation(), { capture: true });
        btn?.addEventListener('click', (e) => e.stopPropagation(), { capture: true });
    }
}

customElements.define('help-tooltip', HelpTooltip);