/**
 * Campfire Widget - State Management Module
 * 
 * Exports all state management classes.
 */

const User = require('./User');
const UserManager = require('./UserManager');
const UserPreferencesStore = require('./UserPreferencesStore');

module.exports = {
  User,
  UserManager,
  UserPreferencesStore
};
