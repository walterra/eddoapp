import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Eddo } from './eddo';
import './eddo.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Eddo />
  </StrictMode>,
);
