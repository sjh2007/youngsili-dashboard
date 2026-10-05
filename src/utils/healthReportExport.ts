import { type z } from 'zod';
import { HealthInsightReportSchema } from '../schemas';

type HealthReport = z.infer<typeof HealthInsightReportSchema>;
const topics:Record<string,string>={meal:'식사',sleep:'수면',activity:'활동',discomfort:'불편 사항'};
const states:Record<string,string>={unreviewed:'미확인',reviewing:'확인 중',resolved:'담당자 조치 완료',corrected:'근거 정정',dismissed:'검토 제외'};
const values:Record<string,string>={present:'불편 있음',absent:'불편 없음 응답',unclear:'불명확',not_asked:'미질문',recognition_failed:'인식 실패'};
const time=(value:unknown)=>typeof value==='string'&&Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'';

export function healthReportRows(report:HealthReport,name:string) {
  if(!report.coverage.complete)throw new Error(`${report.coverage.reason==='record_limit'?'보관 자료가 많아 전체 건강 보고서를 생성할 수 없습니다. 관리자에게 문의해 주세요.':'통화 원본을 확인하지 못해 건강 보고서 전체 자료를 확보하지 못했습니다.'} 일부 자료를 전체 보고서로 내려받지 않습니다.`);
  return {
    안내:[['건강 변화 확인 보고서'],['어르신',name],['조회 기간 (한국시간)',`${report.from} ~ ${report.to}`],['자료 범위','선택 기간의 통화 관찰 및 관련 담당자 확인 기록'],['구분','통화의 회복 보고는 담당자 조치 완료와 별개입니다. 앱 자가체크는 이 보고서에 합산하지 않습니다.'],['판단 기준','개인 변화 판단은 최근 7일과 이전 23일 비교이며, 조회 기간 통계와 다릅니다. 의료 진단이 아닙니다.'],['관찰 건수',report.observations.length],['담당자 확인 기록',report.cases.length]],
    통화관찰:[['관찰 ID','항목','응답','대상','시점','근거 상태','통화 시각 (한국시간)','통화 ID','원문 줄','원문 근거','정정·제외 이유'],...report.observations.map(o=>[o.observationId,topics[o.topic]||o.topic,values[o.value]||o.value,({self:'본인',other:'타인',unknown:'불명확'}[o.subject]||o.subject),({current:'현재',past:'과거',unknown:'불명확'}[o.temporality]||o.temporality),o.validationStatus==='invalid'?'정정·제외':o.validationStatus,time(o.observedAt),o.sourceId,o.line,o.excerpt,o.invalidationReason||''])],
    담당자조치:[['확인 건 ID','항목','담당자 처리 상태','통화 회복 보고','회복 보고 시각 (한국시간)','마지막 문제 근거 시각 (한국시간)','근거 수','조치 기록','확인 담당자','확인 시각 (한국시간)'],...report.cases.map(c=>[c.caseId,topics[c.topic]||c.topic,states[c.state]||c.state,c.recoveryStatus==='reported'?'회복 보고 있음':'회복 보고 없음',time(c.recoveryReportedAt),time(c.latestObservedAt),c.evidenceCount,typeof c.reviewNote==='string'?c.reviewNote:'',typeof c.reviewedBy==='string'?c.reviewedBy:'',time(c.updatedAt)])],
  };
}

export async function exportHealthReport(report:HealthReport,name:string) {
  const rows=healthReportRows(report,name);
  const XLSX=await import('xlsx');
  const workbook=XLSX.utils.book_new();
  Object.entries(rows).forEach(([sheet,values])=>{
    const worksheet=XLSX.utils.aoa_to_sheet(values);
    worksheet['!cols']=values[0].map(()=>({wch:26}));
    XLSX.utils.book_append_sheet(workbook,worksheet,sheet);
  });
  // No elder identifiers in filenames; cell strings remain strings (never formula objects).
  XLSX.writeFile(workbook,`영실이_건강변화보고서_${report.from}_${report.to}.xlsx`);
}
