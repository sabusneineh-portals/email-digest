export function matchesFilters(row, {search='', category='', priority=''}) {
  const text = [row.sender_name,row.sender_email,row.receiver_email,row.subject,row.summary].join(' ').toLowerCase();
  return (!category || row.category===category) && (!priority || row.priority===priority) && text.includes(search.trim().toLowerCase());
}
export const allowedEmails = ['s.abusneineh@xpandpros.com','n.mahmoud@xpandpros.com','malek@xpandpros.com','m.ali@xpandpros.com'];
