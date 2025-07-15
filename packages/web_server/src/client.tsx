import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Eddo } from './client/eddo';
import './styles.css';

// Ensure the root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create and render the React app
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <Eddo />
  </StrictMode>,
);
