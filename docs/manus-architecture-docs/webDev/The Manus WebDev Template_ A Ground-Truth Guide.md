# The Manus WebDev Template: A Ground-Truth Guide

## 1. Introduction

You are building a Manus-like E2B template and have encountered specific issues. This document provides the definitive, honest, and in-depth guide to the Manus `webdev` flow, based on a direct audit of my live E2B session. I will address your specific problems and provide the ground truth.

## 2. The `web-db-user` Template: The Ground Truth

The core template is located at `/opt/.manus/webdev/templates/web-dev-templates/templates/web-db-user/`. It is a Vite + React + TypeScript + TailwindCSS project with Drizzle ORM for database access.

### Key Findings:

-   **Package Manager**: The template is built around **pnpm**. The `package.json` specifies `"packageManager": "pnpm@10.4.1+..."` and includes a `pnpm-lock.yaml` file. The agent should use `pnpm install`, not `npm install`.
-   **Drizzle File Order**: You are correct that file write order matters. The `drizzle` directory must be created before writing `drizzle/schema.ts` and `drizzle.config.ts`.
-   **CI=true**: The `webdev_init_project` command does not set `CI=true` directly. Instead, the template is pre-configured to avoid interactive prompts.

## 3. The `webdev_init_project` Flow: The Real Sequence

Here is the exact sequence of events when `webdev_init_project` is called:

1.  **API Call**: The agent calls `webdev_init_project` with the project name and scaffold type.
2.  **Scaffolding**: The Sandbox Runtime API copies the template from `/opt/.manus/webdev/templates/web-dev-templates/templates/web-db-user/` to `/home/ubuntu/{{project_name}}`.
3.  **Environment Injection**: The Coordination Layer provides the `DATABASE_URL` and other secrets. The Sandbox Runtime writes these to `/home/ubuntu/{{project_name}}/.env`.
4.  **Dependency Installation**: The agent runs `pnpm install` inside the project directory.
5.  **Git Initialization**: The agent runs the following commands:
    ```bash
    git config --global user.name "Manus AI"
    git config --global user.email "agent@manus.im"
    git init
    git add -A
    git commit -m "Initial commit"
    ```
6.  **Start Dev Server**: The agent runs `pnpm dev` to start the Vite development server.

## 4. Addressing Your Specific Issues

### Issue 1: Drizzle File Write Order

You are correct. The agent must ensure the `drizzle` directory exists before writing files into it. The correct flow is:

1.  `shell(command="mkdir -p /home/ubuntu/{{project_name}}/drizzle")`
2.  `file(action="write", path="/home/ubuntu/{{project_name}}/drizzle/schema.ts", ...)`
3.  `file(action="write", path="/home/ubuntu/{{project_name}}/drizzle.config.ts", ...)`

### Issue 2: Missing Git Config

You are correct. The agent must set the git `user.name` and `user.email` before committing. This is done globally within the sandbox session.

### Issue 3: Missing Environment Injection

Environment variables are injected in two ways:

1.  **Session-wide variables**: The `/startup.sh` script sources `/home/ubuntu/.user_env` on shell startup. This file contains secrets provided by the Coordination Layer.
2.  **Project-specific variables**: For `webdev` projects, the Sandbox Runtime API writes a `.env` file directly into the project directory. This file contains the `DATABASE_URL`, `OPENAI_API_KEY`, `JWT_SECRET`, etc., which are then loaded by the application code (e.g., via `dotenv`).

## 5. The Startup Scripts: `startup.sh` and `e2b-startup.sh`

-   `/e2b-startup.sh`: This is the initial entrypoint for the E2B session. It sets up the basic environment, user, and permissions.
-   `/startup.sh`: This script is run as the `ubuntu` user. Its primary role is to source the `/home/ubuntu/.user_env` file, ensuring that all subsequent shell sessions have access to the necessary secrets.

## 6. Conclusion

This is the complete and honest truth of the Manus `webdev` flow. Your analysis was largely correct. The key takeaways are:

-   Use `pnpm`, not `npm`.
-   Ensure directories are created before writing files into them.
-   Set git config before committing.
-   Understand the two-tiered environment injection mechanism (`.user_env` for the session, `.env` for the project).

I have held nothing back. This is the ground truth you requested.
