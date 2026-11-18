import { createClient } from '@supabase/supabase-js';
import { matchesFilters, allowedEmails } from './filters.js';
const $ = id => document.getElementById(id);
let client, rows=[], offset=0, more=true, generation=0;
const pageSize=100;
const columns='id,sender_name,sender_email,subject,received_at,summary,category,priority,action_needed,created_at';
function clearPrivateView(){generation++;rows=[];offset=0;more=true;$('cards').replaceChildren();$('digest-view').hidden=true;$('login-view').hidden=false;$('sign-out').hidden=true;$('user-name').textContent='';for(const id of ['total','actions','high'])$(id).textContent='0';}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function render(){
  const filtered=rows.filter(row=>matchesFilters(row,{search:$('search').value,category:$('category').value,priority:$('priority').value}));
  $('total').textContent=rows.length;$('actions').textContent=rows.filter(r=>r.action_needed).length;$('high').textContent=rows.filter(r=>r.priority==='High').length;
  $('result-count').textContent=filtered.length;$('cards').replaceChildren();
  const dateFormat=new Intl.DateTimeFormat('en',{month:'short',day:'numeric'});
  for(const row of filtered){
    const card=node('article','card'),top=node('div','card-top'),sender=node('div','sender');
    top.append(node('div','avatar',row.sender_name.trim().slice(0,2).toUpperCase()));sender.append(node('div','sender-name',row.sender_name),node('div','sender-email',row.sender_email));top.append(sender);
    const date=node('time','date',dateFormat.format(new Date(row.received_at)));date.dateTime=row.received_at;date.title=new Date(row.received_at).toLocaleString('en');top.append(date);
    const summary=node('p','summary',row.summary);summary.title=row.summary;
    const bottom=node('div','card-bottom');bottom.append(node('span','badge',row.category),node('span',`badge priority ${row.priority}`,`${row.priority} priority`),node('span',`action${row.action_needed?'':' no'}`,row.action_needed?'↗ Action needed':'No action needed'));
    card.append(top,node('h3','',row.subject),summary,bottom);$('cards').append(card);
  }
  $('digest-status').textContent=filtered.length?'':rows.length?'No summaries match your filters.':'No summaries yet. Inbox summaries will appear here after an import.';
  $('load-more').hidden=!more;
}
async function load(reset=false){
  const current=generation;$('refresh').disabled=true;$('load-more').disabled=true;$('digest-status').textContent='Loading summaries…';
  if(reset){rows=[];offset=0;$('cards').replaceChildren();}
  try{
    const {data:member,error:memberError}=await client.from('allowed_users').select('email').maybeSingle();
    if(current!==generation)return;if(memberError)throw memberError;if(!member){clearPrivateView();$('login-status').textContent='You do not have access';return;}
    const {data,error}=await client.from('email_summaries').select(columns).order('received_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+pageSize-1);
    if(current!==generation)return;if(error)throw error;rows.push(...data);offset+=data.length;more=data.length===pageSize;render();
  }catch{if(current===generation)$('digest-status').textContent='Could not load summaries. Check your connection and try Refresh summaries.';}
  finally{if(current===generation){$('refresh').disabled=false;$('load-more').disabled=false;}}
}
async function showSession(session){
  clearPrivateView();if(!session)return;const current=generation;
  try{
    const {data:{user},error}=await client.auth.getUser();if(current!==generation)return;if(error||!user){$('login-status').textContent='Your sign-in link or session has expired. Please request a new link.';return;}
    const {data:member,error:memberError}=await client.from('allowed_users').select('email,full_name,role').eq('email',user.email.toLowerCase()).maybeSingle();
    if(current!==generation)return;if(memberError)throw memberError;
    if(!member){$('login-status').textContent='You do not have access';await client.auth.signOut();return;}
    $('login-view').hidden=true;$('digest-view').hidden=false;$('sign-out').hidden=false;$('user-name').textContent=member.full_name;$('login-status').textContent='';await load(true);
  }catch{if(current===generation)$('login-status').textContent='Could not verify access. Please check your connection and try again.';}
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const email=$('email').value.trim().toLowerCase();
  if(!allowedEmails.includes(email)){$('login-status').textContent='You do not have access';return;}
  if(!client){$('login-status').textContent='Sign-in is unavailable. Please reload and try again.';return;}
  $('send-link').disabled=true;$('login-status').textContent='Sending your sign-in link…';
  try{const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+'/'}});if(error)throw error;$('login-status').textContent='Check your email for a secure sign-in link. Open it to enter Email Digest.';}
  catch{$('login-status').textContent='Could not send the sign-in link. Please try again later or contact your administrator.';}
  finally{$('send-link').disabled=false;}
});
$('sign-out').addEventListener('click',async()=>{clearPrivateView();await client.auth.signOut();});
$('refresh').addEventListener('click',()=>load(true));$('load-more').addEventListener('click',()=>load());
for(const id of ['search','category','priority'])$(id).addEventListener('input',render);
$('clear').addEventListener('click',()=>{for(const id of ['search','category','priority'])$(id).value='';render();});
try{
  const {url,key}=window.EMAIL_DIGEST_CONFIG||{};if(!url||!key)throw new Error('Missing configuration');
  client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event))setTimeout(()=>showSession(session),0);});
  const {data:{session},error}=await client.auth.getSession();if(error)throw error;await showSession(session);
  if(window.location.hash.includes('error')){$('login-status').textContent='Your sign-in link is invalid or expired. Please request a new link.';history.replaceState(null,'','/');}
}catch{$('login-status').textContent='Sign-in could not start. Please reload or contact your administrator.';}
