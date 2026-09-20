import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { MissingEnvNotice } from './components/MissingEnvNotice';
import { missingEnvVars } from './lib/env';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const root = createRoot(rootElement);

if (missingEnvVars.length > 0) {
  // Explain the problem instead of showing a blank page. The rest of the app is loaded
  // lazily below, because importing it would construct the Supabase client and throw first.
  root.render(<MissingEnvNotice missing={missingEnvVars} />);
} else {
  void Promise.all([import('./App'), import('./components/AuthProvider')]).then(
    ([{ default: App }, { AuthProvider }]) => {
      root.render(
        <StrictMode>
          {/* BrowserRouter gives real URLs; AuthProvider shares the session with every page. */}
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </StrictMode>,
      );
    },
  );
}
