import { EN } from "@/lib/i18n-en";
import { API_EXACT } from "@/lib/i18n-api-dict";

// Server response messages translated for DISPLAY only. Request payloads are never altered.

type Tpl = { re: RegExp; en: (m: RegExpMatchArray, t: (s: string) => string) => string };

const API_TEMPLATES: Tpl[] = [
  { re: /^(.+)長度過長$/, en: (m, t) => `${t(m[1])} is too long` },
  { re: /^請填寫「?(.+?)」?$/, en: (m, t) => `Please fill in ${t(m[1])}` },
  { re: /^報到人數必須是 1 到 (\d+) 之間的整數$/, en: (m) => `Check-in count must be an integer from 1 to ${m[1]}` },
  { re: /^戰鬥陀螺賽參賽名額已額滿，剩餘 (\d+) 個名額$/, en: (m) => `Beyblade competitor spots are full; ${m[1]} remaining` },
  { re: /^此申請已處於「(.+)」狀態，無法重複處理$/, en: (m, t) => `This request is already "${t(m[1])}" and cannot be processed again` },
  {
    re: /^此票券 (\d+) 位已全數報到(?:（最後報到時間 (.+)）)?$/,
    en: (m) => `All ${m[1]} people on this ticket are checked in${m[2] ? ` (last check-in ${new Date(m[2]).toLocaleString("en-US")})` : ""}`,
  },
  { re: /^角色必須為 (.+) 之一$/, en: (m) => `Role must be one of ${m[1]}` },
  { re: /^退票張數需為 1 到 (\d+) 之間的整數$/, en: (m) => `Refund quantity must be an integer from 1 to ${m[1]}` },
];

const CJK = /[\u3400-\u9fff]/;
const known = (s: string): string | undefined => API_EXACT[s] ?? EN[s];

/** English rendering of a server message. Unknown Chinese stays verbatim with an English note; non-Chinese (provider) errors pass through. */
export function translateApiMessage(msg: string): string {
  const exact = known(msg);
  if (exact !== undefined) return exact;
  const t = (s: string) => known(s) ?? s;
  for (const tpl of API_TEMPLATES) {
    const m = msg.match(tpl.re);
    if (m) return tpl.en(m, t);
  }
  // "<known prefix>：<provider detail>" -> translate prefix, keep detail verbatim.
  const sep = msg.match(/^([^：:]+)[：:]\s*([\s\S]+)$/);
  if (sep && known(sep[1].trim())) return `${t(sep[1].trim())}: ${sep[2]}`;
  if (CJK.test(msg)) return `Server message (not yet translated): ${msg}`;
  return msg;
}
