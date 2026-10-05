import { fireEvent, render, screen } from '@testing-library/react';
import HealthEvidenceCorrection from './HealthEvidenceCorrection';
const detail:any = {caseId:'c1',revision:1,evidence:[
  {observationId:'o1',excerpt:'잠을 못 자요',line:2,observedAt:'2026-10-02T01:00:00Z'},
  {observationId:'o2',excerpt:'밤새 깼어요',line:4,observedAt:'2026-10-02T01:00:00Z'},
]};
it('requires selected evidence and a reason, sends only selected original IDs',async()=>{
  const onSave=jest.fn().mockResolvedValue(false);
  render(<HealthEvidenceCorrection detail={detail} busy={false} onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button',{name:'근거 정정·제외'}));
  fireEvent.click(screen.getByRole('button',{name:'선택 근거 정정·제외 저장'}));
  expect(screen.getByRole('alert')).toHaveTextContent('근거를 선택');
  fireEvent.click(screen.getByLabelText(/잠을 못 자요/));
  fireEvent.click(screen.getByRole('button',{name:'선택 근거 정정·제외 저장'}));
  expect(screen.getByRole('alert')).toHaveTextContent('이유를 입력');
  fireEvent.change(screen.getByLabelText('정정·제외 이유 (필수)'),{target:{value:'타인의 과거 이야기'}});
  fireEvent.click(screen.getByRole('button',{name:'선택 근거 정정·제외 저장'}));
  expect(onSave).toHaveBeenCalledWith('corrected',['o1'],'타인의 과거 이야기');
  expect(screen.getByLabelText('정정·제외 이유 (필수)')).toHaveValue('타인의 과거 이야기');
});
it('does not offer unknown IDs from older evidence responses',()=>{
  render(<HealthEvidenceCorrection detail={{...detail,evidence:[{excerpt:'unknown',line:1}]}} busy={false} onSave={jest.fn()}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
