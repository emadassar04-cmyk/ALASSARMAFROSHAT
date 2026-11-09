import type { ReactNode } from "react";

// تنسيق بسيط وآمن لنص السياسة (نص عادي، بلا HTML):
// سطر يبدأ بـ "## " عنوان فرعي، وأسطر متتالية تبدأ بـ "- " قائمة، وباقي الأسطر فقرات يفصلها سطر فارغ.
export function PolicyBody({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) out.push(<p key={out.length} className="whitespace-pre-line">{para.join("\n")}</p>);
    if (list.length) out.push(<ul key={out.length} className="list-disc space-y-1 ps-6">{list.map((t, i) => <li key={i}>{t}</li>)}</ul>);
    para = [];
    list = [];
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) { flush(); out.push(<h2 key={out.length} className="pt-2 text-lg font-bold">{line.slice(3)}</h2>); continue; }
    if (line.startsWith("- ")) { if (para.length) flush(); list.push(line.slice(2)); continue; }
    if (list.length) flush();
    para.push(line);
  }
  flush();
  return <div className="space-y-4 leading-loose">{out}</div>;
}
