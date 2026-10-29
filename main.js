// Включаем анимации появления только если JS работает
document.documentElement.classList.add('js');

// Шапка: тёмный логотип над светлыми секциями (data-surface="light")
const header = document.getElementById('header');

const updateHeader = () => {
  const line = header.offsetHeight / 2;
  const overLight = [...document.querySelectorAll('[data-surface="light"]')].some((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= line && r.bottom >= line;
  });
  header.classList.toggle('is-light', overLight);
  header.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * 0.6);
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', updateHeader);

// Меню-панель за круглой кнопкой
const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.getElementById('menu');

const setMenu = (open) => {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  menu.hidden = !open;
};

menuToggle.addEventListener('click', () => {
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
});

menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) setMenu(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) {
    setMenu(false);
    menuToggle.focus();
  }
});

document.addEventListener('click', (e) => {
  if (!menu.hidden && !menu.contains(e.target) && !menuToggle.contains(e.target)) setMenu(false);
});

// Появление блоков при прокрутке
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    revealObserver.unobserve(entry.target);
  });
}, { rootMargin: '0px 0px -10% 0px' });

document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

// История процесса.
// Десктоп: сцена закреплена, активный шаг зависит от того, насколько прокручен блок;
// пройденные шаги уходят вверх, следующие ждут снизу.
// Телефон: шаг загорается, когда он в середине экрана, и гаснет, когда уходит.
const story = document.querySelector('.how__story');
const steps = [...document.querySelectorAll('.step')];
const ticks = [...document.querySelectorAll('.rail__tick')];
const desktop = window.matchMedia('(min-width: 960px)');

const setActiveStep = (index) => {
  steps.forEach((step, i) => {
    step.classList.toggle('is-active', i === index);
    step.classList.toggle('is-past', i < index);
  });
  ticks.forEach((tick, i) => tick.classList.toggle('is-active', i === index));
};

const updateStory = () => {
  if (!desktop.matches) return;
  const r = story.getBoundingClientRect();
  const progress = Math.min(Math.max(-r.top / (r.height - window.innerHeight), 0), 1);
  setActiveStep(Math.min(steps.length - 1, Math.floor(progress * steps.length)));
};

if (story && steps.length) {
  const stepObserver = new IntersectionObserver((entries) => {
    if (desktop.matches) return;
    entries.forEach((entry) => entry.target.classList.toggle('is-active', entry.isIntersecting));
  }, { rootMargin: '-30% 0px -30% 0px' });

  steps.forEach((step) => stepObserver.observe(step));

  window.addEventListener('scroll', updateStory, { passive: true });
  desktop.addEventListener('change', () => {
    steps.forEach((step) => step.classList.remove('is-active', 'is-past'));
    updateStory();
  });
  updateStory();
}

// Контактная форма (демо): проверяем поля и честно говорим, что ничего не отправлено
const contactForm = document.getElementById('contact-form');

if (contactForm) {
  const fields = [...contactForm.querySelectorAll('.field__input')];

  const validate = (input) => {
    const ok = input.checkValidity() && input.value.trim() !== '';
    input.setAttribute('aria-invalid', String(!ok));
    input.parentElement.querySelector('.field__error').hidden = ok;
    return ok;
  };

  fields.forEach((input) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validate(input);
    });
  });

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = fields.filter((input) => !validate(input));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    const result = contactForm.querySelector('.contact__result');
    result.hidden = false;
    result.textContent = 'Это демо-проект: сообщение никуда не отправлено.';
  });
}
