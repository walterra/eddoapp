import { Eddo } from './eddo';
import './eddo.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Eddo />
  </StrictMode>,
);
