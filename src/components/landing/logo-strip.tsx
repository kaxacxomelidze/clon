"use client";

const brands = [
  { name: "Stripe", logo: (<svg viewBox="0 0 60 25" fill="currentColor" className="h-5"><path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a10 10 0 01-4.56 1c-4.01 0-6.83-2.03-6.83-7.26 0-4.01 2.28-7.28 6.3-7.28 4.03 0 5.96 3.29 5.96 7.3 0 .5-.04 1.18-.06 1.32zm-5.92-5.36c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zm-13.96 7.35c.76 0 1.58-.3 1.96-.5v3.19c-.5.26-1.29.42-2.16.42-2.29 0-3.7-1.42-3.7-3.7v-5.72H34.2V7.35h1.66V4.56l4.07-1.03v3.82h2.63v3.27h-2.63v5.23c0 .9.47 1.45 1.83 1.45zM24.45 6.3c-1.3 0-2.32.67-2.32 2.27v8.37h-4.11V3.31h4.11v1.76c.6-1.03 1.72-1.93 3.42-1.93h.03v3.73c-.37-.31-.75-.57-1.13-.57zm-12.32 9.95c.98 0 1.85-.43 2.35-.83V18.3a7.54 7.54 0 01-3.42.73c-3.31 0-5.38-2.06-5.38-5.41 0-3.33 2.1-5.35 5.38-5.35 1.23 0 2.45.3 3.42.85V12.3c-.5-.4-1.37-.83-2.35-.83-1.52 0-2.44.97-2.44 2.39 0 1.38.92 2.39 2.44 2.39zM5.72 6.3c0-.48.19-.88.54-1.17L0 1.37 0 21.4l6.26-3.76V6.3zm0 0" /></svg>) },
  { name: "Vercel", logo: (<svg viewBox="0 0 4438 4438" fill="currentColor" className="h-5 w-5"><path d="M2219 0L4438 4438H0L2219 0z" /></svg>) },
  { name: "Linear", logo: (<svg viewBox="0 0 100 100" fill="currentColor" className="h-5 w-5"><path d="M1.22541 61.5228c-.8486-2.3695 1.9471-4.2241 3.7369-2.5943l37.1398 35.0867c1.7891 1.6298.891 4.5972-2.0065 4.3978-19.1528-2.1162-35.4982-16.2624-38.8702-36.8902zM.00124 48.9892c-.0506-21.1905 11.9539-40.4505 31.1929-51.5948 19.239-11.1443 42.8184-10.4751 62.2788.8493 18.5286 10.9553 26.1217 28.7654 24.6577 31.1578L2.66045 63.0695C1.00796 56.6395.0519 52.9095.00124 48.9892z" /></svg>) },
  { name: "Notion", logo: (<svg viewBox="0 0 100 100" fill="currentColor" className="h-5 w-5"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-.777 6.803-4.08 7.097L17.793 99.94c-2.523.19-3.883-.387-5.25-2.917l-10.79-14c-1.753-2.33-2.523-4.077-2.523-6.21V11.223c0-3.497 1.167-6.413 6.787-6.91z" /></svg>) },
  { name: "Figma", logo: (<svg viewBox="0 0 38 57" fill="currentColor" className="h-5"><path d="M19 28.5a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0zM0 47.5A9.5 9.5 0 019.5 38H19v9.5a9.5 9.5 0 01-19 0zM19 0v19h9.5a9.5 9.5 0 000-19H19zM0 9.5A9.5 9.5 0 019.5 0H19v19H9.5A9.5 9.5 0 010 9.5zM0 28.5A9.5 9.5 0 019.5 19H19v19H9.5A9.5 9.5 0 010 28.5z" /></svg>) },
  { name: "Framer", logo: (<svg viewBox="0 0 14 21" fill="currentColor" className="h-5"><path d="M0 0h14v7H7zm0 7h7l7 7H7v7l-7-7z" /></svg>) },
  { name: "Supabase", logo: (<svg viewBox="0 0 109 113" fill="currentColor" className="h-5"><path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874L63.708 110.284zM45.317 2.071C48.177-1.53 53.976.443 54.044 5.041l.796 67.251H9.875c-8.19 0-12.758-9.46-7.664-15.873L45.317 2.07z" /></svg>) },
  { name: "Next.js", logo: (<svg viewBox="0 0 180 180" fill="currentColor" className="h-5 w-5"><circle cx="90" cy="90" r="90" /><path d="M149.508 157.52L69.142 54H54V125.97H66.1V69.3L139.999 164.3a90.69 90.69 0 009.509-6.78z" fill="white" /><rect x="115" y="54" width="12" height="72" fill="white" /></svg>) },
  { name: "Tailwind", logo: (<svg viewBox="0 0 248 31" fill="currentColor" className="h-4"><path fillRule="evenodd" clipRule="evenodd" d="M25.517 0C18.712 0 14.46 3.382 12.758 10.146c2.552-3.382 5.529-4.65 8.931-3.805 1.941.482 3.329 1.882 4.864 3.432 2.502 2.524 5.398 5.445 11.722 5.445 6.804 0 11.057-3.382 12.758-10.145-2.551 3.382-5.528 4.65-8.93 3.804-1.942-.482-3.33-1.882-4.865-3.431C34.736 2.92 31.841 0 25.517 0zM12.758 15.218C5.954 15.218 1.701 18.6 0 25.364c2.552-3.382 5.529-4.65 8.93-3.805 1.942.482 3.33 1.882 4.865 3.432 2.502 2.524 5.397 5.445 11.722 5.445 6.804 0 11.057-3.382 12.758-10.145-2.552 3.382-5.529 4.65-8.931 3.805-1.941-.483-3.329-1.883-4.864-3.432-2.502-2.524-5.398-5.446-11.722-5.446z" /></svg>) },
];

export function LogoStrip() {
  const doubled = [...brands, ...brands];
  return (
    <section className="border-y border-white/[0.06] bg-black overflow-hidden py-8">
      <p className="text-center text-[10px] font-semibold text-white/25 uppercase tracking-[0.25em] mb-7">
        Clone sites from the world&apos;s best products instantly
      </p>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="flex overflow-hidden">
          <div className="flex items-center gap-12 shrink-0" style={{ animation: "marquee 28s linear infinite", willChange: "transform" }}>
            {doubled.map((brand, i) => (
              <div key={i} className="flex items-center gap-2.5 text-white/20 hover:text-white/50 transition-colors shrink-0 select-none">
                <span className="opacity-80">{brand.logo}</span>
                <span className="text-sm font-semibold tracking-tight">{brand.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
