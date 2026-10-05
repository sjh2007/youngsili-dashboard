import { noteDateKst, printSavedCaseNote, reserveNotePrintWindow } from './caseNoteExport';

function printTarget() {
  const doc = document.implementation.createHTMLDocument('');
  return { document: doc, closed: false, print: jest.fn() } as unknown as Window;
}

it('escapes all note text, prints only on explicit click and labels drafts', () => {
  const target = printTarget();
  printSavedCaseNote({ id: '<id>', elderName: '<img src=x onerror=alert(1)>', content: '<script>alert(1)</script>', action: 'A&B', source: 'auto-call', visitedAt: '2026-10-01T23:00:00Z' }, target);
  expect(target.document.querySelectorAll('script,img,iframe,link').length).toBe(0);
  expect(target.document.body.textContent).toContain('<script>alert(1)</script>');
  expect(target.document.body.textContent).toContain('자동기록 초안');
  expect(target.document.body.textContent).toContain('2026. 10. 2.');
  expect(target.print).not.toHaveBeenCalled();
  target.document.getElementById('print-note')!.click();
  expect(target.print).toHaveBeenCalledTimes(1);
});

it('rejects unsaved records and closed windows and reports popup blocking', () => {
  expect(() => printSavedCaseNote({ id: '' }, printTarget())).toThrow('저장된 일지');
  expect(() => printSavedCaseNote({ id: 'saved' }, { closed: true } as Window)).toThrow('닫혔습니다');
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  expect(() => reserveNotePrintWindow()).toThrow('차단');
  open.mockRestore();
});

it('uses KST day boundaries and does not invent missing confirmation metadata', () => {
  expect(noteDateKst('2026-10-01T23:00:00Z')).toBe('2026-10-02');
  expect(noteDateKst('invalid')).toBe('');
  const target = printTarget();
  printSavedCaseNote({ id: 'saved', status: 'confirmed', authorEmail: 'worker@example.test', content: 'saved content' }, target);
  expect(target.document.body.textContent).toContain('확인 완료 일지');
  expect(target.document.body.textContent).toContain('기록 없음');
  expect(target.document.querySelector('style')?.textContent).toContain('size:A4');
});
