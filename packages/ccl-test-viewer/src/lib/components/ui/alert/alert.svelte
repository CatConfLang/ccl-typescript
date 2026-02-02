<script lang="ts">
import { cn } from "@/utils.js";
import type { Props } from "./index.js";
import { alertVariants } from "./variants.js";

type $$Props = Props;

let className: $$Props["class"] ;
export const variant: $$Props["variant"] = undefined;
export { className as class };
</script>

<div class={cn(alertVariants({ variant }), className)} role="alert" {...$$restProps}>
	<slot />
</div>