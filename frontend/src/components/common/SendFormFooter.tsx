import { Button, Upload, Progress, Dropdown } from 'antd';
import { PictureOutlined, CodeOutlined, FileTextOutlined } from '@ant-design/icons';

interface FormFooterProps {
  text: string;
  maxLength: number;
  onPostClick: () => void;
  onInsertTag: (tag: string) => void;
  onImageUpload: (file: File) => void;
  onFileUpload: (file: File) => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function SendFormFooter({ 
  text, 
  maxLength, 
  onPostClick, 
  onInsertTag, 
  onImageUpload, 
  onFileUpload,
  disabled = false,
  loading = false
}: FormFooterProps) {

  const handleImageSelect = (file: File) => {
    onImageUpload(file);
    return false;
  };

  const handleFileSelect = (file: File) => {
    onFileUpload(file);
    return false; 
  };

  const isPostDisabled = disabled || loading || text.trim().length === 0 || text.length > maxLength;
  const remainingPercentage = (text.length / maxLength) * 100;
  const remainingCharacters = maxLength - text.length;

  return (
    <div className="form-footer">
      <div className="icon-group">
        <Upload
          accept="image/jpeg,image/png,image/gif"
          showUploadList={false}
          beforeUpload={handleImageSelect}
          disabled={disabled}
        >
          <Button 
            type="text" 
            icon={<PictureOutlined />} 
            className={`icon-button ${disabled ? 'custom-disabled' : ''}`}
            disabled={false} 
            title="Upload image (JPG, PNG, GIF)"
          />
        </Upload>
        
        <Upload
          accept=".txt"
          showUploadList={false}
          beforeUpload={handleFileSelect}
          disabled={disabled}
        >
          <Button 
            type="text" 
            icon={<FileTextOutlined />} 
            className={`icon-button ${disabled ? 'custom-disabled' : ''}`}
            disabled={false}
            title="Upload text file (.txt, max 100KB)"
          />
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
              if (!disabled) {
                onInsertTag(key);
              }
            },
          }}
          trigger={['click']}
          placement="bottom"
          disabled={disabled}
        >
          <Button 
            type="text" 
            icon={<CodeOutlined />} 
            className={`icon-button ${disabled ? 'custom-disabled' : ''}`}
            disabled={false}
            title="Insert HTML tags"
          />
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
          className={`linearGradientButton ${isPostDisabled ? 'custom-disabled' : ''} ${loading ? 'loading' : ''}`}
          onClick={isPostDisabled ? undefined : onPostClick}
          disabled={false}
          loading={false}
        >
          {loading ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </div>
  );
}