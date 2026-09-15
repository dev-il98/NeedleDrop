// Card-based playlist selection. Only renders fields the Spotify API
// actually returned (image/name/trackCount) — no placeholder metadata.
export default function PlaylistPicker({ playlists, likedCount, selectedId, onSelect }) {
  const items = [
    { id: "liked", name: "Liked Songs", image: null, trackCount: likedCount ?? null },
    ...playlists,
  ];

  return (
    <div className="playlist-grid">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`playlist-card cursor-target${p.id === selectedId ? " is-selected" : ""}`}
          onClick={() => onSelect(p.id)}
        >
          <div className="playlist-art">
            {p.image ? <img src={p.image} alt="" /> : <div className="playlist-art-fallback">♪</div>}
          </div>
          <div className="playlist-meta">
            <div className="playlist-name">{p.name}</div>
            {p.trackCount != null && <div className="playlist-count">{p.trackCount} tracks</div>}
          </div>
        </button>
      ))}
    </div>
  );
}