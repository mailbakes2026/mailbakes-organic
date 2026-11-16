"use client";

import { creativeVideoSources } from "@/lib/media-preview";

export function CreativePreview({ notes }: { notes: string }) {
  const videos = creativeVideoSources(notes);
  if (videos.length === 0) return null;
  return (
    <div className="creative-preview">
      {videos.map((video) =>
        video.kind === "file" ? (
          <video key={video.src} src={video.src} controls playsInline preload="metadata" />
        ) : (
          <iframe
            key={video.src}
            className={video.shape}
            src={video.src}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        ),
      )}
    </div>
  );
}
