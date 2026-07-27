export async function waitForStudioApi(timeout = 5000): Promise<any | null> {
  const interval = 100
  const start = Date.now()
  while (Date.now() - start < timeout) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any)?.studioApi
    if (api) return api
    // small sleep
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, interval))
  }
  return null
}

export default waitForStudioApi
