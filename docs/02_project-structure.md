# Project Structure

## Overview

The project is a React-based todo and time tracking application built with TypeScript, Vite, and TailwindCSS. Data is persisted locally in the browser using PouchDB.

```
├── src/                  # Source code
│   ├── api/              # API and data version migration logic
│   ├── components/       # React components
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── eddo.css          # Main CSS file
│   ├── eddo.tsx          # Main application component
│   ├── index.tsx         # Application entry point
│   └── pouch_db.ts       # PouchDB setup and context
├── public/               # Static assets
└── dist/                 # Build output directory
```