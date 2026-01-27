# Campfire Widget - App Vision

## What is Campfire Widget?

**Campfire Widget** is a desktop application that creates an interactive, visual community experience for Twitch streamers. It transforms passive chat viewers into active participants by representing them as animated sprites gathered around a virtual campfire on the stream overlay.

## Core Vision

> *"Turn your chat into a living, breathing community that viewers can see and interact with."*

The Campfire Widget bridges the gap between text-based chat and visual engagement. When viewers join the campfire, they become visible characters on screen—creating a sense of presence, belonging, and community that traditional chat cannot provide.

## Key Features

### 🔥 Visual Community Presence
- **Animated Sprites**: Each viewer is represented by a customizable animated character
- **Real-time Movement**: Sprites move around the campfire, creating a dynamic scene
- **State Indicators**: Visual cues show who's active, sleepy, AFK, or lurking
- **Customization**: Viewers can choose their sprite, colors, and animations

### 💬 Chat Integration
- **Twitch Chat Commands**: Full command system for viewer interaction
- **Popout Chat Window**: Dedicated chat window with emoji and emote pickers
- **Message Persistence**: Chat history retained across window opens/closes
- **Bot Responses**: Customizable bot messages for all commands

### 🎮 Interactive Commands
| Category | Commands | Purpose |
|----------|----------|---------|
| **State** | !join, !leave, !afk, !lurk, !return | Control campfire membership |
| **Movement** | !cw, !ccw, !still, !roam, !wander | Control sprite movement |
| **Appearance** | !sprite, !color, !next, !back, !random | Customize appearance |
| **Animation** | !spin, !dance, !sparkle | Trigger animations |
| **App** | !who | List users around the campfire |

### 🛠️ Streamer Dashboard
- **Member Management**: View, mute, kick, or manage all campfire members
- **Command Customization**: Edit triggers, responses, and enable/disable commands
- **Cooldown System**: Global or per-user cooldowns for all commands
- **Settings Control**: Configure Twitch integration, bot accounts, and preferences

### 🎨 Sprite System
- **Default Sprites**: RPG characters, pixel morphs, and more included
- **Custom Sprites**: Upload and use custom animated GIFs
- **Sprite Converter**: Built-in tool to convert sprite sheets to animations
- **Per-User Customization**: Each viewer can have their own unique sprite

## Architecture

### Desktop Application (Electron)
- **Main Process**: Handles Twitch IRC, user state, and IPC communication
- **Widget Window**: OBS-compatible overlay showing the campfire scene
- **Dashboard Window**: Streamer control panel
- **Popout Chat**: Standalone chat window

### State Management
- **UserManager**: Centralized user state management
- **User Class**: Individual user state, preferences, and sprite data
- **Persistence**: User preferences saved locally

### Twitch Integration
- **OAuth Authentication**: Secure token-based authentication
- **IRC Connection**: Real-time chat message handling
- **Helix API**: Emote fetching, user data, and more
- **Dual Account Support**: Separate streamer and bot accounts

## Future Plans

### Phase 1: Enhanced Interactivity
- [ ] **User Interactions**: Allow sprites to interact with each other
- [ ] **Mini-games**: Simple games viewers can play together
- [ ] **Achievements**: Reward system for active community members
- [ ] **Sound Effects**: Audio feedback for actions and events

### Phase 2: Advanced Customization
- [ ] **Theme System**: Multiple campfire themes (beach, space, forest)
- [ ] **Custom Animations**: User-uploadable animation sets
- [ ] **Particle Effects**: Weather, sparkles, and ambient effects
- [ ] **Scene Editor**: Visual tool for arranging the campfire scene

### Phase 3: Community Features
- [ ] **Leaderboards**: Track most active community members
- [ ] **Events**: Scheduled community gatherings
- [ ] **Raids Integration**: Special effects when raids occur
- [ ] **Subscriber Perks**: Exclusive sprites/features for subscribers

### Phase 4: Platform Expansion
- [ ] **YouTube Integration**: Support for YouTube Live chat
- [ ] **Kick Integration**: Support for Kick streaming platform
- [ ] **Web Version**: Browser-based version for non-desktop users
- [ ] **Mobile Companion**: View campfire status on mobile

## Technical Roadmap

### Near-term
- [ ] Performance optimization for large communities
- [ ] Improved sprite loading and caching
- [ ] Better error handling and recovery
- [ ] Automated testing coverage

### Mid-term
- [ ] Plugin system for community extensions
- [ ] API for third-party integrations
- [ ] Cloud sync for user preferences
- [ ] Analytics dashboard

### Long-term
- [ ] Machine learning for spam detection
- [ ] AI-powered moderation assistance
- [ ] Real-time translation support
- [ ] Accessibility improvements

## Design Principles

1. **Community First**: Every feature should enhance the sense of community
2. **Simplicity**: Easy to set up, easy to use, easy to customize
3. **Performance**: Lightweight overlay that doesn't impact stream quality
4. **Reliability**: Stable connections and graceful error handling
5. **Extensibility**: Built to grow with new features and integrations

## Target Audience

- **Streamers**: Looking to increase viewer engagement and retention
- **Communities**: Groups that value visual presence and interaction
- **Creative Streamers**: Artists, musicians, and creators who want unique overlays
- **Gaming Streamers**: Those who want RPG-style community representation

## Success Metrics

- Active daily users around the campfire
- Average session duration per viewer
- Command usage frequency
- Community retention rates
- Streamer satisfaction scores

---

*Campfire Widget is developed by The Offline Club with the goal of making streaming communities more visible, interactive, and connected.*

**Current Version**: 0.1.1  
**Status**: Beta Testing  
**License**: MIT
