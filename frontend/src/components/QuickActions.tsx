type QuickActionsProps = {
  disabled: boolean;
  onSelect: (prompt: string) => void;
};

const actions = [
  "Tell me a joke",
  "Sing a song",
  "Tell a nursery rhyme",
];

export function QuickActions({ disabled, onSelect }: QuickActionsProps) {
  return (
    <div className="quick-actions">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          className="quick-actions__button"
          disabled={disabled}
          onClick={() => onSelect(action)}
        >
          {action}
        </button>
      ))}
    </div>
  );
}
