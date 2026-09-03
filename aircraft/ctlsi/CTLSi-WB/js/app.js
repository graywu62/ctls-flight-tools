document.addEventListener('DOMContentLoaded', () => {
 loadProfiles();
 const ids = ['w_empty', 'arm_empty'];
 ids.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', calc);
 });
 calc();
});