import { useEffect, useState } from 'react';
import { RocketOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Title, Text } = Typography;

export const AppInitializingLoader = ({ visible = true }: { visible?: boolean }) => {
  const [show, setShow] = useState(visible);
  const [animate, setAnimate] = useState(false);
  const [opacity, setOpacity] = useState(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setOpacity(1);
      
      // Запускаем анимацию сразу после монтирования
      const timer = setTimeout(() => {
        setAnimate(true);
      }, 100); // Небольшая пауза перед стартом
      
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
      }}
    >
      {/* Контейнер ракеты и пламени */}
      <div
        style={{
          height: 300,
          width: 100,
          position: 'relative',
          marginBottom: 32,
          overflow: 'visible',
        }}
      >
        {/* Ракета с пламенем */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            transform: animate
              ? 'translate(-50%, -250px)' // Летит прямо вверх, не слишком далеко
              : 'translate(-50%, 0px)', // Стартует снизу
            transition: 'transform 1s cubic-bezier(.2, 0, .8, 1)', // Медленно потом быстро (ease-in-out)
            opacity: animate ? 0 : 1, // Fade out при полете
            transitionProperty: 'transform, opacity',
            transitionDuration: '1s, 0.8s', // Исчезает чуть быстрее чем летит
            transitionTimingFunction: 'cubic-bezier(.2, 0, .8, 1), ease-out',
            width: 64,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Ракета */}
          <RocketOutlined
            style={{
              fontSize: 64,
              color: '#1677ff',
              filter: 'drop-shadow(0 8px 16px #1677ff33)',
              zIndex: 2,
              // Убрали поворот - летит прямо
            }}
          />
          
          {/* Пламя */}
          <div
            style={{
              width: animate ? 32 : 24,
              height: animate ? 80 : 50,
              marginTop: -12,
              zIndex: 1,
              transition: 'width 0.5s ease-out, height 0.5s ease-out',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: animate 
                  ? 'linear-gradient(0deg, #fff 0%, #ffeb3b 20%, #ff9800 50%, #ff3c00 80%, #d32f2f 100%)'
                  : 'linear-gradient(0deg, #fff 0%, #ff9800 40%, #ff3c00 100%)',
                borderRadius: '50% 50% 50% 50%/70% 70% 30% 30%',
                filter: animate ? 'blur(0.5px)' : 'blur(2px)',
                animation: animate 
                  ? 'flameIntense 0.08s infinite alternate' 
                  : 'flame 0.3s infinite alternate',
                opacity: 0.9,
                transition: 'background 0.5s ease-out, filter 0.5s ease-out',
              }}
            />
          </div>
        </div>
        
        <style>
          {`
            @keyframes flame {
              0% { 
                transform: scaleY(1) scaleX(1); 
                opacity: 0.8; 
              }
              100% { 
                transform: scaleY(1.1) scaleX(1.05); 
                opacity: 0.9; 
              }
            }
            
            @keyframes flameIntense {
              0% { 
                transform: scaleY(1) scaleX(1); 
                opacity: 0.9; 
              }
              100% { 
                transform: scaleY(1.4) scaleX(1.3); 
                opacity: 1; 
              }
            }
          `}
        </style>
      </div>
      
      {/* Текст - всегда по центру */}
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