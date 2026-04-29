/**
 * Risolve un path relativo agli asset statici di `public/` rispetto alla `base`
 * configurata in vite.config.ts.
 *
 * In dev `import.meta.env.BASE_URL = '/'`.
 * In build con `GITHUB_PAGES=true` diventa `'/Arkamon-Beta/'`.
 *
 * Vite riscrive automaticamente solo gli asset importati staticamente; per i
 * path costruiti a runtime (es. ``/sprites/${id}.png``) bisogna prefissare
 * manualmente con `BASE_URL`.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  const clean = path.startsWith('/') ? path.slice(1) : path
  return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`
}
