import { Config } from '@remotion/cli/config';

// PNG keeps the alpha channel the sprite sheet needs; the exported asset
// overlays live video, so a matted background is not an option.
Config.setVideoImageFormat('png');
Config.setEntryPoint('./src/index.ts');
