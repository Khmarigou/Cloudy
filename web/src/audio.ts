import type { MusicUploadSpec } from "./api/types";
import { parseBlob } from "music-metadata";

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  mp4: "audio/mp4",
  m4a: "audio/x-m4a",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  opus: "audio/opus",
  wma: "audio/x-ms-wma",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  webm: "audio/webm",
  amr: "audio/amr",
  mid: "audio/midi",
  midi: "audio/midi",
  "3gp": "audio/3gpp",
};

export const ACCEPTED_AUDIO = Object.keys(MIME_BY_EXTENSION)
  .map((ext) => `.${ext}`)
  .join(",");

export function withAuthorizedMimeType(file: File): File {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mapped = MIME_BY_EXTENSION[extension];
  if (!mapped) return file;
  if (file.type === mapped) return file;
  return new File([file], file.name, { type: mapped, lastModified: file.lastModified });
}

export function isLikelyAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return extension in MIME_BY_EXTENSION;
}

function fallbackName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "") || fileName;
}

export async function buildUploadSpec(file: File): Promise<{
  spec: MusicUploadSpec;
  cover?: Blob;
}> {
  let title = fallbackName(file.name);
  let album = "Unknown album";
  let artist = "Unknown artist";
  let albumPosition: number | null = null;
  let duration = 0;
  let cover: Blob | undefined;

  try {
    const metadata = await parseBlob(file);
    title = metadata.common.title?.trim() || title;
    album = metadata.common.album?.trim() || album;
    artist =
      metadata.common.artist?.trim() ||
      metadata.common.artists?.find(Boolean)?.trim() ||
      artist;
    albumPosition = metadata.common.track.no ?? null;
    duration = Math.round((metadata.format.duration ?? 0) * 1000);
    const picture = metadata.common.picture?.[0];
    if (picture) {
      cover = new Blob([new Uint8Array(picture.data)], {
        type: picture.format || "image/jpeg",
      });
    }
  } catch {
    duration = await durationFromAudioElement(file);
  }

  const artistUpload = {
    name: artist,
    nbPlayed: 0,
    isInQuickAccess: false,
  };

  return {
    spec: {
      name: title,
      albumUpload: {
        name: album,
        nbPlayed: 0,
        isInQuickAccess: false,
        artistUpload,
      },
      artists: [artistUpload],
      albumPosition,
      duration,
      nbPlayed: 0,
      isInQuickAccess: false,
    },
    cover,
  };
}

function durationFromAudioElement(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const millis = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
      URL.revokeObjectURL(url);
      resolve(millis);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}

export function formatDuration(millis: number): string {
  if (!millis || millis < 0) return "—";
  const totalSeconds = Math.round(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatAddedDate(millis: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(millis));
}
