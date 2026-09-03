(function(){
  'use strict';
  var DATA = window.CTLS_CHECKLIST_DATA;
  var STORAGE_KEY = 'ctls_checklist_rev24_v1';
  var active = 'external';
  var state = loadState();

  function loadState(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {checked:{},open:{}}; }
    catch(e){ return {checked:{},open:{}}; }
  }
  function saveState(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){}
  }
  function itemId(categoryId, groupIndex, itemIndex){ return categoryId+'-'+groupIndex+'-'+itemIndex; }
  function currentCategory(){ return DATA.categories.find(function(c){return c.id===active;}) || DATA.categories[0]; }
  function categoryStats(category){
    var total=0, done=0;
    category.groups.forEach(function(g,gi){g.items.forEach(function(_,ii){total++;if(state.checked[itemId(category.id,gi,ii)])done++;});});
    return {total:total,done:done};
  }
  function renderTabs(){
    var host=document.getElementById('categoryTabs'); host.replaceChildren();
    DATA.categories.forEach(function(c){
      var b=document.createElement('button'); b.type='button'; b.className='category-tab'+(c.id===active?' active':''); b.dataset.id=c.id;
      b.innerHTML=c.title+'<small>'+c.en+'</small>';
      b.addEventListener('click',function(){active=c.id;render();window.scrollTo({top:0,behavior:'smooth'});}); host.appendChild(b);
    });
  }
  function renderGroups(){
    var category=currentCategory(); var host=document.getElementById('checklist'); host.replaceChildren();
    host.className='checklist'+(category.id==='emergency'?' emergency-mode':'');
    document.getElementById('categoryNotice').textContent=category.notice;
    document.getElementById('categoryNotice').className='category-notice'+(category.id==='emergency'?' emergency':'');
    category.groups.forEach(function(group,gi){
      var key=category.id+'-'+gi; var stats={done:0,total:group.items.length};
      group.items.forEach(function(_,ii){if(state.checked[itemId(category.id,gi,ii)])stats.done++;});
      var section=document.createElement('section'); section.className='check-group'+(state.open[key]||gi===0?' open':'');
      var head=document.createElement('button'); head.type='button'; head.className='group-head';
      head.innerHTML='<strong>'+group.title+'</strong><span class="count">'+stats.done+' / '+stats.total+'</span><span class="chevron">›</span>';
      head.addEventListener('click',function(){state.open[key]=!section.classList.contains('open');section.classList.toggle('open');saveState();});
      section.appendChild(head);
      if(group.warning){var warning=document.createElement('p');warning.className='group-warning';warning.textContent='注意：'+group.warning;section.appendChild(warning);}
      var items=document.createElement('div');items.className='items';
      group.items.forEach(function(item,ii){
        var id=itemId(category.id,gi,ii); var b=document.createElement('button');b.type='button';b.className='check-item'+(state.checked[id]?' done':'');b.setAttribute('aria-pressed',String(!!state.checked[id]));
        b.innerHTML='<span class="box">'+(state.checked[id]?'✓':'')+'</span><span class="seq">'+item[0]+'</span><span class="item-name">'+item[1]+'</span><span class="item-action">'+item[2]+'</span>';
        b.addEventListener('click',function(){state.checked[id]=!state.checked[id];saveState();render();});items.appendChild(b);
      });
      section.appendChild(items);host.appendChild(section);
    });
  }
  function renderProgress(){
    var s=categoryStats(currentCategory());document.getElementById('progressText').textContent=s.done+' / '+s.total;
    document.getElementById('progressBar').style.width=(s.total?s.done/s.total*100:0)+'%';
  }
  function render(){renderTabs();renderGroups();renderProgress();}
  document.getElementById('resetBtn').addEventListener('click',function(){if(confirm('开始新航班将清除全部勾选记录，是否继续？')){state={checked:{},open:{}};saveState();render();}});
  document.getElementById('emergencyJump').addEventListener('click',function(){active='emergency';render();window.scrollTo({top:0,behavior:'smooth'});});
  render();
})();
