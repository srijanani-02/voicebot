type ComposerProps = {
  disabled: boolean;
  inputValue: string;
  isRecording: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onRecordToggle: () => void;
};

export function Composer({
  disabled,
  inputValue,
  isRecording,
  onInputChange,
  onSend,
  onRecordToggle,
}: ComposerProps) {
  return (
    <div className="composer">
      <label className="composer__field">
        <span className="sr-only">Type your message</span>
        <input
          value={inputValue}
          disabled={disabled}
          placeholder="Ask anything or use the microphone..."
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
      </label>

      <div className="composer__actions">
        <button
          type="button"
          className={`composer__mic ${isRecording ? "composer__mic--active" : ""}`}
          disabled={disabled}
          onClick={onRecordToggle}
        >
          {isRecording ? "Stop" : "Mic"}
        </button>
        <button
          type="button"
          className="composer__send"
          disabled={disabled || !inputValue.trim()}
          onClick={onSend}
        >
          Send
        </button>
      </div>
    </div>
  );
}
