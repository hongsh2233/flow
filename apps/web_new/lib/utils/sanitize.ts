import DOMPurify from "isomorphic-dompurify";

/**
 * HTML 문자열을 XSS 방지를 위해 새니타이징합니다.
 * dangerouslySetInnerHTML 사용 시 반드시 이 함수를 거쳐야 합니다.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}
