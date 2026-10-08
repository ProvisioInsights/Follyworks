// The Follyworks Worker entry. A Worker module may only export handlers, so the API itself lives
// in api.ts (which the unit tests and the Vite dev server import directly).

import { handle, type Env } from './api';

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
};
