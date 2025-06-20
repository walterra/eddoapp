# ISSUE-042: Code Organization Refactor

## Summary

The codebase has evolved to include a client-side web application, an MCP server, and shared code between them, but the current structure lacks clear organization and separation of concerns.

## Current State

The project currently contains:
- **Client-side web app**: React/TypeScript application in the main src/ directory
- **MCP server**: Model Context Protocol server in `src/mcp-server.ts`
- **Shared code**: Data models (e.g., `TodoAlpha3` type) used by both client and server

### Problems

1. **Mixed concerns**: Server code (`mcp-server.ts`) lives alongside client code in the same directory
2. **Unclear boundaries**: No clear separation between client-only, server-only, and shared code
3. **Import confusion**: Both client and server import from the same paths, making it unclear what code is meant for which environment
4. **Build complexity**: Single build process needs to handle both client and server code
5. **Testing challenges**: Tests for client and server code are intermingled

## Proposed Solutions

### Option 1: Traditional pnpm Workspaces

Reorganize the codebase with clear separation:

```
/packages/
  /client/         # Client-side web application
    /src/
    /tests/
    package.json
    tsconfig.json
    vite.config.ts
    
  /server/         # MCP server
    /src/
    /tests/
    package.json
    tsconfig.json
    
  /shared/         # Shared types and utilities
    /src/
      /types/      # TodoAlpha3, etc.
      /utils/      # Shared utilities
    /tests/
    package.json
    tsconfig.json
```

### Option 2: Bit Component Platform

Use Bit for automated dependency management and component-first architecture:

```
/workspace.jsonc   # Bit workspace configuration
/client/           # Client app components
/server/           # Server components  
/shared/           # Shared components
/.bit/             # Bit metadata
```

## Evaluation: pnpm Workspaces vs Bit

### pnpm Workspaces
**Pros:**
- Simple, familiar package management approach
- Direct control over dependencies via package.json
- Lightweight with minimal abstraction
- Well-documented with large community
- Easy integration with existing tools (Nx, Turborepo)

**Cons:**
- Manual dependency management across packages
- Risk of phantom dependencies
- Requires explicit configuration for each package
- More boilerplate for cross-package dependencies

### Bit Component Platform
**Pros:**
- Automated dependency tracking and management
- Prevents phantom dependencies automatically
- Component-level versioning and isolation
- Simplified workspace-wide dependency installation
- Built-in component documentation and testing

**Cons:**
- Steeper learning curve with new concepts/commands
- Additional tooling layer to understand
- Potentially overkill for a small project
- Less community resources compared to pnpm

## Recommendation

For this project, **pnpm workspaces** is recommended because:

1. **Project Size**: With only 3 packages (client, server, shared), manual dependency management is manageable
2. **Simplicity**: The team can use familiar npm/pnpm commands and workflows
3. **Flexibility**: Easy to integrate with build tools like Vite and TypeScript
4. **Future Options**: Can migrate to Bit later if the project grows significantly
5. **Learning Curve**: Lower barrier to entry for contributors

Bit would be more beneficial for larger projects with many reusable components or teams that need advanced component isolation and versioning.

## Benefits

1. **Clear separation**: Obvious which code runs where
2. **Independent builds**: Each package can have its own build configuration
3. **Better type safety**: Shared types package ensures consistency
4. **Easier testing**: Separate test configurations for client and server
5. **Scalability**: Easy to add new packages (e.g., CLI tools, additional servers)

## Implementation Steps (pnpm workspaces)

1. Set up monorepo structure:
   - Create `pnpm-workspace.yaml` at root
   - Configure packages directory structure
2. Create three packages: `@eddo/client`, `@eddo/server`, `@eddo/shared`
3. Move existing code to appropriate packages:
   - Client: All React components, hooks, and client utilities
   - Server: `mcp-server.ts` and related server code
   - Shared: `TodoAlpha3` type and other shared types/utilities
4. Update imports to use package names (e.g., `import { TodoAlpha3 } from '@eddo/shared'`)
5. Configure separate build processes:
   - Client: Keep existing Vite config
   - Server: Add TypeScript build for Node.js
   - Shared: Simple TypeScript compilation
6. Update CI/CD to handle monorepo structure
7. Add workspace-level scripts for common tasks (build all, test all, etc.)

## Considerations

- **Monorepo tooling**: Consider using tools like Turborepo or Nx for better monorepo management
- **Shared dependencies**: Ensure shared dependencies are properly managed
- **Development workflow**: Update development scripts to handle multiple packages
- **Documentation**: Update README and development docs to reflect new structure

## Priority

Medium - While the current structure works, this refactor will improve maintainability and scalability as the project grows.

## Related Issues

- None currently, but this will impact future development patterns