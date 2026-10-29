// Мини-графики в карточках «Подхода»: силуэты одежды из полутоновых точек (canvas 2D).
// Каждая графика — функция яркости (x, y, t) → [0..1, акцент?].
// x, y — координаты от центра карточки в единицах её высоты (−0.5…0.5 по y).
// Анимация идёт, только пока карточка видна; при наведении — быстрее.
// При prefers-reduced-motion рисуется один статичный кадр.

const TILE_STEP = 6;      // шаг сетки, CSS px
const TILE_MAX_R = 2.6;   // максимальный радиус точки
const TILE_BASE = 0.05;   // слабая сетка точек на фоне, как во вложенных панелях референса
const TILE_INK = 'rgba(255, 255, 255, .92)';
const TILE_ACCENT = '#fe4701';

/* ---------- Геометрия ---------- */

// Точка внутри многоугольника (метод лучей)
const inPoly = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Расстояние от точки до отрезка
const segDist = (x, y, [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - k * dx, y - ay - k * dy);
};

// Расстояние до ломаной (closed — замкнутая)
const pathDist = (x, y, pts, closed = false) => {
  let d = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) d = Math.min(d, segDist(x, y, pts[i], pts[(i + 1) % pts.length]));
  return d;
};

const scalePts = (pts, s, oy = 0) => pts.map(([x, y]) => [x * s, y * s + oy]);

// Мягкий блик, пробегающий по силуэту
const sheen = (x, y, t) => 0.72 + 0.28 * Math.sin(x * 9 + y * 4 - t * 2.2);

/* ---------- Силуэты ---------- */

// Пиджак: корпус и рукава, разделённые подмышкой
const JACKET = [
  [-0.10, -0.38], [-0.30, -0.32], [-0.41, 0.30], [-0.31, 0.32], [-0.27, -0.04],
  [-0.25, 0.38], [0.25, 0.38], [0.27, -0.04], [0.31, 0.32], [0.41, 0.30],
  [0.30, -0.32], [0.10, -0.38],
];
const COLLAR = [[-0.10, -0.38], [0, -0.04], [0.10, -0.38]];
const LAPEL_L = [[-0.10, -0.38], [-0.18, -0.30], [-0.03, -0.08], [0, -0.04]];
const LAPEL_R = [[0.10, -0.38], [0.18, -0.30], [0.03, -0.08], [0, -0.04]];
const TIE = [[-0.025, -0.31], [0.025, -0.31], [0.045, 0.02], [0, 0.08], [-0.045, 0.02]];

const TSHIRT = [
  [-0.17, -0.33], [-0.06, -0.35], [0, -0.29], [0.06, -0.35], [0.17, -0.33],
  [0.38, -0.17], [0.30, -0.04], [0.20, -0.10], [0.20, 0.35], [-0.20, 0.35],
  [-0.20, -0.10], [-0.30, -0.04], [-0.38, -0.17],
];

const HANGER = [[0, -0.12], [0.38, 0.16], [-0.38, 0.16]];
const CHECK = [[-0.11, 0.33], [-0.03, 0.40], [0.13, 0.26]];

