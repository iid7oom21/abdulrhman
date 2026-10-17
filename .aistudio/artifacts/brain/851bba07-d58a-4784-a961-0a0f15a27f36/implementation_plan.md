# TaskFlow Workspace — Modern Productivity & Task Management

A clean, minimalist productivity and task management workspace engineered with React 19, Vite, and Tailwind CSS, featuring flexible task prioritization, Kanban boards, agenda scheduling, focus timers, and persistent local storage.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your selections, we have aligned on the following core decisions:
> - **Product Type**: Modern productivity and task management workspace with multi-view task organization (List, Kanban board, Today agenda, and Focus timer).
> - **Visual Identity**: Clean modern minimalist aesthetic with dark charcoal accents, crisp border definition, and zero pill-box clutter.
> - **Technical Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4, resolving the missing root configuration files (`package.json`, `vite.config.ts`, `index.html`, `main.tsx`, `App.tsx`).

- **Confirmed Decision 1**: Multi-view productivity system (Kanban board, Priority List, Calendar/Today Agenda, and Pomodoro Focus Mode).
- **Confirmed Decision 2**: LocalStorage persistence with sample starter tasks and export/import capability to ensure immediate utility.
- **Recommended Default**: Responsive desktop-first workspace layout with a 260px collapsible sidebar and dedicated top breadcrumb header.

---

## 1. Overview & Core Concept

- **What It Does**: TaskFlow provides a distraction-free, responsive command center for managing daily tasks, project milestones, priority triage, and focused work sessions.
- **Target Audience / Persona**: Professionals, developers, and knowledge workers seeking a rapid, clutter-free personal productivity hub.
- **Key Value**: Instant load times, keyboard-friendly interactions, frictionless task creation, multiple organizational views, and zero unnecessary visual noise.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Daily Triage & Quick Capture*: Global quick-add bar (with title, priority, due date, category tag) allows task capture in seconds.
  2. *View Switching*: Effortless tab switching between List (grouped by priority/status), Kanban Board (drag-and-drop / click-to-move columns), Today Agenda (scheduled items), and Focus Timer.
  3. *Task Management*: Interactive status toggling, tag editing, priority adjustment, deletion, search filtering, and celebratory completion feedback.
  4. *Focus Session*: Integrated Pomodoro/interval timer linked directly to an active task with audio/visual completion alerts.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Clean modern minimalism with slate/charcoal dark accents, razor-sharp hairline dividers (`border-neutral-200 dark:border-neutral-800`), and generous breathing room.
  - *Color Palette & Mood*:
    - Neutral Canvas: Crisp white (`#FAFAFA` / `#FFFFFF`) and dark neutral mode support (`#0F172A`).
    - Structural Surfaces: Flat panels with subtle 1px border lines and zero card-in-card nesting.
    - Accent Budget: Deep slate (`#0F172A`) for primary controls with semantic status accents (Emerald `#16A34A` for completed, Amber `#D97706` for medium/due soon, Rose `#E11D48` for high priority).
  - *Typography & Hierarchy*:
    - Display & Headings: `Plus Jakarta Sans` for crisp titles and section headings.
    - Body Text: `Plus Jakarta Sans` / system sans (14px–15px, 1.5 line height).
    - Data & Metrics: Monospace tabular numerals (`font-mono tabular-nums`) for timers, task counts, and dates.
  - *Zero-Pill Discipline*: Categories and dates rendered as quiet inline metadata with typographic bullet separators (`·`), avoiding candy badges and artificial pill containers.

- **Interactive Feedback & Motion**:
  - Snappy feedback ($\le 150\text{ms}$) on clicks and status toggles.
  - Smooth filter transitions and discreet check animations.
  - Confetti burst on clearing all daily high-priority items.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: File Structure & Build Recovery**
  - *Chosen Approach*: Create a complete `package.json` with standard modern dependencies (`react`, `react-dom`, `lucide-react`, `canvas-confetti`, `clsx`, `tailwind-merge`, `@tailwindcss/vite`, `vite`, `typescript`), `vite.config.ts`, `index.html`, and `src/main.tsx` + `src/App.tsx`.
  - *Why*: Resolves the fatal Vite import resolution error and Bun install error immediately, establishing a robust developer server.
  - *Alternatives Considered*: Minimal single-file JS bundle without Vite plugins was rejected because TypeScript and Tailwind provide greater reliability and maintainability.

