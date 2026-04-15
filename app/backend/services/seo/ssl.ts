// SSL certificate checker service
import https from 'https';
import tls from 'tls';
import type { SSLCertificate } from '../../../shared/types/jobs';

export async function checkSSL(domain: string): Promise<SSLCertificate | undefined> {
  try {
    // Clean domain (remove protocol, path, etc.)
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0] ?? domain;

    return await new Promise<SSLCertificate>((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        host: cleanDomain,
        port: 443,
        servername: cleanDomain,
        rejectUnauthorized: false, // We want to check even invalid certs
      };

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();

        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy();
          reject(new Error('No certificate found'));
          return;
        }

        const validFrom = cert.valid_from;
        const validTo = cert.valid_to;
        const validToDate = new Date(validTo);
        const now = new Date();
        const daysUntilExpiry = Math.floor((validToDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const result: SSLCertificate = {
          valid: socket.authorized,
          issuer: cert.issuer?.O || cert.issuer?.CN,
          subject: cert.subject?.CN,
          validFrom,
          validTo,
          daysUntilExpiry,
          protocol: protocol ?? undefined,
          cipher: cipher?.name,
        };

        socket.destroy();
        resolve(result);
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.setTimeout(5000, () => {
        socket.destroy();
        reject(new Error('SSL check timeout'));
      });
    });
  } catch (error) {
    console.error(`SSL check failed for ${domain}:`, error);
    return undefined;
  }
}
