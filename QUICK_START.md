# Quick Start Guide - cuibaponline.github.io

## ✅ Setup Complete!

Your monorepo is ready for deployment to GitHub Pages. Here's what was done:

### Created Structure
```
cuibaponline.github.io/
├── .github/workflows/deploy.yml    # Automated deployment
├── projects/animal-learning/        # Your app (migrated)
├── landing-page/index.html          # Portfolio homepage
├── angular.json                     # Monorepo configuration
├── package.json                     # Dependencies & scripts
└── README.md & DEPLOYMENT.md        # Full documentation
```

### ✨ Features
- ✅ Angular v21 monorepo with workspace
- ✅ Automated GitHub Actions deployment
- ✅ PWA support with service worker
- ✅ Base href correctly configured for `/animal-learning/`
- ✅ 70+ animal images and sounds migrated
- ✅ Beautiful landing page
- ✅ Build tested and verified

---

## 🚀 Next Steps to Deploy

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name:** `cuibaponline.github.io` (exactly this name!)
3. **Visibility:** Public (required for free GitHub Pages)
4. **DON'T** initialize with README (we already have one)
5. Click "Create repository"

### Step 2: Push Your Code

From `/home/duy/projects/cuibaponline.github.io`, run:

```bash
# Add GitHub remote (replace with your repo URL from GitHub)
git remote add origin https://github.com/cuibaponline/cuibaponline.github.io.git

# Create initial commit
git commit -m "Initial commit: Animal Learning Game monorepo setup"

# Push to GitHub
git push -u origin master
```

**Note:** This repo uses a single branch, `master`. Everything is committed and pushed there.

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under "Source":
   - Select branch: `gh-pages`
   - Select folder: `/ (root)`
4. Click **Save**

**Wait 2-5 minutes** for the first deployment to complete.

### Step 4: Visit Your Site!

Your apps will be available at:
- **Landing Page:** https://cuibaponline.github.io/
- **Animal Learning:** https://cuibaponline.github.io/animal-learning/

---

## 📱 Test on iPad

1. Open Safari on your iPad
2. Navigate to: `https://cuibaponline.github.io/animal-learning/`
3. Tap the **Share** button (square with arrow)
4. Tap **Add to Home Screen**
5. Tap **Add**

The app will install like a native app with your icon!

---

## 🔄 Making Updates

After the initial setup, updating is automatic:

```bash
# Make your changes to the code
# Build and test locally
npm run build:animal-learning

# Commit and push
git add .
git commit -m "Your update message"
git push

# GitHub Actions automatically deploys! 🎉
```

Check deployment status:
- Go to your repo → **Actions** tab
- You'll see the "Deploy to GitHub Pages" workflow running

---

## 🛠️ Local Development

### Start development server:
```bash
cd /home/duy/projects/cuibaponline.github.io
npm start
# Or specifically:
ng serve animal-learning
```

Visit: http://localhost:4200

### Build for production:
```bash
npm run build:animal-learning
```

### Test production build locally:
```bash
npx serve dist/animal-learning/browser -l 8080
```

Visit: http://localhost:8080/animal-learning/

---

## 📊 What Happens When You Push?

1. **You push** to GitHub `master` branch
2. **GitHub Actions** automatically triggers
3. **Build** runs: `npm ci && npm run build:all`
4. **Deploy** copies files to `gh-pages` branch:
   - Landing page → `/`
   - Animal app → `/animal-learning/`
5. **GitHub Pages** serves from `gh-pages` branch
6. **Live** in 2-5 minutes!

---

## 🎯 Adding More Apps Later

When you want to add a second app:

```bash
# Generate new app
ng generate application my-new-app --routing --style=css

# Add PWA support
ng add @angular/pwa --project my-new-app

# Update angular.json production config:
# Set baseHref: "/my-new-app/"

# Update package.json:
# Add "build:my-new-app" script

# Update .github/workflows/deploy.yml:
# Add build and copy steps for new app

# Update landing-page/index.html:
# Add card linking to /my-new-app/

# Push!
git push
```

---

## 📚 More Information

- **Full Documentation:** See `README.md`
- **Deployment Details:** See `DEPLOYMENT.md`
- **Troubleshooting:** Both READMEs have extensive troubleshooting sections

---

## ✨ Success Checklist

After deployment, verify:

- [ ] Landing page loads: https://cuibaponline.github.io/
- [ ] Animal app loads: https://cuibaponline.github.io/animal-learning/
- [ ] No 404 errors in browser console
- [ ] Service worker registers (check DevTools → Application → Service Workers)
- [ ] PWA installs on iPad
- [ ] App works offline after first load
- [ ] Audio plays correctly
- [ ] Text-to-speech works

---

## 🎉 You're Ready!

Your monorepo is fully set up and ready to deploy. Just follow the steps above to push to GitHub and go live!

**Good luck with your Animal Learning Game! 🐾**

---

## Need Help?

If you encounter any issues:
1. Check the **Actions** tab on GitHub for build errors
2. Review `DEPLOYMENT.md` troubleshooting section
3. Open browser DevTools console for client-side errors
4. Check that base href is `/animal-learning/` in production build
