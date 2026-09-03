(() => {
  const options = [...document.querySelectorAll('.model-option[data-model]')];

  function preview(model) {
    document.body.dataset.model = model;
    for (const option of options) {
      const active = option.dataset.model === model;
      option.classList.toggle('is-active', active);
      if (active) option.setAttribute('aria-current', 'true');
      else option.removeAttribute('aria-current');
    }
  }

  for (const option of options) {
    option.addEventListener('pointerenter', () => preview(option.dataset.model));
    option.addEventListener('focus', () => preview(option.dataset.model));
    option.addEventListener('touchstart', () => preview(option.dataset.model), { passive: true });
  }
})();
