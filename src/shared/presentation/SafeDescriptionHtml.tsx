import { isSafeDescriptionHtml } from '@/shared/validation/safe-description-html';

export function SafeDescriptionHtml({
  html,
  className,
}: Readonly<{
  html: string | null | undefined;
  className?: string;
}>) {
  if (!html) return null;

  if (!isSafeDescriptionHtml(html)) {
    return <div className={className}>{html}</div>;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
