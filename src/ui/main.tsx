import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';
import './styles/app.css';
import './styles/sd-cadet.css';
import './styles/ops.css';
import './styles/sd-fly.css';
import './styles/sd-pack.css';
import './styles/sd-report.css';
import './styles/sd-home.css';
import './styles/sd-daily.css';
import './styles/sd-notebook.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
