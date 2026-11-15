// ===== Sliding Banner =====
const banner = document.getElementById('banner-slider');

if (banner) {
  const track = document.getElementById('banner-track');
  const slides = track.querySelectorAll('.banner-slide');
  const dots = document.querySelectorAll('#banner-dots .banner-dot');
  const prevBtn = document.getElementById('banner-prev');
  const nextBtn = document.getElementById('banner-next');

  const AUTOPLAY_DELAY = 5000;
  let current = 0;
  let timer = null;
  let startX = 0;
  let dragging = false;
  let didDrag = false;

  function goTo(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    current = index;

    track.style.transform = `translateX(-${current * 100}%)`;

    // 3D carousel: rotate/scale/fade each slide by its offset from center
    slides.forEach((slide, i) => {
      let offset = i - current;
      const half = slides.length / 2;
      if (offset > half) offset -= slides.length;
      if (offset < -half) offset += slides.length;

      slide.style.setProperty('--offset', offset);
      slide.style.setProperty('--offset-abs', Math.abs(offset));
    });

    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle('bg-white', active);
      dot.classList.toggle('bg-white/50', !active);
      dot.classList.toggle('w-7', active);
      dot.classList.toggle('w-2.5', !active);
    });
  }

  function next() {
    goTo(current + 1);
  }

  function prev() {
    goTo(current - 1);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(() => {
      if (!document.hidden) next();
    }, AUTOPLAY_DELAY);
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Controls
  nextBtn?.addEventListener('click', () => {
    next();
    startAutoplay();
  });

  prevBtn?.addEventListener('click', () => {
    prev();
    startAutoplay();
  });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      goTo(Number(dot.dataset.index));
      startAutoplay();
    });
  });

  // Pause on hover
  banner.addEventListener('mouseenter', stopAutoplay);
  banner.addEventListener('mouseleave', startAutoplay);

  // Pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });

  // Touch / swipe support
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    dragging = true;
    stopAutoplay();
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;

    if (Math.abs(diff) > 50) {
      if (diff < 0) {
        next();
      } else {
        prev();
      }
    }
    startAutoplay();
  }, { passive: true });

  // Mouse drag support
  track.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    dragging = true;
    didDrag = false;
    track.classList.add('cursor-grabbing');
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('cursor-grabbing');
    // Clear the drag flag after the click event has fired
    setTimeout(() => { didDrag = false; }, 0);
  });

  track.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 50) {
      didDrag = true;
      if (diff < 0) {
        next();
      } else {
        prev();
      }
      dragging = false;
    }
  });

  // Keyboard navigation
  banner.setAttribute('tabindex', '0');
  banner.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      next();
      startAutoplay();
    } else if (e.key === 'ArrowLeft') {
      prev();
      startAutoplay();
    }
  });

  // Init
  goTo(0);
  startAutoplay();

  // ===== Clickable Banner Images =====
  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (target) {
      window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
    }
  }

  function highlightProduct(productName) {
    const card = Array.from(document.querySelectorAll('.product-card')).find(el => {
      const title = el.querySelector('h3');
      return title && title.textContent.trim() === productName;
    });

    if (!card) return;
    card.classList.add('search-highlight');
    setTimeout(() => card.classList.remove('search-highlight'), 1800);
  }

  // Product images jump to the matching product card
  banner.querySelectorAll('.banner-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (didDrag) return;

      const productName = btn.dataset.product;
      scrollToSection('products');

      setTimeout(() => {
        highlightProduct(productName);
      }, 450);
    });
  });

  // Brand images open that brand's modal directly
  banner.querySelectorAll('.banner-brand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (didDrag) return;

      const brandName = btn.dataset.brand;

      const brandCard = Array.from(document.querySelectorAll('.brand-card')).find(el => {
        return el.getAttribute('data-brand') === brandName;
      });

      if (brandCard) {
        openBrandModal(brandCard);
      } else {
        scrollToSection('brands');
      }
    });
  });
}
