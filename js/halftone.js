// Интерактивный фон всей страницы (WebGL), как в референсе: один фиксированный
// слой за всеми секциями. Тёмные секции прозрачные — эффект виден сквозь них.
//
// - На первом экране фото образа собрано из полутоновых точек и уезжает вместе с экраном.
// - Ниже фон темнеет, а курсор «разливает» полутоновое свечение.
// - Точки стоят на сетке, значения под ними текут (волновое искажение) — ощущение воды;
//   вокруг курсора подсветка и круги, как на воде.
// - Под текстом с атрибутом data-quiet точки гаснут, чтобы текст читался.
// - Без мыши (телефон) пятно света плавает само; при prefers-reduced-motion — статичный кадр.
// - Если фото не загрузилось, на первом экране рисуется «жидкая» сфера.

const canvas = document.querySelector('.page-bg');

// Фото на чёрном фоне: в полутоне светится только силуэт, фон остаётся чистым
const PHOTO_URL = 'https://images.unsplash.com/photo-1581966429686-ab5d030753fa?w=900&h=1125&q=80&auto=format&fit=crop';
const PHOTO_ASPECT = 0.8;   // ширина / высота фото
const CELL = 9;             // шаг сетки точек, CSS px
const QUIET_PAD = 24;       // запас вокруг текста, где точки гаснут, CSS px
const QUIET_SLOTS = 6;      // сколько текстовых зон учитываем одновременно

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;

