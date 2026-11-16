const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const matchesType = (v, type) => [].concat(type).some((t) => t === typeOf(v) || (t === 'number' && typeOf(v) === 'integer'));

export function createValidator(root) {
  const resolve = (s) => (s.$ref ? resolve(s.$ref.slice(2).split('/').reduce((o, k) => o[k], root)) : s);

  function check(schema, v, path, errors) {
    const s = resolve(schema);
    const fail = (m) => errors.push(`${path || '/'}: ${m}`);
    if (s.type && !matchesType(v, s.type)) return fail(`expected ${[].concat(s.type).join(' or ')}`);
    if (s.enum && !s.enum.includes(v)) return fail(`expected one of ${s.enum.join(', ')}`);
    if (typeof v === 'string' && s.pattern && !new RegExp(s.pattern).test(v)) fail(`does not match ${s.pattern}`);
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) fail(`below ${s.minimum}`);
      if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) fail(`not above ${s.exclusiveMinimum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) fail(`fewer than ${s.minItems} items`);
      if (s.maxItems !== undefined && v.length > s.maxItems) fail(`more than ${s.maxItems} items`);
      if (s.items) v.forEach((item, i) => check(s.items, item, `${path}/${i}`, errors));
    }
    if (typeOf(v) === 'object') {
      for (const k of s.required || []) if (!(k in v)) fail(`missing ${k}`);
      for (const [k, item] of Object.entries(v)) {
        const own = s.properties?.[k];
        if (own) check(own, item, `${path}/${k}`, errors);
        else if (s.additionalProperties === false) fail(`unexpected ${k}`);
        else if (typeof s.additionalProperties === 'object') check(s.additionalProperties, item, `${path}/${k}`, errors);
      }
    }
    const passes = (alt) => validate(alt, v, path).length === 0;
    if (s.anyOf && !s.anyOf.some(passes)) fail('matches none of the allowed shapes');
    if (s.oneOf && s.oneOf.filter(passes).length !== 1) fail('must match exactly one allowed shape');
  }

  function validate(schema, v, path = '') {
    const errors = [];
    check(schema, v, path, errors);
    return errors;
  }

  return (v) => validate(root, v);
}
