export interface FileInfo {
  isImage: boolean;
  isText: boolean;
  isPdf: boolean;
  isArchive: boolean;
  category: 'image' | 'text' | 'document' | 'archive' | 'unknown';
}

export function analyzeFile(fileType?: string, fileName?: string): FileInfo {
  const mimeType = fileType?.toLowerCase() || '';
  const extension = fileName?.toLowerCase().split('.').pop() || '';
  
  // Image detection
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const isImage = imageTypes.includes(mimeType) || imageExtensions.includes(extension);
  
  // Text detection
  const textTypes = ['text/plain', 'text/csv', 'text/html'];
  const textExtensions = ['txt', 'csv', 'log', 'md'];
  const isText = textTypes.includes(mimeType) || textExtensions.includes(extension);
  
  // PDF detection
  const isPdf = mimeType === 'application/pdf' || extension === 'pdf';
  
  // Archive detection
  const archiveTypes = ['application/zip', 'application/x-rar', 'application/x-7z-compressed'];
  const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz'];
  const isArchive = archiveTypes.includes(mimeType) || archiveExtensions.includes(extension);
  
  // Determine category
  let category: FileInfo['category'] = 'unknown';
  if (isImage) category = 'image';
  else if (isText || isPdf) category = 'document';
  else if (isArchive) category = 'archive';
  else category = 'text'; // Default for text files
  
  return {
    isImage,
    isText,
    isPdf,
    isArchive,
    category
  };
}