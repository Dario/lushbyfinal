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
})();
