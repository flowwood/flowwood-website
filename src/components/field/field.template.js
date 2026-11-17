import { bem, esc } from '../../js/bem.js';

function control(b, { type, autocomplete, options, limit, shared }) {
  if (type === 'select') return `<select ${b('input', { mods: { select: true } })} ${shared} autocomplete="${autocomplete}">${options.map((o) => `<option ${b('option', { key: o.value })} value="${esc(o.value)}"${o.selected ? ' selected' : ''}${o.attrs || ''}>${esc(o.label)}</option>`).join('')}</select>`;
  const max = limit ? ` maxlength="${limit}"` : '';
  if (type === 'textarea') return `<textarea ${b('input', { mods: { multiline: true } })} ${shared}${max} rows="5"></textarea>`;
  return `<input ${b('input')} ${shared}${max} type="${type}" autocomplete="${autocomplete}">`;
}

export function field({ site, i18n }, { form, name, label, hint = '', error = '', type = 'text', autocomplete = 'off', optional = false, limit = name, options = [], attrs = '', extra = '' }) {
  const b = bem('field', `${form}-${name}`);
  const hintId = hint && b.id('hint');
  const notes = `${hint ? ` aria-describedby="${hintId}" data-hint="${hintId}"` : ''}${error ? ` data-error="${b.id('error')}"` : ''}`;
  const shared = `name="${name}"${optional ? '' : ' required'}${notes}${attrs}`;
  const marker = optional ? ` <span ${b('optional')}>(${esc(i18n.t('field.optional'))})</span>` : `<span ${b('required')} aria-hidden="true">*</span>`;
  return `<div ${b()}>
      <label ${b('label')} for="${b.id('input')}">${esc(label)}${marker}</label>
      ${hint ? `<p ${b('hint')}>${esc(hint)}</p>` : ''}
      <div ${b('control', { mods: { select: type === 'select' } })}>${control(b, { type, autocomplete, options, limit: site.limits[limit], shared })}<span ${b('check')} aria-hidden="true"></span>${extra}</div>
      ${error ? `<p ${b('error')}>${esc(error)}</p>` : ''}
    </div>`;
}
