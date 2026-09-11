// Layout for print-oriented routes: no app chrome (header, nav), white page.
// The sheet itself is black on white so the browser print preview matches
// what lands on paper.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
