export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
};

type ChatWindowProps = {
  messages: ChatMessage[];
  loading: boolean;
};

export function ChatWindow({ messages, loading }: ChatWindowProps) {
  return (
    <div className="chat-window">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`chat-bubble chat-bubble--${message.role}`}
        >
          <span className="chat-bubble__role">
            {message.role === "assistant" ? "Assistant" : "You"}
          </span>
          <p className="chat-bubble__text">{message.content}</p>
          {message.meta ? <span className="chat-bubble__meta">{message.meta}</span> : null}
        </article>
      ))}

      {loading ? (
        <article className="chat-bubble chat-bubble--assistant chat-bubble--loading">
          <span className="chat-bubble__role">Assistant</span>
          <p className="chat-bubble__text">Thinking...</p>
        </article>
      ) : null}
    </div>
  );
}
