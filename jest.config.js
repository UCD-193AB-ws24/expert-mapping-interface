module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '<rootDir>/src/?(*/*/*/)__tests__/**/*.[jt]s?(x)',
    '<rootDir>/src/?(*/*/*/)__tests__/?(*.)+(test).[jt]s?(x)',
    '<rootDir>/src/?(*/*/*/)?(*.)+(test).[jt]s?(x)'
  ],
  moduleFileExtensions: ['js', 'json', 'jsx', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['/node_modules/'],
};
// This configuration allows test files up to 3 levels deep in src/ and its subdirectories
