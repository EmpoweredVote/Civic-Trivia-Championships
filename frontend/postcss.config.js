export default {
  plugins: {
    // Tailwind 4 ships its PostCSS integration as a separate package, and
    // handles vendor prefixing itself — autoprefixer is no longer needed.
    '@tailwindcss/postcss': {}
  }
};
