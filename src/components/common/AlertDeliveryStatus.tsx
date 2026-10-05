import { Call } from '../../schemas';

const reasons: Record<string, string> = {
  audio_generation_failed: '경보 음성을 만들지 못했습니다.',
  playback_unconfirmed: '경보 음성이 끝까지 재생됐는지 확인하지 못했습니다.',
  interrupted: '경보 재생 중 통화가 종료되거나 중단됐습니다.',
  unsupported_engine: '이 통화 경로에서는 경보 재생 완료를 확인할 수 없습니다.',
};

/** Connection success and risk analysis are independent of alert playback evidence. */
export default function AlertDeliveryStatus({ call }: { call: Partial<Call> }) {
  const result = call.alertDelivery;
  if (!result && call.isAlert !== true && (!call.alertType || call.alertType === 'none')) return null;
  const completed = result?.status === 'completed';
  const failed = result?.status === 'failed';
  const label = completed ? '경보 재생 완료' : failed ? '경보 전달 실패' : '경보 재생 확인 안 됨';
  const detail = completed
    ? '경보 음성의 재생 완료를 확인했습니다. 청취·이해 여부는 별도 확인이 필요합니다.'
    : failed
      ? `${reasons[result.reason] || '경보 재생을 완료하지 못했습니다.'} 담당자가 연락 여부를 확인해 주세요.`
      : '재생 완료 기록이 없습니다. 통화 연결만으로 경보 전달을 확인할 수 없습니다.';
  return <div style={{flexBasis:'100%',padding:'10px 12px',borderRadius:8,background:completed?'#f0fdf4':'#fff7ed',color:completed?'#166534':'#9a3412'}}>
    <strong>{label}</strong>
    <span style={{display:'block',fontSize:15,marginTop:4}}>{detail}</span>
  </div>;
}
