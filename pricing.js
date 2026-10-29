// Блок «Тариф»: пересчёт итога и демо-оформление.
// Оплата не подключена — это учебный проект, форма никуда не отправляет данные.

const PRICES = {
  month: { name: 'Месяц', base: 600, stylist: 500, tile: 'plan__tile--dark' },
  year: { name: 'Год', base: 6000, stylist: 5000, tile: 'plan__tile--accent' }, // «2 месяца в подарок» и на доп
};

const form = document.getElementById('pricing-form');

if (form) {
  const $ = (sel) => form.querySelector(sel);
  const fmt = (n) => `${n.toLocaleString('ru-RU')} ₽`;

  const update = () => {
    const period = form.elements.period.value;
    const stylist = form.elements.stylist.checked;
    const p = PRICES[period];
    const unit = period === 'month' ? '/мес' : '/год';
    const total = p.base + (stylist ? p.stylist : 0);

    // Плитка выбранного периода в итоге
    const tile = $('[data-summary-tile]');
    tile.classList.remove('plan__tile--dark', 'plan__tile--accent');
    tile.classList.add(p.tile);
    $('[data-summary-name]').textContent = p.name;
    $('[data-summary-price]').innerHTML = `${fmt(p.base)}<small>${unit}</small>`;

    $('[data-addon-price]').innerHTML = `+${fmt(p.stylist)}<small>${unit}</small>`;
    $('[data-line-row="stylist"]').hidden = !stylist;
    $('[data-line="stylist"]').textContent = `${fmt(p.stylist)}${unit}`;

    $('[data-total-caption]').textContent = period === 'month' ? 'Итого в месяц' : 'Итого за год';
    $('[data-total]').textContent = fmt(total);
    $('[data-total-unit]').textContent = unit;
    $('[data-total-hint]').textContent = period === 'month'
      ? 'Списание раз в месяц'
      : `${total % 12 ? '≈' : ''}${fmt(Math.round(total / 12))} в месяц — одним платежом`;
    $('[data-submit-price]').textContent = `за ${fmt(total)}`;
  };

  form.addEventListener('change', update);

  // Email: ошибка появляется после попытки отправки, а не во время ввода
  const email = form.elements.email;
  const emailError = document.getElementById('email-error');

  const validateEmail = () => {
    const ok = email.checkValidity();
    email.setAttribute('aria-invalid', String(!ok));
    if (ok) email.removeAttribute('aria-describedby');
    else email.setAttribute('aria-describedby', 'email-error');
    emailError.hidden = ok;
    return ok;
  };

  email.addEventListener('input', () => {
    if (email.getAttribute('aria-invalid') === 'true') validateEmail();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateEmail()) {
      email.focus();
      return;
    }
    const result = $('.summary__result');
    result.hidden = false;
    result.textContent = 'Это демо-проект для портфолио: оплата не подключена, данные никуда не отправлены.';
  });

  update();
}
