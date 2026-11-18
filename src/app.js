import { createClient } from '@supabase/supabase-js';
import { matchesFilters, allowedEmails } from './filters.js';
import { originalEmailUrl } from './email-links.js';
const $ = id => document.getElementById(id);
let client, rows=[], offset=0, more=true, generation=0;
const pageSize=100;
const columns='id,sender_name,sender_email,receiver_email,gmail_message_id,subject,received_at,summary,category,priority,action_needed,created_at';
function clearPrivateView(){generation++;rows=[];offset=0;more=true;$('cards').replaceChildren();$('digest-view').hidden=true;$('login-view').hidden=false;$('sign-out').hidden=true;$('user-name').textContent='';for(const id of ['total','actions','high'])$(id).textContent='0';}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function render(){
  const filtered=rows.filter(row=>matchesFilters(row,{search:$('search').value,category:$('category').value,priority:$('priority').value}));
  $('total').textContent=rows.length;$('actions').textContent=rows.filter(r=>r.action_needed).length;$('high').textContent=rows.filter(r=>r.priority==='High').length;
  $('result-count').textContent=filtered.length;$('cards').replaceChildren();
  const dateFormat=new Intl.DateTimeFormat('en',{month:'short',day:'numeric'});
  for(const row of filtered){
    const card=node('article','card'),top=node('div','card-top'),sender=node('div','sender');
    top.append(node('div','avatar',row.sender_name.trim().slice(0,2).toUpperCase()));sender.append(node('div','sender-name',row.sender_name));top.append(sender);
    const date=node('time','date',dateFormat.format(new Date(row.received_at)));date.dateTime=row.received_at;date.title=new Date(row.received_at).toLocaleString('en');top.append(date);
    const summary=node('p','summary',row.summary);summary.title=row.summary;
    const bottom=node('div','card-bottom');bottom.append(node('span','badge',row.category),node('span',`badge priority ${row.priority}`,`${row.priority} priority`),node('span',`action${row.action_needed?'':' no'}`,row.action_needed?'↗ Action needed':'No action needed'));
    const addresses=node('dl','email-addresses');
    addresses.append(node('dt','','From'),node('dd','',row.sender_email),node('dt','','To'),node('dd','',row.receiver_email||'Not recorded'));
    card.append(top,node('h3','',row.subject),addresses,summary,bottom);
    const originalUrl=originalEmailUrl(row);
    if(originalUrl){
      const original=node('a','original-email','Open original email in Gmail ↗');original.href=originalUrl;original.target='_blank';original.rel='noopener noreferrer';
      original.setAttribute('aria-label',`Open original email in Gmail: ${row.subject} (opens in a new tab)`);
      card.append(original,node('p','gmail-note',"Requires access to the recipient’s Gmail mailbox."));
    }
    $('cards').append(card);
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
    const {data:{user},error}=await client.auth.getUser();if(current!==generation)return;if(error||!user){$('login-status').textContent='Your session has expired. Please sign in again.';return;}
    const {data:member,error:memberError}=await client.from('allowed_users').select('email,full_name,role').eq('email',user.email.toLowerCase()).maybeSingle();
    if(current!==generation)return;if(memberError)throw memberError;
    if(!member){$('login-status').textContent='You do not have access';await client.auth.signOut();return;}
    $('login-view').hidden=true;$('digest-view').hidden=false;$('sign-out').hidden=false;$('user-name').textContent=member.full_name;$('login-status').textContent='';await load(true);
  }catch{if(current===generation)$('login-status').textContent='Could not verify access. Please check your connection and try again.';}
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const email=$('email').value.trim().toLowerCase();
  if(!allowedEmails.includes(email)){$('password').value='';$('login-status').textContent='You do not have access';return;}
  if(!client){$('login-status').textContent='Sign-in is unavailable. Please reload and try again.';return;}
  $('sign-in').disabled=true;$('login-status').textContent='Signing in…';
  try{
    const {data,error}=await client.auth.signInWithPassword({email,password:$('password').value});
    if(error)throw error;
    await showSession(data.session);
  }
  catch(error){$('login-status').textContent=error.code==='invalid_credentials'?'Email or password is incorrect.':error.code==='email_not_confirmed'?'Your email needs to be confirmed. Please contact your administrator.':'Could not sign in. Please try again or contact your administrator.';}
  finally{$('password').value='';$('sign-in').disabled=false;}
});
$('sign-out').addEventListener('click',async()=>{clearPrivateView();await client.auth.signOut();});
$('refresh').addEventListener('click',()=>load(true));$('load-more').addEventListener('click',()=>load());
for(const id of ['search','category','priority'])$(id).addEventListener('input',render);
$('clear').addEventListener('click',()=>{for(const id of ['search','category','priority'])$(id).value='';render();});
try{
  const {url,key}=window.EMAIL_DIGEST_CONFIG||{};if(!url||!key)throw new Error('Missing configuration');
  client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  client.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event))setTimeout(()=>showSession(session),0);});
  const {data:{session},error}=await client.auth.getSession();if(error)throw error;await showSession(session);
}catch{$('login-status').textContent='Sign-in could not start. Please reload or contact your administrator.';}
