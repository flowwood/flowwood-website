(elements) => {
  if (!elements) {
    elements = [document.body, ...document.body.querySelectorAll('*')].map((e) => ({
      tag: e.localName,
      id: e.id,
      component: e.getAttribute('data-component'),
      cls: e.getAttribute('class') || '',
    }));
  }
  const NAME = '[a-z0-9]+(?:-[a-z0-9]+)*';
  const BEM = new RegExp(`^${NAME}(?:__${NAME})?(?:--${NAME})?$`);
  const problems = [];
  const seen = new Map();
  for (const el of elements) {
    const where = `<${el.tag}${el.id ? `#${el.id}` : ''}${el.cls ? `.${el.cls.split(/\s+/).join('.')}` : ''}>`;
    if (!el.id) problems.push(`missing id: ${where}`);
    if (!el.component) problems.push(`missing data-component: ${where}`);
    if (el.id && !BEM.test(el.id)) problems.push(`id is not BEM: ${where}`);
    if (el.id && el.component && !(el.id === el.component || el.id.startsWith(`${el.component}__`) || el.id.startsWith(`${el.component}--`)))
      problems.push(`id does not belong to data-component="${el.component}": ${where}`);
    for (const c of el.cls.split(/\s+/).filter(Boolean)) if (!BEM.test(c)) problems.push(`class "${c}" is not BEM: ${where}`);
    if (el.id) seen.set(el.id, (seen.get(el.id) || 0) + 1);
  }
  for (const [id, n] of seen) if (n > 1) problems.push(`duplicate id ×${n}: #${id}`);
  return problems;
}
