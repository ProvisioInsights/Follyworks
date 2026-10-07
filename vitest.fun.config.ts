// Config for the fun audit (`npm run fun:audit`): same aliases as the game, but runs only the
// audit runner, which is too slow for the normal test suite.
import base from './vite.config.ts';

export default { ...base, test: { ...base.test, include: ['tools/fun/*.fun.ts'], testTimeout: 3_600_000 } };
