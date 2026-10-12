/**
 * <scroll-highlight> custom element for Wix Studio
 * Words light up one by one as the visitor scrolls the page.
 *
 * Attributes (set in the Custom Element settings panel):
 *   text   The sentence. Mark brand-colour phrases like {1:visas and jobs abroad,}
 *          1 = blue, 2 = purple, 3 = teal, 4 = red
 *   track  Optional CSS selector of a pinned/sticky Wix section (e.g. "#comp-abc123").
 *          If set, progress follows that section's scroll instead of this element.
 *   font   Optional font-family (default: Plus Jakarta Sans, system-ui, sans-serif)
 *   color  Optional text colour (default: #1b1a17)
 *   dim    Optional opacity of words not yet lit (default: 0.16)
 */
const DEFAULT_TEXT =
  'One trusted group guiding every journey: {1:visas and jobs abroad,} {2:holidays,} ' +
  '{3:Hajj and Umrah,} and {4:college admissions} across India, so you can move forward with confidence.';
const KEY_COLOURS = { 1: '#1b4fa8', 2: '#8b6cfa', 3: '#0a5f73', 4: '#e4002b' };

class ScrollHighlight extends HTMLElement {
  static get observedAttributes() {
    return ['text', 'track', 'font', 'color', 'dim'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._words = [];
    this._raf = 0;
    this._queue = this._queue.bind(this);
    this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  connectedCallback() {
    this._render();
    if (!this._reduced) {
      window.addEventListener('scroll', this._queue, { passive: true });
      window.addEventListener('resize', this._queue);
    }
    this._queue();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this._queue);
    window.removeEventListener('resize', this._queue);
    cancelAnimationFrame(this._raf);
  }

  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }

  _render() {
    const text = this.getAttribute('text') || DEFAULT_TEXT;
    const font = this.getAttribute('font') || "'Plus Jakarta Sans', system-ui, sans-serif";
    const color = this.getAttribute('color') || '#1b1a17';
    const dim = this.getAttribute('dim') || '0.16';

    // Split text into words, remembering which {n:...} group each word belongs to.
    const parts = [];
    const re = /\{(\d):([^}]+)\}/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index), k: 0 });
      parts.push({ t: m[2], k: Number(m[1]) });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ t: text.slice(last), k: 0 });

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = parts
      .flatMap((p) => p.t.split(/\s+/).filter(Boolean).map((w) => ({ w, k: p.k })))
      .map(({ w, k }) => `<span class="w${k ? ' k' : ''}"${k ? ` style="--u:${KEY_COLOURS[k] || color}"` : ''}>${esc(w)}</span>`)
      .join(' ');

    const plain = text.replace(/\{\d:([^}]+)\}/g, '$1');
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;width:100%}
        p{margin:0;color:${color};font-family:${font};font-weight:700;
          font-size:clamp(1.75rem,5.2vw,4.4rem);line-height:1.15;letter-spacing:-.035em}
        .w{opacity:${this._reduced ? 1 : dim};transition:opacity .25s}
        .w.on{opacity:1}
        .k{text-decoration:underline;text-decoration-color:var(--u);
          text-decoration-thickness:.07em;text-underline-offset:.14em}
      </style>
      <p role="text" aria-label="${plain.replace(/"/g, '&quot;')}">${html}</p>`;
    this._words = Array.from(this.shadowRoot.querySelectorAll('.w'));
    this._queue();
  }

  _queue() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._update();
    });
  }

  _update() {
    if (this._reduced || !this._words.length) return;
    const vh = window.innerHeight;
    const sel = this.getAttribute('track');
    const target = sel ? document.querySelector(sel) : null;
    let p;
    if (target) {
      // Pinned section: progress = how far the section has scrolled past the screen.
      const r = target.getBoundingClientRect();
      p = -r.top / Math.max(1, r.height - vh);
    } else {
      // No pinning: lights up as this element travels up the screen.
      const r = this.getBoundingClientRect();
      p = (0.85 * vh - r.top) / (0.7 * vh);
    }
    p = Math.min(1, Math.max(0, p));
    const n = Math.ceil(p * this._words.length * 1.1);
    this._words.forEach((el, i) => el.classList.toggle('on', i < n));
  }
}

if (!customElements.get('scroll-highlight')) {
  customElements.define('scroll-highlight', ScrollHighlight);
}
