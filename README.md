# PWA Apps Portfolio - cuibaponline.github.io

Welcome to the Progressive Web Apps portfolio! This monorepo contains a collection of educational PWA applications built with modern Angular v21, deployed to GitHub Pages.

## Project Overview

This is a **monorepo structure** that hosts multiple PWA applications at [https://cuibaponline.github.io](https://cuibaponline.github.io). Each app is a standalone Angular project that can be independently developed, built, and deployed.

### Why Monorepo?

- **Single source of truth** for all PWA apps
- **Shared CI/CD pipeline** with GitHub Actions
- **Centralized documentation** and configuration
- **Easy management** of related projects
- **Simplified deployment** to GitHub Pages

## Available Apps

### 1. Animal Learning Game

An interactive educational PWA designed to help toddlers learn English animal names through engaging gameplay.

- **Technology**: Angular v21, Progressive Web App (PWA)
- **Features**: 36 animals, audio pronunciation, offline support, tap-to-learn interface
- **Target Audience**: Toddlers (2-4 years old)
- **Location**: `/animal-learning-game`
- **Status**: Active Development

**Learn more**: See [Animal Learning Game README](/animal-learning-game/README.md)

### Future Apps

This portfolio is designed to grow. New educational PWA apps can be added following the established patterns.

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm 10.x or higher
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/cuibaponline/cuibaponline.github.io.git
cd cuibaponline.github.io
```

### Development

```bash
# Install all dependencies
npm install

# Start development server (Animal Learning Game)
npm start

# Or start a specific app
cd animal-learning-game
npm start
```

The app will be available at `http://localhost:4200`

### Production Build

```bash
# Build all apps for production
npm run build:all

# Or build a specific app
cd animal-learning-game
npm run build
```

Build artifacts are generated in the `dist/` directories.

## Monorepo Structure

```
cuibaponline.github.io/
├── animal-learning-game/       # Main PWA app (toddler education)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/     # Angular components
│   │   │   ├── services/       # Business logic services
│   │   │   ├── models/         # TypeScript interfaces
│   │   │   └── app.ts          # Root component
│   │   └── index.html
│   ├── public/
│   │   ├── assets/
│   │   │   ├── images/         # Animal images
│   │   │   └── sounds/         # Animal audio files
│   │   ├── icons/              # PWA icons
│   │   └── manifest.webmanifest
│   ├── package.json
│   ├── angular.json
│   ├── tsconfig.json
│   ├── ngsw-config.json        # Service Worker config
│   └── README.md               # App-specific documentation
├── README.md                   # This file
├── DEPLOYMENT.md               # Deployment guide
├── package.json                # Root package configuration
└── .github/
    └── workflows/
        └── deploy.yml          # GitHub Actions CI/CD
```

## Technology Stack

### Core

- **Angular v21.x** - Latest Angular framework with standalone components
- **TypeScript 5.9+** - Static type checking
- **RxJS 7.8+** - Reactive programming

### PWA & Web APIs

- **@angular/service-worker** - Service Worker support
- **Web Audio API** - Audio playback
- **Web Speech API** - Text-to-speech
- **Manifest.json** - PWA installability

### Build & Deployment

- **Angular CLI** - Build tooling
- **GitHub Pages** - Static hosting
- **GitHub Actions** - CI/CD automation

### Development

- **Vitest** - Unit testing
- **TypeScript** - Language and tooling

## How to Add a New App

### 1. Create the App Directory

```bash
mkdir new-app-name
cd new-app-name
```

### 2. Initialize as Angular Standalone App

```bash
# You can manually set up Angular or use Angular CLI
npm init -y
npm install --save-dev @angular/cli@21
```

### 3. Configure as PWA

- Add `@angular/service-worker` to dependencies
- Create `ngsw-config.json` for Service Worker
- Add PWA manifest at `public/manifest.webmanifest`
- Configure Angular build in `angular.json`

### 4. Update Root Package Scripts

Add corresponding build script in the root `package.json`:

```json
{
  "scripts": {
    "build:all": "npm run build && cd new-app-name && npm run build"
  }
}
```

### 5. Add Documentation

Create `README.md` in your app directory following the Animal Learning Game pattern.

### 6. GitHub Pages Configuration

The app will automatically be deployed to `https://cuibaponline.github.io/` via GitHub Actions.

## Deployment

This project uses **GitHub Actions** for automatic deployment.

### What Happens Automatically

1. Push changes to `main` branch
2. GitHub Actions triggers the workflow
3. Dependencies are installed
4. Apps are built for production
5. Build artifacts are deployed to GitHub Pages
6. Live at: https://cuibaponline.github.io

### Manual Deployment

```bash
# Build all apps
npm run build:all

# Push to GitHub
git add .
git commit -m "Deploy: update"
git push origin main
```

### Testing Before Deploy

```bash
# Build all apps locally
npm run build:all

# Test the build output
cd dist/animal-learning-game
python -m http.server 8000
# Visit http://localhost:8000
```

For detailed deployment instructions, see [DEPLOYMENT.md](/DEPLOYMENT.md)

## Development Workflow

### Standard Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Make changes in the app directory
4. Test locally: `npm start`
5. Build for production: `npm run build`
6. Commit and push to GitHub
7. GitHub Actions automatically deploys

### Multiple Apps

```bash
# Work on different apps
cd animal-learning-game
npm start

# In another terminal
cd ../another-app
npm start
```

## Feature Highlights

### Angular v21 Modern Features

- **Standalone Components** - No NgModules required
- **Signals** - Fine-grained reactivity for state management
- **Zoneless Change Detection** - Improved performance
- **New Control Flow** - `@if`, `@for`, `@switch` syntax
- **inject() Function** - Simplified dependency injection
- **NgOptimizedImage** - Automatic image optimization

### PWA Capabilities

- **Offline Support** - Works without internet connection
- **Installable** - Add to home screen on mobile/tablet
- **App-like Experience** - Fullscreen, no browser UI
- **Push Notifications Ready** - Foundation for future features
- **Works Across Devices** - Responsive design

## Performance Targets

- Initial load: < 3 seconds
- Bundle size: < 500KB (production)
- Lighthouse scores: 90+
- Service Worker caching: All static assets
- Support: Modern browsers (Chrome, Safari, Edge, Firefox)

## Browser Support

- Chrome 120+
- Safari 15+ (iOS and macOS)
- Edge 120+
- Firefox 121+

## Contributing

When adding new apps:

1. Follow the Angular v21 standalone component pattern
2. Implement PWA features (manifest, service worker)
3. Add comprehensive README documentation
4. Ensure responsive design (mobile-first)
5. Test on actual devices before deploying
6. Update main README with app information

## Troubleshooting

### Build Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clear Angular cache
rm -rf .angular
```

### Deployment Problems

See [DEPLOYMENT.md](/DEPLOYMENT.md) for troubleshooting guide.

### Performance Issues

- Check bundle sizes: `npm run build -- --stats-json`
- Profile with Chrome DevTools
- Check Lighthouse scores
- Monitor service worker caching

## Resources

### Documentation

- [DEPLOYMENT.md](/DEPLOYMENT.md) - Detailed deployment guide
- [Animal Learning Game README](/animal-learning-game/README.md) - App-specific docs
- [Angular Official Docs](https://angular.dev/)
- [PWA Docs](https://web.dev/progressive-web-apps/)

### Links

- **Live Site**: https://cuibaponline.github.io
- **GitHub Repository**: https://github.com/cuibaponline/cuibaponline.github.io
- **GitHub Pages Documentation**: https://docs.github.com/en/pages

## License

This project is free to use for educational and personal purposes.

## Support & Feedback

If you encounter issues or have suggestions for improvement:

1. Check the relevant app's README
2. Review [DEPLOYMENT.md](/DEPLOYMENT.md) for deployment issues
3. Create an issue on the GitHub repository
4. Submit a pull request with improvements

---

**Happy Learning!** Build amazing educational PWA apps and deploy them effortlessly.
