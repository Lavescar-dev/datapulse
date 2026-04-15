/**
 * Simple test script to verify authentication system
 * Run with: bun test-auth.ts
 */

import { adminAuth } from './auth/admin';
import { sessionManager } from './auth/session';

console.log('🧪 Testing Authentication System\n');

// Test 1: Admin authentication
console.log('Test 1: Admin Authentication');
const validCreds = { username: 'admin', password: process.env.ADMIN_PASSWORD || 'change_me_in_production' };
const invalidCreds = { username: 'admin', password: 'wrongpassword' };

console.log('  ✓ Valid credentials:', adminAuth.verify(validCreds) ? 'PASS' : 'FAIL');
console.log('  ✓ Invalid credentials:', !adminAuth.verify(invalidCreds) ? 'PASS' : 'FAIL');
console.log();

// Test 2: Session creation
console.log('Test 2: Session Creation');
const demoToken = await sessionManager.createDemoSession('127.0.0.1');
const adminToken = await sessionManager.createAdminSession('127.0.0.1');

console.log('  ✓ Demo token created:', demoToken ? 'PASS' : 'FAIL');
console.log('  ✓ Admin token created:', adminToken ? 'PASS' : 'FAIL');
console.log();

// Test 3: Session verification
console.log('Test 3: Session Verification');
const demoSession = await sessionManager.verifySession(demoToken);
const adminSession = await sessionManager.verifySession(adminToken);

console.log('  ✓ Demo session verified:', demoSession !== null ? 'PASS' : 'FAIL');
console.log('  ✓ Demo session isAdmin:', !demoSession?.isAdmin ? 'PASS' : 'FAIL');
console.log('  ✓ Admin session verified:', adminSession !== null ? 'PASS' : 'FAIL');
console.log('  ✓ Admin session isAdmin:', adminSession?.isAdmin ? 'PASS' : 'FAIL');
console.log();

// Test 4: Session status
console.log('Test 4: Session Status');
const demoStatus = await sessionManager.getSessionStatus(demoToken);
const adminStatus = await sessionManager.getSessionStatus(adminToken);

console.log('  ✓ Demo status active:', demoStatus?.active ? 'PASS' : 'FAIL');
console.log('  ✓ Demo requests remaining:', demoStatus?.requestsRemaining === 100 ? 'PASS' : 'FAIL');
console.log('  ✓ Admin status active:', adminStatus?.active ? 'PASS' : 'FAIL');
console.log('  ✓ Admin unlimited requests:', adminStatus?.requestsRemaining === -1 ? 'PASS' : 'FAIL');
console.log();

// Test 5: Request decrementing
console.log('Test 5: Request Decrementing');
const newToken = await sessionManager.decrementRequests(demoToken);
const newSession = await sessionManager.verifySession(newToken!);

console.log('  ✓ Token updated:', newToken !== null ? 'PASS' : 'FAIL');
console.log('  ✓ Requests decremented:', newSession?.requestsRemaining === 99 ? 'PASS' : 'FAIL');
console.log();

// Test 6: Invalid token
console.log('Test 6: Invalid Token');
const invalidSession = await sessionManager.verifySession('invalid.token.here');
console.log('  ✓ Invalid token rejected:', invalidSession === null ? 'PASS' : 'FAIL');
console.log();

console.log('✅ All authentication tests completed!');
