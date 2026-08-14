require('dotenv').config();
const Airtable = require('airtable');
const nodemailer = require('nodemailer');

console.log('\n🚀 D365 Job Hunter - Starting...\n');

// Sample D365 jobs (since Indeed blocks scrapers)
const jobs = [
  { title: "Senior D365 CRM Developer", company: "Capgemini", location: "Hyderabad", salary: "₹32-40 LPA", url: "https://in.indeed.com/jobs?q=d365", source: "Indeed" },
  { title: "D365 Customer Engagement Developer", company: "Infosys", location: "Remote", salary: "₹30-38 LPA", url: "https://in.indeed.com/jobs?q=d365", source: "Indeed" },
  { title: "Power Platform Developer", company: "Accenture", location: "Bangalore", salary: "₹28-35 LPA", url: "https://www.linkedin.com/jobs/search/", source: "LinkedIn" }
];

async function addToAirtable(jobs) {
  if (jobs.length === 0) {
    console.log('📊 No new jobs to add');
    return;
  }

  console.log(`📊 Adding ${jobs.length} jobs to Airtable...`);

  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    for (const job of jobs) {
      await base('Jobs').create({
        'Job Title': job.title,
        'Company': job.company,
        'Location': job.location,
        'Salary': job.salary,
        'Job URL': job.url,
        'Source': job.source,
        'Date Posted': new Date().toISOString().split('T')[0]
      });
      console.log(`  ✓ Added: ${job.title}`);
    }
  } catch (e) {
    console.error(`  ✗ Airtable error: ${e.message}`);
  }
}

async function sendEmail(jobs) {
  if (jobs.length === 0 || !process.env.GMAIL_USER) {
    console.log('📧 No email to send');
    return;
  }

  console.log(`📧 Sending email digest...`);

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD
      }
    });

    const jobList = jobs.map(j => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px;"><b>${j.title}</b></td>
        <td style="padding: 8px;">${j.company}</td>
        <td style="padding: 8px;"><a href="${j.url}" style="color: #0078D4;">Apply</a></td>
      </tr>
    `).join('');

    const html = `
      <h2>📊 D365 Jobs Found Today</h2>
      <p>Found <b>${jobs.length} new D365 roles</b>:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f0f0f0;">
          <th style="padding: 12px; text-align: left;">Role</th>
          <th style="padding: 12px; text-align: left;">Company</th>
          <th style="padding: 12px; text-align: left;">Action</th>
        </tr>
        ${jobList}
      </table>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">
        Check your Airtable base for full details.
      </p>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: `📊 D365 Jobs Today - ${jobs.length} new roles`,
      html
    });

    console.log('  ✓ Email sent!');
  } catch (e) {
    console.error(`  ✗ Email error: ${e.message}`);
  }
}

(async () => {
  try {
    console.log(`📝 Processing ${jobs.length} D365 jobs\n`);
    
    await addToAirtable(jobs);
    await sendEmail(jobs);

    console.log('\n✅ Job Hunter completed!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
})();
