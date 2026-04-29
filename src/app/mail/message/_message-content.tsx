type MessageContentProps = {
  bodyHtml: string;
};

export function MessageContent({ bodyHtml }: MessageContentProps) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div
        className="prose prose-slate max-w-none break-words dark:prose-invert prose-headings:tracking-tight prose-p:leading-relaxed prose-a:break-words prose-a:font-medium prose-a:text-sky-700 prose-a:underline prose-a:decoration-sky-300 prose-a:underline-offset-2 hover:prose-a:text-sky-800 dark:prose-a:text-sky-300 dark:prose-a:decoration-sky-600 dark:hover:prose-a:text-sky-200 prose-blockquote:border-l-slate-300 prose-blockquote:text-slate-600 dark:prose-blockquote:border-l-slate-700 dark:prose-blockquote:text-slate-300 prose-hr:border-slate-200 dark:prose-hr:border-slate-800 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-slate-800 dark:prose-code:bg-slate-800 dark:prose-code:text-slate-100 prose-pre:overflow-x-auto prose-pre:rounded-md prose-pre:bg-slate-900/5 dark:prose-pre:bg-slate-950/40 prose-img:mx-auto prose-img:rounded-md prose-table:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </div>
  );
}
