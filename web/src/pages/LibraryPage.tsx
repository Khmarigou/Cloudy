import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  clearSession,
  deleteMusic,
  getStorage,
  listMusic,
  uploadMusic,
} from "../api/client";
import type { Music, SimpleUser, UserStorage } from "../api/types";
import {
  ACCEPTED_AUDIO,
  buildUploadSpec,
  formatAddedDate,
  isLikelyAudioFile,
  withAuthorizedMimeType,
} from "../audio";
import { CoverImage } from "../components/CoverImage";

interface UploadJob {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  message?: string;
}

type SortKey = "name" | "addedDate" | "mostListened";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Alphabetical" },
  { key: "addedDate", label: "Added date" },
  { key: "mostListened", label: "Most listened" },
];

const DEFAULT_SORT: SortKey = "addedDate";

function sortMusics(
  musics: Music[],
  sortKey: SortKey,
  ascending: boolean,
): Music[] {
  const sorted = [...musics].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return a.name.localeCompare(b.name);
      case "mostListened":
        return a.nbPlayed - b.nbPlayed;
      case "addedDate":
      default:
        return a.addedDateMillis - b.addedDateMillis;
    }
  });
  return ascending ? sorted : sorted.reverse();
}

function artistLabel(music: Music): string {
  return music.artists.map((artist) => artist.name).join(", ") || "Unknown artist";
}

export function LibraryPage({
  user,
  onSignOut,
}: {
  user: SimpleUser;
  onSignOut: () => void;
}) {
  const [musics, setMusics] = useState<Music[]>([]);
  const [storage, setStorage] = useState<UserStorage | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [searchMetadata, setSearchMetadata] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT);
  const [ascending, setAscending] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [songs, usage] = await Promise.all([listMusic(), getStorage()]);
    setMusics(songs);
    setStorage(usage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : "Could not load the library.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? musics.filter((music) => {
          const haystack = [music.name, music.album.name, artistLabel(music)]
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        })
      : musics;
    return sortMusics(filtered, sortKey, ascending);
  }, [musics, query, sortKey, ascending]);

  async function uploadFiles(files: File[]) {
    const audioFiles = files.filter(isLikelyAudioFile).map(withAuthorizedMimeType);
    if (audioFiles.length === 0) {
      setError("Drop audio files (mp3, flac, wav, m4a, …).");
      return;
    }
    setError("");
    for (const file of audioFiles) {
      const jobId = crypto.randomUUID();
      setJobs((current) => [
        { id: jobId, name: file.name, status: "uploading" },
        ...current,
      ]);
      try {
        const { spec, cover } = await buildUploadSpec(file);
        await uploadMusic(file, spec, cover, searchMetadata);
        setJobs((current) =>
          current.map((job) =>
            job.id === jobId ? { ...job, status: "done", message: "Added" } : job,
          ),
        );
        await refresh();
      } catch (cause) {
        const message = cause instanceof ApiError ? cause.message : "Upload failed";
        setJobs((current) =>
          current.map((job) =>
            job.id === jobId ? { ...job, status: "error", message } : job,
          ),
        );
      }
    }
  }

  async function removeSong(music: Music) {
    if (!window.confirm(`Remove “${music.name}” from this server?`)) return;
    setBusyId(music.id);
    try {
      await deleteMusic([music.id]);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not delete this song.");
    } finally {
      setBusyId(null);
    }
  }

  const usedPercent = storage
    ? Math.min(100, Math.round((storage.current / Math.max(storage.max.total, 0.01)) * 100))
    : 0;

  const currentSortLabel =
    SORT_OPTIONS.find((option) => option.key === sortKey)?.label ?? "";

  return (
    <div
      className="app-shell"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void uploadFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <aside className="sidebar">
        <div className="brand">
          <strong>Cloudy</strong>
          <span>Soul Searching library</span>
        </div>
        <div className="storage">
          <strong>Storage</strong>
          <div className="storage-bar" aria-hidden>
            <span style={{ width: `${usedPercent}%` }} />
          </div>
          <span className="meta">
            {storage
              ? `${storage.current.toFixed(2)} GB of ${storage.max.total.toFixed(2)} GB`
              : "Loading usage…"}
          </span>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={searchMetadata}
            onChange={(event) => setSearchMetadata(event.target.checked)}
          />
          Look up tags with AcoustID on upload
        </label>
        <div className="user-card">
          <div>
            <strong>{user.username}</strong>
            <div className="meta">{user.type}</div>
          </div>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              clearSession();
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <input
            className="search"
            placeholder="Search title, album, or artist"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="sort">
            <button
              className="btn ghost choice-btn"
              type="button"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((open) => !open)}
            >
              {currentSortLabel}
              <svg
                className="chevron"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {sortOpen ? (
              <>
                <button
                  className="dropdown-backdrop"
                  aria-label="Close sort menu"
                  onClick={() => setSortOpen(false)}
                />
                <div className="dropdown">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      className="dropdown-item"
                      type="button"
                      role="menuitemradio"
                      aria-checked={sortKey === option.key}
                      onClick={() => {
                        setSortKey(option.key);
                        setSortOpen(false);
                      }}
                    >
                      {option.label}
                      <span className="check" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </span>
                    </button>
                  ))}
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item"
                    type="button"
                    role="menuitemradio"
                    aria-checked={false}
                    onClick={() => setAscending((current) => !current)}
                  >
                    {ascending ? "Ascending" : "Descending"}
                    <span aria-hidden>
                      {ascending ? "↑" : "↓"}
                    </span>
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <button className="btn" type="button" onClick={() => inputRef.current?.click()}>
            Add music
          </button>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept={ACCEPTED_AUDIO}
            multiple
            onChange={(event) => {
              void uploadFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>

        {error ? <p className="error">{error}</p> : null}

        {loading ? <p className="status">Loading library…</p> : null}
        {!loading && visible.length === 0 ? (
          <p className="empty">No songs yet. Drop audio files anywhere on this page.</p>
        ) : (
          <section className="grid">
            {visible.map((music) => (
              <article className="card" key={music.id}>
                <button 
                className="card-close" 
                type="button" 
                aria-label="Remove song"
                disabled={busyId === music.id}
                onClick={() => void removeSong(music)}>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <CoverImage coverPath={music.coverPath} title={music.name} />
                <div className="card-body">
                  <h3>{music.name}</h3>
                  <div className="meta">{artistLabel(music)}</div>
                  <div className="meta">{music.album.name}</div>
                  <div className="card-actions">
                    <span className="meta">
                      {formatAddedDate(music.addedDateMillis)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {dragging ? (
        <div className="drop-overlay">
          <strong>Drop files to add them to Cloudy</strong>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <aside className="upload-panel">
          <strong>Uploads</strong>
          {jobs.slice(0, 6).map((job) => (
            <div className="upload-item" key={job.id}>
              <span>{job.name}</span>
              <span className="meta">
                {job.status === "uploading" ? "Uploading…" : job.message ?? job.status}
              </span>
            </div>
          ))}
        </aside>
      ) : null}
    </div>
  );
}