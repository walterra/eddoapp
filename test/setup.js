import { vi } from 'vitest';

// Mock tailwindcss/version.js for Flowbite React compatibility
vi.mock('tailwindcss/version.js', () => ({
  default: '3.4.17',
  version: '3.4.17'
}));