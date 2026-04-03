# IDP Test

An Internal Developer Portal UI for scaffolding AWS CDK deployments from [cdk-patterns/serverless](https://github.com/cdk-patterns/serverless).

Fill in your GitHub and AWS details, pick a deployment pattern, and download a ready-to-run bash script that deploys the chosen CDK stack and pushes the result to your repo.

## Live demo

Hosted on GitHub Pages: **https://hfoster1.github.io/idp-test/**

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build   # output in dist/
```

## Deploy to GitHub Pages

The site is deployed via the `gh-pages` branch. To publish a new version:

```bash
npm run build
npx gh-pages -d dist
```

Then in your repo go to **Settings → Pages → Source** and set the branch to `gh-pages` / `/ (root)`.

> The `vite.config.js` already sets `base: "/idp-test/"` so all assets resolve correctly under the Pages URL.

## Tech

- [React 18](https://react.dev)
- [Vite 5](https://vitejs.dev)
- [cdk-patterns/serverless](https://github.com/cdk-patterns/serverless) — CDK pattern library
