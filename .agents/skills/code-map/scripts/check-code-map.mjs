import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const extensions = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.css','.scss','.sass','.html','.sql','.py','.vue','.svelte','.jsonc']);
const ignored = new Set(['.git','.agents','node_modules','.next','.nuxt','.output','.wrangler','.cache','__pycache__']);
const ignoredAtRoot = new Set(['dist','build','coverage','qa','work','data','playwright-report','test-results']);
const start = '<!-- code-map-review:start -->';
const end = '<!-- code-map-review:end -->';
const normalized = value => value.replaceAll('\\','/');

export async function sourceInventory(root, exclusions = []) {
  const results = {};
  const excluded = exclusions.map(value => normalized(value).replace(/\/$/,''));
  async function visit(relative = '') {
    for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes:true})) {
      const file = normalized(path.join(relative, entry.name));
      if (excluded.some(prefix => file === prefix || file.startsWith(prefix + '/'))) continue;
      if (entry.isDirectory()) { if (!ignored.has(entry.name) && (relative || !ignoredAtRoot.has(entry.name))) await visit(file); }
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        const source = (await fs.readFile(path.join(root, file),'utf8')).replaceAll('\r\n','\n');
        results[file] = createHash('sha256').update(source).digest('hex');
      }
      // Symlinks are deliberately not followed, so the inventory stays in the target tree.
    }
  }
  await visit();
  return Object.fromEntries(Object.entries(results).sort(([a],[b]) => a.localeCompare(b,'en')));
}

export function reviewMap(text, inventory) {
  const rows = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/);
    if (!match) continue;
    const file = normalized(match[1]);
    if (!extensions.has(path.extname(file).toLowerCase())) continue;
    if (!match[2].trim()) continue;
    rows.set(file, (rows.get(file) || 0) + 1);
  }
  const missing = Object.keys(inventory).filter(file => !rows.has(file));
  const removed = [...rows.keys()].filter(file => !(file in inventory));
  const duplicates = [...rows].filter(([,count]) => count > 1).map(([file]) => file);
  const from = text.indexOf(start), to = text.indexOf(end);
  let stamp = null;
  if (from >= 0 && to > from) {
    try { stamp = JSON.parse(text.slice(from + start.length, to).trim()); } catch { /* invalid stamp is unreviewed */ }
  }
  const changed = Object.entries(inventory).filter(([file,hash]) => stamp?.files?.[file] !== hash).map(([file]) => file);
  return {missing,removed,duplicates,changed};
}

export async function checkCodeMap({root = process.cwd(), map = 'docs/code-map.md', exclude = [], stamp = false, list = false} = {}) {
  root = path.resolve(root);
  const inventory = await sourceInventory(root, exclude);
  if (list) return {files:Object.keys(inventory)};
  const target = path.resolve(root, map);
  const relative = path.relative(root, target);
  if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || relative === '..') throw new Error('문서는 대상 프로젝트 안에 있어야 합니다.');
  const text = await fs.readFile(target, 'utf8');
  const result = reviewMap(text, inventory);
  if (stamp && !result.missing.length && !result.removed.length && !result.duplicates.length) {
    const record = `${start}\n${JSON.stringify({version:1,files:inventory},null,2)}\n${end}`;
    const from = text.indexOf(start), to = text.indexOf(end);
    if ((from >= 0 || to >= 0) && !(from >= 0 && to > from)) throw new Error('검토 주석이 손상됐습니다. 시작·끝 주석을 함께 복구하세요.');
    const next = from >= 0 && to > from ? text.slice(0,from) + record + text.slice(to+end.length) : text.trimEnd() + '\n\n' + record + '\n';
    await fs.writeFile(target, next);
    result.changed = [];
  }
  return {...result,files:Object.keys(inventory),ok:!result.missing.length && !result.removed.length && !result.duplicates.length && !result.changed.length};
}

async function main() {
  const options = {exclude:[]};
  for (let index = 0; index < process.argv.slice(2).length; index++) {
    const args = process.argv.slice(2), arg = args[index];
    if (['--stamp','--list'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--root','--map','--exclude'].includes(arg) && args[index+1] && !args[index+1].startsWith('--')) {
      const value = args[++index]; if (arg === '--exclude') options.exclude.push(value); else options[arg.slice(2)] = value;
    } else throw new Error(`사용법: --root 경로 --map 문서 --exclude 생성폴더 --list --stamp (알 수 없는 인수: ${arg})`);
  }
  const result = await checkCodeMap(options);
  if (options.list) { console.log(result.files.join('\n')); return; }
  for (const [key,label] of [['missing','문서에서 빠진 파일'],['removed','삭제됐거나 대상 밖인 문서 행'],['duplicates','중복 문서 행'],['changed','소스 변경 후 검토가 필요한 파일']]) {
    if (result[key].length) console.log(`${label}:\n${result[key].map(file => '  '+file).join('\n')}`);
  }
  console.log(result.ok ? `파일 역할표 검사 PASS (${result.files.length}개 소스). 설명의 의미는 별도 검토 대상입니다.` : '파일 역할표를 검토·갱신한 뒤 --stamp로 검토 기준을 기록하세요.');
  if (!result.ok) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
