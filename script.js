document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  const navBackdrop = document.getElementById('navBackdrop');
  const heroVideo = document.querySelector('.hero__video');

  if (heroVideo) {
    heroVideo.play().catch(() => {});
  }

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  });

  function closeMenu() {
    burger.classList.remove('active');
    nav.classList.remove('open');
    navBackdrop.classList.remove('is-visible');
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
  }

  function openMenu() {
    burger.classList.add('active');
    nav.classList.add('open');
    navBackdrop.classList.add('is-visible');
    document.body.classList.add('menu-open');
    document.body.style.overflow = 'hidden';
  }

  burger.addEventListener('click', () => {
    if (nav.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  navBackdrop.addEventListener('click', closeMenu);

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1100 && nav.classList.contains('open')) {
      closeMenu();
    }
  });

  const track = document.getElementById('reviewsTrack');
  const prevBtn = document.getElementById('prevReview');
  const nextBtn = document.getElementById('nextReview');
  const dotsContainer = document.getElementById('reviewDots');
  const cards = track.querySelectorAll('.review-card');
  let currentIndex = 0;

  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.classList.add('reviews__dot');
    dot.setAttribute('aria-label', `Отзыв ${i + 1}`);
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });

  const dots = dotsContainer.querySelectorAll('.reviews__dot');

  function goToSlide(index) {
    currentIndex = index;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
  }

  prevBtn.addEventListener('click', () => {
    goToSlide(currentIndex === 0 ? cards.length - 1 : currentIndex - 1);
  });

  nextBtn.addEventListener('click', () => {
    goToSlide(currentIndex === cards.length - 1 ? 0 : currentIndex + 1);
  });

  let autoplay = setInterval(() => {
    goToSlide(currentIndex === cards.length - 1 ? 0 : currentIndex + 1);
  }, 6000);

  const slider = document.getElementById('reviewsSlider');
  slider.addEventListener('mouseenter', () => clearInterval(autoplay));
  slider.addEventListener('mouseleave', () => {
    autoplay = setInterval(() => {
      goToSlide(currentIndex === cards.length - 1 ? 0 : currentIndex + 1);
    }, 6000);
  });

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, observerOptions);

  document.querySelectorAll('.advantage-card, .service-card, .fleet-card, .gallery__item, .faq__item').forEach((el) => {
    el.classList.add('reveal');
    observer.observe(el);
  });
});
