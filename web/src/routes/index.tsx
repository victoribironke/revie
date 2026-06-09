import { createFileRoute, Link } from "@tanstack/react-router";
import cafeImg from "@/assets/cafe.jpg";
import mapTextureImg from "@/assets/map-texture.jpg";

const TELEGRAM_URL = "https://t.me/revie_chatbot";

const TelegramIcon = ({ className }: { className?: string }) => {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
};

const SearchIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
};

const Index = () => {
  return (
    <div className="bg-parchment text-ink font-sans selection:bg-accent/10 min-h-screen">
      {/* Nav */}
      <nav className="py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Revie Logo" className="size-8 rounded-[6px]" />
            <span className="font-medium tracking-tight">Revie</span>
          </div>
          <a href="#how" className="text-sm font-medium hover:text-accent transition-colors">
            How it works
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="py-20 lg:py-32">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
          {/* <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-8 bg-accent/40" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-accent-deep">
              Edition No. 01
            </span>
            <span className="h-px w-8 bg-accent/40" />
          </div> */}
          <h1 className="font-display text-4xl lg:text-6xl leading-tight text-balance mb-8 max-w-[20ch]">
            The local insight of its top reviews,{" "}
            <span className="italic text-accent">summarized</span> in a chat.
          </h1>
          <p className="text-[#5c544d] text-base sm:text-lg mb-10 max-w-[56ch] text-pretty">
            Revie transforms scattered Google Maps feedback into a single, honest conversation. Ask
            about the noise, the vibe, or the secret menu items without reading a single paragraph.
          </p>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-ink text-parchment px-6 py-3 text-sm font-medium tracking-wide flex items-center gap-2 shadow-xl shadow-accent-deep/15 hover:bg-accent-deep transition-colors duration-300"
          >
            <TelegramIcon className="size-4 shrink-0" />
            Open in Telegram
          </a>
          <div className="mt-16 pt-8 grid grid-cols-3 gap-12 border-t border-accent-soft/60 max-w-md w-full">
            <div>
              <div className="text-2xl font-display text-accent-deep">200M+</div>
              <div className="text-[10px] uppercase tracking-widest text-[#8c847d] mt-1">
                Places
              </div>
            </div>
            <div>
              <div className="text-2xl font-display text-accent-deep">≈ 5s</div>
              <div className="text-[10px] uppercase tracking-widest text-[#8c847d] mt-1">
                Analysis
              </div>
            </div>
            <div>
              <div className="text-2xl font-display text-accent-deep">Anywhere</div>
              <div className="text-[10px] uppercase tracking-widest text-[#8c847d] mt-1">
                On Maps
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat mockup */}
      <section className="pb-24" aria-label="Example conversation">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-[24px] ring-1 ring-accent/10 shadow-2xl shadow-accent-deep/10 p-6 md:p-8 relative">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-accent/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-accent-deep/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="space-y-6">
                {/* Bot intro */}
                <div className="flex gap-4 items-start">
                  <div className="size-8 bg-ember rounded-full shrink-0 flex items-center justify-center ring-1 ring-accent/15">
                    <span className="text-[10px] font-semibold text-accent-deep">RB</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="bg-ember/60 ring-1 ring-accent/10 rounded-3xl rounded-tl-none p-4 max-w-[85%]">
                      <p className="text-sm font-bold text-ink">L'Archiviste Cafe</p>
                      <p className="text-[12px] text-[#8c847d] mt-0.5">
                        ⭐⭐⭐⭐⭐ 4.8/5 | 🗺️ 12 Rue de la Paix, Paris
                      </p>
                      <div className="my-2 border-t border-[#8c847d]/30 w-full" />
                      <p className="text-sm leading-relaxed text-[#5c544d]">
                        I've analyzed the most helpful recent reviews. People love the atmosphere,
                        but mention the back room gets quite chilly in the evenings.
                      </p>
                      <p className="text-[12px] italic text-[#8c847d] mt-3">
                        Ask me anything about this place, or type a new place name to search again.
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="bg-white/60 border border-accent/10 rounded-md py-1.5 px-2 text-center text-[11px] font-medium text-accent-deep">
                          🍽️ How's the food?
                        </div>
                        <div className="bg-white/60 border border-accent/10 rounded-md py-1.5 px-2 text-center text-[11px] font-medium text-accent-deep">
                          💸 Is it expensive?
                        </div>
                        <div className="bg-white/60 border border-accent/10 rounded-md py-1.5 px-2 text-center text-[11px] font-medium text-accent-deep">
                          👨‍👩‍👧‍👦 Good for families?
                        </div>
                        <div className="bg-white/60 border border-accent/10 rounded-md py-1.5 px-2 text-center text-[11px] font-medium text-accent-deep">
                          ⏰ Best time to go?
                        </div>
                        <div className="col-span-2 bg-white/60 border border-accent/10 rounded-md py-1.5 px-2 text-center text-[11px] font-medium text-accent-deep">
                          🗺️ Open in Google Maps
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User message */}
                <div className="flex gap-4 items-start flex-row-reverse">
                  <div className="size-8 bg-accent rounded-full shrink-0 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-white">ME</span>
                  </div>
                  <div className="flex-1 flex justify-end">
                    <div className="bg-accent text-white rounded-3xl rounded-tr-none py-2.5 px-4 text-sm">
                      Is it a good place to work for a few hours?
                    </div>
                  </div>
                </div>

                {/* Bot analysis */}
                <div className="flex gap-4 items-start">
                  <div className="size-8 bg-ember rounded-full shrink-0 flex items-center justify-center ring-1 ring-accent/15">
                    <span className="text-[10px] font-semibold text-accent-deep">RB</span>
                  </div>
                  <div className="flex-1">
                    <div className="bg-ember/60 ring-1 ring-accent/10 rounded-3xl rounded-tl-none p-4 space-y-3 max-w-[85%]">
                      <p className="text-sm font-medium text-ink underline decoration-accent/50 decoration-2 underline-offset-4">
                        Workspace Analysis
                      </p>
                      <ul className="space-y-2">
                        <li className="flex gap-2 text-sm text-[#5c544d]">
                          <span className="text-accent font-medium">✓</span>
                          Excellent Wi-Fi (consistently mentioned as reliable)
                        </li>
                        <li className="flex gap-2 text-sm text-[#5c544d]">
                          <span className="text-accent font-medium">✓</span>
                          Outlets under the banquette seating
                        </li>
                        <li className="flex gap-2 text-sm text-[#5c544d]">
                          <span className="text-[#c9a899] font-medium">–</span>
                          Music is jazz-heavy and can be loud after 4 PM
                        </li>
                      </ul>
                      <p className="text-sm italic text-[#8c847d] pt-2 border-l-2 border-accent/30 pl-3">
                        "A regular mentioned the corner tables are the only ones with consistent
                        light for reading."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 bg-ember">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-12 justify-center">
            <span className="h-px w-8 bg-accent/40" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-accent-deep">
              How it works
            </span>
            <span className="h-px w-8 bg-accent/40" />
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: "Step 01",
                title: "Share a location",
                body: "Paste any link (Google Maps, Instagram, a blog) or type the name of the place directly into the Telegram chat.",
              },
              {
                step: "Step 02",
                title: "We read for you",
                body: "Revie scans the most relevant recent reviews and pulls in information from across the web, filtering for honesty, detail, and specific mentions of what matters.",
              },
              {
                step: "Step 03",
                title: "Ask follow-ups",
                body: "Dig deeper into the menu, the seating, or the noise levels. It's like texting a friend who knows the place inside out.",
              },
            ].map((s) => (
              <div key={s.step} className="space-y-4">
                <span className="text-[12px] font-medium tracking-widest text-accent uppercase">
                  {s.step}
                </span>
                <h3 className="font-display text-2xl text-ink">{s.title}</h3>
                <p className="text-sm sm:text-base text-[#5c544d] max-w-[40ch] text-pretty">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Examples */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-ink rounded-[32px] p-8 md:p-16 text-parchment overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-[45ch]">
              <div className="flex items-center gap-3 mb-6">
                <span className="h-px w-8 bg-accent-soft/40" />
                <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-accent-soft">
                  Sample questions
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-4xl leading-tight mb-8">
                Know before you <span className="italic text-accent-soft">go.</span>
              </h2>
              <div className="space-y-6">
                {[
                  "Is the vegan pizza actually good or just an afterthought?",
                  "Do people mention if the terrace gets too much sun at noon?",
                  "Can I bring a large dog inside or only the small patio?",
                ].map((q) => (
                  <div key={q} className="flex gap-4 items-center group">
                    <div className="size-10 rounded-full bg-accent/15 flex items-center justify-center ring-1 ring-accent-soft/20 shrink-0">
                      <SearchIcon className="size-4 text-accent-soft" />
                    </div>
                    <p className="text-parchment/70 text-sm sm:text-base italic group-hover:text-parchment transition-colors">
                      "{q}"
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -right-20 -bottom-20 opacity-20 pointer-events-none">
              <img
                src={mapTextureImg}
                alt=""
                width={600}
                height={600}
                loading="lazy"
                aria-hidden="true"
                className="size-150 rounded-full object-cover outline-1 -outline-offset-1 outline-accent-soft/10 mix-blend-screen"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <footer className="py-24 border-t border-accent-soft/40">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <img
            src="/icon.png"
            alt="Revie Logo"
            className="size-12 rounded-2xl mx-auto mb-6 shadow-lg shadow-accent-deep/20"
          />
          <h2 className="font-display text-4xl mb-6">
            Ready to <span className="italic text-accent">travel smarter?</span>
          </h2>
          <p className="text-[#5c544d] mb-10 max-w-[40ch] mx-auto text-pretty">
            Add Revie to your Telegram and start making better choices about where you spend your
            time.
          </p>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-ink text-parchment px-8 py-3 text-sm font-medium tracking-wide shadow-xl shadow-accent-deep/15 hover:bg-accent-deep transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <TelegramIcon className="size-4 shrink-0" />
            Start Talking to Revie
          </a>

          <div className="mt-24 pt-8 border-t border-accent-soft/40 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-[12px] text-[#8c847d] font-medium tracking-tight">
              © {new Date().getFullYear()} Revie. Built by{" "}
              <a
                href="https://www.victoribironke.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Victor Ibironke
              </a>
            </p>
            <div className="flex gap-8">
              <a
                href="https://github.com/victoribironke/revie"
                className="text-[12px] text-[#8c847d] hover:text-accent transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <Link
                to="/privacy"
                className="text-[12px] text-[#8c847d] hover:text-accent transition-colors"
              >
                Privacy
              </Link>
              <a
                href="mailto:hello@victoribironke.com"
                className="text-[12px] text-[#8c847d] hover:text-accent transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Revie — Conversational Google Maps reviews on Telegram" },
      {
        name: "description",
        content:
          "Ask any place a question on Telegram. Revie reads Google Maps reviews and answers like a well-traveled friend.",
      },
      { property: "og:title", content: "Revie — Conversational Google Maps reviews" },
      {
        property: "og:description",
        content:
          "Stop scrolling reviews. Ask Revie about any place on Telegram and get a synthesized, honest answer.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: cafeImg },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: cafeImg },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});
