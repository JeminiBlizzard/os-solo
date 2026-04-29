import { Router } from './router';
import { AppProviders } from './providers/AppProviders';

export default function App() {
  return (
    <AppProviders>
      <Router />
    </AppProviders>
  );
}
