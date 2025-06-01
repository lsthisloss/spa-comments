import React from 'react';
import { RocketOutlined } from '@ant-design/icons';

interface RocketWithEmojisProps {
  animate: boolean;
}

export const RocketWithEmojis: React.FC<RocketWithEmojisProps> = ({ animate }) => {
  return (
    <>
      {/* Original rocket from AppInitializingLoader */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: animate
            ? 'translate(-50%, -250px)' // Flies straight up
            : 'translate(-50%, 0px)', // Starts at bottom
          transition: 'transform 1s cubic-bezier(.2, 0, .8, 1)',
          opacity: animate ? 0 : 1, // Fade out during flight
          transitionProperty: 'transform, opacity',
          transitionDuration: '1s, 0.8s',
          transitionTimingFunction: 'cubic-bezier(.2, 0, .8, 1), ease-out',
          width: 64,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {/* Rocket icon */}
        <RocketOutlined
          style={{
            fontSize: 64,
            color: '#1677ff',
            filter: 'drop-shadow(0 8px 16px #1677ff33)',
            zIndex: 2,
          }}
        />
        
        {/* Enhanced flame */}
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

      {/* Animation styles */}
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
    </>
  );
};