import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HelpGuide from './HelpGuide';

const guideHtml = '<!doctype html><html><head><title>AI영실이 문서</title></head><body>전체 안내 내용</body></html>';

afterEach(() => {
  jest.restoreAllMocks();
});

test('전체 가이드를 가져와 응답 헤더의 프레임 제한 없이 srcDoc으로 표시한다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    text: async () => guideHtml,
  } as Response);

  render(<HelpGuide />);
  fireEvent.click(screen.getByRole('button', { name: /전체 가이드/ }));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/help/ai-youngsili-guide.html',
    expect.objectContaining({ credentials: 'same-origin' }),
  ));
  const frame = await screen.findByTitle('AI영실이 문서');
  expect(frame).toHaveAttribute('srcdoc', guideHtml);
  expect(frame).not.toHaveAttribute('src');
});
