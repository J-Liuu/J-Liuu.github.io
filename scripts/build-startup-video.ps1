param([string]$FFmpeg = 'ffmpeg')

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$media = Join-Path $repo 'assets/media'
$source = Join-Path $media 'flowers-source.mp4'
$video = Join-Path $media 'flowers-intro.mp4'
$idle = Join-Path $media 'flowers-idle.mp4'
$poster = Join-Path $media 'flowers-poster.jpg'

# Stop just before 5s; the idle clip starts with the next source frame at 5s.
$filter = 'trim=start_frame=24:end_frame=120,setpts=PTS-STARTPTS,scale=1280:-2,setsar=1,format=yuv420p'
& $FFmpeg -hide_banner -y -i $source -vf $filter -an -map_metadata -1 -c:v libx264 -preset medium -crf 20 -r 24 -movflags +faststart $video
if ($LASTEXITCODE -ne 0) { throw 'Could not encode the startup video.' }

# 5s back to 4s, then forward to 5s. Do not repeat either turnaround frame.
$idleFilter = '[0:v]trim=start_frame=96:end_frame=121,setpts=PTS-STARTPTS,scale=1280:-2,setsar=1,split[reverse][forward];[reverse]reverse,setpts=PTS-STARTPTS[back];[forward]trim=start_frame=1:end_frame=24,setpts=PTS-STARTPTS[ahead];[back][ahead]concat=n=2:v=1:a=0,format=yuv420p[out]'
& $FFmpeg -hide_banner -y -i $source -filter_complex $idleFilter -map '[out]' -an -map_metadata -1 -c:v libx264 -preset medium -crf 20 -r 24 -movflags +faststart $idle
if ($LASTEXITCODE -ne 0) { throw 'Could not encode the last-second idle loop.' }

& $FFmpeg -hide_banner -loglevel error -y -ss 1 -i $source -frames:v 1 -vf 'scale=1280:-2' -q:v 2 -update 1 $poster
if ($LASTEXITCODE -ne 0) { throw 'Could not create the startup video poster.' }
