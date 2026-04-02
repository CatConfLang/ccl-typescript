import { PackageJsonProperties, PackageJsonSorted, type PolicyConfig } from "repopo";

const config: PolicyConfig = {
	policies: [
		new PackageJsonProperties({
			requiredProperties: {
				author: "Tyler Butler <tyler@tylerbutler.com>",
				bugs: "https://github.com/tylerbutler/ccl-typescript/issues",
				license: "MIT",
			},
			propertyOverridesByPackage: {},
		}),
		new PackageJsonSorted(),
	],
};

export default config;
