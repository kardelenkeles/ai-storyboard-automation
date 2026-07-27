export interface VideoEncoderPort {
  generateVideo(imagePaths: readonly string[], outputPath: string): Promise<string>
}