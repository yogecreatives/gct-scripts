/**
 * <scroll-highlight> custom element for Wix Studio
 * Scroll-driven word reveal with responsive typography.
 *
 * CORE ATTRIBUTES
 * text, track, font, font-url, color, dim, size, weight, align, line,
 * color1, color2, color3, color4, underline
 *
 * track:  "auto" = follow the tall section this element sits in (pinned effect),
 *         a CSS selector (e.g. "#comp-abc123"), or empty = follow this element.
 *
 * ANIMATION ATTRIBUTES
 * animation: fade | fade-up (default fade-up)
 * duration:  milliseconds (default 400)
 * stagger:   per-word delay in milliseconds, 0-100 (default 0)
 * distance:  initial vertical offset for fade-up (default 12px)
 * start / end: progress window, 0 to 1 (defaults 0 and 1)
 * first-line: on | off. On = the first line is always fully visible (default on)
 *
 * SCROLL BEHAVIOUR (normal page scroll, no pinning; leave track empty)
 * enter: vh from the BOTTOM of the screen where the reveal starts (default 20).
 *        The first line is visible; the rest start dimmed.
 * exit:  vh beyond the TOP of the screen where the reveal is complete (default 20).
 *        The reveal finishes smoothly before the element has fully left.
 *        Use a negative value to finish while the text is still on screen,
 *        e.g. exit="-45" = complete when the element's bottom reaches 45vh.
 *
 * RESPONSIVE ATTRIBUTES
 * size-tablet, size-mobile, line-tablet, line-mobile,
 * align-tablet, align-mobile, weight-tablet, weight-mobile
 */

const DEFAULT_TEXT =
  'One trusted group guiding every journey: {1:visas and jobs abroad,} {2:holidays,} ' +
  '{3:Hajj and Umrah,} and {4:college admissions} across India, so you can move forward with confidence.';

const DEFAULT_KEYS = { 1: '#1b4fa8', 2: '#8b6cfa', 3: '#0a5f73', 4: '#e4002b' };

