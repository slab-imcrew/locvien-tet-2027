const products=[...document.querySelectorAll('.product-card')];
const filters=[...document.querySelectorAll('.filter')];
const needs=[...document.querySelectorAll('.need-card')];
const count=document.querySelector('.result-count');
const empty=document.querySelector('.empty-state');
let activeBudget='all',activeAudience='all';

filters.forEach(button=>button.setAttribute('aria-pressed',button.classList.contains('active')));
needs.forEach(button=>button.setAttribute('aria-pressed','false'));

function applyFilters(){
  let visible=0;
  products.forEach(card=>{
    const budgetMatch=activeBudget==='all'||card.dataset.budget===activeBudget;
    const audienceMatch=activeAudience==='all'||card.dataset.audience.split(' ').includes(activeAudience);
    card.hidden=!(budgetMatch&&audienceMatch);
    if(!card.hidden)visible++;
  });
  count.textContent=`Đang hiển thị ${visible} bộ quà${activeAudience!=='all'?' phù hợp nhu cầu':''}`;
  empty.hidden=visible!==0;
}

filters.forEach(button=>button.addEventListener('click',()=>{
  filters.forEach(item=>item.classList.remove('active'));
  filters.forEach(item=>item.setAttribute('aria-pressed','false'));
  button.classList.add('active');button.setAttribute('aria-pressed','true');activeBudget=button.dataset.budget;applyFilters();
}));

needs.forEach(button=>button.addEventListener('click',()=>{
  const already=button.classList.contains('selected');
  needs.forEach(item=>item.classList.remove('selected'));
  needs.forEach(item=>item.setAttribute('aria-pressed','false'));
  activeAudience=already?'all':button.dataset.audience;
  if(!already){button.classList.add('selected');button.setAttribute('aria-pressed','true');}
  applyFilters();document.querySelector('#bo-suu-tap').scrollIntoView({behavior:'smooth'});
}));

document.querySelectorAll('.process-tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.process-tab').forEach(item=>item.classList.remove('active'));
  document.querySelectorAll('.flow').forEach(item=>item.classList.remove('active'));
  tab.classList.add('active');
  document.querySelector(tab.dataset.flow==='personal'?'.flow.personal':'.business-flow').classList.add('active');
}));

const toast=document.querySelector('.toast');
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000)}
document.querySelectorAll('.order-btn').forEach(button=>button.addEventListener('click',()=>{
  showToast(`Đã chọn set ${button.dataset.product}. Lộc Viên sẽ hỗ trợ bạn ở bước tiếp theo.`);
  document.querySelector('#bao-gia').scrollIntoView({behavior:'smooth'});
}));
document.querySelector('#personal-order').addEventListener('click',()=>document.querySelector('#bo-suu-tap').scrollIntoView({behavior:'smooth'}));
document.querySelector('#business-form').addEventListener('submit',event=>{
  event.preventDefault();
  if(!event.currentTarget.reportValidity())return;
  event.currentTarget.querySelector('.form-success').hidden=false;
  event.currentTarget.querySelector('.submit-btn').textContent='Đã gửi yêu cầu';
});