uniform vec2  u_res;      // размер холста, device px
uniform float u_dpr;
uniform float u_time;
uniform vec2  u_light;    // положение пятна света, device px (y вниз)
uniform float u_ripple;   // сила кругов на воде (0..1)
uniform vec4  u_rect;     // где сейчас фото: x, y, w, h (device px)
uniform float u_hasTex;
uniform sampler2D u_tex;
uniform vec4  u_quiet[${QUIET_SLOTS}]; // зоны текста: left, top, right, bottom
uniform float u_cell;
uniform float u_hero;     // 1 — на первом экране, 0 — ниже

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// 1 вне прямоугольника, плавно опускается до 0 внутри
float quiet(vec2 p, vec4 r) {
  if (r.z <= r.x) return 1.0;
  vec2 d = max(vec2(r.x - p.x, r.y - p.y), vec2(p.x - r.z, p.y - r.w));
  float dist = length(max(d, 0.0));
  return smoothstep(0.0, 90.0 * u_dpr, dist);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float t = u_time;

  // Центр ячейки сетки — точки стоят на месте
  vec2 cell = (floor(p / u_cell) + 0.5) * u_cell;

  // Вода: медленное течение (domain warp) ...
  vec2 q = cell / (240.0 * u_dpr);
  vec2 flow = vec2(fbm(q + vec2(0.0, t * 0.10)), fbm(q + vec2(5.2, -t * 0.08))) - 0.5;
  vec2 q2 = q * 1.7 + flow * 1.5;
  vec2 flow2 = vec2(fbm(q2 + vec2(t * 0.06, 1.7)), fbm(q2 + vec2(8.3, t * 0.05))) - 0.5;

  // ... и круги вокруг курсора
  vec2 toLight = cell - u_light;
  float dl = length(toLight) + 0.001;
  float ring = sin(dl / (22.0 * u_dpr) - t * 2.6) * exp(-dl / (240.0 * u_dpr)) * u_ripple;

  vec2 s = cell + (flow + flow2 * 0.8) * 38.0 * u_dpr + (toLight / dl) * ring * 14.0 * u_dpr;

  // Свет от курсора
  float sigma = 0.32 * min(u_res.x, u_res.y);
  float light = exp(-dot(toLight, toLight) / (2.0 * sigma * sigma));

  // Фигура первого экрана: фото в полутонах или «жидкая» сфера
  float v = 0.0;
  vec2 uv = (s - u_rect.xy) / u_rect.zw;
  if (u_rect.y + u_rect.w > 0.0) {
    if (u_hasTex > 0.5) {
      float edge = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x)
                 * smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.82, uv.y);
      vec3 c = texture2D(u_tex, clamp(uv, 0.0, 1.0)).rgb;
      float lum = smoothstep(0.04, 0.55, dot(c, vec3(0.299, 0.587, 0.114)));
      v = lum * edge * (0.45 + 1.0 * light);
    } else {
      vec2 center = u_rect.xy + u_rect.zw * 0.5;
      vec2 sc = (s - center) / (u_rect.w * 0.42);
      float r = length(sc);
      float body = smoothstep(1.02, 0.96, r + flow.x * 0.25);
      float rim = pow(clamp(dot(normalize(sc + 0.0001), normalize(u_light - center)), 0.0, 1.0), 3.0);
      v = body * (0.12 + 0.95 * rim * smoothstep(0.55, 1.0, r)) * (0.6 + 0.6 * light);
    }
  }

  // «Жидкое» свечение за курсором: слабое на первом экране, заметное ниже
  float liquid = light * clamp(0.55 + 1.1 * flow2.y + 0.6 * flow.x, 0.0, 1.2);
  v += liquid * mix(0.42, 0.06, u_hero) + flow2.x * 0.04;

  for (int i = 0; i < ${QUIET_SLOTS}; i++) {
    v *= quiet(cell, u_quiet[i]);
  }
  v = clamp(v, 0.0, 1.0);

  // Радиус больше половины ячейки — в ярких местах точки сливаются в «лужи»
  float radius = sqrt(v) * u_cell * 0.64;
  float aa = 0.9 * u_dpr;
  float dotMask = 1.0 - smoothstep(radius - aa, radius + aa, length(p - cell));

  // Фон: графит на первом экране, почти чёрный ниже; мягкое свечение за курсором
  float glow = exp(-dot(p - u_light, p - u_light) / (2.0 * pow(0.6 * u_res.y, 2.0)));
  vec3 bg = mix(vec3(mix(0.07, 0.27, u_hero)), vec3(mix(0.2, 0.47, u_hero)), glow);
  vec3 ink = vec3(mix(0.72, 0.97, u_hero));

  vec3 col = mix(bg, ink, dotMask * 0.95);

  // Зерно, как в референсе
  col += (hash(p + fract(t * 7.0) * 100.0) - 0.5) * 0.045;

  gl_FragColor = vec4(col, 1.0);
}
`;

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
};

const gl = canvas && canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });

if (gl) {
  const hero = document.querySelector('.hero');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Программа
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);

  // Полноэкранный треугольник
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['u_res', 'u_dpr', 'u_time', 'u_light', 'u_ripple', 'u_rect', 'u_hasTex', 'u_tex', 'u_quiet', 'u_cell', 'u_hero']
    .forEach((name) => { u[name] = gl.getUniformLocation(program, name); });

  gl.uniform1f(u.u_hasTex, 0);
  gl.uniform1i(u.u_tex, 0);

  let dpr = 1;
  let width = 0;
  let height = 0;
  const light = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let ripple = 0.4;
  let pointerActive = false;
  let frameId = null;

  // Фото: Unsplash отдаёт картинки с CORS, поэтому их можно читать в шейдере
  const texture = gl.createTexture();
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1f(u.u_hasTex, 1);
    if (reduceMotion) render(0);
  };
  image.src = PHOTO_URL;

  // Где сейчас фото (в координатах окна): уезжает вместе с первым экраном
  const photoRect = () => {
    const h = hero.getBoundingClientRect();

    if (h.width >= 960) {
      const ph = h.height * 0.96;
      const pw = ph * PHOTO_ASPECT;
      return [h.width * 0.4 - pw / 2, h.top + h.height * 0.02, pw, ph];
    }

    // Телефон: силуэт начинается в пустом промежутке между текстом и ценой
    const top = hero.querySelector('.hero__spacer').getBoundingClientRect().top - 40;
    const pw = Math.min(h.width * 1.1, (h.bottom - top) * PHOTO_ASPECT);
    const ph = pw / PHOTO_ASPECT;
    return [(h.width - pw) / 2, top, pw, ph];
  };

  // Зоны текста, видимые сейчас в окне
  const quietRects = () => {
    const out = new Float32Array(QUIET_SLOTS * 4);
    let i = 0;
    for (const el of document.querySelectorAll('[data-quiet]')) {
      if (i === QUIET_SLOTS) break;
      const r = el.getBoundingClientRect();
      if (r.bottom < -QUIET_PAD || r.top > height + QUIET_PAD) continue;
      out.set([
        (r.left - QUIET_PAD) * dpr,
        (r.top - QUIET_PAD) * dpr,
        (r.right + QUIET_PAD) * dpr,
        (r.bottom + QUIET_PAD) * dpr,
      ], i * 4);
      i += 1;
    }
    return out;
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.uniform2f(u.u_res, canvas.width, canvas.height);
    gl.uniform1f(u.u_dpr, dpr);
    gl.uniform1f(u.u_cell, CELL * dpr);

    if (!pointerActive) {
      light.x = target.x = width * 0.4;
      light.y = target.y = height * 0.35;
    }
  };

  const render = (time) => {
    const t = time / 1000;

    // Без курсора пятно плавает по мягкой траектории
    if (!pointerActive) {
      target.x = width * (0.38 + 0.18 * Math.sin(t * 0.21));
      target.y = height * (0.42 + 0.2 * Math.sin(t * 0.33 + 1));
    }

    // Инерция: пятно догоняет курсор с запаздыванием, как в жидкости
    light.x += (target.x - light.x) * 0.06;
    light.y += (target.y - light.y) * 0.06;
    ripple += ((pointerActive ? 1 : 0.4) - ripple) * 0.04;

    // Насколько мы ещё на первом экране: 1 вверху, 0 когда он прокручен
    const heroH = hero.offsetHeight || height;
    const heroProgress = Math.min(Math.max(1 - window.scrollY / (heroH * 0.8), 0), 1);

    gl.uniform1f(u.u_time, t);
    gl.uniform2f(u.u_light, light.x * dpr, light.y * dpr);
    gl.uniform1f(u.u_ripple, ripple);
    gl.uniform1f(u.u_hero, heroProgress);
    gl.uniform4fv(u.u_rect, photoRect().map((n) => n * dpr));
    gl.uniform4fv(u.u_quiet, quietRects());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (time) => {
    render(time);
    frameId = requestAnimationFrame(loop);
  };

  const start = () => {
    if (reduceMotion || frameId !== null || document.hidden) return;
    frameId = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    target.x = e.clientX;
    target.y = e.clientY;
    pointerActive = true;
  });

  document.documentElement.addEventListener('pointerleave', () => { pointerActive = false; });

  // Не тратим ресурсы, когда вкладка скрыта
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  window.addEventListener('resize', () => {
    resize();
    if (reduceMotion) render(0);
  });

  // При reduced motion перерисовываем кадр при прокрутке, чтобы фото уезжало с экраном
  if (reduceMotion) {
    window.addEventListener('scroll', () => render(0), { passive: true });
  }

  resize();
  reduceMotion ? render(0) : start();
} else {
  // WebGL недоступен — остаётся градиент из CSS
  document.documentElement.classList.add('no-webgl');
  if (canvas) canvas.hidden = true;
}
