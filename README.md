# Video Automation Studio

Production-ready Electron, React, TypeScript, SQLite, Playwright, and FFmpeg foundation for a storyboard-driven AI video automation workflow.

## Foundation layout

- `src/main` for the Electron main process and IPC registration
- `src/preload` for the secure bridge exposed to the renderer
- `src/renderer` for the React UI shell and Vite configuration
- `src/shared` for serializable domain and IPC contracts
- `src/core` for application ports and workflow contracts
- `src/types` for ambient globals

## Scripts

- `npm run dev` starts the renderer, TypeScript watchers, and Electron
- `npm run build` produces renderer, main, preload, and packaged outputs
- `npm run typecheck` runs project-reference type checking
