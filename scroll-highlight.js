
class ScrollHighlight extends HTMLElement {
  static get observedAttributes() {
    return [
      "animation",
      "dim",
      "duration",
      "stagger",
      "font-family",
      "font-size",
      "font-size-desktop",
      "font-size-tablet",
      "font-size-mobile",
      "font-weight",
      "line-height",
      "letter-spacing",
      "text-align",
      "color",
      "highlight-1",
      "highlight-2",
      "highlight-3",
      "highlight-4",
      "highlight-5",
      "track",
      "start",
      "end"
    ];
  }

  constructor() {
    super();

    this._sourceHTML = null;
    this._words = [];
    this._lastProgress = 0;
    this._raf = null;
    this._resizeObserver = null;
    this._initialized = false;

    this._onScroll = this._onScroll.bind(this);
    this._update = this._update.bind(this);
  }

  connectedCallback() {
    if (this._sourceHTML === null) {
      this._sourceHTML = this.innerHTML;
    }

    this._render();
    this._initialized = true;

    window.addEventListener("scroll", this._onScroll, {
      passive: true
    });

    window.addEventListener("resize", this._onScroll, {
      passive: true
    });

    if ("ResizeObserver" in window) {
      this._resizeObserver = new ResizeObserver(() => {
        this._markFirstVisualLine();
        this._onScroll();
      });

      this._resizeObserver.observe(this);
    }

    this._onScroll();
  }

