import type { HTMLAttributes } from "svelte/elements";
import Root from "./progress.svelte";

type Props = HTMLAttributes<HTMLDivElement> & {
	value?: number;
	max?: number;
};

export {
	type Props,
	type Props as ProgressProps,
	Root,
	//
	Root as Progress,
};
