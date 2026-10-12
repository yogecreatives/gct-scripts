/**
 * <scroll-highlight> custom element for Wix Studio
 * Words light up one by one as the visitor scrolls the page.
 *
 * Attributes (set in the Custom Element settings panel). All are optional.
 *   text       The sentence. Mark highlighted phrases like {1:visas and jobs abroad,}
 *              1-4 pick the highlight colours color1-color4.
 *   track      "auto" = follow the tall section this element sits in (pinned effect).
 *              Or a CSS selector such as "#comp-abc123". Empty = follow this element.
 *   font       Font family, e.g. Poppins, sans-serif   (default: Plus Jakarta Sans)
 *   font-url   Google Fonts link to load the font, e.g.
 *              https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap
 *   color      Text colour                              (default: #1b1a17)
 *   dim        Opacity of words not yet lit, 0 to 1     (default: 0.16)
 *   size       Text size, any CSS size, e.g. 56px       (default: clamp(1.75rem,5.2vw,4.4rem))
 *   weight     Font weight, e.g. 400, 600, 700, 800     (default: 700)
 *   align      left, center or right                    (default: left)
 *   line       Line height, e.g. 1.15                   (default: 1.15)
 *   color1-4   Highlight colours for {1:..} to {4:..}   (defaults: blue, purple, teal, red)
 *   underline  on or off. Off = highlighted phrases are coloured instead of underlined (default: on)
 */
const DEFAULT_TEXT =
  'One trusted group guiding every journey: {1:visas and jobs abroad,} {2:holidays,} ' +
  '{3:Hajj and Umrah,} and {4:college admissions} across India, so you can move forward with confidence.';
const DEFAULT_KEYS = { 1: '#1b4fa8', 2: '#8b6cfa', 3: '#0a5f73', 4: '#e4002b' };

// Keeps attribute values safe to place inside CSS.
const safe = (v) => String(v).replace(/[;{}<>"\\]/g, '').trim();

class ScrollHighlight extends HTMLElement {
  static get observedAttributes() {
    return ['text', 'track', 'font', 'font-url', 'color', 'dim', 'size', 'weight',
      'align', 'line', 'color1', 'color2', 'color3', 'color4', 'underline'];
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

  _attr(name, fallback) {
    const v = this.getAttribute(name);
    return v && v.trim() ? safe(v) : fallback;
  }

  // Fonts must be loaded in the main page (not inside the shadow DOM).
  _loadFont(url) {
    if (!url || !/^https:\/\//.test(url)) return;
    if (document.head.querySelector(`link[data-sh-font="${CSS.escape(url)}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url;
    l.setAttribute('data-sh-font', url);
    document.head.appendChild(l);
  }

  _render() {
    const text = this.getAttribute('text') || DEFAULT_TEXT;
    const font = this._attr('font', "'Plus Jakarta Sans', system-ui, sans-serif");
    const color = this._attr('color', '#1b1a17');
    const dim = this._attr('dim', '0.16');
    const size = this._attr('size', 'clamp(1.75rem,5.2vw,4.4rem)');
    const weight = this._attr('weight', '700');
    const align = this._attr('align', 'left');
    const line = this._attr('line', '1.15');
    const underline = this._attr('underline', 'on').toLowerCase() !== 'off';
    const keys = {};
    for (let i = 1; i <= 4; i++) keys[i] = this._attr('color' + i, DEFAULT_KEYS[i]);
    this._loadFont((this.getAttribute('font-url') || '').trim());

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
      .map(({ w, k }) => `<span class="w${k ? ' k' : ''}"${k ? ` style="--u:${keys[k] || color}"` : ''}>${esc(w)}</span>`)
      .join(' ');

    const plain = text.replace(/\{\d:([^}]+)\}/g, '$1');
    const keyStyle = underline
      ? 'text-decoration:underline;text-decoration-color:var(--u);text-decoration-thickness:.07em;text-underline-offset:.14em'
      : 'color:var(--u)';
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;width:100%}
        p{margin:0;color:${color};font-family:${font};font-weight:${weight};text-align:${align};
          font-size:${size};line-height:${line};letter-spacing:-.035em}
        .w{opacity:${this._reduced ? 1 : dim};transition:opacity .25s}
        .w.on{opacity:1}
        .k{${keyStyle}}
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

  // Finds the nearest tall ancestor (the pinned section) without needing its id.
  _findSection() {
    const min = window.innerHeight * 1.5;
    let el = this.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.offsetHeight > min) return el;
      el = el.parentElement;
    }
    return null;
  }

  _update() {
    if (this._reduced || !this._words.length) return;
    const vh = window.innerHeight;
    const sel = this.getAttribute('track');
    let target = null;
    if (sel === 'auto') target = this._findSection();
    else if (sel) target = document.querySelector(sel);
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
