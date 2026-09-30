import { fireEvent, render, screen } from '@testing-library/react';
import HistoryPagination from './HistoryPagination';

test('내역이 한 페이지를 넘으면 페이지 이동을 제공하고 경계를 막는다', () => {
  const onChange = jest.fn();
  const { rerender } = render(<HistoryPagination page={1} totalItems={21} pageSize={10} onChange={onChange}/>);
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'이전'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'다음'}));
  expect(onChange).toHaveBeenCalledWith(2);

  rerender(<HistoryPagination page={3} totalItems={21} pageSize={10} onChange={onChange}/>);
  expect(screen.getByRole('button',{name:'다음'})).toBeDisabled();
});

test('한 페이지 이내면 페이지 이동을 숨긴다', () => {
  const { container } = render(<HistoryPagination page={1} totalItems={10} pageSize={10} onChange={()=>undefined}/>);
  expect(container).toBeEmptyDOMElement();
});
