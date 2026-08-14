require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const GOOD_KEYWORDS = ['Dynamics 365', 'D365', 'CRM', 'Azure', 'Power Platform', 'Power Automate'];
const BAD_KEYWORDS = ['Java', 'Python', 'Salesforce', 'SAP', 'React', 'Flutter'];

console.log('\n╔════════════════════════════════════╗');
console.log('║   D365 Job Hunter - Windows       ║');
console.log(`║   ${new Date().toLocaleString('en-IN')}      ║`);
console.log('╚════════════════════════════════════╝\n');

// Scrape Indeed
async function scrapeIndeed() {
  console.log('🔍 Scraping Indeed...');
  const jobs = [];
  
  try {
    const url = 'https://in.indeed.com/jobs?q=Dynamics%20365&l=India&sort=date&limit=25';
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    
    $('div.job_seen_beacon').each((i, elem) => {
      try {
        const $elem = cheerio(elem);
        const title = $elem.find('[class*="jobTitle"]').text().trim();
        const company = $elem.find('[data-testid="company-name"]').text().trim();
        const salary = $elem.find('[data-testid="salary-snippet"]').text().trim() || 'Not listed';
        const jobLink = $elem.find('a.jcs')?.attr('href') || '';

        if (title && company && jobLink) {
          jobs.push({
            title: title.substring(0, 100),
            company: company.substring(0, 100),
            location: 'India',
            salary: salary.substring(0, 50),
            url: jobLink.startsWith('http') ? jobLink : `https://in.indeed.com${jobLink}`,
            source: 'Indeed',
            posted: new Date().toISOString()
          });
        }
      } catch (e) {
        // Skip bad records
      }
    });

    console.log(`  ✓ Found ${jobs.length} jobs`);
  } catch (e) {
    console.error(`  ✗ Error: ${e.message}`);
  }

  return jobs;
}

// Filter for D365 roles
function filterJobs(jobs) {
  console.log('\n🔥 Filtering for D365 roles...');
  
  const filtered = jobs.filter(job => {
    const text = `${job.title} ${job.company}`.toLowerCase();
    const hasGood = GOOD_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    const hasBad = BAD_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    return hasGood && !hasBad;
  });

  // Dedupe
  const seen = new Set();
  const deduped = filtered.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });

  console.log(`  ✓ Filtered ${jobs.length} → ${deduped.length} after dedup`);
  return deduped;
}

// Sync to Google Sheets
async function syncToSheets(jobs) {
  if (jobs.length === 0) {
    console.log('\n📊 No new jobs to sync');
    return;
  }

  console.log(`\n📊 Syncing ${jobs.length} jobs to Google Sheets...`);

  try {
    if (!process.env.GOOGLE_SHEET_ID) {
      console.log('  ℹ️  GOOGLE_SHEET_ID not set. Skipping Sheets sync.');
      return;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const values = jobs.map(j => [
      j.title,
      j.company,
      j.location,
      j.salary,
      j.url,
      j.source,
      new Date().toLocaleDateString('en-IN'),
      'Not Applied',
      '',
      ''
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A:J',
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    console.log(`  ✓ Synced ${values.length} rows`);
  } catch (e) {
    console.error(`  ✗ Error: ${e.message}`);
  }
}

// Send email
async function sendEmail(jobs) {
  if (jobs.length === 0 || !process.env.GMAIL_USER) {
    console.log('\n📧 No email config. Skipping.');
    return;
  }

  console.log(`\n📧 Sending email digest...`);

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const jobList = jobs.map(j => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px;"><strong>${j.title}</strong></td>
        <td style="padding: 8px;">${j.company}</td>
        <td style="padding: 8px;"><a href="${j.url}" style="color: #0078D4;">Apply</a></td>
      </tr>
    `).join('');

    const html = `
      <h2>📊 D365 Jobs Found</h2>
      <p>Found <strong>${jobs.length} new roles</strong>:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f0f0f0;">
          <th style="padding: 12px; text-align: left;">Role</th>
          <th style="padding: 12px; text-align: left;">Company</th>
          <th style="padding: 12px; text-align: left;">Action</th>
        </tr>
        ${jobList}
      </table>
      <p style="margin-top: 20px; font-size: 12px; color: #666;">
        D365 Job Hunter • ${new Date().toLocaleString('en-IN')}
      </p>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_RECIPIENT || process.env.GMAIL_USER,
      subject: `📊 D365 Jobs Today - ${jobs.length} new roles`,
      html
    });

    console.log(`  ✓ Email sent`);
  } catch (e) {
    console.error(`  ✗ Error: ${e.message}`);
  }
}

// Main
async function main() {
  try {
    const jobs = await scrapeIndeed();
    const filtered = filterJobs(jobs);

    await syncToSheets(filtered);
    await sendEmail(filtered);

    console.log('\n✅ Job Hunter completed!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
