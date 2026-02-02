import process from "node:process";
import { defineConfig } from "vitest/config";

const config = defineConfig({
	test: {
		watch: false,
		testTimeout: process.env.GITHUB_ACTIONS ? 15_000 : 5000,
		reporters: process.env.GITHUB_ACTIONS ? ["github-actions", "junit"] : ["verbose", "junit"],
		outputFile: {
			junit: "./_temp/junit.xml",
		},
		coverage: {
			include: ["src/**"],
			provider: "v8",
			reporter: ["text", "json", "html", "cobertura"],
			reportsDirectory: ".coverage/vitest",
		},
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/esm/**",
			"**/.{idea,git,cache,output,temp}/**",
			"**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
			"**/fixtures/**",
		],
	},
});

// biome-ignore lint/style/noDefaultExport: config file
export default config;
