import { createStyles } from 'antd-style';

export const useGradientButtonStyle = createStyles(({ prefixCls, css }) => ({
  linearGradientButton: css`
    &.${prefixCls}-btn-primary:not([disabled]):not(.${prefixCls}-btn-dangerous) {
      position: relative;
      overflow: hidden; 
      color: #fff; 
      background: linear-gradient(45deg,#00aaff, #5b09cd, #c91d55); 
      background-size: 200% 200%; 
      transition: background-position 0.5s ease; 

      &:hover {
        background-position: 100% 0; 
      }

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(45deg, #ff4500, #ffae00, #ff4500, #ff0000);
        background-size: 300% 300%; 
        z-index: -1; 
        animation: burning-effect 5s infinite; 
      }
    }
  `,

  '@keyframes burning-effect': css`
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  `,
}));