export default function createPausedUrl (sourceUrl) {
  const workerFunc = async ({ data: sourceUrl }) => {
    const response = await fetch(sourceUrl, { cache: 'force-cache' });
    const contentType = response.headers.get('Content-Type');
    let canvas;

    /* globals ImageDecoder */
    if (typeof ImageDecoder === 'function' && await ImageDecoder.isTypeSupported(contentType)) {
      const decoder = new ImageDecoder({
        type: contentType,
        data: response.body,
        preferAnimation: true
      });
      const { image: videoFrame } = await decoder.decode();
      if (!decoder.tracks.selectedTrack.animated) {
        // source image is not animated; decline to pause it
        return undefined;
      }
      canvas = new OffscreenCanvas(videoFrame.displayWidth, videoFrame.displayHeight);
      canvas.getContext('2d').drawImage(videoFrame, 0, 0);
    } else {
      const imageBitmap = await response.blob().then(window.createImageBitmap);
      canvas = new OffscreenCanvas(imageBitmap.displayWidth, imageBitmap.displayHeight);
      canvas.getContext('2d').drawImage(imageBitmap, 0, 0);
    }
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 1 });
    postMessage({ sourceUrl, result: URL.createObjectURL(blob) });
  };

  window.createPausedUrlWorker ??= new Worker(
    URL.createObjectURL(new Blob([`self.onmessage = ${workerFunc.toString()};`], { type: 'text/javascript' })),
    { type: 'module' }
  );

  return new Promise(resolve => {
    const callback = ({ data }) => {
      if (data.sourceUrl === sourceUrl) {
        resolve(data.result);
        window.createPausedUrlWorker.removeEventListener('message', callback);
      }
    };
    window.createPausedUrlWorker.addEventListener('message', callback);
    window.createPausedUrlWorker.postMessage(sourceUrl);
  });
}
