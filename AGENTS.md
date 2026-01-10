# AGENTS.md

Guidelines for agentic coding agents working in the AutoCoder repository.

## Project Overview

Autonomous coding agent system with a React UI. Two-agent pattern (initializer + coding agent) for building complete applications across multiple sessions. Python backend (FastAPI) with React + TypeScript frontend.

---

## Build/Test Commands

### Python Backend

```bash
# Setup
python -m venv venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
pip install -r requirements.txt

# Linting
ruff check .              # Lint entire project
ruff check path/to/file.py  # Lint single file
ruff check --fix .        # Auto-fix issues

# Type checking
mypy .                    # Type check all files
mypy path/to/file.py      # Type check single file

# Testing
python test_security.py   # Run security tests (no pytest framework)

# Run application
python start.py           # CLI launcher
python start_ui.py        # Web UI backend
python autonomous_agent_demo.py --project-dir <path>  # Direct agent run
```

### React Frontend (ui/)

```bash
cd ui

# Setup
npm install

# Development
npm run dev               # Start dev server (http://localhost:5173)

# Linting
npm run lint              # ESLint check
npm run lint -- --fix     # Auto-fix lint issues

# Type checking & Build
npm run build             # TypeScript check + Vite production build

# Preview production build
npm run preview
```

**Note:** Running a single test is not supported (no test framework configured). Only `test_security.py` exists as a standalone test script.

---

## Code Style Guidelines

### Python

#### Import Organization
```python
# Standard library (alphabetical)
import asyncio
import io
import sys
from pathlib import Path
from typing import Optional

# Third-party (alphabetical)
from fastapi import APIRouter, HTTPException
from sqlalchemy import Column, Integer, String

# Local modules (alphabetical)
from client import create_client
from progress import has_features
from prompts import get_coding_prompt
```

#### Type Annotations
- **ALWAYS** use type hints for function signatures
- Use `typing` module types: `Optional`, `list`, `dict`, `tuple`
- Modern syntax: `list[str]` instead of `List[str]` (Python 3.11+)
```python
def run_agent_session(
    client: ClaudeSDKClient,
    message: str,
    project_dir: Path,
) -> tuple[str, str]:
    """Run a single agent session."""
    pass
```

#### Docstrings
- Use triple-quoted docstrings for modules, functions, and classes
- Format: One-line summary, blank line, detailed description
```python
"""
Module Name
===========

Brief module description.
"""

def function_name(param: str) -> bool:
    """
    Brief description.
    
    Args:
        param: Parameter description
    
    Returns:
        Return value description
    """
```

#### Naming Conventions
- Functions/variables: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private: Prefix with `_underscore`

#### Error Handling
- Use specific exceptions (avoid bare `except:`)
- Catch specific errors you expect
```python
try:
    result = risky_operation()
except FileNotFoundError as e:
    print(f"File not found: {e}")
except ValueError as e:
    print(f"Invalid value: {e}")
```

#### Ruff Configuration
- Line length: 120 characters
- Target: Python 3.11
- Ignores: E501 (line length), E402 (imports after code), E712 (SQLAlchemy comparisons)

---

### TypeScript/React

#### Import Organization
```typescript
// React core
import { useState, useEffect, useCallback } from 'react'

// Third-party libraries (alphabetical)
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Loader2, Code } from 'lucide-react'

// Local components
import { ProjectSelector } from './components/ProjectSelector'
import { KanbanBoard } from './components/KanbanBoard'

// Local utilities/hooks
import { useProjects, useFeatures } from './hooks/useProjects'
import * as api from './lib/api'

// Types (always last)
import type { Feature, ProjectSummary } from './lib/types'
```

#### Component Structure
- **ALWAYS** use functional components with hooks
- Export at definition: `export function ComponentName()`
- Props interface above component
```typescript
interface ComponentProps {
  data: string
  onAction: (id: number) => void
}

export function MyComponent({ data, onAction }: ComponentProps) {
  const [state, setState] = useState(false)
  
  return <div>{data}</div>
}
```

#### Type Definitions
- Prefer `interface` for object shapes
- Use `type` for unions, intersections, primitives
- Use `type` imports: `import type { Feature } from './types'`
```typescript
// Use interface for objects
export interface Feature {
  id: number
  name: string
}

// Use type for unions
export type AgentStatus = 'stopped' | 'running' | 'paused' | 'crashed'
```

