import { Button, Tooltip, Upload, Progress } from 'antd';
import { UploadOutlined, PictureOutlined, SmileOutlined } from '@ant-design/icons';
import '../../styles/Comments/FormFooter.css';
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
        <Tooltip title="Upload" placement="bottom">
          <Upload>
            <Button type="text" icon={<UploadOutlined />} className="icon-button" />
          </Upload>
        </Tooltip>
        <Tooltip title="Picture" placement="bottom">
          <Button type="text" icon={<PictureOutlined />} className="icon-button" />
        </Tooltip>
        <Tooltip title="Emoji" placement="bottom">
          <Button type="text" icon={<SmileOutlined />} className="icon-button" />
        </Tooltip>
      </div>
      <div className="footer-right">
        <Tooltip title={`Remaining characters: ${remainingCharacters}`} placement="bottom">
          <Progress
            type="circle"
            percent={remainingPercentage}
            width={28} 
            strokeColor={
              remainingCharacters <= 0 ? '#ff4d4f' : '#1890ff'
            }
            format={() => `${remainingCharacters}`}
          />
        </Tooltip>
        <Button type="primary" htmlType="submit" className={styles.linearGradientButton}>
          Post
        </Button>
      </div>
    </div>
  );
}