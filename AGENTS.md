# Agent Guidelines

This file contains repository-specific guidance for future AI agents working on Link 2 Ink Studio.

## Project Structure
- **Frontend**: React 19 + Vite.
- **Entry Points**: `index.html` -> `index.tsx` -> `App.tsx`.
- **Components**: Located in `/components/`.
- **Services**: Located in `/services/`. Contains logic for external APIs (GitHub, Gemini).
- **Types**: Global types are in `types.ts` and `/types/editing.ts`.
- **Styling**: Tailwind CSS is used exclusively. Global styles are in `index.css`.

## Coding Conventions
- **TypeScript**: Strict typing is preferred. Avoid `any` where possible.
- **React**: Use functional components and hooks.
- **API Keys**: The application currently injects `GEMINI_API_KEY` via Vite's `define` config in `vite.config.ts`. Be aware of this when modifying environment variables.
- **Icons**: Use `lucide-react` for all icons. Do not introduce new icon libraries.
- **Visualizations**: Use `d3` for complex data visualizations.

## Setup and Verification Hints
- The development server runs on port 3000.
- The application requires a valid Gemini API key to function properly.
- When adding new dependencies, ensure they are compatible with React 19 and Vite.

## Pitfalls & Important Rules
- **API Key Security**: Currently, the API key is exposed to the client build. If you are tasked with improving security, consider moving API calls to a backend service.
- **D3.js Integration**: When modifying `D3FlowChart.tsx`, ensure you handle React's lifecycle correctly to avoid memory leaks or duplicate SVGs. Use `useRef` for the SVG container and clean up on unmount.
- **Vite Config**: Do not change the dev server port (3000) or host (`0.0.0.0`) in `vite.config.ts` as the environment relies on these settings.
