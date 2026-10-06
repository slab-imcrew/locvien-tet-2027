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

// Live lead capture + QR payment flow
const liveLeadForm=document.querySelector('#business-form');
const liveSubmit=liveLeadForm.querySelector('.submit-btn');
const liveSuccess=liveLeadForm.querySelector('.form-success');
const paymentBox=liveLeadForm.querySelector('.payment-box');
const paymentMessage=liveLeadForm.querySelector('.payment-message');
const paymentQr=liveLeadForm.querySelector('.payment-qr');
const paymentDetails=liveLeadForm.querySelector('.payment-details');
let latestPaymentDescription='';

liveLeadForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!liveLeadForm.reportValidity())return;
  liveSubmit.disabled=true;liveSubmit.textContent='Đang ghi nhận...';
  const formData=new FormData(liveLeadForm);
  const payload=Object.fromEntries(formData.entries());
  try{
    const response=await fetch('/api/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Không thể lưu thông tin.');
    liveSuccess.hidden=false;paymentMessage.textContent='Bạn có thể quét mã QR dưới đây để chuyển khoản 100.000đ.';
    paymentBox.hidden=false;paymentQr.src=data.payment.qrUrl;paymentDetails.textContent=`ACB · ${data.payment.account} · ${data.payment.amount.toLocaleString('vi-VN')}đ · ${data.payment.description}`;
    latestPaymentDescription=data.payment.description;liveSubmit.textContent='Đã ghi nhận yêu cầu';
  }catch(error){showToast(error.message);liveSubmit.disabled=false;liveSubmit.textContent='Gửi yêu cầu báo giá';}
});

document.querySelector('.copy-payment')?.addEventListener('click',async()=>{
  await navigator.clipboard?.writeText(latestPaymentDescription);showToast('Đã sao chép nội dung chuyển khoản.');
});

// Lightweight admin view protected by the Worker-issued session token.
const adminDialog=document.querySelector('#admin-dialog');
const adminLaunch=document.querySelector('#admin-launch');
const adminClose=document.querySelector('#admin-close');
const adminLogin=document.querySelector('#admin-login');
const adminContent=document.querySelector('#admin-content');
const adminLoginForm=document.querySelector('#admin-login-form');
const adminLoginError=document.querySelector('#admin-login-error');
const adminRows=document.querySelector('#admin-leads');
const adminCount=document.querySelector('#admin-count');
let adminToken=sessionStorage.getItem('locvien_admin_token')||'';
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function renderLeads(leads){
  adminCount.textContent=`${leads.length} yêu cầu gần nhất`;
  adminRows.innerHTML=leads.length?leads.map(lead=>`<tr><td>${new Date(lead.created_at).toLocaleString('vi-VN')}</td><td><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.quantity||'')}</small></td><td>${escapeHtml(lead.company)}<small>${escapeHtml(lead.budget||'')}</small></td><td>${escapeHtml(lead.phone)}</td><td><strong>${Number(lead.amount).toLocaleString('vi-VN')}đ</strong><small>${escapeHtml(lead.payment_description)}</small></td></tr>`).join(''):'<tr><td colspan="5">Chưa có yêu cầu nào.</td></tr>';
}
async function loadLeads(){
  const response=await fetch('/api/admin/leads',{headers:{authorization:`Bearer ${adminToken}`}});
  if(response.status===401){sessionStorage.removeItem('locvien_admin_token');adminToken='';adminLogin.hidden=false;adminContent.hidden=true;return;}
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Không thể tải danh sách.');renderLeads(data.leads||[]);
}
adminLaunch.addEventListener('click',async()=>{adminDialog.showModal();if(adminToken){adminLogin.hidden=true;adminContent.hidden=false;try{await loadLeads();}catch(error){showToast(error.message);}}});
adminClose.addEventListener('click',()=>adminDialog.close());
adminDialog.addEventListener('click',event=>{if(event.target===adminDialog)adminDialog.close();});
adminLoginForm.addEventListener('submit',async event=>{event.preventDefault();adminLoginError.textContent='';const password=document.querySelector('#admin-password').value;const response=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});const data=await response.json();if(!response.ok){adminLoginError.textContent=data.error||'Đăng nhập thất bại.';return;}adminToken=data.token;sessionStorage.setItem('locvien_admin_token',adminToken);adminLogin.hidden=true;adminContent.hidden=false;await loadLeads();});
document.querySelector('#admin-refresh').addEventListener('click',()=>loadLeads().catch(error=>showToast(error.message)));
