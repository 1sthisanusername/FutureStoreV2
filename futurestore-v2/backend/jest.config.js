module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
  ],
  coverageThreshold: { global: { branches: 60, functions: 60, lines: 60 } },
  verbose: true,
};
