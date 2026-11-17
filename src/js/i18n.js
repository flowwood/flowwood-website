export const LOCALE_STORAGE_KEY = 'fw:locale';

export function createI18n(site, locale) {
  const loc = (v) => (v && typeof v === 'object' && !Array.isArray(v) && locale in v ? v[locale] : v);
  const fillOne = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
  const fill = (v, vars) => (!vars ? v : Array.isArray(v) ? v.map((s) => fillOne(s, vars)) : fillOne(v, vars));
  const text = (v, vars) => fill(loc(v), vars);
  const lang = site.locales[locale].lang;
  const lookup = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), site.ui);
  const wholeEuros = new Intl.NumberFormat(site.locales[locale].numberFormat, { maximumFractionDigits: 2 });
  const cents = new Intl.NumberFormat(site.locales[locale].numberFormat, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const url = (route, to = locale, item = '') => {
    const s = site.routes[route][to];
    return `${site.basePath || ''}/${to}/${s ? `${s}/` : ''}${item ? `${item}/` : ''}`;
  };

  return {
    locale,
    loc,
    text,
    t(key, vars) {
      const v = lookup(key);
      if (loc(v) == null) throw new Error(`i18n: missing ui.${key} (${locale})`);
      return text(v, vars);
    },
    countries(list) {
      const names = new Intl.DisplayNames([lang], { type: 'region' });
      return new Intl.ListFormat(lang, { type: 'conjunction' }).format(list.map((c) => loc(c.name) ?? names.of(c.code)));
    },
    money(n) {
      const r = Math.round(n * 100) / 100;
      return `€ ${(Number.isInteger(r) ? wholeEuros : cents).format(r)}`;
    },
    pieces(n) {
      return n === 1 ? this.t('common.piece') : this.t('common.pieces', { n });
    },
    url,
    alternates: (route, item = '') => Object.entries(site.locales).map(([l, d]) => ({ locale: l, href: url(route, l, item), ...d })),
  };
}
