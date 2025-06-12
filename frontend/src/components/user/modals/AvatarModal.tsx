import React, { useState } from 'react';
import { Modal, Upload, Button, message, Avatar, Tabs, Segmented } from 'antd';
import { UserOutlined, UploadOutlined, PictureOutlined, FontSizeOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { RcFile, UploadChangeParam } from 'antd/es/upload';
import { getAvatarColor } from '../../../components/ui/particles/avatarColor';

interface AvatarModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (avatarData: { 
    type: 'upload' | 'initial', 
    value: string, 
    file?: File,
    shape: 'circle' | 'square'
  }) => void;
  currentAvatarUrl?: string;
  currentAvatarShape?: 'circle' | 'square';
  userName: string;
}

const AvatarModal: React.FC<AvatarModalProps> = ({ 
  visible, 
  onClose, 
  onSave, 
  currentAvatarUrl,
  currentAvatarShape = 'circle',
  userName 
}) => {
  const [avatarType, setAvatarType] = useState<'upload' | 'initial'>(currentAvatarUrl ? 'upload' : 'initial');
  const [avatarShape, setAvatarShape] = useState<'circle' | 'square'>(currentAvatarShape);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string>(currentAvatarUrl || '');
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const initialLetter = userName.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(initialLetter);

  const handleShapeChange = (value: 'circle' | 'square') => {
    setAvatarShape(value);
  };

  const handleTypeChange = (key: string) => {
    setAvatarType(key as 'upload' | 'initial');
  };

  const handleUploadChange = (info: UploadChangeParam) => {
    if (info.file.status === 'uploading') {
      setUploadLoading(true);
      return;
    }
    
    if (info.file.status === 'done') {
      setUploadLoading(false);
      setFileList(info.fileList.slice(-1));
    }
  };

  const beforeUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return Upload.LIST_IGNORE;
    }
    
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must be smaller than 2MB!');
      return Upload.LIST_IGNORE;
    }
    
    // Создаем превью изображения
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    
    setFileList([
      {
        uid: '-1',
        name: file.name,
        status: 'done',
        url: URL.createObjectURL(file),
        originFileObj: file
      }
    ]);
    
    // Возвращаем false, чтобы предотвратить автоматическую загрузку
    return false;
  };

  const handleSave = () => {
    if (avatarType === 'initial') {
      onSave({ type: 'initial', value: initialLetter, shape: avatarShape });
    } else if (avatarType === 'upload' && fileList.length > 0) {
      const file = fileList[0].originFileObj;
      if (file) {
        onSave({ type: 'upload', value: previewImage, file, shape: avatarShape });
      } else if (currentAvatarUrl) {
        // Keep current uploaded avatar
        onSave({ type: 'upload', value: currentAvatarUrl, shape: avatarShape });
      } else {
        message.error('Please upload an image or select initial avatar');
        return;
      }
    } else if (currentAvatarUrl) {
      // Keep current uploaded avatar
      onSave({ type: 'upload', value: currentAvatarUrl, shape: avatarShape });
    } else {
      message.error('Please upload an image or select initial avatar');
      return;
    }
    
    onClose();
  };

  const items = [
    {
      key: 'initial',
      label: (
        <span>
          <FontSizeOutlined /> Initial
        </span>
      ),
      children: (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Avatar 
            style={{ 
              backgroundColor: avatarColor,
              fontSize: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }} 
            shape={avatarShape}
            size={100}
          >
            {initialLetter}
          </Avatar>
          <p style={{ marginTop: 10 }}>Using first letter of your name</p>
        </div>
      ),
    },
    {
      key: 'upload',
      label: (
        <span>
          <PictureOutlined /> Custom Image
        </span>
      ),
      children: (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Avatar 
            src={previewImage || <UserOutlined />} 
            shape={avatarShape}
            size={100}
          />
          <div style={{ marginTop: 20 }}>
            <Upload
              listType="picture"
              fileList={fileList}
              beforeUpload={beforeUpload}
              onChange={handleUploadChange}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />} loading={uploadLoading}>
                Select Image
              </Button>
            </Upload>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="Customize Avatar"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" onClick={handleSave}>
          Save
        </Button>
      ]}
    >
      <div style={{ marginBottom: 20 }}>
        <p>Avatar Shape:</p>
        <Segmented
          options={[
            { label: 'Circle', value: 'circle' },
            { label: 'Square', value: 'square' },
          ]}
          value={avatarShape}
          onChange={(value) => handleShapeChange(value as 'circle' | 'square')}
          block
        />
      </div>
      
      <Tabs 
        activeKey={avatarType}
        onChange={handleTypeChange}
        items={items}
        centered
      />
    </Modal>
  );
};

export default AvatarModal;