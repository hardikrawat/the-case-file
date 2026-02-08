# The Case File

The Case File is a visual investigation board application designed for connecting complex pieces of information. It provides a digital "detective board" experience where users can create nodes, link them with red strings, and collaborate on investigations.

## Core Features

- Digital Investigation Board: A flexible canvas for placing and organizing case evidence.
- Interactive Nodes: Create and edit various types of evidence nodes including Articles, Sticky Notes, and more.
- Dynamic Connections: Use the signature "red string" to connect related nodes and visualize relationships.
- Authentication and User Profiles: Secure login system with detective reputation tracking.
- Collaborative Tools: Shared board access and version history.
- Export Capabilities: Save your investigation board as PDF or image.

## Architecture

The project follows a modern full-stack architecture:

- Frontend: Next.js 15 (App Router) using React for UI components.
- Board Engine: ReactFlow handles the complex canvas interactions, node rendering, and edge management.
- State Management: Zustand provides a lightweight and performant store for application state.
- Backend: Next.js API Routes (Serverless) for data processing and authentication logic.
- Database: Turso (libSQL) - a distributed database at the edge.
- ORM: Drizzle ORM for type-safe database queries and migrations.
- Authentication: Auth.js (NextAuth) for secure session management and provider integration.
- Styling: Tailwind CSS for a responsive and consistent noir-themed aesthetic.

## Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- Turso CLI (for database management)

### Installation

1. Clone the repository:
   git clone https://github.com/hardikrawat/the-case-file.git
   cd the-case-file

2. Install dependencies:
   npm install

3. Configure environment variables:
   cp .env.example .env.local
   Fill in your TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.
   Generate an AUTH_SECRET using 'npx auth secret'.

4. Initialize the database:
   npx drizzle-kit push

5. Start the development server:
   npm run dev

### Scripts

- npm run dev: Start development server.
- npm run build: Build for production.
- npm run lint: Run ESLint for code quality checks.
- npm test: Run unit and integration tests using Vitest.
- npm run test:e2e: Run end-to-end tests using Playwright.

## Key Dependencies

- next: React framework for the web.
- reactflow: Library for building node-based editors and diagrams.
- drizzle-orm: TypeScript ORM for SQL databases.
- next-auth: Authentication for Next.js.
- zustand: Small, fast and scalable bearbones state-management solution.
- tailwindcss: Utility-first CSS framework.

## License

Private Repository - All Rights Reserved.
