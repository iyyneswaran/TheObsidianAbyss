# Technology stack

Versions below were verified on the Milestone 0 Windows workspace. Transitive versions are recorded in `pnpm-lock.yaml`.

| Area                   | Installed versions                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Runtime and workspace  | Node.js 22.17.0, pnpm 12.18.0, Git 2.51.2.windows.1                                                                     |
| Web                    | React and React DOM 19.3.1, React Router DOM 7.18.6, Phaser 3.90.0                                                      |
| Web build              | Vite 8.3.8, Vite React plugin 6.3.0, Tailwind CSS and Tailwind Vite plugin 4.3.5                                        |
| Multiplayer            | Colyseus core 0.17.56, WebSocket transport 0.17.13, SDK 0.17.43, schema 4.0.31                                          |
| API and validation     | Fastify 5.12.8, Fastify CORS 11.4.3, Zod 4.6.7                                                                          |
| TypeScript and runners | TypeScript 6.0.3, tsx 4.23.15, Node types 22.20.5, React and React DOM types 19.3.0                                     |
| Lint and format        | ESLint 10.15.0, @eslint/js 10.0.1, typescript-eslint 8.73.0, React Hooks plugin 7.1.1, globals 17.14.0, Prettier 3.10.1 |
| Tests                  | Vitest 5.1.1, Playwright 1.65.1                                                                                         |
| Asset source           | PixelFX 0.3.1, used locally for export                                                                                  |

PostgreSQL and Prisma are reserved for future milestones.
