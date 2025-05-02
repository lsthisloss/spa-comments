import { Button, Tooltip, Upload } from 'antd';
import { UploadOutlined, PictureOutlined, SmileOutlined } from '@ant-design/icons';
import '../../styles/Comments/FormFooter.css';
import { useGradientButtonStyle } from '../../styles/GradientButtonStyles';

export default function FormFooter() {
  const { styles } = useGradientButtonStyle();
  return (
    <div className="form-footer">
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
      <Button type="primary" htmlType="submit" className={styles.linearGradientButton}>
        Post
      </Button>
    </div>
  );
}