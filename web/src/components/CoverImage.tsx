import { useEffect, useState } from "react";
import { coverIdFromPath, fetchAuthorizedBlob } from "../api/client";

const cache = new Map<string, string>();

export function CoverImage({ coverPath, title }: { coverPath: string; title: string }) {
  const [src, setSrc] = useState<string | null>(cache.get(coverPath) ?? null);

  useEffect(() => {
    const coverId = coverIdFromPath(coverPath);
    if (!coverId) return;
    if (cache.has(coverPath)) {
      setSrc(cache.get(coverPath) ?? null);
      return;
    }
    let cancelled = false;
    fetchAuthorizedBlob(`/music/cover/${coverId}`)
      .then((url) => {
        cache.set(coverPath, url);
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [coverPath]);

  if (!src) {
    return <div className="cover cover-placeholder" aria-hidden title={title} />;
  }
  return (
    <div className="cover">
      <img src={src} alt="" />
    </div>
  );
}