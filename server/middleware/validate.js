'use strict';
/* ══════════════════════════════════════════════════════════════
   Strict schema validation middleware.
   Rejects any request whose body/query/params don't match the
   given zod schema exactly (type, length, format) — never silently
   strips or coerces bad fields away. Unknown keys are rejected too
   (.strict()) so extra/unexpected fields don't silently pass through.
══════════════════════════════════════════════════════════════ */
const { z } = require('zod');

function firstIssueMessage(error) {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

// source: 'body' | 'query' | 'params'
// onReject(req): optional cleanup hook (e.g. delete a file multer already
// wrote to disk earlier in the chain) run before the 400 is sent.
function validate(schema, source = 'body', onReject) {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      if (onReject) { try { onReject(req); } catch (e) {} }
      const msg = firstIssueMessage(result.error);
      // Most routes read `.message`; a couple (pdf.js) read `.error` instead —
      // sending both keeps every existing client's error display working.
      return res.status(400).json({
        success: false,
        message: msg,
        error: msg
      });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate, z };
