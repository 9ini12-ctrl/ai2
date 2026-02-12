import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import { normLower, normStr, safeNum } from "./_utils.mjs";

export function parseCsv(csvText){
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true
  });
  return records;
}

export function hashDonationRow(row){
  const donation_date = normStr(row.donation_date);
  const amount = safeNum(row.amount);
  const donor_phone = normStr(row.donor_phone);
  const referral_code = normLower(row.referral_code);
  const key = JSON.stringify({ donation_date, amount, donor_phone, referral_code });
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function hashBoxRow(row){
  const created_at = normStr(row.created_at);
  const box_number = normStr(row.box_number);
  const donor_phone = normStr(row.donor_phone);
  const referral_code = normLower(row.referral_code);
  const key = JSON.stringify({ created_at, box_number, donor_phone, referral_code });
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function validateDonations(rows){
  const rejected = [];
  const accepted = [];
  for (const r of rows){
    const donation_date = normStr(r.donation_date);
    const referral_code = normLower(r.referral_code);
    const amount = safeNum(r.amount);
    if (!donation_date) { rejected.push({ row:r, reason:"donation_date مفقود" }); continue; }
    if (!referral_code) { rejected.push({ row:r, reason:"referral_code مفقود" }); continue; }
    if (amount === null) { rejected.push({ row:r, reason:"amount غير صالح" }); continue; }
    accepted.push({ donation_date, amount, donor_phone: normStr(r.donor_phone) || null, referral_code, source_row_hash: hashDonationRow(r) });
  }
  return { accepted, rejected };
}

export function validateBoxes(rows){
  const rejected = [];
  const accepted = [];
  for (const r of rows){
    const created_at = normStr(r.created_at);
    const box_number = normStr(r.box_number);
    const referral_code = normLower(r.referral_code);
    if (!created_at) { rejected.push({ row:r, reason:"created_at مفقود" }); continue; }
    if (!box_number) { rejected.push({ row:r, reason:"box_number مفقود" }); continue; }
    if (!referral_code) { rejected.push({ row:r, reason:"referral_code مفقود" }); continue; }
    accepted.push({ created_at, box_number, donor_phone: normStr(r.donor_phone) || null, referral_code, source_row_hash: hashBoxRow(r) });
  }
  return { accepted, rejected };
}
