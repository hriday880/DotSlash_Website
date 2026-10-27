# DotSlash Daily (Blog Newsstand)

## Overview
This feature introduces a fully interactive 3D newsstand for the DotSlash blog, built using React Three Fiber. Blogs are rendered dynamically as procedural newspapers. 

## Setup & Running

### 1. Database Seeding
Since the local sandbox environment restricted direct `node` execution, you must run the seed script manually to populate your Turso database with sample blogs:
```bash
node scripts/seed_blogs.js
```

### 2. Markdown Content
The seed script maps blogs to markdown files located in `public/blogs/`. Currently published:
- `public/blogs/tag-youre-built.md` — *Tag, You're Built!* (laser tag build newsletter)

### 3. Fetching & Build Process
To secure the Turso credentials, we moved to a **build-time JSON generation** architecture.
Before running the Vite dev server or building, you must fetch the latest blogs from the database:
```bash
npm run prebuild
```
This generates `public/blogs/blogs.json`, which the React app safely reads without exposing your database credentials.

## Adding a New Blog
1. Insert a new row into the `blogs` table in your Turso DB.
2. Add the corresponding markdown file to `public/blogs/`.
3. Run `npm run prebuild` (or trigger a new build on Render) to update the generated JSON file.

## Customization
- **Palette**: The palette uses tokens from `tailwind.config.js`.
- **Masthead Name**: To change "DOTSLASH DAILY", edit the title string in the Canvas generator inside `src/components/blog/Newspaper.jsx`.
- **Shelf Configuration**: Shelf dimensions (`CELL_W`, `CELL_H`, `DEPTH`, …) live in `src/components/blog/Bookshelf.jsx`. The grid (columns × rows per bay) is picked from the viewport aspect in `src/pages/Blog.jsx`, and the camera is locked and auto-framed in `src/components/blog/Newsstand.jsx`.
