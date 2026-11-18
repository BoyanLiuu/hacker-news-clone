import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function FrontPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        current="Front"
        viewer={{ name: "mlin", karma: 1284 }}
        doc={{ section: "front page", rev: 862, rankedAt: "14:31:22", age: "39 s", gravity: 1.8 }}
      />

      <main className="mx-auto w-full max-w-wrap grow px-4 pt-6 sm:px-8">
        <div className="page-grid">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 tabIndex={-1} className="type-title">
                Front page
              </h1>
              <span className="text-[13.5px] text-meta">
                68 candidates from the last 7 days, ranked by score and age
              </span>
            </div>

            {/* The ranked list lands in M2. The rules are here so the grid and type can be checked now. */}
            <div className="mt-4 rule-open">
              {/* The head band is hidden at 640px and below; its figures move into each row's meta line. */}
              <div className="hidden grid-cols-[30px_70px_1fr_52px_74px] gap-x-3 bg-head px-1 py-[7px] type-label text-ink-2 sm:grid">
                <span className="text-right">#</span>
                <span className="text-right">Points</span>
                <span>Story</span>
                <span className="text-right">Age</span>
                <span className="text-right">Comments</span>
              </div>
              <p className="rule-divide px-1 py-[7px] type-meta text-meta">
                Ranked rows arrive in M2.
              </p>
              <div className="rule-close" />
            </div>
          </div>

          <aside className="page-aside">
            <h2 className="type-section">
              <span className="pr-2 font-medium text-meta">Figure 1</span>
              Score against age
            </h2>
            <p className="mt-2 type-meta text-meta">The decay characteristic arrives in M4.</p>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
