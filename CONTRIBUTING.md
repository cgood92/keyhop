# Contributing to KeyHop

Thank you for helping improve **KeyHop**! Everyone is welcome to fork the repository and submit pull requests.

## How to Contribute

1. **Fork** the repository on GitHub and create a feature branch from `main`.
2. Install dependencies and start the local dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Make your changes and verify all checks pass before opening a pull request:
   ```bash
   npm test
   npm run lint
   npm run build
   ```
4. Open a **Pull Request** targeting `main`.

## Review & Deployment Policy

- All pull requests are verified in read-only isolation by the `CI` workflow.
- Only the repository maintainer (`@cgood92`) can approve, merge into `main`, and trigger deployments to GitHub Pages.
