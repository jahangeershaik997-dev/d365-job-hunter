require('dotenv').config();
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

console.log('\n╔════════════════════════════════════╗');
console.log('║   D365 Job Tracker - Manual Add   ║');
console.log('║   ' + new Date().toLocaleString('en-IN') + '      ║');
console.log('╚════════════════════════════════════╝\n');

const sampleJobs = [
  { title: "Senior D365 CRM Developer", company: "Capgemini", location: "Hyderabad", salary: "₹32-40 LPA", url: "https://in.indeed.com/jobs?q=d365", source: "Indeed", posted: new Date().toISOString() },
  { title: "D365 Developer", company: "Infosys", location: "Remote", salary: "₹30-38 LPA", url: "https://in.indeed.com/jobs?q=d365", source: "Indeed", posted: new Date().toISOString() },
  { title: "Power Platform Developer", company: "Accenture", location: "Bangalore", salary: "₹28-35 LPA", url: "https://www.linkedin.com/jobs/search/", source: "LinkedIn", posted: new Date().toISOString() }
];

async function syncToSheets(jobs) {
  console.log('📊 Syncing ' + jobs.length + ' jobs to Google Sheets...');
  try {
    const auth = new (require('googleapis').google.auth.GoogleAuth)({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = require('googleapis').google.sheets({ version: 'v4', auth });
    const values = jobs.map(j => [j.title, j.company, j.location, j.salary, j.url, j.source, new Date().toLocaleDateString('en-IN'), 'Not Applied', '', '']);
    await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: 'A:J', valueInputOption: 'USER_ENTERED', resource: { values } });
    console.log('  ✓ Synced ' + values.length + ' rows!');
  } catch (e) { console.error('  ✗ Error: ' + e.message); }
}

async function sendEmail(jobs) {
  if (!process.env.GMAIL_USER) return;
  console.log('📧 Sending email...');
  try {
    const transporter = require('nodemailer').createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    const jobList = jobs.map(j => '<tr><td style="padding:8px"><b>' + j.title + '</b></td><td style="padding:8px">' + j.company + '</td><td style="padding:8px"><a href="' + j.url + '">Apply</a></td></tr>').join('');
    const html = '<h2>📊 D365 Jobs</h2><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f0f0"><th style="padding:12px">Role</th><th style="padding:12px">Company</th><th style="padding:12px">Action</th></tr>' + jobList + '</table>';
    await transporter.sendMail({ from: process.env.GMAIL_USER, to: process.env.GMAIL_RECIPIENT || process.env.GMAIL_USER, subject: '📊 D365 Jobs - ' + jobs.length + ' roles', html });
    console.log('  ✓ Email sent!');
  } catch (e) { console.error('  ✗ Error: ' + e.message); }
}

(async () => {
  try {
    console.log('📝 Adding sample jobs\n');
    sampleJobs.forEach((job, i) => { console.log('  ' + (i+1) + '. ' + job.title + ' @ ' + job.company); });
    await syncToSheets(sampleJobs);
    await sendEmail(sampleJobs);
    console.log('\n✅ Done!\n');
  } catch (error) { console.error('❌ Error:', error.message); }
})();
