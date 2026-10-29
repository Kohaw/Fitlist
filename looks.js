// Блок «Комплекты к событиям»: вкладки по событиям, образ разложен на вещи.
// Контент — в js/looks-data.js.

const tabList = document.querySelector('.looks__tabs');
const panel = document.querySelector('.looks__panel');

const formatPrice = (n) => `${n.toLocaleString('ru-RU')} ₽`;

const renderPanel = (look) => {
  const total = look.items.reduce((sum, item) => sum + item.price, 0);

  panel.setAttribute('aria-labelledby', `tab-${look.id}`);
  panel.innerHTML = `
    <figure>
      <img class="look__photo"
        src="https://images.unsplash.com/${look.photo}?w=900&h=1125&q=80&auto=format&fit=crop"
        alt="${look.photoAlt}" width="900" height="1125" loading="lazy">
      <figcaption class="look__credit">
        Фото: <a href="${look.credit.url}" target="_blank" rel="noopener">${look.credit.author} / Unsplash</a>
      </figcaption>
    </figure>

    <div class="look__body">
      <p class="look__event">${look.tab}</p>
      <h3 class="look__title">${look.title}</h3>
      <p class="look__why">${look.why}</p>

      <ul class="look__items">
        ${look.items.map((item) => `
          <li class="look__item">
            <div>
              <p class="look__item-name">${item.name}</p>
              <p class="look__item-note">${item.note}</p>
            </div>
            <p class="look__item-price">от ${formatPrice(item.price)}</p>
            <a class="look__item-link" href="${SHOP_SEARCH}${encodeURIComponent(item.query)}"
              target="_blank" rel="noopener" aria-label="Найти: ${item.name.toLowerCase()}">
              <span><svg><use href="#i-arrow"/></svg></span>Найти
            </a>
          </li>`).join('')}
      </ul>

      <p class="look__tip">${look.tip}</p>

      <div class="look__footer">
        <p class="look__total">Образ целиком <strong>от ${formatPrice(total)}</strong></p>
        <a href="#pricing" class="pill pill--accent">
          <span class="pill__icon"><svg><use href="#i-arrow"/></svg></span>
          <span class="pill__text"><span class="pill__title">Получать такие подборки</span><span class="pill__sub">600 ₽/мес</span></span>
        </a>
      </div>
    </div>
  `;
};

const selectLook = (id, { focus = false } = {}) => {
  const look = LOOKS.find((l) => l.id === id) || LOOKS[0];

  tabList.querySelectorAll('[role="tab"]').forEach((tab) => {
    const active = tab.dataset.look === look.id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });

  renderPanel(look);
};

if (tabList && panel) {
  tabList.innerHTML = LOOKS.map((look) => `
    <button class="looks__tab" type="button" role="tab" id="tab-${look.id}"
      data-look="${look.id}" aria-controls="looks-panel">${look.tab}</button>
  `).join('');

  tabList.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) selectLook(tab.dataset.look);
  });

  // Стрелки переключают вкладки — стандартное поведение для tablist
  tabList.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ids = LOOKS.map((l) => l.id);
    const current = ids.indexOf(tabList.querySelector('[aria-selected="true"]').dataset.look);
    const next = {
      ArrowLeft: (current - 1 + ids.length) % ids.length,
      ArrowRight: (current + 1) % ids.length,
      Home: 0,
      End: ids.length - 1,
    }[e.key];
    selectLook(ids[next], { focus: true });
  });

  // Кнопки событий на первом экране открывают нужную вкладку
  document.querySelectorAll('.chip[data-event]').forEach((chip) => {
    chip.addEventListener('click', () => selectLook(chip.dataset.event));
  });

  selectLook(LOOKS[0].id);
}
