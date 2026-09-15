import { definition, PLUGIN_ID } from "./v2"
import { server } from "./v1"

/**
 * Dual entrypoint: one package, both OpenCode majors.
 *
 *   OpenCode 2      -> calls `setup(ctx)` (from Plugin.define)
 *   OpenCode 1.18.29+ -> calls `server(input, options)`
 *
 * The two implementations are independent; nothing is translated between them.
 */
export default {
  ...definition,
  server,
}

export { definition, server, PLUGIN_ID }

/** @deprecated OpenCode 1 only. Kept so existing named imports keep resolving. */
export const RandomSoundboardPlugin = server
