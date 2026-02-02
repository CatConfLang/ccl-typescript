// @ts-check

/** @type {import("syncpack").RcFile} */
const config = {
	sortFirst: ["name", "version", "private", "description", "homepage", "bugs", "repository"],
	semverGroups: [
		{
			range: "^",
			dependencies: ["**"],
			packages: ["**"],
		},
	],
	versionGroups: [
		{
			label: "Use workspace protocol for internal packages",
			dependencies: ["@myorg/**"],
			dependencyTypes: ["dev", "prod", "peer"],
			pinVersion: "workspace:^",
		},
	],
};

module.exports = config;
