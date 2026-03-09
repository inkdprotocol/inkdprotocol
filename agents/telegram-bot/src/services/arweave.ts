const API_URL = process.env.INKD_API_URL ?? 'https://api.inkdprotocol.com'

export async function uploadText(content: string, tags?: Record<string, string>) {
  const payload = {
    data: Buffer.from(content, 'utf8').toString('base64'),
    contentType: 'text/plain; charset=utf-8',
    filename: `${Date.now()}.txt`,
    tags,
  }

  const res = await fetch(`${API_URL}/v1/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Upload API failed: ${res.status} ${body}`)
  }
  const json = await res.json() as {
    hash: string
    txId: string
    url: string
    bytes: number
  }
  return json
}
