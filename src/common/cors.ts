/**
 * CORS_ORIGINS 환경변수를 파싱해 origin 화이트리스트 반환.
 * - 미지정 + production : false (모든 origin 차단)
 * - 미지정 + 개발 : true (모든 origin 허용)
 * - "*" : true
 * - "https://a.com,https://b.com" : 배열
 */
export function resolveCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? false : true;
  }
  if (raw === '*') return true;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
