## Hatx Service

TypeScript wrapper for the Hatx REST API (`/v1`).

### Installation

From a private GitHub repo:

```bash
pnpm add git+ssh://git@github.com:igen-info/igen-hatx-ts.git
```

The `prepare` script runs the build automatically on install. If you clone manually, run `pnpm install && pnpm build`.

### Usage

```ts
import { HatxService } from '@igen/hatx';

const hatx = new HatxService({
    baseURL: 'https://api.example.com',
});

const beads = await hatx.getBeadByAllele('A*01:01');

// Customize caching
const cachedHatx = new HatxService({
    baseURL: 'https://api.example.com',
    cache: {
        ttl: 1000 * 60 * 30, // 30 minutes for most data
        serologicalTTL: 1000 * 60 * 5, // 5 minutes for serological responses
    },
});
```

See `src/hatx-service.ts` for the full list of available methods.

### Caching

The service caches responses in-memory using an LRU strategy. By default:

- Most endpoints cache responses for 1 hour.
- Serological endpoints cache responses for 15 minutes to account for their rare mutations.

You can disable caching entirely with `cache: false` or supply custom options:

```ts
const hatx = new HatxService({
    baseURL: 'https://api.example.com',
    cache: {
        max: 2000, // max entries to keep
        ttl: 1000 * 60 * 10, // general TTL
        serologicalTTL: 1000 * 60 * 2, // override for serological data
    },
});
```
