require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('\n╔════════════════════════════════════╗');
console.log('║   D365 Job Tracker - Simple       ║');
console.log('║   ' + new Date().toLocaleString('en-IN') + '      ║');
console.log('╚════════════════════════════════════╝\n');

const sampleJobs = [
  { title: "Senior D365 CRM Developer", company: "Capgemini", location: "Hyderabad", salary: "₹32-40 LPA", url: "https://in.indeed.com/jobs?q=d365", source: "Indeed", posted: new Date().toISOString() },
  { title: "D365 Developer", company: "Infosys", location: "Remote", salary: "₹30-38 LPA", url: "https://in.indeed.com/jobs?q=d365", source: "Indeed", posted: new Date().toISOString() },
  { title: "Power Platform Developer", company: "Accenture", location: "Bangalore", salary: "₹28-35 LPA", url: "https://www.linkedin.com/jobs/search/", source: "LinkedIn", posted: new Date().toISOString() }
];

async function sendEmail(jobs) {
  if (!process.env.GMAIL_USER) {
    console.log('📧 Email config not set. Skipping.');
    return;
  }
  console.log('📧 Sending email...');
  try {
    const transporter = require('nodemailer').createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    const jobList = jobs.map(j => '<tr><td style="padding:8px"><b>' + j.title + '</b></td><td style="padding:8px">' + j.company + '</td><td style="padding:8px;"><a href="' + j.url + '" style="color:#0078D4">Apply</a></td></tr>').join('');
    const html = '<h2>📊 D365 Jobs Found</h2><p>Hi Shaik, here are ' + jobs.length + ' new D365 roles to check:</p><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f0f0"><th style="padding:12px">Role</th><th style="padding:12px">Company</th><th style="padding:12px">Action</th></tr>' + jobList + '</table><p style="font-size:12px;color:#666;margin-top:20px">D365 Job Hunter • ' + new Date().toLocaleString('en-IN') + '</p>';
    await transporter.sendMail({ from: process.env.GMAIL_USER, to: process.env.GMAIL_RECIPIENT || process.env.GMAIL_USER, subject: '📊 D365 Jobs - ' + jobs.length + ' roles', html });
    console.log('  ✓ Email sent to ' + process.env.GMAIL_RECIPIENT);
  } catch (e) { console.error('  ✗ Email error: ' + e.message); }
}

(async () => {
  try {
    console.log('📝 Sample D365 Jobs\n');
    sampleJobs.forEach((job, i) => { console.log('  ' + (i+1) + '. ' + job.title + ' @ ' + job.company + ' (' + job.location + ')'); });
    console.log('');
    await sendEmail(sampleJobs);
    console.log('\n✅ Check your email inbox!\n');
  } catch (error) { console.error('❌ Error:', error.message); }
})();
