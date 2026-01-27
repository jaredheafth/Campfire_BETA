{
  "testEnvironment": "node",
  "testMatch": ["**/__tests__/**/*.test.js", "**/*.test.js"],
  "collectCoverageFrom": [
    "desktop-app/main.js",
    "desktop-app/server/**/*.js",
    "!desktop-app/server/node_modules/**",
    "!**/node_modules/**"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 50,
      "functions": 50,
      "lines": 50,
      "statements": 50
    }
  },
  "testTimeout": 10000,
  "verbose": true
}
