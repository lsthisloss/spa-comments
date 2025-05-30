import React, { useEffect, useState, useRef } from 'react';
import { RocketOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Title, Text } = Typography;

export const AppInitializingLoader = ({ visible = true }: { visible?: boolean }) => {
  const [show, setShow] = useState(visible);
  const [animate, setAnimate] = useState(false);
  const [opacity, setOpacity] = useState(visible ? 1 : 0);
  const isUnmounting = useRef(false);

  useEffect(() => {
    if (visible) {
      // Если уже показываем — не сбрасываем анимацию
      if (!show) setShow(true);
      setTimeout(() => {
        if (!isUnmounting.current) {
          setAnimate(true);
          setOpacity(1);
        }
      }, 10);
    } else {
      isUnmounting.current = true;
      setAnimate(true); // не сбрасываем в false!
      setOpacity(0);
      setTimeout(() => {
        setShow(false);
        isUnmounting.current = false;
      }, 1000);
    }
    // eslint-disable-next-line
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
      }}
    >
      {/* Контейнер ракеты и пламени, улетают вместе */}
      <div
        style={{
          height: 180,
          width: 80,
          position: 'relative',
          marginBottom: 32,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            transform: animate
              ? 'translate(-50%, -220px)'
              : 'translate(-50%, 0)',
            transition: 'transform 1s cubic-bezier(.4,2,.6,1)',
            width: 64,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <RocketOutlined
            style={{
              fontSize: 64,
              color: '#1677ff',
              filter: 'drop-shadow(0 8px 16px #1677ff33)',
              zIndex: 2,
            }}
          />
          {/* Пламя под ракетой */}
          <div
            style={{
              width: 22,
              height: 44,
              marginTop: -8,
              zIndex: 1,
              opacity: animate ? 1 : 0.8,
              transition: 'opacity 0.5s',
              pointerEvents: 'none',
              display: animate ? 'block' : 'block',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'radial-gradient(ellipse at center, #fff 0%, #ff9800 60%, #ff3c00 100%)',
                borderRadius: '50% 50% 60% 60%/60% 60% 100% 100%',
                filter: 'blur(2px)',
                animation: animate ? 'flame 0.6s infinite alternate' : 'none',
                opacity: visible ? 0.85 : 0,
              }}
            />
          </div>
        </div>
        <style>
          {`
            @keyframes flame {
              0% { transform: scaleY(1) scaleX(1); opacity: 0.85; }
              100% { transform: scaleY(1.25) scaleX(1.1); opacity: 1; }
            }
          `}
        </style>
      </div>
      <Title level={3} style={{ margin: 0, color: '#1677ff', letterSpacing: 2 }}>
        Jeez!
      </Title>
      <Text type="secondary" style={{ fontSize: 16, marginBottom: 16, color: '#222' }}>
        developed by sk8
      </Text>
    </div>
  );
};