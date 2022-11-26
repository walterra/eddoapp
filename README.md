# Eddo

_Loosely GTD inspired todo & time tracking app_

Consider this an alpha state proof of concept for now. I encourage you to give it a try and I'd love to hear your feedback, but don't expect 100% data integrity across updates.

The current version persists its data just locally within the browser via PouchDb.

The app is inspired by my offline/notebook based approach I've been using for 10+ years.

Notebook             |  Eddo
:-------------------------:|:-------------------------:
<img src="./img/notebook.jpg" alt="notebook" width="60%" /> | <img src="./img/screenshot.png" alt="Eddo screenshot" width="100%" />

- The form to add a todo consists of a context (e.g. home/work), the todo itself and a due date.
- The whole view is filtered by calendar week and you page through weeks.
- Each column can be treated similar to a GTD-like context.
- Within a column, todos will be grouped by date.
- Each todo has a start/pause button for time tracking.
- Time tracked for todos will be summed up for each day and column.

## Setup

- Clone the repository
- Run `pnpm install` (or `npm install` if you don't use `pnpm`).
- Run `pnpm dev` to give it a try as is on your local machine.
- Run `pnpm build` to create a production build which you can deploy/use to your liking.

