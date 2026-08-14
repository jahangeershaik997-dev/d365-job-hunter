require('dotenv').config();
const axios = require('axios');
const Airtable = require('airtable');
const nodemailer = require('nodemailer');

console.log('\n╔════════════════════════════════════╗');
console.log('║   D365 Job Hunter - Multi Source  ║');
console.log('║   ' + new Date().toLocaleString('en-IN') + '      ║');
console.log('╚════════════════════════════════════╝\n');

const KEYWORDS = ['Dynamics 365', 'D365', 'CRM', 'Azure', 'Power Platform'];
const BAD_KEYWORDS = ['Java', 'Python', 'Salesforce', 'SAP'];

async function scrapeIndeed() {
  console.log('🔍 Scraping Indeed India...');
  try {
    const url = 'https://in.indeed.com/jobs?q=Dynamics+365&l=India&sort=date';
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const jobs = [];
    const regex = /title="([^"]+)"[^>]*company-name[^>]*>([^<]+)/g;
    let match;

    while ((match = regex.exec(data)) !== null) {
      jobs.push({
        title: match[1].trim(),
        company: match[2].trim(),
        salary: 'Not listed',
        url: url,
        source: 'Indeed',
        location: 'India'
      });
    }

    console.log(`  ✓ Found ${jobs.length} jobs on Indeed`);
    return jobs;
  } catch (e) {
    console.error(`  ✗ Indeed error: ${e.message}`);
    return [];
  }
}

async function scrapeNaukri() {
  console.log('🔍 Scraping Naukri...');
  try {
    const url = 'https://www.naukri.com/search?keyword=Dynamics%20365';
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const jobs = [];
    const regex = /title="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;

    while ((match = regex.exec(data)) !== null) {
      jobs.push({
        title: match[1].trim(),
        company: match[2].trim(),
        salary: 'Not listed',
        url: url,
        source: 'Naukri',
        location: 'India'
      });
    }

    console.log(`  ✓ Found ${jobs.length} jobs on Naukri`);
    return jobs;
  } catch (e) {
    console.error(`  ✗ Naukri error: ${e.message}`);
    return [];
  }
}

async function scrapeLinkedIn() {
  console.log('🔍 Scraping LinkedIn...');
  try {
    const url = 'https://www.linkedin.com/jobs/search/?keywords=Dynamics%20365&location=India';
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const jobs = [];
    const regex = /<span[^>]*>([^<]+D365[^<]+)<\/span>/gi;
    let match;

    while ((match = regex.exec(data)) !== null) {
      jobs.push({
        title: match[1].trim(),
        company: 'LinkedIn Job',
        salary: 'Not listed',
        url: url,
        source: 'LinkedIn',
        location: 'India'
      });
    }

    console.log(`  ✓ Found ${jobs.length} jobs on LinkedIn`);
    return jobs;
  } catch (e) {
    console.error(`  ✗ LinkedIn error: ${e.message}`);
    return [];
  }
}

function filterJobs(jobs) {
  console.log('\n🔥 Filtering D365 roles...');
  
  const filtered = jobs.filter(job => {
    const text = `${job.title} ${job.company}`.toLowerCase();
    const hasGood = KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    const hasBad = BAD_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    return hasGood && !hasBad;
  });

  const seen = new Set();
  const deduped = filtered.filter(job => {
    const key = `${job.title}-${job.company}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`  ✓ Filtered ${jobs.length} → ${deduped.length} after dedup`);
  return deduped;
}

async function addToAirtable(jobs) {
  if (jobs.length === 0) {
    console.log('\n📊 No new jobs to add');
    return;
  }

  console.log(`\n📊 Adding ${jobs.length} jobs to Airtable...`);

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
      console.log(`  ✓ Added: ${job.title} (${job.source})`);
    }
  } catch (e) {
    console.error(`  ✗ Airtable error: ${e.message}`);
  }
}

async function sendEmail(jobs) {
  if (jobs.length === 0 || !process.env.GMAIL_USER) {
    console.log('\n📧 No email to send');
    return;
  }

  console.log(`\n📧 Sending email digest...`);

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD
      }
    });

    const jobList = jobs.map(j => `<tr><td style="padding:8px"><b>${j.title}</b></td><td style="padding:8px">${j.company}</td><td style="padding:8px">${j.source}</td><td style="padding:8px"><a href="${j.url}">Apply</a></td></tr>`).join('');

    const html = `<h2>📊 D365 Jobs - Indeed + Naukri + LinkedIn</h2><p>Found <b>${jobs.length} new roles</b>:</p><table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f0f0"><th style="padding:12px">Role</th><th style="padding:12px">Company</th><th style="padding:12px">Source</th><th style="padding:12px">Action</th></tr>${jobList}</table>`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: `📊 D365 Jobs - ${jobs.length} roles (Indeed + Naukri + LinkedIn)`,
      html
    });

    console.log('  ✓ Email sent!');
  } catch (e) {
    console.error(`  ✗ Email error: ${e.message}`);
  }
}

(async () => {
  try {
    console.log('📝 Scraping from 3 sources...\n');
    
    const indeedJobs = await scrapeIndeed();
    const naukriJobs = await scrapeNaukri();
    const linkedInJobs = await scrapeLinkedIn();
    
    const allJobs = [...indeedJobs, ...naukriJobs, ...linkedInJobs];
    console.log(`\n📈 Total: ${allJobs.length} jobs\n`);
    
    const filtered = filterJobs(allJobs);
    
    await addToAirtable(filtered);
    await sendEmail(filtered);

    console.log('\n✅ Job Hunter completed!\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
})();
