/**
 * The migration tests, run separately from the unit suite.
 *
 * PGlite loads its WebAssembly through a dynamic import, which needs Node's
 * --experimental-vm-modules flag under Jest. That flag belongs to the process,
 * so it cannot be scoped to a Jest project — and turning it on globally breaks
 * three existing suites, because it changes how the ESM-only packages named in
 * transformIgnorePatterns (otplib, @scure, @noble) resolve.
 *
 * Hence a second Jest run, with the flag, over exactly one file. `npm test`
 * runs both, so none of this is optional or forgettable.
 */
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'ledger-migration\.spec\.ts$',
  transform: {
    '^.+.(t|j)s$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  testEnvironment: 'node',
};
