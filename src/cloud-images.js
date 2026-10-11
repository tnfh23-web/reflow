async function webp(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('이미지를 변환하지 못했어요.')),'image/webp',.82));
}
function canvasOf(image,x,y,width,height,targetWidth){
  const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=Math.max(1,Math.round(height*targetWidth/width));
  canvas.getContext('2d').drawImage(image,x,y,width,height,0,0,canvas.width,canvas.height);return canvas;
}
export async function uploadImages(file){
  if(file.size>20*1024*1024)throw new Error('20MB 이하의 이미지를 선택해 주세요.');
  const image=await createImageBitmap(file);
  try{
    if(image.width*image.height>60e6)throw new Error('이미지 해상도를 줄여 다시 올려 주세요.');
    const scale=Math.min(1,1440/image.width,16000/image.height),width=Math.max(1,Math.floor(image.width*scale));
    const full=canvasOf(image,0,0,image.width,image.height,width),thumb=canvasOf(full,0,0,full.width,Math.min(900,full.height),Math.min(960,width));
    const [fullBlob,thumbBlob]=await Promise.all([webp(full),webp(thumb)]),form=new FormData();
    form.append('image',fullBlob,'image.webp');form.append('thumb',thumbBlob,'thumb.webp');return form;
  }finally{image.close();}
}
export async function cropImage(element,crop,name){
  const bounds={x:Math.round(crop.x),y:Math.round(crop.y),width:Math.round(crop.width),height:Math.round(crop.height),name};
  bounds.width=Math.min(bounds.width,element.naturalWidth-bounds.x);bounds.height=Math.min(bounds.height,element.naturalHeight-bounds.y);
  if(bounds.width<20||bounds.height<20)throw new Error('구간을 조금 더 크게 선택해 주세요.');
  const canvas=canvasOf(element,bounds.x,bounds.y,bounds.width,bounds.height,Math.min(960,bounds.width)),form=new FormData();
  form.append('image',await webp(canvas),'section.webp');form.append('crop',JSON.stringify(bounds));return form;
}
