/**
 * Campfire Widget - State Management Module
 * 
 * Exports all state management classes.
 */

const User = require('./User');
const UserManager = require('./UserManager');
const UserPreferencesStore = require('./UserPreferencesStore');
const AppSettingsStore = require('./AppSettingsStore');

module.exports = {
  User,
  UserManager,
  UserPreferencesStore,
  AppSettingsStore
};
