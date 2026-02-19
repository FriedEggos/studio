import imageCompression from 'browser-image-compression';

export async function compressAndResizeImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.19, // Max size ~195KB to be safe under 200KB
    maxWidthOrHeight: 512,
    useWebWorker: true,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Image compression error:', error);
    // If compression fails, return the original file but warn the user.
    // In a real app, you might want to show a toast message here.
    return file;
  }
}

export async function compressAndResizeDataUrl(dataUrl: string, fileName: string): Promise<File> {
  const imageFile = imageCompression.dataUrlToFile(dataUrl, fileName);
  return compressAndResizeImage(imageFile);
}
