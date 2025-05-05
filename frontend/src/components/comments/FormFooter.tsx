import { Button, Upload, Progress } from 'antd';
import { UploadOutlined, PictureOutlined } from '@ant-design/icons';
import '../../styles/main.scss';
import { useGradientButtonStyle } from '../../styles/GradientButtonStyles';


interface FormFooterProps {
  text: string;
  maxLength: number;
  onPostClick: () => void;
}

export default function FormFooter({ text, maxLength, onPostClick }: FormFooterProps) {

  const remainingPercentage = (text.length / maxLength) * 100;
  const remainingCharacters = maxLength - text.length;
  const { styles } = useGradientButtonStyle();

  return (
    <div className="form-footer">
      <div className="icon-group">
        <Upload>
          <Button
            type="text"
            icon={<UploadOutlined />}
            className="icon-button"
          />
        </Upload>
        <Button
          type="text"
          icon={<PictureOutlined />}
          className="icon-button"
        />
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