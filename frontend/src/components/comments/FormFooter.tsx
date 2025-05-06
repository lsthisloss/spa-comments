import { Button, Upload, Progress, Dropdown } from 'antd';
import { PictureOutlined, CodeOutlined, FileTextOutlined } from '@ant-design/icons';
import '../../styles/main.scss';
import { useGradientButtonStyle } from '../../styles/GradientButtonStyles';
import Resizer from 'react-image-file-resizer';

interface FormFooterProps {
  text: string;
  maxLength: number;
  onPostClick: () => void;
  onInsertTag: (tag: string) => void;
  onImageUpload: (uri: string, file: File) => void;
  onFileUpload: (file: File) => void;
}

export default function FormFooter({ text, maxLength, onPostClick, onInsertTag, onImageUpload, onFileUpload }: FormFooterProps) {

  const handleFileSelect = (file: File) => {
    if (file.type !== 'text/plain') {
      alert('Only .txt files are allowed.');
      return false;
    }

    if (file.size > 100 * 1024) {
      alert('File size must not exceed 100KB.');
      return false;
    }

    onFileUpload(file);
    return false;
  };

  const handleImageUpload = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      alert('Invalid file format. Only JPG, PNG, and JPEG are allowed.');
      return false;
    }
  
    Resizer.imageFileResizer(
      file,
      320,
      240,
      file.type.split('/')[1].toUpperCase(),
      100,
      0,
      (uri) => {
        onImageUpload(uri as string, file);
      },
      'base64'
    );
    return false;
  };


  const remainingPercentage = (text.length / maxLength) * 100;
  const remainingCharacters = maxLength - text.length;
  const { styles } = useGradientButtonStyle();

  return (
    <div className="form-footer">
      <div className="icon-group">
        <Upload
          accept="image/jpeg,image/png,image/gif"
          showUploadList={false}
          beforeUpload={handleImageUpload}
        >
          <Button type="text" icon={<PictureOutlined />} className="icon-button" />
        </Upload>
          <Upload
            accept=".txt"
            showUploadList={false}
            beforeUpload={handleFileSelect}
          >
            <Button type="text" icon={<FileTextOutlined />} className="icon-button" />
          </Upload>
          <Dropdown
            menu={{
              items: [
                { key: 'b', label: <b>Bold</b> },
                { key: 'i', label: <i>Italic</i> },
                { key: 'u', label: <u>Underline</u> },
                { key: 'code', label: <code>Code</code> },
              ],
              onClick: ({ key }) => {
                console.log('Dropdown tag click:', key);
                onInsertTag(key);
              },
            }}
            trigger={['click']}
            placement="bottom"
          >
            <Button type="text" icon={<CodeOutlined />} className="icon-button" />
          </Dropdown>
      </div>
      <div className="footer-right">
        <Progress
          type="circle"
          percent={remainingPercentage}
          size={28}
          strokeColor={remainingCharacters <= 0 ? '#ff4d4f' : '#1890ff'}
          format={() => `${remainingCharacters}`}
        />
        <Button
          type="primary"
          htmlType="button"
          className={styles.linearGradientButton}
          onClick={onPostClick}
        >
          Post
        </Button>
      </div>
    </div>
  );
}