const SHAPES = {
  // К событию: пиджак, рубашка в вырезе, оранжевый галстук пульсирует
  calendar(x, y, t) {
    if (inPoly(x, y, TIE)) return [0.75 + 0.25 * Math.sin(t * 3), true];
    if (inPoly(x, y, COLLAR)) return [0.32, false];
    if (inPoly(x, y, LAPEL_L) || inPoly(x, y, LAPEL_R)) return [0.45, false];
    if (inPoly(x, y, JACKET)) {
      const placket = Math.abs(x) < 0.012 && y > -0.06 ? 0.35 : 1; // линия застёжки
      return [0.85 * sheen(x, y, t) * placket, false];
    }
    return [0, false];
  },

  // Под тебя: футболка «примеряется» — меняет размер и садится в оранжевый контур
  fit(x, y, t) {
    const s = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.3));
    if (pathDist(x, y, TSHIRT, true) < 0.014) return [0.85, true];
    if (inPoly(x, y, scalePts(TSHIRT, s))) return [0.8 * sheen(x, y, t), false];
    return [0, false];
  },

  // Где купить: пакет наполняется покупками, оранжевый ценник пульсирует
  budget(x, y, t) {
    if (Math.hypot(x - 0.2, y + 0.02) < 0.045) return [0.7 + 0.3 * Math.sin(t * 3.4), true];

    const inBag = Math.abs(x) < 0.27 && y > -0.12 && y < 0.38;
    const handle = Math.abs(Math.hypot(x, y + 0.12) - 0.13) < 0.022 && y < -0.12;
    if (handle) return [0.85, false];
    if (!inBag) return [0, false];

    const level = 0.38 - 0.5 * ((t * 0.18) % 1);   // уровень «покупок» поднимается
    const edge = Math.abs(x) > 0.245 || y > 0.355 || y < -0.1;
    if (edge) return [0.9, false];
    return [y > level ? 0.7 * sheen(x, y, t) : 0.14, false];
  },

  // Без риска: вешалка, на ней прорисовывается оранжевая галочка
  wave(x, y, t) {
    const progress = Math.min(1, ((t * 0.35) % 1.4));   // галочка рисуется, потом пауза
    const len1 = Math.hypot(CHECK[1][0] - CHECK[0][0], CHECK[1][1] - CHECK[0][1]);
    const len2 = Math.hypot(CHECK[2][0] - CHECK[1][0], CHECK[2][1] - CHECK[1][1]);
    const drawn = progress * (len1 + len2);
    const p1 = drawn < len1
      ? [CHECK[0][0] + (CHECK[1][0] - CHECK[0][0]) * (drawn / len1), CHECK[0][1] + (CHECK[1][1] - CHECK[0][1]) * (drawn / len1)]
      : CHECK[1];
    let d = segDist(x, y, CHECK[0], p1);
    if (drawn > len1) {
      const k = (drawn - len1) / len2;
      d = Math.min(d, segDist(x, y, CHECK[1], [CHECK[1][0] + (CHECK[2][0] - CHECK[1][0]) * k, CHECK[1][1] + (CHECK[2][1] - CHECK[1][1]) * k]));
    }
    if (d < 0.028) return [0.95, true];

    // Крючок: дуга сверху и ножка
    const hook = (Math.abs(Math.hypot(x, y + 0.27) - 0.07) < 0.018 && !(x < 0 && y > -0.27))
      || (Math.abs(x) < 0.016 && y > -0.2 && y < -0.11);
    if (hook) return [0.85, false];
    if (pathDist(x, y, HANGER, true) < 0.024) return [0.85 * sheen(x, y, t), false];
    return [0, false];
  },
};

/* ---------- Отрисовка ---------- */

const reduceTiles = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-tile]').forEach((canvas) => {
  const shape = SHAPES[canvas.dataset.tile];
  if (!shape) return;

  const ctx = canvas.getContext('2d');
  const card = canvas.closest('.tile');
  let width = 0;
  let height = 0;
  let visible = false;
  let speed = 1;
  let clock = 1.2; // стартовый кадр с уже нарисованными элементами
  let last = 0;
  let frameId = null;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, width, height);
    const ink = new Path2D();
    const accent = new Path2D();

    for (let py = TILE_STEP / 2; py < height; py += TILE_STEP) {
      for (let px = TILE_STEP / 2; px < width; px += TILE_STEP) {
        // Координаты от центра в единицах высоты — силуэты не растягиваются
        const x = (px - width / 2) / height;
        const y = (py - height / 2) / height;
        const [value, isAccent] = shape(x, y, t);
        const v = Math.max(value, TILE_BASE);
        const r = TILE_MAX_R * Math.sqrt(Math.min(v, 1));
        if (r < 0.4) continue;
        const path = isAccent ? accent : ink;
        path.moveTo(px + r, py);
        path.arc(px, py, r, 0, Math.PI * 2);
      }
    }

    ctx.fillStyle = TILE_INK;
    ctx.fill(ink);
    ctx.fillStyle = TILE_ACCENT;
    ctx.fill(accent);
  };

  const loop = (time) => {
    clock += ((time - (last || time)) / 1000) * speed;
    last = time;
    draw(clock);
    frameId = requestAnimationFrame(loop);
  };

  const start = () => {
    if (reduceTiles || frameId !== null || !visible) return;
    last = 0;
    frameId = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  };

  card.addEventListener('pointerenter', () => { speed = 2.5; });
  card.addEventListener('pointerleave', () => { speed = 1; });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);

  new ResizeObserver(() => {
    resize();
    draw(clock);
  }).observe(canvas);
});
