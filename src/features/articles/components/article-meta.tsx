import { formatDate } from "@/lib/dates";

/** Date de publication et temps de lecture d'un article. */
export function ArticleMeta({
  publishedAt,
  readingMinutes,
  className = "petit text-gris",
}: {
  publishedAt: Date;
  readingMinutes: number;
  className?: string;
}) {
  return (
    <p className={className}>
      <time dateTime={publishedAt.toISOString()}>{formatDate(publishedAt)}</time> · {readingMinutes}{" "}
      min de lecture
    </p>
  );
}
