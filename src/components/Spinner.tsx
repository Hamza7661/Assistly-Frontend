import React from 'react';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  text?: string;
  className?: string;
}

export default function Spinner({ 
  size = 'md', 
  color = 'primary', 
  text,
  className = '' 
}: SpinnerProps) {
  return (
    <div className={`${styles.spinnerContainer} ${styles[size]} ${styles[color]} ${className}`}>
      <div className={styles.spinner}></div>
      {text && <p className={styles.spinnerText}>{text}</p>}
    </div>
  );
}
