// References contain no email body or Gmail credentials.
export function originalEmailUrl(row) {
  if (!/^[0-9a-f]{10,32}$/.test(row.gmail_message_id || '') || !row.receiver_email) return null;
  const url = new URL('https://mail.google.com/mail/u/');
  url.searchParams.set('authuser', row.receiver_email);
  url.hash = `all/${row.gmail_message_id}`;
  return url.href;
}
