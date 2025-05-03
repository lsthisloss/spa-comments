import { Button, Upload, Progress } from 'antd';
import { UploadOutlined, PictureOutlined, SmileOutlined } from '@ant-design/icons';
import '../../styles/main.scss';
import { useGradientButtonStyle } from '../../styles/GradientButtonStyles';
import { ReactNode } from 'react';

interface FormFooterProps {
  children: ReactNode;
  text: string;
  maxLength: number;
}

export default function FormFooter({ children, text, maxLength }: FormFooterProps) {
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
          <Button
            type="text"
            icon={<SmileOutlined />}
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
          htmlType="submit"
          className={styles.linearGradientButton}
        >
          Post
        </Button>
      </div>
    </div>
  );
}