#### Naming Conventions
- Components: `PascalCase` (e.g., `KanbanBoard`)
- Hooks: `camelCase` with `use` prefix (e.g., `useProjects`)
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

#### Error Handling
- Use try/catch for async operations
- Provide fallbacks for localStorage, etc.
```typescript
try {
  localStorage.setItem(STORAGE_KEY, project)
} catch {
  // localStorage not available - silent fail
}
```

#### TypeScript Configuration
- Strict mode: ON
- `noUnusedLocals`: ON
- `noUnusedParameters`: ON
- `noFallthroughCasesInSwitch`: ON
- Target: ES2020
- JSX: `react-jsx`

---

## Security Model

Defense-in-depth security via `security.py` and `client.py`:

1. **Bash Command Allowlist:** Only commands in `ALLOWED_COMMANDS` can run
2. **Filesystem Restrictions:** Operations limited to project directory
3. **Special Validations:**
   - `chmod`: Only `+x` for scripts (no numeric modes, no recursive)
   - `pkill`: Only for dev processes (node, npm, vite, etc.)
   - `init.sh`: Only script execution allowed

**When modifying security:**
- Add new commands to `ALLOWED_COMMANDS` in `security.py`
- Add test cases to `test_security.py`
- Run `python test_security.py` to verify

---

## Key Patterns

### Python Patterns
- **Lazy imports:** Use functions to defer imports and avoid circular dependencies
- **Path handling:** Use `pathlib.Path` (not string paths)
- **Database:** SQLAlchemy ORM with explicit session management
- **Async:** Use `async`/`await` for I/O operations

### React Patterns
- **Data fetching:** TanStack Query with hooks in `hooks/useProjects.ts`
- **Real-time updates:** WebSocket with custom hook `useWebSocket.ts`
- **State management:** React hooks (useState, useEffect) + React Query cache
- **Styling:** Tailwind CSS v4 with neobrutalism design (see `ui/src/styles/globals.css`)

### File Organization
```
Python:
  - Entry points: start.py, autonomous_agent_demo.py
  - Core logic: agent.py, client.py
  - API: server/routers/
  - MCP servers: mcp_server/

TypeScript:
  - Components: ui/src/components/
  - Hooks: ui/src/hooks/
  - API client: ui/src/lib/api.ts
  - Types: ui/src/lib/types.ts
```

---

## Common Tasks

### Adding a New Python Module
1. Follow import organization (stdlib → third-party → local)
2. Add module docstring
3. Use type hints for all functions
4. Update `requirements.txt` if adding dependencies

### Adding a New React Component
1. Create in `ui/src/components/`
2. Use functional component with TypeScript
3. Define props interface above component
4. Import types from `ui/src/lib/types.ts`
5. Use existing design patterns (neobrutalism, Tailwind CSS v4)

### Modifying API Endpoints
1. Update router in `server/routers/`
2. Update schema in `server/schemas.py`
3. Update API client in `ui/src/lib/api.ts`
4. Update types in `ui/src/lib/types.ts`
5. Update hooks in `ui/src/hooks/useProjects.ts`

---

## Pre-commit Checklist

Before committing changes:

**Python:**
- [ ] `ruff check .` passes
- [ ] `mypy .` passes (if type annotations added)
- [ ] `python test_security.py` passes (if security changes made)
- [ ] All imports organized correctly
- [ ] Type hints added to new functions

**TypeScript:**
- [ ] `npm run lint` passes (in ui/ directory)
- [ ] `npm run build` succeeds (in ui/ directory)
- [ ] No console errors in browser
- [ ] Types properly imported with `import type`

---

## Additional Notes

- **No test framework:** Only `test_security.py` exists. Add tests there if modifying security logic.
- **Git workflow:** The agent auto-commits after each session. Manual commits should follow conventional commit style.
- **CI/CD:** GitHub Actions runs linting for both Python and UI on PRs (see `.github/workflows/ci.yml`).
- **Project registry:** Projects stored anywhere, mapped in `~/.autocoder/registry.db` (not in fixed `generations/` folder).
