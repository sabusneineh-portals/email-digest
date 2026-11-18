import test from 'node:test';
import assert from 'node:assert/strict';
import { originalEmailUrl } from '../src/email-links.js';
import { matchesFilters } from '../src/filters.js';
test('original message opens Gmail for the recipient mailbox',()=>{
  const url=new URL(originalEmailUrl({receiver_email:'recipient@example.com',gmail_message_id:'1a1edfea77583e20'}));
  assert.equal(url.origin,'https://mail.google.com');
  assert.equal(url.searchParams.get('authuser'),'recipient@example.com');
  assert.equal(url.hash,'#all/1a1edfea77583e20');
});
test('missing or unsafe references do not create original-message links',()=>{
  for(const gmail_message_id of [null,'','https://evil.example','../message'])assert.equal(originalEmailUrl({receiver_email:'recipient@example.com',gmail_message_id}),null);
  assert.equal(originalEmailUrl({gmail_message_id:'1a1edfea77583e20'}),null);
});
test('receiver addresses are searchable',()=>{
  assert.equal(matchesFilters({receiver_email:'recipient@example.com'},{search:'RECIPIENT@EXAMPLE.COM'}),true);
});
