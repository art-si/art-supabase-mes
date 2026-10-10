import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig } from 'vite'

const applicationRoot = fileURLToPath(new URL('.', import.meta.url))

function isPlatformRoot(candidate: string | undefined): candidate is string {
  if (!candidate) return false
  const packageFile = path.join(candidate, 'package.json')
  if (!existsSync(packageFile)) return false

  try {
    const packageJson = JSON.parse(readFileSync(packageFile, 'utf8')) as { name?: string }
    return packageJson.name === 'art-supabase-pro'
  } catch {
    return false
  }
}

function resolvePlatformRoot(): string {
  const candidates = [
    process.env.ART_SUPABASE_PLATFORM_ROOT,
    path.resolve(applicationRoot, '../..'),
    path.resolve(applicationRoot, '../art-supabase-pro'),
    path.resolve(applicationRoot, 'node_modules/art-supabase-pro')
  ]
  const resolved = candidates.find(isPlatformRoot)
  if (!resolved) {
    throw new Error('未找到 art-supabase-pro 平台运行时，请先执行 pnpm install')
  }
  return realpathSync(resolved)
}

const platformRoot = resolvePlatformRoot()

if (process.argv.includes('--typecheck')) {
  const checkerPath = path.join(platformRoot, 'scripts/module-typecheck.mjs')
  const { typecheckModule } = await import(pathToFileURL(checkerPath).href)
  process.exitCode = typecheckModule({ applicationRoot, platformRoot })
}

export default defineConfig(async ({ mode }) => {
  const factoryPath = path.join(platformRoot, 'scripts/module-vite-config.mjs')
  const { createModuleViteConfig } = await import(pathToFileURL(factoryPath).href)

  return createModuleViteConfig({
    appCode: 'mes',
    applicationRoot,
    componentScope: 'without-finance-shell',
    defaultPort: 3019,
    mode,
    platformRoot
  })
})