  disconnectedCallback() {
    window.removeEventListener("scroll", this._onScroll);
    window.removeEventListener("resize", this._onScroll);

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  attributeChangedCallback() {
    if (!this._initialized || this._sourceHTML === null) {
      return;
    }

    this._render();
    this._lastProgress = 0;
    this._onScroll();
  }

  _render() {
    const animation = this.getAttribute("animation") || "fade";
    const dim = this._getNumber("dim", 0.2);
    const duration = this._getNumber("duration", 500);
    const stagger = this._getNumber("stagger", 15);

    const fontFamily = this.getAttribute("font-family");
    const fontSize = this.getAttribute("font-size");
    const fontSizeDesktop =
      this.getAttribute("font-size-desktop") || fontSize;
    const fontSizeTablet =
      this.getAttribute("font-size-tablet") || fontSizeDesktop;
    const fontSizeMobile =
      this.getAttribute("font-size-mobile") || fontSizeTablet;

    const fontWeight = this.getAttribute("font-weight");
    const lineHeight = this.getAttribute("line-height");
    const letterSpacing = this.getAttribute("letter-spacing");
    const textAlign = this.getAttribute("text-align");
    const color = this.getAttribute("color");

    this.style.display = "block";

    const styles = `
      :host {
        display: block;
      }

      .sh-content {
        display: block;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        font-weight: inherit;
        letter-spacing: inherit;
        text-align: inherit;
        color: inherit;
      }

      .sh-word {
        display: inline-block;
        opacity: ${dim};
        transition:
          opacity ${duration}ms ease,
          transform ${duration}ms ease;
        will-change: opacity, transform;
      }

      .sh-word.sh-first-line {
        opacity: 1 !important;
        transform: none !important;
      }

      .sh-content[data-animation="fade-up"] .sh-word {
        transform: translateY(0.3em);
      }

      .sh-content[data-animation="fade-up"] .sh-word.sh-visible {
        transform: translateY(0);
      }

      .sh-content[data-animation="fade"] .sh-word {
        transform: none;
      }

      .sh-content .sh-highlight {
        color: inherit;
      }

      ${[1, 2, 3, 4, 5]
        .map((n) => {
          const value = this.getAttribute(`highlight-${n}`);
          return value
            ? `.sh-content .sh-highlight-${n} { color: ${value}; }`
            : "";
        })
        .join("\n")}

      @media (min-width: 1025px) {
        .sh-content {
          ${fontSizeDesktop ? `font-size: ${fontSizeDesktop};` : ""}
        }
      }

      @media (min-width: 768px) and (max-width: 1024px) {
        .sh-content {
          ${fontSizeTablet ? `font-size: ${fontSizeTablet};` : ""}
        }
      }

      @media (max-width: 767px) {
        .sh-content {
          ${fontSizeMobile ? `font-size: ${fontSizeMobile};` : ""}
        }
      }
    `;

    this.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = styles;
    this.appendChild(style);

    const content = document.createElement("div");
    content.className = "sh-content";
    content.dataset.animation =
      animation === "fade-up" ? "fade-up" : "fade";

    if (fontFamily) content.style.fontFamily = fontFamily;
    if (fontWeight) content.style.fontWeight = fontWeight;
    if (lineHeight) content.style.lineHeight = lineHeight;
    if (letterSpacing) content.style.letterSpacing = letterSpacing;
    if (textAlign) content.style.textAlign = textAlign;
    if (color) content.style.color = color;

    content.innerHTML = this._sourceHTML;
    this.appendChild(content);

    this._words = [];

    // Convert {1:phrase} syntax into highlighted phrases.
    // Split text into individual words without removing existing HTML.
    const walker = document.createTreeWalker(
      content,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;

          if (
            !node.nodeValue.trim() ||
            (parent &&
              parent.closest("script, style, .sh-word"))
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;

    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    for (const textNode of textNodes) {
      const fragment = document.createDocumentFragment();
      const text = textNode.nodeValue;
      const pattern = /\{(\d+):([^{}]+)\}/g;

      let lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          this._appendWords(
            fragment,
            text.slice(lastIndex, match.index),
            null,
            stagger
          );
        }

        const highlight = document.createElement("span");
        highlight.className =
          `sh-highlight sh-highlight-${match[1]}`;

        this._appendWords(
          highlight,
          match[2],
          match[1],
          stagger
        );

        fragment.appendChild(highlight);
        lastIndex = pattern.lastIndex;
      }

      if (lastIndex < text.length) {
        this._appendWords(
          fragment,
          text.slice(lastIndex),
          null,
          stagger
        );
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    }

    this._markFirstVisualLine();
    this._applyProgress(this._lastProgress);
  }

  _appendWords(container, text, highlightNumber, stagger) {
    const parts = text.match(/\s+|[^\s]+/g) || [];

    for (const part of parts) {
      if (/^\s+$/.test(part)) {
        container.appendChild(document.createTextNode(part));
        continue;
      }

      const word = document.createElement("span");
      word.className = "sh-word";
      word.textContent = part;

      word.style.transitionDelay =
        `${this._words.length * stagger}ms`;

      if (highlightNumber) {
        word.dataset.highlight = highlightNumber;
      }

      this._words.push(word);
      container.appendChild(word);
    }
  }

  _markFirstVisualLine() {
    if (!this._words.length) return;

    this._words.forEach((word) => {
      word.classList.remove("sh-first-line");
    });

    const firstWord = this._words[0];
    const firstRect = firstWord.getBoundingClientRect();
    const firstTop = firstRect.top;

    for (const word of this._words) {
      const rect = word.getBoundingClientRect();

      if (Math.abs(rect.top - firstTop) <= 2) {
        word.classList.add("sh-first-line");
      }
    }
  }

  _onScroll() {
    if (this._raf !== null) return;

    this._raf = requestAnimationFrame(this._update);
  }

  _update() {
    this._raf = null;

    if (!this.isConnected || !this._words.length) {
      return;
    }

    const rect = this.getBoundingClientRect();
    const vh = window.innerHeight;

    // START:
    // Begin when the element's top reaches 80vh.
    // This is 20vh into the viewport from the bottom.
    const startY = vh * 0.8;

    // END:
    // Finish when the element's bottom reaches 20vh
    // beyond the top of the viewport.
    const endTop = -rect.height - vh * 0.2;

    const rawProgress =
      (startY - rect.top) / (startY - endTop);

    const progress = Math.max(
      0,
      Math.min(1, rawProgress)
    );

    // Preserve the existing one-way reveal behavior.
    this._lastProgress = Math.max(
      this._lastProgress,
      progress
    );

    this._applyProgress(this._lastProgress);
  }

  _applyProgress(progress) {
    const dim = Math.max(
      0,
      Math.min(1, this._getNumber("dim", 0.2))
    );

    const total = this._words.length;

    if (!total) return;

    this._words.forEach((word, index) => {
      if (word.classList.contains("sh-first-line")) {
        word.style.opacity = "1";
        word.classList.add("sh-visible");
        return;
      }

      // Each word gets its own point along the scroll distance.
      const threshold = total <= 1
        ? 0
        : index / (total - 1);

      const revealed = progress >= threshold;

      word.style.opacity = revealed ? "1" : String(dim);
      word.classList.toggle("sh-visible", revealed);
    });
  }

  _getNumber(attribute, fallback) {
    const value = parseFloat(this.getAttribute(attribute));

    return Number.isFinite(value) ? value : fallback;
  }
}

if (!customElements.get("scroll-highlight")) {
  customElements.define("scroll-highlight", ScrollHighlight);
}
