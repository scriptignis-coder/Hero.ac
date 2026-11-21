import { wrap, send, httpError } from './_lib.js';

/**
 * v74 — REMOVED.
 *
 * This endpoint let an admin type in what another scanner supposedly concluded about a
 * player. It was removed on purpose: a verdict somebody typed by hand is not evidence, it
 * cannot be checked by the person it accuses, and once it sits in a report next to real
 * findings it reads exactly like one. The whole value of this product is that every line in
 * a report can be traced back to something on the PC.
 *
 * What replaced it is automatic and verifiable: the PC Checker History section of a scan
 * report reads Windows' own execution records and reports which PC-check and forensic tools
 * are installed on the machine, which of them actually RAN, and when each was last seen.
 * It never states what those tools concluded, because that is not written anywhere on the PC.
 *
 * The endpoint answers 410 rather than 404 so that anything still calling it gets told the
 * feature is gone, not that it mistyped the path.
 *
 * To finish the removal, delete these two files and drop the table:
 *     api/external-reports.js          (this file)
 *     database/hs_v73_external_reports.sql
 *     drop table if exists public.hs_external_reports;
 */
export default wrap(async (req, res) => {
  throw httpError(410, 'External scanner reports were removed. Scan reports now build PC Checker History automatically from the machine\'s own execution records.');
});
