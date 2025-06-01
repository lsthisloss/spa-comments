import { useEffect, useState } from 'react';
import { Typography } from 'antd';
import { RocketWithEmojis } from './particles/animation/RocketWithEmojis';

const { Title, Text } = Typography;

export const AppInitializingLoader = ({ visible = true }: { visible?: boolean }) => {
  const [show, setShow] = useState(visible);
  const [animate, setAnimate] = useState(false);
  const [opacity, setOpacity] = useState(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setOpacity(1);
      
      // Start animation shortly after mounting
      const timer = setTimeout(() => {
        setAnimate(true);
      }, 100);
      
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
      setOpacity(0);
      const timer = setTimeout(() => {
        setShow(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#fff',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'opacity 1s cubic-bezier(.4,2,.6,1)',
        opacity,
        pointerEvents: visible ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Rocket container */}
      <div
        style={{
          height: 300,
          width: '100%',
          position: 'relative',
          marginBottom: 32,
          overflow: 'visible',
        }}
      >
        <RocketWithEmojis animate={animate} />
      </div>
      
      {/* Text - always centered */}
      <div
        style={{
          textAlign: 'center',
          opacity: animate ? 0 : 1,
          transform: animate ? 'translateY(20px)' : 'translateY(0)',
          transition: 'opacity 1.5s ease-out, transform 1.5s ease-out',
        }}
      >
        <Title level={3} style={{ margin: 0, color: '#1677ff', letterSpacing: 2 }}>
          Jeez!
        </Title>
        <Text type="secondary" style={{ fontSize: 16, color: '#222' }}>
          developed by sk8
        </Text>
      </div>
    </div>
  );
};