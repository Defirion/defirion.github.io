/* Progressive enhancement: the same two heading words become the compact identity.
   No clones, scroll hijacking, time-based animation or hidden duplicate links. */
(() => {
  const heading = document.querySelector('#identity-title');
  const dock = document.querySelector('.identity-dock');
  if (!heading || !dock) return;
  const words = [...heading.querySelectorAll('.identity-word')];
  const hero = document.querySelector('.hero');
  const orbit = hero.querySelector('.hero-orbit');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let geometry, pending = false;
  function render() {
    pending = false;
    if (!geometry) return;
    const { starts, target, scale, end } = geometry;
    const progress = Math.min(1, Math.max(0, scrollY / end));
    // The orbital mark recedes as the name takes over the persistent header.
    if (orbit) {
      orbit.style.opacity = motion.matches ? '' : `${1 - progress * .8}`;
      orbit.style.scale = motion.matches ? '' : `${1 - progress * .12}`;
    }
    words.forEach((word, i) => {
      let p = progress;
      if (motion.matches) p = progress < 1 ? 0 : 1;
      const start = starts[i];
      const x = start.x + (target[i].x - start.x) * p;
      const naturalY = motion.matches && p === 0 ? start.y - scrollY : start.y;
      const y = naturalY + (target[i].y - naturalY) * p;
      const size = 1 + (scale - 1) * p;
      word.style.transform = `translate(${x}px, ${y}px) scale(${size})`;
    });
  }
  function measure() {
    document.documentElement.classList.remove('identity-enhanced');
    heading.style.height = '';
    words.forEach(word => word.style.transform = '');
    const starts = words.map(word => {
      const r = word.getBoundingClientRect();
      return {x:r.left, y:r.top + scrollY, width:r.width, height:r.height};
    });
    const height = heading.getBoundingClientRect().height;
    const r = dock.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(heading).fontSize);
    const wantedSize = innerWidth < 370 ? 15 : innerWidth < 701 ? 17 : 22;
    const scale = Math.min(wantedSize / fontSize, (r.width - 6) / (starts[0].width + starts[1].width));
    const copyTop = hero.querySelector('.hero-bottom').getBoundingClientRect().top + scrollY;
    const dockedBottom = r.top + 4 + Math.max(...starts.map(start => start.height)) * scale;
    // Finish before the scrolling introduction reaches the moving name.
    // This matters on narrow screens, where the copy sits closer to the heading.
    const end = Math.max(180, Math.min(hero.offsetHeight * .72, copyTop - dockedBottom - 24));
    geometry = { starts, scale, end,
      target:[{x:r.left,y:r.top+4},{x:r.left+starts[0].width*scale+6,y:r.top+4}] };
    heading.style.height = `${height}px`;
    document.documentElement.classList.add('identity-enhanced');
    render();
  }
  addEventListener('scroll', () => {if (!pending) {pending=true;requestAnimationFrame(render);}}, {passive:true});
  addEventListener('resize', measure);
  addEventListener('pageshow', measure);
  motion.addEventListener('change', render);
  document.fonts.ready.then(measure);
  measure();
})();
