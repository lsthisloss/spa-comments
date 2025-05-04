import { Button, Upload, Progress } from 'antd';
import { UploadOutlined, PictureOutlined } from '@ant-design/icons';
import '../../styles/main.scss';
import { useGradientButtonStyle } from '../../styles/GradientButtonStyles';
import { ReactNode, useState } from 'react';
import CaptchaModal from '../particles/CaptchaModal';

interface FormFooterProps {
  children: ReactNode;
  text: string;
  maxLength: number;
}

export default function FormFooter({ children, text, maxLength }: FormFooterProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handlePostClick = () => {
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const remainingPercentage = (text.length / maxLength) * 100;
  const remainingCharacters = maxLength - text.length;
  const { styles } = useGradientButtonStyle();

  return (
    <div className="form-footer">
      {children}
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
          width={28}
          strokeColor={remainingCharacters <= 0 ? '#ff4d4f' : '#1890ff'}
          format={() => `${remainingCharacters}`}
        />
        <Button
          type="primary"
          htmlType="button"
          className={styles.linearGradientButton}
          onClick={handlePostClick}
        >
          Post
        </Button>
      </div>

      {/* Используем CaptchaModal */}
      <CaptchaModal visible={isModalVisible} onClose={handleModalClose} />
    </div>
  );
}