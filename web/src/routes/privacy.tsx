import { createFileRoute, Link } from "@tanstack/react-router";

const Privacy = () => {
  return (
    <div className="bg-parchment text-ink font-sans selection:bg-accent/10 min-h-screen pb-24">
      {/* Nav */}
      <nav className="py-6 px-6 border-b border-accent-soft/20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="text-sm font-medium tracking-tight hover:text-accent transition-colors flex items-center gap-2"
          >
            <span aria-hidden="true">&larr;</span> Back to Revie
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 pt-16">
        <div className="mb-12">
          <h1 className="font-display text-4xl lg:text-5xl mb-4 text-balance">
            Revie Privacy Policy
          </h1>
          <p className="text-[12px] uppercase tracking-widest text-[#8c847d] font-semibold">
            Effective Date: May 25, 2026
          </p>
        </div>

        <div className="space-y-12 text-[#5c544d] leading-relaxed text-sm sm:text-base text-pretty">
          <section>
            <p>
              Revie ("we," "our," or "the Bot") is committed to protecting your privacy. This policy
              outlines how we handle data when you use our service via Telegram.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl text-ink">1. Data We Collect</h2>
            <p>
              We collect the minimum information necessary to provide the review summarization
              service:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink font-medium">Telegram User ID:</strong> A unique
                numerical identifier provided by Telegram to maintain your session state.
              </li>
              <li>
                <strong className="text-ink font-medium">Message Content:</strong> We process
                location links (Google Maps URLs) and place names you send to fetch reviews.
              </li>
              <li>
                <strong className="text-ink font-medium">Chat History:</strong> If you ask follow-up
                questions, we temporarily store the recent conversation context to provide coherent
                AI responses.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl text-ink">2. How We Use Your Data</h2>
            <p>Your data is used strictly for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink font-medium">Disambiguation:</strong> To help you select
                the correct location from a list of matches.
              </li>
              <li>
                <strong className="text-ink font-medium">Summarization:</strong> To fetch, process,
                and summarize Google Maps reviews using our integrated AI models.
              </li>
              <li>
                <strong className="text-ink font-medium">State Management:</strong> To remember
                which location you are currently chatting about.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl text-ink">3. Data Processing and Third Parties</h2>
            <p>
              To function, Revie securely communicates with the following third-party APIs. We do
              not sell your data to these parties:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink font-medium">SerpAPI:</strong> To fetch location data
                and raw review text from Google Maps.
              </li>
              <li>
                <strong className="text-ink font-medium">OpenRouter:</strong> To process the raw
                reviews and generate the conversational AI summaries.
              </li>
              <li>
                <strong className="text-ink font-medium">Supabase:</strong> For secure database
                storage of session states (User ID and cached summaries).
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl text-ink">4. Data Retention</h2>
            <p>
              We do not persist your raw chat logs indefinitely. Cached summaries and session states
              (the "Knowledge Profile") are stored to improve your experience but can be cleared at
              any time by using the{" "}
              <code className="bg-accent-soft/20 px-1.5 py-0.5 rounded text-ink text-sm">
                /newsearch
              </code>{" "}
              or{" "}
              <code className="bg-accent-soft/20 px-1.5 py-0.5 rounded text-ink text-sm">/end</code>{" "}
              commands.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl text-ink">5. Your Rights</h2>
            <p>
              You control your data. You may delete your active session state and all cached
              location data associated with your Telegram User ID instantly by sending the{" "}
              <code className="bg-accent-soft/20 px-1.5 py-0.5 rounded text-ink text-sm">/end</code>{" "}
              command to the Bot.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl text-ink">6. Contact</h2>
            <p>
              If you have any questions regarding this Privacy Policy, please contact us through the
              support channels listed on our marketing website or via Telegram.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Revie" },
      {
        name: "description",
        content: "Learn how Revie handles your data and privacy.",
      },
    ],
  }),
  component: Privacy,
});
