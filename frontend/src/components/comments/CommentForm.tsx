import { Form, Input, Avatar, Image } from 'antd';
import { useState, useContext, useEffect } from 'react';
import FormFooter from './FormFooter';
import CaptchaModal from '../particles/CaptchaModal';
import { WebSocketContext } from '../../services/WebSocketContext';
import { useNavigate } from 'react-router-dom';
import { UserInfo } from '../../types/comment';
import { getAvatarColor } from '../particles/avatarColor';

export default function CommentForm({ parentId, placeholder }: { parentId?: string; placeholder?: string }) {
  const [text, setText] = useState('');
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [userName, setUserName] = useState('');
  const maxLength = 600;
  const socket = useContext(WebSocketContext);
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleImageUpload = (base64: string, file?: File) => {
    setImagePreview(base64);
    if (file) setSelectedImageFile(file);
  };

  const handlePostClick = () => {
    const userInfo = localStorage.getItem('userInfo');
    if (!userInfo) {
      navigate('/whoami');
      return;
    }
    if (!text.trim()) {
      console.log('Form is empty');
      setTimeout(() => setErrorMessage('Form is empty'), 0);
      return;
    }
    setCaptchaVisible(true);
  };

  const isValidXHTML = (text: string): boolean => {
    try {
      const wrappedText = `<div>${text}</div>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(wrappedText, 'application/xhtml+xml');
      return !doc.querySelector('parsererror');
    } catch (error) {
      console.error('Error validating XHTML:', error);
      return false;
    }
  };

  const handleCaptchaSubmit = (data: { text: string; userInfo: UserInfo; captcha: string }) => {
    const { text, userInfo } = data;
  
    if (!isValidXHTML(text)) {
      setErrorMessage('Invalid XHTML in comment text.');
      return;
    }
  
    const sendComment = (imageUrl: string | null, file: File | null) => {
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          const commentData = {
            text,
            imageUrl,
            file: {
              name: file.name,
              type: file.type,
              base64,
            },
            userName: userInfo.userName || 'Anonymous',
            email: userInfo.email || 'anonymous@example.com',
            homePage: userInfo.homePage || null,
            parentId: parentId || null,
            createdAt: new Date().toISOString(),
          };
          if (socket) {
            socket.emit('addComment', commentData, (ack: { success: boolean; message?: string }) => {
              if (ack.success) {
                setSuccessMessage('Your post added to queue');
              }
              console.log('Acknowledgment from server:', ack);
            });
          }
          resetForm();
        };
        reader.readAsDataURL(file);
      } else {
        const commentData = {
          text,
          imageUrl,
          file: null,
          userName: userInfo.userName || 'Anonymous',
          email: userInfo.email || 'anonymous@example.com',
          homePage: userInfo.homePage || null,
          parentId: parentId || null,
          createdAt: new Date().toISOString(),
        };
        if (socket) {
          socket.emit('addComment', commentData, (ack: { success: boolean; message?: string }) => {
            console.log('Acknowledgment from server:', ack);
          });
        }
        resetForm();
      }
    };
  
    const resetForm = () => {
      setText('');
      setImagePreview(null);
      setSelectedFile(null);
      setSelectedImageFile(null);
      setCaptchaVisible(false);
      setSuccessMessage('Your post added to queue');
    };
  
    if (selectedImageFile && imagePreview) {
      const base64 = imagePreview.split(',')[1];
      if (socket) {
        socket.emit(
          'uploadImage',
          {
            file: base64,
            fileName: `${Date.now()}-${selectedImageFile.name}`,
          },
          (response: { imageUrl: string }) => {
            sendComment(response.imageUrl, selectedFile);
          }
        );
      }
    } else {
      sendComment(null, selectedFile);
    }
  };

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    setUserName(userInfo.userName || 'Anonymous');
  }, []);

  return (
    <>
      <Form className="comment-form">
        
        <div className="form-header">
        <Avatar
            className="comment-avatar"
            style={{
              background: getAvatarColor(userName.charAt(0)),
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </Avatar>
          <Input.TextArea
            id="comment-input"
            autoSize={{ minRows: 1, maxRows: 10 }}
            placeholder={placeholder || "What's happening?"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input-area"
            maxLength={maxLength}
          />
        </div>
        
        <FormFooter
          text={text}
          maxLength={600}
          onPostClick={handlePostClick}
          onInsertTag={(tag) => {
            const tagTemplate = `<${tag}></${tag}>`;
            setText((prev) => {
              const available = 600 - prev.length;
              console.log('Available space:', available, 'prev:', prev.length, 'tag:', tagTemplate.length);
              if (available <= 0) return prev;
              return prev + tagTemplate.slice(0, available);
            });
          }}
          onImageUpload={(base64, file) => handleImageUpload(base64, file)}
          onFileUpload={(file) => setSelectedFile(file)}
        />

        {imagePreview && (
          <div
            className="image-preview"
            style={{
              marginTop: '0',
              textAlign: 'start',
              marginBottom: '16px',
              marginLeft: '38px',
            }}
          >
            <Image
              src={imagePreview}
              alt="Preview"
              style={{ maxWidth: '180px', maxHeight: '120px', borderRadius: '8px' }}
            />
          </div>
        )}
      </Form>
      {errorMessage && (
        <div className="error-toast show">
          {errorMessage}
        </div>
      )}
      
      {successMessage && (
        <div className={`success-toast show`}>
          {successMessage}
        </div>
      )}
      {selectedFile && (
          <div style={{ marginLeft: 38, marginBottom: 12, color: '#888' }}>
            <span>📄 {selectedFile.name}</span>
          </div>
        )}
      <CaptchaModal
        visible={captchaVisible}
        onClose={() => setCaptchaVisible(false)}
        onSubmit={handleCaptchaSubmit}
        text={text}
        userInfo={JSON.parse(localStorage.getItem('userInfo') || '{}')}
      />
    </>
  );
}