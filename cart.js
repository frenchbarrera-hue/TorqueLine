// ===== Cart System =====
const STORAGE_KEY = 'torqueline_cart';
const FREE_SHIPPING_THRESHOLD = 2500;
const SHIPPING_FLAT_RATE = 150;

let cart = loadCart();

// ===== Persistence =====
function loadCart() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    // Storage unavailable, cart stays in memory
  }
}

// ===== Cart Operations =====
function addToCart(product) {
  const item = {
    id: product.id || product.name,
    name: product.name,
    price: Number(product.price) || 0,
    image: product.image || '',
    quantity: 1
  };

  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push(item);
  }

  saveCart();
  renderCart();
  openCart();
  showNotification(`Added ${item.name} to cart`);
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  renderCart();
}

function updateQuantity(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart();
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
  showNotification('Cart cleared');
}

// ===== Totals =====
function getTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = cart.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
  return {
    subtotal,
    shipping,
    total: subtotal + shipping,
    count: cart.reduce((sum, item) => sum + item.quantity, 0)
  };
}

// ===== Render =====
function renderCart() {
  const itemsContainer = document.getElementById('cart-items');
  const emptyState = document.getElementById('cart-empty');
  const footer = document.getElementById('cart-footer');
  const badge = document.getElementById('cart-badge');

  const { subtotal, shipping, total, count } = getTotals();

  // Badge
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }

  // Empty state
  if (cart.length === 0) {
    itemsContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    footer.classList.add('hidden');
    return;
  }

  itemsContainer.classList.remove('hidden');
  emptyState.classList.add('hidden');
  footer.classList.remove('hidden');

  // Items
  itemsContainer.innerHTML = cart.map(item => `
    <div class="flex gap-4 border border-gray-200 rounded-xl p-4 cart-item">
      <div class="w-20 h-20 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center p-1.5">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}" class="w-full h-full object-contain">`
          : '<span class="text-gray-400 text-xs text-center px-1">No image</span>'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start gap-2">
          <h3 class="font-bold text-gray-900 truncate">${escapeHtml(item.name)}</h3>
          <button onclick="removeFromCart('${item.id}')" class="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0" aria-label="Remove item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <p class="text-sm text-gray-500 mb-3">${formatPrice(item.price)} each</p>
        <div class="flex items-center justify-between">
          <div class="flex items-center border border-gray-300 rounded-lg">
            <button onclick="updateQuantity('${item.id}', -1)" class="px-3 py-1 text-gray-600 hover:text-red-600 font-bold transition-colors" aria-label="Decrease quantity">-</button>
            <span class="px-3 py-1 font-bold text-gray-900">${item.quantity}</span>
            <button onclick="updateQuantity('${item.id}', 1)" class="px-3 py-1 text-gray-600 hover:text-red-600 font-bold transition-colors" aria-label="Increase quantity">+</button>
          </div>
          <span class="font-black text-red-600">${formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Totals
  document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
  document.getElementById('cart-shipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
  document.getElementById('cart-total').textContent = formatPrice(total);

  // Free shipping hint
  const hint = document.getElementById('cart-shipping-hint');
  if (hint) {
    if (shipping === 0) {
      hint.textContent = 'You have unlocked free shipping!';
      hint.className = 'text-sm text-green-600 font-medium mb-4';
    } else {
      const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
      hint.textContent = `Add ${formatPrice(remaining)} more for free shipping`;
      hint.className = 'text-sm text-gray-500 mb-4';
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Drawer Open/Close =====
function openCart() {
  document.getElementById('cart-drawer').classList.remove('translate-x-full');
  document.getElementById('cart-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-drawer').classList.add('translate-x-full');
  document.getElementById('cart-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ===== Event Listeners =====
document.getElementById('cart-btn')?.addEventListener('click', () => {
  const drawer = document.getElementById('cart-drawer');
  if (drawer.classList.contains('translate-x-full')) {
    openCart();
  } else {
    closeCart();
  }
});

document.getElementById('cart-close')?.addEventListener('click', closeCart);
document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
  clearCart();
});

document.getElementById('checkout-btn')?.addEventListener('click', () => {
  const { count } = getTotals();
  if (count === 0) {
    showNotification('Your cart is empty');
    return;
  }
  if (typeof openCheckout === 'function') {
    openCheckout();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const drawer = document.getElementById('cart-drawer');
    if (drawer && !drawer.classList.contains('translate-x-full')) {
      closeCart();
    }
  }
});

// ===== Initial Render =====
renderCart();
