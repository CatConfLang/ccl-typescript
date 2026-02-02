

/** @type {import('tailwindcss').Config} */
const config = {
	// Content scanning still needed for v4
	content: ["./src/**/*.{html,js,svelte,ts}"],

	// Base16 plugin - keep this in JS config since it's a complex plugin
	// plugins: [base16Tailwind()],
};

export default config;
