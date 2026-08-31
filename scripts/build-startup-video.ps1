param([string]$FFmpeg = 'ffmpeg')

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$media = Join-Path $repo 'assets/media'
$source = Join-Path $media 'flowers-source.mp4'
$loop = Join-Path $media 'flowers-ping-pong.mp4'
$poster = Join-Path $media 'flowers-poster.jpg'

# The supplied source is 24 fps. Include 1s and 5s on the forward leg,
# then omit both endpoints from the reverse leg: 97 + 95 = 192 frames (8s).
$filter = '[0:v]trim=start_frame=24:end_frame=121,setpts=PTS-STARTPTS,scale=1280:-2,setsar=1,split[forward][reverse];[reverse]reverse,trim=start_frame=1:end_frame=96,setpts=PTS-STARTPTS[back];[forward][back]concat=n=2:v=1:a=0,format=yuv420p[out]'
& $FFmpeg -hide_banner -y -i $source -filter_complex $filter -map '[out]' -an -map_metadata -1 -c:v libx264 -preset medium -crf 20 -r 24 -movflags +faststart $loop
if ($LASTEXITCODE -ne 0) { throw 'Could not encode the startup video loop.' }

& $FFmpeg -hide_banner -loglevel error -y -ss 1 -i $source -frames:v 1 -vf 'scale=1280:-2' -q:v 2 -update 1 $poster
if ($LASTEXITCODE -ne 0) { throw 'Could not create the startup video poster.' }
