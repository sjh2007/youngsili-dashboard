import { fireEvent, render, screen } from '@testing-library/react';
import NoteModal from './NoteModal';
const form={id:'n1',elderPhone:'01000000000',elderName:'가상어르신',type:'phone',category:'health',topics:[],visitedDate:'2026-10-02',visitedTime:'18:30',content:'확인한 내용',action:'',autoDraft:true};
const props=()=>({noteForm:form,setNoteModal:jest.fn(),setNoteForm:jest.fn(),elders:[{phone:form.elderPhone,name:form.elderName}],CASE_TYPE_META:{phone:{label:'전화상담'}},CASE_CAT_META:{health:'건강'},CASE_TOPIC_META:{},TIME_OPTS:['18:30'],fmtTimeK:(s:string)=>s,copyNote:jest.fn(),saveNote:jest.fn(),noteSaving:false});
it('저장과 저장 후 PDF를 별도 의도로 호출한다',()=>{
  const p=props(); render(<NoteModal {...p}/>);
  fireEvent.click(screen.getByRole('button',{name:'확인 완료 저장'}));
  fireEvent.click(screen.getByRole('button',{name:'저장 후 PDF'}));
  expect(p.saveNote.mock.calls).toEqual([[false],[true]]);
  expect(screen.getByRole('combobox',{name:'어르신'})).toBeDisabled();
});
it('저장 실패 안내와 작성 내용을 유지한다',()=>{
  render(<NoteModal {...props()} noteError="다른 담당자가 수정했습니다. 다시 조회해 주세요."/>);
  expect(screen.getByRole('alert')).toHaveTextContent('다른 담당자');
  expect(screen.getByDisplayValue('확인한 내용')).toBeInTheDocument();
});
it('저장 중 중복 저장과 창 닫기를 차단한다',()=>{
  const p=props(); render(<NoteModal {...p} noteSaving/>);
  expect(screen.getByRole('button',{name:'저장 후 PDF'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'취소'})).toBeDisabled();
  fireEvent.click(screen.getByRole('dialog').parentElement!);
  expect(p.setNoteModal).not.toHaveBeenCalled();
});
