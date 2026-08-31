param([string]$FFmpeg = 'ffmpeg')

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$media = Join-Path $repo 'assets/media'
$source = Join-Path $media 'flowers-source.mp4'
$video = Join-Path $media 'flowers-intro.mp4'
$poster = Join-Path $media 'flowers-poster.jpg'

# Include the source frames at both 1s and 5s, so playback holds on exactly 5s.
$filter = 'trim=start_frame=24:end_frame=121,setpts=PTS-STARTPTS,scale=1280:-2,setsar=1,format=yuv420p'
& $FFmpeg -hide_banner -y -i $source -vf $filter -an -map_metadata -1 -c:v libx264 -preset medium -crf 20 -r 24 -movflags +faststart $video
if ($LASTEXITCODE -ne 0) { throw 'Could not encode the startup video.' }

& $FFmpeg -hide_banner -loglevel error -y -ss 1 -i $source -frames:v 1 -vf 'scale=1280:-2' -q:v 2 -update 1 $poster
if ($LASTEXITCODE -ne 0) { throw 'Could not create the startup video poster.' }
