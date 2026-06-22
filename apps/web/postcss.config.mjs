// Tailwind v4 via PostCSS (Next.js has no Vite plugin). The shared design
// system (@retail-os/ui-react) is Tailwind v4, so the public site compiles the
// same utilities + tokens as the rest of the monorepo.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
