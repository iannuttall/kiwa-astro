import { posix, resolve, relative, sep, join } from 'node:path'
import type { KiwaAstroConfig } from './config.js'
import type { RegistryFile } from './registry.js'
import { convertTsx } from './convert.js'

export type InstallFile = {
  path: string
  content: string
}

export type PreparedRegistryFile = {
  registryPath: string
  files: InstallFile[]
}

export function prepareCachedRegistryFile(file: RegistryFile, itemName: string, cacheRoot: string): PreparedRegistryFile {
  const registryPath = validateRegistryPath(file.path)
  const baseName = file.name.replace(/\.tsx?$/, '')

  if (registryPath.startsWith('components/ui/')) {
    return {
      registryPath,
      files: convertedFiles(file.content, baseName, resolve(cacheRoot, 'ui', itemName)),
    }
  }

  if (registryPath.startsWith('components/blocks/')) {
    const subdir = registryPath.replace(/^components\/blocks\//, '').split('/').slice(0, -1).join('/')
    return {
      registryPath,
      files: convertedFiles(file.content, baseName, resolve(cacheRoot, 'blocks', subdir, itemName)),
    }
  }

  if (registryPath.startsWith('lib/')) {
    const rel = registryPath.replace(/^lib\//, '')
    if (!/\.tsx?$/.test(rel)) throw new Error(`Unsupported lib file type: ${registryPath}`)
    return {
      registryPath,
      files: [{ path: resolve(cacheRoot, 'lib', itemName, rel), content: file.content }],
    }
  }

  throw new Error(`Unsupported registry path: ${registryPath}`)
}

export function prepareRegistryFile(file: RegistryFile, cfg: KiwaAstroConfig, cwd: string): PreparedRegistryFile {
  const registryPath = validateRegistryPath(file.path)
  const baseName = file.name.replace(/\.tsx?$/, '')

  if (registryPath.startsWith('components/ui/')) {
    return {
      registryPath,
      files: convertedFiles(file.content, baseName, safeProjectDir(cwd, cfg.componentsDir)),
    }
  }

  if (registryPath.startsWith('components/blocks/')) {
    const rest = registryPath.replace(/^components\/blocks\//, '')
    const subdir = rest.split('/').slice(0, -1).join('/')
    return {
      registryPath,
      files: convertedFiles(file.content, baseName, safeProjectDir(cwd, join(cfg.blocksDir, subdir))),
    }
  }

  if (registryPath.startsWith('lib/')) {
    const rel = registryPath.replace(/^lib\//, '')
    if (!/\.tsx?$/.test(rel)) throw new Error(`Unsupported lib file type: ${registryPath}`)
    const outDir = safeProjectDir(cwd, cfg.libDir)
    return {
      registryPath,
      files: [{ path: resolve(outDir, rel), content: file.content }],
    }
  }

  throw new Error(`Unsupported registry path: ${registryPath}`)
}

export function validateRegistryPath(path: string): string {
  if (!path) throw new Error('Registry file path is empty')
  if (path.includes('\0')) throw new Error(`Registry file path contains a null byte: ${path}`)
  if (path.includes('\\')) throw new Error(`Registry file path must use POSIX separators: ${path}`)
  if (path.startsWith('/')) throw new Error(`Registry file path must be relative: ${path}`)

  const normal = posix.normalize(path)
  if (normal !== path || normal === '.' || normal === '..' || normal.startsWith('../') || normal.includes('/../')) {
    throw new Error(`Unsafe registry file path: ${path}`)
  }
  return normal
}

export function safeProjectDir(cwd: string, configuredDir: string): string {
  if (!configuredDir) throw new Error('Configured output directory is empty')
  if (configuredDir.includes('\0')) throw new Error(`Configured output directory contains a null byte: ${configuredDir}`)

  const projectRoot = resolve(cwd)
  const target = resolve(projectRoot, configuredDir)
  const rel = relative(projectRoot, target)
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(configuredDir) === configuredDir) {
    throw new Error(`Configured output directory must stay inside the project: ${configuredDir}`)
  }
  return target
}

function convertedFiles(source: string, baseName: string, outDir: string): InstallFile[] {
  const result = convertTsx(source, baseName)
  return [
    ...result.astroFiles.map((file) => ({ path: resolve(outDir, file.name), content: file.content })),
    { path: resolve(outDir, result.barrel.name), content: result.barrel.content },
  ]
}
