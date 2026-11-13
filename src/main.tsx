import { createRoot } from 'react-dom/client';
import '@fontsource/google-sans/400.css';
import '@fontsource/google-sans/500.css';
import '@fontsource/google-sans/600.css';
import '@fontsource/google-sans/700.css';
import '@fontsource/google-sans/400-italic.css';
import '@fontsource/google-sans/700-italic.css';
import App from './App.tsx';
import './index.css';

import { SettingsProvider } from './lib/SettingsContext';
import { LanguageProvider } from './lib/LanguageContext';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </LanguageProvider>
);
