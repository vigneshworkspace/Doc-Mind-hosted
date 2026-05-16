import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <img src="/LogoMain.png" alt="DocMind Logo" className={className} />
  );
};

export default Logo;