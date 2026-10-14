import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

export async function prerenderPublicPages(){
  // Only the bundled public examples are used. Never query accounts or private data.
  const samples=JSON.parse(await readFile('dist/cloud-samples.json','utf8')).slice(0,3).map(({id,title,image,thumb,sections,sample})=>({id,title,image,thumb,sections:sections.map(({id,name,image})=>({id,name,image})),sample}));
  const vite=await createServer({configFile:false,plugins:[react()],server:{middlewareMode:true},ssr:{noExternal:['gsap','lenis']}});
  try{
    const {renderPublicPage}=await vite.ssrLoadModule('/src/public-preview.jsx');
    const data=JSON.stringify(samples).replace(/</g,'\\u003c');
    for(const page of ['about','guide']){
      const file=`dist/${page}.html`;
      const template=await readFile(file,'utf8');
      if(!template.includes('<!--REFLOW_PUBLIC_CONTENT-->')||!template.includes('<!--REFLOW_PUBLIC_DATA-->'))throw new Error(`Missing public page markers: ${page}`);
      await writeFile(file,template.replace('<!--REFLOW_PUBLIC_CONTENT-->',renderPublicPage(page,samples)).replace('<!--REFLOW_PUBLIC_DATA-->',data));
    }
  }finally{await vite.close();}
}
