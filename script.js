// ===== Currency Config =====
const CURRENCY_SYMBOL = '₱';

function formatPrice(value) {
  return `${CURRENCY_SYMBOL}${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// ===== Mobile Menu Toggle =====
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
    mobileMenuBtn.querySelector('svg').classList.toggle('hidden');
  });
}

// ===== Close mobile menu on link click =====
document.querySelectorAll('.nav-link-mobile').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
  });
});

// ===== Smooth Scrolling =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      window.scrollTo({
        top: target.offsetTop - 80,
        behavior: 'smooth'
      });
    }
  });
});

// ===== Header Scroll Effect =====
const header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('shadow-md', 'bg-white/95', 'backdrop-blur-sm');
      header.classList.remove('shadow-sm');
    } else {
      header.classList.remove('shadow-md', 'bg-white/95', 'backdrop-blur-sm');
      header.classList.add('shadow-sm');
    }
  });
}

// ===== Intersection Observer for Animations =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('.animate-fade-in, .product-card').forEach(element => {
  element.classList.add('animate-on-scroll');
  observer.observe(element);
});

// ===== Notification System =====
function showNotification(message) {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'notification fixed bottom-6 right-6 bg-red-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 transform translate-x-full transition-transform duration-300';
  notification.innerHTML = `
    <div class="flex items-center space-x-3">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 10);

  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ===== Form Validation =====
const contactForm = document.getElementById('contact-form');

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData);

    const errors = [];

    if (!data.firstName) {
      errors.push('First name is required');
    }

    if (!data.lastName) {
      errors.push('Last name is required');
    }

    if (!data.email) {
      errors.push('Email is required');
    } else if (!isValidEmail(data.email)) {
      errors.push('Please enter a valid email address');
    }

    if (!data.message) {
      errors.push('Message is required');
    }

    if (errors.length > 0) {
      showNotification(errors.join('. '));
      return;
    }

    showNotification('Thank you! Your message has been sent. We will contact you soon.');
    contactForm.reset();
  });
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ===== Product Card Hover Effects =====
document.querySelectorAll('.product-card').forEach(card => {
  const banner = card.querySelector('.product-image-banner');
  const price = card.querySelector('.text-3xl');

  card.addEventListener('mouseenter', () => {
    if (price) {
      price.style.transform = 'scale(1.08)';
    }
  });

  card.addEventListener('mouseleave', () => {
    if (price) {
      price.style.transform = 'scale(1)';
    }
  });

  // Cursor spotlight + 3D tilt following the pointer
  if (banner) {
    let frame = null;
    let pending = null;

    banner.addEventListener('mousemove', (e) => {
      const rect = banner.getBoundingClientRect();
      pending = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      };

      if (frame === null) {
        frame = requestAnimationFrame(() => {
          if (pending) {
            banner.style.setProperty('--mouse-x', `${pending.x}%`);
            banner.style.setProperty('--mouse-y', `${pending.y}%`);
          }
          frame = null;
        });
      }
    });

    banner.addEventListener('mouseleave', () => {
      banner.style.setProperty('--mouse-x', '50%');
      banner.style.setProperty('--mouse-y', '50%');
    });
  }

  // 3D tilt of the whole card
  let tiltFrame = null;
  let tiltPending = null;

  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    tiltPending = { x: -y * 8, y: x * 10 };

    if (tiltFrame === null) {
      tiltFrame = requestAnimationFrame(() => {
        if (tiltPending) {
          card.style.setProperty('--tilt-x', `${tiltPending.x}deg`);
          card.style.setProperty('--tilt-y', `${tiltPending.y}deg`);
        }
        tiltFrame = null;
      });
    }
  });

  card.addEventListener('mouseleave', () => {
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
  });
});

// ===== Brand Card Click Effects =====
document.querySelectorAll('.brand-card').forEach(card => {
  card.addEventListener('click', () => openBrandModal(card));
});

// ===== Brand Modal =====
let selectedBrand = null;
let selectedBrandPrice = 0;
let selectedBrandImage = '';
let selectedBrandViscosity = '';

const brandDescriptions = {
  'Mobil 1': 'Mobil 1 is a synthetic motor oil brand owned by ExxonMobil. Provides triple action power for maximum engine protection, cleaner engines, and fuel efficiency. API SP certified.',
  'Castrol EDGE': 'Castrol EDGE is a full synthetic motor oil with Fluid Titanium technology for superior engine performance. Meets dexos1 specifications for modern engines.',
  'Shell Helix': 'Shell Helix Ultra is a fully synthetic motor oil with Shell Pure Plus technology. Provides exceptional engine cleanliness and protection under extreme conditions.',
  'Total Quartz': 'Total Quartz 9000 is a fully synthetic engine oil from TotalEnergies. Designed for gasoline and diesel engines, meeting the most demanding manufacturer specifications.',
  'BP VEG': 'BP VEG is a premium mineral-based motor oil with excellent detergency and dispersancy properties. API SL certified for reliable everyday engine protection.',
  'ARKO Tection': 'ARKO Tection is a semi-synthetic oil with enhanced viscosity characteristics for improved engine protection and reduced wear under normal driving conditions.',
  'Liqui Moly': 'Liqui Moly Top Tec is a German-engineered motor oil with additive technology for superior engine cleanliness and protection. Maintains stable viscosity under high temperatures.',
  'TorqueLine Premium': 'TorqueLine Premium is our proprietary full synthetic blend, engineered in-house for maximum protection and performance. Optimized for all driving conditions.'
};

