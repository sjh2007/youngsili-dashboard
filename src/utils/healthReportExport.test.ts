import { healthReportRows } from './healthReportExport';
const report:any={from:'2026-10-01',to:'2026-10-03',elderId:'e1',coverage:{complete:true,limit:1000,reason:null,omittedSources:0},
  observations:[{observationId:'o1',topic:'sleep',value:'absent',subject:'self',temporality:'current',validationStatus:'valid',observedAt:'2026-10-01T23:00:00Z',sourceId:'c1',excerpt:'오늘 잘 잤어요',line:3}],
  cases:[{caseId:'case1',topic:'sleep',state:'reviewing',recoveryStatus:'reported',recoveryReportedAt:'2026-10-01T23:00:00Z',latestObservedAt:'2026-10-01T01:00:00Z',evidenceCount:2,reviewNote:'확인 예정',reviewedBy:'staff',updatedAt:'2026-10-02T00:00:00Z'}]};
it('keeps recovery report and staff completion separate, uses KST and original evidence',()=>{
  const rows=healthReportRows(report,'가상 어르신');
  expect(rows.담당자조치[1][2]).toBe('확인 중');
  expect(rows.담당자조치[1][3]).toBe('회복 보고 있음');
  expect(rows.통화관찰[1]).toContain('오늘 잘 잤어요');
  expect(rows.통화관찰[1][6]).toContain('2026. 10. 2.');
  expect(rows.안내.flat().join(' ')).toContain('앱 자가체크');
});
it.each(['record_limit','source_unavailable'])('refuses incomplete %s reports instead of silently dropping rows',reason=>{
  expect(()=>healthReportRows({...report,coverage:{...report.coverage,complete:false,reason}},'테스트')).toThrow('일부 자료');
});
