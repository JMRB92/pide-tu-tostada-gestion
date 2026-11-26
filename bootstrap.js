import('./admin.js').catch(error=>{
  console.error('Error de inicio',error);
  const main=document.getElementById('main');
  const box=document.createElement('div');box.className='card';
  const h=document.createElement('h2');h.textContent='No se pudo iniciar la aplicación';
  const p=document.createElement('p');p.textContent='Comprueba tu conexión y vuelve a intentarlo. Si el problema continúa, contacta con cafetería.';
  const button=document.createElement('button');button.textContent='Reintentar';button.onclick=()=>location.reload();
  box.append(h,p,button);main.replaceChildren(box);
});
