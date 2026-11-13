() => {
  const vw = document.documentElement.clientWidth;
  const problems = [];
  const label = (e) => `<${e.localName}#${e.id || '?'}.${[...e.classList].join('.')}>`;
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && !e.closest('[hidden],[inert],.visually-hidden,dialog:not([open]),[popover]:not(:popover-open)');
  };
  if (document.documentElement.scrollWidth > vw + 1) problems.push(`page scrolls horizontally: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  for (const e of document.body.querySelectorAll('*')) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    const scroller = e.closest('[style*="overflow"], .menu-bar__nav') || [...ancestors(e)].find((a) => /auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowX));
    if (!scroller && (r.right > vw + 1 || r.left < -1)) problems.push(`sticks out of the viewport (${Math.round(r.left)}…${Math.round(r.right)} of ${vw}): ${label(e)}`);
    if (e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible' && !/ellipsis|clip/.test(getComputedStyle(e).textOverflow)) problems.push(`text clipped: ${label(e)} "${e.textContent.trim().slice(0, 30)}"`);
  }
  if (vw <= 1199) {
    for (const e of document.body.querySelectorAll('a[href], button, input, [role="button"]')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      const before = getComputedStyle(e, '::before');
      const padded = before.content !== 'none' && before.position === 'absolute';
      if ((r.width < 44 || r.height < 44) && !padded && !e.closest('p, .footer__links, .menu-bar__nav, nav[aria-label]')) problems.push(`touch target ${Math.round(r.width)}×${Math.round(r.height)}: ${label(e)}`);
    }
  }
  function* ancestors(e) {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) yield a;
  }
  return problems.slice(0, 60);
}
