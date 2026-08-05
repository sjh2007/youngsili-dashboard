import { useSyncExternalStore, type ComponentType } from 'react';
import DashboardPage from './DashboardPage';
import EldersPage from './EldersPage';
import SafetyPage from './SafetyPage';
import SchedulePage from './SchedulePage';
import ScriptPage from './ScriptPage';
import CallsPage from './CallsPage';
import HealthPage from './HealthPage';
import CaseNotesPage from './CaseNotesPage';
import FormsPage from './FormsPage';
import ReportPage from './ReportPage';
import DataPage from './DataPage';
import AdminPage from './AdminPage';
import HelpPage from './HelpPage';
import ElderDetailPage from './ElderDetailPage';
import ElderRegisterPage from './ElderRegisterPage';
import { pageFromHash, type PageId } from './pageRegistry';

const ROUTES: Record<PageId, ComponentType> = {
  dashboard: DashboardPage,
  elders: EldersPage,
  safety: SafetyPage,
  schedule: SchedulePage,
  script: ScriptPage,
  calls: CallsPage,
  health: HealthPage,
  casenotes: CaseNotesPage,
  forms: FormsPage,
  report: ReportPage,
  data: DataPage,
  admin: AdminPage,
  help: HelpPage,
  detail: ElderDetailPage,
  register: ElderRegisterPage,
};

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

export default function PageRouter() {
  const page = useSyncExternalStore(subscribe, () => pageFromHash(), () => 'dashboard');
  const Page = ROUTES[page];
  return <Page />;
}
