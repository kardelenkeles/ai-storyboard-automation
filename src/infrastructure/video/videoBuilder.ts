import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import type { VideoBuilder, VideoBuildOptions, VideoBuildResult, VideoBuildProgress } from '../../core/ports/videoBuilder.port'

function secondsToMs(v: number) { return Math.round(v * 1000) }

export class VideoBuilderImpl implements VideoBuilder {
  async initialize(): Promise<void> {
    // verify ffmpeg available
    // we won't spawn here; defer to build to surface errors
  }

  private async createTempDir(projectRoot: string): Promise<string> {
    const tmp = path.join(projectRoot, 'temp', `video-${Date.now()}-${Math.floor(Math.random() * 10000)}`)
    await fsp.mkdir(tmp, { recursive: true })
    return tmp
  }

  async build(options: VideoBuildOptions, onProgress?: (p: VideoBuildProgress) => void): Promise<VideoBuildResult> {
    const { images, transitionDuration = 1.0, fps = 30, resolution, narrationPath, musicPath } = options
    if (!images || images.length === 0) throw new Error('No images provided')

    // compute base durations and total
    const imgDurations = images.map(i => i.duration)
    let totalImagesDuration = imgDurations.reduce((a,b) => a+b, 0)
    const transitions = Math.max(0, images.length - 1)
    let videoDuration = totalImagesDuration - transitions * transitionDuration

    // if narration provided, get its duration
    let narrationDurationSec: number | null = null
    if (narrationPath) {
      try {
        // use ffprobe to get duration
        const dur = await this.probeDuration(narrationPath)
        narrationDurationSec = dur
      } catch (e) {
        // ignore and proceed
      }
    }

    if (narrationDurationSec !== null && narrationDurationSec > videoDuration) {
      // extend last image
      const extra = narrationDurationSec - videoDuration
      imgDurations[imgDurations.length -1] += extra
      totalImagesDuration += extra
      videoDuration = totalImagesDuration - transitions * transitionDuration
    }

    const projectRoot = path.dirname(options.outputPath)
    const tmp = await this.createTempDir(projectRoot)

    // Build ffmpeg inputs
    const args: string[] = []
    // image inputs
    images.forEach((img, idx) => {
      args.push('-loop','1')
      args.push('-t', String(imgDurations[idx]))
      args.push('-i', img.path)
    })

    // audio inputs
    const audioOffset = images.length
    if (narrationPath) args.push('-i', narrationPath)
    if (musicPath) args.push('-i', musicPath)

    // filter_complex for xfade
    const vfParts: string[] = []
    const labels: string[] = []
    for (let i=0;i<images.length;i++) {
      labels.push(`[v${i}]`)
      vfParts.push(``)
    }

    // prepare video input format conversions
    let filterComplex = ''
    for (let i=0;i<images.length;i++) {
      filterComplex += `[${i}:v]format=yuv420p,setsar=1[fv${i}];`
    }

    // chain xfade operations
    if (images.length === 1) {
      filterComplex += `[0:v]scale=${resolution ?? '-2:1080'},fps=${fps}[vout]`
    } else {
      // compute offsets for each xfade: offset_n = sum_{k=0..n-1} Dk - n*t
      const offsets: number[] = []
      for (let n=1;n<images.length;n++) {
        const sum = imgDurations.slice(0,n).reduce((a,b)=>a+b,0)
        offsets.push(sum - n*transitionDuration)
      }

      // start chain: [fv0][fv1]xfade=... -> [x1]
      for (let n=1;n<images.length;n++) {
        const a = n===1 ? `[fv0][fv1]` : `[x${n-1}][fv${n}]`
        const out = `[x${n}]`
        const offset = offsets[n-1]
        filterComplex += `${a}xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${out};`
      }

      filterComplex += `[x${images.length-1}]scale=${resolution ?? '-2:1080'},fps=${fps}[vout]`
    }

    // audio mixing
    let audioMap = ''
    if (narrationPath && musicPath) {
      const narrIdx = audioOffset
      const musicIdx = audioOffset + (narrationPath ? 1 : 0)
      // lower music volume
      filterComplex += `[${narrIdx}:a]adelay=0|0[a_narr];[${musicIdx}:a]volume=0.3[a_music];[a_narr][a_music]amix=inputs=2:duration=longest:dropout_transition=2[aout];`
      audioMap = `-map [aout]`
    } else if (narrationPath) {
      const narrIdx = audioOffset
      // map narration directly
      audioMap = `-map ${narrIdx}:a`
    } else if (musicPath) {
      const musicIdx = audioOffset
      audioMap = `-map ${musicIdx}:a`
    }

    // complete args
    args.push('-filter_complex', filterComplex)
    args.push('-map', '[vout]')
    if (audioMap) {
      // audioMap may be like '-map [aout]' or '-map N:a'
      const parts = audioMap.split(' ')
      args.push(...parts)
    }

    // encoding options
    args.push('-c:v','libx264','-pix_fmt','yuv420p','-r',String(fps))
    if (audioMap) args.push('-c:a','aac','-b:a','192k')
    args.push('-y', options.outputPath)

    // spawn ffmpeg
    return await new Promise<VideoBuildResult>((resolve, reject) => {
      const ff = spawn('ffmpeg', args, { stdio: ['ignore','pipe','pipe'] })
      let stdout = ''
      ff.stdout.on('data', (d) => { stdout += d.toString(); parseProgress(d.toString(), onProgress) })
      ff.stderr.on('data', (d) => { parseProgress(d.toString(), onProgress) })
      ff.on('error', (err) => reject(err))
      ff.on('close', (code) => {
        // cleanup tmp
        void fsp.rm(tmp, { recursive: true, force: true })
        if (code === 0) {
          resolve({ outputPath: options.outputPath, durationMs: secondsToMs(videoDuration) })
        } else {
          reject(new Error(`ffmpeg exited with ${code}`))
        }
      })
    })
  }

  private async probeDuration(filePath: string): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const ff = spawn('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', filePath])
      let out = ''
      ff.stdout.on('data', (d) => out += d.toString())
      ff.on('close', (code) => {
        if (code !== 0) return resolve(0)
        const v = parseFloat(out.trim())
        resolve(isFinite(v) ? v : 0)
      })
      ff.on('error', (err) => reject(err))
    })
  }
}

export default VideoBuilderImpl

function parseProgress(chunk: string, onProgress?: (p: VideoBuildProgress) => void) {
  if (!onProgress) return
  // ffmpeg prints lines like: frame=..., time=00:00:01.23, bitrate=..., speed=...
  const timeMatch = chunk.match(/time=\s*([0-9:.]+)/)
  if (timeMatch) {
    const timeStr = timeMatch[1]
    const parts = timeStr.split(':').map(p => parseFloat(p))
    const seconds = parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2] : parts.length === 2 ? parts[0]*60 + parts[1] : parts[0]
    onProgress({ time: seconds * 1000 })
    return
  }
  const percentMatch = chunk.match(/frame=/)
  if (percentMatch) onProgress({ message: chunk.trim() })
}
