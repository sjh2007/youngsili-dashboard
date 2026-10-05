import { fireEvent, render, screen } from '@testing-library/react';
import CasenotesPage from './CasenotesPage';
jest.mock('./WorkMemosPanel', () => () => <div>업무 메모</div>);

const notes = [
  { id: 'a', elderName: '가', elderPhone: '1', type: 'phone', visitedAt: '2026-10-01T23:00:00Z', content: 'saved' },
  { id: 'b', elderName: '가', elderPhone: '1', type: 'phone', visitedAt: '2026-10-01T01:00:00Z', source: 'auto-call', status: 'draft' },
  { id: 'c', elderName: '나', elderPhone: '2', type: 'visit', visitedAt: '2026-09-29T01:00:00Z' },
];
const props = () => ({
  T: { elder: '어르신' }, caseSearch: '가', setCaseSearch: jest.fn(), caseType: 'all', setCaseType: jest.fn(),
  caseFollowUpOnly: false, setCaseFollowUpOnly: jest.fn(), caseNotes: notes, caseLoading: false,
  isAutoDraft: n => n.source === 'auto-call' && n.status !== 'confirmed',
  nameByPhone: (_phone, name) => name, selectedNotes: new Set(['a', 'b', 'c']), setSelectedNotes: jest.fn(),
  expandedNoteDays: new Set(), setExpandedNoteDays: jest.fn(), formatDateHeader: d => d,
  CASE_TYPE_META: { phone: {label:'전화'}, visit: {label:'방문'}, etc: {label:'기타'} }, CASE_CAT_META: {}, CASE_TOPIC_META: {},
  AutoDraftBadge: () => <span>초안</span>, exportNotesXlsx: jest.fn(), printNote: jest.fn(),
});

it('exports only filtered selected saved notes, never hidden selections; drafts require opt-in', () => {
  const p = props(); render(<CasenotesPage {...p}/>);
  fireEvent.click(screen.getByRole('button', {name:'선택 일지 엑셀'}));
  expect(p.exportNotesXlsx).toHaveBeenLastCalledWith([notes[0]]);
  expect(screen.getByTestId('filtered-export-summary')).toHaveTextContent('1건 · 1명 · 상담일 2026-10-02 ~ 2026-10-02');
  fireEvent.click(screen.getByLabelText('다운로드에 미확인 자동 초안 포함'));
  fireEvent.click(screen.getByRole('button', {name:'조회 결과 엑셀'}));
  expect(p.exportNotesXlsx).toHaveBeenLastCalledWith([notes[0], notes[1]]);
  fireEvent.click(screen.getByRole('button', {name:'선택 일지 엑셀'}));
  expect(p.exportNotesXlsx).toHaveBeenLastCalledWith([notes[0], notes[1]]);
});

it('disables empty export and passes saved note to per-note print', () => {
  const p = props(); const { rerender } = render(<CasenotesPage {...p}/>);
  fireEvent.click(screen.getAllByRole('button', {name:'PDF·인쇄'})[0]);
  expect(p.printNote).toHaveBeenCalledWith(notes[0]);
  rerender(<CasenotesPage {...p} caseSearch="없는 이름"/>);
  expect(screen.getByRole('button', {name:'조회 결과 엑셀'})).toBeDisabled();
  expect(screen.getByRole('button', {name:'선택 일지 엑셀'})).toBeDisabled();
});

it('disables exports on load failure while retaining records and offers retry', () => {
  const p = props(); const retry = jest.fn();
  render(<CasenotesPage {...p} caseError="목록 불러오기 실패" reloadNotes={retry}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('최신 상태가 아닐 수 있습니다');
  expect(screen.getByText('saved')).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'조회 결과 엑셀'})).toBeDisabled();
  expect(screen.getByRole('button', {name:'선택 일지 엑셀'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name:'일지 다시 불러오기'}));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('does not enable selected export for only hidden selections or excluded drafts', () => {
  const p = props(); const { rerender } = render(<CasenotesPage {...p} selectedNotes={new Set(['c'])}/>);
  expect(screen.getByRole('button', {name:'선택 일지 엑셀'})).toBeDisabled();
  rerender(<CasenotesPage {...p} selectedNotes={new Set(['b'])}/>);
  expect(screen.getByRole('button', {name:'선택 일지 엑셀'})).toBeDisabled();
  fireEvent.click(screen.getByLabelText('다운로드에 미확인 자동 초안 포함'));
  expect(screen.getByRole('button', {name:'선택 일지 엑셀'})).not.toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name:'선택 일지 엑셀'}));
  expect(p.exportNotesXlsx).toHaveBeenCalledWith([notes[1]]);
});

it('does not hide server-filtered results with a second raw whitespace/case-sensitive search',()=>{
  const p=props(); const openNoteExport=jest.fn();
  render(<CasenotesPage {...p} caseSearch=" 가 " caseNotes={[notes[0]]}
    notesPage={{pageNumber:1,loading:false,hasMore:false,scanned:1}} openNoteExport={openNoteExport}/>);
  expect(screen.getByText('saved')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'선택 일지 엑셀'}));
  expect(openNoteExport).toHaveBeenCalledWith({includeDrafts:false,selectedIds:['a']});
});