function openBrandModal(card) {
  const brandName = card.getAttribute('data-brand');
  const image = card.getAttribute('data-image');
  const price = card.getAttribute('data-price');
  const viscosity = card.getAttribute('data-viscosity');
  const size = card.getAttribute('data-size');

  selectedBrand = brandName;
  selectedBrandPrice = price;
  selectedBrandImage = image;
  selectedBrandViscosity = viscosity;

  const modal = document.getElementById('brand-modal');
  document.getElementById('modal-brand-name').textContent = brandName;
  document.getElementById('modal-image').src = image;
  document.getElementById('modal-image').alt = brandName;
  document.getElementById('modal-price').textContent = formatPrice(Number(price) || 0);
  document.getElementById('modal-viscosity').textContent = `Viscosity: ${viscosity} | Size: ${size}`;
  document.getElementById('modal-description').textContent = brandDescriptions[brandName] || '';

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    const fadeElement = modal.querySelector('.fade-in-modal');
    if (fadeElement) {
      fadeElement.classList.remove('modal-visible');
      fadeElement.offsetHeight;
      fadeElement.classList.add('modal-visible');
    }
  }, 10);
}

function closeBrandModal() {
  const modal = document.getElementById('brand-modal');
  const fadeElement = modal.querySelector('.fade-in-modal');
  if (fadeElement) {
    fadeElement.classList.remove('modal-visible');
  }
  modal.classList.add('hidden');
  document.body.style.overflow = '';

  const modalImg = document.getElementById('modal-image');
  if (modalImg) {
    modalImg.style.transform = 'rotateY(0deg) rotateX(0deg)';
  }
}

document.getElementById('modal-close')?.addEventListener('click', closeBrandModal);

document.getElementById('brand-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('brand-modal')) {
    closeBrandModal();
  }
});

// ===== Simple 3D Mouse Tilt on Modal Image =====
const modalImg = document.getElementById('modal-image');
if (modalImg && modalImg.parentElement) {
  const container = modalImg.parentElement;

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 5;
    const rotateX = ((centerY - y) / centerY) * 5;
    modalImg.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  });

  container.addEventListener('mouseleave', () => {
    modalImg.style.transform = 'rotateY(0deg) rotateX(0deg)';
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('brand-modal').classList.contains('hidden')) {
    closeBrandModal();
  }
});

function addToCartFromModal() {
  if (selectedBrand) {
    addToCart({
      id: selectedBrand,
      name: selectedBrand,
      price: selectedBrandPrice,
      image: selectedBrandImage
    });
  }
}

// ===== Back to Top Button =====
const backToTopBtn = document.createElement('button');
backToTopBtn.id = 'back-to-top';
backToTopBtn.innerHTML = `
  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7 7 7"></path>
  </svg>
`;
backToTopBtn.className = 'fixed bottom-6 left-6 bg-gray-800 hover:bg-red-600 text-white p-3 rounded-full shadow-xl z-50 opacity-0 invisible transition-all duration-300';
document.body.appendChild(backToTopBtn);

backToTopBtn.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    backToTopBtn.classList.remove('opacity-0', 'invisible');
  } else {
    backToTopBtn.classList.add('opacity-0', 'invisible');
  }
});

// ===== Button Click Effects =====
function createRipple(e) {
  const btn = e.currentTarget;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.left = `${e.clientX - btn.getBoundingClientRect().left}px`;
  ripple.style.top = `${e.clientY - btn.getBoundingClientRect().top}px`;

  btn.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 800);
}

function addClickEffects(selector) {
  const buttons = document.querySelectorAll(selector);
  buttons.forEach(btn => {
    btn.addEventListener('click', createRipple);
    btn.classList.add('btn-clickable');
  });
}

addClickEffects('button');
addClickEffects('a.btn-primary');
addClickEffects('a[href^="#"]:not(.nav-link):not(.nav-link-mobile)');

// ===== Button Press Animation =====
document.querySelectorAll('button, .btn-clickable').forEach(btn => {
  btn.addEventListener('mousedown', () => {
    btn.style.transform = 'scale(0.95)';
  });

  btn.addEventListener('mouseup', () => {
    btn.style.transform = 'scale(1)';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
  });
});

// ===== Voucher & Discount Campaign Banner =====
const claimVoucherBtn = document.getElementById('claim-voucher-btn');

if (claimVoucherBtn) {
  claimVoucherBtn.addEventListener('click', () => {
    showNotification('Voucher claimed! Use code TORQUE10 for 10% off + ₱100 off your order.');
    const products = document.getElementById('products');
    if (products) {
      window.scrollTo({ top: products.offsetTop - 80, behavior: 'smooth' });
    }
  });
}

// ===== Initialize animations on DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
});
