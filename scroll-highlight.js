
/**
 * <scroll-highlight> custom element for Wix Studio
 * Scroll-driven word reveal with responsive typography.
 *
 * EXISTING ATTRIBUTES
 * text, track, font, font-url, color, dim, size, weight,
 * align, line, color1, color2, color3, color4, underline
 *
 * ANIMATION ATTRIBUTES
 * animation: fade | fade-up
 * duration: milliseconds (default 400)
 * stagger: per-word delay in milliseconds (default 0)
 * distance: initial vertical offset (default 12px)
 * start: normalized progress adjustment (default 0)
 * end: normalized progress adjustment (default 1)
 *
 * SCROLL BEHAVIOR
 * Starts when the element's top reaches 80vh.
 * Finishes when the element's bottom reaches -20vh.
 * The first visual line remains fully visible.
 *
 * RESPONSIVE ATTRIBUTES
 * size-tablet, size-mobile
 * line-tablet, line-mobile
 * align-tablet, align-mobile
 * weight-tablet, weight-mobile
 */

const DEFAULT_TEXT =
  'One trusted group guiding every journey: {1:visas and jobs abroad,} {2:holidays,} ' +
  '{3:Hajj and Umrah,} and {4:college admissions} across India, so you can move forward with confidence.';

const DEFAULT_KEYS = {
  1: '#1b4fa8',
  2: '#8b6cfa',
  3: '#0a5f73',
  4: '#e4002b'
};

