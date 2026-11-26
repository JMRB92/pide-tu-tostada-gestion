import('./admin.js').catch(error=>{
  console.error('Error de inicio',error);
  const main=document.getElementById('main');
  const box=document.createElement('div');box.className='card';
  const h=document.createElement('h2');h.textContent='No se pudo iniciar la aplicación';
  const p=document.createElement('p');p.textContent='No se han cargado los recursos de la aplicación. Comprueba internet, recarga y verifica que todos los archivos de la v1.04 estén en GitHub. Este fallo es anterior al acceso a Firebase.';
  const detail=document.createElement('small');detail.textContent=String(error?.message||error);
  const button=document.createElement('button');button.textContent='Reintentar';button.onclick=()=>location.reload();
  box.append(h,p,detail,button);main.replaceChildren(box);
});
