// Витрина кейсов: шоурил, петли в списке, часы, титры. Без библиотек.
// Видео грузим лениво: только активный слайд, следующий за ним и строку под мышью (на телефоне
// карточку в кадре). При reduced-motion, экономии трафика и 2g петель нет, стоят постеры.
(() => {
  const html = document.documentElement;
  html.classList.add('js');

  const SHOW_MS = 7000; // сколько держится слайд шоурила (полоса прогресса берёт отсюда же)

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 500px)');
  const conn = navigator.connection || {};
  const lite = reduced || conn.saveData === true || /2g$/.test(conn.effectiveType || '');

  /* ---------- видео: подставить src один раз, играть, пауза ---------- */
  function arm(v) {
    if (lite || !v) return false;
    if (!v.dataset.armed) {
      v.dataset.armed = '1';
      v.preload = 'auto';
      v.addEventListener('playing', () => v.classList.add('is-ready'));
      v.src = v.dataset.src + (small.matches ? '-m' : '') + '.mp4';
    }
    return true;
  }
  function play(v) {
    if (!arm(v) || !v.paused) return;
    const p = v.play();
    if (p) p.catch(() => {}); // автозапуск запрещён или прерван паузой: остаётся постер
  }
  function stop(v) { if (v && v.dataset.armed && !v.paused) v.pause(); }

  /* ---------- шоурил ---------- */
  const reel = $('.reel');
  const slides = $$('.slide', reel), caps = $$('.cap', reel), segs = $$('.seg', reel);
  const vid = (i) => $('video', slides[(i + slides.length) % slides.length]);
  const N = slides.length;
  let cur = 0, cleanT = 0;
  const hold = new Set(); // причины паузы: hover (мышь на полосе), hidden (вкладка), away (шоурил вне экрана)

  reel.style.setProperty('--show', SHOW_MS + 'ms');
  if (!reduced) reel.classList.add('auto');

  function syncVideo() {
    const live = !hold.has('hidden') && !hold.has('away');
    slides.forEach((s, i) => { if (i !== cur && !s.classList.contains('is-prev')) stop(vid(i)); });
    if (live) play(vid(cur)); else stop(vid(cur));
  }
  function setHold(why, on) {
    if (on) hold.add(why); else hold.delete(why);
    reel.classList.toggle('is-paused', hold.size > 0);
    syncVideo();
  }
  // следующий слайд догружаем, когда текущий уже пошёл
  reel.addEventListener('playing', (e) => {
    if (e.target === vid(cur)) arm(vid(cur + 1));
  }, true);

  function go(n, dir) {
    n = (n + N) % N;
    if (n === cur) return;
    reel.classList.toggle('is-back', dir < 0);
    void reel.offsetWidth; // зафиксировать начало шторки до смены слайда
    const old = cur;
    slides.forEach((s) => s.classList.remove('is-prev'));
    caps.forEach((c) => c.classList.remove('is-out'));
    slides[old].classList.replace('is-on', 'is-prev');
    slides[n].classList.add('is-on');
    caps[old].classList.replace('is-on', 'is-out');
    caps[n].classList.add('is-on');
    segs.forEach((s, i) => {
      s.classList.toggle('is-on', i === n);
      s.classList.toggle('is-past', i < n);
      if (i === n) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current');
    });
    reel.style.setProperty('--i', n);
    cur = n;
    clearTimeout(cleanT);
    cleanT = setTimeout(() => {
      slides[old].classList.remove('is-prev');
      caps[old].classList.remove('is-out');
      stop(vid(old));
    }, 950);
    syncVideo();
  }
  const next = () => go(cur + 1, 1);
  const prev = () => go(cur - 1, -1);

  // таймер это сама анимация полосы: кончилась, значит пора дальше
  reel.addEventListener('animationend', (e) => { if (e.animationName === 'fill') next(); });
  segs.forEach((s, i) => s.addEventListener('click', () => go(i, i > cur ? 1 : -1)));
  const bar = $('.bar', reel);
  bar.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setHold('hover', true); });
  bar.addEventListener('pointerleave', () => setHold('hover', false));

  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || hold.has('away')) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });

  // свайп пальцем и перетаскивание мышью; вертикальный жест отдаём прокрутке (touch-action: pan-y)
  let sx = 0, sy = 0, pid = null, swiped = false;
  reel.addEventListener('pointerdown', (e) => {
    swiped = false;
    if (e.button !== 0 || e.target.closest('.bar')) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY;
  });
  reel.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped = true;
      if (dx < 0) next(); else prev();
    }
  });
  reel.addEventListener('pointercancel', () => { pid = null; });
  reel.addEventListener('dragstart', (e) => e.preventDefault());
  reel.addEventListener('click', (e) => {
    if (swiped) { swiped = false; e.preventDefault(); e.stopPropagation(); return; } // это был жест, не клик
    // телефон: тап по правой трети кадра вперёд, по левой назад
    if (!small.matches || e.target.closest('a, button')) return;
    const x = e.clientX / reel.clientWidth;
    if (x > 2 / 3) next(); else if (x < 1 / 3) prev();
  }, true);

  document.addEventListener('visibilitychange', () => setHold('hidden', document.hidden));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => setHold('away', en.intersectionRatio < 0.2), { threshold: [0, 0.2] }).observe(reel);
  }
  syncVideo();

  /* ---------- список работ ---------- */
  const works = $$('.work');
  works.forEach((w) => {
    const v = $('.win video', w);
    // компьютер: петля за строкой, пока мышь на ней или фокус внутри; ушли, пауза без перемотки
    w.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !small.matches) play(v); });
    w.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') stop(v); });
    w.addEventListener('focusin', () => { if (!small.matches) play(v); });
    w.addEventListener('focusout', (e) => { if (!w.contains(e.relatedTarget)) stop(v); });
  });
  // телефон: src подставляем, когда окно с петлёй показалось краем, играем, пока видно на 40 % и больше.
  // Запаса снизу (rootMargin) нет нарочно: первая карточка стоит сразу под шоурилом и с запасом
  // тянула бы свою петлю уже при открытии страницы (+0,3 МБ к первой загрузке, замерено 28.10).
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((ens) => ens.forEach((en) => {
      if (!small.matches) return;
      const v = $('video', en.target);
      if (en.intersectionRatio > 0) arm(v);
      if (en.intersectionRatio >= 0.4 && !document.hidden) play(v); else stop(v);
    }), { threshold: [0.01, 0.4] });
    works.forEach((w) => seen.observe($('.win', w)));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) works.forEach((w) => stop($('.win video', w))); });

  /* ---------- часы в шапке (только компьютер, см. CSS) ---------- */
  const clock = $('.clock');
  if (clock && clock.dataset.city) {
    try {
      const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: clock.dataset.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      const h = document.createElement('span'), m = document.createElement('span'), colon = document.createElement('b');
      colon.textContent = ':';
      clock.append(clock.dataset.city + ' ', h, colon, m);
      const tick = () => {
        const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
        h.textContent = p.hour; m.textContent = p.minute;
      };
      tick(); setInterval(tick, 10000);
      clock.hidden = false;
    } catch (e) { /* неизвестный пояс: часов просто нет */ }
  }

  /* ---------- титры проявляются один раз при входе в экран ---------- */
  const credits = $('.credits');
  if (reduced || !('IntersectionObserver' in window)) credits.classList.add('is-in');
  else {
    const io = new IntersectionObserver((ens) => {
      if (ens.some((en) => en.isIntersecting)) { credits.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(credits);
  }
})();
