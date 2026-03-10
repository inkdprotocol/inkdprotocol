const API_URL = process.env.INKD_API_URL ?? 'https://api.inkdprotocol.com'

export type UploadPriceQuote = {
  bytes: number
  arweaveCost: number
  markup: number
  total: number
  totalUsd: string
}

export async function fetchUploadPrice(bytes: number): Promise<UploadPriceQuote> {
  const url = new URL('/v1/upload/price', API_URL)
  url.searchParams.set('bytes', String(bytes))

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Price API failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<UploadPriceQuote>
}
