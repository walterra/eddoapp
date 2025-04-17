# Application Architecture

## Application Flow
The application is structured as a React single-page application with local data persistence:

- React entry point (`index.tsx`) → Main component (`eddo.tsx`) → Component hierarchy
- PouchDB context provides database access throughout the application
- Components use hooks for state management and database interactions

## Data Architecture

- **PouchDB Storage**: Uses browser-local database for all todo data
- **Versioned Schemas**: Implements schema versioning (alpha1→alpha2→alpha3) with migration paths
- **Type System**: Strong TypeScript typing throughout the codebase

## Component Architecture

- **Functional Components**: All React components are functional with hooks
- **Component Hierarchy**:
  - Presentation components (`todo_list_element`, `formatted_message`)
  - Container components (`todo_board` manages data and child components)
  - Forms and modals (`add_todo`, `todo_edit_modal`)

## State Management

- Local component state with `useState` for UI state
- Database access via React Context API
- Real-time updates via PouchDB change listeners

## Time Tracking Design

- Smart timestamp tracking using `active` records on todo items
- Utility functions calculate and format durations
- Clean separation between data storage and presentation logic

## Key Components

- **Main Application Flow**: Entry at `index.tsx` → `eddo.tsx` → Components
- **Data Layer**: PouchDB for local storage with versioned data schemas
- **UI Components**:
  - `todo_board.tsx`: Main display of todos organized by context and date
  - `add_todo.tsx`: Form for creating new todos
  - `todo_list_element.tsx`: Individual todo item with time tracking controls
  - `todo_edit_modal.tsx`: Modal for editing todo details
  - `page_wrapper.tsx`: Layout wrapper for the application

## Database

The app uses PouchDB to store todo items locally in the browser:

- **Schema Versioning**: Todo schemas are versioned (alpha1, alpha2, alpha3) with migration paths
- **Data Model**: Todo items with properties like title, context, due date, completion status, and time tracking
- **Time Tracking**: Uses an `active` record that stores start/end timestamps for activity periods