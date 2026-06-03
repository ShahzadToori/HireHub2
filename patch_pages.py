#!/usr/bin/env python3
"""
Adds "Table View" buttons to jobs.html and applications.html
Run: python3 patch_pages.py
"""
import os

BASE = os.path.expanduser('~/HireHub2/public/employer')

# ── jobs.html: add Table View button next to "Post New Job" ──────────────────
jobs_path = os.path.join(BASE, 'jobs.html')
jobs_find = '<a href="/employer/post-job.html" class="ep-btn-primary"><i class="bi bi-plus-lg me-2"></i>Post New Job</a>'
jobs_replace = (
    '<a href="/employer/data-grid.html?type=jobs" class="ep-btn-outline" style="margin-right:.5rem">'
    '<i class="bi bi-table me-1"></i>Table View</a>'
    '<a href="/employer/post-job.html" class="ep-btn-primary"><i class="bi bi-plus-lg me-2"></i>Post New Job</a>'
)

with open(jobs_path, 'r') as f:
    content = f.read()

if 'data-grid.html?type=jobs' in content:
    print('jobs.html already patched — skipping')
else:
    if jobs_find not in content:
        print('ERROR: Could not find target in jobs.html')
    else:
        content = content.replace(jobs_find, jobs_replace)
        with open(jobs_path, 'w') as f:
            f.write(content)
        print('jobs.html patched OK')

# ── applications.html: add Table View button to the page header ──────────────
apps_path = os.path.join(BASE, 'applications.html')
apps_find = '''  <div class="ep-page-header">
    <div>
      <h1 class="ep-page-title">Applications</h1>
      <p class="ep-page-sub">Review and manage candidate applications</p>
    </div>
  </div>'''
apps_replace = '''  <div class="ep-page-header">
    <div>
      <h1 class="ep-page-title">Applications</h1>
      <p class="ep-page-sub">Review and manage candidate applications</p>
    </div>
    <a href="/employer/data-grid.html?type=applications" class="ep-btn-outline">
      <i class="bi bi-table me-1"></i>Table View
    </a>
  </div>'''

with open(apps_path, 'r') as f:
    content = f.read()

if 'data-grid.html?type=applications' in content:
    print('applications.html already patched — skipping')
else:
    if apps_find not in content:
        print('ERROR: Could not find target in applications.html')
    else:
        content = content.replace(apps_find, apps_replace)
        with open(apps_path, 'w') as f:
            f.write(content)
        print('applications.html patched OK')

print('All done.')
