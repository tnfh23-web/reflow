export function publicAddress(address) {
  if (address.includes(':')) return /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0|10|20):/i.test(address);
  const bytes = address.split('.').map(Number);
  if (bytes.length !== 4 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) return false;
  const [a,b] = bytes;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b)) ||
    (a === 198 && [18,19,51].includes(b)) || (a === 203 && b === 0));
}

export async function verifyHost(host, fetcher = fetch) {
  const responses = await Promise.all(['A', 'AAAA'].map(async type => {
    const response = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: {Accept: 'application/dns-json'}, signal: AbortSignal.timeout(4000)});
    if (!response.ok) throw new Error('DNS lookup unavailable');
    return response.json();
  }));
  const addresses = responses.flatMap(r => (r.Answer || []).filter(a => [1,28].includes(a.type)).map(a => a.data));
  if (!addresses.length || addresses.some(a => !publicAddress(a))) throw new Error('Public address required');
}

