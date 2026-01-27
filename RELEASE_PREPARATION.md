# Release Preparation Guide - v0.0.22 Beta

This document provides a comprehensive checklist for preparing the Campfire Widget for release on GitHub.

**Last Updated:** 2026-01-26

---

## Table of Contents
1. [Security Audit Summary](#security-audit-summary)
2. [Pre-Commit Checklist](#pre-commit-checklist)
3. [Files to Commit](#files-to-commit)
4. [Files NOT to Commit](#files-not-to-commit)
5. [Git Commands](#git-commands)
6. [Post-Release Steps](#post-release-steps)

---

## Security Audit Summary

### ✅ PASSED - No Hardcoded Credentials
- OAuth tokens use placeholder values (`'oauth:YOUR_OAUTH_TOKEN_HERE'`)
- All sensitive data loaded from environment variables or user config
- Twitch Client ID is a public client ID (safe to expose)

### ✅ PASSED - Sensitive Files Excluded
- `.gitignore` properly excludes:
  - `twitch-config.json` (user credentials)
  - `.env` and `.env.local` (environment variables)
  - `node_modules/` (dependencies)
  - `dist/` (build outputs)
  - `*.log` files

### ⚠️ REVIEW NEEDED - Personal Information in Documentation
The following files contain your username/channel name as examples:
- `KNOWN_ISSUES.md` - Error examples mention "heafth"
- `RELEASE_NOTES_*.md` - GitHub URLs contain "jaredheafth"
- `README.md` - GitHub URLs contain "jaredheafth"
- `plans/COMMAND_SYSTEM_REFACTOR_PLAN.md` - Examples use "heafth"

**Action:** These are fine for a personal project. If you want to make it more generic, search and replace example usernames.

### ⚠️ CLEANUP RECOMMENDED - Old/Backup Files
Currently tracked in git:
- `desktop-app/main.js.old`
- `desktop-app/preload.js.old`

**Action:** Consider removing these from git tracking (see commands below).

### ✅ PASSED - No Security Vulnerabilities
- Electron security warnings are development-only
- CSP can be added for production (documented in KNOWN_ISSUES.md)
- No eval() or dangerous patterns in production code

---

## Pre-Commit Checklist

### Code Quality
- [ ] All features tested and working
- [ ] No console.log statements with sensitive data
- [ ] Error handling in place for all async operations
- [ ] Version number updated in `desktop-app/package.json` (currently 0.0.22)

### Documentation
- [ ] README.md is up to date
- [ ] CHANGELOG.md updated with recent changes
- [ ] DEVELOPER_GUIDE.md reflects current architecture
- [ ] KNOWN_ISSUES.md documents outstanding bugs

### Files
- [ ] No `.backup` or `.old` files in commit (or intentionally included)
- [ ] No `node_modules` directories
- [ ] No `dist` build outputs
- [ ] No personal config files (twitch-config.json)

---

## Files to Commit

### Core Application
```
desktop-app/main.js              # Main Electron process
desktop-app/preload.js           # Preload script
desktop-app/package.json         # Dependencies and build config
desktop-app/server/widget.html   # Widget UI
desktop-app/server/dashboard.html # Dashboard UI
desktop-app/server/settings-window.html
desktop-app/server/chat-popout.html
desktop-app/server/viewer-dashboard.html
desktop-app/server/members-window.html
```

### New Files (Untracked)
```
DEVELOPER_GUIDE.md               # Developer documentation
KNOWN_ISSUES.md                  # Bug tracking
DOCUMENTATION_INDEX.md           # Doc navigation
ERROR_HANDLING_STANDARD.md       # Error handling guide
plans/                           # Architecture plans
desktop-app/src/                 # Modular source code
desktop-app/server/chat-popout.html
__tests__/                       # Test files
jest.config.js                   # Test configuration
```

### Documentation (Optional but Recommended)
```
README.md
CHANGELOG.md
RELEASE_NOTES_v0.0.21.md
RELEASE_NOTES_v0.0.22.md (create this)
```

---

## Files NOT to Commit

### Already in .gitignore ✅
```
node_modules/
desktop-app/node_modules/
desktop-app/server/node_modules/
desktop-app/dist/
dist/
*.log
.env
.env.local
desktop-app/server/twitch-config.json
```

### Consider Adding to .gitignore
```
# Development files
*.old
*.backup
*-dev*.html
dashboard-dev2.html
widget-dev2.html

# Session/analysis files (optional)
SESSION_SUMMARY_*.md
*_ANALYSIS*.md
```

### Files to Remove from Git Tracking
```bash
# Remove old backup files from tracking (keeps local copy)
git rm --cached desktop-app/main.js.old
git rm --cached desktop-app/preload.js.old
```

---

## Git Commands

### 1. Check Current Status
```bash
git status
```

### 2. Stage All Changes
```bash
# Stage modified files
git add -A

# Or stage specific files
git add desktop-app/main.js
git add desktop-app/server/widget.html
git add desktop-app/server/dashboard.html
# ... etc
```

### 3. Review What Will Be Committed
```bash
git diff --staged --stat
```

### 4. Commit with Message
```bash
git commit -m "v0.0.22: Command system fixes, dashboard reorganization, auto-return feature

Major Changes:
- Fixed all command handlers (STATE, MOVEMENT, APPEARANCE, ANIMATION)
- Reorganized Commands tab into 6 subtabs
- Added !return command and Auto Return feature
- Fixed duplicate join simulation on startup
- Fixed bot message suppression in chat bubbles
- Added KNOWN_ISSUES.md for bug tracking
- Added DEVELOPER_GUIDE.md for architecture documentation

Bug Fixes:
- Fixed memberMovement userId matching (case-insensitive)
- Fixed LURK/AFK visual overlays
- Fixed movement speed (50% slower)
- Fixed manualStill flag for !still command"
```

### 5. Push to GitHub
```bash
git push origin main
```

### 6. Create a Tag for Release
```bash
git tag -a v0.0.22 -m "Beta release v0.0.22"
git push origin v0.0.22
```

---

## Post-Release Steps

### 1. Build Installers
```bash
cd desktop-app
npm run build:win    # Windows installer
npm run build:mac    # macOS installer (requires macOS)
```

### 2. Create GitHub Release
1. Go to https://github.com/jaredheafth/offlineclub_widget_Campfire/releases
2. Click "Draft a new release"
3. Select tag `v0.0.22`
4. Title: "Campfire Widget v0.0.22 Beta"
5. Upload installers from `desktop-app/dist/`
6. Add release notes (copy from RELEASE_NOTES_v0.0.22.md)
7. Check "This is a pre-release" for beta
8. Publish

### 3. Verify Auto-Updater
- Install previous version
- Check that update notification appears
- Verify update downloads and installs correctly

---

## Quick Reference

### Version Locations
Update version in these files before release:
1. `desktop-app/package.json` - `"version": "0.0.22"`
2. `package.json` (root) - `"version": "0.0.22"`
3. Create `RELEASE_NOTES_v0.0.22.md`

### GitHub Repository
- URL: https://github.com/jaredheafth/offlineclub_widget_Campfire
- Releases: https://github.com/jaredheafth/offlineclub_widget_Campfire/releases

### Support
- Issues: https://github.com/jaredheafth/offlineclub_widget_Campfire/issues
- Discussions: https://github.com/jaredheafth/offlineclub_widget_Campfire/discussions

---

## Security Notes for Users

When users install this app:
1. **Credentials are stored locally** - Twitch tokens are saved in the user's app data folder using Electron's secure storage
2. **No data sent to external servers** - All communication is directly with Twitch's API
3. **Open source** - Users can inspect the code before running
4. **Unsigned installer** - Windows may show a warning; users need to click "More info" → "Run anyway"

---

## Checklist Summary

Before pushing:
- [ ] Security audit passed
- [ ] Version numbers updated
- [ ] CHANGELOG.md updated
- [ ] No sensitive data in code
- [ ] .gitignore is complete
- [ ] Tests pass (if applicable)
- [ ] Documentation is current

After pushing:
- [ ] Build installers
- [ ] Create GitHub release
- [ ] Upload installers
- [ ] Test auto-updater
- [ ] Announce release (if applicable)
