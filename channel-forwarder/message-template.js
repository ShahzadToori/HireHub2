'use strict';
/* Shared WhatsApp message template renderer — used by smart-cron.js (the
 * actual sender) and server/routes/admin-whatsapp.js (the admin preview),
 * so the preview an admin sees is guaranteed byte-identical to what ships.
 * No external deps — safe to require from the main app as well as the
 * standalone channel-forwarder project.
 */

const SITE_URL = 'https://joborbit.org';

const DEFAULT_TEMPLATE = `🔥 *Job Opportunity on {{site_name}}*

📋 *{{title}}*
🏢 {{company}}
📍 {{location}}
💼 {{job_type}}

{{description}}

🔗 View & apply: {{link}}

{{notice}}`;

const DEFAULT_NOTICE = `⚠️ *Important Notice:*
▪ Verify job details before joining
▪ Do NOT pay anyone for job placement
▪ Only deal with verified sources`;

const DEFAULT_DESC_LENGTH = 200;

// Strips contact info out of free-text job descriptions before they go to
// WhatsApp — kept unconditional (not a template option) since it's a
// spam/compliance safeguard, not a formatting preference.
function sanitizeDescription(text) {
    let cleaned = (text || '').replace(/\n/g, ' ');

    const withoutPhones = cleaned
        .replace(/(\+?9665|05)\d{8}/g, '')
        .replace(/(\+\d{1,3}[-.\s]?\d{6,})/g, '')
        .replace(/\d{4,}[-.\s]?\d{4,}/g, '');
    if (withoutPhones !== cleaned && !withoutPhones.includes('📞 Contact details on website')) {
        cleaned = withoutPhones + ' 📞 Contact details on website.';
    } else {
        cleaned = withoutPhones;
    }

    const withoutEmails = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '');
    if (withoutEmails !== cleaned && !withoutEmails.includes('✉️ Email on website')) {
        cleaned = withoutEmails + ' ✉️ Email on website.';
    } else {
        cleaned = withoutEmails;
    }

    return cleaned
        .replace(/Contact:\s*/gi, '')
        .replace(/Phone:\s*/gi, '')
        .replace(/WhatsApp:\s*/gi, '');
}

function formatSalary(job) {
    if (job.salary) return String(job.salary);
    if (job.salary_min && job.salary_max) return `${job.salary_min}–${job.salary_max} SAR`;
    if (job.salary_min) return `${job.salary_min}+ SAR`;
    return '';
}

function renderTemplate(template, job, opts = {}) {
    const descLength = Number.isFinite(opts.descLength) ? opts.descLength : DEFAULT_DESC_LENGTH;
    const notice = opts.notice != null ? opts.notice : DEFAULT_NOTICE;

    const desc = sanitizeDescription(job.description);
    const truncatedDesc = desc.length > descLength ? desc.slice(0, descLength) + '…' : desc;

    const salary = formatSalary(job);
    const category = job.category || '';

    const values = {
        site_name: 'JobOrbit',
        title: job.title || '',
        company: job.company || 'Not specified',
        location: job.location || '',
        job_type: job.job_type || 'Full-time',
        description: truncatedDesc,
        salary,
        category,
        positions: job.positions ? String(job.positions) : '',
        link: `${SITE_URL}/job/${job.slug}`,
        notice,
        salary_line: salary ? `💰 Salary: ${salary}\n` : '',
        category_line: category ? `🏷️ Category: ${category}\n` : '',
    };

    return template.replace(/\{\{(\w+)\}\}/g, (m, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : m
    );
}

module.exports = {
    SITE_URL,
    DEFAULT_TEMPLATE,
    DEFAULT_NOTICE,
    DEFAULT_DESC_LENGTH,
    sanitizeDescription,
    formatSalary,
    renderTemplate,
};
