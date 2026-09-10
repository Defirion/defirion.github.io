/* Scroll describes relationships; all figures remain complete without JavaScript.
   No timers, looping motion, hidden copy, or simulated project results. */
(() => {
  const figures = [...document.querySelectorAll('[data-diagram]')];
  if (!figures.length || !('IntersectionObserver' in window)) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const active = new Set();
  let pending = false;

  const entries = figures.map(figure => ({
    figure,
    weight: figure.querySelector('.mix-weight'),
    parts: [...figure.querySelectorAll('.diagram-line, .diagram-node')].map(element => ({
      element,
      stage: Number(element.dataset.stage),
      length: element.classList.contains('diagram-line') ? element.getTotalLength() : 0
    }))
  }));

  function paint(entry, progress) {
    if (entry.weight) {
      // 55% is the configured input, not an achieved listening-time measurement.
      entry.weight.style.strokeDasharray = `${525.274 * progress} 955.044`;
    }
    entry.parts.forEach(({element, stage, length}) => {
      const step = clamp(progress * 2 - stage * .4);
      if (length) {
        element.style.strokeDasharray = `${length} ${length}`;
        element.style.strokeDashoffset = `${length * (1 - step)}`;
      } else {
        element.style.opacity = `${.3 + step * .7}`;
      }
    });
  }

  function render() {
    pending = false;
    // Read every rect before writing styles to avoid interleaved layout work.
    const states = entries.filter(entry => active.has(entry.figure)).map(entry => {
      const rect = entry.figure.getBoundingClientRect();
      const span = Math.min(rect.height * .6, innerHeight * .5);
      // Let the figure settle into the viewport before its story starts.
      const revealLine = innerHeight * .82;
      return [entry, motion.matches ? 1 : clamp((revealLine - rect.top) / Math.max(1, span))];
    });
    states.forEach(([entry, progress]) => paint(entry, progress));
  }

  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(render); }
  }

  const observer = new IntersectionObserver(changes => {
    changes.forEach(({target, isIntersecting}) => {
      if (isIntersecting) active.add(target);
      else active.delete(target);
    });
    schedule();
  }, {rootMargin: '0px'});
  figures.forEach(figure => observer.observe(figure));
  addEventListener('scroll', schedule, {passive: true});
  addEventListener('resize', schedule);
  addEventListener('pageshow', schedule);
  motion.addEventListener('change', () => {
    entries.forEach(entry => paint(entry, 1));
    schedule();
  });
  // Reduced motion always gets the final diagram, including offscreen figures.
  if (motion.matches) entries.forEach(entry => paint(entry, 1));
})();
