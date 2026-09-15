// Seeds government/admin accounts. Safe to re-run — existing emails are skipped.
// Usage: node src/scripts/seedGovernmentUsers.js
import mongoose from 'mongoose';

import '../../src/config/env.js';
import { connectDB } from '../../src/config/db.js';
import User from '../models/User.js';

// Shared default password for all seeded official accounts.
// CHANGE THESE PASSWORDS before any real deployment.
const DEFAULT_PASSWORD = 'Johar@2026';

const ACCOUNTS = [
  // ---- Admins (platform operators) ----
  { name: 'JOHAR Platform Admin', email: 'admin@johar.gov.in', role: 'admin', district: 'Ranchi', organization: 'JOHAR Platform', phone: '+919000000001' },
  { name: 'Anil Kumar Mahto', email: 'anil.admin@johar.gov.in', role: 'admin', district: 'Ranchi', organization: 'JOHAR Platform', phone: '+919000000002' },
  { name: 'Priya Rani', email: 'priya.admin@johar.gov.in', role: 'admin', district: 'Dhanbad', organization: 'JOHAR Platform', phone: '+919000000003' },

  // ---- Government officials (district administration & departments) ----
  { name: 'Ramesh Singh Sahu', email: 'ramesh.singh@jh.gov.in', role: 'government', district: 'Ranchi', organization: 'Deputy Commissioner Office, Ranchi', phone: '+919000000101' },
  { name: 'Sunita Devi', email: 'sunita.devi@jh.gov.in', role: 'government', district: 'Dumka', organization: 'District Administration, Dumka', phone: '+919000000102' },
  { name: 'Manoj Prasad', email: 'manoj.prasad@jh.gov.in', role: 'government', district: 'Dhanbad', organization: 'District Mining Office, Dhanbad', phone: '+919000000103' },
  { name: 'Kiran Topno', email: 'kiran.topno@jh.gov.in', role: 'government', district: 'Khunti', organization: 'Zila Parishad, Khunti', phone: '+919000000104' },
  { name: 'Deepak Anand', email: 'deepak.anand@jh.gov.in', role: 'government', district: 'Bokaro', organization: 'District Administration, Bokaro', phone: '+919000000105' },
  { name: 'Reena Hansda', email: 'reena.hansda@jh.gov.in', role: 'government', district: 'Sahibganj', organization: 'District Welfare Office, Sahibganj', phone: '+919000000106' },
  { name: 'Vijay Kumar Gupta', email: 'vijay.gupta@jh.gov.in', role: 'government', district: 'Hazaribagh', organization: 'PHED Division, Hazaribagh', phone: '+919000000107' },
  { name: 'Shanti Murmu', email: 'shanti.murmu@jh.gov.in', role: 'government', district: 'East Singhbhum', organization: 'District Administration, East Singhbhum', phone: '+919000000108' },
  { name: 'Arjun Bhagat', email: 'arjun.bhagat@jh.gov.in', role: 'government', district: 'Gumla', organization: 'Rural Works Department, Gumla', phone: '+919000000109' },
  { name: 'Nirmala Soy', email: 'nirmala.soy@jh.gov.in', role: 'government', district: 'Lohardaga', organization: 'District Education Office, Lohardaga', phone: '+919000000110' },
  { name: 'Sanjay Ram', email: 'sanjay.ram@jh.gov.in', role: 'government', district: 'Palamu', organization: 'District Agriculture Office, Palamu', phone: '+919000000111' },
  { name: 'Usha Kacchap', email: 'usha.kacchap@jh.gov.in', role: 'government', district: 'Deoghar', organization: 'District Health Society, Deoghar', phone: '+919000000112' },
];

async function main() {
  await connectDB();

  let created = 0;
  let skipped = 0;

  for (const account of ACCOUNTS) {
    const exists = await User.findOne({ email: account.email }).select('_id').lean();
    if (exists) {
      skipped += 1;
      continue;
    }
    // User.create() triggers the pre-save hook that bcrypt-hashes the password
    await User.create({
      ...account,
      password: DEFAULT_PASSWORD,
      isVerified: true,
      preferredLanguage: 'en',
    });
    created += 1;
    console.log(`created: ${account.role.padEnd(11)} ${account.email}`);
  }

  console.log(`\nDone. Created ${created}, skipped (already existed) ${skipped}.`);
  console.log(`Default password for all seeded accounts: ${DEFAULT_PASSWORD}`);
  console.warn('WARNING: change these passwords before real deployment.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
