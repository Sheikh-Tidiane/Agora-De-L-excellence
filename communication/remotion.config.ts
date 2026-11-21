import { Config } from "@remotion/cli/config";

// Vidéos : MP4 H.264, 30 i/s.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Plans filmés et photos : déposés dans assets/ (plans/, comite/), lus avec staticFile().
Config.setPublicDir("./assets");
Config.setEntryPoint("./src/index.ts");
