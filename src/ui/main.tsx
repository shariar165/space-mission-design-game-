import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';
import './styles/app.css';
import './styles/cadet.css';
import './styles/ops.css';
import './styles/sd-fly.css';
import './styles/sd-pack.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
