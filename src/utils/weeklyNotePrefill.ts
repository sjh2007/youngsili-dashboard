export function prefillWeeklyNotes(weeks: Record<number, any>, notes: any[], phone: string, ym: string) {
  const [year, month] = ym.split('-').map(Number);
  const typeLabels = {visit:'가정방문',phone:'전화상담',office:'내소상담',guardian:'보호자상담',etc:'기타'};
  notes.filter(n => {
    const d = new Date(n.visitedAt);
    return String(n.elderPhone || '').replace(/\D/g, '') === phone &&
      d.getFullYear() === year && d.getMonth() + 1 === month;
  }).sort((a,b) => (a.visitedAt || '').localeCompare(b.visitedAt || '')).forEach(n => {
    const day = new Date(n.visitedAt).getDate();
    const week = weeks[Math.min(5, Math.floor((day - 1) / 7) + 1)];
    if (week.content && !week._fromNotes) return;
    week._fromNotes = true;
    week.content = `${week.content ? week.content + '\n' : ''}${month}/${day} [${typeLabels[n.type] || '기타'}] ${n.content}${n.action ? `\n  → 조치: ${n.action}` : ''}`;
    week.topics = [...new Set([...(week.topics || []), ...(n.topics || [])])];
  });
}
