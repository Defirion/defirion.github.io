/* Local-only palette switch for the design lab. The baseline stays unchanged without ?palette=. */
(() => {
  const params = new URLSearchParams(location.search);
  const palette = params.get('palette');
  const allowed = ['graphite', 'navy', 'earth', 'ember', 'violet', 'plum', 'coastal', 'mauve'];
  if (allowed.includes(palette)) {
    document.documentElement.dataset.palette = palette;
    return;
  }
  if (palette !== 'custom') return;
  const colors = (params.get('colors') || '').split('-').filter((color) => /^[0-9a-f]{6}$/i.test(color)).slice(0, 6);
  if (colors.length < 3) return;
  colors.forEach((color, index) => document.documentElement.style.setProperty(`--custom-${index + 1}`, `#${color}`));
  document.documentElement.dataset.palette = 'custom';
})();
