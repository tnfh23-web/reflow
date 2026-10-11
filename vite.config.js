import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
function appShell(){return {name:'reflow-app-shell',apply:'build',async closeBundle(){
  const html=await readFile('dist/index.html','utf8');
  const assets=(await readdir('dist/assets')).filter(name=>/\.(js|css)$/.test(name)).map(name=>'/assets/'+name);
  const files=['/index.html','/manifest.webmanifest','/favicon.svg',...assets,'/fonts/Pretendard-Regular.woff2','/fonts/Pretendard-Bold.woff2','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png','/icons/apple-touch-icon.png','/media/architecture.webp','/intro-install/library.webp','/intro-install/dialog.webp','/intro-install/app.webp'];
  let worker=await readFile('public/sw.js','utf8');
  const fingerprint=createHash('sha256').update(worker);
  for(const file of files)fingerprint.update(await readFile('dist'+file));
  const hash=fingerprint.digest('hex').slice(0,12);
  worker=worker.replace('__REFLOW_BUILD__',hash).replace('/*__REFLOW_PRECACHE__*/[]',JSON.stringify(files));
  await writeFile('dist/sw.js',worker);
}};}
export default defineConfig({ plugins: [react(),appShell()], server: { strictPort: true, proxy: { '/api': 'http://127.0.0.1:4183' } }, build: { sourcemap: false } });
