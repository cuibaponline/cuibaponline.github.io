# Deployment Guide - PWA Apps Portfolio

This guide covers everything needed to set up, configure, and maintain the deployment of PWA apps to GitHub Pages.

## Table of Contents

1. [GitHub Pages Setup](#github-pages-setup)
2. [Automated Deployment with GitHub Actions](#automated-deployment-with-github-actions)
3. [Local Testing](#local-testing)
4. [Manual Deployment](#manual-deployment)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance](#maintenance)

## GitHub Pages Setup

### Prerequisites

- GitHub account
- Repository at `github.com/cuibaponline/cuibaponline.github.io`
- Repository must be public (required for free GitHub Pages)

### Initial Configuration

#### Step 1: Create the Repository

```bash
# This should already exist at:
# https://github.com/cuibaponline/cuibaponline.github.io
```

#### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under "Build and deployment":
   - **Source**: Select `GitHub Actions`
   - This allows custom workflows to deploy

#### Step 3: Configure Repository Settings

1. Go to **Settings** → **General**
2. Ensure "Public" is selected (required for free GitHub Pages)
3. Save settings

#### Step 4: Verify Custom Domain (Optional)

If using a custom domain instead of `cuibaponline.github.io`:

1. Go to **Settings** → **Pages**
2. Under "Custom domain":
   - Enter your domain
   - Add DNS records as instructed by GitHub
3. Enable "Enforce HTTPS"

### Repository Structure for GitHub Pages

The repository name must be exactly: `cuibaponline.github.io`

```
cuibaponline.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── dist/                       # Build output (generated)
│   ├── animal-learning-game/
│   └── ...
├── animal-learning-game/       # Source code
├── README.md
├── DEPLOYMENT.md
└── package.json
```

## Automated Deployment with GitHub Actions

### How It Works

1. **Trigger**: Push to `main` branch
2. **Build**: GitHub Actions runs build commands
3. **Test**: Verify build succeeded
4. **Deploy**: Upload artifacts to `gh-pages` branch
5. **Live**: Available at https://cuibaponline.github.io

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build all apps
        run: npm run build:all

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: cuibaponline.github.io
```

### Understanding the Workflow

| Step | Purpose |
|------|---------|
| Checkout | Gets the latest code from the repository |
| Setup Node.js | Installs Node.js runtime |
| Install | Runs `npm ci` for clean dependency installation |
| Build | Executes `npm run build:all` to build all apps |
| Deploy | Uploads the `dist/` directory to GitHub Pages |

### Build Scripts Required

Ensure your root `package.json` has these scripts:

```json
{
  "scripts": {
    "install": "npm install",
    "build": "ng build",
    "build:all": "npm run build && cd animal-learning-game && npm run build"
  }
}
```

### Checking Deployment Status

1. Go to your GitHub repository
2. Click on **Actions** tab
3. View the workflow run status
4. Click on a run to see detailed logs

### Troubleshooting Workflow Failures

If the workflow fails:

1. **Check the logs**: Click the failed workflow run
2. **Review the error**: Read the error message in the logs
3. **Common issues**:
   - Build failed: Check `npm run build:all`
   - Permission denied: Ensure `github_token` is set
   - Deployment failed: Check `publish_dir` is correct

## Local Testing

### Before Committing and Pushing

Always test locally before pushing to GitHub.

### Build Locally

```bash
# Install dependencies
npm install

# Build all apps for production
npm run build:all

# The dist/ directory contains production builds
ls -la dist/
```

### Test the Build Output

#### Option 1: Using Python HTTP Server

```bash
cd dist
python3 -m http.server 8000
# Visit: http://localhost:8000
```

#### Option 2: Using Node.js HTTP Server

```bash
cd dist
npx http-server
# Visit: http://localhost:8080
```

#### Option 3: Using a Static Server

```bash
# Install serve globally
npm install -g serve

# Serve the dist directory
serve dist

# Visit: http://localhost:3000
```

### Testing Specific App

```bash
# Build one app
cd animal-learning-game
npm run build

# Test the output
cd dist/animal-learning-game
python3 -m http.server 8000
```

### Verifying PWA Features

When testing locally, verify:

1. **App Loads**: Check no 404 errors in console
2. **Assets Load**: Images and sounds load correctly
3. **Service Worker**: Check DevTools → Application → Service Workers
4. **Manifest**: Check DevTools → Application → Manifest
5. **Offline Support**: Disable network and reload
6. **Performance**: Check Lighthouse score

#### Lighthouse Audit

Using Chrome DevTools:

1. Open DevTools (F12)
2. Go to **Lighthouse**
3. Click **Analyze page load**
4. Check scores:
   - Performance: 90+
   - Accessibility: 90+
   - Best Practices: 90+
   - SEO: 90+
   - PWA: 90+

### Testing on Mobile

#### Using Chrome DevTools Remote Debugging

```bash
# On desktop, run local server
python3 -m http.server 8000

# On mobile, visit: http://<your-computer-ip>:8000
# Example: http://192.168.1.100:8000
```

#### Testing on Real Device

1. Find your computer's local IP:
   ```bash
   # On macOS/Linux
   ipconfig getifaddr en0

   # On Windows
   ipconfig | grep "IPv4 Address"
   ```

2. On mobile device, visit: `http://<IP>:8000`

3. Test:
   - Touch interactions work
   - Audio plays correctly
   - Layout is responsive
   - PWA install prompt appears

## Manual Deployment

If automated deployment fails or you need to deploy manually:

### Step 1: Build Locally

```bash
# Clean previous builds
rm -rf dist/

# Install dependencies
npm install

# Build all apps
npm run build:all
```

### Step 2: Create Deployment Branch

```bash
# Create or update gh-pages branch
git checkout --orphan gh-pages
```

### Step 3: Deploy the Build

```bash
# Remove all files except dist
git rm -rf .
rm -rf $(ls -1 | grep -v dist)

# Move build output to root
mv dist/* .
rm -rf dist

# Commit the deployment
git add .
git commit -m "Deploy: $(date)"

# Push to GitHub Pages
git push origin gh-pages -f
```

### Step 4: Return to Main Branch

```bash
git checkout main
```

### Alternative: Using GitHub CLI

```bash
gh repo deploy --branch gh-pages --dir dist
```

## Testing GitHub Pages Deployment

### Verify Deployment Status

1. Go to repository → **Settings** → **Pages**
2. Check "Your site is live at: https://cuibaponline.github.io"

### Test the Live Site

```bash
# Wait 1-2 minutes for deployment to complete
# Then visit: https://cuibaponline.github.io
```

### Check Deployment Logs

1. Go to **Actions** tab
2. Find the workflow run
3. Click to view detailed logs

### Verify All Apps Are Accessible

```bash
# Main site
https://cuibaponline.github.io

# Animal Learning Game
https://cuibaponline.github.io/animal-learning-game
```

## DNS & Custom Domain Setup (Optional)

If using a custom domain:

### Option 1: CNAME Record

1. Go to your domain registrar
2. Create a CNAME record:
   - Name: `@` or leave blank
   - Value: `cuibaponline.github.io`

### Option 2: A Records

1. Go to your domain registrar
2. Create A records pointing to GitHub IPs:
   ```
   A: 185.199.108.153
   A: 185.199.109.153
   A: 185.199.110.153
   A: 185.199.111.153
   ```

### Verify Custom Domain

1. Go to repository → **Settings** → **Pages**
2. Enter custom domain
3. Check "Enforce HTTPS"
4. Wait 5-10 minutes for DNS propagation
5. Visit your custom domain

## Performance Optimization

### Build Optimization

```bash
# Check bundle size
npm run build -- --stats-json

# Analyze bundles
npm install -g webpack-bundle-analyzer
webpack-bundle-analyzer dist/animal-learning-game/stats.json
```

### Service Worker Optimization

- Service Worker caches all assets
- Update Service Worker config in `ngsw-config.json`
- Configure cache duration and refresh strategy

### Image Optimization

- Use `.webp` format for images
- Compress SVGs
- Use responsive images with `srcset`

## Troubleshooting

### Deployment Issues

#### Issue: "Your site is ready to be published"

**Solution**: GitHub Pages is enabled but workflow hasn't run yet.

```bash
# Push a commit to trigger the workflow
git add .
git commit -m "Trigger deployment"
git push origin main
```

#### Issue: Build failed in GitHub Actions

**Solution**: Check the workflow logs

1. Go to **Actions** tab
2. Click the failed workflow
3. Expand the error step
4. Look for error messages

Common causes:
- Missing dependencies: Run `npm install` locally
- Build errors: Check `npm run build:all` locally
- Script not found: Verify scripts in `package.json`

#### Issue: 404 errors for app pages

**Cause**: GitHub Pages routing not configured correctly

**Solution**: Each app needs proper routing

For Angular apps, use:
```typescript
provideRouter(routes, withHashLocationStrategy())
```

Or configure `.nojekyll` file:
```bash
echo "" > dist/.nojekyll
```

#### Issue: Assets return 404

**Cause**: Asset paths not configured correctly

**Solution**: Update asset paths to include base href

In `angular.json`:
```json
{
  "projects": {
    "animal-learning-game": {
      "architect": {
        "build": {
          "options": {
            "baseHref": "/animal-learning-game/"
          }
        }
      }
    }
  }
}
```

#### Issue: Service Worker not working

**Solution**: Verify Service Worker configuration

1. Check `ngsw-config.json` exists
2. Verify service worker build is enabled
3. In DevTools → Application → Service Workers, ensure it's active
4. Check browser console for errors

```bash
# Verify build includes service worker
ls -la dist/animal-learning-game/ngsw.json
```

#### Issue: HTTPS certificate errors

**Solution**: GitHub Pages provides automatic HTTPS

1. Go to **Settings** → **Pages**
2. Check "Enforce HTTPS"
3. Wait 5 minutes for certificate generation

### Performance Issues

#### Slow initial load

**Solution**: Check what's blocking the initial load

1. Open DevTools → Network tab
2. Identify large assets
3. Optimize or defer loading
4. Run Lighthouse audit

#### Large bundle size

**Solution**: Analyze and optimize the build

```bash
npm run build -- --stats-json
webpack-bundle-analyzer dist/animal-learning-game/stats.json
```

#### Service Worker slow to update

**Solution**: Configure update strategy in `ngsw-config.json`

```json
{
  "dataGroups": [
    {
      "name": "api-freshness",
      "urls": ["/api/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxAge": "1h"
      }
    }
  ]
}
```

## Maintenance

### Regular Tasks

#### Weekly

- Monitor GitHub Actions workflow success rate
- Check for build errors in workflow logs
- Review Lighthouse scores

#### Monthly

- Update dependencies: `npm update`
- Run security audit: `npm audit`
- Test on actual devices

#### Quarterly

- Audit bundle sizes
- Review performance metrics
- Plan new features or apps

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update to latest major version
npm install package@latest

# Update Angular
ng update @angular/cli @angular/core
```

### Monitoring Deployments

#### GitHub Actions Dashboard

- Repository → **Actions**
- View workflow status
- Click workflow for details
- Check for consistent failures

#### GitHub Pages Status

- Repository → **Settings** → **Pages**
- Check deployment status
- Verify site is live

#### Performance Monitoring

- Use Google Lighthouse
- Use Chrome DevTools Performance tab
- Monitor Core Web Vitals

### Backup & Recovery

#### Backing Up Code

```bash
# Create a local backup
git clone --mirror https://github.com/cuibaponline/cuibaponline.github.io.git
```

#### Recovery from Failed Deployment

```bash
# Revert to previous commit
git revert <commit-hash>
git push origin main

# GitHub Actions will automatically redeploy
```

## Advanced Configuration

### Custom Build Process

Modify `.github/workflows/deploy.yml` to add custom steps:

```yaml
- name: Generate Assets
  run: npm run generate:assets

- name: Run Tests
  run: npm test

- name: Build with Custom Options
  run: npm run build:all -- --configuration=production
```

### Environment Variables

Store secrets in GitHub Secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click "New repository secret"
3. Add variables
4. Use in workflow:

```yaml
- name: Deploy
  env:
    DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
  run: ./deploy.sh
```

### Conditional Deployments

Only deploy on certain conditions:

```yaml
- name: Deploy
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: |
    npm run build:all
    # Deploy logic
```

## Quick Reference

### Common Commands

```bash
# Local development
npm install
npm start

# Local testing
npm run build:all
cd dist && python3 -m http.server 8000

# Deployment
git add .
git commit -m "Deploy: description"
git push origin main

# Check deployment
# Visit: https://cuibaponline.github.io
# Check: GitHub Repository → Actions
```

### Workflow URLs

- **Repository**: https://github.com/cuibaponline/cuibaponline.github.io
- **Live Site**: https://cuibaponline.github.io
- **Settings**: https://github.com/cuibaponline/cuibaponline.github.io/settings/pages
- **Actions**: https://github.com/cuibaponline/cuibaponline.github.io/actions
- **Secrets**: https://github.com/cuibaponline/cuibaponline.github.io/settings/secrets/actions

## Support

For deployment issues:

1. Check this guide's Troubleshooting section
2. Review GitHub Actions logs
3. Run `npm run build:all` locally to reproduce
4. Check GitHub Pages documentation: https://docs.github.com/en/pages

---

**Happy Deploying!** Your PWA apps are now ready for the world.
