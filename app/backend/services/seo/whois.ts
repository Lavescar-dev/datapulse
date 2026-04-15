// WHOIS lookup service
import * as whois from 'whois';
import type { WhoisData } from '../../../shared/types/jobs';

export async function lookupWhois(domain: string): Promise<WhoisData | undefined> {
  try {
    // Clean domain (remove protocol, path, etc.)
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0] ?? domain;

    const result = await new Promise<string>((resolve, reject) => {
      whois.lookup(cleanDomain, ((err: Error | null, data: string | Record<string, unknown>) => {
        if (err) reject(err);
        else resolve(typeof data === 'string' ? data : JSON.stringify(data));
      }) as any);
    });

    // Parse WHOIS data (format varies by registrar)
    const data: WhoisData = {
      domain: cleanDomain,
    };

    // Extract registrar
    const registrarMatch = result.match(/Registrar:\s*(.+)/i);
    if (registrarMatch?.[1]) data.registrar = registrarMatch[1].trim();

    // Extract dates (multiple formats)
    const createdMatch = result.match(/Creat(?:ion|ed) Date:\s*(.+)/i);
    if (createdMatch?.[1]) data.createdDate = createdMatch[1].trim();

    const expiryMatch = result.match(/Registry Expiry Date:\s*(.+)|Expir(?:ation|y) Date:\s*(.+)/i);
    if (expiryMatch?.[1] || expiryMatch?.[2]) data.expiryDate = (expiryMatch[1] || expiryMatch[2] || '').trim();

    const updatedMatch = result.match(/Updated Date:\s*(.+)/i);
    if (updatedMatch?.[1]) data.updatedDate = updatedMatch[1].trim();

    // Extract name servers
    const nameServers: string[] = [];
    const nsRegex = /Name Server:\s*(.+)/gi;
    let nsMatch;
    while ((nsMatch = nsRegex.exec(result)) !== null) {
      if (nsMatch[1]) {
        nameServers.push(nsMatch[1].trim().toLowerCase());
      }
    }
    if (nameServers.length > 0) data.nameServers = nameServers;

    // Extract status
    const statuses: string[] = [];
    const statusRegex = /Domain Status:\s*(.+)/gi;
    let statusMatch;
    while ((statusMatch = statusRegex.exec(result)) !== null) {
      if (statusMatch[1]) {
        statuses.push(statusMatch[1].trim());
      }
    }
    if (statuses.length > 0) data.status = statuses;

    // Extract registrant info
    const orgMatch = result.match(/Registrant Organization:\s*(.+)/i);
    const countryMatch = result.match(/Registrant Country:\s*(.+)/i);
    if (orgMatch || countryMatch) {
      data.registrant = {
            organization: orgMatch?.[1] ? orgMatch[1].trim() : undefined,
            country: countryMatch?.[1] ? countryMatch[1].trim() : undefined,
      };
    }

    return data;
  } catch (error) {
    console.error(`WHOIS lookup failed for ${domain}:`, error);
    return undefined;
  }
}
