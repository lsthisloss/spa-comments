import { Form, Input, Avatar } from 'antd';
import { useState, useContext, useEffect } from 'react';
import FormFooter from './FormFooter';
import CaptchaModal from '../particles/CaptchaModal';
import { WebSocketContext } from '../WebSocketContext';
import { useNavigate } from 'react-router-dom';

export default function CommentForm({ parentId }: { parentId?: string }) {
  const [text, setText] = useState('');
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [userName, setUserName] = useState('');
  const maxLength = 600;
  const socket = useContext(WebSocketContext);
  const navigate = useNavigate();

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    setUserName(userInfo.userName || 'Anonymous');
  }, []);

  const handlePostClick = () => {
    const userInfo = localStorage.getItem('userInfo');
    if (!userInfo) {
      navigate('/whoami');
      return;
    }
    setCaptchaVisible(true);
  };

  interface UserInfo {
    userName?: string;
    email?: string;
    homePage?: string;
  }

  const handleCaptchaSubmit = (data: { text: string; userInfo: UserInfo; captcha: string }) => {
    const { text, userInfo } = data;

    const commentData = {
      text,
      userName: userInfo.userName || 'Anonymous',
      email: userInfo.email || 'anonymous@example.com',
      homePage: userInfo.homePage || null,
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
    };

    if (socket) {
      console.log('Attempting to emit addComment:', commentData);
      socket.emit('addComment', commentData, (ack: { success: boolean; message?: string }) => {
        console.log('Acknowledgment from server:', ack);
      });
      console.log('Comment submitted:', commentData);
    } else {
      console.error('WebSocket connection is not available.');
    }

    setText('');
    setCaptchaVisible(false);
  };

  return (
    <>
      <Form className="comment-form">
        <div className="form-header">
          <Avatar className="comment-avatar">{userName.charAt(0).toUpperCase()}</Avatar>
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 10 }}
            placeholder="What's happening?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input-area"
            maxLength={maxLength}
          />
        </div>
        <FormFooter
          text={text}
          maxLength={maxLength}
          onPostClick={handlePostClick}
        />
      </Form>

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