export const LOCALE_STORAGE_KEY = 'fw:locale';

export function createI18n(site, locale) {
  const loc = (v) => (v && typeof v === 'object' && !Array.isArray(v) && locale in v ? v[locale] : v);
  const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`)) : s);
  const lookup = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), site.ui);
  const wholeEuros = new Intl.NumberFormat(site.locales[locale].numberFormat, { maximumFractionDigits: 2 });
  const cents = new Intl.NumberFormat(site.locales[locale].numberFormat, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const url = (route, to = locale) => {
    const s = site.routes[route][to];
    return `/${to}/${s ? `${s}/` : ''}`;
  };

  return {
    locale,
    loc,
    t(key, vars) {
      const v = loc(lookup(key));
      if (v == null) throw new Error(`i18n: missing ui.${key} (${locale})`);
      return Array.isArray(v) ? v : fill(v, vars);
    },
    money(n) {
      const r = Math.round(n * 100) / 100;
      return `€ ${(Number.isInteger(r) ? wholeEuros : cents).format(r)}`;
    },
    pieces(n) {
      return n === 1 ? this.t('common.piece') : this.t('common.pieces', { n });
    },
    url,
    alternates: (route) => Object.entries(site.locales).map(([l, d]) => ({ locale: l, href: url(route, l), ...d })),
  };
}
