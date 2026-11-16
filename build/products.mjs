import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTS = 'content/products';
const CATALOG = 'content/catalog.json';
const MEDIA = 'content/media';
const MODEL = 'model.json';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const TYPE_CHECKS = { object: isObject, array: Array.isArray, string: (v) => typeof v === 'string', number: (v) => typeof v === 'number', integer: Number.isInteger };
const isUnique = (list) => new Set(list.map((v) => JSON.stringify(v))).size === list.length;
const defOf = (model, ref) => ref.split('/').slice(1).reduce((node, key) => node[key], model);

function valueErrors(value, schema, path, model) {
  const errors = [];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(', ')}`);
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} "${value}" does not match ${schema.pattern}`);
  if (schema.minLength && value.length < schema.minLength) errors.push(`${path} is empty`);
  if (schema.minimum != null && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`);
  if (schema.minItems && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} item(s)`);
  if (schema.maxItems && value.length > schema.maxItems) errors.push(`${path} allows at most ${schema.maxItems} item(s)`);
  if (schema.uniqueItems && !isUnique(value)) errors.push(`${path} has duplicates`);
  if (schema.items) value.forEach((v, i) => errors.push(...modelErrors(v, schema.items, `${path}[${i}]`, model)));
  return errors;
}

function fieldErrors(value, schema, path, model) {
  if (!isObject(value)) return [];
  const missing = (schema.required ?? []).filter((k) => !(k in value)).map((k) => `${path} is missing "${k}"`);
  const fields = Object.entries(value).flatMap(([k, v]) => {
    if (schema.properties?.[k]) return modelErrors(v, schema.properties[k], `${path}.${k}`, model);
    return schema.additionalProperties === false ? [`${path} has unknown field "${k}"`] : [];
  });
  return [...missing, ...fields];
}

function shapeErrors(value, schema, path, model) {
  const errors = [];
  if (schema.not && !modelErrors(value, schema.not, path, model).length) errors.push(`${path} must not match ${JSON.stringify(schema.not)}`);
  if (schema.oneOf) {
    const results = schema.oneOf.map((s) => ({ title: s.title, errors: modelErrors(value, s, path, model) }));
    const matches = results.filter((r) => !r.errors.length).length;
    if (matches !== 1) errors.push(`${path} must be exactly one of: ${results.map((r) => `${r.title} (${r.errors[0] ?? 'matches'})`).join(', ')}`);
  }
  return errors;
}

export function modelErrors(value, schema, path, model = schema) {
  if (schema.$ref) return modelErrors(value, defOf(model, schema.$ref), path, model);
  if (schema.type && !TYPE_CHECKS[schema.type](value)) return [`${path} must be a ${schema.type}`];
  return [...valueErrors(value, schema, path, model), ...fieldErrors(value, schema, path, model), ...shapeErrors(value, schema, path, model)];
}

const imagesOf = (p) => [p.image, p.altImage, ...(p.gallery ?? [])].filter(isObject);
const mediaFilesOf = (p) => imagesOf(p).flatMap((i) => [i.file, i.thumbnail]).filter((f) => typeof f === 'string');

async function parseJson(root, file) {
  try {
    return { value: JSON.parse(await readFile(join(root, file), 'utf8')) };
  } catch (e) {
    return { error: `${file} is not valid JSON: ${e.message}` };
  }
}

async function checkProduct(root, model, id) {
  const file = `${PRODUCTS}/${id}.json`;
  if (!existsSync(join(root, file))) return { id, file, errors: [`${CATALOG} lists "${id}" but ${file} does not exist`] };
  const { value: product, error } = await parseJson(root, file);
  if (error) return { id, file, errors: [error] };
  const errors = modelErrors(product, model, id);
  if (product.id !== id) errors.push(`${id}.id must be "${id}", the file name`);
  for (const f of mediaFilesOf(product)) if (!existsSync(join(root, MEDIA, f))) errors.push(`${id}: image "${f}" is not in ${MEDIA}`);
  const { $schema, ...fields } = product;
  return { id, file, product: fields, errors };
}

export async function productReport(root) {
  const model = JSON.parse(await readFile(join(root, MODEL), 'utf8'));
  const { value: catalog, error } = await parseJson(root, CATALOG);
  if (error) return { products: [], problems: [error] };
  const order = Array.isArray(catalog.products) ? catalog.products : [];
  const files = (await readdir(join(root, PRODUCTS))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length));
  const unlisted = files.filter((id) => !order.includes(id)).map((id) => `${PRODUCTS}/${id}.json is not listed in ${CATALOG} → products`);
  const duplicates = order.filter((id, i) => order.indexOf(id) !== i).map((id) => `${CATALOG} → products lists "${id}" more than once`);
  const products = await Promise.all([...new Set(order)].map((id) => checkProduct(root, model, id)));
  const invalid = products.filter((p) => p.errors.length).map((p) => `${p.file} does not follow ${MODEL}\n  ${p.errors.join('\n  ')}`);
  return { products, problems: [...unlisted, ...duplicates, ...invalid] };
}

export async function readProducts(root) {
  const { products, problems } = await productReport(root);
  if (problems.length) throw new Error(`content: ${problems.join('\ncontent: ')}`);
  return products.map((p) => p.product);
}

async function main() {
  const { products, problems } = await productReport(join(dirname(fileURLToPath(import.meta.url)), '..'));
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log(`✓ ${products.length} products follow ${MODEL}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
