import { prefillWeeklyNotes } from './weeklyNotePrefill';
it('preserves saved weeks and includes every matching note in empty weeks chronologically', () => {
  const weeks = Object.fromEntries([1,2,3,4,5].map(i=>[i,{content:i===1?'담당자 작성':'',topics:[]}])) as Record<number,any>;
  const note = (day:string,content:string,phone='0101') => ({elderPhone:phone,visitedAt:`2026-10-${day}T12:00:00+09:00`,type:'phone',content,topics:['social']});
  prefillWeeklyNotes(weeks,[note('10','두 번째'),note('09','첫 번째'),note('03','덮어쓰면 안됨'),note('09','다른 사람','0102')],'0101','2026-10');
  expect(weeks[1].content).toBe('담당자 작성');
  expect(weeks[2].content).toBe('10/9 [전화상담] 첫 번째\n10/10 [전화상담] 두 번째');
  expect(weeks[2].topics).toEqual(['social']);
});
