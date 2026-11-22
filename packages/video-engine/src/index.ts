import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);

export * from "./types/schema";
export { AnimoraVideo } from "./compositions/AnimoraVideo";
export { RemotionRoot } from "./Root";
