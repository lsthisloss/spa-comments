import Resizer from 'react-image-file-resizer';

export const resizeImageFile = (
  file: File,
  callback: (uri: string) => void
) => {
  Resizer.imageFileResizer(
    file,
    320,
    240,
    file.type.split('/')[1].toUpperCase(),
    100,
    0,
    (uri) => {
      callback(uri as string);
    },
    'base64'
  );
};