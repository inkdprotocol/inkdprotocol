const MAX_REPO_BYTES = 100 * 1024 * 1024 // 100 MB

const GH_HEADERS = {
  'User-Agent': 'inkd-bot/1.0',
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

export interface RepoRef {
  owner: string
  repo: string
  ref: string
}

/**
 * Parse user input into { owner, repo, ref }.
 * Accepts: owner/repo, owner/repo@branch, https://github.com/owner/repo[/tree/branch]
 */
export function parseRepoInput(input: string): { owner: string; repo: string; ref: string | null } {
  const trimmed = input.trim()

  // Full GitHub URL optionally with /tree/<branch>
  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([A-Za-z0-9_.-]+)(?:\/tree\/([^/\s]+))?/
  )
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, ''), ref: urlMatch[3] ?? null }
  }

  // Short form: owner/repo or owner/repo@ref
  const shortMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([^\s]+))?$/)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2], ref: shortMatch[3] ?? null }
  }

  throw new Error('Invalid repo format. Use owner/repo, owner/repo@branch, or a full GitHub URL.')
}

export async function fetchRepoDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: GH_HEADERS,
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} – ${await res.text()}`)
  const json = (await res.json()) as { default_branch: string }
  return json.default_branch
}

export async function downloadRepoZip(opts: {
  owner: string
  repo: string
  ref: string
}): Promise<{ buffer: Buffer; filename: string; size: number }> {
  const { owner, repo, ref } = opts
  const url = `https://codeload.github.com/${owner}/${repo}/zip/${ref}`
  const res = await fetch(url, { headers: { 'User-Agent': GH_HEADERS['User-Agent'] } })
  if (!res.ok) throw new Error(`GitHub download failed: ${res.status} – ${await res.text()}`)

  const contentLength = res.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_REPO_BYTES) {
    await res.body?.cancel()
    throw new Error(
      `Repo ZIP is ${(Number(contentLength) / 1024 / 1024).toFixed(1)} MB — exceeds the 100 MB limit.`
    )
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > MAX_REPO_BYTES) {
    throw new Error(
      `Repo ZIP is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — exceeds the 100 MB limit.`
    )
  }

  return { buffer, filename: `${repo}-${ref}.zip`, size: buffer.length }
}

/**
 * List public repos for a GitHub user/org (max 30)
 */
export async function listUserRepos(username: string): Promise<{ name: string; fullName: string; description: string | null; stars: number }[]> {
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30&type=public`
  const res = await fetch(url, { headers: GH_HEADERS })
  if (res.status === 404) throw new Error(`GitHub user "${username}" not found`)
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
  const data = await res.json() as Array<{ name: string; full_name: string; description: string | null; stargazers_count: number; fork: boolean }>
  return data
    .filter(r => !r.fork)
    .map(r => ({ name: r.name, fullName: r.full_name, description: r.description, stars: r.stargazers_count }))
}
