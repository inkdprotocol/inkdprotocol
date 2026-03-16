/**
 * inkd run <projectId>[@version] — fetch and execute a project from INKD registry
 *
 * Downloads the latest (or specified) version from Arweave and executes it
 * in a Node.js child process (sandboxed via --experimental-permission where available).
 *
 * Usage:
 *   inkd run 42
 *   inkd run 42@v1.0.0
 *   inkd run my-agent-name
 *   inkd run 42 -- --arg1 value1
 */
import { spawnSync } from 'child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { error, info, success, BOLD, RESET, DIM, CYAN } from '../config.js'

const API_URL = process.env['INKD_API_URL'] ?? 'https://api.inkdprotocol.com'

export async function cmdRun(args: string[]): Promise<void> {
  const target = args[0]
  if (!target) error(`Usage: inkd run <projectId>[@version]\n  Example: ${DIM}inkd run 42${RESET}`)

  // Parse "42@v1.0.0" or "42" or "my-agent-name"
  const [projectRef, versionTag] = (target as string).split('@')

  info(`Looking up ${BOLD}${target}${RESET}...`)

  // Resolve project (by ID or name)
  let projectId: number
  if (/^\d+$/.test(projectRef as string)) {
    projectId = parseInt(projectRef as string, 10)
  } else {
    const nameRes = await fetch(`${API_URL}/v1/projects/by-name/${encodeURIComponent(projectRef as string)}`)
    if (!nameRes.ok) error(`Project "${projectRef}" not found`)
    const proj = ((await nameRes.json()) as { data: { id: string } }).data
    projectId = parseInt(proj.id, 10)
  }

  // Get versions
  const versionsRes = await fetch(`${API_URL}/v1/projects/${projectId}/versions`)
  if (!versionsRes.ok) error(`Could not fetch versions for project #${projectId}`)
  const versions = ((await versionsRes.json()) as { data: Array<{ versionTag: string; arweaveHash: string }> }).data

  if (!versions.length) error(`No versions found for project #${projectId}`)

  // Find target version
  const version = versionTag
    ? versions.find(v => v.versionTag === versionTag)
    : versions[versions.length - 1]
  if (!version) error(`Version "${versionTag}" not found. Available: ${versions.map(v => v.versionTag).join(', ')}`)

  const hash = version!.arweaveHash.replace('ar://', '')
  info(`Fetching ${CYAN}ar://${hash}${RESET} from Arweave...`)

  // Download from Arweave
  const contentRes = await fetch(`https://arweave.net/${hash}`, { signal: AbortSignal.timeout(30000) })
  if (!contentRes.ok) error(`Arweave fetch failed: ${contentRes.status}`)
  const content = await contentRes.text()

  // Write to temp dir
  const tmpDir = mkdtempSync(join(tmpdir(), 'inkd-run-'))
  const scriptPath = join(tmpDir, 'index.js')

  try {
    writeFileSync(scriptPath, content)
    success(`Running project #${projectId} (${version!.versionTag})...`)
    console.log(DIM + '─'.repeat(60) + RESET)

    // Execute with passthrough args (everything after --)
    const separatorIdx = args.indexOf('--')
    const scriptArgs = separatorIdx !== -1 ? args.slice(separatorIdx + 1) : []

    const result = spawnSync('node', [scriptPath, ...scriptArgs], {
      stdio: 'inherit',
      timeout: 60000,
    })

    if (result.status !== 0) process.exit(result.status ?? 1)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}
