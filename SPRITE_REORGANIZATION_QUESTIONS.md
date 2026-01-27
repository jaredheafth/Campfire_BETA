# Sprite System Questions - Before Reorganization

## Current Understanding

**Current Structure:**
- `circles/` folder contains:
  - `3dgifmaker92871.gif` (Shadow GIF - needs to move to new folder)
  - `circle-40x40.svg` (Fallback SVG - stays here)
- `rpg-characters/` folder (Adventurers - stays)
- `pixel-morphs/` folder (Morphs - stays)

**Proposed Structure:**
- `circles/` folder → Only SVG fallback
- `shadows/` folder → Shadow GIFs (NEW)
- `rpg-characters/` folder → Adventurer GIFs (unchanged)
- `pixel-morphs/` folder → Morph GIFs (unchanged)

**Sprite Modes:**
- `circle` mode → Currently uses "circleSprites" but should use "shadowSprites"
- `rpg-characters` mode → Uses "rpgSprites"
- `pixel-morphs` mode → Uses "morphSprites"

## Questions for Clarification

### 1. Sprite Selection Per User Per Mode

You mentioned: "each user also needs to have their sprite saved to their username. so that when the streamer chooses a sprite option, there is a saved sprite per option for an individual user."

**Question:** Should the system work like this?
- User "Alice" joins with sprite mode = "shadows" → Gets assigned shadow GIF #3
- Streamer switches to "adventurers" mode → Alice gets assigned adventurer GIF #5
- Streamer switches back to "shadows" → Alice gets back shadow GIF #3 (her saved one)

**OR:**
- User "Alice" joins → Gets random shadow sprite
- Streamer switches mode → Alice gets NEW random sprite for that mode (not saved)
- But if Alice manually selected a sprite, that selection is saved per mode?

### 2. Shadow GIFs

**Question:** Are there more shadow GIFs beyond `3dgifmaker92871.gif`, or is that the only one? Should I create the shadows folder structure expecting multiple files or just one?

### 3. Fallback Behavior

You said: "the svg circle should be its own default that is used when any of the app defaults don't work"

**Question:** Should the SVG circle fallback trigger when:
- A) No sprites are loaded for the current mode? (e.g., shadowSprites array is empty)
- B) A user's assigned sprite fails to load?
- C) Both A and B?
- D) When sprite mode is set to a specific "circle" mode that uses SVG?

### 4. Code Changes Needed

Based on your requirements, I'll need to:
1. Create `shadows/` folder and move `3dgifmaker92871.gif` there
2. Update dashboard code to load from `shadows/` instead of `circles/`
3. Rename `circleSprites` to `shadowSprites` throughout codebase
4. Update sprite mode "circle" to use shadowSprites
5. Implement per-user per-mode sprite saving
6. Fix fallback to use SVG circle when no sprites available

**Question:** Does this plan sound correct?

### 5. localStorage Keys

Currently using:
- `circleSprites` (needs to become `shadowSprites`)
- `rpgSprites` (stays)
- `morphSprites` (stays)

**Question:** Should I:
- A) Keep `circleSprites` key for backward compatibility, but load from shadows folder?
- B) Change to `shadowSprites` key (will clear existing data)?
- C) Support both during migration?

---

Please answer these questions so I can implement the fix correctly!
