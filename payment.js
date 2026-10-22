// ===== Payment Methods =====
const PAYMENT_METHODS = {
  gcash: {
    label: 'GCash',
    fields: [
      { name: 'gcashNumber', label: 'GCash Mobile Number', type: 'tel', placeholder: '09XX XXX XXXX', pattern: '09[0-9]{9}' },
      { name: 'gcashName', label: 'Account Name', type: 'text', placeholder: 'Juan Dela Cruz' }
    ]
  },
  maya: {
    label: 'Maya',
    fields: [
      { name: 'mayaNumber', label: 'Maya Account Number', type: 'tel', placeholder: '09XX XXX XXXX' },
      { name: 'mayaName', label: 'Account Name', type: 'text', placeholder: 'Juan Dela Cruz' }
    ]
  },
  shopeepay: {
    label: 'ShopeePay',
    fields: [
      { name: 'shopeeUsername', label: 'ShopeePay Username', type: 'text', placeholder: 'your_username' },
      { name: 'shopeeNumber', label: 'Linked Mobile Number', type: 'tel', placeholder: '09XX XXX XXXX' }
    ]
  },
  card: {
    label: 'Credit / Debit Card',
    fields: [
      { name: 'cardNumber', label: 'Card Number', type: 'text', placeholder: '0000 0000 0000 0000', inputmode: 'numeric' },
      { name: 'cardName', label: 'Name on Card', type: 'text', placeholder: 'JUAN DELA CRUZ' },
      { name: 'cardExpiry', label: 'Expiry (MM/YY)', type: 'text', placeholder: 'MM/YY', inputmode: 'numeric' },
      { name: 'cardCvv', label: 'CVV', type: 'text', placeholder: '000', inputmode: 'numeric' }
    ]
  },
  bank: {
    label: 'Bank Transfer',
    fields: [
      { name: 'bankName', label: 'Bank', type: 'text', placeholder: 'BPI, BDO, Metrobank...' },
      { name: 'bankAccount', label: 'Account Number', type: 'text', placeholder: '0000000000' }
    ]
  },
  cod: {
    label: 'Cash on Delivery',
    fields: [
      { name: 'codAddress', label: 'Delivery Address', type: 'text', placeholder: 'House no., Street, Barangay, City' },
      { name: 'codNotes', label: 'Delivery Notes (optional)', type: 'text', placeholder: 'Landmark, preferred time...' }
    ]
  }
};

let selectedPaymentMethod = 'gcash';

const checkoutModal = document.getElementById('checkout-modal');
const checkoutOverlay = document.getElementById('checkout-overlay');
const paymentDetails = document.getElementById('payment-details');

// ===== Render Dynamic Fields =====
function renderPaymentDetails() {
  if (!paymentDetails) return;

  const method = PAYMENT_METHODS[selectedPaymentMethod];
  if (!method) return;

  const fields = method.fields.map(field => {
    const isLong = field.name === 'codAddress';
    return `
      <div class="${isLong ? 'sm:col-span-2' : ''}">
        <label for="pay-${field.name}" class="block text-xs font-bold text-gray-600 mb-1.5">${field.label}</label>
        <input
          type="${field.type}"
          id="pay-${field.name}"
          name="${field.name}"
          placeholder="${field.placeholder}"
          ${field.pattern ? `pattern="${field.pattern}"` : ''}
          ${field.inputmode ? `inputmode="${field.inputmode}"` : ''}
          class="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-colors"
        />
      </div>
    `;
  }).join('');

  paymentDetails.innerHTML = `
    <div class="payment-method-note">
      <span class="payment-method-note-dot" style="--pm-color:${getPaymentColor(selectedPaymentMethod)}"></span>
      <span>You're paying with <strong>${method.label}</strong>. ${getPaymentHint(selectedPaymentMethod)}</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${fields}</div>
  `;
}

function getPaymentColor(method) {
  return {
    gcash: '#007DFE',
    maya: '#00C271',
    shopeepay: '#EE4D2D',
    card: '#1A1F71',
    bank: '#4F46E5',
    cod: '#16A34A'
  }[method] || '#dc2626';
}

function getPaymentHint(method) {
  return {
    gcash: 'A confirmation request will pop up in your GCash app.',
    maya: 'You will approve the payment in the Maya app.',
    shopeepay: 'Log in to ShopeePay to approve this payment.',
    card: 'Your card is charged once the order is confirmed.',
    bank: 'You will be redirected to your bank to complete the transfer.',
    cod: 'Please prepare the exact amount for the rider.'
  }[method] || '';
}

// ===== Checkout Modal =====
function openCheckout() {
  if (!checkoutModal) return;

  const { subtotal, shipping, total } = getTotals();

  const subtotalEl = document.getElementById('checkout-subtotal');
  const shippingEl = document.getElementById('checkout-shipping');
  const totalEl = document.getElementById('checkout-total');

  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (shippingEl) shippingEl.textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
  if (totalEl) totalEl.textContent = formatPrice(total);

  renderPaymentDetails();

  checkoutModal.classList.remove('hidden');
  checkoutOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  if (!checkoutModal) return;
  checkoutModal.classList.add('hidden');
  checkoutOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// ===== Method Selection =====
document.querySelectorAll('.payment-option').forEach(option => {
  option.addEventListener('click', () => {
    const radio = option.querySelector('.payment-radio');
    if (radio) radio.checked = true;
    selectedPaymentMethod = option.dataset.method;
    renderPaymentDetails();
  });
});

// ===== Place Order =====
document.getElementById('place-order-btn')?.addEventListener('click', () => {
  const method = PAYMENT_METHODS[selectedPaymentMethod];
  const { count, subtotal, shipping, total } = getTotals();

  if (!method) return;

  const details = document.getElementById('payment-details');
  const inputs = details ? details.querySelectorAll('input') : [];
  let missing = null;

  inputs.forEach(input => {
    const required = input.name !== 'codNotes';
    if (required && !input.value.trim()) {
      input.classList.add('border-red-500', 'ring-2', 'ring-red-500/20');
      if (!missing) missing = input;
    } else {
      input.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
    }
  });

  if (missing) {
    showNotification('Please complete the payment details before placing your order.');
    missing.focus();
    return;
  }

  const orderRef = 'TL' + Date.now().toString().slice(-8);

  // Snapshot the order before the cart is cleared
  const order = {
    id: orderRef,
    userId: typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null,
    customer: typeof currentUser !== 'undefined' && currentUser ? currentUser.name : 'Guest',
    email: typeof currentUser !== 'undefined' && currentUser ? currentUser.email : '',
    payment: method.label,
    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    subtotal: subtotal,
    shipping: shipping,
    total: total,
    status: selectedPaymentMethod === 'cod' ? 'Awaiting Payment' : 'Processing',
    date: new Date().toISOString()
  };

  if (typeof saveOrder === 'function') saveOrder(order);

  closeCheckout();
  closeCart();

  cart = [];
  saveCart();
  renderCart();

  showNotification(`Order ${orderRef} placed via ${method.label} — ${count} item(s) for ${formatPrice(total)}. Thank you!`);
});

document.getElementById('checkout-close')?.addEventListener('click', closeCheckout);
checkoutOverlay?.addEventListener('click', closeCheckout);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && checkoutModal && !checkoutModal.classList.contains('hidden')) {
    closeCheckout();
  }
});
