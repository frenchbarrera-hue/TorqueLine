// ===== Search System =====
let searchIndex = [];

function buildSearchIndex() {
  const items = [];

  // Products
  document.querySelectorAll('.product-card').forEach(card => {
    const title = card.querySelector('h3');
    const price = card.querySelector('.text-3xl');
    const img = card.querySelector('img');
    const badge = card.querySelector('.product-image-banner > span');

    if (!title) return;

    items.push({
      type: 'product',
      name: title.textContent.trim(),
      meta: badge ? badge.textContent.trim() : '',
      price: price ? price.textContent.trim() : '',
      image: img ? img.getAttribute('src') : '',
      keywords: `${title.textContent} ${badge ? badge.textContent : ''} ${price ? price.textContent : ''}`.toLowerCase(),
      element: card
    });
  });

  // Brands
  document.querySelectorAll('.brand-card').forEach(card => {
    const name = card.getAttribute('data-brand');
    const price = card.getAttribute('data-price');
    const image = card.getAttribute('data-image');
    const subtitle = card.querySelector('span:last-of-type');

    if (!name) return;

    items.push({
      type: 'brand',
      name: name,
      meta: subtitle ? subtitle.textContent.trim() : 'Brand',
      price: formatPrice(Number(price) || 0),
      image: image,
      keywords: `${name} ${subtitle ? subtitle.textContent : ''}`.toLowerCase(),
      element: card
    });
  });

  return items;
}

function searchItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return searchIndex
    .filter(item => item.keywords.includes(q))
    .sort((a, b) => {
      // Exact name matches first
      const aExact = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bExact = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);
}

function renderSearchResults(inputEl, resultsEl) {
  const query = inputEl.value.trim();
  const clearBtn = inputEl.id === 'search-input'
    ? document.getElementById('search-clear')
    : document.getElementById('search-clear-mobile');

  if (clearBtn) {
    clearBtn.classList.toggle('hidden', query.length === 0);
  }

  if (query.length === 0) {
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
    return;
  }

  const results = searchItems(query);

  if (results.length === 0) {
    resultsEl.innerHTML = `
      <div class="px-4 py-8 text-center">
        <p class="text-gray-500 font-medium">No results for "${escapeHtml(query)}"</p>
        <p class="text-gray-400 text-sm mt-1">Try a brand name or viscosity like 5W-30</p>
      </div>
    `;
    resultsEl.classList.remove('hidden');
    return;
  }

  resultsEl.innerHTML = results.map((item, index) => `
    <button class="search-result w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${index < results.length - 1 ? 'border-b border-gray-100' : ''}" data-index="${index}">
      <span class="w-11 h-11 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center p-1">
        ${item.image
          ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" class="w-full h-full object-contain">`
          : '<span class="text-gray-300 text-xs">—</span>'}
      </span>
      <span class="flex-1 min-w-0">
        <span class="block font-semibold text-gray-900 truncate">${escapeHtml(item.name)}</span>
        <span class="block text-xs text-gray-500">${escapeHtml(item.meta)}${item.type === 'product' ? '' : ' · Brand'}</span>
      </span>
      <span class="font-bold text-red-600 text-sm flex-shrink-0">${escapeHtml(item.price)}</span>
    </button>
  `).join('');

  resultsEl.classList.remove('hidden');

  resultsEl.querySelectorAll('.search-result').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = results[Number(btn.dataset.index)];
      selectSearchResult(item, resultsEl, inputEl);
    });
  });
}

function selectSearchResult(item, resultsEl, inputEl) {
  resultsEl.classList.add('hidden');
  inputEl.value = '';
  const clearBtn = inputEl.id === 'search-input'
    ? document.getElementById('search-clear')
    : document.getElementById('search-clear-mobile');
  if (clearBtn) clearBtn.classList.add('hidden');

  if (item.type === 'brand') {
    openBrandModal(item.element);
    return;
  }

  // Product: scroll to it and flash a highlight
  const target = document.getElementById('products');
  if (target) {
    window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
  }

  item.element.classList.add('search-highlight');
  setTimeout(() => {
    item.element.classList.remove('search-highlight');
  }, 1800);
}

function setupSearch(inputId, resultsId, clearId) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  const clear = document.getElementById(clearId);
  if (!input || !results) return;

  input.addEventListener('input', () => {
    renderSearchResults(input, results);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length > 0) {
      renderSearchResults(input, results);
    }
  });

  if (clear) {
    clear.addEventListener('click', () => {
      input.value = '';
      results.classList.add('hidden');
      clear.classList.add('hidden');
      input.focus();
    });
  }

  // Keyboard navigation
  let activeIndex = -1;

  input.addEventListener('keydown', (e) => {
    const optionEls = results.querySelectorAll('.search-result');

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (optionEls.length === 0) return;

      activeIndex = e.key === 'ArrowDown'
        ? (activeIndex + 1) % optionEls.length
        : (activeIndex - 1 + optionEls.length) % optionEls.length;

      optionEls.forEach((el, i) => {
        el.classList.toggle('bg-red-50', i === activeIndex);
      });
      optionEls[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    if (e.key === 'Enter' && activeIndex >= 0 && optionEls[activeIndex]) {
      e.preventDefault();
      optionEls[activeIndex].click();
      activeIndex = -1;
    }

    if (e.key === 'Escape') {
      results.classList.add('hidden');
      input.blur();
      activeIndex = -1;
    }
  });
}

function hideSearchResults(e) {
  const inDesktop = e.target.closest('.search-wrapper');
  const inMobile = e.target.closest('#search-input-mobile') || e.target.closest('#search-clear-mobile');
  if (inDesktop || inMobile) return;
  document.getElementById('search-results')?.classList.add('hidden');
  document.getElementById('search-results-mobile')?.classList.add('hidden');
}

document.addEventListener('click', hideSearchResults);

searchIndex = buildSearchIndex();

setupSearch('search-input', 'search-results', 'search-clear');
setupSearch('search-input-mobile', 'search-results-mobile', 'search-clear-mobile');
