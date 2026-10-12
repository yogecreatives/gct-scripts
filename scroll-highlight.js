
/**
 * <scroll-highlight> custom element for Wix Studio
 * Premium scroll-driven word reveal with responsive typography.
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
 * start: normalized scroll progress (default 0)
 * end: normalized scroll progress (default 0.85)
 *
 * RESPONSIVE ATTRIBUTES
 * size-tablet, size-mobile
 * line-tablet, line-mobile
 * align-tablet, align-mobile
 * weight-tablet, weight-mobile
 *
 * Desktop uses the original size, line, align and weight attributes.
 * Tablet styles apply from 769px to 1024px.
 * Mobile styles apply at 768px and below.
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

    // Responsive overrides. Empty attributes inherit desktop values.
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

    // Parse highlighted phrases.
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
        }

        .w {
          display: inline;
          opacity: ${this._reduced ? 1 : dim};
          transform: ${this._reduced ? 'none' : initialTransform};
          transition:
            opacity ${duration}ms ease,
            transform ${duration}ms cubic-bezier(.22, 1, .36, 1);
          transition-delay: calc(var(--i) * ${stagger}ms);
        }

        .w.on {
          opacity: 1;
          transform: translate3d(0, 0, 0);
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

    this._queue();
  }

  _queue() {
    if (this._raf) return;

    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._update();
    });
  }

  _findSection() {
    const minHeight = window.innerHeight * 1.5;
    let element = this.parentElement;

    while (
      element &&
      element !== document.body &&
      element !== document.documentElement
    ) {
      if (element.offsetHeight > minHeight) {
        return element;
      }

      element = element.parentElement;
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
    const selector = this.getAttribute('track');

    let target = null;

    if (selector === 'auto') {
      target = this._findSection();
    } else if (selector) {
      try {
        target = document.querySelector(selector);
      } catch (error) {
        target = null;
      }
    }

    let progress;

    if (target) {
      const rect = target.getBoundingClientRect();
      const distance = Math.max(1, rect.height - vh);

      progress = -rect.top / distance;
    } else {
      const rect = this.getBoundingClientRect();

      progress = (0.85 * vh - rect.top) / (0.7 * vh);
    }

    const start = this._numberAttr('start', 0, 0, 0.99);
    const end = this._numberAttr('end', 0.85, 0.01, 1);
    const range = Math.max(0.01, end - start);

    progress = Math.min(
      1,
      Math.max(0, (progress - start) / range)
    );

    const count = Math.ceil(
      progress * this._words.length * 1.1
    );

    this._words.forEach((word, index) => {
      word.classList.toggle('on', index < count);
    });
  }
}

if (!customElements.get('scroll-highlight')) {
  customElements.define('scroll-highlight', ScrollHighlight);
}
