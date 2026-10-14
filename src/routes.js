export function readRoute(url=new URL(location.href)){
  const [page,id]=url.hash.replace(/^#\/?/,'').split('/');
  const path=url.pathname.replace(/\.html$/,'').replace(/\/$/,'');
  const publicPage=path==='/about'?'about':path==='/guide'?'guide':null;
  if(page&&(!publicPage||['library','reference','project','projects','about','guide','compare'].includes(page)))return {page,id};
  return {page:path==='/about'?'about':path==='/guide'?'guide':'library',id:undefined};
}
export function routeHref(page,id){
  if(page==='about')return '/about';
  if(page==='guide')return '/guide'+(id?'#guide/'+id:'');
  return '/#'+page+(id?'/'+id:'');
}
