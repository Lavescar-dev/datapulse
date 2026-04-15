// DNS record lookup service
import { promises as dns } from 'dns';
import type { DNSRecords } from '../../../shared/types/jobs';

export async function lookupDNS(domain: string): Promise<DNSRecords | undefined> {
  try {
    // Clean domain (remove protocol, path, etc.)
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0] ?? domain;

    const records: DNSRecords = {};

    // A records (IPv4)
    try {
      const aRecords = await dns.resolve4(cleanDomain);
      if (aRecords.length > 0) records.A = aRecords;
    } catch (e) {
      // A records might not exist, that's okay
    }

    // AAAA records (IPv6)
    try {
      const aaaaRecords = await dns.resolve6(cleanDomain);
      if (aaaaRecords.length > 0) records.AAAA = aaaaRecords;
    } catch (e) {
      // AAAA records might not exist, that's okay
    }

    // MX records (Mail)
    try {
      const mxRecords = await dns.resolveMx(cleanDomain);
      if (mxRecords.length > 0) {
        records.MX = mxRecords.map((mx) => ({
          priority: mx.priority,
          exchange: mx.exchange,
        }));
      }
    } catch (e) {
      // MX records might not exist
    }

    // TXT records
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      if (txtRecords.length > 0) {
        records.TXT = txtRecords.map((txt) => txt.join(' '));
      }
    } catch (e) {
      // TXT records might not exist
    }

    // CNAME records
    try {
      const cnameRecords = await dns.resolveCname(cleanDomain);
      if (cnameRecords.length > 0) records.CNAME = cnameRecords;
    } catch (e) {
      // CNAME records might not exist (most domains won't have CNAME at apex)
    }

    // NS records (Name Servers)
    try {
      const nsRecords = await dns.resolveNs(cleanDomain);
      if (nsRecords.length > 0) records.NS = nsRecords;
    } catch (e) {
      // NS records might not exist
    }

    return Object.keys(records).length > 0 ? records : undefined;
  } catch (error) {
    console.error(`DNS lookup failed for ${domain}:`, error);
    return undefined;
  }
}
