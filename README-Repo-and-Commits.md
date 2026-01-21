# Repository and Commits Details

## Local Repository

**Path:** `/Users/elienabushosi/ProjectLindero-fresh`

**Current Branch:** `main`

**Total Tracked Files:** 189 files

## Remote Repository

**GitHub URL:** `https://github.com/elienabushosi/Lindero.git`

**Remote Name:** `origin`

**Default Branch:** `main`

**Fetch URL:** `https://github.com/elienabushosi/Lindero.git`

**Push URL:** `https://github.com/elienabushosi/Lindero.git`

## Git File Tree Structure

Git tracks the following file structure (189 files total):

### Root Level
- `.gitignore` - Git ignore rules
- `README.md` - Main project README
- `package.json` - Monorepo workspace configuration
- `package-lock.json` - Dependency lock file

### Backend (`/backend`)
- **Configuration:**
  - `package.json` - Backend dependencies
  - `server.js` - Express server entry point

- **Documentation:**
  - `README.md` - Backend overview
  - `README-GEOSERVICE.md` - Geoservice agent documentation
  - `README-ORCHESTRATION.md` - Orchestration layer documentation
  - `README-ZONING-RESOLUTION.md` - Zoning resolution documentation

- **Libraries (`/lib`):**
  - `building-class.js` - Building class lookup
  - `land-use.js` - Land use code lookup
  - `supabase.js` - Supabase client configuration

- **Orchestration (`/orchestration`):**
  - `orchestrator.js` - Main orchestration coordinator
  - **Agents (`/agents`):**
    - `base-agent.js` - Base agent class
    - `geoservice.js` - Geoservice integration agent
    - `index.js` - Agent exports
    - `tax-lot-finder.js` - Tax lot finder agent
    - `transit-zones.js` - Transit zones agent
    - `zola.js` - Zola API agent
    - `zoning-resolution.js` - Zoning resolution agent
    - `zoning-resolution-yards.test.js` - Zoning resolution tests

- **Routes (`/routes`):**
  - `auth.js` - Authentication routes
  - `reports.js` - Report routes

- **Services (`/services`):**
  - `report-service.js` - Report generation service

- **Database (`/`):**
  - `schema.sql` - Database schema
  - `schema-update-reports-bbl.sql` - Schema update script

### Frontend (`/frontend`)
- **App Directory (`/app`):**
  - `layout.tsx` - Root layout with metadata
  - `globals.css` - Global styles
  - `icon.svg` - App icon
  - `favicon.ico` - Favicon
  - `page.tsx` - Landing page
  - **Workspace Routes (`/(workspace)`):**
    - `layout.tsx` - Workspace layout
    - `home/page.tsx` - Home page
    - `search-address/page.tsx` - Address search page
    - `reports/page.tsx` - Reports list page
    - `viewreport/[id]/page.tsx` - View report detail page
    - `demo-report-list/page.tsx` - Demo reports list
    - `demo-report/[id]/page.tsx` - Demo report detail
    - `settings/page.tsx` - Settings page
    - `team/page.tsx` - Team page
  - **Auth Routes:**
    - `login/page.tsx` - Login page
    - `signup/page.tsx` - Signup page

- **Components (`/components`):**
  - `components.json` - shadcn/ui configuration
  - **Landing Page Components:**
    - `header.tsx` - Site header
    - `hero-section.tsx` - Hero section
    - `feature-cards.tsx` - Feature cards
    - `cta-section.tsx` - Call-to-action section
    - `documentation-section.tsx` - Documentation section
    - `faq-section.tsx` - FAQ section
    - `footer-section.tsx` - Footer
    - `pricing-section.tsx` - Pricing section
    - `testimonials-section.tsx` - Testimonials
    - `dashboard-preview.tsx` - Dashboard preview
    - `effortless-integration.tsx` - Integration section
    - `effortless-integration-updated.tsx` - Updated integration section
    - `smart-simple-brilliant.tsx` - Feature section
    - `numbers-that-speak.tsx` - Stats section
  - **Functional Components:**
    - `address-autocomplete.tsx` - Google Maps autocomplete
    - `address-map.tsx` - Address map display
    - `theme-provider.tsx` - Theme context provider
  - **UI Components (`/ui`):**
    - All shadcn/ui components (accordion, alert, avatar, button, card, dialog, form, input, select, table, tabs, etc.)

- **Libraries (`/lib`):**
  - `reports.ts` - Report utilities
  - `team.ts` - Team utilities

- **Configuration:**
  - `package.json` - Frontend dependencies
  - `tsconfig.json` - TypeScript configuration
  - `tailwind.config.ts` - Tailwind CSS configuration
  - `postcss.config.js` - PostCSS configuration
  - `next.config.js` - Next.js configuration

- **Public Assets (`/public`):**
  - Various images, logos, and static assets

### Shared (`/shared`)
- `building-class-lookup.json` - Building class data
- `building-class-lookup.ts` - Building class TypeScript definitions
- `land-use-lookup.json` - Land use data
- `land-use-lookup.ts` - Land use TypeScript definitions
- `README.md` - Shared resources documentation
- `BUILDING_CLASS_SETUP.md` - Building class setup guide

## Files Ignored by Git

The following are excluded from version control (see `.gitignore`):

- `node_modules/` - All dependency folders
- `frontend/.next/` - Next.js build output
- `frontend/out/` - Next.js export output
- `.env*` - Environment variable files
- `.DS_Store` - macOS system files
- `.vscode/`, `.idea/` - IDE configuration
- `*.log` - Log files
- `cursor_chat_history_*.txt` - Cursor chat history files
- Build and dist folders
- TypeScript build info

## How to Commit

### Standard Commit Workflow

1. **Check Status:**
   ```bash
   git status
   ```

2. **Stage Changes:**
   ```bash
   # Stage all changes
   git add .
   
   # Or stage specific files
   git add path/to/file
   ```

3. **Commit with Message:**
   ```bash
   git commit -m "Your commit message here"
   ```

4. **Push to Remote:**
   ```bash
   git push origin main
   ```

### Commit Message Guidelines

- Use clear, descriptive messages
- Start with a verb (Add, Fix, Update, Refactor, etc.)
- Be specific about what changed
- Examples:
  - `Add height constraints to ZoningResolutionAgent`
  - `Fix geoservice extraction error`
  - `Update viewreport page layout`
  - `Refactor zoning constraints UI`

### Viewing Commit History

```bash
# View recent commits
git log --oneline -20

# View detailed commit history
git log --pretty=format:"%h - %an, %ar : %s" -20

# View changes in last commit
git show --stat HEAD
```

## AI Assistant Permissions

**AUTHORIZATION:** The AI assistant (Auto) has permission to:
- ✅ Stage files for commit
- ✅ Create commits with appropriate messages
- ✅ Push commits to the remote repository (`origin/main`)
- ✅ View commit history and repository status

The AI assistant will:
- Use descriptive commit messages following the project's conventions
- Only commit changes that are explicitly requested or part of completed tasks
- Push changes to `origin/main` after committing
- Verify changes before committing when appropriate

## Branch Information

**Current Branch:** `main`

**Available Branches:**
- `main` (local and remote)
- `origin/main` (remote tracking branch)

**Default Branch:** `main`

## Quick Reference Commands

```bash
# Navigate to project
cd /Users/elienabushosi/ProjectLindero-fresh

# Check repository status
git status

# View remote information
git remote -v

# Pull latest changes
git pull origin main

# View tracked files
git ls-files

# View ignored files
git status --ignored
```

---

**Last Updated:** January 2026  
**Repository:** ProjectLindero-fresh  
**Maintainer:** elienabushosi
