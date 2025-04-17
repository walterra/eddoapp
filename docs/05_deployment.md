# Build & Deployment

## Building for Production

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

## Deployment Process

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