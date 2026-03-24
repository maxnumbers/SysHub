import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: Props) {
  return (
    <div className={`prose-sm prose-sepia max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-base font-semibold text-ink mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold text-ink mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-medium text-ink mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="text-sm text-ink leading-relaxed mb-2">{children}</p>,
          ul: ({ children }) => <ul className="text-sm text-ink list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="text-sm text-ink list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return <pre className="bg-paper-darker p-2 rounded text-xs overflow-x-auto mb-2"><code>{children}</code></pre>;
            }
            return <code className="bg-paper-darker px-1 py-0.5 rounded text-xs">{children}</code>;
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent pl-3 italic text-ink-muted text-sm my-2">{children}</blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic text-ink-muted">{children}</em>,
          hr: () => <hr className="border-border my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
