import { homedir } from 'node:os'
import { join } from 'node:path'

// Local cache where `kiwa-astro extract` stores converted output.
export const CACHE_ROOT = join(homedir(), '.cache', 'kiwa-astro')
export const CACHE_REGISTRY = join(CACHE_ROOT, 'registry') // raw registry JSON per item
export const CACHE_CONVERTED = join(CACHE_ROOT, 'converted') // converted .astro/.ts trees
export const CACHE_INDEX = join(CACHE_ROOT, 'index.json') // last seen index.json