const safe = (value) => String(value).replace(/[;{}<>"\\]/g, '').trim();

class ScrollHighlight extends HTMLElement {
  static get observedAttributes() {
    return [
      'text', 'track', 'font', 'font-url', 'color', 'dim',
      'size', 'weight', 'align', 'line',
      'color1', 'color2', 'color3', 'color4', 'underline',
      'animation', 'duration', 'stagger', 'distance', 'start', 'end', 'first-line', 'enter', 'exit',
      'size-tablet', 'size-mobile', 'line-tablet', 'line-mobile',
      'align-tablet', 'align-mobile', 'weight-tablet', 'weight-mobile'
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._words = [];
    this._raf = 0;
    this._queue = this._queue.bind(this);
    this._onResize = this._onResize.bind(this);
    this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  connectedCallback() {
    this._render();
    if (!this._reduced) {
      window.addEventListener('scroll', this._queue, { passive: true });
      window.addEventListener('resize', this._onResize);
    }
    // Fonts can change line wrapping after they load.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this._onResize());
    }
    this._queue();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this._queue);
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this._raf);
  }

  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }

  _attr(name, fallback) {
    const value = this.getAttribute(name);
    return value && value.trim() ? safe(value) : fallback;
  }

  _numberAttr(name, fallback, min, max) {
    const value = Number.parseFloat(this.getAttribute(name));
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  _loadFont(url) {
    if (!url || !/^https:\/\//.test(url)) return;
    const exists = Array.from(document.head.querySelectorAll('link[data-sh-font]'))
      .some((link) => link.getAttribute('data-sh-font') === url);
    if (exists) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-sh-font', url);
    document.head.appendChild(link);
  }

  _render() {
    const text = this.getAttribute('text') || DEFAULT_TEXT;
    const font = this._attr('font', "'Plus Jakarta Sans', system-ui, sans-serif");
    const color = this._attr('color', '#1b1a17');
    const dim = this._numberAttr('dim', 0.16, 0, 1);
    const size = this._attr('size', 'clamp(1.75rem,5.2vw,4.4rem)');
    const weight = this._attr('weight', '700');
    const align = this._attr('align', 'left');
    const line = this._attr('line', '1.15');

    const sizeTablet = this._attr('size-tablet', size);
    const sizeMobile = this._attr('size-mobile', size);
    const lineTablet = this._attr('line-tablet', line);
    const lineMobile = this._attr('line-mobile', line);
    const alignTablet = this._attr('align-tablet', align);
    const alignMobile = this._attr('align-mobile', align);
    const weightTablet = this._attr('weight-tablet', weight);
    const weightMobile = this._attr('weight-mobile', weight);

    const underline = this._attr('underline', 'on').toLowerCase() !== 'off';
    const animation = this._attr('animation', 'fade-up').toLowerCase();
    const validAnimation = animation === 'fade' || animation === 'fade-up' ? animation : 'fade-up';
    const duration = this._numberAttr('duration', 400, 0, 2000);
    const stagger = this._numberAttr('stagger', 0, 0, 100);
    const distance = this._attr('distance', '12px');

    const keys = {};
    for (let i = 1; i <= 4; i++) keys[i] = this._attr('color' + i, DEFAULT_KEYS[i]);

    this._loadFont((this.getAttribute('font-url') || '').trim());

    // Parse highlighted phrases such as {1:highlighted words}.
    const parts = [];
    const regex = /\{(\d):([^}]+)\}/g;
    let last = 0;
    let match;
    while ((match = regex.exec(text))) {
      if (match.index > last) parts.push({ text: text.slice(last, match.index), key: 0 });
      parts.push({ text: match[2], key: Number(match[1]) });
      last = regex.lastIndex;
    }
    if (last < text.length) parts.push({ text: text.slice(last), key: 0 });

    const escapeText = (value) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let wordIndex = 0;
    const html = parts
      .flatMap((part) => part.text.split(/\s+/).filter(Boolean).map((word) => ({ word, key: part.key })))
      .map(({ word, key }) => {
        const index = wordIndex++;
        const highlightColor = keys[key] || color;
        return `<span class="w${key ? ' k' : ''}" style="--i:${index};--u:${highlightColor}">${escapeText(word)}</span>`;
      })
      .join(' ');

    const plain = text.replace(/\{\d:([^}]+)\}/g, '$1');
    const keyStyle = underline
      ? 'text-decoration:underline;text-decoration-color:var(--u);text-decoration-thickness:.07em;text-underline-offset:.14em'
      : 'color:var(--u)';
    const initialTransform = validAnimation === 'fade-up' ? `translate3d(0, ${distance}, 0)` : 'none';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        p {
          margin: 0; color: ${color}; font-family: ${font}; font-weight: ${weight};
          text-align: ${align}; font-size: ${size}; line-height: ${line};
          letter-spacing: -.035em; overflow-wrap: break-word;
          --sh-dim: ${dim}; --sh-duration: ${duration}ms; --sh-stagger: ${stagger}ms;
        }
        /* inline-block is required: transforms do not apply to plain inline text. */
        .w {
          display: inline-block;
          opacity: var(--sh-dim);
          transform: ${initialTransform};
          transition: opacity var(--sh-duration) ease, transform var(--sh-duration) ease;
          transition-delay: calc(var(--i) * var(--sh-stagger));
        }
        .w.on { opacity: 1; transform: none; }
        .w.first-line { opacity: 1 !important; transform: none !important; transition-delay: 0ms !important; }
        .k { ${keyStyle} }
        @media (min-width: 769px) and (max-width: 1024px) {
          p { font-size: ${sizeTablet}; line-height: ${lineTablet}; text-align: ${alignTablet}; font-weight: ${weightTablet}; }
        }
        @media (max-width: 768px) {
          p { font-size: ${sizeMobile}; line-height: ${lineMobile}; text-align: ${alignMobile}; font-weight: ${weightMobile}; }
        }
        @media (prefers-reduced-motion: reduce) {
          .w { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      </style>
      <p role="text" aria-label="${escapeText(plain).replace(/"/g, '&quot;')}">${html}</p>`;

    this._words = Array.from(this.shadowRoot.querySelectorAll('.w'));
    this._markFirstLine();
    this._queue();
  }

  // Marks every word on the first visual line. Uses offsetTop, which is not
  // affected by the fade-up transform, so it stays correct while words animate.
  _markFirstLine() {
    if (!this._words.length) return;
    this._words.forEach((word) => word.classList.remove('first-line'));
    if (this._attr('first-line', 'on').toLowerCase() === 'off') return;
    const firstTop = this._words[0].offsetTop;
    this._words.forEach((word) => {
      if (Math.abs(word.offsetTop - firstTop) <= 2) word.classList.add('first-line');
    });
  }

  _onResize() {
    this._markFirstLine();
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
    if (!this._words.length) return;

    if (this._reduced) {
      this._words.forEach((word) => word.classList.add('on'));
      return;
    }

    const vh = window.innerHeight;
    const sel = this.getAttribute('track');
    let target = null;
    if (sel === 'auto') target = this._findSection();
    else if (sel) target = document.querySelector(sel);

    let progress;
    if (target) {
      // Pinned section: progress = how far the section has scrolled past the screen.
      const r = target.getBoundingClientRect();
      progress = -r.top / Math.max(1, r.height - vh);
    } else {
      // Normal scroll: starts when the top is `enter` vh above the bottom of the screen,
      // finishes when the element's bottom is `exit` vh beyond the top of the screen.
      const r = this.getBoundingClientRect();
      const enter = this._numberAttr('enter', 20, 0, 100);
      const exit = this._numberAttr('exit', 20, -100, 100);
      const startY = vh * (1 - enter / 100);
      const endTop = -r.height - vh * (exit / 100);
      progress = (startY - r.top) / Math.max(1, startY - endTop);
    }

    const start = this._numberAttr('start', 0, 0, 0.99);
    const end = this._numberAttr('end', 1, 0.01, 1);
    const range = Math.max(0.01, end - start);
    progress = Math.min(1, Math.max(0, (progress - start) / range));

    const revealable = this._words.filter((word) => !word.classList.contains('first-line'));
    const count = Math.ceil(progress * revealable.length);
    revealable.forEach((word, index) => word.classList.toggle('on', index < count));
    this._words.forEach((word) => {
      if (word.classList.contains('first-line')) word.classList.add('on');
    });
  }
}

if (!customElements.get('scroll-highlight')) {
  customElements.define('scroll-highlight', ScrollHighlight);
}
