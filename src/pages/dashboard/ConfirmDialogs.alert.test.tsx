import { fireEvent, render, screen } from '@testing-library/react';
import { BulkConfirmDialog } from './ConfirmDialogs';

test('alert choice preserves selection and discloses playback gating without fixed duration or comprehension promise', () => {
  const setAlertIncludeCare = jest.fn();
  const startBulkCall = jest.fn();
  const queue = ['fixture'];
  render(<BulkConfirmDialog bulkConfirm={{count:1, queue, channel:'pstn', isAlert:true, alertLabel:'경보 멘트 — 한파경보'}}
    setBulkConfirm={jest.fn()} startBulkCall={startBulkCall} batchSize={5} batchIntervalSec={10}
    alertIncludeCare setAlertIncludeCare={setAlertIncludeCare} activeAlert="cold" />);
  expect(screen.getByText('경보 멘트 — 한파경보')).toBeInTheDocument();
  expect(screen.getByText(/재생에 실패하면 안부 질문을 진행하지 않습니다/)).toBeInTheDocument();
  expect(screen.queryByText(/이해하셨는지|약 3분|약 5분/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', {name:/경보 멘트만/}));
  expect(setAlertIncludeCare).toHaveBeenCalledWith(false);
  fireEvent.click(screen.getByRole('button', {name:'발신 시작'}));
  expect(startBulkCall).toHaveBeenCalledWith(queue, 'pstn', true);
});
