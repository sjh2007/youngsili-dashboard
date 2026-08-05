import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./pages/PageRouter', () => () => <main>영실이 대시보드</main>);

test('renders the application router', () => {
  render(<App />);
  expect(screen.getByRole('main')).toHaveTextContent('영실이 대시보드');
});
