import { ThemeProvider } from 'flowbite-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemeInit } from '../../../.flowbite-react/init';
import { Eddo } from './eddo';
import './eddo.css';
import { customFlowbiteTheme } from './flowbite_theme';
import { initTelemetry } from './telemetry';

// Initialize OpenTelemetry before React renders to capture page load metrics
initTelemetry();

// Ensure the root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create and render the React app
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <ThemeProvider theme={customFlowbiteTheme}>
      <ThemeInit />
      <Eddo />
    </ThemeProvider>
  </StrictMode>,
);