const safe = (value) =>
  String(value).replace(/[;{}<>"\\]/g, '').trim();

class ScrollHighlight extends HTMLElement {
  static get observedAttributes() {
    return [
      'text', 'track', 'font', 'font-url', 'color', 'dim',
      'size', 'weight', 'align', 'line',
      'color1', 'color2', 'color3', 'color4', 'underline',
      'animation', 'duration', 'stagger', 'distance', 'start', 'end',
      'size-tablet', 'size-mobile',
      'line-tablet', 'line-mobile',
      'align-tablet', 'align-mobile',
      'weight-tablet', 'weight-mobile'
    ];
  }

  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this._words = [];
    this._raf = 0;

    this._queue = this._queue.bind(this);
    this._onResize = this._onResize.bind(this);

    this._reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }

  connectedCallback() {
    this._render();

    if (!this._reduced) {
      window.addEventListener('scroll', this._queue, {
        passive: true
      });

      window.addEventListener('resize', this._onResize);
    }

    this._queue();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this._queue);
    window.removeEventListener('resize', this._onResize);
    cancelAnimationFrame(this._raf);
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this._render();
    }
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

    const exists = Array.from(
      document.head.querySelectorAll('link[data-sh-font]')
    ).some((link) => link.getAttribute('data-sh-font') === url);

    if (exists) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-sh-font', url);
    document.head.appendChild(link);
  }

  _render() {
    const text = this.getAttribute('text') || DEFAULT_TEXT;

    const font = this._attr(
      'font',
      "'Plus Jakarta Sans', system-ui, sans-serif"
    );

    const color = this._attr('color', '#1b1a17');
    const dim = this._numberAttr('dim', 0.16, 0, 1);

    const size = this._attr(
      'size',
      'clamp(1.75rem,5.2vw,4.4rem)'
    );

    const weight = this._attr('weight', '700');
    const align = this._attr('align', 'left');
    const line = this._attr('line', '1.15');

    // Responsive typography.
    const sizeTablet = this._attr('size-tablet', size);
    const sizeMobile = this._attr('size-mobile', size);

    const lineTablet = this._attr('line-tablet', line);
    const lineMobile = this._attr('line-mobile', line);

    const alignTablet = this._attr('align-tablet', align);
    const alignMobile = this._attr('align-mobile', align);

    const weightTablet = this._attr('weight-tablet', weight);
    const weightMobile = this._attr('weight-mobile', weight);

    const underline =
      this._attr('underline', 'on').toLowerCase() !== 'off';

    const animation = this._attr('animation', 'fade-up').toLowerCase();

    const validAnimation =
      animation === 'fade' || animation === 'fade-up'
        ? animation
        : 'fade-up';

    const duration = this._numberAttr('duration', 400, 0, 2000);
    const stagger = this._numberAttr('stagger', 0, 0, 100);
    const distance = this._attr('distance', '12px');

    const keys = {};

    for (let i = 1; i <= 4; i++) {
      keys[i] = this._attr('color' + i, DEFAULT_KEYS[i]);
    }

    this._loadFont(
      (this.getAttribute('font-url') || '').trim()
    );

    // Parse highlighted phrases such as {1:highlighted words}.
    const parts = [];
    const regex = /\{(\d):([^}]+)\}/g;

    let last = 0;
    let match;

    while ((match = regex.exec(text))) {
      if (match.index > last) {
        parts.push({
          text: text.slice(last, match.index),
          key: 0
        });
      }

      parts.push({
        text: match[2],
        key: Number(match[1])
      });

      last = regex.lastIndex;
    }

    if (last < text.length) {
      parts.push({
        text: text.slice(last),
        key: 0
      });
    }

    const escapeText = (value) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    let wordIndex = 0;

    const html = parts
      .flatMap((part) =>
        part.text
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => ({
            word,
            key: part.key
          }))
      )
      .map(({ word, key }) => {
        const index = wordIndex++;
        const highlightColor = keys[key] || color;

        return (
          `<span class="w${key ? ' k' : ''}" ` +
          `style="--i:${index};--u:${highlightColor}">` +
          `${escapeText(word)}</span>`
        );
      })
      .join(' ');

    const plain = text.replace(/\{\d:([^}]+)\}/g, '$1');

    const keyStyle = underline
      ? `text-decoration:underline;
         text-decoration-color:var(--u);
         text-decoration-thickness:.07em;
         text-underline-offset:.14em`
      : 'color:var(--u)';

    const initialTransform =
      validAnimation === 'fade-up'
        ? `translate3d(0, ${distance}, 0)`
        : 'none';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        p {
          margin: 0;
          color: ${color};
          font-family: ${font};
          font-weight: ${weight};
          text-align: ${align};
          font-size: ${size};
          line-height: ${line};
          letter-spacing: -.035em;
          overflow-wrap: break-word;

          --sh-dim: ${dim};
          --sh-duration: ${duration}ms;
          --sh-stagger: ${stagger}ms;
        }

        .w {
          display: inline;
          opacity: var(--sh-dim);
          transition:
            opacity var(--sh-duration) ease,
            transform var(--sh-duration) ease;
          transition-delay: calc(var(--i) * var(--sh-stagger));
          transform: ${initialTransform};
        }

        .w.on {
          opacity: 1;
          transform: none;
        }

        .w.first-line {
          opacity: 1 !important;
          transform: none !important;
          transition-delay: 0ms !important;
        }

        .k {
          ${keyStyle}
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          p {
            font-size: ${sizeTablet};
            line-height: ${lineTablet};
            text-align: ${alignTablet};
            font-weight: ${weightTablet};
          }
        }

        @media (max-width: 768px) {
          p {
            font-size: ${sizeMobile};
            line-height: ${lineMobile};
            text-align: ${alignMobile};
            font-weight: ${weightMobile};
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .w {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }
      </style>

      <p role="text" aria-label="${escapeText(plain).replace(/"/g, '&quot;')}">
        ${html}
      </p>
    `;

    this._words = Array.from(
      this.shadowRoot.querySelectorAll('.w')
    );

    this._markFirstLine();
    this._queue();
  }

  _markFirstLine() {
    if (!this._words.length) return;

    this._words.forEach((word) => {
      word.classList.remove('first-line');
    });

    const firstRect = this._words[0].getBoundingClientRect();
    const firstTop = firstRect.top;

    this._words.forEach((word) => {
      const rect = word.getBoundingClientRect();

      if (Math.abs(rect.top - firstTop) <= 2) {
        word.classList.add('first-line');
      }
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

  _update() {
    if (!this._words.length) return;

    if (this._reduced) {
      this._words.forEach((word) => word.classList.add('on'));
      return;
    }

    const rect = this.getBoundingClientRect();
    const vh = window.innerHeight;

    // Start when the element's top reaches 20vh from the bottom.
    const startY = vh * 0.8;

    // Finish when the element's bottom reaches 20vh above the viewport.
    const endTop = -rect.height - vh * 0.2;

    let progress =
      (startY - rect.top) / (startY - endTop);

    // Optional normalized progress adjustments.
    const start = this._numberAttr('start', 0, 0, 0.99);
    const end = this._numberAttr('end', 1, 0.01, 1);
    const range = Math.max(0.01, end - start);

    progress = Math.min(
      1,
      Math.max(0, (progress - start) / range)
    );

    // Reveal words progressively across the scroll distance.
    const revealableWords = this._words.filter(
      (word) => !word.classList.contains('first-line')
    );

    const count = Math.ceil(
      progress * revealableWords.length
    );

    revealableWords.forEach((word, index) => {
      word.classList.toggle('on', index < count);
    });

    // The first visual line remains fully visible.
    this._words
      .filter((word) => word.classList.contains('first-line'))
      .forEach((word) => word.classList.add('on'));
  }
}

if (!customElements.get('scroll-highlight')) {
  customElements.define('scroll-highlight', ScrollHighlight);
}
