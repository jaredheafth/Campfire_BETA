# Streamlabs OBS Custom Widget - Campfire Widget Research

## Executive Summary

**YES, this is possible to create in Cursor!** Your campfire widget concept is feasible, though it requires understanding some technical details and limitations.

## What You Want to Build

1. **Central Graphic**: Custom GIF/video upload (campfire or any graphic)
2. **Adjustable Circle**: Invisible circle around the graphic, angle adjustable from top-down (perfect circle) to side-view (ellipse/line)
3. **User Shapes**: Little graphics/shapes appear along the circle's circumference
4. **Chat Command Integration**: When viewers type a custom command, their shape appears with username
5. **Settings**: Subscriber-only, Prime subs, bits charge, etc.
6. **Future**: Sprite support for custom user graphics

## Technical Feasibility

### ✅ POSSIBLE Features

1. **Custom Graphics/GIFs**
   - ✅ Can be uploaded and displayed
   - ✅ Widgets support HTML5 video and animated GIFs
   - ⚠️ **Limitation**: Files need to be hosted somewhere (can't upload directly to widget)

2. **Adjustable Circle Perspective**
   - ✅ Fully possible using CSS transforms and JavaScript
   - ✅ Can create perfect circle → ellipse → line transition
   - ✅ Can be controlled via widget settings panel

3. **Dynamic Shape Placement**
   - ✅ Shapes can be positioned along circle circumference using trigonometry
   - ✅ Usernames can be displayed above shapes
   - ✅ Shapes can be simple CSS shapes or images/sprites

4. **Chat Command Integration**
   - ✅ Possible, but requires one of these approaches:
     - **Option A**: Streamlabs Cloudbot + WebSocket/API integration
     - **Option B**: Direct Twitch/YouTube chat API integration
     - **Option C**: Streamlabs Event API (if available for custom widgets)

5. **User Permissions (Subs, Prime, Bits)**
   - ✅ Possible via Streamlabs API or platform API
   - ✅ Requires API calls to check user status
   - ⚠️ **Requirement**: Streamlabs account connection or platform API access

6. **Sprite Support**
   - ✅ Can be implemented as image uploads
   - ⚠️ **Limitation**: Files need hosting (same as GIF issue)

### ⚠️ LIMITATIONS & CHALLENGES

1. **File Hosting**
   - Widgets are HTML/CSS/JS that run in a browser source
   - Custom GIFs/sprites need to be hosted somewhere accessible
   - **Solutions**:
     - Host on GitHub Pages, Netlify, or similar
     - Use base64 encoding for small files (not recommended for GIFs)
     - Streamer uploads to their own server/CDN

2. **Chat Integration**
   - Streamlabs widgets don't have built-in chat listeners
   - Need to use external service:
     - Streamlabs API/WebSocket
     - Twitch/YouTube Chat API directly
     - Cloudbot webhooks (if supported)
   - **Complexity**: Medium - requires real-time data handling

3. **Widget Hosting**
   - Custom widgets must be hosted as web pages
   - Added to SLOBS as "Browser Source"
   - **Can develop in Cursor**, but needs web hosting for final deployment

4. **Settings/Configuration**
   - Widget settings typically stored in:
     - URL parameters
     - LocalStorage (browser-based)
     - External database/API
   - **Challenge**: Making settings persistent and accessible

5. **Performance**
   - Multiple animated elements can impact performance
   - Need to optimize rendering
   - Limit number of simultaneous users if needed

## Development Approach

### Architecture Overview

```
┌─────────────────────────────────────┐
│  Custom HTML/CSS/JS Widget          │
│  (Hosted on web server)             │
├─────────────────────────────────────┤
│  - Campfire GIF/Video Display       │
│  - Adjustable Circle (CSS Transform)│
│  - User Shape Management            │
│  - Username Display                 │
└─────────────────────────────────────┘
           ↕ (API/WebSocket)
┌─────────────────────────────────────┐
│  Chat Integration Layer             │
│  - Streamlabs API                   │
│  - OR Twitch/YouTube Chat API       │
│  - Command Detection                │
│  - User Permission Checking         │
└─────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Chat Integration**: 
  - Streamlabs API (preferred if using SLOBS)
  - OR tmi.js (Twitch) / YouTube Chat API
- **Hosting**: Any static hosting (GitHub Pages, Netlify, Vercel, etc.)
- **Storage**: 
  - LocalStorage for settings
  - External API for user data/permissions

### Development Steps

1. **Create Widget Structure** (HTML/CSS/JS)
   - Campfire display area
   - Circle calculation and rendering
   - Shape placement algorithm
   - Username display

2. **Implement Settings Panel**
   - Circle angle control
   - Command customization
   - Permission settings (subs, bits, etc.)
   - GIF upload interface (or URL input)

3. **Chat Integration**
   - Connect to chat API
   - Listen for commands
   - Validate user permissions
   - Trigger shape creation

4. **Testing**
   - Local testing with mock data
   - Integration testing with Streamlabs
   - Performance optimization

5. **Deployment**
   - Host widget files
   - Add as Browser Source in SLOBS
   - Configure settings

## Complexity Assessment

**Overall Complexity: MEDIUM to HIGH**

### Simple Parts:
- ✅ HTML/CSS layout
- ✅ Circle rendering and angle adjustment
- ✅ Basic shape placement
- ✅ Username display

### Medium Complexity:
- ⚠️ Chat API integration
- ⚠️ User permission checking
- ⚠️ Settings persistence
- ⚠️ File upload/hosting solution

### Advanced Parts:
- 🔴 Real-time WebSocket handling
- 🔴 Performance optimization with many users
- 🔴 Sprite animation system
- 🔴 Cross-platform compatibility (Twitch/YouTube)

## Can We Build This in Cursor?

**YES!** Here's what we can do:

1. ✅ **Write all code** in Cursor (HTML, CSS, JavaScript)
2. ✅ **Test locally** using a local web server
3. ✅ **Create mock chat** for development/testing
4. ⚠️ **Final deployment** requires:
   - Hosting the widget files online
   - Adding as Browser Source in SLOBS
   - Testing with live chat

## Recommended Next Steps

1. **Start with MVP** (Minimum Viable Product):
   - Basic campfire display
   - Fixed circle with shapes
   - Manual trigger (button) instead of chat command
   - Simple shapes (circles/squares)

2. **Add Chat Integration**:
   - Integrate Streamlabs API or Twitch Chat
   - Command detection
   - Basic user validation

3. **Enhance Features**:
   - Adjustable circle angle
   - Permission system
   - Custom graphics upload
   - Sprite support

4. **Polish & Optimize**:
   - Performance tuning
   - Better UI/UX
   - Error handling
   - Documentation

## Potential Issues to Consider

1. **Rate Limiting**: Chat APIs have rate limits - need to handle spam
2. **User Limits**: Too many users = performance issues (need max limit)
3. **Persistence**: User positions might reset on widget reload
4. **Cross-Platform**: Different APIs for Twitch vs YouTube
5. **Security**: Validate all user inputs, prevent XSS attacks
6. **Moderation**: Handle banned users, inappropriate usernames

## Conclusion

**Your idea is absolutely feasible!** The main challenges are:
- Chat integration (medium complexity)
- File hosting for custom graphics
- Real-time performance with many users

We can absolutely build this in Cursor. The widget will be a standard web application that gets loaded as a Browser Source in Streamlabs OBS.

**UPDATE: Custom Widget Option Discovered!**

After further research, **Streamlabs DOES support Custom Widgets** where you can paste HTML/CSS/JavaScript directly into the Streamlabs dashboard - **NO HOSTING REQUIRED!**

### Custom Widget vs Browser Source

**Custom Widget (EASIER - Recommended):**
- ✅ Paste code directly into Streamlabs Custom Widget editor
- ✅ No web hosting needed
- ✅ Code is embedded in Streamlabs
- ⚠️ Settings need to be embedded in code (or use URL parameters)
- ⚠️ Need to regenerate code to update settings

**Browser Source (Alternative):**
- ✅ Easy to update (just refresh)
- ✅ Settings can sync via LocalStorage
- ⚠️ Requires web hosting (GitHub Pages, Netlify, etc.)
- ⚠️ Need to keep files online

**Both methods work!** Custom Widget is easier for deployment, Browser Source is easier for development/testing.

---

## MVP Status: ✅ COMPLETE

The MVP has been built with:
1. ✅ Visual widget with campfire display
2. ✅ Adjustable circle perspective
3. ✅ User shapes with usernames
4. ✅ Settings dashboard
5. ✅ Support for both Custom Widget and Browser Source methods
6. ✅ LocalStorage and URL parameter settings support
