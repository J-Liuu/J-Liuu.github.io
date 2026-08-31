# Startup Flowers

`flowers-source.mp4` is Jacky's supplied `0001-0150.mp4`, preserved unchanged.
Source: 1920 x 1080, 24 fps, 150 frames (6.25 seconds), no audio.

`flowers-intro.mp4` plays source times 1s up to 5s once. Its 96 frames at 24 fps
last 4 seconds, ending just before the frame at 5s.

`flowers-idle.mp4` starts on that next frame at 5s, plays backward to 4s, then
forward toward 5s. Its 48 frames at 24 fps form a 2-second loop without duplicated
turnaround frames. This clip takes over after the intro, so only the final second
of the selected source segment keeps moving.

Both videos are H.264/yuv420p at 1280 x 720 with fast-start metadata and no audio.

`flowers-poster.jpg` shows the source at 1s. It is the loading fallback and the
static artwork for visitors who prefer reduced motion.

Rebuild the derivatives with `./scripts/build-startup-video.ps1 -FFmpeg <path>`.
Playback starts with the popup animation, stays muted, and pauses in hidden tabs.
The intro stays underneath the idle clip until that clip starts playing, avoiding
a blank frame during the handoff. Tab changes and input never restart the intro;
reduced-motion preferences pause both clips.
