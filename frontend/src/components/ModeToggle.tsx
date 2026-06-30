type ModeToggleProps = {
  outputMode: "audio" | "text";
  onToggle: (nextMode: "audio" | "text") => void;
};

export function ModeToggle({ outputMode, onToggle }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <div>
        <p className="mode-toggle__eyebrow">Output Mode</p>
        <h2 className="mode-toggle__title">Audio / Text</h2>
      </div>

      <div className="mode-switch" role="group" aria-label="Output mode">
        <button
          type="button"
          className={`mode-switch__option ${outputMode === "text" ? "mode-switch__option--active" : ""}`}
          aria-pressed={outputMode === "text"}
          onClick={() => onToggle("text")}
        >
          Text
        </button>
        <button
          type="button"
          className={`mode-switch__option ${outputMode === "audio" ? "mode-switch__option--active" : ""}`}
          aria-pressed={outputMode === "audio"}
          onClick={() => onToggle("audio")}
        >
          Audio
        </button>
      </div>
    </div>
  );
}
