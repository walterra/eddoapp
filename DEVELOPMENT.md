# Development Guide

This guide provides an overview of the development process for Eddo, a GTD-inspired todo and time tracking application.

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Getting Started](docs/01_getting-started.md) - Prerequisites and setup instructions
- [Project Structure](docs/02_project-structure.md) - Overview of the codebase organization
- [Architecture](docs/03_architecture.md) - Details of the application architecture and design
- [Development Workflow](docs/04_development-workflow.md) - Guidelines for making changes, testing, and code style
- [Deployment](docs/05_deployment.md) - Building and deploying the application

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Key Commands

- **Development**: `pnpm dev`
- **Testing**: `pnpm test`
- **Linting**: `pnpm lint`
- **Formatting**: `pnpm format`
- **Building**: `pnpm build`

## Contributing

When contributing to this repository, please ensure you follow the coding standards and development workflow documented in [Development Workflow](docs/04_development-workflow.md).

## Test Infrastructure

The project includes testing infrastructure:

**Unit Tests:**
```bash
pnpm test:unit
```

**Integration Tests:** 
```bash
pnpm test:integration
```

**End-to-End Tests:**
```bash
pnpm test:e2e
```

**All Tests:**
```bash
pnpm test:all
```

## CI/CD Features

- **Pre-commit hooks**: Automatic TypeScript checking, linting, and formatting via Husky
- **GitHub Actions**: Automated testing with CouchDB service container
- **Database isolation**: Per-user database isolation with API key authentication for MCP server
- **Test optimization**: Separate unit/integration/e2e test commands for faster feedback