- **Decision 2: Local Persistence & Sample Data Seed**
  - *Chosen Approach*: Browser `localStorage` with initial seed tasks (Work, Personal, Development) so the app opens in an immediately interactive, populated state with full CRUD capabilities.
  - *Why*: Zero server setup overhead; instant offline availability; safe, persistent user state across reloads.
  - *Alternatives Considered*: In-memory only state was rejected because users would lose their tasks on page refresh.

- **Decision 3: Multi-View Organization Paradigm**
  - *Chosen Approach*: Unified task data model rendered across four view modes: List (dense, structured table), Board (Kanban columns: Backlog, In Progress, Done), Agenda (Today's timeblocks), and Focus (Distraction-free Pomodoro session).
  - *Why*: Accommodates different work styles without fragmenting data.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       TaskFlow App                          │
├──────────────────────────────┬──────────────────────────────┤
│      Sidebar Navigation      │        Header Bar            │
│  - All Tasks                 │  - Breadcrumb Location       │
│  - Today / Agenda            │  - Live Task Count Metric    │
│  - Board View                │  - New Task Quick Trigger    │
│  - Focus Mode                │  - Search & Filter Controls  │
├──────────────────────────────┴──────────────────────────────┤
│                      Active Viewport                        │
│                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │      List View        │  OR  │      Kanban Board      │  │
│  │  - Priority grouping  │      │  - To Do / Doing / Done│  │
│  │  - Inline toggle      │      │  - Stage transitions   │  │
│  └───────────────────────┘      └────────────────────────┘  │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │     Today Agenda      │  OR  │      Focus Timer       │  │
│  │  - Time-blocked items │      │  - 25m Pomodoro clock  │  │
│  │  - Daily completion   │      │  - Current active task │  │
│  └───────────────────────┘      └────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Task Store (localStorage)                  │
│       CRUD Actions · Category Filters · Timer State         │
└─────────────────────────────────────────────────────────────┘
```

- **Data Model**:
  ```ts
  interface Task {
    id: string;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    status: 'backlog' | 'in_progress' | 'completed';
    category: string;
    dueDate?: string;
    createdAt: number;
    completedAt?: number;
    estimatedMinutes?: number;
  }
  ```

- **Files to Establish**:
  1. `package.json` — dependencies, dev server scripts, build configurations.
  2. `vite.config.ts` — React plugin and Tailwind CSS Vite plugin integration.
  3. `index.html` — HTML shell, viewport, metadata, Google Fonts preconnect.
  4. `src/main.tsx` — Root entry point mounting React 19 into the DOM.
  5. `src/index.css` — Global CSS with `@import "tailwindcss";` and typography styles.
  6. `src/types/index.ts` — Task, view mode, filter, and timer type definitions.
  7. `src/data/initialTasks.ts` — Realistic seed data across projects and priorities.
  8. `src/components/Sidebar.tsx` — Navigation panel and view selector.
  9. `src/components/Header.tsx` — Top bar contract, search input, and stats.
  10. `src/components/ListView.tsx` — High-density, structured priority task list.
  11. `src/components/BoardView.tsx` — Multi-column Kanban board with stage shifting.
  12. `src/components/AgendaView.tsx` — Daily schedule and time-grouped tasks.
  13. `src/components/FocusView.tsx` — Pomodoro focus timer with task binding.
  14. `src/components/TaskModal.tsx` — Create and edit task dialog.
  15. `src/App.tsx` — Root component coordinating state, views, and persistence.
  16. `metadata.json` — Set applet title, description, and permissions.
