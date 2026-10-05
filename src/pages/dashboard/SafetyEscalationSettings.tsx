import { useEffect, useState } from 'react';
import { SERVER_URL, authFetch } from '../../utils/api';

const EMPTY = { name: '', phone: '' };

const toEditableSettings = (value: any = {}) => ({
  primary: { name: value.primary?.name || '', phone: value.primary?.phone || '' },
  secondary: { name: value.secondary?.name || '', phone: value.secondary?.phone || '' },
  afterHours: { name: value.afterHours?.name || '', phone: value.afterHours?.phone || '' },
  afterHoursInstructions: value.afterHoursInstructions || '',
  acknowledgeWithinMinutes: value.acknowledgeWithinMinutes ?? 15,
  completeWithinMinutes: value.completeWithinMinutes ?? 60,
});

export default function SafetyEscalationSettings({ me, notify }: any) {
  const [form, setForm] = useState<any>({
    primary: EMPTY, secondary: EMPTY, afterHours: EMPTY, afterHoursInstructions: '',
    acknowledgeWithinMinutes: 15, completeWithinMinutes: 60,
  });
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!me?.safetyEscalation) return;
    setForm(toEditableSettings(me.safetyEscalation));
  }, [me?.safetyEscalation]);

  const setContact = (key: string, field: string, value: string) => {
    setForm((current: any) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  };
  const save = async () => {
    const payload = toEditableSettings(form);
    let error = '';
    for (const key of ['primary', 'secondary', 'afterHours'] as const) {
      const contact = payload[key];
      contact.name = contact.name.trim();
      const digits = contact.phone.replace(/\D/g, '');
      if (!!contact.name !== !!digits) error = '담당자 이름과 전화번호를 함께 입력해 주세요';
      else if (digits && (digits.length < 9 || digits.length > 11)) error = '전화번호를 정확히 입력해 주세요';
      if (error) break;
    }
    if (!error && payload.completeWithinMinutes <= payload.acknowledgeWithinMinutes) error = '완료 기한은 조치 시작 기한보다 길어야 합니다';
    setValidationError(error);
    if (error) return;
    setSaving(true);
    try {
      // /me 응답에는 updatedAt/updatedBy 같은 읽기 전용 메타데이터가 포함될 수 있다.
      // 서버 요청 스키마는 strict이므로 편집 가능한 필드만 전송한다.
      const response = await authFetch(`${SERVER_URL}/org/safety-escalation-settings`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { notify?.(data?.error?.message || '안전 대응 연락망을 저장하지 못했습니다'); return; }
      if (!data.safetyEscalation) throw new Error('invalid response');
      setForm(toEditableSettings(data.safetyEscalation));
      notify?.('안전 대응 연락망을 저장했습니다.', 'success');
    } catch { notify?.('네트워크 오류로 안전 대응 연락망을 저장하지 못했습니다'); }
    finally { setSaving(false); }
  };

  return <div className="section" style={{marginBottom:16}}>
    <div className="section-title">안전 대응 연락망</div>
    <p style={{fontSize:15,color:'#64748b',margin:'0 0 14px'}}>위험 알림을 놓치지 않도록 1차 담당자와 이관 연락처를 등록하세요. 시스템은 연락 사실을 자동으로 간주하지 않으며, 담당자가 연락 후 이관 기록을 남깁니다.</p>
    <div className="form-grid">
      {[['primary','1차 담당자'],['secondary','2차 담당자'],['afterHours','야간·휴일 담당자']].map(([key,label]) => <div key={key} style={{display:'grid',gridTemplateColumns:'1fr 1.3fr',gap:8}}>
        <div className="form-field"><label className="form-label">{label} 이름</label><input className="form-input" value={form[key]?.name||''} onChange={e=>setContact(key,'name',e.target.value)} maxLength={60}/></div>
        <div className="form-field"><label className="form-label">{label} 전화번호</label><input className="form-input" inputMode="tel" value={form[key]?.phone||''} onChange={e=>setContact(key,'phone',e.target.value.replace(/[^0-9-]/g,''))} maxLength={20} placeholder="01012345678"/></div>
      </div>)}
      <div className="form-field"><label className="form-label">조치 시작 기한</label><select className="form-input" value={form.acknowledgeWithinMinutes} onChange={e=>setForm({...form,acknowledgeWithinMinutes:Number(e.target.value)})}><option value={10}>10분</option><option value={15}>15분</option><option value={30}>30분</option></select></div>
      <div className="form-field"><label className="form-label">조치 완료 기한</label><select className="form-input" value={form.completeWithinMinutes} onChange={e=>setForm({...form,completeWithinMinutes:Number(e.target.value)})}><option value={30}>30분</option><option value={60}>60분</option><option value={120}>2시간</option><option value={240}>4시간</option></select></div>
      <div className="form-field" style={{gridColumn:'1 / -1'}}><label className="form-label">야간·휴일 대응 지침</label><textarea className="form-input" rows={3} maxLength={300} value={form.afterHoursInstructions||''} onChange={e=>setForm({...form,afterHoursInstructions:e.target.value})} placeholder="예: 18시 이후에는 당직자에게 우선 연락하고, 응답이 없으면 센터장에게 이관"/></div>
    </div>
    {validationError&&<p className="error-msg" role="alert">{validationError}</p>}
    <button className="btn-primary" disabled={saving} onClick={save} style={{marginTop:12}}>{saving?'저장 중…':'연락망 저장'}</button>
  </div>;
}
