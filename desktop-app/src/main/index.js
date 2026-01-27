/**
 * Campfire Widget - Main Process Modules
 *
 * Central export point for all main process modules.
 * Import from here to get access to all state management,
 * IPC handlers, and constants.
 *
 * Usage:
 *   const { UserManager, UserPreferencesStore, IPC_CHANNELS } = require('./src/main');
 */

const constants = require('./constants');
const state = require('./state');
const ipc = require('./ipc');
const integration = require('./integration');
const helpers = require('./helpers');

module.exports = {
  // Constants
  ...constants,
  
  // State management
  ...state,
  
  // IPC handlers
  ...ipc,
  
  // Integration helpers
  ...integration,
  
  // Helper utilities
  ...helpers
};
