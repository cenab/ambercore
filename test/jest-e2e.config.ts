import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  setupFilesAfterEnv: ['./jest.setup.ts', './jest.env.ts'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/../src/app/$1',
    '^@core/(.*)$': '<rootDir>/../src/core/$1',
    '^@libs/(.*)$': '<rootDir>/../src/libs/$1',
  },
};

export default config; 