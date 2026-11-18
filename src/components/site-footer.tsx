import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule pt-4 pb-[72px]">
      <div className="mx-auto flex max-w-wrap flex-wrap items-center gap-x-6 gap-y-2 px-4 type-meta text-meta sm:px-8">
        <span>Tally</span>
        <Link href="/rank-debug" className="text-meta underline decoration-rule underline-offset-[3px]">
          Ranking details
        </Link>
        <Link href="/settings" className="text-meta underline decoration-rule underline-offset-[3px]">
          Settings
        </Link>
        <span>Stories, people and comments here are synthetic sample data.</span>
      </div>
    </footer>
  );
}
