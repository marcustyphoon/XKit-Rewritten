/* global riffChunks */
import '../lib/riff-chunks.min.js';

/**
 * @param {Element} url - WebP image url
 * @returns {boolean} - Whether the image is an animated
 */
export async function isAnimatedWebP (url) {
  try {
    const imageData = await fetch(url).then(response => response.arrayBuffer());

    const { format, subChunks } = riffChunks.riffChunks(new Uint8Array(imageData));
    return format === 'WEBP' && subChunks.some(({ chunkId }) => chunkId === 'ANIM');
  } catch {
    return false;
  }
}
