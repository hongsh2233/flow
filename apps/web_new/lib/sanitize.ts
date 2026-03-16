/**
 * HTML 새니타이즈 - XSS 방지 (SECURITY_AUDIT 3번)
 * dangerouslySetInnerHTML 사용 전 반드시 적용
 */
import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "a",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "div", "span", "blockquote", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
      "img", "hr",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "class", "style"],
    ALLOW_DATA_ATTR: false,
  });
}
