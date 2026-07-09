/* =========================================================
   Beauty Theme — JS
   Cart drawer, mobile menu, swatches, sticky ATC, predictive search
   ========================================================= */

(function () {
  'use strict';

  // ===== Mobile menu toggle =====
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-menu-toggle]')) {
      const menu = document.querySelector('[data-mobile-menu]');
      if (menu) menu.hidden = !menu.hidden;
    }
  });

  // ===== Cart drawer =====
  const cartDrawer = document.getElementById('CartDrawer');

  function openCart() {
    if (!cartDrawer) return;
    cartDrawer.hidden = false;
    document.body.style.overflow = 'hidden';
    refreshCart();
  }

  function closeCart() {
    if (!cartDrawer) return;
    cartDrawer.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-cart-open]')) {
      e.preventDefault();
      openCart();
    }
    if (e.target.closest('[data-cart-close]')) {
      e.preventDefault();
      closeCart();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (cartDrawer && !cartDrawer.hidden) closeCart();
      closeSearch();
    }
  });

  // ===== Refresh cart contents =====
  async function refreshCart() {
    try {
      const res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      const cart = await res.json();
      updateCartCount(cart.item_count);
      renderCartBody(cart);
    } catch (err) {
      console.error('Cart refresh failed', err);
    }
  }

  function updateCartCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  function renderCartBody(cart) {
    const body = document.querySelector('[data-cart-body]');
    if (!body) return;
    if (cart.item_count === 0) {
      body.innerHTML = '<p class="cart-drawer__empty">Your bag is empty.</p>';
      return;
    }
    const items = cart.items.map(function (item) {
      return `
        <div class="cart-drawer__item">
          <img src="${item.image}" alt="${escapeHtml(item.product_title)}" width="80" height="100" style="object-fit:cover">
          <div class="cart-drawer__item-info">
            <p class="cart-drawer__item-name">${escapeHtml(item.product_title)}</p>
            <p class="cart-drawer__item-variant">${escapeHtml(item.variant_title || '')}</p>
            <p>Qty: ${item.quantity}</p>
            <p>${formatMoney(item.line_price)}</p>
          </div>
        </div>
      `;
    }).join('');
    body.innerHTML = items + `
      <div class="cart-drawer__footer" style="margin-top:24px;padding-top:24px;border-top:2px solid currentColor">
        <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:16px">
          <span>Subtotal</span><span>${formatMoney(cart.total_price)}</span>
        </div>
        <a href="/checkout" class="btn btn--primary btn--block">Checkout</a>
        <a href="/cart" class="btn btn--outline btn--block" style="margin-top:8px">View bag</a>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  // ===== Intercept add-to-cart forms =====
  document.addEventListener('submit', async function (e) {
    const form = e.target.closest('[data-product-form]');
    if (!form) return;
    e.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.dataset.originalText = submit.textContent; submit.textContent = 'Adding...'; }
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Add failed');
      openCart();
    } catch (err) {
      alert('Sorry, something went wrong adding this to your bag.');
      console.error(err);
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = submit.dataset.originalText || 'Add to bag'; }
    }
  });

  // ===== Cart drawer custom element =====
  if (!customElements.get('ui-cart-drawer')) {
    customElements.define('ui-cart-drawer', class extends HTMLElement {});
  }

  // ===== Sticky header subtle shadow on scroll =====
  const header = document.querySelector('.site-header[data-sticky="true"]');
  if (header) {
    let ticking = false;
    document.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          header.style.boxShadow = window.scrollY > 8 ? '0 1px 0 rgba(0,0,0,0.05)' : 'none';
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ===== Product page: variant switching + swatch picker =====
  const productSection = document.querySelector('[data-product-section]');
  if (productSection) {
    // Gallery: thumbnail click swaps the main image
    const galleryMain = productSection.querySelector('[data-main-image]');
    const galleryThumbs = productSection.querySelectorAll('[data-thumb]');
    galleryThumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (galleryMain) galleryMain.src = btn.dataset.full;
        galleryThumbs.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
      });
    });

    const variantJsonEl = productSection.querySelector('[data-product-json]');
    const variants = variantJsonEl ? JSON.parse(variantJsonEl.textContent) : [];
    const variantIdInput = productSection.querySelector('[data-variant-id]');
    const priceContainer = productSection.querySelector('[data-product-price]');
    const stickyPrice = document.querySelector('[data-sticky-price]');
    const addButton = productSection.querySelector('[data-add-button]');
    const addLabel = productSection.querySelector('[data-add-label]');

    function selectedOptions() {
      const options = [];
      productSection.querySelectorAll('.product-form__option').forEach(function (fieldset) {
        const checked = fieldset.querySelector('input[type="radio"]:checked');
        options.push(checked ? checked.value : null);
      });
      return options;
    }

    function findVariant(opts) {
      return variants.find(function (v) {
        return v.options.every(function (val, i) { return val === opts[i]; });
      });
    }

    function updateOptionSelectedLabels() {
      productSection.querySelectorAll('.product-form__option').forEach(function (fieldset) {
        const checked = fieldset.querySelector('input[type="radio"]:checked');
        const label = fieldset.querySelector('[data-option-selected]');
        if (label && checked) label.textContent = checked.value;
      });
    }

    function updatePrice(variant) {
      if (!priceContainer || !variant) return;
      const price = formatMoney(variant.price);
      const compare = variant.compare_at_price && variant.compare_at_price > variant.price
        ? '<s class="price__compare">' + formatMoney(variant.compare_at_price) + '</s>'
        : '';
      const main = variant.compare_at_price && variant.compare_at_price > variant.price
        ? '<span class="price__sale">' + price + '</span>'
        : '<span class="price__regular">' + price + '</span>';
      priceContainer.innerHTML = '<div class="price">' + main + ' ' + compare + '</div>';
      if (stickyPrice) stickyPrice.innerHTML = priceContainer.innerHTML;
    }

    function updateAddButton(variant) {
      if (!addButton) return;
      if (!variant) {
        addButton.disabled = true;
        if (addLabel) addLabel.textContent = 'Unavailable';
        return;
      }
      addButton.disabled = !variant.available;
      if (addLabel) addLabel.textContent = variant.available ? 'Add to bag' : 'Sold out';
    }

    productSection.addEventListener('change', function (e) {
      if (!e.target.matches('[data-option-input]')) return;
      const opts = selectedOptions();
      const variant = findVariant(opts);
      if (variantIdInput && variant) variantIdInput.value = variant.id;
      updateOptionSelectedLabels();
      updatePrice(variant);
      updateAddButton(variant);
    });

    // Sticky ATC button proxies the main add button
    const stickyAdd = document.querySelector('[data-sticky-add]');
    if (stickyAdd) {
      stickyAdd.addEventListener('click', function (e) {
        e.preventDefault();
        const form = productSection.querySelector('[data-product-form]');
        if (form) form.requestSubmit();
      });
    }

    // ===== Sticky ATC: show when main button leaves viewport =====
    const stickyAtc = document.querySelector('[data-sticky-atc]');
    if (stickyAtc && addButton && 'IntersectionObserver' in window) {
      stickyAtc.hidden = false;
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          // Show sticky bar when the main button is NOT visible AND user has scrolled past it
          const buttonAboveViewport = entry.boundingClientRect.bottom < 0;
          const shouldShow = !entry.isIntersecting && buttonAboveViewport;
          stickyAtc.setAttribute('data-visible', shouldShow ? 'true' : 'false');
          stickyAtc.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        });
      }, { threshold: 0, rootMargin: '0px 0px -80px 0px' });
      observer.observe(addButton);
    }
  }

  // ===== Predictive search (overlay on mobile, dropdown on desktop) =====
  const searchPopover = document.querySelector('[data-search-popover]');
  const searchToggle = document.querySelector('[data-search-open]');
  const popoverInput = searchPopover ? searchPopover.querySelector('[data-search-input]') : null;

  function openSearch() {
    if (!searchPopover) return;
    searchPopover.hidden = false;
    document.body.style.overflow = 'hidden';
    if (searchToggle) searchToggle.setAttribute('aria-expanded', 'true');
    setTimeout(function () { if (popoverInput) popoverInput.focus(); }, 50);
  }

  function closeSearch() {
    if (!searchPopover || searchPopover.hidden) return;
    searchPopover.hidden = true;
    document.body.style.overflow = '';
    if (searchToggle) searchToggle.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-open]')) {
      e.preventDefault();
      openSearch();
    }
    if (e.target.closest('[data-search-close]')) {
      e.preventDefault();
      closeSearch();
    }
  });

  const SEARCH_HINT = '<p class="predictive-search__hint">Start typing to see suggestions.</p>';

  function resultsFor(input) {
    const scope = input.closest('.site-header__search-wrap, .predictive-search');
    return scope ? scope.querySelector('[data-search-results]') : null;
  }

  document.querySelectorAll('[data-search-input]').forEach(function (input) {
    const resultsEl = resultsFor(input);
    const inline = input.hasAttribute('data-search-input-inline');
    let timer = null;
    let last = '';
    let abort = null;

    function show() { if (inline && resultsEl) resultsEl.hidden = false; }
    function hide() { if (inline && resultsEl) resultsEl.hidden = true; }

    input.addEventListener('input', function () {
      const q = input.value.trim();
      if (q === last) return;
      last = q;
      clearTimeout(timer);
      if (q.length < 2) {
        if (resultsEl) resultsEl.innerHTML = SEARCH_HINT;
        hide();
        return;
      }
      timer = setTimeout(function () { run(q); }, 200);
    });

    if (inline) {
      input.addEventListener('focus', function () {
        if (resultsEl && input.value.trim().length >= 2 && resultsEl.innerHTML.trim()) show();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { hide(); input.blur(); }
      });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.site-header__search-wrap')) hide();
      });
    }

    async function run(q) {
      if (!resultsEl) return;
      resultsEl.innerHTML = '<p class="predictive-search__loading">Searching&hellip;</p>';
      show();
      if (abort) abort.abort();
      abort = new AbortController();
      const params = new URLSearchParams({
        'q': q,
        'resources[type]': 'product',
        'resources[limit]': '8',
        'resources[options][unavailable_products]': 'last'
      });
      try {
        const res = await fetch('/search/suggest.json?' + params.toString(), {
          signal: abort.signal,
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('Search failed');
        render(await res.json(), q);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Predictive search failed', err);
        resultsEl.innerHTML = '<p class="predictive-search__empty">Search unavailable. Try the full search page.</p>';
      }
    }

    function render(data, q) {
      if (!resultsEl) return;
      const products = (data.resources && data.resources.results && data.resources.results.products) || [];
      if (products.length === 0) {
        resultsEl.innerHTML = '<p class="predictive-search__empty">No results for &ldquo;' + escapeHtml(q) + '&rdquo;.</p>';
        return;
      }
      const items = products.map(function (p) {
        const image = p.image
          ? '<img class="predictive-search__item-image" src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">'
          : '<div class="predictive-search__item-image"></div>';
        const vendor = p.vendor
          ? '<p class="predictive-search__item-vendor">' + escapeHtml(p.vendor) + '</p>'
          : '';
        const price = p.price
          ? '<p class="predictive-search__item-price">' + p.price + '</p>'
          : '';
        return `
          <a href="${escapeHtml(p.url)}" class="predictive-search__item">
            ${image}
            <div class="predictive-search__item-info">
              ${vendor}
              <p class="predictive-search__item-title">${escapeHtml(p.title)}</p>
              ${price}
            </div>
          </a>
        `;
      }).join('');
      resultsEl.innerHTML = `
        <h3 class="predictive-search__section-title">Products</h3>
        <ul class="predictive-search__items">${items}</ul>
        <a href="/search?q=${encodeURIComponent(q)}" class="predictive-search__view-all">View all results &rarr;</a>
      `;
    }
  });
  // ===== Product carousels (featured collection arrows) =====
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-carousel-prev], [data-carousel-next]');
    if (!btn) return;
    const sectionEl = btn.closest('section');
    const track = sectionEl && sectionEl.querySelector('[data-carousel-track]');
    if (!track) return;
    const isNext = btn.hasAttribute('data-carousel-next');
    const amount = Math.min(track.clientWidth * 0.9, 560);
    track.scrollBy({ left: isNext ? amount : -amount, behavior: 'smooth' });
  });

  // ===== Wishlist toggle (visual state) =====
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-wishlist]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
  });

  // ===== Hero slider: crossfade + dots + autoplay + glitter =====
  document.querySelectorAll('[data-hero-slider]').forEach(function (slider) {
    const slides = slider.querySelectorAll('[data-hero-slide]');
    const copies = slider.querySelectorAll('[data-hero-copy]');
    const dots = slider.querySelectorAll('[data-hero-dot]');
    const fgs = slider.querySelectorAll('[data-hero-fg]');
    const autoplay = parseInt(slider.dataset.autoplay, 10) || 5000;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    let timer = null;

    function goTo(n) {
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === n); });
      copies.forEach(function (c, i) { c.classList.toggle('is-active', i === n); });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === n); });
      fgs.forEach(function (f) { f.classList.toggle('is-active', parseInt(f.dataset.index, 10) === n); });
      current = n;
    }
    function next() { goTo((current + 1) % slides.length); }
    function restart() {
      if (timer) clearInterval(timer);
      if (slides.length > 1 && !reducedMotion) timer = setInterval(next, autoplay);
    }
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); restart(); });
    });
    restart();

    // Glitter burst across the banner on CTA hover
    if (!slider.hasAttribute('data-glitter') || reducedMotion) return;
    const colors = ['#ffe9a8', '#ffd76e', '#fff3d6', '#ffffff', '#ffc9e0', '#d6ecff'];
    let glitterTimer = null;
    function spawn(count) {
      for (let i = 0; i < count; i++) {
        const g = document.createElement('span');
        const star = Math.random() < 0.35;
        g.className = 'hero-glitter ' + (star ? 'hero-glitter--star' : 'hero-glitter--dot');
        g.style.left = (Math.random() * 100) + '%';
        g.style.top = (Math.random() * 100) + '%';
        g.style.setProperty('--s', (star ? 10 + Math.random() * 16 : 3 + Math.random() * 7) + 'px');
        g.style.setProperty('--d', (0.5 + Math.random() * 0.7) + 's');
        g.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
        slider.appendChild(g);
        g.addEventListener('animationend', function () { this.remove(); });
      }
    }
    slider.querySelectorAll('[data-sparkle-cta]').forEach(function (cta) {
      cta.addEventListener('mouseenter', function () {
        spawn(40);
        clearInterval(glitterTimer);
        glitterTimer = setInterval(function () { spawn(24); }, 140);
      });
      cta.addEventListener('mouseleave', function () {
        clearInterval(glitterTimer);
        glitterTimer = null;
      });
    });
  });

  // ===== AI beauty chat (scripted demo — swap aiRespond() source for a real AI later) =====
  const chatDrawer = document.querySelector('[data-chat-drawer]');
  if (chatDrawer) {
    const chatBody = chatDrawer.querySelector('[data-chat-body]');
    const chatForm = chatDrawer.querySelector('[data-chat-form]');
    const chatInput = chatDrawer.querySelector('[data-chat-input]');
    const replies = {
      routine: "Let's build it. A simple, high-impact routine: 1) Hydra Glow Serum to hydrate and plump, 2) Dewy Skin Tint SPF 30 for coverage plus protection, 3) Soft Matte Lip Cream to finish. Want it tailored to dry, oily or combination skin?",
      foundation: "Happy to match you. Most guests land within two shades of their neck tone — our Dewy Skin Tint comes in 24 flexible shades that self-adjust. Tell me your undertone (cool, neutral or warm) and I'll narrow it down.",
      gift: "Three most-loved gifts under $50: Soft Matte Lip Cream ($24), Niacinamide 10% Booster ($19), and the Mini Glow Discovery Set ($42). All arrive gift-ready.",
      trending: "The glazed-skin look is everywhere right now — Hydra Glow Serum layered with Liquid Highlighter Drops. Also trending: Maison Rose eau de parfum and heatless curl kits."
    };
    const fallback = "Love that question. I'm in preview right now, so my full brain isn't connected yet — soon I'll answer from Lushby's live catalog. Meanwhile, try one of the suggestions above.";

    function chatOpen() {
      chatDrawer.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { chatDrawer.classList.add('is-open'); });
      });
      if (chatInput) chatInput.focus();
    }
    function chatClose() {
      chatDrawer.classList.remove('is-open');
      setTimeout(function () { chatDrawer.hidden = true; }, 350);
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-chat-open]')) chatOpen();
      if (e.target.closest('[data-chat-close]')) chatClose();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !chatDrawer.hidden) chatClose();
    });

    function addMsg(text, who) {
      const d = document.createElement('div');
      d.className = 'ai-chat__msg ai-chat__msg--' + who;
      d.textContent = text;
      chatBody.appendChild(d);
      chatBody.scrollTop = chatBody.scrollHeight;
    }
    function aiRespond(text) {
      const typing = document.createElement('div');
      typing.className = 'ai-chat__typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      chatBody.appendChild(typing);
      chatBody.scrollTop = chatBody.scrollHeight;
      setTimeout(function () {
        typing.remove();
        addMsg(text, 'ai');
      }, 900 + Math.random() * 700);
    }
    document.addEventListener('click', function (e) {
      const chip = e.target.closest('[data-chat-chip]');
      if (!chip) return;
      addMsg(chip.textContent, 'user');
      aiRespond(replies[chip.dataset.chatChip] || fallback);
    });
    if (chatForm) {
      chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const val = chatInput.value.trim();
        if (!val) return;
        chatInput.value = '';
        addMsg(val, 'user');
        const v = val.toLowerCase();
        let key = null;
        if (v.indexOf('routine') > -1 || v.indexOf('skincare') > -1) key = 'routine';
        else if (v.indexOf('shade') > -1 || v.indexOf('foundation') > -1 || v.indexOf('tint') > -1) key = 'foundation';
        else if (v.indexOf('gift') > -1) key = 'gift';
        else if (v.indexOf('trend') > -1 || v.indexOf('popular') > -1) key = 'trending';
        aiRespond(key ? replies[key] : fallback);
      });
    }
  }
})();
