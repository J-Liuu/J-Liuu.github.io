# Startup Flowers

`flowers-source.mp4` is Jacky's supplied `0001-0150.mp4`, preserved unchanged.
Source: 1920 x 1080, 24 fps, 150 frames (6.25 seconds), no audio.

`flowers-ping-pong.mp4` plays source times 1s through 5s, then back toward 1s.
It contains 192 frames at 24 fps (8 seconds), encoded as H.264/yuv420p at
1280 x 720 with fast-start metadata and no audio. Turnaround frames are not
duplicated, including at the loop boundary.

`flowers-poster.jpg` shows the source at 1s. It is the loading fallback and the
static artwork for visitors who prefer reduced motion.

Rebuild both derivatives with `./scripts/build-startup-video.ps1 -FFmpeg <path>`.
Playback starts with the popup animation, stays muted, and pauses in hidden tabs.
