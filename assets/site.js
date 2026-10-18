// Keep long reference tables readable on small screens.
document.querySelectorAll('.prose table').forEach(table => {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', 'Scrollable reference table');
  table.parentNode.insertBefore(wrapper, table);
  wrapper.appendChild(table);
});
