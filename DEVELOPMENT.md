# Development Guide

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.11.0 (see `.nvmrc`)
- [pnpm](https://pnpm.io/) >= 7.1.0
- A modern web browser

We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions:

```bash
# If you have nvm installed
nvm use
```

### Installation

1. Clone the repository:

```bash
git clone https://github.com/walterra/eddoapp.git
cd eddoapp
```

2. Install dependencies:

```bash
pnpm install
```

### Running Locally

Start the development server:

```bash
pnpm dev
```

This will start a local development server using Vite. Open your browser and navigate to the URL shown in the terminal (typically http://localhost:5173/).

## Project Structure

### Overview

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

### Key Components

- **Main Application Flow**: Entry at `index.tsx` → `eddo.tsx` → Components
- **Data Layer**: PouchDB for local storage with versioned data schemas
- **UI Components**:
  - `todo_board.tsx`: Main display of todos organized by context and date
  - `add_todo.tsx`: Form for creating new todos
  - `todo_list_element.tsx`: Individual todo item with time tracking controls
  - `todo_edit_modal.tsx`: Modal for editing todo details
  - `page_wrapper.tsx`: Layout wrapper for the application

### Database

The app uses PouchDB to store todo items locally in the browser:

- **Schema Versioning**: Todo schemas are versioned (alpha1, alpha2, alpha3) with migration paths
- **Data Model**: Todo items with properties like title, context, due date, completion status, and time tracking
- **Time Tracking**: Uses an `active` record that stores start/end timestamps for activity periods

## Development Workflow

### Making Changes

1. **Feature Branches**:

   - Create a branch for your feature or bugfix
   - Use descriptive branch names, e.g., `feature/add-calendar-view` or `fix/time-tracking-bug`

2. **Code Organization**:

   - Place new components in the `src/components` directory
   - Add utility functions to `src/utils`
   - New types should go in `src/types`
   - When adding new data fields, consider if a schema migration is needed (see `src/api/versions`)

3. **Component Development**:
   - Follow React functional component patterns
   - Use TypeScript for type safety
   - Use Tailwind CSS for styling

### Testing

1. **Running Tests**:

   ```bash
   # Run all tests
   pnpm test

   # Run a specific test file
   pnpm vitest:run src/path/to/file.test.ts
   ```

2. **Writing Tests**:

   - Place test files alongside implementation files with `.test.ts` or `.test.tsx` extension
   - Use Vitest's `describe`/`it` pattern
   - Follow the existing test patterns as seen in the utils tests
   - Test utilities and business logic thoroughly

3. **TypeScript Checking**:
   ```bash
   pnpm tsc:check
   ```

### Code Style

1. **Formatting**:

   ```bash
   # Check formatting
   pnpm lint:format

   # Fix formatting issues
   pnpm format
   ```

2. **Linting**:

   ```bash
   # Run ESLint
   pnpm lint
   ```

3. **Style Guidelines**:
   - Use snake_case for filenames
   - Use camelCase for variables/functions, PascalCase for components/types
   - Use single quotes and trailing commas
   - Use explicit return types for functions
   - Follow the existing import sorting (managed by @trivago/prettier-plugin-sort-imports)
   - Use TailwindCSS for styling
   - Use try/catch with console.error for error handling

## Build & Deployment

### Building for Production

The application uses Vite for building the production bundle:

1. **Create a production build**:

   ```bash
   pnpm build
   ```

   This command:

   - Compiles TypeScript to JavaScript
   - Bundles all dependencies
   - Optimizes assets
   - Generates production-ready files in the `dist` directory

2. **Preview the production build**:

   ```bash
   npx vite preview
   ```

   This command serves the production build locally for testing before deployment.

### Deployment Process

Since this is a client-side application with local browser storage, it can be deployed to any static web hosting:

1. **Static Hosting Options**:

   - GitHub Pages
   - Netlify
   - Vercel
   - AWS S3 + CloudFront
   - Any web server that can serve static files

2. **Deployment Steps**:

   - Build the application with `pnpm build`
   - Deploy the contents of the `dist` directory to your chosen hosting
   - Ensure all routes are directed to `index.html` for client-side routing

3. **PouchDB Considerations**:
   - The app uses PouchDB to store data in the browser
   - Data is persisted in the user's browser and doesn't require a server
   - Consider syncing options if server-side persistence is needed in the future
